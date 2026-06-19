import re
with open('index.html', 'r') as f:
    code = f.read()

# Make platTex pure black
old_plat = """  /* --- platform: katmanlı küllenmiş taş --- */
  g.clear();
  g.fillStyle(0x1E1E33,1); g.fillRect(0,0,64,64);
  const rp = mulberry(7);
  g.fillStyle(0x262640,1);
  for (let i=0;i<7;i++) {
    const bx = rp()*56, by = 6+rp()*52, bw = 10+rp()*22, bh = 6+rp()*10;
    g.fillRoundedRect(bx, by, bw, bh, 2);
  }
  g.fillStyle(0x14142A,0.8);
  for (let i=0;i<14;i++) g.fillRect(rp()*60, 4+rp()*58, 1.5+rp()*4, 1.2);
  g.fillStyle(0x383358,1); g.fillRect(0,0,64,3);
  g.fillStyle(0x4A4470,0.6);
  for (let i=0;i<6;i++) g.fillRect(rp()*58, 0, 3+rp()*7, 1.6);
  g.fillStyle(0x6B6478,0.35);
  for (let i=0;i<4;i++) { const x = rp()*60; g.fillTriangle(x,3, x+3,3, x+1.5,6+rp()*5); }
  g.generateTexture('platTex',64,64);"""

new_plat = """  /* --- platform: siyah limbo zemini --- */
  g.clear();
  g.fillStyle(0x020204,1); g.fillRect(0,0,64,64);
  const rp = mulberry(7);
  g.fillStyle(0x000000,1);
  for (let i=0;i<7;i++) {
    const bx = rp()*56, by = 6+rp()*52, bw = 10+rp()*22, bh = 6+rp()*10;
    g.fillRoundedRect(bx, by, bw, bh, 2);
  }
  g.generateTexture('platTex',64,64);"""
code = code.replace(old_plat, new_plat)

# Make movTex pure black
old_mov = """  /* --- hareketli platform --- */
  g.clear();
  g.fillStyle(0x322E4E,1); g.fillRoundedRect(0,0,64,18,4);
  g.fillStyle(0x46406A,1); g.fillRect(2,0,60,2);
  g.fillStyle(0xD4C4F0,0.3); g.fillCircle(8,9,3); g.fillCircle(56,9,3);
  g.generateTexture('movTex',64,18);"""

new_mov = """  /* --- hareketli platform --- */
  g.clear();
  g.fillStyle(0x020204,1); g.fillRoundedRect(0,0,64,18,4);
  g.fillStyle(0x111111,1); g.fillRect(2,0,60,2);
  g.fillStyle(0xD4C4F0,0.5); g.fillCircle(8,9,2); g.fillCircle(56,9,2);
  g.generateTexture('movTex',64,18);"""
code = code.replace(old_mov, new_mov)

# Make spikeTex pure black
old_spike = """  /* --- dikenler: kemik --- */
  g.clear();
  for (let i=0;i<4;i++) {
    g.fillStyle(0x5C5468,1);
    g.fillTriangle(i*16,32, i*16+16,32, i*16+8,1);
    g.fillStyle(0x8F8AA0,1);
    g.fillTriangle(i*16+4,32, i*16+11,32, i*16+8,5);
    g.fillStyle(0xB8B0C4,0.7);
    g.fillTriangle(i*16+6,30, i*16+9,30, i*16+8,8);
  }
  g.generateTexture('spikeTex',64,32);"""

new_spike = """  /* --- dikenler --- */
  g.clear();
  for (let i=0;i<4;i++) {
    g.fillStyle(0x000000,1); // purely black
    g.fillTriangle(i*16,32, i*16+16,32, i*16+8,1);
    g.fillStyle(0x050505,1);
    g.fillTriangle(i*16+4,32, i*16+11,32, i*16+8,5);
  }
  g.generateTexture('spikeTex',64,32);"""
code = code.replace(old_spike, new_spike)

# Also update task.md
with open('/Users/ahmetyaz/.gemini/antigravity-ide/brain/124f1d15-6962-4edd-b321-9e6ae2daf70b/task.md', 'w') as t:
    t.write("- [x] Update procedural environment textures (Limbo style backgrounds, mist, dark silhouettes).\n- [x] Overhaul player sprite procedural generation (Detailed Limbo style survivor).\n- [x] Overhaul monster procedural generation (Giant Spiders, Deep Tentacles/Octopus, Shadows).\n- [x] Overhaul obstacle procedural generation (Detailed black houses, structures, pushable crates).\n- [x] Update genLevel to use the new complex structures (houses) and crates instead of simple floating platforms.\n- [x] Add pushable crate physics/logic to the GameScene.\n- [x] Ensure lighting and atmosphere match the Limbo aesthetic (high contrast, glow, deep darks).")

with open('index.html', 'w') as f:
    f.write(code)

print("Patch 4 applied successfully.")
