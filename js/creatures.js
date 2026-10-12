/* ============================================================
   SHADOW FALL — Creatures v2
   - Stalker: Kök Canavarı — kambur, uzun kollu, dal boynuzlu (+ boss varyantı)
   - Hound: 4 bacaklı hızlı tazı — atılarak saldırır
   - Lurker: uzun insansı gölge — dört ayak koşusuna geçer
   - Soldier: devriye + fener konisi + karanlık farkındalığı, ses takibi,
     arama, kuşatma, şarjör değiştirir, araba anahtarı taşıyabilir
   Hepsi hearNoise(x, güç) ile sahnedeki seslere tepki verir.
   Tüm yaratıklar ışık seviyesine göre algılar: zifiri karanlıkta
   fener kapalıysa oyuncu görünmezdir.
   ============================================================ */
'use strict';

/* ortak: ışığa göre görüş çarpanı */
function visFactor(scene, px, py) {
  if (!scene.lights2) return 1;
  const lv = scene.lights2.levelAt(px, py);
  return 0.18 + 0.82 * lv;   // zifiri karanlıkta %18 menzil
}

/* ortak: yaratık ilk kez fark ettiğinde korku vurgusu (çığlık + ekran) */
function creatureScare(cr, power = 1) {
  if (cr._scared) return;
  cr._scared = true;
  cr.scene.scare?.(cr.x, power);
}

/* ---------------- STALKER (Kök Canavarı) ----------------
   Ormanın kendisinden doğmuş kambur yaratık: uzun ön kollarıyla parmak
   eklemleri üstünde yürür (goril gibi), arka bacakları kısa ve kalın,
   sırtından kökler sarkar, başında geyik boynuzunu andıran kuru dallar,
   yüzünde tek bir kızıl yarık göz. Fark edince arka ayakları üstüne
   kalkıp kollarını açar. Ölünce yığılır, kökleri toprağa çöker. */
class Stalker {
  /** cfg: { x, groundY, scale, patrolMinX, patrolMaxX, hp, boss, name, charges } */
  constructor(scene, cfg) {
    this.scene = scene;
    this.type = 'stalker';
    this.x = cfg.x; this.y = cfg.groundY - 80;
    this.s = cfg.scale ?? 1.6;
    this.groundY = cfg.groundY;
    this.minX = cfg.patrolMinX; this.maxX = cfg.patrolMaxX;
    this.gfx = scene.add.graphics().setDepth(95);
    this.eyeGfx = scene.add.graphics().setDepth(96);
    addRimGlow(this.gfx, 0x8a6a64, 1.1);

    this.hp = cfg.hp ?? 6;
    this.maxHp = this.hp;
    this.boss = !!cfg.boss;
    this.name = cfg.name;
    this.canCharge = cfg.charges ?? this.boss;
    this.chaseSpeed = cfg.chaseSpeed;

    this.bodyR = 22 * this.s;
    this.facing = cfg.facing ?? 1;
    this.vx = 0;
    this.state = cfg.startChase ? 'chase' : 'lurk';
    this.alertT = 0; this.strikeT = 0; this.chargeT = 0; this.stunT = 0;
    this.roarCD = 0;
    this.breathe = Math.random() * 10;
    this.twitchT = 0; this.twitch = 0;
    this.rear = 0;                      // tehdit pozu 0..1
    this.dead = false;
    this.onStrike = null;

    /* 4 uzuv: 2 uzun ön kol (side +1), 2 kısa arka bacak (side -1); her çiftin biri arka planda */
    this.legs = [];
    const s0 = this.s;
    const defs = [
      { side: 1, back: true,  hip: [12, -12], rest: 30, l1: 30, l2: 31 },
      { side: 1, back: false, hip: [15, -11], rest: 40, l1: 30, l2: 31 },
      { side: -1, back: true,  hip: [-17, 1], rest: -14, l1: 21, l2: 22 },
      { side: -1, back: false, hip: [-20, 2], rest: -24, l1: 21, l2: 22 },
    ];
    defs.forEach((d, i) => {
      this.legs.push({
        side: d.side, k: 0, idx: i, back: d.back,
        hipOff: { x: d.hip[0] * s0, y: d.hip[1] * s0 },
        restOff: d.rest * s0,
        footX: this.x, footY: this.groundY,
        startX: this.x, startY: this.groundY, targetX: this.x, targetY: this.groundY,
        progress: 1, stepping: false,
        l1: d.l1 * s0, l2: d.l2 * s0,
      });
    });
    this.roots = [];                              // sırttan sarkan kök lifleri
    for (let i = 0; i < 9; i++) this.roots.push({ t: 0.12 + i * 0.1, len: (10 + (i * 7) % 13) * s0, ph: i * 1.7 });
    for (const leg of this.legs) {
      leg.footX = this.x + leg.restOff * this.facing; leg.footY = this.groundY;
    }
  }

  destroy() { this.gfx.destroy(); this.eyeGfx.destroy(); }

  /* ses duydu: başını sese çevirir; yüksek ses uyandırır */
  hearNoise(x, power) {
    if (this.dead || this.state !== 'lurk') return;
    this.facing = x > this.x ? 1 : -1;
    if (power >= 0.6 && x > this.minX - 120 && x < this.maxX + 120) {
      this.state = 'alert'; this.alertT = 0;
      creatureScare(this, this.boss ? 1.2 : 0.9);
    }
  }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = Math.max(this.stunT, 0.22);
    this.twitch = 1;
    SFAudio.monsterRoar(false);
    if (this.state === 'lurk') { this.state = 'alert'; this.alertT = 0; creatureScare(this, 0.8); }
    if (this.hp <= 0) this.die(dir);
  }

  die(dir = 0) {
    this.dead = true;
    this.state = 'dead';
    SFAudio.screech?.(0.7);
    this.scene.cameras.main.shake(500, 0.012);
    this.deathT = 0;
  }

  update(dt, player) {
    this.breathe += dt;
    this.roarCD -= dt;
    this.twitch = Math.max(0, this.twitch - dt * 4);
    if (this.dead) {
      this.deathT = (this.deathT ?? 0) + dt;
      this.y = lerp(this.y, this.groundY - 10 * this.s, 1 - Math.exp(-dt * 3));
      this.gfx.setAlpha(Math.max(0, 1 - (this.deathT - 2.2) * 0.6));
      this.eyeGfx.clear();
      this.draw();
      return;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.vx = 0; this.draw(); return; }

    /* ürkütücü tikler: arada bir tüm gövde sarsılır */
    this.twitchT -= dt;
    if (this.twitchT <= 0) { this.twitchT = 1.5 + Math.random() * 3; this.twitch = 0.6 + Math.random() * 0.4; }

    const px = player.x, py = player.y;
    const dx = px - this.x;
    const dist = Math.abs(dx);
    const vf = visFactor(this.scene, px, py);
    const playerInRoom = px > this.minX - 80 && px < this.maxX + 80;
    const senseDist = 420 * vf + (player.crouching ? 0 : 60) + (player.noisy ? 140 : 0);
    let rearT = 0;

    switch (this.state) {
      case 'lurk': {
        this.vx = Math.sin(this.breathe * 0.5) * 8;
        if (playerInRoom && dist < senseDist) {
          this.state = 'alert'; this.alertT = 0;
          creatureScare(this, this.boss ? 1.2 : 1);
          this.roarCD = 6;
        }
        break;
      }
      case 'alert': {
        /* tehdit pozu: ön bacaklar havada, dişler açılır */
        this.alertT += dt;
        this.facing = dx > 0 ? 1 : -1;
        this.vx = 0;
        rearT = 1;
        if (this.alertT > 1.0) this.state = (this.canCharge && dist > 320 && Math.random() < 0.5) ? 'charge' : 'chase';
        if (this.state === 'charge') { this.chargeT = 0; SFAudio.monsterRoar(true); }
        break;
      }
      case 'chase': {
        this.facing = dx > 0 ? 1 : -1;
        this.vx = this.facing * (this.chaseSpeed ?? 175 * this.s * 0.8);
        if (!playerInRoom || dist > Math.max(700, senseDist + 250)) { this.state = 'lurk'; this.vx = 0; }
        else if (dist < this.bodyR + 34) { this.state = 'strike'; this.strikeT = 0; }
        else if (this.canCharge && dist > 380 && Math.random() < dt * 0.25) { this.state = 'charge'; this.chargeT = 0; SFAudio.monsterRoar(false); }
        if (this.roarCD <= 0 && Math.random() < dt * 0.25) { SFAudio.monsterRoar(false); this.roarCD = 3.5; }
        break;
      }
      case 'charge': {
        this.chargeT += dt;
        if (this.chargeT < 0.55) { this.vx = -this.facing * 30; rearT = 0.7; }
        else if (this.chargeT < 1.5) {
          this.vx = this.facing * 480 * Math.min(1.4, this.s * 0.7);
          if (Math.abs(px - this.x) < this.bodyR + 24 && Math.abs(py - this.y) < 130) {
            this.onStrike?.(2);
            this.state = 'chase';
          }
        } else { this.state = 'chase'; }
        break;
      }
      case 'strike': {
        this.strikeT += dt;
        this.vx = 0;
        rearT = this.strikeT < 0.3 ? 1 : 0;
        if (this.strikeT > 0.42) {
          if (Math.abs(px - (this.x + this.facing * this.bodyR * 1.3)) < 80 && Math.abs(py - this.y) < 130) {
            this.onStrike?.(2);
          }
          SFAudio.thud(1);
          this.scene.cameras.main.shake(280, 0.01);
          this.state = dist < 220 ? 'chase' : 'lurk';
        }
        break;
      }
    }
    this.rear = lerp(this.rear, rearT, 1 - Math.exp(-dt * 8));

    this.x += this.vx * dt;
    this.x = clamp(this.x, this.minX, this.maxX);
    const fast = this.state === 'chase' || this.state === 'charge';
    /* gövde: hızlıyken öne eğik, kambur sırt nefesle kabarır; tehditte ayağa kalkar */
    const bodyLift = (40 * this.s) + Math.sin(this.breathe * (fast ? 7 : 1.3)) * 2 * this.s + this.rear * 14 * this.s;
    this.y = this.groundY - bodyLift;

    /* adım: önde ve arkada aynı anda en fazla bir uzuv havada (dört ayak yürüyüşü) */
    const stepThreshold = 30 * this.s * (fast ? 0.8 : 1.15);
    const lifting = { 1: 0, '-1': 0 };
    for (const leg of this.legs) if (leg.stepping) lifting[leg.side]++;
    for (const leg of this.legs) {
      const restX = this.x + leg.restOff * this.facing + this.vx * 0.16;
      const raised = this.rear > 0.2 && leg.side > 0;                 // tehditte kollar havada
      if (raised) continue;
      if (!leg.stepping && Math.abs(leg.footX - restX) > stepThreshold && lifting[leg.side] < 1) {
        leg.stepping = true; leg.progress = 0; lifting[leg.side]++;
        leg.startX = leg.footX; leg.startY = leg.footY;
        leg.targetX = restX + this.vx * 0.12 + (Math.random() - 0.5) * 6 * this.s;
        leg.targetY = this.groundY;
      }
      if (leg.stepping) {
        leg.progress += dt * (fast ? 7.5 : 3.2);
        const t = Math.min(1, leg.progress);
        const e = t * t * (3 - 2 * t);
        leg.footX = lerp(leg.startX, leg.targetX, e);
        leg.footY = lerp(leg.startY, leg.targetY, e) - Math.sin(e * Math.PI) * (leg.side > 0 ? 16 : 10) * this.s;
        if (t >= 1) {
          leg.stepping = false;
          if (Math.random() < 0.5) SFAudio.monsterStep();
          if (this.s > 1.6) this.scene.cameras.main.shake(70, 0.0025 * this.s);
        }
      }
    }
    this.draw();
  }

  draw() {
    const g = this.gfx, col = 0x08080b, s = this.s, f = this.facing;
    g.clear();
    const tw = this.twitch * Math.sin(this.breathe * 60) * 2.2 * s;
    const bx = this.x + tw, by = this.y;
    const curl = this.dead ? Math.min(1, (this.deathT ?? 0) * 1.4) : 0;
    const rear = this.rear;
    /* gövde ekseni: kalça → omuz. Tehditte omuz yükselir (arka ayaklar üstüne kalkar). */
    const hip = { x: bx - f * 18 * s, y: by + 2 * s };
    const sh = { x: bx + f * lerp(14, 4, rear) * s, y: by - lerp(12, 44, rear) * s + curl * 20 * s };
    const mid = { x: lerp(hip.x, sh.x, 0.5) - f * 2 * s, y: lerp(hip.y, sh.y, 0.5) - 10 * s * (1 - rear * 0.5) };
    const breath = 1 + Math.sin(this.breathe * (this.state === 'chase' ? 5 : 1.5)) * 0.05;

    const limb = (a, j, e, w0, w1) => {
      g.lineStyle(w0, col, 1); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(j.x, j.y); g.strokePath();
      g.lineStyle(w1, col, 1); g.beginPath(); g.moveTo(j.x, j.y); g.lineTo(e.x, e.y); g.strokePath();
      g.fillStyle(col, 1); g.fillCircle(j.x, j.y, w0 * 0.55);
    };
    const drawLeg = (leg) => {
      const front = leg.side > 0;
      const anchor = front ? sh : hip;
      const hx = anchor.x + (leg.hipOff.x - (front ? 13 : -18.5) * s) * f * 0.4, hy = anchor.y + (front ? 4 * s : 0);
      let fx = leg.footX, fy = leg.footY;
      if (front && rear > 0.2) {
        /* tehdit: kollar yana-yukarı açılır, parmaklar kıvrılır */
        const w = Math.sin(this.breathe * 6 + leg.idx) * 5 * s;
        fx = lerp(fx, hx + f * (leg.back ? 6 : 22) * s, rear);
        fy = lerp(fy, hy - (leg.back ? 30 : 20) * s + w, rear);
      }
      if (curl > 0) { fx = lerp(fx, hx + f * 10 * s, curl * 0.7); fy = lerp(fy, this.groundY - 2, curl * 0.7); }
      const bend = front ? (f > 0 ? 1 : -1) : (f > 0 ? -1 : 1);   // dirsek geride, diz önde
      const ik = solveIK2(hx, hy, fx, fy, leg.l1, leg.l2, bend);
      const wF = (front ? (leg.back ? 6 : 7.5) : (leg.back ? 7 : 8.5)) * s;
      limb({ x: hx, y: hy }, { x: ik.jx, y: ik.jy }, { x: fx, y: fy }, wF, wF * 0.62);
      /* el: üç uzun boğumlu parmak (kökler gibi) · ayak: geniş toynak */
      g.lineStyle(1.6 * s, col, 1);
      if (front) {
        for (let k = -1; k <= 1; k++) {
          const a0 = (f > 0 ? 0 : Math.PI) + k * 0.45 + (rear > 0.2 ? -f * 1.2 : 0.15 * f);
          const L = (7 + (k === 0 ? 3 : 0)) * s;
          g.beginPath(); g.moveTo(fx, fy);
          g.lineTo(fx + Math.cos(a0) * L, fy + Math.sin(a0) * L * 0.6 + (rear > 0.2 ? 0 : 1.5 * s));
          g.strokePath();
        }
      } else {
        g.fillStyle(col, 1); g.fillEllipse(fx + f * 2 * s, fy - 1.5 * s, 10 * s, 4 * s);
      }
    };
    for (const leg of this.legs) if (leg.back) drawLeg(leg);

    /* kambur gövde — üç kütle (kalça, sırt kamburu, göğüs) */
    g.fillStyle(col, 1);
    g.fillEllipse(hip.x, hip.y - 2 * s, 30 * s * breath, 26 * s * breath);
    g.fillEllipse(mid.x, mid.y, 36 * s * breath, 30 * s * breath);
    g.fillEllipse(sh.x, sh.y, 32 * s * breath, 30 * s * breath);
    /* sırt kabuğu: kalın kabuk çıkıntıları */
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const px = lerp(hip.x, sh.x, t), py = lerp(hip.y, sh.y, t) - Math.sin(t * Math.PI) * 14 * s - 12 * s;
      const hh = (5 + (i % 3) * 3) * s * (1 + rear * 0.4);
      g.fillTriangle(px - 3.5 * s, py + 4 * s, px + 3.5 * s, py + 4 * s, px - f * 2 * s, py - hh);
    }
    /* sarkan kökler — gövdenin altından toprağa doğru, harekete göre salınır */
    g.lineStyle(1.4 * s, col, 1);
    for (const r of this.roots) {
      const px = lerp(hip.x, sh.x, r.t), py = lerp(hip.y, sh.y, r.t) + 10 * s;
      const sw = Math.sin(this.breathe * 2.3 + r.ph) * 3 * s - clamp(this.vx * 0.02, -6, 6) * s;
      const len = r.len * (1 - curl * 0.3);
      g.beginPath(); g.moveTo(px, py);
      g.lineTo(px + sw * 0.5, py + len * 0.55);
      g.lineTo(px + sw, py + len);
      g.strokePath();
    }

    /* boyun + uzun, alçak tutulan kafatası */
    const headBase = { x: sh.x + f * 12 * s, y: sh.y + lerp(4, -6, rear) * s };
    const head = { x: headBase.x + f * 10 * s, y: headBase.y + lerp(6, -2, rear) * s };
    g.lineStyle(9 * s, col, 1);
    g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(headBase.x, headBase.y); g.strokePath();
    g.fillStyle(col, 1);
    g.fillEllipse(head.x, head.y, 18 * s, 12 * s);
    /* çene — saldırıda açılır */
    const open = clamp(rear * 0.6 + (this.state === 'strike' ? 1 : 0) + Math.sin(this.breathe * 9) * 0.05, 0, 1);
    const ja = 0.25 + open * 0.6;
    const jx = head.x + f * Math.cos(ja) * 14 * s, jy = head.y + 3 * s + Math.sin(ja) * 14 * s;
    g.beginPath();
    g.moveTo(head.x - f * 4 * s, head.y + 2 * s); g.lineTo(jx, jy); g.lineTo(jx - f * 3 * s, jy + 2 * s); g.lineTo(head.x - f * 6 * s, head.y + 5 * s);
    g.closePath(); g.fillPath();
    /* dal boynuzlar — dallanan kuru çatallar */
    const antler = (side, scale) => {
      const ax = head.x - f * 3 * s, ay = head.y - 5 * s;
      const sway = Math.sin(this.breathe * 1.1 + side) * 0.05;
      const base = -Math.PI / 2 - f * (0.55 + side * 0.25) + sway;
      const branch = (x, y, a, len, w, depth) => {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        g.lineStyle(w, col, 1); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
        if (depth <= 0) return;
        branch(ex, ey, a - 0.45 * f, len * 0.62, w * 0.65, depth - 1);
        branch(ex, ey, a + 0.38 * f, len * 0.7, w * 0.7, depth - 1);
      };
      branch(ax, ay, base, 16 * s * scale, 3 * s, 2);
    };
    antler(1, 1); antler(-1, 0.8);
    for (const leg of this.legs) if (!leg.back) drawLeg(leg);

    /* tek yarık göz — kızıl, uyanınca açılır */
    const eg = this.eyeGfx;
    eg.clear();
    if (!this.dead) {
      const hot = this.state !== 'lurk';
      const blink = (Math.sin(this.breathe * 0.7) > 0.97) ? 0.15 : 1;
      const c = this.boss ? 0xe0705a : 0xc8483a;
      const a = (hot ? 0.95 : 0.4) * blink;
      const ex = head.x + f * 4 * s, ey = head.y - 1.5 * s;
      eg.fillStyle(c, a * 0.22); eg.fillEllipse(ex, ey, 12 * s, 7 * s);
      eg.fillStyle(c, a); eg.fillEllipse(ex, ey, 5 * s, (hot ? 1.8 : 0.9) * s);
    }
  }
}

/* ---------------- HOUND (iskelet tazı) ----------------
   Bir deri bir kemik: derin göğüs kafesi (kaburgalar seçilir), çökük bel,
   omurga çıkıntıları, uzun kafatası, dişli açık çene, gözsüz yüz.
   Dört bacaklı döner galop: arka bacaklar topuk eklemli (köpek gibi). */
class Hound {
  /** cfg: { x, groundY, scale, patrolMinX, patrolMaxX, hp } */
  constructor(scene, cfg) {
    this.scene = scene;
    this.type = 'hound';
    this.s = cfg.scale ?? 0.9;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.y = this.groundY - 30 * this.s;
    this.minX = cfg.patrolMinX; this.maxX = cfg.patrolMaxX;
    this.hp = cfg.hp ?? 3; this.maxHp = this.hp;
    this.boss = !!cfg.boss; this.name = cfg.name;
    this.chaseSpeed = cfg.chaseSpeed;
    this.gfx = scene.add.graphics().setDepth(95);
    addRimGlow(this.gfx, 0x8a6a64, 1.0);
    this.facing = cfg.facing ?? -1;
    this.vx = 0; this.vy = 0;
    this.state = cfg.startChase ? 'chase' : 'prowl';
    this.lungeT = 0; this.stunT = 0; this.recoverT = 0;
    this.phase = Math.random() * 10;
    this.breathe = Math.random() * 10;
    this.dead = false;
    this.onStrike = null;
    this.airborne = false;
    this.jaw = 0;
  }
  destroy() { this.gfx.destroy(); }

  /* ses duydu: koku alır gibi o yöne döner, güçlü seste koşar */
  hearNoise(x, power) {
    if (this.dead || this.state !== 'prowl') return;
    this.facing = x > this.x ? 1 : -1;
    if (power >= 0.45 && x > this.minX - 100 && x < this.maxX + 100) {
      this.state = 'chase'; SFAudio.houndGrowl?.(true);
      creatureScare(this, 0.8);
    }
  }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = 0.25;
    SFAudio.houndYelp?.();
    if (this.state === 'prowl') { this.state = 'chase'; creatureScare(this, 0.7); }
    if (this.hp <= 0) { this.dead = true; this.state = 'dead'; this.deathT = 0; }
  }

  update(dt, player) {
    this.breathe += dt;
    if (this.dead) {
      this.deathT = (this.deathT ?? 0) + dt;
      this.y = lerp(this.y, this.groundY - 9 * this.s, 1 - Math.exp(-dt * 4));
      this.gfx.setAlpha(Math.max(0, 1 - (this.deathT - 1.8) * 0.8));
      this.draw();
      return;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.draw(); return; }

    const px = player.x, py = player.y;
    const dx = px - this.x, dist = Math.abs(dx);
    const vf = visFactor(this.scene, px, py);
    const sense = 360 * vf + (player.crouching ? -40 : 40) + (player.noisy ? 120 : 0);
    let jawT = 0.1;

    switch (this.state) {
      case 'prowl': {
        this.vx = this.facing * 50 * this.s;
        if (this.x > this.maxX) this.facing = -1;
        if (this.x < this.minX) this.facing = 1;
        if (dist < sense && px > this.minX - 100 && px < this.maxX + 100) {
          this.state = 'chase'; SFAudio.houndGrowl?.(true);
          creatureScare(this, 0.85);
        }
        break;
      }
      case 'chase': {
        this.facing = dx > 0 ? 1 : -1;
        this.vx = this.facing * (this.chaseSpeed ?? 290 * this.s);
        jawT = 0.5 + Math.sin(this.breathe * 14) * 0.3;
        if (dist > Math.max(600, sense + 200) && !this.chaseSpeed) this.state = 'prowl';
        else if (dist < 170 && Math.abs(py - this.y) < 90) {
          this.state = 'lunge'; this.lungeT = 0;
          this.vy = -340; this.airborne = true;
          SFAudio.houndGrowl?.(true);
        }
        break;
      }
      case 'lunge': {
        this.lungeT += dt;
        jawT = 1;
        this.vx = this.facing * 430;
        this.vy += 1250 * dt;
        this.y += this.vy * dt;
        if (Math.abs(px - this.x) < 40 && Math.abs(py - this.y) < 60 && !this._hitDone) {
          this._hitDone = true;
          this.onStrike?.(1);
        }
        if (this.y >= this.groundY - 30 * this.s) {
          this.y = this.groundY - 30 * this.s;
          this.airborne = false; this._hitDone = false;
          this.state = 'recover'; this.recoverT = 0;
          SFAudio.thud(0.5);
        }
        break;
      }
      case 'recover': {
        this.recoverT += dt;
        this.vx *= 0.85;
        jawT = 0.6;
        if (this.recoverT > 0.7) this.state = 'chase';
        break;
      }
    }
    this.jaw = lerp(this.jaw, jawT, 1 - Math.exp(-dt * 12));

    this.x += this.vx * dt;
    this.x = clamp(this.x, this.minX - 60, this.maxX + 60);
    const run = Math.abs(this.vx) > 120;
    if (!this.airborne) this.y = this.groundY - 30 * this.s + (run ? Math.sin(this.phase * 2) * 2.5 * this.s : Math.sin(this.breathe * 2) * 0.8);
    /* adım fazı mesafeye bağlı — pençeler kaymaz */
    const stride = (run ? 22 : 9) * this.s;
    this.phase += Math.abs(this.vx) * dt * Math.PI / (2 * stride);
    this.draw();
  }

  draw() {
    const g = this.gfx, col = 0x09090c, s = this.s, f = this.facing;
    g.clear();
    const bx = this.x, by = this.y;
    const ph = this.phase;
    const run = Math.abs(this.vx) > 120;
    const flex = run ? Math.sin(ph * 2) * 0.08 : 0;      // galopta omurga esneyip toplanır
    const stride = (run ? 22 : 9) * s;
    const groundY = this.groundY;

    const shoulder = { x: bx + f * 18 * s, y: by - 4 * s };
    const hip = { x: bx - f * (19 + flex * 40) * s, y: by - 6 * s };

    const footAt = (base, p, lift) => {
      const u = ((p % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (this.airborne) return { x: base + (lift ? f * 10 * s : -f * 14 * s), y: by + 16 * s };
      if (u < Math.PI) {                                       // salınım
        const k = u / Math.PI;
        return { x: base + f * (-stride + 2 * stride * (0.5 - 0.5 * Math.cos(Math.PI * k))), y: groundY - Math.sin(Math.PI * k) * (run ? 12 : 5) * s };
      }
      const k = (u - Math.PI) / Math.PI;                       // destek: doğrusal geri
      return { x: base + f * (stride - 2 * stride * k), y: groundY };
    };
    /* ön bacak: omuz → dirsek (geri) → pençe */
    const frontLeg = (p, w) => {
      const ft = footAt(shoulder.x + f * 4 * s, p, true);
      const ik = solveIK2(shoulder.x, shoulder.y, ft.x, ft.y, 17 * s, 18 * s, f > 0 ? 1 : -1);
      g.lineStyle(w * s, col, 1);
      g.beginPath(); g.moveTo(shoulder.x, shoulder.y); g.lineTo(ik.jx, ik.jy); g.lineTo(ft.x, ft.y); g.strokePath();
      g.fillStyle(col, 1); g.fillEllipse(ft.x + f * 2 * s, ft.y - 1 * s, 6 * s, 3 * s);
    };
    /* arka bacak: kalça → diz (ileri) → topuk (geri) → pençe — köpek bacağı */
    const hindLeg = (p, w) => {
      const ft = footAt(hip.x - f * 2 * s, p, false);
      const hock = { x: ft.x - f * 7 * s, y: ft.y - 13 * s };
      const ik = solveIK2(hip.x, hip.y, hock.x, hock.y, 17 * s, 15 * s, f > 0 ? -1 : 1);
      g.lineStyle((w + 2) * s, col, 1);
      g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(ik.jx, ik.jy); g.strokePath();
      g.lineStyle(w * s, col, 1);
      g.beginPath(); g.moveTo(ik.jx, ik.jy); g.lineTo(hock.x, hock.y); g.lineTo(ft.x, ft.y); g.strokePath();
      g.fillStyle(col, 1); g.fillEllipse(ft.x + f * 2 * s, ft.y - 1 * s, 6 * s, 3 * s);
    };
    // arka plandaki bacaklar
    hindLeg(ph + 0.7, 2.6); frontLeg(ph + Math.PI + 0.25, 2.6);

    /* gövde: derin göğüs, çökük karın */
    g.fillStyle(col, 1);
    g.beginPath();
    g.moveTo(hip.x - f * 6 * s, hip.y + 2 * s);
    qTo(g, hip.x - f * 6 * s, hip.y + 2 * s, bx, by - 15 * s - flex * 20 * s, shoulder.x + f * 6 * s, shoulder.y - 8 * s);
    g.lineTo(shoulder.x + f * 9 * s, shoulder.y + 3 * s);
    qTo(g, shoulder.x + f * 9 * s, shoulder.y + 3 * s, shoulder.x - f * 2 * s, by + 15 * s, bx - f * 4 * s, by + 5 * s);
    qTo(g, bx - f * 4 * s, by + 5 * s, hip.x + f * 2 * s, by + 3 * s, hip.x - f * 6 * s, hip.y + 6 * s);
    g.closePath(); g.fillPath();
    // kaburgalar — açık tonlu ince yaylar
    g.lineStyle(1.1 * s, 0x2a2c36, 0.85);
    for (let i = 0; i < 5; i++) {
      const rx = shoulder.x - f * (3 + i * 4.2) * s;
      g.beginPath();
      g.moveTo(rx, by - 7 * s);
      qTo(g, rx, by - 7 * s, rx + f * 3 * s, by + 2 * s, rx - f * 1 * s, by + (9 - i * 1.3) * s, 5);
      g.strokePath();
    }
    // omurga çıkıntıları
    g.fillStyle(col, 1);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const sx = lerp(hip.x, shoulder.x, t), sy = by - 12 * s - Math.sin(t * Math.PI) * 4 * s - flex * 16 * s;
      g.fillTriangle(sx - 2 * s, sy + 2 * s, sx + 2 * s, sy + 2 * s, sx - f * 1 * s, sy - (3 + (i % 2) * 2) * s);
    }
    // kuyruk — kemik kamçı
    g.lineStyle(2 * s, col, 1);
    g.beginPath();
    g.moveTo(hip.x - f * 5 * s, hip.y);
    qTo(g, hip.x - f * 5 * s, hip.y, hip.x - f * 18 * s, hip.y - 2 * s + Math.sin(this.breathe * 4) * 3 * s, hip.x - f * 28 * s, hip.y + 8 * s, 6);
    g.strokePath();

    /* boyun + uzun kafatası + dişli çene */
    const neck = { x: shoulder.x + f * 8 * s, y: shoulder.y - 6 * s };
    const headA = run ? 0.18 : 0.32;
    const skull = { x: neck.x + f * 10 * s, y: neck.y + 2 * s + headA * 6 * s };
    g.lineStyle(7 * s, col, 1);
    g.beginPath(); g.moveTo(shoulder.x, shoulder.y - 2 * s); g.lineTo(neck.x, neck.y); g.strokePath();
    g.fillStyle(col, 1);
    g.fillEllipse(skull.x, skull.y - 1 * s, 13 * s, 10 * s);
    const jawA = this.jaw * 0.75;
    const snoutTip = { x: skull.x + f * 17 * s, y: skull.y + 2 * s };
    // üst çene
    g.beginPath();
    g.moveTo(skull.x, skull.y - 5 * s);
    g.lineTo(snoutTip.x, snoutTip.y - 1 * s);
    g.lineTo(snoutTip.x - f * 1 * s, snoutTip.y + 2 * s);
    g.lineTo(skull.x, skull.y + 2 * s);
    g.closePath(); g.fillPath();
    // alt çene (açılır)
    const jx = skull.x + f * Math.cos(jawA) * 15 * s, jy = skull.y + 3 * s + Math.sin(jawA) * 15 * s;
    g.beginPath();
    g.moveTo(skull.x - f * 1 * s, skull.y + 1 * s);
    g.lineTo(jx, jy);
    g.lineTo(jx - f * 2 * s, jy + 2.5 * s);
    g.lineTo(skull.x - f * 2 * s, skull.y + 5 * s);
    g.closePath(); g.fillPath();
    // dişler — açık ağızda seçilen soluk sivri uçlar
    if (this.jaw > 0.2) {
      g.fillStyle(0x9a948a, 0.75);
      for (let i = 0; i < 4; i++) {
        const t = 0.35 + i * 0.17;
        const ux = lerp(skull.x, snoutTip.x, t), uy = lerp(skull.y + 2 * s, snoutTip.y + 1.5 * s, t);
        g.fillTriangle(ux - 1 * s, uy, ux + 1 * s, uy, ux, uy + 2.6 * s);
        const lx = lerp(skull.x, jx, t), ly = lerp(skull.y + 2 * s, jy, t);
        g.fillTriangle(lx - 1 * s, ly, lx + 1 * s, ly, lx, ly - 2.4 * s);
      }
    }
    // göz çukuru — içinde sönük kırmızı kıvılcım
    if (!this.dead) {
      g.fillStyle(0xb8443a, this.state === 'prowl' ? 0.35 : 0.85);
      g.fillCircle(skull.x + f * 3 * s, skull.y - 3 * s, 1.3 * s);
    }
    // ön plandaki bacaklar
    hindLeg(ph, 3); frontLeg(ph + Math.PI, 3);
  }
}

/* ---------------- LURKER (uzun gölge-insan) ----------------
   Fazla uzun bacaklar, dizlere inen kollar, uzun parmaklar, hafif yana
   eğik kafa, dikey ağız yarığı. Bakarken stop-motion gibi kesik kesik
   hareket eder (12 kare/sn) — tekinsizlik hissi. Koşarken dört ayak. */
class Lurker {
  /** cfg: { x, groundY, scale, patrolMinX, patrolMaxX, hp } */
  constructor(scene, cfg) {
    this.scene = scene;
    this.type = 'lurker';
    this.s = cfg.scale ?? 1.3;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.minX = cfg.patrolMinX; this.maxX = cfg.patrolMaxX;
    this.hp = cfg.hp ?? 5; this.maxHp = this.hp;
    this.boss = !!cfg.boss; this.name = cfg.name;
    this.chaseSpeed = cfg.chaseSpeed;
    this.rig = new HumanRig(scene, { scale: this.s, depth: 95, color: 0x060609, variant: 'lurker', rimColor: 0x7a6a72, rimStrength: 1.1 });
    this.eyeGfx = scene.add.graphics().setDepth(97);
    this.facing = cfg.facing ?? -1;
    this.vx = 0;
    this.state = cfg.startChase ? 'chase' : 'wander';
    this.stareT = 0; this.strikeT = 0; this.stunT = 0;
    this.frameAcc = 0;
    this.dead = false;
    this.onStrike = null;
  }
  get y() { return this.rig.joints.pelvis?.y ?? (this.groundY - 60); }
  destroy() { this.rig.destroy(); this.eyeGfx.destroy(); }

  /* ses duydu: donar ve o yöne bakar (kesik kesik) */
  hearNoise(x, power) {
    if (this.dead || this.state !== 'wander') return;
    this.facing = x > this.x ? 1 : -1;
    if (power >= 0.4) { this.state = 'stare'; this.stareT = 0; SFAudio.lurkerWhisper?.(); }
  }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = 0.3;
    this.rig.hurtT = 0.4;
    SFAudio.monsterRoar(false);
    if (this.state === 'wander') { this.state = 'chase'; creatureScare(this, 0.8); }
    if (this.hp <= 0) {
      this.dead = true; this.state = 'dead';
      SFAudio.screech?.(0.5);
      this.rig.startRagdoll(dir * 200, -150, () => this.groundY);
      this.eyeGfx.clear();
    }
  }

  update(dt, player) {
    if (this.dead) {
      this.rig.update(dt, { x: this.x, y: this.groundY - this.rig.A.standH, mode: 'ragdoll', groundY: this.groundY });
      return;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.vx = 0; }
    else {
      const px = player.x, py = player.y;
      const dx = px - this.x, dist = Math.abs(dx);
      const vf = visFactor(this.scene, px, py);
      const sense = 380 * vf + (player.noisy ? 120 : 0);

      switch (this.state) {
        case 'wander': {
          this.vx = this.facing * 24 * this.s;
          if (this.x > this.maxX) this.facing = -1;
          if (this.x < this.minX) this.facing = 1;
          if (dist < sense) { this.state = 'stare'; this.stareT = 0; SFAudio.lurkerWhisper?.(); }
          break;
        }
        case 'stare': {
          this.vx = 0;
          this.facing = dx > 0 ? 1 : -1;
          this.stareT += dt;
          if (dist > sense + 140) this.state = 'wander';
          else if (this.stareT > 1.3) { this.state = 'chase'; creatureScare(this, 1); }
          break;
        }
        case 'chase': {
          this.facing = dx > 0 ? 1 : -1;
          this.vx = this.facing * (this.chaseSpeed ?? 250 * Math.min(1.3, this.s * 0.75));
          if (dist > Math.max(640, sense + 260) && !this.chaseSpeed) this.state = 'wander';
          else if (dist < 46 * this.s) { this.state = 'strike'; this.strikeT = 0; }
          break;
        }
        case 'strike': {
          this.strikeT += dt;
          this.vx = 0;
          if (this.strikeT > 0.3) {
            if (Math.abs(px - this.x) < 70 * this.s && Math.abs(py - (this.groundY - 50)) < 120) this.onStrike?.(2);
            SFAudio.thud(0.8);
            this.state = 'chase';
          }
          break;
        }
      }
      this.x += this.vx * dt;
      this.x = clamp(this.x, this.minX - 50, this.maxX + 50);
    }

    /* bakış/gezinti sırasında stop-motion: rig yalnız ~12 kare/sn güncellenir */
    const chasing = this.state === 'chase';
    this.frameAcc += dt;
    const choppy = this.state === 'stare' || this.state === 'wander';
    if (!choppy || this.frameAcc > 1 / 11) {
      const rdt = choppy ? this.frameAcc : dt;
      this.frameAcc = 0;
      this.rig.update(rdt, {
        x: this.x, y: this.groundY - this.rig.A.standH * (chasing ? 0.6 : 1),
        vx: this.vx * (chasing ? 1.6 : 1), vy: 0,
        grounded: true, facing: this.facing,
        mode: chasing ? 'crawl' : (Math.abs(this.vx) > 4 ? 'move' : 'idle'),
        groundY: this.groundY,
      });
    }

    const eg = this.eyeGfx;
    eg.clear();
    const J = this.rig.joints;
    if (J.head) {
      const inten = this.state === 'wander' ? 0.35 : 0.95;
      const f = this.facing, s = this.s;
      eg.fillStyle(0xd8d4c8, inten * 0.25);
      eg.fillCircle(J.head.x + f * 3 * s, J.head.y - 1 * s, 4 * s);
      eg.fillStyle(0xe6e2d6, inten);
      eg.fillCircle(J.head.x + f * 2.2 * s, J.head.y - 1.4 * s, 1.1 * s);
      eg.fillCircle(J.head.x + f * 5 * s, J.head.y - 0.8 * s, 0.9 * s);
      // dikey ağız yarığı
      if (this.state !== 'wander') {
        eg.fillStyle(0x8a3a34, 0.8);
        eg.fillRect(J.head.x + f * 3.6 * s - 0.5 * s, J.head.y + 2 * s, 1.1 * s, 4.5 * s * (this.state === 'strike' ? 1.6 : 1));
      }
    }
  }
}

/* ---------------- yaratık fabrikası ---------------- */
function spawnCreature(scene, cfg) {
  switch (cfg.type) {
    case 'hound': return new Hound(scene, cfg);
    case 'lurker': return new Lurker(scene, cfg);
    default: return new Stalker(scene, cfg);
  }
}

/* ---------------- SOLDIER ----------------
   Düzenli ordu askeri: devriye (arada durup etrafı tarar), şüphe, sesin
   geldiği yere gidip arama (varınca feneriyle iki yana bakar), siper alma,
   kısa seri atış, telsizle birbirini uyarma, ikili timde biri siperde
   tutarken diğeri ilerleyip kuşatır. Konuşmazlar: başlarının üstünde
   yalnız sözsüz durum işareti çıkar (? ! …). */

class Soldier {
  /**
   * cfg: { x, groundY, patrolMinX, patrolMaxX, facing, scale, depth,
   *        static, hp, hasCarKey, tough }
   */
  constructor(scene, cfg) {
    this.scene = scene;
    this.x = cfg.x;
    this.groundY = cfg.groundY;
    this.minX = cfg.patrolMinX ?? cfg.x - 1;
    this.maxX = cfg.patrolMaxX ?? cfg.x + 1;
    this.static = cfg.static ?? (this.maxX - this.minX < 10);
    this.s = cfg.scale ?? 1;
    this.facing = cfg.facing ?? 1;
    this.rig = new SoldierRig(scene, { scale: this.s, depth: cfg.depth ?? 98, color: 0x0a0b0e });
    this.rig.hasCarKey = !!cfg.hasCarKey;
    this.hasCarKey = !!cfg.hasCarKey;
    this.lightGfx = scene.add.graphics().setDepth((cfg.depth ?? 98) - 2);

    this.vx = 0;
    this.state = 'patrol';         // patrol|suspicious|investigate|alert
    this.suspicion = 0;
    this.waitT = 0;
    this.shootCD = 0.6;
    this.burstLeft = 0; this.burstT = 0;
    this.ammo = 24;
    this.reloading = false;
    this.hp = cfg.hp ?? 2;
    this.tough = !!cfg.tough;
    if (this.tough) this.hp = cfg.hp ?? 6;
    this.dead = false;
    this.viewDist = 460;
    this.viewHalfAngle = 0.36;
    this.onShoot = null;
    this.barkCD = 0;
    this.lastSeenX = null;
    this.investT = 0;
    this.coverX = null;
    this.ducked = false; this.duckT = 0;
    this.scanT = Math.random() * 6;
    this.homeX = this.x;
    this.lookT = 0;                 // arama sonunda etrafı tarama süresi
    this.pauseT = 4 + Math.random() * 5;   // devriyede bir sonraki duraklama
    this.unseenT = 0;
    this.role = ((scene.soldiers?.length ?? 0) % 2) ? 'push' : 'hold';
    if (scene.lights2) {
      this.light = scene.lights2.addLight({ x: this.x, y: this.groundY - 52, r: 210, type: 'cone', facing: this.facing, intensity: 0.85 });
    }
  }

  get eyeY() { return this.rig.joints.head?.y ?? (this.groundY - 74 * this.s); }

  destroy() {
    this.rig.destroy(); this.lightGfx.destroy();
    if (this.light) this.scene.lights2.removeLight(this.light);
  }

  bark(kind, force) {
    if (this.dead || (!force && this.barkCD > 0)) return;
    this.barkCD = 3.5 + Math.random() * 2;
    this.scene.bark?.(this.x, this.eyeY - 22, kind);
  }

  /* ses duydu: silah sesi → alarm; diğerleri → sesin geldiği yere arama */
  hearNoise(x, power) {
    if (this.dead) return;
    if (power >= 1) { this.lastSeenX = x; this.goAlert(true); return; }
    if (this.state === 'alert') return;
    this.lastSeenX = x;
    this.suspicion = Math.max(this.suspicion, 0.3 + power * 0.4);
    if (this.state !== 'investigate') { this.state = 'investigate'; this.investT = 0; this.lookT = 0; this.bark('suspicious'); }
  }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    SFAudio.hurt();
    this.rig.hurtT = 0.4;
    if (this.hp <= 0) this.kill(dir * 180);
    else { this.bark('hit', true); this.goAlert(); this.facing = -dir || this.facing; }
  }

  goAlert(fromRadio) {
    if (this.dead) return;
    const was = this.state;
    this.state = 'alert'; this.suspicion = 1;
    if (was !== 'alert') {
      this.shootCD = fromRadio ? 1.1 : 0.55;           // tepki süresi — anında vurmaz
      if (!fromRadio) {
        this.bark('alert', true);
        SFAudio.radioChirp?.();
        /* telsiz: yakındaki birlik de alarma geçer (gecikmeli) */
        for (const o of (this.scene.soldiers ?? [])) {
          if (o === this || o.dead || o.state === 'alert') continue;
          if (Math.abs(o.x - this.x) < 700) {
            this.scene.time.delayedCall(500 + Math.random() * 700, () => {
              if (o.dead || o.state === 'alert') return;
              o.lastSeenX = this.lastSeenX; o.goAlert(true);
              o.bark('alert', true);
            });
          }
        }
      }
    }
  }

  canSee(player, isBlockedFn) {
    if (player.hidden) return false;
    const eyeY = this.eyeY;
    const dx = player.x - this.x, dy = (player.y - 10) - eyeY;
    const dist = Math.hypot(dx, dy);
    const vf = visFactor(this.scene, player.x, player.y);
    const effDist = this.viewDist * vf;
    if (dist > effDist && dist > 60) return false;
    if (Math.sign(dx) !== this.facing && dist > 60) return false;
    const ang = Math.atan2(dy, Math.abs(dx));
    if (Math.abs(ang) > this.viewHalfAngle + (player.crouching ? -0.06 : 0.06) && dist > 60) return false;
    if (isBlockedFn && isBlockedFn(this.x, eyeY, player.x, player.y - 10)) return false;
    if (player.crouching && dist > effDist * 0.45) return false;
    return true;
  }

  /* oyuncuyla arasındaki en yakın araç siperi */
  findCover(px) {
    let best = null, bd = 220;
    for (const c of (this.scene.cars ?? [])) {
      const cx = (c.coverX0 + c.coverX1) / 2;
      // siper oyuncuyla asker arasında, askere yakın olmalı
      if ((cx - this.x) * (px - this.x) < 0) continue;
      const side = px > cx ? c.coverX0 - 18 : c.coverX1 + 18;  // siperin askere bakan yüzü
      const d = Math.abs(side - this.x);
      if (d < bd && Math.abs(px - cx) > 120) { bd = d; best = side; }
    }
    return best;
  }

  update(dt, player, isBlockedFn) {
    const R = this.rig;
    if (this.dead) {
      R.update(dt, { x: this.x, y: this.groundY - R.A.standH, grounded: true, mode: 'ragdoll', groundY: this.groundY });
      this.lightGfx.clear();
      if (this.light) this.light.on = false;
      return;
    }
    this.barkCD -= dt;
    this.scanT += dt;
    const seen = this.canSee(player, isBlockedFn);
    if (seen) this.lastSeenX = player.x;
    const dist = Math.abs(player.x - this.x);
    /* koşu adımları / yakın ses: görmeden duyar */
    const heard = player.noisy && dist < 300 && !seen;
    let crouch = false;
    let targetSpeed = 0;

    switch (this.state) {
      case 'patrol': {
        R.readyTarget = 0;
        if (this.static) {
          /* nöbet yerinden ayrıldıysa (arama sonrası) geri döner */
          if (Math.abs(this.x - this.homeX) > 10) { this.facing = this.homeX > this.x ? 1 : -1; targetSpeed = 40; }
          this.waitT += dt;
          if (this.waitT > 4 + Math.random() * 2 && !this.staticNoTurn) {
            this.waitT = 0;
            if (Math.random() < 0.4) this.facing *= -1;
          }
        } else {
          /* devriye: arada durur, feneriyle iki yana bakar, sonra devam eder */
          this.pauseT -= dt;
          if (this.pauseT < 0) {
            this.lookT += dt;
            if (this.lookT > 0.9 && this.lookT - dt <= 0.9) this.facing *= -1;
            if (this.lookT > 1.9 && this.lookT - dt <= 1.9) this.facing *= -1;
            if (this.lookT > 2.6) { this.lookT = 0; this.pauseT = 5 + Math.random() * 6; }
          } else targetSpeed = 44;
          if (this.x > this.maxX) this.facing = -1;
          if (this.x < this.minX) this.facing = 1;
        }
        if (seen) this.suspicion += dt * (player.crouching ? 0.8 : 2.4);
        else this.suspicion = Math.max(0, this.suspicion - dt * 0.5);
        if (heard) { this.suspicion = Math.max(this.suspicion, 0.4); this.lastSeenX = player.x; }
        if (this.suspicion > 0.35) { this.state = 'suspicious'; this.bark('suspicious'); }
        break;
      }
      case 'suspicious': {
        R.readyTarget = 0.6;
        if (this.lastSeenX != null) this.facing = this.lastSeenX > this.x ? 1 : -1;
        if (seen) this.suspicion += dt * (player.crouching ? 1.3 : 3.2);
        else this.suspicion -= dt * 0.35;
        if (this.suspicion >= 1) this.goAlert();
        else if (this.suspicion < 0.3 && this.lastSeenX != null) { this.state = 'investigate'; this.investT = 0; }
        else if (this.suspicion <= 0.1) this.state = 'patrol';
        break;
      }
      case 'investigate': {
        /* son görülen/duyulan noktaya feneriyle temkinli yürür */
        R.readyTarget = 0.75;
        this.investT += dt;
        const tx = clamp(this.lastSeenX ?? this.x, this.minX - 160, this.maxX + 160);
        if (Math.abs(tx - this.x) > 16) { this.facing = tx > this.x ? 1 : -1; targetSpeed = 52; this.lookT = 0; }
        else {
          /* noktaya vardı: iki yana bakar, fenerle tarar */
          this.lookT += dt;
          if (this.lookT > 1.1 && this.lookT - dt <= 1.1) this.facing *= -1;
          if (this.lookT > 2.4 && this.lookT - dt <= 2.4) this.facing *= -1;
        }
        if (seen) { this.suspicion += dt * 3; if (this.suspicion >= 0.9) this.goAlert(); }
        if (heard) { this.lastSeenX = player.x; this.lookT = 0; }
        if (this.investT > 7 || this.lookT > 3.4) { this.state = 'patrol'; this.suspicion = 0; this.lookT = 0; this.bark('lost'); }
        break;
      }
      case 'alert': {
        R.readyTarget = 1;
        this.shootCD -= dt;
        const lastX = this.lastSeenX ?? player.x;
        this.facing = lastX > this.x ? 1 : -1;
        /* siper: varsa koşup arkasına geç, seriler arasında eğil */
        if ((this.coverX == null && !(this.role === 'push' && this.unseenT > 1.6)) || Math.random() < dt * 0.2) this.coverX = this.findCover(lastX);
        if (this.coverX != null && Math.abs(this.coverX - this.x) > 10 && !this.reloading) {
          targetSpeed = 120;
          this.facing = this.coverX > this.x ? 1 : -1;
        } else if (this.coverX == null && dist > 340 && !this.reloading && !this.static) {
          targetSpeed = 72;                                  // açıkta: yaklaş
        }
        /* KUŞATMA: oyuncu bir süre görünmezse "ilerleyen" asker siperi bırakıp
           son görüldüğü yere sokulur; "tutan" asker siperde bekler */
        this.unseenT = seen ? 0 : this.unseenT + dt;
        if (this.role === 'push' && !this.static && this.unseenT > 1.6 && !this.reloading) {
          this.coverX = null;
          if (Math.abs(lastX - this.x) > 120) targetSpeed = 86;
        }
        const atCover = this.coverX != null && Math.abs(this.coverX - this.x) <= 10;
        if (atCover) {
          this.duckT -= dt;
          if (this.burstLeft <= 0 && this.duckT <= 0) { this.ducked = !this.ducked; this.duckT = this.ducked ? 1.0 + Math.random() * 0.8 : 1.6; }
          crouch = this.ducked || this.reloading;
        }
        /* ateş: 3'lü kısa seri */
        if (this.burstLeft > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.burstLeft--; this.burstT = 0.11; this.ammo--;
            const eyeY = this.eyeY;
            R.aimAngle = Math.atan2((player.y - 14) - eyeY, Math.max(40, Math.abs(player.x - this.x))) * 0.9;
            R.recoilT = 0.16;
            SFAudio.gunshot();
            const m = R.muzzle;
            this.onShoot?.(m ? m.x : this.x + this.facing * 30, m ? m.y : eyeY + 8, this.facing, player);
          }
        } else if (seen && !crouch && this.shootCD <= 0 && !this.reloading && targetSpeed < 100 && dist < this.viewDist + 40) {
          if (this.ammo <= 0) {
            this.reloading = true;
            this.bark('reload', true);
            R.startAction('reload', {
              onPhase: (p) => {
                if (p === 'magout') { SFAudio.magDrop?.(); this.scene.spawnDroppedMag?.(this.x + this.facing * 14, this.groundY - 40); }
                if (p === 'magin') SFAudio.magIn?.();
                if (p === 'rack') SFAudio.rack?.();
              },
              onDone: () => { this.ammo = 24; this.reloading = false; },
            });
          } else {
            this.burstLeft = this.tough ? 4 : 3; this.burstT = 0;
            this.shootCD = (this.tough ? 1.0 : 1.5) + Math.random() * 0.7;
          }
        }
        if (!seen) {
          this.suspicion -= dt * 0.22;
          if (this.suspicion < 0.3) { this.state = 'investigate'; this.investT = 0; this.coverX = null; this.bark('lost'); }
        } else this.suspicion = 1;
        break;
      }
    }

    /* yumuşak hızlanma — robotik ani başla/dur yok */
    this.vx = lerp(this.vx, this.facing * targetSpeed, 1 - Math.exp(-dt * 6));
    if (this.reloading) this.vx *= 0.8;
    this.x += this.vx * dt;
    this.x = clamp(this.x, this.minX - 200, this.maxX + 200);

    R.stepCallback = (f) => SFAudio.footstep('earth', f * 0.45);
    R.update(dt, {
      x: this.x, y: this.groundY - R.A.standH,
      vx: this.vx, vy: 0, grounded: true, facing: this.facing,
      mode: Math.abs(this.vx) > 6 ? 'move' : 'idle', crouch,
      groundY: this.groundY,
    });

    /* taktik fener — tüfeğin altındaki lambadan çıkar */
    const m = R.muzzle;
    if (this.light) {
      const sweep = this.state === 'patrol' || this.state === 'investigate' ? Math.sin(this.scanT * 1.3) * 0.12 : 0;
      this.light.x = m ? m.lx : this.x + this.facing * 16;
      this.light.y = m ? m.ly : this.groundY - 52 * this.s;
      this.light.facing = this.facing;
      this.light.angle = (m ? m.angle : 0) + sweep;
      this.light.on = true;
    }
    this.drawLight(seen);
  }

  drawLight(seen) {
    const g = this.lightGfx;
    g.clear();
    const L = this.light;
    if (!L) return;
    const ox = L.x, oy = L.y, a = L.angle ?? 0, f = this.facing;
    const len = this.viewDist * 0.95, half = this.viewHalfAngle;
    const tension = this.state === 'alert' ? 1 : this.suspicion;
    const col = tension > 0.6 ? 0xd6b8a8 : 0xc4c8d2;
    const pt = (ang, r) => ({ x: ox + Math.cos(ang) * r * f, y: oy + Math.sin(ang) * r });
    const p1 = pt(a - half, len), p2 = pt(a, len * 1.04), p3 = pt(a + half, len);
    g.fillStyle(col, 0.045 + tension * 0.05);
    g.beginPath(); g.moveTo(ox, oy); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.fillPath();
    g.fillStyle(col, 0.035);
    const q1 = pt(a - half * 0.45, len * 0.7), q3 = pt(a + half * 0.45, len * 0.7);
    g.beginPath(); g.moveTo(ox, oy); g.lineTo(q1.x, q1.y); g.lineTo(q3.x, q3.y); g.closePath(); g.fillPath();
  }

  kill(impulseX) {
    if (this.dead) return;
    this.dead = true;
    this.rig.startRagdoll(impulseX, -160, () => this.groundY);
    this.lightGfx.clear();
    if (this.light) this.light.on = false;
  }
}
