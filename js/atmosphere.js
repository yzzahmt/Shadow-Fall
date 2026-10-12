/* ============================================================
   SHADOW FALL — Atmosphere Engine v6
   Görsel kimlik: "soğuk gümüş" siyah-beyaz — gölgeler mavi-çelik,
   ışıklar kemik beyazı. Keskin kenarlı ay ve önünden geçen bulut
   bantları, açık havada şimşekle aniden aydınlanan siluetler,
   ağır ağır düşen kül, ay ışığı vurmuş zemin sırtları. Dünyadaki
   tek renk aksanı kızıl (göz, uyarı, atkı).
   Tüm dokular prosedürel üretilir — hiç asset yok.
   ============================================================ */
'use strict';

const Atmo = {

  /* renk derecelendirme: rengi parlaklığına indirger ve soğuk çelik tonuna boyar
     (tam gri değil — gölgeler mavimsi, açık tonlar kemik beyazına kayar) */
  grade(c) {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    const L = 0.3 * r + 0.55 * g + 0.15 * b;
    const t = clamp(L / 120, 0, 1);
    const R = L * lerp(0.86, 1.0, t), G = L * lerp(0.95, 1.0, t), B = L * lerp(1.16, 1.03, t);
    return (clamp(Math.round(R), 0, 255) << 16) | (clamp(Math.round(G), 0, 255) << 8) | clamp(Math.round(B), 0, 255);
  },

  // ---------- prosedürel dokular ----------
  generateTextures(scene) {
    const W = 512;

    // yumuşak radyal nokta (parçacıklar, ışık)
    if (!scene.textures.exists('softDot')) {
      const c = scene.textures.createCanvas('softDot', 64, 64);
      const g = c.context;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      c.refresh();
    }

    // sis kümesi — kabarık, düzensiz
    if (!scene.textures.exists('fogPuff')) {
      const c = scene.textures.createCanvas('fogPuff', 256, 128);
      const g = c.context;
      for (let i = 0; i < 26; i++) {
        const x = 30 + Math.random() * 196, y = 30 + Math.random() * 68;
        const r = 18 + Math.random() * 36;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,0.10)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      c.refresh();
    }

    // film greni — birkaç kare arasında geçiş yapılır
    for (let f = 0; f < 3; f++) {
      const key = 'grain' + f;
      if (!scene.textures.exists(key)) {
        const c = scene.textures.createCanvas(key, W, W);
        const g = c.context;
        const img = g.createImageData(W, W);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 14 + Math.random() * 16;
        }
        g.putImageData(img, 0, 0);
        c.refresh();
      }
    }

    // vinyet
    if (!scene.textures.exists('vignette')) {
      const c = scene.textures.createCanvas('vignette', W, 256);
      const g = c.context;
      const grd = g.createRadialGradient(W / 2, 128, 60, W / 2, 128, 290);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.62, 'rgba(0,0,0,0.05)');
      grd.addColorStop(1, 'rgba(0,0,0,0.62)');
      g.fillStyle = grd; g.fillRect(0, 0, W, 256);
      c.refresh();
    }

    // ışık hüzmesi — üstten gelen volumetrik şaft
    if (!scene.textures.exists('lightShaft')) {
      const c = scene.textures.createCanvas('lightShaft', 256, 512);
      const g = c.context;
      const grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, 'rgba(235,232,225,0.16)');
      grd.addColorStop(0.7, 'rgba(235,232,225,0.04)');
      grd.addColorStop(1, 'rgba(235,232,225,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(96, 0); g.lineTo(160, 0); g.lineTo(240, 512); g.lineTo(16, 512);
      g.closePath(); g.fill();
      c.refresh();
    }

    // yağmur çizgisi
    if (!scene.textures.exists('rainDrop')) {
      const c = scene.textures.createCanvas('rainDrop', 4, 36);
      const g = c.context;
      const grd = g.createLinearGradient(0, 0, 0, 36);
      grd.addColorStop(0, 'rgba(200,205,215,0)');
      grd.addColorStop(0.5, 'rgba(200,205,215,0.35)');
      grd.addColorStop(1, 'rgba(200,205,215,0.08)');
      g.fillStyle = grd; g.fillRect(1, 0, 2, 36);
      c.refresh();
    }

    // ay diski — keskin kenarlı, hafif lekeli (bulanık bir leke değil)
    if (!scene.textures.exists('moonDisk')) {
      const c = scene.textures.createCanvas('moonDisk', 128, 128);
      const g = c.context;
      const grd = g.createRadialGradient(54, 54, 6, 64, 64, 50);
      grd.addColorStop(0, 'rgba(244,244,240,1)');
      grd.addColorStop(1, 'rgba(206,212,222,1)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(150,158,172,0.18)';
      for (const [x, y, r] of [[48, 52, 9], [76, 70, 12], [60, 84, 6], [82, 44, 5], [40, 74, 4]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      c.refresh();
    }
    // bulut bandı — ayın önünden geçen ince, yırtık bulutlar
    if (!scene.textures.exists('cloudBand')) {
      const c = scene.textures.createCanvas('cloudBand', 512, 96);
      const g = c.context;
      for (let i = 0; i < 34; i++) {
        const x = Math.random() * 512, y = 30 + Math.random() * 36, rx = 30 + Math.random() * 70, ry = 6 + Math.random() * 10;
        const grd = g.createRadialGradient(x, y, 0, x, y, rx);
        grd.addColorStop(0, 'rgba(255,255,255,0.22)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.save(); g.translate(x, y); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
      }
      c.refresh();
    }
    // kül tanesi — düzensiz küçük pul
    if (!scene.textures.exists('ashFlake')) {
      const c = scene.textures.createCanvas('ashFlake', 8, 8);
      const g = c.context;
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.moveTo(1, 3); g.lineTo(4, 1); g.lineTo(7, 3); g.lineTo(6, 6); g.lineTo(2, 7); g.closePath(); g.fill();
      c.refresh();
    }

    // 1px beyaz (çeşitli kullanım)
    if (!scene.textures.exists('px')) {
      const c = scene.textures.createCanvas('px', 2, 2);
      c.context.fillStyle = '#fff'; c.context.fillRect(0, 0, 2, 2);
      c.refresh();
    }
  },

  /* ---------- paralaks siluet katmanları ----------
     Hava perspektifi: uzak katmanlar açık, yakın katmanlar koyu.
     layerSpec: { trees, hills, ruins, fence, factory } türleri */
  buildParallax(scene, worldW, opts = {}) {
    const H = scene.scale.height;
    const cam = scene.cameras.main;
    const layers = [];
    const pal0 = opts.palette || { sky0: 0x3c3f46, sky1: 0x17181d, far: 0x2e3037, mid: 0x1d1e24, near: 0x101116 };
    const palette = {};
    for (const k in pal0) palette[k] = Atmo.grade(pal0[k]);

    // --- gökyüzü gradyanı ---
    const skyTexKey = 'sky_' + (opts.id || 'default');
    if (!scene.textures.exists(skyTexKey)) {
      const c = scene.textures.createCanvas(skyTexKey, 32, 512);
      const g = c.context;
      const grd = g.createLinearGradient(0, 0, 0, 512);
      const c0 = Phaser.Display.Color.IntegerToColor(palette.sky0);
      const c1 = Phaser.Display.Color.IntegerToColor(palette.sky1);
      /* tepe koyu, ufuk çizgisine doğru ay ışığıyla açılan soğuk sis bandı —
         siluetler bu açık banda karşı keskin okunur */
      const mix = (a, b, t) => `rgb(${Math.round(lerp(a.red, b.red, t))},${Math.round(lerp(a.green, b.green, t))},${Math.round(lerp(a.blue, b.blue, t))})`;
      const hz = Phaser.Display.Color.IntegerToColor(Atmo.grade(0x5c636e));
      grd.addColorStop(0, mix(c1, c0, 0.35));
      grd.addColorStop(0.5, mix(c0, c1, 0.15));
      grd.addColorStop(0.78, mix(c0, hz, 0.45));
      grd.addColorStop(1, mix(c1, c0, 0.5));
      g.fillStyle = grd; g.fillRect(0, 0, 32, 512);
      c.refresh();
    }
    const sky = scene.add.image(0, 0, skyTexKey).setOrigin(0).setScrollFactor(0).setDepth(-100);
    sky.setDisplaySize(scene.scale.width + 4, H + 4);

    // --- ay: keskin disk + soğuk hale + önünden geçen bulut bantları ---
    let moon = null, moonGlow = null, clouds = null;
    if (opts.moon !== false) {
      const mx = scene.scale.width * 0.72, my = H * 0.22;
      moonGlow = scene.add.image(mx, my, 'softDot').setScrollFactor(0).setDepth(-99)
        .setScale(7).setAlpha(0.13).setBlendMode(Phaser.BlendModes.ADD).setTint(0xb8c4d8);
      moon = scene.add.image(mx, my, 'moonDisk').setScrollFactor(0).setDepth(-99)
        .setScale(0.42).setAlpha(0.82);
      clouds = scene.add.tileSprite(0, my + 6, scene.scale.width, 96, 'cloudBand').setOrigin(0, 0.5)
        .setScrollFactor(0).setDepth(-98).setTint(0x1a1d24).setAlpha(0.9);
    }

    // --- şimşek: gökyüzü bir anlığına beyazlar, uzak katmanlar siyah kesilir ---
    let bolt = null, boltT = 6 + Math.random() * 10;
    if (opts.lightning) {
      bolt = scene.add.rectangle(0, 0, scene.scale.width + 8, H + 8, 0xdfe6f2, 0).setOrigin(0).setScrollFactor(0).setDepth(-97);
    }
    const fireBolt = () => {
      if (!bolt) return;
      const seq = [[0, 0.55], [90, 0.08], [150, 0.42], [260, 0]];
      for (const [d, a] of seq) scene.time.delayedCall(d, () => bolt.setAlpha(a));
      scene.tweens.add({ targets: bolt, alpha: 0, delay: 280, duration: 520 });
      if (scene.lights2) scene.lights2.flash = 1;
      scene.time.delayedCall(500 + Math.random() * 1200, () => SFAudio.thunder?.());
    };

    // --- siluet katmanları çiz ---
    const mkSilhouette = (key, color, type, seedBase, yGround, heightScale) => {
      const texW = 1024, texH = 512;
      if (!scene.textures.exists(key)) {
        const c = scene.textures.createCanvas(key, texW, texH);
        const g = c.context;
        const col = Phaser.Display.Color.IntegerToColor(color);
        g.fillStyle = `rgb(${col.red},${col.green},${col.blue})`;
        const rng = Atmo._mulberry(seedBase);

        if (type === 'trees') {
          // çıplak, eğri ağaçlar — yanmış orman
          let x = 20;
          while (x < texW - 20) {
            const h = (140 + rng() * 200) * heightScale;
            const baseY = texH;
            const lean = (rng() - 0.5) * 60;
            const w0 = 7 + rng() * 9;
            // gövde (eğri)
            g.beginPath();
            g.moveTo(x - w0, baseY);
            g.quadraticCurveTo(x + lean * 0.4 - w0 * 0.4, baseY - h * 0.55, x + lean - 1.5, baseY - h);
            g.lineTo(x + lean + 1.5, baseY - h);
            g.quadraticCurveTo(x + lean * 0.4 + w0 * 0.4, baseY - h * 0.55, x + w0, baseY);
            g.closePath(); g.fill();
            // dallar
            const nB = 2 + Math.floor(rng() * 4);
            for (let b = 0; b < nB; b++) {
              const t = 0.45 + rng() * 0.5;
              const bx = x + lean * t * 0.9, by = baseY - h * t;
              const bl = 24 + rng() * 50, ba = -0.2 - rng() * 1.1, dir = rng() > 0.5 ? 1 : -1;
              g.beginPath();
              g.moveTo(bx, by);
              g.quadraticCurveTo(bx + dir * bl * 0.5, by - bl * 0.36, bx + dir * Math.cos(ba) * bl, by - Math.abs(Math.sin(ba)) * bl);
              g.lineWidth = 2 + rng() * 2.5; g.strokeStyle = g.fillStyle; g.stroke();
            }
            x += 60 + rng() * 130;
          }
        } else if (type === 'hills') {
          g.beginPath(); g.moveTo(0, texH);
          let y = texH - 80 * heightScale;
          for (let px = 0; px <= texW; px += 32) {
            y += (rng() - 0.5) * 46;
            y = Math.min(texH - 26, Math.max(texH - 190 * heightScale, y));
            g.lineTo(px, y);
          }
          g.lineTo(texW, texH); g.closePath(); g.fill();
        } else if (type === 'ruins') {
          // yıkık binalar / şehir silueti
          let x = 0;
          while (x < texW) {
            const w = 60 + rng() * 110;
            const h = (90 + rng() * 230) * heightScale;
            g.fillRect(x, texH - h, w, h);
            // kırık çatı
            if (rng() > 0.4) {
              g.beginPath();
              g.moveTo(x, texH - h);
              g.lineTo(x + w * rng(), texH - h - 16 - rng() * 26);
              g.lineTo(x + w, texH - h);
              g.closePath(); g.fill();
            }
            // pencere boşlukları (delik)
            if (rng() > 0.35) {
              g.save(); g.globalCompositeOperation = 'destination-out';
              const rows = 1 + Math.floor(rng() * 4), cols = 1 + Math.floor(rng() * 3);
              for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) {
                if (rng() > 0.45) continue;
                g.fillRect(x + 12 + cc * (w - 20) / cols, texH - h + 18 + r * 36, 9, 13);
              }
              g.restore();
            }
            x += w + 18 + rng() * 70;
          }
        } else if (type === 'factory') {
          // fabrika boruları ve depo silueti
          let x = 0;
          while (x < texW) {
            const t = rng();
            if (t < 0.35) { // baca
              const w = 16 + rng() * 14, h = (200 + rng() * 180) * heightScale;
              g.fillRect(x, texH - h, w, h);
              x += w + 40 + rng() * 60;
            } else if (t < 0.7) { // depo
              const w = 110 + rng() * 90, h = (80 + rng() * 90) * heightScale;
              g.fillRect(x, texH - h, w, h);
              g.beginPath(); // tonoz çatı
              g.moveTo(x, texH - h);
              g.quadraticCurveTo(x + w / 2, texH - h - 40, x + w, texH - h);
              g.closePath(); g.fill();
              x += w + 30 + rng() * 50;
            } else { // vinç
              const h = (170 + rng() * 120) * heightScale;
              g.fillRect(x, texH - h, 8, h);
              g.fillRect(x - 50, texH - h, 130, 7);
              g.fillRect(x + 72, texH - h + 7, 3, 30 + rng() * 30);
              x += 150 + rng() * 100;
            }
          }
        }
        c.refresh();
      }
      return key;
    };

    const defs = opts.layers || [
      { type: 'hills', color: palette.far, sf: 0.12, yOff: 0, hs: 1, alpha: 0.85 },
      { type: 'trees', color: palette.far, sf: 0.25, yOff: 10, hs: 0.85, alpha: 0.9 },
      { type: 'trees', color: palette.mid, sf: 0.5, yOff: 24, hs: 1.05, alpha: 1 },
    ];

    defs.forEach((d, i) => {
      const key = mkSilhouette(`par_${opts.id || 'x'}_${i}`, Atmo.grade(d.color), d.type, (opts.seed || 7) * 31 + i * 101, 0, d.hs || 1);
      const ts = scene.add.tileSprite(0, H - 256 + (d.yOff || 0), scene.scale.width, 512, key)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(-90 + i * 2).setAlpha(d.alpha ?? 1);
      ts.parallaxSF = d.sf;
      layers.push(ts);
    });

    // --- katmanlar arası sis bantları ---
    const fogBands = [];
    for (let i = 0; i < defs.length; i++) {
      const fb = scene.add.tileSprite(0, H - 200 + i * 40, scene.scale.width, 200, 'fogPuff')
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(-89 + i * 2)
        .setAlpha(0.10 + i * 0.05).setTint(Atmo.grade(0x9aa0ad));
      fb.fogSpeed = 0.06 + i * 0.05; fb.parallaxSF = (defs[i].sf + 0.06);
      fogBands.push(fb);
    }

    // --- ÖN PLAN katmanı: kameradan hızlı kayan yakın otlar/çalılar
    //     (oyuncunun önünde — gerçek derinlik/parallax hissi) ---
    const fgKey = 'fg_' + (opts.id || 'x');
    if (!scene.textures.exists(fgKey)) {
      const c = scene.textures.createCanvas(fgKey, 1024, 170);
      const g = c.context;
      g.fillStyle = 'rgb(3,3,5)';
      const rng = Atmo._mulberry((opts.seed || 7) * 53 + 9);
      // taban şeridi
      g.fillRect(0, 138, 1024, 32);
      let x = 0;
      while (x < 1024) {
        const t = rng();
        if (t < 0.62) {
          // ot kümesi
          const n = 3 + Math.floor(rng() * 5);
          for (let i = 0; i < n; i++) {
            const bx = x + i * 5, hgt = 26 + rng() * 64;
            const lean2 = (rng() - 0.5) * 26;
            g.beginPath();
            g.moveTo(bx, 150);
            g.quadraticCurveTo(bx + lean2 * 0.4, 150 - hgt * 0.6, bx + lean2, 150 - hgt);
            g.lineWidth = 1.6 + rng() * 1.8;
            g.strokeStyle = g.fillStyle;
            g.stroke();
          }
          x += 36 + rng() * 90;
        } else if (t < 0.85) {
          // çalı yumrusu
          const r = 16 + rng() * 22;
          g.beginPath(); g.arc(x + r, 152 - r * 0.5, r, 0, Math.PI * 2); g.fill();
          x += r * 2 + 40 + rng() * 120;
        } else {
          // sivri kütük / taş
          g.beginPath();
          g.moveTo(x, 154); g.lineTo(x + 9 + rng() * 8, 154 - 30 - rng() * 40); g.lineTo(x + 24 + rng() * 10, 154);
          g.closePath(); g.fill();
          x += 70 + rng() * 160;
        }
      }
      c.refresh();
    }
    /* ön plan: yalnız ekranın en altında ince bir ot/çalı saçağı — oyunu (ve
       çukur kenarlarını) örtmesin diye eskisinden alçak ve seyrek */
    const FG_DROP = 58;
    const fg = scene.add.tileSprite(0, H + FG_DROP, scene.scale.width, 170, fgKey)
      .setOrigin(0, 1).setScrollFactor(0).setDepth(760).setAlpha(0.9);
    fg.parallaxSF = 1.3;

    return {
      layers, fogBands, sky, fg, moon, moonGlow,
      update(camX, time) {
        for (const l of layers) l.tilePositionX = camX * l.parallaxSF;
        for (const f of fogBands) f.tilePositionX = camX * f.parallaxSF + time * 0.001 * 30 * f.fogSpeed;
        fg.tilePositionX = camX * fg.parallaxSF;
        if (clouds) clouds.tilePositionX = camX * 0.03 + time * 0.004;
        if (bolt) {
          boltT -= scene.game.loop.delta / 1000;
          if (boltT <= 0) { boltT = 9 + Math.random() * 16; fireBolt(); }
        }
      },
      resize(w, h) {
        sky.setDisplaySize(w + 4, h + 4);
        for (const l of layers) { l.width = w; l.y = h - 256 + (l.yOff || 0); }
        for (const f of fogBands) f.width = w;
        fg.width = w; fg.y = h + FG_DROP;
        if (moon) { moon.setPosition(w * 0.72, h * 0.22); moonGlow.setPosition(w * 0.72, h * 0.22); clouds.width = w; clouds.y = h * 0.22 + 6; }
        if (bolt) bolt.setSize(w + 8, h + 8);
      }
    };
  },

  /* ---------- ekran-üstü sinematik katman ----------
     gren + vinyet + toz + flaş efektleri */
  buildScreenFX(scene, opts = {}) {
    const W = scene.scale.width, H = scene.scale.height;
    const fx = {};

    /* hafif kenar kararması (ağır, bulanık vinyet yok) + ince gren */
    fx.vignette = scene.add.image(W / 2, H / 2, 'vignette')
      .setScrollFactor(0).setDepth(900).setDisplaySize(W * 1.15, H * 1.15).setAlpha(0.6);

    fx.grain = scene.add.image(W / 2, H / 2, 'grain0')
      .setScrollFactor(0).setDepth(901).setDisplaySize(Math.max(W, H) * 1.2, Math.max(W, H) * 1.2)
      .setAlpha((window.SF_SETTINGS?.grain ?? 0.55) * 0.32).setBlendMode(Phaser.BlendModes.OVERLAY);

    // beyaz flaş (hasar / vurgu)
    fx.flash = scene.add.rectangle(W / 2, H / 2, W + 8, H + 8, 0xE8E4DC).setScrollFactor(0).setDepth(902).setAlpha(0);
    // karanlık nabız (düşük can)
    fx.darkPulse = scene.add.image(W / 2, H / 2, 'vignette')
      .setScrollFactor(0).setDepth(903).setDisplaySize(W * 1.4, H * 1.4).setAlpha(0).setTint(0x14060a);

    // korku nabzı — yaratık fark edince kan kırmızısı kenar karartması
    fx.scareV = scene.add.image(W / 2, H / 2, 'vignette')
      .setScrollFactor(0).setDepth(904).setDisplaySize(W * 1.25, H * 1.25).setAlpha(0).setTint(0x6a0c0c);
    fx.scareFlash = (p = 1) => {
      fx.scareV.setAlpha(Math.min(1, 0.95 * p));
      scene.tweens.add({ targets: fx.scareV, alpha: 0, duration: 1400, ease: 'Quad.easeIn' });
    };

    // yangın sıcaklığı — ekranın sol kenarından turuncu kızıllık
    fx.heat = scene.add.image(0, H / 2, 'softDot').setScrollFactor(0).setDepth(899)
      .setDisplaySize(W * 0.9, H * 2.2).setTint(0xff5a18).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    fx.setHeat = (v) => fx.heat.setAlpha(v * 0.5);

    let grainIdx = 0, grainT = 0;
    fx.update = (time, delta) => {
      grainT += delta;
      if (grainT > 70) { // ~14fps gren değişimi — sinematik
        grainT = 0;
        grainIdx = (grainIdx + 1) % 3;
        fx.grain.setTexture('grain' + grainIdx);
        fx.grain.setPosition(W / 2 + (Math.random() - 0.5) * 12, H / 2 + (Math.random() - 0.5) * 12);
      }
      fx.grain.setAlpha((window.SF_SETTINGS?.grain ?? 0.55) * 0.32);
    };
    fx.hitFlash = (a = 0.35) => {
      fx.flash.setAlpha(a);
      scene.tweens.add({ targets: fx.flash, alpha: 0, duration: 280, ease: 'Quad.easeOut' });
    };
    fx.setLowHp = (v) => { // 0..1
      scene.tweens.add({ targets: fx.darkPulse, alpha: v * 0.55, duration: 600 });
    };
    fx.resize = (w, h) => {
      fx.vignette.setPosition(w / 2, h / 2).setDisplaySize(w * 1.15, h * 1.15);
      fx.grain.setPosition(w / 2, h / 2).setDisplaySize(Math.max(w, h) * 1.2, Math.max(w, h) * 1.2);
      fx.flash.setPosition(w / 2, h / 2).setSize(w + 8, h + 8);
      fx.darkPulse.setPosition(w / 2, h / 2).setDisplaySize(w * 1.4, h * 1.4);
      fx.scareV.setPosition(w / 2, h / 2).setDisplaySize(w * 1.25, h * 1.25);
      fx.heat.setPosition(0, h / 2).setDisplaySize(w * 0.9, h * 2.2);
    };
    return fx;
  },

  /* ---------- dünya içi parçacıklar ---------- */
  buildWorldParticles(scene, worldW, opts = {}) {
    const H = scene.scale.height;
    const sys = {};

    /* açık havada ağır ağır düşen kül (yarığın dünyası yanmış bir dünya);
       maden/fabrika gibi iç mekânlarda havada asılı toz */
    const indoor = ['mine', 'factory', 'spire'].includes(opts.biome);
    if (indoor) {
      sys.motes = scene.add.particles(0, 0, 'softDot', {
        x: { min: 0, max: worldW }, y: { min: -100, max: H },
        lifespan: 9000, speedX: { min: -6, max: 14 }, speedY: { min: -4, max: 7 },
        scale: { min: 0.015, max: 0.06 }, alpha: { start: 0, peak: 0.16, end: 0 },
        quantity: 1, frequency: 320, blendMode: Phaser.BlendModes.ADD, tint: 0xc8c4ba,
      }).setDepth(50);
    } else {
      sys.motes = scene.add.particles(0, 0, 'ashFlake', {
        x: { min: 0, max: worldW }, y: { min: -160, max: -20 },
        lifespan: 14000, speedX: { min: -14, max: 22 }, speedY: { min: 16, max: 38 },
        rotate: { min: 0, max: 360 }, scale: { min: 0.35, max: 0.8 }, alpha: { start: 0.5, end: 0.2 },
        quantity: 1, frequency: window.SF_LOWFX ? 260 : 120, tint: 0xb9bfca,
      }).setDepth(50);
      /* kameraya çok yakın, bulanık iri kül — derinlik hissi (karanlığın üstünde, çok soluk) */
      if (!window.SF_LOWFX) {
        sys.nearAsh = scene.add.particles(0, 0, 'softDot', {
          x: { min: -50, max: scene.scale.width + 50 }, y: -30,
          lifespan: 5200, speedX: { min: -30, max: 40 }, speedY: { min: 60, max: 110 },
          scale: { min: 0.06, max: 0.14 }, alpha: { start: 0.14, end: 0 },
          quantity: 1, frequency: 700, tint: 0xd4dae4,
        }).setDepth(851).setScrollFactor(0);
      }
    }

    // yağmur (opsiyonel)
    if (opts.rain) {
      sys.rain = scene.add.particles(0, 0, 'rainDrop', {
        x: { min: -100, max: scene.scale.width + 100 }, y: -50,
        lifespan: 900, speedY: { min: 750, max: 980 }, speedX: { min: -60, max: -30 },
        scaleY: { min: 0.8, max: 1.5 }, scaleX: 0.8,
        alpha: { min: 0.25, max: 0.5 }, quantity: opts.rain >= 1 ? 4 : 2, frequency: 16,
        angle: 4,
      }).setDepth(880).setScrollFactor(0);
    }
    return sys;
  },

  // önplan siluet bantı — zeminin "kara toprak" görünümü
  drawGroundStrip(scene, graphics, x0, x1, yTop, seed, color = 0x0a0a0e) {
    const rng = Atmo._mulberry(seed);
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(x0, yTop + 6);
    for (let x = x0; x <= x1; x += 26) {
      graphics.lineTo(x, yTop + (rng() - 0.5) * 7);
    }
    /* uç dikey bitsin — eskiden son noktadan aşağı çapraz iniyordu; zemin
       fiziksel kenardan 26 px'e kadar önce bitmiş gibi görünüyordu */
    graphics.lineTo(x1, yTop);
    graphics.lineTo(x1, yTop + 2000);
    graphics.lineTo(x0, yTop + 2000);
    graphics.closePath();
    graphics.fillPath();
    /* ay ışığı vurmuş sırt — zeminin üst kenarı ince soğuk bir çizgiyle okunur;
       çizgi zeminin bittiği yerde biter, boşluklar karanlıkta da seçilir */
    const rng2 = Atmo._mulberry(seed);
    graphics.lineStyle(1.4, 0x6e7686, 0.42);
    graphics.beginPath();
    graphics.moveTo(x0, yTop + (rng2() - 0.5) * 7);
    for (let x = x0 + 26; x <= x1; x += 26) graphics.lineTo(x, yTop + (rng2() - 0.5) * 7);
    graphics.lineTo(x1, yTop);
    graphics.strokePath();
    // zemin içinde gömülü taşlar — düz siyah şerit yerine dokulu toprak
    graphics.fillStyle(0x12141a, 1);
    for (let x = x0 + 20; x < x1 - 20; x += 40 + rng() * 90) {
      const y = yTop + 10 + rng() * 26, r = 2 + rng() * 5;
      graphics.fillEllipse(x, y, r * 2.2, r * 1.4);
    }
    graphics.fillStyle(color, 1);
    // seyrek ot kümeleri
    graphics.lineStyle(1.6, color, 1);
    for (let x = x0; x < x1; x += 12 + rng() * 36) {
      const h = 5 + rng() * 14, lean = (rng() - 0.5) * 8;
      graphics.beginPath();
      graphics.moveTo(x, yTop + 2);
      graphics.lineTo(x + lean, yTop - h);
      graphics.strokePath();
    }
  },

  _mulberry(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },
};
