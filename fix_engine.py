with open('motor_engine.js', 'r') as f:
    code = f.read()

import re

new_init = """    init: function(scene) {
        try {
            this.scene = scene;
            this.graphics = scene.add.graphics().setDepth(15);
            this.atmosphere = new LimboAtmosphere(scene);
            this.shadows = new ShadowEngine(scene);
            this.tentacles = new VerletBossSystem(scene);
            this.tentacles.spawnTentacles(2000, 200, 12);
            
            if (scene.textures.exists('houseTex')) {
                scene.textures.remove('houseTex');
            }
            let g = scene.make.graphics({x:0, y:0, add:false});
            ProceduralArchitecture.generateGothicHouse(g, 220, 150);
            g.destroy();
        } catch (e) {
            console.error("IKManager INIT ERROR: ", e);
            alert("INIT ERROR: " + e.message);
        }
    },"""

code = re.sub(r"    init: function\(scene\) \{.*?g\.destroy\(\);\n    \},", new_init, code, flags=re.DOTALL)

with open('motor_engine.js', 'w') as f:
    f.write(code)
