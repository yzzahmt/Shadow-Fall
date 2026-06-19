import re
with open('index.html', 'r') as f:
    code = f.read()

# Add CSS for film grain and canvas filters
css_addition = """
    canvas {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      max-height: 100%;
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
      filter: grayscale(100%) contrast(1.2) brightness(0.85); /* Limbo Effect */
    }
    
    /* Film Grain Overlay */
    .film-grain {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.08;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }
"""

old_css = """    canvas {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      max-height: 100%;
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
    }"""
code = code.replace(old_css, css_addition)

# Add film grain div to body
old_body = """<body>
  <div id="game-container"></div>"""
new_body = """<body>
  <div class="film-grain"></div>
  <div id="game-container"></div>"""
code = code.replace(old_body, new_body)

# Increase fog intensity and scale
old_fog = """      const f = this.add.image(rnd()*this.data0.width, 360+rnd()*260, 'fogTex')
        .setDepth(40).setScale(3.5+rnd()*3).setAlpha(0.5).setTint(this.zone.fog);"""
new_fog = """      const f = this.add.image(rnd()*this.data0.width, 360+rnd()*260, 'fogTex')
        .setDepth(40).setScale(6.5+rnd()*5).setAlpha(0.8).setTint(this.zone.fog); // More dense fog"""
code = code.replace(old_fog, new_fog)

# Increase vignette alpha
old_vignette = """    this.vignette.setAlpha(pct < 0.22 && k.lanternOn ? (0.22-pct)/0.22 * 0.85 : 0);"""
new_vignette = """    this.vignette.setAlpha(pct < 0.22 && k.lanternOn ? (0.22-pct)/0.22 * 0.85 : 0.65); // Constant Limbo vignette"""
code = code.replace(old_vignette, new_vignette)

with open('index.html', 'w') as f:
    f.write(code)

print("Patch 5 applied successfully.")
