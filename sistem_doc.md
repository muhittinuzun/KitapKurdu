# Kitap Ligi - Sistem Dokümantasyonu

## 1) Dokümanın Amacı

Bu dosya proje için "checkpoint/sigorta" kaydıdır. Mimari kararlar, canlı sözleşmeler ve müdahale noktaları burada tutulur. Yeni bir ekip, farklı bir yapay zeka veya iş analisti projeye buradan girip hızlıca doğru yerde müdahale edebilmelidir.

---

## 2) Checkpoint Özeti (Güncel Durum)

Proje artık mock/prototipten gerçek MVP akışına geçmiştir.

- Frontend `index.html + app.js + style.css` (no-build) mimarisinde kalır.
- Backend tek giriş noktası n8n webhook (`api_akisi.json`) üzerinden çalışır.
- Kritik ekranlar gerçek veriye bağlıdır: dashboard, kitaplarım, kütüphane, rozetler.
- Rozet kazanımları artık sadece istemci geçici verisi değil, `k_t_user_badges` tablosuna kalıcı yazılır.
- Mobil görünümde sol sidebar kapatılmış, alt menü ana navigasyon olarak kullanılır.
- ISBN tabanlı kitap bulma akışı fallback mimarisi ile canlıdır: önce lokal DB, yoksa Google Books API.
- "Sisteme Kitap Ekle" modalı premium mobil UX'e taşınmıştır (spinner, onay kartı, kategori seçimi, büyük CTA).

---

## 3) Değiştirilemez Temel Kurallar

1. **Mimari**
   - Build sistemi yoktur. Sadece `index.html`, `app.js`, `style.css`.
   - UI render yaklaşımı `app.js` içinde view tabanlıdır.

2. **Backend**
   - Tüm veri işlemleri tek webhook üzerinden (`POST`).
   - SQL üretimi n8n içindeki `Smart SQL Builder` node'unda yapılır.

3. **Veri Modeli Namusu**
   - `k_t_books`: kitabın genel künyesi.
   - `k_t_book_editions`: ISBN/sayfa sayısı gibi baskı bilgisi.
   - `k_t_read_logs`: ISBN üzerinden okuma olayları.

4. **UX Kuralı (Sayfa Takibi)**
   - Kullanıcıya "Şu an kaçıncı sayfadasın?" sorulur.
   - `app.js` farkı hesaplayıp `pages_read` olarak backend'e gönderir.

---

## 4) Dosya Bazlı Sorumluluklar

- `index.html`
  - Uygulama iskeleti, header, içerik alanı, mobil alt menü.
  - Desktop sidebar markup içerir ama mobilde CSS ile kapatılır.
  - `html5-qrcode` CDN entegrasyonu ile kamera tabanlı ISBN okutma desteği içerir.

- `style.css`
  - Özel animasyonlar ve yardımcı stiller.
  - Mobilde sidebar'ı zorunlu gizleyen kural içerir (`#desktop-sidebar { display: none !important; }`).

- `app.js`
  - Global state (`AppState`), view render, API istemcisi, tüm etkileşimler.
  - Öğrenci/yetkili ekranları, rozet hesaplama ve senkronizasyon mantığı.
  - Kitap ekleme modalı: ISBN arama spinner'ı, onay kartı, görsel fallback, kategori seçimi, tek-tık DB kayıt akışı.

- `api_akisi.json`
  - n8n workflow: `Webhook -> Action Yönlendirici`.
  - `fetch_book_by_isbn` için şelale: `Lokal DB Kontrolü -> Bizde Var Mı? -> (varsa) Cevap Dön / (yoksa) Google Books API -> Format Google Data -> Cevap Dön`.
  - Diğer aksiyonlar için klasik hat: `Smart SQL Builder -> Universal Executor -> Respond Success`.
  - Aksiyonlara göre SQL üretimi ve whitelist güvenliği.

---

## 5) API Sözleşmesi (Canlı)

## 5.1 Standart Request

```json
{
  "action": "string",
  "resource": "string",
  "data": {},
  "user_id": "uuid|optional"
}
```

## 5.2 Standart Response

```json
{
  "status": "success",
  "resource": "string",
  "data": []
}
```

## 5.3 n8n'de Aktif Aksiyonlar

- `get_groups`
- `resolve_code`
- `login`
- `register`
- `add_book_edition`
- `log_read`
- `dashboard_stats`
- `leaderboard_group`
- `authority_stats`
- `authority_students`
- `sync_user_badges`
- `fetch_book_by_isbn`
- `read`

## 5.4 Whitelist Tabloları

- `k_t_groups`
- `k_t_users`
- `k_t_read_logs`
- `k_t_badges`
- `k_t_books`
- `k_t_book_editions`
- `k_t_user_badges`

## 5.5 `fetch_book_by_isbn` Cevap Sözleşmesi

Başarılı örnek:

```json
{
  "status": "success",
  "source": "local|google",
  "data": {
    "title": "string",
    "author": "string",
    "page_count": 0,
    "thumbnail_url": "string",
    "category": "string"
  }
}
```

Hata örneği:

```json
{
  "status": "error",
  "message": "Kitap bulunamadı"
}
```

---

## 6) Rozet Sistemi (Güncel Tasarım + Kalıcılık)

## 6.1 Frontend

- Rozet görünümü `renderBadgesView()` ile üretilir.
- Kazanılan rozet kartları:
  - renkli/gradyan
  - büyük ikon
  - dikey kart formu
- Kilitli rozet kartları:
  - beyaz zemin
  - ilerleme barı
  - dikey kart formu
- Tema eşlemesi `requirement_type` bazlı sabittir:
  - `total_pages` -> mavi
  - `read_streak` -> mor
  - `total_books` -> yeşil

## 6.2 Backend Kalıcılık

- `sync_user_badges` aksiyonu:
  1. Kullanıcı metriklerini `k_t_read_logs` üzerinden hesaplar.
  2. `k_t_badges` kurallarıyla eşleştirir.
  3. Yeni kazanımları `k_t_user_badges` tablosuna yazar.
  4. `newly_earned` bilgisiyle frontend'e döner.

Not: Bu yapı rozet kazanımını tekrar hesaplanabilir ve denetlenebilir hale getirir.

---

## 7) Mobil Navigasyon Kararı (Önemli)

- Mobilde sol sidebar kullanılmaz.
- Mobilde sadece alt menü (`mobile-bottom-nav`) aktif kalır.
- Uygulama bu kararı hem JS sınıf yönetimi hem de CSS zorlaması ile uygular.

Bu karar UX tutarlılığı için korunmalıdır; mobilde iki ayrı navigasyon katmanı gösterilmez.

---

## 8) Kitap Ekleme UX Standardı (MVP)

Bu akış MVP için standarttır, değiştirilirken korunmalıdır:

1. Kullanıcı ISBN'i manuel girer veya kamera ile okutur.
2. Modal içinde "Aranıyor..." spinner'ı görünür.
3. `apiCall('fetch_book_by_isbn', { isbn })` çağrılır.
4. Başarılıysa onay kartı açılır:
   - kapak (hotlink),
   - kitap adı,
   - yazar,
   - sayfa sayısı,
   - kategori seçimi.
5. Görsel yüklenemezse lucide `book` placeholder gösterilir.
6. Kullanıcı onaylarsa:
   - `apiCall('add_book_edition', { isbn, title, author, page_count, thumbnail_url, category })`
   - başarıda modal kapanır, toast gösterilir, kütüphane tazelenir.
7. API hata dönerse kullanıcıya okunabilir toast mesajı verilir.

---

## 9) Şu An Güvenli Müdahale Noktaları

Yeni geliştirme yapacak ekipler için önerilen giriş noktaları:

1. **Yeni backend aksiyonu eklenecekse**
   - `api_akisi.json` içinde önce `resource` çözümü, sonra whitelist, sonra action SQL bloğu eklenir.

2. **Yeni bir öğrenci ekranı/akışı eklenecekse**
   - `app.js` içinde `navigate()` switch'ine view ve render fonksiyonu eklenir.

3. **Bildirim/UI geri bildirimi değişecekse**
   - `showToast()` (inline alert davranışı) merkezi noktadır.

4. **Rozet/oyunlaştırma kuralı değişecekse**
   - Frontend: `loadBadgeProgressData()` ve `renderBadgesView()`
   - Backend: `sync_user_badges` SQL kural bloğu

5. **ISBN fallback akışı değişecekse**
   - `api_akisi.json` içinde `Action Yönlendirici`, `Lokal DB Kontrolü`, `Google Books API`, `Format Google Data`, `Cevap Dön` zinciri birlikte ele alınmalıdır.
   - Sadece tek node değiştirilip bırakılmamalıdır; bağlantı bütünlüğü korunmalıdır.

---

## 10) Açık Riskler ve Teknik Borç

1. **Auth sertliği**
   - Session/token tabanlı merkezi yetkilendirme henüz yok.

2. **Tarayıcı API desteği**
   - `html5-qrcode` kamera izinlerine ve cihaz performansına bağlıdır.
   - `webkitSpeechRecognition` cihaz/tarayıcıya göre değişebilir.

3. **Veritabanı kısıtları**
   - `k_t_user_badges` için `UNIQUE(user_id, badge_id)` indeksinin veritabanında net garanti edilmesi önerilir.

4. **No-build sınırı**
   - Büyük kod tabanında tek dosya `app.js` bakımı zorlaştırır; modülerleşme kararı alınırsa mimari kuralın güncellenmesi gerekir.

---

## 11) Operasyon Notu (Checkpoint Süreci)

Bu dosya düzenli aralıklarla checkpoint olarak güncellenir.

- Her önemli adım sonrası:
  - ne değişti,
  - hangi dosyada değişti,
  - hangi davranış artık standart oldu
  net olarak işlenir.

Bu disiplin proje yönünü korur ve ekipler arası bağlam kaybını azaltır.
