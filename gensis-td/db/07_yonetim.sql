-- ============================================================
-- 07_yonetim.sql — Yönetim modülü revizyonu
-- Supabase SQL editöründe çalıştırın.
-- ============================================================

-- ---------- Aşama 3: Mühendislik tipleri ----------
-- engineers.discipline bir ENUM (engineer_discipline). Yeni değerleri ekle.
-- ÖNEMLİ: Bu iki satırı TEK BAŞINA çalıştırın (aşağıdaki diğer komutlardan ÖNCE).
alter type engineer_discipline add value if not exists 'elektrik_elektronik';
alter type engineer_discipline add value if not exists 'mekatronik';

-- ---------- Aşama 4: Müşteri kategorisi ----------
-- Asansör / Diğer kategori + Diğer için sektör/meslek alanı
alter table public.companies add column if not exists category text not null default 'asansor';
alter table public.companies add column if not exists sector text;
-- Mevcut kayıtlar otomatik 'asansor' kategorisinde olur.

-- ---------- Aşama 5: Güvenlik Ekipmanları ----------
-- Sertifikaya belge tipi + kategori
alter table public.certificates add column if not exists belge_tipi text;
alter table public.certificates add column if not exists category_id uuid references public.equipment_categories(id);

-- Model ↔ Sertifika çoklu bağlama
create table if not exists public.model_certificates (
  model_id       uuid not null references public.equipment_models(id) on delete cascade,
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  primary key (model_id, certificate_id)
);
-- Okuma uygulama tarafında service-role ile yapılır; RLS açık (deny-by-default).
alter table public.model_certificates enable row level security;
