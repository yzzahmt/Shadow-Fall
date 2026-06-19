import re

with open('index.html', 'r') as f:
    code = f.read()

# 1. Add crossorigin to Phaser script
code = code.replace('<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js" crossorigin="anonymous"></script>')

# 2. Fix IK spider NaN bug
code = code.replace('let d = Math.hypot(dx, dy);', 'let d = Math.hypot(dx, dy);\n        if(d <= 0.001) d = 0.001;')

# 3. Remove old this.raycaster and this.weather from updateLight
old_raycast = """    // Advanced Raycasting
    if (k.lanternOn && pct > 0) {
      this.raycaster.updateGeometry(this.houseG, this.pushableG, this.enemyG);
      this.raycaster.castRays(lx, ly, r*2.6);
    } else {
      this.raycaster.graphics.clear();
    }
    this.weather.update(time, dt);"""

code = code.replace(old_raycast, "    // Delegated to IKManager")

# 4. Remove old this.weather and this.raycaster from create()
code = code.replace('this.weather = new WeatherSystem(this);', '')
code = code.replace('this.raycaster = new ShadowRaycaster(this);', '')

with open('index.html', 'w') as f:
    f.write(code)

print("Cleaned index.html successfully")
