import re
with open('index.html', 'r') as f:
    code = f.read()

# 1. Update OctoTex to look more terrifying and Limbo style
old_octo = """  /* DERİNLERDEN GELEN: dev kör ahtapot — soluk kör gözler */
  g.clear();
  g.fillStyle(0x140E26,1);
  g.fillEllipse(130,100,250,170);
  g.fillEllipse(130,38,180,105);
  g.fillStyle(0x1E1640,0.9);
  for (let i=0;i<5;i++) g.fillEllipse(50+i*40, 22+(i%2)*10, 26, 38);  // kafa kıvrımları
  g.fillStyle(0x251C42,1);
  g.fillEllipse(82,92,38,52); g.fillEllipse(178,92,38,52);  // göz yuvaları
  g.fillStyle(0xE8E4F0,0.92);                        // KÖR gözler — bembeyaz
  g.fillEllipse(82,92,22,34); g.fillEllipse(178,92,22,34);
  g.fillStyle(0xB8B4C8,0.5);
  g.fillEllipse(82,92,10,18); g.fillEllipse(178,92,10,18);
  g.lineStyle(2,0x4A4060,0.8);                       // yara izleri
  g.lineBetween(60,60, 100,120); g.lineBetween(156,64, 196,118);
  g.lineBetween(110,30, 150,46);
  g.generateTexture('octoTex',260,190);"""

new_octo = """  /* DERİNLERDEN GELEN: dev kör ahtapot — Limbo stili devasa gölge */
  g.clear();
  g.fillStyle(0x020204,1); // Very dark silhouette
  g.fillEllipse(130,100,250,170);
  g.fillEllipse(130,38,180,105);
  // Spikes and dark aura
  for (let i=0;i<12;i++) {
    g.fillTriangle(10+i*20, 40, 20+i*20, -30+Math.random()*20, 30+i*20, 40);
  }
  g.fillStyle(0xFFFFFF,0.85); // Glowing white empty eyes for contrast
  g.fillEllipse(82,92,18,30); g.fillEllipse(178,92,18,30);
  g.fillStyle(0x020204,1);
  g.fillEllipse(82,92,5,12); g.fillEllipse(178,92,5,12); // Slit pupils
  g.generateTexture('octoTex',260,190);"""
code = code.replace(old_octo, new_octo)

# 2. Update drawKai to make the player purely black silhouettes except for the lantern
old_draw_kai_colors = """    g.lineStyle(4.5, COLORS.SIL, 1);"""
new_draw_kai_colors = """    g.lineStyle(4.5, 0x020204, 1); // Limbo black"""
code = code.replace(old_draw_kai_colors, new_draw_kai_colors)

old_draw_kai_colors2 = """    g.fillStyle(COLORS.SIL, 1);"""
new_draw_kai_colors2 = """    g.fillStyle(0x020204, 1); // Limbo black"""
code = code.replace(old_draw_kai_colors2, new_draw_kai_colors2)

old_draw_kai_colors3 = """    g.lineStyle(4, COLORS.SIL, 1);"""
new_draw_kai_colors3 = """    g.lineStyle(4, 0x020204, 1);"""
code = code.replace(old_draw_kai_colors3, new_draw_kai_colors3)

# Make the scarf purely black too
old_scarf = """g.lineStyle(4.2 - i*0.55, COLORS.SCARF, 1 - i*0.07);"""
new_scarf = """g.lineStyle(4.2 - i*0.55, 0x010103, 1 - i*0.07);"""
code = code.replace(old_scarf, new_scarf)

# Update background generation to be more atmospheric and darker
old_bg_ridge = """  /* uzak: yüzen adalar + sivri kuleler */
  g.clear();
  const r1 = mulberry(404);
  g.fillStyle(0x0F0F18,1);"""
new_bg_ridge = """  /* uzak: yüzen adalar + sivri kuleler */
  g.clear();
  const r1 = mulberry(404);
  g.fillStyle(0x05050A,1); // Darker silhouettes"""
code = code.replace(old_bg_ridge, new_bg_ridge)

old_bg_mid = """  /* orta: ölü ağaçlar + kemik kemerler + çan kuleleri + asılı kafesler */
  g.clear();
  const r2 = mulberry(808);
  for (let i=0;i<11;i++) {
    const x = 30 + r2()*964, h = 160 + r2()*220;
    g.fillStyle(0x161625,1);"""
new_bg_mid = """  /* orta: ölü ağaçlar + kemik kemerler + çan kuleleri + asılı kafesler */
  g.clear();
  const r2 = mulberry(808);
  for (let i=0;i<18;i++) { // More dense forest/structures
    const x = 30 + r2()*964, h = 160 + r2()*220;
    g.fillStyle(0x0A0A12,1); // Darker"""
code = code.replace(old_bg_mid, new_bg_mid)

with open('index.html', 'w') as f:
    f.write(code)

print("Patch 2 applied successfully.")
