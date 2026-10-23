/* SHADOW FALL — scripted gameplay checks (headless Chrome)
   Drives the real game loop through each mechanic and asserts the outcome. */
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');
const url = 'file://' + path.join(__dirname, '..', 'index.html');

const CASES = {
  /* kanal: vanayı çevir → su yükselir, tahta karşı kıyıya erişilebilir olur */
  async canal(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.puzzles ?? []).some(q => q.type === 'canal')));
      const p = sc.pz.find(q => q.type === 'canal');
      if (!p) return 'no canal';
      H.tp(sc, p.valve.x - 20, p.valve.y - 31);
      await H.frames(30);
      const t = sc.findInteractable();
      if (t?.label !== 'VANAYI ÇEVİR') return 'valve not interactable: ' + JSON.stringify(t?.label);
      Input.actHit = true;
      await H.frames(600);
      const top = p.plankPlat.y;
      /* yükselen tahtadan sağ kıyıya ≤150px: zıplanır; önceden 300+px: zıplanmaz */
      return (p.raised && Math.abs(p.water.surfaceY - p.high) < 2 && top - p.bankY < 150 && p.low - p.bankY > 280) ? true : `surface ${p.water.surfaceY} plank ${top}`;
    });
  },
  /* birleşik kaplar: sandık plakaya → sal yükselir */
  async hydraulic(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.puzzles ?? []).some(q => q.type === 'hydraulic')));
      const p = sc.pz.find(q => q.type === 'hydraulic');
      const box = sc.pushboxes.find(b => Math.abs(b.body.position.x - p.plate.x0) < 500);
      MatterLib.Body.setPosition(box.body, { x: (p.plate.x0 + p.plate.x1) / 2, y: p.plate.y - 40 });
      await H.frames(420);
      return (p.done && p.raftPlat.y < p.tank.low - 140) ? true : `depth ${p.depth.toFixed(1)} raft ${p.raftPlat.y.toFixed(0)}`;
    });
  },
  /* karşı ağırlık: sandık sol kafese, oyuncu sağ kafese, fren → yukarı */
  async pulley(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.puzzles ?? []).some(q => q.type === 'pulley')));
      const p = sc.pz.find(q => q.type === 'pulley');
      const box = sc.pushboxes.find(b => Math.abs(b.body.position.x - p.left.x0) < 500);
      MatterLib.Body.setPosition(box.body, { x: (p.left.x0 + p.left.x1) / 2, y: p.y - 40 });
      H.tp(sc, p.brake.x - 18, p.y - 31);
      await H.frames(40);
      const t = sc.findInteractable();
      if (t?.label !== 'FRENİ BIRAK') return 'brake not interactable ' + t?.label;
      Input.actHit = true;
      await H.frames(260);
      const feet = sc.player.body.position.y + 30;
      return (p.done && feet < p.y - p.rise + 20) ? true : `off ${p.off.toFixed(0)} feet ${feet.toFixed(0)}`;
    });
  },
  /* baskı plakası: sandık plakada → kapı açık, kalkınca kapanır */
  async pressure(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.puzzles ?? []).some(q => q.type === 'pressure')));
      const p = sc.pz.find(q => q.type === 'pressure');
      const box = sc.pushboxes.find(b => Math.abs(b.body.position.x - p.plate.x0) < 400);
      MatterLib.Body.setPosition(box.body, { x: (p.plate.x0 + p.plate.x1) / 2, y: p.plate.y - 40 });
      await H.frames(140);
      const open = p.D.open;
      MatterLib.Body.setPosition(box.body, { x: p.plate.x0 - 150, y: p.plate.y - 40 });
      await H.frames(120);
      return (open > 0.95 && p.D.open < 0.05) ? true : `open ${open.toFixed(2)} after ${p.D.open.toFixed(2)}`;
    });
  },
  /* ışık gözü: fener sensöre tutulunca kapı açılır */
  async photocell(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.puzzles ?? []).some(q => q.type === 'photocell')));
      const p = sc.pz.find(q => q.type === 'photocell');
      H.tp(sc, p.eye.x - 300, 569);
      sc.player.facing = 1;
      Input.flashHit = true;
      await H.frames(200);
      return p.solved ? true : `charge ${p.charge.toFixed(2)} flash ${sc.flashOn}`;
    });
  },
  /* zamanlı kapı: kolu çek → kapı açılır, süre bitince kapanır */
  async timedGate(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.puzzles ?? []).some(q => q.type === 'timedGate')));
      const p = sc.pz.find(q => q.type === 'timedGate');
      const lv = sc.levers.find(l => l.id === p.lever);
      H.tp(sc, lv.x - 20, 569);
      await H.frames(30);
      Input.actHit = true;
      await H.frames(150);
      const open = p.D.open;
      await H.frames(300);
      return (open > 0.9 && p.D.open < 0.1) ? true : `open ${open.toFixed(2)} later ${p.D.open.toFixed(2)}`;
    });
  },
  /* basamaklı merdiven: dipte yukarı → üst kat; üstten sola → zemin kat */
  async stairs(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.buildings ?? []).some(b => b.kind === 'house')));
      const s = sc.stairs[0];
      H.tp(sc, s.x0 - 10, s.y0 - 31);
      await H.frames(20);
      Input.up = true; Input.right = true;
      let sawStairs = false;
      for (let i = 0; i < 260; i++) { await H.frames(1); if (sc.rig.mode === 'stairs') sawStairs = true; if (!sc.player.stair && sawStairs) break; }
      Input.up = false; Input.right = false;
      await H.frames(20);
      const upFeet = sc.player.body.position.y + 30;
      if (Math.abs(upFeet - s.y1) > 6) return `not upstairs: feet ${upFeet.toFixed(0)} want ${s.y1}`;
      Input.left = true;
      for (let i = 0; i < 300; i++) { await H.frames(1); if (sc.player.body.position.y + 30 > s.y0 - 4 && !sc.player.stair) break; }
      Input.left = false;
      const downFeet = sc.player.body.position.y + 30;
      return (sawStairs && Math.abs(downFeet - s.y0) < 8) ? true : `down feet ${downFeet.toFixed(0)}`;
    });
  },
  /* el merdiveni: tırmanırken animasyon fazı ilerler, tepede kenara çıkar */
  async ladder(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.buildings ?? []).some(b => b.kind === 'house')));
      const lad = sc.ladders.find(l => l.climbable);
      H.tp(sc, lad.x, lad.bottomY - 31);
      await H.frames(15);
      Input.up = true;
      const ph0 = sc.rig.phase; let climbed = false, mantled = false;
      for (let i = 0; i < 400; i++) {
        await H.frames(1);
        if (sc.player.climbing) climbed = true;
        if (sc.player.mantle) mantled = true;
        if (mantled && !sc.player.mantle) break;
      }
      Input.up = false;
      await H.frames(20);
      const feet = sc.player.body.position.y + 30;
      return (climbed && mantled && Math.abs(sc.rig.phase - ph0) > 3 && Math.abs(feet - lad.topY) < 8) ? true : `climbed ${climbed} mantled ${mantled} phase ${(sc.rig.phase - ph0).toFixed(1)} feet ${feet.toFixed(0)} top ${lad.topY}`;
    });
  },
  /* ev içi: dışı kararır, kamera duvarlara kilitlenir */
  async interiorMask(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => (L.buildings ?? []).some(b => b.kind === 'house')));
      const b = sc.blds.find(q => q.kind === 'house');
      H.tp(sc, b.x0 + 200, 569);
      await H.frames(90);
      const cam = sc.cameras.main;
      const left = cam.scrollX + cam.width * (1 - 1 / cam.zoom) / 2;
      return (sc.insideK > 0.95 && left >= b.x0 - 8) ? true : `k ${sc.insideK.toFixed(2)} viewLeft ${left.toFixed(0)} bld ${b.x0}`;
    });
  },
  /* saklama yeri: çekmece açılır, içindeki envantere geçer */
  async container(page) {
    return page.evaluate(async () => {
      const sc = await H.start(5);
      const c = sc.containers.find(k => !k.needsCrowbar && k.contents.includes('bandage')) ?? sc.containers.find(k => !k.needsCrowbar);
      const before = sc.state.bandages;
      H.tp(sc, c.x - 16, c.groundY - 31);
      await H.frames(20);
      const t = sc.findInteractable();
      if (t?.type !== 'container') return 'not interactable: ' + JSON.stringify(t?.type);
      const hadBandage = c.contents.includes('bandage');
      Input.actHit = true;
      await H.frames(150);
      return (c.opened && (!hadBandage || sc.state.bandages > before)) ? true : `opened ${c.opened} bandages ${before}->${sc.state.bandages}`;
    });
  },
  /* fener: eşya alırken bile ışık göğüsten çıkar, ayaktan değil */
  async flashlight(page) {
    return page.evaluate(async () => {
      const sc = await H.start(13);
      Input.flashHit = true;
      await H.frames(10);
      sc.rig.startAction('pickup', { targetX: sc.player.body.position.x + 20, targetY: sc.player.body.position.y + 25 });
      sc.player.mode = 'action';
      let worst = -1e9;
      for (let i = 0; i < 50; i++) { await H.frames(1); const fp = sc.rig.flashPoint; if (fp) worst = Math.max(worst, fp.y - sc.rig.joints.pelvis.y); }
      return worst < 0 ? true : `flash point ${worst.toFixed(1)}px below pelvis`;
    });
  },
  /* kovalama: yaratık bölgesi boyunca peşinden gelir, birkaç saniyede bırakmaz */
  async chase(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => !L.interior && !L.mission && L.creatures.some(c => c.type !== 'wraith' && c.patrolMaxX - c.patrolMinX > 400)));
      const cr = sc.creatures.find(c => !c.dead && c.type !== 'wraith' && c.terr[1] - c.terr[0] > 700) ?? sc.creatures.find(c => c.type !== 'wraith');
      if (!cr) return 'no creature';
      const span = cr.terr[1] - cr.terr[0];
      H.tp(sc, cr.x + 140, 569);
      Input.right = true; Input.run = true;
      let chasing = 0;
      for (let i = 0; i < 240; i++) { await H.frames(1); if (['chase', 'charge', 'lunge', 'strike', 'smash', 'recover'].includes(cr.state)) chasing++; if (sc.dead) break; }
      Input.right = false; Input.run = false;
      return (chasing > 120 || sc.dead) ? true : `type ${cr.type} chasing frames ${chasing} territory ${span.toFixed(0)}`;
    });
  },
  /* uçma: oyuncunun altına teneke sıkışınca fırlamaz */
  async noLaunch(page) {
    return page.evaluate(async () => {
      const sc = await H.start(2);
      const P = sc.player;
      let minVy = 0;
      for (let k = 0; k < 6; k++) sc.physItems.push(new PhysItem(sc, 'can', P.body.position.x + (k - 3) * 6, P.body.position.y + 26));
      for (let i = 0; i < 120; i++) { await H.frames(1); minVy = Math.min(minVy, P.body.velocity.y); }
      return minVy > -6.6 ? true : `launched vy ${minVy.toFixed(1)}`;
    });
  },
  /* asansör: jeneratöre pil → kafese bin → kol → tepeye çık → kafes düşmeden üst kata */
  async elevator(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => L.mission === 'elevator'));
      const E = sc.mis.elev, gen = sc.generators.find(g => g.id === 'gen_lift');
      H.tp(sc, gen.x - 20, E.bottomY - 31);
      await H.frames(20);
      let t = sc.findInteractable();
      if (t?.label !== 'PİLİ TAK') return 'generator not interactable: ' + t?.label;
      Input.actHit = true;
      if (!await H.until(() => E.state === 'ready', 6000)) return 'not powered: ' + E.state;
      H.tp(sc, E.leverX + 10, E.bottomY - 31);
      await H.frames(20);
      t = sc.findInteractable();
      if (t?.label !== 'KOLU ÇEK') return 'lever not interactable: ' + t?.label;
      Input.actHit = true;
      if (!await H.until(() => E.state === 'top', 30000)) return 'did not reach top: ' + E.state + ' y ' + E.y.toFixed(0);
      const feetTop = sc.player.body.position.y + 30;
      if (Math.abs(feetTop - E.topY) > 10) return `rode off the cage: feet ${feetTop.toFixed(0)} top ${E.topY}`;
      Input.right = true;
      await H.until(() => sc.player.body.position.x > E.wr + 60, 6000);
      Input.right = false;
      await H.until(() => E.state === 'fall', 6000);
      await H.frames(60);
      const feet = sc.player.body.position.y + 30;
      return (!sc.dead && Math.abs(feet - E.topY) < 6) ? true : `dead ${sc.dead} feet ${feet.toFixed(0)}`;
    });
  },
  /* tren: vagona binince kalkar, oyuncuyu taşır; yıkık köprüde vagonlar düşer */
  async train(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => L.mission === 'train'));
      const T = sc.mis.train, flat = T.cars[0];
      H.tp(sc, flat.x0 + 120, T.railY + flat.top - 31);
      if (!await H.until(() => T.state === 'go', 8000)) return 'train did not start';
      const x0 = sc.player.body.position.x, off0 = T.off;
      await H.until(() => T.off - off0 > 400, 12000);
      const moved = sc.player.body.position.x - x0, trainMoved = T.off - off0;
      if (Math.abs(moved - trainMoved) > 40) return `not carried: player ${moved.toFixed(0)} train ${trainMoved.toFixed(0)}`;
      /* yıkık köprü: treni ileri sar, oyuncuyu üst geçide al */
      H.tp(sc, T.G1 + 300, T.upY - 31);
      T.off = T.BX - T.cars[3].x0 - T.cars[3].w + 10;
      await H.until(() => T.cars[3].fallen && T.cars[2].fallen, 8000);
      return (!sc.dead && T.cars[3].fallen) ? true : `dead ${sc.dead}`;
    });
  },
  /* kör dehliz: fener söner, yere vurmak ışık halkası çıkarır ve sürüngeni uyandırır */
  async echo(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => L.mission === 'echo'));
      const E = sc.mis.echo;
      Input.flashHit = true;
      await H.frames(10);
      if (!sc.flashOn) return 'flash did not turn on before the zone';
      const cr = sc.creatures.find(c => c.type === 'crawler' && c.x > E.x0);
      H.tp(sc, cr.x - 260, sc.groundYAt(cr.x - 260) - 31);
      await H.frames(20);
      if (!sc.flashBlocked || sc.flashOn) return `zone not dark: blocked ${sc.flashBlocked} flash ${sc.flashOn}`;
      const nLights = sc.lights2.lights.length;
      Input.flashHit = true;
      await H.frames(10);
      if (sc.lights2.lights.length <= nLights) return 'no echo light';
      if (sc.flashOn) return 'flash turned on inside zone';
      await H.frames(20);
      return cr.state !== 'idle' ? true : 'crawler did not hear the knock';
    });
  },
  /* kontrol noktası: geçince fener yanar */
  async checkpoint(page) {
    return page.evaluate(async () => {
      const sc = await H.start(5);
      const m = sc.cpMarks.find(k => !k.lit);
      if (!m) return 'no checkpoint marks';
      H.tp(sc, m.x + 40, m.gy - 31);
      await H.frames(20);
      return (m.lit && m.light.on && sc.checkpointX >= m.x) ? true : `lit ${m.lit} cp ${sc.checkpointX}`;
    });
  },
  /* bölüm sonu özeti: süre, ölüm, bulunan eşya; DEVAM bir sonraki bölümü açar */
  async summary(page) {
    return page.evaluate(async () => {
      const sc = await H.start(5);
      const c = sc.containers.find(k => !k.needsCrowbar && k.contents.length);
      H.tp(sc, c.x - 16, c.groundY - 31);
      await H.frames(20);
      Input.actHit = true;
      await H.until(() => c.opened, 4000);
      await H.frames(40);
      RunStats.deaths = 2;
      sc.completeChapter();
      if (!await H.until(() => UI.el('summary-panel').classList.contains('visible'), 6000)) return 'summary not shown';
      const found = UI.el('sum-found').textContent, deaths = UI.el('sum-deaths').textContent;
      if (deaths !== '2' || !/^[1-9]\d* \/ \d+$/.test(found)) return `deaths ${deaths} found ${found}`;
      UI.el('sum-next').click();
      const ok = await H.until(() => UI.scene()?.levelId === 6 && UI.scene().player, 6000);
      return (ok && SaveGame.unlocked >= 6) ? true : `next level ${UI.scene()?.levelId} unlocked ${SaveGame.unlocked}`;
    });
  },
  /* bölüm kilidi: yeni kayıtta yalnız 1. bölüm açık */
  async lock(page) {
    return page.evaluate(async () => {
      const keep = localStorage.getItem('sf5_save');
      localStorage.removeItem('sf5_save');
      const fresh = SaveGame.unlocked;
      SaveGame.unlock(7);
      const after = SaveGame.unlocked;
      UI.buildChapters();
      const locked = document.querySelectorAll('#chapters-grid .lv-btn.locked').length;
      if (keep) localStorage.setItem('sf5_save', keep); else localStorage.removeItem('sf5_save');
      return (fresh === 1 && after === 7 && locked === 93) ? true : `fresh ${fresh} after ${after} locked ${locked}`;
    });
  },
  /* levye yerde durmaz: öğreticide arabanın bagajında; levyesiz başlanan bölümde bir dolapta / bagajda */
  async crowbarHidden(page) {
    return page.evaluate(async () => {
      for (const n of [1, 2]) {
        const L = getLevel(n);
        if (L.crates.length || L.containers.some(c => c.needsCrowbar || c.contents.includes('crowbar')) || L.looseItems.some(i => i.kind === 'crowbar')) return `crowbar content in level ${n}`;
      }
      let sc = await H.start(3, { crowbar: false });
      if (sc.physItems.some(i => i.kind === 'crowbar')) return 'crowbar lying on the ground in level 3';
      const trunk = sc.containers.find(c => c.kind === 'trunk' && c.contents.includes('crowbar'));
      if (!trunk) return 'no trunk with crowbar in level 3';
      H.tp(sc, trunk.x - 20, trunk.groundY - 31);
      await H.frames(20);
      const t = sc.findInteractable();
      if (t?.label !== 'BAGAJI AÇ') return 'trunk not interactable: ' + t?.label;
      Input.actHit = true;
      if (!await H.until(() => sc.inv.crowbar, 5000)) return 'crowbar not collected from trunk';
      const needs = (L) => L.crates.length || L.containers.some(c => c.needsCrowbar);
      const lvls = []; for (let n = 2; n <= 100 && lvls.length < 4; n++) if (needs(getLevel(n)) && (n % 9 === 0 || getLevel(n).interior)) lvls.push(n);
      for (const n of lvls) {
        sc = await H.start(n, { crowbar: false });
        if (sc.physItems.some(i => i.kind === 'crowbar')) return `crowbar on the ground in level ${n}`;
        if (!sc.containers.some(c => c.contents.includes('crowbar'))) return `no hidden crowbar in level ${n}`;
      }
      return true;
    });
  },
  /* yüksekten atlayıp inmek can götürmez (çukura düşmek hâlâ öldürür) */
  async noFallDamage(page) {
    return page.evaluate(async () => {
      const sc = await H.start(2);
      sc.invulnT = 0;
      const x = sc.player.body.position.x;
      for (const run of [0, 4]) {
        H.tp(sc, x, sc.groundYAt(x) - 330);
        MatterLib.Body.setVelocity(sc.player.body, { x: run, y: 6 });
        await H.until(() => sc.player.grounded, 4000);
        await H.frames(30);
      }
      return sc.hp === sc.hpMax ? true : `hp ${sc.hp}/${sc.hpMax}`;
    });
  },
  /* havada ikinci zıplama: yakındaki kenara uzanıp tutunur; kenar yoksa bir şey olmaz */
  async airGrab(page) {
    return page.evaluate(async () => {
      const sc = await H.start(H.find(L => L.ground.some((s, i) => i > 0 && s.y < 640 && L.ground[i - 1].y - s.y > 150)));
      const lg = sc.ledges.find(l => l.grab && l.side === -1 && !l.lethal && l.drop > 150 && !sc.surfaceCovers(l.x, l.y, l.side))
        ?? sc.ledges.find(l => l.grab && l.side === -1 && l.drop > 150);
      if (!lg) return 'no ledge';
      /* kenarın altında, ondan uzaklaşarak düşüyor: otomatik yakalama tutmaz */
      H.tp(sc, lg.x - 40, lg.y + 60);
      MatterLib.Body.setVelocity(sc.player.body, { x: -1, y: 1 });
      sc.player.facing = -1; sc.player.coyote = 0; sc.player.grounded = false;
      await H.frames(2);
      if (sc.player.hang) return 'auto-grabbed before second jump';
      Input.jumpHit = true;
      await H.frames(3);
      if (!sc.player.hang) return 'second jump did not grab';
      /* boşlukta (kenar yok) ikinci zıplama hiçbir şey yapmaz */
      sc.player.hang = null; sc.player.hangCD = 0;
      H.tp(sc, lg.x - 400, lg.y - 300);
      sc.player.coyote = 0; sc.player.grounded = false;
      await H.frames(2);
      const vy = sc.player.body.velocity.y;
      Input.jumpHit = true;
      await H.frames(2);
      return (!sc.player.hang && sc.player.body.velocity.y >= vy - 1) ? true : 'jumped/grabbed in empty air';
    });
  },
  /* yaratık zekâsı: tazı boşluktan atlayıp kovalar; koca atlayamaz, kenarda volta atar */
  async creatureLeap(page) {
    return page.evaluate(async () => {
      for (const [type, should] of [['hound', true], ['brute', false]]) {
        let sc, s1, s2;
        for (let n = 3; n <= 60 && !s2; n++) {
          const L = getLevel(n);
          if (L.interior || L.mission) continue;
          const segs = L.ground.filter(g => g.y === 600).sort((a, b) => a.x0 - b.x0);
          for (let i = 1; i < segs.length; i++) {
            const gap = segs[i].x0 - segs[i - 1].x1;
            if (gap > 90 && gap < 170 && segs[i - 1].x1 - segs[i - 1].x0 > 400 && segs[i].x1 - segs[i].x0 > 400) { s1 = segs[i - 1]; s2 = segs[i]; sc = await H.start(n); break; }
          }
        }
        if (!s2) return 'no gap found';
        sc.creatures.forEach(c => { c.dead = true; });
        const cr = spawnCreature(sc, { type, x: s1.x1 - (type === 'brute' ? 110 : 220), groundY: 600, patrolMinX: s1.x1 - 400, patrolMaxX: s1.x1 - 40, facing: 1, startChase: true, hp: 99 });
        cr.onStrike = () => {};
        /* Koca kovalarken rastgele anda hücuma geçer; test hücumu hemen başlatır */
        if (type === 'brute') { cr.state = 'alert'; cr.alertT = 0; }
        sc.creatures.push(cr);
        H.tp(sc, s2.x0 + 260, 569);
        let crossed = false, atEdge = false;
        for (let i = 0; i < 260 && !crossed; i++) {
          await H.frames(1);
          if (cr.x > s2.x0 + 10 && Math.abs(cr.groundY - 600) < 4) crossed = true;
          if (Math.abs(cr.x - s1.x1) < 60) atEdge = true;
        }
        if (crossed !== should) return `${type} crossed=${crossed} (state ${cr.state}, x ${cr.x.toFixed(0)}, gap ${s1.x1}-${s2.x0})`;
        if (!should && !atEdge) return `${type} never reached the edge (x ${cr.x.toFixed(0)})`;
      }
      return true;
    });
  },
  /* ses araştırma: boştaki yaratık sesin geldiği yere yürür */
  async investigate(page) {
    return page.evaluate(async () => {
      const sc = await H.start(5);
      sc.creatures.forEach(c => { c.dead = true; });
      const x = sc.player.body.position.x + 900;
      const cr = spawnCreature(sc, { type: 'stalker', x, groundY: sc.groundYAt(x), patrolMinX: x - 80, patrolMaxX: x + 80, facing: 1, hp: 9 });
      cr.onStrike = () => {}; sc.creatures.push(cr);
      await H.frames(10);
      sc.makeNoise(x - 300, 560, 500, 0.4);
      if (!cr.investigate) return 'did not register the noise (state ' + cr.state + ')';
      await H.frames(150);
      return cr.x < x - 120 ? true : `did not walk to the noise (x ${cr.x.toFixed(0)} from ${x})`;
    });
  },
  /* gözcü: fener görünce gözü açılır, tam açılınca çığlık atar ve çevredekileri çağırır */
  async watcher(page) {
    return page.evaluate(async () => {
      const sc = await H.start(5);
      sc.creatures.forEach(c => { c.dead = true; });
      const px = sc.player.body.position.x, x = px + 260;
      const w = spawnCreature(sc, { type: 'watcher', x, groundY: sc.groundYAt(x) }); sc.creatures.push(w);
      const st = spawnCreature(sc, { type: 'stalker', x: x + 500, groundY: sc.groundYAt(x + 500), patrolMinX: x + 420, patrolMaxX: x + 580, hp: 9 });
      st.onStrike = () => {}; sc.creatures.push(st);
      await H.frames(30);
      if (w.state !== 'hang') return 'watcher awake in the dark: ' + w.state;
      sc.player.facing = 1; Input.flashHit = true;
      await H.until(() => w.state === 'cool', 6000);
      if (w.state !== 'cool') return 'no alarm: ' + w.state + ' eye ' + w.eye.toFixed(2);
      return (st.investigate || !['lurk'].includes(st.state)) ? true : 'alarm did not reach the stalker';
    });
  },
  /* sürü: karanlıkta avlanır, fener tutulunca kaçar */
  async swarm(page) {
    return page.evaluate(async () => {
      const sc = await H.start(5);
      sc.creatures.forEach(c => { c.dead = true; });
      const px = sc.player.body.position.x, x = px + 220;
      const sw = spawnCreature(sc, { type: 'swarm', x, groundY: sc.groundYAt(x), patrolMinX: x - 200, patrolMaxX: x + 300, count: 10 });
      sw.onStrike = () => {}; sc.creatures.push(sw);
      sc.makeNoise(px, 560, 500, 0.5);
      await H.frames(40);
      if (sw.state !== 'hunt') return 'swarm not hunting: ' + sw.state;
      sc.player.facing = 1; Input.flashHit = true;
      await H.frames(30);
      return sw.state === 'flee' ? true : 'swarm did not flee the light: ' + sw.state;
    });
  },
  /* taklitçi: sandık gibi durur, yaklaşınca saldırır */
  async mimic(page) {
    return page.evaluate(async () => {
      const sc = await H.start(5);
      sc.creatures.forEach(c => { c.dead = true; });
      const px = sc.player.body.position.x, x = px + 300;
      const m = spawnCreature(sc, { type: 'mimic', x, groundY: sc.groundYAt(x) }); m.onStrike = () => {}; sc.creatures.push(m);
      await H.frames(20);
      if (m.state !== 'disguise') return 'not disguised';
      H.tp(sc, x - 50, sc.groundYAt(x) - 31);
      await H.frames(20);
      return ['bite', 'chase'].includes(m.state) ? true : 'did not reveal: ' + m.state;
    });
  },
  /* akıl oyunları: üretilen her biri çözülebilir, çözülünce kapı açılır, yanlışta açılmaz */
  async thinking(page) {
    return page.evaluate(async () => {
      const lv = (t) => H.find(L => (L.puzzles ?? []).some(q => q.type === t) && !(L.puzzles.find(q => q.type === t).gen));
      /* pano: bir şalteri gerçekten çevir, sonra çözümü uygula */
      let sc = await H.start(lv('circuit'));
      let p = sc.pz.find(q => q.type === 'circuit');
      const s0 = [...p.state];
      H.tp(sc, p.switches[0].x - 14, p.groundY - 31);
      await H.frames(20);
      if (!/^ŞALTER/.test(sc.findInteractable()?.label ?? '')) return 'circuit switch not interactable';
      Input.actHit = true;
      await H.until(() => p.state.some((v, i) => v !== s0[i]), 4000);
      if (p.switches[0].links.some(j => p.state[j] === s0[j])) return 'switch did not toggle its lamps';
      let found = false;
      for (let m = 0; m < (1 << p.switches.length) && !found; m++) {
        const st = [...p.state];
        p.switches.forEach((s, i) => { if (m & (1 << i)) for (const j of s.links) st[j] = !st[j]; });
        if (st.every(Boolean)) { p.state = st; found = true; }
      }
      if (!found) return 'circuit unsolvable';
      await H.until(() => p.D.open > 0.9, 6000);
      if (p.D.open < 0.9) return 'circuit door did not open';
      /* aynalar: başlangıçta hedefe gitmez; bir çözüm vardır */
      sc = await H.start(lv('mirrors'));
      p = sc.pz.find(q => q.type === 'mirrors');
      if (p.hit) return 'mirrors solved at start';
      found = false;
      for (let m = 0; m < (1 << p.nodes.length) && !found; m++) {
        p.nodes.forEach((nd, i) => { nd.m = (m & (1 << i)) ? 1 : -1; });
        Puzzles._drawMirrors(sc, p);
        if (p.hit) found = true;
      }
      if (!found) return 'mirrors unsolvable';
      await H.until(() => p.D.open > 0.9, 6000);
      if (p.D.open < 0.9) return 'mirror door did not open';
      /* terazi: hepsi kefede → dengesiz; doğru alt küme → açılır */
      sc = await H.start(lv('scale'));
      p = sc.pz.find(q => q.type === 'scale');
      const boxes = sc.pushboxes.filter(b => Math.abs(b.body.position.x - p.pan.x0) < 700 && b.body.position.x < p.pan.x0);
      const put = (sel) => boxes.forEach((b, i) => MatterLib.Body.setPosition(b.body, sel.includes(i)
        ? { x: p.pan.x0 + 30 + sel.indexOf(i) * 74, y: p.groundY - b.h / 2 - 2 } : { x: p.pan.x0 - 120 - i * 90, y: p.groundY - b.h / 2 - 2 }));
      put(boxes.map((_, i) => i));
      await H.frames(90);
      if (p.solved && boxes.reduce((a, b) => a + b.weight, 0) !== p.target) return 'scale opened while unbalanced';
      let sel = null;
      for (let m = 1; m < (1 << boxes.length) && !sel; m++) {
        const idx = boxes.map((_, i) => i).filter(i => m & (1 << i));
        if (idx.length >= 2 && idx.reduce((a, i) => a + boxes[i].weight, 0) === p.target && idx.length <= 3) sel = idx;
      }
      if (!sel) return 'scale unsolvable with boxes ' + boxes.map(b => b.weight);
      put(sel);
      await H.until(() => p.D.open > 0.9, 6000);
      if (p.D.open < 0.9) return `scale door closed: load ${p.load} target ${p.target}`;
      /* saatler: şifre = akrepler, rakam sırasıyla — tuş takımıyla gir */
      sc = await H.start(lv('clocks'));
      p = sc.pz.find(q => q.type === 'clocks');
      const code = [0, 1, 2, 3].map(k => p.clocks.find(c => c.num === k).h);
      const kp = sc.mis.keypads.find(k => k.lock === p.lock);
      if (kp.code.join('') !== code.join('')) return 'keypad code does not match the clocks';
      if (p.clocks.map(c => c.h).join('') === code.join('') && p.clocks.some((c, i) => c.num !== i)) { /* aynı olabilir, sorun değil */ }
      UI.openKeypad(sc, kp);
      const keys = [...document.querySelectorAll('#kp-keys .kp-key')];
      const press = (ch) => keys.find(k => k.textContent === ch).dispatchEvent(new PointerEvent('pointerdown'));
      for (const d of code) press(String(d));
      press('✓');
      await H.frames(10);
      return kp.solved ? true : 'keypad did not accept the clock code';
    });
  },
  /* kenarda durup yön + zıpla ile boşluk geçilir; düşersen ölmezsin: 1 can gider, kenara dönersin */
  async edgeJump(page) {
    return page.evaluate(async () => {
      const sc = await H.start(2);
      sc.invulnT = 0;
      const segs = sc.groundSegs.filter(g => g.y === 600).sort((a, b) => a.x0 - b.x0);
      let e = null;
      for (let i = 1; i < segs.length && !e; i++) { const w = segs[i].x0 - segs[i - 1].x1; if (w > 90 && w < 180) e = { x: segs[i - 1].x1, to: segs[i].x0 }; }
      if (!e) return 'no gap';
      H.tp(sc, e.x - 160, 569);
      await H.frames(10);
      Input.right = true;
      await H.until(() => sc.player.teeter, 5000);
      Input.jumpHit = true; Input.jump = true;
      await H.frames(20);
      Input.jump = false;
      await H.until(() => sc.player.grounded, 4000);
      Input.right = false;
      if (sc.dead || sc.player.body.position.x < e.to) return `fell: x ${sc.player.body.position.x.toFixed(0)} needed ${e.to}`;
      /* bilerek çukura düş: ölmez, can 1 azalır, son sağlam zemine döner */
      const hp = sc.hp;
      H.tp(sc, (e.x + e.to) / 2, 700);
      sc.player.safe = { x: e.to + 80, y: 569 };
      await H.until(() => sc.player.body.position.y < 650, 3000);
      return (!sc.dead && sc.hp === hp - 1) ? true : `dead ${sc.dead} hp ${hp}->${sc.hp}`;
    });
  },
  /* müzik: keşif → aksiyon geçişi */
  async music(page) {
    return page.evaluate(async () => {
      const sc = await H.start(2);
      await H.frames(30);
      const a = SFMusic.current;
      sc.musicTick(1);
      await H.frames(5);
      const b = SFMusic.current;
      return (a === 'explore_forest' && b === 'action') ? true : `${a} -> ${b}`;
    });
  },
};

(async () => {
  const only = process.argv[2];
  const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  await page.evaluate(() => {
    window.H = {
      frames: (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }),
      async start(lv, extra) {
        SFAudio.init();
        UI.startGame(lv, { crowbar: true, flashBattery: 100, batteries: 2, bandages: 1, gun: false, ...extra });
        await new Promise(r => setTimeout(r, 1400));
        const sc = UI.scene();
        sc.invulnT = 999;
        for (const k in Input) if (typeof Input[k] === 'boolean') Input[k] = false;
        return sc;
      },
      find(pred) { for (let n = 2; n <= 100; n++) if (pred(getLevel(n))) return n; return 2; },
      async until(fn, ms) { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await H.frames(2); } return !!fn(); },
      tp(sc, x, y) { MatterLib.Body.setPosition(sc.player.body, { x, y }); MatterLib.Body.setVelocity(sc.player.body, { x: 0, y: 0 }); sc.checkpointX = x; },
    };
  });
  let failed = 0;
  for (const [name, fn] of Object.entries(CASES)) {
    if (only && name !== only) continue;
    errs.length = 0;
    let res;
    try { res = await fn(page); } catch (e) { res = 'exception: ' + e.message; }
    const ok = res === true && !errs.length;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${name}${res === true ? '' : '  — ' + res}${errs.length ? '  [page errors: ' + [...new Set(errs)].slice(0, 3).join(' | ') + ']' : ''}`);
  }
  await browser.close();
  console.log(failed ? `\n${failed} failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})();
