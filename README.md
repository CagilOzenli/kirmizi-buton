# Kırmızı Buton — Kurulum Rehberi

Bu proje iki parçadan oluşuyor:
- `mobile-app/` — telefonda çalışan Expo (React Native) uygulaması
- `functions/` — biri butona basınca herkese bildirim yollayan Firebase backend'i

Toplam kurulum ~20-30 dakika sürer, ödeme gerekmez (Firebase ve Expo'nun ücretsiz katmanı bu iş için yeterli).

---

## 1. Gerekli araçlar

- [Node.js](https://nodejs.org) (LTS sürüm) kurulu olsun
- Telefonuna **Expo Go** uygulamasını indir (App Store / Play Store)
- Bir [Firebase](https://console.firebase.google.com) hesabı (Google hesabınla ücretsiz)

---

## 2. Firebase projesi oluştur

1. https://console.firebase.google.com → **Add project** → bir isim ver (ör. `kirmizi-buton`)
2. Sol menüden **Build > Firestore Database** → **Create database** → *production mode* seç, bölge olarak sana yakın birini seç
3. Firestore kuralları için Rules sekmesine git, aşağıdakini yapıştır ve **Publish** de (küçük, güvenilir bir grup için basit tuttum):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /devices/{deviceId} {
      allow read, write: if true;
    }
    match /presses/{pressId} {
      allow read, write: if true;
    }
  }
}
```

4. Sol menüden **Project settings** (dişli ikonu) → **Your apps** → **Web** ikonuna tıkla (</>) → bir isim ver, kaydet
5. Karşına çıkan `firebaseConfig` nesnesini kopyala — `mobile-app/App.js` dosyasının en üstündeki `firebaseConfig` yerine yapıştıracaksın

---

## 3. Mobil uygulamayı çalıştır

```bash
cd mobile-app
npm install
npx expo start
```

Terminalde çıkan QR kodu telefonundaki **Expo Go** uygulamasıyla okut (iPhone'da kamera uygulamasıyla, Android'de Expo Go içinden). Uygulama telefonunda açılacak.

Aynı işlemi grup arkadaşlarının telefonlarında da yap (her biri kendi bilgisayarında `npx expo start` çalıştırmasına gerek yok — sen `npx expo publish` ya da EAS update ile tek bir bağlantı paylaşabilirsin, aşağıda anlatıyorum).

---

## 4. Backend'i (Cloud Function) deploy et

```bash
npm install -g firebase-tools
firebase login
cd kirmizi-buton
firebase init functions
```

`firebase init` sırasında:
- "Use an existing project" → yukarıda oluşturduğun projeyi seç
- Language: JavaScript
- ESLint: Hayır (istersen evet)
- "Overwrite functions/package.json?" → **Hayır** (elindeki dosyayı koru) — eğer sorarsa dikkatli ol, gerekirse benim verdiğim `functions/index.js` ve `functions/package.json` içeriklerini yeni oluşan klasöre kopyala

Sonra deploy et:

```bash
cd functions
npm install
firebase deploy --only functions
```

Bu, `presses` koleksiyonuna her yeni kayıt eklendiğinde otomatik çalışacak bir fonksiyon kurar. Ekstra bir sunucuya veya API anahtarına gerek yok.

---

## 5. Test et

1. İki farklı telefonda uygulamayı aç, ikisi de isim girip "Bildirimleri Aç ve Katıl" desin
2. Birinde BAS düğmesine bas
3. Diğer telefonda birkaç saniye içinde bildirim gelmeli (uygulama kapalı olsa bile)

---

## 6. Herkese kalıcı bir uygulama olarak dağıtmak istersen

Şu ana kadarki kurulum Expo Go üzerinden test amaçlı. Kalıcı, gerçek bir app ikonuyla telefona kurulan bir sürüm istersen:

```bash
npm install -g eas-cli
eas login
cd mobile-app
eas build --profile preview --platform android
```

Bu sana indirilebilir bir `.apk` linki verir, Android'e Play Store'a gerek kalmadan direkt kurulabilir.

**iOS için** aynısını yapmak (`--platform ios`) bir **Apple Developer hesabı** gerektirir (yıllık ~99$) — Apple, imzasız uygulamaların iPhone'a kurulmasına izin vermiyor. Android tarafında bu ücret yok.

Grubun küçükse ve herkes Expo Go kullanmaya razıysa, 6. adıma hiç gerek yok — 3. adım yeterli.

---

## Notlar

- `devices` koleksiyonundaki push token'lar teknik olarak herkese açık okunabilir durumda (basit kural kullandık). Gerçekten hassas bir kullanım değilse sorun değil; istersen Firestore kurallarını daha sıkı hale getirebiliriz.
- Expo push servisi ücretsizdir, aylık bildirim limiti bu kullanım için fazlasıyla yeterli.
- Bildirim sesi/başlığı `functions/index.js` içinde değiştirilebilir.
