/* ============================================================
   SHADOW FALL — 150 Bölümlük Dünya Üreteci
   15 perde × 10 bölüm. Her bölüm tohumlu (deterministik)
   üretilir: zemin, uçurumlar, su, rüzgâr koridorları,
   bulmacalar (kol→merdiven, jeneratör→kapı, ev içinde anahtar,
   askerden araba anahtarı çalma), düşmanlar, ganimet ekonomisi.
   Her perde finali (n%10==0) bir boss/sınav arenasıdır.
   ============================================================ */
'use strict';

const KILL_Y = 920;
const WORLD_H = 760;
const LEVEL_COUNT = 150;

/* ---------------- PERDE TANIMLARI ---------------- */
const ACTS = [null,
  { // 1 ORMAN
    biome: 'forest', material: 'earth', rain: 0, wind: 0.4, dark: 0,
    palette: { sky0: 0x34373f, sky1: 0x101116, far: 0x272930, mid: 0x191a20, near: 0x0c0c11 },
    parallax: [
      { type: 'hills', color: 0x272930, sf: 0.1, yOff: -10, hs: 1, alpha: 0.8 },
      { type: 'trees', color: 0x23252c, sf: 0.24, yOff: 6, hs: 0.9, alpha: 0.92 },
      { type: 'trees', color: 0x16171c, sf: 0.48, yOff: 22, hs: 1.1, alpha: 1 },
    ],
    chunks: ['flat', 'gap', 'spikes', 'climb', 'crates', 'creature', 'flat'],
    creatures: ['stalker'], decor: ['deadTree', 'bush', 'rock', 'wagon'],
  },
  { // 2 KÜL YOLU
    biome: 'road', material: 'concrete', rain: 0.6, wind: 0.6, dark: 0,
    darkLevels: { 13: 0.55, 16: 0.6, 19: 0.65 },
    palette: { sky0: 0x26282e, sky1: 0x0a0b0f, far: 0x1c1d23, mid: 0x14151a, near: 0x0a0a0e },
    parallax: [
      { type: 'hills', color: 0x1c1d23, sf: 0.1, yOff: -6, hs: 0.8, alpha: 0.85 },
      { type: 'ruins', color: 0x17181d, sf: 0.26, yOff: 10, hs: 0.8, alpha: 0.95 },
      { type: 'factory', color: 0x101116, sf: 0.5, yOff: 24, hs: 0.9, alpha: 1 },
    ],
    chunks: ['flat', 'soldierPost', 'gap', 'crates', 'soldierPost', 'spikes', 'flat'],
    creatures: ['hound'], decor: ['lamp', 'barrier', 'sign', 'rubble'],
  },
  { // 3 BATAKLIK
    biome: 'swamp', material: 'earth', rain: 1, wind: 0.5, dark: 0.25,
    palette: { sky0: 0x252a28, sky1: 0x0a0d0c, far: 0x1d2220, mid: 0x141816, near: 0x0a0c0b },
    parallax: [
      { type: 'hills', color: 0x1d2220, sf: 0.1, yOff: -4, hs: 0.7, alpha: 0.85 },
      { type: 'trees', color: 0x171b19, sf: 0.28, yOff: 12, hs: 1.0, alpha: 0.95 },
      { type: 'trees', color: 0x0e1110, sf: 0.52, yOff: 24, hs: 1.15, alpha: 1 },
    ],
    chunks: ['flat', 'pond', 'creature', 'gap', 'pond', 'crates', 'spikes'],
    creatures: ['hound', 'stalker'], decor: ['deadTree', 'reed', 'boat', 'rock'],
  },
  { // 4 BOĞULMUŞ KÖY
    biome: 'village', material: 'wood', rain: 0.4, wind: 0.7, dark: 0.3,
    palette: { sky0: 0x2a2c30, sky1: 0x0b0c0e, far: 0x1e2024, mid: 0x15161a, near: 0x0a0b0d },
    parallax: [
      { type: 'hills', color: 0x1e2024, sf: 0.1, yOff: -6, hs: 0.7, alpha: 0.8 },
      { type: 'ruins', color: 0x16181c, sf: 0.3, yOff: 14, hs: 0.7, alpha: 0.95 },
    ],
    chunks: ['flat', 'house', 'leverLadder', 'crates', 'creature', 'genDoor', 'pond'],
    creatures: ['lurker', 'hound'], decor: ['fence', 'wagon', 'grave', 'lamp', 'bush'],
  },
  { // 5 MADEN
    biome: 'mine', material: 'concrete', rain: 0, wind: 0.2, dark: 0.95, interiorish: true,
    palette: { sky0: 0x17181d, sky1: 0x060608, far: 0x101115, mid: 0x0c0d10, near: 0x07080a },
    parallax: [{ type: 'hills', color: 0x101115, sf: 0.06, yOff: 0, hs: 0.5, alpha: 0.7 }],
    chunks: ['flat', 'creature', 'leverLadder', 'crates', 'genDoor', 'spikes', 'climb'],
    creatures: ['stalker', 'lurker'], decor: ['pipe', 'rock', 'rubble', 'cage'],
  },
  { // 6 FABRİKA
    biome: 'factory', material: 'metal', rain: 0, wind: 0.3, dark: 0.5, blackouts: true,
    palette: { sky0: 0x202126, sky1: 0x08090b, far: 0x17181c, mid: 0x101114, near: 0x0a0a0d },
    parallax: [
      { type: 'factory', color: 0x17181c, sf: 0.14, yOff: 0, hs: 1, alpha: 0.9 },
      { type: 'factory', color: 0x0e0f12, sf: 0.4, yOff: 18, hs: 1.1, alpha: 1 },
    ],
    chunks: ['flat', 'sentryGate', 'genDoor', 'crates', 'leverLadder', 'soldierPost', 'spikes'],
    creatures: ['lurker'], decor: ['pipe', 'gear', 'barrier', 'rubble'],
  },
  { // 7 NEHİR
    biome: 'river', material: 'earth', rain: 1, wind: 0.7, dark: 0.2,
    palette: { sky0: 0x252830, sky1: 0x0a0b10, far: 0x1b1e25, mid: 0x13151a, near: 0x0a0b0e },
    parallax: [
      { type: 'hills', color: 0x1b1e25, sf: 0.1, yOff: -8, hs: 0.9, alpha: 0.85 },
      { type: 'trees', color: 0x12141a, sf: 0.34, yOff: 16, hs: 0.95, alpha: 1 },
    ],
    chunks: ['flat', 'pond', 'soldierPost', 'pond', 'creature', 'gap', 'crates'],
    creatures: ['hound'], decor: ['reed', 'boat', 'deadTree', 'rock'],
  },
  { // 8 ÖLÜ ŞEHİR
    biome: 'city', material: 'concrete', rain: 0.3, wind: 0.8, dark: 0.35, blackouts: true,
    palette: { sky0: 0x27272c, sky1: 0x0a0a0d, far: 0x1d1d22, mid: 0x141418, near: 0x0a0a0d },
    parallax: [
      { type: 'ruins', color: 0x1d1d22, sf: 0.12, yOff: -4, hs: 1.1, alpha: 0.9 },
      { type: 'ruins', color: 0x121216, sf: 0.36, yOff: 14, hs: 0.9, alpha: 1 },
    ],
    chunks: ['flat', 'house', 'sentryGate', 'creature', 'crates', 'gap', 'leverLadder'],
    creatures: ['lurker', 'hound'], decor: ['lamp', 'rubble', 'barrier', 'sign', 'statue'],
  },
  { // 9 UÇURUMLAR
    biome: 'cliffs', material: 'earth', rain: 0.5, wind: 1.0, dark: 0.25,
    palette: { sky0: 0x2c2e36, sky1: 0x0b0c11, far: 0x21232b, mid: 0x16181e, near: 0x0b0c10 },
    parallax: [
      { type: 'hills', color: 0x21232b, sf: 0.08, yOff: -30, hs: 1.5, alpha: 0.9 },
      { type: 'hills', color: 0x14161b, sf: 0.3, yOff: 0, hs: 1.2, alpha: 1 },
    ],
    chunks: ['flat', 'windCanyon', 'gap', 'creature', 'windCanyon', 'crates', 'spikes'],
    creatures: ['hound'], decor: ['rock', 'deadTree', 'grave'],
  },
  { // 10 KALE
    biome: 'fortress', material: 'concrete', rain: 0.2, wind: 0.4, dark: 0.45, blackouts: true,
    palette: { sky0: 0x1f2026, sky1: 0x08080b, far: 0x16171c, mid: 0x0f1014, near: 0x08090c },
    parallax: [
      { type: 'ruins', color: 0x16171c, sf: 0.1, yOff: -10, hs: 1.3, alpha: 0.9 },
      { type: 'ruins', color: 0x0e0f13, sf: 0.32, yOff: 10, hs: 1.0, alpha: 1 },
    ],
    chunks: ['flat', 'sentryGate', 'genDoor', 'soldierPost', 'leverLadder', 'crates', 'sentryGate'],
    creatures: ['lurker'], decor: ['barrier', 'lamp', 'statue', 'cage'],
  },
  { // 11 KÜL ÇÖLÜ
    biome: 'desert', material: 'earth', rain: 0, wind: 0.85, dark: 0.2,
    palette: { sky0: 0x33302c, sky1: 0x0d0c0a, far: 0x262420, mid: 0x191815, near: 0x0c0b0a },
    parallax: [
      { type: 'hills', color: 0x262420, sf: 0.07, yOff: -12, hs: 0.8, alpha: 0.85 },
      { type: 'hills', color: 0x171613, sf: 0.26, yOff: 8, hs: 0.6, alpha: 1 },
    ],
    chunks: ['flat', 'gap', 'creature', 'windCanyon', 'crates', 'gap', 'creature'],
    creatures: ['hound', 'stalker'], decor: ['sign', 'rock', 'rubble', 'grave'],
  },
  { // 12 KEMİK MAHZENLERİ
    biome: 'catacomb', material: 'concrete', rain: 0, wind: 0.15, dark: 0.96,
    palette: { sky0: 0x141318, sky1: 0x050507, far: 0x0e0d12, mid: 0x0a090d, near: 0x060609 },
    parallax: [{ type: 'hills', color: 0x0e0d12, sf: 0.05, yOff: 0, hs: 0.4, alpha: 0.6 }],
    chunks: ['flat', 'creature', 'spikes', 'crates', 'leverLadder', 'creature', 'genDoor'],
    creatures: ['stalker', 'stalker', 'lurker'], decor: ['grave', 'cage', 'rock', 'statue'],
  },
  { // 13 SİS KULESİ
    biome: 'spire', material: 'wood', rain: 0, wind: 0.5, dark: 0.55, blackouts: true,
    palette: { sky0: 0x23242c, sky1: 0x090a0e, far: 0x191a21, mid: 0x111218, near: 0x0a0a0e },
    parallax: [
      { type: 'ruins', color: 0x191a21, sf: 0.1, yOff: -20, hs: 1.6, alpha: 0.9 },
      { type: 'ruins', color: 0x101117, sf: 0.3, yOff: 4, hs: 1.2, alpha: 1 },
    ],
    chunks: ['flat', 'climb', 'leverLadder', 'creature', 'crates', 'climb', 'spikes'],
    creatures: ['lurker'], decor: ['lampInt2', 'statue', 'rubble', 'cage'],
  },
  { // 14 GEÇİDİN GÖLGESİ
    biome: 'gateShadow', material: 'earth', rain: 0.4, wind: 0.7, dark: 0.6, blackouts: true,
    palette: { sky0: 0x2a2330, sky1: 0x0a080d, far: 0x1f1a24, mid: 0x141017, near: 0x0a080c },
    parallax: [
      { type: 'hills', color: 0x1f1a24, sf: 0.08, yOff: -16, hs: 1.3, alpha: 0.9 },
      { type: 'ruins', color: 0x120f16, sf: 0.3, yOff: 8, hs: 1.0, alpha: 1 },
    ],
    chunks: ['flat', 'soldierPost', 'creature', 'genDoor', 'windCanyon', 'soldierPost', 'creature'],
    creatures: ['stalker', 'hound', 'lurker'], decor: ['statue', 'grave', 'rock', 'cage'],
  },
  { // 15 GEÇİT
    biome: 'gate', material: 'concrete', rain: 0, wind: 0.6, dark: 0.5,
    palette: { sky0: 0x342c38, sky1: 0x0c0a10, far: 0x251f29, mid: 0x171219, near: 0x0b090d },
    parallax: [
      { type: 'hills', color: 0x251f29, sf: 0.07, yOff: -24, hs: 1.5, alpha: 0.9 },
      { type: 'ruins', color: 0x140f17, sf: 0.28, yOff: 6, hs: 1.1, alpha: 1 },
    ],
    chunks: ['flat', 'soldierPost', 'creature', 'spikes', 'leverLadder', 'creature', 'soldierPost'],
    creatures: ['stalker', 'hound', 'lurker'], decor: ['statue', 'grave', 'rubble'],
  },
];

/* ---------------- GİRİŞ SİNEMATİĞİ ---------------- */
const INTRO_LEVEL = {
  id: 0, act: 0, name: 'KAYBOLUŞ', sub: 'BİR AKŞAM YÜRÜYÜŞÜ', type: 'intro',
  worldW: 1800, rain: 0, wind: 0.5, dark: 0,
  palette: { sky0: 0x3a3d44, sky1: 0x0d0e12, far: 0x2b2d34, mid: 0x1b1c22, near: 0x0c0c10 },
  parallax: [
    { type: 'hills', color: 0x2b2d34, sf: 0.1, yOff: -10, hs: 1, alpha: 0.8 },
    { type: 'trees', color: 0x22242b, sf: 0.26, yOff: 8, hs: 0.95, alpha: 0.92 },
    { type: 'trees', color: 0x14151a, sf: 0.5, yOff: 22, hs: 1.1, alpha: 1 },
  ],
  ground: [{ x0: -200, x1: 2000, y: 600, material: 'earth' }],
};

/* ============================================================
   ÜRETEÇ
   ============================================================ */
const _levelCache = {};

function getLevel(n) {
  if (n === 0) return INTRO_LEVEL;
  if (_levelCache[n]) return _levelCache[n];
  const L = genLevel(n);
  _levelCache[n] = L;
  return L;
}

function genLevel(n) {
  const act = Math.min(15, Math.ceil(n / 10));
  const A = ACTS[act];
  const rng = Atmo._mulberry(n * 7919 + 101);
  const d = n / LEVEL_COUNT;                 // 0..1 zorluk
  const inAct = ((n - 1) % 10) / 9;          // perde içi ilerleme
  const isBoss = n % 10 === 0;
  const gunEra = n >= 18;

  const L = {
    id: n, act, type: 'level',
    name: ACT_NAMES[act][0], sub: ACT_NAMES[act][1],
    bossName: isBoss ? BOSS_NAMES[n] : null,
    rain: A.rain, wind: A.wind,
    dark: A.darkLevels?.[n] ?? A.dark,
    blackouts: !!A.blackouts && !isBoss && rng() < 0.75,
    palette: A.palette, parallax: A.parallax,
    material: A.material,
    playerStart: { x: 130 },
    checkpoints: [130],
    ground: [], platforms: [], walls: [], spikes: [],
    water: [], windZones: [], barricades: [],
    pushboxes: [], looseItems: [], crates: [],
    doors: [], levers: [], ladders: [], generators: [], poweredDoors: [],
    cars: [], driveCar: null,
    soldiers: [], creatures: [],
    decor: [], shafts: [], triggers: [],
    leverLinks: {}, genLinks: {},
    bossGate: null, endCine: null,
  };

  /* özel bölüm bayrakları */
  if (n === 10) L.endCine = 'kidnap';
  if (n === 100) L.endCine = 'glimpse';
  if (n === 150) L.endCine = 'final';

  /* ---- ganimet kuyruğu (kutu içerikleri) ---- */
  const loot = [];
  const darkLevel = L.dark > 0.45;
  loot.push('bandage', 'bandage');
  if (rng() < 0.4 + d * 0.2) loot.push('bandage');
  if (darkLevel) { loot.push('battery', 'battery'); if (rng() < 0.6) loot.push('battery'); }
  else if (L.dark > 0.2 || L.blackouts) loot.push('battery', 'battery');
  if (gunEra) { loot.push('mag', 'mag'); if (isBoss || rng() < 0.5) loot.push('mag'); }
  loot.sort(() => rng() - 0.5);
  const takeLoot = (k = 1) => {
    const out = [];
    for (let i = 0; i < k && loot.length; i++) out.push(loot.shift());
    if (!out.length) out.push(rng() < 0.5 ? 'can' : 'bandage');
    return out;
  };

  /* ---- zemin imleci ---- */
  let x = -100;
  let gy = 600;
  let segStart = -100;
  let uid = 0;
  const endSeg = (xe) => { if (xe > segStart) L.ground.push({ x0: segStart, x1: xe, y: gy, material: A.material }); };
  const jumpTo = (xs, newY) => { segStart = xs; gy = newY ?? gy; };

  x = 0;

  /* ============ CHUNK İNŞACILARI ============ */
  const C = {
    flat(w) {
      w = w ?? 380 + rng() * 320;
      // serbest eşya serpiştir
      if (rng() < 0.4) L.looseItems.push({ kind: rng() < 0.5 ? 'stone' : 'can', x: x + w * rng(), y: gy - 30 });
      if (rng() < 0.16 && loot.length) L.looseItems.push({ kind: loot.shift(), x: x + w * (0.3 + rng() * 0.4), y: gy - 30 });
      x += w;
    },

    gap() {
      const w = Math.min(190, 95 + d * 95 + rng() * 30);
      endSeg(x);
      if (w > 150) {
        // geniş uçurum — ortada asılı platform
        L.platforms.push({ x: x + w / 2 - 55, y: gy + 30 + rng() * 30, w: 110, material: 'wood' });
      }
      x += w;
      jumpTo(x, 600 - (rng() < 0.3 ? 40 : 0) * 0);
      x += 60;
    },

    spikes() {
      const w = 130 + d * 150 + rng() * 60;
      endSeg(x);
      const pitY = gy + 100;
      L.ground.push({ x0: x - 4, x1: x + w + 4, y: pitY, material: A.material });
      L.spikes.push({ x0: x + 8, x1: x + w - 8, y: pitY - 2 });
      // geçiş platformları
      const nPlat = w > 240 ? 2 : 1;
      for (let i = 0; i < nPlat; i++) {
        L.platforms.push({ x: x + (w / (nPlat + 1)) * (i + 1) - 45, y: gy - 4 - rng() * 26, w: 90, material: 'wood' });
      }
      x += w;
      jumpTo(x);
      x += 50;
    },

    climb() {
      // yükseltiye itme kutusuyla çıkış
      const stepH = 112 + rng() * 24;
      L.pushboxes.push({ x: x + 120 + rng() * 60, groundY: gy, w: 72, h: 72 });
      endSeg(x + 260);
      jumpTo(x + 260, gy - stepH);
      L.walls.push({ x: x + 260, y0: gy, y1: gy + stepH + 2 });
      x += 260 + 300 + rng() * 160;
      // ardından aşağı in
      endSeg(x);
      jumpTo(x, gy + stepH);
      x += 40;
    },

    crates(forceContents) {
      const k = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < k; i++) {
        L.crates.push({ x: x + 60 + i * 110 + rng() * 30, groundY: gy, contents: forceContents ?? takeLoot(1 + (rng() < 0.4 ? 1 : 0)), needsCrowbar: true });
      }
      x += 140 + k * 90;
    },

    pond() {
      const w = 240 + d * 220 + rng() * 120;
      endSeg(x);
      const bottom = gy + 130 + rng() * 50;
      L.ground.push({ x0: x - 6, x1: x + w + 6, y: bottom, material: 'earth' });
      L.water.push({ x0: x, x1: x + w, surfaceY: gy + 26, bottomY: bottom });
      // suda yüzen teneke
      if (rng() < 0.5) L.looseItems.push({ kind: 'can', x: x + w / 2, y: gy + 10 });
      // derin suda diken (yüksek zorlukta)
      if (d > 0.45 && w > 350) L.spikes.push({ x0: x + w * 0.4, x1: x + w * 0.6, y: bottom - 2 });
      x += w;
      jumpTo(x);
      x += 50;
    },

    windCanyon() {
      const w = 320 + rng() * 200;
      L.windZones.push({ x0: x, x1: x + w, mult: 2.4 + d });
      endSeg(x);
      const pitY = gy + 110;
      L.ground.push({ x0: x - 4, x1: x + w + 4, y: pitY, material: A.material });
      L.spikes.push({ x0: x + 10, x1: x + w - 10, y: pitY - 2 });
      const nP = Math.ceil(w / 150);
      for (let i = 0; i < nP; i++) {
        L.platforms.push({ x: x + 40 + i * (w - 110) / Math.max(1, nP - 1), y: gy - 6 - (i % 2) * 24, w: 84, material: 'wood' });
      }
      x += w;
      jumpTo(x);
      x += 50;
    },

    soldierPost() {
      const w = 460 + rng() * 240;
      const n2 = (d > 0.4 && rng() < 0.6) ? 2 : 1;
      // siper arabası
      L.cars.push({ x: x + 130, groundY: gy, kind: rng() < 0.4 ? 'truck' : 'sedan', burnt: rng() < 0.4 });
      for (let i = 0; i < n2; i++) {
        const sx = x + 250 + i * 150 + rng() * 60;
        L.soldiers.push(rng() < 0.5
          ? { x: sx, facing: -1, static: true }
          : { x: sx, patrolMinX: sx - 90 - rng() * 70, patrolMaxX: sx + 90 + rng() * 70, facing: -1 });
      }
      x += w;
    },

    sentryGate() {
      // GİZLİLİK KAPISI: nöbetçinin feneri koridoru tarar. Araç siperinin arkasına
      // çömel ([S]), fener başka yana döndüğünde geç. Görüş hattı siperle kesilir.
      const w = 560 + rng() * 140;
      L.cars.push({ x: x + 160, groundY: gy, kind: rng() < 0.5 ? 'truck' : 'sedan', burnt: rng() < 0.5 });
      const sx = x + w - 150;
      L.soldiers.push({ x: sx, patrolMinX: sx - 130, patrolMaxX: sx + 70, facing: -1 });
      // ikinci siper (ortada) — iki aşamalı sızma
      if (d > 0.45 && rng() < 0.6) L.decor.push({ type: 'barrier', x: x + w * 0.5, groundY: gy });
      if (rng() < 0.55 && loot.length) L.crates.push({ x: x + 330, groundY: gy, contents: takeLoot(1), needsCrowbar: true });
      L._hasSentry = true;
      x += w;
    },

    creature() {
      const w = 480 + rng() * 240;
      const type = A.creatures[Math.floor(rng() * A.creatures.length)];
      const scale = (type === 'stalker' ? 1.15 : type === 'lurker' ? 1.3 : 0.85) + d * 0.55;
      L.creatures.push({
        type, x: x + w * 0.55, patrolMinX: x + 60, patrolMaxX: x + w - 60,
        scale, hp: Math.round((type === 'stalker' ? 5 : type === 'lurker' ? 4 : 3) * (1 + d * 1.4)),
      });
      x += w;
    },

    leverLadder() {
      // kol çek → merdiven insin → yükseltiye tırman
      const cliffH = 175 + rng() * 30;
      const id = 'lad' + (uid++);
      L.levers.push({ x: x + 90 + rng() * 60, groundY: gy, id: 'lev_' + id });
      endSeg(x + 320);
      const topY = gy - cliffH;
      L.walls.push({ x: x + 320, y0: topY, y1: gy + 2 });
      L.ladders.push({ x: x + 300, topY: topY, bottomY: gy - 4, raised: true, id });
      L.leverLinks['lev_' + id] = { ladder: id };
      jumpTo(x + 320, topY);
      // tepede ödül
      L.crates.push({ x: x + 430 + rng() * 60, groundY: topY, contents: takeLoot(1), needsCrowbar: true });
      x += 320 + 340 + rng() * 140;
      endSeg(x);
      jumpTo(x, gy + cliffH);
      x += 40;
    },

    genDoor() {
      // pil → jeneratör → demir kapak açılır
      const id = 'gen' + (uid++);
      // garanti pil — kapıdan önce kutuda
      L.crates.push({ x: x + 70, groundY: gy, contents: ['battery'], needsCrowbar: true });
      L.generators.push({ x: x + 220 + rng() * 50, groundY: gy, id });
      const doorX = x + 420 + rng() * 60;
      L.poweredDoors.push({ x: doorX, y: gy, h: 140, id: 'pd_' + id });
      L.walls.push({ x: doorX, y0: gy - 380, y1: gy - 138 });
      L.genLinks[id] = { door: 'pd_' + id };
      x = doorX + 120;
    },

    house() {
      // ev: içeride anahtar, çıkış kapısı kilitli
      const w = 640 + rng() * 120;
      const id = 'h' + (uid++);
      const roofY = gy - 240;
      // ön duvar + kapı boşluğu
      L.walls.push({ x: x + 40, y0: roofY, y1: gy - 118 });
      L.doors.push({ x: x + 40, groundY: gy, h: 118, locked: false, needsKey: false, id: 'in_' + id });
      // çatı / iç mekan dekor kabuğu
      L.decor.push({ type: 'shell', x0: x + 28, x1: x + w, groundY: gy, roofY });
      L.decor.push({ type: 'table', x: x + 170 + rng() * 50, groundY: gy });
      L.decor.push({ type: 'chair', x: x + 250 + rng() * 60, groundY: gy });
      L.decor.push({ type: 'shelf', x: x + w - 200, groundY: gy });
      L.decor.push({ type: 'lampInt2', x: x + w * 0.5, y: roofY + 60, flicker: rng() < 0.5 });
      // anahtar kutularda — hangisinde olduğu belirsiz
      const nCr = 2 + (rng() < 0.5 ? 1 : 0);
      const keyIn = Math.floor(rng() * nCr);
      for (let i = 0; i < nCr; i++) {
        L.crates.push({
          x: x + 150 + i * 130 + rng() * 40, groundY: gy,
          contents: i === keyIn ? ['key'] : takeLoot(1), needsCrowbar: true,
        });
      }
      // tavan arası platformu
      L.platforms.push({ x: x + w * 0.35, y: gy - 120, w: 160, material: 'wood' });
      // çıkış kapısı — kilitli, anahtar ister
      L.walls.push({ x: x + w, y0: roofY, y1: gy - 130 });
      L.doors.push({ x: x + w, groundY: gy, h: 130, locked: true, needsKey: true, id: 'out_' + id });
      x += w + 100;
    },

    carDrive() {
      // bariyer tarlası — tek geçiş: arabayı çalıştırmak.
      // anahtar devriyedeki askerin bileğinde — sessizce çal ya da öldür.
      const sx = x + 260;
      L.soldiers.push({ x: sx, patrolMinX: sx - 110, patrolMaxX: sx + 130, facing: -1, hasCarKey: true });
      L.cars.push({ x: x + 90, groundY: gy, kind: 'sedan', burnt: true });
      const carX = x + 480;
      const fieldW = 520;
      L.driveCar = { x: carX, groundY: gy, travelTo: carX + fieldW + 200 };
      // diken tarlası — yürüyerek geçilmez
      endSeg(carX + 130);
      const pitY = gy + 90;
      L.ground.push({ x0: carX + 126, x1: carX + 130 + fieldW, y: pitY, material: A.material });
      L.spikes.push({ x0: carX + 140, x1: carX + 120 + fieldW, y: pitY - 2 });
      for (let i = 0; i < 3; i++) L.barricades.push({ x: carX + 220 + i * 150, groundY: gy });
      jumpTo(carX + 130 + fieldW);
      x = carX + 130 + fieldW + 80;
    },
  };

  /* ============ BÖLÜM KURGUSU ============ */
  C.flat(360);   // güvenli başlangıç

  if (isBoss) {
    buildBossArena(L, n, act, A, rng, d, C, () => x, (nx) => { x = nx; });
    // arena sonrası x güncellenmiş döner
    x = L._x;
  } else {
    // perde şablonundan parça dizilimi — bölüm uzunluğuna göre
    const targetW = 2700 + n * 16 + rng() * 500;
    const seq = [...A.chunks].sort(() => rng() - 0.5);
    let si = 0;
    while (x < targetW) {
      let chunk = seq[si % seq.length];
      si++;
      // özel bölüm zorlamaları
      if (n === 65 && !L.driveCar && x > 900) chunk = 'carDrive';
      if (chunk === 'creature' && n < 3) chunk = 'flat';            // ilk 2 bölüm tanışma; bölüm 3'ten itibaren yaratık (hikâyeyle uyumlu)
      if ((chunk === 'soldierPost' || chunk === 'sentryGate') && n < 11) chunk = 'flat';   // perde 1'de asker yok
      C[chunk]?.();
      if (rng() < 0.55) C.flat(180 + rng() * 200);
      L.checkpoints.push(x - 30);
    }
  }

  /* bölüm 18: ölü askerin yanında tabanca — hikâye anı */
  if (n === 18) {
    L.decor.push({ type: 'deadSoldier', x: 480, groundY: 600 });
    L.looseItems.push({ kind: 'pistol', x: 510, y: 560 });
    L.looseItems.push({ kind: 'mag', x: 545, y: 560 });
  }

  C.flat(L.endCine ? 900 : 420);   // çıkış düzlüğü (sinematikli bölümde sahne payı)
  const worldW = x + 160;
  endSeg(worldW + 100);
  L.worldW = worldW;
  L.exitX = L.endCine ? worldW - 640 : worldW - 90;   // sinematik sahnesi çerçevede kalsın

  /* ---- GARANTİ PİL: feneri kullanılan karanlık bölümlerde pil MUTLAKA bulunabilsin.
     Eski sistem pili %16 ihtimalle düz zemine bırakıyordu → oyuncu çoğu zaman hiç
     pil bulamıyordu. Artık bölüme yayılmış, ulaşılabilir konumlara garanti koyulur. ---- */
  if (n >= 13 && (L.dark > 0.2 || L.blackouts)) {
    const safe = L.ground.filter(s => s.y <= 620 && (s.x1 - s.x0) > 150 && s.x0 > 200 && s.x1 < worldW - 200);
    const need = L.dark > 0.6 ? 3 : 2;
    for (let i = 0; i < need; i++) {
      const seg = safe.length ? safe[Math.min(safe.length - 1, Math.floor(((i + 0.5) / need) * safe.length))] : null;
      const bx = seg ? (seg.x0 + 55 + (seg.x1 - seg.x0 - 110) * rng()) : worldW * (0.25 + i * 0.22);
      const by = (seg ? seg.y : 600) - 32;
      L.looseItems.push({ kind: 'battery', x: bx, y: by });
    }
  }

  /* ---- kidnap bölümünde son 600px temiz ---- */
  if (L.endCine) {
    L.soldiers = L.soldiers.filter(s => s.x < worldW - 700);
    L.creatures = L.creatures.filter(c => c.patrolMaxX < worldW - 700);
  }

  /* ---- dekor serpiştirme ---- */
  for (const seg of L.ground) {
    if (seg.y > 640) continue; // çukur tabanlarına dekor yok
    let dx0 = Math.max(seg.x0 + 60, 60);
    while (dx0 < seg.x1 - 80) {
      if (rng() < 0.42) {
        const t = A.decor[Math.floor(rng() * A.decor.length)];
        L.decor.push({ type: t, x: dx0, groundY: seg.y });
      }
      dx0 += 170 + rng() * 260;
    }
  }

  /* ---- ışık hüzmeleri (açık hava) ---- */
  if (L.dark < 0.5) {
    const nSh = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < nSh; i++) {
      L.shafts.push({ x: 300 + rng() * (worldW - 600), y: 0, scale: 1.2 + rng() * 0.8, alpha: 0.3 + rng() * 0.2 });
    }
  }

  /* ---- hikâye tetikleri ---- */
  const beats = BEATS[n];
  if (beats?.mid?.length) {
    beats.mid.forEach((line, i) => {
      L.triggers.push({ x: worldW * (0.3 + i * 0.32), text: line });
    });
  }
  // kontrol ipuçları (erken bölümler)
  if (n === 1) {
    L.triggers.push({ x: 300, text: '[A/D] yürü — [W] zıpla — [S] eğil — [E] etkileşim' });
    L.triggers.push({ x: 700, text: 'Eşyaları almak için yanında eğilirsin. Acele etme.' });
  }
  if (n === 13) L.triggers.push({ x: 350, text: '[F] el feneri. Pil biterse [E] ile yenisini takarsın — yavaş bir iştir.' });
  if (n === 18) L.triggers.push({ x: 560, text: '[X] ateş — [R] şarjör değiştir. Boş şarjör yere düşer.' });
  // gizlilik öğretimi: ilk nöbetçili bölümde bir kez
  if ((n === 11 || n === 51) && L._hasSentry) {
    L.triggers.push({ x: 300, text: 'Görülürsen vururlar. Eğil ([S]), siperin arkasında kal, ışıkta durma.' });
  }
  // karanlık öğretimi: zifiri perdelerde fener şart, ama ışık seni ele verir
  if (L.dark >= 0.85) {
    L.triggers.push({ x: 320, text: 'Zifiri karanlık. Fenersiz göremezsin — ama fener açıkken düşmanlar seni görür.' });
  }

  /* checkpoint temizliği */
  L.checkpoints = [...new Set(L.checkpoints)].sort((a, b) => a - b);

  return L;
}

/* ============ BOSS ARENALARI ============ */
function buildBossArena(L, n, act, A, rng, d, C, getX, setX) {
  let x = getX();
  const gy = 600;
  const firefight = [20, 60, 80, 100, 140].includes(n);
  const arenaW = 1500 + d * 700;
  const start = x;

  if (firefight) {
    // siperli çatışma arenası
    const nCars = 3 + Math.floor(d * 2);
    for (let i = 0; i < nCars; i++) {
      L.cars.push({ x: start + 200 + i * (arenaW / nCars), groundY: gy, kind: i % 2 ? 'sedan' : 'truck', burnt: rng() < 0.5 });
    }
    const nSold = Math.min(7, 3 + Math.floor(d * 4));
    for (let i = 0; i < nSold; i++) {
      const sx = start + 350 + i * (arenaW - 350) / nSold;
      L.soldiers.push({
        x: sx, patrolMinX: sx - 70, patrolMaxX: sx + 70, facing: -1,
        gate: true, hp: 2 + (d > 0.5 ? 1 : 0),
      });
    }
    // komutan — dayanıklı
    L.soldiers.push({
      x: start + arenaW - 160, facing: -1, static: true, tough: true,
      hp: Math.round(6 + d * 8), gate: true, hasCarKey: false,
    });
  } else {
    // yaratık boss'u
    const bossType = { 10: 'stalker', 30: 'hound', 40: 'lurker', 50: 'stalker', 70: 'hound', 90: 'lurker', 110: 'hound', 120: 'stalker', 130: 'lurker', 150: 'stalker' }[n] ?? 'stalker';
    const scale = { 10: 1.7, 30: 1.3, 40: 1.9, 50: 2.0, 70: 1.5, 90: 2.2, 110: 1.7, 120: 2.6, 130: 2.5, 150: 3.1 }[n] ?? (1.6 + d);
    L.creatures.push({
      type: bossType, x: start + arenaW * 0.6,
      patrolMinX: start + 100, patrolMaxX: start + arenaW - 100,
      scale, hp: Math.round(10 + d * 30), boss: true, gate: true,
      name: BOSS_NAMES[n], charges: true,
    });
    // sürü destekli boss'lar
    if (n >= 70) {
      const minion = bossType === 'hound' ? 'hound' : (rng() < 0.5 ? 'hound' : 'lurker');
      for (let i = 0; i < (n >= 120 ? 2 : 1); i++) {
        L.creatures.push({
          type: minion, x: start + 300 + i * 500,
          patrolMinX: start + 100, patrolMaxX: start + arenaW - 100,
          scale: 0.9 + d * 0.4, hp: Math.round(3 + d * 4), gate: true,
        });
      }
    }
    // arena içinde sığınak platformları
    for (let i = 0; i < 3; i++) {
      L.platforms.push({ x: start + 250 + i * (arenaW / 3), y: gy - 130 - (i % 2) * 40, w: 130, material: 'wood' });
    }
  }

  // bölüm 10 hariç: boss kapısı — hepsi ölmeden çıkış açılmaz
  if (n !== 10) {
    L.bossGate = { x: start + arenaW + 60, h: 200 };
    L.walls.push({ x: start + arenaW + 60, y0: gy - 460, y1: gy - 198 });
  }
  // arena ortasına acil ganimet
  L.crates.push({ x: start + arenaW * 0.45, groundY: gy, contents: n >= 18 ? ['mag', 'bandage'] : ['bandage'], needsCrowbar: true });
  if (n >= 18) L.crates.push({ x: start + arenaW * 0.7, groundY: gy, contents: ['mag'], needsCrowbar: true });

  x = start + arenaW + 140;
  L._x = x;
  L.checkpoints.push(start - 40);
}

/* ============================================================
   DEKOR ÇİZİMLERİ
   ============================================================ */
const Decor = {
  draw(scene, g, d) {
    const c = 0x0b0b10;
    switch (d.type) {
      case 'deadTree': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.beginPath();
        g.moveTo(x - 9, y);
        qTo(g, x - 9, y, x - 4, y - 90, x - 2, y - 170);
        g.lineTo(x + 4, y - 170);
        qTo(g, x + 4, y - 170, x + 7, y - 80, x + 11, y);
        g.closePath(); g.fillPath();
        g.lineStyle(4, c, 1);
        g.beginPath(); g.moveTo(x - 2, y - 130); qTo(g, x - 2, y - 130, x - 40, y - 165, x - 65, y - 200); g.strokePath();
        g.lineStyle(3, c, 1);
        g.beginPath(); g.moveTo(x + 3, y - 150); qTo(g, x + 3, y - 150, x + 35, y - 180, x + 50, y - 215); g.strokePath();
        break;
      }
      case 'bush': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        for (let i = 0; i < 4; i++) g.fillCircle(x + i * 9 - 13, y - 7 - (i % 2) * 6, 10 + (i % 2) * 3);
        break;
      }
      case 'rock': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.beginPath();
        g.moveTo(x - 22, y); g.lineTo(x - 12, y - 18); g.lineTo(x + 6, y - 24); g.lineTo(x + 20, y - 8); g.lineTo(x + 24, y);
        g.closePath(); g.fillPath();
        break;
      }
      case 'reed': {
        const x = d.x, y = d.groundY;
        g.lineStyle(2, c, 1);
        for (let i = 0; i < 5; i++) {
          const rx = x + i * 7 - 14, h = 34 + (i % 3) * 14;
          g.beginPath(); g.moveTo(rx, y); qTo(g, rx, y, rx + 4, y - h * 0.6, rx + 9, y - h); g.strokePath();
          g.fillStyle(c, 1); g.fillEllipse(rx + 9, y - h, 4, 10);
        }
        break;
      }
      case 'boat': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.beginPath();
        g.moveTo(x - 50, y - 24); g.lineTo(x + 50, y - 24);
        qTo(g, x + 50, y - 24, x + 36, y - 2, x + 18, y);
        g.lineTo(x - 28, y);
        qTo(g, x - 28, y, x - 46, y - 6, x - 50, y - 24);
        g.closePath(); g.fillPath();
        g.lineStyle(3, c, 1);
        g.beginPath(); g.moveTo(x - 4, y - 24); g.lineTo(x - 4, y - 70); g.strokePath(); // kırık direk
        break;
      }
      case 'wagon': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 55, y - 42, 110, 26);
        g.beginPath(); g.moveTo(x - 55, y - 42); g.lineTo(x - 70, y - 12); g.lineTo(x - 55, y - 16); g.closePath(); g.fillPath();
        g.lineStyle(4, c, 1); g.strokeCircle(x + 38, y - 12, 13);
        g.lineStyle(2.4, c, 1);
        g.beginPath(); g.moveTo(x + 28, y - 18); g.lineTo(x + 48, y - 6); g.strokePath();
        g.beginPath(); g.moveTo(x + 44, y - 20); g.lineTo(x + 32, y - 4); g.strokePath();
        break;
      }
      case 'sign': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 2.6, y - 86, 5.2, 86);
        g.fillRect(x - 26, y - 86, 52, 16);
        break;
      }
      case 'lamp': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 3, y - 210, 6, 210);
        g.fillRect(x - 3, y - 210, 36, 5);
        g.fillRect(x + 27, y - 210, 6, 12);
        if (!d.broken) d.lightAt = { x: x + 30, y: y - 196 };
        break;
      }
      case 'barrier': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 40, y - 34, 80, 8);
        g.fillRect(x - 34, y - 26, 7, 26);
        g.fillRect(x + 27, y - 26, 7, 26);
        break;
      }
      case 'fence': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        for (let i = 0; i < 4; i++) g.fillRect(x + i * 16 - 24, y - 36 + (i % 2) * 3, 5, 36);
        g.fillRect(x - 28, y - 30, 66, 4);
        break;
      }
      case 'grave': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 9, y - 34, 18, 34);
        g.fillCircle(x, y - 34, 9);
        break;
      }
      case 'rubble': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.beginPath();
        g.moveTo(x - 36, y); g.lineTo(x - 20, y - 16); g.lineTo(x - 4, y - 8); g.lineTo(x + 10, y - 22); g.lineTo(x + 26, y - 6); g.lineTo(x + 38, y);
        g.closePath(); g.fillPath();
        g.lineStyle(3, c, 1);
        g.beginPath(); g.moveTo(x + 4, y - 14); g.lineTo(x + 14, y - 44); g.strokePath(); // çıkık demir
        break;
      }
      case 'pipe': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 8, y - 150, 16, 150);
        g.fillRect(x - 8, y - 150, 60, 14);
        g.fillCircle(x + 52, y - 143, 9);
        break;
      }
      case 'gear': {
        const x = d.x, y = d.groundY;
        g.lineStyle(6, c, 1);
        g.strokeCircle(x, y - 26, 22);
        g.fillStyle(c, 1);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          g.fillRect(x + Math.cos(a) * 26 - 3, y - 26 + Math.sin(a) * 26 - 3, 7, 7);
        }
        break;
      }
      case 'statue': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 16, y - 14, 32, 14);                 // kaide
        g.fillRect(x - 7, y - 64, 14, 50);                  // gövde
        g.fillCircle(x, y - 70, 8);                         // baş
        g.lineStyle(5, c, 1);
        g.beginPath(); g.moveTo(x - 4, y - 56); g.lineTo(x - 22, y - 38); g.strokePath();  // kırık kol
        break;
      }
      case 'cage': {
        const x = d.x, y = d.groundY;
        g.lineStyle(2.6, c, 1);
        g.strokeRect(x - 20, y - 64, 40, 64);
        for (let i = 1; i < 4; i++) {
          g.beginPath(); g.moveTo(x - 20 + i * 10, y - 64); g.lineTo(x - 20 + i * 10, y); g.strokePath();
        }
        break;
      }
      case 'deadSoldier': {
        // hikâye dekoru — yerde yatan asker silueti
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillEllipse(x, y - 7, 56, 13);
        g.fillCircle(x - 30, y - 10, 7);
        g.beginPath(); // miğfer yuvarlanmış
        g.arc(x - 52, y - 6, 8, Math.PI, 0);
        g.lineTo(x - 44, y - 2); g.lineTo(x - 60, y - 2);
        g.closePath(); g.fillPath();
        break;
      }
      case 'window': {
        const x = d.x, y = d.y;
        g.fillStyle(0x3a3d46, 0.5);
        g.fillRect(x - 30, y - 45, 60, 90);
        g.fillStyle(0x07070a, 1);
        g.fillRect(x - 3, y - 45, 6, 90);
        g.fillRect(x - 30, y - 3, 60, 6);
        g.lineStyle(5, 0x0b0b10, 1);
        g.strokeRect(x - 32, y - 47, 64, 94);
        break;
      }
      case 'table': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 44, y - 40, 88, 7);
        g.fillRect(x - 38, y - 33, 7, 33);
        g.fillRect(x + 31, y - 33, 7, 33);
        break;
      }
      case 'chair': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 14, y - 30, 28, 5);
        g.fillRect(x - 13, y - 25, 5, 25);
        g.fillRect(x + 8, y - 25, 5, 25);
        g.fillRect(x - 13, y - 62, 5, 34);
        break;
      }
      case 'shelf': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 36, y - 110, 72, 6);
        g.fillRect(x - 36, y - 70, 72, 6);
        g.fillRect(x - 36, y - 110, 5, 110);
        g.fillRect(x + 31, y - 110, 5, 110);
        g.fillRect(x - 20, y - 124, 7, 14); g.fillRect(x - 2, y - 122, 6, 12); g.fillRect(x + 14, y - 126, 8, 16);
        break;
      }
      case 'lampInt2': {
        const x = d.x, y = d.y;
        g.lineStyle(2, c, 1);
        g.beginPath(); g.moveTo(x, y - 60); g.lineTo(x, y); g.strokePath();
        g.fillStyle(c, 1);
        g.beginPath(); g.moveTo(x - 12, y + 14); g.lineTo(x + 12, y + 14); g.lineTo(x + 7, y); g.lineTo(x - 7, y); g.closePath(); g.fillPath();
        d.lightAt = { x, y: y + 18, flicker: d.flicker };
        break;
      }
      case 'shell': {
        // ev kabuğu: çatı + arka duvar dolgusu
        const x0 = d.x0, x1 = d.x1, y = d.groundY, ry = d.roofY;
        g.fillStyle(0x14151c, 1);
        g.fillRect(x0, ry + 4, x1 - x0, y - ry - 4);   // iç arka duvar
        g.fillStyle(c, 1);
        g.fillRect(x0 - 14, ry - 10, x1 - x0 + 28, 16); // tavan
        g.beginPath();                                   // çatı üçgeni
        g.moveTo(x0 - 30, ry - 4);
        g.lineTo((x0 + x1) / 2, ry - 88);
        g.lineTo(x1 + 30, ry - 4);
        g.closePath(); g.fillPath();
        // duvar kağıdı çizgileri
        g.lineStyle(1, 0x1d1e26, 0.7);
        for (let wx = x0 + 30; wx < x1 - 20; wx += 46) {
          g.beginPath(); g.moveTo(wx, ry + 10); g.lineTo(wx, y - 6); g.strokePath();
        }
        break;
      }
    }
  },

  /* araba siluetleri — stealth siperi */
  drawCar(scene, g, car) {
    const c = 0x0a0a0f;
    const x = car.x, y = car.groundY;
    g.fillStyle(c, 1);
    if (car.kind === 'truck') {
      g.fillRect(x - 130, y - 78, 175, 60);
      g.fillRoundedRect(x + 45, y - 64, 80, 46, { tl: 14, tr: 10, bl: 0, br: 0 });
      g.fillRect(x - 130, y - 24, 255, 8);
      g.fillCircle(x - 85, y - 13, 15); g.fillCircle(x - 25, y - 13, 15); g.fillCircle(x + 85, y - 13, 15);
      g.fillStyle(0x16171d, 1);
      g.fillCircle(x - 85, y - 13, 6); g.fillCircle(x - 25, y - 13, 6); g.fillCircle(x + 85, y - 13, 6);
      car.coverX0 = x - 135; car.coverX1 = x + 130; car.coverH = 60;
    } else {
      g.fillRoundedRect(x - 90, y - 40, 180, 26, 8);
      g.beginPath();
      g.moveTo(x - 52, y - 38);
      qTo(g, x - 52, y - 38, x - 30, y - 62, x + 2, y - 62);
      qTo(g, x + 2, y - 62, x + 38, y - 62, x + 55, y - 38);
      g.closePath(); g.fillPath();
      if (car.burnt) {
        g.lineStyle(2.5, c, 1);
        g.beginPath(); g.moveTo(x + 55, y - 40); g.lineTo(x + 88, y - 58); g.strokePath();
      } else {
        g.fillStyle(0x16171d, 0.9);
        g.fillRect(x - 34, y - 56, 28, 16); g.fillRect(x + 2, y - 56, 28, 16);
        g.fillStyle(c, 1);
      }
      g.fillCircle(x - 52, y - 13, 13); g.fillCircle(x + 52, y - 13, 13);
      g.fillStyle(0x16171d, 1);
      g.fillCircle(x - 52, y - 13, 5); g.fillCircle(x + 52, y - 13, 5);
      car.coverX0 = x - 95; car.coverX1 = x + 95; car.coverH = 42;
    }
  },
};
