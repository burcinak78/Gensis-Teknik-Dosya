-- ============================================================
-- 20_notlar.sql
-- Kişisel notlar — her kullanıcı yalnızca kendi notlarını görür/düzenler.
-- 3 gün ve üzeri bekleyen not arayüzde kırmızıya düşer; "Ertele" sayaç
-- başlangıcını bugüne çeker (3 gün yeniden sayılır).
-- Supabase SQL editöründe çalıştırın.
-- ============================================================
create table if not exists public.notlar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  icerik text not null,
  sayac_baslangic timestamptz not null default now(), -- 3 günlük sayacın başladığı an (ertele ile güncellenir)
  created_at timestamptz not null default now()
);
create index if not exists notlar_user_idx on public.notlar(user_id);

alter table public.notlar enable row level security;

drop policy if exists notlar_select on public.notlar;
create policy notlar_select on public.notlar for select using (user_id = auth.uid());
drop policy if exists notlar_insert on public.notlar;
create policy notlar_insert on public.notlar for insert with check (user_id = auth.uid());
drop policy if exists notlar_update on public.notlar;
create policy notlar_update on public.notlar for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notlar_delete on public.notlar;
create policy notlar_delete on public.notlar for delete using (user_id = auth.uid());
