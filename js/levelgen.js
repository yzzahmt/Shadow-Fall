/* ============================================================
   SHADOW FALL — 100 Bölümlük Dünya Üreteci
   10 perde × 10 bölüm. Her bölüm tohumlu (deterministik) üretilir:
   zemin, uçurumlar, su, aksiyon sahneleri, en az bir bulmaca
   (bkz. puzzles.js), iki katlı evler ve 2-3 bölüm süren yapılar
   (bkz. buildings.js), karışık yaratık türleri, saklama yerlerine
   dağıtılan ganimet (bandaj yalnız tıbbi yerlerden çıkar).
   ============================================================ */
'use strict';

const KILL_Y = 920;
const WORLD_H = 760;
const LEVEL_COUNT = 100;
const BOMB_LEVEL = 87;           // bomba tuzaklı kapı — süreli görev

/* ---------------- PERDE TANIMLARI ---------------- */
const ACTS = [null,
  { // 1 ORMAN
    biome: 'forest', setPieces: ['collapse', 'chase'], material: 'earth', rain: 0, wind: 0.4, dark: 0,
    palette: { sky0: 0x34373f, sky1: 0x101116, far: 0x272930, mid: 0x191a20, near: 0x0c0c11 },
    parallax: [
      { type: 'hills', color: 0x272930, sf: 0.1, yOff: -10, hs: 1, alpha: 0.8 },
      { type: 'trees', color: 0x23252c, sf: 0.24, yOff: 6, hs: 0.9, alpha: 0.92 },
      { type: 'trees', color: 0x16171c, sf: 0.48, yOff: 22, hs: 1.1, alpha: 1 },
    ],
    chunks: ['flat', 'gap', 'spikes', 'creature', 'stash', 'flat', 'house'],
    creatures: ['stalker', 'crawler', 'hound'], decor: ['deadTree', 'bush', 'rock', 'wagon'],
  },
  { // 2 KÜL YOLU
    biome: 'road', setPieces: ['ambush', 'chase'], material: 'concrete', rain: 0.6, wind: 0.6, dark: 0,
    darkLevels: { 13: 0.55, 16: 0.6, 19: 0.65 },
    palette: { sky0: 0x26282e, sky1: 0x0a0b0f, far: 0x1c1d23, mid: 0x14151a, near: 0x0a0a0e },
    parallax: [
      { type: 'hills', color: 0x1c1d23, sf: 0.1, yOff: -6, hs: 0.8, alpha: 0.85 },
      { type: 'ruins', color: 0x17181d, sf: 0.26, yOff: 10, hs: 0.8, alpha: 0.95 },
      { type: 'factory', color: 0x101116, sf: 0.5, yOff: 24, hs: 0.9, alpha: 1 },
    ],
    chunks: ['flat', 'soldierPost', 'gap', 'crates', 'shop', 'spikes', 'stash', 'house'],
    creatures: ['hound', 'brute', 'crawler'], decor: ['lamp', 'barrier', 'sign', 'rubble'],
  },
  { // 3 BATAKLIK
    biome: 'swamp', setPieces: ['chase', 'collapse'], material: 'earth', rain: 1, wind: 0.5, dark: 0.25,
    palette: { sky0: 0x252a28, sky1: 0x0a0d0c, far: 0x1d2220, mid: 0x141816, near: 0x0a0c0b },
    parallax: [
      { type: 'hills', color: 0x1d2220, sf: 0.1, yOff: -4, hs: 0.7, alpha: 0.85 },
      { type: 'trees', color: 0x171b19, sf: 0.28, yOff: 12, hs: 1.0, alpha: 0.95 },
      { type: 'trees', color: 0x0e1110, sf: 0.52, yOff: 24, hs: 1.15, alpha: 1 },
    ],
    chunks: ['flat', 'pond', 'creature', 'gap', 'pond', 'stash', 'spikes'],
    creatures: ['crawler', 'stalker', 'wraith', 'hound'], decor: ['deadTree', 'reed', 'boat', 'rock'],
  },
  { // 4 MADEN
    biome: 'mine', setPieces: ['collapse', 'chase'], material: 'concrete', rain: 0, wind: 0.2, dark: 0.95, interiorish: true,
    palette: { sky0: 0x17181d, sky1: 0x060608, far: 0x101115, mid: 0x0c0d10, near: 0x07080a },
    parallax: [{ type: 'hills', color: 0x101115, sf: 0.06, yOff: 0, hs: 0.5, alpha: 0.7 }],
    chunks: ['flat', 'creature', 'crates', 'genDoor', 'spikes', 'stash', 'creature'],
    creatures: ['crawler', 'lurker', 'wraith', 'brute'], decor: ['pipe', 'rock', 'rubble', 'cage'],
  },
  { // 5 FABRİKA
    biome: 'factory', setPieces: ['ambush', 'collapse'], material: 'metal', rain: 0, wind: 0.3, dark: 0.5, blackouts: true,
    palette: { sky0: 0x202126, sky1: 0x08090b, far: 0x17181c, mid: 0x101114, near: 0x0a0a0d },
    parallax: [
      { type: 'factory', color: 0x17181c, sf: 0.14, yOff: 0, hs: 1, alpha: 0.9 },
      { type: 'factory', color: 0x0e0f12, sf: 0.4, yOff: 18, hs: 1.1, alpha: 1 },
    ],
    chunks: ['flat', 'sentryGate', 'factoryLock', 'crates', 'soldierPost', 'spikes', 'stash'],
    creatures: ['brute', 'lurker', 'hound', 'crawler'], decor: ['pipe', 'gear', 'barrier', 'rubble'],
  },
  { // 6 NEHİR
    biome: 'river', setPieces: ['chase', 'ambush'], material: 'earth', rain: 1, wind: 0.7, dark: 0.2,
    palette: { sky0: 0x252830, sky1: 0x0a0b10, far: 0x1b1e25, mid: 0x13151a, near: 0x0a0b0e },
    parallax: [
      { type: 'hills', color: 0x1b1e25, sf: 0.1, yOff: -8, hs: 0.9, alpha: 0.85 },
      { type: 'trees', color: 0x12141a, sf: 0.34, yOff: 16, hs: 0.95, alpha: 1 },
    ],
    chunks: ['flat', 'pond', 'soldierPost', 'pond', 'creature', 'gap', 'stash'],
    creatures: ['hound', 'wraith', 'stalker', 'crawler'], decor: ['reed', 'boat', 'deadTree', 'rock'],
  },
  { // 7 ÖLÜ ŞEHİR
    biome: 'city', setPieces: ['ambush', 'chase'], material: 'concrete', rain: 0.3, wind: 0.8, dark: 0.35, blackouts: true,
    palette: { sky0: 0x27272c, sky1: 0x0a0a0d, far: 0x1d1d22, mid: 0x141418, near: 0x0a0a0d },
    parallax: [
      { type: 'ruins', color: 0x1d1d22, sf: 0.12, yOff: -4, hs: 1.1, alpha: 0.9 },
      { type: 'ruins', color: 0x121216, sf: 0.36, yOff: 14, hs: 0.9, alpha: 1 },
    ],
    chunks: ['flat', 'house', 'sentryGate', 'creature', 'shop', 'gap', 'stash'],
    creatures: ['lurker', 'brute', 'wraith', 'hound'], decor: ['lamp', 'rubble', 'barrier', 'sign', 'statue'],
  },
  { // 8 KALE
    biome: 'fortress', setPieces: ['ambush', 'collapse'], material: 'concrete', rain: 0.2, wind: 0.4, dark: 0.45, blackouts: true,
    palette: { sky0: 0x1f2026, sky1: 0x08080b, far: 0x16171c, mid: 0x0f1014, near: 0x08090c },
    parallax: [
      { type: 'ruins', color: 0x16171c, sf: 0.1, yOff: -10, hs: 1.3, alpha: 0.9 },
      { type: 'ruins', color: 0x0e0f13, sf: 0.32, yOff: 10, hs: 1.0, alpha: 1 },
    ],
    chunks: ['flat', 'sentryGate', 'factoryLock', 'soldierPost', 'house', 'crates', 'stash'],
    creatures: ['brute', 'lurker', 'crawler', 'wraith'], decor: ['barrier', 'lamp', 'statue', 'cage'],
  },
  { // 9 SİS KULESİ
    biome: 'spire', setPieces: ['collapse', 'ambush'], material: 'wood', rain: 0, wind: 0.5, dark: 0.55, blackouts: true,
    palette: { sky0: 0x23242c, sky1: 0x090a0e, far: 0x191a21, mid: 0x111218, near: 0x0a0a0e },
    parallax: [
      { type: 'ruins', color: 0x191a21, sf: 0.1, yOff: -20, hs: 1.6, alpha: 0.9 },
      { type: 'ruins', color: 0x101117, sf: 0.3, yOff: 4, hs: 1.2, alpha: 1 },
    ],
    chunks: ['flat', 'creature', 'crates', 'spikes', 'stash', 'creature'],
    creatures: ['wraith', 'lurker', 'stalker', 'crawler'], decor: ['lampInt2', 'statue', 'rubble', 'cage'],
  },
  { // 10 GEÇİT
    biome: 'gate', setPieces: ['ambush', 'chase', 'collapse'], material: 'concrete', rain: 0, wind: 0.6, dark: 0.5,
    palette: { sky0: 0x342c38, sky1: 0x0c0a10, far: 0x251f29, mid: 0x171219, near: 0x0b090d },
    parallax: [
      { type: 'hills', color: 0x251f29, sf: 0.07, yOff: -24, hs: 1.5, alpha: 0.9 },
      { type: 'ruins', color: 0x140f17, sf: 0.28, yOff: 6, hs: 1.1, alpha: 1 },
    ],
    chunks: ['flat', 'soldierPost', 'creature', 'spikes', 'stash', 'creature', 'soldierPost'],
    creatures: ['stalker', 'hound', 'lurker', 'crawler', 'wraith', 'brute'], decor: ['statue', 'grave', 'rubble'],
  },
];

/* ---------------- GİRİŞ SİNEMATİĞİ ---------------- */
const INTRO_LEVEL = {
  id: 0, act: 0, name: 'KAYBOLUŞ', sub: 'BİR AKŞAM YÜRÜYÜŞÜ', type: 'intro', biome: 'forest',
  worldW: 1800, rain: 0, wind: 0.5, dark: 0,
  palette: { sky0: 0x3a3d44, sky1: 0x0d0e12, far: 0x2b2d34, mid: 0x1b1c22, near: 0x0c0c10 },
  parallax: [
    { type: 'hills', color: 0x2b2d34, sf: 0.1, yOff: -10, hs: 1, alpha: 0.8 },
    { type: 'trees', color: 0x22242b, sf: 0.26, yOff: 8, hs: 0.95, alpha: 0.92 },
    { type: 'trees', color: 0x14151a, sf: 0.5, yOff: 22, hs: 1.1, alpha: 1 },
  ],
  /* ortadaki parça (520–615) giriş sinematiğinde depremle çöken toprak kütlesi;
     ayrı çizilir, buradaki şeritler yarığın iki yakası */
  ground: [{ x0: -200, x1: 520, y: 600, material: 'earth' }, { x0: 615, x1: 2000, y: 600, material: 'earth' }],
};

/* ============================================================
   ÜRETEÇ
   ============================================================ */
const _levelCache = {};

/* tohumlu karıştırma (Fisher–Yates). sort(() => rng() - 0.5) motor sürümüne göre
   farklı sayıda karşılaştırma yapar: aynı bölüm iki cihazda farklı çıkıyordu. */
function shuffleWith(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* yaratık türleri: ilk göründüğü bölüm + temel ölçü / dayanıklılık */
const CREATURE_STATS = {
  stalker: { from: 3,  scale: 1.15, hp: 5 },
  crawler: { from: 4,  scale: 1.0,  hp: 3 },
  hound:   { from: 6,  scale: 0.85, hp: 3 },
  brute:   { from: 12, scale: 1.4,  hp: 8 },
  wraith:  { from: 21, scale: 1.1,  hp: 99 },
  lurker:  { from: 31, scale: 1.3,  hp: 4 },
};
/* açık havadaki saklama yerleri — perdeye göre */
const STASH_KINDS = {
  forest: ['hollow', 'backpack', 'hollow', 'toolbox'],
  road: ['mailbox', 'trash', 'backpack', 'toolbox'],
  swamp: ['hollow', 'chest', 'backpack'],
  mine: ['locker', 'toolbox', 'chest', 'medkit'],
  factory: ['locker', 'toolbox', 'medkit'],
  river: ['chest', 'backpack', 'hollow', 'toolbox'],
  city: ['mailbox', 'trash', 'backpack', 'medkit'],
  fortress: ['ammo', 'locker', 'chest', 'medkit'],
  spire: ['chest', 'cabinet', 'drawer'],
  gate: ['chest', 'backpack', 'ammo'],
};

function getLevel(n) {
  if (n === 0) return INTRO_LEVEL;
  if (_levelCache[n]) return _levelCache[n];
  const L = genLevel(n);
  _levelCache[n] = L;
  return L;
}

function genLevel(n) {
  const act = Math.min(10, Math.ceil(n / 10));
  const A = ACTS[act];
  const rng = Atmo._mulberry(n * 7919 + 101);
  const d = n / LEVEL_COUNT;                 // 0..1 zorluk
  const gunEra = n >= 17;

  const L = {
    id: n, act, type: 'level', biome: A.biome,
    name: ACT_NAMES[act][0], sub: ACT_NAMES[act][1],
    rain: A.rain, wind: A.wind,
    dark: A.darkLevels?.[n] ?? A.dark,
    blackouts: !!A.blackouts && rng() < 0.75,
    palette: A.palette, parallax: A.parallax,
    material: A.material,
    playerStart: { x: 130 },
    checkpoints: [130],
    ground: [], platforms: [], walls: [], spikes: [],
    water: [], windZones: [], barricades: [],
    pushboxes: [], looseItems: [], crates: [], containers: [],
    doors: [], levers: [], ladders: [], generators: [], poweredDoors: [],
    cars: [], driveCar: null,
    soldiers: [], creatures: [],
    collapses: [], chases: [], ambushes: [],
    decor: [], shafts: [], triggers: [],
    leverLinks: {}, genLinks: {},
    endCine: null,
  };

  /* Maria yarığa düştükten sonra son bölüme kadar görünmez; tek sinematik final */
  L.companion = false;
  if (n === 100) L.endCine = 'final';
  L.noGrab = [];             // tutunulamayan kenarlar (bulmacalar atlanmasın)

  /* ---- zemin imleci ---- */
  let x = -100;
  let gy = 600;
  let segStart = -100;
  let uid = 0;
  const endSeg = (xe) => { if (xe > segStart) L.ground.push({ x0: segStart, x1: xe, y: gy, material: A.material }); };
  const jumpTo = (xs, newY) => { segStart = xs; gy = newY ?? gy; };
  x = 0;

  /* ---- saklama yerleri ---- */
  const stash = (kind, sx, groundY, contents, opts = {}) => {
    const c = { kind, x: sx, groundY, contents: contents ? [...contents] : [], fixed: !!contents, ...opts };
    if (opts.needsCrowbar == null && (kind === 'vent' || ((kind === 'locker' || kind === 'chest') && rng() < 0.25))) c.needsCrowbar = true;
    L.containers.push(c);
    return c;
  };
  /* yaratık seçimi: perdenin listesinden, bu bölümde açılmış olanlar arasından sırayla
     (art arda iki yaratık odası aynı tür olmasın) */
  const creaturePool = () => {
    const pool = A.creatures.filter(t => n >= CREATURE_STATS[t].from);
    return pool.length ? pool : ['stalker'];
  };
  const pickCreature = () => {
    const pool = creaturePool();
    L._crN = (L._crN ?? Math.floor(rng() * pool.length)) + 1;
    return pool[L._crN % pool.length];
  };
  const creatureStats = (t, k = 1) => {
    const S = CREATURE_STATS[t];
    return { scale: (S.scale + d * (t === 'brute' ? 0.25 : 0.45)) * k, hp: t === 'wraith' ? 99 : Math.round(S.hp * (1 + d * 1.3)) };
  };

  /* ============ CHUNK İNŞACILARI ============ */
  const C = {
    flat(w) {
      w = w ?? 380 + rng() * 320;
      // ses yapan serbest eşya (taş / teneke) — fırlatılınca dikkat dağıtır
      if (rng() < 0.4) L.looseItems.push({ kind: rng() < 0.5 ? 'stone' : 'can', x: x + w * rng(), y: gy - 30 });
      if (w > 300 && rng() < 0.14 && !L.interior) stash(STASH_KINDS[A.biome][Math.floor(rng() * STASH_KINDS[A.biome].length)], x + w * (0.3 + rng() * 0.4), gy, null);
      x += w;
    },

    gap() {
      const w = Math.min(190, 95 + d * 95 + rng() * 30);
      endSeg(x);
      if (w > 150) L.platforms.push({ x: x + w / 2 - 55, y: gy + 30 + rng() * 30, w: 110, material: 'wood' });
      x += w;
      jumpTo(x);
      x += 60;
    },

    spikes() {
      const w = 130 + d * 150 + rng() * 60;
      endSeg(x);
      const pitY = gy + 100;
      L.ground.push({ x0: x - 4, x1: x + w + 4, y: pitY, material: A.material });
      L.spikes.push({ x0: x + 8, x1: x + w - 8, y: pitY - 2 });
      const nPlat = w > 240 ? 2 : 1;
      for (let i = 0; i < nPlat; i++) {
        L.platforms.push({ x: x + (w / (nPlat + 1)) * (i + 1) - 45, y: gy - 4 - rng() * 26, w: 90, material: 'wood' });
      }
      x += w;
      jumpTo(x);
      x += 50;
    },

    /* yükselti: zıplayarak çıkılamaz, tutunulamaz — itme kutusu şart */
    climb() {
      const stepH = 214 + rng() * 12;
      L.pushboxes.push({ x: x + 110 + rng() * 50, groundY: gy, w: 72, h: 72 });
      endSeg(x + 260);
      jumpTo(x + 260, gy - stepH);
      L.walls.push({ x: x + 260, y0: gy, y1: gy + stepH + 2 });
      L.noGrab.push({ x: x + 260, y: gy });
      x += 260 + 300 + rng() * 160;
      endSeg(x);
      jumpTo(x, gy + stepH);
      x += 40;
    },

    crates(forceContents) {
      const k = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < k; i++) {
        L.crates.push({ x: x + 60 + i * 110 + rng() * 30, groundY: gy, contents: forceContents ?? [], needsCrowbar: true, fixed: !!forceContents });
      }
      x += 140 + k * 90;
    },

    /* saklama köşesi — perdeye uygun bir yer: kovuk, çanta, posta kutusu... */
    stash() {
      const kinds = L.interior ? (H.theme?.stash ?? ['drawer']) : STASH_KINDS[A.biome];
      const k = kinds[Math.floor(rng() * kinds.length)];
      if (k === 'backpack' && n >= 11 && rng() < 0.6) L.decor.push({ type: 'deadSoldier', x: x + 40, groundY: gy });
      stash(k, x + 100, gy, null);
      if (rng() < 0.35) stash(kinds[Math.floor(rng() * kinds.length)], x + 210, gy, null);
      x += 300;
    },

    pond() {
      const w = 240 + d * 220 + rng() * 120;
      endSeg(x);
      const bottom = gy + 130 + rng() * 50;
      L.ground.push({ x0: x - 6, x1: x + w + 6, y: bottom, material: 'earth' });
      L.water.push({ x0: x, x1: x + w, surfaceY: gy + 26, bottomY: bottom });
      if (rng() < 0.5) L.looseItems.push({ kind: 'can', x: x + w / 2, y: gy + 10 });
      if (d > 0.45 && w > 350) L.spikes.push({ x0: x + w * 0.4, x1: x + w * 0.6, y: bottom - 2 });
      x += w;
      jumpTo(x);
      x += 50;
    },

    soldierPost() {
      const w = 460 + rng() * 240;
      const n2 = (d > 0.4 && rng() < 0.6) ? 2 : 1;
      const burnt = rng() < 0.4;
      L.cars.push({ x: x + 130, groundY: gy, kind: rng() < 0.4 ? 'truck' : 'sedan', burnt });
      if (!burnt && rng() < 0.6) stash('glovebox', x + 150, gy, null);
      for (let i = 0; i < n2; i++) {
        const sx = x + 250 + i * 150 + rng() * 60;
        L.soldiers.push(rng() < 0.5
          ? { x: sx, facing: -1, static: true }
          : { x: sx, patrolMinX: sx - 90 - rng() * 70, patrolMaxX: sx + 90 + rng() * 70, facing: -1 });
      }
      x += w;
    },

    sentryGate() {
      /* GİZLİLİK KAPISI: nöbetçinin feneri koridoru tarar. Araç siperinin arkasına
         çömel, fener başka yana döndüğünde geç. */
      const w = 560 + rng() * 140;
      L.cars.push({ x: x + 160, groundY: gy, kind: rng() < 0.5 ? 'truck' : 'sedan', burnt: rng() < 0.5 });
      const sx = x + w - 150;
      L.soldiers.push({ x: sx, patrolMinX: sx - 130, patrolMaxX: sx + 70, facing: -1 });
      if (d > 0.45 && rng() < 0.6) L.decor.push({ type: 'barrier', x: x + w * 0.5, groundY: gy });
      if (rng() < 0.55) stash(rng() < 0.5 ? 'ammo' : 'backpack', x + 330, gy, null);
      L._hasSentry = true;
      x += w;
    },

    creature() {
      if (n < 3) { C.flat(480); return; }
      const w = 520 + rng() * 260;
      const type = pickCreature();
      L.creatures.push({ type, x: x + w * 0.55, patrolMinX: x + 60, patrolMaxX: x + w - 60, ...creatureStats(type) });
      /* geç bölümlerde zaman zaman ikinci, farklı bir tür */
      if (d > 0.35 && rng() < 0.35) {
        const t2 = pickCreature();
        if (t2 !== type) L.creatures.push({ type: t2, x: x + w * 0.25, patrolMinX: x + 40, patrolMaxX: x + w * 0.5, ...creatureStats(t2, 0.9) });
      }
      x += w;
    },

    leverLadder() {
      // kol çek → merdiven insin → yükseltiye tırman (zıplayarak / tutunarak çıkılmaz)
      const cliffH = 248 + rng() * 18;
      const id = 'lad' + (uid++);
      L.levers.push({ x: x + 90 + rng() * 60, groundY: gy, id: 'lev_' + id });
      endSeg(x + 320);
      const topY = gy - cliffH;
      L.walls.push({ x: x + 320, y0: topY, y1: gy + 2 });
      L.noGrab.push({ x: x + 320, y: topY });
      L.ladders.push({ x: x + 300, topY: topY, bottomY: gy - 4, raised: true, id });
      L.leverLinks['lev_' + id] = { ladder: id };
      jumpTo(x + 320, topY);
      stash(L.interior ? 'cabinet' : STASH_KINDS[A.biome][0], x + 440 + rng() * 60, topY, null);
      x += 320 + 340 + rng() * 140;
      endSeg(x);
      jumpTo(x, gy + cliffH);
      x += 40;
    },

    genDoor() {
      // pil → jeneratör → demir kapak açılır
      const id = 'gen' + (uid++);
      stash('toolbox', x + 70, gy, ['battery']);
      L.generators.push({ x: x + 220 + rng() * 50, groundY: gy, id });
      const doorX = x + 420 + rng() * 60;
      L.poweredDoors.push({ x: doorX, y: gy, h: 140, id: 'pd_' + id });
      L.walls.push({ x: doorX, y0: gy - 380, y1: gy - 138 });
      L.genLinks[id] = { door: 'pd_' + id };
      x = doorX + 120;
    },

    /* ÇÖKEN KÖPRÜ — üstüne basınca arkandan parça parça çöker: koş! */
    collapse() {
      const nP = 7 + Math.floor(rng() * 3);
      const pw = 64;
      endSeg(x);
      L.collapses.push({ x0: x, y: gy, n: nP, pw });
      x += nP * pw;
      jumpTo(x);
      x += 60;
    },

    /* KOVALAMACA — arkandan bir şey fırlar; uçurumun öbür yanına atla, o atlayamaz */
    chase() {
      const run = 900 + rng() * 300;
      const pool = creaturePool().filter(t => t !== 'wraith');
      const type = pool.includes('hound') && rng() < 0.5 ? 'hound' : pool[Math.floor(rng() * pool.length)] ?? 'stalker';
      const gapW = 118 + d * 22;
      L.chases.push({ trigX: x + 140, spawnX: x - 380, endX: x + run, type, count: type === 'hound' && d > 0.3 ? 2 : 1 });
      for (let i = 1; i <= 3; i++) L.decor.push({ type: 'rock', x: x + i * run / 4, groundY: gy });
      x += run;
      endSeg(x);
      x += gapW;
      jumpTo(x);
      x += 80;
    },

    /* PUSU — geçerken telsiz çatırdar, sağdan bir tim koşarak gelir; siper al */
    ambush() {
      const w = 760 + rng() * 200;
      L.cars.push({ x: x + 180, groundY: gy, kind: rng() < 0.5 ? 'truck' : 'sedan', burnt: true });
      L.cars.push({ x: x + w - 220, groundY: gy, kind: 'sedan', burnt: rng() < 0.6 });
      L.ambushes.push({ trigX: x + 260, fromX: x + w + 420, n: d > 0.5 ? 3 : 2, minX: x + 120, maxX: x + w + 200 });
      x += w;
    },

    carDrive() {
      // bariyer tarlası — anahtar devriyedeki askerin bileğinde
      const sx = x + 260;
      L.soldiers.push({ x: sx, patrolMinX: sx - 110, patrolMaxX: sx + 130, facing: -1, hasCarKey: true });
      L.cars.push({ x: x + 90, groundY: gy, kind: 'sedan', burnt: true });
      const carX = x + 480;
      const fieldW = 520;
      L.driveCar = { x: carX, groundY: gy, travelTo: carX + fieldW + 200 };
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

  const H = {
    L, C, rng, d, A, n,
    getX: () => x, setX: (v) => { x = v; }, endSeg, jumpTo, getGy: () => gy,
    stash, pickCreature, creatureStats,
  };
  addBuildingChunks(C, H);
  addPuzzleChunks(C, H);
  addHouseChunks(C, H);
  const mission = MISSIONS[n];
  const bld = buildingFor(n);
  if (bld) {
    buildInteriorLevel(H, bld, bld.levels.indexOf(n) + 1);
  } else if (mission) {
    buildMissionLevel(mission, H);
    if (L._x) x = L._x;
    if (L.vehicle) L.companion = false;
  } else {
    /* perde şablonundan parça dizilimi + bulmacalar. Her bölümde en az bir akıl
       oyunu; ilerleyen bölümlerde iki farklı bulmaca. */
    const targetW = 3000 + n * 18 + rng() * 500;
    const seq = shuffleWith(rng, A.chunks.filter(c => !(c === 'house' && n < 5)));
    const pool = shuffleWith(rng, PUZZLE_POOLS[A.biome] ?? PUZZLE_POOLS.forest);
    const nPz = n < 12 ? 1 : 2;
    const puzzles = pool.slice(0, nPz);
    /* AKSİYON SAHNESİ: bölüm 2'den itibaren çöken köprü / kovalamaca / pusu */
    const pieces = (A.setPieces ?? []).filter(p => !(p === 'ambush' && n < 11));
    if (n >= 2 && pieces.length) {
      const pick = pieces[Math.floor(rng() * pieces.length)];
      seq.splice(1, 0, pick);
      if (d > 0.45 && pieces.length > 1 && rng() < 0.5) seq.splice(seq.length - 1, 0, pieces[(pieces.indexOf(pick) + 1) % pieces.length]);
    }
    seq.splice(Math.min(2, seq.length), 0, puzzles[0]);
    if (puzzles[1]) seq.splice(Math.min(seq.length - 1, 6), 0, puzzles[1]);
    let si = 0;
    const must = new Set(puzzles);
    while (x < targetW || must.size) {
      let chunk = seq[si % seq.length];
      si++;
      if ((chunk === 'soldierPost' || chunk === 'sentryGate') && n < 11) chunk = 'flat';   // perde 1'de asker yok
      if (si > seq.length && must.size && !must.has(chunk)) continue;                    // hedef doldu, kalan bulmacayı koy
      C[chunk]?.();
      must.delete(chunk);
      if (rng() < 0.55) C.flat(180 + rng() * 200);
      L.checkpoints.push(x - 30);
      if (si > seq.length * 3) break;
    }
  }

  /* bölüm 1: uyandığın yerde Maria'nın atkısı — sözsüz anlatım */
  if (n === 1) L.scarfAt = { x: 230, groundY: 600 };

  /* bölüm 17: ölü askerin yanında tabanca */
  if (n === 17) {
    L.decor.push({ type: 'deadSoldier', x: 480, groundY: 600 });
    L.looseItems.push({ kind: 'pistol', x: 510, y: 560 });
    stash('backpack', 548, 600, ['mag']);
  }

  C.flat(L.endCine ? 900 : 420);   // çıkış düzlüğü (sinematikli bölümde sahne payı)
  const worldW = x + 160;
  endSeg(worldW + 100);
  L.worldW = worldW;
  L.exitX = L.endCine ? worldW - 640 : worldW - 90;
  if (L.bomb) L.exitX = worldW + 9999;                  // bomba bölümü: bitiş = bombayı sökmek

  /* ---- GANİMET DAĞITIMI ----
     Bandaj yalnız tıbbi saklama yerlerine (çekmece, dolap, ilk yardım, çanta, sandık...).
     Pil / şarjör alet çantasına, kovuğa, torpidoya, dolaba, kutuya. Yetmezse bölüme
     uygun yeni saklama yerleri açılır. Bazı yerler boş kalır. */
  distributeLoot(L, { rng, d, n, gunEra, worldW, stash, biome: A.biome });

  /* ---- sinematikli bölümde son 600px temiz ---- */
  if (L.endCine) {
    L.soldiers = L.soldiers.filter(s => s.x < worldW - 700);
    L.creatures = L.creatures.filter(c => c.patrolMaxX < worldW - 700);
  }

  /* ---- dekor serpiştirme (açık hava) ---- */
  if (!L.noDecor) {
    for (const seg of L.ground) {
      if (seg.y > 640) continue;
      let dx0 = Math.max(seg.x0 + 60, 60);
      while (dx0 < seg.x1 - 80) {
        const inBld = (L.buildings ?? []).some(b => dx0 > b.x0 - 40 && dx0 < b.x1 + 40);
        if (!inBld && rng() < 0.42) {
          const t = A.decor[Math.floor(rng() * A.decor.length)];
          L.decor.push({ type: t, x: dx0, groundY: seg.y });
        }
        dx0 += 170 + rng() * 260;
      }
    }
  }

  /* ---- ışık hüzmeleri (açık hava) ---- */
  if (L.dark < 0.5 && !L.interior) {
    const nSh = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < nSh; i++) {
      L.shafts.push({ x: 300 + rng() * (worldW - 600), y: 0, scale: 1.2 + rng() * 0.8, alpha: 0.3 + rng() * 0.2 });
    }
  }

  /* ---- öğretici ipuçları (hikâye satırı yok — yalnız kontrol anlatımı) ---- */
  if (n === 2) L.triggers.push({ x: 300, text: UI_HINT('edge'), icon: '⚠' });
  if (n === 3) L.triggers.push({ x: 300, text: UI_HINT('ledge'), icon: '✋' });
  if (n === 5) L.triggers.push({ x: 300, text: UI_HINT('stairs'), icon: '⟋' });
  if (n === 13) L.triggers.push({ x: 350, text: UI_HINT('flash'), icon: '✦' });
  if (n === 17) L.triggers.push({ x: 560, text: UI_HINT('fire'), icon: '◎' });
  if ((n === 11 || n === 41) && L._hasSentry) L.triggers.push({ x: 300, text: UI_HINT('stealth'), icon: '◐' });
  if (L.dark >= 0.85 && n % 10 === 1) L.triggers.push({ x: 320, text: UI_HINT('dark'), icon: '✦' });
  if (L.creatures.some(c => c.type === 'wraith') && !L.triggers.some(t => t.icon === '◌') && n <= 25) {
    const w0 = L.creatures.find(c => c.type === 'wraith');
    L.triggers.push({ x: w0.patrolMinX - 200, text: UI_HINT('wraith'), icon: '◌' });
  }
  if (L.creatures.some(c => c.type === 'crawler') && n <= 8) {
    const c0 = L.creatures.find(c => c.type === 'crawler');
    L.triggers.push({ x: c0.patrolMinX - 160, text: UI_HINT('crawler'), icon: '≋' });
  }

  L.checkpoints = [...new Set(L.checkpoints)].sort((a, b) => a - b);
  return L;
}

/* ganimet kuyruğu → saklama yerleri / kutular */
function distributeLoot(L, o) {
  const { rng, d, n, gunEra, worldW, stash, biome } = o;
  const med = [], gear = [];
  med.push('bandage', 'bandage');
  if (rng() < 0.4 + d * 0.2) med.push('bandage');
  const darkLevel = L.dark > 0.45;
  const needBat = n >= 13 && (L.dark > 0.2 || L.blackouts) ? (L.dark > 0.6 ? 3 : 2) : (darkLevel ? 2 : 0);
  for (let i = 0; i < needBat; i++) gear.push('battery');
  if (!needBat && rng() < 0.5) gear.push('battery');
  if (gunEra) { gear.push('mag', 'mag'); if (rng() < 0.5) gear.push('mag'); }

  const shuffle = (a) => shuffleWith(rng, a);
  const isMed = (c) => CONTAINER_DEFS[c.kind]?.med;
  const open = shuffle(L.containers.filter(c => !c.fixed));
  const safeSpot = (i, k) => {
    const safe = L.ground.filter(s => s.y <= 620 && (s.x1 - s.x0) > 200 && s.x0 > 240 && s.x1 < worldW - 240
      && !(L.buildings ?? []).some(b => s.x0 < b.x1 && s.x1 > b.x0 && !b.interior));
    const seg = safe.length ? safe[Math.min(safe.length - 1, Math.floor(((i + 0.5) / k) * safe.length))] : null;
    return seg ? { x: seg.x0 + 90 + (seg.x1 - seg.x0 - 180) * rng(), y: seg.y } : { x: worldW * (0.25 + 0.5 * rng()), y: 600 };
  };
  const extraKinds = L.interior ? null : STASH_KINDS[biome];
  /* bandajlar */
  let mi = 0;
  for (const b of med) {
    const target = open.filter(isMed).sort((a, c) => a.contents.length - c.contents.length)[0];
    if (target && target.contents.length < 2) target.contents.push(b);
    else {
      const p = safeSpot(mi++, med.length);
      const k = L.interior ? 'medkit' : (['mine', 'factory', 'fortress', 'city'].includes(biome) ? 'medkit' : 'backpack');
      stash(k, p.x, p.y, [b]);
    }
  }
  /* pil + şarjör: saklama yerleri ve kutular */
  const bins = shuffle([...open.filter(c => c.contents.length < 2), ...L.crates.filter(c => !c.fixed)]);
  let gi = 0;
  for (const it of gear) {
    const target = bins.filter(c => c.contents.length < 2).sort((a, c) => a.contents.length - c.contents.length)[0];
    if (target && rng() < 0.85) target.contents.push(it);
    else {
      const p = safeSpot(gi++, gear.length);
      const pool = extraKinds ?? ['locker', 'toolbox'];
      stash(pool[Math.floor(rng() * pool.length)], p.x, p.y, [it]);
    }
  }
  /* kutular boş kalmasın (kırılan kutu bir şey versin) */
  for (const c of L.crates) if (!c.contents.length) c.contents.push(rng() < 0.6 ? 'can' : (gunEra && rng() < 0.4 ? 'mag' : 'stone'));
}

/* ============ BOMBA BÖLÜMÜ (87) ============
   Kale kulesinin tek çıkışı bomba tuzaklı bir kapı. Süre işliyor.
   Yol: nöbetçi kapısı → ölü asker (TALİMAT) → yükseltide PENSE →
   devriye noktası → bomba odası. Süre dolarsa her şey biter. */
function buildBombLevel(L, C, rng, getX, setX, getGy) {
  L.bombTime = 225;              // saniye
  L.blackouts = false;
  L.companion = false;
  C.flat(420);
  C.sentryGate();
  let x = getX();
  // ölü asker + talimat kâğıdı
  L.decor.push({ type: 'deadSoldier', x: x + 120, groundY: 600 });
  L.looseItems.push({ kind: 'manual', x: x + 160, y: 560 });
  C.flat(380);
  // yükselti — pense üstte
  const x0 = getX();
  C.climb();
  const plateau = L.ground.find(g => Math.abs(g.x0 - (x0 + 260)) < 2);
  const py = plateau ? plateau.y : 480;
  L.looseItems.push({ kind: 'cutters', x: x0 + 260 + 170, y: py - 40 });
  L.decor.push({ type: 'crateOpen', x: x0 + 260 + 140, groundY: py });
  C.flat(260);
  C.soldierPost();
  C.flat(240);
  x = getX();
  // bomba odası
  L.decor.push({ type: 'shell', x0: x + 20, x1: x + 760, groundY: 600, roofY: 360 });
  L.decor.push({ type: 'lampInt2', x: x + 420, y: 420, flicker: true });
  L.bomb = { x: x + 470, groundY: 600 };
  L.triggers.push({ x: x + 240, text: 'Bombayı sökmek için PENSE ve TALİMAT gerekli. Kırmızı kabloya dokunma.', icon: '⏱' });
  C.flat(900);
  L._x = getX();
  L.checkpoints.push(L.bomb.x - 300);
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
      case 'scarf': {
        // Maria'nın atkısı — yere düşmüş, ucu rüzgârda kıvrık; tek açık tonlu nesne
        const x = d.x, y = d.groundY;
        g.fillStyle(0x6a2e2e, 0.95);
        g.beginPath();
        g.moveTo(x - 18, y - 1); g.lineTo(x - 4, y - 4); g.lineTo(x + 10, y - 2); g.lineTo(x + 22, y - 6);
        g.lineTo(x + 26, y - 3); g.lineTo(x + 12, y + 1); g.lineTo(x - 2, y); g.lineTo(x - 16, y + 2);
        g.closePath(); g.fillPath();
        g.fillStyle(0x4a1f20, 1);
        g.fillRect(x + 22, y - 6, 2, 5); g.fillRect(x + 25, y - 5, 2, 4);
        break;
      }
      case 'crateOpen': {
        // kapağı açık takım çantası
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 22, y - 18, 44, 18);
        g.beginPath(); g.moveTo(x - 22, y - 18); g.lineTo(x - 30, y - 36); g.lineTo(x - 26, y - 38); g.lineTo(x - 18, y - 18); g.closePath(); g.fillPath();
        g.fillRect(x - 6, y - 23, 12, 5);
        break;
      }
      case 'shell': {
        // yapı kabuğu: iç arka duvar + (evde) çatı. Tema duvar dokusunu belirler.
        const x0 = d.x0, x1 = d.x1, y = d.groundY, ry = d.roofY;
        const th = d.theme ?? 'house';
        const wall = { hospital: 0x171a1d, foundry: 0x141312, plant: 0x13161a, mineworks: 0x121214, barracks: 0x151618, temple: 0x16151a }[th] ?? 0x14151c;
        g.fillStyle(wall, 1);
        g.fillRect(x0, ry + 4, x1 - x0, y - ry - 4);   // iç arka duvar
        g.lineStyle(1, 0x1d1e26, 0.7);
        if (th === 'hospital' || th === 'plant') {
          /* fayans: alt yarıda kare ızgara, üstte sıva */
          const ty = y - 150;
          for (let wx = x0 + 10; wx < x1; wx += 28) { g.beginPath(); g.moveTo(wx, ty); g.lineTo(wx, y - 4); g.strokePath(); }
          for (let wy = ty; wy < y; wy += 28) { g.beginPath(); g.moveTo(x0, wy); g.lineTo(x1, wy); g.strokePath(); }
        } else if (th === 'foundry' || th === 'mineworks' || th === 'barracks' || th === 'temple') {
          /* tuğla / taş örgü */
          for (let wy = ry + 20, row = 0; wy < y; wy += 22, row++) {
            g.beginPath(); g.moveTo(x0, wy); g.lineTo(x1, wy); g.strokePath();
            for (let wx = x0 + (row % 2) * 30; wx < x1; wx += 60) { g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx, wy + 22); g.strokePath(); }
          }
        } else {
          for (let wx = x0 + 30; wx < x1 - 20; wx += 46) { g.beginPath(); g.moveTo(wx, ry + 10); g.lineTo(wx, y - 6); g.strokePath(); }
        }
        /* kat döşemelerinin arkasında süpürgelik çizgisi */
        for (const fy of (d.floors ?? [])) { g.fillStyle(0x0d0e13, 1); g.fillRect(x0, fy - 8, x1 - x0, 8); }
        g.fillStyle(c, 1);
        g.fillRect(x0 - 14, ry - 10, x1 - x0 + 28, 16); // tavan
        if (!d.flat) {
          g.beginPath();                                 // çatı üçgeni
          g.moveTo(x0 - 30, ry - 4);
          g.lineTo((x0 + x1) / 2, ry - 88 - (x1 - x0) * 0.04);
          g.lineTo(x1 + 30, ry - 4);
          g.closePath(); g.fillPath();
          g.fillRect(x0 + (x1 - x0) * 0.72, ry - 110, 26, 70);   // baca
        }
        break;
      }
      case 'bed': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 60, y - 30, 120, 14);
        g.fillRect(x - 60, y - 56, 8, 56); g.fillRect(x + 52, y - 40, 8, 40);
        g.fillRoundedRect(x - 50, y - 40, 30, 12, 5);                 // yastık
        g.fillRect(x - 56, y - 16, 6, 16); g.fillRect(x + 50, y - 16, 6, 16);
        break;
      }
      case 'curtain': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 46, y - 190, 92, 4);
        g.lineStyle(10, c, 0.9);
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - 38 + i * 24, y - 186); qTo(g, x - 38 + i * 24, y - 186, x - 44 + i * 24, y - 100, x - 34 + i * 24, y - 30); g.strokePath(); }
        break;
      }
      case 'clock': {
        const x = d.x, y = d.groundY;
        g.fillStyle(c, 1);
        g.fillRect(x - 14, y - 150, 28, 150);
        g.fillCircle(x, y - 150, 18);
        g.lineStyle(1.5, 0x2a2a32, 1); g.strokeCircle(x, y - 150, 13);
        g.beginPath(); g.moveTo(x, y - 150); g.lineTo(x + 6, y - 156); g.moveTo(x, y - 150); g.lineTo(x, y - 160); g.strokePath();
        break;
      }
      case 'antlers': {
        const x = d.x, y = d.groundY - 170;
        g.fillStyle(c, 1); g.fillEllipse(x, y, 16, 20);
        g.lineStyle(3, c, 1);
        for (const sd of [-1, 1]) {
          g.beginPath(); g.moveTo(x + sd * 4, y - 6); g.lineTo(x + sd * 22, y - 30); g.lineTo(x + sd * 30, y - 52); g.strokePath();
          g.beginPath(); g.moveTo(x + sd * 16, y - 22); g.lineTo(x + sd * 30, y - 26); g.strokePath();
          g.beginPath(); g.moveTo(x + sd * 24, y - 36); g.lineTo(x + sd * 16, y - 50); g.strokePath();
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
