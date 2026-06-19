with open('index.html', 'r') as f:
    code = f.read()

# 1. Physics Pickups
old_spawn_pickup = """  spawnPickup(x, y, type) {
    const keys = { heart:'heartTex', battery:'battTex', flare:'flareTex' };
    const img = this.pickupG.create(x, y, keys[type] || 'battTex');
    img.setData('type', type);
    img.body.setSize(34, 40);
    if (type === 'flare') img.setScale(1.4);
    const glowKey = type === 'heart' ? 'redGlowTex' : (type === 'flare' ? 'redGlowTex' : 'memGlowTex');
    const glow = this.add.image(x, y, glowKey).setDepth(1).setScale(0.55).setAlpha(0.7);
    img.setData('glow', glow).setDepth(2);
    this.tweens.add({ targets:[img, glow], y:y-5, duration:1000+Math.random()*400, yoyo:true, repeat:-1, ease:'Sine.inOut' });
  }"""

new_spawn_pickup = """  spawnPickup(x, y, type) {
    if (this.mode === 'story' && this.levelN === 1) return; // No pickups in level 1
    const keys = { heart:'heartTex', battery:'battTex', flare:'flareTex' };
    const img = this.physics.add.sprite(x, y, keys[type] || 'battTex');
    img.setData('type', type);
    img.body.setSize(34, 40);
    img.body.setGravityY(700); // Give it gravity
    img.body.setBounce(0.3); // Slight bounce
    img.body.setDragX(500); // Friction
    this.physics.add.collider(img, this.platG); // Collide with ground
    this.physics.add.collider(img, this.pushableG); // Collide with crates
    this.pickupG.add(img); // Add to group for player overlap
    if (type === 'flare') img.setScale(1.4);
    const glowKey = type === 'heart' ? 'redGlowTex' : (type === 'flare' ? 'redGlowTex' : 'memGlowTex');
    const glow = this.add.image(x, y, glowKey).setDepth(1).setScale(0.55).setAlpha(0.7);
    img.setData('glow', glow).setDepth(2);
    
    // Update glow position in update block, but we can do it via a custom event or just let it float.
    // For now, glow follows img using a fast loop.
    this.events.on('postupdate', () => {
        if(img.active && glow.active) {
            glow.x = img.x; glow.y = img.y;
        }
    });
  }"""

code = code.replace(old_spawn_pickup, new_spawn_pickup)

# 2. Chest break logic
# I need to find where chest breaks
with open('index.html', 'w') as f:
    f.write(code)

print("Updated spawnPickup")
