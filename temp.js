
/* ==================================================================
   SHADOW FALL — ARAF (v3.0)
   ------------------------------------------------------------------
   Tek dosyalık atmosferik aksiyon-platform / korku oyunu. Phaser 3.60.
   v3: gerçekçi fizik (düşüş ivmesi, tepe asılması, sarkaç fener,
   verlet atkı), gizlilik (fener söndürme + gürültü), TR/EN dil,
   6 düşman türü + karanlıkta parlayan gözler, 4 farklı boss
   (20/50/80/100), ışık ve sesle avlanan kör final boss, her 10
   bölümde hikâye, güçlü uzunluk/zorluk ölçekleme.
   ================================================================== */
'use strict';

/* ============================ FİZİK ============================ */

const PHYS = {
  GRAVITY: 2000,
  FALL_MULT: 1.42,          // düşüş, yükselişten hızlı (gerçekçi his)
  APEX_GRAV: 0.52,          // tepe noktasında kısa asılma
  APEX_VY: 110,
  JUMP_VY: -700,
  JUMP_CUT_VY: -200,
  MOVE_SPEED: 252,
  ACCEL_GROUND: 2800,
  DECEL_GROUND: 3400,
  ACCEL_AIR: 1350,
  DRAG_AIR: 230,
  WALL_SLIDE: 85,
  WALL_JUMP_VX: 360,
  WALL_JUMP_VY: -590,
  WALL_LOCK_MS: 140,
  COYOTE_MS: 110,
  BUFFER_MS: 140,
  MAX_FALL: 1150,
  LAND_RECOVER_MS: 130
};

const BAL = {
  MAX_HEARTS: 6,
  START_HEARTS: 3,
  BATT_MAX: 100,
  BATT_START: 85,
  BATT_DRAIN: 1.0,
  BATT_PICKUP: 50,
  IFRAMES_MS: 1000,
  SEARCH_MS: 700,
  LIGHT_R_MIN: 44,
  LIGHT_R_MAX: 138,
  LIGHT_R_OFF: 15,
  STEALTH_SIGHT: 0.32,      // fener kapalıyken görülme çarpanı
  FLARE_BURN_MS: 6500,
  FLARE_LIGHT_R: 150
};

/* aletler: yakın dövüş + ateşli + işaret fişeği */
const WEAPONS = {
  fist:    { kind:'melee', dmg:1, range:46, cd:400 },
  bat:     { kind:'melee', dmg:2, range:68, cd:440 },
  machete: { kind:'melee', dmg:3, range:62, cd:340 },
  pistol:  { kind:'gun', dmg:2, cd:280, speed:660, pellets:1, spread:0 },
  shotgun: { kind:'gun', dmg:2, cd:680, speed:580, pellets:3, spread:0.14 }
};

const COLORS = {
  VOID:0x08080D, DEEP:0x0F0F18, MID:0x161625, LIGHT:0x22223A,
  SIL:0x05050A, LANTERN:0xE8C97A, PALE:0xD4C4F0, BONE:0xBDB4A4,
  BLOOD:0xC23A4A, HOLLOW:0x0C0C16, SCARF:0x5A1E2A
};

window.SF_DEBUG = { noDamage:false, noDrain:false };

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function levelSeed(mode, n) {
  return ((mode === 'story' ? 0x9E3779B9 : 0x85EBCA6B) ^ Math.imul(n, 2654435761)) >>> 0;
}

/* ====================== DİL SİSTEMİ (TR/EN) ====================== */

const STR = {
tr: {
  menu_sub:'Araf’ta bir hikâye — taşıdıklarımız ve geri alacaklarımız',
  menu_continue:'DEVAM ET', menu_story:'HİKÂYE · 100 BÖLÜM', menu_action:'AKSİYON · 1000 BÖLÜM',
  menu_options:'AYARLAR', back:'GERİ', skip:'GEÇ ▸▸',
  panel_story:'HİKÂYE', panel_action:'AKSİYON',
  levels_sub_story:'MİRA’YA GİDEN 100 BÖLÜM', levels_sub_action:'ARAF’IN 1000 ARENASI',
  unlocked:'AÇILAN', page:'SAYFA',
  opt_title:'AYARLAR', opt_lang:'DİL / LANGUAGE', opt_master:'ANA SES', opt_music:'MÜZİK / AMBİYANS',
  opt_sfx:'SES EFEKTLERİ', opt_haptics:'TİTREŞİM', opt_reduced:'AZALTILMIŞ HAREKET',
  opt_erase:'TÜM İLERLEMEYİ SİL', opt_erase_confirm:'SİLMEK İÇİN TEKRAR DOKUN',
  pause_title:'DURAKLATILDI', pause_resume:'DEVAM', pause_restart:'BÖLÜMÜ YENİDEN BAŞLAT', pause_menu:'ANA MENÜ',
  kb_hint:'←/→ hareket · Boşluk zıpla · J saldır & ara · F fener · Q fişek · Esc duraklat',
  mode_story:'HİKÂYE', mode_action:'AKSİYON', level:'BÖLÜM',
  w_fist:'YUMRUK', w_bat:'SOPA', w_machete:'PALA', w_pistol:'TABANCA', w_shotgun:'POMPALI',
  t_level_done:'BÖLÜM {n} TAMAMLANDI',
  t_found_bat:'🏏 SOPA BULDUN', t_found_machete:'🔪 PALA BULDUN',
  t_found_pistol:'🔫 TABANCA BULDUN · 12 MERMİ', t_found_shotgun:'💥 POMPALI BULDUN · 8 FİŞEK',
  t_ammo:'MERMİ +{n}', t_batt:'PİL BULDUN', t_heart:'KALP BULDUN', t_medkit:'SARGI BEZİ · +2 KALP',
  t_flare:'🧨 İŞARET FİŞEĞİ +{n}', t_ink:'MÜREKKEP! IŞIĞIN ZAYIFLIYOR',
  t_boss_fell:'BEKÇİ DÜŞTÜ — YOL AÇILDI', t_story_done:'HİKÂYE TAMAMLANDI ♥',
  t_lantern_off:'FENER SÖNDÜ — GÖLGELERDESİN', t_lantern_on:'FENER YANDI',
  checkpoint_line:'Sıcak bir taş. Burada bir an durabilirim.',
  end:'SON', the_end_title:'SHADOW FALL',
  b20:'MEZAR BEKÇİSİ', b50:'KORO ANASI', b80:'KEMİK GOLEMİ', b100:'DERİNLERDEN GELEN',
  boss_warn_title:'BİR ŞEY YAKLAŞIYOR',
  boss_warn_20:'Toprağın altından nefes alıyor.',
  boss_warn_50:'Şarkıyı duyuyor musun? Sana sesleniyor.',
  boss_warn_80:'Kemikler... yürüyor.',
  boss_warn_100:'O kör. Ama IŞIĞI DUYAR, SESİ GÖRÜR. Fenerini söndür. Yavaş yürü.',
  aware_label:'FARKINDALIK',
  zone_names:['KÜL BAHÇELERİ','SOLUK ORMAN','KEMİK GEÇİDİ','ÇAN KULELERİ','BOĞULMUŞ YOL','SİS ÇUKURU','UNUTULANLAR','KEDER OVASI','SON EŞİK','DERİNLİK'],
  intro:[
    'Araf’ta zaman geçmez. Ama onunla her an geçerdi.',
    'Mira: “Ne olursa olsun, ışığı söndürme.”',
    'Önce sessizlik geldi. Sonra ayak sesleri.',
    'Silahlı adamlar. Araf’ta dirileri avladıklarını duymuştum—',
    'MIRA!',
    'Derinlerden gelen bir şey onu aldı. Ve ben... peşinden gideceğim.'
  ],
  finale:[
    'Derinlerden gelen şey... sustu.',
    'Mira: “Kai...?”',
    'Seni buldum.',
    'Mira: “Hiç şüphem olmadı ki.”',
    'Işık ikimizindi. Artık ne Araf ne dünya — neresi olursa olsun, birlikte.'
  ],
  beats:{
    10:['Fener bu gece daha ağır.','Sanki içinde bir şey hatırlıyor.','Mira’nın sesi hâlâ kulağımda: “Işığı söndürme.”'],
    20:['Toprak titriyor. Mezar Bekçisi yolu tutmuş.','Araf, ölülerini kıskançlıkla saklar.','Ama ben ölü değilim. ...Değil mi?'],
    30:['Yaratıklar artık benden kaçmıyor.','Duruyorlar. İzliyorlar. Öğreniyorlar.','Derine indikçe ışığım küçülüyor.'],
    40:['Bir duvara kazınmış: “Hepimiz birini arıyorduk.”','Altında yüzlerce isim, yüzlerce çentik.','Mira’nın adını yazmadım. O, bulunacak.'],
    50:['Koro Anası şarkı söylüyor — kayıpların sesleriyle.','Şarkının içinde Mira’nın sesini duydum.','Gerçek değil. Gerçek OLAMAZ. Yürü, Kai.'],
    60:['Bir rüya gördüm: su, soğuk, kayan eller.','Bu bir rüya değildi, değil mi?','Hatırlamak istemiyorum. Ama fener hatırlıyor.'],
    70:['Çanlar artık hiç susmuyor.','Kimse ölmediği hâlde çalıyorlar. Belki de... benim için.','Işık ve ses. Burada ikisi de ihanet eder.'],
    80:['Kemik Golemi — kayıp umutlardan örülmüş.','Artık hatırlıyorum. Bir yıl önce o nehirde boğulan bendim.','Mira beni bırakmadı. Kederi onu Araf’a taşıdı. Beni aramaya geldi.'],
    90:['Derinlerden Gelen, kederi toplar. En parlak keder — Mira’nınki.','O kör. Ama ışığı duyar, sesi görür.','Fenerimi söndüreceğim. Sessiz olacağım. Dayan, Mira. Geliyorum.']
  },
  pre100:['Söndür ışığını.','Sessiz ol.','O, ışığı duyar. Sesi görür.']
},
en: {
  menu_sub:'A story in Purgatory — what we carry, and what we take back',
  menu_continue:'CONTINUE', menu_story:'STORY · 100 LEVELS', menu_action:'ACTION · 1000 LEVELS',
  menu_options:'OPTIONS', back:'BACK', skip:'SKIP ▸▸',
  panel_story:'STORY', panel_action:'ACTION',
  levels_sub_story:'100 LEVELS TO MIRA', levels_sub_action:'1000 ARENAS OF PURGATORY',
  unlocked:'UNLOCKED', page:'PAGE',
  opt_title:'OPTIONS', opt_lang:'DİL / LANGUAGE', opt_master:'MASTER VOLUME', opt_music:'MUSIC / AMBIENCE',
  opt_sfx:'SOUND EFFECTS', opt_haptics:'HAPTICS', opt_reduced:'REDUCED MOTION',
  opt_erase:'ERASE ALL PROGRESS', opt_erase_confirm:'TAP AGAIN TO CONFIRM',
  pause_title:'PAUSED', pause_resume:'RESUME', pause_restart:'RESTART LEVEL', pause_menu:'MAIN MENU',
  kb_hint:'←/→ move · Space jump · J attack & search · F lantern · Q flare · Esc pause',
  mode_story:'STORY', mode_action:'ACTION', level:'LEVEL',
  w_fist:'FISTS', w_bat:'BAT', w_machete:'MACHETE', w_pistol:'PISTOL', w_shotgun:'SHOTGUN',
  t_level_done:'LEVEL {n} COMPLETE',
  t_found_bat:'🏏 FOUND A BAT', t_found_machete:'🔪 FOUND A MACHETE',
  t_found_pistol:'🔫 FOUND A PISTOL · 12 ROUNDS', t_found_shotgun:'💥 FOUND A SHOTGUN · 8 SHELLS',
  t_ammo:'AMMO +{n}', t_batt:'FOUND A BATTERY', t_heart:'FOUND A HEART', t_medkit:'BANDAGES · +2 HEARTS',
  t_flare:'🧨 FLARE +{n}', t_ink:'INK! YOUR LIGHT IS FAILING',
  t_boss_fell:'THE WARDEN FELL — THE WAY IS OPEN', t_story_done:'STORY COMPLETE ♥',
  t_lantern_off:'LANTERN OUT — YOU ARE IN SHADOW', t_lantern_on:'LANTERN LIT',
  checkpoint_line:'A warm stone. I can rest here, just a moment.',
  end:'THE END', the_end_title:'SHADOW FALL',
  b20:'THE GRAVEWARDEN', b50:'THE CHOIR MOTHER', b80:'THE BONE GOLEM', b100:'THE ONE FROM BELOW',
  boss_warn_title:'SOMETHING APPROACHES',
  boss_warn_20:'It breathes beneath the soil.',
  boss_warn_50:'Do you hear the song? It is calling you.',
  boss_warn_80:'The bones... are walking.',
  boss_warn_100:'It is blind. But it HEARS LIGHT and SEES SOUND. Douse your lantern. Walk slowly.',
  aware_label:'AWARENESS',
  zone_names:['ASH GARDENS','PALE FOREST','BONE PASS','BELL TOWERS','DROWNED ROAD','MIST HOLLOW','THE FORGOTTEN','GRIEF PLAINS','LAST THRESHOLD','THE DEEP'],
  intro:[
    'Time does not pass in Purgatory. But with her, every moment did.',
    'Mira: “Whatever happens — never put out the light.”',
    'First came the silence. Then the footsteps.',
    'Armed men. I had heard they hunt the living here—',
    'MIRA!',
    'Something from below took her. And I... I am going after it.'
  ],
  finale:[
    'The thing from below... went silent.',
    'Mira: “Kai...?”',
    'I found you.',
    'Mira: “I never doubted it.”',
    'The light was always ours. Purgatory or the world — wherever, together.'
  ],
  beats:{
    10:['The lantern is heavier tonight.','As if it remembers something inside.','Mira’s voice is still in my ear: “Never put out the light.”'],
    20:['The ground trembles. The Gravewarden holds the road.','Purgatory keeps its dead jealously.','But I am not dead. ...Am I?'],
    30:['The creatures no longer run from me.','They stop. They watch. They learn.','The deeper I go, the smaller my light.'],
    40:['Carved into a wall: “We were all looking for someone.”','Beneath it — hundreds of names, hundreds of notches.','I didn’t write Mira’s name. She will be found.'],
    50:['The Choir Mother sings — with the voices of the lost.','Inside the song I heard Mira’s voice.','It isn’t real. It CANNOT be real. Keep walking, Kai.'],
    60:['I dreamed: water, cold, slipping hands.','That wasn’t a dream, was it?','I don’t want to remember. But the lantern remembers.'],
    70:['The bells never stop anymore.','No one dies here, yet they toll. Perhaps... for me.','Light and sound. Down here, both betray you.'],
    80:['The Bone Golem — woven from abandoned hopes.','I remember now. It was me who drowned in that river, a year ago.','Mira never let go. Her grief carried her into Purgatory. She came looking for me.'],
    90:['The One From Below collects grief. The brightest grief — Mira’s.','It is blind. But it hears light, and it sees sound.','I will douse my lantern. I will be silent. Hold on, Mira. I am coming.']
  },
  pre100:['Douse your light.','Be silent.','It hears light. It sees sound.']
}
};

const I18N = {
  lang: 'tr',
  t(key, params) {
    let s = (STR[this.lang] && STR[this.lang][key]) || STR.tr[key] || key;
    if (params) for (const k in params) s = s.replace('{'+k+'}', params[k]);
    return s;
  },
  arr(key) { return (STR[this.lang] && STR[this.lang][key]) || STR.tr[key]; },
  beat(n) { return (STR[this.lang].beats || STR.tr.beats)[n]; },
  refreshStatic() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.getElementById('opt-lang').textContent = this.lang === 'tr' ? 'TÜRKÇE' : 'ENGLISH';
    document.getElementById('kb-hint').textContent = this.t('kb_hint');
    document.documentElement.lang = this.lang;
  }
};
const T = (k, p) => I18N.t(k, p);

/* ========================= KAYIT SİSTEMİ ========================== */

const SaveSystem = {
  KEY: 'shadowfall_araf_v2',
  data: null,
  defaults() {
    return {
      story:  { unlocked:1, introSeen:false, finished:false },
      action: { unlocked:1 },
      gear:   { melee:'fist', gun:'none', ammo:0, flares:0 },
      settings: { masterVolume:0.8, musicVolume:0.7, sfxVolume:1.0, haptics:true, reducedMotion:false, lang:'tr' }
    };
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const d = this.defaults(), p = JSON.parse(raw);
        this.data = Object.assign(d, p);
        this.data.story = Object.assign(d.story, p.story || {});
        this.data.action = Object.assign(d.action, p.action || {});
        this.data.gear = Object.assign(d.gear, p.gear || {});
        this.data.settings = Object.assign(d.settings, p.settings || {});
      } else this.data = this.defaults();
    } catch (e) { this.data = this.defaults(); }
    I18N.lang = this.data.settings.lang || 'tr';
    return this.data;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  erase() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    const lang = this.data.settings.lang;
    this.data = this.defaults();
    this.data.settings.lang = lang;
  },
  maxLevel(mode) { return mode === 'story' ? 100 : 1000; },
  unlocked(mode) { return this.data[mode].unlocked; },
  completeLevel(mode, n) {
    const max = this.maxLevel(mode);
    if (n >= this.data[mode].unlocked && n < max) this.data[mode].unlocked = n + 1;
    if (mode === 'story' && n === 100) this.data.story.finished = true;
    this.save();
  }
};
SaveSystem.load();

/* ============================ TİTREŞİM ============================ */

const Haptics = {
  buzz(p) {
    if (!SaveSystem.data.settings.haptics) return;
    if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} }
  },
  land()    { this.buzz(20); },
  pickup()  { this.buzz([10,40,10]); },
  hurt()    { this.buzz([20,30,20,30,20]); },
  death()   { this.buzz(110); },
  attack()  { this.buzz(12); },
  shoot()   { this.buzz([10,14]); },
  boss()    { this.buzz([60,40,60]); }
};
