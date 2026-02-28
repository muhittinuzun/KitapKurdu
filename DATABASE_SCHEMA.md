# Kitap Ligi Veritabanı Şeması

Bu dosya, n8n webhook'ları ve frontend uygulamasının beklediği veri yapısını tanımlar. Tabloların yapısı belirtilen Google Sheets dökümanından alınmıştır.

## Tablolar ve Sütunlar

### `k_t_users` (Kullanıcılar)
| Sütun Adı | Veri Tipi | Boş Olabilir mi? | İlişki (FK) / Notlar |
| :--- | :--- | :--- | :--- |
| `id` | uuid | HAYIR | Primary Key (PK) |
| `email` | character varying | HAYIR | Kullanıcı e-postası |
| `password_hash` | text | HAYIR | Şifre özeti |
| `full_name` | character varying | HAYIR | Ad Soyad |
| `telegram_id` | bigint | EVET | Opsiyonel bağlantı |
| `group_id` | uuid | EVET | `-> k_t_groups(id)` |
| `role` | character varying | EVET | Enum: "Student", "Teacher", "Admin" |
| `telefon_no` | text | EVET | Telefon Numarası |
| `created_at` | timestamp with tz | EVET | Kayıt tarihi |
| `last_login` | timestamp with tz | EVET | Son giriş |

### `k_t_groups` (Sınıf ve Okul Hiyerarşisi)
| Sütun Adı | Veri Tipi | Boş Olabilir mi? | İlişki (FK) / Notlar |
| :--- | :--- | :--- | :--- |
| `id` | uuid | HAYIR | Primary Key (PK) |
| `parent_id` | uuid | EVET | `-> k_t_groups(id)` (Hiyerarşi) |
| `name` | character varying | HAYIR | Grup/Sınıf İsmi |
| `type` | character varying | HAYIR | Enum: "city", "district", "school", "class" |
| `grade_level` | integer | EVET | Sınıf Seviyesi (1-12) |
| `join_code` | character varying | EVET | Sınıf Davet Kodu |
| `created_at` | timestamp with tz | EVET | - |

### `k_t_read_logs` (Okuma Geçmişi)
| Sütun Adı | Veri Tipi | Boş Olabilir mi? | İlişki (FK) / Notlar |
| :--- | :--- | :--- | :--- |
| `id` | uuid | HAYIR | Primary Key (PK) |
| `user_id` | uuid | EVET | `-> k_t_users(id)` |
| `book_isbn` | character varying | EVET | `-> k_t_book_editions(isbn)` |
| `pages_read` | integer | HAYIR | Okunan sayfa |
| `read_date` | date | EVET | Okuma günü |
| `note` | text | EVET | Kullanıcı yorumu |
| `created_at` | timestamp with tz | EVET | - |

### `k_t_books` (Kitap Genel Bilgileri)
| Sütun Adı | Veri Tipi | Boş Olabilir mi? | İlişki (FK) / Notlar |
| :--- | :--- | :--- | :--- |
| `id` | uuid | HAYIR | Primary Key (PK) |
| `title` | character varying | HAYIR | Kitap Adı |
| `author` | character varying | EVET | Yazar |
| `category` | character varying | EVET | Kategori/Tür |
| `created_at` | timestamp with tz | EVET | - |

### `k_t_book_editions` (Kitap Basımları)
| Sütun Adı | Veri Tipi | Boş Olabilir mi? | İlişki (FK) / Notlar |
| :--- | :--- | :--- | :--- |
| `isbn` | character varying | HAYIR | Primary Key (PK) |
| `book_id` | uuid | EVET | `-> k_t_books(id)` |
| `page_count` | integer | HAYIR | Toplam Sayfa |
| `thumbnail_url` | text | EVET | Kapak Görseli URL |
| `publisher` | character varying | EVET | Yayınevi |

### `k_t_badges` (Rozetler Başarımlar)
| Sütun Adı | Veri Tipi | Boş Olabilir mi? | İlişki (FK) / Notlar |
| :--- | :--- | :--- | :--- |
| `id` | uuid | HAYIR | Primary Key (PK) |
| `name` | character varying | HAYIR | Rozet İsmi |
| `description` | text | EVET | Kazanma Şartı |
| `icon_key` | character varying | EVET | Lucide Icon ID |
| `requirement_type` | character varying | EVET | "total_pages, vb." |
| `requirement_value` | integer | EVET | Hedef Sayı |

### `k_t_user_badges` (Kullanıcının Kazandığı Rozetler)
| Sütun Adı | Veri Tipi | Boş Olabilir mi? | İlişki (FK) / Notlar |
| :--- | :--- | :--- | :--- |
| `user_id` | uuid | HAYIR | `-> k_t_users(id)` |
| `badge_id` | uuid | HAYIR | `-> k_t_badges(id)` |
| `earned_at` | timestamp with tz | EVET | Kazanma Zamanı |

---
*Bu dosya, Kitap Ligi projesi geliştirilirken referans olarak kullanılacaktır. Frontend ve API entegrasyonları bu isimlendirmelere (`full_name`, `pages_read`, vb.) uygun olarak yapılmalıdır.*
