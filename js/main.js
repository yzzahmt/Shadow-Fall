/* ============================================================
   SHADOW FALL — Main Engine v6
   100 bölüm, el feneri + pil ekonomisi, su/rüzgâr fizikleri,
   kenar sistemi (uçurumda durma, kenara tutunma, tırmanma,
   kaçarken refleksle yakalama), sert inişte yuvarlanma,
   tabanca + şarjör değişimi, eşya alma, bandaj, bulmacalar, yapılar,
   ses yayılımı (NPC'ler duyduğu yere gider), elektrik kesintileri.
   Hikâye yalnız giriş sinematiğinde ve finalde anlatılır.
   ============================================================ */
'use strict';

const MatterLib = Phaser.Physics.Matter.Matter;

/* ---------------- ayarlar + kayıt ----------------
   sens: dokunma hassasiyeti (0.5 = parmağı daha uzağa kaydırmak gerekir,
   1.5 = küçük hareket yeter) · vibe: titreşim açık/kapalı */
window.SF_SETTINGS = { vol: 0.8, music: 0.7, grain: 0.55, sens: 1, vibe: true };
/* zayıf mobil cihazlarda ağır shader efektlerini (kenar ışığı) kapat */
window.SF_LOWFX = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
  ((navigator.hardwareConcurrency ?? 8) <= 4 || (navigator.deviceMemory ?? 8) <= 3);
if ((('ontouchstart' in window) || navigator.maxTouchPoints > 0)) window.SF_SETTINGS.grain = 0.35;
try { Object.assign(window.SF_SETTINGS, JSON.parse(localStorage.getItem('sf_settings')) || {}); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem('sf_settings', JSON.stringify(SF_SETTINGS)); } catch (e) {} };
/* titreşim — ayarlardan kapatılabilir */
window.SFVibrate = (pattern) => {
  if (!SF_SETTINGS.vibe) return;
  try { navigator.vibrate?.(pattern); } catch (e) {}
};

/* bölüm istatistikleri — kontrol noktasından dönüşte sıfırlanmaz, bölüm özetinde gösterilir */
const RunStats = { level: null, time: 0, deaths: 0, found: new Set() };
const JUNK_ITEMS = new Set(['stone', 'can', 'plank', 'shard', 'deadBattery', 'magEmpty']);

const SaveGame = {
  load() {
    try { return JSON.parse(localStorage.getItem('sf5_save')) || {}; } catch (e) { return {}; }
  },
  save(d) { try { localStorage.setItem('sf5_save', JSON.stringify(d)); } catch (e) {} },
  /* açılan son bölüm: bitirdiğin bölümün bir sonrası. Geliştirirken tüm bölümleri
     açmak için adrese ?unlockall ekle. */
  get unlocked() {
    if (/[?&]unlockall\b/.test(location.search)) return LEVEL_COUNT;
    const d = this.load();
    return clamp(Math.max(1, d.unlocked ?? 0, d.current ?? 0), 1, LEVEL_COUNT);
  },
  unlock(lv) { const d = this.load(); d.unlocked = Math.max(d.unlocked ?? 0, lv); this.save(d); },
  setCurrent(lv, state) { const d = this.load(); d.current = lv; d.state = state; this.save(d); },
};

/* ---------------- giriş durumu ---------------- */
const Input = {
  left: false, right: false, jump: false, crouch: false, act: false,
  fire: false, flash: false, reload: false, heal: false, run: false,
  stick: null,               // mobil joystick itme miktarı (0..1) — null: klavye
  up: false,                 // joystick yukarı (merdiven)
  jumpHit: false, actHit: false, fireHit: false, flashHit: false, reloadHit: false, healHit: false,
};

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
    if (!(this.spawnX != null && RunStats.level === this.levelId)) {
      RunStats.level = this.levelId; RunStats.time = 0; RunStats.deaths = 0; RunStats.found = new Set();
    }
  }

  create() {
    const ch = this.ch = getLevel(this.levelId);
    this.isIntro = ch.type === 'intro';
    this.worldW = ch.worldW;

    SFAudio.init(); SFAudio.resume(); SFAudio.startAmbience();
    SFAudio.setWeather(ch.rain ?? 0, ch.wind ?? 0.5);
    SFAudio.setBiomeAmbience(ch.type === 'intro' ? 'forest' : ch.biome, { interior: !!ch.interior });
    SFAudio.setVol(SF_SETTINGS.vol, SF_SETTINGS.music);
    /* müzik: bölümde sahneye göre parça değişir (bkz. music.js); giriş kendi temasını çalar */
    if (this.isIntro) SFMusic.stop(0.8);
    else SFMusic.setScene(ch.interior ? 'interior' : 'explore', ch.biome, 0);
    this.events.once('shutdown', () => {
      SFMusic.stop(0.6);
      SFAudio.setBiomeAmbience(null);
      const M = this.mis;
      M?.fire?.snd?.stop(); M?.flood?.hiss?.stop(); M?.vehicle?.engine?.stop(0.2);
      UI.showBombHud(false); UI.hide('bomb-panel'); UI.hide('keypad-panel'); UI.showTutorial(null); UI.showCode(null);
      this.fx?.setHeat?.(0);
    });

    Atmo.generateTextures(this);
    LightSystem.ensureTextures(this);

    this.matter.world.setBounds(-50, -600, this.worldW + 100, WORLD_H + 900, 64, true, true, false, false);
    this.matter.world.setGravity(0, 1.35);
    /* HIZ BİRİMİ DÜZELTMESİ — Matter 0.19'da adım sonrası body.velocity "adım başına
       yer değiştirme"dir; setVelocity ise 60 Hz'e göre normalize birim bekler. Ekran
       60 Hz değilse (120 Hz telefon, yavaş cihaz) okunan hız yanlış çıkıyor, animasyon
       ile hareket kopuyordu (yerinde/havada yürüme). Her adımdan sonra normalize et. */
    const _norm = () => {
      for (const b of MatterLib.Composite.allBodies(this.matter.world.localWorld)) {
        if (b.isStatic || b.isSleeping) continue;
        const v = MatterLib.Body.getVelocity(b);
        b.velocity.x = v.x; b.velocity.y = v.y;
      }
    };
    this.matter.world.on('afterupdate', _norm);
    /* sahne kapanırken Matter dünyası önce yok edilebiliyor (menüye dönüş / bölüm
       değişimi) — world null iken .off çağrısı hata fırlatıyordu */
    const world = this.matter.world;
    this.events.once('shutdown', () => world?.off?.('afterupdate', _norm));

    this.parallax = Atmo.buildParallax(this, this.worldW, {
      id: 'lv' + ch.id + '_' + ch.act, seed: ch.act * 37 + 5, palette: ch.palette, layers: ch.parallax,
      moon: (ch.dark ?? 0) < 0.6,   // iç mekân / zifiri perdelerde ay yok
      biome: ch.biome, lightning: !ch.interiorish && (ch.dark ?? 0) < 0.6 && (ch.rain ?? 0) > 0.2,
    });

    /* ---- ışık sistemi ---- */
    this.lights2 = new LightSystem(this);
    /* karanlık katmanı, bu karedeki tüm hareket (oyuncu, fener, KAMERA) bittikten sonra
       çizilir — yoksa ışık bir kare geriden gelir ve hareket ederken elden kopar */
    const lightTick = () => this.lights2.update(this.time.now);
    this.events.on('postupdate', lightTick);
    this.events.once('shutdown', () => this.events.off('postupdate', lightTick));
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
    this.platforms = (ch.platforms ?? []).map(p => ({ ...p }));   // kopya: çöken köprü listeyi değiştirir, önbellek bozulmasın
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
    this.containers = [];
    this.pushboxes = [];
    this.doors = [];
    this.soldiers = [];
    this.creatures = [];
    this.levers = [];
    this.ladders = [];
    this.generators = [];
    this.poweredDoors = [];
    this.bullets = [];
    this.playerBullets = [];

    if (!this.isIntro) this.buildGameplay();

    /* uçurum kenarları: tutunma noktaları + görünür çukurlar */
    this.buildLedges();
    if (!this.isIntro) this.decoratePits();

    this.particles = Atmo.buildWorldParticles(this, this.worldW, { rain: ch.rain, biome: ch.biome });
    this.fx = Atmo.buildScreenFX(this);

    /* ---- oyuncu durumu ---- */
    this.hpMax = 4;
    this.hp = 4;
    this.state = { ...this.carry };
    this.inv = { crowbar: this.carry.crowbar, key: false, fuse: false, cutters: false };
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
      /* Maria'nın atkısı: bölüm 1'de uyandığın yerde yerde durur, alınca boynunda taşırsın */
      this.rig.scarf = !!this.carry.scarf || this.levelId > 1;
      if (ch.scarfAt && !this.rig.scarf) {
        const g = this.add.graphics().setDepth(93);
        const x = ch.scarfAt.x, y = ch.scarfAt.groundY;
        g.fillStyle(0x6a2e2e, 0.95);
        g.beginPath();
        g.moveTo(x - 18, y - 1); g.lineTo(x - 4, y - 4); g.lineTo(x + 10, y - 2); g.lineTo(x + 22, y - 6);
        g.lineTo(x + 26, y - 3); g.lineTo(x + 12, y + 1); g.lineTo(x - 2, y); g.lineTo(x - 16, y + 2);
        g.closePath(); g.fillPath();
        this.scarfItem = { x, y, g, light: this.lights2.addLight({ x, y: y - 10, r: 70, type: 'halo', intensity: 0.55 }) };
      }
      /* bölüm 1 başı: Kai yarığın dibinde baygın yatıyor — kendine gelip doğrulur */
      if (this.levelId === 1 && !this.spawnX) this.player.wakeT = 4.2;
      this.hint = new InteractHint(this);
      Missions.setup(this);
      Puzzles.setup(this);
      Buildings.setup(this);
      UI.showHUD(!this.player.wakeT);
      UI.updateHP(this.hp, this.hpMax);
      this.syncHUD();
    }

    const cam = this.cameras.main;
    cam.setBounds(0, -200, this.worldW, WORLD_H + 200);
    cam.setBackgroundColor(0x000000);
    /* ekran yüksekliğine göre zoom — telefonda dünya daha geniş görünür,
       karakter ekranın küçük bir kısmını kaplar (kontrol tuşlarına yer kalır) */
    this.fitZoom = () => clamp(this.scale.height / 545, 1.0, 1.3);   // <1 olursa ekran-sabit katmanlar (gök, karanlık) ekranı doldurmaz
    this.baseZoom = this.fitZoom();
    if (!this.isIntro) cam.setZoom(this.baseZoom);

    this.triggers = (ch.triggers ?? []).map(t => ({ ...t, fired: false }));
    if (!this.isIntro) this.buildCheckpointMarks();
    /* bölümde bulunabilecek eşyalar (taş, teneke gibi çöpler hariç) */
    this.lootKeys = new Set();
    const addLoot = (pre, list) => list.forEach((raw, i) => { if (!JUNK_ITEMS.has(raw.split(':')[0])) this.lootKeys.add(pre + ':' + i); });
    for (const c of (ch.containers ?? [])) addLoot('c' + Math.round(c.x), c.contents ?? []);
    for (const c of (ch.crates ?? [])) addLoot('k' + Math.round(c.x), c.contents ?? []);
    for (const it of (ch.looseItems ?? [])) if (!JUNK_ITEMS.has(it.kind)) this.lootKeys.add(it.kind + '@' + Math.round(it.x / 40));
    for (const n of (ch.notes ?? [])) this.lootKeys.add('n' + n.lock + ':' + n.idx);

    this.matter.world.on('collisionstart', (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        const item = a.sfItem || b.sfItem;
        if (item && !item.picked) {
          const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
          if (rel > 1.2) SFAudio.itemHit(item.def.sound, Math.min(1, rel / 9));
          /* devrilen teneke / taş ses yapar — yakındaki düşmanlar o yöne bakar */
          if (rel > 3 && item.x != null) this.makeNoise(item.x, item.y, 140 + Math.min(1, rel / 9) * 200, 0.35);
        }
      }
    });

    /* ölçek yöneticisi oyun genelinde tek: dinleyici sahne kapanınca kaldırılmazsa her bölümde
       bir tane daha birikir ve ekran döndürülünce yok edilmiş katmanlara erişip hata verir */
    const onResize = (gs) => {
      this.parallax.resize(gs.width, gs.height);
      this.fx.resize(gs.width, gs.height);
      this.lights2.resize(gs.width, gs.height);
      if (!this.isIntro) { this.baseZoom = this.fitZoom(); this.cameras.main.setZoom(this.baseZoom); }
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));

    UI.fadeIn();
    if (!this.isIntro) {
      if (!(this.levelId === 1 && !this.spawnX)) UI.showChapterCard(this.ch);
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
      this.matter.add.rectangle(wl.x, (wl.y0 + wl.y1) / 2, wl.look === 'log' ? 104 : 22, wl.y1 - wl.y0, {
        isStatic: true, label: 'wall', collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
    }
  }

  drawGround() {
    const g = this.add.graphics().setDepth(70);
    let i = 0;
    for (const seg of this.groundSegs) {
      Atmo.drawGroundStrip(this, g, seg.x0, seg.x1, seg.y, this.ch.id * 100 + i * 7 + 3, 0x0a0a0e, (seg.material ?? 'earth') === 'earth' && !this.ch.interior);
      i++;
    }
    for (const p of this.platforms) {
      const th = p.thick ?? 10;
      g.fillStyle(0x0a0a0e, 1);
      if (p.ceiling) {
        // tavan: beton kütle + alt kenarda borular
        g.fillRect(p.x, p.y, p.w, th);
        g.fillStyle(0x0c0c11, 1);
        g.fillRect(p.x, p.y + th - 8, p.w, 8);
        for (let bx = p.x + 40; bx < p.x + p.w; bx += 180) g.fillRect(bx, p.y + th, 12, 10);
      } else if (p.look === 'branch') {
        // devrilmiş kalın dal — altından eğilerek geçilir
        g.fillRect(p.x - 30, p.y + th - 34, p.w + 60, 34);
        g.fillRect(p.x + p.w * 0.3, p.y, 22, th);
        g.lineStyle(4, 0x0a0a0e, 1);
        g.beginPath(); g.moveTo(p.x + 20, p.y + th - 30); g.lineTo(p.x - 10, p.y + th - 70); g.strokePath();
        g.beginPath(); g.moveTo(p.x + p.w - 30, p.y + th - 28); g.lineTo(p.x + p.w + 20, p.y + th - 64); g.strokePath();
        for (let lx = p.x; lx < p.x + p.w; lx += 14) g.fillEllipse(lx, p.y + th + 4 + (lx % 3) * 3, 10, 6);
      } else if (p.look === 'beam') {
        g.fillRect(p.x, p.y + th - 22, p.w, 22);
        g.fillRect(p.x + p.w * 0.45, p.y, 14, th);
      } else {
        g.fillRect(p.x, p.y, p.w, th);
        g.fillRect(p.x + 8, p.y, 6, 40);
        g.fillRect(p.x + p.w - 14, p.y, 6, 40);
      }
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
      if (wl.look === 'log') {
        // devrik kütük — üstünden atlanır
        g.fillEllipse(wl.x, wl.y1 - (wl.y1 - wl.y0) / 2, 120, wl.y1 - wl.y0 + 4);
        g.fillStyle(0x16171d, 1);
        g.fillEllipse(wl.x + 56, wl.y1 - (wl.y1 - wl.y0) / 2, 12, wl.y1 - wl.y0 - 4);
      } else g.fillRect(wl.x - 11, wl.y0, 22, wl.y1 - wl.y0);
    }
  }

  buildGameplay() {
    const ch = this.ch;
    for (const c of (ch.crates ?? [])) this.crates.push(new Crate(this, c));
    for (const c of (ch.containers ?? [])) this.containers.push(new Container(this, c));
    for (const p of (ch.pushboxes ?? [])) this.pushboxes.push(new PushBox(this, p));
    for (const it of (ch.looseItems ?? [])) this.physItems.push(new PhysItem(this, it.kind, it.x, it.y));
    /* levyesiz oyuncu için yedek levye (kutu bulmacaları kilitlenmesin). Yerde durmaz:
       ilk zorlanacak yerden önceki bir dolapta / bagajda saklıdır; yoksa oraya
       terk edilmiş bir araba (iç mekânda dolap) konur. */
    const firstPry = [...(ch.crates ?? []), ...(ch.containers ?? []).filter(c => c.needsCrowbar)].sort((a, b) => a.x - b.x)[0];
    if (!this.carry.crowbar && firstPry && this.levelId > 3) {
      const inside = (x) => !!ch.interior || (ch.buildings ?? []).some(b => x > b.x0 && x < b.x1);
      const host = this.containers.filter(c => !c.needsCrowbar && c.x < firstPry.x - 40 && ['wardrobe', 'cabinet', 'locker', 'trunk', 'drawer', 'chest'].includes(c.kind))
        .sort((a, b) => b.x - a.x)[0];
      if (host) host.contents = [...host.contents, 'crowbar'];           // kopya: önbellekteki bölüm verisi değişmesin
      else {
        let x = Math.max(240, firstPry.x - 200);
        while (x > 160 && this.groundYAt(x - 20) !== this.groundYAt(x + 140)) x -= 40;
        this.containers.push(new Container(this, { kind: inside(x) ? 'cabinet' : 'trunk', x, groundY: this.groundYAt(x), contents: ['crowbar'] }));
      }
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
    for (const s of (ch.soldiers ?? [])) {
      const sol = new Soldier(this, {
        x: s.x, groundY: this.groundYAt(s.x),
        patrolMinX: s.patrolMinX, patrolMaxX: s.patrolMaxX,
        facing: s.facing ?? -1, static: s.static,
        hp: s.hp, tough: s.tough,
      });
      sol.onShoot = (x, y, dir, target) => this.spawnBullet(x, y, dir, target);
      this.soldiers.push(sol);
    }
    for (const c of (ch.creatures ?? [])) {
      const cr = spawnCreature(this, {
        ...c, groundY: this.groundYAt(c.x),
      });
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
    void msg;
  }

  /* lever / jeneratör bağlantıları */
  onLeverPulled(id) {
    const link = this.ch.leverLinks?.[id];
    if (link?.ladder) {
      const lad = this.ladders.find(l => l.id === link.ladder);
      if (lad) lad.lower();
    }
    if (link?.door) this.openGrate(this.poweredDoors.find(p => p.id === link.door), 'Bir kapak açıldı!');
    if (link?.puzzle) Puzzles.onLever(this, link.puzzle);
  }

  /* basamaklı merdivene gir: k=0 dipten, k=1 tepeden; auto: dokunarak başlatıldıysa kendiliğinden yürür */
  enterStair(s, k, auto) {
    const P = this.player;
    if (!P || P.stair) return;
    this.setCrouch(false);
    P.stair = { s, k, auto: auto ?? 0, v: 0 };
    P.climbing = false; P.slideT = 0; P.rollT = 0;
    P.body.collisionFilter.mask = 0;
  }
  /* bir noktada basılabilir yüzey var mı (merdiven çıkışı için) */
  surfaceNear(x, y) {
    for (const g of this.groundSegs) if (x >= g.x0 && x <= g.x1 && Math.abs(g.y - y) < 8) return true;
    for (const p of this.platforms) if (!p.ceiling && x >= p.x && x <= p.x + p.w && Math.abs(p.y - y) < 8) return true;
    return false;
  }
  onGeneratorPowered(id) {
    const link = this.ch.genLinks?.[id];
    if (link?.door) {
      const pd = this.poweredDoors.find(p => p.id === link.door);
      this.openGrate(pd, 'Bir yerlerde demir bir kapak açıldı.');
    }
    if (link?.lift) Escapes.powerLift(this);
    if (link?.puzzle) Puzzles.onPower(this, link.puzzle);
    const gen = this.generators.find(g => g.id === id);
    if (gen) this.lights2.addLight({ x: gen.x, y: gen.groundY - 40, r: 200, type: 'halo', intensity: 0.9 });
  }


  /* ---------------- kontrol noktaları ----------------
     Her kontrol noktasında yere dikilmiş küçük bir taş fener durur: sönükken
     yalnız kor gibi bir nokta, geçince fitil tutuşur ve sıcak bir ışık kalır.
     Öldüğünde son yanan fenerden devam edersin. */
  buildCheckpointMarks() {
    this.cpMarks = [];
    for (const cp of (this.ch.checkpoints ?? [])) {
      if (cp < 300 || cp > this.ch.exitX - 150) continue;
      const gy = this.groundYAt(cp);
      if (gy >= KILL_Y) continue;
      const g = this.add.graphics().setDepth(90);
      const c = 0x0b0b10;
      g.fillStyle(c, 1);
      g.fillRect(cp - 9, gy - 8, 18, 8);              // taban taşı
      g.fillRect(cp - 3, gy - 34, 6, 28);             // direk
      g.fillRect(cp - 8, gy - 52, 16, 4);             // çatı
      g.fillTriangle(cp - 6, gy - 52, cp + 6, gy - 52, cp, gy - 58);
      g.lineStyle(1.4, c, 1); g.strokeRect(cp - 6, gy - 48, 12, 14);   // fener kafesi
      const flame = this.add.image(cp, gy - 41, 'softDot').setDepth(91).setScale(0.18)
        .setAlpha(0.25).setTint(0xb04a2a).setBlendMode(Phaser.BlendModes.ADD);
      const light = this.lights2.addLight({ x: cp, y: gy - 41, r: 110, type: 'halo', intensity: 0.75, flicker: 0.08, on: false });
      const m = { x: cp, gy, g, flame, light, lit: false };
      if (cp <= this.checkpointX) this.lightCheckpoint(m, false);
      this.cpMarks.push(m);
    }
  }
  lightCheckpoint(m, announce) {
    m.lit = true;
    m.light.on = true;
    m.flame.setTint(0xf0d8a0).setScale(0.42).setAlpha(0.9);
    this.tweens.add({ targets: m.flame, alpha: 0.65, scale: 0.36, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (announce) SFAudio.checkpoint?.();
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
      if (!this._blackoutHinted && !this.flashOn) {
        this._blackoutHinted = true;
        UI.hint(UI_HINT('flash'), 3200, '✦');
      }
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
        inertia: Infinity, friction: 0, frictionStatic: 0, frictionAir: 0,   // hızı kod yönetir; sürtünme kare hızına göre değişmesin
        chamfer: { radius: [3, 3, 7, 7] },   // yuvarlak alt köşeler: tahta/zemin eklerine takılmaz
        restitution: 0, label: 'player', density: 0.0024,
        collisionFilter: { category: CAT.PLAYER, mask: CAT.WORLD | CAT.PUSHBOX },
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

  /* ---------------- dokunmatik: dokun / basılı tut ---------------- */
  cancelAutoWalk() { if (this.player) { this.player.autoX = null; this.player.autoAct = false; } }
  _screenToWorld(sx, sy) {
    const p = this.cameras.main.getWorldPoint(sx, sy);
    return { x: p.x, y: p.y };
  }
  /* dokunulan noktadaki hedefler: eşya, kutu, kol, kapı, jeneratör, görev nesneleri */
  _tapTargets() {
    const T = [];
    for (const it of this.physItems) if (!it.picked && it.def.pickable) T.push({ x: it.x, y: it.y, ax: it.x });
    for (const c of this.crates) if (!c.opened) T.push({ x: c.x, y: c.y, ax: c.x });
    for (const c of this.containers) if (!c.opened) T.push({ x: c.x, y: c.y, ax: c.x });
    for (const l of this.levers) if (!l.pulled) T.push({ x: l.x, y: l.groundY - 40, ax: l.x });
    for (const d of this.doors) if (!d.open) T.push({ x: d.x, y: d.groundY - d.h / 2, ax: d.x - 30 * Math.sign(d.x - this.player.body.position.x) });
    for (const g of this.generators) if (!g.powered) T.push({ x: g.x, y: g.groundY - 30, ax: g.x });
    const M = this.mis;
    if (M) {
      for (const f of M.fuseBoxes) if (!f.done) T.push({ x: f.x, y: f.y, ax: f.x });
      for (const n of M.notes) if (!n.read) T.push({ x: n.x, y: n.y, ax: n.x });
      for (const k of M.keypads) if (!k.solved) T.push({ x: k.x, y: k.lampY, ax: k.x });
      for (const S of M.simons) { T.push({ x: S.startX, y: S.groundY - 50, ax: S.startX }); S.levers.forEach(lx => T.push({ x: lx, y: S.groundY - 50, ax: lx })); }
      if (M.bomb && !M.bomb.done) T.push({ x: M.bomb.x, y: M.bomb.groundY - 30, ax: M.bomb.x - 30 });
      if (M.vehicle && !M.vehicle.started) T.push({ x: M.vehicle.x, y: M.vehicle.y - 30, ax: M.vehicle.x });
    }
    T.push(...Puzzles.tapTargets(this));
    if (M) T.push(...Escapes.tapTargets(this));
    for (const s of (this.stairs ?? [])) T.push({ x: s.x0 + s.dir * 40, y: s.y0 - 40, ax: s.x0 });
    return T;
  }
  handleTap(sx, sy) {
    const P = this.player;
    if (!P || this.dead || this.cineLock || this.panelOpen) return;
    const w = this._screenToWorld(sx, sy);
    const px = P.body.position.x, py = P.body.position.y;
    // araçtayken: takipçiye dokun = ateş
    if (P.inVehicle) { Input.fireHit = true; return; }
    // düşmana dokun = ateş (silah varsa)
    if (this.state.gun) {
      const foes = [...this.soldiers.filter(s => !s.dead).map(s => ({ x: s.x, y: s.groundY - 50 })),
        ...this.creatures.filter(c => !c.dead).map(c => ({ x: c.x, y: c.y ?? c.groundY - 40 }))];
      if (foes.some(f => Math.hypot(f.x - w.x, f.y - w.y) < 70)) {
        P.facing = Math.sign(w.x - px) || P.facing;
        Input.fireHit = true; return;
      }
    }
    // karaktere dokun = (pil bittiyse pil değiştir) / fener aç-kapa
    if (Math.abs(w.x - px) < 34 && w.y > py - 70 && w.y < py + 40) {
      if (this._lastTarget?.type === 'battery-swap') Input.actHit = true;
      else Input.flashHit = true;
      return;
    }
    // eşya / nesne: oraya yürü, varınca kullan
    let best = null, bd = 80;
    for (const t of this._tapTargets()) {
      const d = Math.hypot(t.x - w.x, t.y - w.y);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) {
      const near = this._lastTarget && Math.hypot(this._lastTarget.x - best.x, this._lastTarget.y - best.y) < 90;
      if (near || Math.abs(best.ax - px) < 40) { Input.actHit = true; return; }
      P.autoX = best.ax; P.autoAct = true;
      return;
    }
    // boş zemine dokun: oraya yürü
    if (Math.abs(w.x - px) > 50) { P.autoX = w.x; P.autoAct = false; }
  }
  handleHold(sx, sy) {
    const P = this.player;
    if (!P || this.dead || this.cineLock) return;
    const w = this._screenToWorld(sx, sy);
    // yanındaki kutuya basılı tut = levyeyle zorla (basılı kaldıkça devam eder)
    for (const c of this.crates) if (!c.opened && Math.hypot(c.x - w.x, c.y - w.y) < 80 && Math.abs(c.x - P.body.position.x) < 75) Input.actHit = true;
    for (const c of this.containers) if (!c.opened && c.needsCrowbar && Math.hypot(c.x - w.x, c.y - w.y) < 80 && Math.abs(c.x - P.body.position.x) < 75) Input.actHit = true;
    // uzaktaki kutuya basılı tutulduysa önce oraya yürü (tutma, varınca başlar)
    for (const c of this.crates) if (!c.opened && Math.hypot(c.x - w.x, c.y - w.y) < 70 && Math.abs(c.x - P.body.position.x) > 60) { P.autoX = c.x - 40 * Math.sign(c.x - P.body.position.x); P.autoAct = true; }
    for (const pb of this.pushboxes) {
      const bx = pb.body.position.x;
      if (Math.hypot(bx - w.x, pb.body.position.y - w.y) < 80 && Math.abs(bx - P.body.position.x) > pb.w / 2 + 30) {
        P.autoX = bx - (pb.w / 2 + 20) * Math.sign(bx - P.body.position.x); P.autoAct = false;
      }
    }
  }

  /* fener ışığı rig'in elindeki merceğe kilitlenir (eskiden gövde ortasından çıkıyordu) */
  updateFlashBeam() {
    const P = this.player, fp = this.rig.flashPoint;
    const on = this.flashOn && !!fp && !P.inCar;
    this.rig.flashAngle = this.rig.aimMode ? this.rig.aimAngle * 0.5 : 0.06;
    if (on) {
      this.flashLight.x = fp.x;
      this.flashLight.y = fp.y;
      this.flashLight.angle = fp.angle;
    }
    if (!this.beamGlow) {
      this.beamGlow = this.add.image(0, 0, 'lightCone').setOrigin(8 / 480, 0.5).setDepth(101)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffdcaa);
    }
    const bg = this.beamGlow;
    bg.setVisible(on);
    if (on) {
      const r = this.flashLight.r, inten = this.flashLight.intensity;
      bg.setPosition(fp.x, fp.y);
      bg.setScale(r / 230, r / 300);
      bg.setRotation(P.facing > 0 ? fp.angle : Math.PI - fp.angle);
      bg.setAlpha(0.075 * inten + (this.lights2.darkness > 0.8 ? 0.03 : 0));
    }
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

  /* x'teki zemin şeridinden başlayarak aynı yükseklikte kesintisiz yürünebilen aralık
     (yaratıkların kovalama bölgesi). Duvar ya da uçurum aralığı keser. */
  walkRange(x, y) {
    const segs = this.groundSegs.filter(s => Math.abs(s.y - y) < 3).sort((a, b) => a.x0 - b.x0);
    const i = segs.findIndex(s => x >= s.x0 - 2 && x <= s.x1 + 2);
    if (i < 0) return null;
    let lo = segs[i].x0, hi = segs[i].x1;
    for (let k = i + 1; k < segs.length && segs[k].x0 <= hi + 4; k++) hi = Math.max(hi, segs[k].x1);
    for (let k = i - 1; k >= 0 && segs[k].x1 >= lo - 4; k--) lo = Math.min(lo, segs[k].x0);
    /* duvarlar: ayak hizasını kesen her duvar aralığı daraltır */
    for (const w of (this.ch.walls ?? [])) {
      if (w.y0 > y - 20 || w.y1 < y - 40) continue;
      if (w.x > x && w.x < hi) hi = w.x - 16;
      if (w.x < x && w.x > lo) lo = w.x + 16;
    }
    for (const d of (this.ch.doors ?? [])) {
      if (Math.abs(d.groundY - y) > 4) continue;
      if (d.x > x && d.x < hi) hi = d.x - 16;
      if (d.x < x && d.x > lo) lo = d.x + 16;
    }
    return [lo + 10, hi - 10];
  }

  groundYAt(x) {
    let best = KILL_Y + 100;
    for (const seg of this.groundSegs) {
      if (x >= seg.x0 && x <= seg.x1) best = Math.min(best, seg.y);
    }
    return best;
  }

  /* ============================================================
     KENAR SİSTEMİ
     Zemin şeritlerinin ve platformların uçları "kenar"dır. Her kenarın
     açık tarafı (side: +1 sağ / -1 sol), düşüş yüksekliği ve tehlikesi
     (dipte zemin yok / diken / çok derin) hesaplanır.
     ============================================================ */
  buildLedges() {
    const L = [];
    const segs = this.groundSegs;
    const spikes = this.ch.spikes ?? [];
    const groundBelow = (x, y) => {
      let best = null;
      for (const s of segs) if (x >= s.x0 && x <= s.x1 && s.y > y - 30 && (best == null || s.y < best)) best = s.y;
      return best;
    };
    const spikeAt = (x) => spikes.some(sp => x > sp.x0 - 30 && x < sp.x1 + 30);
    const noGrab = this.ch.noGrab ?? [];
    const add = (x, y, side, kind) => {
      const below = groundBelow(x + side * 10, y);
      const drop = below == null ? 9999 : below - y;
      if (drop < 40) return;
      const water = (this.ch.water ?? []).some(w => x + side * 10 > w.x0 && x + side * 10 < w.x1);
      const lethal = !water && (below == null || drop > 260 || spikeAt(x + side * 40));
      const grab = !noGrab.some(n => Math.abs(n.x - x) < 6 && Math.abs(n.y - y) < 6);
      L.push({ x, y, side, drop, lethal, grab, kind });
    };
    for (const s of segs) {
      if (s.y > 680) continue;                       // çukur tabanları kenar sayılmaz
      add(s.x1, s.y, 1, 'ground');
      add(s.x0, s.y, -1, 'ground');
    }
    for (const p of this.platforms) {
      if (p.ceiling || p.look === 'branch' || p.look === 'beam') continue;
      add(p.x + p.w, p.y, 1, 'plat');
      add(p.x, p.y, -1, 'plat');
    }
    this.ledges = L;
  }

  /* x'in hemen ötesinde (side yönünde) basılacak bir yüzey var mı? (köprü, kutu, araba...) */
  surfaceCovers(x, y, side) {
    const tx = x + side * 9;
    const near = (top) => top > y - 14 && top < y + 30;
    for (const g of this.groundSegs) if (tx >= g.x0 && tx <= g.x1 && near(g.y)) return true;
    for (const p of this.platforms) if (!p.ceiling && tx >= p.x && tx <= p.x + p.w && near(p.y)) return true;
    for (const pb of this.pushboxes) if (Math.abs(tx - pb.body.position.x) < pb.w / 2 && near(pb.body.bounds.min.y)) return true;
    return false;
  }

  /* ayağın yakınındaki kenar. lethalOnly: yalnız ölümcül; dirFilter: yalnız o yöne açılan */
  ledgeNear(x, feetY, range, lethalOnly, dirFilter) {
    let best = null, bd = range;
    for (const lg of this.ledges ?? []) {
      if (lethalOnly && !lg.lethal) continue;
      if (dirFilter && lg.side !== dirFilter) continue;
      if (Math.abs(lg.y - feetY) > 14) continue;
      const dist = (lg.x - x) * lg.side;            // + : kenar önümde
      if (dist < -8 || dist > bd) continue;
      if (this.surfaceCovers(lg.x, lg.y, lg.side)) continue;
      bd = dist; best = lg;
    }
    return best;
  }

  /* havadayken tutunma: eller kenar hizasına geldiğinde yakala */
  tryGrabLedge(dt) {
    const P = this.player, body = P.body;
    if (P.hangCD > 0 || Input.crouch || this.rig.actionActive || P.inCar) return;
    const h = P.crouching ? P.hCrouch : P.hStand;
    const top = body.position.y - h / 2;
    /* refleks: zıplamadan kenardan kaydıysa, düştüğü kenarı yakalar */
    if (P.slip) {
      P.slip.t -= dt;
      const lg = P.slip.ledge;
      const past = (body.position.x - lg.x) * lg.side;
      if (P.slip.t <= 0 || past > 70) P.slip = null;
      else if (lg.grab && body.position.y + h / 2 > lg.y + 14 && past > -6) {
        P.slip = null;
        this.startHang(lg, true);
        return;
      }
    }
    const cands = [...(this.ledges ?? [])];
    for (const pb of this.pushboxes) {
      const b = pb.body.bounds;
      cands.push({ x: b.max.x, y: b.min.y, side: 1, grab: true, pb, off: b.max.x - pb.body.position.x });
      cands.push({ x: b.min.x, y: b.min.y, side: -1, grab: true, pb, off: b.min.x - pb.body.position.x });
    }
    /* havada bir kez daha zıpla → uzan: yakında tutunacak kenar varsa (yön, yükseliş fark
       etmez) eller ona atılır. Kenar yoksa hiçbir şey olmaz — çift zıplama yok. */
    if (Input.jumpHit && !P.grounded && P.coyote <= 0 && !P.climbing && !P.swimming && !P.stair) {
      Input.jumpHit = false;
      let best = null, bd = 1e9;
      for (const lg of cands) {
        if (!lg.grab) continue;
        const rel = (body.position.x - lg.x) * lg.side;
        if (rel < -12 || rel > 70) continue;
        if (lg.y < top - 58 || lg.y > top + 50) continue;
        if (!lg.pb && this.surfaceCovers(lg.x, lg.y, lg.side)) continue;
        const d = Math.abs(rel - 14) + Math.abs(lg.y - top) * 0.6;
        if (d < bd) { bd = d; best = lg; }
      }
      if (best) { this.startHang(best, false); return; }
    }
    if (body.velocity.y < -2.5) return;               // yükselişte değil, tepede / düşüşte yakalar
    for (const lg of cands) {
      if (!lg.grab) continue;
      const rel = (body.position.x - lg.x) * lg.side;  // + : oyuncu açık tarafta
      if (rel < 2 || rel > 30) continue;
      if (lg.y < top - 24 || lg.y > top + 26) continue;
      const toward = P.facing === -lg.side || Math.sign(body.velocity.x) === -lg.side;
      if (!toward) continue;
      if (!lg.pb && this.surfaceCovers(lg.x, lg.y, lg.side)) continue;
      this.startHang(lg, false);
      return;
    }
  }

  startHang(lg, reflex) {
    const P = this.player;
    this.setCrouch(false);
    P.hang = { x: lg.x, y: lg.y, side: lg.side, t: 0, pb: lg.pb, off: lg.off };
    P.facing = -lg.side;
    P.slideT = 0; P.rollT = 0; P.slip = null;
    MatterLib.Body.setVelocity(P.body, { x: 0, y: 0 });
    SFAudio.itemHit(this.materialAt(lg.x, lg.y) === 'metal' ? 'metal' : 'wood', reflex ? 0.6 : 0.4);
    SFAudio.land(0.18, P.groundMat);
    if (reflex) this.cameras.main.shake(140, 0.004);
    if (!this._ledgeHinted && this.levelId <= 6) { this._ledgeHinted = true; UI.hint(UI_HINT('ledge'), 3200, '✋'); }
  }

  updateHang(dt, dir) {
    const P = this.player, body = P.body, Hg = P.hang;
    Hg.t += dt;
    if (Hg.pb) {                                      // itme kutusunun kenarı — kutu kayarsa elle birlikte gelir
      const b = Hg.pb.body;
      Hg.x = b.position.x + Hg.off; Hg.y = b.bounds.min.y;
    }
    MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
    MatterLib.Body.setPosition(body, { x: Hg.x + Hg.side * 11, y: Hg.y + 58 });
    P.facing = -Hg.side;
    const up = Input.jumpHit || Input.up || (Input.jump && Hg.t > 0.25) || (dir === -Hg.side && Hg.t > 0.35);
    if (Input.crouch || (Input.crouchPulse ?? 0) > 0) {
      P.hang = null; P.hangCD = 0.45; Input.crouchPulse = 0;
    } else if (dir === Hg.side && Input.jumpHit && Hg.t > 0.15) {
      P.hang = null; P.hangCD = 0.35;               // geriye, boşluğa doğru sıçra
      P.facing = Hg.side; P.jumpedAt = true;
      MatterLib.Body.setVelocity(body, { x: Hg.side * 3.4, y: -8.6 });
      P.launchOK = true;
      SFAudio.jump();
    } else if (up && Hg.t > 0.18) {
      /* üst tarafta baş boşluğu var mı? (tavan/kutu varsa çıkamaz, sarkmaya devam) */
      const bodies = MatterLib.Composite.allBodies(this.matter.world.localWorld);
      const x0 = Math.min(Hg.x - Hg.side * 4, Hg.x - Hg.side * 26), x1 = Math.max(Hg.x - Hg.side * 4, Hg.x - Hg.side * 26);
      const block = MatterLib.Query.region(bodies, { min: { x: x0, y: Hg.y - 56 }, max: { x: x1, y: Hg.y - 6 } })
        .filter(b => b !== body && !b.isSensor && (b.isStatic || b.sfPush) && !b.sfItem);
      if (!block.length) {
        P.mantle = { ...Hg, p: 0, sx: body.position.x, sy: body.position.y };
        P.hang = null;
        body.collisionFilter.mask = 0;              // kenar köşesinden geçerken takılmasın
        SFAudio.itemHit('wood', 0.25);
      }
    }
    Input.jumpHit = false;
  }

  updateMantle(dt) {
    const P = this.player, body = P.body, M = P.mantle;
    M.p = Math.min(1, M.p + dt / 0.62);
    const s = this.rig.s;
    const ex = M.x - M.side * 16 * s, ey = M.y - P.hStand / 2 - 1;
    const ky = smooth(Math.min(1, M.p / 0.72));
    const kx = smooth(clamp((M.p - 0.3) / 0.7, 0, 1));
    MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
    MatterLib.Body.setPosition(body, { x: lerp(M.sx, ex, kx), y: lerp(M.sy, ey, ky) });
    P.facing = -M.side;
    if (M.p >= 1) {
      P.mantle = null;
      body.collisionFilter.mask = CAT.WORLD | CAT.PUSHBOX;
      P.hangCD = 0.3; P.lastVy = 0;
      P.grounded = true; P.wasGrounded = true;
    }
    Input.jumpHit = false;
  }

  /* bölüm 1 açılışı: yarığın dibinde kendine gelme (yazı yok) */
  updateWake(dt) {
    const P = this.player, body = P.body;
    P.wakeT -= dt;
    const el = 4.2 - P.wakeT;
    const gY = body.position.y + P.hStand / 2;
    if (el < 0.05) { this.lights2.darkness = 0.97; this.lights2.setDarkness(this.baseDark, 3000); SFAudio.heartbeat?.(0.5); }
    const pose = el < 2.1 ? 'fallen' : el < 3.3 ? 'kneel' : null;
    this.rig.facing = 1;
    if (pose) {
      this.rig.setPose(pose, el);
      this.rig.update(dt, { x: body.position.x, y: gY - this.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: 1, mode: 'pose', groundY: gY });
    } else {
      this.rig.update(dt, { x: body.position.x, y: gY - this.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: el < 3.8 ? -1 : 1, mode: 'idle', groundY: gY });
    }
    this.playerHalo.x = body.position.x; this.playerHalo.y = body.position.y;
    const cam = this.cameras.main;
    cam.scrollX = lerp(cam.scrollX, body.position.x + 60 - cam.width / 2, 1 - Math.exp(-dt * 3));
    cam.scrollY = lerp(cam.scrollY, body.position.y - cam.height * 0.58, 1 - Math.exp(-dt * 3));
    Input.jumpHit = false; Input.actHit = false;
    if (P.wakeT <= 0) { P.wakeT = 0; UI.showHUD(true); }
  }

  /* ÇUKURLARI GÖRÜNÜR YAP — karanlıkta zemin ile boşluk aynı siyahtı.
     Artık: boşluktan soğuk sis yükselir, kenarı hafif aydınlatır; zemin ucu
     ufalanmış bir dudakla ve sarkan köklerle biter. */
  decoratePits() {
    const pits = [];
    for (const lg of this.ledges) {
      if (!lg.lethal || lg.kind !== 'ground' || lg.side !== 1 || lg.x > this.worldW - 40) continue;
      let x1 = lg.x + 600;
      for (const s of this.groundSegs) if (s.x0 > lg.x + 4 && s.x0 < x1 && s.y < 680) x1 = s.x0;
      pits.push({ x0: lg.x, x1, y: lg.y });
    }
    const lipG = this.add.graphics().setDepth(71);
    const low = !!window.SF_LOWFX;
    /* kör dehlizde çukurlar ışık vermez — yalnız damla sesiyle bulunur */
    const E = this.ch.echo;
    const dark = (x) => !!E && x > E.x0 && x < E.x1;
    for (const p of pits) {
      const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
      if (dark(cx)) continue;
      const mist = this.add.image(cx, p.y + 46, 'fogPuff').setDepth(69)
        .setDisplaySize(w + 70, 150).setTint(0x9aa6b8).setAlpha(0.42).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: mist, alpha: 0.24, duration: 2200 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (!low) {
        this.add.particles(0, 0, 'softDot', {
          x: { min: p.x0 + 6, max: p.x1 - 6 }, y: p.y + 90, lifespan: 3200,
          speedY: { min: -38, max: -16 }, speedX: { min: -6, max: 6 },
          scale: { start: 0.07, end: 0 }, alpha: { start: 0.4, end: 0 }, frequency: 420,
          tint: 0xb8c4d6, blendMode: Phaser.BlendModes.ADD,
        }).setDepth(69);
      }
      this.lights2.addLight({ x: cx, y: p.y + 14, r: clamp(w * 0.55 + 46, 80, 175), type: 'halo', intensity: 0.5 });
      /* kenar dudakları: ufalanmış uç + sarkan kökler + ay ışığı vurmuş ince sırt */
      for (const [ex, sd] of [[p.x0, 1], [p.x1, -1]]) {
        lipG.fillStyle(0x0a0a0e, 1);
        lipG.beginPath();
        lipG.moveTo(ex - sd * 30, p.y - 1);
        lipG.lineTo(ex + sd * 5, p.y - 2);
        lipG.lineTo(ex + sd * 2, p.y + 9);
        lipG.lineTo(ex - sd * 3, p.y + 15);
        lipG.lineTo(ex - sd * 4, p.y + 40);
        lipG.lineTo(ex - sd * 30, p.y + 40);
        lipG.closePath(); lipG.fillPath();
        lipG.lineStyle(1.3, 0x0a0a0e, 1);
        for (let i = 0; i < 4; i++) {
          const rx = ex - sd * (2 + i * 5);
          lipG.beginPath(); lipG.moveTo(rx, p.y + 8);
          lipG.lineTo(rx + sd * (i % 2 ? 3 : -2), p.y + 22 + i * 7);
          lipG.lineTo(rx + sd * (i % 2 ? 1 : 2), p.y + 34 + i * 9);
          lipG.strokePath();
        }
        lipG.lineStyle(1.6, 0x8a93a4, 0.55);
        lipG.beginPath(); lipG.moveTo(ex - sd * 34, p.y - 1); lipG.lineTo(ex + sd * 4, p.y - 2); lipG.strokePath();
      }
    }
    /* diken çukurları: uçlar ışıkta seçilsin */
    for (const sp of (this.ch.spikes ?? [])) {
      const w = sp.x1 - sp.x0;
      if (dark(sp.x0)) continue;
      for (let x = sp.x0 + 60; x < sp.x1; x += 200) {
        this.lights2.addLight({ x: Math.min(x, sp.x1 - 30), y: sp.y - 20, r: Math.min(140, w * 0.5 + 50), type: 'halo', intensity: 0.38 });
      }
    }
    this.pits = pits;
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
      // dokunmatikte şarjör kendiliğinden değişir (tuş yok)
      if (IS_TOUCH && S.mags > 0) { this.startReload(); return; }
      UI.hint(IS_TOUCH ? 'Şarjör yok.' : 'Şarjör boş. [R]', 1400, '◎');
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
    // silah sesi dikkat çeker — duyan herkes sesin geldiği yere döner
    this.makeNoise(P.body.position.x, P.body.position.y, 760, 1);
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
      if (P && !this.dead && !P.inCar && !(P.slideT > 0)) {
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

  /* korku vurgusu: yaratık oyuncuyu ilk fark ettiğinde çığlık + kırmızı nabız
     + kamera yumruğu + kalp atışı. Arka arkaya spam olmasın diye 6 sn bekleme. */
  scare(x, power = 1) {
    if (this.dead || this.cineLock) return;
    const now = this.time.now;
    if (now - (this._lastScare ?? -1e9) < 6000) { SFAudio.monsterRoar(true); return; }
    this._lastScare = now;
    SFAudio.screech?.(power);
    const cam = this.cameras.main;
    cam.shake(520, 0.011 * power);
    const z = this.baseZoom ?? cam.zoom;
    this.tweens.add({ targets: cam, zoom: z * (1 + 0.07 * power), duration: 110, yoyo: true, hold: 160, ease: 'Quad.easeOut' });
    this.fx.scareFlash?.(power);
    for (let i = 0; i < 4; i++) this.time.delayedCall(350 + i * 820, () => SFAudio.heartbeat?.(1 - i * 0.2));
    SFVibrate([60, 40, 120]);
  }

  /* NPC durum işareti — konuşma yok: başın üstünde sözsüz sembol.
     ? şüphe · ! fark etti · … kaybetti. Kırmızı = tehlike. */
  bark(x, y, kind) {
    const sym = { suspicious: '?', alert: '!', hit: '!', lost: '…' }[kind];
    if (!sym) return;
    if (this._barkCount > 3) return;
    this._barkCount = (this._barkCount ?? 0) + 1;
    const urgent = sym === '!';
    const t = this.add.text(x, y, sym, {
      fontFamily: 'Inter, sans-serif', fontSize: urgent ? '22px' : '18px', fontStyle: 'bold',
      color: urgent ? '#c8483a' : '#d6d2c8', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(870).setAlpha(0).setScale(0.4);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, y: y - 8, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, alpha: 0, y: y - 18, delay: urgent ? 1100 : 1500, duration: 500,
      onComplete: () => { t.destroy(); this._barkCount--; },
    });
  }

  /* SES YAYILIMI — koşu adımı, sert iniş, devrilen eşya, silah sesi.
     Menzildeki asker ve yaratıklar sesin geldiği noktaya döner / gider. */
  makeNoise(x, y, radius, power = 0.5) {
    for (const s of this.soldiers) {
      if (!s.dead && Math.abs(s.x - x) < radius) s.hearNoise?.(x, power);
    }
    for (const c of this.creatures) {
      if (!c.dead && Math.abs(c.x - x) < radius * 0.8) c.hearNoise?.(x, power);
      if (!c.dead) creatureHeard(c, x, power, radius);
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
    SFVibrate(amount > 1 ? 70 : 35);
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
    RunStats.deaths++;
    SFMusic.stop(0.6);
    SFAudio.playDeathChord();
    SFVibrate([90, 50, 200]);
    this.rig.action = null;
    this.rig.setVisible(true);
    if (this.player.inVehicle) { this.player.inVehicle.engine?.stop(0.3); this.player.inVehicle = null; this.player.inCar = false; }
    this.rig.startRagdoll(dir * 220 + this.player.body.velocity.x * 30, -180, (x) => this.groundYAt(x));
    this.matter.world.remove(this.player.body);
    this.flashLight.on = false;
    UI.showHUD(false);
    this.time.delayedCall(1700, () => UI.showDeath());
  }

  /* çukura / dikene düştü: son canı değilse son sağlam zemine geri konur */
  fallBack() {
    const P = this.player;
    if (this.hp <= 1 || !P.safe) { this.killPlayer(0); return; }
    this.hp -= 1;
    SFAudio.hurt(); SFVibrate(60);
    UI.updateHP(this.hp, this.hpMax, true);
    this.fx.setLowHp(this.hp <= 1 ? 0.8 : this.hp <= 2 ? 0.35 : 0);
    this.fx.hitFlash(0.4);
    MatterLib.Body.setPosition(P.body, { x: P.safe.x, y: P.safe.y - 4 });
    MatterLib.Body.setVelocity(P.body, { x: 0, y: 0 });
    P.hang = null; P.mantle = null; P.slip = null; P.slideT = 0; P.rollT = 0; P.carryVx = 0;
    this.invulnT = 1.2;
    this.cameras.main.scrollX = P.safe.x + P.facing * 90 - this.cameras.main.width / 2;
  }

  respawn() {
    this.scene.restart({ level: this.levelId, state: { ...this.carry }, spawnX: this.checkpointX });
  }

  /* ---------------- etkileşim ---------------- */
  findInteractable() {
    const P = this.player;
    const px = P.body.position.x, py = P.body.position.y;
    const S = this.state;

    const mt = Missions.findInteractable(this, px, py);
    if (mt) return mt;
    const pt = Puzzles.findInteractable(this, px, py);
    if (pt) return pt;
    /* basamaklı merdivenin dibi */
    for (const s of (this.stairs ?? [])) {
      const feet = py + P.hStand / 2;
      if (Math.abs(px - s.x0) < 34 && Math.abs(feet - s.y0) < 10) return { type: 'stair', obj: s, label: 'MERDİVENİ ÇIK', x: s.x0 + s.dir * 30, y: s.y0 - 96 };
    }
    if (this.scarfItem && Math.abs(this.scarfItem.x - px) < 50) {
      return { type: 'scarf', obj: this.scarfItem, label: 'ATKIYI AL', x: this.scarfItem.x, y: this.scarfItem.y - 26 };
    }
    // 1) alınabilir eşyalar
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
    // 3b) saklama yerleri: çekmece, dolap, kovuk, torpido...
    for (const c of this.containers) {
      if (c.opened) continue;
      const feet = py + P.hStand / 2;
      if (Math.abs(c.x - px) < Math.max(46, c.w / 2 + 22) && c.groundY - feet > -30 && c.groundY - feet < 60) {
        if (c.needsCrowbar) {
          if (this.inv.crowbar) return { type: 'crate', obj: c, label: 'LEVYEYLE ZORLA', x: c.x, y: c.y - c.h / 2 - 12 };
          return { type: 'crate-locked', obj: c, label: 'SIKIŞMIŞ — LEVYE GEREK', x: c.x, y: c.y - c.h / 2 - 12 };
        }
        return { type: 'container', obj: c, label: c.label, x: c.x, y: Math.min(c.y - 18, c.groundY - c.h - 10) };
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
    if (target.type.startsWith('m-')) { Missions.interact(this, target); return; }
    if (target.type === 'p-act') { Puzzles.interact(this, target); return; }
    if (target.type === 'stair') { this.enterStair(target.obj, 0, target.obj.dir); return; }
    switch (target.type) {
      case 'scarf': {
        const sf = target.obj;
        P.mode = 'action';
        this.rig.startAction('pickup', {
          targetX: sf.x, targetY: sf.y - 3,
          onPhase: (ph) => {
            if (ph !== 'grab' || !this.scarfItem) return;
            sf.g.destroy(); this.lights2.removeLight(sf.light);
            this.scarfItem = null;
            this.rig.scarf = true; this.carry.scarf = true;
            SFAudio.pickup();
          },
          onDone: () => { P.mode = 'idle'; },
        });
        break;
      }
      case 'item': {
        const it = target.obj;
        // İNSANSI ALMA: eğil, uzan, kavra, doğrul
        P.mode = 'action';
        this.rig.startAction('pickup', {
          targetX: it.x, targetY: it.y,
          onPhase: (ph) => {
            if (ph !== 'grab' || it.picked) return;
            it.pickupToHand(this.rig.joints.handR?.x ?? it.x, this.rig.joints.handR?.y ?? it.y);
            this.collectItem(it.kind, it);
          },
          onDone: () => { P.mode = 'idle'; },
        });
        break;
      }
      case 'container': {
        const c = target.obj;
        P.mode = 'action';
        const low = c.def.reach === 'low';
        this.rig.startAction(low ? 'pickup' : 'insert', {
          targetX: c.x, targetY: low ? c.groundY - Math.min(c.h, 30) : c.y,
          onPhase: (ph) => { if (ph === 'grab' || ph === 'inserted') c.open(); },
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
        if (res === 'unlocking') { this.inv.key = false; this.syncHUD(); }
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
      case 'crate-locked': SFAudio.thud(0.2); UI.hint('Levye gerekli.', 1500, '✊'); break;
      case 'door-locked': SFAudio.thud(0.25); UI.hint('Anahtar gerekli. Çekmecelere, dolaplara bak.', 1800, '⚿'); break;
      case 'generator-locked': SFAudio.thud(0.2); UI.hint('Pil gerekli.', 1600, '⚡'); break;
    }
  }

  markFound(key) { if (key && this.lootKeys?.has(key)) RunStats.found.add(key); }

  collectItem(kind, item) {
    const S = this.state;
    this.markFound(item?.src);
    if (Missions.collect(this, kind, item)) { this.syncHUD(); return; }
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
          if (!this.flashBlocked && (wasOn || this.lights2.darkness > 0.5)) {
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

    if (this.isIntro) { this.updateIntro(dt, time); return; }
    if (!this.dead && !this.finished && !this.cineLock) RunStats.time += Math.min(deltaMs, 250) / 1000;
    if (!this.player) return;

    const P = this.player;
    const body = P.body;
    const S = this.state;

    for (const it of this.physItems) it.update(dt);
    for (const c of this.containers) c.update(dt);
    for (const pb of this.pushboxes) pb.update(time);
    for (const d of this.doors) { if (d.locked && d.needsKey) d.draw(); }
    for (const lv of this.levers) { if (!lv.pulled) lv.draw(); }
    for (const gn of this.generators) { if (!gn.powered) gn.draw(); }

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

    /* ---- bölüm 1 açılışı: baygın yatıyor → kendine geliyor → doğruluyor ---- */
    if (P.wakeT > 0) { this.updateWake(dt); return; }

    /* ---- görevler (set-piece, yangın, su, dev, bomba, öğretici) ---- */
    Missions.update(this, dt);
    Puzzles.update(this, dt);
    Buildings.update(this, dt);
    if (this.dead) return;
    this.mis?.vehicle?.update(dt);

    /* ---- araç kaçışı (araba / tekne) ---- */
    if (P.inVehicle) {
      const V = P.inVehicle;
      MatterLib.Body.setPosition(body, { x: V.x, y: V.y - 60 });
      MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
      P.crouching = Input.crouch;
      if (Input.fireHit) {
        Input.fireHit = false;
        if (S.gun && S.loaded > 0 && V.pursuer) { S.loaded--; SFAudio.playerShot(); V.hitPursuer(1); this.syncHUD(); }
        else if (S.gun && S.loaded <= 0 && S.mags > 0) { S.mags--; S.loaded = 7; SFAudio.rack(); this.syncHUD(); }
        else SFAudio.dryFire();
      }
      Input.jumpHit = false; Input.actHit = false;
      const cam = this.cameras.main;
      cam.scrollX = lerp(cam.scrollX, V.x + 160 - cam.width / 2, 1 - Math.exp(-dt * 4));
      cam.scrollY = lerp(cam.scrollY, V.y - 60 - cam.height * 0.58, 1 - Math.exp(-dt * 3));
      this.updateBullets(dt);
      this.updateEnemies(dt);
      return;
    }

    /* ---- fener ---- */
    if (Input.flashHit) {
      Input.flashHit = false;
      if (this.flashBlocked) {
        Escapes.echoPulse(this);            // kör dehliz: fener yanmaz, yere vurulur
      } else if (this.flashOn) {
        this.flashOn = false;
        SFAudio.flashClick(false);
      } else if (S.flashBattery > 0) {
        this.flashOn = true;
        SFAudio.flashClick(true);
      } else if (S.batteries > 0) {
        UI.hint(IS_TOUCH ? 'Pil bitti. Karaktere dokun: pil değiştir.' : 'Pil bitti. [E] pil değiştir.', 2200, '✦');
        SFAudio.dryFire();
      } else {
        UI.hint('Pil yok. Alet çantalarına, dolaplara bak.', 2200, '✦');
        SFAudio.dryFire();
      }
    }
    if (this.flashOn) {
      S.flashBattery = Math.max(0, S.flashBattery - dt * (100 / 80));   // ~80 sn / pil
      if (S.flashBattery <= 0) {
        this.flashOn = false;
        SFAudio.flashClick(false);
        if (S.batteries > 0) UI.hint(IS_TOUCH ? 'Pil bitti. Karaktere dokun: pil değiştir.' : 'Pil bitti. [E] pil değiştir.', 2400, '✦');
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
    }).filter(b => b !== body && !b.isSensor && (b.isStatic || b.sfPush));
    P.wasGrounded = P.grounded;
    P.grounded = feet.length > 0 && Math.abs(body.velocity.y) < 6;
    if (P.grounded) P.coyote = 0.1; else P.coyote -= dt;
    /* UÇMA KORUMASI — oyuncu yalnız kendi zıplamasıyla (veya sudan çıkış / kenardan
       geri sıçrayış) hızla yükselebilir. Gövde bir kutu/kapak/çöken parça arasında
       sıkışıp Matter tarafından yukarı fırlatılırsa hız kesilir. */
    if (P.grounded && body.velocity.y > -1) P.launchOK = false;
    if (!P.launchOK && !P.grounded && !P.hang && !P.mantle && !P.climbing && !P.swimming && body.velocity.y < -6.5) {
      MatterLib.Body.setVelocity(body, { x: clamp(body.velocity.x, -4, 4), y: -1 });
    }

    if (P.grounded && !P.wasGrounded && !P.inWater && !P.mantle && !P.hang) {
      const impact = clamp(P.lastVy / 14, 0, 1);
      P.groundMat = this.materialAt(body.position.x, body.position.y + h / 2 + 4);
      /* koşarken sert iniş → omuz üstü yuvarlanma: yükü dağıtır, hız korunur */
      const roll = impact > 0.45 && Math.abs(body.velocity.x) > 2.2 && !P.crouching && !this.rig.actionActive;
      if (roll) {
        P.rollT = 0.52; P.rollDir = Math.sign(body.velocity.x);
        SFAudio.land(impact * 0.6, P.groundMat);
        this.landDust(body.position.x, body.position.y + h / 2, impact * 0.8);
        this.makeNoise(body.position.x, body.position.y, 160 + impact * 120, 0.35);
      } else if (impact > 0.12) {
        this.rig.triggerLand(impact);
        SFAudio.land(impact, P.groundMat);
        if (impact > 0.35) this.makeNoise(body.position.x, body.position.y, 180 + impact * 220, 0.45);
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
    P.lastVy = (P.hang || P.mantle) ? 0 : body.velocity.y;
    /* yerden ayrılış: zıplamadan (yürüyerek/koşarak) kenardan düştüyse refleks tutunma penceresi */
    if (P.wasGrounded && !P.grounded && !P.jumpedAt && !P.hang && !P.mantle) {
      /* gövde kenardan ayrıldığında merkezi çoktan kenarı geçmiş olur — geriye bak */
      const feetY = body.position.y + h / 2;
      for (const lg of this.ledges ?? []) {
        if (!lg.lethal || !lg.grab || Math.abs(lg.y - feetY) > 16) continue;
        const past = (body.position.x - lg.x) * lg.side;
        if (past < -4 || past > 36 || this.surfaceCovers(lg.x, lg.y, lg.side)) continue;
        P.slip = { ledge: lg, t: 0.45 };
        break;
      }
    }
    if (P.grounded) P.jumpedAt = false;
    P.groundMat = this.materialAt(body.position.x, body.position.y + h / 2 + 6);

    /* ---- el merdiveni ---- */
    let onLadder = null;
    for (const lad of this.ladders) {
      if (!lad.climbable) continue;
      if (Math.abs(body.position.x - lad.x) < 30 && body.position.y + h / 2 > lad.topY - 8 && body.position.y - h / 2 < lad.bottomY + 16) {
        onLadder = lad;
      }
    }
    if (!P.climbing && !P.stair && onLadder && (Input.jump || Input.up) && body.position.y + h / 2 - 4 > onLadder.topY) {
      P.climbing = true; P.ladder = onLadder; P.climbVy = 0;
      Input.jumpHit = false;
      this.setCrouch(false);
      MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
    }
    /* tepeden inme: merdivenin başında aşağı */
    if (!P.climbing && !P.stair && !P.mantle && P.grounded && (Input.crouch || (Input.crouchPulse ?? 0) > 0)) {
      for (const lad of this.ladders) {
        if (!lad.climbable || Math.abs(body.position.x - lad.x) > 34 || Math.abs(body.position.y + h / 2 - lad.topY) > 10) continue;
        this.setCrouch(false);
        P.climbing = true; P.ladder = lad; P.climbVy = 0; Input.crouchPulse = 0;
        body.collisionFilter.mask = 0;
        MatterLib.Body.setPosition(body, { x: lad.x, y: lad.topY + P.hStand / 2 + 8 });
        MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
        P.ladderDown = 0.35;
        break;
      }
    }
    if (P.climbing) {
      const lad = P.ladder;
      if (P.ladderDown > 0) { P.ladderDown -= dt; if (P.ladderDown <= 0) body.collisionFilter.mask = CAT.WORLD | CAT.PUSHBOX; }
      if (!lad || (!onLadder && !(P.ladderDown > 0))) { P.climbing = false; body.collisionFilter.mask = CAT.WORLD | CAT.PUSHBOX; }
      else {
        const vy = ((Input.jump || Input.up) ? -118 : 0) + ((Input.crouch || (Input.crouchPulse ?? 0) > 0) ? 132 : 0);
        P.climbVy = vy;
        MatterLib.Body.setVelocity(body, { x: 0, y: 0 });
        MatterLib.Body.setPosition(body, {
          x: lerp(body.position.x, lad.x, 0.3),
          y: Math.min(lad.bottomY - P.hStand / 2, body.position.y + vy * dt),
        });
        /* tepeye varış: kollar kenarı kavrar, gövde yukarı çekilir (kenara çıkış animasyonu) */
        if (vy < 0 && body.position.y <= lad.topY + 30) {
          const exitDir = this.surfaceNear(lad.x + 32, lad.topY) ? 1 : this.surfaceNear(lad.x - 32, lad.topY) ? -1 : 1;
          P.climbing = false; P.climbVy = 0;
          P.mantle = { x: lad.x + exitDir * 14, y: lad.topY, side: -exitDir, p: 0.12, sx: body.position.x, sy: body.position.y };
          body.collisionFilter.mask = 0;
          SFAudio.itemHit('wood', 0.25);
        }
        // tabana iniş
        if (body.position.y + h / 2 >= lad.bottomY - 2 && Input.crouch) P.climbing = false;
        if ((Input.left || Input.right) && Input.jumpHit) { P.climbing = false; Input.jumpHit = false; body.collisionFilter.mask = CAT.WORLD | CAT.PUSHBOX; }
        if (P.climbing && vy !== 0 && (!P._rungT || this.time.now - P._rungT > 260)) { P._rungT = this.time.now; SFAudio.itemHit('wood', 0.12); }
      }
    } else P.climbVy = 0;

    /* ---- hareket ---- */
    let dir = (Input.left ? -1 : 0) + (Input.right ? 1 : 0);
    /* dokunarak hedefe yürüme (eşyaya/kapıya dokununca oraya gider, varınca kullanır) */
    if (P.autoX != null) {
      if (dir !== 0) P.autoX = null;
      else {
        const adx = P.autoX - body.position.x;
        if (Math.abs(adx) > 22) { dir = Math.sign(adx); P.autoRun = Math.abs(adx) > 320; }
        else {
          if (P.autoAct) Input.actHit = true;
          P.autoX = null; P.autoAct = false; P.autoRun = false;
        }
      }
    }
    if (this.panelOpen) dir = 0;

    /* ---- basamaklı merdiven ---- */
    if (!P.stair && !P.climbing && !P.hang && !P.mantle && !this.rig.actionActive) {
      const st = Buildings.stairAt(this, P, dir, h);
      if (st && (st.k === 1 || Input.up || Input.jump || Input.jumpHit)) this.enterStair(st.s, st.k);
    }
    if (P.stair) {
      if (dir === 0 && P.stair.auto) dir = P.stair.auto;
      if (dir !== 0 && dir !== P.stair.auto) P.stair.auto = 0;
      Buildings.updateStair(this, P, dir, dt);
      Input.jumpHit = false;
    }

    /* ---- KENAR: tutunma / yukarı çıkma / refleks yakalama ---- */
    if (P.hangCD > 0) P.hangCD -= dt;
    if (P.mantle) this.updateMantle(dt);
    else if (P.hang) this.updateHang(dt, dir);
    else if (!P.grounded && !P.climbing && !P.swimming && !P.inVehicle && !P.stair) this.tryGrabLedge(dt);
    const onLedge = !!(P.hang || P.mantle);

    if (dir !== 0 && !this.rig.actionActive && !onLedge) P.facing = dir;

    /* ---- yuvarlanma (sert iniş) ---- */
    if (P.rollT > 0) {
      P.rollT -= dt;
      this.setCrouch(true);
      MatterLib.Body.setVelocity(body, { x: P.rollDir * Math.max(1.6, Math.abs(body.velocity.x) * (1 - dt * 1.2)), y: body.velocity.y });
      P.facing = P.rollDir;
      if (P.rollT <= 0) P.rollT = 0;
    }

    /* kayma: koşarken eğil (S / aşağı fırlat) → yerde kayarak alçak engelin altından geç */
    const crouchEdge = (Input.crouch && !P.prevCrouchKey) || (Input.crouchPulse ?? 0) > 0;
    P.prevCrouchKey = Input.crouch;
    if (Input.crouchPulse > 0) Input.crouchPulse -= dt;
    if (crouchEdge && P.grounded && Math.abs(body.velocity.x) > 2.8 && !(P.slideT > 0) && !this.rig.actionActive) {
      P.slideT = 0.62; P.slideDir = Math.sign(body.velocity.x);
      SFAudio.land(0.4, P.groundMat);
      this.landDust(body.position.x, body.position.y + 30, 0.6);
      Input.crouchPulse = 0;
    }
    const slidingNow = P.slideT > 0;
    if (slidingNow) {
      P.slideT -= dt;
      this.setCrouch(true);
      MatterLib.Body.setVelocity(body, { x: P.slideDir * Math.max(1.2, Math.abs(body.velocity.x) * (1 - dt * 1.6)), y: body.velocity.y });
      if (P.slideT <= 0) P.slideT = 0;
    }

    const actionLock = this.rig.actionActive || P.mode === 'pry' || this.panelOpen || P.rollT > 0;

    if (!P.climbing && !onLedge && !P.stair) {
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
          P.launchOK = true;
          inWaterZone.splash(body.position.x, 0.8);
        }
        M.Body.setVelocity(body, { x: clamp(vx, -3.2, 3.2), y: clamp(vy, -4.5, 5) });
        Input.jumpHit = false;
        if (Math.abs(vx) > 1 && Math.random() < dt * 2.2) SFAudio.swimStroke();
        this.setCrouch(false);
      } else {
        // eğilme (aşağı fırlatma kısa bir eğilme darbesi verir)
        const wantCrouch = Input.crouch || (Input.crouchPulse ?? 0) > 0 || slidingNow || P.rollT > 0;
        if (wantCrouch && P.grounded && !actionLock) this.setCrouch(true);
        else if (!wantCrouch) this.setCrouch(false);

        /* GERÇEKÇİ KOŞU İVMESİ:
           - duruştan kalkış yavaş, tam hıza kademeli ulaşır
           - yön değiştirirken önce frenler (kayma hissi)
           - sert inişten sonra kısa toparlanma yavaşlığı */
        const recovering = (P.landRecover ?? 0) > 0;
        /* YÜRÜ / KOŞ: varsayılan yürüyüş. Klavyede [Shift] basılıyken koşar;
           dokunmatikte parmak uzağa kaydırılınca (çapadan ~%72+) koşar. Koşmak ses çıkarır. */
        if (dir !== 0 && dir === P.lastDir) P.holdT = (P.holdT ?? 0) + dt; else P.holdT = 0;
        P.lastDir = dir;
        const wantRun = dir !== 0 && (Input.run || (Input.stick != null && Input.stick >= 0.72) || P.autoRun);
        P.runBlend = lerp(P.runBlend ?? 0, wantRun ? 1 : 0, 1 - Math.exp(-dt * (wantRun ? 3.2 : 6)));
        const baseSpeed = lerp(1.58, 3.85, P.runBlend);   // yürüyüş ≈ 95 px/s (insan ölçüsünde ~1.8 m/sn)
        const maxSpeed = (P.crouching ? 1.1 : baseSpeed) * (recovering ? 0.4 : 1);
        let targetVx = dir * maxSpeed;
        if (actionLock) targetVx = 0;
        /* havada aynı yöne basılıyken sıçrayış hızı korunur (yürüme hızına düşmez) */
        if (!P.grounded && dir !== 0 && Math.sign(body.velocity.x) === dir && Math.abs(body.velocity.x) > Math.abs(targetVx)) targetVx = body.velocity.x;
        const turning = dir !== 0 && Math.sign(body.velocity.x) === -dir && Math.abs(body.velocity.x) > 1;
        /* AĞIRLIK / MOMENTUM — ivme artık kare-hızından BAĞIMSIZ (dt tabanlı),
           kütle his verir: duruştan kalkış kademeli, durunca momentumla hafif
           süzülür, yön değişiminde önce frenler. Havada momentum büyük ölçüde korunur. */
        let rate;
        if (!P.grounded) rate = 6;                           // havada yönlendirilebilir — boşluklar kenardan atlanabilsin
        else if (turning) rate = 9.5;                        // fren + dönüş — ayak kaydırır
        else if (dir !== 0) rate = 11;                       // kalkış — kütleyi hızlandırmak zaman alır
        else rate = 13;                                      // durunca biraz süzülür (buz gibi değil)
        let newVx = lerp(body.velocity.x, targetVx, 1 - Math.exp(-rate * dt));

        /* UÇURUM KENARINDA DUR — yürürken (koşmuyorken) insan karanlıkta boşluğa
           adım atmaz: kenarda durur, sendeler. Geçmek için bilerek zıplamak gerekir.
           Koşarken durmaz; ama zıplamadan düşerse refleksle kenara tutunur. */
        P.teeter = 0;
        if (P.grounded && !slidingNow && !(P.rollT > 0)) {
          const feetY = body.position.y + h / 2;
          const mv = Math.sign(newVx) || P.facing;
          const lg = this.ledgeNear(body.position.x, feetY, 30, true, mv);
          if (lg) {
            const dist = (lg.x - body.position.x) * lg.side;      // kenara kalan mesafe (+ = önünde)
            const walking = (P.runBlend ?? 0) < 0.55 && !P.autoRun;
            if (walking && dist < 13 && Math.sign(newVx) === lg.side) {
              newVx = 0;
              if (dist < 10) MatterLib.Body.setPosition(body, { x: lg.x - lg.side * 10, y: body.position.y });
            }
            if (dist < 16 && P.facing === lg.side && Math.abs(newVx) < 0.6 && !P.crouching) {
              P.teeter = lg.side; P.teeterX = lg.x;
              if (!this._edgeHinted && this.levelId <= 3) { this._edgeHinted = true; UI.hint(UI_HINT('edge'), 2600, '⚠'); }
            }
          }
        }
        if (!slidingNow && !(P.rollT > 0)) MatterLib.Body.setVelocity(body, { x: newVx, y: body.velocity.y });

        /* GERÇEK SIÇRAYIŞ: yerinden sıçrarken insan önce çömelir, kollarını geri
           atar, sonra iter (~0.09 sn hazırlık). Koşarken sıçrama hazırlıksız olur. */
        if (Input.jumpHit && P.coyote > 0 && !P.crouching && !actionLock && !recovering && !(P.jumpPrep > 0)) {
          if (Math.abs(body.velocity.x) < 1.6 && P.grounded) { P.jumpPrep = 0.09; this.rig.prepT = 0.09; }
          else P.jumpNow = true;
        }
        if (P.jumpPrep > 0) {
          P.jumpPrep -= dt;
          if (P.jumpPrep <= 0) { P.jumpPrep = 0; if (P.grounded || P.coyote > 0) P.jumpNow = true; }
        }
        if (P.jumpNow) {
          P.jumpNow = false;
          const runBoost = Math.abs(body.velocity.x) * 0.22;
          /* yön basılıyken sıçrayış ileri atar: kenarda durup atlayan da ~200px boşluğu geçer */
          const jdir = (Input.left ? -1 : 0) + (Input.right ? 1 : 0) || (P.teeter ? P.teeter : 0);
          const jvx = jdir ? jdir * Math.max(Math.abs(body.velocity.x) * (Math.sign(body.velocity.x) === jdir ? 1 : 0), 4.9) : body.velocity.x;
          MatterLib.Body.setVelocity(body, { x: jvx, y: -11.8 - runBoost });
          P.launchOK = true;
          P.coyote = 0;
          P.jumpedAt = true; P.slip = null;
          P.jumpCutDone = false;
          this.rig.prepT = 0;
          P.jumpGrace = 0.1;           // hazırlık sırasında tuş bırakıldıysa sıçrama yarıda kesilmesin
          SFAudio.jump();
        }
        if (P.jumpGrace > 0) P.jumpGrace -= dt;
        Input.jumpHit = false;

        /* değişken zıplama: tuş erken bırakılırsa yükseliş kesilir */
        if (!P.grounded && !Input.jump && !(P.jumpGrace > 0) && body.velocity.y < -3 && !P.jumpCutDone) {
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

    /* ---- kutuyu tutma (basılı tut / [E] basılı): it VE çek ---- */
    P.grabbing = null;
    if ((Input.grab || Input.act) && P.grounded && !P.crouching && !P.swimming && !this.rig.actionActive) {
      for (const pb of this.pushboxes) {
        const bdx = pb.body.position.x - body.position.x;
        if (Math.abs(bdx) < pb.w / 2 + 30 && Math.abs(pb.body.position.y - body.position.y) < pb.h / 2 + 8) { P.grabbing = pb; P.grabSide = Math.sign(bdx); break; }
      }
      if (P.grabbing) {
        const vx = clamp(body.velocity.x, -1.5, 1.5);
        MatterLib.Body.setVelocity(body, { x: vx, y: body.velocity.y });
        MatterLib.Body.setVelocity(P.grabbing.body, { x: vx, y: P.grabbing.body.velocity.y });
        P.facing = P.grabSide;
      }
    }
    P.pushing = false;

    /* ---- itme tespiti ---- */
    let pushing = !!P.grabbing && Math.abs(body.velocity.x) > 0.2;
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
    P.pushing = pushing;

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
    this._lastTarget = target;
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

    /* ---- son sağlam zemin: çukura düşünce buraya dönülür ---- */
    if (P.grounded && !P.hang && !P.mantle && !P.inVehicle) {
      const fy = body.position.y + h / 2;
      const lethalNear = (this.ledges ?? []).some(l => l.lethal && Math.abs(l.y - fy) < 14 && Math.abs(l.x - body.position.x) < 40);
      if (!lethalNear && this.groundSegs.some(g => body.position.x > g.x0 + 30 && body.position.x < g.x1 - 30 && Math.abs(g.y - fy) < 6)) P.safe = { x: body.position.x, y: body.position.y };
    }
    /* ---- dikenler / çukur: anında ölüm yok — 1 can gider, son sağlam zemine dönersin ---- */
    let fell = body.position.y > KILL_Y;
    for (const sp of (this.ch.spikes ?? [])) {
      if (onLedge) break;
      if (body.position.x > sp.x0 - 4 && body.position.x < sp.x1 + 4 && body.position.y + h / 2 > sp.y - 18) fell = true;
    }
    if (fell) { this.fallBack(); return; }

    /* ---- düşmanlar ---- */
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePlayerBullets(dt);

    /* ---- atkı ---- */
    if (this.scarfItem) this.scarfItem.g.setAlpha(0.85 + Math.sin(time * 0.003) * 0.15);

    /* ---- tetikler ---- */
    for (const t of this.triggers) {
      if (t.fired) continue;
      if (Math.abs(body.position.x - t.x) < 70) {
        t.fired = true;
        if (t.text) UI.hint(t.text, 3800, t.icon ?? '•');
      }
    }
    for (const cp of (this.ch.checkpoints ?? [])) {
      if (body.position.x > cp && cp > this.checkpointX && this.groundYAt(cp) < KILL_Y) this.checkpointX = cp;
    }
    for (const m of this.cpMarks ?? []) if (!m.lit && m.x <= this.checkpointX) this.lightCheckpoint(m, true);

    /* ---- bölüm sonu ---- */
    if (body.position.x > this.ch.exitX && !this.finished && !this.cineLock) {
      if (this.ch.endCine) this.startEndCine(this.ch.endCine);
      else this.completeChapter();
    }

    /* ---- rig ---- */
    let mode = 'idle';
    if (this.rig.actionActive) mode = this.rig.mode; // action çizimi draw() içinde önceliğe sahip
    else if (P.stair) mode = 'stairs';
    else if (P.mantle) mode = 'mantle';
    else if (P.hang) mode = 'hang';
    else if (P.rollT > 0) mode = 'roll';
    else if (P.mode === 'pry') mode = 'pry';
    else if (P.climbing) mode = 'climb';
    else if (P.swimming) mode = 'swim';
    else if (!P.grounded && P.coyote <= 0) mode = 'air';
    else if (P.slideT > 0) mode = 'slide';
    else if (P.crouching) mode = 'crawl';
    else if (pushing) mode = 'push';
    else if (P.teeter) mode = 'teeter';
    else if (Math.abs(body.velocity.x) > 0.25) mode = 'move';

    const bodyBottom = body.position.y + h / 2;
    const LG = P.mantle ?? P.hang;
    this.rig.update(dt, {
      x: body.position.x,
      y: P.swimming ? body.position.y : bodyBottom - this.rig.A.standH,
      vx: P.stair ? (P.stair.v ?? 0) * P.stair.s.dir : body.velocity.x * 60,
      vy: P.climbing ? P.climbVy : body.velocity.y * 60,
      grounded: P.grounded || P.coyote > 0 || !!P.stair,
      facing: P.facing, crouch: false,
      mode, groundY: bodyBottom,
      ledge: LG ? { x: LG.x, y: LG.y, side: LG.side } : null,
      mantleP: P.mantle ? P.mantle.p : 0,
      rollP: P.rollT > 0 ? 1 - P.rollT / 0.52 : 0,
      edgeX: P.teeter ? P.teeterX : null,
      stair: P.stair ? P.stair.s : null,
    });

    this.updateFlashBeam();

    /* ---- kamera ---- */
    const cam = this.cameras.main;
    const lookAhead = P.facing * 90;
    const tgt = Buildings.clampCamera(this, body.position.x + lookAhead - cam.width / 2, clamp(body.position.y - cam.height * 0.58, -200, WORLD_H - cam.height + 100));
    cam.scrollX = lerp(cam.scrollX, tgt.x, 1 - Math.exp(-dt * 3.2));
    cam.scrollY = lerp(cam.scrollY, tgt.y, 1 - Math.exp(-dt * 2.6));
  }

  updateEnemies(dt) {
    const P = this.player;
    const playerProxy = {
      x: P.body.position.x, y: P.body.position.y, vx: P.body.velocity.x,
      crouching: P.crouching, hidden: P.hidden || P.inCar, flashOn: this.flashOn,
      noisy: P.grounded && Math.abs(P.body.velocity.x) > 3.1 && !P.crouching,   // koşu adımları duyulur
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
      if (c.dead) continue;
      if (['chase', 'strike', 'charge', 'lunge', 'hunt', 'smash', 'recover', 'bite'].includes(c.state)) tension = Math.max(tension, 1);
      else if (['alert', 'stare', 'rear', 'stun', 'wake', 'cool'].includes(c.state)) tension = Math.max(tension, 0.7);
    }
    const tens = this.cineLock ? 0 : tension;
    SFAudio.setTension(tens);
    this.musicTick(tens);
  }

  /* sahnenin gidişatı → müzik: araç, bomba, kaçış (yangın / su / dev / kovalamaca /
     çöken köprü), aksiyon (seni kovalayan / ateş eden), gizlilik (şüphelenen),
     bulmaca başında, bina içinde, yoksa perdenin keşif teması */
  musicTick(tens) {
    if (this.cineLock || this.dead || this.finished) return;
    const M = this.mis ?? {}, P = this.player;
    const now = this.time.now / 1000;
    let st = 'explore';
    const px = P.body.position.x;
    const fireOn = M.fire?.active && !M.fire.over && Math.abs((M.fire.cells ?? []).reduce((m, c) => c.st === 1 ? Math.max(m, c.x) : m, -1e9) - px) < 900;
    const floodOn = M.flood?.burst && !M.flood.safe;
    const chaseOn = (M.chases ?? []).some(c => c.fired && !c.done);
    const collapseOn = (M.collapses ?? []).some(c => c.fired && now - (c._firedAt ?? (c._firedAt = now)) < 4);
    if (P.inVehicle || P.inCar) st = 'vehicle';
    else if (M.bomb && !M.bomb.done && !M.bomb.exploded) st = 'bomb';
    else if (fireOn || floodOn || M.colossus?.active || chaseOn || collapseOn || Escapes.escaping(this)) st = 'escape';
    else if (tens >= 0.85) st = 'action';
    else if (tens >= 0.45 || M.echo?.inside) st = 'stealth';
    else if ((this.pz ?? []).some(p => !(p.raised || p.done || p.solved) && Math.abs(px - (p.hintX ?? p.x0 ?? 0) - 250) < 420)) st = 'puzzle';
    else if (this.inBld || this.ch.interior) st = 'interior';
    SFMusic.setIntensity(tens);
    SFMusic.setScene(st, this.ch.biome, now);
  }

  completeChapter() {
    this.finished = true;
    const nextState = {
      scarf: true,
      crowbar: this.inv.crowbar,
      bandages: this.state.bandages,
      gun: this.state.gun, loaded: this.state.loaded, mags: this.state.mags,
      flashBattery: this.state.flashBattery, batteries: this.state.batteries,
    };
    SaveGame.unlock(this.levelId + 1);
    SaveGame.setCurrent(this.levelId + 1, nextState);
    SFMusic.stop(1.8);
    SFAudio.playHopeMotif();
    SFAudio.setTension(0);
    UI.showHUD(false);
    UI.fadeOut(2000);
    this.time.delayedCall(2300, () => {
      if (this.levelId + 1 <= LEVEL_COUNT) {
        UI.showSummary(this.ch, {
          time: RunStats.time, deaths: RunStats.deaths,
          found: RunStats.found.size, total: this.lootKeys?.size ?? 0,
        }, () => this.scene.restart({ level: this.levelId + 1, state: nextState }));
      } else {
        UI.showEndCard();
      }
    });
  }

  /* ============================================================
     BÖLÜM SONU SİNEMATİKLERİ (kaçırılma / kule / final)
     ============================================================ */
  startEndCine(kind, opts = {}) {
    this.cineLock = true;
    SFMusic.stop(2.5);
    document.body.classList.add('cine');
    UI.showHUD(false);
    UI.showSkip(true);
    const P = this.player;
    MatterLib.Body.setVelocity(P.body, { x: 0, y: 0 });
    const gY = this.groundYAt(P.body.position.x);
    const px = P.body.position.x;
    this.cine = { t: 0, step: 0, kind, actors: {}, timeline: [], gY, px };
    const C = this.cine;
    UI.showTutorial(null);
    const camT = px + 90 - this.cameras.main.width / 2;
    if (Math.abs(this.cameras.main.scrollX - camT) > 600) this.cameras.main.scrollX = camT;

    if (kind === 'final') {
      /* SON BÖLÜM — Maria yarığın en dibinde, ışığın önünde diz çökmüş.
         Sözsüz: Maria koşup sarılır, ışık her şeyi kaplar. */
      C.actors.maria = { rig: new HumanRig(this, { scale: 0.88, depth: 99, variant: 'maria' }), x: px + 420, facing: -1, vx: 0, pose: 'kneel', visible: true };
      this.gateLight = this.lights2.addLight({ x: px + 700, y: gY - 200, r: 120, type: 'halo', intensity: 0.6 });
      C.timeline = [
        { t: 1.6, fn: () => {
            this.tweens.add({ targets: this.gateLight, r: 700, intensity: 1.4, duration: 9000 });
            this.lights2.setDarkness(0.25, 6000);
        }},
        { t: 3.2, fn: () => { C.actors.maria.pose = 'standSad'; } },
        { t: 4.4, fn: () => { C.actors.maria.pose = null; C.actors.maria.vx = -120; C.actors.maria.facing = -1; } },
        { t: 7.0, fn: () => { C.actors.maria.vx = 0; C.actors.maria.pose = 'hug'; C.kaiPose = 'hug'; SFAudio.playHopeMotif(); } },
        { t: 15.5, fn: () => { this.fx.flash.setFillStyle?.(0xE8E4DC); this.tweens.add({ targets: this.fx.flash, alpha: 1, duration: 4200 }); } },
        { t: 20.0, fn: () => UI.showEnding() },
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
    /* kai (bomba bölümünde oyuncu Maria'dır; rig'i aynı şekilde çizilir) */
    const P = this.player;
    if (C.kaiVx) {
      const nx = P.body.position.x + C.kaiVx * dt;
      if (nx >= C.kaiStop) { MatterLib.Body.setPosition(P.body, { x: C.kaiStop, y: P.body.position.y }); C.kaiVx = 0; }
      else MatterLib.Body.setPosition(P.body, { x: nx, y: P.body.position.y });
      this.rig.update(dt, { x: P.body.position.x, y: gY - this.rig.A.standH, vx: C.kaiVx || 0, vy: 0, grounded: true, facing: 1, mode: C.kaiVx ? 'move' : 'idle', groundY: gY });
    } else if (C.kaiPose) {
      this.rig.facing = 1;
      this.rig.setPose(C.kaiPose, C.t);
      this.rig.update(dt, { x: P.body.position.x, y: gY - this.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: 1, mode: 'pose', groundY: gY });
    } else {
      this.rig.update(dt, { x: P.body.position.x, y: gY - this.rig.A.standH, vx: 0, vy: 0, grounded: true, facing: 1, mode: 'idle', groundY: gY });
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
    const PIT0 = 520, PIT1 = 615;
    this.pit = { x0: PIT0, x1: PIT1 };

    /* yarığın altı: zifiri boşluk + yükselen soğuk toz (sahne başında toprak kütlesinin arkasında gizli) */
    const abyss = this.add.graphics().setDepth(69);
    abyss.fillStyle(0x020203, 1);
    abyss.fillRect(PIT0 - 2, gY + 2, PIT1 - PIT0 + 4, 1400);

    /* ortadaki toprak kütlesi — depremde çatlayıp düşer */
    const slab = this.add.graphics().setDepth(70);
    const W = PIT1 - PIT0;
    slab.fillStyle(0x0a0a0e, 1);
    slab.beginPath();
    slab.moveTo(0, 0);
    for (let x = 0; x <= W; x += 13) slab.lineTo(x, (Math.sin(x * 0.7) * 2.4));
    slab.lineTo(W, 70); slab.lineTo(W * 0.7, 96); slab.lineTo(W * 0.35, 84); slab.lineTo(0, 104);
    slab.closePath(); slab.fillPath();
    slab.lineStyle(1.6, 0x0a0a0e, 1);
    for (let x = 6; x < W; x += 11) { slab.beginPath(); slab.moveTo(x, 1); slab.lineTo(x + (x % 3) - 1, -6 - (x % 5)); slab.strokePath(); }
    slab.setPosition(PIT0, gY);
    this.slab = slab;

    /* çatlak — sarsıntıyla büyüyen soluk yarık çizgisi */
    this.crackG = this.add.graphics().setDepth(72);
    this.crackP = 0;
    this.crackPts = [];
    for (let i = 0; i <= 8; i++) this.crackPts.push({ x: PIT0 + 4 + (W - 8) * (i / 8) + (i % 2 ? 5 : -4), y: gY + 1 + (i % 3) * 2 });

    this.kai = new HumanRig(this, { scale: 0.94, depth: 100, variant: 'kai' });
    this.mariaRig = new HumanRig(this, { scale: 0.88, depth: 99, variant: 'maria' });

    this.actors = {
      kai: { x: 170, y: gY, vx: 62, vy: 0, facing: 1, visible: true, pose: null, falling: false },
      maria: { x: 250, y: gY, vx: 64, vy: 0, facing: 1, visible: true, pose: null, falling: false },
    };

    this.fogOverlay = this.add.rectangle(0, 0, 4000, 3000, 0x9aa0ad, 0).setDepth(200).setOrigin(0);

    this.introT = 0;
    this.introStep = 0;
    this.skipHold = 0;

    SFAudio.playIntroTheme();
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 30;
    this.cameras.main.setZoom(1.5);

    const A = this.actors;
    const debris = (n) => {
      const p = this.add.particles(0, 0, 'softDot', {
        x: { min: PIT0, max: PIT1 }, y: gY, speedY: { min: -140, max: -30 }, speedX: { min: -90, max: 90 },
        lifespan: 900, gravityY: 700, scale: { start: 0.12, end: 0.02 }, alpha: { start: 0.6, end: 0 },
        tint: 0x5e5a52, emitting: false,
      }).setDepth(73);
      p.explode(n);
      this.time.delayedCall(1200, () => p.destroy());
    };
    this.introTimeline = [
      /* ilk sarsıntı — ikisi de durur, etrafa bakar */
      { t: 4.6, fn: () => {
          SFAudio.rumble?.(1.4, 0.45);
          this.cameras.main.shake(700, 0.003);
          A.kai.vx = 0; A.maria.vx = 0;
          A.maria.facing = -1; A.maria.pose = 'scared'; A.kai.pose = 'scared';
      }},
      /* asıl deprem — çatlak açılır, toprak kütlesi Maria'yla birlikte çöker */
      { t: 6.8, fn: () => {
          SFAudio.rumble?.(3.2, 0.95);
          SFAudio.explosion?.(0.35);
          this.cameras.main.shake(2600, 0.012);
          this.tweens.add({ targets: this, crackP: 1, duration: 1100, ease: 'Quad.easeIn' });
          debris(10);
      }},
      { t: 7.4, fn: () => { A.kai.pose = null; A.kai.facing = 1; } },
      { t: 8.0, fn: () => {
          debris(24);
          this.crackG.clear();
          /* açılan yarık: dipten soğuk sis yükselir — karanlıkta boşluk okunur */
          const mist = this.add.image((PIT0 + PIT1) / 2, gY + 50, 'fogPuff').setDepth(69)
            .setDisplaySize(W + 80, 170).setTint(0x9aa6b8).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: mist, alpha: 0.45, duration: 900 });
          this.lights2.addLight({ x: (PIT0 + PIT1) / 2, y: gY + 14, r: 120, type: 'halo', intensity: 0.55 });
          this.add.particles(0, 0, 'softDot', {
            x: { min: PIT0 + 6, max: PIT1 - 6 }, y: gY + 90, lifespan: 3000,
            speedY: { min: -40, max: -16 }, scale: { start: 0.07, end: 0 }, alpha: { start: 0.45, end: 0 },
            frequency: 220, tint: 0xb8c4d6, blendMode: Phaser.BlendModes.ADD,
          }).setDepth(69);
          this.tweens.add({ targets: this.slab, y: gY + 620, angle: 24, duration: 1300, ease: 'Quad.easeIn' });
          A.maria.pose = null; A.maria.falling = true; A.maria.vy = -40; A.maria.facing = 1;
      }},
      { t: 9.3, fn: () => { A.maria.visible = false; } },
      { t: 9.4, fn: () => { A.kai.vx = 230; A.kai.facing = 1; A.kai.stopAt = PIT0 - 26; } },
      { t: 10.3, fn: () => { A.kai.pose = 'peerDown'; } },
      { t: 12.4, fn: () => {
          A.kai.pose = null; A.kai.falling = true; A.kai.vx = 70; A.kai.vy = -330;
          SFAudio.jump();
      }},
      { t: 13.3, fn: () => {
          this.fogOverlay.fillColor = 0x010103;
          this.tweens.add({ targets: this.fogOverlay, fillAlpha: 1, duration: 700 });
      }},
      { t: 20.2, fn: () => this.endIntro() },
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
    /* çatlak: soldan sağa büyür, kenarlarından toz ışığı sızar */
    if (this.crackP > 0 && this.crackP < 1 && this.slab.y < gY + 5) {
      const cg = this.crackG, pts = this.crackPts;
      const n = Math.max(1, Math.floor(this.crackP * (pts.length - 1)));
      cg.clear();
      cg.lineStyle(3.2, 0x020203, 1);
      cg.beginPath(); cg.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= n; i++) cg.lineTo(pts[i].x, pts[i].y);
      cg.strokePath();
      cg.lineStyle(1, 0x8a93a4, 0.6);
      cg.beginPath(); cg.moveTo(pts[0].x, pts[0].y - 2);
      for (let i = 1; i <= n; i++) cg.lineTo(pts[i].x, pts[i].y - 2);
      cg.strokePath();
    }
    for (const key of ['kai', 'maria']) {
      const a = this.actors[key];
      a.x += (a.vx ?? 0) * dt;
      if (a.stopAt != null && a.x >= a.stopAt) { a.x = a.stopAt; a.vx = 0; a.stopAt = null; }
      const rig = key === 'kai' ? this.kai : this.mariaRig;
      rig.setVisible(a.visible);
      if (!a.visible) continue;
      if (a.falling) {
        a.vy += 1300 * dt;
        a.y += a.vy * dt;
        a.vx *= 0.99;
        rig.update(dt, { x: a.x, y: a.y - rig.A.standH, vx: a.vx, vy: a.vy, grounded: false, facing: a.facing, mode: 'air', groundY: a.y + 400 });
        continue;
      }
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
    const k = this.actors.kai;
    const focusX = k.falling ? k.x : (this.introT > 5 && this.introT < 9.5 ? (k.x + this.actors.maria.x) / 2 : k.x + 60);
    cam.scrollX = lerp(cam.scrollX, focusX - cam.width / 2, 1 - Math.exp(-dt * 1.6));
    const focusY = k.falling ? Math.min(k.y - 75, gY + 260) : gY - 75;
    cam.scrollY = lerp(cam.scrollY, focusY - cam.height / 2, 1 - Math.exp(-dt * (k.falling ? 4 : 1.2)));
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
    $('m-privacy').onclick = () => { this.hide('menu'); this.show('privacy-panel'); };
    $('privacy-back').onclick = () => { this.hide('privacy-panel'); this.show('menu'); };

    /* ayarlar: kaydedilen değerlerle açılır, her değişiklikte kaydedilir */
    $('opt-vol').value = SF_SETTINGS.vol * 100;
    $('opt-music').value = SF_SETTINGS.music * 100;
    $('opt-grain').value = SF_SETTINGS.grain * 100;
    $('opt-sens').value = SF_SETTINGS.sens * 100;
    const vibeLabel = () => { $('opt-vibe').textContent = SF_SETTINGS.vibe ? 'AÇIK' : 'KAPALI'; $('opt-vibe').classList.toggle('off', !SF_SETTINGS.vibe); };
    vibeLabel();
    $('opt-vol').oninput = (e) => { SF_SETTINGS.vol = e.target.value / 100; SFAudio.setVol(SF_SETTINGS.vol, SF_SETTINGS.music); saveSettings(); };
    $('opt-music').oninput = (e) => { SF_SETTINGS.music = e.target.value / 100; SFAudio.setVol(SF_SETTINGS.vol, SF_SETTINGS.music); saveSettings(); };
    $('opt-grain').oninput = (e) => { SF_SETTINGS.grain = e.target.value / 100; saveSettings(); };
    $('opt-sens').oninput = (e) => { SF_SETTINGS.sens = e.target.value / 100; saveSettings(); };
    $('opt-vibe').onclick = () => { SF_SETTINGS.vibe = !SF_SETTINGS.vibe; vibeLabel(); saveSettings(); SFVibrate(30); };

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
      ShiftLeft: 'run', ShiftRight: 'run',
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

    /* ============================================================
       DOKUNMATİK JEST KONTROLÜ — joystick yok, tuş yok:
       • parmağı yatay kaydır → o yöne yürü; uzağa kaydır → koş
       • yukarı fırlat → zıpla (parmak kalırsa daha yükseğe)
       • aşağı fırlat → eğil / koşarken kay;  aşağıda tut → eğik yürü
       • dokun → eşyaya/kapıya/kola: oraya yürü ve kullan;
                 düşmana: ateş;  karaktere: fener
       • basılı tut → levyeyle kutu aç / kutuyu tutup it-çek
       ============================================================ */
    const layer = this.el('touch-layer'), trail = this.el('touch-trail'), anchorEl = this.el('touch-anchor');
    const pts = new Map();
    let movePid = null;
    const placeTrail = (x, y) => { trail.style.left = x + 'px'; trail.style.top = y + 'px'; };
    const releaseMove = () => {
      Input.left = Input.right = false; Input.stick = null; Input.crouch = false; Input.up = false;
      movePid = null; anchorEl.classList.remove('on');
    };
    layer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { layer.setPointerCapture(e.pointerId); } catch (_) {}
      const now = performance.now();
      const p = { sx: e.clientX, sy: e.clientY, ax: e.clientX, ay: e.clientY, x: e.clientX, y: e.clientY, t0: now, hist: [{ x: e.clientX, y: e.clientY, t: now }], role: null, moved: false, jumpLock: false };
      p.holdTimer = setTimeout(() => {
        if (p.moved || p.role) return;
        p.role = 'hold';
        Input.act = true; Input.grab = true;
        trail.classList.add('hold');
        this.scene()?.handleHold?.(p.x, p.y);
        SFVibrate(15);
      }, 300);
      pts.set(e.pointerId, p);
      placeTrail(e.clientX, e.clientY); trail.classList.add('on');
    });
    layer.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      e.preventDefault();
      const now = performance.now();
      p.x = e.clientX; p.y = e.clientY;
      p.hist.push({ x: p.x, y: p.y, t: now });
      // yalnız son ~120 ms'lik hareket — parmak bir süre durduysa eski nokta hızı bozmasın
      while (p.hist.length > 1 && now - p.hist[0].t > 200) p.hist.shift();
      if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > 14) { p.moved = true; if (p.role !== 'hold') clearTimeout(p.holdTimer); }
      placeTrail(p.x, p.y);
      const old = p.hist.length > 1 ? p.hist[0] : p.hist[p.hist.length - 1], dtm = Math.max(16, now - old.t);
      const vy = (p.y - old.y) / dtm * 1000;
      /* hassasiyet: yüksekse daha kısa / yavaş bir fırlatma ve kaydırma yeter */
      const k = clamp(SF_SETTINGS.sens ?? 1, 0.5, 1.5);
      const vFast = 600 / k, vSlow = 280 / k, dShort = 28 / k, dLong = 58 / k;
      /* yukarı fırlatma = zıpla */
      if (((vy < -vFast && old.y - p.y > dShort) || (vy < -vSlow && old.y - p.y > dLong)) && !p.jumpLock) {
        p.jumpLock = true;
        Input.jumpHit = true; Input.jump = true;
        clearTimeout(p.jumpRel);
        p.jumpRel = setTimeout(() => { Input.jump = false; }, 340);
        p.ay = p.y;
        this.scene()?.cancelAutoWalk?.();
      } else if (vy > -200) p.jumpLock = false;
      /* aşağı fırlatma = eğil / kay */
      if (((vy > vFast && p.y - old.y > dShort) || (vy > vSlow && p.y - old.y > dLong)) && !p.downLock) {
        p.downLock = true;
        Input.crouchPulse = 0.4;
        p.ay = p.y;
      } else if (vy < 200) p.downLock = false;
      /* yatay kaydırma = yürü / koş */
      const dx = p.x - p.ax;
      if ((movePid === null || movePid === e.pointerId) && Math.abs(dx) > 16 / k && p.role !== 'tapOnly') {
        if (movePid === null) { movePid = e.pointerId; if (p.role !== 'hold') p.role = 'move'; this.scene()?.cancelAutoWalk?.(); }
      }
      if (movePid === e.pointerId) {
        const R = 120 / k;
        if (Math.abs(dx) > R * 1.25) p.ax = p.x - Math.sign(dx) * R * 1.25;     // çapa parmağı izler → anında geri dönüş
        const ndx = (p.x - p.ax) / R;
        Input.left = ndx < -0.13; Input.right = ndx > 0.13;
        Input.stick = (Input.left || Input.right) ? clamp(Math.abs(ndx), 0, 1) : null;
        Input.crouch = (p.y - p.ay) > 60 / k;
        Input.up = (p.ay - p.y) > 60 / k;
        anchorEl.style.left = p.ax + 'px'; anchorEl.style.top = p.ay + 'px'; anchorEl.classList.add('on');
      }
    });
    const endPt = (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      clearTimeout(p.holdTimer);
      const dur = performance.now() - p.t0;
      if (!p.moved && !p.role && dur < 280) {
        const r = document.createElement('div'); r.className = 'tap-ring';
        r.style.left = p.x + 'px'; r.style.top = p.y + 'px'; document.body.appendChild(r);
        setTimeout(() => r.remove(), 500);
        this.scene()?.handleTap?.(p.x, p.y);
      }
      if (p.role === 'hold') { Input.act = false; Input.grab = false; trail.classList.remove('hold'); }
      if (movePid === e.pointerId) releaseMove();
      pts.delete(e.pointerId);
      if (!pts.size) trail.classList.remove('on');
    };
    layer.addEventListener('pointerup', endPt);
    layer.addEventListener('pointercancel', endPt);
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { releaseMove(); pts.clear(); Input.jump = Input.act = Input.grab = false; }
    });
    /* HUD çiplerine dokunma: bandaj = sar, fener = aç/kapa, mermi = şarjör */
    const chipTap = (id, hit) => {
      const el = this.el(id); if (!el) return;
      el.classList.add('tappable');
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Input[hit] = true; });
    };
    chipTap('cnt-bandage', 'healHit');
    chipTap('battery-box', 'flashHit');
    chipTap('ammo-box', 'reloadHit');

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
    /* mobilde tam ekran + yatay kilit (destekleyen tarayıcılarda) */
    if (this.isTouch && !document.fullscreenElement) {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      try {
        const pr = req?.call(el, { navigationUI: 'hide' });
        pr?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
      } catch (_) {}
    }
    this.hide('menu'); this.hide('chapters-panel'); this.hide('death-panel'); this.hide('ending-panel'); this.hide('summary-panel');
    this.el('hint-card')?.classList.remove('show');
    this.el('fader').classList.remove('clear');
    if (!this.game) {
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game-container',
        backgroundColor: '#050507',
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        physics: {
          default: 'matter',
          matter: {
            debug: false, positionIterations: 8, velocityIterations: 6,
            /* fizik adımı gerçek kare süresini kullansın: varsayılan alt sınır 16.7 ms
               olduğu için 90/120 Hz telefonlarda fizik 1.5-2 kat hızlı akıyor, animasyon
               geride kalıyordu (karakter kayarak/havada yürüyormuş gibi görünüyordu) */
            runner: { deltaMin: 1000 / 240, deltaMax: 1000 / 30 },
          },
        },
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
      if (this.isTouch) this.el('touch-layer').style.display = 'block';
    }, 60);
  },

  toMenu() {
    this.hide('pause-panel'); this.hide('death-panel'); this.hide('ending-panel'); this.hide('summary-panel');
    this.showHUD(false);
    this.showSkip(false);
    this.el('pause-btn').style.display = 'none';
    this.el('touch-layer').style.display = 'none';
    document.body.classList.remove('cine');
    if (this.game) this.game.scene.stop('game');
    if (SaveGame.load().current) this.el('m-continue').style.display = '';
    this.show('menu');
    this.fadeIn();                      // bölüm sonu karartmasından dönüldüyse menü görünsün
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
    for (let act = 1; act <= 10; act++) {
      const head = document.createElement('div');
      head.className = 'act-head';
      head.textContent = `PERDE ${act} — ${ACT_NAMES[act][0]}`;
      grid.appendChild(head);
      const row = document.createElement('div');
      row.className = 'act-row';
      for (let i = 1; i <= 10; i++) {
        const lv = (act - 1) * 10 + i;
        const b = document.createElement('button');
        const mis = MISSIONS[lv];
        const bld = buildingFor(lv);
        b.className = 'lv-btn' + (lv > unlocked ? ' locked' : '') + (mis ? ' mislv' : '') + (bld ? ' bldlv' : '');
        b.textContent = lv;
        if (mis) b.title = MISSION_TITLES[mis];
        if (bld) b.title = bld.name;
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

  /* ---- BOMBA PANELİ ----
     1) 4 vida: her birine basılı tut  2) kabloları doğru sırayla kes.
     Talimat bulunduysa sıra yazılı; yoksa yalnız ilk kablo bilinir. */
  showBombHud(on) { const h = this.el('bomb-hud'); if (h) h.style.display = on ? 'block' : 'none'; },
  updateBombTime(t, urgent) {
    const v = Math.max(0, Math.ceil(t));
    const txt = String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
    const h = this.el('bomb-hud'); h.textContent = txt; h.classList.toggle('urgent', !!urgent);
    this.el('bomb-timer').textContent = txt;
  },
  openBomb(sc) {
    const B = sc.mis.bomb;
    this.show('bomb-panel');
    Object.assign(Input, { left: false, right: false, jump: false, crouch: false });
    sc.panelOpen = true;
    const screws = this.el('bomb-screws'), wires = this.el('bomb-wires'), step = this.el('bomb-step'), hint = this.el('bomb-hint');
    screws.innerHTML = ''; wires.innerHTML = '';
    const render = () => {
      const open = B.screws >= 4;
      step.textContent = open ? 'KABLOLARI DOĞRU SIRAYLA KES' : 'KAPAĞIN VİDALARINI SÖK — BASILI TUT';
      wires.classList.toggle('locked', !open);
      const left = B.order.filter(c => !B.cut.includes(c));
      hint.textContent = B.manual
        ? `Talimat: ${B.order.join(' → ')}. Kırmızıya dokunma.`
        : `İlk kablo ${B.order[0]}. Tam sıra, ölü askerin üstündeki talimatta.`;
      if (!left.length) hint.textContent = '';
    };
    for (let i = 0; i < 4; i++) {
      const sc2 = document.createElement('div');
      sc2.className = 'screw' + (i < B.screws ? ' out' : '');
      sc2.style.setProperty('--r', (20 + i * 37) + 'deg');
      sc2.innerHTML = '<div class="ring"></div>';
      let hold = null, p = 0;
      const ring = sc2.querySelector('.ring');
      const stop = () => { clearInterval(hold); hold = null; if (p < 1) { p = 0; sc2.style.setProperty('--p', 0); sc2.style.setProperty('--o', 0); } };
      sc2.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (sc2.classList.contains('out') || hold) return;
        hold = setInterval(() => {
          p += 0.06;
          sc2.style.setProperty('--p', p); sc2.style.setProperty('--o', 1);
          sc2.style.setProperty('--r', (20 + i * 37 + p * 720) + 'deg');
          if (p >= 1) {
            clearInterval(hold); hold = null;
            sc2.classList.add('out'); B.screws++;
            SFAudio.itemHit('metal', 0.4);
            render();
          }
        }, 40);
      });
      sc2.addEventListener('pointerup', stop); sc2.addEventListener('pointerleave', stop); sc2.addEventListener('pointercancel', stop);
      void ring;
      screws.appendChild(sc2);
    }
    const COLS = { KIRMIZI: '#c8483a', MAVİ: '#4a7fd2', SARI: '#d2b84a', BEYAZ: '#dadada', YEŞİL: '#4ab86a' };
    const names = Object.keys(COLS).sort(() => Math.random() - 0.5);
    for (const n of names) {
      const w = document.createElement('div');
      w.className = 'wire' + (B.cut.includes(n) ? ' cut' : '');
      w.style.setProperty('--c', COLS[n]);
      w.textContent = n;
      w.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (w.classList.contains('cut') || B.screws < 4 || B.done || B.exploded) return;
        w.classList.add('cut'); B.cut.push(n);
        SFAudio.wireCut?.();
        const expected = B.order.find(c => !B.cut.slice(0, -1).includes(c));
        if (n === 'KIRMIZI') { this.el('bomb-hint').textContent = 'HAYIR—'; setTimeout(() => Missions.explodeBomb(sc), 350); return; }
        if (n !== expected) {
          B.mistakes++;
          B.t -= 40;
          sc.cameras.main.shake(300, 0.01);
          SFAudio.bombBeep?.(true); SFAudio.bombBeep?.(true);
          this.el('bomb-hint').textContent = B.mistakes >= 2 ? 'Sayaç çıldırdı!' : 'YANLIŞ! Sayaç 40 saniye atladı!';
          if (B.mistakes >= 2) { setTimeout(() => Missions.explodeBomb(sc), 600); }
          // yanlış kesilen kablo sırayı bozmaz — doğru sırayı sürdür
          B.order = B.order.filter(c => c !== n);
          return;
        }
        if (B.order.every(c => B.cut.includes(c))) { setTimeout(() => Missions.defuseSuccess(sc), 500); }
        render();
      });
      wires.appendChild(w);
    }
    render();
    this.el('bomb-close').onclick = () => { this.hide('bomb-panel'); sc.panelOpen = false; };
  },

  /* ---- ŞİFRE PANELİ (dükkân) ---- */
  openKeypad(sc, kp) {
    this.show('keypad-panel');
    sc.panelOpen = true;
    let entry = '';
    const disp = this.el('kp-display');
    const known = sc.mis.codeKnown[kp.lock] ?? [null, null, null, null];
    this.el('kp-known').textContent = 'BİLDİKLERİN: ' + known.map(d => d ?? '_').join(' ');
    const upd = () => { disp.textContent = (entry + '____').slice(0, 4).split('').join(' '); };
    upd();
    const pad = this.el('kp-keys');
    pad.innerHTML = '';
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']) {
      const b = document.createElement('button');
      b.className = 'kp-key'; b.textContent = k;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        SFAudio.bombBeep?.(false);
        if (k === '⌫') entry = entry.slice(0, -1);
        else if (k === '✓') {
          if (entry === kp.code.join('')) {
            kp.solved = true;
            this.hide('keypad-panel'); sc.panelOpen = false;
            sc.openGrate(sc.poweredDoors.find(p => p.id === kp.door), 'Kilit açıldı.');
            SFAudio.doorUnlock();
            this.showCode(null);
            return;
          }
          disp.classList.add('err'); setTimeout(() => disp.classList.remove('err'), 400);
          SFAudio.dryFire(); entry = '';
        } else if (entry.length < 4) entry += k;
        upd();
      });
      pad.appendChild(b);
    }
    this.el('kp-close').onclick = () => { this.hide('keypad-panel'); sc.panelOpen = false; };
  },
  showCode(known) {
    const c = this.el('code-chip');
    if (!c) return;
    if (!known) { c.style.display = 'none'; return; }
    c.style.display = 'flex';
    c.querySelector('.num').textContent = known.map(d => d ?? '_').join(' ');
  },

  /* ---- ÖĞRETİCİ KARTI ---- */
  showTutorial(key) {
    const c = this.el('tut-card');
    if (!c) return;
    if (!key) { c.classList.remove('show'); return; }
    /* YAZISIZ: yalnız sembol + (klavyede) tuş, dokunmatikte hareket işareti */
    const icons = { move: '⟷', jump: '⤒', crouch: '⤓', act: '☝', pry: '✊', push: '⇥', flash: '✦', run: '»' };
    const keys = IS_TOUCH
      ? { move: '☜  ☞', jump: '⇡', crouch: '⇣', act: '☝', pry: '☝ ⋯', push: '☝ ⋯ ⇥', flash: '☝ ✦', run: '⟹' }
      : { move: 'A  D', jump: 'W', crouch: 'S', act: 'E', pry: 'E ⋯', push: 'E ⋯ ⇥', flash: 'F', run: '⇧ Shift' };
    c.querySelector('.ico').textContent = icons[key] ?? '•';
    c.querySelector('.txt').textContent = keys[key] ?? '';
    c.classList.remove('done');
    c.classList.add('show');
  },
  tutorialDone() {
    const c = this.el('tut-card');
    c.classList.add('done');
    setTimeout(() => c.classList.remove('show'), 700);
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
    // bandaj
    const bd = this.el('cnt-bandage');
    bd.style.display = state.bandages > 0 ? 'flex' : 'none';
    bd.querySelector('.num').textContent = state.bandages;
    // silah
    const am = this.el('ammo-box');
    am.style.display = state.gun ? 'flex' : 'none';
    if (state.gun) am.querySelector('.num').textContent = `${state.loaded} · ${state.mags}`;
    // mobil bağlamsal tuşlar
    this.el('btn-fire').classList.toggle('hidden', !state.gun);
    this.el('btn-reload').classList.toggle('hidden', !(state.gun && state.mags > 0 && state.loaded < 7));
    this.el('btn-heal').classList.toggle('hidden', !(state.bandages > 0));
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


  _subTimer: null,
  subtitle(text, ms = 3000) {
    const s = this.el('subtitle');
    if (!text) { s.classList.remove('show'); return; }
    s.textContent = text;
    s.classList.add('show');
    clearTimeout(this._subTimer);
    this._subTimer = setTimeout(() => s.classList.remove('show'), ms);
  },

  /* ÖĞRETİCİ İPUCU — konuşma değil, ekranın üstünde kısa kontrol/bulmaca kartı */
  _hintTimer: null,
  hint(text, ms = 2600, icon = '•') {
    const c = this.el('hint-card');
    if (!c || !text) return;
    /* YAZISIZ: ipucu kartında yalnız sembol kalır (metin ekran okuyucu için saklanır) */
    c.querySelector('.ico').textContent = icon;
    c.querySelector('.txt').textContent = '';
    c.setAttribute('aria-label', text);
    c.classList.add('show');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => c.classList.remove('show'), ms);
  },

  showChapterCard(ch) {
    const card = this.el('chapter-card');
    card.querySelector('.num').textContent = ch.id === 0 ? '' : `BÖLÜM ${ch.id} / ${LEVEL_COUNT}`;
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

  /* ---- BÖLÜM SONU ÖZETİ ---- */
  showSummary(ch, st, onNext) {
    const $ = (id) => this.el(id);
    const sec = Math.round(st.time);
    $('sum-title').textContent = `BÖLÜM ${ch.id}`;
    $('sum-name').textContent = ch.name + (ch.sub ? ' — ' + ch.sub : '');
    $('sum-time').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    $('sum-deaths').textContent = st.deaths;
    $('sum-found').textContent = st.total ? `${st.found} / ${st.total}` : '—';
    this.show('summary-panel');
    $('sum-next').onclick = () => { this.hide('summary-panel'); onNext(); };
    $('sum-menu').onclick = () => { this.hide('summary-panel'); this.toMenu(); };
  },

  showDeath() {
    this.el('death-text').textContent = this._deathOverride ?? DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
    this._deathOverride = null;
    this.show('death-panel');
  },

  fadeIn() { setTimeout(() => this.el('fader').classList.add('clear'), 120); },
  fadeOut(ms = 1600) {
    const f = this.el('fader');
    f.style.transitionDuration = ms + 'ms';
    f.classList.remove('clear');
  },
};

/* ---------------- Android geri tuşu ----------------
   true: oyun işledi (duraklat / panel kapat), false: uygulamadan çık */
window.SFBack = () => {
  const vis = (id) => UI.el(id)?.classList.contains('visible');
  if (vis('summary-panel')) { UI.el('sum-next').click(); return true; }
  for (const id of ['chapters-panel', 'options-panel', 'privacy-panel']) {
    if (vis(id)) { UI.hide(id); UI.show('menu'); return true; }
  }
  if (vis('keypad-panel')) { UI.el('kp-close').click(); return true; }
  if (vis('bomb-panel')) { UI.el('bomb-close').click(); return true; }
  if (vis('pause-panel')) { UI.resume(); return true; }
  if (vis('death-panel') || vis('ending-panel')) { UI.toMenu(); return true; }
  if (vis('menu')) return false;
  if (UI.game?.scene.isActive('game')) { UI.pause(); return true; }
  UI.toMenu();
  return true;
};

/* uygulama arka plana atılınca otomatik duraklat */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (UI.game?.scene.isActive('game')) UI.pause();
    try { SFAudio.ctx?.suspend(); } catch (e) {}   // arka planda ses çalmasın
  } else {
    try { SFAudio.ctx?.resume(); } catch (e) {}
  }
});

/* ---------------- boot ---------------- */
window.addEventListener('DOMContentLoaded', () => UI.init());
