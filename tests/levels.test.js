/* SHADOW FALL — level generation integrity test (node, no browser)
   Generates all 100 levels and validates geometry, puzzles, loot and links. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, window: {}, navigator: { maxTouchPoints: 0 }, Math, Set, Map, JSON, Object, Array };
ctx.Atmo = {
  _mulberry(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },
};
vm.createContext(ctx);
for (const f of ['js/items.js', 'js/story.js', 'js/puzzles.js', 'js/thinking.js', 'js/buildings.js', 'js/levelgen.js', 'js/missions.js', 'js/escapes.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const getLevel = vm.runInContext('getLevel', ctx);
const CONTAINER_DEFS = vm.runInContext('CONTAINER_DEFS', ctx);

let fails = 0;
const fail = (n, msg) => { console.log(`  ✗ level ${n}: ${msg}`); fails++; };
const stats = { puzzles: {}, creatures: {}, containers: {}, interior: 0 };

for (let n = 1; n <= 100; n++) {
  let L;
  try { L = getLevel(n); } catch (e) { fail(n, 'generation error: ' + e.stack.split('\n').slice(0, 3).join(' | ')); continue; }
  if (!(L.worldW > 1500)) fail(n, `worldW too small (${L.worldW})`);
  const groundAt = (x) => L.ground.some(s => x >= s.x0 && x <= s.x1 && s.y <= 640);
  if (!groundAt(L.playerStart.x)) fail(n, 'no ground at start');
  if (!L.bomb && !groundAt(L.exitX)) fail(n, 'no ground at exit');
  /* every level has at least one puzzle-type obstacle */
  const puzzleCount = (L.puzzles ?? []).length + L.levers.length + L.generators.length + (L.simons ?? []).length
    + (L.keypads ?? []).length + L.pushboxes.length + L.doors.filter(d => d.needsKey).length + (L.fuseBoxes ?? []).length;
  if (!puzzleCount && !L.mission) fail(n, 'no puzzle');
  for (const p of (L.puzzles ?? [])) stats.puzzles[p.type] = (stats.puzzles[p.type] ?? 0) + 1;
  /* loot rules */
  if (L.looseItems.some(i => i.kind === 'bandage')) fail(n, 'bandage lying loose');
  for (const c of L.crates) if (c.contents.includes('bandage')) fail(n, 'bandage inside a crate');
  for (const c of L.containers) {
    if (!CONTAINER_DEFS[c.kind]) fail(n, 'unknown container ' + c.kind);
    else if (c.contents.includes('bandage') && !CONTAINER_DEFS[c.kind].med) fail(n, `bandage in non-medical ${c.kind}`);
    stats.containers[c.kind] = (stats.containers[c.kind] ?? 0) + 1;
  }
  const bandages = L.containers.reduce((a, c) => a + c.contents.filter(k => k === 'bandage').length, 0);
  if (bandages < 1 && !L.vehicle) fail(n, 'no bandage available');
  /* locked doors need a key placed before them */
  for (const d of L.doors.filter(d => d.locked && d.needsKey)) {
    const key = L.containers.some(c => c.x < d.x && c.contents.includes('key')) || L.crates.some(c => c.x < d.x && c.contents.includes('key'));
    if (!key) fail(n, `locked door @${Math.round(d.x)} without key`);
  }
  /* generators need a battery before them */
  for (const g of L.generators) {
    const ok = L.containers.some(c => c.x < g.x + 60 && c.contents.includes('battery'));
    if (!ok) fail(n, `generator @${Math.round(g.x)} without battery`);
  }
  for (const lv of L.levers) if (!L.leverLinks[lv.id]) fail(n, `lever ${lv.id} unlinked`);
  for (const c of L.creatures) {
    stats.creatures[c.type] = (stats.creatures[c.type] ?? 0) + 1;
    if (!(c.patrolMaxX > c.patrolMinX)) fail(n, 'creature patrol range invalid');
  }
  if (L.interior) stats.interior++;
  /* top-level gaps must be bridged */
  const top = L.ground.filter(s => s.y <= 640).sort((a, b) => a.x0 - b.x0);
  for (let i = 1; i < top.length; i++) {
    const gapW = top[i].x0 - top[i - 1].x1;
    if (gapW > 200) {
      const bridged = L.platforms.some(p => p.x + p.w > top[i - 1].x1 - 20 && p.x < top[i].x0 + 20)
        || L.water.some(w => w.x0 <= top[i - 1].x1 + 30 && w.x1 >= top[i].x0 - 30)
        || L.collapses.some(c => Math.abs(c.x0 - top[i - 1].x1) < 10)
        || (L.puzzles ?? []).some(p => Math.abs((p.x0 ?? p.plate?.x0 ?? p.left?.x0 ?? -1e9) - top[i - 1].x1) < 40)
        || L.ground.some(s => s.y > 640 && s.x0 <= top[i - 1].x1 + 10 && s.x1 >= top[i].x0 - 10)
        || (L.bridges ?? []).some(b => b.x0 <= top[i - 1].x1 && b.x1 >= top[i].x0)
        || L.vehicle;
      if (!bridged) fail(n, `${Math.round(gapW)}px unbridged gap @${Math.round(top[i - 1].x1)}`);
    }
  }
}
console.log('puzzles   ', JSON.stringify(stats.puzzles));
console.log('creatures ', JSON.stringify(stats.creatures));
console.log('containers', JSON.stringify(stats.containers));
console.log('interior levels:', stats.interior);
console.log(fails ? `\n${fails} problem(s)` : '\nall 100 levels OK');
process.exit(fails ? 1 : 0);
