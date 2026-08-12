-- ============================================================
-- 07_yonetim.sql — Yönetim modülü revizyonu
-- Supabase SQL editöründe çalıştırın.
-- ============================================================

-- ---------- Aşama 3: Mühendislik tipleri ----------
-- engineers.discipline artık 4 değer alabilmeli:
--   makine, elektrik, elektrik_elektronik, mekatronik
-- Mevcut CHECK kısıtı varsa kaldırıp yenisini ekle (discipline TEXT ise).
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.engineers'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%discipline%'
  loop
    execute format('alter table public.engineers drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.engineers
  add constraint engineers_discipline_check
  check (discipline in ('makine','elektrik','elektrik_elektronik','mekatronik'));
-- NOT: Eğer engineers.discipline bir ENUM tipi ise, yukarıdaki yerine:
--   alter type <enum_adi> add value if not exists 'elektrik_elektronik';
--   alter type <enum_adi> add value if not exists 'mekatronik';
