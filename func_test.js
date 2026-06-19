/* SHADOW FALL v4 — fonksiyonel test (puppeteer)
   Giriş sinematiği, bölüm yükleme, insansı eşya alma, el feneri,
   karanlık/stealth, su yüzme, tabanca+şarjör, boss arenası.
   Not: headless ~15fps olduğundan zaman tabanlı mekanikler yavaş akar. */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8738;
const ROOT = __dirname;

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' });
    res.end(data);
  });
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) fails++;
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 400)));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.setItem('sf4_save', JSON.stringify({ unlocked: 150, current: 1, state: {} })));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(600);

  const startLevel = async (lv, state) => {
    await page.evaluate((l, s) => {
      UI.hide('menu'); UI.hide('chapters-panel'); UI.hide('death-panel');
      UI.startGame(l, s);
    }, lv, state ?? {});
    await sleep(3500);
  };
  const sc = (fn, ...args) => page.evaluate(fn, ...args);
  const key = async (code, ms = 120) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };

  /* ====== GİRİŞ SİNEMATİĞİ ====== */
  await startLevel(0);
  let r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return { isIntro: s.isIntro, hasKai: !!s.kai, hasMaria: !!s.mariaRig, t: s.introT };
  });
  check('giriş sinematiği çalışıyor', r.isIntro && r.hasKai && r.hasMaria && r.t > 0.5);
  await page.screenshot({ path: 'shot_v4_intro.png' });

  /* ====== BÖLÜM 1: Maria yoldaş + insansı eşya alma ====== */
  await startLevel(1);
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return { player: !!s.player, maria: !!s.maria, items: s.physItems.length, soldiers: s.soldiers.length };
  });
  check('bölüm 1 yüklendi (oyuncu + Maria)', r.player && r.maria);
  check('bölüm 1: asker yok (hikâye tutarlılığı)', r.soldiers === 0);

  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    const it = s.physItems.find(i => i.def.pickable && !i.picked);
    if (!it) return { found: false };
    const M = Phaser.Physics.Matter.Matter;
    M.Body.setPosition(s.player.body, { x: it.x - 30, y: s.groundYAt(it.x - 30) - 50 });
    M.Body.setVelocity(s.player.body, { x: 0, y: 0 });
    return { found: true, kind: it.kind };
  });
  if (r.found) {
    await sleep(900);
    await key('KeyE');
    await sleep(500);
    const act = await sc(() => UI.game.scene.getScene('game').rig.action?.name ?? null);
    check('insansı alma animasyonu (pickup) başladı', act === 'pickup', `eşya: ${r.kind}, aksiyon: ${act}`);
    await sleep(2500);
    const picked = await sc(() => UI.game.scene.getScene('game').physItems.some(i => i.picked));
    check('eşya el ile alındı', picked);
  } else check('alınabilir eşya bulundu', false);
  await page.screenshot({ path: 'shot_v4_ch1.png' });

  /* ====== BÖLÜM 13: karanlık + el feneri + pil ====== */
  await startLevel(13, { batteries: 2, flashBattery: 100 });
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return { dark: s.lights2.darkness, flashOn: s.flashOn };
  });
  check('bölüm 13 karanlık', r.dark > 0.4, `karanlık=${r.dark.toFixed(2)}`);
  await key('KeyF');
  await sleep(400);
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return { flashOn: s.flashOn, lightOn: s.flashLight.on, bat: s.state.flashBattery };
  });
  check('el feneri [F] açıldı', r.flashOn && r.lightOn);

  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    const sol = s.soldiers.find(x => !x.dead);
    if (!sol) return { skip: true };
    s.flashOn = false; s.flashLight.on = false;
    const M = Phaser.Physics.Matter.Matter;
    M.Body.setPosition(s.player.body, { x: sol.x - sol.facing * 320, y: sol.groundY - 50 });
    const proxy = { x: s.player.body.position.x, y: s.player.body.position.y, crouching: false, hidden: false };
    sol.facing = Math.sign(proxy.x - sol.x) || 1;
    const seenDark = sol.canSee(proxy, null);
    s.flashLight.on = true;
    s.flashLight.x = proxy.x; s.flashLight.y = proxy.y;
    const seenLit = sol.canSee(proxy, null);
    return { seenDark, seenLit };
  });
  if (!r.skip) {
    check('zifiri karanlıkta fener kapalıyken görünmez', r.seenDark === false);
    check('fener açıkken görünür', r.seenLit === true);
  }
  await page.screenshot({ path: 'shot_v4_dark.png' });

  /* ====== BÖLÜM 21: su fizikleri ====== */
  await startLevel(21);
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    if (!s.waters.length) return { skip: true };
    const w = s.waters[0];
    const M = Phaser.Physics.Matter.Matter;
    M.Body.setPosition(s.player.body, { x: (w.x0 + w.x1) / 2, y: w.surfaceY + 30 });
    return { waterCount: s.waters.length };
  });
  check('bölüm 21: su bölgeleri var', !r.skip, `adet=${r.waterCount ?? 0}`);
  await sleep(1200);
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return { swimming: s.player.swimming, inWater: s.player.inWater, mode: s.rig.mode };
  });
  check('yüzme modu aktif', r.swimming && r.mode === 'swim', `mode=${r.mode}`);
  await page.screenshot({ path: 'shot_v4_water.png' });

  /* ====== BÖLÜM 20: boss arenası + tabanca + şarjör ====== */
  await startLevel(20, { gun: true, loaded: 2, mags: 2, bandages: 2 });
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return {
      gate: !!s.bossGate, soldiers: s.soldiers.length,
      tough: s.soldiers.some(x => x.tough), bossName: s.ch.bossName,
    };
  });
  check('bölüm 20: boss kapısı + komutan', r.gate && r.tough, `${r.soldiers} asker, boss=${r.bossName}`);
  await key('KeyX');
  await sleep(300);
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return { loaded: s.state.loaded };
  });
  check('tabanca ateş etti', r.loaded === 1, `kalan=${r.loaded}`);
  await key('KeyX'); await sleep(600);
  await key('KeyR');
  await sleep(700);
  r = await sc(() => UI.game.scene.getScene('game').rig.action?.name ?? null);
  check('şarjör değiştirme animasyonu', r === 'reload');
  // animasyon bitene kadar bekle (düşük fps'te uzar)
  for (let i = 0; i < 24; i++) {
    const busy = await sc(() => !!UI.game.scene.getScene('game').rig.action);
    if (!busy) break;
    await sleep(500);
  }
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return {
      loaded: s.state.loaded, mags: s.state.mags,
      droppedMag: s.physItems.some(i => i.kind === 'magEmpty'),
    };
  });
  check('şarjör dolduruldu, eski şarjör yerde', r.loaded === 7 && r.mags === 1 && r.droppedMag,
    `dolu=${r.loaded} yedek=${r.mags} yerde=${r.droppedMag}`);
  await page.screenshot({ path: 'shot_v4_boss20.png' });

  /* ====== BÖLÜM 65: araba + yankesicilik kurulumu ====== */
  await startLevel(65, { gun: true, loaded: 7, mags: 1 });
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return {
      car: !!s.driveCar, keySoldier: s.soldiers.some(x => x.hasCarKey),
      barricades: s.barricades.length,
    };
  });
  check('bölüm 65: araba + anahtarlı asker + barikatlar', r.car && r.keySoldier && r.barricades > 0,
    `barikat=${r.barricades}`);

  /* ====== BÖLÜM 150: final boss ====== */
  await startLevel(150, { gun: true, loaded: 7, mags: 3 });
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    const boss = s.creatures.find(c => c.boss);
    return { boss: !!boss, hp: boss?.hp, scale: boss?.s, cine: s.ch.endCine };
  });
  check('bölüm 150: Geçit Bekçisi + final sinematiği', r.boss && r.cine === 'final',
    `hp=${r.hp} ölçek=${r.scale}`);
  await page.screenshot({ path: 'shot_v4_final.png' });

  /* ====== bandaj sarma ====== */
  await sc(() => {
    const s = UI.game.scene.getScene('game');
    s.hp = 2; s.state.bandages = 1;
  });
  await key('KeyQ');
  await sleep(600);
  r = await sc(() => UI.game.scene.getScene('game').rig.action?.name ?? null);
  check('bandaj sarma animasyonu', r === 'bandage');
  await sleep(8000);   // headless düşük fps — animasyon gerçek zamandan yavaş akar
  r = await sc(() => {
    const s = UI.game.scene.getScene('game');
    return { hp: s.hp, bd: s.state.bandages };
  });
  check('bandaj iyileştirdi', r.hp === 4 && r.bd === 0, `hp=${r.hp}`);

  /* ====== sayfa hataları ====== */
  check('JS hatası yok', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log(fails === 0 ? '\n✓ TÜM FONKSİYONEL TESTLER GEÇTİ' : `\n✗ ${fails} HATA`);
  await browser.close();
  server.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
