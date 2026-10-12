/* ============================================================
   SHADOW FALL — Human Rig v2
   Gerçek insan oranlı, dolgulu siluet (çöp adam değil):
   incelen uzuvlar, dolu gövde, boyun, çene hatlı kafa,
   varyant detayları (Kai: ceket+saç, Maria: uzun saç,
   Asker: miğfer+yelek+tüfek).
   İnsansı eylem animasyonları: eğilip eşya alma, pil
   değiştirme, şarjör değiştirme (eskisini yere atar),
   bandaj sarma, kol çekme, yankesicilik.
   Modlar: idle/move/air/crawl/push/pry/swim/climb/pose/ragdoll
   + tabanca nişan katmanı.
   ============================================================ */
'use strict';

/* iki-kemik IK: kökten hedefe, diz/dirsek pozisyonunu döndürür */
function solveIK2(rootX, rootY, targetX, targetY, l1, l2, bendDir) {
  let dx = targetX - rootX, dy = targetY - rootY;
  let dist = Math.hypot(dx, dy);
  const maxL = l1 + l2 - 0.01;
  if (dist > maxL) { dx *= maxL / dist; dy *= maxL / dist; dist = maxL; }
  if (dist < 0.01) dist = 0.01;
  const a1 = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
  const baseAng = Math.atan2(dy, dx);
  const jointAng = baseAng + a1 * bendDir;
  return {
    jx: rootX + Math.cos(jointAng) * l1,
    jy: rootY + Math.sin(jointAng) * l1,
    ex: rootX + dx, ey: rootY + dy,
  };
}

/* WebGL ön-işleme glow'u — siluetin kenarına soluk ay ışığı. Canvas renderer'da
   veya düşük performans modunda sessizce atlanır. */
function addRimGlow(obj, color, strength = 1.4) {
  try {
    if (window.SF_LOWFX || !obj.postFX) return null;
    return obj.postFX.addGlow(color, strength, 0, false, 0.1, 6);
  } catch (e) { return null; }
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* ============================================================
   İNSAN YÜRÜYÜŞ VERİSİ — klinik yürüyüş analizinden (Winter; Novacheck)
   alınmış normatif sagital eklem açıları (derece), döngü %0 = topuk vuruşu.
   kalça: + fleksiyon (uyluk öne) · diz: + fleksiyon · bilek: + dorsifleksiyon
   ============================================================ */
const GAIT = {
  walk: {
    toeOff: 0.62,
    hip:   [[0, 30], [10, 27], [20, 18], [30, 9], [40, 1], [50, -7], [55, -10], [60, -7], [65, 2], [70, 13], [75, 21], [80, 27], [85, 31], [90, 32], [95, 31]],
    knee:  [[0, 3], [5, 10], [10, 16], [15, 18], [20, 16], [30, 8], [40, 4], [45, 5], [50, 9], [55, 18], [60, 35], [65, 50], [70, 60], [73, 62], [78, 55], [85, 35], [90, 16], [95, 5]],
    ankle: [[0, 0], [5, -5], [10, -2], [20, 4], [30, 7], [40, 10], [45, 9], [50, 4], [55, -6], [60, -16], [65, -18], [70, -10], [75, -3], [80, 0], [90, 1]],
  },
  run: {
    toeOff: 0.36,
    hip:   [[0, 32], [10, 26], [20, 14], [30, 0], [38, -8], [45, -10], [55, 2], [65, 25], [75, 40], [85, 42], [95, 36]],
    knee:  [[0, 18], [8, 32], [15, 38], [25, 28], [35, 15], [40, 22], [50, 55], [60, 90], [68, 100], [75, 95], [85, 60], [95, 25]],
    ankle: [[0, 2], [8, 14], [15, 18], [25, 8], [35, -18], [45, -22], [55, -10], [65, 4], [80, 6], [92, 3]],
  },
};
/* periyodik Catmull-Rom örnekleme (0..1) */
function gaitSample(tbl, u) {
  u = ((u % 1) + 1) % 1;
  const n = tbl.length, x = u * 100;
  let i = n - 1;
  for (let k = 0; k < n; k++) { if (tbl[k][0] > x) { i = k - 1; break; } }
  const at = (k) => tbl[((k % n) + n) % n];
  const p1 = at(i), p2 = at(i + 1);
  const x1 = i < 0 ? p1[0] - 100 : p1[0];
  let x2 = p2[0]; if (x2 <= x1) x2 += 100;
  let xx = x; if (xx < x1) xx += 100;
  const t = (xx - x1) / (x2 - x1);
  const p0 = at(i - 1)[1], p3 = at(i + 2)[1];
  const a = p1[1], b = p2[1];
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * a) + (-p0 + b) * t + (2 * p0 - 5 * a + 4 * b - p3) * t2 + (-p0 + 3 * a - 3 * b + p3) * t3);
}
/* birleşik faz u (0..1, D = destek oranı) → eğrinin kendi fazı (topuk vuruşu ve parmak itişi hizalanır) */
function gaitWarp(u, D, toeOff) {
  u = ((u % 1) + 1) % 1;
  return u < D ? (u / D) * toeOff : toeOff + ((u - D) / (1 - D)) * (1 - toeOff);
}
/* bir bacağın açıları (radyan) — yürüyüş/koşu karışımı + genlik ölçeği */
function gaitAngles(u, runF, D, amp) {
  const D2R = Math.PI / 180;
  const pw = gaitWarp(u, D, GAIT.walk.toeOff), pr = gaitWarp(u, D, GAIT.run.toeOff);
  const mix = (k) => lerp(gaitSample(GAIT.walk[k], pw), gaitSample(GAIT.run[k], pr), runF);
  const hipMean = lerp(11, 16, runF);
  return {
    hip: (hipMean + (mix('hip') - hipMean) * amp) * D2R,
    knee: Math.max(0, mix('knee') * lerp(0.75, 1, amp)) * D2R,
    ankle: mix('ankle') * amp * D2R,
  };
}

class HumanRig {
  /** opts: { scale, color, variant: 'kai'|'maria'|'soldier', depth } */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.s = opts.scale ?? 1;
    this.color = opts.color ?? 0x0b0b10;
    this.variant = opts.variant ?? 'kai';
    this.gfx = scene.add.graphics().setDepth(opts.depth ?? 100);
    /* kenar ışığı (rim light): koyu siluet koyu arka plandan ayrışsın */
    if (opts.rim !== false) addRimGlow(this.gfx, opts.rimColor ?? 0x8a90a4, opts.rimStrength ?? 1.4);

    const s = this.s;
    const fem = this.variant === 'maria';
    /* gerçek insan oranları — bacaklar pelvis yüksekliğine ulaşır,
       ayaklar gerçekten yere basar (eski rig'de bacaklar kısaydı) */
    const lurk = this.variant === 'lurker';
    this.A = lurk ? {
      /* lurker: insan değil — fazla uzun bacak/kol, dar gövde, küçük kafa */
      legUp: 31 * s, legLo: 31 * s,
      armUp: 23 * s, armLo: 23 * s,
      torso: 31 * s,
      headR: 5.0 * s,
      hipW: 4.6 * s, shW: 6.4 * s,
      waist: 0.62,
      standH: 61 * s,
    } : fem ? {
      legUp: 26 * s, legLo: 25 * s,        // uzun bacaklar
      armUp: 14 * s, armLo: 13 * s,
      torso: 25 * s,
      headR: 5.7 * s,
      hipW: 9.0 * s, shW: 5.0 * s,         // dar omuz, BELİRGİN geniş kalça (kum saati)
      waist: 0.52,                          // daha ince bel → kalça daha çok öne çıkar
      standH: 49.5 * s,
    } : {
      legUp: 25 * s, legLo: 24 * s,
      armUp: 15 * s, armLo: 14 * s,
      torso: 27 * s,
      headR: 6.2 * s,
      hipW: 6.0 * s,
      shW: (this.variant === 'soldier' ? 9.0 : 8.6) * s,   // iri yapılı — geniş omuz
      waist: 0.8,                                           // V-form gövde
      standH: 47.5 * s,
    };

    this.x = 0; this.y = 0;
    this.facing = 1;
    this.phase = 0;
    this.mode = 'idle';
    this.vx = 0; this.vy = 0;
    this.grounded = true;
    this.crouchAmt = 0;
    this.landImpact = 0;
    this.breathe = Math.random() * 10;
    this.poseName = null; this.poseT = 0;
    this.holdItem = null;          // 'crowbar' | 'pistol' | null
    this.flashOn = false;          // sol elde fener
    this.pryAnim = 0;
    this.hurtT = 0;
    this.recoilT = 0;              // tabanca tepmesi
    this.aimMode = false;          // tabanca doğrultulmuş
    this.aimAngle = 0;
    this.stepCallback = null;
    this._lastStepLeg = 0;
    this.swimT = 0;

    /* eylem animasyonu durumu */
    this.action = null;            // { name, t, dur, targetX, targetY, onPhase, onDone, fired:{} }

    this.ragdoll = null;
    this.joints = {};
  }

  setDepth(d) { this.gfx.setDepth(d); return this; }
  setVisible(v) { this.gfx.setVisible(v); return this; }
  destroy() { this.gfx.destroy(); }

  /* ============ EYLEM SİSTEMİ ============ */
  /**
   * names: pickup | batterySwap | reload | bandage | lever | pickpocket | insert
   * opts: { targetX, targetY, onPhase(name), onDone() }
   */
  startAction(name, opts = {}) {
    const durs = { pickup: 1.05, batterySwap: 2.4, reload: 2.0, bandage: 2.6, lever: 1.15, pickpocket: 1.6, insert: 1.4 };
    this.action = {
      name, t: 0, dur: opts.dur ?? durs[name] ?? 1,
      targetX: opts.targetX, targetY: opts.targetY,
      onPhase: opts.onPhase, onDone: opts.onDone, fired: {},
    };
  }
  get actionActive() { return !!this.action; }
  _phase(act, key, atT) {
    if (act.t >= atT && !act.fired[key]) {
      act.fired[key] = true;
      act.onPhase?.(key);
    }
  }

  /* yarı-adım genliği (dünya-px): ayağın pelvise göre öne/arkaya açılımı.
     update() fazı buna göre ilerletir, drawStanding ayağı buna göre yerleştirir —
     ikisi aynı değeri kullandığı için ayak yere kilitlenir (kaymaz). */
  /* GERÇEK İNSAN ÖLÇÜLERİ (bacak boyu L ≈ 0.9 m):
     yürüyüşte adım uzunluğu ≈ 0.6–0.85·L (yavaş→hızlı), kadans ≈ 1.6–2.2 adım/sn;
     koşuda adım ≈ 1.4·L, kadans ≈ 2.8–3.2 adım/sn. Genlik = yarım adım.
     (eskiden adım çok kısaydı → karakter saniyede ~5 adım atıp "tıpış tıpış" koşuyordu) */
  _stepAmp(speed) {
    const L = this.A.legUp + this.A.legLo;
    if (this.mode === 'crawl') return (5 + clamp(speed / 220, 0, 1) * 3) * this.s;
    const rf = this._runF(speed);
    const walkAmp = L * (0.27 + 0.15 * clamp(speed / 95, 0, 1));
    return lerp(walkAmp, L * 0.47, rf);
  }
  /* yürüyüş (≈95 px/s ≈ 1.8 m/sn) → koşu (≈230 px/s) karışımı */
  _runF(speed) { return this.mode === 'crawl' ? 0 : clamp((speed - 105) / 110, 0, 1); }
  /* destek oranı: yürüyüşte %50 (çift destek), koşuda %34 (uçuş fazı var) */
  _duty(speed) { return lerp(0.62, 0.36, this._runF(speed)); }

  /* hıza göre adım genliği (gerçek insan yavaşken daha kısa adım atar) */
  _gaitAmp(speed) {
    const rf = this._runF(speed);
    return lerp(lerp(0.5, 1, clamp(speed / 95, 0, 1)), lerp(1, 1.12, clamp((speed - 230) / 80, 0, 1)), rf);
  }
  /* duruş eki: itme (öne yaslanmış, dizler bükük), eğik yürüyüş (derin çömelme) */
  _posture() {
    if (this.mode === 'push') return { hip: 0.42, knee: 0.38, ankle: 0.1 };
    if (this.mode === 'crawl') return { hip: 0.95, knee: 1.45, ankle: 0.35 };
    return null;
  }
  /* İLERİ KİNEMATİK — tek bacak, kalça (0,0)'da, bakış +x, y aşağı.
     uyluk mutlak açısı = kalça açısı − pelvis eğimi (~10°). */
  _legFK(u, runF, D, amp, post) {
    const A = this.A, s = this.s;
    const g = gaitAngles(u, runF, D, amp);
    const tilt = lerp(10, 12, runF) * Math.PI / 180;
    const th = g.hip - tilt + (post?.hip ?? 0);
    const ts = th - (g.knee + (post?.knee ?? 0));
    const kx = Math.sin(th) * A.legUp, ky = Math.cos(th) * A.legUp;
    const ax = kx + Math.sin(ts) * A.legLo, ay = ky + Math.cos(ts) * A.legLo;
    const toeUp = ts + g.ankle - (post?.ankle ?? 0);
    const toeY = ay - Math.sin(toeUp) * 9 * s, heelY = ay + Math.sin(toeUp) * 4 * s;
    return { kx, ky, ax, ay, toeUp, low: Math.max(toeY, heelY) + 1.8 * s, thigh: th };
  }
  /* faz hızı: destekteki ayak kalçaya göre tam gövde hızıyla geri gitsin (kayma yok) */
  _gaitRate(speed) {
    const runF = this._runF(speed), D = this._duty(speed), amp = this._gaitAmp(speed), post = this._posture();
    const X = (u) => this._legFK(u, runF, D, amp, post).ax;
    const avg = Math.max(1, (X(0) - X(D * 0.999)) / D);
    const e = 0.006;
    let sl = 0, n = 0;
    for (const off of [0, 0.5]) {
      const uu = (((this.gaitU ?? 0) + off) % 1 + 1) % 1;
      if (uu < D) { sl += (X(uu - e) - X(uu + e)) / (2 * e); n++; }
    }
    const inst = n ? sl / n : avg;
    return speed / clamp(inst, avg * 0.6, avg * 1.7);
  }

  /* omuza GÖRELİ el yumuşatması: metronom gibi kusursuz salınımı kırar,
     ele doğal gecikme/takip (follow-through) verir → robot hissini azaltır.
     Konum farkı omuza göre saklandığı için gövde hızlı ilerlerken el geride
     "sürüklenmez"; sadece yerel kol hareketi yumuşar. */
  _smoothHand(key, target, ox, oy) {
    const sm = this._sm || (this._sm = {});
    const dx = target.x - ox, dy = target.y - oy;
    const p = sm[key];
    const a = 1 - Math.exp(-(this._dt || 0.016) * 17);
    if (!p) { sm[key] = { x: dx, y: dy }; return target; }
    p.x = lerp(p.x, dx, a); p.y = lerp(p.y, dy, a);
    return { x: ox + p.x, y: oy + p.y };
  }

  /* ============ ANA GÜNCELLEME ============ */
  update(dt, state) {
    this._dt = dt;
    Object.assign(this, {
      x: state.x, y: state.y, vx: state.vx ?? 0, vy: state.vy ?? 0,
      grounded: state.grounded ?? true,
    });
    if (state.facing) this.facing = state.facing;
    if (state.mode) this.mode = state.mode;
    this.groundY = state.groundY ?? (this.y + this.A.standH);

    this.breathe += dt;
    this.swimT += dt;
    this.airT = this.grounded ? 0 : (this.airT ?? 0) + dt;
    if (this.prepT > 0) this.prepT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.recoilT > 0) this.recoilT -= dt;

    const targetCrouch = state.crouch ? 1 : 0;
    this.crouchAmt = lerp(this.crouchAmt, targetCrouch, 1 - Math.exp(-dt * 9));
    this.landImpact = lerp(this.landImpact, 0, 1 - Math.exp(-dt * 5));   // dizler biraz daha uzun yaylanır

    if (this.mode === 'ragdoll') { this.updateRagdoll(dt); this.draw(); return; }

    /* eylem ilerlet */
    if (this.action) {
      const act = this.action;
      act.t += dt / act.dur;
      switch (act.name) {
        case 'pickup': this._phase(act, 'grab', 0.45); break;
        case 'batterySwap':
          this._phase(act, 'eject', 0.32); this._phase(act, 'insert', 0.78); break;
        case 'reload':
          this._phase(act, 'magout', 0.28); this._phase(act, 'magin', 0.72); this._phase(act, 'rack', 0.9); break;
        case 'bandage':
          this._phase(act, 'wrapStart', 0.18); this._phase(act, 'healed', 0.92); break;
        case 'lever': this._phase(act, 'pulled', 0.68); break;
        case 'pickpocket': this._phase(act, 'steal', 0.72); break;
        case 'insert': this._phase(act, 'inserted', 0.6); break;
      }
      if (act.t >= 1) {
        this.action = null;
        act.onDone?.();
      }
    }

    const speed = Math.abs(this.vx);
    if (this.mode === 'swim') {
      this.phase += dt * (2.2 + speed / 60);
    } else if (this.mode === 'climb') {
      this.phase += Math.abs(this.vy) * 0.018 * dt * 60 / 16.6;
    } else if (this.grounded && speed > 6 && this.mode !== 'pry' && !this.action && this.mode !== 'crawl-old') {
      /* GERÇEK YÜRÜYÜŞ FAZI (u: 0..1) — topuk vuruşlarında adım sesi */
      const prevU = this.gaitU ?? 0;
      this.gaitU = prevU + this._gaitRate(speed) * dt;
      if (Math.floor(this.gaitU * 2) !== Math.floor(prevU * 2) && this.stepCallback) this.stepCallback(Math.min(1, speed / 200));
      this.gaitU %= 1;
      /* fazı GİDİLEN MESAFEYE bağla: gövde bir adım (2×genlik) yol alınca faz π ilerler.
         Böylece basan ayak yere KİLİTLİ kalır — geriye kayma / moonwalk olmaz.
         (Eski strideRate modeli adımı gerçek hızla eşleştirmiyordu, ayak geriye kayıyordu.) */
      const ampW = this._stepAmp(speed);
      const D = this._duty(speed);
      /* destekte ayak pelvise göre 2·genlik yol alır, süresi 2πD/ω → ω = v·π·D/genlik */
      this.phase += (speed * dt) * Math.PI * D / ampW;
      const stepHalf = Math.floor((this.phase - Math.PI * 2 * (1 - D)) / Math.PI);
      if (stepHalf !== this._lastStepLeg) {
        this._lastStepLeg = stepHalf;
        if (this.stepCallback) this.stepCallback(Math.min(1, speed / 200));
      }
    } else if (this.grounded) {
      const target = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = lerp(this.phase, target, 1 - Math.exp(-dt * 8));
    }
    if (this.mode === 'pry') this.pryAnim += dt;

    /* kenar / tırmanma / yuvarlanma verisi */
    if (state.ledge) this.ledge = state.ledge;
    this.mantleP = state.mantleP ?? 0;
    this.rollP = state.rollP ?? 0;
    if (state.edgeX != null) this.edgeX = state.edgeX;

    /* POZ GEÇİŞİ — mod veya yön değişince eski iskelet 0.15–0.2 sn içinde yenisine
       eriyerek geçer. Ani "pat" diye poz değiştirme (robot hissi) yok; yön değişimi
       bu sayede gövdenin kendi ekseni etrafında dönmesi gibi görünür. */
    const cat = this._animCat() + '|' + (this.facing > 0 ? 'R' : 'L');
    if (this._cat && cat !== this._cat && this._lastOut && this.mode !== 'ragdoll') {
      const turnOnly = cat.split('|')[0] === this._cat.split('|')[0];
      this._blendFrom = this._lastOut;
      this._blendT = 0;
      this._blendDur = turnOnly ? 0.2 : 0.15;
    }
    this._cat = cat;
    if (this._blendFrom) {
      this._blendT += dt;
      if (this._blendT >= this._blendDur) this._blendFrom = null;
    }

    this.draw();
  }

  _animCat() {
    if (this.mode === 'ragdoll') return 'ragdoll';
    if (this.action) return 'act:' + this.action.name;
    if (this.mode === 'pose') return 'pose:' + this.poseName;
    if (['crawl', 'slide', 'swim', 'climb', 'hang', 'mantle', 'teeter', 'roll'].includes(this.mode)) return this.mode;
    return 'stand';
  }

  triggerLand(impact) { this.landImpact = clamp(impact, 0, 1); }
  setPose(name, t = 0) { this.mode = 'pose'; this.poseName = name; this.poseT = t; }

  /* ============ RAGDOLL ============ */
  startRagdoll(impulseX, impulseY, groundFn) {
    const J = this.joints;
    if (!J.head) this.draw();
    const mk = (p, m = 1) => ({ x: p.x, y: p.y, px: p.x - (impulseX * (0.7 + Math.random() * 0.6)) * 0.016, py: p.y - (impulseY * (0.7 + Math.random() * 0.6)) * 0.016, m });
    const R = {
      pts: {
        head: mk(J.head, 0.8), neck: mk(J.neck), pelvis: mk(J.pelvis, 1.4),
        kneeL: mk(J.kneeL), kneeR: mk(J.kneeR), footL: mk(J.footL, 0.7), footR: mk(J.footR, 0.7),
        elbL: mk(J.elbL), elbR: mk(J.elbR), handL: mk(J.handL, 0.5), handR: mk(J.handR, 0.5),
      },
      groundFn: groundFn || (() => this.groundY),
      settled: 0,
    };
    const A = this.A;
    R.sticks = [
      ['head', 'neck', A.headR * 1.6], ['neck', 'pelvis', A.torso],
      ['pelvis', 'kneeL', A.legUp], ['kneeL', 'footL', A.legLo],
      ['pelvis', 'kneeR', A.legUp], ['kneeR', 'footR', A.legLo],
      ['neck', 'elbL', A.armUp], ['elbL', 'handL', A.armLo],
      ['neck', 'elbR', A.armUp], ['elbR', 'handR', A.armLo],
      ['head', 'pelvis', A.torso + A.headR * 1.6, 0.25],
    ];
    this.ragdoll = R;
    this.mode = 'ragdoll';
  }

  updateRagdoll(dt) {
    const R = this.ragdoll; if (!R) return;
    /* oturduktan sonra dur — sonsuz mikro-titreme yok */
    if (R.settled > 0.6) return;
    const g = 1300 * dt * dt;
    let motion = 0;
    for (const k in R.pts) {
      const p = R.pts[k];
      let vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g;
      const gy = R.groundFn(p.x);
      if (p.y > gy - 2) {
        p.y = gy - 2;
        p.px = p.x - vx * 0.3;          // zeminde yatay sürtünme (uzuvlar kaymaz, yığılır)
        p.py = p.y - vy * 0.18;         // dikey sekme sönümü (thud, zıplamaz)
      }
      motion += Math.abs(vx) + Math.abs(vy);
    }
    /* daha fazla iterasyon → kemik boyları kararlı, uzuvlar gerçekçi katlanır */
    for (let it = 0; it < 8; it++) {
      for (const [a, b, len, stiff = 1] of R.sticks) {
        const pa = R.pts[a], pb = R.pts[b];
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const diff = (d - len) / d * 0.5 * stiff;
        const ma = pb.m / (pa.m + pb.m), mb = pa.m / (pa.m + pb.m);
        pa.x += dx * diff * ma; pa.y += dy * diff * ma;
        pb.x -= dx * diff * mb; pb.y -= dy * diff * mb;
      }
    }
    R.settled = (motion < 0.5) ? (R.settled + dt) : 0;
  }

  /* ============ ÇİZİM YÖNLENDİRİCİ ============ */
  draw() {
    const g = this.gfx;
    g.clear();
    if (this.mode === 'ragdoll') return this.drawRagdoll();
    if (this.action) return this.drawAction();
    if (this.mode === 'pose') return this.drawPose();
    if (this.mode === 'crawl') return this.drawCrawl();
    if (this.mode === 'slide') return this.drawSlide();
    if (this.mode === 'swim') return this.drawSwim();
    if (this.mode === 'climb') return this.drawClimb();
    if (this.mode === 'hang') return this.drawHang();
    if (this.mode === 'mantle') return this.drawMantle();
    if (this.mode === 'teeter') return this.drawTeeter();
    if (this.mode === 'roll') return this.drawRoll();
    this.drawStanding();
  }

  /* ============ KENARA TUTUNMA ============
     İki el kenarın üstünde, kollar neredeyse gergin, gövde duvara dönük sarkar.
     Bir ayak duvara dayanıp tutunmaya çalışır, diğeri boşlukta sallanır. */
  drawHang() {
    const A = this.A, J = this.joints, s = this.s;
    const L = this.ledge ?? { x: this.x, y: this.y - 40, side: -this.facing };
    const f = this.facing;
    const armR = A.armUp + A.armLo, legLen = A.legUp + A.legLo;
    const sw = Math.sin(this.breathe * 2.1) * 2.2 * s;
    const neck = { x: L.x - f * 7 * s + sw * 0.25, y: L.y + armR * 0.8 };
    const pelvis = { x: neck.x - f * 2 * s + sw * 0.6, y: neck.y + A.torso };
    const head = { x: neck.x + f * A.headR * 0.5, y: neck.y - A.headR * 1.35 };
    const scrab = Math.max(0, Math.sin(this.breathe * 4.5));
    const footL = { x: pelvis.x + f * 5 * s + sw, y: pelvis.y + legLen * 0.93 };
    const footR = { x: L.x - f * 1 * s, y: pelvis.y + legLen * 0.62 - scrab * 7 * s };   // duvara dayanan ayak
    const legL = solveIK2(pelvis.x - A.hipW * 0.3 * f, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.3 * f, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const hL = { x: L.x + f * 3 * s, y: L.y + 0.5 * s }, hR = { x: L.x + f * 8.5 * s, y: L.y };
    const armL = solveIK2(neck.x - A.shW * 0.35 * f, neck.y, hL.x, hL.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
    const armRr = solveIK2(neck.x + A.shW * 0.35 * f, neck.y, hR.x, hR.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armRr);
    J.footL.ang = 0.9; J.footR.ang = 0.2;
    this.render(J, 0);
  }

  /* ============ KENARDAN YUKARI ÇIKMA (mantle) ============
     0 → sarkma · 0.4 → kollarla çekip göğsü kenarın üstüne al ·
     0.7 → bir dizi kenara at, ellerle it · 1 → ayağa kalk. */
  drawMantle() {
    const A = this.A, J = this.joints, s = this.s;
    const L = this.ledge ?? { x: this.x, y: this.y, side: -this.facing };
    const f = this.facing;
    const armR = A.armUp + A.armLo, legLen = A.legUp + A.legLo, T = A.torso, H = A.standH;
    const handsDown = -H - T + armR * 0.86;
    const K = [
      { p: 0,    pel: [-9, armR * 0.8 + T], neck: [-7, armR * 0.8], hL: [3, 0], hR: [8, 0], fL: [-5, armR * 0.8 + T + legLen * 0.92], fR: [-9, armR * 0.8 + T + legLen * 0.84] },
      { p: 0.4,  pel: [-4, T * 0.5], neck: [6, -T * 0.42], hL: [4, 0], hR: [10, 0], fL: [-6, T * 0.5 + legLen * 0.9], fR: [-9, T * 0.5 + legLen * 0.78] },
      { p: 0.72, pel: [5, -legLen * 0.38], neck: [20, -legLen * 0.38 - T * 0.78], hL: [16, 0], hR: [23, 0], fL: [9, 0], fR: [-3, legLen * 0.22] },
      { p: 1,    pel: [16, -H], neck: [17.5, -H - T], hL: [13, handsDown], hR: [21, handsDown], fL: [12, 0], fR: [20, 0] },
    ];
    const p = clamp(this.mantleP, 0, 1);
    let i = 0;
    while (i < K.length - 2 && p > K[i + 1].p) i++;
    const a = K[i], b = K[i + 1];
    const k = smooth((p - a.p) / (b.p - a.p));
    /* u bileşeni (yatay) s ile ölçeklenir; v (dikey) zaten dünya biriminde */
    const P = (key) => ({ x: L.x + f * lerp(a[key][0], b[key][0], k) * s, y: L.y + lerp(a[key][1], b[key][1], k) });
    const pelvis = P('pel'), neck = P('neck');
    const head = { x: neck.x + f * A.headR * 0.55, y: neck.y - A.headR * 1.35 };
    const fL = P('fL'), fR = P('fR'), hL = P('hL'), hR = P('hR');
    const legL = solveIK2(pelvis.x - A.hipW * 0.3 * f, pelvis.y, fL.x, fL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.3 * f, pelvis.y, fR.x, fR.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const bend = p < 0.5 ? (f > 0 ? -1 : 1) : (f > 0 ? 1 : -1);    // çekişte dirsek dışa, itişte geriye
    const armL = solveIK2(neck.x - A.shW * 0.35 * f, neck.y, hL.x, hL.y, A.armUp, A.armLo, bend);
    const armRr = solveIK2(neck.x + A.shW * 0.35 * f, neck.y, hR.x, hR.y, A.armUp, A.armLo, bend);
    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armRr);
    J.footL.ang = p < 0.6 ? 0.8 : 0; J.footR.ang = p < 0.85 ? 0.7 : 0;
    this.render(J, 0);
  }

  /* ============ KENARDA SENDELEME ============
     Uçurumun ağzında: ön ayağın parmakları boşlukta, gövde geriye yaslanır,
     kollar dengeyi bulmak için daire çizer. */
  drawTeeter() {
    const A = this.A, J = this.joints, s = this.s, f = this.facing;
    const gY = this.groundY, t = this.breathe;
    const armR = A.armUp + A.armLo;
    const edgeX = this.edgeX ?? (this.x + f * 8 * s);
    const wob = Math.sin(t * 5.2) * 0.7 + Math.sin(t * 8.3) * 0.3;
    const pelvis = { x: edgeX - f * 9 * s - wob * 1.4 * s * f, y: gY - A.standH + 2.5 * s };
    const lean = -f * (0.2 + wob * 0.1);
    const neck = { x: pelvis.x + Math.sin(lean) * A.torso, y: pelvis.y - Math.cos(lean) * A.torso };
    const head = { x: neck.x + f * A.headR * 0.4, y: neck.y - A.headR * 1.4 + 1.5 * s };   // aşağı, boşluğa bakar
    const footB = { x: pelvis.x - f * 8 * s, y: gY };
    const footF = { x: edgeX - f * 3 * s, y: gY - Math.max(0, wob) * 2 * s };
    const legL = solveIK2(pelvis.x - A.hipW * 0.4 * f, pelvis.y, footB.x, footB.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.4 * f, pelvis.y, footF.x, footF.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const a = t * 7.5;
    const hR = { x: neck.x + f * Math.cos(a) * armR * 0.62, y: neck.y - Math.sin(a) * armR * 0.62 };
    const hL = { x: neck.x + f * Math.cos(a + 2.4) * armR * 0.55, y: neck.y - Math.sin(a + 2.4) * armR * 0.55 };
    const armL = solveIK2(neck.x - A.shW * 0.4 * f, neck.y, hL.x, hL.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armRr = solveIK2(neck.x + A.shW * 0.4 * f, neck.y, hR.x, hR.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armRr);
    J.footR.ang = 0.25 + Math.max(0, wob) * 0.2;
    this.render(J, lean);
  }

  /* ============ YUVARLANMA (sert inişte omuz üstü takla) ============
     Gövde top gibi kıvrılır ve hareket yönünde bir tur döner — yükü dağıtır. */
  drawRoll() {
    const A = this.A, J = this.joints, s = this.s, f = this.facing;
    const p = clamp(this.rollP, 0, 1);
    const c = { x: this.x, y: this.groundY - 15 * s };
    const ang = p * Math.PI * 2;
    const curl = Math.sin(Math.min(1, p * 1.25) * Math.PI) * 0.6 + 0.4;   // başta ve sonda biraz açılır
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const R = (u, v) => ({ x: c.x + f * (u * ca - v * sa) * s, y: c.y + (u * sa + v * ca) * s });
    const pelvis = R(-5, 6 * curl);
    const neck = R(5 * curl, -8);
    const head = R(10 * curl, -9 - 3 * (1 - curl));
    const kneeL = R(7, 2 * curl), kneeR = R(5, 4 * curl);
    const footL = R(-1, 13 * curl + 2), footR = R(-4, 12 * curl + 4);
    const handL = R(6, 8), handR = R(9, 6);
    const elbL = R(1, 2), elbR = R(3, 1);
    J.pelvis = pelvis; J.neck = neck; J.head = head;
    J.kneeL = kneeL; J.kneeR = kneeR; J.footL = footL; J.footR = footR;
    J.elbL = elbL; J.elbR = elbR; J.handL = handL; J.handR = handR;
    this.render(J, 0);
  }

  /* ============ AYAKTA / KOŞU / HAVA ============
     İnsan biyomekaniği: basan ayak yerde kilitli kalır,
     kafa stabilize, koşuda dirsekler bükük, kalça salınımı
     (maria belirgin), yükselme/düşme ayrı hava pozları. */
  drawStanding() {
    const A = this.A, f = this.facing, J = this.joints, s = this.s;
    const fem = this.variant === 'maria';
    const speed = Math.abs(this.vx);
    const moving = speed > 6;
    const runF = this._runF(speed);
    const D = this._duty(speed);
    const TAU = Math.PI * 2;
    const swingLen = TAU * (1 - D);

    let pelvisX = this.x, pelvisY = this.y;
    const crouch = this.crouchAmt;
    const gY = this.groundY;
    const ph = this.phase;
    const legLen = A.legUp + A.legLo;

    /* yön değiştirirken fren kayması: gövde hâlâ eski yöne kayıyor ama yüz yeni yöne dönük */
    const skid = (this.grounded && speed > 70 && Math.sign(this.vx) === -f && !this.aimMode) ? clamp((speed - 70) / 120, 0, 1) : 0;

    /* ---- DURUŞ CANLILIĞI (nefes, ağırlık aktarımı, etrafa bakış) ---- */
    const idle = (!moving && this.grounded && this.mode !== 'pry' && !this.aimMode) ? 1 : 0;
    const breathC = Math.sin(this.breathe * 1.5);
    const sway = Math.sin(this.breathe * 0.45);
    const sway2 = Math.sin(this.breathe * 0.3 + 1.1);
    const wshift = Math.sin(this.breathe * 0.32);
    const look = Math.sin(this.breathe * 0.21 + 0.6);
    const breathOff = idle ? (breathC * 0.7 - 0.3) * s : 0;
    const idleShift = idle * (sway * 1.1 + wshift * 1.7) * s;

    /* ---- pelvis dikey hareketi ----
       yürüyüş: ters sarkaç — destek ortasında (bacak dik) pelvis EN YÜKSEK.
       koşu: yay-kütle — destek ortasında pelvis EN ALÇAK, uçuş fazında en yüksek. */
    const midL = swingLen + Math.PI * D;                      // sol bacak destek ortası
    const c2 = 0.5 + 0.5 * Math.cos(2 * (ph - midL));        // 1 = destek ortası
    const walkBob = -c2 * 1.7 * s;
    const runBob = (c2 - 0.55) * 4.2 * s;
    const bob = (this.grounded && moving) ? lerp(walkBob, runBob, runF) : 0;
    /* kalça, adım açılımında bacak (neredeyse düz dizle) yere uzanabilecek kadar alçalır —
       gerçek yürüyüşte topuk vuruşunda diz neredeyse düzdür */
    const ampNow = this._stepAmp(speed);
    const reachH = Math.sqrt(Math.max(1, (legLen * 0.985) ** 2 - ampNow * ampNow));
    const walkDip = (this.grounded && moving) ? Math.max(0, A.standH - reachH) + (0.6 + runF * 2.6) * s : 0;

    const hipSway = (fem && this.grounded && moving) ? Math.sin(ph) * (2.6 * (1 - runF) + 0.8) * s : 0;
    pelvisX += hipSway * 0.75 + idleShift;
    const heelLift = (fem && this.grounded) ? 7 * s : 0;
    pelvisY += bob + walkDip + breathOff - heelLift + idle * Math.abs(wshift) * 0.8 * s
      + this.landImpact * 15 * s + crouch * 12 * s + skid * 7 * s
      + (this.prepT > 0 && this.grounded ? 11 * s : 0);                   // zıplamadan önce çömelme (hazırlık)

    /* ---- gövde eğimi ---- */
    const dirV = Math.sign(this.vx) || f;
    let lean = (this.grounded && moving) ? dirV * (0.05 + runF * 0.21) : 0;
    if (!this.grounded) lean = clamp(this.vx / 900, -0.22, 0.22) + f * clamp(-this.vy / 2600, -0.08, 0.12);
    if (skid) lean = f * 0.28 * skid;                         // fren: geriye (yeni yöne) yaslan
    if (this.grounded && this.landImpact > 0.04) lean += f * 0.42 * this.landImpact;   // iniş: gövde öne katlanır, dizler yükü alır
    if (this.grounded && this.prepT > 0) lean += f * 0.32;                              // sıçrama hazırlığı
    if (this.mode === 'push') lean = f * 0.55;
    const postureCurve = fem ? -f * 0.05 : f * 0.02;

    const torsoLen = A.torso * (1 - crouch * 0.2);
    const shX = pelvisX + Math.sin(lean + postureCurve) * torsoLen - hipSway * 0.5 - idle * sway * 0.9 * s;
    const shY = pelvisY - Math.cos(lean) * torsoLen - (idle ? Math.max(0, breathC) * 0.8 * s : 0);
    /* kafa stabilizasyonu: gövde eğilse de bakış ufukta kalır */
    const headLean = lean * 0.45 + (this.hurtT > 0 ? Math.sin(this.breathe * 40) * 0.1 : 0) + idle * (sway2 * 0.045 + look * 0.05);
    const headX = shX + Math.sin(headLean) * (A.headR * 1.5) + f * A.headR * 0.26 + idle * (sway2 * 0.8 + look * 1.5) * s;
    const headY = shY - Math.cos(headLean) * (A.headR * 1.5) - A.headR * 0.45 - bob * 0.35;

    /* ============ BACAKLAR ============ */
    const stride = this._stepAmp(speed);
    let footL, footR, footAngL = 0, footAngR = 0;
    if (!this.grounded) {
      /* HAVA — gerçek sıçrayış evreleri:
         1) itiş (kalkıştan ilk ~0.13 sn): iki bacak gergin, ayak uçları aşağı (bilek itişi)
         2) yükseliş/tepe: dizler göğse toplanır (yerinde sıçramada ikisi birlikte,
            koşarak sıçramada öndeki diz önde, arkadaki bacak geride)
         3) düşüş: bacaklar inişe uzanır, ayaklar biraz önde, dizler hafif bükük */
      const t = clamp((this.vy + 260) / 620, 0, 1);       // 0 yükseliş .. 1 düşüş
      const tuck = 1 - Math.abs(2 * t - 1);                 // tepe noktası
      const leap = clamp(Math.abs(this.vx) / 200, 0, 1);    // koşarak sıçrayış → bacaklar açılır
      const push = this.vy < -60 ? clamp(1 - (this.airT ?? 1) / 0.13, 0, 1) : 0;
      // yerinde sıçrama: iki ayak birlikte toplanır
      const stL = { x: pelvisX + f * lerp(5, 7, t) * s, y: pelvisY + legLen * lerp(0.6, 0.88, t) - tuck * 9 * s };
      const stR = { x: pelvisX - f * lerp(1, -2, t) * s, y: pelvisY + legLen * lerp(0.64, 0.86, t) - tuck * 9 * s };
      // koşarak sıçrama: makas
      const lpL = { x: pelvisX + f * lerp(14, 9, t) * s, y: pelvisY + legLen * lerp(0.5, 0.86, t) - tuck * 6 * s };
      const lpR = { x: pelvisX - f * lerp(17, 5, t) * s, y: pelvisY + legLen * lerp(0.9, 0.8, t) - tuck * 10 * s };
      footL = { x: lerp(stL.x, lpL.x, leap), y: lerp(stL.y, lpL.y, leap) };
      footR = { x: lerp(stR.x, lpR.x, leap), y: lerp(stR.y, lpR.y, leap) };
      // itiş: bacaklar gergin, ayaklar kalçanın altında/biraz geride
      footL.x = lerp(footL.x, pelvisX - f * (1 + leap * 3) * s, push); footL.y = lerp(footL.y, pelvisY + legLen * 0.99, push);
      footR.x = lerp(footR.x, pelvisX - f * (4 + leap * 10) * s, push); footR.y = lerp(footR.y, pelvisY + legLen * 0.99, push);
      footAngL = lerp(lerp(0.1, 0.15, t), 0.95, push);
      footAngR = lerp(lerp(0.45, 0.2, t), 1.0, push);
    } else if (skid) {
      footL = { x: pelvisX - f * 15 * s, y: gY };           // fren ayağı ileride (kayma yönünde)
      footR = { x: pelvisX - f * 2 * s, y: gY };
      footAngL = -0.35;
    } else if (moving) {
      /* ADIM DÖNGÜSÜ — destek fazında ayak pelvise göre DOĞRUSAL geri gider
         (hız tam olarak -v → ayak yerde kilitli, kayma/moonwalk yok).
         Salınımda yumuşak öne savrulur. Koşuda topuk kalçaya doğru katlanır. */
      const hipH = gY - pelvisY;
      const maxHoriz = Math.sqrt(Math.max(1, legLen * legLen * 0.985 - hipH * hipH));
      const liftW = legLen * 0.15, liftR = legLen * 0.5;
      const ss = (v) => v * v * (3 - 2 * v);
      const legFoot = (p) => {
        const u = ((p % TAU) + TAU) % TAU;
        if (u < swingLen) {
          /* SALINIM: parmak itişiyle topuk yukarı kalkar (diz bükülür), ayak gövdenin
             altından alçak geçer, sona doğru diz açılır ve parmak yukarı — topukla basmaya hazır */
          const k = u / swingLen;
          const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
          let x = -stride + 2 * stride * e;
          x -= runF * stride * 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (1 - k);   // koşu: topuk kalçaya katlanır
          const hW = Math.sin(Math.PI * Math.pow(k, 0.62)) * (1 - 0.35 * ss(clamp((k - 0.45) / 0.55, 0, 1)));
          const hR = Math.sin(Math.PI * Math.pow(k, 0.8));
          const h = lerp(hW * liftW, hR * liftR, runF);
          const ang = lerp(lerp(0.75, -0.32, ss(k)), lerp(0.95, -0.05, ss(k)), runF);
          return { x: pelvisX + clamp(x, -maxHoriz * 1.3, maxHoriz) * f, y: gY - h, ang, swing: true };
        }
        /* DESTEK: topukla basış (parmak yukarı) → taban düz → topuk kalkar, parmak üstünde itiş.
           Topuk kalkarken ayak bileği de yükselir (ayak parmak üstünde döner). */
        const k = (u - swingLen) / (TAU * D);
        const x = stride - 2 * stride * k;
        const heelOn = lerp(0.15, 0.05, runF), heelOff = lerp(0.6, 0.45, runF);
        let ang = 0;
        if (k < heelOn) ang = lerp(lerp(-0.32, -0.05, runF), 0, k / heelOn);
        else if (k > heelOff) ang = (k - heelOff) / (1 - heelOff) * lerp(0.75, 0.95, runF);
        const ankleLift = ang > 0 ? Math.sin(ang) * 8.5 * s : Math.sin(-ang) * 2.5 * s;
        return { x: pelvisX + clamp(x, -maxHoriz, maxHoriz) * f, y: gY - ankleLift, ang, swing: false };
      };
      footL = legFoot(ph);
      footR = legFoot(ph + Math.PI);
      footAngL = footL.ang; footAngR = footR.ang;
    } else {
      /* duruş: kontrapost — ağırlık bir bacakta */
      footL = { x: pelvisX - f * 1.5 * s, y: gY };
      footR = { x: pelvisX + f * (fem ? 10 : 7) * s, y: gY - 0.5 };
    }
    if (fem && this.grounded) { const hl = 7 * s; footL.y -= hl; footR.y -= hl; }

    const legL = solveIK2(pelvisX - A.hipW * 0.4 * f, pelvisY, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvisX + A.hipW * 0.4 * f, pelvisY, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? -1 : 1);

    /* ============ KOLLAR ============
       ÇAPRAZ salınım: bir kol, KARŞI bacak öndeyken öndedir (sağ kol ↔ sol bacak).
       Salınım miktarı karşı ayağın gerçek konumundan okunur → bacakla birebir senkron.
       Yürüyüşte gevşek, koşuda dirsek ~90° bükük ve güçlü pompalama. */
    const shoulderTwist = (this.grounded && moving) ? (footL.x - pelvisX) * f / Math.max(1, stride) * (1.2 + runF * 1.6) * s : 0;
    const shRoll = (this.grounded && moving) ? Math.sin(ph) * (0.7 + runF * 1.4) * s : 0;
    const shL = { x: shX - A.shW * 0.45 * f + shoulderTwist * f, y: shY + 1 + shRoll };
    const shR = { x: shX + A.shW * 0.45 * f - shoulderTwist * f, y: shY + 1 - shRoll };
    const armReach = A.armUp + A.armLo;
    const recoil = this.recoilT > 0 ? Math.sin(this.recoilT * 28) * this.recoilT * 9 : 0;
    const swingMag = moving ? (0.34 + runF * 0.42) : 0;
    const oppSwing = (oppFoot) => moving && this.grounded ? clamp((oppFoot.x - pelvisX) * f / Math.max(1, stride), -1.1, 1.1) : 0;

    const fkArm = (sh, sw) => {
      const breatheSwing = idle ? Math.sin(this.breathe * 0.85) * 0.05 : 0;
      const upperAng = Math.PI / 2 - f * ((fem ? 0.12 : 0.08) + lean * 0.6 + sw * swingMag) + breatheSwing;
      let flex = lerp(0.3, 1.45, runF) + Math.max(0, sw) * lerp(0.25, 0.35, runF);
      flex = clamp(flex, 0, 1.9);
      const ex = sh.x + Math.cos(upperAng) * A.armUp;
      const ey = sh.y + Math.sin(upperAng) * A.armUp;
      const foreAng = upperAng - f * flex;
      return { jx: ex, jy: ey, ex: ex + Math.cos(foreAng) * A.armLo, ey: ey + Math.sin(foreAng) * A.armLo };
    };

    let handL = null, handR = null;
    if (this.aimMode && this.holdItem === 'pistol') {
      const aa = this.aimAngle;
      const ax = Math.cos(aa) * f, ay = Math.sin(aa);
      handR = { x: shX + ax * armReach * 0.93 - f * recoil, y: shY + 4 * s + ay * armReach * 0.9 - recoil * 0.4 };
      handL = { x: shX + ax * armReach * 0.78 - f * recoil * 0.7, y: shY + 7 * s + ay * armReach * 0.78 };
    } else if (this.mode === 'push') {
      handL = { x: shX + f * armReach * 0.86, y: shY + 7 * s };
      handR = { x: shX + f * armReach * 0.92, y: shY + 13 * s };
    } else if (this.mode === 'pry') {
      const t = Math.min(1, this.pryAnim * 1.4);
      const press = Math.sin(Math.min(Math.PI, t * Math.PI));
      handL = { x: shX + f * (armReach * 0.55), y: shY + 4 * s + press * 16 * s };
      handR = { x: shX + f * (armReach * 0.62), y: shY + 8 * s + press * 16 * s };
    } else if (!this.grounded) {
      /* havada: yükselişte kollar yukarı savrulur, düşüşte denge için yana açılır */
      /* kalkışta iki kol öne-yukarı savrulur (itişe güç katar); koşarak sıçramada çapraz;
         düşüşte kollar denge için öne ve hafif yukarı açılır */
      const t = clamp((this.vy + 260) / 620, 0, 1);
      const leap = clamp(Math.abs(this.vx) / 200, 0, 1);
      const push = this.vy < -60 ? clamp(1 - (this.airT ?? 1) / 0.16, 0, 1) : 0;
      const upR = { x: shX + f * armReach * 0.55, y: shY - armReach * lerp(0.35, 0.1, t) };
      const upL = { x: shX + f * armReach * lerp(0.4, 0.25, leap), y: shY - armReach * lerp(0.25, 0.0, t) + leap * armReach * 0.7 };
      const fallR = { x: shX + f * armReach * 0.6, y: shY + armReach * 0.05 };
      const fallL = { x: shX - f * armReach * 0.35, y: shY + armReach * 0.1 };
      handR = { x: lerp(upR.x, fallR.x, t), y: lerp(upR.y, fallR.y, t) };
      handL = { x: lerp(upL.x, fallL.x, t), y: lerp(upL.y, fallL.y, t) };
      if (push > 0) { handR.y -= push * armReach * 0.2; handL.y -= push * armReach * 0.2 * (1 - leap); }
    } else if (skid) {
      handL = { x: shX + f * 14 * s, y: shY + armReach * 0.35 };
      handR = { x: shX - f * 10 * s, y: shY + armReach * 0.45 };
    }
    if (this.grounded && this.prepT > 0 && !this.aimMode) {
      // hazırlık: kollar geriye çekilir (sıçramada öne savrulmak için)
      handR = { x: shX - f * armReach * 0.45, y: shY + armReach * 0.7 };
      handL = { x: shX - f * armReach * 0.55, y: shY + armReach * 0.65 };
    } else if (this.grounded && this.landImpact > 0.12 && !this.aimMode && this.mode !== 'push') {
      // iniş: kollar öne-aşağı uzanır, yükü dengeler
      const li = this.landImpact;
      handR = { x: shX + f * armReach * (0.35 + li * 0.3), y: shY + armReach * (0.75 - li * 0.15) };
      handL = { x: shX + f * armReach * (0.15 + li * 0.25), y: shY + armReach * (0.8 - li * 0.1) };
    }
    if (!this.aimMode && this.mode !== 'push' && this.mode !== 'pry' && this.grounded && !skid && !moving) {
      if (this.holdItem === 'crowbar') handR = { x: shX + f * 9 * s, y: shY + armReach * 0.62 };
      else if (this.holdItem === 'pistol') handR = { x: shX + f * 8 * s, y: shY + armReach * 0.68 };
    }
    /* EL FENERİ: kol omuz hizasında ileri uzanır, fener ileriyi gösterir.
       (eskiden el bel hizasındaydı ve ışık gövdenin ortasından çıkıyordu) */
    if (this.flashOn && this.mode !== 'push' && this.mode !== 'pry') {
      const steady = moving ? Math.sin(ph * 2) * (0.6 + runF * 1.6) * s : 0;
      handL = { x: shX + f * armReach * (0.74 - runF * 0.1), y: shY + (4 + runF * 4) * s + steady };
    }
    if (fem && !moving && this.grounded && !this.aimMode && this.mode !== 'push' && this.mode !== 'pry' && handL == null) {
      handL = { x: pelvisX - f * 4 * s, y: pelvisY - 2 * s };
    }
    if (idle) {
      const brA = Math.sin(this.breathe * 0.85);
      const brB = Math.sin(this.breathe * 0.55 + 2.1);
      if (handR == null) handR = { x: shX + f * (5.0 + brA * 0.8) * s, y: shY + armReach * 0.79 + brA * 1.0 * s };
      if (handL == null) handL = { x: shX - f * (3.2 + brB * 0.5) * s, y: shY + armReach * 0.86 + brB * 0.8 * s };
    }

    const solveArm = (key, sh, hand, sw) => {
      if (hand) {
        if (!this.aimMode && this.mode !== 'push' && this.mode !== 'pry') hand = this._smoothHand(key, hand, sh.x, sh.y);
        // el gövdenin arkasında ve omuz hizasına yakınsa dirsek aşağı bakar (yukarı kırılmaz)
        const behindHigh = (hand.x - sh.x) * f < -2 && hand.y < sh.y + armReach * 0.4;
        const bend = (f > 0 ? 1 : -1) * (behindHigh ? -1 : 1);
        return solveIK2(sh.x, sh.y, hand.x, hand.y, A.armUp, A.armLo, bend);
      }
      if (this._sm) delete this._sm[key];
      return fkArm(sh, sw);
    };
    const armL = solveArm('hL', shL, handL, oppSwing(footR));   // sol kol ↔ sağ bacak
    const armR = solveArm('hR', shR, handR, oppSwing(footL));   // sağ kol ↔ sol bacak

    this._setJoints(J, { x: pelvisX, y: pelvisY }, { x: shX, y: shY }, { x: headX, y: headY }, legL, legR, armL, armR);
    J.footL.ang = footAngL;
    J.footR.ang = footAngR;
    this.render(J, lean);
  }

  /* ============ EYLEM ÇİZİMLERİ ============ */
  drawAction() {
    const A = this.A, f = this.facing, J = this.joints;
    const act = this.action;
    const t = act.t;
    const gY = this.groundY;
    const px = this.x;
    const armReach = A.armUp + A.armLo;

    // varsayılan: ayakta dik
    let dip = 0;          // pelvis alçalması 0..1
    let lean = 0;
    let kneel = 0;        // tek diz yere
    let handLT = null, handRT = null;   // el hedefleri (dünya)
    let footL = { x: px - 5 * this.s, y: gY }, footR = { x: px + 6 * this.s, y: gY };

    switch (act.name) {
      case 'pickup': {
        // eğil → uzan → al → doğrul
        dip = t < 0.45 ? smooth(t / 0.45) : smooth((1 - t) / 0.55);
        lean = f * 0.65 * dip;
        const tx = act.targetX ?? (px + f * 30), ty = act.targetY ?? (gY - 6);
        const reach = smooth(clamp((t - 0.12) / 0.3, 0, 1)) * (t < 0.55 ? 1 : smooth((1 - t) / 0.45));
        handRT = { x: lerp(px + f * 8, tx, reach), y: lerp(gY - 40 * this.s, ty, reach) };
        footL = { x: px - 7 * this.s, y: gY };
        footR = { x: px + f * 10 * this.s, y: gY };
        break;
      }
      case 'batterySwap': {
        dip = 0.22;
        lean = f * 0.18;
        // sol el feneri göğüs hizasında tutar
        const chest = { x: px + f * 14 * this.s, y: gY - A.standH * 0.62 };
        handLT = chest;
        // sağ el: fener → cep → fener
        let rt;
        if (t < 0.32) rt = { x: chest.x + f * 4, y: chest.y + 4 };                       // pil çıkar
        else if (t < 0.6) {
          const k = smooth((t - 0.32) / 0.28);
          rt = { x: lerp(chest.x, px + f * 3, k), y: lerp(chest.y, gY - A.standH * 0.42, k) }; // cebe
        } else if (t < 0.8) {
          const k = smooth((t - 0.6) / 0.2);
          rt = { x: lerp(px + f * 3, chest.x + f * 4, k), y: lerp(gY - A.standH * 0.42, chest.y + 3, k) }; // geri
        } else rt = { x: chest.x + f * 5, y: chest.y + 2 };                              // tak + çevir
        handRT = rt;
        break;
      }
      case 'reload': {
        dip = 0.12;
        lean = f * 0.1;
        // sağ el tabancayı önde-alçakta tutar
        const gun = { x: px + f * 22 * this.s, y: gY - A.standH * 0.58 };
        handRT = gun;
        let lt;
        if (t < 0.28) lt = { x: gun.x - f * 3, y: gun.y + 5 };                            // şarjöre uzan
        else if (t < 0.55) {
          const k = smooth((t - 0.28) / 0.27);
          lt = { x: lerp(gun.x - f * 3, px - f * 2, k), y: lerp(gun.y + 8, gY - A.standH * 0.40, k) }; // kemerden yeni şarjör
        } else if (t < 0.78) {
          const k = smooth((t - 0.55) / 0.23);
          lt = { x: lerp(px - f * 2, gun.x - f * 2, k), y: lerp(gY - A.standH * 0.40, gun.y + 4, k) };  // tak
        } else if (t < 0.92) {
          const k = Math.sin(((t - 0.78) / 0.14) * Math.PI);
          lt = { x: gun.x - f * (2 + k * 9), y: gun.y - 2 - k * 3 };                      // sürgü çek
        } else lt = { x: gun.x - f * 4, y: gun.y + 5 };
        handLT = lt;
        break;
      }
      case 'bandage': {
        // tek diz çök, sağ el sol ön-kolu sarar (dairesel hareket)
        kneel = smooth(clamp(t / 0.18, 0, 1)) * (t > 0.85 ? smooth((1 - t) / 0.15) : 1);
        dip = kneel * 0.55;
        lean = f * 0.25 * kneel;
        const fore = { x: px + f * 13 * this.s, y: gY - A.standH * 0.46 + dip * 16 };
        handLT = fore;
        if (t > 0.15 && t < 0.88) {
          const wrap = (t - 0.15) / 0.73 * Math.PI * 6;   // 3 tur
          handRT = { x: fore.x + Math.cos(wrap) * 7 * this.s, y: fore.y + Math.sin(wrap) * 7 * this.s };
        } else handRT = { x: fore.x + f * 6, y: fore.y + 4 };
        footL = { x: px - f * 3 * this.s, y: gY };
        footR = { x: px - f * 17 * this.s, y: gY };       // arka diz
        break;
      }
      case 'lever': {
        // kolu kavra, vücut ağırlığıyla aşağı çek
        const pull = t < 0.68 ? smooth(t / 0.68) : 1;
        dip = pull * 0.34;
        lean = f * (0.3 - pull * 0.5);
        const lx = act.targetX ?? (px + f * 26), ly0 = (act.targetY ?? gY - 70) - 18;
        handLT = { x: lx - f * 3, y: ly0 + pull * 34 };
        handRT = { x: lx + f * 2, y: ly0 + pull * 34 + 3 };
        break;
      }
      case 'pickpocket': {
        // çömelik, tek el yavaşça hedefe süzülür
        dip = 0.5;
        lean = f * 0.4;
        const tx = act.targetX ?? (px + f * 40), ty = act.targetY ?? (gY - 40);
        const k = smooth(clamp(t / 0.7, 0, 1)) * (t > 0.8 ? smooth((1 - t) / 0.2) : 1);
        handRT = { x: lerp(px + f * 10, tx, k), y: lerp(gY - 36 * this.s, ty, k) };
        handLT = { x: px - f * 2, y: gY - 30 * this.s };
        break;
      }
      case 'insert': {
        // pil/sigorta takma — panele uzan
        dip = 0.1;
        lean = f * 0.22;
        const tx = act.targetX ?? (px + f * 34), ty = act.targetY ?? (gY - 88);
        const k = t < 0.6 ? smooth(t / 0.6) : smooth((1 - t) / 0.4) * 0.7 + 0.3;
        handRT = { x: lerp(px + f * 8, tx, k), y: lerp(gY - 44 * this.s, ty, k) };
        break;
      }
    }

    const pelvis = { x: px - f * dip * 6 * this.s, y: gY - A.standH * (1 - dip * 0.42) };
    const torsoLen = A.torso * (1 - dip * 0.16);
    const neck = { x: pelvis.x + Math.sin(lean) * torsoLen, y: pelvis.y - Math.cos(lean) * torsoLen };
    const head = { x: neck.x + Math.sin(lean * 1.5) * A.headR * 1.55 + f * A.headR * 0.3, y: neck.y - Math.cos(lean * 1.5) * A.headR * 1.55 - A.headR * 0.45 };

    if (!handLT) handLT = { x: neck.x - f * 2 * this.s, y: neck.y + armReach * 0.78 };
    if (!handRT) handRT = { x: neck.x + f * 3 * this.s, y: neck.y + armReach * 0.78 };

    const legL = solveIK2(pelvis.x - A.hipW * 0.4 * f, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.4 * f, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const armL = solveIK2(neck.x - A.shW * 0.45 * f, neck.y + 1, handLT.x, handLT.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armR = solveIK2(neck.x + A.shW * 0.45 * f, neck.y + 1, handRT.x, handRT.y, A.armUp, A.armLo, f > 0 ? 1 : -1);

    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, lean);
  }

  /* ============ YÜZME ============ */
  drawSwim() {
    const A = this.A, f = this.facing, J = this.joints;
    const speed = Math.abs(this.vx);
    const swimming = speed > 12;
    const ph = this.phase;
    // gövde yatay-eğik
    const bodyAng = f * (swimming ? 0.32 : 0.12) + Math.sin(this.swimT * 2) * 0.04;
    const pelvis = { x: this.x - f * 8 * this.s, y: this.y + 6 * this.s };
    const neck = {
      x: pelvis.x + Math.cos(bodyAng * f) * A.torso * f * 0.96,
      y: pelvis.y - Math.sin(swimming ? 0.35 : 0.5) * A.torso * 0.8,
    };
    const head = { x: neck.x + f * A.headR * 1.3, y: neck.y - A.headR * 0.7 + Math.sin(ph * 2) * 1.5 };

    // bacaklar: makas tekmesi
    const kick = swimming ? 1 : 0.4;
    const footL = { x: pelvis.x - f * (A.legUp + A.legLo) * 0.8, y: pelvis.y + Math.sin(ph * 2) * 11 * this.s * kick + 4 };
    const footR = { x: pelvis.x - f * (A.legUp + A.legLo) * 0.85, y: pelvis.y + Math.sin(ph * 2 + Math.PI) * 11 * this.s * kick + 6 };
    const legL = solveIK2(pelvis.x, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? -1 : 1);

    // kollar: serbest stil kulaç (daire)
    const armReach = A.armUp + A.armLo;
    const strokeL = ph, strokeR = ph + Math.PI;
    const handL = {
      x: neck.x + (Math.cos(strokeL) * 0.9 + 0.3) * armReach * 0.8 * f,
      y: neck.y + Math.sin(strokeL) * armReach * 0.55 + 4,
    };
    const handR = {
      x: neck.x + (Math.cos(strokeR) * 0.9 + 0.3) * armReach * 0.8 * f,
      y: neck.y + Math.sin(strokeR) * armReach * 0.55 + 6,
    };
    const armL = solveIK2(neck.x - 2 * f, neck.y, handL.x, handL.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armR = solveIK2(neck.x + 2 * f, neck.y, handR.x, handR.y, A.armUp, A.armLo, f > 0 ? 1 : -1);

    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, f * 0.8);
  }

  /* ============ TIRMANMA (merdiven) ============ */
  drawClimb() {
    const A = this.A, J = this.joints;
    const ph = this.phase;
    const lx = this.x;   // merdiven ekseni
    /* çapraz tırmanış: sol el ile sağ ayak birlikte uzanır (gerçek merdiven ritmi);
       uzanan uzuv kısa bir yay çizer, tutan uzuv basamakta sabit kalır */
    const s = this.s;
    const reachA = Math.max(0, Math.sin(ph)), reachB = Math.max(0, Math.sin(ph + Math.PI));
    const sway = Math.sin(ph) * 1.4 * s;
    const pelvis = { x: lx - 6 * s + sway, y: this.y };
    const neck = { x: lx - 2.5 * s + sway * 0.5, y: pelvis.y - A.torso * 0.97 };
    const head = { x: neck.x + 2.5 * s, y: neck.y - A.headR * 1.45 - reachA * 1 * s };
    const handL = { x: lx + 3 * s + reachA * 2 * s, y: neck.y - 12 * s - reachA * 15 * s };
    const handR = { x: lx + 3 * s + reachB * 2 * s, y: neck.y - 12 * s - reachB * 15 * s };
    const footL = { x: lx + 2 * s + reachB * 3 * s, y: pelvis.y + A.legUp + A.legLo * 0.66 - reachB * 16 * s };
    const footR = { x: lx + 2 * s + reachA * 3 * s, y: pelvis.y + A.legUp + A.legLo * 0.66 - reachA * 16 * s };
    const legL = solveIK2(pelvis.x, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, -1);
    const legR = solveIK2(pelvis.x, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, -1);
    const armL = solveIK2(neck.x, neck.y, handL.x, handL.y, A.armUp, A.armLo, 1);
    const armR = solveIK2(neck.x, neck.y, handR.x, handR.y, A.armUp, A.armLo, 1);
    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, 0);
  }

  /* ============ KAYMA (koşarken eğil) ============
     ayaklar önde yere uzanır, gövde geriye yaslanır, arka el yere sürtünür */
  drawSlide() {
    const A = this.A, f = this.facing, J = this.joints, s = this.s;
    const gY = this.groundY;
    const pelvis = { x: this.x - f * 4 * s, y: gY - A.legUp * 0.42 };
    const lean = -f * 0.62;
    const neck = { x: pelvis.x + Math.sin(lean) * A.torso, y: pelvis.y - Math.cos(lean) * A.torso };
    const head = { x: neck.x + f * A.headR * 0.9, y: neck.y - A.headR * 1.3 };
    const footF = { x: pelvis.x + f * (A.legUp + A.legLo) * 0.93, y: gY - 2 * s };
    const footB = { x: pelvis.x + f * 6 * s, y: gY - 1 };
    const legL = solveIK2(pelvis.x, pelvis.y, footF.x, footF.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x, pelvis.y, footB.x, footB.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const armReach = A.armUp + A.armLo;
    const handB = { x: neck.x - f * armReach * 0.55, y: gY - 2 * s };
    const handF = { x: neck.x + f * armReach * 0.6, y: neck.y + 2 * s };
    const armL = solveIK2(neck.x, neck.y, handB.x, handB.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armR = solveIK2(neck.x, neck.y, handF.x, handF.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    J.footL.ang = -0.5;
    this.render(J, lean);
  }

  /* ============ ÇÖMELİK SIZMA (eğilme) ============
     Yüzüstü sürünme yerine insan gibi derin çömelmiş,
     öne eğik, sessiz adımlarla ilerleyen duruş. */
  drawCrawl() {
    const A = this.A, f = this.facing, J = this.joints;
    const gY = this.groundY;
    const speed = Math.abs(this.vx);
    const moving = speed > 4;
    const ph = this.phase;

    /* pelvis derin çömelmede — dizler tam bükük, sırt öne eğik */
    const dipBob = moving ? Math.abs(Math.cos(ph)) * 1.2 * this.s : Math.sin(this.breathe * 1.8) * 0.7 * this.s;
    const pelvis = { x: this.x - f * 4 * this.s, y: gY - A.standH * 0.44 - dipBob };
    const leanA = f * 0.78;                                   // ~45° öne eğik gövde
    const neck = {
      x: pelvis.x + Math.sin(leanA) * A.torso * 0.94,
      y: pelvis.y - Math.cos(leanA) * A.torso * 0.94,
    };
    /* baş öne bakar, tetikte */
    const head = { x: neck.x + f * A.headR * 1.35, y: neck.y - A.headR * 0.9 };

    /* küçük sessiz adımlar — basan ayak yerde sabit (mesafe-bağlı genlik) */
    const stride = this._stepAmp(speed);
    const stepFoot = (p, off) => {
      const sn = Math.sin(p), cs = Math.cos(p);
      if (moving && sn > 0) return { x: pelvis.x + f * off - cs * stride * f, y: gY - sn * 3.5 * this.s };
      return { x: pelvis.x + f * off + (moving ? -cs * stride * f : 0), y: gY };
    };
    const footL = stepFoot(ph, -2 * this.s);
    const footR = stepFoot(ph + Math.PI, 9 * this.s);
    const legL = solveIK2(pelvis.x - A.hipW * 0.3 * f, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.3 * f, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? -1 : 1);

    /* kollar: biri önde denge için alçakta, diğeri dizde */
    const armReach = A.armUp + A.armLo;
    const swing = moving ? Math.cos(ph) * 4 * this.s : 0;
    const handL = { x: neck.x + f * (12 * this.s + swing), y: neck.y + armReach * 0.55 };
    const handR = { x: neck.x + f * (4 * this.s - swing), y: neck.y + armReach * 0.66 };
    const armL = solveIK2(neck.x - 1.5 * f, neck.y, handL.x, handL.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armR = solveIK2(neck.x + 1.5 * f, neck.y, handR.x, handR.y, A.armUp, A.armLo, f > 0 ? 1 : -1);

    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, leanA);
  }

  /* ============ SİNEMATİK POZLAR ============ */
  drawPose() {
    const A = this.A, f = this.facing, J = this.joints;
    const t = this.poseT;
    const px = this.x, gY = this.groundY;
    const P = {};
    const def = (pelvY, shOff, headOff, hl, hr, fl, fr) => ({ pelvY, shOff, headOff, hl, hr, fl, fr });
    switch (this.poseName) {
      case 'holdHands': // el ele yürüyüş duruşu (durunca)
        P.v = def(-A.standH, { x: f * 1, y: -A.torso * 0.97 }, { x: f * 5, y: -7 },
          { x: -f * 6, y: -2 }, { x: f * 14, y: -A.torso * 0.28 },
          { x: -4, y: 0 }, { x: 6, y: 0 });
        break;
      case 'hug':
        P.v = def(-A.standH, { x: f * 4, y: -A.torso * 0.97 }, { x: f * 9, y: -8 },
          { x: f * 26, y: -A.torso * 0.55 }, { x: f * 24, y: -A.torso * 0.85 },
          { x: -4, y: 0 }, { x: 6, y: 0 });
        break;
      case 'scared': // korkmuş — geri çekilmiş, eller önde
        P.v = def(-A.standH + 3, { x: -f * 4, y: -A.torso * 0.92 }, { x: -f * 2, y: -9 },
          { x: f * 14, y: -A.torso * 0.75 }, { x: f * 17, y: -A.torso * 0.6 },
          { x: -f * 9, y: 0 }, { x: f * 4, y: 0 });
        break;
      case 'punchWind':
        P.v = def(-A.standH + 3, { x: -f * 5, y: -A.torso * 0.95 }, { x: -f * 2, y: -10 },
          { x: -f * 24, y: -A.torso * 0.9 }, { x: f * 8, y: -A.torso * 0.3 },
          { x: -f * 10, y: 0 }, { x: f * 8, y: 0 });
        break;
      case 'punch':
        P.v = def(-A.standH + 2, { x: f * 9, y: -A.torso * 0.92 }, { x: f * 12, y: -8 },
          { x: f * (A.armUp + A.armLo) * 0.98, y: -A.torso * 0.88 }, { x: -f * 6, y: -A.torso * 0.25 },
          { x: -f * 12, y: 0 }, { x: f * 12, y: 0 });
        break;
      case 'fallen': return this.drawFallen();
      case 'kneel':
        P.v = def(-A.standH * 0.55, { x: f * 3, y: -A.torso * 0.88 }, { x: f * 8, y: -5 },
          { x: f * 8, y: -2 }, { x: f * 12, y: -2 },
          { x: -f * 2, y: 0 }, { x: -f * 16, y: 0 });
        break;
      case 'dragged':
        P.v = def(-A.standH * 0.72, { x: -f * 8, y: -A.torso * 0.8 }, { x: -f * 4, y: -11 },
          { x: -f * 28 - Math.sin(t * 9) * 5, y: -A.torso * 1.15 }, { x: -f * 22 + Math.sin(t * 11) * 5, y: -A.torso * 1.05 },
          { x: -f * 24, y: 2 }, { x: -f * 30, y: 3 });
        break;
      case 'carryStruggle':
        P.v = def(-A.standH * 0.9, { x: -f * 10, y: -A.torso * 0.5 }, { x: -f * 16, y: 2 },
          { x: -f * 18, y: -A.torso * 0.9 + Math.sin(t * 8) * 4 }, { x: -f * 14, y: -A.torso * 0.7 - Math.sin(t * 8) * 4 },
          { x: f * 14 + Math.sin(t * 10) * 6, y: -A.standH * 0.45 }, { x: f * 18 - Math.sin(t * 10) * 6, y: -A.standH * 0.5 });
        break;
      case 'reach':
        P.v = def(-A.standH * 0.62, { x: f * 7, y: -A.torso * 0.85 }, { x: f * 11, y: -7 },
          { x: f * (A.armUp + A.armLo) * 0.99, y: -A.torso * 1.1 }, { x: f * 16, y: -4 },
          { x: -f * 6, y: 0 }, { x: -f * 20, y: 1 });
        break;
      case 'peerDown': // çukurun kenarında diz çöküp aşağı uzanma
        P.v = def(-A.standH * 0.5, { x: f * 13, y: -A.torso * 0.72 }, { x: f * 16, y: 3 },
          { x: f * 26, y: 14 }, { x: f * 10, y: -3 },
          { x: -f * 3, y: 0 }, { x: -f * 18, y: 1 });
        break;
      case 'bound': // bombaya bağlı — diz çökmüş, eller arkada
        P.v = def(-A.standH * 0.56, { x: -f * 1, y: -A.torso * 0.9 }, { x: f * 3, y: 2 + Math.sin(this.breathe * 1.3) * 1.5 },
          { x: -f * 9, y: -6 }, { x: -f * 7, y: -4 },
          { x: f * 4, y: 0 }, { x: -f * 15, y: 0 });
        break;
      case 'standSad':
      default:
        P.v = def(-A.standH + 2, { x: f * 1, y: -A.torso * 0.93 }, { x: f * 6, y: -6 + Math.sin(this.breathe * 1.4) },
          { x: -f * 1, y: -2 }, { x: f * 3, y: -2 },
          { x: -4, y: 0 }, { x: 5, y: 0 });
    }
    const v = P.v;
    const pelvis = { x: px, y: gY + v.pelvY };
    const neck = { x: pelvis.x + v.shOff.x * this.s, y: pelvis.y + v.shOff.y };
    const head = { x: neck.x + v.headOff.x * this.s * 0.4, y: neck.y + v.headOff.y * this.s * 0.6 - A.headR * 1.2 };
    const armReach = A.armUp + A.armLo;
    const handLW = { x: pelvis.x + v.hl.x * this.s, y: pelvis.y + (v.hl.y < 0 ? v.hl.y : armReach * 0.45 + v.hl.y) };
    const handRW = { x: pelvis.x + v.hr.x * this.s, y: pelvis.y + (v.hr.y < 0 ? v.hr.y : armReach * 0.45 + v.hr.y) };
    const footLW = { x: pelvis.x + v.fl.x * this.s, y: gY + (v.fl.y || 0) };
    const footRW = { x: pelvis.x + v.fr.x * this.s, y: gY + (v.fr.y || 0) };

    const legL = solveIK2(pelvis.x - A.hipW * 0.4 * f, pelvis.y, footLW.x, footLW.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.4 * f, pelvis.y, footRW.x, footRW.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const armL = solveIK2(neck.x - A.shW * 0.4 * f, neck.y, handLW.x, handLW.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armR = solveIK2(neck.x + A.shW * 0.4 * f, neck.y, handRW.x, handRW.y, A.armUp, A.armLo, f > 0 ? 1 : -1);

    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, 0);
  }

  drawFallen() {
    const A = this.A, f = this.facing, J = this.joints, gY = this.groundY, px = this.x;
    const pelvis = { x: px, y: gY - 7 * this.s };
    const neck = { x: px - f * A.torso * 0.95, y: gY - 9 * this.s };
    const head = { x: neck.x - f * A.headR * 1.5, y: gY - A.headR };
    const footL = { x: px + f * 26 * this.s, y: gY - 2 };
    const footR = { x: px + f * 33 * this.s, y: gY - 4 };
    const handL = { x: neck.x - f * 14 * this.s, y: gY - 1 };
    const handR = { x: neck.x + f * 9 * this.s, y: gY - 1 };
    const legL = solveIK2(pelvis.x, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvis.x, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? 1 : -1);
    const armL = solveIK2(neck.x, neck.y, handL.x, handL.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armR = solveIK2(neck.x, neck.y, handR.x, handR.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, 0);
  }

  drawRagdoll() {
    const R = this.ragdoll; if (!R) return;
    const J = {};
    for (const k in R.pts) J[k] = { x: R.pts[k].x, y: R.pts[k].y };
    this.render(J, 0);
  }

  _setJoints(J, pelvis, neck, head, legL, legR, armL, armR) {
    J.pelvis = pelvis; J.neck = neck; J.head = head;
    J.kneeL = { x: legL.jx, y: legL.jy }; J.kneeR = { x: legR.jx, y: legR.jy };
    J.footL = { x: legL.ex, y: legL.ey }; J.footR = { x: legR.ex, y: legR.ey };
    J.elbL = { x: armL.jx, y: armL.jy }; J.elbR = { x: armR.jx, y: armR.jy };
    J.handL = { x: armL.ex, y: armL.ey }; J.handR = { x: armR.ex, y: armR.ey };
  }

  /* lurker: dizlere sarkan uzun, kemikli parmaklar */
  _fingers(g, elb, hand, col) {
    const s = this.s;
    const a = Math.atan2(hand.y - elb.y, hand.x - elb.x);
    g.lineStyle(1.1 * s, col, 1);
    for (let i = -1; i <= 1; i++) {
      const fa = a + i * 0.28 + Math.sin(this.breathe * 3 + i) * 0.08;
      const L = (9 + (i === 0 ? 3 : 0)) * s;
      const mx = hand.x + Math.cos(fa) * L * 0.55, my = hand.y + Math.sin(fa) * L * 0.55;
      g.beginPath(); g.moveTo(hand.x, hand.y); g.lineTo(mx, my);
      g.lineTo(mx + Math.cos(fa + 0.35 * this.facing) * L * 0.5, my + Math.sin(fa + 0.35 * this.facing) * L * 0.5);
      g.strokePath();
    }
  }

  /* ============ GERÇEK İNSAN SİLUET RENDERI ============ */
  render(J, lean) {
    const g = this.gfx, A = this.A, col = this.color, s = this.s, f = this.facing;
    const fem = this.variant === 'maria';

    /* poz geçişi: eski iskeletten yenisine eklem eklem karışım */
    if (this.mode !== 'ragdoll') {
      if (!this._noBlend && this._blendFrom) {
        const k = smooth(this._blendT / this._blendDur);
        for (const key in J) {
          const a0 = this._blendFrom[key], b0 = J[key];
          if (!a0 || !b0) continue;
          J[key] = { x: lerp(a0.x, b0.x, k), y: lerp(a0.y, b0.y, k), ang: lerp(a0.ang || 0, b0.ang || 0, k) };
        }
      }
      const out = {};
      for (const key in J) if (J[key]) out[key] = { x: J[key].x, y: J[key].y, ang: J[key].ang };
      this._lastOut = out;
    }

    /* incelen uzuv segmenti — dolgulu dörtgen + eklem yuvarlatma */
    const seg = (a, b, w0, w1) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const nx = -dy / d, ny = dx / d;
      g.fillStyle(col, 1);
      g.beginPath();
      g.moveTo(a.x + nx * w0 / 2, a.y + ny * w0 / 2);
      g.lineTo(b.x + nx * w1 / 2, b.y + ny * w1 / 2);
      g.lineTo(b.x - nx * w1 / 2, b.y - ny * w1 / 2);
      g.lineTo(a.x - nx * w0 / 2, a.y - ny * w0 / 2);
      g.closePath(); g.fillPath();
      g.fillCircle(a.x, a.y, w0 / 2);
      g.fillCircle(b.x, b.y, w1 / 2);
    };
    /* ayak — BELİRGİN AYAKKABI; fp.ang = topuk-parmak yuvarlanış açısı.
       kai/asker: dolgun tabanlı bot;  maria: sivri burunlu TOPUKLU ayakkabı. */
    const heelH = fem ? 7.0 * s : 0;       // maria topuğunun yerden yüksekliği (ayak bileği bu kadar yukarıda)
    const foot = (fp) => {
      const a = -(fp.ang || 0) * f;        // ekran yönüne göre döndür
      const ca = Math.cos(a), sa = Math.sin(a);
      const pt = (dx, dy) => ({ x: fp.x + (dx * ca - dy * sa), y: fp.y + (dx * sa + dy * ca) });
      const poly = (...pts) => {
        g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.closePath(); g.fillPath();
      };
      g.fillStyle(col, 1);
      if (fem) {
        /* sivri burunlu pump — ince zarif gövde */
        poly(pt(-f * 2.7 * s, -3.6 * s), pt(f * 9.2 * s, -2.4 * s), pt(f * 9.8 * s, -0.6 * s),
             pt(f * 1.4 * s, 1.5 * s), pt(-f * 2.5 * s, 1.5 * s));
        /* ince yüksek topuk — arka altta yere kadar iner (siluette belirgin) */
        poly(pt(-f * 2.5 * s, 1.0 * s), pt(-f * 1.2 * s, 1.0 * s),
             pt(-f * 1.7 * s, 1.0 * s + heelH), pt(-f * 2.9 * s, 1.0 * s + heelH));
      } else {
        /* dolgun bot: yuvarlak burun + kalın taban */
        poly(pt(-f * 4.2 * s, -5.6 * s), pt(f * 8.6 * s, -3.4 * s), pt(f * 9.6 * s, -0.6 * s),
             pt(f * 8.8 * s, 1.7 * s), pt(-f * 4.6 * s, 1.7 * s), pt(-f * 4.8 * s, -2.2 * s));
        /* taban kabartısı — hafif açık tonla ayrışır */
        g.fillStyle(0x15161e, 1);
        poly(pt(-f * 4.7 * s, 0.7 * s), pt(f * 9.2 * s, 0.0 * s), pt(f * 9.2 * s, 1.8 * s), pt(-f * 4.9 * s, 1.8 * s));
        g.fillStyle(col, 1);
      }
    };

    /* GERÇEK VÜCUT KÜTLESİ — kürdan değil:
       kai/asker: kaslı kalın uzuvlar; maria: dolgun uyluk + ince bilek (kadınsı kontrast).
       Bacaklar kullanıcı isteğiyle biraz daha iri. */
    const lurk = this.variant === 'lurker';
    const bulky = this.variant !== 'maria' && !lurk;
    let thW = (fem ? 10.2 : 11.4) * s, caW = (fem ? 6.2 : 7.2) * s, anW = (fem ? 3.3 : 4.3) * s;
    let uaW = (fem ? 4.8 : 6.8) * s, faW = (fem ? 3.7 : 5.4) * s, wrW = (fem ? 2.5 : 3.5) * s;
    if (lurk) { thW = 5.6 * s; caW = 3.8 * s; anW = 2.0 * s; uaW = 3.4 * s; faW = 2.7 * s; wrW = 1.7 * s; }

    /* kas çıkıntıları: uyluk, baldır (gastrocnemius), omuz (deltoid), pazu */
    const muscle = (a, b, t, r) => {
      g.fillStyle(col, 1);
      g.fillCircle(lerp(a.x, b.x, t), lerp(a.y, b.y, t), r);
    };
    const legMuscles = (hip, knee, footJ) => {
      muscle(hip, knee, 0.32, thW * 0.58);                       // uyluk dolgunluğu
      muscle(knee, footJ, 0.3, caW * (fem ? 0.78 : 0.72));       // baldır kası
    };
    const armMuscles = (sh, elb) => {
      muscle(sh, elb, 0.08, uaW * (bulky ? 0.78 : 0.6));         // deltoid
      if (bulky) muscle(sh, elb, 0.45, uaW * 0.6);               // pazu
    };

    /* ---- zemin temas gölgesi: karakteri yere "oturtur" ---- */
    if (this.mode !== 'ragdoll' && this.groundY) {
      const fx2 = (J.footL.x + J.footR.x) / 2;
      const air = clamp(1 - Math.max(0, this.groundY - Math.max(J.footL.y, J.footR.y)) / 110, 0.15, 1);
      g.fillStyle(0x000000, 0.30 * air);
      g.fillEllipse(fx2, this.groundY + 2.5, (26 + (1 - air) * 14) * s * air + 14 * s, 5.5 * s);
    }

    /* ---- arka uzuvlar ---- */
    seg(J.pelvis, J.kneeL, thW, caW); legMuscles(J.pelvis, J.kneeL, J.footL);
    seg(J.kneeL, J.footL, caW, anW); foot(J.footL);
    seg(J.neck, J.elbL, uaW, faW); armMuscles(J.neck, J.elbL);
    seg(J.elbL, J.handL, faW, wrW);
    g.fillCircle(J.handL.x, J.handL.y, (fem ? 2.4 : 3.0) * s);
    if (lurk) this._fingers(g, J.elbL, J.handL, col);

    /* ---- sırt çantası (kai) — gövdeden önce, arkada ---- */
    if (this.variant === 'kai' && this.mode !== 'ragdoll') {
      const bx = (J.pelvis.x + J.neck.x) / 2 - f * 8.5 * s;
      const by = (J.pelvis.y + J.neck.y) / 2 - 2 * s;
      g.fillStyle(col, 1);
      g.fillRoundedRect(bx - 6 * s, by - 11 * s, 12 * s, 22 * s, 4 * s);
    }

    /* ---- gövde: kalçadan omza dolu form (kum saati / V-form) ---- */
    {
      const p = J.pelvis, n = J.neck;
      const dx = n.x - p.x, dy = n.y - p.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const nx = -dy / d, ny = dx / d;
      const hw = A.hipW * 1.05, sw = A.shW * 1.0;
      const ww = Math.max(hw, sw) * (A.waist ?? 0.86);     // bel — maria'da ince
      const wx = p.x + dx * (fem ? 0.6 : 0.55), wy = p.y + dy * (fem ? 0.6 : 0.55);
      g.fillStyle(col, 1);
      const cR = fem ? hw * 1.02 : (hw + ww) / 2;   // kavis kontrol yarıçapı
      g.beginPath();
      g.moveTo(p.x + nx * hw, p.y + ny * hw);
      // kalça→bel içbükey kavis (kadın silüetinde belirgin)
      qTo(g, p.x + nx * hw, p.y + ny * hw,
        p.x + dx * 0.3 + nx * cR, p.y + dy * 0.3 + ny * cR,
        wx + nx * ww, wy + ny * ww, 6);
      g.lineTo(n.x + nx * sw, n.y + ny * sw);
      g.lineTo(n.x - nx * sw, n.y - ny * sw);
      g.lineTo(wx - nx * ww, wy - ny * ww);
      // bel→kalça dışbükey kavis
      qTo(g, wx - nx * ww, wy - ny * ww,
        p.x + dx * 0.3 - nx * cR, p.y + dy * 0.3 - ny * cR,
        p.x - nx * hw, p.y - ny * hw, 6);
      g.closePath(); g.fillPath();
      // kalça dolgunluğu — maria'da geniş, yuvarlak elips (belirgin kalça hattı)
      if (fem) {
        g.fillEllipse(p.x, p.y + 1.5 * s, hw * 2.75, hw * 2.05);
      } else {
        g.fillCircle(p.x, p.y, hw);
      }
      g.fillCircle(n.x, n.y, sw * 0.92);
      // göğüs kafesi dolgunluğu
      const cx = p.x + dx * 0.78, cy = p.y + dy * 0.78;
      if (fem) {
        // maria: göğüs hattı — bakış yönünde yumuşak kavis
        g.fillCircle(cx + f * 2.6 * s, cy + 0.5 * s, sw * 0.92);
        g.fillCircle(cx + f * 0.5 * s, cy, sw * 0.85);
      } else {
        g.fillCircle(cx + f * 1.2 * s, cy, sw * 1.08);
      }
      // ceket etek ucu (kai) — hıza göre arkaya savrulan kumaş + nefesle salınım
      if (this.variant === 'kai') {
        const coatSway = clamp(-this.vx * 0.022, -7, 7) * s + Math.sin(this.breathe * 2.1) * 0.7 * s;
        const drop = (3 + Math.min(5, Math.abs(this.vx) * 0.01)) * s;   // koşarken biraz uzar
        g.beginPath();
        g.moveTo(p.x - nx * hw * 1.05, p.y - ny * hw);
        g.lineTo(p.x - nx * hw - f * 2 * s + coatSway, p.y + 7 * s + drop);
        g.lineTo(p.x + nx * hw - f * 1 * s + coatSway, p.y + 6 * s + drop);
        g.lineTo(p.x + nx * hw * 1.05, p.y + ny * hw);
        g.closePath(); g.fillPath();
      }
      /* ASKERİ TEÇHİZAT — plaka taşıyıcı yelek (kutu formu), göğüste şarjör
         cepleri, sırtta telsizli çanta + kırbaç anten. Siluetten "düzenli ordu"
         okunur: başlıklı/maskeli düzensiz adam değil. */
      if (this.variant === 'soldier') {
        const P2 = (t, side) => ({ x: p.x + dx * t + nx * side, y: p.y + dy * t + ny * side });
        const vest = [P2(0.32, -sw * 1.18), P2(0.32, sw * 1.12), P2(0.92, sw * 1.12), P2(0.95, -sw * 1.05)];
        g.beginPath(); g.moveTo(vest[0].x, vest[0].y);
        for (let i = 1; i < 4; i++) g.lineTo(vest[i].x, vest[i].y);
        g.closePath(); g.fillPath();
        // göğüs şarjör cepleri (bakış yönünde dışa taşar)
        for (let i = 0; i < 3; i++) {
          const t0 = 0.42 + i * 0.13;
          const fx2 = p.x + dx * t0 + f * (A.shW * 1.18), fy2 = p.y + dy * t0;
          g.fillRoundedRect(Math.min(fx2, fx2 + f * 3.4 * s) - 0.2 * s, fy2 - 2.6 * s, 3.8 * s, 5.4 * s, 1 * s);
        }
        // bel kemeri + yan çanta
        const belt = P2(0.12, 0);
        g.fillRect(belt.x - hw * 1.1, belt.y - 2 * s, hw * 2.2, 4 * s);
        g.fillRoundedRect(belt.x - f * hw * 1.2 - 3 * s, belt.y - 1 * s, 6 * s, 8 * s, 1.5 * s);
        // sırt çantası + telsiz
        const bx = p.x + dx * 0.62 - f * (A.shW * 1.35), by = p.y + dy * 0.62;
        g.fillRoundedRect(bx - 5.5 * s, by - 10 * s, 11 * s, 19 * s, 3 * s);
        // kırbaç anten — yürürken hafif salınır
        const sway = Math.sin(this.breathe * 3.1) * 2.2 * s + clamp(-this.vx * 0.02, -5, 5) * s;
        g.lineStyle(1.1 * s, col, 1);
        g.beginPath();
        g.moveTo(bx - f * 2.5 * s, by - 9 * s);
        g.lineTo(bx - f * 4 * s + sway * 0.4, by - 24 * s);
        g.lineTo(bx - f * 6 * s + sway, by - 38 * s);
        g.strokePath();
      }
    }

    /* ---- boyun + kafa ---- */
    {
      const n = J.neck, h = J.head;
      // iri yapıda kalın boyun + trapez kası
      seg(n, { x: lerp(n.x, h.x, 0.55), y: lerp(n.y, h.y, 0.55) }, (bulky ? 5.2 : 3.4) * s, (bulky ? 4.2 : 3.0) * s);
      if (bulky) {
        g.fillStyle(col, 1);
        g.beginPath();
        g.moveTo(n.x - A.shW * 0.9, n.y + 1 * s);
        g.lineTo(n.x, n.y - 6.5 * s);
        g.lineTo(n.x + A.shW * 0.9, n.y + 1 * s);
        g.closePath(); g.fillPath();
      }
      g.fillStyle(col, 1);
      // kranyum
      g.fillCircle(h.x, h.y, A.headR);
      // çene — bakış yönünde hafif çıkıntı
      g.fillCircle(h.x + f * A.headR * 0.42, h.y + A.headR * 0.5, A.headR * 0.62);
      // saç
      if (fem) {
        // maria: uzun, dökülen saç — harekete ve rüzgâra tepki verir
        const sway = Math.sin(this.breathe * 1.8) * 2.4 * s;
        const drift = clamp(-this.vx * 0.026, -9, 9) * s;   // koşarken arkaya savrulur
        // dolgun taç — başı saran gür saç (yukarı ve geriye taşar)
        g.fillCircle(h.x - f * A.headR * 0.18, h.y - A.headR * 0.52, A.headR * 1.34);
        // ana saç kütlesi — bele kadar inen, daha GENİŞ ve UZUN akışkan şekil
        g.beginPath();
        g.moveTo(h.x + f * A.headR * 0.62, h.y - A.headR * 1.05);
        qTo(g, h.x + f * A.headR * 0.62, h.y - A.headR * 1.05,
          h.x - f * A.headR * 2.05, h.y - A.headR * 0.25,
          h.x - f * A.headR * 1.6 + drift * 0.5, h.y + A.headR * 1.9, 7);
        qTo(g, h.x - f * A.headR * 1.6 + drift * 0.5, h.y + A.headR * 1.9,
          h.x - f * A.headR * 2.1 + drift, h.y + A.headR * 3.8 + Math.abs(drift) * 0.2,
          h.x - f * A.headR * 1.25 + drift * 1.4 + sway * 0.5, h.y + A.headR * 5.2, 7);
        g.lineTo(h.x - f * A.headR * 0.05, h.y + A.headR * 1.7);
        g.closePath(); g.fillPath();
        // omuz önüne düşen gür tutam — göğüs hizasına kadar
        g.beginPath();
        g.moveTo(h.x + f * A.headR * 0.95, h.y + A.headR * 0.05);
        g.lineTo(h.x + f * A.headR * 0.95 + sway * 0.3, h.y + A.headR * 3.0);
        g.lineTo(h.x + f * A.headR * 0.55 + sway * 0.2, h.y + A.headR * 3.1);
        g.lineTo(h.x + f * A.headR * 0.12, h.y + A.headR * 0.8);
        g.closePath(); g.fillPath();
        // alın perçemi
        g.beginPath();
        g.moveTo(h.x + f * A.headR * 0.95, h.y - A.headR * 0.45);
        g.lineTo(h.x + f * A.headR * 0.68, h.y + A.headR * 0.45);
        g.lineTo(h.x + f * A.headR * 0.15, h.y - A.headR * 0.62);
        g.closePath(); g.fillPath();
      } else if (lurk) {
        // uzamış, hafif yana yatık kafatası — insan kafasına "neredeyse" benzer
        const tilt = Math.sin(this.breathe * 0.7) * 0.25 + 0.35;
        g.fillEllipse(h.x - f * A.headR * 0.2, h.y - A.headR * 0.9, A.headR * 1.7, A.headR * 3.0);
        g.fillCircle(h.x + f * A.headR * 0.5 * Math.cos(tilt), h.y + A.headR * 0.6, A.headR * 0.55);
      } else if (this.variant === 'soldier') {
        /* modern muharebe miğferi: yüksek kubbe, kulak kesimli kenar,
           önde gece görüş (NVG) bağlantısı, yanda ray çıkıntısı */
        const R = A.headR;
        g.beginPath();
        g.arc(h.x - f * R * 0.08, h.y - R * 0.2, R * 1.28, Math.PI, 0);
        g.lineTo(h.x - f * R * 0.08 + R * 1.28, h.y + R * 0.05);
        g.lineTo(h.x - f * R * 0.08 - R * 1.28, h.y + R * 0.05);
        g.closePath(); g.fillPath();
        // ense koruması (arkada aşağı iner), alın kesimi (önde yukarıda biter)
        g.fillRect(h.x - f * R * 1.36 - (f < 0 ? R * 0.5 : 0), h.y - R * 0.1, R * 0.5, R * 0.7);
        // NVG montajı
        g.fillRect(h.x + f * R * 0.7 - (f < 0 ? R * 0.55 : 0), h.y - R * 0.95, R * 0.55, R * 0.42);
        // yan ray
        g.fillRect(h.x - R * 0.7, h.y - R * 0.55, R * 1.4, R * 0.22);
        // gözlük bandı — soğuk ince yansıma
        g.fillStyle(0x3a4250, 0.85);
        g.fillRect(h.x + f * R * 0.35 - (f < 0 ? R * 0.75 : 0), h.y - R * 0.12, R * 0.75, R * 0.26);
        g.fillStyle(col, 1);
        // dizlik (iri siluet)
        g.fillCircle(J.kneeR.x + f * 1.5 * s, J.kneeR.y, 4.2 * s);
        g.fillCircle(J.kneeL.x + f * 1.5 * s, J.kneeL.y, 4.0 * s);
      } else {
        // kai: dağınık kısa saç
        g.fillCircle(h.x - f * A.headR * 0.2, h.y - A.headR * 0.5, A.headR * 0.92);
        g.beginPath();
        g.moveTo(h.x - f * A.headR * 1.0, h.y - A.headR * 0.3);
        g.lineTo(h.x - f * A.headR * 1.45, h.y + A.headR * 0.35);
        g.lineTo(h.x - f * A.headR * 0.5, h.y + A.headR * 0.25);
        g.closePath(); g.fillPath();
      }
    }

    /* ---- ön uzuvlar ---- */
    seg(J.pelvis, J.kneeR, thW, caW); legMuscles(J.pelvis, J.kneeR, J.footR);
    seg(J.kneeR, J.footR, caW, anW); foot(J.footR);
    seg(J.neck, J.elbR, uaW, faW); armMuscles(J.neck, J.elbR);
    seg(J.elbR, J.handR, faW, wrW);
    g.fillCircle(J.handR.x, J.handR.y, (fem ? 2.4 : 3.0) * s);
    if (lurk) this._fingers(g, J.elbR, J.handR, col);

    /* (karakterlerde parlayan göz yok — siluet okunurluğu kenar ışığıyla sağlanır) */
    /* kai: boyunda Maria'nın kırmızı atkısı (bölüm 1'de yerden alır) — dünyadaki tek renk,
       koşarken arkaya savrulur */
    if (this.variant === 'kai' && this.scarf && this.mode !== 'ragdoll') {
      const n = J.neck;
      const drift = clamp(-this.vx * 0.03, -10, 10) * s;
      const flap = Math.sin(this.breathe * (Math.abs(this.vx) > 60 ? 13 : 3)) * (1.5 + Math.abs(drift) * 0.25) * s;
      g.fillStyle(0x6e2b2b, 0.95);
      g.fillEllipse(n.x, n.y + 0.5 * s, A.shW * 1.5, 4.2 * s);
      g.beginPath();
      g.moveTo(n.x - f * 2 * s, n.y);
      g.lineTo(n.x - f * 8 * s + drift * 0.6, n.y + 6 * s + flap * 0.5);
      g.lineTo(n.x - f * 13 * s + drift, n.y + 9 * s + flap);
      g.lineTo(n.x - f * 11 * s + drift, n.y + 12 * s + flap);
      g.lineTo(n.x - f * 4 * s + drift * 0.4, n.y + 5 * s);
      g.closePath(); g.fillPath();
    }

    /* ---- hacim ışığı: üst-arka kenarlara soluk form aydınlığı (3B hissi) ---- */
    if (this.mode !== 'ragdoll') {
      const hi = 0x2e313e, hiA = 0.34;
      const edge = (a, b, w) => {
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = Math.hypot(dx, dy) || 0.001;
        const ox = (dy / dd) * w * 0.32, oy = (-dx / dd) * w * 0.32;  // üst kenara kaydır
        g.lineStyle(Math.max(1, w * 0.3), hi, hiA);
        g.beginPath(); g.moveTo(a.x + ox, a.y + oy); g.lineTo(b.x + ox, b.y + oy); g.strokePath();
      };
      // ön bacak uyluk + baldır, ön kol, gövde sırt hattı, kafa tepesi
      edge(J.pelvis, J.kneeR, thW); edge(J.kneeR, J.footR, caW);
      edge(J.neck, J.elbR, uaW);
      edge(J.pelvis, J.neck, A.shW * 1.4);
      g.lineStyle(1.4 * s, hi, hiA * 0.9);
      g.beginPath();
      g.arc(J.head.x, J.head.y, A.headR * 0.82, Math.PI * 1.05, Math.PI * 1.75);
      g.strokePath();
    }

    if (this.mode === 'ragdoll') return;

    /* ---- elde taşınanlar ---- */
    if (this.holdItem === 'crowbar') {
      const h = J.handR;
      g.lineStyle(3.4 * s, col, 1);
      g.beginPath(); g.moveTo(h.x - f * 4 * s, h.y + 13 * s); g.lineTo(h.x + f * 6 * s, h.y - 9 * s); g.strokePath();
      g.beginPath(); g.moveTo(h.x + f * 6 * s, h.y - 9 * s); g.lineTo(h.x + f * 10 * s, h.y - 12 * s); g.strokePath();
    }
    if (this.holdItem === 'pistol') {
      const h = J.handR;
      const aa = this.aimMode ? this.aimAngle : 0.5; // nişansızken namlu aşağı
      const ca = Math.cos(aa) * f, sa = Math.sin(aa);
      g.fillStyle(col, 1);
      // kabza + gövde
      g.save();
      g.beginPath();
      g.moveTo(h.x - ca * 2 * s, h.y - 6 * s * 0);
      g.fillRect(h.x - f * 2 * s, h.y - 2 * s, f * 4 * s, 7 * s);
      g.fillPath();
      g.restore();
      // namlu
      g.lineStyle(4.2 * s, col, 1);
      g.beginPath();
      g.moveTo(h.x, h.y - 1.5 * s);
      g.lineTo(h.x + ca * 13 * s, h.y - 1.5 * s + sa * 13 * s);
      g.strokePath();
      // namlu ağzı parlaması
      if (this.recoilT > 0.12) {
        g.fillStyle(0xfff2d8, (this.recoilT - 0.12) * 4);
        const mx = h.x + ca * 17 * s, my = h.y - 1.5 * s + sa * 17 * s;
        g.fillCircle(mx, my, 6 * s);
        g.fillTriangle(mx, my - 3 * s, mx, my + 3 * s, mx + ca * 12 * s, my + sa * 12 * s);
      }
    }
    if (this.flashOn) {
      /* sol elde fener — gövde ileri bakar, hafif aşağı eğik; ışık TAM merceğinden çıkar */
      const h = J.handL;
      const ang = this.flashAngle ?? 0.06;
      const ca = Math.cos(ang) * f, sa = Math.sin(ang);
      const nx = -sa, ny = ca * f;                     // gövdeye dik birim (ekran)
      const p = (along, side) => ({ x: h.x + ca * along * s + nx * side * s * f, y: h.y + sa * along * s + ny * side * s * f });
      const q = [p(-3, -1.8), p(7, -1.8), p(7.5, -2.8), p(11, -2.8), p(11, 2.8), p(7.5, 2.8), p(7, 1.8), p(-3, 1.8)];
      g.fillStyle(col, 1);
      g.beginPath(); g.moveTo(q[0].x, q[0].y);
      for (let i = 1; i < q.length; i++) g.lineTo(q[i].x, q[i].y);
      g.closePath(); g.fillPath();
      const lens = p(11.3, 0);
      g.fillStyle(0xfff4dc, 0.95);
      g.fillCircle(lens.x, lens.y, 2.3 * s);
      this.flashPoint = { x: lens.x, y: lens.y, angle: ang };
    } else this.flashPoint = null;

  }
}

/* ============================================================
   ASKER RIG — tüfek gerçek tutuşla: dipçik omuz cebinde, sağ el
   kabzada, sol el ön tutamakta. Devriyede "alçak hazır" (namlu
   aşağı), alarmda nişan. Tüfekte taktik fener — ışık namludan çıkar.
   ============================================================ */
class SoldierRig extends HumanRig {
  constructor(scene, opts = {}) {
    super(scene, Object.assign({ variant: 'soldier', rimColor: 0x7d8696 }, opts));
    this.aimAngle = 0;
    this.ready = 0;            // 0 alçak hazır .. 1 nişan
    this.readyTarget = 0;
    this.hasCarKey = false;    // bilekte araba anahtarı — yankesicilik hedefi
    this.muzzle = null;        // { x, y, angle } — taktik fener / mermi çıkışı
  }
  draw() {
    if (this.mode === 'ragdoll' || this.mode === 'pose' || this.action) { this.muzzle = null; return super.draw(); }
    const keep = this.holdItem; this.holdItem = null;
    super.draw();
    this.holdItem = keep;
    const J = this.joints, A = this.A, f = this.facing, s = this.s;
    if (!J.neck) return;
    this.ready = lerp(this.ready, this.readyTarget, 1 - Math.exp(-(this._dt || 0.016) * 7));
    const rd = this.ready;
    /* namlu açısı: alçak hazırda ~32° aşağı, nişanda hedefe */
    const ang = lerp(0.56, clamp(this.aimAngle, -0.5, 0.5), rd);
    const ca = Math.cos(ang) * f, sa = Math.sin(ang);
    const px = -sa * f, py = Math.cos(ang);             // namluya dik (aşağı yön +)
    const butt = {
      x: J.neck.x + f * lerp(1.5 * s, A.shW * 0.55, rd),
      y: J.neck.y + lerp(9, 4, rd) * s,
    };
    const at = (u, v = 0) => ({ x: butt.x + ca * u * s + px * v * s, y: butt.y + sa * u * s + py * v * s });
    const grip = at(9.5, 3.2), fore = at(23, 2.2);
    const shL = { x: J.neck.x - A.shW * 0.42 * f, y: J.neck.y + 1 };
    const shR = { x: J.neck.x + A.shW * 0.42 * f, y: J.neck.y + 1 };
    const armR = solveIK2(shR.x, shR.y, grip.x, grip.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    const armL = solveIK2(shL.x, shL.y, fore.x, fore.y, A.armUp, A.armLo, f > 0 ? 1 : -1);
    J.elbL = { x: armL.jx, y: armL.jy }; J.handL = { x: armL.ex, y: armL.ey };
    J.elbR = { x: armR.jx, y: armR.jy }; J.handR = { x: armR.ex, y: armR.ey };
    /* nişanda baş namluya doğru eğilir (yanak dipçikte) */
    if (rd > 0.3) { J.head.x += f * 1.6 * rd * s; J.head.y += 1.4 * rd * s; }
    this.gfx.clear();
    this._noBlend = true;            // karışım ilk render'da uygulandı; ikinci kez uygulama
    this.render(J, 0);
    this._noBlend = false;
    this.drawRifle(at, ang);
    if (this.hasCarKey) {
      const g = this.gfx, h = J.handR;
      const t = this.scene.time.now * 0.004;
      g.fillStyle(0xd8d2b8, 0.5 + Math.sin(t) * 0.3);
      g.fillCircle(h.x - f * 3 * s, h.y + 3 * s, 2);
    }
  }
  drawRifle(at, ang) {
    const g = this.gfx, col = this.color, s = this.s;
    const poly = (pts) => {
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.closePath(); g.fillPath();
    };
    g.fillStyle(col, 1);
    poly([at(-2, -1.6), at(8, -1.6), at(8, 1.0), at(2, 3.6), at(-2, 3.6)]);   // dipçik
    poly([at(7, -2.2), at(21, -2.2), at(21, 2.0), at(7, 2.0)]);               // gövde
    poly([at(11, 1.5), at(13.5, 1.5), at(12.5, 5.5), at(10.5, 5.2)]);         // kabza
    poly([at(15, 1.8), at(18.5, 1.8), at(19.5, 8.2), at(16.5, 8.6)]);         // şarjör
    poly([at(21, -1.7), at(31, -1.7), at(31, 1.7), at(21, 1.7)]);             // el kundağı
    poly([at(31, -0.7), at(39, -0.7), at(39, 0.7), at(31, 0.7)]);             // namlu
    poly([at(39, -1.1), at(41.5, -1.1), at(41.5, 1.1), at(39, 1.1)]);         // susturucu ağzı
    poly([at(12, -2.2), at(18, -2.2), at(17.5, -4.6), at(12.5, -4.6)]);       // nişangâh
    poly([at(26, 1.6), at(30, 1.6), at(30, 3.6), at(26, 3.6)]);               // taktik fener
    const lens = at(30.3, 2.6);
    g.fillStyle(0xeef0f4, this.lightOn === false ? 0.15 : 0.9);
    g.fillCircle(lens.x, lens.y, 1.3 * s);
    if (this.recoilT > 0.1) {
      const m = at(43, 0);
      g.fillStyle(0xfff2d8, (this.recoilT - 0.1) * 5);
      g.fillCircle(m.x, m.y, 4.5 * s);
    }
    this.muzzle = { x: at(41.5, 0).x, y: at(41.5, 0).y, lx: lens.x, ly: lens.y, angle: ang };
  }
}
