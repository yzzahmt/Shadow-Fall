/* SHADOW FALL — 150 bölüm üretim sağlamlık testi (node, tarayıcısız)
   Her bölümün üretilebildiğini, zeminin başlangıç/çıkışı kapsadığını,
   ganimet ekonomisini ve özel bölüm bayraklarını doğrular. */
'use strict';

// tarayıcı global'lerini taklit et
global.Atmo = {
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

const fs = require('fs');
const vm = require('vm');
const ctx = { Atmo: global.Atmo, console };
vm.createContext(ctx);
for (const f of ['js/story.js', 'js/levelgen.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
}

const getLevel = vm.runInContext('getLevel', ctx);
const BEATS = vm.runInContext('BEATS', ctx);
let fails = 0;
const fail = (msg) => { console.log('  ✗ ' + msg); fails++; };

let stats = { soldiers: 0, creatures: 0, water: 0, levers: 0, gens: 0, houses: 0, bosses: 0 };

for (let n = 1; n <= 150; n++) {
  let L;
  try { L = getLevel(n); } catch (e) { fail(`bölüm ${n} üretim hatası: ${e.message}`); continue; }
  if (!L.worldW || L.worldW < 1500) fail(`bölüm ${n}: worldW küçük (${L.worldW})`);
  if (L.exitX >= L.worldW) fail(`bölüm ${n}: exitX dünya dışında`);
  // başlangıç ve çıkışın altında zemin var mı
  const groundAt = (x) => L.ground.some(s => x >= s.x0 && x <= s.x1 && s.y <= 640);
  if (!groundAt(L.playerStart.x)) fail(`bölüm ${n}: başlangıçta zemin yok`);
  if (!groundAt(L.exitX)) fail(`bölüm ${n}: çıkışta zemin yok`);
  // zemin boşlukları zıplanabilir mi (üst seviye segmentler arası)
  const top = L.ground.filter(s => s.y <= 640).sort((a, b) => a.x0 - b.x0);
  for (let i = 1; i < top.length; i++) {
    const gapW = top[i].x0 - top[i - 1].x1;
    if (gapW > 200) {
      // arada platform, su veya merdiven köprüsü var mı
      const bridged = L.platforms.some(p => p.x + p.w > top[i - 1].x1 - 20 && p.x < top[i].x0 + 20)
        || L.water.some(w => w.x0 <= top[i - 1].x1 + 30 && w.x1 >= top[i].x0 - 30)
        || L.ground.some(s => s.y > 640 && s.x0 <= top[i - 1].x1 + 10 && s.x1 >= top[i].x0 - 10);
      if (!bridged) fail(`bölüm ${n}: ${Math.round(gapW)}px köprüsüz boşluk @${Math.round(top[i - 1].x1)}`);
    }
  }
  // jeneratör kapıları için pil garantisi
  for (const gn of L.generators) {
    const hasBattery = L.crates.some(c => c.x < gn.x + 50 && c.contents.includes('battery'))
      || L.looseItems.some(it => it.kind === 'battery' && it.x < gn.x + 50);
    if (!hasBattery) fail(`bölüm ${n}: jeneratör @${Math.round(gn.x)} öncesi pil yok`);
  }
  // kol → merdiven bağlantıları
  for (const lv of L.levers) {
    if (!L.leverLinks[lv.id]) fail(`bölüm ${n}: kol ${lv.id} bağlantısız`);
  }
  for (const id in L.genLinks) {
    if (!L.poweredDoors.some(p => p.id === L.genLinks[id].door)) fail(`bölüm ${n}: jeneratör ${id} kapısı yok`);
  }
  // ev bulmacası: kilitli kapı varsa anahtar kutusu da olmalı
  const lockedDoors = L.doors.filter(dd => dd.locked && dd.needsKey);
  for (const dd of lockedDoors) {
    const keyBefore = L.crates.some(c => c.x < dd.x && c.contents.includes('key'));
    if (!keyBefore) fail(`bölüm ${n}: kilitli kapı @${Math.round(dd.x)} öncesi anahtar yok`);
  }
  // boss bölümleri
  if (n % 10 === 0) {
    stats.bosses++;
    const gateEnemies = [...L.soldiers.filter(s => s.gate), ...L.creatures.filter(c => c.gate)];
    if (n !== 10 && !L.bossGate) fail(`bölüm ${n}: boss kapısı yok`);
    if (n !== 10 && gateEnemies.length === 0) fail(`bölüm ${n}: kapıya bağlı düşman yok`);
    if (!L.bossName) fail(`bölüm ${n}: boss adı yok`);
  }
  // perde 1'de asker olmamalı (Maria henüz kaçırılmadı)
  if (n <= 10 && L.soldiers.length && n !== 10) fail(`bölüm ${n}: erken asker`);
  stats.soldiers += L.soldiers.length;
  stats.creatures += L.creatures.length;
  stats.water += L.water.length;
  stats.levers += L.levers.length;
  stats.gens += L.generators.length;
}

// özel bölümler
const l18 = getLevel(18);
if (!l18.looseItems.some(i => i.kind === 'pistol')) fail('bölüm 18: tabanca yok');
const l65 = getLevel(65);
if (!l65.driveCar) fail('bölüm 65: sürülebilir araba yok');
if (!l65.soldiers.some(s => s.hasCarKey)) fail('bölüm 65: anahtar taşıyan asker yok');
if (!getLevel(10).endCine) fail('bölüm 10: kaçırılma sinematiği bayrağı yok');
if (!getLevel(150).endCine) fail('bölüm 150: final bayrağı yok');
// hikâye yoğunluğu: her 5 bölümde en az bir beat
for (let n = 5; n <= 150; n += 5) {
  const has = BEATS[n] || BEATS[n + 1] || BEATS[n - 1] || BEATS[n - 2] || BEATS[n + 2] || BEATS[n - 3];
  if (!has) fail(`~bölüm ${n} çevresinde hikâye beat'i yok`);
}

console.log(`\n150 bölüm üretildi. asker=${stats.soldiers} yaratık=${stats.creatures} su=${stats.water} kol=${stats.levers} jeneratör=${stats.gens} boss=${stats.bosses}`);
console.log(fails === 0 ? '✓ TÜM TESTLER GEÇTİ' : `✗ ${fails} HATA`);
process.exit(fails ? 1 : 0);
