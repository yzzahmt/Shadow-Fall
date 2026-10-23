/* ============================================================
   SHADOW FALL — KAÇIŞ GÖREVLERİ
   elevator  ASANSÖR BOŞLUĞU — makine dairesinde jeneratöre pil tak,
             kafese bin, kolu çek. Kafes yükselirken arkandan yaratıklar
             gelir, yukarıdan taş düşer (önce toz süzülür: kenara çekil).
             Yarı yolda kablo bir kez boşalır; tepede kopmak üzeredir —
             kafes düşmeden üst kata çık.
   train     SON TREN — yol uçurumda biter, tek geçit trendir. Vagona çık;
             tren kalkınca alçak kirişlerde eğil. Köprü ileride yıkık:
             vagonun damına tırman, üst geçidin kenarına atla.
   echo      KÖR DEHLİZ — fener burada söner. Yere vur: yankı yolu bir an
             gösterir. Eğilerek vurursan sessiz olur ama az gösterir;
             yüksek vuruş Kör Sürüngenleri uyandırır. Damla sesi boşluktan,
             çan sesi çıkıştan gelir.

   Yerleşim: buildEscapeLevel (missions.js → buildMissionLevel çağırır).
   Çalışma anı: Escapes.* (Missions.setup / update / findInteractable çağırır).
   ============================================================ */
'use strict';

/* ============================================================
   YERLEŞİM
   ============================================================ */
function buildEscapeLevel(kind, H) {
  const { L, C } = H;
  L.bridges = L.bridges ?? [];              // geçidi görev sağlayan boşluklar (test bunları köprülü sayar)
  const gy = H.getGy();
  const cp = () => L.checkpoints.push(H.getX() - 30);

  switch (kind) {
    case 'elevator': {
      C.flat(320); C.creature(); cp(); C.flat(220); C.stash(); cp();
      H.stash('toolbox', H.getX() + 60, gy, ['battery']);
      C.flat(260);
      const hx0 = H.getX();                         // makine dairesi
      const wl = hx0 + 380, wr = wl + 198;          // kuyu duvarları
      const topY = gy - 500, roofY = gy - 250;
      L.generators.push({ x: hx0 + 150, groundY: gy, id: 'gen_lift' });
      L.genLinks.gen_lift = { lift: true };
      L.decor.push({ type: 'shell', x0: hx0 - 20, x1: wl, groundY: gy, roofY, theme: 'mineworks' });
      L.decor.push({ type: 'lampInt2', x: hx0 + 200, y: roofY + 40, flicker: true });
      L.checkpoints.push(hx0 + 40);
      H.setX(wl); H.endSeg(wl);                     // kafesin altı: dipsiz kuyu
      L.walls.push({ x: wl, y0: topY - 160, y1: gy - 150 });
      L.walls.push({ x: wr, y0: topY, y1: gy + 60 });
      let chaser = H.pickCreature();
      if (chaser === 'wraith') chaser = 'hound';
      L.elevator = { x0: wl + 11, x1: wr - 11, wl, wr, bottomY: gy, topY, hallX0: hx0, chaser };
      L.bridges.push({ x0: wl - 30, x1: wr + 30 });
      H.setX(wr - 11); H.jumpTo(wr - 11, topY);
      L.checkpoints.push(wr + 70);
      C.flat(380); C.stash(); C.flat(300);
      break;
    }

    case 'train': {
      C.flat(320); C.creature(); cp(); C.flat(240); C.stash(); cp(); C.flat(160);
      const sx = H.getX();                          // peron
      const tx0 = sx + 280;
      const cars = [{ kind: 'flat', w: 230 }, { kind: 'box', w: 250 }, { kind: 'box', w: 250 }, { kind: 'loco', w: 290 }];
      let cx = tx0;
      for (const c of cars) { c.x0 = cx; cx += c.w + 16; }
      const G0 = cx + 220;                          // uçurum başı
      const G1 = G0 + 2300;                         // üst geçit
      const upY = gy - 236;
      H.setX(G0); H.endSeg(G0);
      L.platforms.push({ x: G1 - 60, y: upY, w: 600, thick: 16, material: 'metal' });
      L.train = {
        cars, tx0, railY: gy, G0, G1, BX: G1 + 430, upY, stationX: sx,
        beams: [G0 + 520, G0 + 1150, G0 + 1780],
      };
      L.bridges.push({ x0: G0 - 30, x1: G1 + 560 });
      L.checkpoints.push(sx + 40);
      L.triggers.push({ x: sx + 60, text: 'Yol uçurumda bitiyor. Vagona çık.', icon: '»' });
      H.setX(G1 + 540); H.jumpTo(G1 + 540, upY);
      L.checkpoints.push(G1 + 600);
      C.flat(420); C.stash(); C.flat(260);
      break;
    }

    case 'echo': {
      L.blackouts = false;
      C.flat(340); C.stash(); cp(); C.flat(200);
      const x0 = H.getX();
      const crawler = () => {
        const x = H.getX(), w = 560;
        L.creatures.push({ type: 'crawler', x: x + w * 0.55, patrolMinX: x + 60, patrolMaxX: x + w - 60, ...H.creatureStats('crawler') });
        H.setX(x + w);
      };
      C.flat(300); C.gap(); cp(); C.flat(240); crawler(); cp();
      C.spikes(); C.flat(260); C.pond(); cp(); C.flat(200);
      C.gap(); C.flat(220); crawler(); cp();
      C.gap(); C.flat(200); C.spikes(); C.flat(300);
      const x1 = H.getX();
      L.echo = { x0, x1, bellX: x1 + 80 };
      cp(); C.flat(400);
      break;
    }
  }
}

/* ============================================================
   ÇALIŞMA ANI
   ============================================================ */
const Escapes = {
  setup(sc) {
    const ch = sc.ch;
    sc.flashBlocked = false;
    if (ch.elevator) this._setupElevator(sc, ch.elevator);
    if (ch.train) this._setupTrain(sc, ch.train);
    if (ch.echo) sc.mis.echo = { ...ch.echo, inside: false, cd: 0, dripT: 1, bellT: 2, hinted: false };
  },
  update(sc, dt, P) {
    if (sc.mis.elev) this._updateElevator(sc, dt, P);
    if (sc.mis.train) this._updateTrain(sc, dt, P);
    if (sc.mis.echo) this._updateEcho(sc, dt, P);
  },
  /* müzik yönetmeni için: kaçış sahnesi sürüyor mu */
  escaping(sc) {
    const M = sc.mis ?? {};
    return ['rise', 'top'].includes(M.elev?.state) || M.train?.state === 'go';
  },
  findInteractable(sc, px, py) {
    const E = sc.mis?.elev;
    if (E && (E.state === 'off' || E.state === 'ready') && this._onCage(sc, E) && Math.abs(px - E.leverX) < 40) {
      return { type: 'm-esc-lift', obj: E, label: E.state === 'off' ? 'AKIM YOK' : 'KOLU ÇEK', x: E.leverX, y: E.y - 84 };
    }
    void py;
    return null;
  },
  tapTargets(sc) {
    const E = sc.mis?.elev;
    return E && (E.state === 'off' || E.state === 'ready') ? [{ x: E.leverX, y: E.y - 30, ax: E.leverX }] : [];
  },
  interact(sc, t) {
    if (t.type !== 'm-esc-lift') return false;
    const E = t.obj;
    if (E.state === 'off') { SFAudio.thud(0.2); UI.hint('Asansörün akımı yok. Jeneratöre pil tak.', 2600, '⚡'); return true; }
    sc.player.mode = 'action';
    sc.rig.startAction('lever', {
      targetX: E.leverX, targetY: E.y - 40,
      onPhase: (ph) => { if (ph === 'pulled' && E.state === 'ready') this._startRise(sc, E); },
      onDone: () => { sc.player.mode = 'idle'; },
    });
    return true;
  },

  /* ---------------- ASANSÖR ---------------- */
  _setupElevator(sc, E0) {
    const w = E0.x1 - E0.x0;
    const E = sc.mis.elev = { ...E0, w, y: E0.bottomY, state: 'off', t: 0, speed: 0, vy: 0, debris: [], debT: 1.2, jolted: false };
    E.cx = E0.x0 + w / 2;
    E.leverX = E0.x0 + 30;
    E.body = sc.matter.add.rectangle(E.cx, E.y + 8, w, 16, {
      isStatic: true, label: 'platform:metal', friction: 0.9, collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
    });
    E.plat = { x: E0.x0, y: E.y, w, thick: 16, material: 'metal' };
    sc.platforms.push(E.plat);
    /* kuyunun arka duvarı, raylar, tepe makarası; üst katın altındaki kaya kütlesi */
    const b = sc.add.graphics().setDepth(58);
    b.fillStyle(0x0f1014, 1); b.fillRect(E0.wl, E0.topY - 260, E0.wr - E0.wl, E0.bottomY + 600 - E0.topY);
    b.lineStyle(1, 0x1b1c24, 0.9);
    for (let y = E0.topY - 240; y < E0.bottomY + 300; y += 90) { b.beginPath(); b.moveTo(E0.wl, y); b.lineTo(E0.wr, y + 40); b.strokePath(); }
    b.fillStyle(0x15161c, 1); b.fillRect(E0.x0 + 4, E0.topY - 240, 5, 900); b.fillRect(E0.x1 - 9, E0.topY - 240, 5, 900);
    b.fillStyle(0x0b0b10, 1); b.fillCircle(E.cx, E0.topY - 170, 16); b.fillRect(E.cx - 40, E0.topY - 176, 80, 6);
    const mass = sc.add.graphics().setDepth(70);
    mass.fillStyle(0x0a0a0e, 1); mass.fillRect(E0.wr - 11, E0.topY + 20, sc.worldW - E0.wr + 200, WORLD_H + 300 - E0.topY);
    E.g = sc.add.graphics().setDepth(93);
    addRimGlow(E.g, 0x9aa2b4, 1.2);
    E.rockG = sc.add.graphics().setDepth(104);
    E.light = sc.lights2.addLight({ x: E.cx, y: E.y - 90, r: 240, type: 'halo', intensity: 0.95, flicker: 0.05, on: false });
    /* kuyunun dibinde sönük bir iş lambası, tepede çıkış lambası: hedef görünsün */
    sc.lights2.addLight({ x: E.cx, y: E0.bottomY - 150, r: 200, type: 'halo', intensity: 0.5 });
    sc.lights2.addLight({ x: E0.wr + 60, y: E0.topY - 70, r: 190, type: 'halo', intensity: 0.75, flicker: 0.08 });
    const lamp = sc.add.image(E0.wr + 60, E0.topY - 70, 'softDot').setDepth(91).setScale(0.35).setAlpha(0.8)
      .setTint(0xf0d8a0).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: lamp, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });
    E.ledgeBottom = (sc.ledges ?? []).find(l => l.side === 1 && Math.abs(l.x - E0.wl) < 4 && Math.abs(l.y - E0.bottomY) < 3);
    E.ledgeTop = (sc.ledges ?? []).find(l => l.side === -1 && Math.abs(l.x - E0.x1) < 4 && Math.abs(l.y - E0.topY) < 3);
    this._drawCage(E);
  },
  powerLift(sc) {
    const E = sc.mis?.elev; if (!E || E.state !== 'off') return;
    E.state = 'ready'; E.light.on = true;
    SFAudio.leverCreak?.();
    this._drawCage(E);
  },
  _onCage(sc, E) {
    const P = sc.player; if (!P) return false;
    const h = P.crouching ? P.hCrouch : P.hStand;
    const px = P.body.position.x;
    return px > E.x0 - 4 && px < E.x1 + 4 && Math.abs(P.body.position.y + h / 2 - E.y) < 12;
  },
  _startRise(sc, E) {
    E.state = 'rise'; E.t = 0; E.speed = 62;
    SFAudio.leverCreak?.(); SFAudio.generatorStart?.();
    E.motor = SFAudio.carEngine?.();
    sc.cameras.main.shake(260, 0.004);
    /* makine sesi uyandırdı: arkadan yaratıklar gelir */
    sc.time.delayedCall(900, () => {
      if (sc.dead) return;
      for (let i = 0; i < 2; i++) {
        const sx = E.hallX0 - 520 - i * 130;
        const cr = spawnCreature(sc, {
          type: E.chaser, x: sx, groundY: E.bottomY, facing: 1, startChase: true,
          patrolMinX: sx - 300, patrolMaxX: E.wl - 24,
          scale: E.chaser === 'brute' ? 1.4 : E.chaser === 'hound' ? 0.95 : 1.15, hp: 6, chaseSpeed: 218 - i * 12,
        });
        cr.onStrike = (dmg) => sc.damagePlayer(dmg ?? 2, 1);
        cr.chaser = true; cr.noNav = true;
        sc.creatures.push(cr);
      }
      sc.scare(E.hallX0 - 300, 1.1);
    });
  },
  _updateElevator(sc, dt, P) {
    const E = sc.mis.elev;
    const span = E.bottomY - E.topY;
    if (E.ledgeBottom) E.ledgeBottom.lethal = !(E.state === 'off' || E.state === 'ready');
    if (E.ledgeTop) E.ledgeTop.lethal = E.state !== 'top';
    if (E.state === 'rise') {
      E.t += dt;
      E.y = Math.max(E.topY, E.y - E.speed * dt);
      /* yarı yolda kablo bir an boşalır */
      if (!E.jolted && E.bottomY - E.y > span * 0.55) {
        E.jolted = true; E.y += 28; E.speed = 46;
        SFAudio.cableSnap(); SFAudio.thud(0.9);
        sc.cameras.main.shake(420, 0.014); SFVibrate(70);
        this._sparks(sc, E.cx, E.topY - 160, 24);
        E.light.flicker = 0.4;
      }
      this._updateDebris(sc, dt, E, P);
      if (E.y <= E.topY) {
        E.y = E.topY; E.state = 'top'; E.t = 0;
        E.motor?.stop(0.4); E.motor = null;
        SFAudio.thud(0.7);
        UI.hint('Kablo kopmak üzere — çık!', 2200, '⚠');
      }
    } else if (E.state === 'top') {
      E.t += dt;
      if (Math.random() < dt * 6) this._sparks(sc, E.cx, E.topY - 160, 4);
      if (Math.random() < dt * 3) SFAudio.itemHit('metal', 0.3);
      if (E.t > 2.6) {
        E.state = 'fall'; E.vy = 0;
        SFAudio.cableSnap(); sc.cameras.main.shake(300, 0.01);
        sc.matter.world.remove(E.body);
        const k = sc.platforms.indexOf(E.plat); if (k >= 0) sc.platforms.splice(k, 1);
        E.light.on = false;
      }
    } else if (E.state === 'fall') {
      E.vy += 1500 * dt; E.y += E.vy * dt;
      if (!E.crashed && E.y > E.bottomY + 300) {
        E.crashed = true;
        SFAudio.explosion?.(0.5); sc.cameras.main.shake(500, 0.012);
      }
    }
    if (E.state !== 'fall') {
      MatterLib.Body.setPosition(E.body, { x: E.cx, y: E.y + 8 });
      E.plat.y = E.y;
    }
    E.light.y = E.y - 90;
    this._drawCage(E);
    this._drawDebris(E);
  },
  _updateDebris(sc, dt, E, P) {
    E.debT -= dt;
    if (E.debT <= 0 && E.y > E.topY + 70) {
      E.debT = 1.25 + Math.random() * 0.6;
      const tx = clamp(P.body.position.x + (Math.random() - 0.5) * 60, E.x0 + 14, E.x1 - 14);
      /* uyarı: tavandan süzülen toz */
      const dust = sc.add.particles(tx, E.y - 330, 'softDot', {
        x: { min: -6, max: 6 }, speedY: { min: 180, max: 300 }, lifespan: 900, frequency: 30,
        scale: { start: 0.09, end: 0.02 }, alpha: { start: 0.55, end: 0 }, tint: 0xa89c8c,
      }).setDepth(103);
      sc.time.delayedCall(800, () => dust.stop());
      sc.time.delayedCall(1900, () => dust.destroy());
      SFAudio.itemHit('stone', 0.15);
      E.debris.push({ x: tx, t: 0, y: null, vy: 0, hit: false, r: 9 + Math.random() * 6 });
    }
    for (const d of E.debris) {
      d.t += dt;
      if (d.y == null && d.t > 0.9) { d.y = E.y - 420; d.vy = 260; }
      if (d.y != null && !d.hit) {
        d.vy += 1600 * dt; d.y += d.vy * dt;
        if (d.y >= E.y - d.r) {
          d.hit = true; d.t = 0;
          SFAudio.thud(0.8); SFAudio.itemHit('stone', 0.7);
          sc.impactSpark(d.x, E.y - 4);
          E.y += 3;
          if (this._onCage(sc, E) && Math.abs(P.body.position.x - d.x) < 24) sc.damagePlayer(1, Math.sign(P.body.position.x - d.x) || 1);
        }
      }
    }
    E.debris = E.debris.filter(d => !(d.hit && d.t > 0.5));
  },
  _sparks(sc, x, y, n) {
    const p = sc.add.particles(x, y, 'softDot', {
      speed: { min: 80, max: 260 }, lifespan: 600, gravityY: 700, scale: { start: 0.1, end: 0 },
      tint: 0xfff0b0, blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(110);
    p.explode(n);
    sc.time.delayedCall(800, () => p.destroy());
  },
  _drawCage(E) {
    const g = E.g; g.clear();
    const c = 0x0c0c12, roof = E.y - 128;
    g.lineStyle(2.2, c, 1);
    if (E.state === 'fall') { g.beginPath(); g.moveTo(E.cx, E.topY - 170); g.lineTo(E.cx + 6, E.topY - 60); g.strokePath(); }
    else { g.beginPath(); g.moveTo(E.cx, E.topY - 170); g.lineTo(E.cx, roof); g.strokePath(); }
    g.fillStyle(c, 1);
    g.fillRect(E.x0, E.y, E.w, 14);
    g.fillRect(E.x0, roof, E.w, 7);
    g.fillRect(E.x0, roof, 4, E.y - roof); g.fillRect(E.x1 - 4, roof, 4, E.y - roof);
    g.lineStyle(1.2, c, 0.85);
    for (let bx = E.x0 + 26; bx < E.x1 - 10; bx += 26) { g.beginPath(); g.moveTo(bx, roof + 6); g.lineTo(bx, roof + 46); g.strokePath(); }
    /* kol: hazırken yukarı, çekilince aşağı */
    const lx = E.leverX, a = (E.state === 'off' || E.state === 'ready') ? -0.7 : 0.7;
    g.fillStyle(c, 1); g.fillRect(lx - 4, E.y - 34, 8, 34);
    g.lineStyle(3.2, c, 1); g.beginPath(); g.moveTo(lx, E.y - 30); g.lineTo(lx + Math.sin(a) * 22, E.y - 30 - Math.cos(a) * 22); g.strokePath();
    g.fillStyle(E.state === 'ready' ? 0xd8d4c8 : c, E.state === 'ready' ? 0.6 : 1);
    g.fillCircle(lx + Math.sin(a) * 22, E.y - 30 - Math.cos(a) * 22, 3.5);
  },
  _drawDebris(E) {
    const g = E.rockG; g.clear();
    g.fillStyle(0x0b0b10, 1);
    for (const d of E.debris) {
      if (d.y == null) continue;
      if (!d.hit) { g.fillCircle(d.x, d.y, d.r); g.fillCircle(d.x + d.r * 0.5, d.y - d.r * 0.4, d.r * 0.6); }
      else for (let i = 0; i < 4; i++) g.fillCircle(d.x - 12 + i * 8, E.y - 3 - (i % 2) * 2, 3 + (i % 2));
    }
  },

  /* ---------------- TREN ---------------- */
  _setupTrain(sc, T0) {
    const T = sc.mis.train = { ...T0, off: 0, v: 0, state: 'wait', boardT: 0, clackT: 0, hitCD: 0, cars: [], hinted: {} };
    const ry = T0.railY;
    for (const c of T0.cars) {
      const top = c.kind === 'flat' ? -44 : -132;
      const h = -10 - top;
      const body = sc.matter.add.rectangle(c.x0 + c.w / 2, ry + top + h / 2, c.w, h, {
        isStatic: true, label: 'train', friction: 0.9, collisionFilter: { category: CAT.WORLD, mask: 0xFFFF },
      });
      const g = sc.add.graphics().setDepth(94).setPosition(c.x0, ry);
      addRimGlow(g, 0x9aa2b4, 1.1);
      this._drawCar(g, c.kind, c.w);
      T.cars.push({ ...c, top, h, body, g, dy: 0, vy: 0, a: 0, fallen: false });
    }
    /* raylar, uçurum üstünde ahşap ayaklı köprü, yıkık uç, kirişler */
    const g = sc.add.graphics().setDepth(68);
    const c = 0x0b0b10;
    g.fillStyle(c, 1);
    g.fillRect(T0.tx0 - 300, ry - 6, T0.BX - T0.tx0 + 300, 4);
    for (let x = T0.tx0 - 300; x < T0.BX; x += 26) g.fillRect(x, ry - 3, 14, 4);
    g.lineStyle(5, c, 1);
    for (let x = T0.G0 + 40; x < T0.BX - 20; x += 150) {
      g.beginPath(); g.moveTo(x, ry); g.lineTo(x, ry + 420); g.strokePath();
      g.lineStyle(2, c, 1);
      g.beginPath(); g.moveTo(x, ry + 10); g.lineTo(x + 150, ry + 150); g.moveTo(x + 150, ry + 10); g.lineTo(x, ry + 150); g.strokePath();
      g.lineStyle(5, c, 1);
    }
    g.fillRect(T0.G0, ry - 2, T0.BX - T0.G0, 12);
    g.lineStyle(3, c, 1);                         // kopuk raylar aşağı sarkar
    g.beginPath(); g.moveTo(T0.BX, ry - 4); g.lineTo(T0.BX + 40, ry + 70); g.moveTo(T0.BX, ry + 4); g.lineTo(T0.BX + 22, ry + 110); g.strokePath();
    for (const bx of T0.beams) {
      const by = ry - 172;
      g.fillStyle(c, 1); g.fillRect(bx - 16, by - 20, 32, 20);
      g.lineStyle(2, c, 1); g.beginPath(); g.moveTo(bx - 12, by - 20); g.lineTo(bx - 40, by - 420); g.moveTo(bx + 12, by - 20); g.lineTo(bx + 40, by - 420); g.strokePath();
      sc.lights2.addLight({ x: bx, y: by + 8, r: 70, type: 'halo', intensity: 0.45 });
    }
    /* yıkık köprü uyarı lambası */
    T.warn = sc.add.image(T0.BX - 10, ry - 60, 'softDot').setDepth(95).setScale(0.3).setTint(0xc8483a).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: T.warn, alpha: 0.15, duration: 420, yoyo: true, repeat: -1 });
    sc.lights2.addLight({ x: T0.stationX + 120, y: ry - 150, r: 170, type: 'halo', intensity: 0.7 });
    const loco = T.cars[T.cars.length - 1];
    T.head = sc.lights2.addLight({ x: 0, y: 0, r: 320, type: 'cone', facing: 1, intensity: 1, on: true });
    T.halo = sc.lights2.addLight({ x: 0, y: 0, r: 220, type: 'halo', intensity: 0.55, on: true });
    T.loco = loco;
    this._placeTrain(T);
  },
  _drawCar(g, kind, w) {
    const c = 0x0b0b10;
    g.fillStyle(c, 1);
    g.fillRect(6, -32, w - 12, 14);                      // şasi
    for (const wx of [24, 50, w - 50, w - 24]) g.fillCircle(wx, -10, 9.5);
    if (kind === 'flat') {
      g.fillRect(0, -44, w, 12);
      for (let x = 20; x < w - 10; x += 40) g.fillRect(x, -52, 4, 8);   // kenar dikmeleri
    } else if (kind === 'box') {
      g.fillRect(2, -132, w - 4, 100);
      g.lineStyle(1.2, 0x1d1e26, 0.9);
      g.strokeRect(w / 2 - 36, -118, 72, 80);
      for (let x = 14; x < w - 8; x += 22) { g.beginPath(); g.moveTo(x, -128); g.lineTo(x, -36); g.strokePath(); }
    } else {
      g.fillRect(0, -132, w - 30, 100);
      g.beginPath(); g.moveTo(w - 30, -132); g.lineTo(w - 4, -100); g.lineTo(w - 4, -32); g.lineTo(w - 30, -32); g.closePath(); g.fillPath();
      g.fillStyle(0x2a2e38, 1); g.fillRect(w - 96, -122, 26, 22); g.fillRect(w - 64, -122, 24, 22);
      g.fillStyle(0xf0e8c8, 0.9); g.fillCircle(w - 8, -84, 3.5);
    }
  },
  _placeTrain(T) {
    for (const c of T.cars) {
      const x = c.x0 + T.off;
      c.g.setPosition(x, T.railY + c.dy).setRotation(c.a);
      if (!c.fallen) MatterLib.Body.setPosition(c.body, { x: x + c.w / 2, y: T.railY + c.top + c.h / 2 });
    }
    const L = T.loco, lx = L.x0 + T.off + L.w;
    T.head.x = lx - 6; T.head.y = T.railY - 84 + L.dy; T.head.on = !L.fallen;
    T.halo.x = T.cars[1].x0 + T.off + 200; T.halo.y = T.railY - 120;
  },
  /* oyuncu hangi vagonun üstünde (yoksa null) */
  _carUnder(sc, T, P) {
    const h = P.crouching ? P.hCrouch : P.hStand;
    const feet = P.body.position.y + h / 2, px = P.body.position.x;
    for (const c of T.cars) {
      if (c.fallen) continue;
      const x = c.x0 + T.off;
      if (px > x - 6 && px < x + c.w + 6 && Math.abs(feet - (T.railY + c.top)) < 8) return c;
    }
    return null;
  },
  _updateTrain(sc, dt, P) {
    const T = sc.mis.train;
    const car = P.grounded ? this._carUnder(sc, T, P) : null;
    if (T.state === 'wait') {
      T.boardT = car ? T.boardT + dt : 0;
      if (T.boardT > 0.9) {
        T.state = 'go';
        SFAudio.trainHorn(); T.engine = SFAudio.carEngine?.();
        sc.cameras.main.shake(300, 0.004);
        UI.hint(IS_TOUCH ? 'Kirişlere yaklaşınca aşağı fırlat: eğil.' : 'Kirişlerde [S] ile eğil.', 3400, '⤓');
      }
    }
    if (T.state === 'go') {
      T.v = Math.min(270, T.v + 60 * dt);
      T.off += T.v * dt;
      T.clackT -= dt;
      if (T.clackT <= 0) { T.clackT = 70 / Math.max(T.v, 40); SFAudio.railClack(Math.min(1, T.v / 220)); }
      /* yıkık köprü: önünü geçen vagon boşluğa düşer */
      for (const c of T.cars) {
        if (!c.fallen && c.x0 + T.off + c.w > T.BX + 20) {
          c.fallen = true;
          sc.matter.world.remove(c.body);
          SFAudio.leverCreak?.(); SFAudio.thud(0.8);
          if (c === T.loco) {
            T.engine?.stop(0.6); T.engine = null;
            sc.time.delayedCall(1100, () => { SFAudio.explosion?.(0.7); sc.cameras.main.shake(700, 0.014); });
          }
        }
        if (c.fallen) { c.vy += 1400 * dt; c.dy += c.vy * dt; c.a = Math.min(0.9, c.a + dt * 0.7); }
      }
      if (T.cars.every(c => c.fallen && c.dy > 900)) T.state = 'gone';
      /* alçak kiriş: damdayken eğilmezsen çarpar */
      T.hitCD -= dt;
      if (car && car.kind !== 'flat' && !P.crouching && T.hitCD <= 0) {
        for (const bx of T.beams) {
          if (Math.abs(P.body.position.x - bx) < 26) { T.hitCD = 1; sc.damagePlayer(1, -1); SFAudio.itemHit('metal', 0.9); break; }
        }
      }
      if (!T.hinted.bridge && P.body.position.x > T.G1 - 900) {
        T.hinted.bridge = true;
        UI.hint('Köprü yıkık! Damdan üst geçide atla, kenarı yakala.', 3400, '⚠');
      }
      this._placeTrain(T);
    }
    /* vagon oyuncuyu taşır; havadayken de trenin hızını korur (atlayınca aynı yere iner) */
    if (car && T.state === 'go') P.carryVx = T.v;
    else if (P.grounded || P.hang || P.mantle || P.climbing || P.swimming) P.carryVx = 0;
    if (P.carryVx) MatterLib.Body.translate(P.body, { x: P.carryVx * dt, y: 0 });
  },

  /* ---------------- KÖR DEHLİZ ---------------- */
  _updateEcho(sc, dt, P) {
    const E = sc.mis.echo;
    const px = P.body.position.x;
    const inside = px > E.x0 && px < E.x1;
    if (inside !== E.inside) {
      E.inside = inside;
      sc.flashBlocked = inside;
      if (inside) {
        if (sc.flashOn) { sc.flashOn = false; SFAudio.flashClick(false); this._sparks(sc, px + P.facing * 10, P.body.position.y - 10, 8); }
        sc.lights2.setDarkness(0.985, 700);
        if (!E.hinted) {
          E.hinted = true;
          UI.hint(IS_TOUCH ? 'Fener söndü. Karaktere dokun: yere vur, yankı yolu bir an gösterir. Eğilerek vurursan sessiz olur.'
            : 'Fener söndü. [F] yere vur: yankı yolu bir an gösterir. Eğilerek vurursan sessiz olur.', 6500, '◉');
          sc.time.delayedCall(7200, () => { if (E.inside) UI.hint('Damla sesi boşluktan, çan sesi çıkıştan gelir.', 4200, '≋'); });
        }
      } else {
        sc.lights2.setDarkness(sc.baseDark, 1200);
      }
    }
    E.cd -= dt;
    if (!inside) return;
    /* en yakın tehlikenin sesi: kenardan aşağı damlayan su */
    E.dripT -= dt;
    if (E.dripT <= 0) {
      E.dripT = 1.1;
      let best = null, bd = 1e9;
      for (const lg of sc.ledges ?? []) {
        if (!lg.lethal || lg.x < E.x0 || lg.x > E.x1) continue;
        const d = Math.abs(lg.x - px);
        if (d < bd) { bd = d; best = lg.x + lg.side * 30; }
      }
      for (const sp of sc.ch.spikes ?? []) {
        if (sp.x0 < E.x0 || sp.x0 > E.x1) continue;
        const d = Math.max(0, sp.x0 - px, px - sp.x1);
        if (d < bd) { bd = d; best = clamp(px, sp.x0, sp.x1); }
      }
      if (best != null && bd < 560) SFAudio.cue('drip', clamp((best - px) / 350, -1, 1), 1 - bd / 560);
    }
    E.bellT -= dt;
    if (E.bellT <= 0) {
      E.bellT = 3.4;
      const d = E.bellX - px;
      SFAudio.cue('bell', clamp(d / 900, -1, 1), clamp(1 - Math.abs(d) / 4000, 0.25, 1));
    }
  },
  /* yere vur: yankı halkası çevreyi bir an aydınlatır, ses yaratıkları uyandırabilir */
  echoPulse(sc) {
    const E = sc.mis?.echo; if (!E || E.cd > 0) return;
    const P = sc.player;
    const quiet = P.crouching;
    E.cd = quiet ? 0.7 : 1.1;
    const x = P.body.position.x, y = P.body.position.y + (quiet ? P.hCrouch : P.hStand) / 2;
    sc.rig.triggerLand?.(0.3);
    SFAudio.echoKnock(!quiet);
    const R = quiet ? 250 : 540;
    const light = sc.lights2.addLight({ x, y: y - 40, r: 40, type: 'halo', intensity: 1.15 });
    sc.tweens.add({ targets: light, r: R, duration: 520, ease: 'Quad.easeOut' });
    sc.tweens.add({ targets: light, intensity: 0, delay: 480, duration: quiet ? 700 : 1300, onComplete: () => sc.lights2.removeLight(light) });
    const ring = sc.add.graphics().setDepth(108).setBlendMode(Phaser.BlendModes.ADD);
    const st = { k: 0 };
    sc.tweens.add({
      targets: st, k: 1, duration: quiet ? 600 : 1000, ease: 'Quad.easeOut',
      onUpdate: () => { ring.clear(); ring.lineStyle(2, 0x9fb4d0, (1 - st.k) * 0.5); ring.strokeCircle(x, y - 10, R * st.k); },
      onComplete: () => ring.destroy(),
    });
    sc.makeNoise(x, y, quiet ? 200 : 460, quiet ? 0.2 : 0.5);
  },
};
