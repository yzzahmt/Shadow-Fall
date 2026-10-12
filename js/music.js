/* ============================================================
   SHADOW FALL — MÜZİK YÖNETMENİ
   Prosedürel ama BESTELENMİŞ parçalar: her parçanın tonu, temposu,
   akor yürüyüşü, enstrümanları ve melodisi var. Sahnenin gidişatına
   göre parçalar arasında yumuşak geçişle değişir:

     keşif (perdeye göre 10 ayrı tema) · iç mekân · gizlilik ·
     bulmaca · kovalamaca/aksiyon · kaçış (yangın, su, dev) ·
     araç kaçışı · bomba

   Enstrümanlar Web Audio ile sentezlenir: piyano, Karplus-Strong telli
   (gitar / pizzicato), yaylı kesit, staccato yaylı, bakır, bas, çan,
   org/koro, davullar (kick, trampet, hi-hat, taiko, tom), riser, braam.
   ============================================================ */
'use strict';

const SFMusic = (() => {
  let ctx = null, bus = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  /* akor: 'Am' 'F' 'G#dim' 'E7' 'Csus' → kök + aralıklar */
  function chord(name, oct = 3) {
    const m = name.match(/^([A-G][b#]?)(m|dim|7|sus|maj7|m7)?$/);
    const root = 12 * (oct + 1) + NOTE[m[1]];
    const q = m[2] ?? '';
    const iv = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], 7: [0, 4, 7, 10], sus: [0, 5, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10] }[q];
    return { root, notes: iv.map(i => root + i), name };
  }

  /* ---------------- ENSTRÜMANLAR ---------------- */
  function out(t, a, peak, dur, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    g.connect(dest);
    return g;
  }
  function osc(type, f, t, dur, dest, det = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function lp(f, dest, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; }

  const I = {
    /* yumuşak piyano: üç kısmi + hafif inharmonik, perdeye göre sönüm */
    piano(m, t, vel, dest, len = 1) {
      const f = mtof(m);
      const dur = Math.min(4.5, (2.6 - (m - 48) * 0.03)) * len;
      const filt = lp(1800 + vel * 2600, dest);
      const g = out(t, 0.006, vel * 0.32, dur, filt);
      osc('sine', f, t, dur, g);
      const g2 = ctx.createGain(); g2.gain.value = 0.35; g2.connect(g); osc('sine', f * 2.003, t, dur * 0.6, g2);
      const g3 = ctx.createGain(); g3.gain.value = 0.12; g3.connect(g); osc('triangle', f * 3.01, t, dur * 0.35, g3);
    },
    /* telli: Karplus-Strong (gitar / arp / pizzicato) */
    _ks: new Map(),
    pluck(m, t, vel, dest, bright = 0.5, len = 1.6) {
      const key = m + ':' + bright;
      let buf = this._ks.get(key);
      if (!buf) {
        const sr = ctx.sampleRate, f = mtof(m), N = Math.max(2, Math.round(sr / f));
        const L = Math.floor(sr * 1.8);
        buf = ctx.createBuffer(1, L, sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
        const fb = 0.994 + bright * 0.004;
        for (let i = N; i < L; i++) d[i] = (d[i - N] + d[i - N + 1 < i ? i - N + 1 : i - N]) * 0.5 * fb;
        this._ks.set(key, buf);
      }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = out(t, 0.002, vel * 0.55, len, lp(1200 + bright * 4200, dest));
      src.connect(g); src.start(t); src.stop(t + len + 0.05);
    },
    /* yaylı kesit: iki ayarsız testere, yavaş atak */
    strings(notes, t, dur, vel, dest, att = 0.5) {
      const filt = lp(1500, dest);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel * 0.06, t + att);
      g.gain.setValueAtTime(vel * 0.06, t + Math.max(att, dur - 0.5));
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      g.connect(filt);
      for (const m of notes) for (const det of [-8, 7]) osc('sawtooth', mtof(m), t, dur + 0.45, g, det);
    },
    /* staccato yaylı — aksiyon ostinatosu */
    stacc(m, t, vel, dest) {
      const g = out(t, 0.004, vel * 0.16, 0.16, lp(2600, dest));
      osc('sawtooth', mtof(m), t, 0.17, g, -6); osc('sawtooth', mtof(m), t, 0.17, g, 6);
    },
    /* bakır: filtre zarflı testere */
    brass(notes, t, dur, vel, dest) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(2200 * (0.6 + vel), t + 0.12); f.frequency.linearRampToValueAtTime(900, t + dur);
      f.connect(dest);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.09, t + 0.06); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2); g.connect(f);
      for (const m of notes) { osc('sawtooth', mtof(m), t, dur + 0.25, g, -5); osc('sawtooth', mtof(m), t, dur + 0.25, g, 5); }
    },
    /* braam — ağır, uyumsuz bakır vuruşu (sinematik) */
    braam(m, t, vel, dest) { this.brass([m - 12, m, m + 7, m + 13], t, 2.6, vel * 1.4, dest); I.kick(t, vel, dest, 40); },
    bass(m, t, dur, vel, dest) {
      const g = out(t, 0.008, vel * 0.42, dur, lp(520, dest));
      osc('triangle', mtof(m), t, dur, g); osc('sine', mtof(m - 12), t, dur, g);
    },
    /* çan / müzik kutusu: FM */
    bell(m, t, vel, dest, dur = 3) {
      const f = mtof(m);
      const g = out(t, 0.002, vel * 0.22, dur, dest);
      const c = ctx.createOscillator(); c.frequency.value = f;
      const mo = ctx.createOscillator(); mo.frequency.value = f * 3.5;
      const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur);
      mo.connect(mg); mg.connect(c.frequency); c.connect(g);
      c.start(t); mo.start(t); c.stop(t + dur + 0.05); mo.stop(t + dur + 0.05);
    },
    /* org / koro: formant süzgeçli ayarsız kümeler */
    choir(notes, t, dur, vel, dest) {
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.05, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 760; f1.Q.value = 3; f1.connect(dest);
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1180; f2.Q.value = 4; f2.connect(dest);
      g.connect(f1); g.connect(f2);
      for (const m of notes) for (const det of [-10, 9]) osc('sawtooth', mtof(m), t, dur + 0.05, g, det);
    },
    pad(notes, t, dur, vel, dest) {
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.07, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(lp(900, dest));
      for (const m of notes) { osc('triangle', mtof(m), t, dur + 0.05, g, -7); osc('triangle', mtof(m), t, dur + 0.05, g, 6); }
    },
    reed(m, t, dur, vel, dest) {            // klarnet benzeri: kare dalga + alçak geçiren, vibrato
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.08, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(lp(1100, dest));
      const o = osc('square', mtof(m), t, dur, g);
      const v = ctx.createOscillator(); v.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = mtof(m) * 0.006;
      v.connect(vg); vg.connect(o.frequency); v.start(t + 0.2); v.stop(t + dur);
    },
    /* --- davullar --- */
    kick(t, vel, dest, f0 = 55) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0 * 2.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.09);
      const g = out(t, 0.002, vel * 0.7, 0.42, dest); o.connect(g); o.start(t); o.stop(t + 0.45);
    },
    snare(t, vel, dest) {
      const n = ctx.createBufferSource(); n.buffer = SFAudio.noise();
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const g = out(t, 0.001, vel * 0.32, 0.2, dest); n.connect(hp); hp.connect(g); n.start(t); n.stop(t + 0.22);
      const tg = out(t, 0.001, vel * 0.2, 0.1, dest); osc('triangle', 190, t, 0.1, tg);
    },
    hat(t, vel, dest, open = false) {
      const n = ctx.createBufferSource(); n.buffer = SFAudio.noise();
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = out(t, 0.001, vel * 0.12, open ? 0.25 : 0.05, dest); n.connect(hp); hp.connect(g); n.start(t); n.stop(t + 0.3);
    },
    taiko(t, vel, dest, f = 70) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.7, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      const g = out(t, 0.003, vel * 0.75, 0.7, dest); o.connect(g); o.start(t); o.stop(t + 0.75);
      const n = ctx.createBufferSource(); n.buffer = SFAudio.noise();
      const ng = out(t, 0.001, vel * 0.25, 0.08, lp(700, dest)); n.connect(ng); n.start(t); n.stop(t + 0.1);
    },
    tick(t, vel, dest) {
      const n = ctx.createBufferSource(); n.buffer = SFAudio.noise();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 8;
      const g = out(t, 0.001, vel * 0.3, 0.03, dest); n.connect(bp); bp.connect(g); n.start(t); n.stop(t + 0.05);
    },
    clank(t, vel, dest) {                    // fabrika/maden: metal vuruş
      [1, 2.7, 4.1].forEach((r, i) => { const g = out(t, 0.001, vel * [0.18, 0.1, 0.06][i], 0.4, dest); osc('square', 210 * r, t, 0.4, g); });
    },
    riser(t, dur, vel, dest) {
      const n = ctx.createBufferSource(); n.buffer = SFAudio.noise(); n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5000, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.18, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
      n.connect(bp); bp.connect(g); g.connect(dest); n.start(t); n.stop(t + dur + 0.1);
    },
  };

  /* ---------------- PARÇALAR ----------------
     her parça: bpm, adım/ölçü (16 = 4/4, 12 = 6/8), akorlar (ölçü başına),
     step(e): o adımda çalınacakları zamanlar. e = { t, step, bar, chord, dur(adım süresi), o(out), v(yoğunluk) } */
  const P = (prob) => Math.random() < prob;
  const arp = (ch, i, oct = 0) => ch.notes[i % ch.notes.length] + 12 * (Math.floor(i / ch.notes.length) + oct);
  const MEL = (s) => s.split(' ').map(x => x === '.' ? null : x === '-' ? '-' : (12 * (+x.slice(-1) + 1) + NOTE[x.slice(0, -1)]));

  const TRACKS = {
    /* ORMAN — "yarığın dibi": la minör, yavaş piyano arpeji, yaylı yatak, yalnız bir melodi */
    explore_forest: {
      bpm: 70, spb: 16, vol: 0.9,
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
      mel: MEL('E5 . D5 C5 B4 . . . C5 . B4 A4 G#4 . . . A4 . C5 E5 D5 . . . C5 . B4 . A4 . . .'),
      step(e) {
        const { step: s, bar, chord: c, t, o } = e;
        if (s === 0) { I.piano(c.root - 12, t, 0.5, o, 1.4); I.strings(c.notes.map(n => n + 12), t, e.dur * 16, 0.5, o, 1.2); }
        if (s % 2 === 0 && s > 0 && P(0.8)) I.piano(arp(c, [0, 1, 2, 4, 2, 1, 3, 2][s / 2], 1), t, 0.28 + (s === 8 ? 0.08 : 0), o);
        if (Math.floor(bar / 8) % 2 === 1 && s % 4 === 0) { const m = this.mel[(bar % 8) * 4 + s / 4]; if (m) I.piano(m + 12, t + 0.01, 0.42, o, 1.6); }
      },
    },
    /* KÜL YOLU — re minör, parmakla çalınan gitar (Karplus), kum sesi */
    explore_road: {
      bpm: 84, spb: 16, vol: 0.85,
      chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'A', 'A'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        const pat = [0, null, 4, 2, 3, null, 4, 2, 1, null, 4, 2, 3, null, 4, 5];
        if (pat[s] != null) I.pluck(pat[s] === 0 ? c.root - 12 : arp(c, pat[s], 0) + 12, t, s === 0 ? 0.7 : 0.42, o, 0.4);
        if (s === 0) I.bass(c.root - 12, t, e.dur * 7, 0.5, o);
        if (s % 4 === 2) I.hat(t, 0.35, o);
        if (s === 0 && e.bar % 4 === 0) I.pad(c.notes, t, e.dur * 32, 0.5, o);
      },
    },
    /* BATAKLIK — mi frigyen, uzun dron, yavaş kamış melodi, damla çanları */
    explore_swamp: {
      bpm: 62, spb: 16, vol: 0.85,
      chords: ['Em', 'F', 'Em', 'Dm', 'Em', 'F', 'G', 'F'],
      mel: MEL('E4 . . F4 G4 . . . F4 . E4 . D4 . . . E4 . . G4 A4 . G4 F4 E4 . . . . . . .'),
      step(e) {
        const { step: s, bar, chord: c, t, o } = e;
        if (s === 0 && bar % 2 === 0) I.pad([40, 47, 52], t, e.dur * 32, 0.7, o);
        if (s === 0) I.pluck(c.root, t, 0.35, o, 0.2, 2.5);
        if (s % 4 === 0) { const m = this.mel[(bar % 8) * 4 + s / 4]; if (m) I.reed(m, t, e.dur * 6, 0.6, o); }
        if (P(0.06)) I.bell(76 + [0, 3, 7, 10][Math.floor(Math.random() * 4)], t, 0.25, o, 2.2);
      },
    },
    /* MADEN — fa# minör, müzik kutusu çan arpeji, metal tıkırtı */
    explore_mine: {
      bpm: 76, spb: 16, vol: 0.85,
      chords: ['F#m', 'D', 'Bm', 'C#', 'F#m', 'A', 'Bm', 'C#'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        if (s % 2 === 0) I.bell(arp(c, [0, 2, 1, 3, 2, 4, 3, 5][s / 2], 2), t, s === 0 ? 0.5 : 0.3, o, 2.4);
        if (s === 0) { I.pad([c.root - 12, c.root - 5], t, e.dur * 16, 0.6, o); I.bass(c.root - 12, t, e.dur * 12, 0.35, o); }
        if (s === 10 && P(0.5)) I.clank(t, 0.25, o);
      },
    },
    /* FABRİKA — do minör, mekanik bas ostinatosu, çekiç */
    explore_factory: {
      bpm: 96, spb: 16, vol: 0.8,
      chords: ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        const ost = [0, 0, 3, 0, 7, 0, 10, 0, 0, 12, 7, 0, 3, 0, 7, 10];
        if (s % 2 === 0) I.bass(c.root - 12 + ost[s], t, e.dur * 1.6, 0.45, o);
        if (s % 2 === 1) I.tick(t, 0.5, o);
        if (s === 0 || s === 8) I.kick(t, 0.5, o);
        if (s === 12) I.clank(t, 0.4, o);
        if (s === 0 && e.bar % 2 === 0) I.strings(c.notes, t, e.dur * 32, 0.4, o, 1.5);
      },
    },
    /* NEHİR — sol minör, 6/8 akan piyano */
    explore_river: {
      bpm: 96, spb: 12, vol: 0.85,
      chords: ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Cm', 'D', 'D'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        const pat = [0, 1, 2, 4, 2, 1, 0, 1, 2, 4, 5, 4];
        I.piano(s === 0 ? c.root - 12 : arp(c, pat[s], 1), t, s % 6 === 0 ? 0.36 : 0.22, o, 0.9);
        if (s === 0) I.strings(c.notes, t, e.dur * 12, 0.4, o, 0.9);
      },
    },
    /* ÖLÜ ŞEHİR — si bemol minör, melankolik piyano + yaylı kabarışı */
    explore_city: {
      bpm: 66, spb: 16, vol: 0.9,
      chords: ['Bbm', 'Gb', 'Db', 'Ab', 'Ebm', 'Gb', 'F', 'F'],
      mel: MEL('F5 . . Db5 C5 . Bb4 . Ab4 . . . . . . . Bb4 . Db5 . F5 . Eb5 Db5 C5 . . . A4 . . .'),
      step(e) {
        const { step: s, bar, chord: c, t, o } = e;
        if (s === 0) { I.piano(c.root - 12, t, 0.48, o, 1.6); I.piano(c.root - 24, t, 0.25, o, 1.6); }
        if (s === 6 || s === 10) I.piano(arp(c, s === 6 ? 1 : 2, 1), t, 0.25, o);
        if (s % 4 === 0) { const m = this.mel[(bar % 8) * 4 + s / 4]; if (m && bar % 16 >= 8) I.piano(m, t, 0.44, o, 1.5); }
        if (s === 0 && bar % 4 === 2) I.strings(c.notes.map(n => n + 12), t, e.dur * 32, 0.55, o, 2);
      },
    },
    /* KALE — re minör, askeri trampet, alçak bakır */
    explore_fortress: {
      bpm: 88, spb: 16, vol: 0.8,
      chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        const sn = [1, 0, 0, 0.5, 1, 0, 0.5, 0.5, 1, 0, 0, 0.5, 1, 0.5, 0.5, 0.5];
        if (sn[s]) I.snare(t, 0.3 * sn[s], o);
        if (s === 0 || s === 10) I.taiko(t, 0.45, o, 60);
        if (s === 0) I.brass(c.notes.map(n => n - 12), t, e.dur * 14, 0.35, o);
      },
    },
    /* SİS KULESİ — mi minör, org/koro + yüksek çan */
    explore_spire: {
      bpm: 60, spb: 16, vol: 0.85,
      chords: ['Em', 'C', 'Am', 'B', 'Em', 'G', 'Am', 'B'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        if (s === 0) I.choir(c.notes, t, e.dur * 16, 0.7, o);
        if (s === 0) I.bass(c.root - 12, t, e.dur * 14, 0.3, o);
        if (s % 4 === 2 && P(0.7)) I.bell(arp(c, Math.floor(Math.random() * 4), 2), t, 0.22, o, 3.5);
      },
    },
    /* GEÇİT — la minör, yükselen yaylı ostinato, koro, bakır melodi */
    explore_gate: {
      bpm: 72, spb: 16, vol: 0.85,
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
      mel: MEL('A4 . . . C5 . B4 . A4 . . . E4 . . . F4 . . . A4 . G4 . E4 . . . . . . .'),
      step(e) {
        const { step: s, bar, chord: c, t, o } = e;
        if (s % 2 === 0) I.stacc(arp(c, [0, 2, 1, 2][(s / 2) % 4], 0), t, 0.5, o);
        if (s === 0) I.choir(c.notes.map(n => n + 12), t, e.dur * 16, 0.5, o);
        if (s % 4 === 0) { const m = this.mel[(bar % 8) * 4 + s / 4]; if (m && bar % 16 >= 8) I.brass([m], t, e.dur * 3.5, 0.4, o); }
      },
    },
    /* İÇ MEKÂN — boğuk tek piyano notaları, oda dronu (perde tonuna göre) */
    interior: {
      bpm: 56, spb: 16, vol: 0.9,
      chords: ['Am', 'Am', 'F', 'E'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        if (s === 0) I.pad([c.root - 12, c.root - 5], t, e.dur * 16, 0.6, o);
        if ((s === 4 || s === 11) && P(0.75)) I.piano(arp(c, Math.floor(Math.random() * 3), 1), t, 0.22, o, 1.8);
        if (s === 14 && P(0.25)) I.bell(arp(c, 2, 2), t, 0.12, o, 2);
      },
    },
    /* GİZLİLİK — kısık pizzicato yürüyüşü, tik tak, gergin yatak */
    stealth: {
      bpm: 92, spb: 16, vol: 0.85,
      chords: ['Dm', 'Dm', 'Bb', 'A'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        const walk = [0, null, 3, null, 7, null, 3, null, 0, null, 3, null, 8, null, 7, null];
        if (walk[s] != null) I.pluck(c.root - 12 + walk[s], t, 0.4, o, 0.05, 0.5);
        if (s % 4 === 0) I.tick(t, 0.4, o);
        if (s === 0) I.strings([c.root + 12, c.root + 13], t, e.dur * 16, 0.28, o, 2);
      },
    },
    /* BULMACA — meraklı çan arpeji + pizzicato karşı ses, re dor */
    puzzle: {
      bpm: 100, spb: 16, vol: 0.8,
      chords: ['Dm', 'G', 'Dm', 'C', 'Bb', 'C', 'Dm', 'A'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        if (s % 2 === 0) I.bell(arp(c, [0, 1, 2, 3, 2, 1, 2, 4][s / 2], 2), t, 0.24, o, 1.4);
        if (s % 4 === 1) I.pluck(arp(c, (s >> 2) % 3, -1), t, 0.35, o, 0.1, 0.5);
        if (s === 0) I.pad(c.notes, t, e.dur * 16, 0.4, o);
      },
    },
    /* KOVALAMACA — 140 bpm, yaylı ostinato 16'lık, taiko, kick, braam */
    action: {
      bpm: 140, spb: 16, vol: 0.95,
      chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Dm', 'E'],
      step(e) {
        const { step: s, bar, chord: c, t, o, v } = e;
        const ost = [0, 0, 12, 0, 7, 0, 12, 7, 0, 0, 12, 0, 10, 0, 7, 3];
        I.stacc(c.root + ost[s], t, 0.55 + (s % 4 === 0 ? 0.25 : 0), o);
        if ([0, 3, 6, 8, 11, 14].includes(s)) I.taiko(t, (s === 0 || s === 8 ? 0.7 : 0.4) * (0.6 + v * 0.4), o, s === 0 ? 55 : 80);
        if (s % 4 === 0) I.kick(t, 0.55, o);
        if (s === 4 || s === 12) I.snare(t, 0.45, o);
        if (s % 2 === 1) I.hat(t, 0.4, o);
        if (s === 0 && bar % 4 === 0) I.braam(c.root - 12, t, 0.55, o);
        if (s === 0) I.strings(c.notes.map(n => n + 12), t, e.dur * 16, 0.45, o, 0.15);
      },
    },
    /* KAÇIŞ — 152 bpm, telaşlı oktav staccato, düz kick, riser */
    escape: {
      bpm: 152, spb: 16, vol: 0.95,
      chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'],
      step(e) {
        const { step: s, bar, chord: c, t, o } = e;
        I.stacc(c.root + (s % 2 ? 12 : 0) + (s % 8 === 6 ? 7 : 0), t, 0.6, o);
        if (s % 4 === 0) I.kick(t, 0.65, o);
        if (s === 4 || s === 12) I.snare(t, 0.55, o);
        I.hat(t, s % 2 ? 0.25 : 0.4, o);
        if (s === 0) I.brass(c.notes, t, e.dur * 14, 0.45, o);
        if (s === 0 && bar % 4 === 3) I.riser(t, e.dur * 16, 0.6, o);
        if (s === 0 && bar % 4 === 0) I.taiko(t, 0.8, o, 50);
      },
    },
    /* ARAÇ KAÇIŞI — 128 bpm, sürükleyici bas + davul, sentez lead */
    vehicle: {
      bpm: 128, spb: 16, vol: 0.9,
      chords: ['Em', 'C', 'G', 'D'],
      mel: MEL('E5 . G5 . B5 . A5 G5 F#5 . . . D5 . E5 .'),
      step(e) {
        const { step: s, bar, chord: c, t, o } = e;
        if (s % 2 === 0) I.bass(c.root - 12 + (s % 8 === 6 ? 7 : 0), t, e.dur * 1.8, 0.55, o);
        if (s % 4 === 0) I.kick(t, 0.6, o);
        if (s === 4 || s === 12) I.snare(t, 0.5, o);
        I.hat(t, 0.25, o, s % 4 === 2);
        if (bar % 2 === 1) { const m = this.mel[s]; if (m) I.brass([m - 12], t, e.dur * 1.8, 0.3, o); }
      },
    },
    /* BOMBA — tik tak, alçak nabız, çatışan yatak */
    bomb: {
      bpm: 120, spb: 16, vol: 0.85,
      chords: ['Cm', 'Cm', 'Db', 'Cm'],
      step(e) {
        const { step: s, chord: c, t, o } = e;
        if (s % 2 === 0) I.tick(t, s % 8 === 0 ? 0.6 : 0.35, o);
        if (s % 8 === 0) I.kick(t, 0.5, o, 45);
        if (s === 0) I.strings([c.root, c.root + 1, c.root + 6], t, e.dur * 16, 0.35, o, 1);
      },
    },
  };
  /* parça başına akorlar önceden çözülür */
  for (const k in TRACKS) TRACKS[k]._ch = TRACKS[k].chords.map(n => chord(n, 3));

  /* ---------------- YÖNETMEN ---------------- */
  const live = [];      // { name, tr, g, next, step, bar, dying }
  let timer = null, current = null, vol = 1, intensity = 0.5;
  let master = null;

  function ensure() {
    if (ctx) return true;
    ctx = SFAudio.ctx; if (!ctx) return false;
    bus = SFAudio.musicBus;
    master = ctx.createGain(); master.gain.value = 1; master.connect(bus);
    return true;
  }
  function play(name, fade = 2.2) {
    if (!ensure() || !TRACKS[name]) return;
    if (current === name) return;
    current = name;
    const t = ctx.currentTime;
    for (const L of live) if (!L.dying) {
      L.dying = true;
      L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t);
      L.g.gain.linearRampToValueAtTime(0.0001, t + fade);
      L.dieAt = t + fade + 0.2;
    }
    const tr = TRACKS[name];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(tr.vol, t + Math.max(0.4, fade * (name === 'action' || name === 'escape' ? 0.35 : 0.8)));
    g.connect(master);
    live.push({ name, tr, g, next: t + 0.08, step: 0, bar: 0, dying: false });
    if (!timer) timer = setInterval(sched, 25);
  }
  function sched() {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i];
      if (L.dying && now > L.dieAt) { try { L.g.disconnect(); } catch (e) {} live.splice(i, 1); continue; }
      const tr = L.tr;
      const dur = 60 / tr.bpm / (tr.spb / 4);
      let guard = 0;
      while (L.next < now + 0.14 && guard++ < 8) {
        if (!L.dying || L.next < L.dieAt - 0.3) {
          try { tr.step({ t: L.next, step: L.step, bar: L.bar, chord: tr._ch[L.bar % tr._ch.length], dur, o: L.g, v: intensity }); } catch (e) {}
        }
        L.next += dur;
        L.step++;
        if (L.step >= tr.spb) { L.step = 0; L.bar++; }
      }
    }
    if (!live.length) { clearInterval(timer); timer = null; }
  }
  function stop(fade = 1.5) {
    if (!ctx) return;
    current = null;
    const t = ctx.currentTime;
    for (const L of live) if (!L.dying) {
      L.dying = true;
      L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t);
      L.g.gain.linearRampToValueAtTime(0.0001, t + fade);
      L.dieAt = t + fade + 0.2;
    }
  }

  /* sahne → parça. Tehlike geçince müzik hemen düşmesin: yüksek öncelikli parça
     (aksiyon, kaçış...) son tetiklendiği andan sonra birkaç saniye daha sürer. */
  const PRIO = { bomb: 6, vehicle: 5, escape: 4, action: 3, stealth: 2, puzzle: 1 };
  const HOLD = { bomb: 2, vehicle: 2, escape: 3, action: 5, stealth: 3.5, puzzle: 4 };
  let holdUntil = 0;
  function setScene(state, biome, nowS) {
    let want = state === 'explore' ? 'explore_' + biome : state;
    if (!TRACKS[want]) want = 'explore_forest';
    const p = PRIO[want] ?? 0, pc = PRIO[current] ?? 0;
    if (want === current) { if (HOLD[want]) holdUntil = nowS + HOLD[want]; return; }
    if (p < pc && nowS < holdUntil) return;
    play(want, p > pc ? 1.0 : 3.0);
    holdUntil = nowS + (HOLD[want] ?? 0);
  }

  return {
    play, stop, setScene,
    setIntensity(v) { intensity = v; },
    get current() { return current; },
    tracks: Object.keys(TRACKS),
  };
})();
