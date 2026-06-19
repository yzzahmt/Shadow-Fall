with open('index.html', 'r') as f:
    code = f.read()

bad_math = """        let dx = k.spr.x - this.sprite.x;
        let dy = k.spr.y - this.sprite.y;
        let d = Math.hypot(dx, dy);
        let targetX = this.sprite.x;
        let targetY = this.sprite.y;
        
        if (d < 500) {
            targetX += (dx/d) * 1.5; // Move towards player"""

good_math = """        let dx = k.spr.x - this.sprite.x;
        let dy = k.spr.y - this.sprite.y;
        let d = Math.hypot(dx, dy);
        if (d <= 0.001) d = 0.001; // FIX: Prevent division by zero NaN!
        
        let targetX = this.sprite.x;
        let targetY = this.sprite.y;
        
        if (d < 500) {
            targetX += (dx/d) * 1.5; // Move towards player"""

code = code.replace(bad_math, good_math)

with open('index.html', 'w') as f:
    f.write(code)

print("Fixed NaN in spider")
