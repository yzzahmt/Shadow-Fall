with open('index.html', 'r') as f:
    code = f.read()

bad_shadow = """    updateGeometry(houses, crates) {
        this.geometry = [];
        let cam = this.scene.cameras.main;
        let wx = cam.worldView.x - 400, wy = cam.worldView.y - 400;
        let ww = cam.worldView.width + 800, wh = cam.worldView.height + 800;
        
        // Bounding box
        this.addRect(wx, wy, ww, wh);
        
        if(houses) {
            for (let h of houses.getChildren()) {"""

good_shadow = """    updateGeometry(houses, crates) {
        this.geometry = [];
        if(!this.scene || !this.scene.cameras || !this.scene.cameras.main) return;
        let cam = this.scene.cameras.main;
        let wx = cam.worldView.x - 400, wy = cam.worldView.y - 400;
        let ww = cam.worldView.width + 800, wh = cam.worldView.height + 800;
        if(isNaN(wx) || isNaN(wy) || isNaN(ww) || isNaN(wh)) return;
        
        // Bounding box
        this.addRect(wx, wy, ww, wh);
        
        if(houses && houses.getChildren) {
            for (let h of houses.getChildren()) {"""

code = code.replace(bad_shadow, good_shadow)

with open('index.html', 'w') as f:
    f.write(code)

print("Protected Shadow Geometry")
