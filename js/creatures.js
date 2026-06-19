/* ============================================================
   SHADOW FALL — Creatures v2
   - Stalker: 6 bacaklı IK örümcek-yaratık (+ boss varyantı)
   - Hound: 4 bacaklı hızlı tazı — atılarak saldırır
   - Lurker: uzun insansı gölge — dört ayak koşusuna geçer
   - Soldier: devriye + fener konisi + karanlık farkındalığı,
     şarjör değiştirir, araba anahtarı taşıyabilir, vurulabilir
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

/* ---------------- STALKER (örümcek yaratık) ---------------- */
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

    this.hp = cfg.hp ?? 6;
    this.maxHp = this.hp;
    this.boss = !!cfg.boss;
    this.name = cfg.name;
    this.canCharge = cfg.charges ?? this.boss;

    this.bodyR = 26 * this.s;
    this.facing = 1;
    this.vx = 0;
    this.state = 'lurk';       // lurk|alert|chase|strike|charge|stunned|dead
    this.alertT = 0; this.strikeT = 0; this.chargeT = 0; this.stunT = 0;
    this.roarCD = 0;
    this.breathe = Math.random() * 10;
    this.dead = false;
    this.onStrike = null;

    this.legs = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const side = i < n / 2 ? -1 : 1;
      const spread = (i % (n / 2)) / (n / 2 - 1);
      this.legs.push({
        side, spread,
        hipOff: { x: side * (8 + spread * 14) * this.s, y: (-6 + spread * 8) * this.s },
        restOff: side * (26 + spread * 34) * this.s * 1.1,
        footX: this.x, footY: this.groundY,
        targetX: this.x, targetY: this.groundY,
        startX: this.x, startY: this.groundY,
        progress: 1, stepping: false,
        l1: 34 * this.s, l2: 30 * this.s,
      });
    }
    for (const leg of this.legs) {
      leg.footX = this.x + leg.restOff; leg.footY = this.groundY;
      leg.targetX = leg.footX; leg.targetY = leg.footY;
    }
  }

  destroy() { this.gfx.destroy(); this.eyeGfx.destroy(); }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = Math.max(this.stunT, 0.22);
    SFAudio.monsterRoar(false);
    if (this.hp <= 0) this.die(dir);
  }

  die(dir = 0) {
    this.dead = true;
    this.state = 'dead';
    SFAudio.monsterRoar(true);
    this.scene.cameras.main.shake(500, 0.012);
    this.deathT = 0;
  }

  update(dt, player) {
    this.breathe += dt;
    this.roarCD -= dt;
    if (this.dead) {
      this.deathT = (this.deathT ?? 0) + dt;
      // bacaklar yana açılıp gövde çöker
      this.y = lerp(this.y, this.groundY - 16 * this.s, 1 - Math.exp(-dt * 3));
      this.gfx.setAlpha(Math.max(0, 1 - (this.deathT - 1.4) * 0.8));
      this.eyeGfx.clear();
      this.draw(player);
      return;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.vx = 0; this.draw(player); return; }

    const px = player.x, py = player.y;
    const dx = px - this.x;
    const dist = Math.abs(dx);
    const vf = visFactor(this.scene, px, py);
    const playerInRoom = px > this.minX - 80 && px < this.maxX + 80;
    const senseDist = 420 * vf + (player.crouching ? 0 : 60);

    switch (this.state) {
      case 'lurk': {
        this.vx = Math.sin(this.breathe * 0.5) * 6;
        if (playerInRoom && dist < senseDist) {
          this.state = 'alert'; this.alertT = 0;
          if (this.roarCD <= 0) { SFAudio.monsterRoar(true); this.roarCD = 6; }
          this.scene.cameras.main.shake(700, 0.012);
        }
        break;
      }
      case 'alert': {
        this.alertT += dt;
        this.facing = dx > 0 ? 1 : -1;
        this.vx = 0;
        if (this.alertT > 0.9) this.state = (this.canCharge && dist > 320 && Math.random() < 0.5) ? 'charge' : 'chase';
        if (this.state === 'charge') { this.chargeT = 0; SFAudio.monsterRoar(true); }
        break;
      }
      case 'chase': {
        this.facing = dx > 0 ? 1 : -1;
        this.vx = this.facing * 170 * this.s * 0.8;
        if (!playerInRoom || dist > Math.max(700, senseDist + 250)) { this.state = 'lurk'; this.vx = 0; }
        else if (dist < this.bodyR + 30) { this.state = 'strike'; this.strikeT = 0; }
        else if (this.canCharge && dist > 380 && Math.random() < dt * 0.25) { this.state = 'charge'; this.chargeT = 0; SFAudio.monsterRoar(false); }
        if (this.roarCD <= 0 && Math.random() < dt * 0.25) { SFAudio.monsterRoar(false); this.roarCD = 3.5; }
        break;
      }
      case 'charge': {
        // boss hücumu: kısa hazırlanma, sonra çok hızlı dalış
        this.chargeT += dt;
        if (this.chargeT < 0.55) { this.vx = -this.facing * 30; }  // geri çekilme
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
        if (this.strikeT > 0.42) {
          if (Math.abs(px - (this.x + this.facing * this.bodyR * 1.3)) < 75 && Math.abs(py - this.y) < 130) {
            this.onStrike?.(this.boss ? 2 : 2);
          }
          SFAudio.thud(1);
          this.scene.cameras.main.shake(280, 0.01);
          this.state = dist < 220 ? 'chase' : 'lurk';
        }
        break;
      }
    }

    this.x += this.vx * dt;
    this.x = clamp(this.x, this.minX, this.maxX);
    const bodyLift = (56 * this.s) + Math.sin(this.breathe * (this.state === 'chase' ? 4 : 1.2)) * 4 * this.s;
    this.y = this.groundY - bodyLift;

    const stepThreshold = 44 * this.s * (this.state === 'chase' || this.state === 'charge' ? 0.8 : 1.3);
    for (const leg of this.legs) {
      const restX = this.x + leg.restOff + this.vx * 0.18;
      if (!leg.stepping && Math.abs(leg.footX - restX) > stepThreshold) {
        leg.stepping = true; leg.progress = 0;
        leg.startX = leg.footX; leg.startY = leg.footY;
        leg.targetX = restX + (Math.random() - 0.5) * 8 * this.s;
        leg.targetY = this.groundY;
      }
      if (leg.stepping) {
        leg.progress += dt * (this.state === 'chase' || this.state === 'charge' ? 7.5 : 3.2);
        const t = Math.min(1, leg.progress);
        const e = t * t * (3 - 2 * t);
        leg.footX = lerp(leg.startX, leg.targetX, e);
        leg.footY = lerp(leg.startY, leg.targetY, e) - Math.sin(e * Math.PI) * 22 * this.s;
        if (t >= 1) {
          leg.stepping = false;
          if (Math.random() < 0.6) SFAudio.monsterStep();
          this.scene.cameras.main.shake(90, 0.0035 * this.s);
        }
      }
    }
    this.draw(player);
  }

  draw(player) {
    const g = this.gfx, col = 0x09090d;
    g.clear();
    const bx = this.x, by = this.y;
    const splay = this.dead ? Math.min(1, (this.deathT ?? 0) * 1.6) : 0;

    for (const leg of this.legs) {
      const hipX = bx + leg.hipOff.x, hipY = by + leg.hipOff.y;
      const fx = this.dead ? leg.footX + leg.side * splay * 26 * this.s : leg.footX;
      const ik = solveIK2(hipX, hipY, fx, leg.footY, leg.l1, leg.l2, leg.side > 0 ? -1 : 1);
      g.lineStyle(7 * this.s, col, 1);
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(ik.jx, ik.jy); g.strokePath();
      g.lineStyle(5 * this.s, col, 1);
      g.beginPath(); g.moveTo(ik.jx, ik.jy); g.lineTo(fx, leg.footY); g.strokePath();
      g.lineStyle(2.6 * this.s, col, 1);
      g.beginPath(); g.moveTo(fx, leg.footY); g.lineTo(fx + leg.side * 7 * this.s, leg.footY); g.strokePath();
      g.fillStyle(col, 1);
      g.fillCircle(ik.jx, ik.jy, 4.4 * this.s);
    }

    g.fillStyle(col, 1);
    g.beginPath();
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3 + this.breathe * 1.8) * 0.09 + Math.sin(a * 5 - this.breathe) * 0.05;
      const r = this.bodyR * wob * (1 + Math.sin(this.breathe * (this.state === 'chase' ? 4 : 1.2)) * 0.03);
      const x = bx + Math.cos(a) * r * 1.25;
      const y = by + Math.sin(a) * r * 0.92;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fillPath();

    g.lineStyle(3.5 * this.s, col, 1);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.75 + i * 0.22;
      const x0 = bx + Math.cos(a) * this.bodyR * 1.15;
      const y0 = by + Math.sin(a) * this.bodyR * 0.85;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + Math.cos(a) * 16 * this.s * (1 + Math.sin(this.breathe * 2 + i) * 0.15), y0 + Math.sin(a) * 16 * this.s);
      g.strokePath();
    }

    const headX = bx + this.facing * this.bodyR * 1.15;
    const headY = by - this.bodyR * 0.25;
    g.fillStyle(col, 1);
    g.beginPath();
    g.moveTo(bx + this.facing * this.bodyR * 0.5, by - this.bodyR * 0.6);
    g.lineTo(headX + this.facing * 16 * this.s, headY + 2 * this.s);
    g.lineTo(bx + this.facing * this.bodyR * 0.6, by + this.bodyR * 0.35);
    g.closePath(); g.fillPath();
    if (this.state === 'strike') {
      const open = Math.sin(Math.min(1, this.strikeT / 0.42) * Math.PI) * 14 * this.s;
      g.beginPath();
      g.moveTo(bx + this.facing * this.bodyR * 0.7, by + this.bodyR * 0.2);
      g.lineTo(headX + this.facing * 14 * this.s, headY + open + 8 * this.s);
      g.lineTo(bx + this.facing * this.bodyR * 0.62, by + this.bodyR * 0.5);
      g.closePath(); g.fillPath();
    }

    const eg = this.eyeGfx;
    eg.clear();
    if (!this.dead) {
      const glow = this.state === 'lurk' ? 0.35 : 0.85;
      const blink = (Math.sin(this.breathe * 0.7) > 0.96) ? 0 : 1;
      eg.fillStyle(this.boss ? 0xd8b0a0 : 0xd8d4ca, glow * blink);
      eg.fillCircle(headX + this.facing * 4 * this.s, headY - 3 * this.s, 2.5 * this.s);
      eg.fillCircle(headX - this.facing * 4 * this.s, headY - 4.5 * this.s, 1.9 * this.s);
    }
  }
}

/* ---------------- HOUND (4 bacaklı tazı) ---------------- */
class Hound {
  /** cfg: { x, groundY, scale, patrolMinX, patrolMaxX, hp } */
  constructor(scene, cfg) {
    this.scene = scene;
    this.type = 'hound';
    this.s = cfg.scale ?? 0.9;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.y = this.groundY - 26 * this.s;
    this.minX = cfg.patrolMinX; this.maxX = cfg.patrolMaxX;
    this.hp = cfg.hp ?? 3; this.maxHp = this.hp;
    this.boss = !!cfg.boss; this.name = cfg.name;
    this.gfx = scene.add.graphics().setDepth(95);
    this.facing = -1;
    this.vx = 0; this.vy = 0;
    this.state = 'prowl';   // prowl|chase|lunge|recover|dead
    this.lungeT = 0; this.stunT = 0; this.recoverT = 0;
    this.phase = Math.random() * 10;
    this.breathe = Math.random() * 10;
    this.dead = false;
    this.onStrike = null;
    this.airborne = false;
  }
  destroy() { this.gfx.destroy(); }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = 0.25;
    SFAudio.houndYelp?.();
    if (this.hp <= 0) { this.dead = true; this.state = 'dead'; this.deathT = 0; }
  }

  update(dt, player) {
    this.breathe += dt;
    if (this.dead) {
      this.deathT = (this.deathT ?? 0) + dt;
      this.y = lerp(this.y, this.groundY - 8 * this.s, 1 - Math.exp(-dt * 4));
      this.gfx.setAlpha(Math.max(0, 1 - (this.deathT - 1.2) * 0.9));
      this.draw();
      return;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.draw(); return; }

    const px = player.x, py = player.y;
    const dx = px - this.x, dist = Math.abs(dx);
    const vf = visFactor(this.scene, px, py);
    const sense = 360 * vf + (player.crouching ? -40 : 40);

    switch (this.state) {
      case 'prowl': {
        this.vx = this.facing * 55 * this.s;
        if (this.x > this.maxX) this.facing = -1;
        if (this.x < this.minX) this.facing = 1;
        if (dist < sense && px > this.minX - 100 && px < this.maxX + 100) {
          this.state = 'chase'; SFAudio.houndGrowl?.();
        }
        break;
      }
      case 'chase': {
        this.facing = dx > 0 ? 1 : -1;
        this.vx = this.facing * 300 * this.s;
        if (dist > Math.max(600, sense + 200)) this.state = 'prowl';
        else if (dist < 170 && Math.abs(py - this.y) < 90) {
          this.state = 'lunge'; this.lungeT = 0;
          this.vy = -340; this.airborne = true;
          SFAudio.houndGrowl?.(true);
        }
        break;
      }
      case 'lunge': {
        this.lungeT += dt;
        this.vx = this.facing * 430;
        this.vy += 1250 * dt;
        this.y += this.vy * dt;
        if (Math.abs(px - this.x) < 40 && Math.abs(py - this.y) < 60 && !this._hitDone) {
          this._hitDone = true;
          this.onStrike?.(1);
        }
        if (this.y >= this.groundY - 26 * this.s) {
          this.y = this.groundY - 26 * this.s;
          this.airborne = false; this._hitDone = false;
          this.state = 'recover'; this.recoverT = 0;
          SFAudio.thud(0.5);
        }
        break;
      }
      case 'recover': {
        this.recoverT += dt;
        this.vx = 0;
        if (this.recoverT > 0.7) this.state = 'chase';
        break;
      }
    }

    this.x += this.vx * dt;
    this.x = clamp(this.x, this.minX - 60, this.maxX + 60);
    if (!this.airborne) this.y = this.groundY - 26 * this.s + Math.sin(this.breathe * 2) * 1.2;
    this.phase += Math.abs(this.vx) * 0.02 * dt * 60;
    this.draw();
  }

  draw() {
    const g = this.gfx, col = 0x0a0a0e, s = this.s, f = this.facing;
    g.clear();
    const bx = this.x, by = this.y;
    const ph = this.phase;
    const run = Math.abs(this.vx) > 100;
    // 4 bacak — koşuda galop
    const leg = (ox, phOff, front) => {
      const hipX = bx + ox * f * s, hipY = by + 6 * s;
      const reach = run ? Math.cos(ph + phOff) * 16 * s : Math.cos(phOff) * 4 * s;
      const liftL = run ? Math.max(0, Math.sin(ph + phOff)) * 9 * s : 0;
      const fx = hipX + reach * f + (front ? f * 6 * s : -f * 6 * s);
      const fy = this.airborne ? by + 18 * s : this.groundY - liftL;
      const ik = solveIK2(hipX, hipY, fx, fy, 16 * s, 15 * s, front ? (f > 0 ? 1 : -1) : (f > 0 ? -1 : 1));
      g.lineStyle(4.6 * s, col, 1);
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(ik.jx, ik.jy); g.strokePath();
      g.lineStyle(3.2 * s, col, 1);
      g.beginPath(); g.moveTo(ik.jx, ik.jy); g.lineTo(fx, fy); g.strokePath();
    };
    leg(-14, 0, false); leg(16, Math.PI * 0.9, true);
    // gövde — kemikli sırt
    g.fillStyle(col, 1);
    g.beginPath();
    g.moveTo(bx - f * 24 * s, by + 4 * s);
    qTo(g, bx - f * 24 * s, by + 4 * s, bx - f * 6 * s, by - 13 * s - Math.sin(this.breathe * 2) * 1.5, bx + f * 14 * s, by - 7 * s);
    g.lineTo(bx + f * 24 * s, by - 2 * s);
    g.lineTo(bx + f * 20 * s, by + 9 * s);
    g.lineTo(bx - f * 18 * s, by + 11 * s);
    g.closePath(); g.fillPath();
    // kafa + çene
    const hx = bx + f * 28 * s, hy = by - 4 * s;
    g.beginPath();
    g.moveTo(bx + f * 16 * s, by - 8 * s);
    g.lineTo(hx + f * 13 * s, hy + 2 * s);
    g.lineTo(hx + f * 7 * s, hy + 8 * s);
    g.lineTo(bx + f * 16 * s, by + 4 * s);
    g.closePath(); g.fillPath();
    // kuyruk
    g.lineStyle(2.6 * s, col, 1);
    g.beginPath();
    g.moveTo(bx - f * 23 * s, by + 2 * s);
    g.lineTo(bx - f * 34 * s, by - 5 * s + Math.sin(this.breathe * 5) * 3 * s);
    g.strokePath();
    leg(-16, Math.PI * 0.5, false); leg(14, Math.PI * 1.4, true);
    // gözler
    if (!this.dead) {
      g.fillStyle(0xd0c8b8, this.state === 'prowl' ? 0.4 : 0.9);
      g.fillCircle(hx + f * 2 * s, hy - 1.5 * s, 1.8 * s);
    }
  }
}

/* ---------------- LURKER (uzun gölge-insan) ---------------- */
class Lurker {
  /** cfg: { x, groundY, scale, patrolMinX, patrolMaxX, hp } */
  constructor(scene, cfg) {
    this.scene = scene;
    this.type = 'lurker';
    this.s = cfg.scale ?? 1.5;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.minX = cfg.patrolMinX; this.maxX = cfg.patrolMaxX;
    this.hp = cfg.hp ?? 5; this.maxHp = this.hp;
    this.boss = !!cfg.boss; this.name = cfg.name;
    this.rig = new HumanRig(scene, { scale: this.s, depth: 95, color: 0x07070b, variant: 'kai' });
    this.eyeGfx = scene.add.graphics().setDepth(97);
    this.facing = -1;
    this.vx = 0;
    this.state = 'wander';   // wander|stare|chase|strike|dead
    this.stareT = 0; this.strikeT = 0; this.stunT = 0;
    this.dead = false;
    this.onStrike = null;
  }
  destroy() { this.rig.destroy(); this.eyeGfx.destroy(); }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = 0.3;
    SFAudio.monsterRoar(false);
    if (this.hp <= 0) {
      this.dead = true; this.state = 'dead';
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
      const sense = 380 * vf;

      switch (this.state) {
        case 'wander': {
          this.vx = this.facing * 26 * this.s;
          if (this.x > this.maxX) this.facing = -1;
          if (this.x < this.minX) this.facing = 1;
          if (dist < sense) { this.state = 'stare'; this.stareT = 0; SFAudio.lurkerWhisper?.(); }
          break;
        }
        case 'stare': {
          // ürkütücü: durur, kafasını çevirir, sonra aniden koşar
          this.vx = 0;
          this.facing = dx > 0 ? 1 : -1;
          this.stareT += dt;
          if (dist > sense + 140) this.state = 'wander';
          else if (this.stareT > 1.1) { this.state = 'chase'; SFAudio.monsterRoar(false); }
          break;
        }
        case 'chase': {
          this.facing = dx > 0 ? 1 : -1;
          this.vx = this.facing * 250 * Math.min(1.3, this.s * 0.75);
          if (dist > Math.max(640, sense + 260)) this.state = 'wander';
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

    // koşarken dört ayak (crawl), yürürken dik
    const chasing = this.state === 'chase';
    this.rig.update(dt, {
      x: this.x, y: this.groundY - this.rig.A.standH * (chasing ? 0.6 : 1),
      vx: this.vx * (chasing ? 1.6 : 1), vy: 0,
      grounded: true, facing: this.facing,
      mode: chasing ? 'crawl' : (Math.abs(this.vx) > 4 ? 'move' : 'idle'),
      groundY: this.groundY,
    });

    // soluk gözler
    const eg = this.eyeGfx;
    eg.clear();
    const J = this.rig.joints;
    if (J.head) {
      const inten = this.state === 'wander' ? 0.3 : 0.9;
      eg.fillStyle(0xcfd2c8, inten);
      eg.fillCircle(J.head.x + this.facing * 2.5 * this.s, J.head.y - 1 * this.s, 1.7 * this.s);
      eg.fillCircle(J.head.x + this.facing * 6 * this.s, J.head.y - 0.5 * this.s, 1.3 * this.s);
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

/* ---------------- SOLDIER ---------------- */
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
    this.rig = new SoldierRig(scene, { scale: this.s, depth: cfg.depth ?? 98, color: 0x0a0a0f });
    this.rig.hasCarKey = !!cfg.hasCarKey;
    this.hasCarKey = !!cfg.hasCarKey;
    this.lightGfx = scene.add.graphics().setDepth((cfg.depth ?? 98) - 2);

    this.vx = 0;
    this.state = 'patrol';
    this.suspicion = 0;
    this.waitT = 0;
    this.shootCD = 0;
    this.ammo = 6;
    this.reloading = false;
    this.hp = cfg.hp ?? 2;
    this.tough = !!cfg.tough;
    if (this.tough) this.hp = cfg.hp ?? 6;
    this.dead = false;
    this.viewDist = 460;
    this.viewHalfAngle = 0.34;
    this.onShoot = null;
    // feneri ışık sistemine kaydet
    if (scene.lights2) {
      this.light = scene.lights2.addLight({ x: this.x, y: this.groundY - 52, r: 200, type: 'cone', facing: this.facing, intensity: 0.85 });
    }
  }

  destroy() {
    this.rig.destroy(); this.lightGfx.destroy();
    if (this.light) this.scene.lights2.removeLight(this.light);
  }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    SFAudio.hurt();
    if (this.hp <= 0) this.kill(dir * 180);
    else { this.state = 'alert'; this.suspicion = 1; }
  }

  canSee(player, isBlockedFn) {
    if (player.hidden) return false;
    const eyeY = this.groundY - 52 * this.s;
    const dx = player.x - this.x, dy = (player.y - 10) - eyeY;
    let dist = Math.hypot(dx, dy);
    // ışık seviyesi görüş mesafesini belirler — karanlıkta fener kapalıysa görünmez
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

  update(dt, player, isBlockedFn) {
    if (this.dead) {
      this.rig.update(dt, { x: this.x, y: this.groundY - 64 * this.s, grounded: true, mode: 'ragdoll', groundY: this.groundY });
      this.lightGfx.clear();
      if (this.light) this.light.on = false;
      return;
    }

    const seen = this.canSee(player, isBlockedFn);

    switch (this.state) {
      case 'patrol': {
        if (this.static) {
          this.vx = 0;
          this.waitT += dt;
          if (this.waitT > 4 + Math.random() * 2 && !this.staticNoTurn) {
            this.waitT = 0;
            if (Math.random() < 0.4) this.facing *= -1;
          }
        } else {
          this.vx = this.facing * 46;
          if (this.x > this.maxX) this.facing = -1;
          if (this.x < this.minX) this.facing = 1;
        }
        if (seen) this.suspicion += dt * (player.crouching ? 0.8 : 2.4);
        else this.suspicion = Math.max(0, this.suspicion - dt * 0.5);
        if (this.suspicion > 0.35) { this.state = 'suspicious'; this.vx = 0; }
        break;
      }
      case 'suspicious': {
        this.vx = 0;
        this.facing = player.x > this.x ? 1 : -1;
        if (seen) this.suspicion += dt * (player.crouching ? 1.3 : 3.2);
        else this.suspicion -= dt * 0.7;
        if (this.suspicion >= 1) { this.state = 'alert'; SFAudio.thud(0.4); }
        if (this.suspicion <= 0.1) this.state = 'patrol';
        break;
      }
      case 'alert': {
        this.facing = player.x > this.x ? 1 : -1;
        this.shootCD -= dt;
        const dist = Math.abs(player.x - this.x);
        this.vx = (dist > 320 && !this.reloading) ? this.facing * 80 : 0;
        if (seen && this.shootCD <= 0 && !this.reloading && dist < this.viewDist) {
          if (this.ammo <= 0) {
            // ŞARJÖR DEĞİŞTİR — insan gibi: eskisini düşürür, yenisini takar
            this.reloading = true;
            this.vx = 0;
            this.rig.startAction('reload', {
              onPhase: (p) => {
                if (p === 'magout') { SFAudio.magDrop?.(); this.scene.spawnDroppedMag?.(this.x + this.facing * 14, this.groundY - 40); }
                if (p === 'magin') SFAudio.magIn?.();
                if (p === 'rack') SFAudio.rack?.();
              },
              onDone: () => { this.ammo = 6; this.reloading = false; },
            });
          } else {
            this.ammo--;
            this.shootCD = (this.tough ? 0.7 : 1.1) + Math.random() * 0.5;
            const eyeY = this.groundY - 48 * this.s;
            SFAudio.gunshot();
            this.rig.aimAngle = Math.atan2((player.y - 14) - eyeY, Math.abs(player.x - this.x)) * 0.5;
            this.onShoot?.(this.x + this.facing * 24, eyeY, this.facing, player);
          }
        }
        if (!seen) {
          this.suspicion -= dt * 0.25;
          if (this.suspicion < 0.3) { this.state = 'patrol'; this.suspicion = 0; }
        } else this.suspicion = 1;
        break;
      }
    }

    this.x += this.vx * dt;
    this.x = clamp(this.x, this.minX - 40, this.maxX + 40);

    this.rig.stepCallback = (f) => SFAudio.footstep('earth', f * 0.5);
    this.rig.update(dt, {
      x: this.x, y: this.groundY - 64 * this.s,
      vx: this.vx, vy: 0, grounded: true, facing: this.facing,
      mode: Math.abs(this.vx) > 4 ? 'move' : 'idle',
      groundY: this.groundY,
    });

    if (this.light) {
      this.light.x = this.x + this.facing * 16;
      this.light.y = this.groundY - 52 * this.s;
      this.light.facing = this.facing;
    }
    this.drawLight(player, seen);
  }

  drawLight(player, seen) {
    const g = this.lightGfx;
    g.clear();
    const eyeY = this.groundY - 52 * this.s;
    const len = this.viewDist;
    const half = this.viewHalfAngle;
    const tension = this.state === 'alert' ? 1 : this.suspicion;
    const colTop = tension > 0.6 ? 0xc8b4a8 : 0xc4c8d2;
    const alpha = 0.05 + tension * 0.05;
    g.fillStyle(colTop, alpha);
    g.beginPath();
    g.moveTo(this.x + this.facing * 14, eyeY);
    g.lineTo(this.x + this.facing * Math.cos(half) * len, eyeY - Math.sin(half) * len * 0.85);
    g.lineTo(this.x + this.facing * len, eyeY + Math.sin(half * 0.4) * len);
    g.lineTo(this.x + this.facing * Math.cos(half) * len * 0.95, eyeY + Math.sin(half) * len);
    g.closePath(); g.fillPath();
    g.fillStyle(0xe8e4da, 0.5 + tension * 0.3);
    g.fillCircle(this.x + this.facing * 16, eyeY, 2.4);
  }

  kill(impulseX) {
    if (this.dead) return;
    this.dead = true;
    this.rig.startRagdoll(impulseX, -160, () => this.groundY);
    this.lightGfx.clear();
    if (this.light) this.light.on = false;
  }
}
