/* SHADOW FALL — otomatik tarayıcı testi
   Oyunu başlatır, konsol hatalarını toplar, ekran görüntüsü alır. */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8736;
const ROOT = __dirname;

// mini statik sunucu
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(p);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1280,720', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'shot_menu.png' });

  const mode = process.argv[2] || 'intro';

  if (mode === 'intro') {
    await page.click('#m-newgame');
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'shot_intro1.png' });
    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: 'shot_intro2.png' });
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'shot_intro3.png' });
  } else {
    // bölüm testi: node test_game.js <1-150> — bölümü açıp ekran görüntüsü alır
    const ch = parseInt(mode, 10);
    await page.evaluate((c) => {
      localStorage.setItem('sf4_save', JSON.stringify({ unlocked: 150, current: c, state: {} }));
    }, ch);
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate((c) => { UI.hide('menu'); UI.startGame(c, { gun: c >= 18, loaded: 7, mags: 2, bandages: 2, batteries: 2, flashBattery: 100 }); }, ch);
    await new Promise(r => setTimeout(r, 3500));
    await page.screenshot({ path: `shot_ch${ch}_a.png` });
    // sağa yürü + zıpla simülasyonu
    await page.keyboard.down('KeyD');
    await new Promise(r => setTimeout(r, 2500));
    await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: `shot_ch${ch}_b.png` });
    await new Promise(r => setTimeout(r, 2500));
    await page.keyboard.up('KeyD');
    await page.keyboard.press('KeyE');
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: `shot_ch${ch}_c.png` });
  }

  console.log('--- CONSOLE ERRORS ---');
  console.log(errors.length ? errors.slice(0, 30).join('\n') : '(temiz)');

  await browser.close();
  server.close();
  process.exit(0);
})().catch(e => { console.error('TEST FAIL:', e.message); process.exit(1); });
