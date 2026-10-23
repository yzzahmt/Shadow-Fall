/* ============================================================
   SHADOW FALL — Physics Items & Puzzles v2
   Matter.js rigid-body eşyalar + bulmaca bileşenleri:
   levye, anahtar, pil (+bitmiş pil), bandaj, tabanca, şarjör
   (+boş şarjör), kol (lever), merdiven, jeneratör, sürülebilir
   araba, levyeyle açılan kutular, kapılar, itilebilir sandıklar.
   ============================================================ */
'use strict';

/* Phaser Graphics'te quadraticCurveTo yok — segmentlerle yaklaştır */
function qTo(g, x0, y0, cx, cy, x1, y1, n = 10) {
  for (let i = 1; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    g.lineTo(mt * mt * x0 + 2 * mt * t * cx + t * t * x1, mt * mt * y0 + 2 * mt * t * cy + t * t * y1);
  }
}

/* çarpışma kategorileri */
const CAT = { WORLD: 0x0001, PLAYER: 0x0002, ITEM: 0x0004, PUSHBOX: 0x0008, RAGDOLL: 0x0010 };

const ITEM_DEFS = {
  crowbar: {
    label: 'LEVYE', sound: 'metal', density: 0.004, friction: 0.4, restitution: 0.25,
    w: 34, h: 8, pickable: true,
    draw(g, c) {
      g.lineStyle(4.5, c, 1);
      g.beginPath(); g.moveTo(-15, 6); g.lineTo(10, -4); g.strokePath();
      g.lineStyle(4, c, 1);
      g.beginPath(); g.moveTo(10, -4); g.lineTo(16, -7); g.strokePath();
      g.lineStyle(3, c, 1);
      g.beginPath(); g.moveTo(16, -7); g.lineTo(15, -2); g.strokePath();
      g.fillStyle(c, 1); g.fillCircle(-15, 6, 2.6);
    },
  },
  key: {
    label: 'ANAHTAR', sound: 'metal', density: 0.002, friction: 0.5, restitution: 0.35,
    w: 22, h: 10, pickable: true,
    draw(g, c) {
      g.lineStyle(2.6, c, 1);
      g.strokeCircle(-7, 0, 4.4);
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(10, 0); g.strokePath();
      g.beginPath(); g.moveTo(7, 0); g.lineTo(7, 4.5); g.strokePath();
      g.beginPath(); g.moveTo(10, 0); g.lineTo(10, 4.5); g.strokePath();
    },
  },
  battery: {
    label: 'PİL', sound: 'metal', density: 0.006, friction: 0.6, restitution: 0.15,
    w: 14, h: 22, pickable: true,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.fillRoundedRect(-7, -10, 14, 20, 2.5);
      g.fillRect(-3, -13, 6, 3);
      g.fillStyle(0x2a2a32, 1);
      g.fillRect(-3.5, -5, 7, 1.6);
      g.fillRect(-3.5, 3, 7, 1.6);
      g.fillRect(-0.8, 0.3, 1.6, 7);
    },
  },
  deadBattery: {
    label: '', sound: 'metal', density: 0.006, friction: 0.7, restitution: 0.1,
    w: 14, h: 22, pickable: false,
    draw(g, c) {
      g.fillStyle(c, 0.85);
      g.fillRoundedRect(-7, -10, 14, 20, 2.5);
      g.fillRect(-3, -13, 6, 3);
      g.lineStyle(1.4, 0x232328, 0.9);
      g.beginPath(); g.moveTo(-5, -7); g.lineTo(5, 7); g.strokePath(); // çizik — bitmiş
    },
  },
  bandage: {
    label: 'BANDAJ', sound: 'soft', density: 0.001, friction: 0.8, restitution: 0.1,
    w: 16, h: 12, pickable: true,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.fillRoundedRect(-8, -5, 16, 10, 4);
      g.lineStyle(1.2, 0x2a2a32, 0.9);
      g.beginPath(); g.moveTo(-5, -5); g.lineTo(-2, 5); g.strokePath();
      g.beginPath(); g.moveTo(0, -5); g.lineTo(3, 5); g.strokePath();
      g.beginPath(); g.moveTo(5, -5); g.lineTo(8, 3); g.strokePath();
    },
  },
  pistol: {
    label: 'TABANCA', sound: 'metal', density: 0.005, friction: 0.5, restitution: 0.18,
    w: 24, h: 16, pickable: true,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.fillRect(-11, -7, 22, 6);     // namlu+gövde
      g.fillRect(-3, -2, 7, 10);      // kabza
      g.fillRect(2, -1, 4, 4);        // tetik korkuluğu
    },
  },
  cutters: {
    label: 'PENSE', sound: 'metal', density: 0.004, friction: 0.6, restitution: 0.2,
    w: 22, h: 10, pickable: true,
    draw(g, c) {
      g.lineStyle(2.6, c, 1);
      g.beginPath(); g.moveTo(-10, -4); g.lineTo(2, 0); g.lineTo(10, -2); g.strokePath();
      g.beginPath(); g.moveTo(-10, 4); g.lineTo(2, 0); g.lineTo(10, 2); g.strokePath();
      g.fillStyle(c, 1); g.fillCircle(2, 0, 2.4);
    },
  },
  fuse: {
    label: 'SİGORTA', sound: 'metal', density: 0.004, friction: 0.6, restitution: 0.15,
    w: 10, h: 18, pickable: true,
    draw(g, c) {
      g.fillStyle(c, 1); g.fillRoundedRect(-5, -9, 10, 18, 2);
      g.fillStyle(0x6a6450, 1); g.fillRect(-4, -9, 8, 3); g.fillRect(-4, 6, 8, 3);
    },
  },
  note: {
    label: 'NOT', sound: 'soft', density: 0.0008, friction: 0.9, restitution: 0.05,
    w: 14, h: 6, pickable: true,
    draw(g, c) {
      g.fillStyle(0x4a4a50, 1); g.fillRect(-7, -3, 14, 6);
      g.lineStyle(0.8, c, 1); g.beginPath(); g.moveTo(-5, 0); g.lineTo(4, 0); g.strokePath();
    },
  },
  manual: {
    label: 'KÂĞIT', sound: 'soft', density: 0.0008, friction: 0.9, restitution: 0.05,
    w: 16, h: 6, pickable: true,
    draw(g, c) {
      g.fillStyle(0x3a3a40, 1);
      g.fillRect(-8, -3, 16, 6);
      g.lineStyle(0.8, c, 1);
      g.beginPath(); g.moveTo(-6, -1); g.lineTo(5, -1); g.moveTo(-6, 1.4); g.lineTo(3, 1.4); g.strokePath();
    },
  },
  mag: {
    label: 'ŞARJÖR', sound: 'metal', density: 0.004, friction: 0.6, restitution: 0.2,
    w: 10, h: 16, pickable: true,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.fillRoundedRect(-5, -8, 10, 16, 1.5);
      g.fillStyle(0x2a2a32, 1);
      g.fillRect(-3, -6, 6, 1.4);
      g.fillRect(-3, -2, 6, 1.4);
    },
  },
  magEmpty: {
    label: '', sound: 'metal', density: 0.004, friction: 0.7, restitution: 0.25,
    w: 10, h: 16, pickable: false,
    draw(g, c) {
      g.fillStyle(c, 0.9);
      g.fillRoundedRect(-5, -8, 10, 16, 1.5);
    },
  },
  plank: {
    label: '', sound: 'wood', density: 0.003, friction: 0.6, restitution: 0.2,
    w: 38, h: 7, pickable: false,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.fillRect(-19, -3.5, 38, 7);
      g.fillStyle(0x1c1c24, 0.6);
      g.fillRect(-12, -1, 7, 1.4); g.fillRect(4, 0.5, 9, 1.2);
    },
  },
  shard: {
    label: '', sound: 'wood', density: 0.002, friction: 0.7, restitution: 0.25,
    w: 14, h: 10, pickable: false,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.beginPath(); g.moveTo(-7, 4); g.lineTo(0, -5); g.lineTo(7, 2); g.lineTo(1, 5);
      g.closePath(); g.fillPath();
    },
  },
  can: {
    label: '', sound: 'metal', density: 0.0015, friction: 0.35, restitution: 0.45, floats: true,
    w: 10, h: 14, pickable: false,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.fillRoundedRect(-5, -7, 10, 14, 1.6);
      g.lineStyle(1, 0x2a2a32, 0.7);
      g.strokeRoundedRect(-4, -5.4, 8, 3, 1);
    },
  },
  stone: {
    label: '', sound: 'wood', density: 0.01, friction: 0.8, restitution: 0.12,
    w: 16, h: 13, pickable: false,
    draw(g, c) {
      g.fillStyle(c, 1);
      g.beginPath(); g.moveTo(-8, 3); g.lineTo(-5, -6); g.lineTo(4, -6.5); g.lineTo(8, 0); g.lineTo(5, 6); g.lineTo(-4, 6);
      g.closePath(); g.fillPath();
    },
  },
};

class PhysItem {
  constructor(scene, kind, x, y, opts = {}) {
    this.scene = scene;
    this.kind = kind;
    const def = ITEM_DEFS[kind];
    this.def = def;
    this.src = opts.src ?? (kind + '@' + Math.round(x / 40));   // bölüm özetinde "bulunan eşya" anahtarı
    const col = opts.color ?? 0x101016;

    this.gfx = scene.add.graphics().setDepth(opts.depth ?? 96);
    def.draw(this.gfx, col);

    this.body = scene.matter.add.rectangle(x, y, def.w, def.h, {
      density: def.density, friction: def.friction, restitution: def.restitution,
      frictionAir: 0.012,
      angle: opts.angle ?? (Math.random() - 0.5) * 0.6,
      collisionFilter: { category: CAT.ITEM, mask: CAT.WORLD | CAT.ITEM | CAT.PUSHBOX },
      label: 'item:' + kind,
    });
    this.body.sfItem = this;
    if (opts.vx || opts.vy) {
      Phaser.Physics.Matter.Matter.Body.setVelocity(this.body, { x: opts.vx ?? 0, y: opts.vy ?? 0 });
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(this.body, (Math.random() - 0.5) * 0.3);
    }
    this.meta = opts.meta ?? null;
    this.picked = false;
    this.inWater = false;
    this.glowT = Math.random() * 10;
    this.glowGfx = def.pickable ? scene.add.graphics().setDepth((opts.depth ?? 96) - 1) : null;
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }

  update(dt) {
    if (this.picked) return;
    // su kaldırma kuvveti — hafif eşyalar yüzer, taşlar batar
    if (this.scene.waters?.length) {
      const M = Phaser.Physics.Matter.Matter;
      for (const w of this.scene.waters) {
        if (this.x > w.x0 && this.x < w.x1 && this.y > w.surfaceY - 8) {
          if (!this.inWater) { this.inWater = true; w.splash(this.x, 0.4); }
          const sub = clamp((this.y - w.surfaceY + 8) / 24, 0, 1);
          const buoy = this.def.floats ? 1.9 : (this.def.density < 0.004 ? 1.35 : 0.55);
          M.Body.applyForce(this.body, this.body.position, { x: 0, y: -this.body.mass * 0.0017 * sub * buoy });
          M.Body.setVelocity(this.body, { x: this.body.velocity.x * 0.96, y: this.body.velocity.y * 0.93 });
        } else if (this.inWater && (this.x < w.x0 || this.x > w.x1 || this.y < w.surfaceY - 20)) {
          this.inWater = false;
        }
      }
    }
    this.gfx.x = this.body.position.x;
    this.gfx.y = this.body.position.y;
    this.gfx.rotation = this.body.angle;
    if (this.glowGfx) {
      this.glowT += dt;
      this.glowGfx.clear();
      const a = 0.05 + Math.abs(Math.sin(this.glowT * 1.3)) * 0.07;
      this.glowGfx.fillStyle(0xd8d4c8, a);
      this.glowGfx.fillCircle(this.body.position.x, this.body.position.y - 2, 17);
    }
  }

  /* ele alınma — el pozisyonuna süzülür (insansı alma animasyonuyla senkron) */
  pickupToHand(handX, handY) {
    if (this.picked) return;
    this.picked = true;
    SFAudio.pickup();
    this.scene.matter.world.remove(this.body);
    this.scene.tweens.add({
      targets: this.gfx, x: handX, y: handY, alpha: 0.0, scale: 0.6, duration: 300, ease: 'Quad.easeIn',
      onComplete: () => this.gfx.destroy(),
    });
    if (this.glowGfx) this.glowGfx.destroy();
  }

  pickup() { this.pickupToHand(this.x, this.y - 26); }

  destroy() {
    if (!this.picked) this.scene.matter.world.remove(this.body);
    this.gfx.destroy();
    if (this.glowGfx) this.glowGfx.destroy();
  }
}

/* ---------------- KUTU (levyeyle açılır) ---------------- */
class Crate {
  constructor(scene, cfg) {
    this.scene = scene;
    this.x = cfg.x;
    this.w = cfg.w ?? 64; this.h = cfg.h ?? 52;
    this.groundY = cfg.groundY;
    this.y = cfg.groundY - this.h / 2;
    this.contents = cfg.contents ?? ['bandage'];
    this.needsCrowbar = cfg.needsCrowbar ?? true;
    this.opened = false;
    this.pryProgress = 0;
    this.col = 0x101016;

    this.body = scene.matter.add.rectangle(this.x, this.y, this.w, this.h, {
      isStatic: true, friction: 0.9,
      collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      label: 'crate',
    });
    this.body.sfCrate = this;
    this.gfx = scene.add.graphics().setDepth(94);
    this.draw();
  }

  draw() {
    const g = this.gfx, c = this.col;
    g.clear();
    const x = this.x, y = this.y, w = this.w, h = this.h;
    g.fillStyle(c, 1);
    g.fillRect(x - w / 2, y - h / 2, w, h);
    g.lineStyle(1.4, 0x1e1e26, 0.8);
    for (let i = 1; i < 3; i++) {
      g.beginPath(); g.moveTo(x - w / 2 + 3, y - h / 2 + (h / 3) * i); g.lineTo(x + w / 2 - 3, y - h / 2 + (h / 3) * i); g.strokePath();
    }
    g.strokeRect(x - w / 2 + 2.5, y - h / 2 + 2.5, w - 5, h - 5);
    if (!this.opened) {
      g.lineStyle(2, 0x1e1e26, 0.9);
      g.beginPath(); g.moveTo(x - w / 2, y - h / 2 + 7); g.lineTo(x + w / 2, y - h / 2 + 7); g.strokePath();
      g.fillStyle(0x1e1e26, 1);
      g.fillCircle(x - w / 2 + 7, y - h / 2 + 3.5, 1.4);
      g.fillCircle(x + w / 2 - 7, y - h / 2 + 3.5, 1.4);
      if (this.pryProgress > 0) {
        const gap = this.pryProgress * 2.2;
        g.fillStyle(0x000000, 0.9);
        g.fillRect(x - w / 2, y - h / 2 + 5 - gap, w, gap);
      }
    }
  }

  pryOnce() {
    if (this.opened) return false;
    this.pryProgress++;
    SFAudio.pry(this.pryProgress / 3);
    this.scene.cameras.main.shake(120, 0.0035);
    this.draw();
    if (this.pryProgress >= 3) {
      this.scene.time.delayedCall(180, () => this.burst());
      return true;
    }
    return false;
  }

  burst() {
    if (this.opened) return;
    this.opened = true;
    SFAudio.crateBurst();
    this.scene.cameras.main.shake(200, 0.006);
    const lid = new PhysItem(this.scene, 'plank', this.x, this.y - this.h / 2, {
      vx: (Math.random() - 0.5) * 3, vy: -7, depth: 97,
    });
    this.scene.physItems.push(lid);
    this.contents.forEach((kind, i) => {
      this.scene.time.delayedCall(60 + i * 70, () => {
        const [k, ...meta] = kind.split(':');          // 'note:shop1:2' → not + kilit bilgisi
        const it = new PhysItem(this.scene, k, this.x + (Math.random() - 0.5) * 14, this.y - this.h / 2 - 6, {
          vx: (Math.random() - 0.5) * 5, vy: -4 - Math.random() * 3, depth: 97, meta: meta.join(':'),
          src: 'k' + Math.round(this.x) + ':' + i,
        });
        this.scene.physItems.push(it);
      });
    });
    for (let i = 0; i < 3; i++) {
      const sh = new PhysItem(this.scene, 'shard', this.x + (Math.random() - 0.5) * 30, this.y - this.h / 2, {
        vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 4, depth: 95,
      });
      this.scene.physItems.push(sh);
    }
    this.draw();
  }
}

/* ---------------- SAKLAMA YERLERİ ----------------
   Her şey kutudan çıkmaz: komodin çekmecesi, dolap, gardırop, duvardaki ilk
   yardım dolabı, işçi dolabı, alet çantası, buzdolabı, terk edilmiş sırt
   çantası, ağaç kovuğu, araç torpidosu, posta kutusu, çöp kutusu, sandık,
   cephane kutusu, havalandırma ızgarası. Bandaj yalnız "tıbbi" saklama
   yerlerinden çıkar (çekmece, dolap, ilk yardım, çanta, sandık...).
   Pil / şarjör ağaç kovuğundan çıkmaz (noGear).
   İçindekiler doğrudan envantere geçer; boş olanlar da vardır. */
const CONTAINER_DEFS = {
  drawer:   { label: 'ÇEKMECEYİ AÇ',       w: 56, h: 52, med: true,  reach: 'low' },
  cabinet:  { label: 'DOLABI AÇ',          w: 50, h: 112, med: true, reach: 'mid' },
  wardrobe: { label: 'GARDIROBU AÇ',       w: 72, h: 132, med: true, reach: 'mid' },
  medkit:   { label: 'İLK YARDIM DOLABI',  w: 30, h: 26, med: true,  reach: 'mid', mountY: 96 },
  locker:   { label: 'DOLABI AÇ',          w: 34, h: 122, med: true, reach: 'mid' },
  toolbox:  { label: 'ALET ÇANTASINI AÇ',  w: 40, h: 20, med: false, reach: 'low' },
  fridge:   { label: 'BUZDOLABINI AÇ',     w: 46, h: 104, med: false, reach: 'mid' },
  backpack: { label: 'ÇANTAYI KARIŞTIR',   w: 26, h: 22, med: true,  reach: 'low' },
  hollow:   { label: 'KOVUĞA BAK',         w: 34, h: 170, med: false, reach: 'mid', mountY: 64, noGear: true },
  glovebox: { label: 'TORPİDOYU AÇ',       w: 18, h: 10, med: false, reach: 'mid', mountY: 34 },
  mailbox:  { label: 'POSTA KUTUSUNA BAK', w: 24, h: 92, med: false, reach: 'mid', mountY: 80 },
  trash:    { label: 'ÇÖPÜ KARIŞTIR',      w: 34, h: 46, med: false, reach: 'low' },
  chest:    { label: 'SANDIĞI AÇ',         w: 58, h: 36, med: true,  reach: 'low' },
  ammo:     { label: 'CEPHANE KUTUSUNU AÇ', w: 46, h: 24, med: false, reach: 'low' },
  vent:     { label: 'IZGARAYI SÖK',       w: 32, h: 22, med: false, reach: 'low', mountY: 30 },
  trunk:    { label: 'BAGAJI AÇ',          w: 150, h: 70, med: false, reach: 'mid', mountY: 42 },
};
const ITEM_NAMES = {
  bandage: 'BANDAJ', battery: 'PİL', mag: 'ŞARJÖR', key: 'ANAHTAR', fuse: 'SİGORTA', crowbar: 'LEVYE',
  note: 'NOT', cutters: 'PENSE', manual: 'TALİMAT', pistol: 'TABANCA', valve: 'VANA KOLU',
};

class Container {
  /** cfg: { kind, x, groundY, contents, needsCrowbar } */
  constructor(scene, cfg) {
    this.scene = scene;
    this.kind = cfg.kind;
    this.def = CONTAINER_DEFS[cfg.kind] ?? CONTAINER_DEFS.drawer;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.w = this.def.w; this.h = this.def.h;
    /* etkileşim noktası: duvara asılılarda montaj yüksekliği, diğerlerinde gövde ortası */
    this.y = cfg.groundY - (this.def.mountY ?? this.h / 2);
    this.contents = cfg.contents ?? [];
    this.needsCrowbar = !!cfg.needsCrowbar;
    this.opened = false;
    this.openAmt = 0;
    this.pryProgress = 0;
    this.gfx = scene.add.graphics().setDepth(cfg.depth ?? 64);
    this.glow = scene.add.graphics().setDepth(63);
    /* açık havadaki ilk yardım dolabı bir direğe asılı durur */
    this.post = this.kind === 'medkit' && !scene.ch?.interior && !(scene.ch?.buildings ?? []).some(b => this.x > b.x0 && this.x < b.x1);
    this.t = Math.random() * 6;
    this.draw();
  }

  get label() { return this.needsCrowbar ? 'LEVYEYLE ZORLA' : this.def.label; }

  update(dt) {
    if (this.opened) return;
    this.t += dt;
    /* belli belirsiz parıltı — keşfedilebilir olduğunu söyler, bağırmaz */
    const g = this.glow; g.clear();
    g.fillStyle(0xd8d4c8, 0.035 + Math.abs(Math.sin(this.t * 1.1)) * 0.045);
    g.fillCircle(this.x, this.y, 20);
  }

  pryOnce() {
    if (this.opened) return false;
    this.pryProgress++;
    SFAudio.pry(this.pryProgress / 2);
    this.scene.cameras.main.shake(100, 0.003);
    if (this.pryProgress >= 2) { this.open(); return true; }
    return false;
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    this.glow.clear();
    const sc = this.scene;
    const metal = ['locker', 'toolbox', 'fridge', 'mailbox', 'ammo', 'vent', 'medkit', 'glovebox', 'trash'].includes(this.kind);
    SFAudio.itemHit(metal ? 'metal' : 'wood', 0.35);
    if (this.kind === 'drawer' || this.kind === 'cabinet' || this.kind === 'wardrobe') SFAudio.doorCreak();
    sc.tweens.add({ targets: this, openAmt: 1, duration: 420, ease: 'Quad.easeOut', onUpdate: () => this.draw() });
    sc.time.delayedCall(260, () => {
      if (!this.contents.length) { this._float('BOŞ', 0x8e8a82); return; }
      this.contents.forEach((raw, i) => {
        const [k, ...meta] = raw.split(':');
        sc.time.delayedCall(i * 220, () => {
          sc.collectItem(k, { meta: meta.join(':'), src: 'c' + Math.round(this.x) + ':' + i });
          SFAudio.pickup();
          this._float('+ ' + (ITEM_NAMES[k] ?? k.toUpperCase()), 0xe2ded6, i);
        });
      });
    });
    /* bir yerde hep aynı şey bulunmasın: açılan saklama yeri ses yapar, yakındakiler duyar */
    if (metal) sc.makeNoise(this.x, this.y, 160, 0.25);
  }

  _float(text, color, i = 0) {
    const sc = this.scene;
    const t = sc.add.text(this.x, this.y - this.h * 0.2 - 18 - i * 16, text, {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', fontStyle: '500',
      color: '#' + color.toString(16).padStart(6, '0'), stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(870).setAlpha(0);
    sc.tweens.add({ targets: t, alpha: 1, y: t.y - 10, duration: 260, ease: 'Quad.easeOut' });
    sc.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1300, duration: 600, onComplete: () => t.destroy() });
  }

  draw() {
    const g = this.gfx; g.clear();
    const c = 0x0c0c11, edge = 0x1d1e26, x = this.x, gy = this.groundY, o = this.openAmt;
    g.fillStyle(c, 1);
    g.lineStyle(1.2, edge, 0.9);
    switch (this.kind) {
      case 'drawer': {                         // üç çekmeceli komodin, üstünde lamba/çerçeve
        const w = 56, h = 52, x0 = x - w / 2, y0 = gy - h;
        g.fillRect(x0, y0, w, h); g.fillRect(x0 + 3, gy - 3, 6, 3); g.fillRect(x0 + w - 9, gy - 3, 6, 3);
        for (let i = 0; i < 3; i++) {
          const dy = y0 + 4 + i * 15;
          const pull = i === 0 ? o * 14 : 0;
          g.strokeRect(x0 + 4 + pull * 0.2, dy, w - 8, 12);
          if (pull) { g.fillStyle(c, 1); g.fillRect(x0 + 4, dy, w - 8 + pull, 12); g.strokeRect(x0 + 4, dy, w - 8 + pull, 12); }
          g.fillStyle(edge, 1); g.fillCircle(x + pull, dy + 6, 1.6); g.fillStyle(c, 1);
        }
        g.fillRect(x - 18, y0 - 14, 7, 14); g.fillEllipse(x - 14.5, y0 - 16, 14, 6);   // masa lambası
        g.strokeRect(x + 8, y0 - 12, 12, 12);                                           // çerçeve
        break;
      }
      case 'cabinet': case 'wardrobe': case 'locker': case 'fridge': {
        const w = this.w, h = this.h, x0 = x - w / 2, y0 = gy - h;
        g.fillRect(x0, y0, w, h);
        const doors = this.kind === 'wardrobe' ? 2 : 1;
        const dw = w / doors;
        for (let i = 0; i < doors; i++) {
          const dx0 = x0 + i * dw;
          if (o > 0 && (i === doors - 1)) {
            /* kapak açılır: perspektif daralan kanat */
            const sw = dw * (1 - o * 0.75);
            g.fillStyle(0x050507, 1); g.fillRect(dx0 + 2, y0 + 3, dw - 4, h - 6);
            g.fillStyle(c, 1);
            g.beginPath(); g.moveTo(dx0 + dw, y0 + 2); g.lineTo(dx0 + dw + sw * 0.9, y0 - 4); g.lineTo(dx0 + dw + sw * 0.9, gy + 2); g.lineTo(dx0 + dw, gy - 2); g.closePath(); g.fillPath();
            g.strokePath();
          } else {
            g.strokeRect(dx0 + 3, y0 + 3, dw - 6, h - 6);
            g.fillStyle(edge, 1); g.fillRect(dx0 + dw - 8, y0 + h * 0.45, 2, 10); g.fillStyle(c, 1);
          }
        }
        if (this.kind === 'locker') { for (let k = 0; k < 4; k++) g.fillStyle(edge, 1).fillRect(x0 + 8, y0 + 10 + k * 4, w - 16, 1.5); g.fillStyle(c, 1); }
        if (this.kind === 'fridge') { g.lineStyle(1.2, edge, 0.9); g.beginPath(); g.moveTo(x0 + 3, y0 + h * 0.36); g.lineTo(x0 + w - 3, y0 + h * 0.36); g.strokePath(); }
        if (this.kind === 'wardrobe') g.fillRect(x0 - 3, y0 - 6, w + 6, 6);
        break;
      }
      case 'medkit': {
        const y = this.y;
        if (this.post) { g.fillRect(x - 3, y, 6, gy - y); g.fillRect(x - 12, gy - 4, 24, 4); }
        g.fillRect(x - 15, y - 13, 30, 26);
        g.fillStyle(0x6e2b2b, 0.85);                 // soluk kızıl haç — dünyadaki seyrek renklerden
        g.fillRect(x - 2.5, y - 8, 5, 16); g.fillRect(x - 8, y - 2.5, 16, 5);
        if (o > 0) { g.fillStyle(c, 1); g.fillRect(x - 15 - o * 16, y - 13, o * 14, 26); g.fillStyle(0x050507, 1); g.fillRect(x - 13, y - 11, 26 * o, 22); }
        break;
      }
      case 'toolbox': case 'ammo': case 'chest': {
        const w = this.w, h = this.h, x0 = x - w / 2, y0 = gy - h;
        g.fillRect(x0, y0 + 4, w, h - 4);
        /* kapak: açıldıkça arkaya devrilir */
        const lidA = o * 1.9;
        g.beginPath();
        g.moveTo(x0, y0 + 4); g.lineTo(x0 + w, y0 + 4);
        g.lineTo(x0 + w - Math.sin(lidA) * 2, y0 + 4 - Math.cos(lidA) * 8 - Math.sin(lidA) * 2);
        g.lineTo(x0 + Math.cos(lidA) * 0 , y0 + 4 - Math.cos(lidA) * 8 - Math.sin(lidA) * 14 * (this.kind === 'chest' ? 1 : 0.6));
        g.closePath(); g.fillPath();
        if (this.kind === 'toolbox') g.fillRect(x - 7, y0 - 3, 14, 3);
        if (this.kind === 'ammo') { g.fillStyle(edge, 1); g.fillRect(x0 + 6, y0 + 10, w - 12, 2); }
        if (this.kind === 'chest') { g.fillStyle(edge, 1); g.fillRect(x - 3, y0 + 8, 6, 7); g.fillRect(x0, y0 + 14, w, 2); }
        break;
      }
      case 'backpack': {
        const y0 = gy - 22;
        g.fillRoundedRect(x - 12, y0, 24, 22, 6);
        g.fillRoundedRect(x - 9, y0 + 9, 18, 10, 3);
        g.lineStyle(2, c, 1); g.beginPath(); g.moveTo(x - 6, y0 + 2); g.lineTo(x - 2, y0 - 6); g.lineTo(x + 4, y0 + 1); g.strokePath();
        if (o > 0) { g.fillStyle(0x050507, 1); g.fillEllipse(x, y0 + 3, 16 * o, 4); }
        break;
      }
      case 'hollow': {                         // kuru gövde, ortasında kovuk
        g.beginPath();
        g.moveTo(x - 16, gy); qTo(g, x - 16, gy, x - 10, gy - 90, x - 6, gy - 170);
        g.lineTo(x + 6, gy - 170); qTo(g, x + 6, gy - 170, x + 11, gy - 80, x + 18, gy);
        g.closePath(); g.fillPath();
        g.lineStyle(4, c, 1); g.beginPath(); g.moveTo(x - 4, gy - 140); qTo(g, x - 4, gy - 140, x - 36, gy - 170, x - 56, gy - 200); g.strokePath();
        g.fillStyle(0x020203, 1); g.fillEllipse(x + 2, this.y, 13, 20);
        if (!this.opened) { g.fillStyle(0x2a2a30, 0.8); g.fillEllipse(x + 3, this.y + 5, 6, 4); }
        break;
      }
      case 'trunk': {                          // terk edilmiş araba: bagaj arkada (solda), kapak yukarı kalkar
        const rx = x - 12, L = 162;
        g.fillRoundedRect(rx, gy - 46, L, 28, 6);
        g.beginPath(); g.moveTo(rx + 44, gy - 44); g.lineTo(rx + 64, gy - 70); g.lineTo(rx + 114, gy - 70); g.lineTo(rx + 138, gy - 44); g.closePath(); g.fillPath();
        g.fillStyle(0x16171d, 1);                                   // kırık camlar
        g.beginPath(); g.moveTo(rx + 52, gy - 46); g.lineTo(rx + 67, gy - 66); g.lineTo(rx + 86, gy - 66); g.lineTo(rx + 80, gy - 54); g.lineTo(rx + 86, gy - 46); g.closePath(); g.fillPath();
        g.beginPath(); g.moveTo(rx + 92, gy - 46); g.lineTo(rx + 92, gy - 66); g.lineTo(rx + 111, gy - 66); g.lineTo(rx + 129, gy - 46); g.closePath(); g.fillPath();
        g.fillStyle(0x08080b, 1);
        g.fillCircle(rx + 34, gy - 13, 12);
        g.fillEllipse(rx + 130, gy - 7, 28, 13);                   // patlak lastik
        g.fillStyle(c, 1);
        g.strokeRect(rx + 2, gy - 44, 32, 20);
        if (o > 0) {
          g.fillStyle(0x050507, 1); g.fillRect(rx + 3, gy - 45, 30, 8);
          const a = o * 1.25, hx = rx + 36, hy = gy - 46;
          g.lineStyle(5, c, 1);
          g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - Math.cos(a) * 34, hy - Math.sin(a) * 34); g.strokePath();
        } else { g.fillStyle(c, 1); g.fillRect(rx, gy - 48, 36, 4); }
        break;
      }
      case 'glovebox': {
        g.fillStyle(edge, 1); g.fillRect(x - 9, this.y - 5, 18, 10);
        if (o > 0) { g.fillStyle(0x050507, 1); g.fillRect(x - 8, this.y - 4, 16, 8); g.fillStyle(edge, 1); g.fillRect(x - 9, this.y + 5, 18, 3 * o); }
        break;
      }
      case 'mailbox': {
        g.fillRect(x - 2, gy - 72, 4, 72);
        g.fillRoundedRect(x - 12, gy - 92, 24, 20, { tl: 9, tr: 9, bl: 0, br: 0 });
        if (o > 0) { g.fillStyle(0x050507, 1); g.fillRect(x + 8, gy - 88, 4, 14); g.fillStyle(c, 1); g.fillRect(x + 12, gy - 90 + 6 * o, 3, 16); }
        g.fillStyle(0x6e2b2b, 0.7); g.fillRect(x - 13, gy - 88, 2, 8 - o * 6);
        break;
      }
      case 'trash': {
        g.fillRect(x - 15, gy - 40, 30, 40);
        g.fillRect(x - 17, gy - 46 - o * 6, 34, 6);
        g.lineStyle(1, edge, 0.8);
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 8, gy - 36); g.lineTo(x + k * 8, gy - 4); g.strokePath(); }
        break;
      }
      case 'vent': {
        const y = this.y;
        g.fillStyle(0x050507, 1); g.fillRect(x - 16, y - 11, 32, 22);
        if (!this.opened) {
          g.fillStyle(c, 1); g.fillRect(x - 16, y - 11, 32, 22);
          g.lineStyle(1.2, edge, 0.9);
          for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - 13, y - 7 + k * 5); g.lineTo(x + 13, y - 7 + k * 5); g.strokePath(); }
        } else { g.fillStyle(c, 1); g.fillRect(x - 18, y + 14, 32, 4); }
        break;
      }
    }
  }
}

/* ---------------- İTİLEBİLİR SANDIK ---------------- */
class PushBox {
  constructor(scene, cfg) {
    this.scene = scene;
    this.w = cfg.w ?? 70; this.h = cfg.h ?? 70;
    this.weight = cfg.weight ?? (this.w < 50 ? 1 : this.w < 65 ? 2 : 3);   // terazi bulmacası: boy = ağırlık
    this.col = cfg.color ?? 0x0e0e14;
    this.body = scene.matter.add.rectangle(cfg.x, cfg.y ?? (cfg.groundY - this.h / 2 - 1), this.w, this.h, {
      density: cfg.density ?? 0.0045,
      friction: 0.55, frictionStatic: 0.9, restitution: 0.02, frictionAir: 0.02,
      inertia: cfg.canTip ? undefined : Infinity,
      collisionFilter: { category: CAT.PUSHBOX, mask: 0xFFFF },
      label: 'pushbox',
    });
    this.body.sfPush = this;
    this.gfx = scene.add.graphics().setDepth(cfg.depth ?? 93);
    this.drawLocal();
    this.lastSlideSound = 0;
  }
  drawLocal() {
    const g = this.gfx, w = this.w, h = this.h, c = this.col;
    g.fillStyle(c, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(1.6, 0x1c1c24, 0.85);
    g.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
    g.beginPath(); g.moveTo(-w / 2 + 3, -h / 2 + 3); g.lineTo(w / 2 - 3, h / 2 - 3); g.strokePath();
    g.beginPath(); g.moveTo(w / 2 - 3, -h / 2 + 3); g.lineTo(-w / 2 + 3, h / 2 - 3); g.strokePath();
  }
  update(time) {
    this.gfx.x = this.body.position.x;
    this.gfx.y = this.body.position.y;
    this.gfx.rotation = this.body.angle;
    const sp = Math.abs(this.body.velocity.x);
    if (sp > 0.4 && Math.abs(this.body.velocity.y) < 0.5 && time - this.lastSlideSound > 240) {
      this.lastSlideSound = time;
      SFAudio.footstep('wood', Math.min(1, sp / 4));
    }
  }
}

/* ---------------- KAPI ---------------- */
class Door {
  constructor(scene, cfg) {
    this.scene = scene;
    this.x = cfg.x;
    this.h = cfg.h ?? 110;
    this.w = 16;
    this.groundY = cfg.groundY;
    this.locked = cfg.locked ?? true;
    this.needsKey = cfg.needsKey ?? true;
    this.id = cfg.id ?? 'door';
    this.open = false;
    this.openAmt = 0;

    this.body = scene.matter.add.rectangle(this.x, this.groundY - this.h / 2, this.w, this.h, {
      isStatic: true,
      collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      label: 'door:' + this.id,
    });
    this.body.sfDoor = this;
    this.gfx = scene.add.graphics().setDepth(92);
    this.draw();
  }

  draw() {
    const g = this.gfx; g.clear();
    const c = 0x0c0c12;
    const x = this.x, gY = this.groundY, h = this.h;
    g.fillStyle(c, 1);
    g.fillRect(x - 13, gY - h - 8, 26, 8);
    if (this.open) {
      const wNow = 13 * (1 - this.openAmt * 0.86);
      g.fillStyle(0x0a0a10, 1);
      g.fillRect(x - wNow, gY - h, wNow, h);
    } else {
      g.fillStyle(c, 1);
      g.fillRect(x - this.w / 2, gY - h, this.w, h);
      g.lineStyle(1.4, 0x1c1c24, 0.9);
      g.strokeRect(x - 5, gY - h + 10, 10, h * 0.34);
      g.strokeRect(x - 5, gY - h * 0.5, 10, h * 0.36);
      g.fillStyle(0x1e1e26, 1);
      g.fillCircle(x + 4, gY - h * 0.48, 2.2);
      if (this.locked && this.needsKey) {
        const t = this.scene.time.now * 0.002;
        g.fillStyle(0xd8d4c8, 0.25 + Math.sin(t) * 0.15);
        g.fillCircle(x + 4, gY - h * 0.42, 1.6);
      }
    }
  }

  tryOpen(hasKey) {
    if (this.open) return 'open';
    if (this.locked) {
      if (this.needsKey && !hasKey) {
        SFAudio.thud(0.25);
        return 'locked';
      }
      this.locked = false;
      SFAudio.doorUnlock();
      this.scene.time.delayedCall(750, () => this.doOpen());
      return 'unlocking';
    }
    this.doOpen();
    return 'opening';
  }

  doOpen() {
    if (this.open) return;
    this.open = true;
    SFAudio.doorCreak();
    this.scene.matter.world.remove(this.body);
    this.scene.tweens.add({
      targets: this, openAmt: 1, duration: 1100, ease: 'Quad.easeInOut',
      onUpdate: () => this.draw(),
    });
  }
}

/* ---------------- KOL (LEVER) ---------------- */
class Lever {
  /** cfg: { x, groundY, id } — çekilince scene.onLeverPulled(id) */
  constructor(scene, cfg) {
    this.scene = scene;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.id = cfg.id ?? 'lever';
    this.pulled = false;
    this.angle = -0.85;    // yukarı
    this.gfx = scene.add.graphics().setDepth(93);
    this.draw();
  }
  get handleX() { return this.x + Math.sin(this.angle) * 34; }
  get handleY() { return this.groundY - 26 + Math.cos(this.angle) * -34; }

  setPulled() {
    if (this.pulled) return;
    this.pulled = true;
    SFAudio.leverCreak?.();
    this.scene.tweens.add({
      targets: this, angle: 0.85, duration: 500, ease: 'Back.easeIn',
      onUpdate: () => this.draw(),
      onComplete: () => { SFAudio.thud(0.6); this.scene.onLeverPulled?.(this.id); },
    });
  }
  draw() {
    const g = this.gfx; g.clear();
    const c = 0x0c0c12;
    const x = this.x, y = this.groundY;
    // kaide
    g.fillStyle(c, 1);
    g.fillRect(x - 12, y - 26, 24, 26);
    g.fillRect(x - 16, y - 6, 32, 6);
    // mil
    g.fillCircle(x, y - 26, 5);
    // kol
    const hx = x + Math.sin(this.angle) * 34;
    const hy = y - 26 - Math.cos(this.angle) * 34;
    g.lineStyle(4.4, c, 1);
    g.beginPath(); g.moveTo(x, y - 26); g.lineTo(hx, hy); g.strokePath();
    // topuz — çekilmemişse parıldar
    g.fillStyle(this.pulled ? c : 0xd8d4c8, this.pulled ? 1 : 0.4 + Math.sin(this.scene.time.now * 0.003) * 0.2);
    g.fillCircle(hx, hy, 4.5);
  }
}

/* ---------------- MERDİVEN ---------------- */
class Ladder {
  /** cfg: { x, topY, bottomY, raised } — raised: kol çekilene dek yukarıda */
  constructor(scene, cfg) {
    this.scene = scene;
    this.x = cfg.x;
    this.topY = cfg.topY; this.bottomY = cfg.bottomY;
    this.raised = cfg.raised ?? false;
    this.dropAmt = this.raised ? 0 : 1;   // 0=katlanmış, 1=inmiş
    this.gfx = scene.add.graphics().setDepth(91);
    this.draw();
  }
  get climbable() { return this.dropAmt > 0.95; }

  lower() {
    if (this.dropAmt >= 1) return;
    SFAudio.doorCreak();
    this.scene.tweens.add({
      targets: this, dropAmt: 1, duration: 900, ease: 'Bounce.easeOut',
      onUpdate: () => this.draw(),
      onComplete: () => SFAudio.thud(0.8),
    });
  }
  draw() {
    const g = this.gfx; g.clear();
    const c = 0x0d0d13;
    const len = (this.bottomY - this.topY) * this.dropAmt;
    const y1 = this.topY + len;
    g.lineStyle(3.6, c, 1);
    g.beginPath(); g.moveTo(this.x - 8, this.topY); g.lineTo(this.x - 8, y1); g.strokePath();
    g.beginPath(); g.moveTo(this.x + 8, this.topY); g.lineTo(this.x + 8, y1); g.strokePath();
    g.lineStyle(2.6, c, 1);
    const n = Math.floor(len / 18);
    for (let i = 1; i <= n; i++) {
      const ry = this.topY + i * 18;
      g.beginPath(); g.moveTo(this.x - 8, ry); g.lineTo(this.x + 8, ry); g.strokePath();
    }
  }
}

/* ---------------- JENERATÖR ---------------- */
class Generator {
  /** cfg: { x, groundY, id } — pil takılınca scene.onGeneratorPowered(id) */
  constructor(scene, cfg) {
    this.scene = scene;
    this.x = cfg.x; this.groundY = cfg.groundY;
    this.id = cfg.id ?? 'gen';
    this.powered = false;
    this.gfx = scene.add.graphics().setDepth(92);
    this.t = 0;
    this.draw();
  }
  power() {
    if (this.powered) return;
    this.powered = true;
    SFAudio.generatorStart?.();
    this.scene.time.delayedCall(900, () => this.scene.onGeneratorPowered?.(this.id));
  }
  update(dt) {
    this.t += dt;
    if (this.powered) this.draw();   // titreşim
  }
  draw() {
    const g = this.gfx; g.clear();
    const c = 0x0c0c12;
    const x = this.x, y = this.groundY;
    const shake = this.powered ? Math.sin(this.t * 40) * 0.8 : 0;
    // gövde
    g.fillStyle(c, 1);
    g.fillRoundedRect(x - 30 + shake, y - 44, 60, 44, 4);
    // egzoz borusu
    g.fillRect(x + 22 + shake, y - 56, 7, 14);
    // tekerlekçikler
    g.fillCircle(x - 20, y - 3, 5); g.fillCircle(x + 20, y - 3, 5);
    // panel
    g.lineStyle(1.4, 0x1c1c24, 1);
    g.strokeRect(x - 22 + shake, y - 38, 22, 16);
    // durum ışığı
    if (this.powered) {
      g.fillStyle(0xc8e0b8, 0.9);
      g.fillCircle(x - 11 + shake, y - 30, 2.4);
      // egzoz dumanı parçacığı yok — basit titreşim yeter
    } else {
      g.fillStyle(0xd8d4c8, 0.25 + Math.sin(this.scene.time.now * 0.003) * 0.15);
      g.fillCircle(x - 11, y - 30, 2);
    }
  }
}

/* ---------------- ETKİLEŞİM İPUCU ----------------
   YAZISIZ: eylem etiketi ekranda sembole döner (metin ekran okuyucu için kalır).
   Sıra önemli: "GEREK / YOK" önce, sonra özel eylemler, en son genel "dokun". */
const ACT_ICONS = [
  [/GEREK|YOK$/, '⊘'],
  [/LEVYE/, '✊'],
  [/SÖK/, '✂'],
  [/MERDİVEN|BİN$/, '⤒'],
  [/ÇEVİR/, '↻'],
  [/KOL|ŞALTER|FREN/, '⇅'],
  [/TAK$|DEĞİŞTİR/, '⊕'],
  [/OKU$|GÖSTER/, '◉'],
  [/ŞİFRE/, '⋯'],
];
function actIcon(label) {
  /* \uFE0E: renkli emoji değil, düz (tek renk) sembol çizilsin */
  for (const [re, ic] of ACT_ICONS) if (re.test(label)) return ic + '\uFE0E';
  return '☝\uFE0E';
}

class InteractHint {
  constructor(scene) {
    this.scene = scene;
    this.txt = scene.add.text(0, 0, '', {
      fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', fontStyle: 'italic',
      color: '#c9c5be',
    }).setOrigin(0.5, 1).setDepth(500).setAlpha(0);
    this.target = null;
  }
  show(x, y, label) {
    this.label = label;
    this.txt.setText(actIcon(label) + (IS_TOUCH ? '' : '  E')).setPosition(x, y);
    if (this.txt.alpha < 1) this.scene.tweens.add({ targets: this.txt, alpha: 0.92, duration: 220 });
  }
  hide() {
    if (this.txt.alpha > 0) this.scene.tweens.add({ targets: this.txt, alpha: 0, duration: 220 });
  }
}
