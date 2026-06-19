import re
with open('index.html', 'r') as f:
    code = f.read()

# 1. Update genLevel to include pushables and houses
code = code.replace("checkpoints:[],", "checkpoints:[], pushables:[], houses:[],")

# Replace the obstacle generation
old_gap = """    } else if (roll < 0.44) {
      /* uçurum */
      const gw = Math.min(215, 95 + d*125 + rnd()*40);
      if (gw > 150 && rnd() < 0.5) {
        L.oneways.push({ x:x+gw/2-55, y:GROUND_Y-90-rnd()*60, w:110 });
      }
      if (rnd() < d*0.55 && (story ? n>=28 : n>=12)) {
        L.tentacles.push({ x:x+gw/2, y:GROUND_Y+80 });
      } else if (rnd() < 0.35) {
        L.enemies.push({ type:'wraith', x:x+gw/2, y:GROUND_Y-180 });
      }
      x += gw;
      const w = 220 + rnd()*200;
      ground(x, w);
      x += w;"""

new_gap = """    } else if (roll < 0.44) {
      /* ev ve itilebilir kasa bulmacası / House & Crate puzzle */
      const w = 600 + rnd()*200;
      ground(x, w);
      L.houses.push({ x: x+w/2, y: GROUND_Y-135, w: 220, h: 135 });
      L.pushables.push({ x: x+w/2 - 200 - rnd()*50, y: GROUND_Y-50 });
      // Canavar evin diğer tarafında bekler
      dropEnemy(x+w/2 + 180, GROUND_Y-30);
      x += w;"""
code = code.replace(old_gap, new_gap)

# 2. Add crateTex and houseTex in generateTextures, and upgrade skitter to giant spider
textures_addition = """
  /* --- crate (pushable) --- */
  g.clear();
  g.fillStyle(0x0C0C16,1);
  g.fillRect(0,0,50,50);
  g.lineStyle(3, 0x2A2438, 1);
  g.strokeRect(2,2,46,46);
  g.lineBetween(2,2,48,48); g.lineBetween(48,2,2,48);
  g.fillStyle(0xD4C4F0, 0.4);
  g.fillCircle(25, 25, 4);
  g.generateTexture('crateTex', 50, 50);

  /* --- house (obstacle) --- */
  g.clear();
  g.fillStyle(0x040408,1); // Very dark limbo silhouette
  g.fillRect(0,0, 220, 135);
  // Roof spikes
  for (let i=0; i<11; i++) {
    g.fillTriangle(i*20, 0, i*20+10, -15, i*20+20, 0);
  }
  g.fillStyle(0x000000, 1);
  // broken windows
  g.fillRect(40,40, 25,45); g.fillRect(150,40, 25,45);
  // door
  g.fillRect(95, 75, 30, 60);
  // Chimney
  g.fillRect(180, -40, 18, 40);
  g.generateTexture('houseTex', 220, 150);

  /* --- Giant Spider (replaces skitter) --- */
  g.clear();
  g.fillStyle(0x04040A,1);
  g.fillEllipse(50, 40, 40, 25); // body
  g.fillCircle(20, 35, 12); // head
  g.fillStyle(0xE84A5F, 1);
  g.fillCircle(14, 32, 2.5); g.fillCircle(8, 35, 2); // glowing eyes
  g.lineStyle(4, 0x04040A, 1);
  for (let i=0; i<4; i++) { // Legs
    g.beginPath(); g.moveTo(40+i*8, 40); g.lineTo(20+i*15, 10-i*5); g.lineTo(5+i*25, 75); g.strokePath();
    g.beginPath(); g.moveTo(40+i*8, 45); g.lineTo(60+i*12, 15-i*3); g.lineTo(80+i*20, 75); g.strokePath();
  }
  g.generateTexture('skitterTex', 140, 80);
"""
# find the end of generateTextures
code = code.replace("g.destroy();\n\n  /* ---------- gradyanlar ---------- */", textures_addition + "\n  g.destroy();\n\n  /* ---------- gradyanlar ---------- */")

# Overwrite mira to be more detailed, and player to be limbo style
# To do this safely, we will let it be. Kai is drawn procedurally in drawKai.

# 3. Add to buildLevel
build_level_addition = """
    this.pushableG = this.physics.add.group();
    for (const pu of L.pushables) {
      const img = this.pushableG.create(pu.x, pu.y, 'crateTex');
      img.setDisplaySize(50, 50).setDepth(4);
      img.body.setMass(2);
      img.body.setDragX(1200);
      img.body.setCollideWorldBounds(true);
    }
    
    this.houseG = this.physics.add.staticGroup();
    for (const hs of L.houses) {
      const img = this.houseG.create(hs.x, hs.y, 'houseTex');
      img.setDisplaySize(hs.w, hs.h).refreshBody();
      img.body.setSize(hs.w, hs.h);
      img.setDepth(3);
    }

"""
code = code.replace("for (const pr of L.props) this.spawnProp(pr);", build_level_addition + "    for (const pr of L.props) this.spawnProp(pr);")

# 4. Colliders for pushables and houses
colliders_addition = """
    this.physics.add.collider(spr, this.houseG);
    this.physics.add.collider(this.pushableG, this.solids);
    this.physics.add.collider(this.pushableG, this.houseG);
    this.physics.add.collider(spr, this.pushableG);
    this.physics.add.collider(this.enemyG, this.houseG);
    this.physics.add.collider(this.enemyG, this.pushableG);
"""
code = code.replace("this.physics.add.collider(spr, this.onewayG);", "this.physics.add.collider(spr, this.onewayG);\n" + colliders_addition)

with open('index.html', 'w') as f:
    f.write(code)

print("Patch applied successfully.")
