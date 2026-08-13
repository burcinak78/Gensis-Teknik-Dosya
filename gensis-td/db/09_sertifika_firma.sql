-- ============================================================
-- 09_sertifika_firma.sql
-- Sertifikaya "verildiği firma" alanı (Note 6).
-- Supabase SQL editöründe çalıştırın.
-- ============================================================
alter table public.certificates add column if not exists firma_adi text;
