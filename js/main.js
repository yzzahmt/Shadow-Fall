/* ============================================================
   SHADOW FALL — Main Engine v4 (ARAF)
   150 bölüm, el feneri + pil ekonomisi, su/rüzgâr fizikleri,
   tabanca + insansı şarjör değişimi, eğilip eşya alma,
   bandaj sarma, Maria yoldaş YZ, sinematikler, boss kapıları,
   yankesicilik, sürülebilir araba, elektrik kesintileri.
   ============================================================ */
'use strict';

const MatterLib = Phaser.Physics.Matter.Matter;

/* ---------------- ayarlar + kayıt ---------------- */
window.SF_SETTINGS = { vol: 0.8, music: 0.7, grain: 0.55 };

const SaveGame = {
  load() {
    try { return JSON.parse(localStorage.getItem('sf4_save')) || {}; } catch (e) { return {}; }
  },
  save(d) { try { localStorage.setItem('sf4_save', JSON.stringify(d)); } catch (e) {} },
  get unlocked() { return this.load().unlocked ?? 0; },
  unlock(lv) { const d = this.load(); d.unlocked = Math.max(d.unlocked ?? 0, lv); this.save(d); },
  setCurrent(lv, state) { const d = this.load(); d.current = lv; d.state = state; this.save(d); },
};

/* ---------------- giriş durumu ---------------- */
const Input = {
  left: false, right: false, jump: false, crouch: false, act: false,
  fire: false, flash: false, reload: false, heal: false,
  jumpHit: false, actHit: false, fireHit: false, flashHit: false, reloadHit: false, healHit: false,
};

/* ============================================================
   MARIA — yoldaş YZ (perde 1)
   ============================================================ */
class Companion {
  constructor(scene) {
    this.scene = scene;
    this.rig = new HumanRig(scene, { scale: 0.88, depth: 99, variant: 'maria' });
    this.x = 0; this.y = 0;
    this.vx = 0;
    this.facing = 1;
    this.visible = true;
    this.cineMode = false;
  }
  destroy() { this.rig.destroy(); }
  setVisible(v) { this.visible = v; this.rig.setVisible(v); }

  /* Oyuncunun gerçek yolunu "iz" (breadcrumb) olarak kaydeder ve Maria bu izi
     belli bir mesafe geriden tekrar oynar. Böylece engellerin İÇİNDEN geçmez:
     oyuncu nereye zıpladıysa/tırmandıysa Maria da oradan geçer. */
  update(dt, player, groundYAt) {
    if (!this.visible || this.cineMode) return;

    if (!this.trail) this.trail = [{ x: player.x, y: player.y }];
    const last = this.trail[this.trail.length - 1];
    const moved = Math.hypot(player.x - last.x, player.y - last.y);
    if (moved > 7) {
      this.trail.push({ x: player.x, y: player.y });
      if (this.trail.length > 160) this.trail.shift();
    }

    // iz boyunca ~58px geriden hedef nokta bul (yol uzunluğuna göre)
    const FOLLOW = 58;
    let target = this.trail[0], acc = 0;
    for (let i = this.trail.length - 1; i > 0; i--) {
      acc += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
      if (acc >= FOLLOW) { target = this.trail[i - 1]; break; }
    }

    const dx = target.x - this.x;
    if (Math.abs(dx) > 900) {                         // çok geride kaldıysa ışınla
      this.x = target.x; this.y = target.y; this.trail = [{ x: player.x, y: player.y }];
    }
    const want = Math.abs(dx) > 20 ? Math.sign(dx) * Math.min(230, Math.abs(dx) * 2.6) : 0;
    this.vx = lerp(this.vx, want, 1 - Math.exp(-dt * 7));
    this.x += this.vx * dt;
    if (Math.abs(this.vx) > 12) this.facing = Math.sign(this.vx);
    else this.facing = player.x > this.x ? 1 : -1;

    // dikey: izin kaydettiği yüksekliği takip et (zıplama/platform yayını tekrarlar)
    const prevY = this.y;
    this.y = lerp(this.y, target.y, 1 - Math.exp(-dt * 10));
    const vy = (this.y - prevY) / Math.max(dt, 0.001);

    const gAt = groundYAt(this.x);
    const grounded = (gAt < 800) && Math.abs(this.y - gAt) < 16;
    const groundY = (gAt < 800) ? gAt : this.y;       // uçurum üstünde kendi y'sine bas

    this.rig.update(dt, {
      x: this.x, y: this.y - this.rig.A.standH,
      vx: this.vx, vy, grounded, facing: this.facing,
      mode: !grounded ? 'air' : (Math.abs(this.vx) > 12 ? 'move' : 'idle'),
      groundY,
    });
  }
}

/* ============================================================
   GAME SCENE
   ============================================================ */
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  init(data) {
    this.levelId = data.level ?? 0;
    this.carry = Object.assign({
      crowbar: false, bandages: 1,
      gun: false, loaded: 0, mags: 0,
      flashBattery: 100, batteries: 1,
    }, data.state ?? {});
    this.spawnX = data.spawnX ?? null;
  }

  create() {
    const ch = this.ch = getLevel(this.levelId);
    this.isIntro = ch.type === 'intro';
    this.worldW = ch.worldW;

    SFAudio.init(); SFAudio.resume(); SFAudio.startAmbience();
    SFAudio.setWeather(ch.rain ?? 0, ch.wind ?? 0.5);
    SFAudio.setVol(SF_SETTINGS.vol, SF_SETTINGS.music);
    /* duygusal müzik altyapısı — intro kendi temasını çalar, bölümlerde kısık underscore */
    SFAudio.stopMusicBed();
    if (!this.isIntro) SFAudio.startMusicBed(0.42 - (ch.dark ?? 0) * 0.1);
    this.events.once('shutdown', () => SFAudio.stopMusicBed());

    Atmo.generateTextures(this);
    LightSystem.ensureTextures(this);

    this.matter.world.setBounds(-50, -600, this.worldW + 100, WORLD_H + 900, 64, true, true, false, false);
    this.matter.world.setGravity(0, 1.35);

    this.parallax = Atmo.buildParallax(this, this.worldW, {
      id: 'lv' + ch.id + '_' + ch.act, seed: ch.act * 37 + 5, palette: ch.palette, layers: ch.parallax,
      moon: (ch.dark ?? 0) < 0.6,   // iç mekân / zifiri perdelerde ay yok
    });

    /* ---- ışık sistemi ---- */
    this.lights2 = new LightSystem(this);
    /* KARANLIK TABANI: fener kapalıyken ortalık gerçekten karanlık olsun.
       Oyuncunun etrafında küçük bir ışık halkası kaldığı için kör kalmaz,
       ama ilerlemek için fener şart. İç mekânların kendi yüksek değeri korunur. */
    const DARK_FLOOR = 0.66;
    this.baseDark = Math.max(ch.dark ?? 0, DARK_FLOOR);
    this.lights2.darkness = this.baseDark;
    this.blackoutActive = false;
    this._blackoutHinted = false;
    if (ch.blackouts) this.scheduleBlackout(14000 + Math.random() * 16000);

    /* ---- rüzgâr ---- */
    this.windSys = new WindSystem(this, ch.wind ?? 0, ch.windZones ?? [], this.worldW);

    /* ---- su ---- */
    this.waters = (ch.water ?? []).map(w => new WaterZone(this, w));

    /* ---- dünya geometrisi ---- */
    this.groundSegs = ch.ground ?? [];
    this.platforms = ch.platforms ?? [];
    this.buildWorld();

    /* ---- dekor ---- */
    this.worldGfx = this.add.graphics().setDepth(60);
    this.decorList = (ch.decor ?? []).map(d => ({ ...d }));
    for (const d of this.decorList) Decor.draw(this, this.worldGfx, d);
    this.cars = (ch.cars ?? []).map(c => ({ ...c }));
    for (const c of this.cars) {
      Decor.drawCar(this, this.worldGfx, c);
      this.matter.add.rectangle((c.coverX0 + c.coverX1) / 2, c.groundY - c.coverH / 2 - 12, (c.coverX1 - c.coverX0) * 0.86, c.coverH, {
        isStatic: true, label: 'car', friction: 0.9,
        collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
    }
    this.drawGround();

    for (const s of (ch.shafts ?? [])) {
      this.add.image(s.x, s.y, 'lightShaft').setOrigin(0.5, 0).setDepth(55)
        .setScale((s.scale ?? 1) * 0.7, (s.scale ?? 1) * 1.3).setAlpha((s.alpha ?? 0.4) * 0.55)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    /* lamba ışıkları */
    this.lampLights = [];
    for (const d of this.decorList) {
      if (d.lightAt) {
        const im = this.add.image(d.lightAt.x, d.lightAt.y, 'softDot').setDepth(56)
          .setScale(d.lightAt.flicker ? 2.2 : 3.4).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8d0b8);
        const lh = this.lights2.addLight({ x: d.lightAt.x, y: d.lightAt.y, r: 150, type: 'halo', intensity: 0.85, flicker: d.lightAt.flicker ? 0.1 : 0 });
        this.lampLights.push({ img: im, light: lh });
        if (d.lightAt.flicker) {
          this.time.addEvent({ delay: 90, loop: true, callback: () => {
            if (!this.blackoutActive) im.setAlpha(Math.random() < 0.12 ? 0.04 : 0.16 + Math.random() * 0.1);
          }});
        }
      }
    }

    /* ---- oyun nesneleri ---- */
    this.physItems = [];
    this.crates = [];
    this.pushboxes = [];
    this.doors = [];
    this.soldiers = [];
    this.creatures = [];
    this.levers = [];
    this.ladders = [];
    this.generators = [];
    this.poweredDoors = [];
    this.barricades = [];
    this.bullets = [];
    this.playerBullets = [];
    this.driveCar = null;
    this.bossGate = null;

    if (!this.isIntro) this.buildGameplay();

    this.particles = Atmo.buildWorldParticles(this, this.worldW, { rain: ch.rain });
    this.fx = Atmo.buildScreenFX(this);

    /* ---- oyuncu durumu ---- */
    this.hpMax = 4;
    this.hp = 4;
    this.state = { ...this.carry };
    this.inv = { crowbar: this.carry.crowbar, key: false, carkey: false };
    this.flashOn = false;
    this.breath = 8;
    this.dead = false;
    this.finished = false;
    this.cineLock = false;
    this.checkpointX = this.spawnX ?? ch.playerStart?.x ?? 120;
    this.invulnT = 0;
    this.fireCD = 0;
    this.aimHold = 0;

    if (this.isIntro) {
      this.createIntro();
    } else {
      this.createPlayer(this.checkpointX, this.groundYAt(this.checkpointX) - 80);
      /* Maria yoldaş — perde 1 */
      if (ch.act === 1) {
        this.maria = new Companion(this);
        this.maria.x = this.checkpointX - 60;
        this.maria.y = this.groundYAt(this.maria.x);
      }
      this.hint = new InteractHint(this);
      UI.showHUD(true);
      UI.updateHP(this.hp, this.hpMax);
      this.syncHUD();
    }

    const cam = this.cameras.main;
    cam.setBounds(0, -200, this.worldW, WORLD_H + 200);
    cam.setBackgroundColor(0x000000);
    if (!this.isIntro) cam.setZoom(1.3);

    this.triggers = (ch.triggers ?? []).map(t => ({ ...t, fired: false }));

    this.matter.world.on('collisionstart', (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        const item = a.sfItem || b.sfItem;
        if (item && !item.picked) {
          const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
          if (rel > 1.2) SFAudio.itemHit(item.def.sound, Math.min(1, rel / 9));
        }
      }
    });

    this.scale.on('resize', (gs) => {
      this.parallax.resize(gs.width, gs.height);
      this.fx.resize(gs.width, gs.height);
      this.lights2.resize(gs.width, gs.height);
    });

    UI.fadeIn();
    if (!this.isIntro) {
      UI.showChapterCard(this.ch);
      /* hikâye giriş satırları */
      const beats = BEATS[this.levelId];
      if (beats?.start?.length && !this.spawnX) {
        beats.start.forEach((line, i) => {
          this.time.delayedCall(2200 + i * 3600, () => UI.subtitle(line, 3300));
        });
      }
      if (this.ch.bossName) {
        this.time.delayedCall(1500, () => {
          if (!this.cineLock && !this.finished && !this.dead) UI.showBossBar(this.ch.bossName, 1);
        });
      }
    }
  }

  /* ---------------- dünya inşası ---------------- */
  buildWorld() {
    for (const seg of this.groundSegs) {
      const w = seg.x1 - seg.x0;
      this.matter.add.rectangle(seg.x0 + w / 2, seg.y + 110, w, 220, {
        isStatic: true, friction: 0.9, label: 'ground:' + seg.material,
        collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
    }
    for (const p of this.platforms) {
      this.matter.add.rectangle(p.x + p.w / 2, p.y + (p.thick ?? 10) / 2, p.w, p.thick ?? 10, {
        isStatic: true, friction: 0.9, label: 'platform:' + (p.material ?? 'wood'),
        collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
    }
    for (const wl of (this.ch.walls ?? [])) {
      this.matter.add.rectangle(wl.x, (wl.y0 + wl.y1) / 2, 22, wl.y1 - wl.y0, {
        isStatic: true, label: 'wall', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
    }
  }

  drawGround() {
    const g = this.add.graphics().setDepth(70);
    let i = 0;
    for (const seg of this.groundSegs) {
      Atmo.drawGroundStrip(this, g, seg.x0, seg.x1, seg.y, this.ch.id * 100 + i * 7 + 3, 0x0a0a0e);
      i++;
    }
    for (const p of this.platforms) {
      g.fillStyle(0x0a0a0e, 1);
      g.fillRect(p.x, p.y, p.w, (p.thick ?? 10));
      g.fillRect(p.x + 8, p.y, 6, 40);
      g.fillRect(p.x + p.w - 14, p.y, 6, 40);
    }
    for (const sp of (this.ch.spikes ?? [])) {
      g.fillStyle(0x0c0c11, 1);
      const n = Math.floor((sp.x1 - sp.x0) / 16);
      for (let k = 0; k < n; k++) {
        const x = sp.x0 + k * 16;
        g.beginPath();
        g.moveTo(x, sp.y + 18);
        g.lineTo(x + 8, sp.y - 14 - (k % 3) * 4);
        g.lineTo(x + 16, sp.y + 18);
        g.closePath(); g.fillPath();
      }
    }
    // duvar görselleri
    for (const wl of (this.ch.walls ?? [])) {
      g.fillStyle(0x0b0b10, 1);
      g.fillRect(wl.x - 11, wl.y0, 22, wl.y1 - wl.y0);
    }
  }

  buildGameplay() {
    const ch = this.ch;
    for (const c of (ch.crates ?? [])) this.crates.push(new Crate(this, c));
    for (const p of (ch.pushboxes ?? [])) this.pushboxes.push(new PushBox(this, p));
    for (const it of (ch.looseItems ?? [])) this.physItems.push(new PhysItem(this, it.kind, it.x, it.y));
    if (ch.fallbackCrowbarAt && !this.carry.crowbar) {
      this.physItems.push(new PhysItem(this, 'crowbar', ch.fallbackCrowbarAt.x, ch.fallbackCrowbarAt.y));
    }
    // levyesiz oyuncu için yedek levye (kutu bulmacaları kilitlenmesin)
    if (!this.carry.crowbar && (ch.crates ?? []).length && this.levelId > 1) {
      const c0 = ch.crates[0];
      this.physItems.push(new PhysItem(this, 'crowbar', Math.max(220, c0.x - 160), this.groundYAt(Math.max(220, c0.x - 160)) - 40));
    }
    for (const d of (ch.doors ?? [])) this.doors.push(new Door(this, d));
    for (const lv of (ch.levers ?? [])) this.levers.push(new Lever(this, lv));
    for (const ld of (ch.ladders ?? [])) { const l = new Ladder(this, ld); l.id = ld.id; this.ladders.push(l); }
    for (const gn of (ch.generators ?? [])) this.generators.push(new Generator(this, gn));
    for (const pd of (ch.poweredDoors ?? [])) {
      const obj = {
        id: pd.id, x: pd.x, y: pd.y, h: pd.h, open: false, slide: 0,
        body: this.matter.add.rectangle(pd.x, pd.y - pd.h / 2, 14, pd.h, {
          isStatic: true, label: 'grate', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
        }),
        gfx: this.add.graphics().setDepth(92),
      };
      this.poweredDoors.push(obj);
      this.drawGrate(obj);
    }
    for (const b of (ch.barricades ?? [])) {
      const body = this.matter.add.rectangle(b.x, b.groundY - 26, 26, 52, {
        isStatic: true, label: 'barricade', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
      const gfx = this.add.graphics().setDepth(93);
      gfx.fillStyle(0x0c0c12, 1);
      gfx.fillRect(b.x - 6, b.groundY - 52, 12, 52);
      gfx.fillRect(b.x - 22, b.groundY - 40, 44, 9);
      gfx.fillRect(b.x - 18, b.groundY - 20, 36, 8);
      this.barricades.push({ x: b.x, groundY: b.groundY, body, gfx, crushed: false });
    }
    if (ch.driveCar) this.driveCar = new DriveCar(this, ch.driveCar);
    if (ch.bossGate) {
      const bg = ch.bossGate;
      const gy = this.groundYAt(bg.x - 40);
      this.bossGate = {
        x: bg.x, y: gy, h: bg.h, open: false, slide: 0,
        body: this.matter.add.rectangle(bg.x, gy - bg.h / 2, 16, bg.h, {
          isStatic: true, label: 'bossgate', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
        }),
        gfx: this.add.graphics().setDepth(92),
      };
      this.drawGrate(this.bossGate);
    }
    for (const s of (ch.soldiers ?? [])) {
      const sol = new Soldier(this, {
        x: s.x, groundY: this.groundYAt(s.x),
        patrolMinX: s.patrolMinX, patrolMaxX: s.patrolMaxX,
        facing: s.facing ?? -1, static: s.static,
        hp: s.hp, tough: s.tough, hasCarKey: s.hasCarKey,
      });
      sol.gate = !!s.gate;
      sol.onShoot = (x, y, dir, target) => this.spawnBullet(x, y, dir, target);
      this.soldiers.push(sol);
    }
    for (const c of (ch.creatures ?? [])) {
      const cr = spawnCreature(this, {
        ...c, groundY: this.groundYAt(c.x),
      });
      cr.gate = !!c.gate;
      cr.onStrike = (dmg) => this.damagePlayer(dmg ?? 2, cr.facing ?? 0);
      this.creatures.push(cr);
    }
  }

  drawGrate(pd) {
    if (!pd) return;
    const g = pd.gfx; g.clear();
    const yTop = pd.y - pd.h + pd.slide * pd.h;
    g.fillStyle(0x0c0c12, 1);
    for (let i = 0; i < 5; i++) g.fillRect(pd.x - 6 + i * 3, yTop, 2, pd.h * (1 - pd.slide));
    g.fillRect(pd.x - 8, yTop, 16, 5);
    g.fillRect(pd.x - 8, pd.y - 4 - pd.slide * pd.h, 16, 4);
  }

  openGrate(pd, msg) {
    if (!pd || pd.open) return;
    pd.open = true;
    SFAudio.thud(0.7);
    this.time.delayedCall(350, () => {
      this.tweens.add({
        targets: pd, slide: 1, duration: 1400, ease: 'Quad.easeInOut',
        onUpdate: () => this.drawGrate(pd),
        onComplete: () => this.matter.world.remove(pd.body),
      });
      SFAudio.doorCreak();
    });
    if (msg) UI.subtitle(msg, 2400);
  }

  /* lever / jeneratör bağlantıları */
  onLeverPulled(id) {
    const link = this.ch.leverLinks?.[id];
    if (link?.ladder) {
      const lad = this.ladders.find(l => l.id === link.ladder);
      if (lad) { lad.lower(); UI.subtitle('Bir merdiven indi.', 2000); }
    }
  }
  onGeneratorPowered(id) {
    const link = this.ch.genLinks?.[id];
    if (link?.door) {
      const pd = this.poweredDoors.find(p => p.id === link.door);
      this.openGrate(pd, 'Bir yerlerde demir bir kapak açıldı.');
    }
    const gen = this.generators.find(g => g.id === id);
    if (gen) this.lights2.addLight({ x: gen.x, y: gen.groundY - 40, r: 200, type: 'halo', intensity: 0.9 });
  }

  crushBarricadesAt(x) {
    for (const b of this.barricades) {
      if (b.crushed || Math.abs(b.x - x) > 46) continue;
      b.crushed = true;
      this.matter.world.remove(b.body);
      b.gfx.destroy();
      SFAudio.crateBurst();
      this.cameras.main.shake(180, 0.008);
      for (let i = 0; i < 3; i++) {
        this.physItems.push(new PhysItem(this, 'plank', b.x + (Math.random() - 0.5) * 20, b.groundY - 40, {
          vx: 3 + Math.random() * 4, vy: -4 - Math.random() * 4,
        }));
      }
    }
  }
  onCarArrived(car) {
    if (this.player?.inCar) {
      this.player.inCar = false;
      MatterLib.Body.setPosition(this.player.body, { x: car.x + 110, y: car.groundY - 60 });
      this.rig.setVisible(true);
      UI.subtitle('Motor sustu. Buradan sonrası yine yürüyerek.', 2600);
    }
  }

  /* ---------------- elektrik kesintisi ---------------- */
  scheduleBlackout(delay) {
    this.time.delayedCall(delay, () => {
      if (this.dead || this.finished || this.isIntro) return;
      this.blackoutActive = true;
      SFAudio.thunder();
      this.cameras.main.shake(300, 0.004);
      this.lights2.setDarkness(0.93, 900);
      for (const l of this.lampLights) { l.light.on = false; l.img.setVisible(false); }
      if (!this._blackoutHinted) {
        this._blackoutHinted = true;
        UI.subtitle('Işıklar gitti. [F] — el feneri.', 3200);
      } else UI.subtitle('Yine karanlık...', 2000);
      // geri gelme
      this.time.delayedCall(11000 + Math.random() * 9000, () => {
        if (this.dead || this.finished) return;
        this.blackoutActive = false;
        this.lights2.setDarkness(this.baseDark, 1400);
        for (const l of this.lampLights) { l.light.on = true; l.img.setVisible(true); }
        SFAudio.flashClick(true);
        this.scheduleBlackout(20000 + Math.random() * 20000);
      });
    });
  }

  /* ---------------- oyuncu ---------------- */
  createPlayer(x, y) {
    this.player = {
      w: 20, hStand: 60, hCrouch: 30,
      body: this.matter.add.rectangle(x, y, 20, 60, {
        inertia: Infinity, friction: 0.001, frictionStatic: 0, frictionAir: 0.015,
        restitution: 0, label: 'player', density: 0.0024,
        collisionFilter: { category: CAT.PLAYER, mask: CAT.WORLD | CAT.PUSHBOX | CAT.ITEM },
      }),
      grounded: false, wasGrounded: false, groundMat: 'earth',
      crouching: false, hidden: false, facing: 1,
      pryTarget: null, pryT: 0, mode: 'idle',
      coyote: 0, lastVy: 0,
      inWater: false, swimming: false,
      climbing: false, ladder: null,
      inCar: false,
    };
    this.rig = new HumanRig(this, { scale: 0.94, depth: 100, variant: 'kai' });
    this.rig.stepCallback = (f) => SFAudio.footstep(this.player.groundMat, f);
    /* fener ışığı */
    this.flashLight = this.lights2.addLight({ x, y, r: 270, type: 'cone', facing: 1, on: false, intensity: 1.1 });
    /* oyuncu çevre halkası (karanlıkta minik görüş) */
    this.playerHalo = this.lights2.addLight({ x, y, r: 78, type: 'halo', intensity: 0.7 });
  }

  /* iniş toz bulutu — ayak hizasında yanlara saçılan ince zerreler */
  landDust(x, y, power = 1) {
    const tint = { earth: 0x6b5d49, sand: 0x9a8a66, stone: 0x6d6f76, wood: 0x5a4836, metal: 0x55585f }[this.player?.groundMat] ?? 0x6b5d49;
    const p = this.add.particles(x, y - 2, 'softDot', {
      speedX: { min: -90 * power, max: 90 * power }, speedY: { min: -70 * power, max: -10 },
      lifespan: { min: 320, max: 620 }, quantity: 0, gravityY: 240,
      scale: { start: 0.10 + power * 0.05, end: 0 }, alpha: { start: 0.42 * power, end: 0 },
      tint, emitting: false,
    }).setDepth(72);
    p.explode(Math.round(5 + power * 9));
    this.time.delayedCall(700, () => p.destroy());
  }

  groundYAt(x) {
    let best = KILL_Y + 100;
    for (const seg of this.groundSegs) {
      if (x >= seg.x0 && x <= seg.x1) best = Math.min(best, seg.y);
    }
    return best;
  }

  /* görüş hattı engellendi mi? — duvar/bina köşesi veya araç siperi araya girerse
     düşman seni göremez (saklanma mekaniğinin temeli). */
  sightBlocked(ex, ey, px, py) {
    const dxTot = px - ex;
    if (Math.abs(dxTot) < 2) return false;
    // dikey duvar segmentleri
    for (const w of (this.ch.walls ?? [])) {
      if ((w.x - ex) * (w.x - px) <= 0) {
        const t = (w.x - ex) / dxTot;
        const yAt = ey + (py - ey) * t;
        if (yAt > w.y0 - 6 && yAt < w.y1 + 6) return true;
      }
    }
    // araç siperleri (arkasına çömelip saklanılır)
    for (const c of (this.cars ?? [])) {
      const cx = (c.coverX0 + c.coverX1) / 2;
      if ((cx - ex) * (cx - px) <= 0) {
        const t = (cx - ex) / dxTot;
        const yAt = ey + (py - ey) * t;
        if (yAt > c.groundY - (c.coverH ?? 70)) return true;   // hat aracın üst kenarının altında
      }
    }
    return false;
  }

  materialAt(x, y) {
    for (const p of this.platforms) {
      if (x >= p.x && x <= p.x + p.w && Math.abs(y - p.y) < 30) return p.material ?? 'wood';
    }
    for (const seg of this.groundSegs) {
      if (x >= seg.x0 && x <= seg.x1 && Math.abs(y - seg.y) < 40) return seg.material;
    }
    return 'earth';
  }

  setCrouch(on) {
    const P = this.player;
    if (P.crouching === on) return;
    if (!on) {
      const bodies = MatterLib.Composite.allBodies(this.matter.world.localWorld);
      const head = MatterLib.Query.region(bodies, {
        min: { x: P.body.position.x - 9, y: P.body.position.y - P.hStand + 4 },
        max: { x: P.body.position.x + 9, y: P.body.position.y - P.hCrouch / 2 },
      }).filter(b => b !== P.body && !b.isSensor && b.label !== 'player' && !b.sfItem);
      if (head.length) return;
    }
    P.crouching = on;
    const scaleY = on ? P.hCrouch / P.hStand : P.hStand / P.hCrouch;
    const bottom = P.body.position.y + (on ? P.hStand : P.hCrouch) / 2;
    MatterLib.Body.scale(P.body, 1, scaleY);
    MatterLib.Body.setPosition(P.body, { x: P.body.position.x, y: bottom - (on ? P.hCrouch : P.hStand) / 2 });
  }

  /* ---------------- mermiler ---------------- */
  spawnBullet(x, y, dir, target) {
    const dy = ((target.y ?? y) - 14 - y) * 0.004;
    this.bullets.push({
      x, y, vx: dir * 1500, vy: dy * 1500 * 0.25, life: 0.7,
      gfx: this.add.graphics().setDepth(105),
    });
  }

  firePlayerGun() {
    const S = this.state, P = this.player;
    if (!S.gun || this.rig.actionActive || P.mode === 'pry' || P.swimming || P.climbing || P.inCar) return;
    if (this.fireCD > 0) return;
    if (S.loaded <= 0) {
      SFAudio.dryFire();
      UI.subtitle('Şarjör boş. [R]', 1400);
      return;
    }
    S.loaded--;
    this.fireCD = 0.38;
    this.aimHold = 1.1;
    this.rig.recoilT = 0.22;
    SFAudio.playerShot();
    // hafif oto-nişan: öndeki en yakın düşmana açı
    let aimY = 0;
    const tgt = this.nearestEnemyAhead();
    const muzzleY = P.body.position.y - 8;
    if (tgt) aimY = clamp((tgt.y - muzzleY) / Math.max(60, Math.abs(tgt.x - P.body.position.x)), -0.5, 0.5);
    this.rig.aimAngle = aimY * 0.7;
    this.playerBullets.push({
      x: P.body.position.x + P.facing * 22, y: muzzleY,
      vx: P.facing * 1700, vy: aimY * 1700 * 0.5, life: 0.6,
      gfx: this.add.graphics().setDepth(105),
    });
    // silah sesi dikkat çeker
    for (const s of this.soldiers) {
      if (!s.dead && Math.abs(s.x - P.body.position.x) < 760) { s.state = 'alert'; s.suspicion = 1; }
    }
    this.syncHUD();
  }

  nearestEnemyAhead() {
    const P = this.player;
    let best = null, bd = 700;
    const consider = (x, y, alive) => {
      if (!alive) return;
      const dx = x - P.body.position.x;
      if (Math.sign(dx) !== P.facing) return;
      const d = Math.abs(dx);
      if (d < bd) { bd = d; best = { x, y }; }
    };
    for (const s of this.soldiers) consider(s.x, s.groundY - 44, !s.dead);
    for (const c of this.creatures) consider(c.x, c.y ?? (c.groundY - 50), !c.dead);
    return best;
  }

  updatePlayerBullets(dt) {
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0;
      // askerlere isabet
      for (const s of this.soldiers) {
        if (s.dead) continue;
        if (Math.abs(b.x - s.x) < 17 && b.y > s.groundY - 72 && b.y < s.groundY) {
          dead = true;
          s.takeDamage(1, Math.sign(b.vx));
          this.impactSpark(b.x, b.y);
        }
      }
      // yaratıklara isabet
      for (const c of this.creatures) {
        if (c.dead) continue;
        const cy = c.y ?? (c.groundY - 40);
        const rr = (c.bodyR ?? 36) + 14;
        if (Math.abs(b.x - c.x) < rr && Math.abs(b.y - cy) < rr) {
          dead = true;
          c.takeDamage(1, Math.sign(b.vx));
          this.impactSpark(b.x, b.y);
          if (c.boss) UI.showBossBar(c.name ?? this.ch.bossName, Math.max(0, c.hp / c.maxHp));
        }
      }
      // siper / zemin
      for (const c of this.cars) {
        if (b.x > c.coverX0 && b.x < c.coverX1 && b.y > c.groundY - c.coverH - 10 && b.y < c.groundY) {
          dead = true; SFAudio.ricochet(); this.impactSpark(b.x, b.y);
        }
      }
      if (b.y > this.groundYAt(b.x)) { dead = true; this.impactSpark(b.x, b.y); }
      b.gfx.clear();
      if (!dead) {
        b.gfx.lineStyle(2, 0xe8e4da, 0.85);
        b.gfx.beginPath(); b.gfx.moveTo(b.x - b.vx * 0.01, b.y - b.vy * 0.01); b.gfx.lineTo(b.x, b.y); b.gfx.strokePath();
      } else {
        b.gfx.destroy();
        this.playerBullets.splice(i, 1);
      }
    }
  }

  updateBullets(dt) {
    const P = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0;
      for (const c of this.cars) {
        if (b.x > c.coverX0 && b.x < c.coverX1 && b.y > c.groundY - c.coverH - 10 && b.y < c.groundY) {
          dead = true; SFAudio.ricochet();
          this.impactSpark(b.x, b.y);
        }
      }
      if (b.y > this.groundYAt(b.x)) { dead = true; this.impactSpark(b.x, b.y); }
      if (P && !this.dead && !P.inCar) {
        const ph = P.crouching ? P.hCrouch : P.hStand;
        if (Math.abs(b.x - P.body.position.x) < 14 && Math.abs(b.y - (P.body.position.y)) < ph / 2 + 4) {
          dead = true;
          this.damagePlayer(1, Math.sign(b.vx));
        }
      }
      b.gfx.clear();
      if (!dead) {
        b.gfx.lineStyle(2, 0xe8e4da, 0.8);
        b.gfx.beginPath(); b.gfx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012); b.gfx.lineTo(b.x, b.y); b.gfx.strokePath();
      } else {
        b.gfx.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  impactSpark(x, y) {
    const p = this.add.particles(x, y, 'softDot', {
      speed: { min: 40, max: 160 }, lifespan: 260, quantity: 6,
      scale: { start: 0.12, end: 0 }, alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(105);
    p.explode(6);
    this.time.delayedCall(400, () => p.destroy());
  }

  /* ---------------- hasar / ölüm ---------------- */
  damagePlayer(amount, knockDir = 0) {
    if (this.dead || this.invulnT > 0 || this.cineLock) return;
    this.hp -= amount;
    this.invulnT = 0.9;
    SFAudio.hurt();
    this.fx.hitFlash(0.3);
    this.cameras.main.shake(220, 0.008);
    this.rig.hurtT = 0.5;
    if (!this.player.inCar) MatterLib.Body.setVelocity(this.player.body, { x: knockDir * 7, y: -4 });
    UI.updateHP(this.hp, this.hpMax, true);
    this.fx.setLowHp(this.hp <= 1 ? 0.8 : this.hp <= 2 ? 0.35 : 0);
    SFAudio.setTension(Math.max(0, 1 - this.hp / this.hpMax));
    if (this.hp <= 0) this.killPlayer(knockDir);
  }

  killPlayer(dir = 0) {
    if (this.dead) return;
    this.dead = true;
    SFAudio.stopMusicBed();
    SFAudio.playDeathChord();
    this.rig.action = null;
    this.rig.startRagdoll(dir * 220 + this.player.body.velocity.x * 30, -180, (x) => this.groundYAt(x));
    this.matter.world.remove(this.player.body);
    this.flashLight.on = false;
    UI.showHUD(false);
    this.time.delayedCall(1700, () => UI.showDeath());
  }

  respawn() {
    this.scene.restart({ level: this.levelId, state: { ...this.carry }, spawnX: this.checkpointX });
  }

  /* ---------------- etkileşim ---------------- */
  findInteractable() {
    const P = this.player;
    const px = P.body.position.x, py = P.body.position.y;
    const S = this.state;

    // 0) sürülebilir araba
    if (this.driveCar && !this.driveCar.started && Math.abs(this.driveCar.x - px) < 110) {
      if (this.inv.carkey) return { type: 'drivecar', obj: this.driveCar, label: 'ARABAYI ÇALIŞTIR', x: this.driveCar.x, y: this.driveCar.groundY - 90 };
      return { type: 'drivecar-locked', obj: this.driveCar, label: 'KİLİTLİ — ANAHTAR GEREK', x: this.driveCar.x, y: this.driveCar.groundY - 90 };
    }
    // 1) yankesicilik — anahtar taşıyan asker, arkadan, eğilerek
    for (const s of this.soldiers) {
      if (s.dead || !s.hasCarKey) continue;
      const behind = Math.sign(px - s.x) !== s.facing;
      if (behind && P.crouching && Math.abs(s.x - px) < 62 && s.state === 'patrol') {
        return { type: 'pickpocket', obj: s, label: 'ANAHTARI ÇAL', x: s.x, y: s.groundY - 100 };
      }
    }
    // 2) alınabilir eşyalar
    for (const it of this.physItems) {
      if (it.picked || !it.def.pickable) continue;
      if (Math.abs(it.x - px) < 46 && Math.abs(it.y - py) < 70) {
        return { type: 'item', obj: it, label: it.def.label + ' AL', x: it.x, y: it.y - 26 };
      }
    }
    // 3) kutular
    for (const c of this.crates) {
      if (c.opened) continue;
      if (Math.abs(c.x - px) < 70 && Math.abs(c.groundY - (py + P.hStand / 2)) < 80) {
        if (this.inv.crowbar) return { type: 'crate', obj: c, label: 'LEVYEYLE AÇ', x: c.x, y: c.y - c.h / 2 - 14 };
        return { type: 'crate-locked', obj: c, label: 'ÇİVİLİ — LEVYE GEREK', x: c.x, y: c.y - c.h / 2 - 14 };
      }
    }
    // 4) kollar
    for (const lv of this.levers) {
      if (lv.pulled) continue;
      if (Math.abs(lv.x - px) < 52) {
        return { type: 'lever', obj: lv, label: 'KOLU ÇEK', x: lv.x, y: lv.groundY - 80 };
      }
    }
    // 5) jeneratörler
    for (const gn of this.generators) {
      if (gn.powered) continue;
      if (Math.abs(gn.x - px) < 56) {
        if (S.batteries > 0) return { type: 'generator', obj: gn, label: 'PİLİ TAK', x: gn.x, y: gn.groundY - 70 };
        return { type: 'generator-locked', obj: gn, label: 'PİL GEREK', x: gn.x, y: gn.groundY - 70 };
      }
    }
    // 6) kapılar
    for (const d of this.doors) {
      if (d.open) continue;
      if (Math.abs(d.x - px) < 56) {
        if (d.locked && d.needsKey && !this.inv.key) return { type: 'door-locked', obj: d, label: 'KİLİTLİ — ANAHTAR GEREK', x: d.x, y: d.groundY - d.h - 16 };
        return { type: 'door', obj: d, label: d.locked ? 'KİLİDİ AÇ' : 'KAPIYI AÇ', x: d.x, y: d.groundY - d.h - 16 };
      }
    }
    // 7) pil değiştirme (fener azaldıysa)
    if (S.flashBattery <= 20 && S.batteries > 0) {
      return { type: 'battery-swap', obj: null, label: 'PİL DEĞİŞTİR', x: px, y: py - 56 };
    }
    return null;
  }

  doInteract(target) {
    const P = this.player;
    const S = this.state;
    if (this.rig.actionActive) return;
    switch (target.type) {
      case 'item': {
        const it = target.obj;
        // İNSANSI ALMA: eğil, uzan, kavra, doğrul
        P.mode = 'action';
        this.rig.startAction('pickup', {
          targetX: it.x, targetY: it.y,
          onPhase: (ph) => {
            if (ph !== 'grab' || it.picked) return;
            it.pickupToHand(this.rig.joints.handR?.x ?? it.x, this.rig.joints.handR?.y ?? it.y);
            this.collectItem(it.kind);
          },
          onDone: () => { P.mode = 'idle'; },
        });
        break;
      }
      case 'crate': {
        P.mode = 'pry';
        this.rig.pryAnim = 0;
        P.pryTarget = target.obj;
        P.pryT = 0;
        break;
      }
      case 'door': {
        const res = target.obj.tryOpen(this.inv.key);
        if (res === 'unlocking') { UI.subtitle('Anahtar uyuyor...', 1400); this.inv.key = false; this.syncHUD(); }
        break;
      }
      case 'lever': {
        const lv = target.obj;
        P.mode = 'action';
        this.rig.startAction('lever', {
          targetX: lv.x, targetY: lv.groundY - 60,
          onPhase: (ph) => { if (ph === 'pulled') lv.setPulled(); },
          onDone: () => { P.mode = 'idle'; },
        });
        break;
      }
      case 'generator': {
        const gn = target.obj;
        P.mode = 'action';
        this.rig.startAction('insert', {
          targetX: gn.x, targetY: gn.groundY - 30,
          onPhase: (ph) => {
            if (ph === 'inserted') {
              S.batteries--;
              SFAudio.batterySlot();
              gn.power();
              this.impactSpark(gn.x, gn.groundY - 34);
              this.syncHUD();
            }
          },
          onDone: () => { P.mode = 'idle'; },
        });
        break;
      }
      case 'battery-swap': this.startBatterySwap(); break;
      case 'pickpocket': {
        const s = target.obj;
        P.mode = 'action';
        UI.subtitle('Sessiz... çok sessiz...', 1600);
        this.rig.startAction('pickpocket', {
          targetX: s.x - s.facing * 6, targetY: s.groundY - 42,
          onPhase: (ph) => {
            if (ph === 'steal') {
              if (s.state !== 'patrol' || s.dead) {
                UI.subtitle('FARK ETTİ!', 1500);
              } else {
                s.hasCarKey = false; s.rig.hasCarKey = false;
                this.inv.carkey = true;
                SFAudio.pickup();
                UI.subtitle('Araba anahtarı sende.', 2200);
                this.syncHUD();
              }
            }
          },
          onDone: () => { P.mode = 'idle'; },
        });
        break;
      }
      case 'drivecar': {
        const car = target.obj;
        car.start();
        P.inCar = true;
        this.rig.setVisible(false);
        UI.subtitle('Tutun Maria. Geliyorum.', 2000);
        // motor sesi herkesi uyandırır
        for (const s of this.soldiers) {
          if (!s.dead && Math.abs(s.x - car.x) < 900) { s.state = 'alert'; s.suspicion = 1; }
        }
        break;
      }
      case 'crate-locked': SFAudio.thud(0.2); UI.subtitle('Çivili. Levye gerek.', 1500); break;
      case 'door-locked': SFAudio.thud(0.25); break;
      case 'generator-locked': SFAudio.thud(0.2); UI.subtitle('Depo boş. Bir pil bulmalıyım.', 1800); break;
      case 'drivecar-locked': SFAudio.thud(0.25); UI.subtitle('Kontak anahtarı... devriyedeki adamda gördüm.', 2600); break;
    }
  }

  collectItem(kind) {
    const S = this.state;
    switch (kind) {
      case 'crowbar': this.inv.crowbar = true; this.rig.holdItem = this.rig.holdItem ?? 'crowbar'; break;
      case 'key': this.inv.key = true; break;
      case 'battery':
        if (S.flashBattery <= 0 && S.batteries === 0) { S.flashBattery = 100; SFAudio.batterySlot(); }
        else S.batteries = Math.min(3, S.batteries + 1);
        break;
      case 'bandage': S.bandages = Math.min(5, S.bandages + 1); break;
      case 'pistol':
        S.gun = true;
        if (S.loaded === 0) S.loaded = 7;
        UI.subtitle('Ağır. Soğuk. Gerekli.', 2400);
        break;
      case 'mag': S.mags = Math.min(5, S.mags + 1); break;
    }
    this.syncHUD();
  }

  startBatterySwap() {
    const S = this.state, P = this.player;
    if (S.batteries <= 0 || this.rig.actionActive) return;
    P.mode = 'action';
    const wasOn = this.flashOn;
    this.rig.startAction('batterySwap', {
      onPhase: (ph) => {
        if (ph === 'eject') {
          // eski pil yere düşer — gerçek fizik nesnesi
          this.flashOn = false; this.flashLight.on = false; this.rig.flashOn = false;
          SFAudio.flashClick(false);
          this.physItems.push(new PhysItem(this, 'deadBattery',
            P.body.position.x + P.facing * 14, P.body.position.y - 6,
            { vx: P.facing * 1.2, vy: -1.5 }));
        }
        if (ph === 'insert') {
          S.batteries--;
          S.flashBattery = 100;
          SFAudio.batterySlot();
          if (wasOn || this.lights2.darkness > 0.5) {
            this.flashOn = true;
            SFAudio.flashClick(true);
          }
          this.syncHUD();
        }
      },
      onDone: () => { P.mode = 'idle'; },
    });
  }

  startReload() {
    const S = this.state, P = this.player;
    if (!S.gun || S.mags <= 0 || S.loaded >= 7 || this.rig.actionActive || P.swimming || P.climbing) return;
    P.mode = 'action';
    this.rig.startAction('reload', {
      onPhase: (ph) => {
        if (ph === 'magout') {
          SFAudio.magDrop();
          // boş şarjör yere düşer
          this.physItems.push(new PhysItem(this, 'magEmpty',
            P.body.position.x + P.facing * 16, P.body.position.y,
            { vx: P.facing * 0.6, vy: -1 }));
        }
        if (ph === 'magin') SFAudio.magIn();
        if (ph === 'rack') {
          SFAudio.rack();
          S.mags--;
          S.loaded = 7;
          this.syncHUD();
        }
      },
      onDone: () => { P.mode = 'idle'; },
    });
  }

  startBandage() {
    const S = this.state, P = this.player;
    if (S.bandages <= 0 || this.hp >= this.hpMax || this.rig.actionActive || !P.grounded || P.swimming) return;
    P.mode = 'action';
    this.rig.startAction('bandage', {
      onPhase: (ph) => {
        if (ph === 'wrapStart') SFAudio.bandage();
        if (ph === 'healed') {
          S.bandages--;
          this.hp = Math.min(this.hpMax, this.hp + 2);
          UI.updateHP(this.hp, this.hpMax);
          this.fx.setLowHp(this.hp <= 1 ? 0.8 : this.hp <= 2 ? 0.35 : 0);
          this.syncHUD();
        }
      },
      onDone: () => { P.mode = 'idle'; },
    });
  }

  spawnDroppedMag(x, y) {
    this.physItems.push(new PhysItem(this, 'magEmpty', x, y, { vx: 0, vy: -1 }));
  }

  syncHUD() {
    UI.updateInv(this.inv, this.state);
  }

  /* ---------------- ana döngü ---------------- */
  update(time, deltaMs) {
    const dt = Math.min(0.033, deltaMs / 1000);
    this.fx.update(time, deltaMs);
    this.parallax.update(this.cameras.main.scrollX, time);
    this.windSys.update(dt);
    for (const w of this.waters) w.update(dt);
    for (const gn of this.generators) gn.update(dt);
    if (this.driveCar) this.driveCar.update(dt);
    this.lights2.update(time);

    if (this.isIntro) { this.updateIntro(dt, time); return; }
    if (!this.player) return;

    const P = this.player;
    const body = P.body;
    const S = this.state;

    for (const it of this.physItems) it.update(dt);
    for (const pb of this.pushboxes) pb.update(time);
    for (const d of this.doors) { if (d.locked && d.needsKey) d.draw(); }
    for (const lv of this.levers) { if (!lv.pulled) lv.draw(); }
    for (const gn of this.generators) { if (!gn.powered) gn.draw(); }
    if (this.driveCar && !this.driveCar.started) this.driveCar.draw();

    if (this.dead) {
      this.rig.update(dt, { x: 0, y: 0, mode: 'ragdoll', groundY: 0 });
      this.updateBullets(dt);
      return;
    }
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.fireCD > 0) this.fireCD -= dt;
    if (this.aimHold > 0) this.aimHold -= dt;

    /* ---- sinematik kilidi ---- */
    if (this.cineLock) {
      this.updateCine(dt);
      this.updateBullets(dt);
      return;
    }

    if (this.finished) {
      this.rig.update(dt, {
        x: body.position.x, y: body.position.y - 2, vx: 80, vy: 0,
        grounded: true, facing: 1, mode: 'move', groundY: body.position.y + P.hStand / 2,
      });
      MatterLib.Body.setVelocity(body, { x: 1.6, y: body.velocity.y });
      return;
    }

    /* ---- arabada ---- */
    if (P.inCar) {
      MatterLib.Body.setPosition(body, { x: this.driveCar.x, y: this.driveCar.groundY - 70 });
      MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
      const cam = this.cameras.main;
      cam.scrollX = lerp(cam.scrollX, this.driveCar.x + 120 - cam.width / 2, 1 - Math.exp(-dt * 3));
      this.updateBullets(dt);
      this.updateEnemies(dt);
      return;
    }

    /* ---- fener ---- */
    if (Input.flashHit) {
      Input.flashHit = false;
      if (this.flashOn) {
        this.flashOn = false;
        SFAudio.flashClick(false);
      } else if (S.flashBattery > 0) {
        this.flashOn = true;
        SFAudio.flashClick(true);
      } else if (S.batteries > 0) {
        UI.subtitle('Pil bitik. [E] — pil değiştir.', 2200);
        SFAudio.dryFire();
      } else {
        UI.subtitle('Pil yok. Karanlıkta bir pil bulmalıyım.', 2400);
        SFAudio.dryFire();
      }
    }
    if (this.flashOn) {
      S.flashBattery = Math.max(0, S.flashBattery - dt * (100 / 80));   // ~80 sn / pil
      if (S.flashBattery <= 0) {
        this.flashOn = false;
        SFAudio.flashClick(false);
        UI.subtitle(S.batteries > 0 ? 'Fener öldü. [E] — pil değiştir.' : 'Fener öldü. Pil yok...', 2600);
      }
    }
    this.rig.flashOn = this.flashOn;
    this.flashLight.on = this.flashOn;
    this.flashLight.x = body.position.x + P.facing * 10;
    this.flashLight.y = body.position.y - 10;
    this.flashLight.facing = P.facing;
    this.flashLight.angle = this.rig.aimAngle * 0.4;
    this.flashLight.intensity = S.flashBattery < 18 ? (0.5 + Math.random() * 0.4) : 1;
    this.flashLight.flicker = S.flashBattery < 18 ? 0.15 : 0;
    this.playerHalo.x = body.position.x;
    this.playerHalo.y = body.position.y;
    /* fener kapalıyken etraf çok karanlık: sadece silüeti seçtirecek
       kadar zayıf bir halka kalsın. Fener açıkken normal görüş. */
    this.playerHalo.intensity = this.flashOn ? 0.7 : 0.32;
    this.playerHalo.r = this.flashOn ? 82 : 60;
    UI.updateBattery(S.flashBattery, S.batteries, this.flashOn);

    /* ---- su algılama ---- */
    const h = P.crouching ? P.hCrouch : P.hStand;
    let inWaterZone = null, submersion = 0;
    for (const w of this.waters) {
      const sub = (body.position.y + h / 2 > w.surfaceY + 4 && body.position.x > w.x0 && body.position.x < w.x1)
        ? clamp((body.position.y + h / 2 - w.surfaceY) / h, 0, 1) : 0;
      if (sub > 0) { inWaterZone = w; submersion = sub; }
    }
    const wasInWater = P.inWater;
    P.inWater = !!inWaterZone;
    P.swimming = submersion > 0.55;
    if (P.inWater && !wasInWater) inWaterZone.splash(body.position.x, clamp(P.lastVy / 10, 0.3, 1));
    if (!P.inWater && wasInWater) this.waters.forEach(w => Math.abs(body.position.x - (w.x0 + w.x1) / 2) < (w.x1 - w.x0) && w.splash(body.position.x, 0.4));
    // fener suda kapanır
    if (P.swimming && this.flashOn) { this.flashOn = false; SFAudio.flashClick(false); }

    /* nefes */
    const headUnder = inWaterZone && (body.position.y - h / 2 + 8 > inWaterZone.surfaceY);
    if (headUnder) {
      this.breath -= dt;
      if (this.breath < 0) { this.breath = 1.6; this.damagePlayer(1, 0); }
    } else this.breath = Math.min(8, this.breath + dt * 2.5);
    UI.updateBreath(headUnder ? this.breath / 8 : -1);

    /* ---- zemin algılama ---- */
    const bodies = MatterLib.Composite.allBodies(this.matter.world.localWorld);
    const feet = MatterLib.Query.region(bodies, {
      min: { x: body.position.x - 8, y: body.position.y + h / 2 - 2 },
      max: { x: body.position.x + 8, y: body.position.y + h / 2 + 6 },
    }).filter(b => b !== body && !b.isSensor && (b.isStatic || b.sfPush || b.sfItem));
    P.wasGrounded = P.grounded;
    P.grounded = feet.length > 0 && Math.abs(body.velocity.y) < 6;
    if (P.grounded) P.coyote = 0.1; else P.coyote -= dt;

    if (P.grounded && !P.wasGrounded && !P.inWater) {
      const impact = clamp(P.lastVy / 14, 0, 1);
      P.groundMat = this.materialAt(body.position.x, body.position.y + h / 2 + 4);
      if (impact > 0.12) {
        this.rig.triggerLand(impact);
        SFAudio.land(impact, P.groundMat);
        if (impact > 0.92) this.damagePlayer(1, 0);
        // sert iniş: dizler yaylanırken kısa toparlanma — insan hemen koşamaz
        if (impact > 0.45) P.landRecover = 0.16 + impact * 0.22;
        // iniş yaylanması: toz bulutu + sert inişte kamera sarsıntısı (ağırlık hissi)
        if (impact > 0.3) {
          this.landDust(body.position.x, body.position.y + h / 2, impact);
          if (impact > 0.55) this.cameras.main.shake(110, 0.005 * impact);
        }
      }
    }
    if (P.landRecover > 0) P.landRecover -= dt;
    P.lastVy = body.velocity.y;
    P.groundMat = this.materialAt(body.position.x, body.position.y + h / 2 + 6);

    /* ---- merdiven ---- */
    let onLadder = null;
    for (const lad of this.ladders) {
      if (!lad.climbable) continue;
      if (Math.abs(body.position.x - lad.x) < 30 && body.position.y + h / 2 > lad.topY - 8 && body.position.y - h / 2 < lad.bottomY + 16) {
        onLadder = lad;
      }
    }
    if (!P.climbing && onLadder && Input.jump && body.position.y - 10 > onLadder.topY) {
      P.climbing = true; P.ladder = onLadder;
      Input.jumpHit = false;
      MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
    }
    if (P.climbing) {
      const lad = P.ladder;
      if (!lad || !onLadder) { P.climbing = false; }
      else {
        const vy = (Input.jump ? -150 : 0) + (Input.crouch ? 150 : 0);
        MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
        MatterLib.Body.setPosition(body, {
          x: lerp(body.position.x, lad.x, 0.3),
          y: body.position.y + vy * dt,
        });
        // tepeye varış
        if (body.position.y + h / 2 <= lad.topY + 6 && Input.jump) {
          MatterLib.Body.setPosition(body, { x: lad.x + 26, y: lad.topY - h / 2 - 4 });
          P.climbing = false;
        }
        // tabana iniş
        if (body.position.y + h / 2 >= lad.bottomY - 2 && Input.crouch) P.climbing = false;
        if ((Input.left || Input.right) && Input.jumpHit) { P.climbing = false; Input.jumpHit = false; }
      }
    }

    /* ---- hareket ---- */
    const dir = (Input.left ? -1 : 0) + (Input.right ? 1 : 0);
    if (dir !== 0 && !this.rig.actionActive) P.facing = dir;

    const actionLock = this.rig.actionActive || P.mode === 'pry';

    if (!P.climbing) {
      if (P.swimming) {
        /* yüzme fizikleri */
        const M = MatterLib;
        M.Body.applyForce(body, body.position, { x: 0, y: -body.mass * 0.00175 * submersion });
        let vx = body.velocity.x * 0.93, vy = body.velocity.y * 0.93;
        if (!actionLock) {
          vx += dir * 0.34;
          if (Input.jump) vy -= 0.42;
          if (Input.crouch) vy += 0.3;
        }
        // su yüzeyinden çıkış zıplaması
        if (Input.jumpHit && body.position.y - h / 2 < inWaterZone.surfaceY + 14) {
          vy = -9.4;
          inWaterZone.splash(body.position.x, 0.8);
        }
        M.Body.setVelocity(body, { x: clamp(vx, -3.2, 3.2), y: clamp(vy, -4.5, 5) });
        Input.jumpHit = false;
        if (Math.abs(vx) > 1 && Math.random() < dt * 2.2) SFAudio.swimStroke();
        this.setCrouch(false);
      } else {
        // eğilme
        if (Input.crouch && P.grounded && !actionLock) this.setCrouch(true);
        else if (!Input.crouch) this.setCrouch(false);

        /* GERÇEKÇİ KOŞU İVMESİ:
           - duruştan kalkış yavaş, tam hıza kademeli ulaşır
           - yön değiştirirken önce frenler (kayma hissi)
           - sert inişten sonra kısa toparlanma yavaşlığı */
        const recovering = (P.landRecover ?? 0) > 0;
        const maxSpeed = (P.crouching ? 1.1 : 3.5) * (recovering ? 0.4 : 1);
        let targetVx = dir * maxSpeed;
        if (actionLock) targetVx = 0;
        const turning = dir !== 0 && Math.sign(body.velocity.x) === -dir && Math.abs(body.velocity.x) > 1;
        /* AĞIRLIK / MOMENTUM — ivme artık kare-hızından BAĞIMSIZ (dt tabanlı),
           kütle his verir: duruştan kalkış kademeli, durunca momentumla hafif
           süzülür, yön değişiminde önce frenler. Havada momentum büyük ölçüde korunur. */
        let rate;
        if (!P.grounded) rate = 3.4;                         // havada düşük kontrol — momentum korunur
        else if (turning) rate = 9.5;                        // fren + dönüş — ayak kaydırır
        else if (dir !== 0) rate = 11;                       // kalkış — kütleyi hızlandırmak zaman alır
        else rate = 13;                                      // durunca biraz süzülür (buz gibi değil)
        const newVx = lerp(body.velocity.x, targetVx, 1 - Math.exp(-rate * dt));
        MatterLib.Body.setVelocity(body, { x: newVx, y: body.velocity.y });

        if (Input.jumpHit && P.coyote > 0 && !P.crouching && !actionLock && !recovering) {
          // zıplama gücü mevcut hıza bağlı — koşarak zıplayış daha uzun
          const runBoost = Math.abs(body.velocity.x) * 0.22;
          MatterLib.Body.setVelocity(body, { x: body.velocity.x, y: -11.6 - runBoost });
          P.coyote = 0;
          P.jumpCutDone = false;
          SFAudio.jump();
        }
        Input.jumpHit = false;

        /* değişken zıplama: tuş erken bırakılırsa yükseliş kesilir */
        if (!P.grounded && !Input.jump && body.velocity.y < -3 && !P.jumpCutDone) {
          P.jumpCutDone = true;
          MatterLib.Body.setVelocity(body, { x: body.velocity.x, y: body.velocity.y * 0.5 });
        }
        /* düşüş yerçekimi takviyesi — gerçek zıplama yayı asimetriktir */
        if (!P.grounded && body.velocity.y > 0) {
          MatterLib.Body.setVelocity(body, { x: body.velocity.x, y: Math.min(18, body.velocity.y + 14 * dt) });
        }

        /* rüzgâr kuvveti — havada daha güçlü */
        this.windSys.applyTo(body, dt, P.grounded ? 0.45 : 1.5);
      }
    } else Input.jumpHit = false;

    /* ---- ateş / şarjör / bandaj ---- */
    if (Input.fireHit) { Input.fireHit = false; this.firePlayerGun(); }
    if (Input.reloadHit) { Input.reloadHit = false; this.startReload(); }
    if (Input.healHit) { Input.healHit = false; this.startBandage(); }
    this.rig.aimMode = S.gun && this.aimHold > 0;
    this.rig.holdItem = S.gun ? 'pistol' : (this.inv.crowbar ? 'crowbar' : null);

    /* ---- itme tespiti ---- */
    let pushing = false;
    if (P.grounded && dir !== 0 && !P.crouching && !P.swimming && !actionLock) {
      const front = MatterLib.Query.region(bodies, {
        min: { x: body.position.x + dir * 12, y: body.position.y - 16 },
        max: { x: body.position.x + dir * 26, y: body.position.y + 20 },
      }).filter(b => b.sfPush);
      if (front.length && Math.abs(body.velocity.x) < 1.4) {
        pushing = true;
        MatterLib.Body.applyForce(front[0], front[0].position, { x: dir * 0.0026, y: 0 });
      }
    }

    /* ---- levye ---- */
    if (P.mode === 'pry') {
      P.pryT += dt;
      if (P.pryT > 0.55) {
        P.mode = 'idle';
        if (P.pryTarget && Input.act) {
          const opened = P.pryTarget.pryOnce();
          if (!opened) { P.mode = 'pry'; this.rig.pryAnim = 0; P.pryT = 0; }
          else P.pryTarget = null;
        } else if (P.pryTarget) {
          P.pryTarget.pryOnce();
          P.pryTarget = null;
        }
      }
    }

    /* ---- etkileşim ---- */
    const target = (!actionLock) ? this.findInteractable() : null;
    if (target) {
      this.hint.show(target.x, target.y, target.label);
      UI.setActGlow(true, target.label);
      if (Input.actHit) this.doInteract(target);
    } else {
      this.hint.hide();
      UI.setActGlow(false);
    }
    Input.actHit = false;

    /* ---- gizlilik ---- */
    P.hidden = false;
    if (P.crouching) {
      for (const c of this.cars) {
        if (body.position.x > c.coverX0 - 4 && body.position.x < c.coverX1 + 4) { P.hidden = true; break; }
      }
    }

    /* ---- dikenler ---- */
    for (const sp of (this.ch.spikes ?? [])) {
      if (body.position.x > sp.x0 - 4 && body.position.x < sp.x1 + 4 && body.position.y + h / 2 > sp.y - 18) {
        this.killPlayer(0);
        return;
      }
    }
    if (body.position.y > KILL_Y) { this.killPlayer(0); return; }

    /* ---- düşmanlar ---- */
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePlayerBullets(dt);

    /* ---- boss kapısı ---- */
    if (this.bossGate && !this.bossGate.open) {
      const gateLeft = [...this.soldiers.filter(s => s.gate && !s.dead), ...this.creatures.filter(c => c.gate && !c.dead)];
      if (gateLeft.length === 0) {
        this.openGrate(this.bossGate, 'Yol açıldı.');
        UI.hideBossBar();
        SFAudio.playHopeMotif();
      }
    }

    /* ---- Maria yoldaş ---- */
    if (this.maria) this.maria.update(dt, { x: body.position.x, y: body.bounds.max.y, facing: P.facing }, (x) => this.groundYAt(x));

    /* ---- tetikler ---- */
    for (const t of this.triggers) {
      if (t.fired) continue;
      if (Math.abs(body.position.x - t.x) < 70) {
        t.fired = true;
        UI.subtitle(t.text, 3200);
      }
    }
    for (const cp of (this.ch.checkpoints ?? [])) {
      if (body.position.x > cp && cp > this.checkpointX) this.checkpointX = cp;
    }

    /* ---- bölüm sonu ---- */
    if (body.position.x > this.ch.exitX && !this.finished && !this.cineLock) {
      if (this.ch.endCine) this.startEndCine(this.ch.endCine);
      else this.completeChapter();
    }

    /* ---- rig ---- */
    let mode = 'idle';
    if (this.rig.actionActive) mode = this.rig.mode; // action çizimi draw() içinde önceliğe sahip
    else if (P.mode === 'pry') mode = 'pry';
    else if (P.climbing) mode = 'climb';
    else if (P.swimming) mode = 'swim';
    else if (!P.grounded && P.coyote <= 0) mode = 'air';
    else if (P.crouching) mode = 'crawl';
    else if (pushing) mode = 'push';
    else if (Math.abs(body.velocity.x) > 0.25) mode = 'move';

    const bodyBottom = body.position.y + h / 2;
    this.rig.update(dt, {
      x: body.position.x,
      y: P.swimming ? body.position.y : bodyBottom - this.rig.A.standH,
      vx: body.velocity.x * 60, vy: body.velocity.y * 60,
      grounded: P.grounded || P.coyote > 0,
      facing: P.facing, crouch: false,
      mode, groundY: bodyBottom,
    });

    /* ---- kamera ---- */
    const cam = this.cameras.main;
    const lookAhead = P.facing * 90;
    const targetX = body.position.x + lookAhead - cam.width / 2;
    const targetY = body.position.y - cam.height * 0.58;
    cam.scrollX = lerp(cam.scrollX, targetX, 1 - Math.exp(-dt * 3.2));
    cam.scrollY = lerp(cam.scrollY, clamp(targetY, -200, WORLD_H - cam.height + 100), 1 - Math.exp(-dt * 2.6));
  }

  updateEnemies(dt) {
    const P = this.player;
    const playerProxy = {
      x: P.body.position.x, y: P.body.position.y,
      crouching: P.crouching, hidden: P.hidden || P.inCar,
    };
    let tension = Math.max(0, 1 - this.hp / this.hpMax) * 0.4;
    const losFn = (ex, ey, px, py) => this.sightBlocked(ex, ey, px, py);
    for (const s of this.soldiers) {
      s.update(dt, playerProxy, losFn);
      if (s.state === 'alert') tension = Math.max(tension, 0.9);
      else if (s.state === 'suspicious') tension = Math.max(tension, 0.5);
    }
    for (const c of this.creatures) {
      c.update(dt, playerProxy);
      if (c.state === 'chase' || c.state === 'strike' || c.state === 'charge') tension = Math.max(tension, 1);
      else if (c.state === 'alert' || c.state === 'stare') tension = Math.max(tension, 0.7);
    }
    const tens = this.cineLock ? 0 : tension;
    SFAudio.setTension(tens);
    // tehlike anında melodik underscore'u kısmen geri çek + sürükleyici aksiyon katmanını yükselt
    SFAudio.setMusicIntensity((0.42 - (this.baseDark ?? 0) * 0.1) * (1 - tens * 0.5));
    SFAudio.setActionLevel(tens);
  }

  completeChapter() {
    this.finished = true;
    const nextState = {
      crowbar: this.inv.crowbar,
      bandages: this.state.bandages,
      gun: this.state.gun, loaded: this.state.loaded, mags: this.state.mags,
      flashBattery: this.state.flashBattery, batteries: this.state.batteries,
    };
    SaveGame.unlock(this.levelId + 1);
    SaveGame.setCurrent(this.levelId + 1, nextState);
    SFAudio.playHopeMotif();
    SFAudio.setTension(0);
    UI.showHUD(false);
    UI.hideBossBar();
    UI.fadeOut(2000);
    this.time.delayedCall(2300, () => {
      if (this.levelId + 1 <= LEVEL_COUNT) {
        this.scene.restart({ level: this.levelId + 1, state: nextState });
      } else {
        UI.showEndCard();
      }
    });
  }

  /* ============================================================
     BÖLÜM SONU SİNEMATİKLERİ (kaçırılma / kule / final)
     ============================================================ */
  startEndCine(kind) {
    this.cineLock = true;
    document.body.classList.add('cine');
    UI.showHUD(false);
    UI.hideBossBar();
    UI.showSkip(true);
    const P = this.player;
    MatterLib.Body.setVelocity(P.body, { x: 0, y: 0 });
    const gY = this.groundYAt(P.body.position.x);
    const px = P.body.position.x;
    this.cine = { t: 0, step: 0, kind, actors: {}, timeline: [], gY, px };
    const C = this.cine;

    if (kind === 'kidnap') {
      /* Maria'nın kaçırılışı */
      const m = this.maria;
      if (m) { m.cineMode = true; }
      C.actors.sol1 = { rig: new SoldierRig(this, { scale: 0.97, depth: 98 }), x: px + 750, facing: -1, vx: 0, pose: null, visible: true };
      C.actors.sol2 = { rig: new SoldierRig(this, { scale: 0.97, depth: 98 }), x: px + 830, facing: -1, vx: 0, pose: null, visible: true };
      C.actors.sol3 = { rig: new SoldierRig(this, { scale: 0.97, depth: 98 }), x: px + 900, facing: -1, vx: 0, pose: null, visible: true };
      C.kaiPose = null;
      C.timeline = [
        { t: 0.6, fn: () => { if (m) { m.x = px + 70; m.facing = 1; } UI.subtitle('Maria: "Kai — ışık! İnsanlar! HEY! BURADAYIZ!"', 3200); } },
        { t: 3.2, fn: () => { C.actors.sol1.vx = -210; C.actors.sol2.vx = -210; C.actors.sol3.vx = -190; } },
        { t: 5.4, fn: () => { C.actors.sol1.vx = 0; C.actors.sol2.vx = 0; C.actors.sol3.vx = 0; UI.subtitle('"Nabzına bakın." — "...atıyor. YAŞIYOR."', 3400); } },
        { t: 8.6, fn: () => { C.actors.sol1.vx = -160; } },
        { t: 9.6, fn: () => { C.actors.sol1.vx = 0; C.actors.sol1.pose = 'punchWind'; } },
        { t: 10.2, fn: () => {
            C.actors.sol1.pose = 'punch';
            SFAudio.punch();
            this.cameras.main.shake(360, 0.018);
            this.fx?.hitFlash?.(0.5);
            C.kaiPose = 'fallen';
        }},
        { t: 11.2, fn: () => UI.subtitle('Maria: "KAİ! — BIRAKIN BENİ — KAİİ!"', 3000) },
        { t: 11.8, fn: () => {
            if (m) { m.carried = true; }
            C.actors.sol1.facing = 1; C.actors.sol1.vx = 130;
            C.actors.sol2.facing = 1; C.actors.sol2.vx = 130;
            C.actors.sol3.facing = 1; C.actors.sol3.vx = 130;
        }},
        { t: 15.5, fn: () => { for (const k of ['sol1', 'sol2', 'sol3']) C.actors[k].visible = false; if (m) m.setVisible(false); } },
        { t: 16.5, fn: () => { C.kaiPose = 'kneel'; UI.subtitle('Hayır. Hayır hayır hayır—', 2600) },
        },
        { t: 19.5, fn: () => UI.subtitle('Ne kadar sürerse sürsün. Seni bulacağım.', 3600) },
        { t: 23.5, fn: () => this.finishCine() },
      ];
    } else if (kind === 'glimpse') {
      /* kulede Maria'yı görme */
      C.actors.maria = { rig: new HumanRig(this, { scale: 0.8, depth: 98, variant: 'maria' }), x: px + 540, facing: -1, vx: 0, pose: 'reach', visible: true, yOff: -260 };
      C.actors.vey = { rig: new HumanRig(this, { scale: 1.04, depth: 98, variant: 'soldier' }), x: px + 600, facing: -1, vx: 0, pose: null, visible: true, yOff: -260 };
      this.lights2.addLight({ x: px + 560, y: gY - 300, r: 170, type: 'halo', intensity: 0.9 });
      // kule silueti
      const tg = this.add.graphics().setDepth(59);
      tg.fillStyle(0x0a0a10, 1);
      tg.fillRect(px + 470, gY - 560, 220, 560);
      tg.fillStyle(0x14151c, 1);
      tg.fillRect(px + 500, gY - 320, 150, 90);
      C.timeline = [
        { t: 0.8, fn: () => UI.subtitle('Kulede... camın ardında...', 2800) },
        { t: 3.4, fn: () => UI.subtitle('MARIA! — Beni gördü. Gülümsedi. Ağlıyor ama gülümsüyor.', 3800) },
        { t: 7.4, fn: () => UI.subtitle('Ve yanındaki uzun adam... Vey.', 3000) },
        { t: 10.2, fn: () => { C.actors.vey.vx = 60; C.actors.maria.vx = 55; C.actors.maria.pose = null; C.actors.vey.facing = 1; C.actors.maria.facing = 1; } },
        { t: 12.6, fn: () => { C.actors.vey.visible = false; C.actors.maria.visible = false; UI.subtitle('Götürdü onu. Yine. SON KEZ.', 3200); } },
        { t: 16.0, fn: () => this.finishCine() },
      ];
    } else if (kind === 'final') {
      /* GEÇİT — final */
      C.actors.maria = { rig: new HumanRig(this, { scale: 0.88, depth: 99, variant: 'maria' }), x: px + 420, facing: -1, vx: 0, pose: 'kneel', visible: true };
      C.actors.vey = { rig: new HumanRig(this, { scale: 1.04, depth: 98, variant: 'soldier' }), x: px + 530, facing: -1, vx: 0, pose: 'standSad', visible: true };
      this.gateLight = this.lights2.addLight({ x: px + 700, y: gY - 200, r: 120, type: 'halo', intensity: 0.6 });
      C.timeline = [
        { t: 0.8, fn: () => UI.subtitle('Geçit... açılıyor.', 2600) },
        { t: 2.2, fn: () => {
            this.tweens.add({ targets: this.gateLight, r: 700, intensity: 1.4, duration: 9000 });
            this.lights2.setDarkness(0.25, 6000);
        }},
        { t: 3.6, fn: () => { C.actors.maria.pose = null; C.actors.maria.vx = -120; C.actors.maria.facing = -1; UI.subtitle('Maria: "KAİ!"', 2200); } },
        { t: 6.2, fn: () => { C.actors.maria.vx = 0; C.actors.maria.pose = 'hug'; C.kaiPose = 'hug'; SFAudio.playHopeMotif(); } },
        { t: 8.2, fn: () => UI.subtitle('"Geç kaldın." — "Biliyorum. Bir daha olmayacak."', 3600) },
        { t: 12.0, fn: () => { C.actors.vey.vx = 55; C.actors.vey.facing = 1; UI.subtitle('Vey arkasına bakmadan ışığa yürüdü.', 3000) } },
        { t: 15.5, fn: () => { C.actors.vey.visible = false; } },
        { t: 16.5, fn: () => { this.fx.flash.setFillStyle?.(0xE8E4DC); this.tweens.add({ targets: this.fx.flash, alpha: 1, duration: 4200 }); } },
        { t: 21.0, fn: () => UI.showEnding() },
      ];
    }
  }

  updateCine(dt) {
    const C = this.cine;
    if (!C) return;
    C.t += dt;
    while (C.step < C.timeline.length && C.t >= C.timeline[C.step].t) {
      C.timeline[C.step].fn();
      C.step++;
    }
    const gY = C.gY;
    /* aktörleri güncelle */
    for (const k in C.actors) {
      const a = C.actors[k];
      a.x += (a.vx ?? 0) * dt;
      a.rig.setVisible(a.visible);
      if (!a.visible) continue;
      const moving = Math.abs(a.vx ?? 0) > 4;
      const ay = gY + (a.yOff ?? 0);
      if (a.pose && !moving) {
        a.rig.facing = a.facing;
        a.rig.setPose(a.pose, C.t);
        a.rig.update(dt, { x: a.x, y: ay - a.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: a.facing, mode: 'pose', groundY: ay });
      } else {
        a.rig.update(dt, { x: a.x, y: ay - a.rig.A.standH, vx: a.vx ?? 0, vy: 0, grounded: true, facing: a.facing, mode: moving ? 'move' : 'idle', groundY: ay });
      }
    }
    /* kai */
    const P = this.player;
    if (C.kaiPose) {
      this.rig.facing = 1;
      this.rig.setPose(C.kaiPose, C.t);
      this.rig.update(dt, { x: P.body.position.x, y: gY - this.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: 1, mode: 'pose', groundY: gY });
    } else {
      this.rig.update(dt, { x: P.body.position.x, y: gY - this.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: 1, mode: 'idle', groundY: gY });
    }
    /* maria yoldaş taşınıyor */
    if (this.maria?.carried) {
      const carrier = C.actors.sol2;
      this.maria.x = carrier.x - 8;
      this.maria.rig.facing = -carrier.facing;
      this.maria.rig.setPose('carryStruggle', C.t);
      this.maria.rig.update(dt, { x: this.maria.x, y: gY - 90, vx: 0, vy: 0, grounded: true, facing: -carrier.facing, mode: 'pose', groundY: gY - 52 });
    } else if (this.maria && this.maria.cineMode && this.maria.visible) {
      this.maria.rig.update(dt, { x: this.maria.x, y: gY - this.maria.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: this.maria.facing, mode: 'idle', groundY: gY });
    }
    /* kamera ağır yaklaşır — Kai çerçevede kalır */
    const cam = this.cameras.main;
    const focus = P.body.position.x + 90;
    cam.scrollX = lerp(cam.scrollX, focus - cam.width / 2, 1 - Math.exp(-dt * 2.4));
  }

  finishCine() {
    if (this._cineDone) return;
    this._cineDone = true;
    document.body.classList.remove('cine');
    UI.showSkip(false);
    for (const k in (this.cine?.actors ?? {})) this.cine.actors[k].rig.destroy();
    this.cineLock = false;
    this.completeChapter();
  }

  /* kullanıcı "ATLA" dedi — aktif sinematiği anında bitir */
  requestSkip() {
    UI.subtitle('', 1);
    if (this.isIntro && !this._introEnded) { UI.showSkip(false); this.endIntro(); return; }
    if (this.cineLock && this.cine && !this._cineDone) {
      if (this.cine.kind === 'final') {
        /* final: jeneriğe atla — aktörleri temizle, ışığı aç, bitiş ekranı */
        this._cineDone = true;
        UI.showSkip(false);
        for (const k in (this.cine.actors ?? {})) this.cine.actors[k].rig.destroy();
        this.tweens.killAll();
        this.lights2.setDarkness(0, 200);
        UI.showEnding();
      } else {
        this.finishCine();
      }
    }
  }

  /* ============================================================
     GİRİŞ SİNEMATİĞİ — orman yürüyüşü, sis, düşüş
     ============================================================ */
  createIntro() {
    document.body.classList.add('cine');
    UI.showHUD(false);
    UI.showSkip(true);
    const gY = 600;
    this.introGY = gY;

    const g = this.add.graphics().setDepth(70);
    Atmo.drawGroundStrip(this, g, -200, 2000, gY, 42, 0x0a0a0e);

    this.kai = new HumanRig(this, { scale: 0.94, depth: 100, variant: 'kai' });
    this.mariaRig = new HumanRig(this, { scale: 0.88, depth: 99, variant: 'maria' });

    this.actors = {
      kai: { x: 200, vx: 62, facing: 1, visible: true, pose: null },
      maria: { x: 145, vx: 62, facing: 1, visible: true, pose: null },
    };

    /* yoğunlaşan sis katmanı */
    this.fogOverlay = this.add.rectangle(0, 0, 4000, 2000, 0x9aa0ad, 0).setDepth(200).setOrigin(0);

    this.introT = 0;
    this.introStep = 0;
    this.skipHold = 0;

    SFAudio.playIntroTheme();
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 30;
    this.cameras.main.setZoom(1.5);

    /* KISA, VURUCU İNTRO (~18 sn): uzun kurulum yerine birkaç cümlede araf'a düşüş.
       Tam metin atlanabilir (ACT/JUMP basılı tut). */
    this.introTimeline = [
      { t: 0.8, fn: () => UI.subtitle('Bir akşam yürüyüşe çıkmıştık. Maria ve ben.', 2800) },
      { t: 3.6, fn: () => {
          this.tweens.add({ targets: this.fogOverlay, fillAlpha: 0.16, duration: 3200 });
          SFAudio.windGust(0.8);
          UI.subtitle('Bir anda yoğun bir sis bastırdı.', 2600);
      }},
      { t: 6.0, fn: () => { this.actors.kai.vx = 0; this.actors.maria.vx = 0; this.actors.maria.facing = -1; this.actors.kai.facing = -1; } },
      { t: 6.8, fn: () => { this.actors.kai.facing = 1; UI.subtitle('Maria: "Kai, yol nerede? Az önce buradaydı."', 3000); } },
      { t: 9.6, fn: () => {
          this.cameras.main.shake(2000, 0.012);
          SFAudio.thunder();
          UI.subtitle('Sonra ayağımızın altındaki zemin kayboldu.', 2400);
          this.actors.maria.pose = 'scared';
      }},
      { t: 11.8, fn: () => {
          this.fx?.hitFlash?.(1);
          this.tweens.add({ targets: this.fogOverlay, fillAlpha: 1, duration: 600 });
          this.fogOverlay.fillColor = 0x010103;
      }},
      { t: 12.9, fn: () => UI.subtitle('Düştük. Uzun süre düştük.', 2400) },
      { t: 15.2, fn: () => UI.showChapterCard({ id: 0, name: 'ARAF', sub: 'ne ölülerin ne dirilerin yeri' }) },
      { t: 18.4, fn: () => this.endIntro() },
    ];
  }

  updateIntro(dt, time) {
    this.introT += dt;
    while (this.introStep < this.introTimeline.length && this.introT >= this.introTimeline[this.introStep].t) {
      this.introTimeline[this.introStep].fn();
      this.introStep++;
    }
    if (Input.act || Input.jump) {
      this.skipHold += dt;
      if (this.skipHold > 1.4) { this.endIntro(); return; }
    } else this.skipHold = 0;

    const gY = this.introGY;
    for (const key of ['kai', 'maria']) {
      const a = this.actors[key];
      a.x += (a.vx ?? 0) * dt;
      const rig = key === 'kai' ? this.kai : this.mariaRig;
      rig.setVisible(a.visible);
      if (!a.visible) continue;
      const moving = Math.abs(a.vx ?? 0) > 4;
      if (a.pose && !moving) {
        rig.facing = a.facing;
        rig.setPose(a.pose, this.introT);
        rig.update(dt, { x: a.x, y: gY - rig.A.standH, vx: 0, vy: 0, grounded: true, facing: a.facing, mode: 'pose', groundY: gY });
      } else {
        rig.update(dt, { x: a.x, y: gY - rig.A.standH, vx: a.vx ?? 0, vy: 0, grounded: true, facing: a.facing, mode: moving ? 'move' : 'idle', groundY: gY });
      }
    }
    const cam = this.cameras.main;
    cam.scrollX = lerp(cam.scrollX, this.actors.kai.x + 60 - cam.width / 2, 1 - Math.exp(-dt * 1.6));
    cam.scrollY = lerp(cam.scrollY, (gY - 75) - cam.height / 2, 1 - Math.exp(-dt * 1.2));
  }

  endIntro() {
    if (this._introEnded) return;
    this._introEnded = true;
    document.body.classList.remove('cine');
    UI.showSkip(false);
    UI.subtitle('', 1);
    SaveGame.unlock(1);
    UI.fadeOut(1600);
    this.time.delayedCall(1900, () => {
      this.scene.restart({ level: 1, state: {} });
    });
  }
}

/* ============================================================
   UI — DOM kontrolü
   ============================================================ */
const UI = {
  el(id) { return document.getElementById(id); },
  game: null,

  init() {
    const $ = (id) => this.el(id);

    $('m-newgame').onclick = () => { SFAudio.init(); SFAudio.resume(); this.startGame(0); };
    $('m-continue').onclick = () => {
      SFAudio.init(); SFAudio.resume();
      const d = SaveGame.load();
      this.startGame(Math.min(d.current ?? 1, LEVEL_COUNT), d.state);
    };
    $('m-chapters').onclick = () => { this.buildChapters(); this.hide('menu'); this.show('chapters-panel'); };
    $('m-options').onclick = () => { this.hide('menu'); this.show('options-panel'); };
    $('ch-back').onclick = () => { this.hide('chapters-panel'); this.show('menu'); };
    $('opt-back').onclick = () => { this.hide('options-panel'); this.show('menu'); };

    $('opt-vol').oninput = (e) => { SF_SETTINGS.vol = e.target.value / 100; SFAudio.setVol(SF_SETTINGS.vol, SF_SETTINGS.music); };
    $('opt-music').oninput = (e) => { SF_SETTINGS.music = e.target.value / 100; SFAudio.setVol(SF_SETTINGS.vol, SF_SETTINGS.music); };
    $('opt-grain').oninput = (e) => { SF_SETTINGS.grain = e.target.value / 100; };

    $('pause-btn').onclick = () => this.pause();
    $('skip-btn').onclick = () => { SFAudio.resume(); this.scene()?.requestSkip(); };
    $('p-resume').onclick = () => this.resume();
    $('p-restart').onclick = () => { this.hide('pause-panel'); this.scene()?.respawn(); };
    $('p-menu').onclick = () => this.toMenu();

    $('d-retry').onclick = () => { this.hide('death-panel'); this.scene()?.respawn(); this.showHUD(true); };
    $('d-menu').onclick = () => this.toMenu();
    $('end-menu').onclick = () => { this.hide('ending-panel'); this.toMenu(); };

    const keymap = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
      ArrowDown: 'crouch', KeyS: 'crouch', ControlLeft: 'crouch',
      KeyE: 'act', Enter: 'act',
      KeyX: 'fire', KeyJ: 'fire',
      KeyF: 'flash',
      KeyR: 'reload',
      KeyQ: 'heal',
    };
    window.addEventListener('keydown', (e) => {
      const k = keymap[e.code];
      if (!k) {
        if (e.code === 'Escape') this.scene() && (this.el('pause-panel').classList.contains('visible') ? this.resume() : this.pause());
        return;
      }
      e.preventDefault();
      if (!Input[k]) {
        if (k === 'jump') Input.jumpHit = true;
        if (k === 'act') Input.actHit = true;
        if (k === 'fire') Input.fireHit = true;
        if (k === 'flash') Input.flashHit = true;
        if (k === 'reload') Input.reloadHit = true;
        if (k === 'heal') Input.healHit = true;
      }
      Input[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      const k = keymap[e.code];
      if (k) Input[k] = false;
    });

    const bindTouch = (id, prop) => {
      const b = this.el(id);
      if (!b) return;
      const on = (e) => {
        e.preventDefault();
        if (!Input[prop]) {
          if (prop === 'jump') Input.jumpHit = true;
          if (prop === 'act') Input.actHit = true;
          if (prop === 'fire') Input.fireHit = true;
          if (prop === 'flash') Input.flashHit = true;
        }
        Input[prop] = true; b.classList.add('active');
      };
      const off = (e) => { e.preventDefault(); Input[prop] = false; b.classList.remove('active'); };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off, { passive: false });
      b.addEventListener('touchcancel', off, { passive: false });
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
    };
    bindTouch('btn-left', 'left');
    bindTouch('btn-right', 'right');
    bindTouch('btn-jump', 'jump');
    bindTouch('btn-crouch', 'crouch');
    bindTouch('btn-act', 'act');
    bindTouch('btn-fire', 'fire');
    bindTouch('btn-flash', 'flash');

    if (SaveGame.load().current) this.el('m-continue').style.display = '';
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    this.show('menu');
    setTimeout(() => this.el('fader').classList.add('clear'), 250);
  },

  scene() { return this.game?.scene.getScene('game'); },
  show(id) { this.el(id).classList.add('visible'); },
  hide(id) { this.el(id).classList.remove('visible'); },
  showSkip(v) { this.el('skip-btn').classList.toggle('show', !!v); },

  startGame(level, state) {
    this.hide('menu'); this.hide('chapters-panel'); this.hide('death-panel'); this.hide('ending-panel');
    this.el('fader').classList.remove('clear');
    if (!this.game) {
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game-container',
        backgroundColor: '#050507',
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        physics: { default: 'matter', matter: { debug: false, positionIterations: 8, velocityIterations: 6 } },
        scene: [],
        render: { antialias: true },
      });
      this.game.scene.add('game', GameScene, false);
    }
    const sc = this.game.scene.getScene('game');
    if (sc && this.game.scene.isActive('game')) {
      this.game.scene.stop('game');
    }
    setTimeout(() => {
      this.game.scene.start('game', { level, state });
      this.el('pause-btn').style.display = 'flex';
      if (this.isTouch) this.el('controls').style.display = 'flex';
    }, 60);
  },

  toMenu() {
    this.hide('pause-panel'); this.hide('death-panel'); this.hide('ending-panel');
    this.showHUD(false);
    this.hideBossBar();
    this.showSkip(false);
    this.el('pause-btn').style.display = 'none';
    this.el('controls').style.display = 'none';
    document.body.classList.remove('cine');
    if (this.game) this.game.scene.stop('game');
    if (SaveGame.load().current) this.el('m-continue').style.display = '';
    this.show('menu');
  },

  pause() {
    const sc = this.scene();
    if (!sc || !this.game.scene.isActive('game')) return;
    this.game.scene.pause('game');
    this.show('pause-panel');
  },
  resume() {
    this.hide('pause-panel');
    this.game.scene.resume('game');
    SFAudio.resume();
  },

  buildChapters() {
    const grid = this.el('chapters-grid');
    grid.innerHTML = '';
    const unlocked = SaveGame.unlocked;
    for (let act = 1; act <= 15; act++) {
      const head = document.createElement('div');
      head.className = 'act-head';
      head.textContent = `PERDE ${act} — ${ACT_NAMES[act][0]}`;
      grid.appendChild(head);
      const row = document.createElement('div');
      row.className = 'act-row';
      for (let i = 1; i <= 10; i++) {
        const lv = (act - 1) * 10 + i;
        const b = document.createElement('button');
        b.className = 'lv-btn' + (lv > unlocked ? ' locked' : '') + (lv % 10 === 0 ? ' bosslv' : '');
        b.textContent = lv;
        if (lv <= unlocked) b.onclick = () => { SFAudio.init(); SFAudio.resume(); this.hide('chapters-panel'); this.startGame(lv, SaveGame.load().state); };
        row.appendChild(b);
      }
      grid.appendChild(row);
    }
    // giriş sinematiği
    const introBtn = document.createElement('button');
    introBtn.className = 'text-btn dim';
    introBtn.textContent = 'GİRİŞİ TEKRAR İZLE';
    introBtn.onclick = () => { SFAudio.init(); SFAudio.resume(); this.hide('chapters-panel'); this.startGame(0); };
    grid.appendChild(introBtn);
  },

  /* ---- HUD ---- */
  showHUD(on) {
    this.el('hud').style.display = on ? 'flex' : 'none';
  },
  updateHP(hp, max, flash) {
    const row = this.el('hp-row');
    if (row.children.length !== max) {
      row.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const c = document.createElement('div');
        c.className = 'hp-cell';
        row.appendChild(c);
      }
    }
    [...row.children].forEach((c, i) => {
      c.classList.toggle('full', i < hp);
      if (flash && i >= hp) { c.classList.remove('hurt'); void c.offsetWidth; c.classList.add('hurt'); }
    });
  },
  updateInv(inv, state) {
    this.el('inv-crowbar').classList.toggle('show', !!inv.crowbar);
    this.el('inv-key').classList.toggle('show', !!inv.key);
    this.el('inv-carkey').classList.toggle('show', !!inv.carkey);
    // bandaj
    const bd = this.el('cnt-bandage');
    bd.style.display = state.bandages > 0 ? 'flex' : 'none';
    bd.querySelector('.num').textContent = state.bandages;
    // silah
    const am = this.el('ammo-box');
    am.style.display = state.gun ? 'flex' : 'none';
    if (state.gun) am.querySelector('.num').textContent = `${state.loaded} · ${state.mags}`;
  },
  updateBattery(pct, spares, on) {
    const box = this.el('battery-box');
    box.style.display = (pct < 100 || spares > 0 || on) ? 'flex' : 'none';
    const fill = this.el('bat-fill');
    fill.style.width = Math.max(0, pct) + '%';
    fill.style.background = pct < 20 ? 'rgba(214,150,130,0.85)' : 'rgba(205,200,190,0.75)';
    box.classList.toggle('on', on);
    this.el('bat-spares').textContent = '×' + spares;
  },
  updateBreath(pct) {
    const b = this.el('breath-bar');
    if (pct < 0) { b.style.display = 'none'; return; }
    b.style.display = 'block';
    this.el('breath-fill').style.width = (pct * 100) + '%';
  },
  setActGlow(on, label) {
    const b = this.el('btn-act');
    b.classList.toggle('glow', on);
    if (on && label) b.querySelector('.act-label').textContent = label;
  },

  showBossBar(name, pct) {
    const bar = this.el('boss-bar');
    bar.style.display = 'block';
    bar.querySelector('.boss-name').textContent = name ?? '???';
    bar.querySelector('.boss-fill').style.width = (pct * 100) + '%';
  },
  hideBossBar() { this.el('boss-bar').style.display = 'none'; },

  _subTimer: null,
  subtitle(text, ms = 3000) {
    const s = this.el('subtitle');
    if (!text) { s.classList.remove('show'); return; }
    s.textContent = text;
    s.classList.add('show');
    clearTimeout(this._subTimer);
    this._subTimer = setTimeout(() => s.classList.remove('show'), ms);
  },

  showChapterCard(ch) {
    const card = this.el('chapter-card');
    card.querySelector('.num').textContent = ch.id === 0 ? '' : `BÖLÜM ${ch.id} / ${LEVEL_COUNT}` + (ch.bossName ? ' — ' + ch.bossName : '');
    card.querySelector('.name').textContent = ch.name + (ch.sub ? ' — ' + ch.sub : '');
    card.classList.add('visible');
    setTimeout(() => card.classList.remove('visible'), 2600);
  },

  showEndCard() {
    const card = this.el('chapter-card');
    card.querySelector('.num').textContent = 'SON';
    card.querySelector('.name').textContent = 'ŞAFAK';
    card.classList.add('visible');
    setTimeout(() => {
      card.classList.remove('visible');
      this.toMenu();
    }, 4200);
  },

  showEnding() {
    document.body.classList.remove('cine');
    this.show('ending-panel');
    const txt = this.el('ending-text');
    txt.innerHTML = '';
    this.el('end-menu').style.opacity = 0;
    ENDING_LINES.forEach((line, i) => {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'end-line';
        p.textContent = line;
        txt.appendChild(p);
        requestAnimationFrame(() => p.classList.add('in'));
      }, 800 + i * 2600);
    });
    setTimeout(() => { this.el('end-menu').style.opacity = 1; }, 800 + ENDING_LINES.length * 2600);
    SaveGame.unlock(LEVEL_COUNT);
  },

  showDeath() {
    this.el('death-text').textContent = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
    this.show('death-panel');
  },

  fadeIn() { setTimeout(() => this.el('fader').classList.add('clear'), 120); },
  fadeOut(ms = 1600) {
    const f = this.el('fader');
    f.style.transitionDuration = ms + 'ms';
    f.classList.remove('clear');
  },
};

/* ---------------- boot ---------------- */
window.addEventListener('DOMContentLoaded', () => UI.init());
