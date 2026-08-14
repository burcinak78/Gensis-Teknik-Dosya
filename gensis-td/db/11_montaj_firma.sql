-- ============================================================
-- 11_montaj_firma.sql — Proje bazlı montaj firması bağlama
-- Supabase SQL editöründe çalıştırın.
-- ============================================================

-- Proje Takip kaydında, seçilen firma "Diğer" kategorisindeyse bağlanan montaj firması.
-- (Müşteri kaydına DEĞİL, projeye bağlıdır.)
alter table public.takip_projeler
  add column if not exists montaj_firma_id uuid references public.companies(id) on delete set null;
