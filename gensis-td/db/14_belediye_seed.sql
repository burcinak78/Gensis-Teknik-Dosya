-- ============================================================
-- 14_belediye_seed.sql — İlgili İdareler'e belediye listesini doldur
-- Kaynak: uygulamanın kendi provinces + districts tabloları (güncel & tutarlı).
-- İl belediyeleri + ilçe belediyeleri üretilir ("<Ad> Belediyesi").
-- Idempotent: tekrar çalıştırılırsa yeni kayıt eklemez.
-- (13_ilgili_idare.sql çalıştırılmış olmalı.)
-- Belde belediyeleri kapsam dışıdır; gerekirse Yönetim → İlgili İdareler → "+ Yeni" ile eklenir.
-- ============================================================

-- İlçe belediyeleri
insert into public.ilgili_idareler (name)
select distinct trim(d.name) || ' Belediyesi'
from public.districts d
where coalesce(trim(d.name), '') <> ''
  and not exists (
    select 1 from public.ilgili_idareler i where i.name = trim(d.name) || ' Belediyesi'
  );

-- İl (merkez/büyükşehir) belediyeleri
insert into public.ilgili_idareler (name)
select distinct trim(p.name) || ' Belediyesi'
from public.provinces p
where coalesce(trim(p.name), '') <> ''
  and not exists (
    select 1 from public.ilgili_idareler i where i.name = trim(p.name) || ' Belediyesi'
  );

-- Kontrol: select count(*) from public.ilgili_idareler;
