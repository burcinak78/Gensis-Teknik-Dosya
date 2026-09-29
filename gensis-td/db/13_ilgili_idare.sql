-- ============================================================
-- 13_ilgili_idare.sql — Proje Onay: "İlgili İdare" kayıtları
-- Supabase SQL editöründe çalıştırın.
-- ============================================================

-- İlgili idareler (belediye/OSB/valilik vb.) — dilekçe & taahhütnamelerde kullanılır
create table if not exists public.ilgili_idareler (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  created_at timestamptz not null default now()
);

alter table public.ilgili_idareler enable row level security;

-- Oturum açmış kullanıcılar dropdown için listeyi okuyabilir; yazma service-role ile yapılır.
drop policy if exists ilgili_idareler_read on public.ilgili_idareler;
create policy ilgili_idareler_read on public.ilgili_idareler
  for select to authenticated using (true);

-- Proje onay kaydına seçilen ilgili idare
alter table public.proje_onay
  add column if not exists ilgili_idare_id uuid references public.ilgili_idareler(id);
