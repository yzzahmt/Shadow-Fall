/* ============================================================
   SHADOW FALL — YAPILAR
   - İki katlı büyük evler: merdivenle üst kat, odalarda çekmece /
     dolap / ilk yardım, anahtar bir yerde saklı, çıkış kapısı kilitli.
   - Çok bölümlük yapılar: hastane, dökümhane, su arıtma tesisi...
     İçeri girildiğinde 2-3 bölüm boyunca dışarı çıkılmaz.
   - İçeride yalnız içerisi görünür: yapının dışı karartılır, kamera
     yapının duvarlarına kilitlenir, yağmur/rüzgâr kesilir.
   - Merdiven (basamaklı): basamaklara gerçekten basarak çıkılır.
   ============================================================ */
'use strict';

/* birden fazla bölüm süren yapılar — içeride geçen bölümler */
const BUILDINGS = [
  { levels: [8, 9],       kind: 'lodge',     name: 'AV KÖŞKÜ' },
  { levels: [19, 20],     kind: 'motel',     name: 'YOL MOTELİ' },
  { levels: [29, 30],     kind: 'manor',     name: 'BATAKLIK KONAĞI' },
  { levels: [39, 40],     kind: 'mineworks', name: 'MADEN TESİSİ' },
  { levels: [44, 45, 46], kind: 'foundry',   name: 'DÖKÜMHANE' },
  { levels: [56, 57],     kind: 'plant',     name: 'SU ARITMA TESİSİ' },
  { levels: [63, 64, 65], kind: 'hospital',  name: 'HASTANE' },
  { levels: [73, 74],     kind: 'barracks',  name: 'KIŞLA' },
  { levels: [81, 82],     kind: 'library',   name: 'KÜTÜPHANE' },
  { levels: [96, 97],     kind: 'temple',    name: 'TAPINAK' },
];
function buildingFor(n) { return BUILDINGS.find(b => b.levels.includes(n)) ?? null; }

/* yapı türüne göre: oda bulmacaları, saklama yerleri, dekor, malzeme */
const BUILDING_THEMES = {
  lodge:     { mat: 'wood',     puzzles: ['pressure', 'climb', 'timedGate'],          stash: ['drawer', 'cabinet', 'chest', 'wardrobe'], decor: ['table', 'chair', 'shelf', 'antlers'], dark: 0.72 },
  motel:     { mat: 'wood',     puzzles: ['photocell', 'pressure', 'genDoor'],        stash: ['drawer', 'wardrobe', 'fridge', 'medkit'], decor: ['bed', 'table', 'chair'], dark: 0.7 },
  manor:     { mat: 'wood',     puzzles: ['shop', 'pressure', 'leverLadder'],         stash: ['drawer', 'wardrobe', 'cabinet', 'chest'], decor: ['shelf', 'table', 'chair', 'clock'], dark: 0.78 },
  mineworks: { mat: 'metal',    puzzles: ['pulley', 'genDoor', 'photocell'],          stash: ['locker', 'toolbox', 'medkit', 'ammo'],   decor: ['pipe', 'gear', 'cage'], dark: 0.9 },
  foundry:   { mat: 'metal',    puzzles: ['factoryLock', 'pulley', 'hydraulic', 'timedGate'], stash: ['locker', 'toolbox', 'medkit'], decor: ['pipe', 'gear', 'barrier'], dark: 0.8 },
  plant:     { mat: 'concrete', puzzles: ['canal', 'hydraulic', 'pressure'],          stash: ['locker', 'toolbox', 'medkit'],          decor: ['pipe', 'gear'], dark: 0.75 },
  hospital:  { mat: 'concrete', puzzles: ['photocell', 'shop', 'pressure', 'timedGate'], stash: ['medkit', 'cabinet', 'drawer', 'locker'], decor: ['bed', 'curtain', 'chair'], dark: 0.82 },
  barracks:  { mat: 'concrete', puzzles: ['pulley', 'pressure', 'photocell'],         stash: ['locker', 'ammo', 'medkit', 'chest'],    decor: ['bed', 'barrier', 'table'], dark: 0.78 },
  library:   { mat: 'wood',     puzzles: ['shop', 'leverLadder', 'photocell'],        stash: ['drawer', 'cabinet', 'chest'],           decor: ['shelf', 'shelf', 'table', 'clock'], dark: 0.8 },
  temple:    { mat: 'concrete', puzzles: ['canal', 'pulley', 'timedGate', 'pressure'], stash: ['chest', 'cabinet', 'medkit'],          decor: ['statue', 'grave'], dark: 0.82 },
};

/* ============================================================
   YERLEŞİM — levelgen'in C nesnesine eklenir
   ============================================================ */
function addHouseChunks(C, H) {
  const { L, rng } = H;
  L.buildings = L.buildings ?? [];
  L.stairs = L.stairs ?? [];

  /* İKİ KATLI EV — ön kapı açık, arka kapı kilitli. Anahtar üst katta bir
     çekmecede / dolapta. Basamaklı merdivenle çıkılır, el merdiveniyle inilir. */
  C.house = () => {
    const gy = H.getGy();
    const x = H.getX();
    const W = 1150 + Math.floor(rng() * 450);
    const upY = gy - 232;                     // üst kat döşemesi
    const roofY = gy - 452;                   // tavan
    const id = 'h' + L.buildings.length;
    const x0 = x + 20, x1 = x + W;
    /* dış duvarlar + kapılar */
    L.walls.push({ x: x0, y0: roofY, y1: gy - 128 });
    L.doors.push({ x: x0, groundY: gy, h: 128, locked: false, needsKey: false, id: 'in_' + id });
    L.walls.push({ x: x1, y0: roofY, y1: gy - 132 });
    L.doors.push({ x: x1, groundY: gy, h: 132, locked: true, needsKey: true, id: 'out_' + id });
    L.decor.push({ type: 'shell', x0, x1, groundY: gy, roofY, floors: [upY] });
    L.platforms.push({ x: x0 - 20, y: roofY - 40, w: x1 - x0 + 40, thick: 40, material: 'wood', ceiling: true });
    /* merdiven: zemin kattan üst kata (soldan sağa yükselir) */
    const sx0 = x0 + 120, sx1 = sx0 + 300;
    L.stairs.push({ x0: sx0, y0: gy, x1: sx1, y1: upY });
    /* üst kat döşemesi: merdiven boşluğunun sağından; el merdiveni deliği */
    const ladX = x1 - 170;
    L.platforms.push({ x: sx1, y: upY, w: ladX - 22 - sx1, thick: 18, material: 'wood', floor: true });
    L.platforms.push({ x: ladX + 22, y: upY, w: x1 - 12 - (ladX + 22), thick: 18, material: 'wood', floor: true });
    L.ladders.push({ x: ladX, topY: upY, bottomY: gy - 4, raised: false, id: id + 'lad' });
    /* zemin kat: mutfak + oturma odası */
    const keyRoom = [];
    const gStash = [];
    L.decor.push({ type: 'table', x: x0 + 560 + rng() * 60, groundY: gy });
    L.decor.push({ type: 'chair', x: x0 + 640 + rng() * 40, groundY: gy });
    gStash.push(H.stash('fridge', x0 + 70, gy, null));
    gStash.push(H.stash(rng() < 0.5 ? 'drawer' : 'cabinet', x0 + 470, gy, null));
    gStash.push(H.stash('drawer', x0 + (W - 20) * 0.62, gy, null));
    L.decor.push({ type: 'lampInt2', x: x0 + W * 0.3, y: upY + 60, flicker: rng() < 0.5 });
    L.decor.push({ type: 'lampInt2', x: x0 + W * 0.72, y: upY + 60, flicker: rng() < 0.4 });
    L.decor.push({ type: 'window', x: x0 + 300, y: gy - 120 });
    /* üst kat: yatak odası + banyo */
    L.decor.push({ type: 'bed', x: sx1 + 160, groundY: upY });
    keyRoom.push(H.stash('wardrobe', sx1 + 330, upY, null));
    keyRoom.push(H.stash('drawer', sx1 + 470, upY, null));
    keyRoom.push(H.stash('medkit', x1 - 80, upY, null));
    L.decor.push({ type: 'window', x: sx1 + 240, y: upY - 110 });
    L.decor.push({ type: 'lampInt2', x: sx1 + 260, y: roofY + 50, flicker: true });
    /* anahtar üst katta, tıbbi olmayan bir yerde — ötekiler ganimet dağıtımına kalır */
    const kc = keyRoom[Math.floor(rng() * 2)];
    kc.contents = ['key']; kc.fixed = true;
    /* bazen içeride bir şey bekler */
    if (H.n >= 3 && rng() < 0.55) {
      const t = H.pickCreature();
      L.creatures.push({ type: t, x: x0 + W * 0.55, patrolMinX: x0 + 260, patrolMaxX: x1 - 60, groundY: gy, ...H.creatureStats(t, 0.85) });
    }
    L.buildings.push({ x0: x0 - 12, x1: x1 + 12, roofY: roofY - 40, bottom: gy + 40, groundY: gy, kind: 'house' });
    L.triggers.push({ x: x0 + 60, text: '', icon: '' });
    H.setX(x1 + 120);
    void gStash;
  };

  /* ARA KAT ODASI (yapıların içinde) — basamaklı merdivenle asma kata çık,
     orada saklı şeyler var; diğer uçtan el merdiveniyle in. */
  C.mezzanine = () => {
    const gy = H.getGy();
    const x = H.getX();
    const upY = gy - 210;
    const sx0 = x + 60, sx1 = sx0 + 280;
    const w = 760;
    L.stairs.push({ x0: sx0, y0: gy, x1: sx1, y1: upY });
    const ladX = x + w - 60;
    L.platforms.push({ x: sx1, y: upY, w: ladX - 22 - sx1, thick: 16, material: H.mat, floor: true });
    L.platforms.push({ x: ladX + 22, y: upY, w: 40, thick: 16, material: H.mat, floor: true });
    L.ladders.push({ x: ladX, topY: upY, bottomY: gy - 4, raised: false, id: 'mz' + L.ladders.length });
    const th = H.theme;
    H.stash(th.stash[Math.floor(rng() * th.stash.length)], sx1 + 120, upY, null);
    H.stash(th.stash[Math.floor(rng() * th.stash.length)], sx1 + 260, upY, null);
    H.stash(th.stash[Math.floor(rng() * th.stash.length)], x + 420, gy, null);
    L.decor.push({ type: 'lampInt2', x: x + w * 0.5, y: upY - 70, flicker: rng() < 0.5 });
    H.setX(x + w + 40);
  };

  /* ODA DUVARI — yapı içinde odaları ayırır, kapı aralığından geçilir */
  C.roomWall = (withDoor) => {
    const gy = H.getGy();
    const x = H.getX() + 30;
    L.walls.push({ x, y0: H.ceilY ?? gy - 360, y1: gy - 150 });
    if (withDoor) L.doors.push({ x, groundY: gy, h: 150, locked: false, needsKey: false, id: 'rw' + L.doors.length });
    H.setX(x + 50);
  };
}

/* ============================================================
   ÇOK BÖLÜMLÜK YAPI — bölümün tamamı içeride geçer
   ============================================================ */
function buildInteriorLevel(H, B, part) {
  const { L, C, rng } = H;
  const th = BUILDING_THEMES[B.kind];
  const parts = B.levels.length;
  const gy = H.getGy();
  const first = part === 1, last = part === parts;
  H.theme = th; H.mat = th.mat;
  H.ceilY = gy - 360;
  L.interior = { kind: B.kind, name: B.name, part, parts };
  L.name = B.name; L.sub = parts > 1 ? `${part} / ${parts}` : '';
  L.dark = th.dark; L.rain = 0; L.wind = 0.05; L.blackouts = rng() < 0.5;
  L.material = th.mat;
  for (const g of L.ground) g.material = th.mat;

  let bx0 = -260;
  if (first) {
    /* dışarıdan giriş: yapının önünde kısa bir avlu */
    C.flat(380);
    bx0 = H.getX();
    L.walls.push({ x: bx0, y0: H.ceilY - 80, y1: gy - 150 });
    L.doors.push({ x: bx0, groundY: gy, h: 150, locked: false, needsKey: false, id: 'bin' });
    H.setX(bx0 + 40);
  }
  C.flat(240);
  /* odalar: bulmaca odaları + ara kat + saklama + yaratık koridoru */
  const pool = shuffleWith(rng, th.puzzles);
  const rooms = [];
  rooms.push(pool[0]);
  rooms.push('mezzanine');
  rooms.push(pool[1 % pool.length]);
  if (H.n >= 3) rooms.push('creature');
  if (parts === 1 || !first) rooms.push(pool[2 % pool.length]);
  rooms.splice(1 + Math.floor(rng() * 2), 0, 'stash');
  rooms.forEach((r, i) => {
    C[r]?.();
    C.flat(140 + rng() * 120);
    if (i < rooms.length - 1) C.roomWall(rng() < 0.35);
    C.flat(60);
    L.checkpoints.push(H.getX() - 30);
  });
  let bx1;
  if (last) {
    C.flat(200);
    bx1 = H.getX();
    L.walls.push({ x: bx1, y0: H.ceilY - 80, y1: gy - 150 });
    L.doors.push({ x: bx1, groundY: gy, h: 150, locked: false, needsKey: false, id: 'bout' });
    H.setX(bx1 + 60);
  } else {
    C.flat(300);
    bx1 = H.getX() + 2000;      // bölüm içeride biter — yapı sonraki bölümde sürer
  }
  /* tavan + kabuk + lambalar */
  L.platforms.push({ x: bx0 - 20, y: H.ceilY - 80, w: bx1 - bx0 + 40, thick: 80, material: 'concrete', ceiling: true });
  L.decor.push({ type: 'shell', x0: bx0, x1: bx1, groundY: gy, roofY: H.ceilY - 80, flat: true, theme: B.kind });
  for (let lx = bx0 + 300; lx < Math.min(bx1, H.getX()) - 100; lx += 520 + rng() * 200) {
    L.decor.push({ type: 'lampInt2', x: lx, y: H.ceilY + 40, flicker: rng() < 0.4 });
  }
  /* tema dekoru zemine serpiştirilir */
  for (let dx = bx0 + 200; dx < Math.min(bx1, H.getX()) - 200; dx += 240 + rng() * 260) {
    if (rng() < 0.6) L.decor.push({ type: th.decor[Math.floor(rng() * th.decor.length)], x: dx, groundY: gy, interior: true });
  }
  L.buildings.push({ x0: bx0 - 14, x1: bx1 + 14, roofY: H.ceilY - 80, bottom: gy + 330, groundY: gy, kind: B.kind, interior: true });
  L.noDecor = true;
}

/* ============================================================
   ÇALIŞMA ANI
   ============================================================ */
const Buildings = {
  setup(sc) {
    const ch = sc.ch;
    sc.blds = (ch.buildings ?? []).map(b => ({ ...b }));
    sc.stairs = (ch.stairs ?? []).map(s => ({ ...s, dir: Math.sign(s.x1 - s.x0) }));
    /* yapı dışını karartan maske (dünya koordinatında, ışık katmanının üstünde) */
    sc.insideMask = sc.add.graphics().setDepth(860).setAlpha(0);
    sc.insideK = 0;
    sc.inBld = null;
    /* basamaklar */
    const g = sc.add.graphics().setDepth(66);
    for (const s of sc.stairs) this._drawStairs(g, s);
  },

  _drawStairs(g, s) {
    const c = 0x0b0b10, n = Math.max(8, Math.round(Math.abs(s.x1 - s.x0) / 16));
    const dx = (s.x1 - s.x0) / n, dy = (s.y1 - s.y0) / n;
    s.n = n; s.dx = dx; s.dy = dy;
    g.fillStyle(c, 1);
    /* yan kiriş (limon) + basamaklar */
    g.beginPath();
    g.moveTo(s.x0, s.y0); g.lineTo(s.x1, s.y1); g.lineTo(s.x1, s.y1 + 26); g.lineTo(s.x0 + Math.sign(dx) * 20, s.y0); g.closePath(); g.fillPath();
    for (let i = 0; i < n; i++) {
      const tx = s.x0 + dx * i, ty = s.y0 + dy * (i + 1);
      g.fillRect(Math.min(tx, tx + dx), ty, Math.abs(dx) + 1, -dy + 1);
    }
    /* korkuluk */
    g.lineStyle(2.2, c, 1);
    g.beginPath(); g.moveTo(s.x0, s.y0 - 70); g.lineTo(s.x1, s.y1 - 70); g.strokePath();
    for (let i = 0; i <= n; i += 3) { g.beginPath(); g.moveTo(s.x0 + dx * i, s.y0 + dy * i - 70); g.lineTo(s.x0 + dx * i, s.y0 + dy * i); g.strokePath(); }
  },

  /* basamaklı merdiven: yürürken altına gelirsen çıkar, üstten yürürsen iner */
  stairAt(sc, P, dir, h) {
    if (!sc.stairs?.length || P.stair || P.climbing || P.swimming || !P.grounded) return null;
    const x = P.body.position.x, feet = P.body.position.y + h / 2;
    for (const s of sc.stairs) {
      if (dir === s.dir && Math.abs(feet - s.y0) < 8 && (x - s.x0) * s.dir > -14 && (x - s.x0) * s.dir < 16) return { s, k: 0 };
      if (dir === -s.dir && Math.abs(feet - s.y1) < 8 && (x - s.x1) * s.dir < 14 && (x - s.x1) * s.dir > -16) return { s, k: 1 };
    }
    return null;
  },
  /* merdivendeyken hareket: x yönü girdiye göre, y basamak çizgisinde */
  updateStair(sc, P, dir, dt) {
    const S = P.stair, s = S.s, body = P.body;
    const len = Math.abs(s.x1 - s.x0);
    const sp = (P.runBlend ?? 0) > 0.5 ? 175 : 100;
    const v = dir * s.dir;                           // + : yukarı
    S.k = clamp(S.k + v * sp * dt / len, 0, 1);
    S.v = v * sp;
    const x = lerp(s.x0, s.x1, S.k), feetY = lerp(s.y0, s.y1, S.k);
    MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
    MatterLib.Body.setPosition(body, { x, y: feetY - P.hStand / 2 - 1 });
    if (dir) P.facing = dir;
    if (Math.abs(v) > 0 && (!S._st || sc.time.now - S._st > (sp > 120 ? 230 : 340))) { S._st = sc.time.now; SFAudio.footstep(sc.materialAt(x, feetY) === 'metal' ? 'metal' : 'wood', 0.7); }
    /* uçlardan çık */
    if ((S.k >= 1 && v > 0) || (S.k <= 0 && v < 0)) {
      const end = S.k >= 1 ? 1 : 0;
      const ex = end ? s.x1 + s.dir * 14 : s.x0 - s.dir * 14;
      const ey = end ? s.y1 : s.y0;
      MatterLib.Body.setPosition(body, { x: ex, y: ey - P.hStand / 2 - 1 });
      body.collisionFilter.mask = CAT.WORLD | CAT.PUSHBOX;
      P.stair = null; P.grounded = true; P.wasGrounded = true; P.lastVy = 0;
    }
  },

  update(sc, dt) {
    const P = sc.player; if (!P) return;
    const px = P.body.position.x, py = P.body.position.y;
    let inside = null;
    for (const b of sc.blds) if (px > b.x0 + 8 && px < b.x1 - 8 && py > b.roofY && py < b.bottom) { inside = b; break; }
    if (inside !== sc.inBld) {
      sc.inBld = inside;
      SFAudio.setIndoor?.(!!inside);
      sc.particles?.setIndoor?.(!!inside);
    }
    sc.insideK = lerp(sc.insideK, inside ? 1 : 0, 1 - Math.exp(-dt * 6));
    const m = sc.insideMask;
    m.clear();
    const B = inside ?? sc._lastBld;
    if (inside) sc._lastBld = inside;
    if (B && sc.insideK > 0.01) {
      m.setAlpha(sc.insideK);
      m.fillStyle(0x000000, 1);
      const far = 6000;
      m.fillRect(B.x0 - far, -far, far, far * 2);
      m.fillRect(B.x1, -far, far, far * 2);
      m.fillRect(B.x0, -far, B.x1 - B.x0, far + B.roofY);
      m.fillRect(B.x0, B.bottom, B.x1 - B.x0, far);
    } else m.setAlpha(0);
  },

  /* kamera hedefini yapının içinde tut (dış dünya kadraja girmesin) */
  clampCamera(sc, tx, ty) {
    const B = sc.inBld; if (!B) return { x: tx, y: ty };
    const cam = sc.cameras.main;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const offX = cam.width * (1 - 1 / cam.zoom) / 2, offY = cam.height * (1 - 1 / cam.zoom) / 2;
    const k = sc.insideK;
    let x = tx, y = ty;
    const bw = B.x1 - B.x0;
    if (bw <= vw) x = (B.x0 + B.x1) / 2 - vw / 2 - offX;
    else x = clamp(tx, B.x0 - offX, B.x1 - vw - offX);
    const bh = B.bottom - B.roofY;
    if (bh <= vh) y = (B.roofY + Math.min(B.bottom, B.groundY + 120)) / 2 - vh / 2 - offY;
    else y = clamp(ty, B.roofY - offY, B.bottom - vh - offY);
    return { x: lerp(tx, x, k), y: lerp(ty, y, k) };
  },
};
