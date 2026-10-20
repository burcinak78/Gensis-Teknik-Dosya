-- ============================================================
-- 19_takip_asansor_seri.sql
-- Proje Takip kaydına "Asansör Seri No" alanı (opsiyonel, boş bırakılabilir).
-- Supabase SQL editöründe çalıştırın.
-- ============================================================
alter table public.takip_projeler add column if not exists asansor_seri_no text;
