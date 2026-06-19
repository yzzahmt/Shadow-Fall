/* ============================================================
   SHADOW FALL — HİKÂYE
   Kai ve Maria yolda yürürken bir anda kayboluyorlar. Araf'a
   düşüyorlar: yaşamla ölüm arası gri bir dünya. Buradaki
   "Solgunlar" (silahlı, yüzü silinmiş adamlar) Geçit'i açmak
   için yaşayan bir ruha ihtiyaç duyuyor. Maria yaşıyor; bu
   yüzden onu kaçırıyorlar. Kai onu kurtarmaya gidiyor.
   --------------------------------------------------------
   Anlatım: kısa, sade, olayı söyleyen cümleler. Şiir yok.
   BEATS[level] = { start:[satırlar], mid:[satırlar] }
   ============================================================ */
'use strict';

const BEATS = {
  1: {
    start: [`Yolda yürürken bir anda her şey değişti.`, `Gökyüzü gri, ortalık bomboş. Maria yanımda.`, `Maria: "Kai, neredeyiz biz?"`],
    mid: [`Geri dönüş yolu yok. Sadece ileri.`, `Maria: "Şu ağaçların arasında bir şey kımıldadı."`],
  },
  2: {
    start: [`Saatlerdir yürüyoruz, hava hiç aydınlanmıyor.`, `Bir şey bizi izliyor. Maria'yı korkutmamaya çalışıyorum.`],
    mid: [`Yakında kalalım. Birbirimizi kaybetmeyelim.`],
  },
  3: {
    start: [`Her ikimizin de saati aynı dakikada durmuş.`, `Burada zaman işlemiyor.`],
    mid: [`O şey yine yaklaştı. Çok bacaklıydı.`, `"Koş dersem koş" dedim.`],
  },
  5: {
    start: [`Burası ne ölülerin ne dirilerin yeri. Arada bir yer.`, `Maria: "Öldük mü biz?"`],
    mid: [`"Hayır. Kalbin atıyor. Yaşıyoruz." dedim.`],
  },
  6: {
    start: [`Bir kayanın arkasında ilk kez durup nefeslendik.`, `Uzaktan bir uluma geldi. İkimiz de donduk.`],
    mid: [`Dinlenmek yok. Yürümeye devam.`],
  },
  8: {
    start: [`Tepenin arkasında ateş ışığı var. Demek insanlar.`, `Maria sevindi. Ama bir terslik seziyorum.`],
    mid: [`Dikkatli yaklaşalım.`],
  },
  10: {
    start: [`Ateşe doğru gidiyoruz. Maria önde, mutlu.`, `Ateşin başındakiler hiç konuşmuyor. Hiç kımıldamıyor.`],
    mid: [`Bu insanlar normal değil.`],
  },
  11: {
    start: [`Maria'yı kaçırdılar. Gözümün önünde elimden aldılar.`, `Yere atkısı düştü. Onu bileğime bağladım.`, `İzler doğuya gidiyor. Peşlerinden gidiyorum.`],
    mid: [`Seni bulacağım Maria.`],
  },
  13: {
    start: [`Onlara "Solgun" diyorlar. Yüzleri silinmiş adamlar.`, `Yıllardır burada bekliyorlar.`],
    mid: [`Karanlıkta feneri kapat, seni göremezler.`],
  },
  15: {
    start: [`Konuştuklarını duydum: "Kız yaşıyor. Kapı onunla açılır."`, `Maria'yı bir kapıyı açmak için aldılar.`],
    mid: [`Onu bir kapıya feda ettirmem.`],
  },
  18: {
    start: [`Yolda ölü bir Solgun, elinde tabanca.`, `Hiç silah tutmadım ama tabancayı aldım.`],
    mid: [`Mermi az. Boşa harcama.`],
  },
  20: {
    start: [`Yolu barikatla kesmişler.`, `Komutan bağırdı: "Geri dön, kız artık bizim!"`, `Geri dönmüyorum.`],
    mid: [],
  },
  21: { start: [`Bataklık. Su kapkara ve durgun.`], mid: [`Su altında nefesin tükenir. Derinde kalma.`] },
  25: {
    start: [`Bir tekne enkazında günlük buldum:`, `"387. gün. Karım hâlâ kapının ardında. Vey bize yalan söyledi."`, `Vey. Bir isim çıktı ortaya.`],
    mid: [`Vey kim?`],
  },
  30: { start: [`Bataklığın bir bekçisi var. Köpeğe benziyor ama değil.`], mid: [] },
  31: { start: [`Sular çekilince altından batık bir köy çıktı.`, `Sofralar hâlâ kurulu.`], mid: [`Herkes yemeğin ortasında ortadan kaybolmuş.`] },
  35: {
    start: [`Bir evin duvarında çocuk çizimleri: güneş.`, `Buranın çocukları güneşi hiç görmemiş.`],
    mid: [`Yürümeye devam.`],
  },
  40: { start: [`Meydanda uzun, eğri bir gölge dolaşıyor. İnsan değil.`], mid: [] },
  41: { start: [`Maden girişi. İçerisi sıcak ve karanlık.`, `Fenerin piline dikkat et.`], mid: [`Buradaki karanlık çok yoğun.`] },
  45: {
    start: [`Madende insan boyunda kafesler var.`, `Birini taşımışlar.`, `Dayan Maria, geliyorum.`],
    mid: [`İzler derine iniyor.`],
  },
  50: { start: [`Madenin dibinde kör bir şey yaşıyor, sese geliyor.`, `Feneri kapat, sessiz geç.`], mid: [] },
  51: { start: [`Fabrika. Makineleri biri yeniden çalıştırmış.`], mid: [`Solgunlar burada silah yapıyor, savaşa hazırlanıyorlar.`] },
  55: {
    start: [`Bir telsizden ses geldi: "...kızı Kale'ye götürün..."`, `Maria, Kale'de. Kuzeydeki dağda.`],
    mid: [`Yön belli artık: kuzey.`],
  },
  60: { start: [`Fabrikanın presi hâlâ çalışıyor. Koruyanları var.`], mid: [] },
  61: { start: [`Nehir. Akıntıya karşı yüzmem gerek.`], mid: [`Yağmur başladı.`] },
  65: {
    start: [`Köprü yıkık. Karşıya tek yol şu eski araba.`, `Anahtar nöbetçinin bileğinde. Sessizce al.`],
    mid: [`Motoru çalıştırınca herkes duyar. Çalıştır ve hemen sür.`],
  },
  70: { start: [`Nehir bekçileri sürü hâlinde. En irisi başları.`], mid: [] },
  71: { start: [`Ölü bir şehir. Geriye sadece kül ve rüzgâr kalmış.`], mid: [`Mankenlere elbise giydirmişler.`] },
  75: {
    start: [`Bir sinema. Perde yarıda donmuş.`, `Burada hiçbir şey tamamlanmıyor.`],
    mid: [`Bu işi ben bitireceğim.`],
  },
  80: { start: [`Şehrin çıkışında pusu kurmuşlar. Kül fırtınası perde oluyor.`], mid: [] },
  81: { start: [`Uçurumlar. Rüzgâr çok sert, itiyor.`], mid: [`Rüzgâr kesilince atla.`] },
  85: {
    start: [`Yamaçta el ele donmuş iki kişi. Onlar da denemiş.`, `Biz başaracağız.`],
    mid: [],
  },
  90: { start: [`Zirvede bir şey fırtınanın içinde kıpırdamadan bekliyor.`], mid: [] },
  91: { start: [`KALE. Kocaman ve karanlık.`, `İçeride yüzlerce Solgun var. Maria da bir yerde.`], mid: [`Çok yaklaştım.`] },
  95: {
    start: [`Bir hücrenin duvarında kazınmış: "M + K — O GELECEK".`, `Maria birkaç saat önce buradaydı.`],
    mid: [`Dayan, geliyorum.`],
  },
  100: {
    start: [`Maria'yı camın ardında gördüm. Yaşıyor.`, `Yanında uzun, gri bir adam: Vey.`, `Bana baktı, gülümsedi ve onu götürdü.`],
    mid: [`Vey benimle konuşmak istiyormuş.`],
  },
  101: {
    start: [`Vey not bırakmış: "Ona zarar vermem. O bizim anahtarımız."`, `"Çölü geçemezsin." — Geçeceğim.`],
    mid: [`Kül çölü. Ufka kadar boşluk.`],
  },
  105: { start: [`Çölde eski tabelalar: "İSTANBUL 40".`, `Burası bizim dünyamızın gölgesi.`], mid: [] },
  110: { start: [`Kumun altında bir şey yüzüyor, dalıp çıkıyor.`], mid: [] },
  111: { start: [`Mahzenler. Duvarlar kemikten yapılmış.`], mid: [`Yukarı bakma, sadece yürü.`] },
  115: {
    start: [`Bir taşta yüzlerce isim: kapıya gönderilenler. Hepsi yaşayan insanlardı.`, `Maria'nın adı buraya yazılmayacak.`],
    mid: [`Vey'in karısı da burada: "LEYLA — geçemedi."`, `Demek Vey de denedi ve kaybetti.`],
  },
  120: { start: [`Mahzenin kraliçesi ağ örmüş. Ağın ortasında anahtar parlıyor.`], mid: [] },
  121: { start: [`Sis Kulesi. Basamaklar yukarı, göğe çıkıyor.`], mid: [`Her katta yarım kalmış bir hayat var.`] },
  125: {
    start: [`Kulenin ortasında dev bir sarkaç hâlâ sallanıyor.`, `Maria yukarıda. Vey yukarıda.`],
    mid: [],
  },
  130: { start: [`Kulenin tepesini sessiz bir dev koruyor.`], mid: [] },
  131: { start: [`Geçidin önü. Gökyüzünde bir yarık.`, `Solgunların hepsi burada toplanmış.`], mid: [`Artık benden korkuyorlar.`] },
  135: {
    start: [`Vey'le konuştum: "Onu seviyorsan bırak. Kapı ikinizi birden almaz."`, `"O zaman ben kalırım" dedim.`],
    mid: [`O gece adamlarını yolumdan çekti.`],
  },
  140: { start: [`Kapının önünde son bekçi duruyor. Vey bile durduramıyor.`], mid: [] },
  141: { start: [`GEÇİT. Kalp gibi atıyor. Maria orada, uyuyor gibi.`], mid: [`Son birkaç adım kaldı.`] },
  145: {
    start: [`Vey elinde Leyla'nın resmini tutuyordu.`, `"Bin yıl bekledim. Sen on beş günde geldin." dedi.`, `Kenara çekildi: "Git, onu al."`],
    mid: [],
  },
  150: {
    start: [`Geçit açılıyor. Bin yıl sonra ilk gerçek ışık.`, `Ama önümüzde son bir bekçi var.`, `Maria orada. Atkısı bileğimde. Çekil önümden.`],
    mid: [],
  },
};

/* ---- perde isimleri (bölüm kartı + bölüm seçimi) ---- */
const ACT_NAMES = [
  null,
  ['ORMAN', 'KAYBOLUŞ'],
  ['KÜL YOLU', 'İZLER'],
  ['BATAKLIK', 'SESSİZ SU'],
  ['BOĞULMUŞ KÖY', 'SOFRALAR KURULU'],
  ['MADEN', 'ZİFİR'],
  ['FABRİKA', 'DEMİR UYKUSU'],
  ['NEHİR', 'AKINTIYA KARŞI'],
  ['ÖLÜ ŞEHİR', 'KÜL VE CAM'],
  ['UÇURUMLAR', 'FIRTINA'],
  ['KALE', 'ONLARIN YUVASI'],
  ['KÜL ÇÖLÜ', 'HİÇLİK'],
  ['KEMİK MAHZENLERİ', 'AÇLIK'],
  ['SİS KULESİ', 'YÜKSELİŞ'],
  ['GEÇİDİN GÖLGESİ', 'SON YOL'],
  ['GEÇİT', 'ŞAFAK'],
];

/* ---- boss isimleri (perde finalleri) ---- */
const BOSS_NAMES = {
  10: 'İLK GÖLGE', 20: 'BARİKAT KOMUTANI', 30: 'BATAKLIK SÜRÜSÜ', 40: 'UZUN ADAM',
  50: 'KÖR SÜRÜNGEN', 60: 'PRES BEKÇİLERİ', 70: 'NEHİR ALFASI', 80: 'KÜL PUSUSU',
  90: 'FIRTINA ÇOBANI', 100: 'KALE MUHAFIZI', 110: 'KUM ANASI', 120: 'KEMİK KRALİÇESİ',
  130: 'SESSİZ DEV', 140: 'SON MUHAFIZ', 150: 'GEÇİT BEKÇİSİ',
};

/* ---- ölüm ekranı yazıları ---- */
const DEATH_LINES = [
  'karanlık seni aldı', 'daha değil...', 'Maria bekliyor. kalk.',
  'bir nefes daha', 'düşen, kalkmayı öğrenir',
  'onun sesi hâlâ kulağında', 'verdiğin sözü hatırla', 'pes etme. o orada.',
];

/* ---- bölüm sonu (150) jenerik satırları ---- */
const ENDING_LINES = [
  'Işık ikimizi de aldı.',
  'Gözümü ormanda açtım. Sabah olmuştu. Gerçek bir sabah.',
  'Maria yanımdaydı. Nefes alıyordu.',
  '"Kai" dedi. "Çok garip bir rüya gördüm."',
  '"Biliyorum" dedim. "Ben de oradaydım."',
  'Vey\'e ne oldu bilmiyorum.',
  'Ama kapanan kapıda iki gölge el ele yürüyordu.',
  '— SON —',
];
