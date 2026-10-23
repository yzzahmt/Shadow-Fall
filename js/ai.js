/* ============================================================
   SHADOW FALL — YARATIK ZEKÂSI (ortak katman)
   Eskiden her yaratık doğduğu zemin şeridine kilitliydi: şeridin ucuna
   gelince görünmez bir duvara çarpmış gibi dururdu. Artık:
   • GEZİNME: zemin ve platformlardan bir yüzey ağı kurulur. Her türün
     kendi yeteneği var (atlama mesafesi, tırmanma, inme). Kovalarken
     boşluktan atlar, basamağı tırmanır, platformdan iner; duvara ve
     kapalı kapıya gerçekten çarpar. Ulaşamıyorsa kenarda volta atar.
   • DUYULAR: her tür farklı algılar (CREATURE_SENSES): kimi ışığa bakar,
     kimi sese, kimi ikisine. Arkası dönükken görmez.
   • HAFIZA: gözden kaybedince son gördüğü yere gidip arar; ses duyunca
     sesin geldiği yere gider, etrafa bakar, sonra yuvasına döner.
   • ZORLUK: bölüm ilerledikçe algı menzili ve hız artar.
   ============================================================ */
'use strict';

/* hareket yetenekleri (px): yatay atlama, yukarı atlama, tırmanma, inme */
const CREATURE_ABILITY = {
  stalker: { jumpX: 120, jumpUp: 80,  climb: 45,  drop: 230 },
  hound:   { jumpX: 200, jumpUp: 120, climb: 60,  drop: 260 },
  lurker:  { jumpX: 150, jumpUp: 170, climb: 130, drop: 320 },   // uzun kollarıyla tırmanır
  crawler: { jumpX: 60,  jumpUp: 40,  climb: 220, drop: 220 },   // duvara yapışıp sürünür
  brute:   { jumpX: 0,   jumpUp: 0,   climb: 30,  drop: 120 },   // ağır: atlayamaz
  tracker: { jumpX: 210, jumpUp: 170, climb: 120, drop: 320 },
  swarm:   { jumpX: 40,  jumpUp: 30,  climb: 260, drop: 200 },
  mimic:   { jumpX: 80,  jumpUp: 40,  climb: 40,  drop: 180 },
};
/* duyular: sight = ışığa bağlı görüş, hear = ses / titreşim. light: fenere tepkisi */
const CREATURE_SENSES = {
  stalker: { sight: 1.0,  hear: 0.6 },
  hound:   { sight: 0.5,  hear: 1.25 },          // koku + kulak
  lurker:  { sight: 0.85, hear: 0.95 },
  crawler: { sight: 0,    hear: 1.3 },           // kör — titreşim
  brute:   { sight: 1.2,  hear: 0.25, lightMul: 1.6 },   // sağıra yakın, fenere saldırır
  wraith:  { sight: 0.6,  hear: 0.8 },
  tracker: { sight: 1.1,  hear: 1.1, lightMul: 1.3 },
  swarm:   { sight: 0,    hear: 0.9 },
  watcher: { sight: 1.4,  hear: 0, lightMul: 2 },
  mimic:   { sight: 0,    hear: 0.5 },
};
const CREATURE_IDLE = new Set(['lurk', 'prowl', 'wander', 'idle', 'dead', 'drift', 'disguise', 'hang']);

function creatureDifficulty(sc) { return clamp((sc.ch?.id ?? 1) / 100, 0, 1); }

/* algı menzili: ışığa (görüş) ve sese (işitme) göre; zorlukla büyür */
function creatureSense(cr, player) {
  const S = CREATURE_SENSES[cr.type] ?? { sight: 1, hear: 1 };
  const d = creatureDifficulty(cr.scene);
  const vf = visFactor(cr.scene, player.x, player.y);
  const facing = Math.sign(player.x - cr.x) === cr.facing || Math.abs(player.x - cr.x) < 50;
  let sight = S.sight * (110 + 380 * vf) * (facing ? 1 : 0.3);
  if (player.flashOn && facing) sight += S.sight * 170 * (S.lightMul ?? 1);
  if (player.crouching) sight *= 0.7;
  if (player.hidden) sight *= 0.2;
  const moving = Math.abs(player.vx ?? 0) > 0.3;
  const hear = S.hear * (player.noisy ? 470 : moving && !player.crouching ? 175 : moving ? 55 : 0);
  return Math.max(sight, hear) * (0.85 + d * 0.5);
}

/* ses duyuldu: boşta ise sesin geldiği yere gidip bakar */
function creatureHeard(cr, x, power, radius) {
  if (cr.dead || cr.chaser || !CREATURE_IDLE.has(cr.state)) return;
  const S = CREATURE_SENSES[cr.type] ?? { hear: 1 };
  if (!S.hear || power * S.hear < 0.14) return;
  if (Math.abs(x - cr.x) > radius * (0.6 + S.hear * 0.4)) return;
  cr.investigate = { x, look: 2.5 + Math.random() * 2, t: 0 };
}

/* ============================================================
   YÜZEY AĞI
   ============================================================ */
class CreatureNav {
  static get(sc) {
    if (!sc.groundSegs) return null;
    const now = sc.time?.now ?? 0;
    if (!sc._nav || now - sc._nav.t > 600) sc._nav = new CreatureNav(sc, now);
    return sc._nav;
  }
  constructor(sc, now) {
    this.sc = sc; this.t = now;
    this.S = [];
    for (const g of sc.groundSegs) if (g.y < 700 && g.x1 - g.x0 > 8) this.S.push({ x0: g.x0, x1: g.x1, y: g.y });
    for (const p of sc.platforms ?? []) {
      if (p.ceiling || p.look === 'branch' || p.look === 'beam' || p.w < 40) continue;
      this.S.push({ x0: p.x, x1: p.x + p.w, y: p.y, plat: true });
    }
    this.S.forEach((s, i) => { s.id = i; });
    this.adj = {};
    this.reach = {};
    /* duvar / kapalı kapılar: yüzey üstünde gövde hizasını kesenler */
    this.blockers = [];
    for (const w of sc.ch?.walls ?? []) this.blockers.push({ x: w.x, y0: w.y0, y1: w.y1, half: w.look === 'log' ? 52 : 11 });
    for (const d of sc.doors ?? []) if (!d.open) this.blockers.push({ x: d.x, y0: d.groundY - (d.h ?? 120), y1: d.groundY, half: 10 });
    for (const pd of sc.poweredDoors ?? []) if (!pd.open) this.blockers.push({ x: pd.x, y0: pd.y - pd.h, y1: pd.y, half: 8 });
    for (const p of sc.pz ?? []) if (p.D && p.D.open < 0.6) this.blockers.push({ x: p.D.x, y0: p.D.y - p.D.h, y1: p.D.y, half: 10 });
  }
  /* (x, y) noktasının altındaki yüzey */
  under(x, y, tol = 14) {
    let best = null, bd = 1e9;
    for (const s of this.S) {
      if (x < s.x0 - 3 || x > s.x1 + 3) continue;
      const d = s.y - y;
      if (d < -tol || d > 60) continue;
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = s; }
    }
    return best;
  }
  same(a, b) { return a && b && Math.abs(a.x0 - b.x0) < 1 && Math.abs(a.x1 - b.x1) < 1 && Math.abs(a.y - b.y) < 1; }
  /* s'den t'ye geçiş türü (yoksa null) */
  link(s, t, ab) {
    if (s === t) return null;
    const dy = t.y - s.y;                               // + : aşağı
    const overlap = t.x0 < s.x1 - 4 && t.x1 > s.x0 + 4;
    if (overlap) {
      if (dy < -8 && -dy <= Math.max(ab.climb, ab.jumpUp)) return 'up';
      if (dy > 8 && dy <= ab.drop && (s.x0 > t.x0 + 6 || s.x1 < t.x1 - 6)) return 'down';
      return null;
    }
    const gap = t.x0 >= s.x1 - 4 ? t.x0 - s.x1 : s.x0 - t.x1;
    if (gap <= 8 && Math.abs(dy) <= 10) return 'walk';
    if (gap <= 40 && dy < 0 && -dy <= ab.climb) return 'climb';
    if (gap <= 40 && dy > 0 && dy <= ab.drop) return 'drop';
    if (ab.jumpX > 0 && gap <= ab.jumpX + Math.max(0, dy) * 0.4 && dy >= -ab.jumpUp && dy <= ab.drop) return 'jump';
    return null;
  }
  neighbors(s, ab, key) {
    const A = this.adj[key] ?? (this.adj[key] = {});
    if (A[s.id]) return A[s.id];
    const out = [];
    for (const t of this.S) { const k = this.link(s, t, ab); if (k) out.push({ t, k }); }
    return (A[s.id] = out);
  }
  reachable(from, to, ab, key) {
    if (!from || !to) return true;
    if (from === to) return true;
    const R = this.reach[key + ':' + from.id];
    if (R) return R.has(to.id);
    const seen = new Set([from.id]), q = [from];
    while (q.length) {
      const s = q.shift();
      for (const { t } of this.neighbors(s, ab, key)) if (!seen.has(t.id)) { seen.add(t.id); q.push(t); }
    }
    this.reach[key + ':' + from.id] = seen;
    return seen.has(to.id);
  }
  /* kenarda: dir yönünde geçilebilecek en uygun yüzey (hedef yüksekliğine yakın olan) */
  next(s, dir, ab, key, targetY) {
    let best = null, bs = 1e9;
    for (const n of this.neighbors(s, ab, key)) {
      if (n.k === 'up') continue;
      const t = n.t;
      const ahead = dir > 0 ? t.x1 > s.x1 - 2 : t.x0 < s.x0 + 2;
      if (!ahead) continue;
      const gap = dir > 0 ? Math.max(0, t.x0 - s.x1) : Math.max(0, s.x0 - t.x1);
      const score = gap + Math.abs(t.y - (targetY ?? s.y)) * 0.8 + (n.k === 'jump' ? 40 : 0);
      if (score < bs) { bs = score; best = n; }
    }
    return best;
  }
  /* prev → x arasında gövdeyi kesen engel */
  blocker(prev, x, y) {
    const lo = Math.min(prev, x), hi = Math.max(prev, x);
    for (const b of this.blockers) {
      if (b.y1 < y - 30 || b.y0 > y - 20) continue;
      const bx0 = b.x - b.half, bx1 = b.x + b.half;
      if (hi + 10 >= bx0 && lo - 10 <= bx1) return b;
    }
    return null;
  }
}

function creatureAbility(cr) {
  const ab = CREATURE_ABILITY[cr.type] ?? CREATURE_ABILITY.stalker;
  return cr.noLeap ? { ...ab, jumpX: 0, jumpUp: 0 } : ab;
}
function creatureNavKey(cr) { return cr.type + (cr.noLeap ? '!' : ''); }

/* oyuncunun durduğu yüzey (havadaysa son bilinen) */
function playerSurface(nav, player) {
  const feet = player.y + (player.crouching ? 15 : 30);
  return nav.under(player.x, feet, 40);
}

/* ============================================================
   HAREKET — her yaratık x'ini değiştirdikten sonra çağırır
   ============================================================ */
function creatureClamp(cr) {
  const sc = cr.scene;
  const nav = cr.noNav || cr.type === 'wraith' ? null : CreatureNav.get(sc);
  if (!nav) {
    const chasing = !CREATURE_IDLE.has(cr.state);
    const lo = chasing ? cr.terr[0] : cr.minX - 60, hi = chasing ? cr.terr[1] : cr.maxX + 60;
    cr.x = clamp(cr.x, lo, hi);
    return;
  }
  const dt = Math.min(0.05, (sc.game?.loop?.delta ?? 16) / 1000);
  const ab = creatureAbility(cr), key = creatureNavKey(cr);

  /* havada: yay çizerek atlıyor */
  if (cr.leap) {
    const L = cr.leap;
    L.t += dt;
    const u = Math.min(1, L.t / L.dur);
    cr.x = lerp(L.x0, L.x1, u);
    cr.groundY = lerp(L.y0, L.y1, u) - L.h * 4 * u * (1 - u);
    cr.facing = Math.sign(L.x1 - L.x0) || cr.facing;
    if (u >= 1) {
      cr.leap = null; cr.groundY = L.y1; cr.surf = L.to;
      SFAudio.thud?.(0.35);
    }
    cr._lastX = cr.x;
    return;
  }

  const prev = cr._lastX ?? cr.x;
  let s = cr.surf;
  if (!s || !nav.S.some(q => nav.same(q, s))) s = cr.surf = nav.under(prev, cr.groundY, 20);
  else s = cr.surf = nav.S.find(q => nav.same(q, s));
  const chasing = !CREATURE_IDLE.has(cr.state);
  const P = sc.player;
  let x = cr.x;

  /* zorluk: geç bölümlerde daha hızlı */
  if (chasing) x = prev + (x - prev) * (0.92 + creatureDifficulty(sc) * 0.33);

  /* ses araştırma: sesin geldiği yere yürür, etrafa bakar, döner */
  let roaming = chasing;
  if (!chasing && cr.investigate) {
    const I = cr.investigate;
    const dx = I.x - prev;
    if (Math.abs(dx) > 24 && !cr.blocked) {
      const dir = Math.sign(dx);
      x = prev + dir * Math.min(Math.abs(dx), 70 * (cr.s ?? 1) * dt * 1.4);
      cr.facing = dir;
    } else {
      x = prev;
      I.t += dt;
      if (Math.floor(I.t / 1.1) % 2 === 1) cr.facing = -Math.sign(dx || cr.facing) || 1;
      if (I.t > I.look) cr.investigate = null;
    }
    roaming = true;
  } else if (!chasing) {
    const out = prev < cr.minX - 60 || prev > cr.maxX + 60;
    if (!out) x = clamp(x, cr.minX - 60, cr.maxX + 60);
    roaming = out;
  }

  if (!s) { cr.x = x; cr._lastX = x; return; }
  cr.blocked = false;
  const dir = Math.sign(x - prev);

  /* kovalarken oyuncu üstteki / alttaki çakışan yüzeyde ve yakınsa: tırman / atla */
  if (chasing && P && !cr.chaser) {
    const ps = playerSurface(nav, { x: P.body.position.x, y: P.body.position.y, crouching: P.crouching });
    if (ps && ps !== s && Math.abs(P.body.position.x - x) < 90) {
      const k = nav.link(s, ps, ab);
      if (k === 'up' || k === 'down') {
        const lx = clamp(P.body.position.x - Math.sign(P.body.position.x - x) * 30, ps.x0 + 10, ps.x1 - 10);
        startLeap(cr, x, s.y, lx, ps, ps.y - s.y);
        return;
      }
    }
  }

  /* duvar / kapalı kapı */
  const b = dir ? nav.blocker(prev, x, s.y) : null;
  if (b) {
    const hop = s.y - b.y0;
    if (roaming && ab.jumpUp >= hop && hop < 90) {
      startLeap(cr, prev, s.y, b.x + dir * (b.half + 26), s, -hop);
      return;
    }
    x = b.x - dir * (b.half + 18 * (cr.s ?? 1));
    cr.blocked = true;
  }

  /* yüzeyin ucu */
  if (x > s.x1 - 4 || x < s.x0 + 4) {
    const edgeDir = x > s.x1 - 4 ? 1 : -1;
    const ty = chasing && P ? P.body.position.y + 30 : (cr.homeY ?? s.y);
    const n = roaming ? nav.next(s, edgeDir, ab, key, ty) : null;
    if (n && (n.k === 'walk' || n.k === 'climb' || n.k === 'drop')) {
      cr.surf = n.t;
      if (n.k === 'walk') cr.groundY = n.t.y;
      else { startLeap(cr, x, s.y, edgeDir > 0 ? n.t.x0 + 14 : n.t.x1 - 14, n.t, n.t.y - s.y); return; }
    } else if (n && n.k === 'jump') {
      const edgeX = edgeDir > 0 ? s.x1 - 6 : s.x0 + 6;
      startLeap(cr, edgeX, s.y, edgeDir > 0 ? n.t.x0 + 16 : n.t.x1 - 16, n.t, n.t.y - s.y);
      return;
    } else {
      x = clamp(x, s.x0 + 6, s.x1 - 6);
      cr.blocked = true;
    }
  }
  /* kenarda volta: ulaşamadığı yerde donmaz, ileri geri gidip bakar */
  if (cr.blocked && chasing) {
    cr.edgeT = (cr.edgeT ?? 0) + dt;
    x -= dir * Math.abs(Math.sin(cr.edgeT * 2.2)) * 26;
  } else cr.edgeT = 0;

  if (!cr.leap && Math.abs(cr.groundY - s.y) > 0.5) cr.groundY = lerp(cr.groundY, s.y, 1 - Math.exp(-dt * 14));
  cr.x = x; cr._lastX = x;
  if (cr.homeY == null) cr.homeY = s.y;
}

function startLeap(cr, x0, y0, x1, to, dy) {
  const hd = Math.abs(x1 - x0);
  cr.leap = { x0, y0, x1, y1: to.y, to, t: 0, h: 34 + Math.max(0, -dy) * 1.05 + hd * 0.12, dur: clamp(0.3 + hd / 520 + Math.abs(dy) / 900, 0.32, 0.9) };
  cr.x = x0; cr._lastX = x0;
  SFAudio.itemHit?.('wood', 0.12);
}

/* oyuncuya ulaşabilir mi: aynı yüzey ağında mı ve dikeyde çok uzak değil */
function creatureCanReach(cr, player) {
  const nav = cr.noNav || cr.type === 'wraith' ? null : CreatureNav.get(cr.scene);
  if (!nav) {
    const [lo, hi] = cr.terr;
    return player.x > lo - 12 && player.x < hi + 12 && player.y > cr.groundY - 240 && Math.abs(player.x - cr.x) < 1500;
  }
  if (Math.abs(player.x - cr.x) > 1600) return false;
  const ps = playerSurface(nav, player);
  if (!ps) return cr._reach ?? true;                     // oyuncu havada: son karar geçerli
  const cs = cr.surf ?? nav.under(cr.x, cr.groundY, 20);
  cr._reach = nav.reachable(cs, ps, creatureAbility(cr), creatureNavKey(cr));
  return cr._reach;
}

/* kovalarken: ulaşamıyorsa ya da uzun süre algılayamıyorsa vazgeçer —
   ama hemen yuvasına dönmez: son bilinen yerde etrafa bakar */
function creatureGiveUp(cr, player, dt) {
  const reach = creatureCanReach(cr, player);
  if (!cr.chaser) {
    const dist = Math.abs(player.x - cr.x);
    if (dist < creatureSense(cr, player) * 1.15 || dist < 90) { cr.lostT = 0; cr.lastKnownX = player.x; }
    else cr.lostT = (cr.lostT ?? 0) + dt;
    if (cr.lostT > (cr.type === 'tracker' ? 9 : 4.5)) {
      cr.lostT = 0;
      cr.investigate = { x: cr.lastKnownX ?? player.x, look: 4, t: 0 };
      return true;
    }
  }
  if (reach) { cr.loseT = 0; return false; }
  cr.loseT = (cr.loseT ?? 0) + dt;
  if (cr.loseT > 0.2 && !cr._roaredLost) { cr._roaredLost = true; SFAudio.monsterRoar(false); }
  if (cr.loseT > 3) {
    cr.loseT = 0; cr._roaredLost = false;
    cr.investigate = { x: cr.x, look: 2.5, t: 0 };
    return true;
  }
  return false;
}
