/* ============================================================
   SHADOW FALL — HİKÂYE
   Kai ve Maria ormanda yürürken deprem olur, yer yarılır ve Maria
   açılan yarığa düşer. Kai onu kurtarmak için peşinden atlar.
   Gözünü açtığında Maria yoktur.
   --------------------------------------------------------
   Anlatım kuralı: hikâye yalnız GİRİŞTE ve SON BÖLÜMDE, sözsüz anlatılır.
   Hiçbir yerde altyazı / konuşma yok — sadece kontrol ve bulmaca kartları.
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
    ledge:  ['Kenara atla: tutunursun. Havada bir daha yukarı fırlat: yakındaki kenara uzan. Yukarı: tırman, aşağı: bırak.', 'Kenara atla: tutunursun. Havada bir daha [W]: yakındaki kenara uzan. [W] tırman — [S] bırak.'],
    edge:   ['Yürürken uçurum kenarında durursun. Geçmek için zıpla.', 'Yürürken uçurum kenarında durursun. Geçmek için [W].'],
    stealth:['Eğil, siperin arkasında kal, ışıkta durma. Koşmak ses çıkarır.', '[S] eğil, siperin arkasında kal, ışıkta durma. Koşmak ses çıkarır.'],
    dark:   ['Fenersiz göremezsin — ama fener açıkken düşmanlar da seni görür.', 'Fenersiz göremezsin — ama fener açıkken [F] düşmanlar da seni görür.'],
    stairs: ['Merdivenin dibinde yukarı kaydır: çık. Üstten yürü: in.', 'Merdivenin dibinde [W]: çık. Üstten yürü: in.'],
    ladder: ['El merdiveninde yukarı-aşağı kaydır: tırman.', 'El merdiveninde [W] / [S]: tırman.'],
    wraith: ['Süzülen gölgeye kurşun işlemez. Feneri üstüne tut.', 'Süzülen gölgeye kurşun işlemez. Feneri [F] üstüne tut.'],
    crawler:['Kör sürüngen titreşimi duyar. Eğilerek, yavaşça geç.', 'Kör sürüngen titreşimi duyar. [S] eğilerek, yavaşça geç.'],
  };
  return (T[k] ?? ['', ''])[IS_TOUCH ? 0 : 1];
}

/* ---- ölüm ekranı: yazı yok, sadece tuşlar ---- */
const DEATH_LINES = [''];

/* ---- oyun sonu: konuşma / anlatım yok, yalnız kapanış ---- */
const ENDING_LINES = ['— SON —'];
