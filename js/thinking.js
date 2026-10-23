/* ============================================================
   SHADOW FALL — AKIL OYUNLARI
   Aksiyon değil düşünce isteyen odalar. Hepsinde çözüm sahnede yazılı,
   yazı yok; oyuncu bakıp çıkarım yapar.

   circuit  LAMBA PANOSU — üstte bir sıra lamba, altta şalterler. Her
            şalter kablolarının gittiği lambaları açar/kapar. Hepsini
            yak: kapı açılır. (Kablolar duvarda görünür.)
   mirrors  AYNALAR — soldaki projektörün ışını ızgaradaki aynalardan
            seker. Aynaları çevir (/ ↔ \), ışını sensöre ulaştır. Üst
            sıradaki aynalara platformdan uzanılır.
   scale    TERAZİ — sol kefede demir ağırlık (çentik sayısı = ağırlık).
            Sandıkların ağırlığı boyuna göre (küçük 1, orta 2, büyük 3).
            Sağ kefeyi TAM dengele; ağır da hafif de olmaz.
   clocks   DURMUŞ SAATLER — duvarda dört durmuş saat, altlarında Roma
            rakamı. Şifre: saatlerin akrebi, rakam sırasıyla (I, II, III, IV)
            — duvardaki sıraya göre değil.

   Geç bölümlerde pano ve projektör ÇALIŞMAZ: önce jeneratöre pil tak.
   ============================================================ */
'use strict';

const THINK_TYPES = ['circuit', 'mirrors', 'scale', 'clocks'];

/* ============================================================
   YERLEŞİM
   ============================================================ */
function addThinkChunks(C, H) {
  const { L, rng } = H;
  L.puzzles = L.puzzles ?? [];
  const pid = () => 'pz' + L.puzzles.length;
  const d = H.d;
  /* geç bölümlerde bulmacayı çalıştırmak için önce güç gerekir */
  const needPower = (x, id) => {
    if (d < 0.3 || rng() > 0.35 + d * 0.5) return null;
    H.stash(rng() < 0.5 ? 'toolbox' : 'locker', x - 260 - rng() * 200, H.getGy(), ['battery']);
    const gid = 'gen_' + id;
    L.generators.push({ x: x + 40, groundY: H.getGy(), id: gid });
    L.genLinks[gid] = { puzzle: id };
    return gid;
  };
  const door = (x) => {
    const gy = H.getGy();
    L.walls.push({ x, y0: gy - 520, y1: gy - 178 });
    L.noGrab.push({ x, y: gy - 178 });
    return { x, y: gy, h: 180 };
  };

  /* ---------- LAMBA PANOSU ---------- */
  C.circuit = () => {
    const gy = H.getGy();
    C.flat(120);
    const id = pid();
    const x0 = H.getX();
    const gen = needPower(x0, id);
    const n = d < 0.35 ? 4 : 5;
    const sx0 = x0 + (gen ? 160 : 90);
    const switches = [];
    for (let i = 0; i < n; i++) {
      /* her şalter 2–3 lamba; komşuluk kurallı değil, rastgele ama çözülebilir */
      const links = new Set([i]);
      while (links.size < (rng() < 0.4 + d * 0.4 ? 3 : 2)) links.add(Math.floor(rng() * n));
      switches.push({ x: sx0 + i * 96, links: [...links].sort() });
    }
    /* başlangıç: hepsi yanık durumdan rastgele şalter çevirmeleri (en az 2) */
    let state;
    do {
      state = new Array(n).fill(true);
      const presses = new Set();
      while (presses.size < 2 + Math.floor(rng() * (n - 1))) presses.add(Math.floor(rng() * n));
      for (const k of presses) for (const j of switches[k].links) state[j] = !state[j];
    } while (state.every(Boolean));
    const lamps = [];
    for (let i = 0; i < n; i++) lamps.push(sx0 + 20 + i * 96);
    const doorX = sx0 + n * 96 + 120;
    L.puzzles.push({ type: 'circuit', id, switches, lamps, lampY: gy - 230, state, gen, door: door(doorX), groundY: gy, hintX: x0 });
    H.setX(doorX + 140);
  };

  /* ---------- AYNALAR ---------- */
  C.mirrors = () => {
    const gy = H.getGy();
    C.flat(120);
    const id = pid();
    const x0 = H.getX();
    const gen = needPower(x0, id);
    const ax = x0 + (gen ? 180 : 100);                 // projektör direği
    const cols = [ax + 170, ax + 340, ax + 510];
    const rows = [gy - 72, gy - 178];
    const right = ax + 660;                            // sensör duvarı
    const top = gy - 268;                              // tavan sensör kirişi
    let tries = 0, sol;
    do {
      tries++;
      const nodes = [];
      for (let c = 0; c < 3; c++) for (let r = 0; r < 2; r++) if (rng() < 0.75) nodes.push({ c, r, m: rng() < 0.5 ? 1 : -1 });
      const srcRow = rng() < 0.5 ? 0 : 1;
      const tr = traceBeam({ nodes, srcRow });
      sol = { nodes, srcRow, tr };
    } while ((sol.tr.bounces < 2 || !['right', 'top'].includes(sol.tr.exit.side)) && tries < 400);
    /* başlangıç durumu: çözüm aynaları karıştırılır, hedefe gitmeyecek şekilde */
    const start = sol.nodes.map(m => ({ ...m }));
    do { for (const m of start) if (rng() < 0.6) m.m = -m.m; }
    while (sameExit(traceBeam({ nodes: start, srcRow: sol.srcRow }).exit, sol.tr.exit));
    /* üst sıradaki aynalara uzanmak için basamak platformlar */
    for (const m of start) if (m.r === 1) L.platforms.push({ x: cols[m.c] - 96, y: gy - 96, w: 64, material: 'metal' });
    const doorX = right + 110;
    L.puzzles.push({
      type: 'mirrors', id, cols, rows, ax, right, top, srcRow: sol.srcRow,
      nodes: start, target: sol.tr.exit, gen, door: door(doorX), groundY: gy, hintX: x0,
    });
    H.setX(doorX + 140);
  };

  /* ---------- TERAZİ ---------- */
  C.scale = () => {
    const gy = H.getGy();
    C.flat(100);
    const id = pid();
    const x0 = H.getX();
    /* sandıklar: ağırlık = boy. Hedefi tek sandıkla tutturmak mümkün değil */
    const W = [1, 2, 2, 3];
    if (d > 0.5) W.push(rng() < 0.5 ? 1 : 3);
    let target;
    do { target = 3 + Math.floor(rng() * 4); } while (W.includes(target) || !subsetSum(W, target));
    const sizes = { 1: 44, 2: 58, 3: 72 };
    const order = shuffleWith(rng, W);
    order.forEach((w, i) => L.pushboxes.push({ x: x0 + 70 + i * 96, groundY: gy, w: sizes[w], h: sizes[w], density: 0.002 + w * 0.0015, weight: w }));
    const px = x0 + 80 + order.length * 96 + 80;      // sağ kefe (yerde, oyuncunun önünde)
    const pivotX = px + 220;
    const doorX = pivotX + 300;
    L.puzzles.push({ type: 'scale', id, target, pan: { x0: px, x1: px + 230, y: gy }, pivotX, door: door(doorX), groundY: gy, hintX: x0 });
    H.setX(doorX + 140);
  };

  /* ---------- DURMUŞ SAATLER ---------- */
  C.clocks = () => {
    const gy = H.getGy();
    C.flat(120);
    const id = pid();
    const x0 = H.getX();
    const lock = 'clk' + id;
    const hours = [0, 0, 0, 0].map(() => 1 + Math.floor(rng() * 9));
    const numerals = shuffleWith(rng, [0, 1, 2, 3]);            // duvardaki sıra ≠ rakam sırası
    while (numerals.every((v, i) => v === i)) numerals.reverse();
    const clocks = numerals.map((k, i) => ({ x: x0 + 110 + i * 150, y: gy - 170 - (i % 2) * 40, h: hours[k], num: k }));
    const code = [0, 1, 2, 3].map(k => clocks.find(c => c.num === k).h);
    const wallX = x0 + 760;
    L.keypads = L.keypads ?? [];
    L.keypads.push({ x: wallX - 26, groundY: gy, door: 'kp_' + lock, code, lock });
    L.walls.push({ x: wallX, y0: gy - 520, y1: gy - 148 });
    L.noGrab.push({ x: wallX, y: gy - 148 });
    L.poweredDoors.push({ x: wallX, y: gy, h: 150, id: 'kp_' + lock });
    L.puzzles.push({ type: 'clocks', id, clocks, lock, wallX, groundY: gy, hintX: x0 });
    H.setX(wallX + 140);
  };
}

function subsetSum(arr, t) {
  const n = arr.length;
  for (let m = 1; m < (1 << n); m++) {
    let s = 0, c = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) { s += arr[i]; c++; }
    if (s === t && c >= 2) return true;
  }
  return false;
}
function sameExit(a, b) { return a.side === b.side && a.idx === b.idx; }

/* ışın izi: soldan srcRow satırından sağa; '/' (m=1) ve '\' (m=-1) aynalar */
function traceBeam(cfg) {
  const at = {};
  for (const n of cfg.nodes) at[n.c + ',' + n.r] = n;
  let c = -1, r = cfg.srcRow, dc = 1, dr = 0, bounces = 0;
  const path = [{ c: -1, r }];
  for (let k = 0; k < 24; k++) {
    c += dc; r += dr;
    if (c < 0) return { path, exit: { side: 'left', idx: r }, bounces };
    if (c > 2) return { path, exit: { side: 'right', idx: r }, bounces };
    if (r < 0) return { path, exit: { side: 'bottom', idx: c }, bounces };
    if (r > 1) return { path, exit: { side: 'top', idx: c }, bounces };
    path.push({ c, r });
    const n = at[c + ',' + r];
    if (n) {
      bounces++;
      /* satır yukarı arttığı için: '/' sağ→yukarı, '\' sağ→aşağı */
      if (n.m === 1) [dc, dr] = [dr, dc];
      else [dc, dr] = [-dr, -dc];
    }
  }
  return { path, exit: { side: 'loop', idx: 0 }, bounces };
}

/* ============================================================
   ÇALIŞMA ANI — Puzzles'a eklenir
   ============================================================ */
Object.assign(Puzzles, {
  onPower(sc, id) {
    const p = (sc.pz ?? []).find(q => q.id === id);
    if (p) { p.powered = true; SFAudio.generatorStart?.(); }
  },
  _powerOk(sc, p) {
    if (!p.gen || p.powered) return true;
    if (!p._noPowHint || sc.time.now - p._noPowHint > 4000) { p._noPowHint = sc.time.now; UI.hint('Panoda akım yok. Bir jeneratör olmalı.', 2600, '⚡'); }
    SFAudio.thud(0.2);
    return false;
  },
  _thinkHint(sc, p, dt, text) {
    const P = sc.player;
    if (p.solved || p.hinted || !P || Math.abs(P.body.position.x - (p.hintX + 300)) > 500) return;
    p.waitT = (p.waitT ?? 0) + dt;
    if (p.waitT > 45) { p.hinted = true; UI.hint(text, 4200, '?'); }
  },

  /* ---------- LAMBA PANOSU ---------- */
  _setup_circuit(sc, p) {
    p.D = this._door(sc, p.door);
    p.state = [...p.state];
    p.g = sc.add.graphics().setDepth(66);
    p.lights = p.lamps.map(x => sc.lights2.addLight({ x, y: p.lampY, r: 70, type: 'halo', intensity: 0.7, on: false }));
    p.pull = p.switches.map(() => 0);
    this._drawCircuit(sc, p);
    return p;
  },
  _drawCircuit(sc, p) {
    const g = p.g; g.clear();
    const c = 0x0c0c12, gy = p.groundY, live = !p.gen || p.powered;
    /* pano */
    g.fillStyle(c, 1); g.fillRect(p.lamps[0] - 40, p.lampY - 24, p.lamps[p.lamps.length - 1] - p.lamps[0] + 80, 40);
    /* kablolar: her şalterden bağlı olduğu lambalara (renkli değil, ince ve ayırt edilir) */
    p.switches.forEach((s, i) => {
      for (const j of s.links) {
        const off = (i - (p.switches.length - 1) / 2) * 3;
        g.lineStyle(1.3, 0x5a5a64, 0.85);
        g.beginPath(); g.moveTo(s.x, gy - 60); g.lineTo(s.x, gy - 110 - i * 9); g.lineTo(p.lamps[j] + off, gy - 110 - i * 9); g.lineTo(p.lamps[j] + off, p.lampY + 16); g.strokePath();
        g.fillStyle(0x5a5a64, 0.9); g.fillCircle(p.lamps[j] + off, gy - 110 - i * 9, 1.8);
      }
    });
    p.lamps.forEach((x, j) => {
      const on = live && p.state[j];
      g.fillStyle(on ? 0xf0d8a0 : 0x26262c, 1); g.fillCircle(x, p.lampY - 4, on ? 9 : 8);
      p.lights[j].on = on;
    });
    /* şalterler: kutu + kol, altında çentikle numara */
    p.switches.forEach((s, i) => {
      g.fillStyle(c, 1); g.fillRect(s.x - 10, gy - 62, 20, 62);
      const a = -0.6 + p.pull[i] * 1.2;
      g.lineStyle(3.4, c, 1); g.beginPath(); g.moveTo(s.x, gy - 56); g.lineTo(s.x + Math.sin(a) * 22, gy - 56 - Math.cos(a) * 22); g.strokePath();
      g.fillStyle(0x6a665e, 1);
      for (let k = 0; k <= i; k++) g.fillRect(s.x - 8 + k * 4, gy - 36, 2, 7);
    });
  },
  _update_circuit(sc, p, dt) {
    if (!p.solved && (!p.gen || p.powered) && p.state.every(Boolean)) {
      p.solved = true; p.D.target = 1;
      SFAudio.doorUnlock(); SFAudio.playHopeMotif();
    }
    this._moveDoor(sc, p.D, dt, 0.9);
    this._thinkHint(sc, p, dt, 'Her şalterin kablosu hangi lambalara gidiyor?');
  },
  _find_circuit(sc, p, px) {
    if (p.solved) return null;
    for (let i = 0; i < p.switches.length; i++) {
      const s = p.switches[i];
      if (Math.abs(px - s.x) < 30) return { type: 'p-act', obj: p, idx: i, label: 'ŞALTER ' + ['I', 'II', 'III', 'IV', 'V'][i], x: s.x, y: p.groundY - 90 };
    }
    return null;
  },
  _act_circuit(sc, p, t) {
    if (!this._powerOk(sc, p)) return;
    const i = t.idx;
    sc.player.mode = 'action';
    sc.rig.startAction('lever', {
      targetX: p.switches[i].x, targetY: p.groundY - 50,
      onPhase: (ph) => {
        if (ph !== 'pulled') return;
        for (const j of p.switches[i].links) p.state[j] = !p.state[j];
        p.pull[i] = 1;
        sc.tweens.add({ targets: p.pull, [i]: 0, duration: 400, delay: 200, onUpdate: () => this._drawCircuit(sc, p) });
        SFAudio.itemHit('metal', 0.4); SFAudio.flashClick(true);
        this._drawCircuit(sc, p);
      },
      onDone: () => { sc.player.mode = 'idle'; },
    });
  },

  /* ---------- AYNALAR ---------- */
  _setup_mirrors(sc, p) {
    p.D = this._door(sc, p.door);
    p.nodes = p.nodes.map(n => ({ ...n }));
    p.g = sc.add.graphics().setDepth(66);
    p.beam = sc.add.graphics().setDepth(104).setBlendMode(Phaser.BlendModes.ADD);
    p.srcLight = sc.lights2.addLight({ x: p.ax, y: p.rows[p.srcRow], r: 90, type: 'halo', intensity: 0.8 });
    p.hitLight = sc.lights2.addLight({ x: 0, y: 0, r: 70, type: 'halo', intensity: 0.7, on: false });
    this._drawMirrors(sc, p);
    return p;
  },
  _nodeXY(p, c, r) {
    const x = c < 0 ? p.ax : c > 2 ? p.right : p.cols[c];
    const y = r < 0 ? p.groundY - 4 : r > 1 ? p.top : p.rows[r];
    return { x, y };
  },
  _drawMirrors(sc, p) {
    const g = p.g; g.clear();
    const c = 0x0c0c12, gy = p.groundY, live = !p.gen || p.powered;
    /* projektör direği, sensör duvarı, tavan kirişi */
    g.fillStyle(c, 1);
    g.fillRect(p.ax - 8, p.rows[p.srcRow] - 12, 22, 24); g.fillRect(p.ax - 3, p.rows[p.srcRow], 6, gy - p.rows[p.srcRow]);
    g.fillRect(p.right - 6, p.top - 6, 12, gy - p.top - 190);
    g.fillRect(p.ax + 60, p.top - 14, p.right - p.ax - 54, 10);
    /* hedef sensör (kızıl göz) */
    const T = this._nodeXY(p, p.target.side === 'right' ? 3 : p.target.idx, p.target.side === 'top' ? 2 : p.target.idx);
    g.fillStyle(p.solved ? 0x8fb08f : 0xc8483a, p.solved ? 0.95 : 0.7); g.fillCircle(T.x, T.y, 5);
    g.lineStyle(1.2, 0x2a2a32, 1); g.strokeCircle(T.x, T.y, 9);
    /* boş montaj noktaları ve aynalar */
    for (let cc = 0; cc < 3; cc++) for (let r = 0; r < 2; r++) { const q = this._nodeXY(p, cc, r); g.fillStyle(0x1d1e26, 1); g.fillCircle(q.x, q.y, 2); }
    for (const n of p.nodes) {
      const q = this._nodeXY(p, n.c, n.r);
      g.fillStyle(c, 1); g.fillRect(q.x - 2, q.y, 4, gy - q.y);              // ayak
      g.lineStyle(6, c, 1); g.beginPath(); g.moveTo(q.x - 14, q.y + 14 * n.m); g.lineTo(q.x + 14, q.y - 14 * n.m); g.strokePath();
      g.lineStyle(2, 0xb8c4d6, 0.8); g.beginPath(); g.moveTo(q.x - 12, q.y + 12 * n.m - 2); g.lineTo(q.x + 12, q.y - 12 * n.m - 2); g.strokePath();
    }
    /* ışın */
    const b = p.beam; b.clear();
    if (!live) { p.hitLight.on = false; return; }
    const tr = traceBeam({ nodes: p.nodes, srcRow: p.srcRow });
    const pts = tr.path.map(s => this._nodeXY(p, s.c, s.r));
    const e = tr.exit;
    pts.push(this._nodeXY(p, e.side === 'right' ? 3 : e.side === 'left' ? -1 : e.idx, e.side === 'top' ? 2 : e.side === 'bottom' ? -1 : e.idx));
    for (const [w, a] of [[7, 0.18], [2.2, 0.85]]) {
      b.lineStyle(w, 0xf6e6b8, a); b.beginPath(); b.moveTo(pts[0].x + 10, pts[0].y);
      for (const q of pts.slice(1)) b.lineTo(q.x, q.y);
      b.strokePath();
    }
    const end = pts[pts.length - 1];
    p.hitLight.on = true; p.hitLight.x = end.x; p.hitLight.y = end.y;
    p.hit = sameExit(e, p.target);
  },
  _update_mirrors(sc, p, dt) {
    if (!p.solved && p.hit) { p.solved = true; p.D.target = 1; SFAudio.doorUnlock(); SFAudio.playHopeMotif(); this._drawMirrors(sc, p); }
    this._moveDoor(sc, p.D, dt, 0.9);
    this._thinkHint(sc, p, dt, 'Işının çarptığı her aynada yön değişiyor. Kızıl göze nereden gelmeli?');
  },
  _find_mirrors(sc, p, px, py) {
    if (p.solved) return null;
    const feet = py + 30;
    let best = null, bd = 1e9;
    for (const n of p.nodes) {
      const q = this._nodeXY(p, n.c, n.r);
      const dx = Math.abs(px - q.x);
      if (dx > 80 || feet < q.y - 4 || feet - q.y > 140) continue;
      if (dx < bd) { bd = dx; best = { type: 'p-act', obj: p, node: n, label: 'AYNAYI ÇEVİR', x: q.x, y: q.y - 34 }; }
    }
    return best;
  },
  _act_mirrors(sc, p, t) {
    if (!this._powerOk(sc, p)) return;
    t.node.m = -t.node.m;
    SFAudio.itemHit('metal', 0.35);
    this._drawMirrors(sc, p);
  },

  /* ---------- TERAZİ ---------- */
  _setup_scale(sc, p) {
    p.D = this._door(sc, p.door);
    p.g = sc.add.graphics().setDepth(66);
    p.tilt = 0;
    return p;
  },
  _update_scale(sc, p, dt) {
    let w = 0;
    for (const pb of sc.pushboxes) {
      const b = pb.body.bounds;
      if (pb.body.position.x > p.pan.x0 && pb.body.position.x < p.pan.x1 && b.max.y > p.pan.y - 160) w += pb.weight;
    }
    p.load = w;
    const diff = clamp(w - p.target, -4, 4);
    p.tilt = lerp(p.tilt, diff / 4, 1 - Math.exp(-dt * 3));
    if (!p.solved && w === p.target) {
      p.balT = (p.balT ?? 0) + dt;
      if (p.balT > 1) { p.solved = true; p.D.target = 1; SFAudio.doorUnlock(); SFAudio.playHopeMotif(); }
    } else p.balT = 0;
    this._moveDoor(sc, p.D, dt, 0.9);
    this._thinkHint(sc, p, dt, 'Ağırlığı sandığın boyu belli ediyor. Kefe tam dengede olmalı.');
    /* çizim: kefe (yerde), direk, kol, karşı kefede demir ağırlıklar, gösterge */
    const g = p.g; g.clear();
    const c = 0x0c0c12, gy = p.groundY, a = -p.tilt * 0.35;
    const L = 200, ax = p.pivotX, ay = gy - 210;
    const lx = ax - Math.cos(a) * L, ly = ay - Math.sin(a) * L;
    const rx = ax + Math.cos(a) * 80, ry = ay + Math.sin(a) * 80;
    g.fillStyle(c, 1); g.fillRect(ax - 7, ay, 14, gy - ay);
    g.lineStyle(6, c, 1); g.beginPath(); g.moveTo(lx, ly); g.lineTo(rx, ry); g.strokePath();
    g.lineStyle(1.4, c, 1); g.beginPath(); g.moveTo(lx, ly); g.lineTo((p.pan.x0 + p.pan.x1) / 2, gy - 150); g.strokePath();
    g.fillStyle(c, 1); g.fillRect(p.pan.x0, gy - 4, p.pan.x1 - p.pan.x0, 6);
    /* karşı kefe: asılı, üstünde çentikli demir bloklar */
    const cx = rx, cy = ry + 60;
    g.lineStyle(1.4, c, 1); g.beginPath(); g.moveTo(rx, ry); g.lineTo(cx, cy); g.strokePath();
    g.fillRect(cx - 34, cy, 68, 6);
    g.fillRect(cx - 26, cy - 26, 52, 26);
    g.fillStyle(0x8a8478, 0.9);
    for (let k = 0; k < p.target; k++) g.fillRect(cx - 22 + k * 7, cy - 20, 3, 14);
    /* gösterge: ortada = denge */
    g.fillStyle(c, 1); g.fillRect(ax - 22, ay - 44, 44, 26);
    g.lineStyle(2, p.solved ? 0x8fb08f : 0xd8d4c8, 0.85);
    g.beginPath(); g.moveTo(ax, ay - 20); g.lineTo(ax + Math.sin(p.tilt * 1.2) * 18, ay - 20 - Math.cos(p.tilt * 1.2) * 18); g.strokePath();
    g.fillStyle(0x6a665e, 1); g.fillRect(ax - 1, ay - 43, 2, 4);
  },

  /* ---------- DURMUŞ SAATLER ---------- */
  _setup_clocks(sc, p) {
    const g = sc.add.graphics().setDepth(62);
    const c = 0x0c0c12;
    for (const k of p.clocks) {
      g.fillStyle(c, 1); g.fillCircle(k.x, k.y, 24);
      g.lineStyle(1.4, 0x3a3a44, 1); g.strokeCircle(k.x, k.y, 21);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        g.fillStyle(0x6a665e, 1); g.fillCircle(k.x + Math.sin(a) * 17, k.y - Math.cos(a) * 17, i % 3 ? 0.9 : 1.6);
      }
      const ha = k.h * Math.PI / 6;
      g.lineStyle(3, 0xbab4a8, 0.95); g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(k.x + Math.sin(ha) * 10, k.y - Math.cos(ha) * 10); g.strokePath();
      g.lineStyle(1.6, 0xbab4a8, 0.8); g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(k.x, k.y - 16); g.strokePath();
      g.fillStyle(c, 1); g.fillRect(k.x - 2, k.y + 24, 4, 20);
      sc.add.text(k.x, k.y + 52, ['I', 'II', 'III', 'IV'][k.num], { fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: '#8a8478' })
        .setOrigin(0.5, 0.5).setDepth(62);
      sc.lights2.addLight({ x: k.x, y: k.y, r: 60, type: 'halo', intensity: 0.45 });
    }
    return p;
  },
  _update_clocks(sc, p, dt) {
    p.solved = !!sc.mis?.keypads?.find(k => k.lock === p.lock)?.solved;
    this._thinkHint(sc, p, dt, 'Saatlerin altındaki rakamlar bir sıra söylüyor.');
  },
});
