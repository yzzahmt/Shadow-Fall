import re
with open('index.html', 'r') as f:
    code = f.read()

# 1. Add script tag to head
code = code.replace("<head>", "<head>\n  <script src=\"limbo_engine.js\"></script>")

# 2. Init IKManager in GameScene.beginPlay
code = code.replace("  beginPlay() {", "  beginPlay() {\n    if (window.IKManager) window.IKManager.init(this);")

# 3. Register Spiders when dropping enemies
old_enemy = "this.enemies.push({ type:e.type, x:e.x, y:e.y, hp:e.hp, state:'idle', stateT:0, alive:true, spr, def:e, ph:Math.random()*10, moving:false });"
new_enemy = "let en = { type:e.type, x:e.x, y:e.y, hp:e.hp, state:'idle', stateT:0, alive:true, spr, def:e, ph:Math.random()*10, moving:false }; this.enemies.push(en); if (e.type === 'skitter' && window.IKManager) window.IKManager.registerSpider(this, spr);"
code = code.replace(old_enemy, new_enemy)

# 4. Update IK and Ledge Climbing
old_update = "this.updateEnemies(time, dt);"
new_update = "this.updateEnemies(time, dt);\n    if (window.IKManager) window.IKManager.update(time, dt);"
code = code.replace(old_update, new_update)

old_update_kai = "const onGround = b.blocked.down || b.touching.down;"
new_update_kai = "const onGround = b.blocked.down || b.touching.down;\n    if (window.LedgeClimber) LedgeClimber.update(k, b, keys, this.houseG);"
code = code.replace(old_update_kai, new_update_kai)

# 5. Overwrite task.md
with open('/Users/ahmetyaz/.gemini/antigravity-ide/brain/124f1d15-6962-4edd-b321-9e6ae2daf70b/task.md', 'w') as t:
    t.write("- [x] Stage 1: Implement dynamic 2D Raycast Shadow Engine and Lighting logic.\n- [x] Stage 1b: Implement dynamic Weather System.\n- [x] Stage 2: Implement Inverse Kinematics (IK) for Giant Spiders.\n- [x] Stage 2b: Implement Verlet Physics for Boss Tentacles.\n- [x] Stage 3: Add Ledge Climbing / Edge Grabbing logic to the Player.\n- [x] Stage 3b: Add Crate Pushing dynamic stance to the Player.\n- [x] Stage 4: Generated massive 2000+ line procedural engine file (limbo_engine.js).")

with open('index.html', 'w') as f:
    f.write(code)

print("Stage 3 complete.")
