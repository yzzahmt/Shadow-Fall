/* Shadow Fall — icon / splash / store art generator
   Draws the app mark (a figure at the lip of a glowing fissure under a cold
   moon, the red scarf as the only colour) and exports every Android density,
   the Android 12 splash icon, legacy splash screens and Play Store art. */
import { createCanvas } from 'canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const store = join(root, 'assets', 'store');
mkdirSync(store, { recursive: true });

const save = (canvas, file, type = 'image/png') => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, canvas.toBuffer(type, type === 'image/jpeg' ? { quality: 0.94 } : undefined));
};

/* deterministic jitter for the fissure */
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function background(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.5, w * 0.75);
  g.addColorStop(0, '#1a1d27');
  g.addColorStop(0.55, '#0b0c12');
  g.addColorStop(1, '#030305');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/* the mark, drawn in a unit box (0..1) scaled to `s` at (ox, oy) */
function mark(ctx, ox, oy, s, opts = {}) {
  const X = (u) => ox + u * s, Y = (v) => oy + v * s;
  /* moon */
  if (opts.moon !== false) {
    ctx.save();
    ctx.shadowColor = 'rgba(214,220,235,0.55)'; ctx.shadowBlur = s * 0.08;
    ctx.fillStyle = '#c9ccd4';
    ctx.beginPath(); ctx.arc(X(0.7), Y(0.26), s * 0.115, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(11,12,18,0.85)';
    ctx.beginPath(); ctx.arc(X(0.735), Y(0.235), s * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  /* ground with a fissure opening downwards */
  const gy = 0.66;
  ctx.fillStyle = '#050507';
  ctx.beginPath();
  ctx.moveTo(X(-0.1), Y(gy));
  ctx.lineTo(X(0.47), Y(gy + 0.005));
  ctx.lineTo(X(0.5), Y(1.2)); ctx.lineTo(X(-0.1), Y(1.2)); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(X(0.56), Y(gy + 0.004));
  ctx.lineTo(X(1.1), Y(gy)); ctx.lineTo(X(1.1), Y(1.2)); ctx.lineTo(X(0.53), Y(1.2)); ctx.closePath(); ctx.fill();
  /* cold light rising from the crack */
  const lg = ctx.createLinearGradient(0, Y(1), 0, Y(gy - 0.12));
  lg.addColorStop(0, 'rgba(160,185,220,0.0)');
  lg.addColorStop(0.55, 'rgba(170,195,230,0.35)');
  lg.addColorStop(1, 'rgba(190,210,240,0.0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(X(0.47), Y(gy)); ctx.lineTo(X(0.56), Y(gy)); ctx.lineTo(X(0.6), Y(gy - 0.14)); ctx.lineTo(X(0.43), Y(gy - 0.14)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(205,218,240,0.9)'; ctx.lineWidth = Math.max(1, s * 0.006);
  seed = 11;
  for (const side of [0, 1]) {
    ctx.beginPath();
    let x = side ? 0.56 : 0.47, y = gy;
    ctx.moveTo(X(x), Y(y));
    while (y < 1.02) { y += 0.035; x += (side ? 1 : -1) * (rnd() * 0.012) + (side ? -0.004 : 0.004); ctx.lineTo(X(x), Y(y)); }
    ctx.stroke();
  }
  /* rim light along the ground line */
  ctx.strokeStyle = 'rgba(130,140,160,0.6)'; ctx.lineWidth = Math.max(1, s * 0.005);
  ctx.beginPath(); ctx.moveTo(X(-0.1), Y(gy)); ctx.lineTo(X(0.47), Y(gy + 0.004)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.56), Y(gy + 0.004)); ctx.lineTo(X(1.1), Y(gy)); ctx.stroke();
  /* figure at the edge, leaning toward the crack — same silhouette language as
     the in-game rig: heavy boots, long coat, backpack, short messy hair */
  ctx.save();
  ctx.shadowColor = 'rgba(150,160,185,0.6)'; ctx.shadowBlur = s * 0.025;
  ctx.fillStyle = '#060608';
  const fx = 0.39, fy = gy;
  const poly = (...pts) => { ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1])); for (const p of pts.slice(1)) ctx.lineTo(X(p[0]), Y(p[1])); ctx.closePath(); ctx.fill(); };
  /* legs (tapered) + boots */
  poly([fx - 0.03, fy - 0.12], [fx - 0.005, fy - 0.12], [fx - 0.022, fy - 0.012], [fx - 0.04, fy - 0.012]);
  poly([fx + 0.0, fy - 0.12], [fx + 0.028, fy - 0.118], [fx + 0.05, fy - 0.014], [fx + 0.03, fy - 0.01]);
  poly([fx - 0.048, fy - 0.016], [fx - 0.012, fy - 0.018], [fx - 0.006, fy], [fx - 0.05, fy]);
  poly([fx + 0.024, fy - 0.016], [fx + 0.062, fy - 0.016], [fx + 0.07, fy], [fx + 0.026, fy]);
  /* coat: broad shoulders → hips, tail flapping back */
  poly([fx - 0.03, fy - 0.235], [fx + 0.05, fy - 0.228], [fx + 0.038, fy - 0.13], [fx + 0.01, fy - 0.1], [fx - 0.06, fy - 0.098], [fx - 0.038, fy - 0.13]);
  /* backpack */
  ctx.beginPath(); ctx.roundRect?.(X(fx - 0.075), Y(fy - 0.222), s * 0.04, s * 0.075, s * 0.01); ctx.fill();
  /* neck + head + hair */
  poly([fx + 0.0, fy - 0.236], [fx + 0.024, fy - 0.238], [fx + 0.03, fy - 0.258], [fx + 0.006, fy - 0.258]);
  ctx.beginPath(); ctx.arc(X(fx + 0.024), Y(fy - 0.275), s * 0.024, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(X(fx + 0.016), Y(fy - 0.284), s * 0.022, 0, Math.PI * 2); ctx.fill();
  poly([fx - 0.002, fy - 0.282], [fx - 0.018, fy - 0.27], [fx + 0.004, fy - 0.272]);
  /* arms: one reaching toward the light, one back for balance */
  const limb = (pts, w) => {
    ctx.lineWidth = w * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#060608';
    ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1])); for (const p of pts.slice(1)) ctx.lineTo(X(p[0]), Y(p[1])); ctx.stroke();
  };
  limb([[fx + 0.035, fy - 0.222], [fx + 0.07, fy - 0.19], [fx + 0.1, fy - 0.168]], 0.019);
  limb([[fx - 0.02, fy - 0.22], [fx - 0.045, fy - 0.17], [fx - 0.035, fy - 0.135]], 0.018);
  ctx.restore();
  /* red scarf streaming back in the wind */
  ctx.fillStyle = '#7a2a2a';
  ctx.beginPath();
  ctx.moveTo(X(fx + 0.02), Y(fy - 0.244));
  ctx.quadraticCurveTo(X(fx - 0.05), Y(fy - 0.262), X(fx - 0.14), Y(fy - 0.225));
  ctx.lineTo(X(fx - 0.128), Y(fy - 0.208));
  ctx.quadraticCurveTo(X(fx - 0.05), Y(fy - 0.236), X(fx + 0.012), Y(fy - 0.226));
  ctx.closePath(); ctx.fill();
}

/* ---------- launcher icons ---------- */
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const L = Math.round(48 * k);
  for (const round of [false, true]) {
    const c = createCanvas(L, L), ctx = c.getContext('2d');
    ctx.save();
    ctx.beginPath();
    if (round) ctx.arc(L / 2, L / 2, L / 2, 0, Math.PI * 2);
    else { const r = L * 0.18; ctx.moveTo(r, 0); ctx.arcTo(L, 0, L, L, r); ctx.arcTo(L, L, 0, L, r); ctx.arcTo(0, L, 0, 0, r); ctx.arcTo(0, 0, L, 0, r); }
    ctx.clip();
    background(ctx, L, L);
    mark(ctx, L * 0.04, L * 0.02, L * 0.92);
    ctx.restore();
    save(c, join(res, `mipmap-${d}`, round ? 'ic_launcher_round.png' : 'ic_launcher.png'));
  }
  /* adaptive foreground: 108dp canvas, art inside the 66dp safe zone */
  const F = Math.round(108 * k);
  const c = createCanvas(F, F), ctx = c.getContext('2d');
  const safe = F * 0.66;
  ctx.save();
  ctx.beginPath(); ctx.arc(F / 2, F / 2, F * 0.5, 0, Math.PI * 2); ctx.clip();
  background(ctx, F, F);
  mark(ctx, (F - safe * 1.25) / 2, (F - safe * 1.25) / 2 + F * 0.02, safe * 1.25);
  ctx.restore();
  save(c, join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'));
}

/* ---------- Android 12+ splash icon (288dp box, 192dp visible circle) ---------- */
{
  const S = 864;                       // xxhdpi
  const c = createCanvas(S, S), ctx = c.getContext('2d');
  const r = S * (192 / 288) / 2;
  ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2); ctx.clip();
  background(ctx, S, S);
  mark(ctx, S / 2 - r * 1.05, S / 2 - r * 1.08, r * 2.1);
  ctx.restore();
  save(c, join(res, 'drawable-xxhdpi', 'splash_icon.png'));
}

/* ---------- legacy splash screens (pre-Android 12) ---------- */
const splash = (w, h, file) => {
  const c = createCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, w, h);
  const s = Math.min(w, h) * 0.42;
  const g = ctx.createRadialGradient(w / 2, h / 2, s * 0.1, w / 2, h / 2, s * 0.9);
  g.addColorStop(0, '#141720'); g.addColorStop(1, '#050507');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  mark(ctx, w / 2 - s / 2, h / 2 - s * 0.62, s);
  ctx.fillStyle = '#c9c5be';
  ctx.font = `${Math.round(s * 0.11)}px Georgia`;
  ctx.textAlign = 'center';
  const title = 'S H A D O W   F A L L';
  ctx.fillText(title, w / 2, h / 2 + s * 0.52);
  save(c, file);
};
splash(480, 320, join(res, 'drawable', 'splash.png'));
const land = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };
for (const [d, [w, h]] of Object.entries(land)) {
  splash(w, h, join(res, `drawable-land-${d}`, 'splash.png'));
  splash(h, w, join(res, `drawable-port-${d}`, 'splash.png'));
}

/* ---------- Play Store art ---------- */
{
  const c = createCanvas(512, 512), ctx = c.getContext('2d');
  background(ctx, 512, 512);
  mark(ctx, 20, 10, 472);
  save(c, join(store, 'icon-512.png'));
}
{
  const W = 1024, H = 500;
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1e28'); g.addColorStop(1, '#040406');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  /* distant tree line */
  ctx.fillStyle = '#0d0e14';
  seed = 3;
  for (let x = -20; x < W + 40; x += 26 + rnd() * 30) {
    const h = 60 + rnd() * 120;
    ctx.fillRect(x, H * 0.66 - h, 5 + rnd() * 4, h);
    ctx.beginPath(); ctx.moveTo(x + 3, H * 0.66 - h * 0.7); ctx.lineTo(x - 20 - rnd() * 20, H * 0.66 - h - 10); ctx.lineWidth = 2; ctx.strokeStyle = '#0d0e14'; ctx.stroke();
  }
  mark(ctx, W * 0.5 - 300, -40, 600, {});
  /* extend the ground to the full banner width */
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, -40 + 0.66 * 600, W * 0.5 - 300 + 0.47 * 600 - 60, H);
  ctx.fillRect(W * 0.5 - 300 + 0.56 * 600 + 60, -40 + 0.66 * 600, W, H);
  ctx.strokeStyle = 'rgba(130,140,160,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -40 + 0.66 * 600); ctx.lineTo(W * 0.5 - 300 + 0.47 * 600, -40 + 0.66 * 600 + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.5 - 300 + 0.56 * 600, -40 + 0.66 * 600 + 2); ctx.lineTo(W, -40 + 0.66 * 600); ctx.stroke();
  ctx.fillStyle = '#d6d2ca';
  ctx.font = '64px Georgia';
  ctx.textAlign = 'left';
  const t = 'SHADOW FALL';
  let x = 70;
  for (const ch of t) { ctx.fillText(ch, x, 120); x += ctx.measureText(ch).width + 14; }
  ctx.fillStyle = '#7a766e';
  ctx.font = 'italic 24px Georgia';
  ctx.fillText('peşinden atladım', 74, 160);
  save(c, join(store, 'feature-graphic-1024x500.png'));
}
console.log('icons, splash and store art generated');
