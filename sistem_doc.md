# Kitap Ligi - Sistem Dokümantasyonu

> **Son guncelleme:** 8 Mart 2026 (MVP Checkpoint - tekil surum)

## 1) Amac

Bu dokuman, projenin teknik gercegini tek kaynaktan anlatir. Yeni gelen ekipler bu dosya ile:

- mimari sinirlari,
- canli API davranisini,
- kritik UX standartlarini,
- bilinen riskleri

hizlica anlayabilmelidir.

---

## 2) Canli Durum Ozeti

- Uygulama no-build yapidadir: `index.html`, `app.js`, `style.css`.
- Backend tek n8n webhook akisi uzerinden calisir (`api_akisi.json`).
- ISBN fallback zinciri canli: **Lokal -> Google -> Kitapyurdu -> D&R -> Nihai kontrol**.
- Kitap ekleme modalinda barkod okuma (`html5-qrcode`), spinner, duzenlenebilir onay karti ve manuel giris akisi vardir.
- Rozet kazanimi backendde hesaplanir ve `k_t_user_badges` tablosuna kalici yazilir.
- Mobilde sol sidebar kapali, ana navigasyon `mobile-bottom-nav` uzerindendir.

---

## 3) Degistirilemez Kurallar

1. **Mimari**
   - Build sistemi yok.
   - Render akisi `app.js` icindeki view tabanli yonlendirme ile yurur.

2. **Backend**
   - Tum istekler tek webhook endpointine `POST` edilir.
   - SQL uretilmesi `Smart SQL Builder` icinde merkezidir.

3. **Veri modeli sinirlari**
   - `k_t_books`: kitap kimligi ve genel metadata.
   - `k_t_book_editions`: ISBN, sayfa sayisi, kapak URL gibi baski verisi.
   - `k_t_read_logs`: okuma hareketleri ve `[KT_EVENT]` notlari.
   - `k_t_user_badges`: kazanilan rozetlerin kalici kaydi.

4. **Okuma UX kurali**
   - Kullaniciya "su an kacinci sayfadasin?" sorulur.
   - `pages_read` farki frontendde hesaplanip `log_read` ile gonderilir.

---

## 4) Dosya Sorumluluklari

### `index.html`
- Uygulama iskeleti (header, desktop sidebar, mobile bottom nav, view alanlari).
- CDN bagimliliklari: Tailwind, Lucide, Chart.js, Canvas Confetti, `html5-qrcode`.

### `style.css`
- Animasyonlar, UI yardimcilari ve responsive davranislar.
- Mobilde `#desktop-sidebar { display: none !important; }` kuraliyla sidebar zorunlu kapatilir.

### `app.js`
- State yonetimi, route/render akisi, API istemcisi, ekranlar ve modal davranislari.
- Premium modal UX:
  - ISBN manuel veya kamera ile girilir,
  - arama yuklenme gostergesi acilir,
  - sonuc varsa duzenlenebilir onay karti acilir,
  - sonuc yoksa manuel kitap girisi acilir.

### `api_akisi.json`
- `fetch_book_by_isbn` icin ozel fallback hattini tasir.
- Diger aksiyonlarda `Smart SQL Builder -> Universal Executor -> Respond Success` hattini kullanir.

### `DATABASE_SCHEMA.md`
- Tablo ve iliski referansi.

### `fix_api.py`
- `api_akisi.json` icindeki `Smart SQL Builder` kodunu guvenli sekilde guncellemek icin yardimci script.

---

## 5) API Sozlesmesi ve Cagri Standardi

### 5.1 Request/Response Cercevesi

Request:

```json
{
  "action": "string",
  "resource": "string (opsiyonel)",
  "data": {},
  "user_id": "uuid (varsa)"
}
```

Response:

```json
{
  "status": "success",
  "resource": "string",
  "data": []
}
```

### 5.2 Frontend Cagri Standardi

Kod tabaninda standart kullanim:

- `apiCall('fetch_book_by_isbn', { isbn })`
- `apiCall('add_book_edition', { isbn, title, author, page_count, thumbnail_url, category })`

Not: `apiCall` fonksiyonu hem bu kisayolu hem de `{ action, resource, data }` formunu destekler; ekip standardi string action + data objesi formatidir.

### 5.3 Aktif aksiyonlar (ozet)

- `get_groups`, `resolve_code`, `login`, `register`
- `add_book_edition`, `get_library_books`, `get_user_books`
- `log_read`, `undo_read_log`
- `dashboard_stats`, `leaderboard_group`, `authority_stats`, `authority_students`
- `sync_user_badges`
- `fetch_book_by_isbn`
- `get_book_comments`, `add_comment`, `read`

---

## 6) ISBN Fallback Akisi (Canli Gercek)

`fetch_book_by_isbn` isteginde:

1. Lokal DB (`k_t_book_editions` + `k_t_books`) sorgulanir.
2. Yetersizse Google Books denenir.
3. Hala yetersizse Kitapyurdu HTML parse edilir.
4. Hala yetersizse D&R HTML parse edilir.
5. Nihai kontrolde `title` varsa basari, yoksa hata donulur.

Bu zincirin node baglantilari kirilmamali; fallback sirasi sabittir.

---

## 7) Kitap Ekleme Modal UX (MVP)

1. Kullanici ISBN'i manuel girer veya `html5-qrcode` ile okutma baslatir.
2. ISBN aramasinda modal icinde loader gorunur.
3. `apiCall('fetch_book_by_isbn', { isbn })` cagrilir.
4. Basarili donuste duzenlenebilir onay karti acilir:
   - kapak goruntu alani,
   - kitap adi/yazar/sayfa sayisi alanlari,
   - kategori secimi,
   - kapak URL duzenleme.
5. Basarisiz donuste manuel kitap giris formu acilir.
6. Kayit onayinda `apiCall('add_book_edition', { ... })` cagrilir.
7. Basarida modal kapanir, toast gosterilir, kutuphane ve ilgili gorunumler yenilenir.

---

## 8) Rozet Kaliciligi ve Oyunlastirma

- Frontend `syncBadgeAchievements` ile backend senkronunu tetikler.
- Backend `sync_user_badges` aksiyonu:
  - metrikleri `k_t_read_logs` uzerinden hesaplar,
  - uygun rozetleri belirler,
  - yeni kazanimi `k_t_user_badges` tablosuna yazar,
  - `newly_earned` bilgisiyle geri doner.

Sonuc: rozetler oturumlar arasinda kalicidir.

---

## 9) Undo Davranisi (Guncel Gercek)

- Backendde `undo_read_log` aksiyonu tanimlidir (SQL Builder icinde delete islemi vardir).
- Frontend `undoLastReadAction` fonksiyonu bu aksiyonu cagirir.
- Cagri cevabi su an zorunlu dogrulanmaz; hata olsa bile yerel state geri alinir (MVP simule/fallback davranisi).

Bu nedenle undo akisi "backend + yerel fallback" modelindedir; yalnizca "tam backend garantili" gibi belgelenmemelidir.

---

## 10) Mobil Navigasyon Standardi

- Mobilde desktop sidebar kapali kalir.
- Mobilde ana navigasyon sadece `mobile-bottom-nav` ile ilerler.
- Bu karar hem CSS (zorunlu gizleme) hem JS sinif yonetimi ile korunur.

---

## 11) Bilinen Riskler

1. Auth akisinda token/session sertlestirmesi yok.
2. Sifre guvenligi sertlestirmesi gerekli (`password_hash` tarafi).
3. `renderAuthorityReportsView` halen gercek raporlama degil (stub davranis).
4. `app.js` tek dosya buyuklugu bakim maliyetini artiriyor.
5. Kitapyurdu/D&R HTML degisimleri fallback parserlarini kirabilir.

---

## 12) Sonraki Oncelikler

1. Yetkili raporlama ekranini filtre/dişa aktarma ile tamamlamak.
2. Auth + sifre guvenligini sertlestirmek.
3. `app.js` icin modulerlesme plani cikarmak.
4. ISBN fallback kaynaklarina regresyon kontrol listesi yazmak.
