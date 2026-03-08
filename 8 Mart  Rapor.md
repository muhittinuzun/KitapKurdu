# Kitap Ligi - Proje Durum Analizi & sistem_doc Güncellemesi

## Yapılanlar

### [sistem_doc.md](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/sistem_doc.md) Tamamen Yeniden Yazıldı

Tüm kaynak dosyaları ([app.js](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/app.js) 3116 satır, [index.html](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/index.html), [style.css](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/style.css), [api_akisi.json](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/api_akisi.json), [DATABASE_SCHEMA.md](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/DATABASE_SCHEMA.md), [fix_api.py](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/fix_api.py)) satır satır incelendi. Eski dokümanda eksik olan birçok özellik ve değişiklik tespit edilip güncellendi.

### Eski Dokümanda Olmayıp Eklenen Başlıca Konular

| Yeni Bölüm | Açıklama |
|-------------|----------|
| Tamamlanan özellikler tablosu | 15 özelliğin canlı/stub/eksik durumu |
| `k_t_book_comments` tablosu | Yeni tablo, eski şemada bile yok |
| Kitap yaşam döngüsü diyagramı | START → okuma → FINISH/DROP |
| 4 kademeli ISBN fallback akış şeması | Lokal → Google → Kitapyurdu → D&R |
| Kitap detay & yorum sistemi | Modal, sesli yorum, status bazlı moderasyon |
| Manuel kitap giriş formu | ISBN bulunamadığında devreye girer |
| [app.js](file:///Users/ahmetmuhittinuzun/Documents/eski%20belgeler/GitHub/KitapTakipApp/KitapKurdu/app.js) fonksiyon envanteri | 93 fonksiyon kategorize edildi |
| Bilinen eksikler (4 kritik, 5 orta) | undo backend yok, raporlar stub, auth güvenliği yok, şifre hash yok |
| 8 geliştirme fırsatı | Okuma hedefleri, bildirimler, dark mode, PDF rapor, vb. |

```diff:sistem_doc.md
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
===
# Kitap Ligi - Sistem Dokümantasyonu

> **Son güncelleme:** 8 Mart 2026

## 1) Dokümanın Amacı

Bu dosya proje için "checkpoint/sigorta" kaydıdır. Mimari kararlar, canlı sözleşmeler ve müdahale noktaları burada tutulur. Yeni bir ekip, farklı bir yapay zeka veya iş analisti projeye buradan girip hızlıca doğru yerde müdahale edebilmelidir.

---

## 2) Checkpoint Özeti (Güncel Durum)

Proje mock/prototipten gerçek MVP akışına geçmiş ve aktif olarak kullanılmaktadır.

### Tamamlanan Özellikler

| Alan | Durum | Açıklama |
|------|-------|----------|
| Kayıt / Giriş | ✅ Canlı | Join-code ve manuel seçim (İl → İlçe → Okul → Sınıf) ile kayıt, e-posta/şifre ile giriş |
| Öğrenci Dashboard | ✅ Canlı | Aktif kitap okuma kartı, istatistikler (toplam sayfa, kitap, seri), sayfa kayıt modalı |
| Kitaplarım | ✅ Canlı | `get_user_books` API ile kapak görselli, ilerleme çubuklu kitap listesi; "okunan / bitirilen / bırakılan" sekmeleri |
| Kütüphane (Keşfet) | ✅ Canlı | Tüm kitaplar grid/liste görünümü, arama, ISBN ile kitap ekleme modalı, kitap detay modalı |
| Rozet Sistemi | ✅ Canlı | `sync_user_badges` ile backend kalıcılık; renkli/kilitli kart görünümü; confetti animasyonu |
| Sıralama | ✅ Canlı | Sınıf bazlı `leaderboard_group` sıralaması |
| Yönetici Paneli | ✅ Canlı | Toplam sayfa, aktif/toplam öğrenci, farklı kitap; aylık trend grafiği (Chart.js) |
| Öğrenci Listesi | ✅ Canlı | Yönetici için öğrenci tablosu (ad, e-posta, toplam sayfa, kitap sayısı) |
| Kitap Detay & Yorum | ✅ Canlı | Modal tabanlı kitap detay; yorum ekleme; sesli yorum (`webkitSpeechRecognition`) |
| ISBN Fallback Zinciri | ✅ Canlı | Lokal DB → Google Books → Kitapyurdu → D&R → Nihai Kontrol (4 kademeli) |
| Kitap Yaşam Döngüsü | ✅ Canlı | Başlat (`[KT_EVENT]START`), bitir (`[KT_EVENT]FINISH`), bırak (`[KT_EVENT]DROP`) |
| Manuel Kitap Girişi | ✅ Canlı | ISBN bulunamadığında kullanıcı kitap bilgilerini elle girebilir |
| Barkod Tarama | ✅ Canlı | `html5-qrcode` kütüphanesi ile kameradan ISBN okutma |
| Geri Alma (Undo) | ⚠️ Kısmen | Frontend simülasyonu mevcut, backend `undo_read_log` aksiyonu henüz tanımlı değil |
| Raporlar (Yönetici) | ⚠️ Stub | `renderAuthorityReportsView` fonksiyonu dashboard'u tekrar render eder, gerçek rapor özelliği yok |
| Ayarlar (Yönetici) | ⚠️ Minimal | Sadece profil bilgilerini (read-only) gösterir, düzenleme yok |

### Teknoloji Yığını

- **Frontend**: `index.html` + `app.js` + `style.css` (no-build, Tailwind CDN + Lucide Icons + Chart.js + Canvas Confetti + html5-qrcode)
- **Backend**: n8n webhook (`api_akisi.json`) → PostgreSQL
- **Fontlar**: Inter + Outfit (Google Fonts)
- **Tema**: Child (amber) ve Academic (slate/indigo) — role-based otomatik

---

## 3) Değiştirilemez Temel Kurallar

1. **Mimari**
   - Build sistemi yoktur. Sadece `index.html`, `app.js`, `style.css`.
   - UI render yaklaşımı `app.js` içinde view tabanlıdır (SPA-like `navigate()` fonksiyonu).

2. **Backend**
   - Tüm veri işlemleri tek webhook üzerinden (`POST`).
   - SQL üretimi n8n içindeki `Smart SQL Builder` node'unda yapılır.

3. **Veri Modeli Namusu**
   - `k_t_books`: kitabın genel künyesi (title, author, category).
   - `k_t_book_editions`: ISBN/sayfa sayısı gibi baskı bilgisi.
   - `k_t_read_logs`: ISBN üzerinden okuma olayları + yaşam döngüsü event'leri (`[KT_EVENT]` prefix).
   - `k_t_book_comments`: kitap yorumları (status bazlı: `approved` / `pending`).

4. **UX Kuralı (Sayfa Takibi)**
   - Kullanıcıya "Şu an kaçıncı sayfadasın?" sorulur.
   - `app.js` farkı hesaplayıp `pages_read` olarak backend'e gönderir.

---

## 4) Dosya Bazlı Sorumluluklar

### `index.html` (148 satır)
- Uygulama iskeleti: header, sidebar (desktop), mobile bottom nav, view container, toast container.
- CDN'ler: Tailwind CSS, Lucide Icons, Chart.js, Canvas Confetti, html5-qrcode, Google Fonts.
- `html5-qrcode` kamera tabanlı ISBN okutma desteği.

### `style.css` (178 satır)
- Özel animasyonlar: `slideUp`, `fadeIn`, `float`, `pulse-ring`, `pulse-red`.
- Glassmorphism utility (`.glass`).
- Mobilde sidebar'ı zorunlu gizleyen kural (`#desktop-sidebar { display: none !important; }`).
- Safe-area-inset (mobil browser çentik uyumu).
- Chart container kısıtlamaları.

### `app.js` (3116 satır, 93 fonksiyon)

| Kategori | Fonksiyonlar |
|----------|-------------|
| **Başlatma** | `initApp`, `loadState`, `saveState`, `checkAuth` |
| **API** | `apiCall`, `normalizeApiDataArray`, `normalizeRole` |
| **Routing** | `navigate` (11 view case) |
| **Auth Ekranları** | `renderLoginView`, `renderRegisterView`, `resolveJoinCode`, `loadGroups`, `resetDownstreamSelects`, `enableFinalForm`, `disableFinalForm` |
| **Öğrenci Ekranları** | `renderStudentDashboard`, `renderMyBooksView`, `renderLeaderboardView`, `renderBadgesView`, `renderLibraryView` |
| **Kitap Detay & Yorum** | `openBookDetailModal`, `closeBookDetailModal`, `renderBookDetailModalSkeleton`, `updateBookDetailComments`, `submitComment` |
| **Sesli Yorum** | `toggleVoiceComment`, `startVoiceComment`, `stopVoiceComment`, `updateVoiceBtnUI` |
| **Kitap Ekleme** | `openAddBookModal`, `closeAddBookModal`, `fetchBookByIsbnForConfirm`, `renderBookConfirmationCard`, `confirmAddBookFromPending`, `showManualBookEntryForm`, `saveManualBookEntry`, `setIsbnFetchLoading` |
| **Barkod** | `startBarcodeScanner`, `stopBarcodeScanner` |
| **Okuma İşlemleri** | `logReading`, `undoLastReadAction`, `openReadingLogModal`, `closeReadingLogModal`, `startReadingForIsbn`, `startReadingFromLibrary`, `removeFromActiveList`, `markBookAsFinished`, `openFinishDateModal`, `closeFinishDateModal`, `submitFinishDateModal` |
| **Rozet** | `loadBadgeProgressData`, `syncBadgeAchievements`, `renderBadgesView` |
| **Kütüphane** | `fetchLibraryBooks`, `renderBookRow`, `renderLibraryBookCard` |
| **Yönetici** | `renderAuthorityDashboard`, `renderAuthorityReportsView`, `renderAuthorityStudentsView`, `renderAuthoritySettingsView` |
| **UI Yardımcıları** | `updateNavigationUI`, `applyTheme`, `setupEventListeners`, `showToast`, `buildBookCoverHtml`, `escapeHtml`, `getGroupNameById`, `getTodayISODate`, `parseReadLogEvent`, `startSpeechToText` |
| **Diğer** | `logout`, `loadDashboardStats`, `calculateReadingStreak`, `loadMyBooksData`, `loadStudentActiveBook` |

### `api_akisi.json` (n8n workflow - 539 satır)

**Genel Mimari:**
```
Webhook → Action Yönlendirici
  ├── [fetch_book_by_isbn] → Lokal DB → Bizde Var Mı?
  │     ├── [Evet] → Lokalden Dön
  │     └── [Hayır] → Google Books API → Google Verisi → Google Yeterli Mi?
  │           ├── [Evet] → Nihai Kontrol → API Cevabı Dön
  │           └── [Hayır] → Kitapyurdu Arama → Kitapyurdu Format → Kitapyurdu Yeterli Mi?
  │                 ├── [Evet] → Nihai Kontrol → API Cevabı Dön
  │                 └── [Hayır] → D&R Arama → D&R Format → Nihai Kontrol → API Cevabı Dön
  └── [Diğer aksiyonlar] → Smart SQL Builder → Universal Executor → Respond Success
```

### `fix_api.py` (184 satır)
- `api_akisi.json` içindeki Smart SQL Builder jsCode'unu güvenli şekilde güncellemek için bir yardımcı Python scripti.
- Doğrudan çalıştırılması gereken bir production dosyası değildir.

### `DATABASE_SCHEMA.md`
- 7 tablo tanımı + ilişkiler (bkz. Bölüm 5.4).

---

## 5) API Sözleşmesi (Canlı)

### 5.1 Standart Request
```json
{
  "action": "string",
  "resource": "string (opsiyonel, oto-resolve edilir)",
  "data": {},
  "user_id": "uuid (auth durumunda otomatik inject)"
}
```

### 5.2 Standart Response
```json
{
  "status": "success",
  "resource": "string",
  "data": []
}
```

### 5.3 n8n'de Aktif Aksiyonlar

| Aksiyon | Resource (oto) | Açıklama |
|---------|---------------|----------|
| `get_groups` | `k_t_groups` | Hiyerarşik grup listesi (il/ilçe/okul/sınıf) |
| `resolve_code` | `k_t_groups` | Katılım kodu ile sınıf çözümleme |
| `login` | `k_t_users` | E-posta + şifre ile giriş |
| `register` | `k_t_users` | Yeni kullanıcı kaydı (mevcut kontrollü) |
| `add_book_edition` | `k_t_book_editions` | ISBN ile kitap ekleme (upsert) |
| `get_library_books` | `k_t_book_editions` | Kütüphane listesi (sayfalı) |
| `get_user_books` | `k_t_read_logs` | Kullanıcının kitapları (ilerleme + durum) |
| `log_read` | `k_t_read_logs` | Okuma kaydı ekleme |
| `dashboard_stats` | `k_t_read_logs` | Öğrenci istatistikleri (streak dahil) |
| `leaderboard_group` | `k_t_read_logs` | Sınıf sıralaması |
| `authority_stats` | `k_t_read_logs` | Yönetici genel istatistikler |
| `authority_students` | `k_t_read_logs` | Tüm öğrenci listesi |
| `sync_user_badges` | `k_t_user_badges` | Rozet hesaplama + kalıcılık |
| `fetch_book_by_isbn` | *(özel akış)* | 4 kademeli ISBN arama |
| `get_book_comments` | `k_t_book_comments` | Kitap yorumlarını getir (onaylılar) |
| `add_comment` | `k_t_book_comments` | Yeni yorum ekle |
| `read` | *(dinamik)* | Genel okuma sorgusu (field/filter/order/limit/offset) |

### 5.4 Whitelist Tabloları

| Tablo | Açıklama |
|-------|----------|
| `k_t_groups` | İl/ilçe/okul/sınıf hiyerarşisi |
| `k_t_users` | Kullanıcılar |
| `k_t_read_logs` | Okuma geçmişi + yaşam döngüsü |
| `k_t_badges` | Rozet tanımları |
| `k_t_books` | Kitap genel bilgileri |
| `k_t_book_editions` | Kitap basımları (ISBN PK) |
| `k_t_user_badges` | Kazanılan rozetler |
| `k_t_book_comments` | Kitap yorumları |

### 5.5 `fetch_book_by_isbn` Fallback Zinciri

```
1. Lokal DB Kontrolü (k_t_book_editions + k_t_books JOIN)
   ↓ bulamadıysa
2. Google Books API (googleapis.com/books/v1/volumes)
   → title + thumbnail varsa → Nihai Kontrol
   → eksikse ↓
3. Kitapyurdu Arama (kitapyurdu.com HTML scrape)
   → title + thumbnail varsa → Nihai Kontrol
   → eksikse ↓
4. D&R Arama (dr.com.tr HTML scrape)
   → Nihai Kontrol
```

**Nihai Kontrol**: title varsa `status: success`, yoksa `status: error` + `"Kitap hiçbir kaynakta bulunamadı"`.

---

## 6) Rozet Sistemi

### 6.1 Frontend
- `renderBadgesView()` + `loadBadgeProgressData()` + `syncBadgeAchievements()`.
- Kazanılan rozetler: renkli/gradyan kart, büyük ikon.
- Kilitli rozetler: beyaz zemin, ilerleme barı.
- Tema: `total_pages` → mavi, `read_streak` → mor, `total_books` → yeşil.

### 6.2 Backend Kalıcılık
- `sync_user_badges` aksiyonu:
  1. `k_t_read_logs` üzerinden metrikler hesaplanır (total_pages, total_books via FINISH event, read_streak).
  2. `k_t_badges` kurallarıyla eşleştirilir.
  3. Yeni kazanımlar `k_t_user_badges`'e yazılır.
  4. `newly_earned` bilgisiyle frontend'e döner.

---

## 7) Kitap Yaşam Döngüsü

```
[Kütüphaneden Seç / ISBN ile Ekle]
       │
       ▼
  startReadingForIsbn() → log_read: [KT_EVENT]START
       │
       ▼
  logReading() → log_read: pages_read (sayfa farkı)
       │  (tekrarlı)
       ▼
  ┌────────────────┐
  │  Kitabı Bitir  │ → submitFinishDateModal() → log_read: [KT_EVENT]FINISH
  └────────────────┘
  ┌────────────────┐
  │  Kitabı Bırak  │ → removeFromActiveList() → log_read: [KT_EVENT]DROP
  └────────────────┘
```

---

## 8) Kitap Ekleme UX Standardı (MVP)

1. Kullanıcı ISBN'i manuel girer veya kamera ile okutur.
2. Modal içinde spinner gösterilir.
3. `apiCall('fetch_book_by_isbn', { isbn })` çağrılır.
4. Başarılıysa **düzenlenebilir** onay kartı açılır:
   - Kapak (hotlink), kitap adı (input), yazar (input), sayfa sayısı (input), kategori (select).
5. Görsel yüklenemezse lucide `book` placeholder gösterilir.
6. Kitap bulunamazsa **manuel giriş formu** sunulur.
7. Kullanıcı onaylarsa:
   - `apiCall('add_book_edition', { isbn, title, author, page_count, thumbnail_url, category })`
   - Başarıda modal kapanır, toast gösterilir, kütüphane yenilenir.
8. API hata dönerse okunabilir toast mesajı verilir.

---

## 9) Mobil Navigasyon Kararı

- Mobilde sol sidebar kullanılmaz.
- Mobilde sadece alt menü (`mobile-bottom-nav`) aktif kalır.
- Bu karar hem JS sınıf yönetimi hem CSS zorlaması ile uygulanır.
- Öğrenci alt menü: Ana Sayfa, Kitaplarım, Keşfet, Rozetler, Sıralama.
- Yönetici alt menü: Panel, Raporlar, Öğrenciler, Ayarlar.

---

## 10) Güvenli Müdahale Noktaları

1. **Yeni backend aksiyonu** → `api_akisi.json > Smart SQL Builder` jsCode'una else-if ekle.
2. **Yeni öğrenci ekranı** → `app.js > navigate()` switch'ine case ekle + render fonksiyonu yaz.
3. **Toast/bildirim** → `showToast()` merkezi noktadır (inline-alert).
4. **Rozet kuralı** → Frontend: `loadBadgeProgressData()` / Backend: `sync_user_badges` SQL bloğu.
5. **ISBN fallback akışı** → `api_akisi.json` içindeki Lokal → Google → Kitapyurdu → D&R zincirinin bağlantı bütünlüğü korunmalıdır.
6. **Yorum sistemi** → Backend: `get_book_comments` / `add_comment`; Frontend: `submitComment()` / `updateBookDetailComments()`.
7. **Smart SQL Builder güncelleme** → `fix_api.py` scripti kullanılabilir (JSON escape güvenliği).

---

## 11) Bilinen Eksikler ve Geliştirme Fırsatları

### 🔴 Kritik Eksikler

| # | Eksik | Detay |
|---|-------|-------|
| 1 | **Auth güvenliği** | Session/token tabanlı yetkilendirme yok; sadece `localStorage`'da tutulan user objesi ile çalışılıyor. |
| 2 | **Şifre güvenliği** | `password_hash` alanına düz metin gönderiliyor; backend'de hash işlemi yapılmıyor. |
| 3 | **Undo backend desteği** | `undo_read_log` aksiyonu frontend'den çağrılıyor ama Smart SQL Builder'da tanımlı değil; çağrı sessizce başarısız oluyor. |
| 4 | **Raporlar sayfası** | `renderAuthorityReportsView()` sadece dashboard'u tekrar render ediyor; gerçek raporlama (PDF, filtreleme, tarih aralığı) yok. |

### 🟡 Orta Öncelikli Geliştirmeler

| # | Özellik | Detay |
|---|---------|-------|
| 5 | **Silme işlemleri** | Kitap silme, okuma kaydı silme, kullanıcı silme backend aksiyonları hiç yok. |
| 6 | **Profil düzenleme** | Şifre değiştirme, ad güncelleme, profil resmi yok. |
| 7 | **Yorum moderasyonu** | `k_t_book_comments` tablosunda `status` alanı var ama AI moderasyon henüz aktif değil; tüm yorumlar "approved" olarak ekleniyor. |
| 8 | **Öğretmen sınıf filtresi** | Yönetici panelinde öğrenciler tüm sistemden çekiliyor; sınıf/okul bazlı filtreleme yok. |
| 9 | **Offline destek** | PWA / Service Worker desteği yok; çevrimdışı kullanım mümkün değil. |

### 🟢 Geliştirme Fırsatları

| # | Özellik | Detay |
|---|---------|-------|
| 10 | **Okuma hedefleri** | Günlük/haftalık sayfa hedefi, hedef takibi ve hatırlatmalar |
| 11 | **Bildirim sistemi** | Push notification veya in-app bildirim (header'daki zil ikonu dekoratif) |
| 12 | **Sosyal özellikler** | Arkadaş ekleme, kitap önerisi paylaşma, sınıf içi okuma yarışması |
| 13 | **Gelişmiş istatistikler** | Öğrenci için haftanın günlerine göre okuma dağılımı, kategori bazlı analiz |
| 14 | **PDF/Excel rapor** | Yönetici için dışa aktarma; sınıf bazlı karşılaştırmalı raporlar |
| 15 | **Dark mode** | Tema altyapısı mevcut ama dark mode aktif değil |
| 16 | **Çoklu dil desteği** | Şu an sadece Türkçe; i18n altyapısı yok |
| 17 | **app.js modülerleşme** | 3116 satırlık dosya bakımı zorlaştırıyor; ES module veya en azından mantıksal parçalara bölme düşünülebilir |

---

## 12) Veritabanı Şeması Özeti

8 tablo (detaylar `DATABASE_SCHEMA.md` dosyasında):

| Tablo | PK | Ana İlişkiler |
|-------|-----|---------------|
| `k_t_users` | `id` (uuid) | `group_id → k_t_groups(id)` |
| `k_t_groups` | `id` (uuid) | `parent_id → k_t_groups(id)` (self-ref hiyerarşi) |
| `k_t_read_logs` | `id` (uuid) | `user_id → k_t_users(id)`, `book_isbn → k_t_book_editions(isbn)` |
| `k_t_books` | `id` (uuid) | — |
| `k_t_book_editions` | `isbn` (varchar) | `book_id → k_t_books(id)` |
| `k_t_badges` | `id` (uuid) | — |
| `k_t_user_badges` | `user_id + badge_id` | `user_id → k_t_users(id)`, `badge_id → k_t_badges(id)` |
| `k_t_book_comments` | `id` | `user_id → k_t_users(id)`, `book_isbn → k_t_book_editions(isbn)` |

> **Not:** `k_t_book_comments` tablosu `DATABASE_SCHEMA.md`'de henüz belgelenmemiş. Sütunları: `id`, `book_isbn`, `user_id`, `comment_text`, `status`, `created_at`.

---

## 13) Operasyon Notu

Bu dosya düzenli aralıklarla checkpoint olarak güncellenir.
- Her önemli adım sonrası: ne değişti, hangi dosyada değişti, hangi davranış artık standart oldu net olarak işlenir.
- Bu disiplin proje yönünü korur ve ekipler arası bağlam kaybını azaltır.

```

## Projenin Mevcut Durumu (Kısa Özet)

**Nerede kaldın:**
- Frontend (öğrenci tarafı) büyük ölçüde tamamlanmış: dashboard, kitaplarım, kütüphane, rozetler, sıralama, kitap ekleme, barkod okutma, kitap detay/yorum hepsi çalışıyor.
- Backend (n8n) 17 aksiyonla canlı çalışıyor.

**Kritik eksikler:**
1. `undo_read_log` backend'de yok (frontend çağırıyor ama sessizce fail oluyor)
2. Raporlar sayfası sadece dashboard'u duplicate ediyor
3. Auth güvenliği → token/session yok
4. Şifre düz metin olarak saklanıyor

**En değerli sonraki adımlar:**
1. `undo_read_log` aksiyonunu Smart SQL Builder'a ekle
2. Raporlar sayfasını gerçek filtreleme/PDF ile yeniden yaz
3. Profil düzenleme (şifre değiştirme) ekle
4. Yönetici panelinde sınıf bazlı filtreleme
