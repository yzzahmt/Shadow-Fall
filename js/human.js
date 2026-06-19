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

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

class HumanRig {
  /** opts: { scale, color, variant: 'kai'|'maria'|'soldier', depth } */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.s = opts.scale ?? 1;
    this.color = opts.color ?? 0x0b0b10;
    this.variant = opts.variant ?? 'kai';
    this.gfx = scene.add.graphics().setDepth(opts.depth ?? 100);

    const s = this.s;
    const fem = this.variant === 'maria';
    /* gerçek insan oranları — bacaklar pelvis yüksekliğine ulaşır,
       ayaklar gerçekten yere basar (eski rig'de bacaklar kısaydı) */
    this.A = fem ? {
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
  _stepAmp(speed) {
    const rf = clamp(speed / 220, 0, 1);
    const base = this.mode === 'crawl' ? (5 + rf * 3) : (8 + rf * 9);
    return base * this.s;
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
    } else if (this.grounded && speed > 6 && this.mode !== 'pry' && !this.action) {
      /* fazı GİDİLEN MESAFEYE bağla: gövde bir adım (2×genlik) yol alınca faz π ilerler.
         Böylece basan ayak yere KİLİTLİ kalır — geriye kayma / moonwalk olmaz.
         (Eski strideRate modeli adımı gerçek hızla eşleştirmiyordu, ayak geriye kayıyordu.) */
      const ampW = this._stepAmp(speed);
      this.phase += (speed * dt) * Math.PI / (2 * ampW);
      const stepHalf = Math.floor(this.phase / Math.PI);
      if (stepHalf !== this._lastStepLeg) {
        this._lastStepLeg = stepHalf;
        if (this.stepCallback) this.stepCallback(Math.min(1, speed / 200));
      }
    } else if (this.grounded) {
      const target = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = lerp(this.phase, target, 1 - Math.exp(-dt * 8));
    }
    if (this.mode === 'pry') this.pryAnim += dt;

    this.draw();
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
    if (this.mode === 'swim') return this.drawSwim();
    if (this.mode === 'climb') return this.drawClimb();
    this.drawStanding();
  }

  /* ============ AYAKTA / KOŞU / HAVA ============
     İnsan biyomekaniği: basan ayak yerde kilitli kalır,
     kafa stabilize, koşuda dirsekler bükük, kalça salınımı
     (maria belirgin), yükselme/düşme ayrı hava pozları. */
  drawStanding() {
    const A = this.A, f = this.facing, J = this.joints;
    const fem = this.variant === 'maria';
    const speed = Math.abs(this.vx);
    const moving = speed > 6;
    const runF = clamp(speed / 220, 0, 1);
    const walkF = 1 - runF;

    let pelvisX = this.x, pelvisY = this.y;
    const crouch = this.crouchAmt;
    const gY = this.groundY;
    const ph = this.phase;

    /* dikey salınım: gerçek yürüyüşte pelvis TEK-DESTEK ortasında (bacak dik,
       |sin|=1) en yüksek, açılım/çift-destek anında (|sin|=0) en alçaktır */
    const bob = this.grounded && moving ? -Math.abs(Math.sin(ph)) * (1.1 + runF * 2.0) * this.s : 0;
    /* yürürken dizler hafif bükük dursun: kalçayı alçaltır, böylece ayaklar
       adım açılımı boyunca yere gerçekten ulaşır (kilitli düz bacak → havada kalma sorununu çözer) */
    const walkDip = (this.grounded && moving) ? (0.8 + runF * 2.6) * this.s : 0;
    /* DURUŞ CANLILIĞI — heykel/robot hissini kıran sürekli mikro-hareket:
       yavaş ağırlık aktarımı (sağ↔sol), nefesle göğüs/omuz yükselişi, başın hafif sürüklenmesi.
       Bu sinyaller aşağıda pelvis/omuz/baş/ele dağıtılır. */
    const idle = (!moving && this.grounded && this.mode !== 'pry' && !this.aimMode) ? 1 : 0;
    const breathC = Math.sin(this.breathe * 1.5);
    const sway = Math.sin(this.breathe * 0.45);
    const sway2 = Math.sin(this.breathe * 0.3 + 1.1);
    /* çok yavaş ağırlık aktarımı (sağ↔sol, ~20 sn periyot) ve başın ara sıra
       etrafa bakışı — durağan heykeli "bekleyen canlı"ya çevirir. */
    const wshift = Math.sin(this.breathe * 0.32);
    const look = Math.sin(this.breathe * 0.21 + 0.6);
    const breathOff = idle ? (breathC * 0.7 - 0.3) * this.s : 0;
    const idleShift = idle * (sway * 1.1 + wshift * 1.7) * this.s;    // belirgin ama yavaş ağırlık kayması
    /* maria: yürürken kalça salınımı (yumuşak yatay sürüklenme + rotasyon hissi) */
    /* maria SEKSİ YÜRÜYÜŞ — belirgin kalça salınımı (catwalk): pelvis yana
       daha çok süzülür, omuzlar karşı yöne yatar (aşağıda shX), adımlar
       merkez hattına yakın atılır (bacaklar çapraz) → zarif, dişil tempo. */
    const hipSway = (fem && this.grounded && moving) ? Math.sin(ph) * (3.4 * walkF + 1.5) * this.s : 0;
    pelvisX += hipSway * 0.75 + idleShift;
    /* topuk: maria'yı UZATIR — pelvis topuk yüksekliği kadar yükselir; ayak ucu/topuk
       (aşağıda foot.y -= hl) ile birlikte bacaklar düz kalır, "oturma" olmaz, boy uzar. */
    const heelLift = (fem && this.grounded) ? 7 * this.s : 0;
    /* yüklenen bacakta pelvis hafif çöker (ağırlık o tarafta) → cansız simetri kırılır */
    pelvisY += bob + walkDip + breathOff - heelLift + idle * Math.abs(wshift) * 0.8 * this.s + this.landImpact * 12 * this.s + crouch * 12 * this.s;  // sert inişte dizler çöker

    let lean = clamp(this.vx / 520, -0.42, 0.42) * (0.55 + runF * 0.45);
    if (!this.grounded) lean = clamp(this.vx / 800, -0.3, 0.3) + clamp(this.vy / 2400, -0.15, 0.25);
    if (this.mode === 'push') lean = f * 0.55;
    /* maria duruşu: hafif dik, göğüs önde */
    const postureCurve = fem ? -f * 0.06 : f * 0.02;

    const torsoLen = A.torso * (1 - crouch * 0.2) * (1 - this.landImpact * 0.22);   // iniş anında gövde de hafif çöker (squash)
    /* omuzlar nefesle yükselir ve ağırlık aktarımına ters yatar → canlı omurga eğrisi */
    const shX = pelvisX + Math.sin(lean + postureCurve) * torsoLen - hipSway * 0.5 - idle * sway * 0.9 * this.s;
    const shY = pelvisY - Math.cos(lean) * torsoLen - (idle ? Math.max(0, breathC) * 0.8 * this.s : 0);
    /* kafa stabilizasyonu: insan kafası gövde sallansa da düz kalır + duruşta hafif sürüklenir/başını oynatır */
    const headLean = lean * 0.55 + (this.hurtT > 0 ? Math.sin(this.breathe * 40) * 0.1 : 0) + idle * (sway2 * 0.045 + look * 0.05);
    const headX = shX + Math.sin(headLean) * (A.headR * 1.5) + f * A.headR * 0.26 + idle * (sway2 * 0.8 + look * 1.5) * this.s;
    const headY = shY - Math.cos(headLean) * (A.headR * 1.5) - A.headR * 0.45 - bob * 0.45;

    /* ---- bacaklar ---- */
    const stride = this._stepAmp(speed);          // update() ile birebir aynı → ayak kilitli
    const lift = (4 + runF * 12) * this.s;
    const legReach = (A.legUp + A.legLo) * 0.992;   // hemen hemen tam uzanım
    let footL, footR;
    if (!this.grounded) {
      if (this.vy < -40) {
        /* yükselme: ön diz çekik, arka bacak itişten uzanmış */
        const k = clamp(-this.vy / 700, 0, 1);
        footL = { x: pelvisX + f * (10 + k * 6) * this.s, y: pelvisY + A.legUp * (0.7 - k * 0.25) + A.legLo * 0.3 };
        footR = { x: pelvisX - f * (8 + k * 7) * this.s, y: pelvisY + (A.legUp + A.legLo) * (0.86 + k * 0.08) };
      } else {
        /* düşme: bacaklar inişe hazır, dizler yaylanmış */
        const k = clamp(this.vy / 800, 0, 1);
        footL = { x: pelvisX + f * 9 * this.s, y: pelvisY + (A.legUp + A.legLo) * (0.72 + k * 0.16) };
        footR = { x: pelvisX - f * 4 * this.s, y: pelvisY + (A.legUp + A.legLo) * (0.66 + k * 0.2) };
      }
    } else if (moving) {
      /* gerçekçi adım döngüsü:
         sin>0 → savruluş (yumuşak kalkış-iniş yayı, öne süpürme)
         sin<=0 → basma: ayak YERDE SABİT geriye süpürülür (kayma yok hissi) */
      /* kalça yüksekliğinde bacağın yere değebileceği max yatay açılım —
         adımı buna kilitle ki basan ayak HER ZAMAN yere bassın (havada kalma yok) */
      const hipH = gY - pelvisY;
      const maxHoriz = Math.sqrt(Math.max(1, legReach * legReach - hipH * hipH)) * 0.98;
      const legFoot = (p) => {
        const sn = Math.sin(p), cs = Math.cos(p);
        /* -cos: savruluşta ayak geri→ön (havada öne uzanır),
           basmada gövde ilerlerken ayak yerde ön→arka süpürülür (kayma yok) */
        const fx = pelvisX + clamp(-cs * stride * f, -maxHoriz, maxHoriz);
        if (sn > 0) {
          const arc = Math.sin(Math.min(Math.PI, sn * Math.PI));
          return { x: fx, y: gY - sn * lift * (0.7 + 0.3 * arc) };
        }
        return { x: fx, y: gY };
      };
      footL = legFoot(ph);
      footR = legFoot(ph + Math.PI);
    } else {
      /* duruş: ağırlık bir bacakta — destek bacağı pelvis altında dik,
         serbest bacak hafif önde gevşek (kontrapost) */
      footL = { x: pelvisX - f * 1.5 * this.s, y: gY };
      footR = { x: pelvisX + f * (fem ? 8.5 : 7) * this.s, y: gY - 0.5 };
      if (fem) { footR.x += f * 1.5 * this.s; }   // maria: bacak çapraz önde
    }

    /* maria topuklu: ayak bileği topuk yüksekliği kadar yerden kalkar (topuk yere değer) */
    if (fem && this.grounded) { const hl = 7 * this.s; footL.y -= hl; footR.y -= hl; }   // belirgin yüksek topuk

    /* diz İLERİ bakar (insan dizi bakış yönüne bükülür) — bendDir = -f */
    const legL = solveIK2(pelvisX - A.hipW * 0.4 * f, pelvisY, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? -1 : 1);
    const legR = solveIK2(pelvisX + A.hipW * 0.4 * f, pelvisY, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? -1 : 1);

    /* ============ KOLLAR — GERÇEK İNSAN HAREKETİ ============
       Doğal yürüyüş/koşuda kollar HEDEFE değil, omuzdan AÇIYLA salınır (FK):
       üst kol omuzdan öne-arkaya sallanır, dirsek doğal flekste bükülür,
       ön kol takip eder. Bacaklarla çapraz faz. Bu, "eli bir noktaya zorla
       koyan" IK'nın yarattığı robotik/yapışkan hissi tamamen kaldırır.
       Özel haller (nişan, itme, levye, havada, eşya tutma) yine IK ile. */
    const shoulderTwist = (this.grounded && moving) ? Math.cos(ph) * (1.5 + runF * 1.5) * this.s : 0;
    /* OMUZ HATTI EĞİLMESİ (torso roll): yürürken öne salınan kolun omzu hafif
       yükselir, diğeri çöker → omuz çizgisi adımla eğilir. Katı blok-gövde yerine
       omurganın canlı karşıt rotasyonu okunur (kalça↔omuz). */
    const shRoll = (this.grounded && moving) ? Math.sin(ph) * (0.9 + runF * 1.6) * this.s : 0;
    const shL = { x: shX - A.shW * 0.45 * f - shoulderTwist * f, y: shY + 1 + shRoll };
    const shR = { x: shX + A.shW * 0.45 * f + shoulderTwist * f, y: shY + 1 - shRoll };
    const armReach = A.armUp + A.armLo;
    const recoil = this.recoilT > 0 ? Math.sin(this.recoilT * 28) * this.recoilT * 9 : 0;
    const leanFwd = fem ? 0.18 : 0.13;                       // kol gövdeye göre hafif önde asılı
    const swingMag = moving ? (0.34 + runF * 0.46) : 0;      // yürüyüşte hoş salınım, koşuda geniş

    /* serbest salınan kol — omuz açısı + dirsek fleksiyonu (anatomik) */
    const fkArm = (sh, phase) => {
      const sw = Math.cos(phase);                            // +1 öne (bakış yönü) .. −1 arkaya
      const breatheSwing = idle ? Math.sin(this.breathe * 0.85) * 0.05 : 0;
      const upperAng = Math.PI / 2 - f * (leanFwd + sw * swingMag) + breatheSwing;
      // dirsek: temelde hafif bükük; koşuda ve kol öne gelirken daha çok bükülür
      let flex = (0.42 + runF * 0.95) + (moving ? Math.max(0, sw) * (0.12 + runF * 0.7) : 0);
      flex = clamp(flex, 0, 1.85);
      const ex = sh.x + Math.cos(upperAng) * A.armUp;
      const ey = sh.y + Math.sin(upperAng) * A.armUp;
      const foreAng = upperAng - f * flex;
      return { jx: ex, jy: ey, ex: ex + Math.cos(foreAng) * A.armLo, ey: ey + Math.sin(foreAng) * A.armLo };
    };

    /* hedef-tabanlı eller (yalnız özel hâller); null => FK ile salınır */
    let handL = null, handR = null;
    if (this.aimMode && this.holdItem === 'pistol') {
      const aa = this.aimAngle;
      const ax = Math.cos(aa) * f, ay = Math.sin(aa);
      handR = { x: shX + ax * armReach * 0.93 - f * recoil, y: shY + 4 * this.s + ay * armReach * 0.9 - recoil * 0.4 };
      handL = { x: shX + ax * armReach * 0.78 - f * recoil * 0.7, y: shY + 7 * this.s + ay * armReach * 0.78 };
    } else if (this.mode === 'push') {
      handL = { x: shX + f * armReach * 0.86, y: shY + 7 * this.s };
      handR = { x: shX + f * armReach * 0.92, y: shY + 13 * this.s };
    } else if (this.mode === 'pry') {
      const t = Math.min(1, this.pryAnim * 1.4);
      const press = Math.sin(Math.min(Math.PI, t * Math.PI));
      handL = { x: shX + f * (armReach * 0.55), y: shY + 4 * this.s + press * 16 * this.s };
      handR = { x: shX + f * (armReach * 0.62), y: shY + 8 * this.s + press * 16 * this.s };
    } else if (!this.grounded) {
      if (this.vy < -40) {
        handL = { x: shX - f * 12 * this.s, y: shY + armReach * 0.28 };
        handR = { x: shX + f * 14 * this.s, y: shY + armReach * 0.18 };
      } else {
        handL = { x: shX - f * 15 * this.s, y: shY + armReach * 0.42 };
        handR = { x: shX + f * 16 * this.s, y: shY + armReach * 0.38 };
      }
    }
    /* elde eşya / fener tek kolu hedefe kilitler (diğer kol serbest salınır) */
    if (!this.aimMode && this.mode !== 'push' && this.mode !== 'pry' && this.grounded) {
      if (this.holdItem === 'crowbar') handR = { x: shX + f * 9 * this.s, y: shY + armReach * 0.62 };
      else if (this.holdItem === 'pistol') handR = { x: shX + f * 8 * this.s, y: shY + armReach * 0.68 };
    }
    if (this.flashOn && this.grounded && this.mode !== 'push' && this.mode !== 'pry') {
      handL = { x: shX + f * 11 * this.s, y: shY + armReach * 0.5 };
    }
    /* maria duruşta bir el kalçada — zarif kontrapost */
    if (fem && !moving && this.grounded && !this.aimMode && this.mode !== 'push' && this.mode !== 'pry' && handL == null) {
      handL = { x: pelvisX - f * 4 * this.s, y: pelvisY - 2 * this.s };
    }
    /* DURUŞTA GEVŞEK ASİMETRİK KOLLAR — manken hissini kıran ana sinyal:
       kollar iki yanda donuk/simetrik asılı yerine, hafif bükük dinlenir; ön kol
       gövdenin biraz önünde, arka kol biraz geride, ikisi FARKLI nefes fazında
       salınır (biri öne-arkaya, diğeri kalkıp-iner) → ikiz manken kolları kırılır. */
    if (idle) {
      const brA = Math.sin(this.breathe * 0.85);
      const brB = Math.sin(this.breathe * 0.55 + 2.1);
      if (handR == null) handR = { x: shX + f * (5.0 + brA * 0.8) * this.s, y: shY + armReach * 0.79 + brA * 1.0 * this.s };
      if (handL == null) handL = { x: shX - f * (3.2 + brB * 0.5) * this.s, y: shY + armReach * 0.86 + brB * 0.8 * this.s };
    }

    /* çöz: hedef varsa IK (yumuşatmalı), yoksa doğal FK salınımı */
    const solveArm = (key, sh, hand, phase) => {
      if (hand) {
        if (!this.aimMode && this.mode !== 'push' && this.mode !== 'pry') hand = this._smoothHand(key, hand, sh.x, sh.y);
        return solveIK2(sh.x, sh.y, hand.x, hand.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
      }
      return fkArm(sh, phase);
    };
    const armL = solveArm('hL', shL, handL, ph + Math.PI);   // sol kol ↔ sağ bacak (çapraz)
    const armR = solveArm('hR', shR, handR, ph);

    this._setJoints(J, { x: pelvisX, y: pelvisY }, { x: shX, y: shY }, { x: headX, y: headY }, legL, legR, armL, armR);
    /* topuk-parmak yuvarlanışı: ayak öndeyken (basış) parmak yukarı,
       arkadayken (itiş) topuk yukarı — insan yürüyüşünün imzası */
    if (this.grounded && moving) {
      const roll = 0.5 + runF * 0.25;
      J.footL.ang = -Math.cos(ph) * roll;
      J.footR.ang = -Math.cos(ph + Math.PI) * roll;
    }
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

    const legL = solveIK2(pelvis.x - A.hipW * 0.4 * f, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? 1 : -1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.4 * f, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, f > 0 ? 1 : -1);
    const armL = solveIK2(neck.x - A.shW * 0.45 * f, neck.y + 1, handLT.x, handLT.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
    const armR = solveIK2(neck.x + A.shW * 0.45 * f, neck.y + 1, handRT.x, handRT.y, A.armUp, A.armLo, f > 0 ? -1 : 1);

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
    const legL = solveIK2(pelvis.x, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, f > 0 ? 1 : -1);
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
    const armL = solveIK2(neck.x - 2 * f, neck.y, handL.x, handL.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
    const armR = solveIK2(neck.x + 2 * f, neck.y, handR.x, handR.y, A.armUp, A.armLo, f > 0 ? 1 : -1);

    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, f * 0.8);
  }

  /* ============ TIRMANMA (merdiven) ============ */
  drawClimb() {
    const A = this.A, J = this.joints;
    const ph = this.phase;
    const lx = this.x;   // merdiven ekseni
    const pelvis = { x: lx - 6 * this.s, y: this.y };
    const neck = { x: lx - 3 * this.s, y: pelvis.y - A.torso * 0.97 };
    const head = { x: neck.x + 2 * this.s, y: neck.y - A.headR * 1.5 };
    // eller üstte değişimli
    const handL = { x: lx + 3 * this.s, y: neck.y - 14 * this.s - Math.max(0, Math.sin(ph)) * 13 * this.s };
    const handR = { x: lx + 3 * this.s, y: neck.y - 14 * this.s - Math.max(0, Math.sin(ph + Math.PI)) * 13 * this.s };
    // ayaklar basamakta değişimli
    const footL = { x: lx + 2 * this.s, y: pelvis.y + A.legUp + A.legLo * 0.62 - Math.max(0, Math.sin(ph)) * 15 * this.s };
    const footR = { x: lx + 2 * this.s, y: pelvis.y + A.legUp + A.legLo * 0.72 - Math.max(0, Math.sin(ph + Math.PI)) * 15 * this.s };
    const legL = solveIK2(pelvis.x, pelvis.y, footL.x, footL.y, A.legUp, A.legLo, -1);
    const legR = solveIK2(pelvis.x, pelvis.y, footR.x, footR.y, A.legUp, A.legLo, -1);
    const armL = solveIK2(neck.x, neck.y, handL.x, handL.y, A.armUp, A.armLo, 1);
    const armR = solveIK2(neck.x, neck.y, handR.x, handR.y, A.armUp, A.armLo, 1);
    this._setJoints(J, pelvis, neck, head, legL, legR, armL, armR);
    this.render(J, 0);
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
    const armL = solveIK2(neck.x - 1.5 * f, neck.y, handL.x, handL.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
    const armR = solveIK2(neck.x + 1.5 * f, neck.y, handR.x, handR.y, A.armUp, A.armLo, f > 0 ? -1 : 1);

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

    const legL = solveIK2(pelvis.x - A.hipW * 0.4 * f, pelvis.y, footLW.x, footLW.y, A.legUp, A.legLo, f > 0 ? 1 : -1);
    const legR = solveIK2(pelvis.x + A.hipW * 0.4 * f, pelvis.y, footRW.x, footRW.y, A.legUp, A.legLo, f > 0 ? 1 : -1);
    const armL = solveIK2(neck.x - A.shW * 0.4 * f, neck.y, handLW.x, handLW.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
    const armR = solveIK2(neck.x + A.shW * 0.4 * f, neck.y, handRW.x, handRW.y, A.armUp, A.armLo, f > 0 ? -1 : 1);

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
    const armR = solveIK2(neck.x, neck.y, handR.x, handR.y, A.armUp, A.armLo, f > 0 ? -1 : 1);
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

  /* ============ GERÇEK İNSAN SİLUET RENDERI ============ */
  render(J, lean) {
    const g = this.gfx, A = this.A, col = this.color, s = this.s, f = this.facing;
    const fem = this.variant === 'maria';

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
    const bulky = this.variant !== 'maria';
    const thW = (fem ? 10.2 : 11.4) * s, caW = (fem ? 6.2 : 7.2) * s, anW = (fem ? 3.3 : 4.3) * s;
    const uaW = (fem ? 4.8 : 6.8) * s, faW = (fem ? 3.7 : 5.4) * s, wrW = (fem ? 2.5 : 3.5) * s;

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
      // askeri yelek
      if (this.variant === 'soldier') {
        g.fillCircle(cx, cy, sw * 1.22);
        g.fillRect(cx - 5 * s, cy - 3 * s, 10 * s, 9 * s);
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
      } else if (this.variant === 'soldier') {
        // miğfer
        g.beginPath();
        g.arc(h.x, h.y - A.headR * 0.15, A.headR * 1.22, Math.PI, 0);
        g.lineTo(h.x + A.headR * 1.22, h.y + A.headR * 0.32);
        g.lineTo(h.x - A.headR * 1.22, h.y + A.headR * 0.32);
        g.closePath(); g.fillPath();
        g.fillRect(h.x - A.headR * 0.4 + f * A.headR * 0.7, h.y + A.headR * 0.1, A.headR * 0.8, A.headR * 0.35); // siperlik
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

    /* ---- Limbo imzası: soluk parlayan gözler (kai & maria) ---- */
    if (this.mode !== 'ragdoll' && this.variant !== 'soldier') {
      const h = J.head;
      const blink = Math.sin(this.breathe * 0.9 + 2) > 0.97 ? 0 : 1;
      g.fillStyle(0xd6d9d0, 0.85 * blink);
      g.fillCircle(h.x + f * A.headR * 0.5, h.y - A.headR * 0.08, 1.25 * s);
      g.fillCircle(h.x + f * A.headR * 0.05, h.y - A.headR * 0.12, 1.0 * s);
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
      // sol elde fener gövdesi
      const h = J.handL;
      g.fillStyle(col, 1);
      g.fillRect(h.x - f * 1 * s, h.y - 3 * s, f * 9 * s, 5 * s);
      g.fillStyle(0xf5eeda, 0.95);
      g.fillRect(h.x + f * 8 * s, h.y - 3.4 * s, f * 2.2 * s, 5.8 * s);
    }

    /* ---- asker tüfeği ---- */
    if (this.variant === 'soldier') {
      const hR = J.handR, hL = J.handL;
      g.lineStyle(3.6 * s, col, 1);
      const gx = (hR.x + hL.x) / 2, gy = (hR.y + hL.y) / 2 - 2;
      g.beginPath();
      g.moveTo(gx - f * 10 * s, gy + 5 * s);
      g.lineTo(gx + f * 22 * s, gy - 3 * s);
      g.strokePath();
      g.lineStyle(2.4 * s, col, 1);
      g.beginPath(); g.moveTo(gx - f * 4 * s, gy + 1); g.lineTo(gx - f * 6 * s, gy + 8 * s); g.strokePath();
      g.beginPath(); g.moveTo(gx + f * 4 * s, gy - 0.5); g.lineTo(gx + f * 3 * s, gy + 6 * s); g.strokePath(); // şarjör
    }
  }
}

/* asker rig'i — eller tüfekte sabit */
class SoldierRig extends HumanRig {
  constructor(scene, opts = {}) {
    super(scene, Object.assign({ variant: 'soldier' }, opts));
    this.aimAngle = 0;
    this.hasCarKey = false;   // bilekte araba anahtarı — yankesicilik hedefi
  }
  draw() {
    if (this.mode === 'ragdoll' || this.mode === 'pose' || this.action) return super.draw();
    const keep = this.holdItem; this.holdItem = null;
    super.draw();
    this.holdItem = keep;
    const J = this.joints, A = this.A, f = this.facing;
    if (!J.neck) return;
    const aimY = Math.sin(this.aimAngle) * 14;
    const gunX = J.neck.x + f * 13 * this.s, gunY = J.neck.y + 10 * this.s + aimY;
    const armL = solveIK2(J.neck.x - A.shW * 0.4 * f, J.neck.y, gunX + f * 7 * this.s, gunY - 2, A.armUp, A.armLo, f > 0 ? -1 : 1);
    const armR = solveIK2(J.neck.x + A.shW * 0.4 * f, J.neck.y, gunX - f * 3 * this.s, gunY + 2, A.armUp, A.armLo, f > 0 ? -1 : 1);
    J.elbL = { x: armL.jx, y: armL.jy }; J.handL = { x: armL.ex, y: armL.ey };
    J.elbR = { x: armR.jx, y: armR.jy }; J.handR = { x: armR.ex, y: armR.ey };
    this.gfx.clear();
    this.render(J, 0);
    // bilekteki araba anahtarı parıltısı
    if (this.hasCarKey) {
      const g = this.gfx, h = J.handR;
      const t = this.scene.time.now * 0.004;
      g.fillStyle(0xd8d2b8, 0.5 + Math.sin(t) * 0.3);
      g.fillCircle(h.x - f * 3 * this.s, h.y + 3 * this.s, 2);
    }
  }
}
