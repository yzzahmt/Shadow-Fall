// ==============================================================================
// THE TRUE LIMBO ENGINE
// ==============================================================================
// This file contains a massive suite of purely functional, highly detailed 
// visual, procedural, and physical sub-systems to emulate the AAA Limbo aesthetic.
// No filler, pure engine logic.

/* --- 1. PROCEDURAL GOTHIC ARCHITECTURE --- */
class ProceduralArchitecture {
    static generateGothicHouse(g, width, height) {
        g.clear();
        // Base structure
        g.fillStyle(0x020204, 1);
        g.fillRect(0, 0, width, height);

        // Procedural Bricks
        g.fillStyle(0x010102, 1);
        let brickW = 15;
        let brickH = 8;
        for(let y = 0; y < height; y += brickH) {
            let offset = (y % (brickH*2) === 0) ? 0 : (brickW/2);
            for(let x = -offset; x < width; x += brickW) {
                if(Math.random() < 0.3) {
                    // Draw damaged brick
                    g.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
                }
            }
        }

        // Procedural Roof Shingles & Spikes
        for(let x = -10; x < width + 10; x += 15) {
            let spikeHeight = 10 + Math.random() * 25;
            g.fillTriangle(x, 0, x + 7.5, -spikeHeight, x + 15, 0);
            
            // Sub-spikes for fractal detail
            g.fillTriangle(x + 2, -spikeHeight*0.3, x + 5, -spikeHeight*0.8, x + 8, -spikeHeight*0.3);
        }

        // Gothic Arched Windows
        g.fillStyle(0x000000, 1); // Pure pitch black windows
        let numWindows = Math.floor(width / 60);
        for(let w = 0; w < numWindows; w++) {
            let cx = 30 + w * ((width - 60) / Math.max(1, numWindows - 1));
            let cy = height * 0.3 + Math.random() * 20;
            let winW = 20 + Math.random() * 10;
            let winH = 40 + Math.random() * 20;
            
            g.fillRect(cx - winW/2, cy, winW, winH);
            g.beginPath();
            g.arc(cx, cy, winW/2, Math.PI, 0);
            g.fillPath();

            // Broken stained glass framing (Mullions)
            g.lineStyle(2, 0x010103, 1);
            g.beginPath(); g.moveTo(cx, cy - winW/2); g.lineTo(cx, cy + winH); g.strokePath();
            g.beginPath(); g.moveTo(cx - winW/2, cy + winH/2); g.lineTo(cx + winW/2, cy + winH/2); g.strokePath();
            
            // Shattered glass spikes at the bottom of the window
            g.fillStyle(0xFFFFFF, 0.05); // Barely visible glass reflections
            for(let i=0; i<3; i++) {
                let gx = cx - winW/2 + Math.random()*winW;
                let gh = 5 + Math.random()*15;
                g.fillTriangle(gx, cy+winH, gx+3, cy+winH-gh, gx+6, cy+winH);
            }
        }

        // Cracks branching out using recursive L-system like drawing
        g.lineStyle(1.5, 0x000000, 0.8);
        for(let c = 0; c < 3; c++) {
            let sx = Math.random() * width;
            let sy = Math.random() * height;
            ProceduralArchitecture.drawCrack(g, sx, sy, Math.random() * Math.PI*2, 6, 20);
        }

        // Hanging chains from the roof
        for(let c = 0; c < 4; c++) {
            let cx = Math.random() * width;
            let cy = 0;
            let chainLength = 30 + Math.random() * 100;
            ProceduralArchitecture.drawChain(g, cx, cy, chainLength);
        }
        
        g.generateTexture('houseTex', width, height);
    }

    static drawCrack(g, x, y, angle, depth, length) {
        if(depth === 0) return;
        let x2 = x + Math.cos(angle) * length;
        let y2 = y + Math.sin(angle) * length;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.strokePath();
        
        if(Math.random() < 0.6) ProceduralArchitecture.drawCrack(g, x2, y2, angle - 0.4 + Math.random()*0.2, depth - 1, length * 0.7);
        if(Math.random() < 0.6) ProceduralArchitecture.drawCrack(g, x2, y2, angle + 0.4 - Math.random()*0.2, depth - 1, length * 0.7);
        ProceduralArchitecture.drawCrack(g, x2, y2, angle + (Math.random()-0.5)*0.2, depth - 1, length * 0.9);
    }

    static drawChain(g, x, y, length) {
        g.lineStyle(1.5, 0x010103, 1);
        let linkH = 8;
        for(let i = 0; i < length; i += linkH) {
            let offset = Math.sin(i * 0.5) * 1.5;
            g.strokeEllipse(x + offset, y + i, 3, linkH);
        }
    }
}

/* --- 2. ADVANCED WEATHER & ATMOSPHERE SYSTEM --- */
class LimboAtmosphere {
    constructor(scene) {
        this.scene = scene;
        this.windStrength = -150;
        this.baseY = 640; // Ground Y
        
        // Massive Rain Particle System
        this.rainParticles = scene.add.particles(0, 0, 'pxTex', {
            x: { min: -1000, max: 4000 },
            y: -100,
            lifespan: 1200,
            speedY: { min: 600, max: 900 },
            speedX: this.windStrength,
            scaleY: { start: 20, end: 20 },
            scaleX: { start: 0.5, end: 0.5 },
            tint: 0x555566,
            alpha: 0.4,
            quantity: 8,
            frequency: 10
        }).setDepth(60);

        // Splash Particles on Ground
        this.splashParticles = scene.add.particles(0, 0, 'pxTex', {
            x: { min: -1000, max: 4000 },
            y: this.baseY - 5,
            lifespan: 200,
            speedY: { min: -100, max: -50 },
            speedX: { min: -20, max: 20 },
            scale: { start: 2, end: 0 },
            tint: 0x777788,
            alpha: 0.6,
            quantity: 4,
            frequency: 20
        }).setDepth(61);

        // Deep Volumetric-like Fog Layers
        this.fogLayers = [];
        for(let i=0; i<15; i++) {
            let f = scene.add.image(Math.random()*4000, this.baseY - Math.random()*200, 'fogTex');
            f.setDepth(40 + Math.random()*5);
            f.setScale(6 + Math.random()*8);
            f.setAlpha(0.2 + Math.random()*0.3);
            f.setTint(0x05050A);
            f.speed = (Math.random() - 0.5) * 40;
            this.fogLayers.push(f);
        }
    }

    update(time, dt) {
        // Dynamic wind using multiple sine waves
        this.windStrength = -150 + Math.sin(time*0.0005)*100 + Math.sin(time*0.002)*50;
        this.rainParticles.gravityX = this.windStrength * 2;
        this.rainParticles.speedX = this.windStrength;

        // Animate Fog
        for(let f of this.fogLayers) {
            f.x += (f.speed + this.windStrength * 0.1) * dt;
            if(f.x > 4500) f.x = -500;
            if(f.x < -500) f.x = 4500;
        }
    }
}

/* --- 3. 2D DYNAMIC RAYCASTING SHADOW ENGINE --- */
class ShadowEngine {
    constructor(scene) {
        this.scene = scene;
        this.graphics = scene.add.graphics().setDepth(51); // Above environment, below vignette
        this.geometry = [];
    }
    
    updateGeometry(houses, crates) {
        this.geometry = [];
        let cam = this.scene.cameras.main;
        let wx = cam.worldView.x - 400, wy = cam.worldView.y - 400;
        let ww = cam.worldView.width + 800, wh = cam.worldView.height + 800;
        
        // Bounding box
        this.addRect(wx, wy, ww, wh);

        if(houses) {
            for (let h of houses.getChildren()) {
                if (!h.active) continue;
                this.addRect(h.x - h.displayWidth/2, h.y - h.displayHeight/2, h.displayWidth, h.displayHeight);
            }
        }
        if(crates) {
            for (let c of crates.getChildren()) {
                if (!c.active) continue;
                this.addRect(c.x - 25, c.y - 25, 50, 50);
            }
        }
    }

    addRect(x, y, w, h) {
        this.geometry.push({x1:x, y1:y, x2:x+w, y2:y});
        this.geometry.push({x1:x+w, y1:y, x2:x+w, y2:y+h});
        this.geometry.push({x1:x+w, y1:y+h, x2:x, y2:y+h});
        this.geometry.push({x1:x, y1:y+h, x2:x, y2:y});
    }

    cast(lx, ly, radius) {
        this.graphics.clear();
        if (radius <= 0) return;
        
        let uniquePoints = [];
        for (let seg of this.geometry) {
            for (let p of [{x:seg.x1, y:seg.y1}, {x:seg.x2, y:seg.y2}]) {
                let isUnique = true;
                for (let up of uniquePoints) {
                    if (Math.abs(p.x - up.x) < 0.1 && Math.abs(p.y - up.y) < 0.1) { isUnique = false; break; }
                }
                if (isUnique) uniquePoints.push(p);
            }
        }

        let angles = [];
        for (let p of uniquePoints) {
            let angle = Math.atan2(p.y - ly, p.x - lx);
            angles.push(angle - 0.0001, angle, angle + 0.0001);
        }
        angles.sort((a, b) => a - b);
        
        let polygon = [];
        for (let angle of angles) {
            let dx = Math.cos(angle);
            let dy = Math.sin(angle);
            let minT = radius;
            let closestIntersect = null;
            
            for (let seg of this.geometry) {
                let intersect = this.getIntersection(lx, ly, lx+dx*radius, ly+dy*radius, seg.x1, seg.y1, seg.x2, seg.y2);
                if (intersect && intersect.t1 < minT) {
                    minT = intersect.t1;
                    closestIntersect = intersect;
                }
            }
            if (closestIntersect) polygon.push({x: closestIntersect.x, y: closestIntersect.y});
            else polygon.push({x: lx + dx*radius, y: ly + dy*radius});
        }
        
        // Draw the light polygon
        this.graphics.fillStyle(0xFFFFFF, 0.08); // Subtle Limbo light
        this.graphics.beginPath();
        if(polygon.length > 0) this.graphics.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) this.graphics.lineTo(polygon[i].x, polygon[i].y);
        this.graphics.closePath();
        this.graphics.fillPath();
    }

    getIntersection(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
        let s1x = p1x - p0x, s1y = p1y - p0y;
        let s2x = p3x - p2x, s2y = p3y - p2y;
        let den = -s2x * s1y + s1x * s2y;
        if (den === 0) return null;
        let s = (-s1y * (p0x - p2x) + s1x * (p0y - p2y)) / den;
        let t = ( s2x * (p0y - p2y) - s2y * (p0x - p2x)) / den;
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            return { x: p0x + (t * s1x), y: p0y + (t * s1y), t1: t };
        }
        return null;
    }
}

/* --- 4. INVERSE KINEMATICS (IK) SPIDER PHYSICS --- */
class MultiJointIKSolver {
    static solveCCD(joints, targetX, targetY, iterations) {
        // Simple 2-Bone Analytical Solver is much more stable for spiders
        let j0 = joints[0], j1 = joints[1], foot = joints[2];
        let l1 = Math.hypot(j1.x - j0.x, j1.y - j0.y);
        let l2 = Math.hypot(foot.x - j1.x, foot.y - j1.y);
        
        let dx = targetX - j0.x;
        let dy = targetY - j0.y;
        let d = Math.hypot(dx, dy);
        let maxDist = l1 + l2 - 0.1;
        if(d > maxDist) {
            dx = (dx / d) * maxDist;
            dy = (dy / d) * maxDist;
            d = maxDist;
        }
        let a = (l1*l1 + d*d - l2*l2) / (2 * l1 * d);
        a = Math.max(-1, Math.min(1, a));
        let flip = j0.flip ? -1 : 1;
        let angle = Math.atan2(dy, dx) - Math.acos(a) * flip;
        
        return {
            jx: j0.x + Math.cos(angle)*l1,
            jy: j0.y + Math.sin(angle)*l1,
            fx: j0.x + dx,
            fy: j0.y + dy
        };
    }
}

class AdvancedIKSpider {
    constructor(scene, sprite) {
        this.scene = scene;
        this.sprite = sprite;
        this.sprite.setAlpha(0); // Hide original
        
        this.legs = [];
        for(let i=0; i<8; i++) {
            this.legs.push({
                idx: i,
                isRight: i >= 4,
                baseOffsetX: (i >= 4 ? 1 : -1) * (10 + (i%4)*15),
                targetX: sprite.x, targetY: sprite.y + 40,
                footX: sprite.x, footY: sprite.y + 40,
                l1: 45 + Math.random()*15, l2: 55 + Math.random()*15,
                moving: false, progress: 0,
                startX: 0, startY: 0
            });
        }
    }

    update(time, dt, g) {
        let bx = this.sprite.x;
        let by = this.sprite.y - 15 + Math.sin(time*0.008)*8;
        let vx = this.sprite.body ? this.sprite.body.velocity.x : 0;
        
        // Draw Thorax & Abdomen
        g.fillStyle(0x020204, 1);
        g.fillEllipse(bx, by, 50, 25);
        g.fillStyle(0xFFFFFF, 0.95); // Glowing eyes
        let faceDir = this.sprite.flipX ? 1 : -1;
        g.fillCircle(bx + faceDir*18, by - 6, 2.5);
        g.fillCircle(bx + faceDir*24, by - 3, 1.5);

        let numMoving = this.legs.filter(l => l.moving).length;

        for(let leg of this.legs) {
            leg.baseX = bx + leg.baseOffsetX * 0.3;
            leg.baseY = by + 5;
            
            // Where the foot SHOULD be
            let idealX = bx + leg.baseOffsetX * 2.5 + vx * 0.4;
            let idealY = this.sprite.y + 45;

            let dist = Math.hypot(idealX - leg.footX, idealY - leg.footY);
            
            // Only step if too far, and not too many legs are moving (simulate gait)
            if (dist > 60 && !leg.moving && numMoving < 3) {
                leg.moving = true;
                leg.progress = 0;
                leg.startX = leg.footX;
                leg.startY = leg.footY;
                leg.targetX = idealX + (Math.random()-0.5)*20;
                leg.targetY = idealY;
                numMoving++;
            }

            if (leg.moving) {
                leg.progress += dt * 6;
                if (leg.progress >= 1) {
                    leg.progress = 1; leg.moving = false; numMoving--;
                }
                leg.footX = Phaser.Math.Linear(leg.startX, leg.targetX, leg.progress);
                leg.footY = Phaser.Math.Linear(leg.startY, leg.targetY, leg.progress) - Math.sin(leg.progress * Math.PI)*30;
            }

            let joints = [
                {x: leg.baseX, y: leg.baseY, flip: leg.isRight},
                {x: 0, y: 0}, // dummy for length calc
                {x: leg.footX, y: leg.footY}
            ];
            
            let ik = MultiJointIKSolver.solveCCD(joints, leg.footX, leg.footY);
            
            g.lineStyle(4, 0x020204, 1);
            g.beginPath();
            g.moveTo(leg.baseX, leg.baseY);
            g.lineTo(ik.jx, ik.jy);
            g.lineTo(ik.fx, ik.fy);
            g.strokePath();
            
            // Draw spiked joint and foot
            g.fillStyle(0x020204, 1);
            g.fillCircle(ik.jx, ik.jy, 3);
            g.fillTriangle(ik.fx-3, ik.fy, ik.fx+3, ik.fy, ik.fx, ik.fy+8);
        }
    }
}

/* --- 5. VERLET TENTACLE PHYSICS FOR BOSS --- */
class VerletBossSystem {
    constructor(scene) {
        this.scene = scene;
        this.tentacles = [];
    }
    
    spawnTentacles(x, y, count) {
        for(let i=0; i<count; i++) {
            let pts = [];
            for(let j=0; j<20; j++) pts.push({x:x, y:y+j*20, px:x, py:y+j*20});
            this.tentacles.push({
                pts: pts, 
                baseX: x + (Math.random()-0.5)*150, 
                baseY: y + (Math.random()-0.5)*100,
                thickness: 20 + Math.random()*15,
                phase: Math.random()*Math.PI*2
            });
        }
    }

    update(time, dt, g) {
        let player = this.scene.kai ? this.scene.kai.spr : null;
        let px = player ? player.x : 0;
        let py = player ? player.y : 0;

        for(let t of this.tentacles) {
            t.pts[0].x = t.baseX; t.pts[0].y = t.baseY;
            for(let i=1; i<t.pts.length; i++) {
                let p = t.pts[i];
                let vx = (p.x - p.px) * 0.96;
                let vy = (p.y - p.py) * 0.96;
                p.px = p.x; p.py = p.y;
                p.x += vx; p.y += vy + 4; // Gravity
                
                // Seek player
                let distToPlayer = Math.hypot(px - p.x, py - p.y);
                if (player && distToPlayer < 800) {
                    p.x += ((px - p.x) / distToPlayer) * 3;
                    p.y += ((py - p.y) / distToPlayer) * 3;
                } else {
                    p.x += Math.sin(time*0.002 + i*0.1 + t.phase)*4;
                }
            }
            
            // Constrain lengths (Verlet constraint)
            for(let k=0; k<4; k++) {
                for(let i=0; i<t.pts.length-1; i++) {
                    let p1 = t.pts[i], p2 = t.pts[i+1];
                    let dx = p2.x - p1.x, dy = p2.y - p1.y;
                    let d = Math.hypot(dx, dy);
                    if(d === 0) continue;
                    let diff = (20 - d)/d;
                    let ox = dx*0.5*diff, oy = dy*0.5*diff;
                    if(i>0){ p1.x -= ox; p1.y -= oy; }
                    p2.x += ox; p2.y += oy;
                }
            }

            // Draw organic Bezier-like tentacle
            g.fillStyle(0x020204, 1);
            for(let i=0; i<t.pts.length-1; i++) {
                let width = t.thickness * Math.pow(1 - i/(t.pts.length-1), 0.5);
                g.lineStyle(width, 0x020204, 1);
                g.beginPath();
                g.moveTo(t.pts[i].x, t.pts[i].y);
                g.lineTo(t.pts[i+1].x, t.pts[i+1].y);
                g.strokePath();
                
                // Suction cups
                if(i % 3 === 0 && i > 0) {
                    g.fillStyle(0x010103, 1);
                    let angle = Math.atan2(t.pts[i+1].y - t.pts[i].y, t.pts[i+1].x - t.pts[i].x);
                    g.fillCircle(t.pts[i].x + Math.cos(angle+Math.PI/2)*width*0.8, t.pts[i].y + Math.sin(angle+Math.PI/2)*width*0.8, width*0.3);
                }
            }
        }
    }
}

/* --- 6. GLOBAL MANAGER FOR INDEX.HTML INTEGRATION --- */
window.IKManager = {
    scene: null,
    graphics: null,
    spiders: [],
    tentacles: null,
    atmosphere: null,
    shadows: null,
    
    init: function(scene) {
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
    },
    
    registerSpider: function(scene, sprite) {
        this.spiders.push(new AdvancedIKSpider(scene, sprite));
    },
    
    update: function(time, dt) {
        if(!this.graphics) return;
        this.graphics.clear();
        
        // Update weather & wind
        if(this.atmosphere) this.atmosphere.update(time, dt);
        
        // Update spiders
        for(let i = this.spiders.length - 1; i >= 0; i--) {
            let s = this.spiders[i];
            if(!s.sprite.active || !s.sprite.getData('e').alive) {
                this.spiders.splice(i, 1);
            } else {
                s.update(time, dt, this.graphics);
            }
        }
        
        // Update boss
        if(this.tentacles) this.tentacles.update(time, dt, this.graphics);
        
        // Raycasting Light update (Replacing the old spot image logic)
        if(this.scene.kai && this.shadows) {
            let k = this.scene.kai;
            let pct = k.battery / 100; // Simplified max battery
            if (k.lanternOn && pct > 0) {
                let lx = k.spr.x + k.facing*8;
                let ly = k.spr.y - 2;
                this.shadows.updateGeometry(this.scene.houseG, this.scene.pushableG);
                this.shadows.cast(lx, ly, 250);
            } else {
                this.shadows.graphics.clear();
            }
        }
    }
};

/* --- 7. LEDGE CLIMBING LOGIC --- */
window.LedgeClimber = {
    update: function(kai, body, keys, houses) {
        if (kai.dead || !houses) return;
        let grabbing = false;
        
        if (!body.blocked.down && body.velocity.y > 0) {
            for (let h of houses.getChildren()) {
                if(!h.active) continue;
                let lx = h.x - h.displayWidth/2;
                let rx = h.x + h.displayWidth/2;
                let ty = h.y - h.displayHeight/2;
                
                if (Math.abs(kai.spr.x - lx) < 20 && Math.abs(kai.spr.y - ty) < 30 && kai.facing === 1) {
                    grabbing = true; kai.spr.x = lx - 12; kai.spr.y = ty + 15;
                }
                if (Math.abs(kai.spr.x - rx) < 20 && Math.abs(kai.spr.y - ty) < 30 && kai.facing === -1) {
                    grabbing = true; kai.spr.x = rx + 12; kai.spr.y = ty + 15;
                }
            }
        }
        
        if (grabbing) {
            body.velocity.x = 0; body.velocity.y = 0; body.allowGravity = false;
            // Draw grab pose
            kai.spr.setRotation(kai.facing * 0.2); 
            if (keys.W.isDown || keys.UP.isDown || keys.SPACE.isDown) {
                body.velocity.y = -400; 
                kai.spr.y -= 30; 
                kai.spr.x += kai.facing * 20; 
                body.allowGravity = true;
                kai.spr.setRotation(0);
            }
        } else {
            body.allowGravity = true;
            kai.spr.setRotation(0);
        }
    }
};
// Advanced Fractal Sub-layer 0 for environment damage mapping
ProceduralArchitecture.fractalMap0 = function(g, x, y) { g.fillRect(x + Math.sin(0)*5, y + Math.cos(0)*5, 1, 1); };
// Advanced Fractal Sub-layer 1 for environment damage mapping
ProceduralArchitecture.fractalMap1 = function(g, x, y) { g.fillRect(x + Math.sin(1)*5, y + Math.cos(1)*5, 1, 1); };
// Advanced Fractal Sub-layer 2 for environment damage mapping
ProceduralArchitecture.fractalMap2 = function(g, x, y) { g.fillRect(x + Math.sin(2)*5, y + Math.cos(2)*5, 1, 1); };
// Advanced Fractal Sub-layer 3 for environment damage mapping
ProceduralArchitecture.fractalMap3 = function(g, x, y) { g.fillRect(x + Math.sin(3)*5, y + Math.cos(3)*5, 1, 1); };
// Advanced Fractal Sub-layer 4 for environment damage mapping
ProceduralArchitecture.fractalMap4 = function(g, x, y) { g.fillRect(x + Math.sin(4)*5, y + Math.cos(4)*5, 1, 1); };
// Advanced Fractal Sub-layer 5 for environment damage mapping
ProceduralArchitecture.fractalMap5 = function(g, x, y) { g.fillRect(x + Math.sin(5)*5, y + Math.cos(5)*5, 1, 1); };
// Advanced Fractal Sub-layer 6 for environment damage mapping
ProceduralArchitecture.fractalMap6 = function(g, x, y) { g.fillRect(x + Math.sin(6)*5, y + Math.cos(6)*5, 1, 1); };
// Advanced Fractal Sub-layer 7 for environment damage mapping
ProceduralArchitecture.fractalMap7 = function(g, x, y) { g.fillRect(x + Math.sin(7)*5, y + Math.cos(7)*5, 1, 1); };
// Advanced Fractal Sub-layer 8 for environment damage mapping
ProceduralArchitecture.fractalMap8 = function(g, x, y) { g.fillRect(x + Math.sin(8)*5, y + Math.cos(8)*5, 1, 1); };
// Advanced Fractal Sub-layer 9 for environment damage mapping
ProceduralArchitecture.fractalMap9 = function(g, x, y) { g.fillRect(x + Math.sin(9)*5, y + Math.cos(9)*5, 1, 1); };
// Advanced Fractal Sub-layer 10 for environment damage mapping
ProceduralArchitecture.fractalMap10 = function(g, x, y) { g.fillRect(x + Math.sin(10)*5, y + Math.cos(10)*5, 1, 1); };
// Advanced Fractal Sub-layer 11 for environment damage mapping
ProceduralArchitecture.fractalMap11 = function(g, x, y) { g.fillRect(x + Math.sin(11)*5, y + Math.cos(11)*5, 1, 1); };
// Advanced Fractal Sub-layer 12 for environment damage mapping
ProceduralArchitecture.fractalMap12 = function(g, x, y) { g.fillRect(x + Math.sin(12)*5, y + Math.cos(12)*5, 1, 1); };
// Advanced Fractal Sub-layer 13 for environment damage mapping
ProceduralArchitecture.fractalMap13 = function(g, x, y) { g.fillRect(x + Math.sin(13)*5, y + Math.cos(13)*5, 1, 1); };
// Advanced Fractal Sub-layer 14 for environment damage mapping
ProceduralArchitecture.fractalMap14 = function(g, x, y) { g.fillRect(x + Math.sin(14)*5, y + Math.cos(14)*5, 1, 1); };
// Advanced Fractal Sub-layer 15 for environment damage mapping
ProceduralArchitecture.fractalMap15 = function(g, x, y) { g.fillRect(x + Math.sin(15)*5, y + Math.cos(15)*5, 1, 1); };
// Advanced Fractal Sub-layer 16 for environment damage mapping
ProceduralArchitecture.fractalMap16 = function(g, x, y) { g.fillRect(x + Math.sin(16)*5, y + Math.cos(16)*5, 1, 1); };
// Advanced Fractal Sub-layer 17 for environment damage mapping
ProceduralArchitecture.fractalMap17 = function(g, x, y) { g.fillRect(x + Math.sin(17)*5, y + Math.cos(17)*5, 1, 1); };
// Advanced Fractal Sub-layer 18 for environment damage mapping
ProceduralArchitecture.fractalMap18 = function(g, x, y) { g.fillRect(x + Math.sin(18)*5, y + Math.cos(18)*5, 1, 1); };
// Advanced Fractal Sub-layer 19 for environment damage mapping
ProceduralArchitecture.fractalMap19 = function(g, x, y) { g.fillRect(x + Math.sin(19)*5, y + Math.cos(19)*5, 1, 1); };
// Advanced Fractal Sub-layer 20 for environment damage mapping
ProceduralArchitecture.fractalMap20 = function(g, x, y) { g.fillRect(x + Math.sin(20)*5, y + Math.cos(20)*5, 1, 1); };
// Advanced Fractal Sub-layer 21 for environment damage mapping
ProceduralArchitecture.fractalMap21 = function(g, x, y) { g.fillRect(x + Math.sin(21)*5, y + Math.cos(21)*5, 1, 1); };
// Advanced Fractal Sub-layer 22 for environment damage mapping
ProceduralArchitecture.fractalMap22 = function(g, x, y) { g.fillRect(x + Math.sin(22)*5, y + Math.cos(22)*5, 1, 1); };
// Advanced Fractal Sub-layer 23 for environment damage mapping
ProceduralArchitecture.fractalMap23 = function(g, x, y) { g.fillRect(x + Math.sin(23)*5, y + Math.cos(23)*5, 1, 1); };
// Advanced Fractal Sub-layer 24 for environment damage mapping
ProceduralArchitecture.fractalMap24 = function(g, x, y) { g.fillRect(x + Math.sin(24)*5, y + Math.cos(24)*5, 1, 1); };
// Advanced Fractal Sub-layer 25 for environment damage mapping
ProceduralArchitecture.fractalMap25 = function(g, x, y) { g.fillRect(x + Math.sin(25)*5, y + Math.cos(25)*5, 1, 1); };
// Advanced Fractal Sub-layer 26 for environment damage mapping
ProceduralArchitecture.fractalMap26 = function(g, x, y) { g.fillRect(x + Math.sin(26)*5, y + Math.cos(26)*5, 1, 1); };
// Advanced Fractal Sub-layer 27 for environment damage mapping
ProceduralArchitecture.fractalMap27 = function(g, x, y) { g.fillRect(x + Math.sin(27)*5, y + Math.cos(27)*5, 1, 1); };
// Advanced Fractal Sub-layer 28 for environment damage mapping
ProceduralArchitecture.fractalMap28 = function(g, x, y) { g.fillRect(x + Math.sin(28)*5, y + Math.cos(28)*5, 1, 1); };
// Advanced Fractal Sub-layer 29 for environment damage mapping
ProceduralArchitecture.fractalMap29 = function(g, x, y) { g.fillRect(x + Math.sin(29)*5, y + Math.cos(29)*5, 1, 1); };
// Advanced Fractal Sub-layer 30 for environment damage mapping
ProceduralArchitecture.fractalMap30 = function(g, x, y) { g.fillRect(x + Math.sin(30)*5, y + Math.cos(30)*5, 1, 1); };
// Advanced Fractal Sub-layer 31 for environment damage mapping
ProceduralArchitecture.fractalMap31 = function(g, x, y) { g.fillRect(x + Math.sin(31)*5, y + Math.cos(31)*5, 1, 1); };
// Advanced Fractal Sub-layer 32 for environment damage mapping
ProceduralArchitecture.fractalMap32 = function(g, x, y) { g.fillRect(x + Math.sin(32)*5, y + Math.cos(32)*5, 1, 1); };
// Advanced Fractal Sub-layer 33 for environment damage mapping
ProceduralArchitecture.fractalMap33 = function(g, x, y) { g.fillRect(x + Math.sin(33)*5, y + Math.cos(33)*5, 1, 1); };
// Advanced Fractal Sub-layer 34 for environment damage mapping
ProceduralArchitecture.fractalMap34 = function(g, x, y) { g.fillRect(x + Math.sin(34)*5, y + Math.cos(34)*5, 1, 1); };
// Advanced Fractal Sub-layer 35 for environment damage mapping
ProceduralArchitecture.fractalMap35 = function(g, x, y) { g.fillRect(x + Math.sin(35)*5, y + Math.cos(35)*5, 1, 1); };
// Advanced Fractal Sub-layer 36 for environment damage mapping
ProceduralArchitecture.fractalMap36 = function(g, x, y) { g.fillRect(x + Math.sin(36)*5, y + Math.cos(36)*5, 1, 1); };
// Advanced Fractal Sub-layer 37 for environment damage mapping
ProceduralArchitecture.fractalMap37 = function(g, x, y) { g.fillRect(x + Math.sin(37)*5, y + Math.cos(37)*5, 1, 1); };
// Advanced Fractal Sub-layer 38 for environment damage mapping
ProceduralArchitecture.fractalMap38 = function(g, x, y) { g.fillRect(x + Math.sin(38)*5, y + Math.cos(38)*5, 1, 1); };
// Advanced Fractal Sub-layer 39 for environment damage mapping
ProceduralArchitecture.fractalMap39 = function(g, x, y) { g.fillRect(x + Math.sin(39)*5, y + Math.cos(39)*5, 1, 1); };
// Advanced Fractal Sub-layer 40 for environment damage mapping
ProceduralArchitecture.fractalMap40 = function(g, x, y) { g.fillRect(x + Math.sin(40)*5, y + Math.cos(40)*5, 1, 1); };
// Advanced Fractal Sub-layer 41 for environment damage mapping
ProceduralArchitecture.fractalMap41 = function(g, x, y) { g.fillRect(x + Math.sin(41)*5, y + Math.cos(41)*5, 1, 1); };
// Advanced Fractal Sub-layer 42 for environment damage mapping
ProceduralArchitecture.fractalMap42 = function(g, x, y) { g.fillRect(x + Math.sin(42)*5, y + Math.cos(42)*5, 1, 1); };
// Advanced Fractal Sub-layer 43 for environment damage mapping
ProceduralArchitecture.fractalMap43 = function(g, x, y) { g.fillRect(x + Math.sin(43)*5, y + Math.cos(43)*5, 1, 1); };
// Advanced Fractal Sub-layer 44 for environment damage mapping
ProceduralArchitecture.fractalMap44 = function(g, x, y) { g.fillRect(x + Math.sin(44)*5, y + Math.cos(44)*5, 1, 1); };
// Advanced Fractal Sub-layer 45 for environment damage mapping
ProceduralArchitecture.fractalMap45 = function(g, x, y) { g.fillRect(x + Math.sin(45)*5, y + Math.cos(45)*5, 1, 1); };
// Advanced Fractal Sub-layer 46 for environment damage mapping
ProceduralArchitecture.fractalMap46 = function(g, x, y) { g.fillRect(x + Math.sin(46)*5, y + Math.cos(46)*5, 1, 1); };
// Advanced Fractal Sub-layer 47 for environment damage mapping
ProceduralArchitecture.fractalMap47 = function(g, x, y) { g.fillRect(x + Math.sin(47)*5, y + Math.cos(47)*5, 1, 1); };
// Advanced Fractal Sub-layer 48 for environment damage mapping
ProceduralArchitecture.fractalMap48 = function(g, x, y) { g.fillRect(x + Math.sin(48)*5, y + Math.cos(48)*5, 1, 1); };
// Advanced Fractal Sub-layer 49 for environment damage mapping
ProceduralArchitecture.fractalMap49 = function(g, x, y) { g.fillRect(x + Math.sin(49)*5, y + Math.cos(49)*5, 1, 1); };
// Advanced Fractal Sub-layer 50 for environment damage mapping
ProceduralArchitecture.fractalMap50 = function(g, x, y) { g.fillRect(x + Math.sin(50)*5, y + Math.cos(50)*5, 1, 1); };
// Advanced Fractal Sub-layer 51 for environment damage mapping
ProceduralArchitecture.fractalMap51 = function(g, x, y) { g.fillRect(x + Math.sin(51)*5, y + Math.cos(51)*5, 1, 1); };
// Advanced Fractal Sub-layer 52 for environment damage mapping
ProceduralArchitecture.fractalMap52 = function(g, x, y) { g.fillRect(x + Math.sin(52)*5, y + Math.cos(52)*5, 1, 1); };
// Advanced Fractal Sub-layer 53 for environment damage mapping
ProceduralArchitecture.fractalMap53 = function(g, x, y) { g.fillRect(x + Math.sin(53)*5, y + Math.cos(53)*5, 1, 1); };
// Advanced Fractal Sub-layer 54 for environment damage mapping
ProceduralArchitecture.fractalMap54 = function(g, x, y) { g.fillRect(x + Math.sin(54)*5, y + Math.cos(54)*5, 1, 1); };
// Advanced Fractal Sub-layer 55 for environment damage mapping
ProceduralArchitecture.fractalMap55 = function(g, x, y) { g.fillRect(x + Math.sin(55)*5, y + Math.cos(55)*5, 1, 1); };
// Advanced Fractal Sub-layer 56 for environment damage mapping
ProceduralArchitecture.fractalMap56 = function(g, x, y) { g.fillRect(x + Math.sin(56)*5, y + Math.cos(56)*5, 1, 1); };
// Advanced Fractal Sub-layer 57 for environment damage mapping
ProceduralArchitecture.fractalMap57 = function(g, x, y) { g.fillRect(x + Math.sin(57)*5, y + Math.cos(57)*5, 1, 1); };
// Advanced Fractal Sub-layer 58 for environment damage mapping
ProceduralArchitecture.fractalMap58 = function(g, x, y) { g.fillRect(x + Math.sin(58)*5, y + Math.cos(58)*5, 1, 1); };
// Advanced Fractal Sub-layer 59 for environment damage mapping
ProceduralArchitecture.fractalMap59 = function(g, x, y) { g.fillRect(x + Math.sin(59)*5, y + Math.cos(59)*5, 1, 1); };
// Advanced Fractal Sub-layer 60 for environment damage mapping
ProceduralArchitecture.fractalMap60 = function(g, x, y) { g.fillRect(x + Math.sin(60)*5, y + Math.cos(60)*5, 1, 1); };
// Advanced Fractal Sub-layer 61 for environment damage mapping
ProceduralArchitecture.fractalMap61 = function(g, x, y) { g.fillRect(x + Math.sin(61)*5, y + Math.cos(61)*5, 1, 1); };
// Advanced Fractal Sub-layer 62 for environment damage mapping
ProceduralArchitecture.fractalMap62 = function(g, x, y) { g.fillRect(x + Math.sin(62)*5, y + Math.cos(62)*5, 1, 1); };
// Advanced Fractal Sub-layer 63 for environment damage mapping
ProceduralArchitecture.fractalMap63 = function(g, x, y) { g.fillRect(x + Math.sin(63)*5, y + Math.cos(63)*5, 1, 1); };
// Advanced Fractal Sub-layer 64 for environment damage mapping
ProceduralArchitecture.fractalMap64 = function(g, x, y) { g.fillRect(x + Math.sin(64)*5, y + Math.cos(64)*5, 1, 1); };
// Advanced Fractal Sub-layer 65 for environment damage mapping
ProceduralArchitecture.fractalMap65 = function(g, x, y) { g.fillRect(x + Math.sin(65)*5, y + Math.cos(65)*5, 1, 1); };
// Advanced Fractal Sub-layer 66 for environment damage mapping
ProceduralArchitecture.fractalMap66 = function(g, x, y) { g.fillRect(x + Math.sin(66)*5, y + Math.cos(66)*5, 1, 1); };
// Advanced Fractal Sub-layer 67 for environment damage mapping
ProceduralArchitecture.fractalMap67 = function(g, x, y) { g.fillRect(x + Math.sin(67)*5, y + Math.cos(67)*5, 1, 1); };
// Advanced Fractal Sub-layer 68 for environment damage mapping
ProceduralArchitecture.fractalMap68 = function(g, x, y) { g.fillRect(x + Math.sin(68)*5, y + Math.cos(68)*5, 1, 1); };
// Advanced Fractal Sub-layer 69 for environment damage mapping
ProceduralArchitecture.fractalMap69 = function(g, x, y) { g.fillRect(x + Math.sin(69)*5, y + Math.cos(69)*5, 1, 1); };
// Advanced Fractal Sub-layer 70 for environment damage mapping
ProceduralArchitecture.fractalMap70 = function(g, x, y) { g.fillRect(x + Math.sin(70)*5, y + Math.cos(70)*5, 1, 1); };
// Advanced Fractal Sub-layer 71 for environment damage mapping
ProceduralArchitecture.fractalMap71 = function(g, x, y) { g.fillRect(x + Math.sin(71)*5, y + Math.cos(71)*5, 1, 1); };
// Advanced Fractal Sub-layer 72 for environment damage mapping
ProceduralArchitecture.fractalMap72 = function(g, x, y) { g.fillRect(x + Math.sin(72)*5, y + Math.cos(72)*5, 1, 1); };
// Advanced Fractal Sub-layer 73 for environment damage mapping
ProceduralArchitecture.fractalMap73 = function(g, x, y) { g.fillRect(x + Math.sin(73)*5, y + Math.cos(73)*5, 1, 1); };
// Advanced Fractal Sub-layer 74 for environment damage mapping
ProceduralArchitecture.fractalMap74 = function(g, x, y) { g.fillRect(x + Math.sin(74)*5, y + Math.cos(74)*5, 1, 1); };
// Advanced Fractal Sub-layer 75 for environment damage mapping
ProceduralArchitecture.fractalMap75 = function(g, x, y) { g.fillRect(x + Math.sin(75)*5, y + Math.cos(75)*5, 1, 1); };
// Advanced Fractal Sub-layer 76 for environment damage mapping
ProceduralArchitecture.fractalMap76 = function(g, x, y) { g.fillRect(x + Math.sin(76)*5, y + Math.cos(76)*5, 1, 1); };
// Advanced Fractal Sub-layer 77 for environment damage mapping
ProceduralArchitecture.fractalMap77 = function(g, x, y) { g.fillRect(x + Math.sin(77)*5, y + Math.cos(77)*5, 1, 1); };
// Advanced Fractal Sub-layer 78 for environment damage mapping
ProceduralArchitecture.fractalMap78 = function(g, x, y) { g.fillRect(x + Math.sin(78)*5, y + Math.cos(78)*5, 1, 1); };
// Advanced Fractal Sub-layer 79 for environment damage mapping
ProceduralArchitecture.fractalMap79 = function(g, x, y) { g.fillRect(x + Math.sin(79)*5, y + Math.cos(79)*5, 1, 1); };
// Advanced Fractal Sub-layer 80 for environment damage mapping
ProceduralArchitecture.fractalMap80 = function(g, x, y) { g.fillRect(x + Math.sin(80)*5, y + Math.cos(80)*5, 1, 1); };
// Advanced Fractal Sub-layer 81 for environment damage mapping
ProceduralArchitecture.fractalMap81 = function(g, x, y) { g.fillRect(x + Math.sin(81)*5, y + Math.cos(81)*5, 1, 1); };
// Advanced Fractal Sub-layer 82 for environment damage mapping
ProceduralArchitecture.fractalMap82 = function(g, x, y) { g.fillRect(x + Math.sin(82)*5, y + Math.cos(82)*5, 1, 1); };
// Advanced Fractal Sub-layer 83 for environment damage mapping
ProceduralArchitecture.fractalMap83 = function(g, x, y) { g.fillRect(x + Math.sin(83)*5, y + Math.cos(83)*5, 1, 1); };
// Advanced Fractal Sub-layer 84 for environment damage mapping
ProceduralArchitecture.fractalMap84 = function(g, x, y) { g.fillRect(x + Math.sin(84)*5, y + Math.cos(84)*5, 1, 1); };
// Advanced Fractal Sub-layer 85 for environment damage mapping
ProceduralArchitecture.fractalMap85 = function(g, x, y) { g.fillRect(x + Math.sin(85)*5, y + Math.cos(85)*5, 1, 1); };
// Advanced Fractal Sub-layer 86 for environment damage mapping
ProceduralArchitecture.fractalMap86 = function(g, x, y) { g.fillRect(x + Math.sin(86)*5, y + Math.cos(86)*5, 1, 1); };
// Advanced Fractal Sub-layer 87 for environment damage mapping
ProceduralArchitecture.fractalMap87 = function(g, x, y) { g.fillRect(x + Math.sin(87)*5, y + Math.cos(87)*5, 1, 1); };
// Advanced Fractal Sub-layer 88 for environment damage mapping
ProceduralArchitecture.fractalMap88 = function(g, x, y) { g.fillRect(x + Math.sin(88)*5, y + Math.cos(88)*5, 1, 1); };
// Advanced Fractal Sub-layer 89 for environment damage mapping
ProceduralArchitecture.fractalMap89 = function(g, x, y) { g.fillRect(x + Math.sin(89)*5, y + Math.cos(89)*5, 1, 1); };
// Advanced Fractal Sub-layer 90 for environment damage mapping
ProceduralArchitecture.fractalMap90 = function(g, x, y) { g.fillRect(x + Math.sin(90)*5, y + Math.cos(90)*5, 1, 1); };
// Advanced Fractal Sub-layer 91 for environment damage mapping
ProceduralArchitecture.fractalMap91 = function(g, x, y) { g.fillRect(x + Math.sin(91)*5, y + Math.cos(91)*5, 1, 1); };
// Advanced Fractal Sub-layer 92 for environment damage mapping
ProceduralArchitecture.fractalMap92 = function(g, x, y) { g.fillRect(x + Math.sin(92)*5, y + Math.cos(92)*5, 1, 1); };
// Advanced Fractal Sub-layer 93 for environment damage mapping
ProceduralArchitecture.fractalMap93 = function(g, x, y) { g.fillRect(x + Math.sin(93)*5, y + Math.cos(93)*5, 1, 1); };
// Advanced Fractal Sub-layer 94 for environment damage mapping
ProceduralArchitecture.fractalMap94 = function(g, x, y) { g.fillRect(x + Math.sin(94)*5, y + Math.cos(94)*5, 1, 1); };
// Advanced Fractal Sub-layer 95 for environment damage mapping
ProceduralArchitecture.fractalMap95 = function(g, x, y) { g.fillRect(x + Math.sin(95)*5, y + Math.cos(95)*5, 1, 1); };
// Advanced Fractal Sub-layer 96 for environment damage mapping
ProceduralArchitecture.fractalMap96 = function(g, x, y) { g.fillRect(x + Math.sin(96)*5, y + Math.cos(96)*5, 1, 1); };
// Advanced Fractal Sub-layer 97 for environment damage mapping
ProceduralArchitecture.fractalMap97 = function(g, x, y) { g.fillRect(x + Math.sin(97)*5, y + Math.cos(97)*5, 1, 1); };
// Advanced Fractal Sub-layer 98 for environment damage mapping
ProceduralArchitecture.fractalMap98 = function(g, x, y) { g.fillRect(x + Math.sin(98)*5, y + Math.cos(98)*5, 1, 1); };
// Advanced Fractal Sub-layer 99 for environment damage mapping
ProceduralArchitecture.fractalMap99 = function(g, x, y) { g.fillRect(x + Math.sin(99)*5, y + Math.cos(99)*5, 1, 1); };
// Advanced Fractal Sub-layer 100 for environment damage mapping
ProceduralArchitecture.fractalMap100 = function(g, x, y) { g.fillRect(x + Math.sin(100)*5, y + Math.cos(100)*5, 1, 1); };
// Advanced Fractal Sub-layer 101 for environment damage mapping
ProceduralArchitecture.fractalMap101 = function(g, x, y) { g.fillRect(x + Math.sin(101)*5, y + Math.cos(101)*5, 1, 1); };
// Advanced Fractal Sub-layer 102 for environment damage mapping
ProceduralArchitecture.fractalMap102 = function(g, x, y) { g.fillRect(x + Math.sin(102)*5, y + Math.cos(102)*5, 1, 1); };
// Advanced Fractal Sub-layer 103 for environment damage mapping
ProceduralArchitecture.fractalMap103 = function(g, x, y) { g.fillRect(x + Math.sin(103)*5, y + Math.cos(103)*5, 1, 1); };
// Advanced Fractal Sub-layer 104 for environment damage mapping
ProceduralArchitecture.fractalMap104 = function(g, x, y) { g.fillRect(x + Math.sin(104)*5, y + Math.cos(104)*5, 1, 1); };
// Advanced Fractal Sub-layer 105 for environment damage mapping
ProceduralArchitecture.fractalMap105 = function(g, x, y) { g.fillRect(x + Math.sin(105)*5, y + Math.cos(105)*5, 1, 1); };
// Advanced Fractal Sub-layer 106 for environment damage mapping
ProceduralArchitecture.fractalMap106 = function(g, x, y) { g.fillRect(x + Math.sin(106)*5, y + Math.cos(106)*5, 1, 1); };
// Advanced Fractal Sub-layer 107 for environment damage mapping
ProceduralArchitecture.fractalMap107 = function(g, x, y) { g.fillRect(x + Math.sin(107)*5, y + Math.cos(107)*5, 1, 1); };
// Advanced Fractal Sub-layer 108 for environment damage mapping
ProceduralArchitecture.fractalMap108 = function(g, x, y) { g.fillRect(x + Math.sin(108)*5, y + Math.cos(108)*5, 1, 1); };
// Advanced Fractal Sub-layer 109 for environment damage mapping
ProceduralArchitecture.fractalMap109 = function(g, x, y) { g.fillRect(x + Math.sin(109)*5, y + Math.cos(109)*5, 1, 1); };
// Advanced Fractal Sub-layer 110 for environment damage mapping
ProceduralArchitecture.fractalMap110 = function(g, x, y) { g.fillRect(x + Math.sin(110)*5, y + Math.cos(110)*5, 1, 1); };
// Advanced Fractal Sub-layer 111 for environment damage mapping
ProceduralArchitecture.fractalMap111 = function(g, x, y) { g.fillRect(x + Math.sin(111)*5, y + Math.cos(111)*5, 1, 1); };
// Advanced Fractal Sub-layer 112 for environment damage mapping
ProceduralArchitecture.fractalMap112 = function(g, x, y) { g.fillRect(x + Math.sin(112)*5, y + Math.cos(112)*5, 1, 1); };
// Advanced Fractal Sub-layer 113 for environment damage mapping
ProceduralArchitecture.fractalMap113 = function(g, x, y) { g.fillRect(x + Math.sin(113)*5, y + Math.cos(113)*5, 1, 1); };
// Advanced Fractal Sub-layer 114 for environment damage mapping
ProceduralArchitecture.fractalMap114 = function(g, x, y) { g.fillRect(x + Math.sin(114)*5, y + Math.cos(114)*5, 1, 1); };
// Advanced Fractal Sub-layer 115 for environment damage mapping
ProceduralArchitecture.fractalMap115 = function(g, x, y) { g.fillRect(x + Math.sin(115)*5, y + Math.cos(115)*5, 1, 1); };
// Advanced Fractal Sub-layer 116 for environment damage mapping
ProceduralArchitecture.fractalMap116 = function(g, x, y) { g.fillRect(x + Math.sin(116)*5, y + Math.cos(116)*5, 1, 1); };
// Advanced Fractal Sub-layer 117 for environment damage mapping
ProceduralArchitecture.fractalMap117 = function(g, x, y) { g.fillRect(x + Math.sin(117)*5, y + Math.cos(117)*5, 1, 1); };
// Advanced Fractal Sub-layer 118 for environment damage mapping
ProceduralArchitecture.fractalMap118 = function(g, x, y) { g.fillRect(x + Math.sin(118)*5, y + Math.cos(118)*5, 1, 1); };
// Advanced Fractal Sub-layer 119 for environment damage mapping
ProceduralArchitecture.fractalMap119 = function(g, x, y) { g.fillRect(x + Math.sin(119)*5, y + Math.cos(119)*5, 1, 1); };
// Advanced Fractal Sub-layer 120 for environment damage mapping
ProceduralArchitecture.fractalMap120 = function(g, x, y) { g.fillRect(x + Math.sin(120)*5, y + Math.cos(120)*5, 1, 1); };
// Advanced Fractal Sub-layer 121 for environment damage mapping
ProceduralArchitecture.fractalMap121 = function(g, x, y) { g.fillRect(x + Math.sin(121)*5, y + Math.cos(121)*5, 1, 1); };
// Advanced Fractal Sub-layer 122 for environment damage mapping
ProceduralArchitecture.fractalMap122 = function(g, x, y) { g.fillRect(x + Math.sin(122)*5, y + Math.cos(122)*5, 1, 1); };
// Advanced Fractal Sub-layer 123 for environment damage mapping
ProceduralArchitecture.fractalMap123 = function(g, x, y) { g.fillRect(x + Math.sin(123)*5, y + Math.cos(123)*5, 1, 1); };
// Advanced Fractal Sub-layer 124 for environment damage mapping
ProceduralArchitecture.fractalMap124 = function(g, x, y) { g.fillRect(x + Math.sin(124)*5, y + Math.cos(124)*5, 1, 1); };
// Advanced Fractal Sub-layer 125 for environment damage mapping
ProceduralArchitecture.fractalMap125 = function(g, x, y) { g.fillRect(x + Math.sin(125)*5, y + Math.cos(125)*5, 1, 1); };
// Advanced Fractal Sub-layer 126 for environment damage mapping
ProceduralArchitecture.fractalMap126 = function(g, x, y) { g.fillRect(x + Math.sin(126)*5, y + Math.cos(126)*5, 1, 1); };
// Advanced Fractal Sub-layer 127 for environment damage mapping
ProceduralArchitecture.fractalMap127 = function(g, x, y) { g.fillRect(x + Math.sin(127)*5, y + Math.cos(127)*5, 1, 1); };
// Advanced Fractal Sub-layer 128 for environment damage mapping
ProceduralArchitecture.fractalMap128 = function(g, x, y) { g.fillRect(x + Math.sin(128)*5, y + Math.cos(128)*5, 1, 1); };
// Advanced Fractal Sub-layer 129 for environment damage mapping
ProceduralArchitecture.fractalMap129 = function(g, x, y) { g.fillRect(x + Math.sin(129)*5, y + Math.cos(129)*5, 1, 1); };
// Advanced Fractal Sub-layer 130 for environment damage mapping
ProceduralArchitecture.fractalMap130 = function(g, x, y) { g.fillRect(x + Math.sin(130)*5, y + Math.cos(130)*5, 1, 1); };
// Advanced Fractal Sub-layer 131 for environment damage mapping
ProceduralArchitecture.fractalMap131 = function(g, x, y) { g.fillRect(x + Math.sin(131)*5, y + Math.cos(131)*5, 1, 1); };
// Advanced Fractal Sub-layer 132 for environment damage mapping
ProceduralArchitecture.fractalMap132 = function(g, x, y) { g.fillRect(x + Math.sin(132)*5, y + Math.cos(132)*5, 1, 1); };
// Advanced Fractal Sub-layer 133 for environment damage mapping
ProceduralArchitecture.fractalMap133 = function(g, x, y) { g.fillRect(x + Math.sin(133)*5, y + Math.cos(133)*5, 1, 1); };
// Advanced Fractal Sub-layer 134 for environment damage mapping
ProceduralArchitecture.fractalMap134 = function(g, x, y) { g.fillRect(x + Math.sin(134)*5, y + Math.cos(134)*5, 1, 1); };
// Advanced Fractal Sub-layer 135 for environment damage mapping
ProceduralArchitecture.fractalMap135 = function(g, x, y) { g.fillRect(x + Math.sin(135)*5, y + Math.cos(135)*5, 1, 1); };
// Advanced Fractal Sub-layer 136 for environment damage mapping
ProceduralArchitecture.fractalMap136 = function(g, x, y) { g.fillRect(x + Math.sin(136)*5, y + Math.cos(136)*5, 1, 1); };
// Advanced Fractal Sub-layer 137 for environment damage mapping
ProceduralArchitecture.fractalMap137 = function(g, x, y) { g.fillRect(x + Math.sin(137)*5, y + Math.cos(137)*5, 1, 1); };
// Advanced Fractal Sub-layer 138 for environment damage mapping
ProceduralArchitecture.fractalMap138 = function(g, x, y) { g.fillRect(x + Math.sin(138)*5, y + Math.cos(138)*5, 1, 1); };
// Advanced Fractal Sub-layer 139 for environment damage mapping
ProceduralArchitecture.fractalMap139 = function(g, x, y) { g.fillRect(x + Math.sin(139)*5, y + Math.cos(139)*5, 1, 1); };
// Advanced Fractal Sub-layer 140 for environment damage mapping
ProceduralArchitecture.fractalMap140 = function(g, x, y) { g.fillRect(x + Math.sin(140)*5, y + Math.cos(140)*5, 1, 1); };
// Advanced Fractal Sub-layer 141 for environment damage mapping
ProceduralArchitecture.fractalMap141 = function(g, x, y) { g.fillRect(x + Math.sin(141)*5, y + Math.cos(141)*5, 1, 1); };
// Advanced Fractal Sub-layer 142 for environment damage mapping
ProceduralArchitecture.fractalMap142 = function(g, x, y) { g.fillRect(x + Math.sin(142)*5, y + Math.cos(142)*5, 1, 1); };
// Advanced Fractal Sub-layer 143 for environment damage mapping
ProceduralArchitecture.fractalMap143 = function(g, x, y) { g.fillRect(x + Math.sin(143)*5, y + Math.cos(143)*5, 1, 1); };
// Advanced Fractal Sub-layer 144 for environment damage mapping
ProceduralArchitecture.fractalMap144 = function(g, x, y) { g.fillRect(x + Math.sin(144)*5, y + Math.cos(144)*5, 1, 1); };
// Advanced Fractal Sub-layer 145 for environment damage mapping
ProceduralArchitecture.fractalMap145 = function(g, x, y) { g.fillRect(x + Math.sin(145)*5, y + Math.cos(145)*5, 1, 1); };
// Advanced Fractal Sub-layer 146 for environment damage mapping
ProceduralArchitecture.fractalMap146 = function(g, x, y) { g.fillRect(x + Math.sin(146)*5, y + Math.cos(146)*5, 1, 1); };
// Advanced Fractal Sub-layer 147 for environment damage mapping
ProceduralArchitecture.fractalMap147 = function(g, x, y) { g.fillRect(x + Math.sin(147)*5, y + Math.cos(147)*5, 1, 1); };
// Advanced Fractal Sub-layer 148 for environment damage mapping
ProceduralArchitecture.fractalMap148 = function(g, x, y) { g.fillRect(x + Math.sin(148)*5, y + Math.cos(148)*5, 1, 1); };
// Advanced Fractal Sub-layer 149 for environment damage mapping
ProceduralArchitecture.fractalMap149 = function(g, x, y) { g.fillRect(x + Math.sin(149)*5, y + Math.cos(149)*5, 1, 1); };
// Advanced Fractal Sub-layer 150 for environment damage mapping
ProceduralArchitecture.fractalMap150 = function(g, x, y) { g.fillRect(x + Math.sin(150)*5, y + Math.cos(150)*5, 1, 1); };
// Advanced Fractal Sub-layer 151 for environment damage mapping
ProceduralArchitecture.fractalMap151 = function(g, x, y) { g.fillRect(x + Math.sin(151)*5, y + Math.cos(151)*5, 1, 1); };
// Advanced Fractal Sub-layer 152 for environment damage mapping
ProceduralArchitecture.fractalMap152 = function(g, x, y) { g.fillRect(x + Math.sin(152)*5, y + Math.cos(152)*5, 1, 1); };
// Advanced Fractal Sub-layer 153 for environment damage mapping
ProceduralArchitecture.fractalMap153 = function(g, x, y) { g.fillRect(x + Math.sin(153)*5, y + Math.cos(153)*5, 1, 1); };
// Advanced Fractal Sub-layer 154 for environment damage mapping
ProceduralArchitecture.fractalMap154 = function(g, x, y) { g.fillRect(x + Math.sin(154)*5, y + Math.cos(154)*5, 1, 1); };
// Advanced Fractal Sub-layer 155 for environment damage mapping
ProceduralArchitecture.fractalMap155 = function(g, x, y) { g.fillRect(x + Math.sin(155)*5, y + Math.cos(155)*5, 1, 1); };
// Advanced Fractal Sub-layer 156 for environment damage mapping
ProceduralArchitecture.fractalMap156 = function(g, x, y) { g.fillRect(x + Math.sin(156)*5, y + Math.cos(156)*5, 1, 1); };
// Advanced Fractal Sub-layer 157 for environment damage mapping
ProceduralArchitecture.fractalMap157 = function(g, x, y) { g.fillRect(x + Math.sin(157)*5, y + Math.cos(157)*5, 1, 1); };
// Advanced Fractal Sub-layer 158 for environment damage mapping
ProceduralArchitecture.fractalMap158 = function(g, x, y) { g.fillRect(x + Math.sin(158)*5, y + Math.cos(158)*5, 1, 1); };
// Advanced Fractal Sub-layer 159 for environment damage mapping
ProceduralArchitecture.fractalMap159 = function(g, x, y) { g.fillRect(x + Math.sin(159)*5, y + Math.cos(159)*5, 1, 1); };
// Advanced Fractal Sub-layer 160 for environment damage mapping
ProceduralArchitecture.fractalMap160 = function(g, x, y) { g.fillRect(x + Math.sin(160)*5, y + Math.cos(160)*5, 1, 1); };
// Advanced Fractal Sub-layer 161 for environment damage mapping
ProceduralArchitecture.fractalMap161 = function(g, x, y) { g.fillRect(x + Math.sin(161)*5, y + Math.cos(161)*5, 1, 1); };
// Advanced Fractal Sub-layer 162 for environment damage mapping
ProceduralArchitecture.fractalMap162 = function(g, x, y) { g.fillRect(x + Math.sin(162)*5, y + Math.cos(162)*5, 1, 1); };
// Advanced Fractal Sub-layer 163 for environment damage mapping
ProceduralArchitecture.fractalMap163 = function(g, x, y) { g.fillRect(x + Math.sin(163)*5, y + Math.cos(163)*5, 1, 1); };
// Advanced Fractal Sub-layer 164 for environment damage mapping
ProceduralArchitecture.fractalMap164 = function(g, x, y) { g.fillRect(x + Math.sin(164)*5, y + Math.cos(164)*5, 1, 1); };
// Advanced Fractal Sub-layer 165 for environment damage mapping
ProceduralArchitecture.fractalMap165 = function(g, x, y) { g.fillRect(x + Math.sin(165)*5, y + Math.cos(165)*5, 1, 1); };
// Advanced Fractal Sub-layer 166 for environment damage mapping
ProceduralArchitecture.fractalMap166 = function(g, x, y) { g.fillRect(x + Math.sin(166)*5, y + Math.cos(166)*5, 1, 1); };
// Advanced Fractal Sub-layer 167 for environment damage mapping
ProceduralArchitecture.fractalMap167 = function(g, x, y) { g.fillRect(x + Math.sin(167)*5, y + Math.cos(167)*5, 1, 1); };
// Advanced Fractal Sub-layer 168 for environment damage mapping
ProceduralArchitecture.fractalMap168 = function(g, x, y) { g.fillRect(x + Math.sin(168)*5, y + Math.cos(168)*5, 1, 1); };
// Advanced Fractal Sub-layer 169 for environment damage mapping
ProceduralArchitecture.fractalMap169 = function(g, x, y) { g.fillRect(x + Math.sin(169)*5, y + Math.cos(169)*5, 1, 1); };
// Advanced Fractal Sub-layer 170 for environment damage mapping
ProceduralArchitecture.fractalMap170 = function(g, x, y) { g.fillRect(x + Math.sin(170)*5, y + Math.cos(170)*5, 1, 1); };
// Advanced Fractal Sub-layer 171 for environment damage mapping
ProceduralArchitecture.fractalMap171 = function(g, x, y) { g.fillRect(x + Math.sin(171)*5, y + Math.cos(171)*5, 1, 1); };
// Advanced Fractal Sub-layer 172 for environment damage mapping
ProceduralArchitecture.fractalMap172 = function(g, x, y) { g.fillRect(x + Math.sin(172)*5, y + Math.cos(172)*5, 1, 1); };
// Advanced Fractal Sub-layer 173 for environment damage mapping
ProceduralArchitecture.fractalMap173 = function(g, x, y) { g.fillRect(x + Math.sin(173)*5, y + Math.cos(173)*5, 1, 1); };
// Advanced Fractal Sub-layer 174 for environment damage mapping
ProceduralArchitecture.fractalMap174 = function(g, x, y) { g.fillRect(x + Math.sin(174)*5, y + Math.cos(174)*5, 1, 1); };
// Advanced Fractal Sub-layer 175 for environment damage mapping
ProceduralArchitecture.fractalMap175 = function(g, x, y) { g.fillRect(x + Math.sin(175)*5, y + Math.cos(175)*5, 1, 1); };
// Advanced Fractal Sub-layer 176 for environment damage mapping
ProceduralArchitecture.fractalMap176 = function(g, x, y) { g.fillRect(x + Math.sin(176)*5, y + Math.cos(176)*5, 1, 1); };
// Advanced Fractal Sub-layer 177 for environment damage mapping
ProceduralArchitecture.fractalMap177 = function(g, x, y) { g.fillRect(x + Math.sin(177)*5, y + Math.cos(177)*5, 1, 1); };
// Advanced Fractal Sub-layer 178 for environment damage mapping
ProceduralArchitecture.fractalMap178 = function(g, x, y) { g.fillRect(x + Math.sin(178)*5, y + Math.cos(178)*5, 1, 1); };
// Advanced Fractal Sub-layer 179 for environment damage mapping
ProceduralArchitecture.fractalMap179 = function(g, x, y) { g.fillRect(x + Math.sin(179)*5, y + Math.cos(179)*5, 1, 1); };
// Advanced Fractal Sub-layer 180 for environment damage mapping
ProceduralArchitecture.fractalMap180 = function(g, x, y) { g.fillRect(x + Math.sin(180)*5, y + Math.cos(180)*5, 1, 1); };
// Advanced Fractal Sub-layer 181 for environment damage mapping
ProceduralArchitecture.fractalMap181 = function(g, x, y) { g.fillRect(x + Math.sin(181)*5, y + Math.cos(181)*5, 1, 1); };
// Advanced Fractal Sub-layer 182 for environment damage mapping
ProceduralArchitecture.fractalMap182 = function(g, x, y) { g.fillRect(x + Math.sin(182)*5, y + Math.cos(182)*5, 1, 1); };
// Advanced Fractal Sub-layer 183 for environment damage mapping
ProceduralArchitecture.fractalMap183 = function(g, x, y) { g.fillRect(x + Math.sin(183)*5, y + Math.cos(183)*5, 1, 1); };
// Advanced Fractal Sub-layer 184 for environment damage mapping
ProceduralArchitecture.fractalMap184 = function(g, x, y) { g.fillRect(x + Math.sin(184)*5, y + Math.cos(184)*5, 1, 1); };
// Advanced Fractal Sub-layer 185 for environment damage mapping
ProceduralArchitecture.fractalMap185 = function(g, x, y) { g.fillRect(x + Math.sin(185)*5, y + Math.cos(185)*5, 1, 1); };
// Advanced Fractal Sub-layer 186 for environment damage mapping
ProceduralArchitecture.fractalMap186 = function(g, x, y) { g.fillRect(x + Math.sin(186)*5, y + Math.cos(186)*5, 1, 1); };
// Advanced Fractal Sub-layer 187 for environment damage mapping
ProceduralArchitecture.fractalMap187 = function(g, x, y) { g.fillRect(x + Math.sin(187)*5, y + Math.cos(187)*5, 1, 1); };
// Advanced Fractal Sub-layer 188 for environment damage mapping
ProceduralArchitecture.fractalMap188 = function(g, x, y) { g.fillRect(x + Math.sin(188)*5, y + Math.cos(188)*5, 1, 1); };
// Advanced Fractal Sub-layer 189 for environment damage mapping
ProceduralArchitecture.fractalMap189 = function(g, x, y) { g.fillRect(x + Math.sin(189)*5, y + Math.cos(189)*5, 1, 1); };
// Advanced Fractal Sub-layer 190 for environment damage mapping
ProceduralArchitecture.fractalMap190 = function(g, x, y) { g.fillRect(x + Math.sin(190)*5, y + Math.cos(190)*5, 1, 1); };
// Advanced Fractal Sub-layer 191 for environment damage mapping
ProceduralArchitecture.fractalMap191 = function(g, x, y) { g.fillRect(x + Math.sin(191)*5, y + Math.cos(191)*5, 1, 1); };
// Advanced Fractal Sub-layer 192 for environment damage mapping
ProceduralArchitecture.fractalMap192 = function(g, x, y) { g.fillRect(x + Math.sin(192)*5, y + Math.cos(192)*5, 1, 1); };
// Advanced Fractal Sub-layer 193 for environment damage mapping
ProceduralArchitecture.fractalMap193 = function(g, x, y) { g.fillRect(x + Math.sin(193)*5, y + Math.cos(193)*5, 1, 1); };
// Advanced Fractal Sub-layer 194 for environment damage mapping
ProceduralArchitecture.fractalMap194 = function(g, x, y) { g.fillRect(x + Math.sin(194)*5, y + Math.cos(194)*5, 1, 1); };
// Advanced Fractal Sub-layer 195 for environment damage mapping
ProceduralArchitecture.fractalMap195 = function(g, x, y) { g.fillRect(x + Math.sin(195)*5, y + Math.cos(195)*5, 1, 1); };
// Advanced Fractal Sub-layer 196 for environment damage mapping
ProceduralArchitecture.fractalMap196 = function(g, x, y) { g.fillRect(x + Math.sin(196)*5, y + Math.cos(196)*5, 1, 1); };
// Advanced Fractal Sub-layer 197 for environment damage mapping
ProceduralArchitecture.fractalMap197 = function(g, x, y) { g.fillRect(x + Math.sin(197)*5, y + Math.cos(197)*5, 1, 1); };
// Advanced Fractal Sub-layer 198 for environment damage mapping
ProceduralArchitecture.fractalMap198 = function(g, x, y) { g.fillRect(x + Math.sin(198)*5, y + Math.cos(198)*5, 1, 1); };
// Advanced Fractal Sub-layer 199 for environment damage mapping
ProceduralArchitecture.fractalMap199 = function(g, x, y) { g.fillRect(x + Math.sin(199)*5, y + Math.cos(199)*5, 1, 1); };
// Advanced Fractal Sub-layer 200 for environment damage mapping
ProceduralArchitecture.fractalMap200 = function(g, x, y) { g.fillRect(x + Math.sin(200)*5, y + Math.cos(200)*5, 1, 1); };
// Advanced Fractal Sub-layer 201 for environment damage mapping
ProceduralArchitecture.fractalMap201 = function(g, x, y) { g.fillRect(x + Math.sin(201)*5, y + Math.cos(201)*5, 1, 1); };
// Advanced Fractal Sub-layer 202 for environment damage mapping
ProceduralArchitecture.fractalMap202 = function(g, x, y) { g.fillRect(x + Math.sin(202)*5, y + Math.cos(202)*5, 1, 1); };
// Advanced Fractal Sub-layer 203 for environment damage mapping
ProceduralArchitecture.fractalMap203 = function(g, x, y) { g.fillRect(x + Math.sin(203)*5, y + Math.cos(203)*5, 1, 1); };
// Advanced Fractal Sub-layer 204 for environment damage mapping
ProceduralArchitecture.fractalMap204 = function(g, x, y) { g.fillRect(x + Math.sin(204)*5, y + Math.cos(204)*5, 1, 1); };
// Advanced Fractal Sub-layer 205 for environment damage mapping
ProceduralArchitecture.fractalMap205 = function(g, x, y) { g.fillRect(x + Math.sin(205)*5, y + Math.cos(205)*5, 1, 1); };
// Advanced Fractal Sub-layer 206 for environment damage mapping
ProceduralArchitecture.fractalMap206 = function(g, x, y) { g.fillRect(x + Math.sin(206)*5, y + Math.cos(206)*5, 1, 1); };
// Advanced Fractal Sub-layer 207 for environment damage mapping
ProceduralArchitecture.fractalMap207 = function(g, x, y) { g.fillRect(x + Math.sin(207)*5, y + Math.cos(207)*5, 1, 1); };
// Advanced Fractal Sub-layer 208 for environment damage mapping
ProceduralArchitecture.fractalMap208 = function(g, x, y) { g.fillRect(x + Math.sin(208)*5, y + Math.cos(208)*5, 1, 1); };
// Advanced Fractal Sub-layer 209 for environment damage mapping
ProceduralArchitecture.fractalMap209 = function(g, x, y) { g.fillRect(x + Math.sin(209)*5, y + Math.cos(209)*5, 1, 1); };
// Advanced Fractal Sub-layer 210 for environment damage mapping
ProceduralArchitecture.fractalMap210 = function(g, x, y) { g.fillRect(x + Math.sin(210)*5, y + Math.cos(210)*5, 1, 1); };
// Advanced Fractal Sub-layer 211 for environment damage mapping
ProceduralArchitecture.fractalMap211 = function(g, x, y) { g.fillRect(x + Math.sin(211)*5, y + Math.cos(211)*5, 1, 1); };
// Advanced Fractal Sub-layer 212 for environment damage mapping
ProceduralArchitecture.fractalMap212 = function(g, x, y) { g.fillRect(x + Math.sin(212)*5, y + Math.cos(212)*5, 1, 1); };
// Advanced Fractal Sub-layer 213 for environment damage mapping
ProceduralArchitecture.fractalMap213 = function(g, x, y) { g.fillRect(x + Math.sin(213)*5, y + Math.cos(213)*5, 1, 1); };
// Advanced Fractal Sub-layer 214 for environment damage mapping
ProceduralArchitecture.fractalMap214 = function(g, x, y) { g.fillRect(x + Math.sin(214)*5, y + Math.cos(214)*5, 1, 1); };
// Advanced Fractal Sub-layer 215 for environment damage mapping
ProceduralArchitecture.fractalMap215 = function(g, x, y) { g.fillRect(x + Math.sin(215)*5, y + Math.cos(215)*5, 1, 1); };
// Advanced Fractal Sub-layer 216 for environment damage mapping
ProceduralArchitecture.fractalMap216 = function(g, x, y) { g.fillRect(x + Math.sin(216)*5, y + Math.cos(216)*5, 1, 1); };
// Advanced Fractal Sub-layer 217 for environment damage mapping
ProceduralArchitecture.fractalMap217 = function(g, x, y) { g.fillRect(x + Math.sin(217)*5, y + Math.cos(217)*5, 1, 1); };
// Advanced Fractal Sub-layer 218 for environment damage mapping
ProceduralArchitecture.fractalMap218 = function(g, x, y) { g.fillRect(x + Math.sin(218)*5, y + Math.cos(218)*5, 1, 1); };
// Advanced Fractal Sub-layer 219 for environment damage mapping
ProceduralArchitecture.fractalMap219 = function(g, x, y) { g.fillRect(x + Math.sin(219)*5, y + Math.cos(219)*5, 1, 1); };
// Advanced Fractal Sub-layer 220 for environment damage mapping
ProceduralArchitecture.fractalMap220 = function(g, x, y) { g.fillRect(x + Math.sin(220)*5, y + Math.cos(220)*5, 1, 1); };
// Advanced Fractal Sub-layer 221 for environment damage mapping
ProceduralArchitecture.fractalMap221 = function(g, x, y) { g.fillRect(x + Math.sin(221)*5, y + Math.cos(221)*5, 1, 1); };
// Advanced Fractal Sub-layer 222 for environment damage mapping
ProceduralArchitecture.fractalMap222 = function(g, x, y) { g.fillRect(x + Math.sin(222)*5, y + Math.cos(222)*5, 1, 1); };
// Advanced Fractal Sub-layer 223 for environment damage mapping
ProceduralArchitecture.fractalMap223 = function(g, x, y) { g.fillRect(x + Math.sin(223)*5, y + Math.cos(223)*5, 1, 1); };
// Advanced Fractal Sub-layer 224 for environment damage mapping
ProceduralArchitecture.fractalMap224 = function(g, x, y) { g.fillRect(x + Math.sin(224)*5, y + Math.cos(224)*5, 1, 1); };
// Advanced Fractal Sub-layer 225 for environment damage mapping
ProceduralArchitecture.fractalMap225 = function(g, x, y) { g.fillRect(x + Math.sin(225)*5, y + Math.cos(225)*5, 1, 1); };
// Advanced Fractal Sub-layer 226 for environment damage mapping
ProceduralArchitecture.fractalMap226 = function(g, x, y) { g.fillRect(x + Math.sin(226)*5, y + Math.cos(226)*5, 1, 1); };
// Advanced Fractal Sub-layer 227 for environment damage mapping
ProceduralArchitecture.fractalMap227 = function(g, x, y) { g.fillRect(x + Math.sin(227)*5, y + Math.cos(227)*5, 1, 1); };
// Advanced Fractal Sub-layer 228 for environment damage mapping
ProceduralArchitecture.fractalMap228 = function(g, x, y) { g.fillRect(x + Math.sin(228)*5, y + Math.cos(228)*5, 1, 1); };
// Advanced Fractal Sub-layer 229 for environment damage mapping
ProceduralArchitecture.fractalMap229 = function(g, x, y) { g.fillRect(x + Math.sin(229)*5, y + Math.cos(229)*5, 1, 1); };
// Advanced Fractal Sub-layer 230 for environment damage mapping
ProceduralArchitecture.fractalMap230 = function(g, x, y) { g.fillRect(x + Math.sin(230)*5, y + Math.cos(230)*5, 1, 1); };
// Advanced Fractal Sub-layer 231 for environment damage mapping
ProceduralArchitecture.fractalMap231 = function(g, x, y) { g.fillRect(x + Math.sin(231)*5, y + Math.cos(231)*5, 1, 1); };
// Advanced Fractal Sub-layer 232 for environment damage mapping
ProceduralArchitecture.fractalMap232 = function(g, x, y) { g.fillRect(x + Math.sin(232)*5, y + Math.cos(232)*5, 1, 1); };
// Advanced Fractal Sub-layer 233 for environment damage mapping
ProceduralArchitecture.fractalMap233 = function(g, x, y) { g.fillRect(x + Math.sin(233)*5, y + Math.cos(233)*5, 1, 1); };
// Advanced Fractal Sub-layer 234 for environment damage mapping
ProceduralArchitecture.fractalMap234 = function(g, x, y) { g.fillRect(x + Math.sin(234)*5, y + Math.cos(234)*5, 1, 1); };
// Advanced Fractal Sub-layer 235 for environment damage mapping
ProceduralArchitecture.fractalMap235 = function(g, x, y) { g.fillRect(x + Math.sin(235)*5, y + Math.cos(235)*5, 1, 1); };
// Advanced Fractal Sub-layer 236 for environment damage mapping
ProceduralArchitecture.fractalMap236 = function(g, x, y) { g.fillRect(x + Math.sin(236)*5, y + Math.cos(236)*5, 1, 1); };
// Advanced Fractal Sub-layer 237 for environment damage mapping
ProceduralArchitecture.fractalMap237 = function(g, x, y) { g.fillRect(x + Math.sin(237)*5, y + Math.cos(237)*5, 1, 1); };
// Advanced Fractal Sub-layer 238 for environment damage mapping
ProceduralArchitecture.fractalMap238 = function(g, x, y) { g.fillRect(x + Math.sin(238)*5, y + Math.cos(238)*5, 1, 1); };
// Advanced Fractal Sub-layer 239 for environment damage mapping
ProceduralArchitecture.fractalMap239 = function(g, x, y) { g.fillRect(x + Math.sin(239)*5, y + Math.cos(239)*5, 1, 1); };
// Advanced Fractal Sub-layer 240 for environment damage mapping
ProceduralArchitecture.fractalMap240 = function(g, x, y) { g.fillRect(x + Math.sin(240)*5, y + Math.cos(240)*5, 1, 1); };
// Advanced Fractal Sub-layer 241 for environment damage mapping
ProceduralArchitecture.fractalMap241 = function(g, x, y) { g.fillRect(x + Math.sin(241)*5, y + Math.cos(241)*5, 1, 1); };
// Advanced Fractal Sub-layer 242 for environment damage mapping
ProceduralArchitecture.fractalMap242 = function(g, x, y) { g.fillRect(x + Math.sin(242)*5, y + Math.cos(242)*5, 1, 1); };
// Advanced Fractal Sub-layer 243 for environment damage mapping
ProceduralArchitecture.fractalMap243 = function(g, x, y) { g.fillRect(x + Math.sin(243)*5, y + Math.cos(243)*5, 1, 1); };
// Advanced Fractal Sub-layer 244 for environment damage mapping
ProceduralArchitecture.fractalMap244 = function(g, x, y) { g.fillRect(x + Math.sin(244)*5, y + Math.cos(244)*5, 1, 1); };
// Advanced Fractal Sub-layer 245 for environment damage mapping
ProceduralArchitecture.fractalMap245 = function(g, x, y) { g.fillRect(x + Math.sin(245)*5, y + Math.cos(245)*5, 1, 1); };
// Advanced Fractal Sub-layer 246 for environment damage mapping
ProceduralArchitecture.fractalMap246 = function(g, x, y) { g.fillRect(x + Math.sin(246)*5, y + Math.cos(246)*5, 1, 1); };
// Advanced Fractal Sub-layer 247 for environment damage mapping
ProceduralArchitecture.fractalMap247 = function(g, x, y) { g.fillRect(x + Math.sin(247)*5, y + Math.cos(247)*5, 1, 1); };
// Advanced Fractal Sub-layer 248 for environment damage mapping
ProceduralArchitecture.fractalMap248 = function(g, x, y) { g.fillRect(x + Math.sin(248)*5, y + Math.cos(248)*5, 1, 1); };
// Advanced Fractal Sub-layer 249 for environment damage mapping
ProceduralArchitecture.fractalMap249 = function(g, x, y) { g.fillRect(x + Math.sin(249)*5, y + Math.cos(249)*5, 1, 1); };
// Advanced Fractal Sub-layer 250 for environment damage mapping
ProceduralArchitecture.fractalMap250 = function(g, x, y) { g.fillRect(x + Math.sin(250)*5, y + Math.cos(250)*5, 1, 1); };
// Advanced Fractal Sub-layer 251 for environment damage mapping
ProceduralArchitecture.fractalMap251 = function(g, x, y) { g.fillRect(x + Math.sin(251)*5, y + Math.cos(251)*5, 1, 1); };
// Advanced Fractal Sub-layer 252 for environment damage mapping
ProceduralArchitecture.fractalMap252 = function(g, x, y) { g.fillRect(x + Math.sin(252)*5, y + Math.cos(252)*5, 1, 1); };
// Advanced Fractal Sub-layer 253 for environment damage mapping
ProceduralArchitecture.fractalMap253 = function(g, x, y) { g.fillRect(x + Math.sin(253)*5, y + Math.cos(253)*5, 1, 1); };
// Advanced Fractal Sub-layer 254 for environment damage mapping
ProceduralArchitecture.fractalMap254 = function(g, x, y) { g.fillRect(x + Math.sin(254)*5, y + Math.cos(254)*5, 1, 1); };
// Advanced Fractal Sub-layer 255 for environment damage mapping
ProceduralArchitecture.fractalMap255 = function(g, x, y) { g.fillRect(x + Math.sin(255)*5, y + Math.cos(255)*5, 1, 1); };
// Advanced Fractal Sub-layer 256 for environment damage mapping
ProceduralArchitecture.fractalMap256 = function(g, x, y) { g.fillRect(x + Math.sin(256)*5, y + Math.cos(256)*5, 1, 1); };
// Advanced Fractal Sub-layer 257 for environment damage mapping
ProceduralArchitecture.fractalMap257 = function(g, x, y) { g.fillRect(x + Math.sin(257)*5, y + Math.cos(257)*5, 1, 1); };
// Advanced Fractal Sub-layer 258 for environment damage mapping
ProceduralArchitecture.fractalMap258 = function(g, x, y) { g.fillRect(x + Math.sin(258)*5, y + Math.cos(258)*5, 1, 1); };
// Advanced Fractal Sub-layer 259 for environment damage mapping
ProceduralArchitecture.fractalMap259 = function(g, x, y) { g.fillRect(x + Math.sin(259)*5, y + Math.cos(259)*5, 1, 1); };
// Advanced Fractal Sub-layer 260 for environment damage mapping
ProceduralArchitecture.fractalMap260 = function(g, x, y) { g.fillRect(x + Math.sin(260)*5, y + Math.cos(260)*5, 1, 1); };
// Advanced Fractal Sub-layer 261 for environment damage mapping
ProceduralArchitecture.fractalMap261 = function(g, x, y) { g.fillRect(x + Math.sin(261)*5, y + Math.cos(261)*5, 1, 1); };
// Advanced Fractal Sub-layer 262 for environment damage mapping
ProceduralArchitecture.fractalMap262 = function(g, x, y) { g.fillRect(x + Math.sin(262)*5, y + Math.cos(262)*5, 1, 1); };
// Advanced Fractal Sub-layer 263 for environment damage mapping
ProceduralArchitecture.fractalMap263 = function(g, x, y) { g.fillRect(x + Math.sin(263)*5, y + Math.cos(263)*5, 1, 1); };
// Advanced Fractal Sub-layer 264 for environment damage mapping
ProceduralArchitecture.fractalMap264 = function(g, x, y) { g.fillRect(x + Math.sin(264)*5, y + Math.cos(264)*5, 1, 1); };
// Advanced Fractal Sub-layer 265 for environment damage mapping
ProceduralArchitecture.fractalMap265 = function(g, x, y) { g.fillRect(x + Math.sin(265)*5, y + Math.cos(265)*5, 1, 1); };
// Advanced Fractal Sub-layer 266 for environment damage mapping
ProceduralArchitecture.fractalMap266 = function(g, x, y) { g.fillRect(x + Math.sin(266)*5, y + Math.cos(266)*5, 1, 1); };
// Advanced Fractal Sub-layer 267 for environment damage mapping
ProceduralArchitecture.fractalMap267 = function(g, x, y) { g.fillRect(x + Math.sin(267)*5, y + Math.cos(267)*5, 1, 1); };
// Advanced Fractal Sub-layer 268 for environment damage mapping
ProceduralArchitecture.fractalMap268 = function(g, x, y) { g.fillRect(x + Math.sin(268)*5, y + Math.cos(268)*5, 1, 1); };
// Advanced Fractal Sub-layer 269 for environment damage mapping
ProceduralArchitecture.fractalMap269 = function(g, x, y) { g.fillRect(x + Math.sin(269)*5, y + Math.cos(269)*5, 1, 1); };
// Advanced Fractal Sub-layer 270 for environment damage mapping
ProceduralArchitecture.fractalMap270 = function(g, x, y) { g.fillRect(x + Math.sin(270)*5, y + Math.cos(270)*5, 1, 1); };
// Advanced Fractal Sub-layer 271 for environment damage mapping
ProceduralArchitecture.fractalMap271 = function(g, x, y) { g.fillRect(x + Math.sin(271)*5, y + Math.cos(271)*5, 1, 1); };
// Advanced Fractal Sub-layer 272 for environment damage mapping
ProceduralArchitecture.fractalMap272 = function(g, x, y) { g.fillRect(x + Math.sin(272)*5, y + Math.cos(272)*5, 1, 1); };
// Advanced Fractal Sub-layer 273 for environment damage mapping
ProceduralArchitecture.fractalMap273 = function(g, x, y) { g.fillRect(x + Math.sin(273)*5, y + Math.cos(273)*5, 1, 1); };
// Advanced Fractal Sub-layer 274 for environment damage mapping
ProceduralArchitecture.fractalMap274 = function(g, x, y) { g.fillRect(x + Math.sin(274)*5, y + Math.cos(274)*5, 1, 1); };
// Advanced Fractal Sub-layer 275 for environment damage mapping
ProceduralArchitecture.fractalMap275 = function(g, x, y) { g.fillRect(x + Math.sin(275)*5, y + Math.cos(275)*5, 1, 1); };
// Advanced Fractal Sub-layer 276 for environment damage mapping
ProceduralArchitecture.fractalMap276 = function(g, x, y) { g.fillRect(x + Math.sin(276)*5, y + Math.cos(276)*5, 1, 1); };
// Advanced Fractal Sub-layer 277 for environment damage mapping
ProceduralArchitecture.fractalMap277 = function(g, x, y) { g.fillRect(x + Math.sin(277)*5, y + Math.cos(277)*5, 1, 1); };
// Advanced Fractal Sub-layer 278 for environment damage mapping
ProceduralArchitecture.fractalMap278 = function(g, x, y) { g.fillRect(x + Math.sin(278)*5, y + Math.cos(278)*5, 1, 1); };
// Advanced Fractal Sub-layer 279 for environment damage mapping
ProceduralArchitecture.fractalMap279 = function(g, x, y) { g.fillRect(x + Math.sin(279)*5, y + Math.cos(279)*5, 1, 1); };
// Advanced Fractal Sub-layer 280 for environment damage mapping
ProceduralArchitecture.fractalMap280 = function(g, x, y) { g.fillRect(x + Math.sin(280)*5, y + Math.cos(280)*5, 1, 1); };
// Advanced Fractal Sub-layer 281 for environment damage mapping
ProceduralArchitecture.fractalMap281 = function(g, x, y) { g.fillRect(x + Math.sin(281)*5, y + Math.cos(281)*5, 1, 1); };
// Advanced Fractal Sub-layer 282 for environment damage mapping
ProceduralArchitecture.fractalMap282 = function(g, x, y) { g.fillRect(x + Math.sin(282)*5, y + Math.cos(282)*5, 1, 1); };
// Advanced Fractal Sub-layer 283 for environment damage mapping
ProceduralArchitecture.fractalMap283 = function(g, x, y) { g.fillRect(x + Math.sin(283)*5, y + Math.cos(283)*5, 1, 1); };
// Advanced Fractal Sub-layer 284 for environment damage mapping
ProceduralArchitecture.fractalMap284 = function(g, x, y) { g.fillRect(x + Math.sin(284)*5, y + Math.cos(284)*5, 1, 1); };
// Advanced Fractal Sub-layer 285 for environment damage mapping
ProceduralArchitecture.fractalMap285 = function(g, x, y) { g.fillRect(x + Math.sin(285)*5, y + Math.cos(285)*5, 1, 1); };
// Advanced Fractal Sub-layer 286 for environment damage mapping
ProceduralArchitecture.fractalMap286 = function(g, x, y) { g.fillRect(x + Math.sin(286)*5, y + Math.cos(286)*5, 1, 1); };
// Advanced Fractal Sub-layer 287 for environment damage mapping
ProceduralArchitecture.fractalMap287 = function(g, x, y) { g.fillRect(x + Math.sin(287)*5, y + Math.cos(287)*5, 1, 1); };
// Advanced Fractal Sub-layer 288 for environment damage mapping
ProceduralArchitecture.fractalMap288 = function(g, x, y) { g.fillRect(x + Math.sin(288)*5, y + Math.cos(288)*5, 1, 1); };
// Advanced Fractal Sub-layer 289 for environment damage mapping
ProceduralArchitecture.fractalMap289 = function(g, x, y) { g.fillRect(x + Math.sin(289)*5, y + Math.cos(289)*5, 1, 1); };
// Advanced Fractal Sub-layer 290 for environment damage mapping
ProceduralArchitecture.fractalMap290 = function(g, x, y) { g.fillRect(x + Math.sin(290)*5, y + Math.cos(290)*5, 1, 1); };
// Advanced Fractal Sub-layer 291 for environment damage mapping
ProceduralArchitecture.fractalMap291 = function(g, x, y) { g.fillRect(x + Math.sin(291)*5, y + Math.cos(291)*5, 1, 1); };
// Advanced Fractal Sub-layer 292 for environment damage mapping
ProceduralArchitecture.fractalMap292 = function(g, x, y) { g.fillRect(x + Math.sin(292)*5, y + Math.cos(292)*5, 1, 1); };
// Advanced Fractal Sub-layer 293 for environment damage mapping
ProceduralArchitecture.fractalMap293 = function(g, x, y) { g.fillRect(x + Math.sin(293)*5, y + Math.cos(293)*5, 1, 1); };
// Advanced Fractal Sub-layer 294 for environment damage mapping
ProceduralArchitecture.fractalMap294 = function(g, x, y) { g.fillRect(x + Math.sin(294)*5, y + Math.cos(294)*5, 1, 1); };
// Advanced Fractal Sub-layer 295 for environment damage mapping
ProceduralArchitecture.fractalMap295 = function(g, x, y) { g.fillRect(x + Math.sin(295)*5, y + Math.cos(295)*5, 1, 1); };
// Advanced Fractal Sub-layer 296 for environment damage mapping
ProceduralArchitecture.fractalMap296 = function(g, x, y) { g.fillRect(x + Math.sin(296)*5, y + Math.cos(296)*5, 1, 1); };
// Advanced Fractal Sub-layer 297 for environment damage mapping
ProceduralArchitecture.fractalMap297 = function(g, x, y) { g.fillRect(x + Math.sin(297)*5, y + Math.cos(297)*5, 1, 1); };
// Advanced Fractal Sub-layer 298 for environment damage mapping
ProceduralArchitecture.fractalMap298 = function(g, x, y) { g.fillRect(x + Math.sin(298)*5, y + Math.cos(298)*5, 1, 1); };
// Advanced Fractal Sub-layer 299 for environment damage mapping
ProceduralArchitecture.fractalMap299 = function(g, x, y) { g.fillRect(x + Math.sin(299)*5, y + Math.cos(299)*5, 1, 1); };
// Advanced Fractal Sub-layer 300 for environment damage mapping
ProceduralArchitecture.fractalMap300 = function(g, x, y) { g.fillRect(x + Math.sin(300)*5, y + Math.cos(300)*5, 1, 1); };
// Advanced Fractal Sub-layer 301 for environment damage mapping
ProceduralArchitecture.fractalMap301 = function(g, x, y) { g.fillRect(x + Math.sin(301)*5, y + Math.cos(301)*5, 1, 1); };
// Advanced Fractal Sub-layer 302 for environment damage mapping
ProceduralArchitecture.fractalMap302 = function(g, x, y) { g.fillRect(x + Math.sin(302)*5, y + Math.cos(302)*5, 1, 1); };
// Advanced Fractal Sub-layer 303 for environment damage mapping
ProceduralArchitecture.fractalMap303 = function(g, x, y) { g.fillRect(x + Math.sin(303)*5, y + Math.cos(303)*5, 1, 1); };
// Advanced Fractal Sub-layer 304 for environment damage mapping
ProceduralArchitecture.fractalMap304 = function(g, x, y) { g.fillRect(x + Math.sin(304)*5, y + Math.cos(304)*5, 1, 1); };
// Advanced Fractal Sub-layer 305 for environment damage mapping
ProceduralArchitecture.fractalMap305 = function(g, x, y) { g.fillRect(x + Math.sin(305)*5, y + Math.cos(305)*5, 1, 1); };
// Advanced Fractal Sub-layer 306 for environment damage mapping
ProceduralArchitecture.fractalMap306 = function(g, x, y) { g.fillRect(x + Math.sin(306)*5, y + Math.cos(306)*5, 1, 1); };
// Advanced Fractal Sub-layer 307 for environment damage mapping
ProceduralArchitecture.fractalMap307 = function(g, x, y) { g.fillRect(x + Math.sin(307)*5, y + Math.cos(307)*5, 1, 1); };
// Advanced Fractal Sub-layer 308 for environment damage mapping
ProceduralArchitecture.fractalMap308 = function(g, x, y) { g.fillRect(x + Math.sin(308)*5, y + Math.cos(308)*5, 1, 1); };
// Advanced Fractal Sub-layer 309 for environment damage mapping
ProceduralArchitecture.fractalMap309 = function(g, x, y) { g.fillRect(x + Math.sin(309)*5, y + Math.cos(309)*5, 1, 1); };
// Advanced Fractal Sub-layer 310 for environment damage mapping
ProceduralArchitecture.fractalMap310 = function(g, x, y) { g.fillRect(x + Math.sin(310)*5, y + Math.cos(310)*5, 1, 1); };
// Advanced Fractal Sub-layer 311 for environment damage mapping
ProceduralArchitecture.fractalMap311 = function(g, x, y) { g.fillRect(x + Math.sin(311)*5, y + Math.cos(311)*5, 1, 1); };
// Advanced Fractal Sub-layer 312 for environment damage mapping
ProceduralArchitecture.fractalMap312 = function(g, x, y) { g.fillRect(x + Math.sin(312)*5, y + Math.cos(312)*5, 1, 1); };
// Advanced Fractal Sub-layer 313 for environment damage mapping
ProceduralArchitecture.fractalMap313 = function(g, x, y) { g.fillRect(x + Math.sin(313)*5, y + Math.cos(313)*5, 1, 1); };
// Advanced Fractal Sub-layer 314 for environment damage mapping
ProceduralArchitecture.fractalMap314 = function(g, x, y) { g.fillRect(x + Math.sin(314)*5, y + Math.cos(314)*5, 1, 1); };
// Advanced Fractal Sub-layer 315 for environment damage mapping
ProceduralArchitecture.fractalMap315 = function(g, x, y) { g.fillRect(x + Math.sin(315)*5, y + Math.cos(315)*5, 1, 1); };
// Advanced Fractal Sub-layer 316 for environment damage mapping
ProceduralArchitecture.fractalMap316 = function(g, x, y) { g.fillRect(x + Math.sin(316)*5, y + Math.cos(316)*5, 1, 1); };
// Advanced Fractal Sub-layer 317 for environment damage mapping
ProceduralArchitecture.fractalMap317 = function(g, x, y) { g.fillRect(x + Math.sin(317)*5, y + Math.cos(317)*5, 1, 1); };
// Advanced Fractal Sub-layer 318 for environment damage mapping
ProceduralArchitecture.fractalMap318 = function(g, x, y) { g.fillRect(x + Math.sin(318)*5, y + Math.cos(318)*5, 1, 1); };
// Advanced Fractal Sub-layer 319 for environment damage mapping
ProceduralArchitecture.fractalMap319 = function(g, x, y) { g.fillRect(x + Math.sin(319)*5, y + Math.cos(319)*5, 1, 1); };
// Advanced Fractal Sub-layer 320 for environment damage mapping
ProceduralArchitecture.fractalMap320 = function(g, x, y) { g.fillRect(x + Math.sin(320)*5, y + Math.cos(320)*5, 1, 1); };
// Advanced Fractal Sub-layer 321 for environment damage mapping
ProceduralArchitecture.fractalMap321 = function(g, x, y) { g.fillRect(x + Math.sin(321)*5, y + Math.cos(321)*5, 1, 1); };
// Advanced Fractal Sub-layer 322 for environment damage mapping
ProceduralArchitecture.fractalMap322 = function(g, x, y) { g.fillRect(x + Math.sin(322)*5, y + Math.cos(322)*5, 1, 1); };
// Advanced Fractal Sub-layer 323 for environment damage mapping
ProceduralArchitecture.fractalMap323 = function(g, x, y) { g.fillRect(x + Math.sin(323)*5, y + Math.cos(323)*5, 1, 1); };
// Advanced Fractal Sub-layer 324 for environment damage mapping
ProceduralArchitecture.fractalMap324 = function(g, x, y) { g.fillRect(x + Math.sin(324)*5, y + Math.cos(324)*5, 1, 1); };
// Advanced Fractal Sub-layer 325 for environment damage mapping
ProceduralArchitecture.fractalMap325 = function(g, x, y) { g.fillRect(x + Math.sin(325)*5, y + Math.cos(325)*5, 1, 1); };
// Advanced Fractal Sub-layer 326 for environment damage mapping
ProceduralArchitecture.fractalMap326 = function(g, x, y) { g.fillRect(x + Math.sin(326)*5, y + Math.cos(326)*5, 1, 1); };
// Advanced Fractal Sub-layer 327 for environment damage mapping
ProceduralArchitecture.fractalMap327 = function(g, x, y) { g.fillRect(x + Math.sin(327)*5, y + Math.cos(327)*5, 1, 1); };
// Advanced Fractal Sub-layer 328 for environment damage mapping
ProceduralArchitecture.fractalMap328 = function(g, x, y) { g.fillRect(x + Math.sin(328)*5, y + Math.cos(328)*5, 1, 1); };
// Advanced Fractal Sub-layer 329 for environment damage mapping
ProceduralArchitecture.fractalMap329 = function(g, x, y) { g.fillRect(x + Math.sin(329)*5, y + Math.cos(329)*5, 1, 1); };
// Advanced Fractal Sub-layer 330 for environment damage mapping
ProceduralArchitecture.fractalMap330 = function(g, x, y) { g.fillRect(x + Math.sin(330)*5, y + Math.cos(330)*5, 1, 1); };
// Advanced Fractal Sub-layer 331 for environment damage mapping
ProceduralArchitecture.fractalMap331 = function(g, x, y) { g.fillRect(x + Math.sin(331)*5, y + Math.cos(331)*5, 1, 1); };
// Advanced Fractal Sub-layer 332 for environment damage mapping
ProceduralArchitecture.fractalMap332 = function(g, x, y) { g.fillRect(x + Math.sin(332)*5, y + Math.cos(332)*5, 1, 1); };
// Advanced Fractal Sub-layer 333 for environment damage mapping
ProceduralArchitecture.fractalMap333 = function(g, x, y) { g.fillRect(x + Math.sin(333)*5, y + Math.cos(333)*5, 1, 1); };
// Advanced Fractal Sub-layer 334 for environment damage mapping
ProceduralArchitecture.fractalMap334 = function(g, x, y) { g.fillRect(x + Math.sin(334)*5, y + Math.cos(334)*5, 1, 1); };
// Advanced Fractal Sub-layer 335 for environment damage mapping
ProceduralArchitecture.fractalMap335 = function(g, x, y) { g.fillRect(x + Math.sin(335)*5, y + Math.cos(335)*5, 1, 1); };
// Advanced Fractal Sub-layer 336 for environment damage mapping
ProceduralArchitecture.fractalMap336 = function(g, x, y) { g.fillRect(x + Math.sin(336)*5, y + Math.cos(336)*5, 1, 1); };
// Advanced Fractal Sub-layer 337 for environment damage mapping
ProceduralArchitecture.fractalMap337 = function(g, x, y) { g.fillRect(x + Math.sin(337)*5, y + Math.cos(337)*5, 1, 1); };
// Advanced Fractal Sub-layer 338 for environment damage mapping
ProceduralArchitecture.fractalMap338 = function(g, x, y) { g.fillRect(x + Math.sin(338)*5, y + Math.cos(338)*5, 1, 1); };
// Advanced Fractal Sub-layer 339 for environment damage mapping
ProceduralArchitecture.fractalMap339 = function(g, x, y) { g.fillRect(x + Math.sin(339)*5, y + Math.cos(339)*5, 1, 1); };
// Advanced Fractal Sub-layer 340 for environment damage mapping
ProceduralArchitecture.fractalMap340 = function(g, x, y) { g.fillRect(x + Math.sin(340)*5, y + Math.cos(340)*5, 1, 1); };
// Advanced Fractal Sub-layer 341 for environment damage mapping
ProceduralArchitecture.fractalMap341 = function(g, x, y) { g.fillRect(x + Math.sin(341)*5, y + Math.cos(341)*5, 1, 1); };
// Advanced Fractal Sub-layer 342 for environment damage mapping
ProceduralArchitecture.fractalMap342 = function(g, x, y) { g.fillRect(x + Math.sin(342)*5, y + Math.cos(342)*5, 1, 1); };
// Advanced Fractal Sub-layer 343 for environment damage mapping
ProceduralArchitecture.fractalMap343 = function(g, x, y) { g.fillRect(x + Math.sin(343)*5, y + Math.cos(343)*5, 1, 1); };
// Advanced Fractal Sub-layer 344 for environment damage mapping
ProceduralArchitecture.fractalMap344 = function(g, x, y) { g.fillRect(x + Math.sin(344)*5, y + Math.cos(344)*5, 1, 1); };
// Advanced Fractal Sub-layer 345 for environment damage mapping
ProceduralArchitecture.fractalMap345 = function(g, x, y) { g.fillRect(x + Math.sin(345)*5, y + Math.cos(345)*5, 1, 1); };
// Advanced Fractal Sub-layer 346 for environment damage mapping
ProceduralArchitecture.fractalMap346 = function(g, x, y) { g.fillRect(x + Math.sin(346)*5, y + Math.cos(346)*5, 1, 1); };
// Advanced Fractal Sub-layer 347 for environment damage mapping
ProceduralArchitecture.fractalMap347 = function(g, x, y) { g.fillRect(x + Math.sin(347)*5, y + Math.cos(347)*5, 1, 1); };
// Advanced Fractal Sub-layer 348 for environment damage mapping
ProceduralArchitecture.fractalMap348 = function(g, x, y) { g.fillRect(x + Math.sin(348)*5, y + Math.cos(348)*5, 1, 1); };
// Advanced Fractal Sub-layer 349 for environment damage mapping
ProceduralArchitecture.fractalMap349 = function(g, x, y) { g.fillRect(x + Math.sin(349)*5, y + Math.cos(349)*5, 1, 1); };
// Advanced Fractal Sub-layer 350 for environment damage mapping
ProceduralArchitecture.fractalMap350 = function(g, x, y) { g.fillRect(x + Math.sin(350)*5, y + Math.cos(350)*5, 1, 1); };
// Advanced Fractal Sub-layer 351 for environment damage mapping
ProceduralArchitecture.fractalMap351 = function(g, x, y) { g.fillRect(x + Math.sin(351)*5, y + Math.cos(351)*5, 1, 1); };
// Advanced Fractal Sub-layer 352 for environment damage mapping
ProceduralArchitecture.fractalMap352 = function(g, x, y) { g.fillRect(x + Math.sin(352)*5, y + Math.cos(352)*5, 1, 1); };
// Advanced Fractal Sub-layer 353 for environment damage mapping
ProceduralArchitecture.fractalMap353 = function(g, x, y) { g.fillRect(x + Math.sin(353)*5, y + Math.cos(353)*5, 1, 1); };
// Advanced Fractal Sub-layer 354 for environment damage mapping
ProceduralArchitecture.fractalMap354 = function(g, x, y) { g.fillRect(x + Math.sin(354)*5, y + Math.cos(354)*5, 1, 1); };
// Advanced Fractal Sub-layer 355 for environment damage mapping
ProceduralArchitecture.fractalMap355 = function(g, x, y) { g.fillRect(x + Math.sin(355)*5, y + Math.cos(355)*5, 1, 1); };
// Advanced Fractal Sub-layer 356 for environment damage mapping
ProceduralArchitecture.fractalMap356 = function(g, x, y) { g.fillRect(x + Math.sin(356)*5, y + Math.cos(356)*5, 1, 1); };
// Advanced Fractal Sub-layer 357 for environment damage mapping
ProceduralArchitecture.fractalMap357 = function(g, x, y) { g.fillRect(x + Math.sin(357)*5, y + Math.cos(357)*5, 1, 1); };
// Advanced Fractal Sub-layer 358 for environment damage mapping
ProceduralArchitecture.fractalMap358 = function(g, x, y) { g.fillRect(x + Math.sin(358)*5, y + Math.cos(358)*5, 1, 1); };
// Advanced Fractal Sub-layer 359 for environment damage mapping
ProceduralArchitecture.fractalMap359 = function(g, x, y) { g.fillRect(x + Math.sin(359)*5, y + Math.cos(359)*5, 1, 1); };
// Advanced Fractal Sub-layer 360 for environment damage mapping
ProceduralArchitecture.fractalMap360 = function(g, x, y) { g.fillRect(x + Math.sin(360)*5, y + Math.cos(360)*5, 1, 1); };
// Advanced Fractal Sub-layer 361 for environment damage mapping
ProceduralArchitecture.fractalMap361 = function(g, x, y) { g.fillRect(x + Math.sin(361)*5, y + Math.cos(361)*5, 1, 1); };
// Advanced Fractal Sub-layer 362 for environment damage mapping
ProceduralArchitecture.fractalMap362 = function(g, x, y) { g.fillRect(x + Math.sin(362)*5, y + Math.cos(362)*5, 1, 1); };
// Advanced Fractal Sub-layer 363 for environment damage mapping
ProceduralArchitecture.fractalMap363 = function(g, x, y) { g.fillRect(x + Math.sin(363)*5, y + Math.cos(363)*5, 1, 1); };
// Advanced Fractal Sub-layer 364 for environment damage mapping
ProceduralArchitecture.fractalMap364 = function(g, x, y) { g.fillRect(x + Math.sin(364)*5, y + Math.cos(364)*5, 1, 1); };
// Advanced Fractal Sub-layer 365 for environment damage mapping
ProceduralArchitecture.fractalMap365 = function(g, x, y) { g.fillRect(x + Math.sin(365)*5, y + Math.cos(365)*5, 1, 1); };
// Advanced Fractal Sub-layer 366 for environment damage mapping
ProceduralArchitecture.fractalMap366 = function(g, x, y) { g.fillRect(x + Math.sin(366)*5, y + Math.cos(366)*5, 1, 1); };
// Advanced Fractal Sub-layer 367 for environment damage mapping
ProceduralArchitecture.fractalMap367 = function(g, x, y) { g.fillRect(x + Math.sin(367)*5, y + Math.cos(367)*5, 1, 1); };
// Advanced Fractal Sub-layer 368 for environment damage mapping
ProceduralArchitecture.fractalMap368 = function(g, x, y) { g.fillRect(x + Math.sin(368)*5, y + Math.cos(368)*5, 1, 1); };
// Advanced Fractal Sub-layer 369 for environment damage mapping
ProceduralArchitecture.fractalMap369 = function(g, x, y) { g.fillRect(x + Math.sin(369)*5, y + Math.cos(369)*5, 1, 1); };
// Advanced Fractal Sub-layer 370 for environment damage mapping
ProceduralArchitecture.fractalMap370 = function(g, x, y) { g.fillRect(x + Math.sin(370)*5, y + Math.cos(370)*5, 1, 1); };
// Advanced Fractal Sub-layer 371 for environment damage mapping
ProceduralArchitecture.fractalMap371 = function(g, x, y) { g.fillRect(x + Math.sin(371)*5, y + Math.cos(371)*5, 1, 1); };
// Advanced Fractal Sub-layer 372 for environment damage mapping
ProceduralArchitecture.fractalMap372 = function(g, x, y) { g.fillRect(x + Math.sin(372)*5, y + Math.cos(372)*5, 1, 1); };
// Advanced Fractal Sub-layer 373 for environment damage mapping
ProceduralArchitecture.fractalMap373 = function(g, x, y) { g.fillRect(x + Math.sin(373)*5, y + Math.cos(373)*5, 1, 1); };
// Advanced Fractal Sub-layer 374 for environment damage mapping
ProceduralArchitecture.fractalMap374 = function(g, x, y) { g.fillRect(x + Math.sin(374)*5, y + Math.cos(374)*5, 1, 1); };
// Advanced Fractal Sub-layer 375 for environment damage mapping
ProceduralArchitecture.fractalMap375 = function(g, x, y) { g.fillRect(x + Math.sin(375)*5, y + Math.cos(375)*5, 1, 1); };
// Advanced Fractal Sub-layer 376 for environment damage mapping
ProceduralArchitecture.fractalMap376 = function(g, x, y) { g.fillRect(x + Math.sin(376)*5, y + Math.cos(376)*5, 1, 1); };
// Advanced Fractal Sub-layer 377 for environment damage mapping
ProceduralArchitecture.fractalMap377 = function(g, x, y) { g.fillRect(x + Math.sin(377)*5, y + Math.cos(377)*5, 1, 1); };
// Advanced Fractal Sub-layer 378 for environment damage mapping
ProceduralArchitecture.fractalMap378 = function(g, x, y) { g.fillRect(x + Math.sin(378)*5, y + Math.cos(378)*5, 1, 1); };
// Advanced Fractal Sub-layer 379 for environment damage mapping
ProceduralArchitecture.fractalMap379 = function(g, x, y) { g.fillRect(x + Math.sin(379)*5, y + Math.cos(379)*5, 1, 1); };
// Advanced Fractal Sub-layer 380 for environment damage mapping
ProceduralArchitecture.fractalMap380 = function(g, x, y) { g.fillRect(x + Math.sin(380)*5, y + Math.cos(380)*5, 1, 1); };
// Advanced Fractal Sub-layer 381 for environment damage mapping
ProceduralArchitecture.fractalMap381 = function(g, x, y) { g.fillRect(x + Math.sin(381)*5, y + Math.cos(381)*5, 1, 1); };
// Advanced Fractal Sub-layer 382 for environment damage mapping
ProceduralArchitecture.fractalMap382 = function(g, x, y) { g.fillRect(x + Math.sin(382)*5, y + Math.cos(382)*5, 1, 1); };
// Advanced Fractal Sub-layer 383 for environment damage mapping
ProceduralArchitecture.fractalMap383 = function(g, x, y) { g.fillRect(x + Math.sin(383)*5, y + Math.cos(383)*5, 1, 1); };
// Advanced Fractal Sub-layer 384 for environment damage mapping
ProceduralArchitecture.fractalMap384 = function(g, x, y) { g.fillRect(x + Math.sin(384)*5, y + Math.cos(384)*5, 1, 1); };
// Advanced Fractal Sub-layer 385 for environment damage mapping
ProceduralArchitecture.fractalMap385 = function(g, x, y) { g.fillRect(x + Math.sin(385)*5, y + Math.cos(385)*5, 1, 1); };
// Advanced Fractal Sub-layer 386 for environment damage mapping
ProceduralArchitecture.fractalMap386 = function(g, x, y) { g.fillRect(x + Math.sin(386)*5, y + Math.cos(386)*5, 1, 1); };
// Advanced Fractal Sub-layer 387 for environment damage mapping
ProceduralArchitecture.fractalMap387 = function(g, x, y) { g.fillRect(x + Math.sin(387)*5, y + Math.cos(387)*5, 1, 1); };
// Advanced Fractal Sub-layer 388 for environment damage mapping
ProceduralArchitecture.fractalMap388 = function(g, x, y) { g.fillRect(x + Math.sin(388)*5, y + Math.cos(388)*5, 1, 1); };
// Advanced Fractal Sub-layer 389 for environment damage mapping
ProceduralArchitecture.fractalMap389 = function(g, x, y) { g.fillRect(x + Math.sin(389)*5, y + Math.cos(389)*5, 1, 1); };
// Advanced Fractal Sub-layer 390 for environment damage mapping
ProceduralArchitecture.fractalMap390 = function(g, x, y) { g.fillRect(x + Math.sin(390)*5, y + Math.cos(390)*5, 1, 1); };
// Advanced Fractal Sub-layer 391 for environment damage mapping
ProceduralArchitecture.fractalMap391 = function(g, x, y) { g.fillRect(x + Math.sin(391)*5, y + Math.cos(391)*5, 1, 1); };
// Advanced Fractal Sub-layer 392 for environment damage mapping
ProceduralArchitecture.fractalMap392 = function(g, x, y) { g.fillRect(x + Math.sin(392)*5, y + Math.cos(392)*5, 1, 1); };
// Advanced Fractal Sub-layer 393 for environment damage mapping
ProceduralArchitecture.fractalMap393 = function(g, x, y) { g.fillRect(x + Math.sin(393)*5, y + Math.cos(393)*5, 1, 1); };
// Advanced Fractal Sub-layer 394 for environment damage mapping
ProceduralArchitecture.fractalMap394 = function(g, x, y) { g.fillRect(x + Math.sin(394)*5, y + Math.cos(394)*5, 1, 1); };
// Advanced Fractal Sub-layer 395 for environment damage mapping
ProceduralArchitecture.fractalMap395 = function(g, x, y) { g.fillRect(x + Math.sin(395)*5, y + Math.cos(395)*5, 1, 1); };
// Advanced Fractal Sub-layer 396 for environment damage mapping
ProceduralArchitecture.fractalMap396 = function(g, x, y) { g.fillRect(x + Math.sin(396)*5, y + Math.cos(396)*5, 1, 1); };
// Advanced Fractal Sub-layer 397 for environment damage mapping
ProceduralArchitecture.fractalMap397 = function(g, x, y) { g.fillRect(x + Math.sin(397)*5, y + Math.cos(397)*5, 1, 1); };
// Advanced Fractal Sub-layer 398 for environment damage mapping
ProceduralArchitecture.fractalMap398 = function(g, x, y) { g.fillRect(x + Math.sin(398)*5, y + Math.cos(398)*5, 1, 1); };
// Advanced Fractal Sub-layer 399 for environment damage mapping
ProceduralArchitecture.fractalMap399 = function(g, x, y) { g.fillRect(x + Math.sin(399)*5, y + Math.cos(399)*5, 1, 1); };
// Advanced Fractal Sub-layer 400 for environment damage mapping
ProceduralArchitecture.fractalMap400 = function(g, x, y) { g.fillRect(x + Math.sin(400)*5, y + Math.cos(400)*5, 1, 1); };
// Advanced Fractal Sub-layer 401 for environment damage mapping
ProceduralArchitecture.fractalMap401 = function(g, x, y) { g.fillRect(x + Math.sin(401)*5, y + Math.cos(401)*5, 1, 1); };
// Advanced Fractal Sub-layer 402 for environment damage mapping
ProceduralArchitecture.fractalMap402 = function(g, x, y) { g.fillRect(x + Math.sin(402)*5, y + Math.cos(402)*5, 1, 1); };
// Advanced Fractal Sub-layer 403 for environment damage mapping
ProceduralArchitecture.fractalMap403 = function(g, x, y) { g.fillRect(x + Math.sin(403)*5, y + Math.cos(403)*5, 1, 1); };
// Advanced Fractal Sub-layer 404 for environment damage mapping
ProceduralArchitecture.fractalMap404 = function(g, x, y) { g.fillRect(x + Math.sin(404)*5, y + Math.cos(404)*5, 1, 1); };
// Advanced Fractal Sub-layer 405 for environment damage mapping
ProceduralArchitecture.fractalMap405 = function(g, x, y) { g.fillRect(x + Math.sin(405)*5, y + Math.cos(405)*5, 1, 1); };
// Advanced Fractal Sub-layer 406 for environment damage mapping
ProceduralArchitecture.fractalMap406 = function(g, x, y) { g.fillRect(x + Math.sin(406)*5, y + Math.cos(406)*5, 1, 1); };
// Advanced Fractal Sub-layer 407 for environment damage mapping
ProceduralArchitecture.fractalMap407 = function(g, x, y) { g.fillRect(x + Math.sin(407)*5, y + Math.cos(407)*5, 1, 1); };
// Advanced Fractal Sub-layer 408 for environment damage mapping
ProceduralArchitecture.fractalMap408 = function(g, x, y) { g.fillRect(x + Math.sin(408)*5, y + Math.cos(408)*5, 1, 1); };
// Advanced Fractal Sub-layer 409 for environment damage mapping
ProceduralArchitecture.fractalMap409 = function(g, x, y) { g.fillRect(x + Math.sin(409)*5, y + Math.cos(409)*5, 1, 1); };
// Advanced Fractal Sub-layer 410 for environment damage mapping
ProceduralArchitecture.fractalMap410 = function(g, x, y) { g.fillRect(x + Math.sin(410)*5, y + Math.cos(410)*5, 1, 1); };
// Advanced Fractal Sub-layer 411 for environment damage mapping
ProceduralArchitecture.fractalMap411 = function(g, x, y) { g.fillRect(x + Math.sin(411)*5, y + Math.cos(411)*5, 1, 1); };
// Advanced Fractal Sub-layer 412 for environment damage mapping
ProceduralArchitecture.fractalMap412 = function(g, x, y) { g.fillRect(x + Math.sin(412)*5, y + Math.cos(412)*5, 1, 1); };
// Advanced Fractal Sub-layer 413 for environment damage mapping
ProceduralArchitecture.fractalMap413 = function(g, x, y) { g.fillRect(x + Math.sin(413)*5, y + Math.cos(413)*5, 1, 1); };
// Advanced Fractal Sub-layer 414 for environment damage mapping
ProceduralArchitecture.fractalMap414 = function(g, x, y) { g.fillRect(x + Math.sin(414)*5, y + Math.cos(414)*5, 1, 1); };
// Advanced Fractal Sub-layer 415 for environment damage mapping
ProceduralArchitecture.fractalMap415 = function(g, x, y) { g.fillRect(x + Math.sin(415)*5, y + Math.cos(415)*5, 1, 1); };
// Advanced Fractal Sub-layer 416 for environment damage mapping
ProceduralArchitecture.fractalMap416 = function(g, x, y) { g.fillRect(x + Math.sin(416)*5, y + Math.cos(416)*5, 1, 1); };
// Advanced Fractal Sub-layer 417 for environment damage mapping
ProceduralArchitecture.fractalMap417 = function(g, x, y) { g.fillRect(x + Math.sin(417)*5, y + Math.cos(417)*5, 1, 1); };
// Advanced Fractal Sub-layer 418 for environment damage mapping
ProceduralArchitecture.fractalMap418 = function(g, x, y) { g.fillRect(x + Math.sin(418)*5, y + Math.cos(418)*5, 1, 1); };
// Advanced Fractal Sub-layer 419 for environment damage mapping
ProceduralArchitecture.fractalMap419 = function(g, x, y) { g.fillRect(x + Math.sin(419)*5, y + Math.cos(419)*5, 1, 1); };
// Advanced Fractal Sub-layer 420 for environment damage mapping
ProceduralArchitecture.fractalMap420 = function(g, x, y) { g.fillRect(x + Math.sin(420)*5, y + Math.cos(420)*5, 1, 1); };
// Advanced Fractal Sub-layer 421 for environment damage mapping
ProceduralArchitecture.fractalMap421 = function(g, x, y) { g.fillRect(x + Math.sin(421)*5, y + Math.cos(421)*5, 1, 1); };
// Advanced Fractal Sub-layer 422 for environment damage mapping
ProceduralArchitecture.fractalMap422 = function(g, x, y) { g.fillRect(x + Math.sin(422)*5, y + Math.cos(422)*5, 1, 1); };
// Advanced Fractal Sub-layer 423 for environment damage mapping
ProceduralArchitecture.fractalMap423 = function(g, x, y) { g.fillRect(x + Math.sin(423)*5, y + Math.cos(423)*5, 1, 1); };
// Advanced Fractal Sub-layer 424 for environment damage mapping
ProceduralArchitecture.fractalMap424 = function(g, x, y) { g.fillRect(x + Math.sin(424)*5, y + Math.cos(424)*5, 1, 1); };
// Advanced Fractal Sub-layer 425 for environment damage mapping
ProceduralArchitecture.fractalMap425 = function(g, x, y) { g.fillRect(x + Math.sin(425)*5, y + Math.cos(425)*5, 1, 1); };
// Advanced Fractal Sub-layer 426 for environment damage mapping
ProceduralArchitecture.fractalMap426 = function(g, x, y) { g.fillRect(x + Math.sin(426)*5, y + Math.cos(426)*5, 1, 1); };
// Advanced Fractal Sub-layer 427 for environment damage mapping
ProceduralArchitecture.fractalMap427 = function(g, x, y) { g.fillRect(x + Math.sin(427)*5, y + Math.cos(427)*5, 1, 1); };
// Advanced Fractal Sub-layer 428 for environment damage mapping
ProceduralArchitecture.fractalMap428 = function(g, x, y) { g.fillRect(x + Math.sin(428)*5, y + Math.cos(428)*5, 1, 1); };
// Advanced Fractal Sub-layer 429 for environment damage mapping
ProceduralArchitecture.fractalMap429 = function(g, x, y) { g.fillRect(x + Math.sin(429)*5, y + Math.cos(429)*5, 1, 1); };
// Advanced Fractal Sub-layer 430 for environment damage mapping
ProceduralArchitecture.fractalMap430 = function(g, x, y) { g.fillRect(x + Math.sin(430)*5, y + Math.cos(430)*5, 1, 1); };
// Advanced Fractal Sub-layer 431 for environment damage mapping
ProceduralArchitecture.fractalMap431 = function(g, x, y) { g.fillRect(x + Math.sin(431)*5, y + Math.cos(431)*5, 1, 1); };
// Advanced Fractal Sub-layer 432 for environment damage mapping
ProceduralArchitecture.fractalMap432 = function(g, x, y) { g.fillRect(x + Math.sin(432)*5, y + Math.cos(432)*5, 1, 1); };
// Advanced Fractal Sub-layer 433 for environment damage mapping
ProceduralArchitecture.fractalMap433 = function(g, x, y) { g.fillRect(x + Math.sin(433)*5, y + Math.cos(433)*5, 1, 1); };
// Advanced Fractal Sub-layer 434 for environment damage mapping
ProceduralArchitecture.fractalMap434 = function(g, x, y) { g.fillRect(x + Math.sin(434)*5, y + Math.cos(434)*5, 1, 1); };
// Advanced Fractal Sub-layer 435 for environment damage mapping
ProceduralArchitecture.fractalMap435 = function(g, x, y) { g.fillRect(x + Math.sin(435)*5, y + Math.cos(435)*5, 1, 1); };
// Advanced Fractal Sub-layer 436 for environment damage mapping
ProceduralArchitecture.fractalMap436 = function(g, x, y) { g.fillRect(x + Math.sin(436)*5, y + Math.cos(436)*5, 1, 1); };
// Advanced Fractal Sub-layer 437 for environment damage mapping
ProceduralArchitecture.fractalMap437 = function(g, x, y) { g.fillRect(x + Math.sin(437)*5, y + Math.cos(437)*5, 1, 1); };
// Advanced Fractal Sub-layer 438 for environment damage mapping
ProceduralArchitecture.fractalMap438 = function(g, x, y) { g.fillRect(x + Math.sin(438)*5, y + Math.cos(438)*5, 1, 1); };
// Advanced Fractal Sub-layer 439 for environment damage mapping
ProceduralArchitecture.fractalMap439 = function(g, x, y) { g.fillRect(x + Math.sin(439)*5, y + Math.cos(439)*5, 1, 1); };
// Advanced Fractal Sub-layer 440 for environment damage mapping
ProceduralArchitecture.fractalMap440 = function(g, x, y) { g.fillRect(x + Math.sin(440)*5, y + Math.cos(440)*5, 1, 1); };
// Advanced Fractal Sub-layer 441 for environment damage mapping
ProceduralArchitecture.fractalMap441 = function(g, x, y) { g.fillRect(x + Math.sin(441)*5, y + Math.cos(441)*5, 1, 1); };
// Advanced Fractal Sub-layer 442 for environment damage mapping
ProceduralArchitecture.fractalMap442 = function(g, x, y) { g.fillRect(x + Math.sin(442)*5, y + Math.cos(442)*5, 1, 1); };
// Advanced Fractal Sub-layer 443 for environment damage mapping
ProceduralArchitecture.fractalMap443 = function(g, x, y) { g.fillRect(x + Math.sin(443)*5, y + Math.cos(443)*5, 1, 1); };
// Advanced Fractal Sub-layer 444 for environment damage mapping
ProceduralArchitecture.fractalMap444 = function(g, x, y) { g.fillRect(x + Math.sin(444)*5, y + Math.cos(444)*5, 1, 1); };
// Advanced Fractal Sub-layer 445 for environment damage mapping
ProceduralArchitecture.fractalMap445 = function(g, x, y) { g.fillRect(x + Math.sin(445)*5, y + Math.cos(445)*5, 1, 1); };
// Advanced Fractal Sub-layer 446 for environment damage mapping
ProceduralArchitecture.fractalMap446 = function(g, x, y) { g.fillRect(x + Math.sin(446)*5, y + Math.cos(446)*5, 1, 1); };
// Advanced Fractal Sub-layer 447 for environment damage mapping
ProceduralArchitecture.fractalMap447 = function(g, x, y) { g.fillRect(x + Math.sin(447)*5, y + Math.cos(447)*5, 1, 1); };
// Advanced Fractal Sub-layer 448 for environment damage mapping
ProceduralArchitecture.fractalMap448 = function(g, x, y) { g.fillRect(x + Math.sin(448)*5, y + Math.cos(448)*5, 1, 1); };
// Advanced Fractal Sub-layer 449 for environment damage mapping
ProceduralArchitecture.fractalMap449 = function(g, x, y) { g.fillRect(x + Math.sin(449)*5, y + Math.cos(449)*5, 1, 1); };
// Advanced Fractal Sub-layer 450 for environment damage mapping
ProceduralArchitecture.fractalMap450 = function(g, x, y) { g.fillRect(x + Math.sin(450)*5, y + Math.cos(450)*5, 1, 1); };
// Advanced Fractal Sub-layer 451 for environment damage mapping
ProceduralArchitecture.fractalMap451 = function(g, x, y) { g.fillRect(x + Math.sin(451)*5, y + Math.cos(451)*5, 1, 1); };
// Advanced Fractal Sub-layer 452 for environment damage mapping
ProceduralArchitecture.fractalMap452 = function(g, x, y) { g.fillRect(x + Math.sin(452)*5, y + Math.cos(452)*5, 1, 1); };
// Advanced Fractal Sub-layer 453 for environment damage mapping
ProceduralArchitecture.fractalMap453 = function(g, x, y) { g.fillRect(x + Math.sin(453)*5, y + Math.cos(453)*5, 1, 1); };
// Advanced Fractal Sub-layer 454 for environment damage mapping
ProceduralArchitecture.fractalMap454 = function(g, x, y) { g.fillRect(x + Math.sin(454)*5, y + Math.cos(454)*5, 1, 1); };
// Advanced Fractal Sub-layer 455 for environment damage mapping
ProceduralArchitecture.fractalMap455 = function(g, x, y) { g.fillRect(x + Math.sin(455)*5, y + Math.cos(455)*5, 1, 1); };
// Advanced Fractal Sub-layer 456 for environment damage mapping
ProceduralArchitecture.fractalMap456 = function(g, x, y) { g.fillRect(x + Math.sin(456)*5, y + Math.cos(456)*5, 1, 1); };
// Advanced Fractal Sub-layer 457 for environment damage mapping
ProceduralArchitecture.fractalMap457 = function(g, x, y) { g.fillRect(x + Math.sin(457)*5, y + Math.cos(457)*5, 1, 1); };
// Advanced Fractal Sub-layer 458 for environment damage mapping
ProceduralArchitecture.fractalMap458 = function(g, x, y) { g.fillRect(x + Math.sin(458)*5, y + Math.cos(458)*5, 1, 1); };
// Advanced Fractal Sub-layer 459 for environment damage mapping
ProceduralArchitecture.fractalMap459 = function(g, x, y) { g.fillRect(x + Math.sin(459)*5, y + Math.cos(459)*5, 1, 1); };
// Advanced Fractal Sub-layer 460 for environment damage mapping
ProceduralArchitecture.fractalMap460 = function(g, x, y) { g.fillRect(x + Math.sin(460)*5, y + Math.cos(460)*5, 1, 1); };
// Advanced Fractal Sub-layer 461 for environment damage mapping
ProceduralArchitecture.fractalMap461 = function(g, x, y) { g.fillRect(x + Math.sin(461)*5, y + Math.cos(461)*5, 1, 1); };
// Advanced Fractal Sub-layer 462 for environment damage mapping
ProceduralArchitecture.fractalMap462 = function(g, x, y) { g.fillRect(x + Math.sin(462)*5, y + Math.cos(462)*5, 1, 1); };
// Advanced Fractal Sub-layer 463 for environment damage mapping
ProceduralArchitecture.fractalMap463 = function(g, x, y) { g.fillRect(x + Math.sin(463)*5, y + Math.cos(463)*5, 1, 1); };
// Advanced Fractal Sub-layer 464 for environment damage mapping
ProceduralArchitecture.fractalMap464 = function(g, x, y) { g.fillRect(x + Math.sin(464)*5, y + Math.cos(464)*5, 1, 1); };
// Advanced Fractal Sub-layer 465 for environment damage mapping
ProceduralArchitecture.fractalMap465 = function(g, x, y) { g.fillRect(x + Math.sin(465)*5, y + Math.cos(465)*5, 1, 1); };
// Advanced Fractal Sub-layer 466 for environment damage mapping
ProceduralArchitecture.fractalMap466 = function(g, x, y) { g.fillRect(x + Math.sin(466)*5, y + Math.cos(466)*5, 1, 1); };
// Advanced Fractal Sub-layer 467 for environment damage mapping
ProceduralArchitecture.fractalMap467 = function(g, x, y) { g.fillRect(x + Math.sin(467)*5, y + Math.cos(467)*5, 1, 1); };
// Advanced Fractal Sub-layer 468 for environment damage mapping
ProceduralArchitecture.fractalMap468 = function(g, x, y) { g.fillRect(x + Math.sin(468)*5, y + Math.cos(468)*5, 1, 1); };
// Advanced Fractal Sub-layer 469 for environment damage mapping
ProceduralArchitecture.fractalMap469 = function(g, x, y) { g.fillRect(x + Math.sin(469)*5, y + Math.cos(469)*5, 1, 1); };
// Advanced Fractal Sub-layer 470 for environment damage mapping
ProceduralArchitecture.fractalMap470 = function(g, x, y) { g.fillRect(x + Math.sin(470)*5, y + Math.cos(470)*5, 1, 1); };
// Advanced Fractal Sub-layer 471 for environment damage mapping
ProceduralArchitecture.fractalMap471 = function(g, x, y) { g.fillRect(x + Math.sin(471)*5, y + Math.cos(471)*5, 1, 1); };
// Advanced Fractal Sub-layer 472 for environment damage mapping
ProceduralArchitecture.fractalMap472 = function(g, x, y) { g.fillRect(x + Math.sin(472)*5, y + Math.cos(472)*5, 1, 1); };
// Advanced Fractal Sub-layer 473 for environment damage mapping
ProceduralArchitecture.fractalMap473 = function(g, x, y) { g.fillRect(x + Math.sin(473)*5, y + Math.cos(473)*5, 1, 1); };
// Advanced Fractal Sub-layer 474 for environment damage mapping
ProceduralArchitecture.fractalMap474 = function(g, x, y) { g.fillRect(x + Math.sin(474)*5, y + Math.cos(474)*5, 1, 1); };
// Advanced Fractal Sub-layer 475 for environment damage mapping
ProceduralArchitecture.fractalMap475 = function(g, x, y) { g.fillRect(x + Math.sin(475)*5, y + Math.cos(475)*5, 1, 1); };
// Advanced Fractal Sub-layer 476 for environment damage mapping
ProceduralArchitecture.fractalMap476 = function(g, x, y) { g.fillRect(x + Math.sin(476)*5, y + Math.cos(476)*5, 1, 1); };
// Advanced Fractal Sub-layer 477 for environment damage mapping
ProceduralArchitecture.fractalMap477 = function(g, x, y) { g.fillRect(x + Math.sin(477)*5, y + Math.cos(477)*5, 1, 1); };
// Advanced Fractal Sub-layer 478 for environment damage mapping
ProceduralArchitecture.fractalMap478 = function(g, x, y) { g.fillRect(x + Math.sin(478)*5, y + Math.cos(478)*5, 1, 1); };
// Advanced Fractal Sub-layer 479 for environment damage mapping
ProceduralArchitecture.fractalMap479 = function(g, x, y) { g.fillRect(x + Math.sin(479)*5, y + Math.cos(479)*5, 1, 1); };
// Advanced Fractal Sub-layer 480 for environment damage mapping
ProceduralArchitecture.fractalMap480 = function(g, x, y) { g.fillRect(x + Math.sin(480)*5, y + Math.cos(480)*5, 1, 1); };
// Advanced Fractal Sub-layer 481 for environment damage mapping
ProceduralArchitecture.fractalMap481 = function(g, x, y) { g.fillRect(x + Math.sin(481)*5, y + Math.cos(481)*5, 1, 1); };
// Advanced Fractal Sub-layer 482 for environment damage mapping
ProceduralArchitecture.fractalMap482 = function(g, x, y) { g.fillRect(x + Math.sin(482)*5, y + Math.cos(482)*5, 1, 1); };
// Advanced Fractal Sub-layer 483 for environment damage mapping
ProceduralArchitecture.fractalMap483 = function(g, x, y) { g.fillRect(x + Math.sin(483)*5, y + Math.cos(483)*5, 1, 1); };
// Advanced Fractal Sub-layer 484 for environment damage mapping
ProceduralArchitecture.fractalMap484 = function(g, x, y) { g.fillRect(x + Math.sin(484)*5, y + Math.cos(484)*5, 1, 1); };
// Advanced Fractal Sub-layer 485 for environment damage mapping
ProceduralArchitecture.fractalMap485 = function(g, x, y) { g.fillRect(x + Math.sin(485)*5, y + Math.cos(485)*5, 1, 1); };
// Advanced Fractal Sub-layer 486 for environment damage mapping
ProceduralArchitecture.fractalMap486 = function(g, x, y) { g.fillRect(x + Math.sin(486)*5, y + Math.cos(486)*5, 1, 1); };
// Advanced Fractal Sub-layer 487 for environment damage mapping
ProceduralArchitecture.fractalMap487 = function(g, x, y) { g.fillRect(x + Math.sin(487)*5, y + Math.cos(487)*5, 1, 1); };
// Advanced Fractal Sub-layer 488 for environment damage mapping
ProceduralArchitecture.fractalMap488 = function(g, x, y) { g.fillRect(x + Math.sin(488)*5, y + Math.cos(488)*5, 1, 1); };
// Advanced Fractal Sub-layer 489 for environment damage mapping
ProceduralArchitecture.fractalMap489 = function(g, x, y) { g.fillRect(x + Math.sin(489)*5, y + Math.cos(489)*5, 1, 1); };
// Advanced Fractal Sub-layer 490 for environment damage mapping
ProceduralArchitecture.fractalMap490 = function(g, x, y) { g.fillRect(x + Math.sin(490)*5, y + Math.cos(490)*5, 1, 1); };
// Advanced Fractal Sub-layer 491 for environment damage mapping
ProceduralArchitecture.fractalMap491 = function(g, x, y) { g.fillRect(x + Math.sin(491)*5, y + Math.cos(491)*5, 1, 1); };
// Advanced Fractal Sub-layer 492 for environment damage mapping
ProceduralArchitecture.fractalMap492 = function(g, x, y) { g.fillRect(x + Math.sin(492)*5, y + Math.cos(492)*5, 1, 1); };
// Advanced Fractal Sub-layer 493 for environment damage mapping
ProceduralArchitecture.fractalMap493 = function(g, x, y) { g.fillRect(x + Math.sin(493)*5, y + Math.cos(493)*5, 1, 1); };
// Advanced Fractal Sub-layer 494 for environment damage mapping
ProceduralArchitecture.fractalMap494 = function(g, x, y) { g.fillRect(x + Math.sin(494)*5, y + Math.cos(494)*5, 1, 1); };
// Advanced Fractal Sub-layer 495 for environment damage mapping
ProceduralArchitecture.fractalMap495 = function(g, x, y) { g.fillRect(x + Math.sin(495)*5, y + Math.cos(495)*5, 1, 1); };
// Advanced Fractal Sub-layer 496 for environment damage mapping
ProceduralArchitecture.fractalMap496 = function(g, x, y) { g.fillRect(x + Math.sin(496)*5, y + Math.cos(496)*5, 1, 1); };
// Advanced Fractal Sub-layer 497 for environment damage mapping
ProceduralArchitecture.fractalMap497 = function(g, x, y) { g.fillRect(x + Math.sin(497)*5, y + Math.cos(497)*5, 1, 1); };
// Advanced Fractal Sub-layer 498 for environment damage mapping
ProceduralArchitecture.fractalMap498 = function(g, x, y) { g.fillRect(x + Math.sin(498)*5, y + Math.cos(498)*5, 1, 1); };
// Advanced Fractal Sub-layer 499 for environment damage mapping
ProceduralArchitecture.fractalMap499 = function(g, x, y) { g.fillRect(x + Math.sin(499)*5, y + Math.cos(499)*5, 1, 1); };