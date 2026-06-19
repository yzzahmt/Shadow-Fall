/* ============================================================
   SHADOW FALL — Environment Physics
   Su (kaldırma kuvveti, yüzme, sıçrama), rüzgâr (esinti +
   bora), ışık/karanlık sistemi (el feneri konisi, lambalar,
   elektrik kesintisi, karanlıkta gizlenme).
   ============================================================ */
'use strict';

/* ---------------- SU BÖLGESİ ---------------- */
class WaterZone {
  /** cfg: { x0, x1, surfaceY, bottomY } */
  constructor(scene, cfg) {
    this.scene = scene;
    this.x0 = cfg.x0; this.x1 = cfg.x1;
    this.surfaceY = cfg.surfaceY;
    this.bottomY = cfg.bottomY ?? cfg.surfaceY + 220;
    this.gfx = scene.add.graphics().setDepth(108);   // karakterin önünde, yarı saydam
    this.backGfx = scene.add.graphics().setDepth(57); // arkada koyu kütle
    this.t = Math.random() * 10;
    this.ripples = [];   // {x, r, a}
  }

  contains(x, y) { return x > this.x0 && x < this.x1 && y > this.surfaceY && y < this.bottomY; }

  /* gövdenin suya batma oranı 0..1 */
  submersion(y, height) {
    const top = y - height / 2;
    return clamp((this.bottomY - 40 - top > 0 ? (y + height / 2 - this.surfaceY) : 0) / height, 0, 1);
  }

  splash(x, power = 1) {
    if (x < this.x0 || x > this.x1) return;
    this.ripples.push({ x, r: 4, a: 0.55 * power, v: 60 + power * 80 });
    SFAudio.splash?.(Math.min(1, power));
    const p = this.scene.add.particles(x, this.surfaceY, 'softDot', {
      speedY: { min: -240 * power, max: -60 }, speedX: { min: -70, max: 70 },
      lifespan: 520, quantity: Math.round(5 + power * 9), gravityY: 900,
      scale: { start: 0.10 + power * 0.06, end: 0 }, alpha: { start: 0.7, end: 0 },
      tint: 0x9fb2bf, emitting: false,
    }).setDepth(109);
    p.explode(Math.round(6 + power * 10));
    this.scene.time.delayedCall(700, () => p.destroy());
  }

  update(dt) {
    this.t += dt;
    const g = this.gfx, bg = this.backGfx;
    g.clear(); bg.clear();
    const y = this.surfaceY;
    // arka koyu su kütlesi
    bg.fillStyle(0x0a1016, 0.92);
    bg.fillRect(this.x0, y, this.x1 - this.x0, this.bottomY - y);
    // ön yarı saydam katman — karakter suda "içeride" görünür
    g.fillStyle(0x16242e, 0.42);
    g.fillRect(this.x0, y, this.x1 - this.x0, this.bottomY - y);
    // dalgalı yüzey çizgisi
    g.lineStyle(2, 0x6f8694, 0.5);
    g.beginPath();
    for (let x = this.x0; x <= this.x1; x += 14) {
      const wy = y + Math.sin(x * 0.035 + this.t * 1.8) * 2.2 + Math.sin(x * 0.013 - this.t * 1.1) * 1.6;
      if (x === this.x0) g.moveTo(x, wy); else g.lineTo(x, wy);
    }
    g.strokePath();
    // yüzey parlaklık bantları
    g.fillStyle(0x8da4b2, 0.07);
    g.fillRect(this.x0, y, this.x1 - this.x0, 6);
    // halkalar
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += r.v * dt; r.a -= dt * 0.7;
      if (r.a <= 0) { this.ripples.splice(i, 1); continue; }
      g.lineStyle(1.6, 0x9fb2bf, r.a);
      g.strokeEllipse(r.x, y, r.r * 2, r.r * 0.5);
    }
  }
  destroy() { this.gfx.destroy(); this.backGfx.destroy(); }
}

/* ---------------- RÜZGÂR ---------------- */
class WindSystem {
  /** base: 0..1 sürekli şiddet; zones: [{x0,x1,mult}] yerel bora koridorları */
  constructor(scene, base = 0, zones = [], worldW = 4000) {
    this.scene = scene;
    this.base = base;
    this.zones = zones;
    this.t = Math.random() * 100;
    this.gust = 0;
    this.dir = 1; // +x yönü
    // uçuşan yapraklar / kül zerreleri
    if (base > 0.15) {
      this.leaves = scene.add.particles(0, 0, 'leaf', {
        x: { min: -100, max: worldW + 100 }, y: { min: -80, max: scene.scale.height },
        lifespan: 6000, quantity: 1, frequency: Math.max(60, 480 - base * 420),
        speedX: { min: 30 + base * 120, max: 90 + base * 260 },
        speedY: { min: -30, max: 60 },
        rotate: { start: 0, end: 720 },
        scale: { min: 0.5, max: 1.1 }, alpha: { start: 0, peak: 0.55, end: 0 },
        tint: 0x3a3d42,
      }).setDepth(86);
    }
  }

  /* anlık rüzgâr şiddeti 0..1 — çok katmanlı sinüs "bora" */
  strength(x = 0) {
    const t = this.t;
    let s = this.base * (0.45 + 0.3 * Math.sin(t * 0.31) + 0.18 * Math.sin(t * 0.83 + 1.7) + 0.12 * Math.sin(t * 2.1 + 0.4));
    s = Math.max(0, s + this.gust);
    for (const z of this.zones) if (x > z.x0 && x < z.x1) s *= (z.mult ?? 2);
    return clamp(s, 0, 1.6);
  }

  update(dt) {
    this.t += dt;
    // ara sıra ani bora
    if (Math.random() < dt * 0.06 * (this.base + 0.1)) {
      this.gust = 0.35 + Math.random() * 0.4;
      SFAudio.windGust?.(this.gust);
    }
    this.gust = Math.max(0, this.gust - dt * 0.35);
  }

  /* fizik gövdesine yatay kuvvet uygula */
  applyTo(body, dt, airborneFactor = 1) {
    const s = this.strength(body.position.x);
    if (s < 0.04) return;
    const M = Phaser.Physics.Matter.Matter;
    M.Body.applyForce(body, body.position, { x: this.dir * s * 0.00012 * body.mass * airborneFactor, y: 0 });
  }
  destroy() { this.leaves?.destroy(); }
}

/* ---------------- IŞIK / KARANLIK ---------------- */
class LightSystem {
  constructor(scene) {
    this.scene = scene;
    LightSystem.ensureTextures(scene);
    this.darkness = 0;                       // 0=aydınlık, 1=zifiri
    this.lights = [];                        // {x,y,r,type,on,angle,facing,flicker,intensity}
    const W = scene.scale.width, H = scene.scale.height;
    this.rt = scene.add.renderTexture(0, 0, W, H)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(848).setVisible(false);
    this._dot = scene.make.image({ key: 'lightHalo', add: false });
    this._cone = scene.make.image({ key: 'lightCone', add: false }).setOrigin(0.06, 0.5);
  }

  static ensureTextures(scene) {
    if (!scene.textures.exists('lightHalo')) {
      const c = scene.textures.createCanvas('lightHalo', 256, 256);
      const g = c.context;
      const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.45, 'rgba(255,255,255,0.6)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      c.refresh();
    }
    if (!scene.textures.exists('lightCone')) {
      const W = 480, H = 300;
      const c = scene.textures.createCanvas('lightCone', W, H);
      const g = c.context;
      // sağa açılan koni + uçta yumuşama
      const grd = g.createLinearGradient(0, 0, W, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0.98)');
      grd.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(8, H / 2 - 9);
      g.lineTo(W - 8, H / 2 - H * 0.46);
      g.quadraticCurveTo(W, H / 2, W - 8, H / 2 + H * 0.46);
      g.lineTo(8, H / 2 + 9);
      g.closePath(); g.fill();
      // merkez sıcak çekirdek
      const grd2 = g.createRadialGradient(30, H / 2, 4, 30, H / 2, 90);
      grd2.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd2.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd2;
      g.beginPath(); g.arc(30, H / 2, 90, 0, Math.PI * 2); g.fill();
      c.refresh();
    }
    if (!scene.textures.exists('leaf')) {
      const c = scene.textures.createCanvas('leaf', 12, 8);
      const g = c.context;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.ellipse(6, 4, 5, 2.4, 0.5, 0, Math.PI * 2); g.fill();
      c.refresh();
    }
  }

  addLight(cfg) {
    const l = Object.assign({ x: 0, y: 0, r: 120, type: 'halo', on: true, angle: 0, facing: 1, flicker: 0, intensity: 1 }, cfg);
    this.lights.push(l);
    return l;
  }
  removeLight(l) { const i = this.lights.indexOf(l); if (i >= 0) this.lights.splice(i, 1); }

  setDarkness(v, ms = 1200) {
    this.scene.tweens.add({ targets: this, darkness: clamp(v, 0, 1), duration: ms, ease: 'Sine.easeInOut' });
  }

  /* bir noktadaki ışık miktarı 0..1 — gizlilik hesabı için */
  levelAt(x, y) {
    let lv = 1 - this.darkness;
    for (const l of this.lights) {
      if (!l.on) continue;
      const dx = x - l.x, dy = y - l.y;
      if (l.type === 'cone') {
        // koninin yönüne bak
        const along = dx * l.facing;
        const reach = l.r * 2.1;
        if (along > -20 && along < reach) {
          const spread = 16 + along * 0.55;
          if (Math.abs(dy - along * Math.tan(l.angle ?? 0) * l.facing) < spread) {
            lv = Math.max(lv, l.intensity * (1 - along / reach));
          }
        }
        // fener tutanın etrafı hafif aydınlık
        const d = Math.hypot(dx, dy);
        if (d < 70) lv = Math.max(lv, 0.5 * (1 - d / 70));
      } else {
        const d = Math.hypot(dx, dy);
        if (d < l.r) lv = Math.max(lv, l.intensity * (1 - d / l.r));
      }
    }
    return clamp(lv, 0, 1);
  }

  update(time) {
    const dark = this.darkness;
    if (dark < 0.02) { this.rt.setVisible(false); return; }
    const cam = this.scene.cameras.main;
    const rt = this.rt;
    rt.setVisible(true);
    rt.clear();
    // zifiri perdelerde neredeyse tam siyah → fener olmadan görülmez
    rt.fill(0x000103, Math.min(0.995, dark > 0.85 ? 0.93 + (dark - 0.85) * 0.46 : dark));
    for (const l of this.lights) {
      if (!l.on) continue;
      let inten = l.intensity;
      if (l.flicker) inten *= (Math.random() < l.flicker ? 0.25 : 0.92 + Math.random() * 0.08);
      const sx = (l.x - cam.scrollX) * cam.zoom + cam.width * (1 - cam.zoom) / 2;
      const sy = (l.y - cam.scrollY) * cam.zoom + cam.height * (1 - cam.zoom) / 2;
      if (l.type === 'cone') {
        this._cone.setScale((l.r / 220) * cam.zoom * inten, (l.r / 260) * cam.zoom);
        this._cone.setRotation(l.facing > 0 ? (l.angle ?? 0) : Math.PI - (l.angle ?? 0));
        this._cone.setAlpha(Math.min(1, inten));
        rt.erase(this._cone, sx, sy);
        // fener gövde halkası
        this._dot.setScale(0.55 * cam.zoom).setAlpha(0.8);
        rt.erase(this._dot, sx, sy);
      } else {
        this._dot.setScale((l.r / 110) * cam.zoom).setAlpha(Math.min(1, inten));
        rt.erase(this._dot, sx, sy);
      }
    }
  }

  resize(w, h) {
    this.rt.setSize(w, h);
  }
  destroy() { this.rt.destroy(); }
}
