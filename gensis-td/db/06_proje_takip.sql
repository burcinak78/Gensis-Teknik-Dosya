-- ============================================================
-- 06_proje_takip.sql
-- Proje Takip + Muhasebe modülü şeması
-- Supabase SQL editöründe çalıştırın (bir kez).
-- ============================================================

-- ---------- 1) muhasebeci rolü ----------
-- profiles.role bir ENUM (app_role) tipidir; yeni değeri ekle.
-- ÖNEMLİ: Bu satırı TEK BAŞINA çalıştırın (aşağıdaki 2-6. adımlardan ÖNCE).
-- Bazı ortamlarda ALTER TYPE ADD VALUE, aynı transaction içindeki diğer
-- komutlarla birlikte çalıştırılamaz.
alter type app_role add value if not exists 'muhasebeci';

-- ---------- 2) Proje No sayacı (değiştirilebilir) ----------
create table if not exists public.takip_counter (
  id      int primary key default 1,
  next_no int not null default 1001,
  constraint takip_counter_single check (id = 1)
);
insert into public.takip_counter (id, next_no) values (1, 1001)
  on conflict (id) do nothing;

-- Başlangıç numarasını değiştirmek için (örn. 5000'den başlat):
--   update public.takip_counter set next_no = 5000 where id = 1;

-- Sıradaki proje numarasını atomik olarak üret
create or replace function public.next_takip_no()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v int;
begin
  update public.takip_counter
     set next_no = next_no + 1
   where id = 1
   returning next_no - 1 into v;
  if v is null then
    insert into public.takip_counter (id, next_no) values (1, 1002)
      on conflict (id) do update set next_no = public.takip_counter.next_no + 1
      returning next_no - 1 into v;
  end if;
  return v;
end $$;

-- ---------- 3) Proje Takip ana tablosu ----------
create table if not exists public.takip_projeler (
  id                    uuid primary key default gen_random_uuid(),
  proje_no              int unique not null,
  proje_tipi            text not null check (proje_tipi in ('mimari','uygulama')),
  siparis_tarihi        date,
  company_id            uuid references public.companies(id),
  ada_parsel            text,
  ada                   text,
  parsel                text,
  is_adi                text,
  asansor_sayisi        int,
  asansor_tipi          text check (asansor_tipi in ('MR','MRL','HD_YUK','HD_INSAN')),
  province_id           int,
  district_id           text,
  il_adi                text,
  ilce_adi              text,
  fiyat                 numeric(14,2),
  fatura_tipi           text check (fatura_tipi in ('faturali','faturasiz')),
  toplam_tutar          numeric(14,2),
  proje_sorumlusu_id    uuid references public.profiles(id),
  tahmini_tamamlanma    date,
  durum                 text not null default 'HAZIRLANIYOR'
                          check (durum in ('HAZIRLANIYOR','BEKLIYOR','TAMAMLANDI')),
  bekliyor_aciklama     text,
  tamamlanma_tarihi     date,
  teslim_tipi           text check (teslim_tipi in ('hard_copy','dijital')),
  hard_copy_adedi       int,
  muhasebeye_gonderildi boolean not null default false,
  muhasebe_durumu       text check (muhasebe_durumu in ('bekliyor','tamamlandi')),
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists takip_projeler_sorumlu_idx on public.takip_projeler(proje_sorumlusu_id);
create index if not exists takip_projeler_muh_idx on public.takip_projeler(muhasebeye_gonderildi, muhasebe_durumu);
-- Mevcut tabloya ada/parsel kolonlarını ekle (daha önce oluşturulmuşsa)
alter table public.takip_projeler add column if not exists ada text;
alter table public.takip_projeler add column if not exists parsel text;

-- ---------- 4) Proje dokümanları (çoklu yükleme) ----------
-- kind: mimari_proje | elektrik_projesi | statik_projesi | olcu_formu | yapi_ruhsati | diger | tamamlanan_proje
create table if not exists public.takip_dokumanlar (
  id            uuid primary key default gen_random_uuid(),
  takip_id      uuid not null references public.takip_projeler(id) on delete cascade,
  kind          text not null,
  storage_path  text not null,
  original_name text,
  uploaded_by   uuid,
  created_at    timestamptz not null default now()
);
create index if not exists takip_dokumanlar_takip_idx on public.takip_dokumanlar(takip_id);

-- ---------- 5) Muhasebe işlemleri ----------
create table if not exists public.takip_muhasebe (
  id             uuid primary key default gen_random_uuid(),
  takip_id       uuid not null unique references public.takip_projeler(id) on delete cascade,
  fatura_tarihi  date,
  fatura_no      text,
  cariye_islendi boolean not null default false,
  teslim_yontemi text check (teslim_yontemi in ('elden','kargo')),
  kargo_sirketi  text,
  kargo_takip_no text,
  teslim_tarihi  date,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- 6) RLS ----------
-- Erişim uygulama tarafında service-role (admin client) + rol geçidi ile yönetilir.
-- RLS açık + politika yok = anon/auth doğrudan okuyamaz (varsayılan reddet).
alter table public.takip_projeler   enable row level security;
alter table public.takip_dokumanlar enable row level security;
alter table public.takip_muhasebe   enable row level security;
alter table public.takip_counter    enable row level security;
