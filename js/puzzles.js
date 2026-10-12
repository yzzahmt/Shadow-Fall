/* ============================================================
   SHADOW FALL — BULMACALAR
   Her bölümde en az bir akıl oyunu. Hepsi fizik / mekanizma tabanlı,
   ipucu yazısı yerine sahnenin kendisi anlatır:

   canal      KANAL — karşı kıyı yüksek, su sığ. Tahta parça suda yüzüyor
              ama işe yaramıyor. Bölmenin altından yüzüp vanaya ulaş,
              suyu yükselt: tahta yükselince karşıya atla.
   hydraulic  BİRLEŞİK KAPLAR — bir haznede piston plakası, öbüründe su ve
              sal. Ağır sandığı plakaya it: basınç öbür haznedeki suyu,
              sal da seni yukarı taşır.
   pulley     KARŞI AĞIRLIK — iki asansör kafesi tek halatla bağlı. Bir
              tarafa ağırlık koy, öbür tarafa bin, freni bırak.
   pressure   BASKI PLAKASI — ağır kapı yalnız plakaya bir şey bastığı
              sürece açık durur. Üstüne sen basarsan yetişemezsin.
   photocell  IŞIK GÖZÜ — kapının üstündeki sensöre feneri tut.
   timedGate  ZAMANLI KAPI — kolu çek, kapı kapanmadan koş, kay.

   Yerleşim levelgen içinden (C.<tip>()), çalışma anı GameScene'den.
   Ölçüler oyuncunun zıplamasına göre: duran zıplama ≈180px, tutunarak
   ≈260px erişim, koşarak ≈140px yatay. "Geçilmez" duvarlar bunun üstünde
   ve tutunmaya kapalı (noGrab).
   ============================================================ */
'use strict';

const PUZZLE_POOLS = {
  forest:   ['climb', 'leverLadder', 'canal', 'pressure', 'timedGate'],
  road:     ['pressure', 'genDoor', 'timedGate', 'photocell', 'climb'],
  swamp:    ['canal', 'hydraulic', 'climb', 'leverLadder'],
  mine:     ['pulley', 'photocell', 'genDoor', 'leverLadder'],
  factory:  ['pulley', 'factoryLock', 'pressure', 'timedGate', 'hydraulic'],
  river:    ['canal', 'hydraulic', 'pressure', 'climb'],
  city:     ['photocell', 'shop', 'timedGate', 'pressure', 'pulley'],
  fortress: ['pulley', 'pressure', 'timedGate', 'photocell'],
  spire:    ['pulley', 'photocell', 'leverLadder', 'climb'],
  gate:     ['canal', 'hydraulic', 'pulley', 'pressure', 'photocell', 'timedGate'],
};

/* ============================================================
   YERLEŞİM
   ============================================================ */
function addPuzzleChunks(C, H) {
  const { L, rng } = H;
  L.puzzles = L.puzzles ?? [];
  const pid = () => 'pz' + L.puzzles.length;

  /* ---------- KANAL ---------- */
  C.canal = () => {
    const gy = H.getGy();
    const x = H.getX();
    C.flat(160);
    const b0 = H.getX();                 // sol kıyı ucu
    const W = 660;
    const b1 = b0 + W;                   // sağ kıyı (yüksek)
    const low = gy + 110, high = gy - 60, bottom = gy + 280;
    const xm = b0 + 300;                 // su altı bölmesi
    H.endSeg(b0);
    L.ground.push({ x0: b0 - 6, x1: b1 + 6, y: bottom, material: 'concrete' });
    /* bölme: tavandan suyun dibine 80px kalana kadar iner — altından yüzülür */
    L.walls.push({ x: xm, y0: gy - 330, y1: bottom - 80, look: 'concrete' });
    /* sağ kıyı duvarı */
    L.walls.push({ x: b1, y0: gy - 200, y1: bottom + 2 });
    L.noGrab.push({ x: b1, y: gy - 200 });
    /* sol duvarda çıkış merdiveni (suya düşen geri çıkabilsin) */
    L.ladders.push({ x: b0 + 16, topY: gy, bottomY: bottom - 4, raised: false, id: pid() + 'lad' });
    /* bakım platformu + vana (bölmenin sağında, sığ suyun hemen üstünde) */
    L.platforms.push({ x: xm + 30, y: gy + 30, w: 150, material: 'metal' });
    const id = pid();
    L.puzzles.push({
      type: 'canal', id, x0: b0, x1: b1, xm, low, high, bottom,
      valve: { x: xm + 120, y: gy + 30 },
      plank: { x: xm + 210, w: 128 },
      bankY: gy - 200, hintX: b0 - 40,
    });
    H.setX(b1);
    H.jumpTo(b1, gy - 200);
    C.flat(300);
    /* yükseltiden aşağı iniş */
    const xd = H.getX();
    H.endSeg(xd);
    H.jumpTo(xd, gy);
    H.setX(xd + 40);
    void x;
  };

  /* ---------- BİRLEŞİK KAPLAR (hidrolik) ---------- */
  C.hydraulic = () => {
    const gy = H.getGy();
    C.flat(120);
    const bx = H.getX();
    L.pushboxes.push({ x: bx + 60, groundY: gy, w: 72, h: 72, density: 0.006 });
    C.flat(260);
    const a0 = H.getX(), a1 = a0 + 190;          // piston haznesi
    const d0 = a1, d1 = a1 + 90;                 // ara set
    const t0 = d1, t1 = d1 + 320;                // su haznesi
    H.endSeg(a0);
    L.ground.push({ x0: a0 - 4, x1: a1 + 4, y: gy + 150, material: 'concrete' });   // piston kuyusu dibi
    L.ground.push({ x0: d0, x1: d1, y: gy, material: 'concrete' });                 // ara set
    L.ground.push({ x0: t0 - 4, x1: t1 + 4, y: gy + 260, material: 'concrete' });   // su haznesi dibi
    L.walls.push({ x: t1, y0: gy - 200, y1: gy + 262 });
    L.noGrab.push({ x: t1, y: gy - 200 });
    const id = pid();
    L.puzzles.push({
      type: 'hydraulic', id,
      plate: { x0: a0 + 3, x1: a1 - 3, y: gy, travel: 120 },
      tank: { x0: t0, x1: t1, low: gy + 110, high: gy - 62, bottom: gy + 260 },
      raft: { w: 120 },
      hintX: bx,
    });
    H.setX(t1);
    H.jumpTo(t1, gy - 200);
    C.flat(280);
    const xd = H.getX();
    H.endSeg(xd);
    H.jumpTo(xd, gy);
    H.setX(xd + 40);
  };

  /* ---------- KARŞI AĞIRLIK ASANSÖRÜ ---------- */
  C.pulley = () => {
    const gy = H.getGy();
    C.flat(100);
    const bx = H.getX();
    L.pushboxes.push({ x: bx + 70, groundY: gy, w: 72, h: 72, density: 0.006 });
    C.flat(250);
    const l0 = H.getX(), l1 = l0 + 150;          // sol kafes kuyusu
    const s0 = l1, s1 = l1 + 140;                // ara zemin (makara direği)
    const r0 = s1, r1 = s1 + 150;                // sağ kafes kuyusu
    const rise = 262;
    H.endSeg(l0);
    L.ground.push({ x0: l0 - 4, x1: l1 + 4, y: gy + rise + 20, material: 'metal' });
    L.ground.push({ x0: s0, x1: s1, y: gy, material: 'metal' });
    L.ground.push({ x0: r0 - 4, x1: r1 + 4, y: gy + 30, material: 'metal' });
    L.walls.push({ x: r1, y0: gy - rise, y1: gy + 32 });
    L.noGrab.push({ x: r1, y: gy - rise });
    const id = pid();
    L.puzzles.push({
      type: 'pulley', id, rise,
      left: { x0: l0 + 4, x1: l1 - 4 }, right: { x0: r0 + 4, x1: r1 - 4 },
      y: gy, pulleyX: (s0 + s1) / 2, pulleyY: gy - rise - 70,
      brake: { x: r0 + 40 },
      hintX: bx,
    });
    H.setX(r1);
    H.jumpTo(r1, gy - rise);
    C.flat(260);
    const xd = H.getX();
    H.endSeg(xd);
    H.jumpTo(xd, gy);
    H.setX(xd + 40);
  };

  /* ---------- BASKI PLAKASI + AĞIR KAPI ---------- */
  C.pressure = () => {
    const gy = H.getGy();
    C.flat(80);
    const bx = H.getX();
    L.pushboxes.push({ x: bx + 60, groundY: gy, w: 72, h: 72, density: 0.006 });
    C.flat(220);
    const px = H.getX();
    const id = pid();
    const doorX = px + 420;
    L.walls.push({ x: doorX, y0: gy - 520, y1: gy - 178 });
    L.puzzles.push({ type: 'pressure', id, plate: { x0: px, x1: px + 96, y: gy }, door: { x: doorX, y: gy, h: 180 }, hintX: bx });
    H.setX(doorX + 140);
  };

  /* ---------- IŞIK GÖZÜ ---------- */
  C.photocell = () => {
    const gy = H.getGy();
    C.flat(120);
    const x = H.getX();
    /* fenersiz kalınmasın: hemen önünde pil olan bir alet çantası */
    H.stash('toolbox', x + 40, gy, ['battery']);
    const doorX = x + 380;
    L.walls.push({ x: doorX, y0: gy - 520, y1: gy - 168 });
    const id = pid();
    L.puzzles.push({ type: 'photocell', id, eye: { x: doorX - 14, y: gy - 196 }, door: { x: doorX, y: gy, h: 170 }, hintX: x + 120 });
    H.setX(doorX + 140);
  };

  /* ---------- ZAMANLI KAPI ---------- */
  C.timedGate = () => {
    const gy = H.getGy();
    C.flat(120);
    const x = H.getX();
    const leverId = 'lev_' + pid();
    L.levers.push({ x: x + 40, groundY: gy, id: leverId });
    /* yolda alçak kiriş — koşarken kayarak geçilir */
    L.platforms.push({ x: x + 250, y: gy - 150, w: 90, thick: 108, material: 'metal', look: 'beam' });
    const doorX = x + 560;
    L.walls.push({ x: doorX, y0: gy - 520, y1: gy - 168 });
    const id = pid();
    L.leverLinks[leverId] = { puzzle: id };
    L.puzzles.push({ type: 'timedGate', id, lever: leverId, door: { x: doorX, y: gy, h: 170 }, window: 4.2, hintX: x });
    H.setX(doorX + 140);
  };
}

/* ============================================================
   ÇALIŞMA ANI
   ============================================================ */
const Puzzles = {
  setup(sc) {
    sc.pz = [];
    for (const p of (sc.ch.puzzles ?? [])) {
      const fn = this['_setup_' + p.type];
      if (fn) sc.pz.push(fn.call(this, sc, { ...p }));
    }
  },
  update(sc, dt) {
    for (const p of sc.pz ?? []) this['_update_' + p.type]?.call(this, sc, p, dt);
  },
  findInteractable(sc, px, py) {
    for (const p of sc.pz ?? []) {
      const t = this['_find_' + p.type]?.call(this, sc, p, px, py);
      if (t) return t;
    }
    return null;
  },
  interact(sc, t) {
    const fn = this['_act_' + t.obj.type];
    return fn ? (fn.call(this, sc, t.obj, t), true) : false;
  },
  tapTargets(sc) {
    const T = [];
    for (const p of sc.pz ?? []) {
      if (p.type === 'canal' && !p.raised) T.push({ x: p.valve.x, y: p.valve.y - 30, ax: p.valve.x });
      if (p.type === 'pulley' && p.state === 'locked') T.push({ x: p.brake.x, y: p.rY - 40, ax: p.brake.x });
    }
    return T;
  },
  onLever(sc, puzzleId) {
    const p = (sc.pz ?? []).find(q => q.id === puzzleId);
    if (p?.type === 'timedGate') this._openTimed(sc, p);
  },

  /* ---------- ortak: sürgülü ağır kapı ---------- */
  _door(sc, d) {
    const door = {
      ...d, open: 0, target: 0,
      body: sc.matter.add.rectangle(d.x, d.y - d.h / 2, 18, d.h, { isStatic: true, label: 'grate', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF } }),
      g: sc.add.graphics().setDepth(92),
    };
    this._drawDoor(door);
    return door;
  },
  _drawDoor(D) {
    const g = D.g; g.clear();
    const top = D.y - D.h - D.open * (D.h - 8);
    g.fillStyle(0x0c0c12, 1);
    g.fillRect(D.x - 10, top, 20, D.h);
    g.lineStyle(1.2, 0x1e1f27, 0.9);
    for (let yy = top + 14; yy < top + D.h - 6; yy += 22) { g.beginPath(); g.moveTo(D.x - 8, yy); g.lineTo(D.x + 8, yy); g.strokePath(); }
    g.fillStyle(0x0c0c12, 1); g.fillRect(D.x - 14, D.y - D.h - 10, 28, 8);
  },
  _moveDoor(sc, D, dt, speedUp = 1.6, speedDown = 3.2) {
    const prev = D.open;
    D.open = D.target > D.open ? Math.min(D.target, D.open + dt * speedUp) : Math.max(D.target, D.open - dt * speedDown);
    if (D.open !== prev) {
      MatterLib.Body.setPosition(D.body, { x: D.x, y: D.y - D.h / 2 - D.open * (D.h - 8) });
      this._drawDoor(D);
      if (!D._snd || sc.time.now - D._snd > 300) { D._snd = sc.time.now; SFAudio.itemHit('metal', 0.18); }
      if (D.open === 0 && prev > 0) { SFAudio.thud(0.8); sc.cameras.main.shake(140, 0.005); }
      /* kapanan kapı oyuncuyu ezmesin: altındaysa geri iter */
      const P = sc.player;
      if (P && D.open < 0.5 && Math.abs(P.body.position.x - D.x) < 18) {
        const dir = Math.sign(P.body.position.x - D.x) || -1;
        MatterLib.Body.setPosition(P.body, { x: D.x + dir * 24, y: P.body.position.y });
      }
    }
  },

  /* ---------- KANAL ---------- */
  _setup_canal(sc, p) {
    p.water = new WaterZone(sc, { x0: p.x0, x1: p.x1, surfaceY: p.low, bottomY: p.bottom });
    sc.waters.push(p.water);
    p.raised = false; p.level = 0;
    /* yüzen tahta: suyun yüzeyini izleyen statik gövde */
    p.plankBody = sc.matter.add.rectangle(p.plank.x + p.plank.w / 2, p.low - 2, p.plank.w, 12, { isStatic: true, label: 'platform:wood', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF } });
    p.plankPlat = { x: p.plank.x, y: p.low - 8, w: p.plank.w, thick: 12, material: 'wood' };
    sc.platforms.push(p.plankPlat);
    p.plankG = sc.add.graphics().setDepth(94);
    /* vana çarkı */
    p.valveG = sc.add.graphics().setDepth(93);
    p.valveA = 0;
    this._drawValve(p);
    /* kanalın beton ağzı ve su seviyesi işaretleri */
    const g = sc.add.graphics().setDepth(61);
    g.lineStyle(1, 0x2a2c36, 0.8);
    for (let yy = p.high; yy < p.bottom; yy += 40) { g.beginPath(); g.moveTo(p.x1 - 18, yy); g.lineTo(p.x1 - 4, yy); g.strokePath(); }
    p.light = sc.lights2.addLight({ x: p.valve.x, y: p.valve.y - 50, r: 110, type: 'halo', intensity: 0.6 });
    return p;
  },
  _drawValve(p) {
    const g = p.valveG; g.clear();
    const x = p.valve.x, y = p.valve.y - 46;
    g.fillStyle(0x0c0c12, 1); g.fillRect(x - 4, y, 8, 46);
    g.lineStyle(3, 0x0c0c12, 1); g.strokeCircle(x, y, 13);
    for (let i = 0; i < 4; i++) {
      const a = p.valveA + i * Math.PI / 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); g.strokePath();
    }
    if (!p.raised) { g.fillStyle(0xd8d4c8, 0.35); g.fillCircle(x, y, 2.5); }
  },
  _update_canal(sc, p, dt) {
    if (p.turning) {
      p.level = Math.min(1, p.level + dt / 7.5);
      p.valveA += dt * 3 * (1 - p.level * 0.7);
      this._drawValve(p);
      p.water.surfaceY = lerp(p.low, p.high, smooth(p.level));
      p.snd?.set(1 - p.level * 0.6);
      if (p.level >= 1) { p.turning = false; p.snd?.stop(); SFAudio.playHopeMotif(); }
    }
    const top = p.water.surfaceY - 7 + Math.sin(sc.time.now * 0.002) * 1.2;
    MatterLib.Body.setPosition(p.plankBody, { x: p.plank.x + p.plank.w / 2, y: top + 6 });
    p.plankPlat.y = top;
    const g = p.plankG; g.clear();
    g.fillStyle(0x0d0d12, 1); g.fillRect(p.plank.x, top, p.plank.w, 11);
    g.lineStyle(1, 0x22232c, 0.9); g.beginPath(); g.moveTo(p.plank.x + 8, top + 5); g.lineTo(p.plank.x + p.plank.w - 10, top + 5); g.strokePath();
    /* uzun süre kıyıda bekleyene sessiz bir ipucu */
    const P = sc.player;
    if (!p.raised && !p.hinted && P && Math.abs(P.body.position.x - p.x0) < 260) {
      p.waitT = (p.waitT ?? 0) + dt;
      if (p.waitT > 14) { p.hinted = true; UI.hint('Su çok sığ. Bölmenin altından yüzülebilir mi?', 3600, '≈'); }
    }
  },
  _find_canal(sc, p, px, py) {
    if (p.raised || Math.abs(px - p.valve.x) > 44 || Math.abs(py + 30 - p.valve.y) > 70) return null;
    return { type: 'p-act', obj: p, label: 'VANAYI ÇEVİR', x: p.valve.x, y: p.valve.y - 80 };
  },
  _act_canal(sc, p) {
    if (p.raised) return;
    sc.player.mode = 'action';
    sc.rig.startAction('lever', {
      targetX: p.valve.x, targetY: p.valve.y - 46,
      onPhase: (ph) => {
        if (ph !== 'pulled') return;
        p.raised = true; p.turning = true;
        SFAudio.leverCreak?.(); SFAudio.rumble?.(2.5, 0.35);
        p.snd = SFAudio.waterLoop?.();
        sc.cameras.main.shake(400, 0.003);
      },
      onDone: () => { sc.player.mode = 'idle'; },
    });
  },

  /* ---------- BİRLEŞİK KAPLAR ---------- */
  _setup_hydraulic(sc, p) {
    p.water = new WaterZone(sc, { x0: p.tank.x0, x1: p.tank.x1, surfaceY: p.tank.low, bottomY: p.tank.bottom });
    sc.waters.push(p.water);
    p.depth = 0;
    const pw = p.plate.x1 - p.plate.x0;
    p.plateBody = sc.matter.add.rectangle(p.plate.x0 + pw / 2, p.plate.y + 8, pw, 16, { isStatic: true, label: 'platform:metal', friction: 0.9, collisionFilter: { category: CAT.WORLD, mask: 0xFFFF } });
    p.platePlat = { x: p.plate.x0, y: p.plate.y, w: pw, thick: 16, material: 'metal' };
    sc.platforms.push(p.platePlat);
    p.raftX = p.tank.x0 + (p.tank.x1 - p.tank.x0 - p.raft.w) / 2;
    p.raftBody = sc.matter.add.rectangle(p.raftX + p.raft.w / 2, p.tank.low, p.raft.w, 12, { isStatic: true, label: 'platform:wood', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF } });
    p.raftPlat = { x: p.raftX, y: p.tank.low - 6, w: p.raft.w, thick: 12, material: 'wood' };
    sc.platforms.push(p.raftPlat);
    p.g = sc.add.graphics().setDepth(94);
    /* yeraltı borusu + basınç göstergesi (sahne anlatır) */
    const bg = sc.add.graphics().setDepth(61);
    bg.fillStyle(0x101118, 1);
    const pipeY = p.plate.y + 175;
    bg.fillRect(p.plate.x0 + 40, p.plate.y + 150, 18, 34);
    bg.fillRect(p.plate.x0 + 40, pipeY, p.tank.x0 + 30 - p.plate.x0 - 40, 16);
    bg.fillRect(p.tank.x0 + 30, p.tank.low + 40, 18, pipeY - p.tank.low - 24);
    p.gauge = { x: p.tank.x0 - 45, y: p.plate.y - 90 };
    bg.fillStyle(0x0c0c12, 1); bg.fillRect(p.gauge.x - 3, p.gauge.y, 6, 90); bg.fillCircle(p.gauge.x, p.gauge.y, 16);
    p.light = sc.lights2.addLight({ x: p.gauge.x, y: p.gauge.y, r: 90, type: 'halo', intensity: 0.5 });
    return p;
  },
  _update_hydraulic(sc, p, dt) {
    /* plakadaki yük: üstünde duran sandık(lar) ağır, oyuncu hafif */
    const pt = p.platePlat.y;
    let load = 0;
    for (const pb of sc.pushboxes) {
      const b = pb.body.bounds;
      if (pb.body.position.x > p.plate.x0 - 6 && pb.body.position.x < p.plate.x1 + 6 && Math.abs(b.max.y - pt) < 10) load += 1;
    }
    const P = sc.player;
    if (P && P.grounded && P.body.position.x > p.plate.x0 && P.body.position.x < p.plate.x1 && Math.abs(P.body.position.y + P.hStand / 2 - pt) < 12) load += 0.4;
    const want = Math.min(1, load) * p.plate.travel;
    const prev = p.depth;
    p.depth = lerp(p.depth, want, 1 - Math.exp(-dt * 1.4));
    if (Math.abs(p.depth - prev) > 0.05 && (!p._snd || sc.time.now - p._snd > 380)) { p._snd = sc.time.now; SFAudio.itemHit('metal', 0.12); }
    const y = p.plate.y + p.depth;
    MatterLib.Body.setPosition(p.plateBody, { x: (p.plate.x0 + p.plate.x1) / 2, y: y + 8 });
    p.platePlat.y = y;
    /* basınç → su: plaka tam inince su en üste çıkar */
    const k = p.depth / p.plate.travel;
    p.water.surfaceY = lerp(p.tank.low, p.tank.high, smooth(k));
    const rt = p.water.surfaceY - 7 + Math.sin(sc.time.now * 0.0021) * 1.2;
    MatterLib.Body.setPosition(p.raftBody, { x: p.raftX + p.raft.w / 2, y: rt + 6 });
    p.raftPlat.y = rt;
    if (k > 0.97 && !p.done) { p.done = true; SFAudio.playHopeMotif(); }
    const g = p.g; g.clear();
    g.fillStyle(0x0d0d12, 1);
    g.fillRect(p.plate.x0, y, p.plate.x1 - p.plate.x0, 14);
    g.fillRect((p.plate.x0 + p.plate.x1) / 2 - 7, y + 14, 14, 160 - p.depth);   // piston kolu
    g.lineStyle(1, 0x24252e, 0.9); g.strokeRect(p.plate.x0 + 3, y + 3, p.plate.x1 - p.plate.x0 - 6, 8);
    g.fillStyle(0x0d0d12, 1); g.fillRect(p.raftX, rt, p.raft.w, 11);
    g.fillRect(p.raftX + 6, rt + 11, 10, 5); g.fillRect(p.raftX + p.raft.w - 16, rt + 11, 10, 5);
    /* gösterge iğnesi */
    const a = -Math.PI * 0.85 + k * Math.PI * 0.7;
    g.lineStyle(2, 0xd8d4c8, 0.7); g.beginPath(); g.moveTo(p.gauge.x, p.gauge.y); g.lineTo(p.gauge.x + Math.cos(a) * 12, p.gauge.y + Math.sin(a) * 12); g.strokePath();
    if (!p.hinted && P && Math.abs(P.body.position.x - p.tank.x0) < 200 && k < 0.2) {
      p.waitT = (p.waitT ?? 0) + dt;
      if (p.waitT > 16) { p.hinted = true; UI.hint('Plakaya basınca göstergedeki iğne oynuyor...', 3600, '◔'); }
    }
  },

  /* ---------- KARŞI AĞIRLIK ---------- */
  _setup_pulley(sc, p) {
    const mk = (side) => {
      const w = side.x1 - side.x0;
      const body = sc.matter.add.rectangle(side.x0 + w / 2, p.y + 8, w, 16, { isStatic: true, label: 'platform:metal', friction: 0.9, collisionFilter: { category: CAT.WORLD, mask: 0xFFFF } });
      const plat = { x: side.x0, y: p.y, w, thick: 16, material: 'metal' };
      sc.platforms.push(plat);
      return { ...side, w, body, plat };
    };
    p.L = mk(p.left); p.R = mk(p.right);
    p.off = 0;            // + : sağ kafes yukarıda
    p.state = 'locked';
    p.rY = p.y;
    p.g = sc.add.graphics().setDepth(93);
    p.light = sc.lights2.addLight({ x: p.brake.x, y: p.y - 60, r: 100, type: 'halo', intensity: 0.55 });
    return p;
  },
  _pulleyLoad(sc, side, top) {
    let w = 0;
    for (const pb of sc.pushboxes) {
      const b = pb.body.bounds;
      if (pb.body.position.x > side.x0 - 6 && pb.body.position.x < side.x1 + 6 && Math.abs(b.max.y - top) < 12) w += 1;
    }
    const P = sc.player;
    if (P && P.body.position.x > side.x0 - 4 && P.body.position.x < side.x1 + 4 && Math.abs(P.body.position.y + P.hStand / 2 - top) < 14) w += 0.45;
    return w;
  },
  _update_pulley(sc, p, dt) {
    const wl = this._pulleyLoad(sc, p.L, p.L.plat.y), wr = this._pulleyLoad(sc, p.R, p.R.plat.y);
    let target = p.off;
    if (p.state === 'free') {
      target = wl > wr + 0.2 ? p.rise : wr > wl + 0.2 ? -60 : 0;
    } else if (p.state === 'reset') {
      target = 0;
      if (Math.abs(p.off) < 2) p.state = 'locked';
    }
    const prev = p.off;
    p.off = p.off + clamp(target - p.off, -dt * 150, dt * 150);
    if (Math.abs(p.off - prev) > 0.1 && (!p._snd || sc.time.now - p._snd > 260)) { p._snd = sc.time.now; SFAudio.itemHit('metal', 0.14); }
    if (p.state === 'free' && Math.abs(p.off - target) < 1) {
      if (target === p.rise && !p.done) { p.done = true; SFAudio.thud(0.6); SFAudio.playHopeMotif(); }
      if (target <= 0 && !p.done) { p.state = 'reset'; UI.hint('Karşı taraf çok hafif kaldı.', 2600, '⚖'); }
    }
    const yl = p.y + p.off, yr = p.y - p.off;
    MatterLib.Body.setPosition(p.L.body, { x: p.L.x0 + p.L.w / 2, y: yl + 8 }); p.L.plat.y = yl;
    MatterLib.Body.setPosition(p.R.body, { x: p.R.x0 + p.R.w / 2, y: yr + 8 }); p.R.plat.y = yr;
    p.rY = yr;
    const g = p.g; g.clear();
    const c = 0x0c0c12;
    /* makara direği + halat */
    g.fillStyle(c, 1); g.fillRect(p.pulleyX - 6, p.pulleyY, 12, p.y - p.pulleyY);
    g.fillRect(p.L.x0 + p.L.w / 2 - 4, p.pulleyY - 6, p.R.x0 + p.R.w / 2 - (p.L.x0 + p.L.w / 2) + 8, 8);
    for (const cx of [p.L.x0 + p.L.w / 2, p.R.x0 + p.R.w / 2]) { g.fillCircle(cx, p.pulleyY - 2, 11); }
    g.lineStyle(1.6, c, 1);
    for (const [S, yy] of [[p.L, yl], [p.R, yr]]) {
      const cx = S.x0 + S.w / 2;
      g.beginPath(); g.moveTo(cx, p.pulleyY + 8); g.lineTo(cx, yy - 70); g.strokePath();
      g.beginPath(); g.moveTo(cx, yy - 70); g.lineTo(S.x0 + 4, yy); g.moveTo(cx, yy - 70); g.lineTo(S.x1 - 4, yy); g.strokePath();
      g.fillStyle(c, 1); g.fillRect(S.x0, yy, S.w, 14);
      g.lineStyle(1, 0x22232c, 0.9); g.strokeRect(S.x0 + 3, yy + 3, S.w - 6, 8); g.lineStyle(1.6, c, 1);
    }
    /* sağ kafesteki fren kolu */
    const bx = p.brake.x, by = yr;
    g.fillStyle(c, 1); g.fillRect(bx - 5, by - 34, 10, 34);
    const a = p.state === 'locked' ? -0.7 : 0.7;
    g.lineStyle(3.4, c, 1); g.beginPath(); g.moveTo(bx, by - 30); g.lineTo(bx + Math.sin(a) * 24, by - 30 - Math.cos(a) * 24); g.strokePath();
    g.fillStyle(p.state === 'locked' ? 0xd8d4c8 : c, p.state === 'locked' ? 0.45 : 1); g.fillCircle(bx + Math.sin(a) * 24, by - 30 - Math.cos(a) * 24, 3.5);
    p.light.y = by - 60;
  },
  _find_pulley(sc, p, px, py) {
    if (p.state !== 'locked' || Math.abs(px - p.brake.x) > 40 || Math.abs(py + 30 - p.rY) > 50) return null;
    return { type: 'p-act', obj: p, label: 'FRENİ BIRAK', x: p.brake.x, y: p.rY - 70 };
  },
  _act_pulley(sc, p) {
    sc.player.mode = 'action';
    sc.rig.startAction('lever', {
      targetX: p.brake.x, targetY: p.rY - 40,
      onPhase: (ph) => { if (ph === 'pulled') { p.state = 'free'; SFAudio.leverCreak?.(); } },
      onDone: () => { sc.player.mode = 'idle'; },
    });
  },

  /* ---------- BASKI PLAKASI ---------- */
  _setup_pressure(sc, p) {
    p.D = this._door(sc, p.door);
    p.g = sc.add.graphics().setDepth(71);
    p.down = 0;
    p.light = sc.lights2.addLight({ x: (p.plate.x0 + p.plate.x1) / 2, y: p.plate.y - 30, r: 90, type: 'halo', intensity: 0.5 });
    return p;
  },
  _update_pressure(sc, p, dt) {
    let pressed = false;
    for (const pb of sc.pushboxes) {
      const b = pb.body.bounds;
      if (pb.body.position.x > p.plate.x0 - 10 && pb.body.position.x < p.plate.x1 + 10 && Math.abs(b.max.y - p.plate.y) < 8) pressed = true;
    }
    const P = sc.player;
    if (P && P.grounded && P.body.position.x > p.plate.x0 && P.body.position.x < p.plate.x1 && Math.abs(P.body.position.y + P.hStand / 2 - p.plate.y) < 10) pressed = true;
    if (pressed && !p.pressed) { SFAudio.itemHit('metal', 0.4); SFAudio.thud(0.3); }
    p.pressed = pressed;
    p.down = lerp(p.down, pressed ? 1 : 0, 1 - Math.exp(-dt * 12));
    /* kapı: plaka bırakılınca kısa bir gecikmeyle hızla iner */
    if (pressed) { p.D.target = 1; p.releaseT = 0.25; }
    else { p.releaseT = (p.releaseT ?? 0) - dt; if (p.releaseT <= 0) p.D.target = 0; }
    this._moveDoor(sc, p.D, dt, 1.4, 4.5);
    const g = p.g; g.clear();
    g.fillStyle(0x0c0c12, 1); g.fillRect(p.plate.x0 - 4, p.plate.y - 2, p.plate.x1 - p.plate.x0 + 8, 4);
    g.fillStyle(pressed ? 0x6e8a6e : 0x2a2a32, 1); g.fillRect(p.plate.x0, p.plate.y - 6 + p.down * 4, p.plate.x1 - p.plate.x0, 5);
    /* kablo plakadan kapıya */
    g.lineStyle(1.4, pressed ? 0x8aa08a : 0x1e1f27, pressed ? 0.5 : 0.9);
    g.beginPath(); g.moveTo(p.plate.x1, p.plate.y - 1); g.lineTo(p.D.x - 12, p.plate.y - 1); g.lineTo(p.D.x - 12, p.D.y - p.D.h - 6); g.strokePath();
  },

  /* ---------- IŞIK GÖZÜ ---------- */
  _setup_photocell(sc, p) {
    p.D = this._door(sc, p.door);
    p.charge = 0; p.solved = false;
    p.g = sc.add.graphics().setDepth(93);
    return p;
  },
  _update_photocell(sc, p, dt) {
    const L = sc.flashLight;
    let lit = false;
    if (!p.solved && L && L.on && sc.flashOn) {
      const dx = p.eye.x - L.x, dy = p.eye.y - L.y;
      const along = dx * L.facing;
      lit = along > 30 && along < L.r * 1.7 && Math.abs(dy - along * Math.tan(L.angle ?? 0) * L.facing) < 22 + along * 0.5;
    }
    p.charge = clamp(p.charge + (lit ? dt / 1.3 : -dt / 2), 0, 1);
    if (lit && (!p._snd || sc.time.now - p._snd > 160)) { p._snd = sc.time.now; SFAudio.simonTone?.(Math.min(2, Math.floor(p.charge * 3))); }
    if (p.charge >= 1 && !p.solved) { p.solved = true; p.D.target = 1; SFAudio.doorUnlock(); SFAudio.playHopeMotif(); }
    this._moveDoor(sc, p.D, dt, 0.8);
    const g = p.g; g.clear();
    g.fillStyle(0x0c0c12, 1); g.fillRoundedRect(p.eye.x - 10, p.eye.y - 9, 20, 18, 4);
    const c = p.solved ? 0x8fb08f : 0xc8483a;
    g.fillStyle(c, p.solved ? 0.9 : 0.35 + p.charge * 0.6); g.fillCircle(p.eye.x, p.eye.y, 3.5 + p.charge * 1.5);
    if (lit) { g.lineStyle(1.2, 0xf0e2c0, 0.4 + p.charge * 0.4); g.strokeCircle(p.eye.x, p.eye.y, 7 + p.charge * 5); }
    const P = sc.player;
    if (!p.solved && !p.hinted && P && Math.abs(P.body.position.x - p.D.x) < 160) {
      p.waitT = (p.waitT ?? 0) + dt;
      if (p.waitT > 10) { p.hinted = true; UI.hint('Kapının üstündeki göz ışığa tepki veriyor gibi.', 3400, '◉'); }
    }
  },

  /* ---------- ZAMANLI KAPI ---------- */
  _setup_timedGate(sc, p) {
    p.D = this._door(sc, p.door);
    p.t = 0;
    p.g = sc.add.graphics().setDepth(93);
    return p;
  },
  _openTimed(sc, p) {
    p.t = p.window;
    p.D.target = 1;
    SFAudio.bombBeep?.(false);
  },
  _update_timedGate(sc, p, dt) {
    if (p.t > 0) {
      p.t -= dt;
      const tick = Math.ceil(p.t * 2);
      if (tick !== p._tick) { p._tick = tick; SFAudio.bombBeep?.(p.t < 1.5); }
      if (p.t <= 0) {
        p.D.target = 0;
        /* kapı yeniden kapandı: kol geri yaylanır, tekrar denenebilir */
        const lv = sc.levers.find(l => l.id === p.lever);
        if (lv && sc.player.body.position.x < p.D.x) {
          sc.time.delayedCall(700, () => { lv.pulled = false; lv.angle = -0.85; lv.draw(); });
        }
      }
    }
    this._moveDoor(sc, p.D, dt, 2.4, 3.6);
    const g = p.g; g.clear();
    if (p.t > 0) {
      const k = p.t / p.window;
      g.fillStyle(0x0c0c12, 1); g.fillRect(p.D.x - 34, p.D.y - p.D.h - 30, 22, 10);
      g.fillStyle(k < 0.35 ? 0xc8483a : 0xd8d4c8, 0.85); g.fillRect(p.D.x - 32, p.D.y - p.D.h - 28, 18 * k, 6);
    }
  },
};
