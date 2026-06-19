/* RIG LAB ekran görüntüsü — rig_lab.html'i açar, ızgarayı yakalar.
   Kullanım: node rig_shot.js [çıktı.png] */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8741, ROOT = __dirname;

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'rig_lab.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' });
    res.end(data);
  });
});

(async () => {
  const out = process.argv[2] || 'shot_lab.png';
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1080, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(`http://localhost:${PORT}/rig_lab.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction('window.__labReady === true', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1200));  // birkaç animasyon karesi aksın

  const canvas = await page.$('canvas');
  if (canvas) await canvas.screenshot({ path: out });
  else await page.screenshot({ path: out });

  console.log(errs.length ? ('HATA:\n' + errs.join('\n')) : 'OK — ' + out);
  await browser.close();
  server.close();
  process.exit(0);
})();
