-- ============================================================
-- 12_ornek_temizle.sql — Örnek/test kayıtlarını temizle
-- Supabase SQL editöründe çalıştırın.
-- NOT: Bu işlem geri alınamaz. Önce SELECT ile kayıtları görün.
-- Depodaki (storage) dosyalar bu SQL ile silinmez; yalnız DB kayıtları silinir.
-- ============================================================

-- ---------- 1) Proje Onay örnek kayıtları ----------
-- Önce görün:
--   select id, dosya_no, yapi_sahibi, created_at from public.proje_onay order by created_at;
-- Tüm Proje Onay kayıtlarını sil (yalnız 2 örnek varsa hepsini temizler):
delete from public.proje_onay;

-- (Alternatif) Yalnız belirli kayıtları silmek isterseniz, yukarıdaki DELETE yerine:
--   delete from public.proje_onay where id in ('UUID-1', 'UUID-2');

-- ---------- 2) Proje Takip + bağlı Muhasebe kayıtları ----------
-- takip_dokumanlar ve takip_muhasebe, takip_projeler'e ON DELETE CASCADE bağlı;
-- takip_projeler silinince ikisi de otomatik silinir. Yine de açıkça temizliyoruz.
delete from public.takip_muhasebe;
delete from public.takip_dokumanlar;
delete from public.takip_projeler;
