# Shadow Fall — Google Play release kit

## Build artefacts

| Item | Path |
|---|---|
| Signed release bundle | `release/ShadowFall-v1.0.0-release.aab` (not committed) |
| Application ID | `net.yazify.shadowfall` |
| Version | `1.0.0` (versionCode `1`) |
| Target / min SDK | 36 / 24 |
| App icon 512×512 | `assets/store/icon-512.png` |
| Feature graphic 1024×500 | `assets/store/feature-graphic-1024x500.png` |
| Phone screenshots 1920×1080 | `assets/store/screenshots/` |
| Privacy policy (host this page) | `docs/privacy-policy.html` → e.g. `https://www.yazify.net/shadowfall/privacy` |
| KVKK aydınlatma metni | `kvkk.txt` |

### Upload key

The upload keystore lives **outside the repository**:
`~/AndroidKeystores/ShadowFall/shadowfall-upload.jks` (+ `keystore.properties` with the passwords).
Back up both files somewhere safe. Enrol in **Play App Signing** when creating the app;
Google then holds the app-signing key and this file is only the upload key.

### Rebuilding

```bash
npm install
npm run android:sync          # builds www/ and copies it into android/
cd android && ./gradlew bundleRelease
```

`android/keystore.properties` must point at the keystore (copy it from the folder above).
The project uses Gradle 9.5 so it runs on the JDK bundled with current Android Studio.

## Store listing (Türkçe)

**Uygulama adı:** Shadow Fall

**Kısa açıklama (80):**
Karanlık bir yarığın dibinde, kaybolanı bulmak için bulmaca çöz ve hayatta kal.

**Tam açıklama:**
Bir akşam yürüyüşünde yer yarıldı. Maria karanlığa düştü — Kai peşinden atladı.

Shadow Fall; siyah-beyaz siluetlerle çizilmiş, atmosferik bir bulmaca-platform oyunudur.
100 bölüm boyunca ormandan maden ocaklarına, terk edilmiş fabrikalardan ölü bir şehre ve
sisli bir kuleye uzanan yolda tek bir ışığın var: elindeki fener.

• Her bölüm bir akıl oyunu: kanalın altından yüzüp suyu yükselt, birleşik kaplarda basıncı
  kullan, karşı ağırlıkla asansörü çalıştır, ışık gözünü feneriyle uyandır.
• İki katlı evler ve hastane, dökümhane, su arıtma tesisi gibi birkaç bölüm süren yapılar.
• Altı farklı yaratık: titreşimi duyan kör sürüngen, yalnız ışıktan korkan süzülen gölge,
  duvara toslayana kadar hücum eden koca ve dahası.
• Yıldırımla başlayıp ağaçtan çimene yayılan yangın, yükselen sular, çöken köprüler.
• Sahneye göre değişen müzik: keşif, gizlilik, kovalamaca, kaçış, bulmaca temaları.
• Joystick yok, tuş yok: tamamen dokunmatik hareketler.
• Reklam yok, internet gerekmez, kişisel veri toplanmaz.

**Kategori:** Oyun › Macera (alternatif: Bulmaca)
**İletişim e-postası:** yzz_software@hotmail.com
**Web sitesi:** https://www.yazify.net

## Store listing (English)

**Short description:** Solve puzzles and survive the dark at the bottom of a fissure to find who you lost.

**Full description:** The ground split open on an evening walk. Maria fell into the dark — Kai jumped after her.
Shadow Fall is an atmospheric black-and-white silhouette puzzle-platformer: 100 chapters, a flashlight,
physics puzzles (canals, communicating vessels, counterweights, light sensors), multi-chapter buildings,
six kinds of creatures, a spreading wildfire, adaptive music, gesture-only touch controls.
No ads, works offline, collects no personal data.

## Play Console answers

**Data safety:** "Does your app collect or share any of the required user data types?" → **No**.
Data is not encrypted in transit because none is transmitted. No account creation. No data deletion request needed (nothing collected).

**Ads:** No ads. **In-app purchases:** none.

**Content rating (IARC questionnaire):** Category *Game*. Violence: fantasy creatures, no blood or gore,
player can shoot creatures/soldiers with a pistol (stylised silhouettes); horror/fear themes: yes (dark,
tense atmosphere, sudden creature appearances). No sexual content, no gambling, no user interaction,
no location sharing, no digital purchases. Expected rating: PEGI 12 / USK 12 / ESRB Teen.

**Target audience:** 13+ (not designed for children).

**App access:** All functionality available without login.

**Government / financial / health features:** None.
