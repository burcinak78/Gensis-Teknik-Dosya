-- ============================================================
-- 10_ok_temizle.sql
-- Onaylanmış Kuruluş listesinden seed'den gelen hatalı kayıtları sil:
-- adı veya kimlik no'su "2014/33" ile başlayanlar (Note 7).
-- Önce referanslar çözülür, sonra silinir (FK engellemesin).
-- Supabase SQL editöründe tek seferde çalıştırın.
-- ============================================================

begin;

-- Silinecek kuruluşları hedefle
with hedef as (
  select id from public.notified_bodies
   where name like '2014/33%' or identity_no like '2014/33%'
)
-- Sertifika referanslarını çöz
update public.certificates set notified_body_id = null
 where notified_body_id in (select id from hedef);

update public.company_documents set notified_body_id = null
 where notified_body_id in (select id from public.notified_bodies
                              where name like '2014/33%' or identity_no like '2014/33%');

delete from public.notified_bodies
 where name like '2014/33%' or identity_no like '2014/33%';

commit;

-- Kontrol: kalan var mı?
-- select id, identity_no, name from public.notified_bodies where name like '2014/33%' or identity_no like '2014/33%';
