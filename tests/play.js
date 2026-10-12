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
      async start(lv) {
        SFAudio.init();
        UI.startGame(lv, { crowbar: true, flashBattery: 100, batteries: 2, bandages: 1, gun: false });
        await new Promise(r => setTimeout(r, 1400));
        const sc = UI.scene();
        sc.invulnT = 999;
        for (const k in Input) if (typeof Input[k] === 'boolean') Input[k] = false;
        return sc;
      },
      find(pred) { for (let n = 2; n <= 100; n++) if (pred(getLevel(n))) return n; return 2; },
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
