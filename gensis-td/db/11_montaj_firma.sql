-- ============================================================
-- 11_montaj_firma.sql — "Diğer" müşteriye montaj firması bağlama
-- Supabase SQL editöründe çalıştırın.
-- ============================================================

-- Diğer kategorideki müşteri, mevcut müşteri listesinden bir montaj firması ile ilişkilenir.
alter table public.companies
  add column if not exists montaj_firma_id uuid references public.companies(id) on delete set null;
