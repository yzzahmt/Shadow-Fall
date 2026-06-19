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

  function jump() {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const g = envGain(t, 0.01, 0.05, 0.12);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.15);
  }

  function land(impact, material) {
    if (!started) return;
    const t = ctx.currentTime;
    const v = Math.min(0.4, 0.07 + impact * 0.3);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = envGain(t, 0.005, v, 0.18);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.2);
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
  function pianoNote(freq, when, dur, velo) {
    const t = ctx.currentTime + when;
    /* keçeli piyano tını: yumuşak alçak-geçiren + hafif inharmonik üst armonikler */
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(2600 + velo * 1800, t);
    tone.frequency.exponentialRampToValueAtTime(900, t + dur * 0.8);  // parlaklık zamanla söner
    tone.Q.value = 0.5;
    tone.connect(musicBus);

    // inharmonik kısmi tonlar (gerçek tel gerginliği hissi)
    const partials = [[1, 1], [2.001, 0.42], [3.004, 0.2], [4.012, 0.09], [5.02, 0.04]];
    for (const [m, a] of partials) {
      // her kısmi tonda iki hafif akort-kaymış ses → koro/sıcaklık
      for (const det of [-0.6, 0.6]) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = freq * m;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(velo * a * 0.07, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        o.connect(g); g.connect(tone);
        o.start(t); o.stop(t + dur + 0.1);
      }
    }
    // çekiç tını — kısa, yumuşak vuruş transiyenti
    const hb = ctx.createBufferSource(); hb.buffer = getNoise();
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass';
    hf.frequency.value = freq * 2.2; hf.Q.value = 0.8;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(velo * 0.05, t);
    hg.gain.exponentialRampToValueAtTime(0.0004, t + 0.06);
    hb.connect(hf); hf.connect(hg); hg.connect(tone);
    hb.start(t); hb.stop(t + 0.08);
  }

  const N = { C3: 130.81, D3: 146.83, Eb3: 155.56, F3: 174.61, G3: 196.0, Ab3: 207.65, Bb3: 233.08, C4: 261.63, D4: 293.66, Eb4: 311.13, F4: 349.23, G4: 392.0, Ab4: 415.3, Bb4: 466.16, C5: 523.25, Eb5: 622.25, D5: 587.33 };

  /* ---- sıcak yaylı/koro pad: duygusal yastık ----
     ünison-genişletilmiş testere + vibrato + yavaş yay girişi → keman ansamblı hissi.
     piyanonun altına serilince müzik "dolu" ve hüzünlü olur. */
  function padChord(freqs, when, dur, velo = 0.5) {
    if (!started) return;
    const t = ctx.currentTime + when;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(velo * 0.42, t + dur * 0.38);     // yavaş, nefesli giriş
    bus.gain.setValueAtTime(velo * 0.42, t + dur * 0.62);
    bus.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(620, t);
    lp.frequency.linearRampToValueAtTime(1800, t + dur * 0.4);          // yavaşça açılan parlaklık
    lp.frequency.linearRampToValueAtTime(820, t + dur);
    bus.connect(lp); lp.connect(musicBus);
    for (const fr of freqs) {
      for (const det of [-7, 0.5, 7]) {        // üçlü ünison → koro genişliği
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
        const vg = ctx.createGain(); vg.gain.value = 0.1;
        const vib = ctx.createOscillator(); vib.type = 'sine';
        vib.frequency.value = 4.2 + Math.random() * 1.2;               // insancıl vibrato
        const vibG = ctx.createGain(); vibG.gain.value = fr * 0.004;
        vib.connect(vibG); vibG.connect(o.frequency);
        o.connect(vg); vg.connect(bus);
        o.start(t); o.stop(t + dur + 0.15); vib.start(t); vib.stop(t + dur + 0.15);
      }
    }
  }

  /* ---- oyun içi müzik altyapısı: yavaş, seyrek, hüzünlü akor döngüsü ----
     keşif boyunca çok kısık çalar; sahneye duygu katar ama yormaz. */
  const bed = { on: false, timer: null, step: 0, intensity: 0.5 };
  // c-minör etrafında dönen, çözülmeyen-özlemli ilerleyiş
  const BED_PROG = [
    [N.C3, N.Eb3, N.G3, N.C4],          // i  (Cm)  — yuva
    [N.Ab3 / 2 * 2, N.Ab3, N.C4, N.Eb4],// VI (Abmaj)— umut rengi
    [N.Eb3, N.G3, N.Bb3, N.Eb4],        // III(Ebmaj)— soluk ışık
    [N.F3, N.Ab3, N.C4, N.F3 * 2],      // iv (Fm)  — özlem
    [N.G3 / 1, N.Bb3, N.D4, N.G4],      // v  (Gm)  — askıda
  ];
  // tek notalı, kederli ama tekrar etmeyen melodi havuzu (c-doğal-minör)
  const BED_MELODY = [N.G4, N.Eb4, N.C4, N.D4, N.Bb3, N.F4, N.Ab4, N.Eb4, N.C5, N.G4];
  function startMusicBed(intensity = 0.5) {
    if (!started) return;
    bed.intensity = intensity;
    if (bed.on) return;
    bed.on = true; bed.step = 0;
    startActionLayer();          // aksiyon katmanı hep çalışır, ama setActionLevel(0) iken sessiz
    /* DAHA SAKİN, DAHA ATMOSFERİK YATAK:
       - pad daha yumuşak ve uzun (yormaz)
       - akor sırası ara sıra atlanır → müzik "nefes alır", metronom hissi gitmez
       - melodi notaları sabit tepe yerine havuzdan seçilir → bıktırıcı tekrar yok
       - bölümler arası süre değişir (8.5–13 sn) */
    const tick = () => {
      if (!bed.on) return;
      // her birkaç adımda bir tam sessizlik aralığı: gerilim ve dinlenme
      const rest = (bed.step % 4 === 3);
      if (!rest) {
        const chord = BED_PROG[bed.step % BED_PROG.length];
        padChord(chord, 0, 11, 0.11 * bed.intensity);
        // seyrek, değişken tek piyano notası — yalnızlık vurgusu
        if (bed.step % 2 === 0) {
          const note = BED_MELODY[(bed.step * 3 + 1) % BED_MELODY.length];
          pianoNote(note, 1.8 + Math.random() * 2.2, 5, 0.10 * bed.intensity);
        }
      }
      bed.step++;
      bed.timer = setTimeout(tick, rest ? 5000 : (8500 + Math.random() * 4500));
    };
    tick();
  }
  function stopMusicBed() {
    bed.on = false;
    if (bed.timer) { clearTimeout(bed.timer); bed.timer = null; }
    stopActionLayer();
  }
  function setMusicIntensity(v) { bed.intensity = clamp01(v); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  /* ============ AKSİYON / GERİLİM KATMANI ============
     Tehdit (asker alarmda, yaratık kovalıyor) yükselince devreye giren
     SÜRÜKLEYİCİ alt nabız + gergin stab. Atmosferik yatak kalırken üstüne
     biner → keşif sakin, çatışma aksiyonlu/gergin olur. */
  // perküsif, gergin alt-bas nabız
  function pulseBass(freq, dur, velo) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq / 2;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(200 + velo * 2200, t);
    f.frequency.exponentialRampToValueAtTime(110, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(velo, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f); sub.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur); sub.start(t); sub.stop(t + dur);
  }
  // dissonant gergin üst stab (tehlike vurgusu)
  function tenseStab(velo) {
    const t = ctx.currentTime;
    for (const fr of [N.C4, N.Eb4, N.Ab4 * 1.04]) {   // hafif tutarsız → tedirginlik
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(velo * 0.07, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.45);
      o.connect(bp); bp.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + 0.45);
    }
  }
  const action = { on: false, target: 0, cur: 0, step: 0, timer: null };
  function setActionLevel(v) { action.target = clamp01(v); }
  function startActionLayer() {
    if (!started || action.on) return;
    action.on = true; action.step = 0; action.cur = 0; action.target = 0;
    const STEP_MS = 195;                       // sürükleyici tempo (~154 BPM 16'lık hissi)
    const rootSeq = [N.C3 / 2, N.C3 / 2, N.Ab3 / 2, N.C3 / 2, N.G3 / 2, N.C3 / 2, N.Ab3 / 2, N.Bb3 / 2];
    const tick = () => {
      if (!action.on) return;
      action.cur += (action.target - action.cur) * 0.18;   // yumuşak giriş/çıkış
      const lv = action.cur;
      if (lv > 0.06) {
        const s = action.step % 8;
        pulseBass(rootSeq[s], 0.19, 0.17 * lv);
        if (s % 2 === 1) pulseBass(rootSeq[s] * 2, 0.085, 0.05 * lv);   // off-beat itki
        if (s === 0 && lv > 0.55) tenseStab(lv);
      }
      action.step++;
      action.timer = setTimeout(tick, STEP_MS);
    };
    tick();
  }
  function stopActionLayer() { action.on = false; if (action.timer) { clearTimeout(action.timer); action.timer = null; } }

  // intro teması — c minor, yavaş, hüzünlü
  function playIntroTheme() {
    if (!started) return;
    const seq = [
      // [nota, zaman, süre, gürlük]
      [N.C4, 0.0, 3.5, 0.9], [N.G3, 0.05, 4, 0.5], [N.C3, 0.1, 5, 0.6],
      [N.Eb4, 2.2, 3, 0.8],
      [N.D4, 4.4, 3.4, 0.7], [N.G3, 4.45, 4, 0.4], [N.Bb3, 4.5, 4, 0.35],
      [N.C4, 8.0, 4, 0.75], [N.Ab3, 8.05, 4.4, 0.45], [N.F3, 8.1, 5, 0.5],
      [N.G4, 11.0, 3, 0.55],
      [N.F4, 13.0, 3, 0.5],
      [N.Eb4, 15.0, 4.5, 0.75], [N.C3, 15.05, 6, 0.55], [N.G3, 15.1, 5, 0.4],
      [N.D4, 19.0, 5, 0.5], [N.Bb3, 19.05, 5, 0.35], [N.F3, 19.1, 5, 0.3],   // iç ses
      // kapanış: tam c-minör akoru, derin pedal + ışıltılı üst ses
      [N.C4, 23.0, 7, 0.8], [N.G3, 23.06, 7, 0.4], [N.C3, 23.12, 8, 0.6], [N.Eb4, 23.2, 7, 0.3],
      [N.G4, 23.3, 6.5, 0.22], [N.C5, 23.5, 6, 0.18],
    ];
    // alttan yaylı yastık — temayı sinematik mekâna oturtur
    padChord([N.C3, N.Eb3, N.G3], 0.0, 8, 0.5);
    padChord([N.Ab3 / 1, N.C4, N.Eb4], 8.0, 7.5, 0.42);
    padChord([N.C3, N.Eb3, N.G3, N.C4], 15.0, 8, 0.5);
    padChord([N.C3, N.G3, N.C4, N.Eb4], 23.0, 9, 0.55);
    for (const [f, w, d, v] of seq) pianoNote(f, w, d, v);
  }

  // bölüm sonu — küçük umut motifi (c-minör → Ab-majör aydınlanma)
  function playHopeMotif() {
    if (!started) return;
    padChord([N.Ab3, N.C4, N.Eb4], 2.2, 6, 0.5);   // sıcak Ab-majör yastığı
    const seq = [
      // yükselen arpej
      [N.C4, 0, 2.5, 0.7], [N.Eb4, 0.7, 2.5, 0.6], [N.G4, 1.4, 3, 0.65],
      [N.C5, 2.4, 4.5, 0.8],
      // alttan sıcak Ab-majör yastığı — umut rengini verir
      [N.Ab3, 2.45, 5, 0.42], [N.Eb4, 2.5, 5, 0.34], [N.C3, 2.55, 5.5, 0.5],
      // çözülen, parlayan üst ses
      [N.Eb5, 4.6, 4, 0.5], [N.G4, 4.7, 4.2, 0.3],
    ];
    for (const [f, w, d, v] of seq) pianoNote(f, w, d, v);
  }

  function playDeathChord() {
    if (!started) return;
    padChord([N.C3, N.Eb3, N.G3], 0, 6.5, 0.6);
    pianoNote(N.C3, 0, 6, 0.8); pianoNote(N.Eb3, 0.08, 6, 0.5); pianoNote(N.G3, 0.16, 6, 0.4);
  }

  return {
    init, resume, setVol, startAmbience, setTension, setWeather,
    footstep, jump, land, pry, crateBurst, itemHit, thud, pickup,
    doorUnlock, doorCreak, monsterRoar, monsterStep, gunshot, ricochet,
    hurt, bandage, punch, carEngine,
    splash, swimStroke, windGust, thunder, flashClick, batterySlot,
    magDrop, magIn, rack, playerShot, dryFire, leverCreak,
    generatorStart, carStart, houndGrowl, houndYelp, lurkerWhisper,
    playIntroTheme, playHopeMotif, playDeathChord,
    padChord, startMusicBed, stopMusicBed, setMusicIntensity, setActionLevel,
    get ctx() { return ctx; },
  };
})();
