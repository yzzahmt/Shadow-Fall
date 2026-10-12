/* SHADOW FALL — runtime smoke test (headless Chrome)
   Loads every level, holds "run right" for a few seconds and reports any
   page error. Usage: node tests/smoke.js [from] [to] */
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');

const from = +(process.argv[2] ?? 0), to = +(process.argv[3] ?? 100);
const url = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  let errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url);
  await new Promise(r => setTimeout(r, 800));
  let bad = 0;
  for (let n = from; n <= to; n++) {
    errs = [];
    await page.evaluate((lv) => { SFAudio.init(); UI.startGame(lv, { crowbar: true, flashBattery: 100, batteries: 2, bandages: 1 }); }, n);
    await new Promise(r => setTimeout(r, 1500));
    const info = await page.evaluate(async () => {
      const sc = UI.scene();
      if (!sc || !sc.player) return { ok: !!sc, x: 0 };
      Input.right = true; Input.run = true;
      for (let i = 0; i < 150; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (i % 40 === 20) Input.jumpHit = true, Input.jump = true;
        if (i % 40 === 30) Input.jump = false;
      }
      Input.right = false; Input.run = false;
      return { ok: true, x: Math.round(sc.player.body.position.x), dead: sc.dead, music: SFMusic.current };
    });
    const line = `level ${String(n).padStart(3)}  x=${String(info.x).padStart(5)} ${info.dead ? 'DEAD ' : '     '} ${info.music ?? ''}`;
    if (errs.length) { bad++; console.log(line + '\n    ' + [...new Set(errs)].slice(0, 4).join('\n    ')); }
    else console.log(line);
  }
  await browser.close();
  console.log(bad ? `\n${bad} level(s) with errors` : '\nno runtime errors');
  process.exit(bad ? 1 : 0);
})();
