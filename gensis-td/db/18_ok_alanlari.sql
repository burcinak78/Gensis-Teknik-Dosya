-- ============================================================
-- 18_ok_alanlari.sql
-- Onaylanmış Kuruluş (notified_bodies) için yeni alanlar:
--   short_name (kısa ad), city (şehir), country (ülke)
-- Belgelerde artık OK Kısa Ad kullanılır; ticari ünvan (name) korunur.
-- Mevcut kayıtlarda kısa ad boşsa ünvandan türetilir (geçici varsayılan).
-- Supabase SQL editöründe çalıştırın.
-- ============================================================
alter table public.notified_bodies add column if not exists short_name text;
alter table public.notified_bodies add column if not exists city text;
alter table public.notified_bodies add column if not exists country text;

update public.notified_bodies
   set short_name = name
 where short_name is null or btrim(short_name) = '';
