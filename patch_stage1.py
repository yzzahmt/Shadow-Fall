import re

with open('index.html', 'r') as f:
    code = f.read()

# 1. Inject Raycaster and WeatherSystem classes right before class GameScene
raycaster_code = """
/* ========================================================= */
/* ADVANCED 2D RAYCASTING & LIGHTING ENGINE (Shadow-Fall)    */
/* ========================================================= */
class ShadowRaycaster {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(51); // Above darkRT, below vignette
    this.geometry = [];
  }
  
  updateGeometry(houses, crates, enemies) {
    this.geometry = [];
    // Add screen borders to bound shadows
    const cam = this.scene.cameras.main;
    const wx = cam.worldView.x - 200, wy = cam.worldView.y - 200;
    const ww = cam.worldView.width + 400, wh = cam.worldView.height + 400;
    this.geometry.push({ x1: wx, y1: wy, x2: wx+ww, y2: wy });
    this.geometry.push({ x1: wx+ww, y1: wy, x2: wx+ww, y2: wy+wh });
    this.geometry.push({ x1: wx+ww, y1: wy+wh, x2: wx, y2: wy+wh });
    this.geometry.push({ x1: wx, y1: wy+wh, x2: wx, y2: wy });
    
    // Add houses
    for (const h of houses.getChildren()) {
      if (!h.active) continue;
      const hx = h.x - h.displayWidth/2, hy = h.y - h.displayHeight/2;
      const hw = h.displayWidth, hh = h.displayHeight;
      this.geometry.push({x1:hx, y1:hy, x2:hx+hw, y2:hy});
      this.geometry.push({x1:hx+hw, y1:hy, x2:hx+hw, y2:hy+hh});
      this.geometry.push({x1:hx+hw, y1:hy+hh, x2:hx, y2:hy+hh});
      this.geometry.push({x1:hx, y1:hy+hh, x2:hx, y2:hy});
    }
    // Add crates
    for (const c of crates.getChildren()) {
      if (!c.active) continue;
      const cx = c.x - 25, cy = c.y - 25;
      this.geometry.push({x1:cx, y1:cy, x2:cx+50, y2:cy});
      this.geometry.push({x1:cx+50, y1:cy, x2:cx+50, y2:cy+50});
      this.geometry.push({x1:cx+50, y1:cy+50, x2:cx, y2:cy+50});
      this.geometry.push({x1:cx, y1:cy+50, x2:cx, y2:cy});
    }
  }

  castRays(lightX, lightY, radius) {
    this.graphics.clear();
    if (radius <= 0) return;
    
    let points = [];
    for (let seg of this.geometry) {
      points.push({x: seg.x1, y: seg.y1});
      points.push({x: seg.x2, y: seg.y2});
    }
    
    let uniquePoints = [];
    for (let p of points) {
      let duplicate = false;
      for (let up of uniquePoints) {
        if (Math.abs(p.x - up.x) < 0.1 && Math.abs(p.y - up.y) < 0.1) { duplicate = true; break; }
      }
      if (!duplicate) uniquePoints.push(p);
    }

    let angles = [];
    for (let p of uniquePoints) {
      let angle = Math.atan2(p.y - lightY, p.x - lightX);
      angles.push(angle - 0.00001, angle, angle + 0.00001);
    }
    
    angles.sort((a, b) => a - b);
    let polygon = [];
    
    for (let angle of angles) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let closestIntersect = null;
      let minT1 = radius;
      
      for (let seg of this.geometry) {
        let intersect = this.getIntersection(lightX, lightY, lightX+dx*radius, lightY+dy*radius, seg.x1, seg.y1, seg.x2, seg.y2);
        if (intersect && intersect.param < minT1) {
          minT1 = intersect.param;
          closestIntersect = intersect;
        }
      }
      if (closestIntersect) polygon.push(closestIntersect);
      else polygon.push({x: lightX + dx*radius, y: lightY + dy*radius});
    }
    
    this.graphics.fillStyle(0xFFFFFF, 0.07);
    this.graphics.beginPath();
    this.graphics.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
      this.graphics.lineTo(polygon[i].x, polygon[i].y);
    }
    this.graphics.closePath();
    this.graphics.fillPath();
  }

  getIntersection(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
    let s1_x = p1_x - p0_x, s1_y = p1_y - p0_y;
    let s2_x = p3_x - p2_x, s2_y = p3_y - p2_y;
    let s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
    let t = ( s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      return { x: p0_x + (t * s1_x), y: p0_y + (t * s1_y), param: t };
    }
    return null;
  }
}

/* ========================================================= */
/* DYNAMIC WEATHER & FLUID PARTICLES SYSTEM                  */
/* ========================================================= */
class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.rainParticles = scene.add.particles(0, 0, 'pxTex', {
      x: { min: 0, max: scene.data0 ? scene.data0.width : 5000 },
      y: -100,
      lifespan: 1400,
      speedY: { min: 400, max: 600 },
      speedX: -100,
      scaleY: { start: 15, end: 15 },
      scaleX: { start: 0.5, end: 0.5 },
      tint: 0x555566,
      alpha: 0.3,
      quantity: 4,
      frequency: 20
    }).setDepth(60);
    this.wind = -100;
  }
  update(time, dt) {
    this.wind = -100 + Math.sin(time*0.001)*80;
    this.rainParticles.gravityX = this.wind;
  }
}

class GameScene extends Phaser.Scene {"""

code = code.replace("class GameScene extends Phaser.Scene {", raycaster_code)

# 2. Add instantiation in GameScene setupLighting and updateLight
old_setup_light = """  setupLighting() {
    const zoom = Math.max(0.6, this.scale.height / 720);"""
new_setup_light = """  setupLighting() {
    this.raycaster = new ShadowRaycaster(this);
    this.weather = new WeatherSystem(this);
    const zoom = Math.max(0.6, this.scale.height / 720);"""
code = code.replace(old_setup_light, new_setup_light)

old_update_light = """    this.darkRT.erase(this.spotImg, lx - wv.x, ly - wv.y);

    /* namlu alevi anlık aydınlatır */"""
new_update_light = """    this.darkRT.erase(this.spotImg, lx - wv.x, ly - wv.y);

    // Advanced Raycasting
    if (k.lanternOn && pct > 0) {
      this.raycaster.updateGeometry(this.houseG, this.pushableG, this.enemyG);
      this.raycaster.castRays(lx, ly, r*2.6);
    } else {
      this.raycaster.graphics.clear();
    }
    this.weather.update(time, dt);

    /* namlu alevi anlık aydınlatır */"""
code = code.replace(old_update_light, new_update_light)

with open('index.html', 'w') as f:
    f.write(code)

print("Stage 1 complete.")
