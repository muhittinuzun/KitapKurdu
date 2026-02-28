# Kitap Ligi - Sistem Dokümantasyonu

## 1) Proje Özeti

`Kitap Ligi`, öğrencilerin kitap okuma alışkanlığını oyunlaştırma yaklaşımıyla takip etmeyi hedefleyen bir web uygulaması prototipidir. Tek sayfa uygulama (SPA benzeri) yaklaşımıyla, `index.html + app.js + style.css` üzerinden çalışır.

- **Frontend:** Vanilla JavaScript + Tailwind CSS (CDN)
- **Backend entegrasyonu:** n8n webhook (`POST`) + PostgreSQL sorgulama akışı
- **Ana roller:** Öğrenci, öğretmen/yönetici (frontend tarafında role tabanlı görünüm)
- **Temel hedefler:** giriş/kayıt, okuma takibi, kütüphane, sıralama, yönetici paneli

---

## 2) Mevcut Dosya Yapısı ve Sorumluluklar

- `index.html`
  - Uygulama iskeleti (sidebar, header, mobile bottom nav, content area)
  - Dış bağımlılıklar: Tailwind CDN, Lucide, Chart.js, Canvas Confetti
  - Uygulama giriş noktası: `app.js`

- `style.css`
  - Özel yardımcı sınıflar, animasyonlar, scrollbar ayarları, glass efekti

- `app.js`
  - Tüm durum yönetimi (`AppState`)
  - Route/view geçişleri
  - API client (`apiCall`)
  - Login, register, grup çözümleme, dashboardlar, toast, tema, okuma logu, barkod tarama

- `api_akisi.json`
  - n8n workflow tanımı (Webhook -> SQL Builder -> Postgres -> Respond)
  - Dinamik SQL oluşturan node + whitelist güvenlik kontrolü

- `DATABASE_SCHEMA.md`
  - Beklenen veri tabanı tabloları ve alanları

---

## 3) Mimari ve Çalışma Prensibi

## 3.1 Frontend Akışı

1. `DOMContentLoaded` ile `initApp()` çalışır.
2. LocalStorage’dan kullanıcı ve tema yüklenir (`kl_user`, `kl_theme`).
3. Auth durumuna göre ekrana:
   - `login`
   - `student_dashboard`
   - `authority_dashboard`
   yönlendirmesi yapılır.
4. Tüm sayfa görünümleri `navigate()` içinde `view-container` içine HTML string olarak render edilir.

## 3.2 Durum Yönetimi

- Global state: `AppState`
  - `user`
  - `theme`
  - `currentView`
  - `data` (active book, leaderboard, groups vb.)
- Persist edilen alanlar:
  - `kl_user`
  - `kl_theme`

## 3.3 Backend/API Akışı

- Endpoint: `https://n8n.ittyazilim.com/webhook/kitap-ligi-api`
- İstek formatı:
  - `POST`
  - JSON body: `{ action: "...", ...params, user_id? }`
- n8n içinde:
  1. `Webhook` isteği alır
  2. `Smart SQL Builder` aksiyona göre query/params üretir
  3. `Universal Executor` Postgres query çalıştırır
  4. `Respond Success` `{ status, resource, data }` döner

---

## 4) Uygulamada Tamamlanan Özellikler

## 4.1 Kimlik Doğrulama ve Hesap

- Login formu (e-posta/şifre)
- Kayıt ekranı:
  - Katılım kodu ile sınıf doğrulama
  - Manuel hiyerarşik grup seçimi (il > ilçe > okul > sınıf > şube)
- Role göre tema ve panel yönlendirmesi
- Çıkış (logout)

## 4.2 Öğrenci Deneyimi

- Öğrenci dashboard (profil, aktif kitap, ilerleme çubuğu)
- Okuma ilerlemesi ekleme modalı
- Sesli not giriş desteği (`webkitSpeechRecognition`)
- Sıralama ekranı (görsel olarak hazırlanmış, büyük kısmı mock veri)
- Kitaplarım ekranı (çoğunlukla mock gösterim)

## 4.3 Kütüphane

- Kütüphane listeleme (`read` action ile `k_t_books` çağrısı)
- Yeni kitap ekleme formu
- ISBN barkod tarama (`BarcodeDetector`, kamera erişimi)

## 4.4 Yönetici/Yetkili Ekranı

- Yönetici dashboard görsel bileşenleri
- İstatistik kartları (mock)
- Trend chart (Chart.js, mock data)
- Sınıf sıralama tablosu (mock)

## 4.5 UI/UX ve Teknik Katman

- Responsive tasarım (desktop sidebar + mobile bottom nav)
- Toast bildirim sistemi
- Tema geçişi (`child` / `academic`)
- Lucide ikon entegrasyonu
- Confetti kutlama efekti (okuma kaydı sonrası)

---

## 5) API Aksiyonları - Frontend ve n8n Uyum Durumu

## 5.1 Frontend'in çağırdığı aksiyonlar

- `login`
- `register`
- `resolve_code`
- `get_groups`
- `add_book_edition`
- `read`
- `log_read`

## 5.2 n8n SQL Builder içinde tanımlı görünen aksiyonlar

- `get_groups`
- `resolve_code`
- `login`
- `read`

## 5.3 Kritik Uyum Notları

- `register`, `add_book_edition`, `log_read` aksiyonları frontend’de çağrılıyor; ancak `api_akisi.json` SQL builder kodunda bu aksiyonlara karşılık görünmüyor.
- `read` sorgusunda `limit` frontend’den gönderilse de SQL builder kodu içinde `LIMIT` uygulanmıyor (mevcut kodda sadece `order` işleniyor).
- SQL builder whitelist’inde `k_t_books` ve `k_t_book_editions` yok; frontend `read` ile `k_t_books` kullanıyor. Bu haliyle güvenlik kontrolüne takılma riski var.
- `login` sorgusu `id, full_name, email, password_hash, telegram_id` döndürüyor; frontend tarafı `role` ve `group_id` bekliyor. Role tabanlı yönlendirme için veri sözleşmesi eksik.

---

## 6) Veritabanı Modeli (Özet)

`DATABASE_SCHEMA.md` dosyasına göre temel varlıklar:

- Kullanıcılar: `k_t_users`
- Hiyerarşik grup yapısı: `k_t_groups`
- Okuma kayıtları: `k_t_read_logs`
- Kitap ana bilgileri: `k_t_books`
- Kitap basımları/ISBN: `k_t_book_editions`
- Rozet sistemi: `k_t_badges`, `k_t_user_badges`

İlişkiler ve kolon adları frontend ile genel olarak uyumlu tasarlanmış; ancak API tarafındaki aksiyon kapsamı henüz tüm kullanım senaryolarını karşılamıyor.

---

## 7) Bilinen Eksikler ve Riskler

1. **Backend aksiyon kapsaması eksikliği**
   - Frontend’de var olan bazı işlemler backend akışında karşılıksız.

2. **Mock veri bağımlılığı**
   - Leaderboard, kitaplarım, yönetici paneli gibi alanlar büyük ölçüde gerçek API’ye bağlı değil.

3. **Kimlik doğrulama güvenliği**
   - Frontend login akışında password hash doğrulama mantığı görünmüyor.
   - Session/token doğrulama mekanizması henüz net değil.

4. **Rol normalizasyonu**
   - Şemada roller `Student/Teacher/Admin`, frontend’de `student/teacher` gibi kullanım var; dönüşüm/standartlaştırma katmanı yok.

5. **Tarayıcı bağımlı özellikler**
   - `webkitSpeechRecognition` ve `BarcodeDetector` her tarayıcıda desteklenmeyebilir.

---

## 8) Çalıştırma ve Geliştirme Notları

Bu proje şu an için statik dosya yapısında çalışıyor:

1. Proje dizinini açın.
2. Basit bir static server ile yayınlayın (örn. Live Server).
3. `index.html` üzerinden uygulamayı açın.
4. API erişimi için n8n endpoint’inin aktif olması gerekir.

Önemli: Doğrudan dosya (`file://`) açma, kamera/mikrofon özelliklerinde kısıt yaratabilir.

---

## 9) Kısa Yol Haritası (Öneri)

1. n8n SQL builder aksiyonlarını frontend ile tam uyumlu hale getir:
   - `register`, `add_book_edition`, `log_read`, `read + limit`
2. `login` dönüşüne `role`, `group_id` gibi zorunlu alanları ekle.
3. Mock ekranları gerçek veri ile besle (leaderboard, student stats, authority reports).
4. Rol/enum mapping standardını netleştir (`Student` vs `student`).
5. Hata yönetimi ve yetkilendirme kontrollerini güçlendir (token/session).

---

## 10) Sonuç

Proje, ürün fikrini güçlü bir UI/UX prototipi ile çalışan bir frontend omurgasına taşımış durumda. En kritik ihtiyaç, frontend’de hazır olan kullanıcı akışlarının backend workflow tarafında birebir karşılığının tamamlanmasıdır. Bu tamamlandığında proje, prototipten üretime yakın bir MVP seviyesine hızlıca ilerleyebilir.
