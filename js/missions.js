/* ============================================================
   SHADOW FALL — GÖREVLER (özel bölümler + bulmaca yapıları)
   Her 2-4 bölümde bir farklı oynanış gelir:
   tutorial · fire (yangından kaçış) · flood (su baskını) ·
   colossus (8 kollu devden kaçış) · boat / car (araçla kaçış) ·
   shop / factory (içeri girip çıkmak için akıl oyunu) · bomb (süreli kapı) ·
   elevator / train / echo (asansör, tren, karanlıkta yankı — bkz. escapes.js).
   Bu dosya hem bölüm yerleşimini (levelgen çağırır) hem de
   çalışma anı mantığını (GameScene çağırır) içerir.
   ============================================================ */
'use strict';

const MISSIONS = {
  1: 'tutorial', 4: 'house', 6: 'fire',
  12: 'shop', 14: 'train', 15: 'car', 18: 'factory',
  23: 'boat', 26: 'colossus', 28: 'shop',
  33: 'flood', 34: 'elevator', 36: 'fire', 37: 'echo', 38: 'factory',
  42: 'elevator', 43: 'flood', 47: 'fire', 49: 'elevator',
  52: 'boat', 53: 'train', 55: 'car', 58: 'colossus',
  62: 'shop', 66: 'car', 67: 'fire', 68: 'flood',
  71: 'train', 72: 'factory', 75: 'flood', 77: 'car', 79: 'elevator',
  83: 'fire', 84: 'echo', 85: 'colossus', 87: 'bomb',
  92: 'boat', 94: 'colossus', 98: 'echo',
};
const MISSION_TITLES = {
  tutorial: 'YARIĞIN DİBİ', house: 'KİLİTLİ EV', fire: 'YANGIN', flood: 'SU BASKINI',
  colossus: 'SEKİZ KOL', boat: 'NEHİR KAÇIŞI', car: 'YOL KAÇIŞI', shop: 'KAPALI DÜKKÂN',
  factory: 'MAKİNE DAİRESİ', bomb: 'SAAT İŞLİYOR',
  elevator: 'ASANSÖR BOŞLUĞU', train: 'SON TREN', echo: 'KÖR DEHLİZ',
};

/* ============================================================
   YERLEŞİM — genLevel içinden çağrılır.
   H: { L, C, rng, d, A, n, getX, setX, endSeg, jumpTo, getGy, takeLoot }
   ============================================================ */
function buildMissionLevel(kind, H) {
  const { L, C, rng } = H;
  L.mission = kind;
  L.sub = MISSION_TITLES[kind] ?? L.sub;
  const gy0 = H.getGy();
  switch (kind) {
    case 'bomb': buildBombLevel(L, C, rng, H.getX, H.setX, H.getGy); return;
    case 'elevator':
    case 'train':
    case 'echo': buildEscapeLevel(kind, H); return;

    case 'tutorial': {
      /* ÖĞRETİCİ — her istasyon bir şey öğretir, sonunda gerçek aksiyon */
      L.tutorial = [];
      const step = (key, w) => { L.tutorial.push({ x: H.getX() - 40, key }); if (w) C.flat(w); };
      step('move', 520);
      // devrilmiş kütük — zıpla
      let x = H.getX();
      L.walls.push({ x: x + 40, y0: gy0 - 34, y1: gy0, look: 'log' });
      L.tutorial.push({ x: x - 160, key: 'jump' });
      C.flat(380);
      // alçak dal — eğil
      x = H.getX();
      L.platforms.push({ x: x + 60, y: gy0 - 236, w: 170, thick: 190, material: 'wood', look: 'branch' });
      L.tutorial.push({ x: x - 120, key: 'crouch' });
      C.flat(420);
      // terk edilmiş çanta — eşya almayı öğretir (levye 3. bölümde bir arabanın bagajında)
      x = H.getX();
      H.stash('backpack', x + 80, gy0, ['battery', 'bandage']);
      L.tutorial.push({ x: x - 100, key: 'act' });
      C.flat(440);
      // itilecek kutu — yükseltiye tırman
      L.tutorial.push({ x: H.getX() - 40, key: 'push' });
      C.climb();
      C.flat(260);
      L.tutorial.push({ x: H.getX() - 120, key: 'flash' });
      C.flat(420);
      // gerçek tehlike: çöken köprü + arkadan gelen yaratık
      L.tutorial.push({ x: H.getX() - 60, key: 'run' });
      C.collapse(true);
      C.flat(300);
      C.chase();
      C.flat(260);
      break;
    }

    case 'house':
      C.house(); C.flat(260); C.leverLadder(); C.flat(200); C.chase(); C.flat(200); C.house();
      break;

    case 'fire': {
      /* YANGIN — yıldırım arkandaki ağaca düşer (iç mekânda pano patlar), alev ağaçtan
         otlara, ottan ağaca yayılır. Rüzgâr sağa: kaç. Kirişlerin altından kay, devrilen
         gövdelerden atla. Bölümün sonundaki dereye varınca yangın orada durur. */
      const indoor = ['mine', 'factory'].includes(H.A.biome);
      const trees = [];
      const tree = (tx) => trees.push({ x: tx, groundY: H.getGy(), h: indoor ? 70 : 150 + rng() * 70 });
      C.flat(640);
      tree(300);
      L.fire = { triggerX: 560, strikeX: 300, indoor, trees };
      const grove = (w) => { const x0 = H.getX(); for (let tx = x0 + 60; tx < x0 + w - 40; tx += 130 + rng() * 120) tree(tx); C.flat(w); };
      grove(420);
      C.gap(); grove(380);
      let x = H.getX();
      L.platforms.push({ x: x + 120, y: gy0 - 160, w: 110, thick: 114, material: 'wood', look: 'beam', burning: true });
      L.triggers.push({ x: x - 40, text: UI_HINT('crouch'), icon: '⤓' });
      grove(460);
      C.collapse(true); grove(320);
      C.gap(); grove(420);
      x = H.getX();
      L.platforms.push({ x: x + 100, y: gy0 - 160, w: 110, thick: 114, material: 'wood', look: 'beam', burning: true });
      grove(420);
      C.spikes(); grove(380);
      C.gap(); grove(360);
      /* dere: ıslak zemin, yangın burada durur */
      L.fire.endX = H.getX() - 40;
      const sx = H.getX();
      H.endSeg(sx);
      L.ground.push({ x0: sx - 6, x1: sx + 180, y: gy0 + 40, material: 'earth' });
      L.water.push({ x0: sx, x1: sx + 174, surfaceY: gy0 + 14, bottomY: gy0 + 40 });
      H.setX(sx + 174); H.jumpTo(H.getX());
      L.decor.push({ type: 'reed', x: sx + 40, groundY: gy0 + 14 });
      L.decor.push({ type: 'reed', x: sx + 230, groundY: gy0 });
      C.flat(520);
      break;
    }

    case 'flood': {
      /* SU BASKINI — kilitli koridor, patlayan borular, yükselen su.
         Ortadaki kolu çek → çıkış kapağı açılır → bacadan yukarı tırman. */
      C.flat(300);
      let x = H.getX();
      const corrX0 = x, corrX1 = x + 1300;
      const ceilY = gy0 - 150;
      L.decor.push({ type: 'shell', x0: corrX0 - 10, x1: corrX1 + 10, groundY: gy0, roofY: ceilY - 30 });
      L.platforms.push({ x: corrX0, y: ceilY - 170, w: corrX1 - corrX0, thick: 170, material: 'metal', ceiling: true });
      for (let i = 0; i < 4; i++) L.decor.push({ type: 'lampInt2', x: corrX0 + 200 + i * 300, y: ceilY + 10, flicker: true });
      L.slamDoor = { x: corrX0 + 30, y0: ceilY, y1: gy0 };
      L.flood = {
        triggerX: corrX0 + 160, x0: corrX0 - 40, x1: corrX1 + 900,
        startY: gy0 + 40, rate: 4.6, topY: 150, pipes: [],
      };
      for (let i = 0; i < 5; i++) L.flood.pipes.push({ x: corrX0 + 260 + i * 230, y: ceilY + 2 });
      // kol → çıkış kapağı
      L.levers.push({ x: corrX0 + 720, groundY: gy0, id: 'lev_flood' });
      L.poweredDoors.push({ x: corrX1, y: gy0, h: 152, id: 'pd_flood' });
      L.leverLinks.lev_flood = { door: 'pd_flood' };
      H.stash('medkit', corrX0 + 480, gy0, ['bandage']);
      L.triggers.push({ x: corrX0 + 620, text: 'Su yükselmeden kolu bul ve çek: çıkış kapağı açılır.', icon: '⇣' });
      H.setX(corrX1 + 20);
      // baca: basamak platformlarla yukarı
      x = H.getX();
      const steps = [[60, gy0 - 90], [210, gy0 - 175], [70, gy0 - 260], [220, gy0 - 345], [80, gy0 - 430]];
      for (const [dx, y] of steps) L.platforms.push({ x: x + dx, y, w: 120, material: 'metal' });
      L.walls.push({ x: x + 360, y0: gy0 - 410, y1: gy0 + 2 });
      H.setX(x + 360);
      H.endSeg(H.getX());
      H.jumpTo(H.getX(), gy0 - 430);
      C.flat(520);
      break;
    }

    case 'colossus': {
      /* SEKİZ KOLLU DEV — arkadan yeri sarsarak gelir; kollarıyla önüne vurur */
      C.flat(640);
      L.colossus = { triggerX: 520, speed: 168, catchUp: 260 };
      C.gap(); C.flat(380); C.collapse(true); C.flat(300);
      C.spikes(); C.flat(420); C.gap(); C.flat(340);
      C.collapse(); C.flat(380); C.gap(); C.flat(300);
      L.colossus.endX = H.getX() + 20;
      // son uçurum — dev buradan geçemez
      H.endSeg(H.getX());
      H.setX(H.getX() + 136);
      H.jumpTo(H.getX());
      C.flat(600);
      break;
    }

    case 'boat':
    case 'car': {
      /* ARAÇLA KAÇIŞ — gaz/fren kaydırarak, eğil = siper, düşmana dokun = ateş */
      const boat = kind === 'boat';
      C.flat(380);
      const x0 = H.getX();
      const len = 3600 + H.d * 1200;
      const V = L.vehicle = { kind, x: x0 - 140, startX: x0 - 140, endX: x0 + len, obstacles: [], pursuers: boat ? 1 : 1, groundY: gy0 };
      if (boat) {
        H.endSeg(x0);
        L.ground.push({ x0: x0 - 6, x1: x0 + len + 6, y: gy0 + 220, material: 'earth' });
        L.water.push({ x0, x1: x0 + len, surfaceY: gy0 + 18, bottomY: gy0 + 220 });
        V.surfaceY = gy0 + 18;
        for (let ox = x0 + 600; ox < x0 + len - 300; ox += 380 + H.rng() * 260) {
          const r = H.rng();
          V.obstacles.push(r < 0.45 ? { type: 'mine', x: ox, phase: H.rng() * 6 } : r < 0.75 ? { type: 'bridge', x: ox } : { type: 'rocks', x: ox });
        }
        H.setX(x0 + len);
        H.jumpTo(H.getX());
      } else {
        V.surfaceY = gy0;
        for (let ox = x0 + 600; ox < x0 + len - 300; ox += 360 + H.rng() * 300) {
          const r = H.rng();
          if (r < 0.32) V.obstacles.push({ type: 'barricade', x: ox });
          else if (r < 0.62) {
            // rampa + çukur: hızlı geçmezsen düşersin
            V.obstacles.push({ type: 'ramp', x: ox });
            H.setX(ox + 60); H.endSeg(H.getX());
            H.setX(ox + 60 + 150); H.jumpTo(H.getX());
            V.obstacles.push({ type: 'pit', x: ox + 60, w: 150 });
            ox += 210;
          } else if (r < 0.82) V.obstacles.push({ type: 'spikes', x: ox });
          else V.obstacles.push({ type: 'pipe', x: ox });       // alçak boru: eğil
        }
        H.setX(x0 + len);
      }
      L.triggers.push({ x: x0 - 260, text: boat ? 'Tekneye bin ve kaç.' : 'Arabaya bin ve kaç.', icon: '»' });
      C.flat(520);
      break;
    }

    case 'shop':
      C.flat(260); C.shop(); C.flat(300); C.chase(); C.flat(300); C.shop();
      break;

    case 'factory':
      C.flat(260); C.factoryLock(); C.flat(300); C.ambush(); C.flat(260); C.factoryLock();
      break;
  }
}

/* ---------------- yapı parçaları (levelgen C nesnesine eklenir) ---------------- */
function addBuildingChunks(C, H) {
  const { L, rng } = H;

  /* DÜKKÂN: kepenk kapalı. Yandaki kutudan SİGORTA çıkar → sigorta kutusuna tak →
     kepenk açılır. İçeride arka kapı ŞİFRELİ: 4 hane, dükkânın içine dağılmış
     notlarda yazıyor. Notları oku, şifreyi gir. */
  C.shop = () => {
    const gy = H.getGy();
    const x = H.getX();
    const w = 780;
    const id = 'shop' + (L._shopN = (L._shopN ?? 0) + 1);
    const roofY = gy - 250;
    const code = [0, 0, 0, 0].map(() => Math.floor(rng() * 10));
    H.stash('toolbox', x - 60, gy, ['fuse']);
    L.fuseBoxes = L.fuseBoxes ?? [];
    L.fuseBoxes.push({ x: x + 6, groundY: gy, door: 'pd_' + id });
    L.decor.push({ type: 'shell', x0: x + 30, x1: x + w, groundY: gy, roofY });
    L.decor.push({ type: 'shopSign', x: x + w / 2, y: roofY - 30 });
    L.walls.push({ x: x + 40, y0: roofY - 10, y1: gy - 148 });
    L.poweredDoors.push({ x: x + 40, y: gy, h: 150, id: 'pd_' + id, shutter: true });
    L.decor.push({ type: 'shelf', x: x + 210, groundY: gy });
    L.decor.push({ type: 'shelf', x: x + 520, groundY: gy });
    L.decor.push({ type: 'table', x: x + 380, groundY: gy });
    L.decor.push({ type: 'lampInt2', x: x + w * 0.5, y: roofY + 50, flicker: true });
    L.platforms.push({ x: x + 440, y: gy - 130, w: 170, material: 'wood' });
    L.pushboxes.push({ x: x + 330, groundY: gy, w: 60, h: 60 });
    // şifre notları: biri dışarıda, biri rafın üstünde (platform), biri kutuda, biri duvarda
    L.notes = L.notes ?? [];
    const nx = [x - 160, x + 520, x + 260, x + 650];
    const ny = [gy - 20, gy - 150, null, gy - 70];
    for (let i = 0; i < 4; i++) {
      if (i === 2) H.stash('drawer', nx[i], gy, ['note:' + id + ':' + i]);
      else L.notes.push({ x: nx[i], y: ny[i], lock: id, idx: i });
    }
    L.keypads = L.keypads ?? [];
    L.keypads.push({ x: x + w - 26, groundY: gy, door: 'kp_' + id, code, lock: id });
    L.walls.push({ x: x + w, y0: roofY - 10, y1: gy - 148 });
    L.poweredDoors.push({ x: x + w, y: gy, h: 150, id: 'kp_' + id });
    L.triggers.push({ x: x - 120, text: 'Kepenk kilitli. Sigorta kutusu boş.', icon: '⚡' });
    H.setX(x + w + 110);
  };

  /* FABRİKA KİLİDİ: büyük demir kapı. BAŞLAT kolunu çek → üstteki 3 lamba bir
     sıra yakar. Aynı sırayla I-II-III kollarını çek. Yanlışta buhar çarpar. */
  C.factoryLock = () => {
    const gy = H.getGy();
    const x = H.getX();
    const w = 760;
    const id = 'fac' + (L._facN = (L._facN ?? 0) + 1);
    const roofY = gy - 270;
    L.decor.push({ type: 'shell', x0: x, x1: x + w, groundY: gy, roofY });
    L.decor.push({ type: 'pipe', x: x + 90, groundY: gy });
    L.decor.push({ type: 'gear', x: x + 640, groundY: gy });
    L.decor.push({ type: 'lampInt2', x: x + 200, y: roofY + 50, flicker: false });
    const seqLen = 3 + (H.d > 0.4 ? 1 : 0) + (H.d > 0.75 ? 1 : 0);
    const seq = [];
    for (let i = 0; i < seqLen; i++) seq.push(Math.floor(rng() * 3));
    L.simons = L.simons ?? [];
    L.simons.push({
      id, startX: x + 170, levers: [x + 340, x + 430, x + 520], lampY: gy - 190,
      groundY: gy, seq, door: 'pd_' + id,
    });
    L.walls.push({ x: x + w - 30, y0: roofY - 10, y1: gy - 168 });
    L.poweredDoors.push({ x: x + w - 30, y: gy, h: 170, id: 'pd_' + id });
    L.triggers.push({ x: x + 60, text: 'Panoyu çalıştır, lambaların yanma sırasını izle, kolları aynı sırayla çek.', icon: '☰' });
    H.setX(x + w + 80);
  };
}

/* ============================================================
   ÇALIŞMA ANI — GameScene bu fonksiyonları çağırır
   ============================================================ */
const Missions = {
  setup(sc) {
    const ch = sc.ch;
    sc.mis = { t: 0 };
    const M = sc.mis;
    M.collapses = (ch.collapses ?? []).map(c => this._buildCollapse(sc, c));
    M.chases = (ch.chases ?? []).map(c => ({ ...c, fired: false, done: false, crs: [] }));
    M.ambushes = (ch.ambushes ?? []).map(a => ({ ...a, fired: false }));
    M.codeKnown = {};
    M.notes = (ch.notes ?? []).map(n => this._buildNote(sc, n));
    M.fuseBoxes = (ch.fuseBoxes ?? []).map(f => this._buildFuseBox(sc, f));
    M.keypads = (ch.keypads ?? []).map(k => ({ ...k, solved: false, gfx: this._drawKeypad(sc, k) }));
    M.simons = (ch.simons ?? []).map(s => this._buildSimon(sc, s));
    if (ch.slamDoor) M.slam = { ...ch.slamDoor, done: false };
    if (ch.fire) this._setupFire(sc, ch.fire);
    if (ch.flood) this._setupFlood(sc, ch.flood);
    if (ch.colossus) M.colossus = { ...ch.colossus, active: false, obj: null };
    if (ch.vehicle) M.vehicle = new Vehicle(sc, ch.vehicle);
    if (ch.bomb) this._setupBomb(sc, ch);
    if (ch.tutorial) M.tutorial = { steps: ch.tutorial.map(s => ({ ...s, done: false })), cur: null, holdT: 0 };
    Escapes.setup(sc);
  },

  /* ---------------- ÇÖKEN KÖPRÜ ---------------- */
  _buildCollapse(sc, c) {
    const pieces = [];
    const post = sc.add.graphics().setDepth(71);
    post.fillStyle(0x0b0b10, 1);
    post.fillRect(c.x0 - 8, c.y - 40, 6, 44);
    post.fillRect(c.x0 + c.n * c.pw + 2, c.y - 40, 6, 44);
    post.lineStyle(1.5, 0x0b0b10, 1);
    post.beginPath(); post.moveTo(c.x0 - 5, c.y - 38);
    for (let i = 0; i <= c.n; i++) post.lineTo(c.x0 + i * c.pw, c.y - 30 + Math.sin(i / c.n * Math.PI) * 10);
    post.lineTo(c.x0 + c.n * c.pw + 5, c.y - 38); post.strokePath();
    for (let i = 0; i < c.n; i++) {
      const px = c.x0 + i * c.pw + c.pw / 2;
      /* sarkma yalnız görüntüde: fizikte tahtalar düz ve bitişik — aradaki 2 px boşluk ve
         1-3 px basamaklar oyuncuyu her ekte takıyordu (köprüde yerinde sayma) */
      const sag = Math.sin((i + 0.5) / c.n * Math.PI) * 3;
      const plat = { x: px - c.pw / 2, y: c.y, w: c.pw, thick: 10, material: 'wood', _collapse: true };
      sc.platforms.push(plat);
      const body = sc.matter.add.rectangle(px, c.y + 5, c.pw, 10, {
        isStatic: true, friction: 0.9, label: 'platform:wood',
        collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
      const g = sc.add.graphics().setDepth(72);
      g.fillStyle(0x0c0c11, 1);
      g.fillRect(-c.pw / 2 + 1, -5, c.pw - 4, 9);
      g.lineStyle(1, 0x1c1c24, 0.8);
      g.beginPath(); g.moveTo(-c.pw / 2 + 6, -1); g.lineTo(c.pw / 2 - 8, -1); g.strokePath();
      /* çökecek köprü belli olsun: tahtalar çatlak, aralarda boşluk */
      if (!c.stable) {
        g.lineStyle(1.2, 0x2a2a34, 0.9);
        const cx = ((i * 37) % 30) - 15;
        g.beginPath(); g.moveTo(cx - 6, -5); g.lineTo(cx, 0); g.lineTo(cx - 3, 4); g.strokePath();
        g.fillStyle(0x000000, 1); g.fillRect(c.pw / 2 - 6, -5, 3, 9);
      }
      g.setPosition(px, c.y + sag + 5);
      pieces.push({ body, g, plat, gone: false, home: { x: px, y: c.y + sag + 5 } });
    }
    return { ...c, pieces, fired: false, timers: [] };
  },
  _updateCollapse(sc, C, P) {
    if (C.stable) return;
    const px = P.body.position.x;
    if (!C.fired && px > C.x0 + 14 && px < C.x0 + C.n * C.pw && P.grounded) {
      C.fired = true;
      SFAudio.rumble?.(C.n * 0.32 + 1, 0.55);
      SFAudio.leverCreak?.();
      sc.cameras.main.shake(400, 0.004);
      C.pieces.forEach((pc, i) => {
        /* bir kez düştüysen köprü yavaş çöker: yürüyerek de geçilir */
        const delay = C.eased ? 900 + i * 760 : 520 + i * 270;
        sc.tweens.add({ targets: pc.g, x: pc.g.x + 2, duration: 50, yoyo: true, repeat: 3, delay: delay - 250 });
        C.timers.push(sc.time.delayedCall(delay, () => {
          pc.gone = true;
          sc.matter.world.remove(pc.body);
          const k = sc.platforms.indexOf(pc.plat); if (k >= 0) sc.platforms.splice(k, 1);
          SFAudio.thud(0.35);
          sc.tweens.add({ targets: pc.g, y: pc.g.y + 520, angle: (Math.random() - 0.5) * 140, alpha: 0, duration: 1300, ease: 'Quad.easeIn' });
        }));
      });
    }
  },
  /* düşüp köprünün gerisine geri konunca çöken köprü yeniden kurulur —
     yoksa boşluk zıplanamaz, oyuncu orada sıkışır */
  restoreCollapses(sc, safeX) {
    for (const C of (sc.mis?.collapses ?? [])) {
      if (!C.fired || safeX > C.x0 + C.n * C.pw) continue;
      C.timers.forEach(t => t.remove(false)); C.timers = [];
      for (const pc of C.pieces) {
        sc.tweens.killTweensOf(pc.g);
        pc.g.setPosition(pc.home.x, pc.home.y).setAngle(0).setAlpha(1);
        if (pc.gone) { sc.matter.world.add(pc.body); sc.platforms.push(pc.plat); pc.gone = false; }
      }
      C.fired = false; C.eased = true;
    }
  },

  /* ---------------- KOVALAMACA ---------------- */
  _updateChase(sc, C, P) {
    const px = P.body.position.x;
    if (!C.fired && px > C.trigX) {
      C.fired = true;
      const gy = sc.groundYAt(C.trigX);
      for (let i = 0; i < C.count; i++) {
        const sx = px - 560 - i * 110;
        const cr = spawnCreature(sc, {
          type: C.type, x: sx, groundY: gy, facing: 1, startChase: true,
          patrolMinX: sx - 300, patrolMaxX: C.endX - 18,
          scale: C.type === 'stalker' ? 1.2 : C.type === 'lurker' ? 1.3 : 1.0,
          hp: C.type === 'hound' ? 4 : 7, chaseSpeed: 206 - i * 8,
        });
        cr.onStrike = (dmg) => sc.damagePlayer(dmg ?? 2, 1);
        cr.chaser = true; cr.noNav = true;            // kurgulu kovalama: uçurumu atlayamaz
        sc.creatures.push(cr); C.crs.push(cr);
      }
      sc.scare(px - 400, 1.1);
    }
    if (C.fired && !C.done && px > C.endX + 60) {
      C.done = true;
      for (const cr of C.crs) {
        if (cr.dead) continue;
        cr.chaseSpeed = 0; cr.vx = 0;
        SFAudio.screech?.(0.6);
        sc.time.delayedCall(1800, () => {
          if (cr.dead) return;
          const g = cr.gfx ?? cr.rig?.gfx;
          sc.tweens.add({ targets: [g, cr.eyeGfx].filter(Boolean), alpha: 0, duration: 1600, onComplete: () => { cr.dead = true; cr.state = 'dead'; } });
        });
      }
    }
  },

  /* ---------------- PUSU ---------------- */
  _updateAmbush(sc, A, P) {
    if (A.fired || P.body.position.x < A.trigX) return;
    A.fired = true;
    SFAudio.radioChirp?.();
    for (let i = 0; i < A.n; i++) {
      const sx = A.fromX + i * 70;
      const sol = new Soldier(sc, { x: sx, groundY: sc.groundYAt(Math.min(sx, A.maxX)), patrolMinX: A.minX, patrolMaxX: A.maxX, facing: -1, hp: 2 });
      sol.onShoot = (x, y, dir, target) => sc.spawnBullet(x, y, dir, target);
      sol.lastSeenX = P.body.position.x;
      sc.soldiers.push(sol);
      sc.time.delayedCall(300 + i * 250, () => { sol.goAlert(true); if (i === 0) sol.bark('alert', true); });
    }
  },

  /* ---------------- YANGIN ----------------
     Gerçekçi yayılım: önce bir ağaca yıldırım düşer (iç mekânda: elektrik
     panosu kısa devre yapar). Alev ağacı sarar, dibindeki otlara iner, ot
     ot, ağaçtan ağaca yayılır. Rüzgâr sağa estiği için yangın kaçtığın yöne
     daha hızlı ilerler; rüzgârın taşıdığı közler arkanda yeni ocaklar açar.
     Yanan ağaç bir süre sonra devrilir. Islak zemine (dereye) varınca biter. */
  _setupFire(sc, F) {
    const M = sc.mis;
    const f = M.fire = { ...F, active: false, t: 0, hurtT: 0, over: false, cells: [], trees: [], spotT: 0 };
    const CS = 30;
    /* yakıt hücreleri: zemin ve platform yüzeyleri boyunca */
    const surf = [];
    for (const g of sc.groundSegs) if (g.y <= 640 && g.x1 > 0) surf.push({ x0: Math.max(0, g.x0), x1: g.x1, y: g.y });
    for (const p of sc.platforms) if (!p.ceiling && !p.burning && p.look !== 'beam' && !p._collapse) surf.push({ x0: p.x, x1: p.x + p.w, y: p.y });
    for (const s of surf) {
      const first = f.cells.length;
      for (let x = s.x0 + CS / 2; x < s.x1; x += CS) {
        if (f.endX && x > f.endX) break;
        f.cells.push({ x, y: s.y, st: 0, t: 0, life: 2.6 + Math.random() * 1.6, spread: false, n: [], tree: null });
      }
      for (let i = first + 1; i < f.cells.length; i++) { f.cells[i].n.push(i - 1); f.cells[i - 1].n.push(i); }
    }
    /* yüzeyler arası geçiş: yakın uçlar birbirini tutuşturur */
    const ends = f.cells.map((c, i) => ({ c, i })).filter(o => o.c.n.length < 2);
    for (const a of ends) for (const b of ends) {
      if (a.i === b.i) continue;
      if (Math.abs(a.c.x - b.c.x) < 46 && Math.abs(a.c.y - b.c.y) < 60 && !a.c.n.includes(b.i)) a.c.n.push(b.i);
    }
    /* ağaçlar (iç mekânda odun yığınları) — büyük, uzun yanan yakıt */
    const tg = sc.add.graphics().setDepth(62);
    for (const tr of (F.trees ?? [])) {
      const cell = f.cells.reduce((best, c, i) => (Math.abs(c.x - tr.x) < 20 && Math.abs(c.y - tr.groundY) < 6 && (best < 0 || Math.abs(c.x - tr.x) < Math.abs(f.cells[best].x - tr.x))) ? i : best, -1);
      const T = { ...tr, cell, burnT: 0, fallen: false, fallA: 0, fallDir: 1, anchors: [] };
      if (cell >= 0) { f.cells[cell].tree = T; f.cells[cell].life = 14 + Math.random() * 6; }
      this._drawFireTree(tg, T, F.indoor);
      f.trees.push(T);
    }
    f.treeG = sc.add.graphics().setDepth(63);
    f.charG = sc.add.graphics().setDepth(71);
    f.flameG = sc.add.graphics().setDepth(106).setBlendMode(Phaser.BlendModes.ADD);
    f.flames = sc.add.particles(0, 0, 'softDot', {
      lifespan: { min: 380, max: 900 }, speedY: { min: -150, max: -50 }, speedX: { min: -10, max: 70 },
      scale: { start: 0.9, end: 0.1 }, alpha: { start: 0.75, end: 0 },
      tint: [0xff8a2a, 0xffb04a, 0xe0461c, 0xffd070], blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(107);
    f.embers = sc.add.particles(0, 0, 'softDot', {
      lifespan: 2800, speedX: { min: 40, max: 150 }, speedY: { min: -90, max: -10 }, gravityY: 20,
      scale: { start: 0.08, end: 0 }, alpha: { start: 0.95, end: 0 }, tint: 0xffa040,
      blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(112);
    f.smoke = sc.add.particles(0, 0, 'fogPuff', {
      lifespan: 5200, speedX: { min: 20, max: 90 }, speedY: { min: -46, max: -12 },
      scale: { start: 0.7, end: 2.6 }, alpha: { start: 0.42, end: 0 }, tint: 0x0b0907, emitting: false,
    }).setDepth(113);
    f.lights = [];
    for (let i = 0; i < 9; i++) f.lights.push(sc.lights2.addLight({ x: -9999, y: 0, r: 150, type: 'halo', intensity: 0.9, flicker: 0.12, on: false }));
    /* yanan kirişler (altından kayarak geçilir) */
    for (const p of sc.platforms.filter(p => p.burning)) {
      sc.add.particles(0, 0, 'softDot', {
        x: { min: p.x, max: p.x + p.w }, y: p.y + p.thick - 4, lifespan: 600,
        speedY: { min: -60, max: -20 }, scale: { start: 0.25, end: 0 }, alpha: { start: 0.7, end: 0 },
        tint: [0xff8a2a, 0xe0461c], blendMode: Phaser.BlendModes.ADD, frequency: 50,
      }).setDepth(73);
      sc.lights2.addLight({ x: p.x + p.w / 2, y: p.y + p.thick, r: 110, type: 'halo', intensity: 0.8, flicker: 0.2 });
    }
  },

  _drawFireTree(g, T, indoor) {
    const c = 0x0b0b10, x = T.x, y = T.groundY, h = T.h;
    g.fillStyle(c, 1);
    if (indoor) {
      /* odun / palet yığını */
      for (let i = 0; i < 4; i++) g.fillRect(x - 34 + (i % 2) * 6, y - 14 - i * 15, 62, 12);
      g.fillRect(x - 30, y - 70, 10, 70); g.fillRect(x + 20, y - 70, 10, 70);
      for (let i = 0; i < 6; i++) T.anchors.push({ x: x - 28 + i * 11, y: y - 18 - (i % 3) * 18 });
      return;
    }
    g.beginPath();
    g.moveTo(x - 10, y); qTo(g, x - 10, y, x - 5, y - h * 0.5, x - 3, y - h);
    g.lineTo(x + 3, y - h); qTo(g, x + 3, y - h, x + 7, y - h * 0.45, x + 12, y);
    g.closePath(); g.fillPath();
    const br = [[-0.72, -1, 0.42], [-0.6, 1, 0.36], [-0.85, 1, 0.3], [-0.9, -1, 0.26]];
    for (const [t, side, len] of br) {
      const bx = x, by = y + h * t, ex = bx + side * h * len, ey = by - h * len * 0.55;
      g.lineStyle(4 - len * 4, c, 1);
      g.beginPath(); g.moveTo(bx, by); qTo(g, bx, by, bx + side * h * len * 0.4, by - h * len * 0.4, ex, ey); g.strokePath();
      T.anchors.push({ x: (bx + ex) / 2, y: (by + ey) / 2 - 4 }, { x: ex, y: ey });
    }
    T.anchors.push({ x, y: y - h * 0.5 }, { x, y: y - h * 0.8 }, { x, y: y - h });
  },

  _igniteCell(f, i) {
    const c = f.cells[i];
    if (!c || c.st !== 0) return;
    if (f.endX && c.x > f.endX) return;
    c.st = 1; c.t = 0; c.spread = false;
    const base = lerp(0.34, 0.16, clamp(f.t / 45, 0, 1));
    c.delay = base * (0.75 + Math.random() * 0.5);
    if (c.tree) c.tree.burning = true;
  },

  _strike(sc, f) {
    const target = f.trees.find(t => Math.abs(t.x - f.strikeX) < 60) ?? f.trees[0];
    if (!target) return;
    const fx = sc.fx;
    if (f.indoor) {
      /* kısa devre: kıvılcım yağmuru + patlama */
      SFAudio.explosion?.(0.45); SFAudio.generatorStart?.();
      const sp = sc.add.particles(target.x, target.groundY - 90, 'softDot', {
        speed: { min: 120, max: 340 }, lifespan: 700, gravityY: 700, scale: { start: 0.12, end: 0 },
        tint: 0xfff0b0, blendMode: Phaser.BlendModes.ADD, emitting: false,
      }).setDepth(110);
      sp.explode(40);
      sc.time.delayedCall(900, () => sp.destroy());
    } else {
      /* yıldırım: gökten ağacın tepesine kırık bir çizgi, ekran beyaz çakar */
      SFAudio.thunder?.();
      sc.lights2.flash = 1;
      const g = sc.add.graphics().setDepth(115).setBlendMode(Phaser.BlendModes.ADD);
      let bx = target.x + (Math.random() - 0.5) * 60, by = target.groundY - 900;
      const pts = [[bx, by]];
      while (by < target.groundY - target.h) { by += 40 + Math.random() * 50; bx += (Math.random() - 0.5) * 50; pts.push([bx, by]); }
      pts.push([target.x, target.groundY - target.h]);
      for (const [w, a] of [[7, 0.25], [2.5, 1]]) {
        g.lineStyle(w, 0xeef2ff, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) g.lineTo(p[0], p[1]); g.strokePath();
      }
      sc.tweens.add({ targets: g, alpha: 0, duration: 380, delay: 90, onComplete: () => g.destroy() });
      fx.flash?.setFillStyle?.(0xeef2ff);
      fx.flash?.setAlpha?.(0.85);
      sc.tweens.add({ targets: fx.flash, alpha: 0, duration: 700 });
    }
    sc.cameras.main.shake(600, 0.012);
    SFVibrate([80, 30, 160]);
    if (target.cell >= 0) this._igniteCell(f, target.cell);
    f.snd = SFAudio.fireLoop?.();
  },

  _updateFire(sc, dt, P) {
    const f = sc.mis.fire; if (!f || f.over) return;
    const px = P.body.position.x, py = P.body.position.y;
    if (!f.active) {
      if (px > f.triggerX) { f.active = true; this._strike(sc, f); }
      return;
    }
    f.t += dt;
    const cam = sc.cameras.main;
    const vx0 = cam.scrollX - 120, vx1 = cam.scrollX + cam.width / cam.zoom + cam.width + 120;
    let front = -1e9, nearest = 1e9, burning = 0;
    const lit = [];
    for (let i = 0; i < f.cells.length; i++) {
      const c = f.cells[i];
      if (c.st !== 1) continue;
      c.t += dt;
      burning++;
      if (!c.spread && c.t > c.delay) {
        c.spread = true;
        for (const j of c.n) {
          const nb = f.cells[j];
          if (nb.st !== 0) continue;
          /* rüzgâr sağa: sağdaki hücre hemen, soldaki gecikmeli tutuşur */
          if (nb.x >= c.x) this._igniteCell(f, j);
          else sc.time.delayedCall(c.delay * 1600, () => this._igniteCell(f, j));
        }
      }
      if (c.t > c.life) {
        c.st = 2;
        if (c.tree) c.tree.burning = false;
        f.charG.fillStyle(0x050403, 1); f.charG.fillRect(c.x - 15, c.y - 2, 30, 4);
        f.charG.fillStyle(0x6a2a10, 0.5); f.charG.fillCircle(c.x - 6 + Math.random() * 12, c.y - 1, 1.4);
        continue;
      }
      if (c.x > front) front = c.x;
      const dpx = Math.abs(c.x - px);
      if (Math.abs(c.y - (py + P.hStand / 2)) < 40 && dpx < nearest) nearest = dpx;
      if (c.x > vx0 && c.x < vx1) lit.push(c);
    }
    /* ağaçlar: yanarken uzun alev; bir süre sonra devrilir */
    for (const T of f.trees) {
      if (!T.burning && !T.falling) continue;
      T.burnT += dt;
      if (!f.indoor && !T.fallen && !T.falling && T.burnT > 6 && Math.random() < dt * 0.4 && T.x < px + 60 && T.x > px - 420) {
        T.falling = true; T.fallDir = 1; SFAudio.leverCreak?.(); SFAudio.doorCreak();
      }
      if (T.falling) {
        T.fallA = Math.min(Math.PI / 2, T.fallA + dt * (0.4 + T.fallA * 2.2));
        if (T.fallA >= Math.PI / 2 && !T.fallen) {
          T.fallen = true; T.falling = false; T.logT = 8;
          SFAudio.thud(1.2); sc.cameras.main.shake(380, 0.012);
          const lx = T.x + T.fallDir * T.h * 0.55;
          T.log = { x0: lx - T.h * 0.45, x1: lx + T.h * 0.45, y: T.groundY };
          T.logBody = sc.matter.add.rectangle(lx, T.groundY - 12, T.h * 0.9, 24, { isStatic: true, label: 'wall', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF } });
          /* düşen gövde altında kalan oyuncu */
          if (px > T.log.x0 && px < T.log.x1 && py > T.groundY - 100) sc.damagePlayer(2, 1);
          for (const c of f.cells) if (c.x > T.log.x0 && c.x < T.log.x1 && Math.abs(c.y - T.groundY) < 6) this._igniteCell(f, f.cells.indexOf(c));
        }
      }
      if (T.fallen && T.logT > 0) {
        T.logT -= dt;
        if (T.logT <= 0 && T.logBody) { sc.matter.world.remove(T.logBody); T.logBody = null; }
      }
    }
    /* rüzgârın taşıdığı közler: cephe çok geride kaldıysa arkanda yeni ocak açar
       (oyuncunun önüne asla düşmez — kaçış yolu açık kalır) */
    f.spotT -= dt;
    if (px - front > 620 && f.spotT <= 0) {
      f.spotT = 1.1;
      const cand = [];
      for (let i = 0; i < f.cells.length; i++) { const c = f.cells[i]; if (c.st === 0 && c.x > front + 120 && c.x < px - 330) cand.push(i); }
      if (cand.length) this._igniteCell(f, cand[Math.floor(Math.random() * cand.length)]);
    }
    /* hasar: yanan hücrenin üstünde / devrilmiş yanan kütüğe değerek */
    f.hurtT -= dt;
    const feet = py + P.hStand / 2;
    let inFire = nearest < 16;
    for (const T of f.trees) if (T.fallen && T.logT > 0 && px > T.log.x0 && px < T.log.x1 && feet > T.groundY - 30) inFire = true;
    if (inFire && f.hurtT <= 0 && !P.hang && !P.mantle) { f.hurtT = 0.55; sc.damagePlayer(1, 1); }
    const heat = clamp(1 - nearest / 360, 0, 1);
    f.snd?.set(clamp(0.25 + heat * 0.75, 0.2, 1));
    sc.fx.setHeat?.(heat * 0.9);
    /* çizim: görünür yanan hücrelerde titreşen, kıvrık alev dilleri (dış kızıl, orta
       turuncu, iç sarı); her hücre kendi fazında salınır, cephe testere gibi görünmez */
    const g = f.flameG; g.clear();
    const now = sc.time.now * 0.012;
    const tongue = (x, y, w, h, sway, col, a) => {
      g.fillStyle(col, a);
      g.beginPath(); g.moveTo(x - w / 2, y);
      qTo(g, x - w / 2, y, x - w * 0.3 + sway * 0.3, y - h * 0.55, x + sway, y - h, 6);
      qTo(g, x + sway, y - h, x + w * 0.35 + sway * 0.2, y - h * 0.45, x + w / 2, y, 6);
      g.closePath(); g.fillPath();
    };
    for (const c of lit) {
      const k = Math.min(1, c.t / 0.5) * (c.t > c.life - 0.8 ? Math.max(0, (c.life - c.t) / 0.8) : 1);
      if (k <= 0.02) continue;
      const ph = c.x * 0.37;
      const hash = (Math.sin(c.x * 12.9898) * 43758.5453) % 1;
      const big = 0.55 + Math.abs(hash) * 0.9;                    // hücreden hücreye boy farkı
      const hh = (20 + Math.sin(now + ph) * 7 + Math.sin(now * 1.9 + ph * 1.7) * 5) * k * big;
      const sw = Math.sin(now * 1.3 + ph) * 5 + 3;
      const ox = hash * 10;
      tongue(c.x + ox, c.y + 1, 30 + big * 14, hh * 1.25, sw, 0xc8381a, 0.32);
      tongue(c.x + ox + 3, c.y + 1, 18 + big * 6, hh * 0.85, sw * 0.8, 0xff8a2a, 0.42);
      if (big > 0.9) tongue(c.x + ox + 2, c.y + 1, 10, hh * 0.5, sw * 0.5, 0xffd070, 0.5);
    }
    const tg = f.treeG; tg.clear();
    for (const T of f.trees) {
      if (T.falling || T.fallen) {
        /* devrilen gövde: tabandan dönen kara çizgi + alev */
        const a = T.fallA * T.fallDir;
        const tx = T.x + Math.sin(a) * T.h, ty = T.groundY - Math.cos(a) * T.h;
        tg.lineStyle(14, 0x0b0b10, 1); tg.beginPath(); tg.moveTo(T.x, T.groundY); tg.lineTo(tx, ty); tg.strokePath();
        if (!T.fallen || T.logT > 0) {
          for (let k = 0; k < 6; k++) {
            const u = k / 5, ax = lerp(T.x, tx, u), ay = lerp(T.groundY, ty, u);
            tongue(ax, ay, 24, 30 + Math.sin(now * 1.4 + k) * 9, Math.sin(now + k) * 5, 0xff8a2a, 0.5);
          }
        }
        continue;
      }
      if (!T.burning) continue;
      const k = Math.min(1, T.burnT / 2.5);
      for (const an of T.anchors.slice(0, Math.ceil(T.anchors.length * k))) {
        const hh = 26 + Math.sin(now + an.x * 0.1) * 9;
        const sw = Math.sin(now * 1.2 + an.y) * 6 + 4;
        tongue(an.x, an.y + 6, 26, hh, sw, 0xc8381a, 0.45);
        tongue(an.x + 2, an.y + 5, 15, hh * 0.65, sw * 0.7, 0xffb04a, 0.5);
        if (Math.random() < dt * 3) f.embers.emitParticleAt(an.x, an.y, 1);
      }
    }
    /* parçacıklar + ışık havuzu: görünür alevlere dağıtılır */
    if (lit.length) {
      for (let k = 0; k < 2; k++) { const c = lit[Math.floor(Math.random() * lit.length)]; f.flames.emitParticleAt(c.x + (Math.random() - 0.5) * 20, c.y - 4, 1); }
      if (Math.random() < dt * 8) { const c = lit[Math.floor(Math.random() * lit.length)]; f.embers.emitParticleAt(c.x, c.y - 10, 1); }
      if (Math.random() < dt * 5) { const c = lit[Math.floor(Math.random() * lit.length)]; f.smoke.emitParticleAt(c.x, c.y - 40, 1); }
    }
    lit.sort((a, b) => a.x - b.x);
    f.lights.forEach((l, i) => {
      const c = lit[Math.floor((i + 0.5) * lit.length / f.lights.length)];
      l.on = !!c; if (c) { l.x = c.x; l.y = c.y - 30; }
    });
    if (f.endX && burning === 0 && f.t > 5) this._fireOver(sc, f);
    if (f.endX && px > f.endX + 120 && !f.safeHint) { f.safeHint = true; SFAudio.playHopeMotif(); }
  },
  _fireOver(sc, f) {
    f.over = true;
    f.snd?.stop();
    sc.fx.setHeat?.(0);
    for (const l of f.lights) l.on = false;
  },

  /* ---------------- SU BASKINI ---------------- */
  _setupFlood(sc, F) {
    const w = new WaterZone(sc, { x0: F.x0, x1: F.x1, surfaceY: F.startY, bottomY: F.startY + 60 });
    sc.waters.push(w);
    sc.mis.flood = { ...F, water: w, active: false, burst: false };
  },
  _updateFlood(sc, dt, P) {
    const F = sc.mis.flood; if (!F) return;
    const px = P.body.position.x;
    if (!F.active && px > F.triggerX) {
      F.active = true;
      this._slam(sc);
      sc.time.delayedCall(1300, () => {
        F.burst = true;
        SFAudio.explosion?.(0.35);
        sc.cameras.main.shake(700, 0.008);
        F.hiss = SFAudio.waterLoop?.();
        for (const p of F.pipes) {
          sc.add.particles(p.x, p.y, 'softDot', {
            speedY: { min: 120, max: 320 }, speedX: { min: -60, max: 60 }, lifespan: 900, gravityY: 600,
            scale: { start: 0.18, end: 0.04 }, alpha: { start: 0.6, end: 0 }, tint: 0x8fa6b4, frequency: 18,
          }).setDepth(107);
          const g = sc.add.graphics().setDepth(75);
          g.fillStyle(0x0b0b10, 1); g.fillRect(p.x - 14, p.y - 6, 28, 10);
          g.lineStyle(2, 0x0b0b10, 1); g.beginPath(); g.moveTo(p.x - 6, p.y + 4); g.lineTo(p.x - 2, p.y + 12); g.lineTo(p.x + 5, p.y + 6); g.strokePath();
        }
      });
    }
    if (F.burst) {
      const w = F.water;
      w.surfaceY = Math.max(F.topY, w.surfaceY - F.rate * dt);
      w.bottomY = F.startY + 80;
      F.hiss?.set(clamp((F.startY - w.surfaceY) / 300, 0.2, 1));
      if (px > F.x1 - 400 && P.body.position.y < w.surfaceY - 120 && !F.safe) {
        F.safe = true; F.hiss?.stop();
      }
    }
  },
  _slam(sc) {
    const S = sc.mis.slam; if (!S || S.done) return;
    S.done = true;
    sc.matter.add.rectangle(S.x, (S.y0 + S.y1) / 2, 20, S.y1 - S.y0, {
      isStatic: true, label: 'wall', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
    });
    const g = sc.add.graphics().setDepth(92);
    g.fillStyle(0x0c0c12, 1);
    g.fillRect(S.x - 10, S.y0, 20, S.y1 - S.y0);
    g.setY(-(S.y1 - S.y0));
    sc.tweens.add({ targets: g, y: 0, duration: 260, ease: 'Bounce.easeOut' });
    SFAudio.thud(1); SFAudio.explosion?.(0.2);
    sc.cameras.main.shake(300, 0.01);
  },

  /* ---------------- 8 KOLLU DEV ---------------- */
  _updateColossus(sc, dt, P) {
    const C = sc.mis.colossus; if (!C) return;
    const px = P.body.position.x;
    if (!C.active && px > C.triggerX) {
      C.active = true;
      C.obj = new Colossus(sc, px - 900, sc.groundYAt(px), C);
      sc.scare(px - 500, 1.4);
      SFAudio.rumble?.(4, 0.9);
    }
    if (C.obj) C.obj.update(dt, P);
  },

  /* ---------------- DÜKKÂN: sigorta, notlar, şifre ---------------- */
  _buildFuseBox(sc, f) {
    const g = sc.add.graphics().setDepth(93);
    const y = f.groundY - 96;
    g.fillStyle(0x0c0c12, 1); g.fillRect(f.x - 12, y - 18, 24, 36);
    g.lineStyle(1.2, 0x2a2a34, 1); g.strokeRect(f.x - 9, y - 14, 18, 28);
    return { ...f, y, g, done: false };
  },
  _buildNote(sc, n) {
    const g = sc.add.graphics().setDepth(93);
    g.fillStyle(0x5a5850, 0.9); g.fillRect(n.x - 6, n.y - 8, 12, 15);
    g.lineStyle(0.8, 0x0b0b10, 1);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(n.x - 4, n.y - 4 + i * 4); g.lineTo(n.x + 4, n.y - 4 + i * 4); g.strokePath(); }
    const glow = sc.add.image(n.x, n.y, 'softDot').setDepth(92).setScale(0.7).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: glow, alpha: 0.08, duration: 1100, yoyo: true, repeat: -1 });
    return { ...n, g, glow, read: false };
  },
  _drawKeypad(sc, k) {
    const g = sc.add.graphics().setDepth(93);
    const y = k.groundY - 92;
    g.fillStyle(0x0c0c12, 1); g.fillRect(k.x - 9, y - 13, 18, 26);
    g.fillStyle(0x6a3a30, 0.9); g.fillCircle(k.x, y - 8, 1.6);
    g.fillStyle(0x2a2a34, 1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.fillRect(k.x - 6 + j * 4.5, y - 3 + i * 4.5, 3, 3);
    k.lampY = y - 8;
    return g;
  },
  revealDigit(sc, lock, idx) {
    const kp = sc.mis.keypads.find(k => k.lock === lock);
    if (!kp) return;
    const known = sc.mis.codeKnown[lock] ?? (sc.mis.codeKnown[lock] = [null, null, null, null]);
    known[idx] = kp.code[idx];
    SFAudio.pickup();
    UI.hint(`${idx + 1}. hane: ${kp.code[idx]}`, 2600, '#');
    UI.showCode(known);
  },

  /* ---------------- FABRİKA: lamba sırası ---------------- */
  _buildSimon(sc, s) {
    const S = { ...s, state: 'idle', pos: 0, lampOn: -1, g: sc.add.graphics().setDepth(93), lights: [] };
    for (let i = 0; i < 3; i++) {
      S.lights.push(sc.lights2.addLight({ x: s.levers[i], y: s.lampY, r: 90, type: 'halo', intensity: 0.9, on: false }));
    }
    S.pull = [0, 0, 0, 0];
    this._drawSimon(S);
    return S;
  },
  _drawSimon(S) {
    const g = S.g; g.clear();
    const c = 0x0c0c12;
    // pano
    g.fillStyle(c, 1); g.fillRect(S.levers[0] - 30, S.lampY - 18, S.levers[2] - S.levers[0] + 60, 34);
    for (let i = 0; i < 3; i++) {
      const on = S.lampOn === i;
      g.fillStyle(on ? 0xf0d8a0 : 0x2a2a30, 1);
      g.fillCircle(S.levers[i], S.lampY, on ? 7 : 6);
      // kol
      const lx = S.levers[i], gy = S.groundY;
      g.fillStyle(c, 1); g.fillRect(lx - 8, gy - 52, 16, 52);
      const a = -0.8 + S.pull[i] * 1.6;
      g.lineStyle(4, c, 1);
      g.beginPath(); g.moveTo(lx, gy - 46); g.lineTo(lx + Math.sin(a) * 30, gy - 46 - Math.cos(a) * 30); g.strokePath();
      g.fillCircle(lx + Math.sin(a) * 30, gy - 46 - Math.cos(a) * 30, 4);
      // roma rakamı
      g.fillStyle(0x6a665e, 1);
      for (let k = 0; k <= i; k++) g.fillRect(lx - 4 + k * 4 - i * 2, gy - 36, 2, 8);
    }
    // başlat düğmesi
    const sx = S.startX, gy = S.groundY;
    g.fillStyle(c, 1); g.fillRect(sx - 12, gy - 70, 24, 70);
    g.fillStyle(S.state === 'idle' || S.state === 'fail' ? 0x8a3a30 : 0x2a2a30, 1);
    g.fillCircle(sx, gy - 58, 5);
  },
  _simonPlay(sc, S) {
    S.state = 'show'; S.pos = 0;
    this._drawSimon(S);
    S.seq.forEach((li, k) => {
      sc.time.delayedCall(600 + k * 700, () => {
        S.lampOn = li; S.lights.forEach((l, i) => l.on = i === li);
        SFAudio.simonTone?.(li);
        this._drawSimon(S);
      });
      sc.time.delayedCall(600 + k * 700 + 420, () => { S.lampOn = -1; S.lights.forEach(l => l.on = false); this._drawSimon(S); });
    });
    sc.time.delayedCall(700 + S.seq.length * 700, () => { S.state = 'input'; this._drawSimon(S); UI.hint('Aynı sırayla kolları çek.', 1800, '☰'); });
  },
  _simonPull(sc, S, i) {
    S.pull[i] = 1; this._drawSimon(S);
    sc.tweens.add({ targets: S.pull, [i]: 0, duration: 500, delay: 250, onUpdate: () => this._drawSimon(S) });
    S.lampOn = i; S.lights[i].on = true; SFAudio.simonTone?.(i);
    sc.time.delayedCall(300, () => { S.lampOn = -1; S.lights[i].on = false; this._drawSimon(S); });
    if (S.seq[S.pos] === i) {
      S.pos++;
      if (S.pos >= S.seq.length) {
        S.state = 'done';
        const pd = sc.poweredDoors.find(p => p.id === S.door);
        sc.openGrate(pd);
        SFAudio.playHopeMotif();
      }
    } else {
      S.state = 'fail';
      SFAudio.explosion?.(0.2);
      sc.cameras.main.shake(300, 0.008);
      const steam = sc.add.particles(S.levers[i], S.groundY - 60, 'fogPuff', {
        speedY: { min: -120, max: -40 }, speedX: { min: -80, max: 80 }, lifespan: 1200,
        scale: { start: 0.3, end: 1.4 }, alpha: { start: 0.5, end: 0 }, tint: 0xc8ccd2, emitting: false,
      }).setDepth(108);
      steam.explode(14);
      sc.time.delayedCall(1500, () => steam.destroy());
      const P = sc.player;
      if (Math.abs(P.body.position.x - S.levers[i]) < 60) sc.damagePlayer(1, -1);
      UI.hint('Yanlış sıra. Paneli yeniden çalıştır.', 2200, '☰');
    }
    this._drawSimon(S);
  },

  /* ---------------- BOMBA (süreli kapı) ---------------- */
  _setupBomb(sc, ch) {
    const M = sc.mis;
    const colors = ['MAVİ', 'SARI', 'BEYAZ', 'YEŞİL'];
    for (let i = colors.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [colors[i], colors[j]] = [colors[j], colors[i]]; }
    M.bomb = {
      x: ch.bomb.x, groundY: ch.bomb.groundY, t: ch.bombTime, order: colors.slice(0, 3), extra: colors[3],
      screws: 0, cut: [], mistakes: 0, done: false, exploded: false, manual: false, beepT: 0,
      g: sc.add.graphics().setDepth(97),
    };
    /* bomba arkadaki demir kapıya bağlı — kablolar kapı menteşesine gider */
    M.gateX = ch.bomb.x + 120;
    M.bombGate = sc.add.graphics().setDepth(92);
    M.bombGate.fillStyle(0x0c0c12, 1);
    M.bombGate.fillRect(M.gateX - 10, ch.bomb.groundY - 230, 20, 230);
    for (let i = 0; i < 6; i++) M.bombGate.fillRect(M.gateX - 16, ch.bomb.groundY - 220 + i * 38, 32, 5);
    M.gateBody = sc.matter.add.rectangle(M.gateX, ch.bomb.groundY - 115, 20, 230, {
      isStatic: true, label: 'wall', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
    });
    M.bombLight = sc.lights2.addLight({ x: ch.bomb.x, y: ch.bomb.groundY - 30, r: 70, type: 'halo', intensity: 0.7 });
    UI.showBombHud(true);
  },
  _updateBomb(sc, dt) {
    const B = sc.mis.bomb; if (!B) return;
    const M = sc.mis;
    const g = B.g; g.clear();
    // bomba: varil + kablolar + sayaç
    g.fillStyle(0x0c0c11, 1);
    g.fillRoundedRect(B.x - 22, B.groundY - 46, 44, 46, 5);
    g.fillRect(B.x - 26, B.groundY - 40, 52, 5);
    g.fillRect(B.x - 26, B.groundY - 16, 52, 5);
    const cols = { KIRMIZI: 0xc8483a, MAVİ: 0x4a7fd2, SARI: 0xd2b84a, BEYAZ: 0xdadada, YEŞİL: 0x4ab86a };
    let k = 0;
    for (const [name, c] of Object.entries(cols)) {
      if (B.cut.includes(name)) { k++; continue; }
      g.lineStyle(1.6, c, 0.85);
      g.beginPath(); g.moveTo(B.x - 14 + k * 7, B.groundY - 46); g.lineTo(B.x - 30 + k * 4, B.groundY - 62); g.lineTo(M.gateX - 8, B.groundY - 70 - k * 9); g.strokePath();
      k++;
    }
    if (B.done) { g.fillStyle(0x4ab86a, 0.9); g.fillCircle(B.x, B.groundY - 52, 3); return; }
    if (B.exploded) return;
    B.t -= dt;
    const urgent = B.t < 30;
    B.beepT -= dt;
    const blink = B.beepT > (urgent ? 0.12 : 0.35);
    g.fillStyle(0xe8604a, blink ? 1 : 0.25); g.fillCircle(B.x, B.groundY - 52, 3);
    if (B.beepT <= 0) { B.beepT = urgent ? 0.5 : 1; SFAudio.bombBeep?.(urgent); }
    UI.updateBombTime(B.t, urgent);
    if (B.t <= 0) this.explodeBomb(sc);
  },
  explodeBomb(sc) {
    const B = sc.mis.bomb; if (!B || B.exploded) return;
    B.exploded = true;
    UI.hide('bomb-panel');
    UI.showBombHud(false);
    SFAudio.explosion?.(1.2);
    sc.cameras.main.shake(1400, 0.03);
    sc.fx.flash.setFillStyle?.(0xfff0d8);
    sc.fx.flash.setAlpha(1);
    sc.tweens.add({ targets: sc.fx.flash, alpha: 0, duration: 2600 });
    sc.killPlayer(1);
  },
  defuseSuccess(sc) {
    const B = sc.mis.bomb;
    B.done = true;
    UI.hide('bomb-panel');
    UI.showBombHud(false);
    sc.panelOpen = false;
    /* kapı açılır — yol serbest */
    const M = sc.mis;
    SFAudio.doorUnlock(); SFAudio.thud(0.7);
    sc.matter.world.remove(M.gateBody);
    sc.tweens.add({ targets: M.bombGate, y: -240, duration: 1500, ease: 'Quad.easeInOut' });
    sc.time.delayedCall(1700, () => { if (!sc.dead) sc.completeChapter(); });
  },

  /* ---------------- ÖĞRETİCİ ---------------- */
  _updateTutorial(sc, dt, P) {
    const T = sc.mis.tutorial; if (!T) return;
    const px = P.body.position.x;
    let cur = T.steps.find(s => !s.done && px > s.x - 380);
    // geçilip gidilen adım sessizce kapanır
    for (const s of T.steps) if (!s.done && px > s.x + 900) s.done = true;
    if (cur !== T.cur) { T.cur = cur; T.holdT = 0; UI.showTutorial(cur ? cur.key : null); }
    if (!cur) return;
    const S = sc.state;
    let ok = false;
    switch (cur.key) {
      case 'move': if (Math.abs(P.body.velocity.x) > 1) T.holdT += dt; ok = T.holdT > 0.7; break;
      case 'jump': ok = !P.grounded && P.body.velocity.y < -4; break;
      case 'crouch': ok = P.crouching || (P.slideT ?? 0) > 0; break;
      case 'act': ok = sc.containers.some(c => c.opened) || sc.inv.crowbar; break;
      case 'pry': ok = sc.crates.some(c => c.opened); break;
      case 'push': ok = !!P.pushing || !!P.grabbing; break;
      case 'flash': ok = sc.flashOn; break;
      case 'run': ok = (P.runBlend ?? 0) > 0.85; break;
    }
    void S;
    if (ok) { cur.done = true; UI.tutorialDone(); }
  },

  /* ---------------- her kare ---------------- */
  update(sc, dt) {
    const P = sc.player; if (!P || !sc.mis) return;
    const M = sc.mis;
    M.t += dt;
    for (const c of M.collapses) this._updateCollapse(sc, c, P);
    for (const c of M.chases) this._updateChase(sc, c, P);
    for (const a of M.ambushes) this._updateAmbush(sc, a, P);
    this._updateFire(sc, dt, P);
    this._updateFlood(sc, dt, P);
    this._updateColossus(sc, dt, P);
    this._updateBomb(sc, dt);
    this._updateTutorial(sc, dt, P);
    Escapes.update(sc, dt, P);
    if (M.slam && !M.slam.done && !sc.mis.flood && P.body.position.x > M.slam.x + 120) this._slam(sc);
  },

  /* ---------------- etkileşim ---------------- */
  findInteractable(sc, px, py) {
    const M = sc.mis; if (!M) return null;
    const et = Escapes.findInteractable(sc, px, py);
    if (et) return et;
    const V = M.vehicle;
    if (V && !V.started && Math.abs(V.x - px) < 120) return { type: 'm-vehicle', obj: V, label: V.kind === 'boat' ? 'TEKNEYE BİN' : 'ARABAYA BİN', x: V.x, y: V.y - 80 };
    for (const f of M.fuseBoxes) {
      if (f.done || Math.abs(f.x - px) > 50) continue;
      return sc.inv.fuse ? { type: 'm-fuse', obj: f, label: 'SİGORTAYI TAK', x: f.x, y: f.y - 30 }
        : { type: 'm-fuse-no', obj: f, label: 'SİGORTA YOK', x: f.x, y: f.y - 30 };
    }
    for (const n of M.notes) {
      if (n.read || Math.abs(n.x - px) > 46 || Math.abs(n.y - py) > 80) continue;
      return { type: 'm-note', obj: n, label: 'NOTU OKU', x: n.x, y: n.y - 22 };
    }
    for (const k of M.keypads) {
      if (k.solved || Math.abs(k.x - px) > 50) continue;
      return { type: 'm-keypad', obj: k, label: 'ŞİFRE GİR', x: k.x, y: k.lampY - 24 };
    }
    for (const S of M.simons) {
      if (S.state === 'done' || S.state === 'show') continue;
      if (Math.abs(S.startX - px) < 40 && S.state !== 'input') return { type: 'm-simon-start', obj: S, label: 'PANELİ ÇALIŞTIR', x: S.startX, y: S.groundY - 92 };
      if (S.state === 'input') {
        for (let i = 0; i < 3; i++) if (Math.abs(S.levers[i] - px) < 34) return { type: 'm-simon', obj: S, idx: i, label: 'KOL ' + ['I', 'II', 'III'][i], x: S.levers[i], y: S.groundY - 92 };
        if (Math.abs(S.startX - px) < 40) return { type: 'm-simon-start', obj: S, label: 'SIRAYI TEKRAR GÖSTER', x: S.startX, y: S.groundY - 92 };
      }
    }
    const B = M.bomb;
    if (B && !B.done && !B.exploded && Math.abs(B.x - px) < 70) {
      return sc.inv.cutters ? { type: 'm-bomb', obj: B, label: 'BOMBAYI SÖK', x: B.x, y: B.groundY - 80 }
        : { type: 'm-bomb-no', obj: B, label: 'PENSE GEREK', x: B.x, y: B.groundY - 80 };
    }
    return null;
  },

  interact(sc, t) {
    const M = sc.mis;
    if (Escapes.interact(sc, t)) return true;
    switch (t.type) {
      case 'm-vehicle': t.obj.board(); return true;
      case 'm-fuse': {
        sc.player.mode = 'action';
        sc.rig.startAction('insert', {
          targetX: t.obj.x, targetY: t.obj.y,
          onPhase: (ph) => {
            if (ph !== 'inserted') return;
            t.obj.done = true; sc.inv.fuse = false; sc.syncHUD();
            SFAudio.batterySlot(); SFAudio.generatorStart?.();
            sc.impactSpark(t.obj.x, t.obj.y);
            const pd = sc.poweredDoors.find(p => p.id === t.obj.door);
            sc.openGrate(pd);
          },
          onDone: () => { sc.player.mode = 'idle'; },
        });
        return true;
      }
      case 'm-fuse-no': SFAudio.thud(0.2); UI.hint('Sigorta yuvası boş.', 2000, '⚡'); return true;
      case 'm-note': sc.markFound('n' + t.obj.lock + ':' + t.obj.idx); t.obj.read = true; t.obj.g.destroy(); t.obj.glow.destroy(); this.revealDigit(sc, t.obj.lock, t.obj.idx); return true;
      case 'm-keypad': UI.openKeypad(sc, t.obj); return true;
      case 'm-simon-start': this._simonPlay(sc, t.obj); return true;
      case 'm-simon': {
        sc.player.mode = 'action';
        sc.rig.startAction('lever', {
          targetX: t.obj.levers[t.idx], targetY: t.obj.groundY - 60,
          onPhase: (ph) => { if (ph === 'pulled') this._simonPull(sc, t.obj, t.idx); },
          onDone: () => { sc.player.mode = 'idle'; },
        });
        return true;
      }
      case 'm-bomb': UI.openBomb(sc); return true;
      case 'm-bomb-no': SFAudio.thud(0.2); UI.hint('Pense gerekli. Yükseltideki alet çantasına bak.', 2600, '⏱'); return true;
    }
    void M;
    return false;
  },

  collect(sc, kind, item) {
    switch (kind) {
      case 'fuse': sc.inv.fuse = true; return true;
      case 'note': { const [lock, idx] = (item?.meta ?? '').split(':'); this.revealDigit(sc, lock, +idx); return true; }
      case 'cutters': sc.inv.cutters = true; return true;
      case 'manual': {
        const B = sc.mis.bomb; if (B) B.manual = true;
        if (B) UI.hint(`Kesme sırası: ${B.order.join(' → ')}. Kırmızıya dokunma.`, 5200, '⏱');
        return true;
      }
    }
    return false;
  },
};

/* ============================================================
   SEKİZ KOLLU DEV — ekranın solundan taşan devasa gövde.
   4 kol yerde sürünerek çeker, 2 kol havada savrulur, 2 kol
   oyuncunun önüne VURUR (önce yerde gölge belirir).
   ============================================================ */
class Colossus {
  constructor(sc, x, groundY, cfg) {
    this.sc = sc; this.x = x; this.groundY = groundY; this.cfg = cfg;
    this.speed = cfg.speed; this.t = 0;
    this.g = sc.add.graphics().setDepth(106);
    this.eyes = sc.add.graphics().setDepth(107);
    this.smash = null; this.smashCD = 3.2;
    this.stopped = false;
    this.light = sc.lights2.addLight({ x, y: groundY - 200, r: 260, type: 'halo', intensity: 0.35 });
  }
  update(dt, P) {
    const sc = this.sc;
    this.t += dt;
    const px = P.body.position.x;
    const gap = px - this.x;
    if (!this.stopped) {
      // lastik bant: çok gerideyse hızlanır, çok yakınsa biraz yavaşlar — hep ensende
      let sp = this.speed;
      if (gap > this.cfg.catchUp) sp = this.speed + (gap - this.cfg.catchUp) * 0.9;
      else if (gap < 140) sp = this.speed * 0.85;
      this.x += sp * dt;
      if (this.cfg.endX && this.x > this.cfg.endX - 30) { this.x = this.cfg.endX - 30; this.stopped = true; this.onStop(); }
    }
    if (Math.random() < dt * 1.2) sc.cameras.main.shake(160, 0.004);
    if (!sc.dead && gap < 30 && !this.stopped) sc.killPlayer(1);
    // vuruş
    this.smashCD -= dt;
    if (!this.smash && this.smashCD <= 0 && !this.stopped && !sc.dead) {
      const tx = clamp(px + P.body.velocity.x * 60 * 0.55, this.x + 160, this.x + 620);
      this.smash = { tx, t: 0, hit: false, ty: sc.groundYAt(tx) };
      this.smashCD = 2.4 + Math.random() * 1.2;
      SFAudio.monsterRoar(true);
    }
    if (this.smash) {
      const S = this.smash;
      S.t += dt;
      if (S.t > 0.95 && !S.hit) {
        S.hit = true;
        SFAudio.explosion?.(0.45);
        sc.cameras.main.shake(380, 0.02);
        const dust = sc.add.particles(S.tx, S.ty, 'softDot', {
          speedX: { min: -220, max: 220 }, speedY: { min: -200, max: -40 }, lifespan: 700, gravityY: 500,
          scale: { start: 0.35, end: 0 }, alpha: { start: 0.5, end: 0 }, tint: 0x5a5048, emitting: false,
        }).setDepth(105);
        dust.explode(26);
        sc.time.delayedCall(900, () => dust.destroy());
        if (Math.abs(px - S.tx) < 70 && P.body.position.y > S.ty - 120) sc.damagePlayer(2, 1);
      }
      if (S.t > 1.6) this.smash = null;
    }
    this.light.x = this.x - 120; this.light.y = this.groundY - 220;
    this.draw(px);
  }
  onStop() {
    const sc = this.sc;
    SFAudio.screech?.(1.2);
    sc.cameras.main.shake(900, 0.015);
    sc.time.delayedCall(3500, () => {
      sc.tweens.add({ targets: [this.g, this.eyes], alpha: 0, duration: 2500 });
      sc.lights2.removeLight(this.light);
    });
  }
  draw(px) {
    const g = this.g, e = this.eyes, t = this.t;
    g.clear(); e.clear();
    const col = 0x07070a;
    const gy = this.groundY;
    const bx = this.x - 170, by = gy - 210 + Math.sin(t * 1.4) * 10;
    /* kollar: segmentli, uca doğru incelen, dalgalı */
    const tentacle = (ax, ay, tx, ty, w0, wave, phase) => {
      /* tek dolu çokgen: omurga noktaları + iki yanda incelen kalınlık (tek çizim çağrısı) */
      const N = 12, L = [], Rr = [];
      let px0 = ax, py0 = ay;
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        const mx = lerp(ax, tx, k), my = lerp(ay, ty, k) - Math.sin(k * Math.PI) * 60;
        const off = Math.sin(k * 5 + t * 3 + phase) * wave * k;
        const x = mx + off * 0.4, y = my + off;
        const dx = x - px0, dy = y - py0, d = Math.hypot(dx, dy) || 1;
        const w = Math.max(1.5, w0 * (1 - k * 0.92)) / 2;
        L.push(x - dy / d * w, y + dx / d * w); Rr.push(x + dy / d * w, y - dx / d * w);
        px0 = x; py0 = y;
      }
      const pts = L;
      for (let i = Rr.length - 2; i >= 0; i -= 2) pts.push(Rr[i], Rr[i + 1]);
      g.fillStyle(col, 1);
      g.beginPath(); g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.closePath(); g.fillPath();
    };
    // yürüyen 4 kol — uçları ileride yere vurup çeker
    for (let i = 0; i < 4; i++) {
      const cyc = (t * 0.9 + i * 0.25) % 1;
      const reach = 260 + i * 70;
      const tipX = this.x + reach * (1 - cyc) - 60, tipY = gy - (cyc < 0.2 ? (0.2 - cyc) * 300 : 0);
      tentacle(bx + 40, by + 60 + i * 12, tipX, tipY, 26 - i * 2, 18, i);
    }
    // havada savrulan 2 kol
    tentacle(bx + 20, by - 20, this.x + 120 + Math.sin(t * 1.3) * 80, gy - 360 + Math.cos(t * 1.1) * 60, 22, 40, 2);
    tentacle(bx - 40, by - 40, this.x + 40 + Math.cos(t * 0.9) * 60, gy - 420, 20, 50, 4);
    // vuran kol
    if (this.smash) {
      const S = this.smash;
      const k = S.t < 0.75 ? S.t / 0.75 : 1;
      const raise = S.t < 0.75 ? Math.sin(k * Math.PI * 0.5) : 0;
      const fall = S.t >= 0.75 ? clamp((S.t - 0.75) / 0.2, 0, 1) : 0;
      const tipY = lerp(gy - 380 * raise, S.ty, fall);
      tentacle(bx + 60, by + 10, S.tx, S.t < 0.75 ? gy - 380 * raise : tipY, 30, 10, 7);
      // yerdeki uyarı gölgesi
      if (!S.hit) {
        g.fillStyle(0x000000, 0.25 + k * 0.35);
        g.fillEllipse(S.tx, S.ty + 2, 90 + k * 60, 10);
      }
    }
    // gövde: dev manto + baş
    g.fillStyle(col, 1);
    g.fillEllipse(bx - 60, by - 30, 420, 300);
    g.fillEllipse(bx + 80, by + 40, 230, 190);
    // gözler — çok sayıda, soluk sarı/kırmızı
    const eyesPos = [[60, 10, 9], [100, -10, 7], [30, -30, 6], [120, 30, 5], [80, 50, 6], [20, 30, 4], [140, -2, 4]];
    for (const [ox, oy, r] of eyesPos) {
      const blink = Math.sin(t * 0.7 + ox) > 0.95 ? 0.15 : 1;
      e.fillStyle(0xd85a3a, 0.2 * blink); e.fillCircle(bx + ox, by + oy, r * 2.2);
      e.fillStyle(0xe8b070, 0.95 * blink); e.fillCircle(bx + ox, by + oy, r * 0.8);
    }
    void px;
  }
}

/* ============================================================
   ARAÇ KAÇIŞI (araba / tekne)
   Sağa kaydır = gaz, sola = fren, aşağı = eğil (kurşun/alçak engel),
   düşmana dokun = ateş. Arkadan silahlı takipçi gelir.
   ============================================================ */
class Vehicle {
  constructor(sc, cfg) {
    this.sc = sc; this.cfg = cfg;
    this.kind = cfg.kind; this.boat = cfg.kind === 'boat';
    this.x = cfg.startX; this.y = this.boat ? cfg.surfaceY : cfg.groundY;
    this.v = 0; this.vy = 0; this.air = false;
    this.started = false; this.finished = false;
    this.duck = 0;
    this.g = sc.add.graphics().setDepth(103);
    addRimGlow(this.g, 0x9aa2b4, 1.3);
    this.og = sc.add.graphics().setDepth(74);
    /* far / pruva feneri + araç çevresinde soluk ışık: karanlıkta seçilsin */
    this.head = sc.lights2.addLight({ x: this.x, y: this.y - 30, r: 300, type: 'cone', facing: 1, intensity: 1.0, on: true });
    this.halo = sc.lights2.addLight({ x: this.x, y: this.y - 30, r: 130, type: 'halo', intensity: 0.75 });
    this.obs = cfg.obstacles.map(o => ({ ...o, hit: false, crushed: false }));
    this.pursuer = null;
    this.hurtCD = 0;
    this.draw();
    this.drawObstacles();
  }
  get vmax() { return this.boat ? 300 : 360; }
  get vcruise() { return this.boat ? 210 : 240; }
  get vmin() { return this.boat ? 90 : 110; }
  board() {
    const sc = this.sc, P = sc.player;
    this.started = true;
    P.inCar = true; P.inVehicle = this;
    sc.rig.setVisible(false);
    this.engine = SFAudio.carEngine?.();
    if (this.boat) SFAudio.splash?.(0.8); else SFAudio.carStart?.();
    UI.hint(IS_TOUCH ? 'Sağa kaydır: hızlan. Sola: yavaşla. Aşağı: eğil. Düşmana dokun: ateş.' : '[D] hızlan · [A] yavaşla · [S] eğil · [X] ateş', 4200, '»');
    this.v = this.vcruise * 0.6;
    sc.time.delayedCall(2200, () => this.spawnPursuer());
  }
  spawnPursuer() {
    if (this.finished || this.sc.dead) return;
    const sc = this.sc;
    this.pursuer = { x: this.x - 520, hp: 8, rigs: [], shootT: 1.6, burst: 0, burstT: 0, dist: 330, g: sc.add.graphics().setDepth(102) };
    this.pursuer.light = sc.lights2.addLight({ x: this.pursuer.x, y: this.y - 40, r: 260, type: 'cone', facing: 1, intensity: 0.9 });
    addRimGlow(this.pursuer.g, 0x9a8a80, 1.2);
    for (let i = 0; i < 2; i++) {
      const r = new SoldierRig(sc, { scale: 0.92, depth: 101 });
      r.readyTarget = 1; r.ready = 1;
      this.pursuer.rigs.push(r);
    }
    SFAudio.radioChirp?.();
  }
  surfaceAt(x) {
    if (this.boat) return this.cfg.surfaceY + Math.sin(x * 0.02 + this.sc.time.now * 0.002) * 3;
    return this.sc.groundYAt(x);
  }
  hurt(n, msg) {
    if (this.hurtCD > 0) return;
    this.hurtCD = 0.8;
    this.sc.damagePlayer(n, -1);
  }
  update(dt) {
    const sc = this.sc, P = sc.player;
    this.hurtCD -= dt;
    this.head.x = this.x + (this.boat ? 56 : 66); this.head.y = this.y - (this.boat ? 18 : 30); this.head.angle = 0.08;
    this.halo.x = this.x; this.halo.y = this.y - 30;
    this.head.on = this.started && !this.finished;
    if (!this.started) {
      // binmeden yanından geçmeye çalışırsa otomatik biner (yol yürüyerek geçilemez)
      if (P && !sc.dead && P.body.position.x > this.x + 50 && P.body.position.x < this.x + 260) this.board();
      this.draw(); this.drawObstacles(); return;
    }
    if (this.finished) { this.draw(); return; }
    // kontrol
    const target = Input.right ? this.vmax : Input.left ? this.vmin : this.vcruise;
    this.v = lerp(this.v, target, 1 - Math.exp(-dt * (Input.right ? 1.2 : 2)));
    this.duck = lerp(this.duck, Input.crouch ? 1 : 0, 1 - Math.exp(-dt * 12));
    this.x += this.v * dt;
    // dikey
    const sy = this.surfaceAt(this.x);
    if (this.air) {
      this.vy += 900 * dt; this.y += this.vy * dt;
      if (this.y >= sy && sy < 800) { this.y = sy; this.air = false; this.vy = 0; SFAudio.land(0.8, 'metal'); sc.cameras.main.shake(200, 0.008); }
      if (this.y > this.cfg.groundY + 160) { sc.killPlayer(0); this.engine?.stop(0.2); this.finished = true; return; }
    } else if (sy > 800 || sy > this.y + 40) {
      this.air = true; this.vy = 0;                    // rampasız çukur: düş
    } else this.y = lerp(this.y, sy, 1 - Math.exp(-dt * 20));
    // engeller
    for (const o of this.obs) {
      if (o.hit) continue;
      const dx = o.x - this.x;
      if (dx > 40 || dx < -50) continue;
      switch (o.type) {
        case 'ramp': o.hit = true; this.air = true; this.vy = -Math.max(220, this.v * 0.95); SFAudio.jump(); break;
        case 'barricade':
        case 'rocks':
          o.hit = true;
          if (this.v > 230) { o.crushed = true; this.v *= 0.75; SFAudio.crateBurst(); sc.cameras.main.shake(260, 0.012); }
          else { this.v = 40; this.hurt(1, this.boat ? 'Kayalara çarptık! Hızlı gir!' : 'Barikat! Hızlanarak çarp!'); sc.cameras.main.shake(300, 0.016); }
          break;
        case 'pipe':
        case 'bridge':
          o.hit = true;
          if (this.duck < 0.6) this.hurt(1, 'Eğil!');
          break;
        case 'mine': {
          const up = Math.sin(sc.time.now * 0.0018 + o.phase) > -0.2;
          if (up && Math.abs(dx) < 26) { o.hit = true; o.boom = true; SFAudio.explosion?.(0.7); sc.cameras.main.shake(400, 0.02); this.hurt(2, 'Mayın!'); this.v *= 0.5; }
          break;
        }
      }
    }
    // takipçi
    const Pu = this.pursuer;
    if (Pu) {
      Pu.dist = lerp(Pu.dist, 280 + Math.sin(sc.time.now * 0.0007) * 90, 1 - Math.exp(-dt));
      Pu.x = this.x - Pu.dist;
      Pu.shootT -= dt;
      if (Pu.burst > 0) {
        Pu.burstT -= dt;
        if (Pu.burstT <= 0) {
          Pu.burst--; Pu.burstT = 0.12;
          SFAudio.gunshot();
          const r = Pu.rigs[Pu.burst % 2];
          r.recoilT = 0.16;
          const m = r.muzzle;
          if (m) {
            this.sc.impactSpark(this.x - 30 + Math.random() * 40, this.y - 30 - Math.random() * 20);
            if (this.duck < 0.5 && Math.random() < 0.38) this.hurt(1);
            else SFAudio.ricochet();
          }
        }
      } else if (Pu.shootT <= 0) { Pu.burst = 3; Pu.shootT = 1.8 + Math.random() * 1.2; }
      this.drawPursuer(dt);
    }
    // bitiş
    if (this.x > this.cfg.endX) {
      this.finished = true;
      this.engine?.stop(1.5);
      P.inCar = false; P.inVehicle = null;
      Phaser.Physics.Matter.Matter.Body.setPosition(P.body, { x: this.x + 90, y: sc.groundYAt(this.x + 90) - 40 });
      sc.rig.setVisible(true);
      if (Pu) { sc.tweens.add({ targets: [Pu.g, ...Pu.rigs.map(r => r.gfx)], alpha: 0, duration: 800 }); }
      this.pursuer = null;
    }
    this.draw();
    this.drawObstacles();
  }
  hitPursuer(dmg = 1) {
    const Pu = this.pursuer; if (!Pu) return false;
    Pu.hp -= dmg;
    this.sc.impactSpark(Pu.x + 30, this.y - 30);
    if (Pu.hp <= 0) {
      SFAudio.explosion?.(0.8);
      this.sc.cameras.main.shake(500, 0.02);
      const fire = this.sc.add.particles(Pu.x, this.y - 20, 'softDot', {
        speed: { min: 60, max: 260 }, lifespan: 800, scale: { start: 0.6, end: 0 }, alpha: { start: 0.8, end: 0 },
        tint: [0xff8a2a, 0xffc060], blendMode: Phaser.BlendModes.ADD, emitting: false,
      }).setDepth(110);
      fire.explode(40);
      Pu.g.destroy(); Pu.rigs.forEach(r => r.destroy()); this.sc.lights2.removeLight(Pu.light);
      this.pursuer = null;
      if (this.cfg.endX - this.x > 1600) this.sc.time.delayedCall(4500, () => this.spawnPursuer());
    }
    return true;
  }
  drawPursuer() {
    const Pu = this.pursuer, g = Pu.g, sc = this.sc;
    const y = this.boat ? this.surfaceAt(Pu.x) : sc.groundYAt(Pu.x) < 800 ? sc.groundYAt(Pu.x) : this.y;
    Pu.light.x = Pu.x + (this.boat ? 60 : 78); Pu.light.y = y - (this.boat ? 20 : 36);
    g.clear(); g.fillStyle(0x0b0b10, 1);
    if (this.boat) {
      g.beginPath(); g.moveTo(Pu.x - 70, y - 18); g.lineTo(Pu.x + 66, y - 18); g.lineTo(Pu.x + 48, y + 4); g.lineTo(Pu.x - 58, y + 4); g.closePath(); g.fillPath();
      g.fillRect(Pu.x - 64, y - 30, 14, 14);
    } else {
      g.fillRect(Pu.x - 80, y - 66, 110, 48); g.fillRoundedRect(Pu.x + 30, y - 56, 50, 38, { tl: 10, tr: 8, bl: 0, br: 0 });
      g.fillCircle(Pu.x - 50, y - 12, 13); g.fillCircle(Pu.x + 50, y - 12, 13);
      g.fillStyle(0xf0e8c8, 0.8); g.fillCircle(Pu.x + 78, y - 36, 3);
    }
    Pu.rigs.forEach((r, i) => {
      const rx = Pu.x - 30 + i * 34, ry = y - (this.boat ? 16 : 64);
      r.aimAngle = Math.atan2((this.y - 40) - (ry - 40), this.x - rx) * 0.8;
      r.update(0.016, { x: rx, y: ry - r.A.standH, vx: 0, vy: 0, grounded: true, facing: 1, mode: 'idle', groundY: ry });
    });
  }
  draw() {
    const g = this.g; g.clear();
    const x = this.x, y = this.y, col = 0x0b0b10;
    const tilt = this.air ? clamp(this.vy / 900, -0.25, 0.25) : 0;
    g.save?.();
    g.fillStyle(col, 1);
    if (this.boat) {
      g.beginPath(); g.moveTo(x - 56, y - 16); g.lineTo(x + 60, y - 18 + tilt * 30); g.lineTo(x + 40, y + 6); g.lineTo(x - 46, y + 6); g.closePath(); g.fillPath();
      g.fillRect(x - 60, y - 26, 10, 14);                       // motor
      if (this.started) {
        const sp = this.sc.add ? null : null; void sp;
      }
    } else {
      g.fillRoundedRect(x - 70, y - 40 + tilt * 20, 140, 24, 7);
      g.beginPath(); g.moveTo(x - 36, y - 38); g.lineTo(x - 16, y - 58); g.lineTo(x + 22, y - 58); g.lineTo(x + 42, y - 38); g.closePath(); g.fillPath();
      g.fillStyle(0x15161c, 1); g.fillCircle(x - 42, y - 12, 12); g.fillCircle(x + 42, y - 12, 12);
      // camlar — içindeki sürücü seçilsin
      g.fillStyle(0x2a2e38, 1);
      g.beginPath(); g.moveTo(x - 30, y - 40); g.lineTo(x - 14, y - 54); g.lineTo(x + 2, y - 54); g.lineTo(x + 2, y - 40); g.closePath(); g.fillPath();
      g.beginPath(); g.moveTo(x + 6, y - 40); g.lineTo(x + 6, y - 54); g.lineTo(x + 20, y - 54); g.lineTo(x + 36, y - 40); g.closePath(); g.fillPath();
      g.fillStyle(0xf0e8c8, 0.9); g.fillCircle(x + 68, y - 30, 3);
      g.fillStyle(col, 1);
    }
    // sürücü: baş + omuz (eğilince alçalır)
    if (this.started && !this.finished) {
      const hy = (this.boat ? y - 40 : y - 52) + this.duck * 18;
      g.fillStyle(col, 1);
      g.fillCircle(x + (this.boat ? -20 : -8), hy, 6.5);
      g.fillRoundedRect(x + (this.boat ? -30 : -18), hy + 5, 20, 16, 5);
    }
    if (this.boat && this.started && this.v > 60) {
      g.fillStyle(0x9fb2bf, 0.35);
      g.fillTriangle(x - 60, y - 2, x - 60 - this.v * 0.25, y + 2, x - 60, y + 6);
    }
  }
  drawObstacles() {
    const g = this.og; g.clear();
    const col = 0x0b0b10, sc = this.sc;
    for (const o of this.obs) {
      const x = o.x;
      if (o.crushed || o.boom) continue;
      switch (o.type) {
        case 'barricade': { const y = this.cfg.groundY; g.fillStyle(col, 1); g.fillRect(x - 6, y - 50, 12, 50); g.fillRect(x - 26, y - 40, 52, 9); g.fillRect(x - 22, y - 20, 44, 8); break; }
        case 'ramp': { const y = this.cfg.groundY; g.fillStyle(col, 1); g.fillTriangle(x - 50, y, x + 40, y - 34, x + 40, y); break; }
        case 'pipe': { const y = this.cfg.groundY; g.fillStyle(col, 1); g.fillRect(x - 70, y - 82, 140, 12); g.fillRect(x - 70, y - 300, 10, 230); g.fillRect(x + 60, y - 300, 10, 230); break; }
        case 'bridge': { const y = this.cfg.surfaceY; g.fillStyle(col, 1); g.fillRect(x - 90, y - 68, 180, 14); g.fillRect(x - 90, y - 68, 12, 90); g.fillRect(x + 78, y - 68, 12, 90); break; }
        case 'rocks': { const y = this.cfg.surfaceY; g.fillStyle(col, 1); g.fillTriangle(x - 30, y + 8, x - 8, y - 26, x + 14, y + 8); g.fillTriangle(x - 4, y + 8, x + 18, y - 16, x + 34, y + 8); break; }
        case 'mine': {
          const up = Math.sin(sc.time.now * 0.0018 + o.phase);
          const y = this.cfg.surfaceY - up * 14 + 6;
          g.fillStyle(col, 1); g.fillCircle(x, y, 13);
          for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.fillRect(x + Math.cos(a) * 13 - 2, y + Math.sin(a) * 13 - 2, 4, 4); }
          if (up > -0.2) { g.fillStyle(0xe8604a, 0.6 + Math.sin(sc.time.now * 0.02) * 0.3); g.fillCircle(x, y - 13, 2.5); }
          break;
        }
      }
    }
  }
}
