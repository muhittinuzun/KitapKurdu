# Kitap Ligi - 8 Mart Checkpoint Raporu

## Ozet

Bu checkpointte dokumantasyon gercek kod davranisina gore yeniden hizalandi. Ozellikle `sistem_doc.md` icindeki tekrarlar temizlendi, cakisali ifadeler duzeltildi ve onboarding odakli tekil bir teknik referans olusturuldu.

---

## Yapilanlar

1. **`sistem_doc.md` yeniden duzenlendi**
   - Birlesmis/tekrarlanan iki farkli surum tek dosyada konsolide edildi.
   - Basliklar, kapsam ve kural seti sadeleştirildi.
   - "Canli durum" bolumu kod tabaniyla hizalandi.

2. **Kritik teknik gercekler netlestirildi**
   - ISBN fallback sirasi acik ve sabit yazildi: `Lokal -> Google -> Kitapyurdu -> D&R -> Nihai kontrol`.
   - Kitap ekleme modalinin premium UX akisi net dokumante edildi (barkod, loader, onay karti, manuel giris).
   - Rozet kaliciligi (`sync_user_badges` -> `k_t_user_badges`) netlestirildi.
   - Mobilde sidebarin kapali olmasi ve alt menunun tek navigasyon katmani oldugu sabitlendi.

3. **API cagri standardi standartlastirildi**
   - `apiCall('fetch_book_by_isbn', { isbn })`
   - `apiCall('add_book_edition', { ... })`
   - Bu iki kullanim onboarding icin "ekip standardi" olarak aciklandi.

4. **Undo davranisi catisma yaratmayacak sekilde guncellendi**
   - Backendde `undo_read_log` aksiyonunun tanimli oldugu belirtildi.
   - Frontendin bu cagiriyi yaptigi, ancak MVP'de lokal fallback ile ilerledigi yazildi.

5. **`8 Mart  Rapor.md` checkpoint formatina cekildi**
   - Ozet, yapilanlar, dogrulamalar, acik konular ve sonraki adimlar basliklariyla yeniden yazildi.

---

## Dogrulamalar

- `api_akisi.json`: `undo_read_log` SQL Builder icinde tanimli.
- `app.js`: ISBN akisi `apiCall('fetch_book_by_isbn', { isbn })` ile calisiyor.
- `app.js`: kitap ekleme onayi `apiCall('add_book_edition', { ... })` ile kaydediyor.
- `app.js` + `index.html`: `html5-qrcode` ile barkod akisi aktif.
- `style.css`: mobilde `#desktop-sidebar` zorunlu kapali.
- `api_akisi.json`: fallback zinciri Lokal -> Google -> Kitapyurdu -> D&R -> Nihai kontrol sekline uygun.

---

## Acik Konular

1. Yetkili raporlama ekrani halen stub seviyesinde.
2. Auth/session ve sifre guvenligi sertlestirmesi gerekli.
3. `app.js` buyuk tek dosya oldugu icin modulerlesme ihtiyaci suruyor.
4. Dis kaynak HTML degisimleri fallback parserlarini etkileyebilir.

---

## Sonraki Adimlar

1. Yetkili raporlama (filtre, tarih araligi, disa aktarma) gelistirilecek.
2. Auth ve sifre guvenligi sertlestirmesi planlanacak.
3. `app.js` modulerlesme backlogu acilacak.
4. ISBN fallback icin kaynak bazli regresyon checklist'i yazilacak.
