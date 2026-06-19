import re
with open('index.html', 'r') as f:
    code = f.read()

# Fix house Y placement
code = code.replace("L.houses.push({ x: x+w/2, y: GROUND_Y-135, w: 220, h: 135 });", "L.houses.push({ x: x+w/2, y: GROUND_Y-75, w: 220, h: 150 });")

# Fix house collision body sizing in buildLevel
old_house_code = """    for (const hs of L.houses) {
      const img = this.houseG.create(hs.x, hs.y, 'houseTex');
      img.setDisplaySize(hs.w, hs.h).refreshBody();
      img.body.setSize(hs.w, hs.h);
      img.setDepth(3);
    }"""
new_house_code = """    for (const hs of L.houses) {
      const img = this.houseG.create(hs.x, hs.y, 'houseTex');
      img.setDisplaySize(hs.w, hs.h);
      img.body.setSize(hs.w, hs.h);
      img.body.setOffset(0, 0);
      img.refreshBody();
      img.setDepth(3);
    }"""
code = code.replace(old_house_code, new_house_code)

# Increase jump velocity slightly to make sure climbing the house from the crate is smooth
code = code.replace("JUMP_VY: -660,", "JUMP_VY: -700,")

with open('index.html', 'w') as f:
    f.write(code)

print("Patch 3 applied successfully.")
