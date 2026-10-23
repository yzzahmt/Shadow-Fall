/* ============================================================
   SHADOW FALL — YENİ YARATIKLAR
   - Watcher  GÖZCÜ: tavandan / daldan sarkan koza, tek dev göz. Yalnız
              IŞIĞI görür (sağır). Fener ona değerse ya da aydınlıkta
              durursan gözü açılır; açılmadan karanlığa çekilirsen uyur.
              Tam açılırsa çığlık atar: çevredeki her şey sesine koşar.
   - Swarm    KEMİRGEN SÜRÜSÜ: karanlıkta avlanan küçük kemirgenler.
              Işıktan KAÇAR — fener üstlerine tutulunca dağılırlar.
              Koşu sesini duyar; karanlıkta ayaklarını kemirir.
   - Tracker  İZCİ: hem görür hem duyar; hızlı, boşluktan atlar, tırmanır.
              Gözden kaybedince son gördüğü yere gidip uzun süre arar.
   - Mimic    TAKLİTÇİ: sandık kılığında bekler, parıltısı bile aynı.
              Ele veren: ara sıra kapağı nefes alır gibi kalkar; fener
              tutulunca titrer. Yanına gelene saldırır.
   ============================================================ */
'use strict';

/* fener konisi bu noktaya değiyor mu (ortak) */
function flashHits(sc, x, y) {
  const L = sc.flashLight;
  if (!L || !L.on || !sc.flashOn) return false;
  const dx = x - L.x, dy = y - L.y;
  const along = dx * L.facing;
  if (along < -10 || along > L.r * 1.9) return false;
  return Math.abs(dy - along * Math.tan(L.angle ?? 0) * L.facing) < 26 + along * 0.55;
}

/* ---------------- GÖZCÜ ---------------- */
class Watcher {
  constructor(scene, cfg) {
    this.scene = scene; this.type = 'watcher';
    this.s = cfg.scale ?? 1;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.hangY = cfg.groundY - (cfg.hang ?? 210);
    this.minX = cfg.patrolMinX ?? cfg.x - 1; this.maxX = cfg.patrolMaxX ?? cfg.x + 1;
    this.terr = [this.minX, this.maxX];
    this.hp = cfg.hp ?? 2; this.maxHp = this.hp;
    this.facing = cfg.facing ?? -1;
    this.state = 'hang'; this.t = Math.random() * 10; this.eye = 0; this.wakeT = 0; this.coolT = 0;
    this.bodyR = 20 * this.s;
    this.dead = false; this.onStrike = null;
    this.gfx = scene.add.graphics().setDepth(96);
    this.eyeGfx = scene.add.graphics().setDepth(97);
    addRimGlow(this.gfx, 0x8a8a94, 1.0);
  }
  get y() { return this.hangY + 20 * this.s; }
  destroy() { this.gfx.destroy(); this.eyeGfx.destroy(); }
  hearNoise() {}                                    // sağır
  takeDamage(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.hp <= 0) { this.dead = true; this.state = 'dead'; this.fallY = this.y; this.vy = 0; SFAudio.creatureDie('watcher'); }
    else { SFAudio.creatureHit('watcher'); this.state = 'wake'; this.wakeT = 0.7; }
  }
  /* oyuncuyu görüyor mu: yalnız ışık */
  _sees(player) {
    const sc = this.scene;
    const dx = player.x - this.x, dist = Math.hypot(dx, player.y - this.y);
    const d = creatureDifficulty(sc);
    if (flashHits(sc, this.x, this.y)) return true;                       // fener değdi
    if (player.flashOn && dist < 380 + d * 160) return true;              // yanan feneri görür
    return visFactor(sc, player.x, player.y) > 0.6 && dist < 260 + d * 120 && !player.hidden;
  }
  update(dt, player) {
    this.t += dt;
    if (this.dead) {
      this.vy += 1400 * dt; this.fallY = Math.min(this.groundY - 8, this.fallY + this.vy * dt);
      this.gfx.setAlpha(Math.max(0, this.gfx.alpha - dt * 0.3));
      this.draw(); return;
    }
    const sees = this._sees(player);
    const d = creatureDifficulty(this.scene);
    switch (this.state) {
      case 'hang':
        this.eye = lerp(this.eye, 0.05, 1 - Math.exp(-dt * 3));
        if (sees) { this.state = 'wake'; this.wakeT = 0; SFAudio.lurkerWhisper?.(); }
        break;
      case 'wake':
        /* göz yavaşça açılır — bu sürede karanlığa çekilirsen uyur */
        this.wakeT += sees ? dt : -dt * 1.4;
        this.eye = clamp(this.wakeT / (1.1 - d * 0.35), 0, 1);
        if (this.wakeT <= 0) { this.state = 'hang'; this.wakeT = 0; }
        if (this.eye >= 1) this._alarm(player);
        break;
      case 'cool':
        this.coolT -= dt;
        this.eye = lerp(this.eye, 0.35, 1 - Math.exp(-dt * 2));
        if (this.coolT <= 0) this.state = 'hang';
        break;
    }
    this.draw();
  }
  _alarm(player) {
    const sc = this.scene;
    this.state = 'cool'; this.coolT = 7;
    SFAudio.screech?.(1.1);
    sc.cameras.main.shake(260, 0.006);
    creatureScare(this, 1);
    /* çığlık: çevredeki herkes oyuncunun olduğu yere koşar */
    sc.makeNoise(player.x, player.y, 1200, 1);
    for (const c of sc.creatures) {
      if (c === this || c.dead || Math.abs(c.x - player.x) > 1100) continue;
      c.investigate = { x: player.x, look: 5, t: 0 };
    }
    for (const s of sc.soldiers ?? []) if (!s.dead && Math.abs(s.x - player.x) < 1100) { s.lastSeenX = player.x; s.goAlert?.(true); }
  }
  draw() {
    const g = this.gfx, e = this.eyeGfx, s = this.s, col = 0x08080b;
    g.clear(); e.clear();
    const sway = Math.sin(this.t * 0.8) * 4 * s;
    const x = this.x + sway * 0.3, y = this.dead ? this.fallY : this.hangY + Math.sin(this.t * 1.1) * 2;
    if (!this.dead) {
      g.lineStyle(1.4, col, 1); g.beginPath(); g.moveTo(this.x, this.hangY - 320); g.lineTo(x, y - 30 * s); g.strokePath();
    }
    g.fillStyle(col, 1);
    g.fillEllipse(x, y, 30 * s, 58 * s);
    g.fillEllipse(x, y + 24 * s, 18 * s, 22 * s);
    g.lineStyle(1, 0x1c1d24, 0.9);
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x - 13 * s, y + i * 9 * s); g.lineTo(x + 13 * s, y + i * 9 * s + 3); g.strokePath(); }
    for (let i = 0; i < 5; i++) {                                     // sarkan lifler
      const fx = x - 8 * s + i * 4 * s;
      g.lineStyle(1, col, 1); g.beginPath(); g.moveTo(fx, y + 30 * s); g.lineTo(fx + Math.sin(this.t * 2 + i) * 3, y + (40 + (i % 3) * 8) * s); g.strokePath();
    }
    if (this.dead) return;
    /* dev göz: önce yarık, açılınca soluk iris ve kızıl bebek */
    const open = this.eye;
    e.fillStyle(0xd8d4c8, 0.15 + open * 0.75); e.fillEllipse(x, y - 4 * s, 18 * s, Math.max(1, 14 * s * open));
    if (open > 0.25) { e.fillStyle(0xc8483a, open); e.fillCircle(x + (this.state === 'wake' ? 0 : Math.sin(this.t) * 3), y - 4 * s, 3.2 * s * open); }
    if (open > 0.6) { e.fillStyle(0xd8d4c8, (open - 0.6) * 0.4); e.fillCircle(x, y - 4 * s, 26 * s); }
  }
}

/* ---------------- KEMİRGEN SÜRÜSÜ ---------------- */
class Swarm {
  constructor(scene, cfg) {
    this.scene = scene; this.type = 'swarm';
    this.s = cfg.scale ?? 1;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.minX = cfg.patrolMinX; this.maxX = cfg.patrolMaxX;
    this.terr = creatureTerritory(scene, cfg);
    this.noNav = true;
    const n = cfg.count ?? 10;
    this.rats = [];
    for (let i = 0; i < n; i++) this.rats.push({ x: this.x + (Math.random() - 0.5) * 120, vx: 0, ph: Math.random() * 6, f: 1, alive: true });
    this.hp = n; this.maxHp = n;
    this.facing = 1; this.vx = 0;
    this.state = 'idle'; this.t = 0; this.fleeT = 0; this.hitCD = 0;
    this.bodyR = 40; this.dead = false; this.onStrike = null;
    this.gfx = scene.add.graphics().setDepth(95);
    addRimGlow(this.gfx, 0x8a7a74, 1.2);
    this.eyeGfx = scene.add.graphics().setDepth(96);
  }
  get y() { return this.groundY - 6; }
  destroy() { this.gfx.destroy(); this.eyeGfx.destroy(); }
  hearNoise(x, power) {
    if (this.dead || this.state !== 'idle') return;
    if (power >= 0.3 && Math.abs(x - this.x) < 500) this.state = 'hunt';
  }
  takeDamage() {
    const live = this.rats.filter(r => r.alive);
    for (let i = 0; i < Math.min(3, live.length); i++) live[i].alive = false;
    SFAudio.creatureHit('swarm');
    this.state = 'flee'; this.fleeT = 1.2;
    if (!this.rats.some(r => r.alive)) { this.dead = true; this.state = 'dead'; SFAudio.creatureDie('swarm'); }
  }
  update(dt, player) {
    this.t += dt;
    const sc = this.scene;
    const live = this.rats.filter(r => r.alive);
    if (!live.length) { this.dead = true; this.gfx.clear(); this.eyeGfx.clear(); return; }
    this.x = live.reduce((a, r) => a + r.x, 0) / live.length;
    const dx = player.x - this.x, dist = Math.abs(dx);
    /* ışık: fener sürünün üstüne tutulursa ya da yakında yanıyorsa dağılırlar */
    const lit = flashHits(sc, this.x, this.groundY - 10) || (player.flashOn && dist < 130) || visFactor(sc, this.x, this.groundY - 10) > 0.75;
    if (lit && this.state !== 'flee') { this.state = 'flee'; SFAudio.creatureHit('swarm'); }
    if (lit) this.fleeT = 1.4;
    const feetNear = Math.abs(player.y + 30 - this.groundY) < 50;
    switch (this.state) {
      case 'idle':
        if (dist < creatureSense(this, player) && feetNear && visFactor(sc, player.x, player.y) < 0.5) this.state = 'hunt';
        break;
      case 'hunt':
        if (dist > 900) this.state = 'idle';
        break;
      case 'flee':
        this.fleeT -= dt;
        if (this.fleeT <= 0) this.state = dist < 500 ? 'hunt' : 'idle';
        break;
    }
    const speed = (150 + creatureDifficulty(sc) * 80) * this.s;
    this.hitCD -= dt;
    let biting = 0;
    for (const r of live) {
      r.ph += dt * 9;
      let want = 0;
      if (this.state === 'hunt') want = Math.sign(player.x - r.x) * speed * (0.8 + (r.ph % 1) * 0.4);
      else if (this.state === 'flee') want = -Math.sign(player.x - r.x || 1) * speed * 1.4;
      else want = ((this.minX + this.maxX) / 2 > r.x ? 18 : -18) + Math.sin(this.t * 0.7 + r.ph) * 22;
      r.vx = lerp(r.vx, want, 1 - Math.exp(-dt * 5));
      r.x = clamp(r.x + r.vx * dt, this.terr[0], this.terr[1]);
      if (Math.abs(r.vx) > 5) r.f = Math.sign(r.vx);
      if (this.state === 'hunt' && Math.abs(r.x - player.x) < 18 && feetNear) biting++;
    }
    if (biting >= 2 && this.hitCD <= 0) { this.hitCD = 1.3; this.onStrike?.(1); SFAudio.creatureHit('swarm'); }
    this.vx = this.state === 'hunt' ? Math.sign(dx) * speed : 0;
    this.draw(live);
  }
  draw(live) {
    const g = this.gfx, e = this.eyeGfx, col = 0x08080b, s = this.s;
    g.clear(); e.clear();
    g.fillStyle(col, 1); g.lineStyle(1, col, 1);
    for (const r of live) {
      const hop = Math.abs(Math.sin(r.ph)) * (Math.abs(r.vx) > 40 ? 3 : 0.6);
      const y = this.groundY - 4 * s - hop;
      g.fillEllipse(r.x, y, 13 * s, 6 * s);
      g.fillCircle(r.x + r.f * 6 * s, y - 1, 2.6 * s);
      g.beginPath(); g.moveTo(r.x - r.f * 6 * s, y + 1); g.lineTo(r.x - r.f * 14 * s, y + 2 + Math.sin(r.ph) * 2); g.strokePath();
      if (this.state === 'hunt') { e.fillStyle(0xc8483a, 0.85); e.fillCircle(r.x + r.f * 7.5 * s, y - 2, 0.9); }
    }
  }
}

/* ---------------- İZCİ ---------------- */
class Tracker extends Lurker {
  constructor(scene, cfg) {
    super(scene, { ...cfg, scale: cfg.scale ?? 1.05 });
    this.type = 'tracker';
    this.stareDur = 0.45;          // fark edince neredeyse hemen atılır
    this.choppy = false;           // akıcı, hızlı
    this.chaseSpeed = cfg.chaseSpeed ?? 285;
  }
}

/* ---------------- TAKLİTÇİ ---------------- */
class Mimic {
  constructor(scene, cfg) {
    this.scene = scene; this.type = 'mimic';
    this.s = cfg.scale ?? 1;
    this.x = cfg.x; this.homeX = cfg.x; this.groundY = cfg.groundY;
    this.minX = cfg.patrolMinX ?? cfg.x - 200; this.maxX = cfg.patrolMaxX ?? cfg.x + 200;
    this.terr = creatureTerritory(scene, cfg);
    this.hp = cfg.hp ?? 4; this.maxHp = this.hp;
    this.facing = -1; this.vx = 0;
    this.state = 'disguise'; this.t = Math.random() * 10; this.open = 0; this.legs = 0; this.shiver = 0;
    this.biteT = 0; this.bodyR = 30; this.dead = false; this.onStrike = null;
    this.gfx = scene.add.graphics().setDepth(64);
    this.glow = scene.add.graphics().setDepth(63);
    this.eyeGfx = scene.add.graphics().setDepth(65);
  }
  get y() { return this.groundY - 18 - this.legs * 16; }
  destroy() { this.gfx.destroy(); this.glow.destroy(); this.eyeGfx.destroy(); }
  hearNoise(x, power) { if (this.state === 'disguise' && power >= 0.9 && Math.abs(x - this.x) < 160) this._reveal(); }
  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.state === 'disguise') this._reveal();
    if (this.hp <= 0) { this.dead = true; this.state = 'dead'; this.deathT = 0; SFAudio.creatureDie('mimic'); }
    else SFAudio.creatureHit('mimic');
    void dir;
  }
  _reveal() {
    this.state = 'bite'; this.biteT = 0;
    SFAudio.monsterRoar(false); SFAudio.crateBurst?.();
    creatureScare(this, 1.1);
  }
  update(dt, player) {
    this.t += dt;
    if (this.dead) {
      this.deathT += dt;
      this.legs = lerp(this.legs, 0, 1 - Math.exp(-dt * 4));
      this.gfx.setAlpha(Math.max(0, 1 - (this.deathT - 1.5) * 0.7));
      this.glow.clear(); this.eyeGfx.clear(); this.draw(); return;
    }
    const dx = player.x - this.x, dist = Math.abs(dx);
    const feetNear = Math.abs(player.y + 30 - this.groundY) < 60;
    switch (this.state) {
      case 'disguise': {
        /* ele veren işaretler: nefes, fenerde titreme */
        this.open = Math.max(0, Math.sin(this.t * 0.9)) ** 8 * 0.12;
        this.shiver = flashHits(this.scene, this.x, this.groundY - 18) ? 1 : Math.max(0, this.shiver - dt * 2);
        if (dist < 64 && feetNear) this._reveal();
        break;
      }
      case 'bite':
        this.biteT += dt;
        this.facing = dx > 0 ? 1 : -1;
        this.open = Math.min(1, this.biteT * 5);
        this.legs = Math.min(1, this.biteT * 3);
        if (this.biteT > 0.28 && !this._bit) {
          this._bit = true;
          if (dist < 80 && feetNear) this.onStrike?.(2);
          SFAudio.thud(0.9);
        }
        if (this.biteT > 0.8) { this.state = 'chase'; this._bit = false; }
        break;
      case 'chase':
        this.facing = dx > 0 ? 1 : -1;
        this.vx = this.facing * (190 + creatureDifficulty(this.scene) * 60);
        this.open = 0.5 + Math.sin(this.t * 14) * 0.3;
        if (dist < 50 && feetNear) { this.state = 'bite'; this.biteT = 0.1; }
        if (creatureGiveUp(this, player, dt)) this.state = 'return';
        break;
      case 'return': {
        const hx = this.homeX - this.x;
        this.facing = Math.sign(hx) || 1;
        this.vx = Math.abs(hx) > 10 ? this.facing * 120 : 0;
        this.open = lerp(this.open, 0, 1 - Math.exp(-dt * 3));
        if (Math.abs(hx) <= 10) { this.state = 'disguise'; this.vx = 0; }
        if (dist < 240 && creatureCanReach(this, player)) this.state = 'chase';
        break;
      }
    }
    if (this.state === 'disguise' || this.state === 'bite') this.vx = 0;
    else { this.x += this.vx * dt; creatureClamp(this); }
    if (this.state === 'disguise' || this.state === 'return') this.legs = lerp(this.legs, this.state === 'return' ? 1 : 0, 1 - Math.exp(-dt * 4));
    /* sandık parıltısı: gerçek saklama yerleriyle aynı */
    const gl = this.glow; gl.clear();
    if (this.state === 'disguise') { gl.fillStyle(0xd8d4c8, 0.035 + Math.abs(Math.sin(this.t * 1.1)) * 0.045); gl.fillCircle(this.x, this.groundY - 18, 20); }
    this.draw();
  }
  draw() {
    const g = this.gfx, e = this.eyeGfx, c = 0x0c0c11, edge = 0x1d1e26, s = this.s;
    g.clear(); e.clear();
    const lift = this.legs * 16;
    const jit = this.shiver ? (Math.random() - 0.5) * 2 : 0;
    const x = this.x + jit, gy = this.groundY - lift;
    /* bacaklar */
    if (this.legs > 0.05) {
      g.lineStyle(2.4, c, 1);
      for (let i = 0; i < 6; i++) {
        const lx = x - 24 + i * 9.6, ph = this.t * 12 + i * 1.3;
        const step = Math.abs(this.vx) > 10 ? Math.sin(ph) * 6 : 0;
        g.beginPath(); g.moveTo(lx, gy - 4); g.lineTo(lx + (i < 3 ? -8 : 8) + step, gy + lift * 0.4 - 6); g.lineTo(lx + (i < 3 ? -6 : 6) + step, this.groundY); g.strokePath();
      }
    }
    /* sandık gövdesi (SANDIĞI AÇ ile aynı biçim) */
    g.fillStyle(c, 1); g.lineStyle(1.2, edge, 0.9);
    g.fillRect(x - 29 * s, gy - 30 * s, 58 * s, 30 * s);
    g.strokeRect(x - 26 * s, gy - 27 * s, 52 * s, 24 * s);
    /* kapak — açılınca dişler */
    const a = this.open * 1.1;
    const hx = x - this.facing * 29 * s, hy = gy - 30 * s;
    const ex = hx + this.facing * Math.cos(a) * 58 * s, ey = hy - Math.sin(a) * 58 * s;
    g.lineStyle(7, c, 1); g.beginPath(); g.moveTo(hx, hy - 3); g.lineTo(ex, ey - 3); g.strokePath();
    if (this.open > 0.15) {
      g.fillStyle(0x050507, 1); g.fillRect(x - 27 * s, gy - 30 * s, 54 * s, 8 * s);
      g.fillStyle(0xbab4a8, 0.9);
      for (let i = 0; i < 6; i++) {
        const tx = x - 24 * s + i * 9 * s;
        g.fillTriangle(tx, gy - 30 * s, tx + 6 * s, gy - 30 * s, tx + 3 * s, gy - 24 * s);
        const u = (i + 0.5) / 6, lx = lerp(hx, ex, u), ly = lerp(hy, ey, u);
        g.fillTriangle(lx - 3, ly, lx + 3, ly, lx + this.facing * Math.sin(a) * 6, ly + Math.cos(a) * 6);
      }
      e.fillStyle(0xc8483a, 0.9); e.fillCircle(x + this.facing * 8 * s, gy - 27 * s, 2); e.fillCircle(x + this.facing * 15 * s, gy - 27 * s, 1.6);
    } else if (this.shiver > 0.2 || this.open > 0.05) {
      e.fillStyle(0xc8483a, 0.35 + this.shiver * 0.4); e.fillRect(x - 10 * s, gy - 31 * s, 20 * s, 1.2);   // aralıktan kızıl parıltı
    }
  }
}
