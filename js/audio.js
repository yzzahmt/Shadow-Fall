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
  let weather = { rain: 0, wind: 0.5 }, indoor = false;
  function setWeather(rainV, windV) {
    weather = { rain: rainV, wind: windV };
    if (!started || !amb.rainGain) return;
    const t = ctx.currentTime;
    const k = indoor ? 0.18 : 1;              // içeride yağmur/rüzgâr boğuklaşır
    amb.rainGain.gain.linearRampToValueAtTime(rainV * 0.16 * k, t + 1.2);
    amb.windGain.gain.linearRampToValueAtTime((0.03 + windV * 0.08) * (indoor ? 0.35 : 1), t + 1.2);
  }
  function setIndoor(on) { indoor = !!on; setWeather(weather.rain, weather.wind); }

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

  /* kontrol noktası: fitil tutuşur — kısa hışırtı + alçak, sıcak tını */
  function checkpoint() {
    if (!started) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = getNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.2;
    const gn = envGain(t, 0.02, 0.05, 0.35);
    n.connect(bp); bp.connect(gn); gn.connect(sfxBus); n.start(t); n.stop(t + 0.4);
    for (const [f, d] of [[220, 0.12], [330, 0.2]]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = envGain(t + d, 0.05, 0.035, 1.6);
      o.connect(g); g.connect(sfxBus); o.start(t + d); o.stop(t + d + 1.7);
    }
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

  /* ============================================================
     SİNEMATİK SES KATMANLARI — giriş teması ve ölüm akoru.
     Bölüm müziği music.js'teki müzik yönetmenindedir.
     ============================================================ */
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

  /* ============================================================
     PERDE ORTAM SESLERİ — her perdenin kendi dokusu: sürekli bir
     taban katmanı + rastgele aralıklarla gelen tekil sesler.
     orman: cırcır + baykuş · yol: tabela gıcırtısı + uzak köpek ·
     bataklık: kurbağa + sinek vızıltısı · maden: su damlası + göçük ·
     fabrika: makine uğultusu + buhar + çekiç · nehir: akan su ·
     şehir: harabe arasında ıslıklı rüzgâr + teneke · kale: zincir +
     bayrak · kule: uluyan rüzgâr + ahşap gıcırtısı · geçit: derin gümbürtü
     ============================================================ */
  const biomeAmb = { nodes: [], timers: [], out: null, name: null };
  function ambTone(type, freq, gain, out) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gain;
    o.connect(g); g.connect(out); o.start();
    biomeAmb.nodes.push(o);
    return o;
  }
  function ambNoise(filterType, freq, q, gain, out, rate = 1) {
    const n = ctx.createBufferSource(); n.buffer = getNoise(); n.loop = true; n.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    n.connect(f); f.connect(g); g.connect(out); n.start();
    biomeAmb.nodes.push(n);
    return { f, g };
  }
  /* tek seferlik, stereo konumlu ortam sesi */
  function ambShot(fn, minS, maxS) {
    const go = () => {
      if (!biomeAmb.out) return;
      fn(biomeAmb.out, (Math.random() - 0.5) * 1.6);
      biomeAmb.timers.push(setTimeout(go, (minS + Math.random() * (maxS - minS)) * 1000));
    };
    biomeAmb.timers.push(setTimeout(go, (1 + Math.random() * minS) * 1000));
  }
  function panned(out, pan) {
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(out); return p;
  }
  function plink(out, pan, freq, v, dur = 0.5) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
    const g = envGain(t, 0.002, v, dur);
    o.connect(g); g.connect(panned(out, pan)); o.start(t); o.stop(t + dur + 0.05);
  }
  function creak(out, pan, v, base = 140) {
    const t = ctx.currentTime, dur = 0.6 + Math.random() * 0.8;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * (0.7 + Math.random() * 0.6), t + dur);
    const am = ctx.createOscillator(); am.frequency.value = 30 + Math.random() * 30;
    const amg = ctx.createGain(); amg.gain.value = 0.5;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 4; bp.Q.value = 5;
    const g = envGain(t, 0.08, v, dur);
    am.connect(amg); amg.connect(g.gain);
    o.connect(bp); bp.connect(g); g.connect(panned(out, pan));
    o.start(t); o.stop(t + dur + 0.1); am.start(t); am.stop(t + dur + 0.1);
  }
  function noiseHit(out, pan, freq, q, v, dur, rate = 1) {
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = getNoise(); n.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = envGain(t, 0.005, v, dur);
    n.connect(f); f.connect(g); g.connect(panned(out, pan)); n.start(t); n.stop(t + dur + 0.05);
  }
  const BIOME_AMB = {
    forest(out) {
      ambNoise('bandpass', 4200, 8, 0.004, out);
      ambShot((o, p) => { for (let i = 0; i < 3 + Math.random() * 4; i++) setTimeout(() => plink(o, p, 4300 + Math.random() * 300, 0.012, 0.05), i * 70); }, 0.6, 2.2);
      ambShot((o, p) => {                                     // baykuş: iki alçak hu
        const t = ctx.currentTime;
        for (const [d, f] of [[0, 380], [0.45, 330]]) {
          const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(f * 1.05, t + d); osc.frequency.linearRampToValueAtTime(f, t + d + 0.3);
          const g = envGain(t + d, 0.06, 0.03, 0.4); osc.connect(g); g.connect(panned(o, p)); osc.start(t + d); osc.stop(t + d + 0.5);
        }
      }, 14, 28);
    },
    road(out) {
      ambShot((o, p) => creak(o, p, 0.025, 180), 7, 16);
      ambShot((o, p) => {                                     // uzak köpek
        for (let i = 0; i < 2; i++) setTimeout(() => {
          const t = ctx.currentTime;
          const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(520, t); osc.frequency.exponentialRampToValueAtTime(300, t + 0.14);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
          const g = envGain(t, 0.005, 0.02, 0.18); osc.connect(lp); lp.connect(g); g.connect(panned(o, p)); osc.start(t); osc.stop(t + 0.2);
        }, i * 260);
      }, 18, 34);
    },
    swamp(out) {
      ambNoise('bandpass', 620, 14, 0.006, out, 0.6);            // sinek vızıltısı
      ambShot((o, p) => {                                     // kurbağa: kısa titreşimli vırak
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 95 + Math.random() * 40;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
        const g = envGain(t, 0.01, 0.03, 0.22);
        const am = ctx.createOscillator(); am.frequency.value = 38; const ag = ctx.createGain(); ag.gain.value = 0.6;
        am.connect(ag); ag.connect(g.gain);
        osc.connect(lp); lp.connect(g); g.connect(panned(o, p)); osc.start(t); osc.stop(t + 0.25); am.start(t); am.stop(t + 0.25);
      }, 1.2, 4);
    },
    mine(out) {
      ambNoise('lowpass', 120, 0.7, 0.01, out, 0.5);
      ambShot((o, p) => plink(o, p, 900 + Math.random() * 900, 0.03, 0.7), 1.4, 4.5);   // su damlası
      ambShot((o, p) => { noiseHit(o, p, 160, 0.8, 0.05, 1.6, 0.3); for (let i = 0; i < 5; i++) setTimeout(() => noiseHit(o, p, 2400, 2, 0.01, 0.06), 300 + i * 90); }, 20, 40);  // uzak göçük
    },
    factory(out) {
      ambTone('sawtooth', 50, 0.004, out); ambTone('sine', 100, 0.006, out);
      ambShot((o, p) => noiseHit(o, p, 3000, 0.7, 0.025, 1.4), 9, 18);                  // buhar
      ambShot((o, p) => { for (let i = 0; i < 3; i++) setTimeout(() => noiseHit(o, p, 1300, 6, 0.04, 0.25), i * 380); }, 6, 14);   // çekiç
    },
    river(out) {
      const w = ambNoise('lowpass', 900, 0.5, 0.03, out, 0.8);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lg = ctx.createGain(); lg.gain.value = 260;
      lfo.connect(lg); lg.connect(w.f.frequency); lfo.start(); biomeAmb.nodes.push(lfo);
      ambShot((o, p) => plink(o, p, 500 + Math.random() * 400, 0.015, 0.25), 0.5, 1.8);
    },
    city(out) {
      const w = ambNoise('bandpass', 1100, 12, 0.012, out);       // harabelerde ıslıklı rüzgâr
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
      const lg = ctx.createGain(); lg.gain.value = 500;
      lfo.connect(lg); lg.connect(w.f.frequency); lfo.start(); biomeAmb.nodes.push(lfo);
      ambShot((o, p) => noiseHit(o, p, 2200, 8, 0.03, 0.4), 8, 18);                     // teneke
    },
    fortress(out) {
      ambShot((o, p) => { for (let i = 0; i < 4 + Math.random() * 4; i++) setTimeout(() => noiseHit(o, p, 3200 + Math.random() * 800, 14, 0.018, 0.09), i * 110); }, 7, 15);   // zincir
      ambShot((o, p) => { for (let i = 0; i < 6; i++) setTimeout(() => noiseHit(o, p, 500, 1, 0.02, 0.12, 0.5), i * 140); }, 10, 20);  // bayrak
    },
    spire(out) {
      const w = ambNoise('bandpass', 380, 3, 0.03, out, 0.7);    // uluyan rüzgâr
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
      const lg = ctx.createGain(); lg.gain.value = 180;
      lfo.connect(lg); lg.connect(w.f.frequency); lfo.start(); biomeAmb.nodes.push(lfo);
      ambShot((o, p) => creak(o, p, 0.03, 110), 6, 14);
    },
    gate(out) {
      ambTone('sine', 36, 0.02, out);
      ambShot((o, p) => noiseHit(o, p, 90, 0.6, 0.06, 2.4, 0.25), 9, 20);
    },
  };
  function setBiomeAmbience(name, opts = {}) {
    if (!started) return;
    if (biomeAmb.out) {
      const old = biomeAmb.out, nodes = biomeAmb.nodes;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) {} } try { old.disconnect(); } catch (e) {} }, 2500);
    }
    for (const id of biomeAmb.timers) clearTimeout(id);
    biomeAmb.nodes = []; biomeAmb.timers = []; biomeAmb.out = null; biomeAmb.name = name;
    const fn = BIOME_AMB[name];
    if (!fn) return;
    const out = ctx.createGain(); out.gain.value = 0;
    out.gain.setTargetAtTime(opts.interior ? 0.5 : 1, ctx.currentTime, 1.2);
    out.connect(ambBus);
    biomeAmb.out = out;
    fn(out);
  }

  /* ============================================================
     YARATIK SESLERİ — her türün kendi vurulma ve ölüm sesi
     ============================================================ */
  function creatureHit(kind) {
    if (!started) return;
    const t = ctx.currentTime, r = 0.9 + Math.random() * 0.2;
    switch (kind) {
      case 'stalker': {                                        // kök: odun çatırtısı + boğuk inilti
        noiseHit(sfxBus, 0, 900 * r, 3, 0.12, 0.18);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(90 * r, t); o.frequency.linearRampToValueAtTime(60 * r, t + 0.45);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
        const g = envGain(t, 0.03, 0.14, 0.5); o.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.55);
        break;
      }
      case 'hound': houndYelp(); break;
      case 'crawler':                                          // kitin tıkırtısı
        for (let i = 0; i < 6; i++) setTimeout(() => noiseHit(sfxBus, 0, 2600 * r + i * 120, 10, 0.06, 0.04), i * 28);
        break;
      case 'lurker': {                                         // nefesli tıslama, tersine şişen
        const n = ctx.createBufferSource(); n.buffer = getNoise();
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(1400 * r, t); f.frequency.linearRampToValueAtTime(3200, t + 0.35); f.Q.value = 3;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 0.4);
        n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + 0.45);
        break;
      }
      case 'brute': {                                          // derin homurtu
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(70 * r, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
        const g = envGain(t, 0.01, 0.3, 0.35); o.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.4);
        break;
      }
      case 'tracker': creatureHit('lurker'); break;
      case 'watcher': noiseHit(sfxBus, 0, 600, 3, 0.1, 0.2, 0.6); break;   // ıslak koza
      case 'swarm':                                            // cıyaklama
        for (let i = 0; i < 3; i++) setTimeout(() => {
          const tt = ctx.currentTime, o = ctx.createOscillator(); o.type = 'square';
          o.frequency.setValueAtTime(2200 + Math.random() * 900, tt); o.frequency.exponentialRampToValueAtTime(1400, tt + 0.06);
          const g = envGain(tt, 0.002, 0.025, 0.07); o.connect(g); g.connect(sfxBus); o.start(tt); o.stop(tt + 0.08);
        }, i * 50);
        break;
      case 'mimic': noiseHit(sfxBus, 0, 700, 2, 0.15, 0.15); creak(sfxBus, 0, 0.06, 160); break;   // tahta çatırtısı
      default: monsterRoar(false);
    }
  }
  function creatureDie(kind) {
    if (!started) return;
    const t = ctx.currentTime;
    switch (kind) {
      case 'stalker':                                          // uzun gıcırtılı çöküş + kökler toprağa
        creak(sfxBus, 0, 0.12, 120);
        for (let i = 0; i < 4; i++) setTimeout(() => noiseHit(sfxBus, 0, 200, 1, 0.12, 0.25, 0.5), 500 + i * 160);
        break;
      case 'hound': {                                          // inen inilti
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.9);
        const g = envGain(t, 0.02, 0.12, 1); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.05);
        break;
      }
      case 'crawler':                                          // yavaşlayan tıkırtı
        for (let i = 0; i < 10; i++) setTimeout(() => noiseHit(sfxBus, 0, 2400, 10, 0.06 * (1 - i / 12), 0.05), i * (40 + i * 18));
        break;
      case 'lurker': screech(0.5); noiseHit(sfxBus, 0, 1200, 2, 0.06, 1.4, 0.4); break;
      case 'brute': monsterRoar(true); setTimeout(() => noiseHit(sfxBus, 0, 120, 0.8, 0.3, 0.6, 0.4), 700); break;
      case 'wraith': {                                         // ışıkta dağılma: yükselen ince parıltı
        for (let i = 0; i < 4; i++) {
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(600 + i * 170, t); o.frequency.exponentialRampToValueAtTime(2400 + i * 300, t + 1.4);
          const g = envGain(t, 0.1, 0.025, 1.5); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.55);
        }
        break;
      }
      case 'tracker': creatureDie('lurker'); break;
      case 'watcher': screech(0.6); setTimeout(() => noiseHit(sfxBus, 0, 200, 1, 0.15, 0.4, 0.5), 600); break;
      case 'swarm': creatureHit('swarm'); setTimeout(() => creatureHit('swarm'), 200); break;
      case 'mimic': monsterRoar(false); creak(sfxBus, 0, 0.1, 100); setTimeout(() => noiseHit(sfxBus, 0, 300, 1, 0.2, 0.3, 0.6), 400); break;
      default: screech(0.5);
    }
  }

  /* ============================================================
     KAÇIŞ GÖREVLERİ — tren, asansör, karanlıkta yankı
     ============================================================ */
  function trainHorn() {
    if (!started) return;
    const t = ctx.currentTime;
    const out = envGain(t, 0.15, 0.12, 2.2); out.connect(sfxBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(out);
    for (const f of [277, 349, 415]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(lp); o.start(t); o.stop(t + 2.3);
    }
  }
  /* raylardan gelen tak-tak: hıza göre çağrılır */
  function railClack(v = 1) {
    if (!started) return;
    noiseHit(sfxBus, 0, 900, 2, 0.05 * v, 0.06);
    setTimeout(() => noiseHit(sfxBus, 0, 700, 2, 0.04 * v, 0.06), 90);
  }
  function cableSnap() {
    if (!started) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.5);
    const g = envGain(t, 0.002, 0.2, 0.6); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.65);
    noiseHit(sfxBus, 0, 2600, 1, 0.15, 0.3);
  }
  /* yere vurma + mağara yankısı. Yüksek: geniş, uzun; alçak (eğilerek): kısa, sessiz */
  function echoKnock(loud) {
    if (!started) return;
    const v = loud ? 0.22 : 0.08;
    noiseHit(sfxBus, 0, 380, 1.5, v, 0.12, 0.8);
    const n = loud ? 4 : 2;
    for (let i = 1; i <= n; i++) {
      setTimeout(() => noiseHit(sfxBus, (i % 2 ? -0.6 : 0.6), 380 - i * 30, 2, v * Math.pow(0.5, i), 0.14, 0.7), i * (loud ? 190 : 120));
    }
  }
  /* konumlu ipucu sesi: damla (boşluk), çan (çıkış) */
  function cue(kind, pan, v) {
    if (!started || v <= 0.01) return;
    if (kind === 'drip') { plink(sfxBus, pan, 700 + Math.random() * 300, 0.05 * v, 0.6); setTimeout(() => plink(sfxBus, -pan * 0.5, 650, 0.018 * v, 0.5), 160); }
    else if (kind === 'bell') {
      const t = ctx.currentTime;
      for (const [m, a] of [[1, 0.05], [2.76, 0.02], [5.4, 0.01]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 523 * m;
        const g = envGain(t, 0.004, a * v, 2.4); o.connect(g); g.connect(panned(sfxBus, pan)); o.start(t); o.stop(t + 2.5);
      }
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
    doorUnlock, doorCreak, checkpoint, monsterRoar, monsterStep, gunshot, ricochet,
    hurt, bandage, punch, carEngine,
    splash, swimStroke, windGust, thunder, flashClick, batterySlot,
    magDrop, magIn, rack, playerShot, dryFire, leverCreak,
    generatorStart, carStart, houndGrowl, houndYelp, lurkerWhisper,
    radioChirp, screech, bombBeep, wireCut, explosion, rumble, heartbeat, fireLoop, waterLoop, simonTone,
    playIntroTheme, playHopeMotif, playDeathChord, setIndoor,
    padChord, setBiomeAmbience, creatureHit, creatureDie,
    trainHorn, railClack, cableSnap, echoKnock, cue,
    get ctx() { return ctx; },
    get musicBus() { return musicBus; },
    noise: () => getNoise(),
  };
})();
