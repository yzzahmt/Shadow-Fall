/* ============================================================
   SHADOW FALL — Procedural Audio Engine
   Tamamen Web Audio API ile üretilen ses: hiç dosya yok.
   ============================================================ */
'use strict';

const SFAudio = (() => {
  let ctx = null;
  let master, sfxBus, musicBus, ambBus;
  let started = false;
  let vol = { sfx: 0.8, music: 0.7 };

  // ---- noise buffer cache ----
  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function init() {
    if (started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    master = ctx.createGain(); master.gain.value = 1;
    // hafif kompresyon — sinematik tutarlılık
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
    master.connect(comp); comp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = vol.sfx * 0.9; ambBus.connect(master);

    /* ---- müzik yankısı (prosedürel salon reverb) ----
       piyano + dronu geniş, sinematik bir mekâna oturtur; kuru sinyal korunur */
    musicReverb = ctx.createConvolver();
    musicReverb.buffer = makeImpulse(3.4, 2.8);
    const revGain = ctx.createGain(); revGain.gain.value = 0.34;
    const revPre = ctx.createBiquadFilter();    // tiz tıslamayı yumuşat
    revPre.type = 'lowpass'; revPre.frequency.value = 4200;
    musicBus.connect(revPre); revPre.connect(musicReverb);
    musicReverb.connect(revGain); revGain.connect(master);
    started = true;
  }

  /* prosedürel impulse response — gürültü kuyruğu üstel sönümle */
  let musicReverb = null;
  function makeImpulse(dur, decay) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setVol(s, m) {
    vol.sfx = s; vol.music = m;
    if (!started) return;
    sfxBus.gain.value = s; musicBus.gain.value = m; ambBus.gain.value = s * 0.9;
  }

  // ============ AMBIENCE (sürekli katmanlar) ============
  const amb = { nodes: [], rainGain: null, windGain: null, droneGain: null, heartGain: null, heartRate: 1 };

  function startAmbience() {
    if (!started || amb.nodes.length) return;
    // --- rüzgâr: filtreli gürültü + yavaş LFO ---
    const wind = ctx.createBufferSource(); wind.buffer = getNoise(); wind.loop = true;
    const wF = ctx.createBiquadFilter(); wF.type = 'bandpass'; wF.frequency.value = 280; wF.Q.value = 0.6;
    const wG = ctx.createGain(); wG.gain.value = 0.0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(wF.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.045;
    const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.035;
    lfo2.connect(lfo2G); lfo2G.connect(wG.gain);
    wind.connect(wF); wF.connect(wG); wG.connect(ambBus);
    wind.start(); lfo.start(); lfo2.start();
    amb.windGain = wG;
    amb.nodes.push(wind, lfo, lfo2);

    // --- yağmur: yüksek frekanslı yoğun gürültü ---
    const rain = ctx.createBufferSource(); rain.buffer = getNoise(); rain.loop = true; rain.playbackRate.value = 1.7;
    const rF = ctx.createBiquadFilter(); rF.type = 'highpass'; rF.frequency.value = 1800;
    const rF2 = ctx.createBiquadFilter(); rF2.type = 'lowpass'; rF2.frequency.value = 7500;
    const rG = ctx.createGain(); rG.gain.value = 0.0;
    rain.connect(rF); rF.connect(rF2); rF2.connect(rG); rG.connect(ambBus);
    rain.start();
    amb.rainGain = rG;
    amb.nodes.push(rain);

    // --- alçak dron: huzursuzluk hissi ---
    const dr1 = ctx.createOscillator(); dr1.type = 'sine'; dr1.frequency.value = 48;
    const dr2 = ctx.createOscillator(); dr2.type = 'sine'; dr2.frequency.value = 48.7; // beat
    const dG = ctx.createGain(); dG.gain.value = 0.0;
    dr1.connect(dG); dr2.connect(dG); dG.connect(musicBus);
    dr1.start(); dr2.start();
    amb.droneGain = dG;
    amb.nodes.push(dr1, dr2);

    // --- kalp atışı (tehlike yakınken) ---
    amb.heartGain = ctx.createGain(); amb.heartGain.gain.value = 0;
    amb.heartGain.connect(sfxBus);
    scheduleHeart();
  }

  let heartTimer = null;
  function scheduleHeart() {
    if (!started) return;
    const beat = () => {
      if (!amb.heartGain) return;
      const t = ctx.currentTime;
      for (const [off, g] of [[0, 1], [0.18, 0.6]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(58, t + off);
        o.frequency.exponentialRampToValueAtTime(35, t + off + 0.12);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, t + off);
        og.gain.linearRampToValueAtTime(g, t + off + 0.015);
        og.gain.exponentialRampToValueAtTime(0.001, t + off + 0.16);
        o.connect(og); og.connect(amb.heartGain);
        o.start(t + off); o.stop(t + off + 0.2);
      }
      heartTimer = setTimeout(beat, 800 / amb.heartRate);
    };
    beat();
  }

  // tension 0..1 → kalp + dron yoğunluğu
  function setTension(v) {
    if (!started || !amb.heartGain) return;
    const t = ctx.currentTime;
    amb.heartGain.gain.linearRampToValueAtTime(v * 0.5, t + 0.5);
    amb.droneGain.gain.linearRampToValueAtTime(0.012 + v * 0.05, t + 1.2);
    amb.heartRate = 1 + v * 1.1;
  }
  function setWeather(rainV, windV) {
    if (!started || !amb.rainGain) return;
    const t = ctx.currentTime;
    amb.rainGain.gain.linearRampToValueAtTime(rainV * 0.16, t + 2);
    amb.windGain.gain.linearRampToValueAtTime(0.03 + windV * 0.08, t + 2);
  }

  // ============ ONE-SHOT SFX ============
  function envGain(t, a, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    return g;
  }

  // ayak sesi — malzemeye göre (earth, wood, concrete, metal, grass)
  function footstep(material, runFactor) {
    if (!started) return;
    const t = ctx.currentTime;
    const v = 0.10 + runFactor * 0.10 + Math.random() * 0.03;
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass';
    let dur = 0.09;
    switch (material) {
      case 'wood':
        f.type = 'bandpass'; f.frequency.value = 320 + Math.random() * 120; f.Q.value = 1.6;
        f2.frequency.value = 1400; dur = 0.11;
        // ahşap tok vuruş
        const th = ctx.createOscillator(); th.type = 'sine';
        th.frequency.setValueAtTime(170 + Math.random() * 40, t);
        th.frequency.exponentialRampToValueAtTime(70, t + 0.07);
        const thG = envGain(t, 0.004, v * 0.8, 0.08);
        th.connect(thG); thG.connect(sfxBus); th.start(t); th.stop(t + 0.1);
        break;
      case 'metal':
        f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 4;
        f2.frequency.value = 4000; dur = 0.16;
        break;
      case 'concrete':
        f.type = 'highpass'; f.frequency.value = 500; f2.frequency.value = 3200; dur = 0.07;
        break;
      case 'grass':
        f.type = 'highpass'; f.frequency.value = 1500; f2.frequency.value = 6000; dur = 0.1;
        break;
      default: // earth
        f.type = 'lowpass'; f.frequency.value = 700; f2.frequency.value = 900; dur = 0.08;
    }
    const g = envGain(t, 0.006, v, dur);
    src.connect(f); f.connect(f2); f2.connect(g); g.connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
    // yumuşak gövde alt-vuruşu: adıma ağırlık/et hissi verir (kuru tıkırtı yerine)
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(95 + Math.random() * 25, t);
    sub.frequency.exponentialRampToValueAtTime(48, t + 0.07);
    const subG = envGain(t, 0.004, v * (0.45 + runFactor * 0.35), 0.1);
    sub.connect(subG); subG.connect(sfxBus); sub.start(t); sub.stop(t + 0.13);
  }

  /* zıplama: sessiz (kullanıcı isteği — tonlu sıçrama sesi yok) */
  function jump() {}

  function land(impact, material) {
    if (!started) return;
    const t = ctx.currentTime;
    void t;   // tonlu "tınk" yok — iniş yalnızca doğal ayak sürtünmesiyle duyulur
    footstep(material || 'earth', impact);
    if (impact > 0.6) footstep(material || 'earth', impact * 0.7);
  }

  // levye gıcırtısı — kutu açma
  function pry(progress01) {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const base = 140 + progress01 * 260;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.22);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = base * 3; f.Q.value = 8;
    const g = envGain(t, 0.03, 0.07, 0.3);
    o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.32);
  }

  // kutu kapağı kırılıp açılır + malzeme dökülür
  function crateBurst() {
    if (!started) return;
    const t = ctx.currentTime;
    // kırılma çatlaması
    for (let i = 0; i < 5; i++) {
      const off = i * 0.03 + Math.random() * 0.02;
      const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.6 + Math.random();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 250 + Math.random() * 900; f.Q.value = 2.5;
      const g = envGain(t + off, 0.004, 0.14, 0.12);
      src.connect(f); f.connect(g); g.connect(sfxBus);
      src.start(t + off); src.stop(t + off + 0.15);
    }
    thud(0.5);
  }

  // eşya yere düşmesi — fizik çarpışmalarından çağrılır
  function itemHit(kind, impact) {
    if (!started || impact < 0.05) return;
    const t = ctx.currentTime;
    const v = Math.min(0.25, impact * 0.3);
    if (kind === 'metal') {
      const o = ctx.createOscillator(); o.type = 'triangle';
      const fr = 700 + Math.random() * 900;
      o.frequency.setValueAtTime(fr, t); o.frequency.exponentialRampToValueAtTime(fr * 0.7, t + 0.2);
      const g = envGain(t, 0.002, v, 0.3);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.32);
    } else if (kind === 'soft') {
      const src = ctx.createBufferSource(); src.buffer = getNoise();
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = envGain(t, 0.005, v * 0.6, 0.08);
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.1);
    } else { // wood / generic
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(220 + Math.random() * 80, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
      const g = envGain(t, 0.003, v, 0.12);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.14);
    }
  }

  function thud(v) {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    const g = envGain(t, 0.006, v * 0.5, 0.35);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.4);
  }

  function pickup() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 660;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 990;
    const g = envGain(t, 0.01, 0.06, 0.5);
    const g2 = envGain(t + 0.08, 0.01, 0.04, 0.5);
    o.connect(g); o2.connect(g2); g.connect(sfxBus); g2.connect(sfxBus);
    o.start(t); o.stop(t + 0.55); o2.start(t + 0.08); o2.stop(t + 0.6);
  }

  function doorUnlock() {
    if (!started) return;
    const t = ctx.currentTime;
    // anahtar dönüşü: metalik klik dizisi
    for (let i = 0; i < 3; i++) {
      const off = i * 0.13;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1800 - i * 300;
      const g = envGain(t + off, 0.002, 0.035, 0.04);
      o.connect(g); g.connect(sfxBus); o.start(t + off); o.stop(t + off + 0.05);
    }
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t + 0.4); o.frequency.exponentialRampToValueAtTime(40, t + 0.7);
    const g = envGain(t + 0.4, 0.02, 0.18, 0.4);
    o.connect(g); g.connect(sfxBus); o.start(t + 0.4); o.stop(t + 0.85);
  }

  function doorCreak() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(160, t + 0.7);
    o.frequency.linearRampToValueAtTime(120, t + 1.1);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 9;
    const g = envGain(t, 0.08, 0.05, 1.2);
    o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.25);
  }

  // canavar kükremesi — katmanlı, korkunç
  function monsterRoar(big) {
    if (!started) return;
    const t = ctx.currentTime;
    const dur = big ? 1.8 : 0.9;
    const v = big ? 0.4 : 0.22;
    // alt katman: distorted düşük osc
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, t);
    o.frequency.linearRampToValueAtTime(95, t + dur * 0.3);
    o.frequency.linearRampToValueAtTime(40, t + dur);
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
    sh.curve = curve;
    const g = envGain(t, 0.06, v, dur);
    o.connect(sh); sh.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.1);
    // üst katman: hırıltı (modüle gürültü)
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 350; f.Q.value = 1.2;
    const ng = envGain(t, 0.1, v * 0.7, dur);
    const am = ctx.createOscillator(); am.frequency.value = 28;
    const amG = ctx.createGain(); amG.gain.value = 0.5;
    am.connect(amG); amG.connect(ng.gain);
    src.connect(f); f.connect(ng); ng.connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.1); am.start(t); am.stop(t + dur);
  }

  function monsterStep() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(26, t + 0.2);
    const g = envGain(t, 0.004, 0.3, 0.3);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.35);
  }

  function gunshot() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.9;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.18);
    const g = envGain(t, 0.001, 0.4, 0.25);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.3);
    thud(0.8);
  }

  function ricochet() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const fr = 2400 + Math.random() * 1500;
    o.frequency.setValueAtTime(fr, t); o.frequency.exponentialRampToValueAtTime(fr * 0.4, t + 0.16);
    const g = envGain(t, 0.001, 0.05, 0.18);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.2);
  }

  function hurt() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    const g = envGain(t, 0.005, 0.25, 0.3);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.35);
  }

  function bandage() {
    if (!started) return;
    const t = ctx.currentTime;
    // kumaş hışırtısı
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 3; i++) {
      g.gain.linearRampToValueAtTime(0.05, t + i * 0.25 + 0.08);
      g.gain.linearRampToValueAtTime(0.01, t + i * 0.25 + 0.22);
    }
    g.gain.linearRampToValueAtTime(0, t + 0.9);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 1);
    // hafif iyileşme tonu
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 520;
    const og = envGain(t + 0.7, 0.05, 0.03, 0.6);
    o.connect(og); og.connect(sfxBus); o.start(t + 0.7); o.stop(t + 1.4);
  }

  function punch() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = envGain(t, 0.002, 0.5, 0.12);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.15);
    thud(1);
  }

  /* ============ YENİ SFX — v4 ============ */
  function splash(power = 0.6) {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.7;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    const g = envGain(t, 0.008, 0.12 + power * 0.2, 0.45);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.5);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    const og = envGain(t, 0.005, power * 0.18, 0.3);
    o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + 0.35);
  }

  function swimStroke() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = envGain(t, 0.04, 0.07, 0.35);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.4);
  }

  function windGust(power = 0.5) {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(700, t + 0.8);
    f.frequency.linearRampToValueAtTime(250, t + 2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(power * 0.12, t + 0.6);
    g.gain.linearRampToValueAtTime(0, t + 2.2);
    src.connect(f); f.connect(g); g.connect(ambBus); src.start(t); src.stop(t + 2.3);
  }

  function thunder() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.28;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 2.2);
    const g = envGain(t, 0.02, 0.4, 2.4);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 2.5);
  }

  function flashClick(on) {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = on ? 2200 : 1500;
    const g = envGain(t, 0.001, 0.04, 0.035);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.04);
  }

  function batterySlot() {
    if (!started) return;
    const t = ctx.currentTime;
    for (const [off, fr] of [[0, 900], [0.1, 1400]]) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr;
      const g = envGain(t + off, 0.002, 0.05, 0.05);
      o.connect(g); g.connect(sfxBus); o.start(t + off); o.stop(t + off + 0.06);
    }
  }

  function magDrop() { itemHit('metal', 0.5); }
  function magIn() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 700;
    const g = envGain(t, 0.001, 0.09, 0.06);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.07);
  }
  function rack() {
    if (!started) return;
    const t = ctx.currentTime;
    for (const [off, fr] of [[0, 1300], [0.07, 800]]) {
      const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 1.6;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = 5;
      const g = envGain(t + off, 0.001, 0.07, 0.06);
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t + off); src.stop(t + off + 0.08);
    }
  }

  function playerShot() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 1.2;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(6500, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.14);
    const g = envGain(t, 0.001, 0.36, 0.2);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.25);
    thud(0.6);
  }

  function dryFire() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1100;
    const g = envGain(t, 0.001, 0.05, 0.04);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.05);
  }

  function leverCreak() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(90, t + 0.45);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 7;
    const g = envGain(t, 0.02, 0.09, 0.55);
    o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.6);
  }

  function generatorStart() {
    if (!started) return;
    const t = ctx.currentTime;
    // marş + rölanti
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(30, t);
    o.frequency.linearRampToValueAtTime(80, t + 1.2);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.8);
    g.gain.linearRampToValueAtTime(0.05, t + 3);
    g.gain.linearRampToValueAtTime(0, t + 8);
    const am = ctx.createOscillator(); am.frequency.value = 16;
    const amG = ctx.createGain(); amG.gain.value = 0.4;
    am.connect(amG); amG.connect(g.gain);
    o.connect(f); f.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + 8.2); am.start(t); am.stop(t + 8.2);
  }

  function carStart() {
    if (!started) return;
    const t = ctx.currentTime;
    // marş motoru dönüşü
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90 + i * 8;
      const g = envGain(t + i * 0.22, 0.02, 0.07, 0.2);
      o.connect(g); g.connect(sfxBus); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.22);
    }
  }

  function houndGrowl(big) {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(big ? 70 : 95, t);
    o.frequency.linearRampToValueAtTime(big ? 110 : 130, t + 0.4);
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const xx = i / 128 - 1; curve[i] = Math.tanh(xx * 5); }
    sh.curve = curve;
    const g = envGain(t, 0.04, big ? 0.22 : 0.14, 0.7);
    o.connect(sh); sh.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.75);
  }
  function houndYelp() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(280, t + 0.2);
    const g = envGain(t, 0.004, 0.16, 0.25);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.3);
  }
  function lurkerWhisper() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.4;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(2000, t);
    f.frequency.linearRampToValueAtTime(900, t + 1.4);
    f.Q.value = 6;
    const g = envGain(t, 0.3, 0.06, 1.6);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 1.7);
  }

  function carEngine() {
    if (!started) return null;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.08, t + 1);
    const am = ctx.createOscillator(); am.frequency.value = 13;
    const amG = ctx.createGain(); amG.gain.value = 0.35;
    am.connect(amG); amG.connect(g.gain);
    o.connect(f); f.connect(g); g.connect(sfxBus);
    o.start(t); am.start(t);
    return { stop(fade = 2) { const tt = ctx.currentTime; g.gain.linearRampToValueAtTime(0, tt + fade); o.stop(tt + fade + 0.1); am.stop(tt + fade + 0.1); } };
  }

  // ============ MUSIC — duygusal piyano (intro & anlar) ============
  // basit Karplus-yumuşatmalı sine-tabanlı "felt piano" hissi
  /* ============================================================
     ATMOSFERİK SKOR — melodi yok, piyano yok.
     Karanlık, yavaş evrilen drone + uzak metalik yaylı tınılar +
     uzak gümbürtüler + rüzgâr dokusu. Tehlikede altta nabız ve
     tiz yaylı tremolosu yükselir. Hepsi prosedürel.
     ============================================================ */
  const score = { on: false, nodes: [], timer: null, intensity: 0.5, root: 55, out: null, actOut: null, act: 0, actTarget: 0, actTimer: null };
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  const MOOD_ROOTS = { forest: 55, road: 51.9, swamp: 49, mine: 43.65, factory: 46.25, river: 51.9, city: 49, fortress: 41.2, spire: 46.25, gate: 55 };

  /* uzak, eğilmiş metal/cam yayı — inharmonik kısmi sesler, yavaş atak */
  function bowedMetal(freq, when, dur, velo) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(velo, t + dur * 0.35);
    out.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    out.connect(lp); lp.connect(musicBus);
    [1, 2.76, 5.40, 8.93].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = freq * m * (1 + (Math.random() - 0.5) * 0.004);
      const g = ctx.createGain(); g.gain.value = [0.5, 0.22, 0.1, 0.05][i];
      const vib = ctx.createOscillator(); vib.frequency.value = 0.15 + Math.random() * 0.3;
      const vg = ctx.createGain(); vg.gain.value = freq * m * 0.003;
      vib.connect(vg); vg.connect(o.frequency);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.1); vib.start(t); vib.stop(t + dur + 0.1);
    });
  }
  /* çok uzaktan gelen boğuk gümbürtü */
  function distantBoom(when, velo) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(26, t + 2.2);
    const g = envGain(t, 0.06, velo, 3.2);
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
    const g2 = envGain(t, 0.04, velo * 0.5, 2.6);
    o.connect(g); g.connect(musicBus);
    src.connect(lp); lp.connect(g2); g2.connect(musicBus);
    o.start(t); o.stop(t + 3.3); src.start(t); src.stop(t + 2.8);
  }
  /* yavaş şişip sönen karanlık küme (yaylı/koro dokusu) */
  function padChord(freqs, when, dur, velo = 0.5) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(velo * 0.12, t + dur * 0.4);
    out.gain.linearRampToValueAtTime(0, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(900, t + dur * 0.45); lp.frequency.linearRampToValueAtTime(300, t + dur);
    out.connect(lp); lp.connect(musicBus);
    for (const f of freqs) for (const det of [-6, 5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(out); o.start(t); o.stop(t + dur + 0.1);
    }
  }

  /* ============================================================
     PERDE SKORU — oyun ilerledikçe müzik koyulaşır:
     orman seyrek ve üşümüş → yol/bataklık saat tikleri ve alçak nabız →
     maden/fabrika mekanik ritim → şehir/kale savaş davulları ve sirenler →
     kule/geçit koro kümeleri. Her perdenin kendi "cam" motifi var: aşağı
     inen dört nota; geç perdelerde bir yarım ton yanında ikinci bir sesle
     çatışır (huzursuzluk artar).
     ============================================================ */
  const ACT_SCORE = [null,
    { base: 0.15, motif: 34, tick: 0,    drum: 0,  choir: 0.2, siren: 0 },   // 1 orman
    { base: 0.25, motif: 30, tick: 1.1,  drum: 0,  choir: 0.2, siren: 0 },   // 2 kül yolu
    { base: 0.3,  motif: 30, tick: 0,    drum: 58, choir: 0.3, siren: 0 },   // 3 bataklık
    { base: 0.4,  motif: 26, tick: 0.9,  drum: 64, choir: 0.3, siren: 0 },   // 4 maden
    { base: 0.5,  motif: 26, tick: 0,    drum: 76, choir: 0.3, siren: 0, mech: true }, // 5 fabrika
    { base: 0.5,  motif: 24, tick: 0,    drum: 82, choir: 0.4, siren: 0 },   // 6 nehir
    { base: 0.6,  motif: 22, tick: 0.75, drum: 84, choir: 0.4, siren: 1 },   // 7 ölü şehir
    { base: 0.7,  motif: 20, tick: 0,    drum: 88, choir: 0.5, siren: 1, war: true },  // 8 kale
    { base: 0.8,  motif: 18, tick: 0.5,  drum: 92, choir: 0.7, siren: 0, war: true },  // 9 sis kulesi
    { base: 0.9,  motif: 16, tick: 0.45, drum: 96, choir: 0.9, siren: 1, war: true },  // 10 geçit
  ];

  /* boğuk savaş davulu / tom: perde düşen sinüs + kısa gürültü vuruşu */
  function drumHit(when, freq, velo) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.8, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    const g = envGain(t, 0.004, velo, 0.55);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.6);
    const n = ctx.createBufferSource(); n.buffer = getNoise();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const ng = envGain(t, 0.002, velo * 0.35, 0.09);
    n.connect(lp); lp.connect(ng); ng.connect(musicBus); n.start(t); n.stop(t + 0.12);
  }
  /* saat tiki — kuru, yüksek frekanslı tık */
  function tickHit(when, velo) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const n = ctx.createBufferSource(); n.buffer = getNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3800; bp.Q.value = 6;
    const g = envGain(t, 0.001, velo, 0.03);
    n.connect(bp); bp.connect(g); g.connect(musicBus); n.start(t); n.stop(t + 0.05);
  }
  /* cam motif notası — sinüs + oktav, yavaş atak, uzun kuyruk (reverb'e akar) */
  function glassNote(freq, when, velo) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(velo, t + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0005, t + 4.5);
    out.connect(musicBus);
    for (const [m, a] of [[1, 1], [2, 0.3], [3.01, 0.08]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
      const g = ctx.createGain(); g.gain.value = a;
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 4.6);
    }
  }
  /* uzak siren — yavaşça yükselip alçalan tek ton (ölü şehir, kale) */
  function sirenSwell(when, velo) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(330, t); o.frequency.linearRampToValueAtTime(495, t + 3); o.frequency.linearRampToValueAtTime(330, t + 6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(velo, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 6.2);
    o.connect(lp); lp.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 6.3);
  }
  /* koro kümesi — formant süzgeçli testere (insan sesine benzer "aa"), yavaş şişer */
  function choirCluster(root, when, dur, velo) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(velo, t + dur * 0.45); out.gain.linearRampToValueAtTime(0, t + dur);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 5;
    out.connect(f1); out.connect(f2); f1.connect(musicBus); f2.connect(musicBus);
    for (const m of [4, 4 * 1.189, 4 * 1.414, 6]) {
      for (const det of [-9, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = root * m; o.detune.value = det;
        const vib = ctx.createOscillator(); vib.frequency.value = 4.5 + Math.random();
        const vg = ctx.createGain(); vg.gain.value = root * m * 0.006;
        vib.connect(vg); vg.connect(o.frequency);
        o.connect(out); o.start(t); o.stop(t + dur + 0.1); vib.start(t); vib.stop(t + dur + 0.1);
      }
    }
  }

  function startMusicBed(intensity = 0.5, mood, opts = {}) {
    if (!started) return;
    stopMusicBed();
    score.on = true;
    const act = clamp01(((opts.act ?? 1) - 1) / 9) * 9 + 1;
    const AS = ACT_SCORE[Math.round(act)] ?? ACT_SCORE[1];
    const inAct = opts.level ? (((opts.level - 1) % 10) / 9) : 0;
    /* hikâye ilerledikçe taban gerilim yükselir; perde içinde de hafifçe artar */
    score.base = AS.base + inAct * 0.1 + (opts.boss ? 0.15 : 0);
    score.intensity = clamp01(intensity * 0.5 + score.base);
    score.root = MOOD_ROOTS[mood] ?? 51.9;
    score.extra = [];
    startActLayers(AS, Math.round(act), !!opts.boss);
    const t = ctx.currentTime;
    const R = score.root;
    const out = ctx.createGain(); out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.5 + score.intensity * 0.5, t + 6);
    out.connect(musicBus);
    score.out = out;
    const keep = (n) => { score.nodes.push(n); return n; };

    /* 1) drone: kök + yarım ton üstü (karanlık sürtünme) + beşli, yavaş filtre nefesi */
    const dl = keep(ctx.createBiquadFilter()); dl.type = 'lowpass'; dl.frequency.value = 260; dl.Q.value = 2.5;
    const dg = keep(ctx.createGain()); dg.gain.value = 0.16;
    dl.connect(dg); dg.connect(out);
    for (const [f, det] of [[R, -7], [R, 6], [R * 1.5, 3], [R * 1.0595 * 2, -4]]) {
      const o = keep(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const g = keep(ctx.createGain()); g.gain.value = f > R * 1.9 ? 0.18 : 0.45;
      o.connect(g); g.connect(dl); o.start(t);
    }
    const lfo = keep(ctx.createOscillator()); lfo.frequency.value = 0.035;
    const lg = keep(ctx.createGain()); lg.gain.value = 170;
    lfo.connect(lg); lg.connect(dl.frequency); lfo.start(t);

    /* 2) alt kat: oktav altı sinüs, çok yavaş titreşim */
    const sub = keep(ctx.createOscillator()); sub.type = 'sine'; sub.frequency.value = R / 2;
    const sg = keep(ctx.createGain()); sg.gain.value = 0.22;
    const trem = keep(ctx.createOscillator()); trem.frequency.value = 0.09;
    const tg = keep(ctx.createGain()); tg.gain.value = 0.1;
    trem.connect(tg); tg.connect(sg.gain);
    sub.connect(sg); sg.connect(out); sub.start(t); trem.start(t);

    /* 3) hava dokusu: süzülen bant-geçiren gürültü (uzak rüzgâr korosu) */
    const ns = keep(ctx.createBufferSource()); ns.buffer = getNoise(); ns.loop = true;
    const bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 7;
    const ng = keep(ctx.createGain()); ng.gain.value = 0.05;
    const sweep = keep(ctx.createOscillator()); sweep.frequency.value = 0.021;
    const swg = keep(ctx.createGain()); swg.gain.value = 420;
    sweep.connect(swg); swg.connect(bp.frequency);
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t); sweep.start(t);

    /* 4) seyrek olaylar: uzak metal yaylar, gümbürtüler, karanlık kümeler */
    const scale = [1, 1.0595, 1.189, 1.414, 1.498, 1.587];   // karanlık: küçük ikili, triton
    const tick = () => {
      if (!score.on) return;
      const r = Math.random();
      if (r < 0.45) bowedMetal(R * 4 * scale[Math.floor(Math.random() * scale.length)], 0, 7 + Math.random() * 5, 0.05 + score.intensity * 0.05);
      else if (r < 0.7) distantBoom(0, 0.12 + score.intensity * 0.12);
      else padChord([R * 2, R * 2 * 1.0595, R * 3], 0, 10, 0.5 + score.intensity * 0.4);
      score.timer = setTimeout(tick, 9000 + Math.random() * 12000);
    };
    score.timer = setTimeout(tick, 2500);
    startActionLayer();
  }

  /* perde katmanları: motif, ritim (davul / mekanik çekiç / savaş), tik, siren, koro */
  function startActLayers(AS, act, boss) {
    const R = score.root;
    const later = (fn, ms) => { const id = setTimeout(fn, ms); score.extra.push(id); };
    /* cam motif — dört inen nota; geç perdelerde yarım ton çatışan gölge ses */
    const motif = [12, 10, 8, 7];
    const playMotif = () => {
      if (!score.on) return;
      const oct = act >= 5 ? 4 : 8;
      motif.forEach((st, i) => {
        const f = R * oct * Math.pow(2, st / 12);
        glassNote(f, i * 1.15, 0.05 + score.intensity * 0.03);
        if (act >= 7) glassNote(f * Math.pow(2, 1 / 12), i * 1.15 + 0.05, 0.022);
      });
      later(playMotif, (AS.motif + Math.random() * 8) * 1000);
    };
    later(playMotif, 6000 + Math.random() * 6000);

    /* ritim — tempo perdeye göre; boss bölümünde iki kat yoğun */
    if (AS.drum || boss) {
      const bpm = (AS.drum || 70) + (boss ? 10 : 0);
      const beat = 60 / bpm;
      const pattern = AS.war || boss ? [1, 0, 0.55, 0, 1, 0.4, 0.55, 0] : AS.mech ? [1, 0.3, 0.6, 0.3] : [1, 0, 0, 0, 0.5, 0, 0, 0];
      let step = 0;
      const tickDrum = () => {
        if (!score.on) return;
        const v = pattern[step % pattern.length];
        if (v > 0) {
          const loud = (0.1 + score.intensity * 0.18) * v * (0.5 + score.act * 0.8);
          if (AS.mech) { tickHit(0, loud * 0.5); drumHit(0, 70, loud * 0.8); }
          else drumHit(0, AS.war || boss ? 52 : 62, loud);
        }
        step++;
        later(tickDrum, (beat / 2) * 1000);
      };
      later(tickDrum, 3000);
    }
    /* saat tiki — zamanın daraldığı hissi */
    if (AS.tick) {
      const tick = () => {
        if (!score.on) return;
        tickHit(0, 0.025 + score.intensity * 0.02);
        later(tick, AS.tick * 1000);
      };
      later(tick, 4000);
    }
    /* uzak siren */
    if (AS.siren) {
      const sir = () => { if (!score.on) return; sirenSwell(0, 0.02 + score.intensity * 0.015); later(sir, 28000 + Math.random() * 20000); };
      later(sir, 12000 + Math.random() * 10000);
    }
    /* koro kümeleri */
    if (AS.choir) {
      const ch = () => {
        if (!score.on) return;
        choirCluster(R, 0, 11, 0.012 * AS.choir + score.act * 0.01);
        later(ch, (26 - AS.choir * 10 + Math.random() * 10) * 1000);
      };
      later(ch, 9000 + Math.random() * 8000);
    }
  }

  function stopMusicBed() {
    score.on = false;
    for (const id of (score.extra ?? [])) clearTimeout(id);
    score.extra = [];
    if (score.timer) { clearTimeout(score.timer); score.timer = null; }
    if (started && score.out) {
      const t = ctx.currentTime;
      const o = score.out;
      o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 1.5);
      const nodes = score.nodes;
      setTimeout(() => { for (const n of nodes) { try { n.stop?.(); } catch (e) {} try { n.disconnect(); } catch (e) {} } }, 1700);
    }
    score.nodes = []; score.out = null;
    stopActionLayer();
  }
  function setMusicIntensity(v) {
    score.intensity = clamp01(v * 0.5 + (score.base ?? 0));
    if (started && score.out) score.out.gain.setTargetAtTime(0.5 + score.intensity * 0.5, ctx.currentTime, 2);
  }

  /* ---- GERİLİM KATMANI: düşman yakınken nabız + tiz tremolo + yükselen küme ---- */
  function setActionLevel(v) {
    score.actTarget = clamp01(v);
  }
  function startActionLayer() {
    if (!started) return;
    stopActionLayer();
    const t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(musicBus);
    score.actOut = out;
    // tiz yaylı tremolo (bant gürültü × 11Hz genlik)
    const ns = ctx.createBufferSource(); ns.buffer = getNoise(); ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 9;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(am.gain);
    const tg = ctx.createGain(); tg.gain.value = 0.09;
    ns.connect(bp); bp.connect(am); am.connect(tg); tg.connect(out);
    // düşük, uyumsuz yaylı küme
    const cl = ctx.createGain(); cl.gain.value = 0.05;
    const clp = ctx.createBiquadFilter(); clp.type = 'lowpass'; clp.frequency.value = 700;
    for (const m of [2, 2.12, 2.83]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = score.root * m;
      o.connect(clp); o.start(t); score.nodes.push(o);
    }
    clp.connect(cl); cl.connect(out);
    ns.start(t); lfo.start(t);
    score.nodes.push(ns, lfo);
    score.act = 0;
    let beat = 0;
    const tick = () => {
      if (!score.actOut) return;
      score.act += (score.actTarget - score.act) * 0.35;
      const tt = ctx.currentTime;
      out.gain.setTargetAtTime(score.act * 0.9, tt, 0.4);
      // nabız: gerilimle hızlanan boğuk vuruş
      if (score.act > 0.12) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(70, tt); o.frequency.exponentialRampToValueAtTime(38, tt + 0.18);
        const g = envGain(tt, 0.005, 0.32 * score.act * (beat % 2 ? 0.6 : 1), 0.3);
        o.connect(g); g.connect(musicBus); o.start(tt); o.stop(tt + 0.32);
      }
      beat++;
      const interval = 860 - score.act * 420;
      score.actTimer = setTimeout(tick, interval);
    };
    score.actTimer = setTimeout(tick, 500);
  }
  function stopActionLayer() {
    if (score.actTimer) { clearTimeout(score.actTimer); score.actTimer = null; }
    if (score.actOut && started) {
      const o = score.actOut;
      o.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 1500);
    }
    score.actOut = null;
  }

  /* giriş: yavaş açılan karanlık katman — melodi yok */
  function playIntroTheme() {
    if (!started) return;
    /* yürüyüş: sakin, hafif sıcak açılış · deprem: gümbürtü ve uyumsuz küme · düşüş */
    padChord([55 * 2, 55 * 3, 55 * 4], 0.2, 7, 0.55);
    [12, 10, 8, 7].forEach((st, i) => glassNote(55 * 8 * Math.pow(2, st / 12), 1.4 + i * 1.2, 0.05));
    distantBoom(4.5, 0.3);
    distantBoom(6.8, 0.55);
    padChord([55 * 2, 55 * 2 * 1.0595, 55 * 2 * 1.414], 6.8, 9, 0.9);
    bowedMetal(55 * 4 * 1.414, 8.2, 8, 0.08);
    drumHit(12.4, 48, 0.3);
  }
  /* umut: çok kısık, sıcak, açık beşli şişme (kapı açılınca, bölüm sonunda) */
  function playHopeMotif() {
    if (!started) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.07, t + 2); out.gain.linearRampToValueAtTime(0, t + 6.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    out.connect(lp); lp.connect(musicBus);
    for (const f of [110, 165, 220, 330]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(out); o.start(t); o.stop(t + 6.6);
    }
  }

  /* ---- yeni efektler: telsiz, çığlık, bomba, kesme, patlama, göçük ---- */
  function radioChirp() {
    if (!started) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = i ? 1850 : 1400;
      const g = envGain(t + i * 0.07, 0.003, 0.035, 0.06);
      o.connect(g); g.connect(sfxBus); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.08);
    }
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.4;
    const g = envGain(t + 0.15, 0.01, 0.05, 0.35);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t + 0.15); src.stop(t + 0.55);
  }
  /* yaratık çığlığı — ani, tiz, kulak tırmalayan (jump-scare vurgusu) */
  function screech(power = 1) {
    if (!started) return;
    const t = ctx.currentTime;
    const out = envGain(t, 0.02, 0.22 * power, 1.3);
    out.connect(sfxBus);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const base = 520 + i * 37;
      o.frequency.setValueAtTime(base * 0.7, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.18);
      o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 1.2);
      const vib = ctx.createOscillator(); vib.frequency.value = 23 + i * 4;
      const vg = ctx.createGain(); vg.gain.value = 40;
      vib.connect(vg); vg.connect(o.frequency);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2;
      o.connect(bp); bp.connect(out);
      o.start(t); o.stop(t + 1.35); vib.start(t); vib.stop(t + 1.35);
    }
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const ng = envGain(t, 0.01, 0.1 * power, 0.5);
    src.connect(hp); hp.connect(ng); ng.connect(sfxBus); src.start(t); src.stop(t + 0.6);
  }
  function bombBeep(urgent) {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = urgent ? 2300 : 1900;
    const g = envGain(t, 0.002, urgent ? 0.11 : 0.07, 0.09);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.12);
  }
  function wireCut() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = envGain(t, 0.001, 0.2, 0.06);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.08);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.05);
    const g2 = envGain(t, 0.001, 0.08, 0.06); o.connect(g2); g2.connect(sfxBus); o.start(t); o.stop(t + 0.08);
  }
  function explosion(power = 1) {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 2.4);
    const g = envGain(t, 0.005, 0.9 * power, 2.8);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 3);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.6);
    const g2 = envGain(t, 0.01, 0.7 * power, 1.8); o.connect(g2); g2.connect(sfxBus); o.start(t); o.stop(t + 2);
  }
  function rumble(dur = 2, power = 0.6) {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.playbackRate.value = 0.25; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(power, t + 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + dur + 0.1);
  }
  function heartbeat(v = 1) {
    if (!started) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(58, t + i * 0.22);
      o.frequency.exponentialRampToValueAtTime(34, t + i * 0.22 + 0.15);
      const g = envGain(t + i * 0.22, 0.01, (i ? 0.2 : 0.3) * v, 0.18);
      o.connect(g); g.connect(sfxBus); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.22);
    }
  }

  /* yangın: sürekli çıtırtı + uğultu — döndürür: { set(0..1), stop() } */
  function fireLoop() {
    if (!started) return null;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true; src.playbackRate.value = 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 1.5);
    src.connect(lp); lp.connect(g); g.connect(sfxBus); src.start(t);
    let level = 0.4, alive = true;
    const crackle = () => {
      if (!alive) return;
      const tt = ctx.currentTime;
      const c = ctx.createBufferSource(); c.buffer = getNoise(); c.playbackRate.value = 1.5 + Math.random();
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const cg = envGain(tt, 0.001, 0.12 * level, 0.05 + Math.random() * 0.05);
      c.connect(hp); hp.connect(cg); cg.connect(sfxBus); c.start(tt); c.stop(tt + 0.12);
      setTimeout(crackle, 40 + Math.random() * (200 - level * 150));
    };
    crackle();
    return {
      set(v) { level = v; g.gain.setTargetAtTime(0.08 + v * 0.35, ctx.currentTime, 0.3); lp.frequency.setTargetAtTime(400 + v * 900, ctx.currentTime, 0.3); },
      stop() { alive = false; g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => { try { src.stop(); } catch (e) {} }, 2500); },
    };
  }
  /* su baskını: fışkıran boru tıslaması + akış */
  function waterLoop() {
    if (!started) return null;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.5);
    src.connect(bp); bp.connect(g); g.connect(sfxBus); src.start(t);
    return {
      set(v) { g.gain.setTargetAtTime(0.1 + v * 0.18, ctx.currentTime, 0.4); bp.frequency.setTargetAtTime(1400 - v * 900, ctx.currentTime, 0.4); },
      stop() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.8); setTimeout(() => { try { src.stop(); } catch (e) {} }, 3000); },
    };
  }
  /* fabrika panosu lamba tonları (I, II, III) */
  function simonTone(i) {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = [196, 247, 294][i] ?? 220;
    const g = envGain(t, 0.01, 0.16, 0.45);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.5);
  }

  function playDeathChord() {
    if (!started) return;
    distantBoom(0, 0.5);
    padChord([41.2 * 2, 41.2 * 2 * 1.0595, 41.2 * 2 * 1.414], 0.1, 7, 0.9);
  }

  return {
    init, resume, setVol, startAmbience, setTension, setWeather,
    footstep, jump, land, pry, crateBurst, itemHit, thud, pickup,
    doorUnlock, doorCreak, monsterRoar, monsterStep, gunshot, ricochet,
    hurt, bandage, punch, carEngine,
    splash, swimStroke, windGust, thunder, flashClick, batterySlot,
    magDrop, magIn, rack, playerShot, dryFire, leverCreak,
    generatorStart, carStart, houndGrowl, houndYelp, lurkerWhisper,
    radioChirp, screech, bombBeep, wireCut, explosion, rumble, heartbeat, fireLoop, waterLoop, simonTone,
    playIntroTheme, playHopeMotif, playDeathChord,
    padChord, startMusicBed, stopMusicBed, setMusicIntensity, setActionLevel,
    get ctx() { return ctx; },
  };
})();
