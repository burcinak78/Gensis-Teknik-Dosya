-- ============================================================
-- 21_ilgili_idare_sehir.sql
-- İlgili İdareler: şehir (province) bağlantısı + son ek (belediye/baskanlik).
-- Ana liste şehir bazlı akordiyon için province_id kullanır.
-- Belgeler dilekçe son ekini isim sonundan türetir; suffix yalnız düzenleme
-- formunda son-ek dropdown'ını önseçmek için tutulur.
-- Supabase SQL editöründe çalıştırın. (13 ve 14 çalıştırılmış olmalı.)
-- ============================================================
alter table public.ilgili_idareler add column if not exists province_id int references public.provinces(id);
alter table public.ilgili_idareler add column if not exists suffix text not null default 'belediye';

-- Mevcut "<İlçe> Belediyesi" kayıtlarını ilgili ile eşle
update public.ilgili_idareler i
   set province_id = d.province_id
  from public.districts d
 where i.province_id is null
   and i.name = trim(d.name) || ' Belediyesi';

-- Mevcut "<İl> Belediyesi" kayıtlarını ile eşle
update public.ilgili_idareler i
   set province_id = p.id
  from public.provinces p
 where i.province_id is null
   and i.name = trim(p.name) || ' Belediyesi';

create index if not exists ilgili_idareler_province_idx on public.ilgili_idareler(province_id);
