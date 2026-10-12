/* Shadow Fall — web build
   Copies the runtime files (no dev tooling, no tests) into www/ for Capacitor. */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const p of ['js', 'vendor', 'assets']) {
  if (existsSync(join(root, p))) cpSync(join(root, p), join(out, p), { recursive: true });
}
/* store/marketing art is not needed inside the app bundle */
rmSync(join(out, 'assets', 'store'), { recursive: true, force: true });

let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/SHADOW FALL · v[\d.]+/g, `SHADOW FALL · v${pkg.version}`);
writeFileSync(join(out, 'index.html'), html);
console.log(`www/ built (v${pkg.version})`);
