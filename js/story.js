/* ============================================================
   SHADOW FALL — HİKÂYE
   Kai ve Maria ormanda yürürken deprem olur, yer yarılır ve Maria
   açılan yarığa düşer. Kai onu kurtarmak için peşinden atlar.
   Gözünü açtığında Maria yoktur.
   --------------------------------------------------------
   Anlatım kuralı: hikâye yalnız GİRİŞTE ve SON BÖLÜMDE anlatılır.
   Aradaki 98 bölümde altyazı / konuşma yok — sadece oyun öğreticisi.
   ============================================================ */
'use strict';

/* bölüm içi hikâye satırları kaldırıldı — tablo boş kalıyor ki eski
   çağrılar (BEATS[n]) hata vermesin */
const BEATS = {};

/* ---- perde isimleri (bölüm kartı + bölüm seçimi) ---- */
const ACT_NAMES = [
  null,
  ['ORMAN', 'YARIĞIN DİBİ'],
  ['KÜL YOLU', 'İZLER'],
  ['BATAKLIK', 'SESSİZ SU'],
  ['MADEN', 'ZİFİR'],
  ['FABRİKA', 'DEMİR UYKUSU'],
  ['NEHİR', 'AKINTIYA KARŞI'],
  ['ÖLÜ ŞEHİR', 'KÜL VE CAM'],
  ['KALE', 'TAŞ VE DEMİR'],
  ['SİS KULESİ', 'YÜKSELİŞ'],
  ['GEÇİT', 'ŞAFAK'],
];

/* ---- boss isimleri (perde finalleri) ---- */
const BOSS_NAMES = {
  10: 'KÖK CANAVARI', 20: 'BARİKAT', 30: 'BATAKLIK SÜRÜSÜ', 40: 'KÖR SÜRÜNGEN',
  50: 'PRES BEKÇİLERİ', 60: 'NEHİR ALFASI', 70: 'KÜL PUSUSU', 80: 'KALE MUHAFIZI',
  90: 'SESSİZ DEV', 100: 'GEÇİT BEKÇİSİ',
};

/* kontrol ipuçları — dokunmatikte jest, klavyede tuş anlatır */
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
function UI_HINT(k) {
  const T = {
    move:   ['Parmağını sağa-sola kaydır: yürü. Daha uzağa kaydır: koş.', '[A/D] yürü — [Shift] basılı: koş.'],
    jump:   ['Yukarı fırlat: zıpla.', '[W] veya [Boşluk] zıpla.'],
    crouch: ['Aşağı kaydır: eğil. Koşarken aşağı kaydır: kay.', '[S] eğil. Koşarken [S]: kay.'],
    act:    ['Eşyaya dokun: al / kullan.', '[E] al / kullan.'],
    push:   ['Kutunun üstüne basılı tut ve kaydır: it / çek.', 'Kutuya yürü: it. [E] basılı tut: tutup çek.'],
    flash:  ['Feneri açıp kapatmak için karaktere dokun.', '[F] el feneri. Pil biterse [E] ile yenisini tak.'],
    fire:   ['Düşmana dokun: ateş. Şarjör bitince kendiliğinden değişir.', '[X] ateş — [R] şarjör değiştir.'],
    heal:   ['Sol üstteki bandaja dokun: yaranı sar.', '[Q] bandaj sar.'],
    ledge:  ['Kenara atla: tutunursun. Yukarı fırlat: tırman. Aşağı: bırak.', 'Kenara atla: tutunursun. [W] tırman — [S] bırak.'],
    edge:   ['Yürürken uçurum kenarında durursun. Geçmek için zıpla.', 'Yürürken uçurum kenarında durursun. Geçmek için [W].'],
    stealth:['Eğil, siperin arkasında kal, ışıkta durma. Koşmak ses çıkarır.', '[S] eğil, siperin arkasında kal, ışıkta durma. Koşmak ses çıkarır.'],
    dark:   ['Fenersiz göremezsin — ama fener açıkken düşmanlar da seni görür.', 'Fenersiz göremezsin — ama fener açıkken [F] düşmanlar da seni görür.'],
  };
  return (T[k] ?? ['', ''])[IS_TOUCH ? 0 : 1];
}

/* ---- ölüm ekranı: yazı yok, sadece tuşlar ---- */
const DEATH_LINES = [''];

/* ---- oyun sonu jenerik satırları (yalnız final) ---- */
const ENDING_LINES = [
  'Işık ikimizi de aldı.',
  'Gözümü ormanda, yarığın kenarında açtım. Sabah olmuştu.',
  'Maria yanımdaydı. Nefes alıyordu.',
  '"Kai" dedi. "Peşimden atladın."',
  '"Atladım" dedim. "Yine atlarım."',
  'Yarık yoktu. Sadece yaprak ve toprak.',
  '— SON —',
];
