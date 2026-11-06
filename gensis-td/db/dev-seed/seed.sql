-- ============================================================
-- dev-seed/seed.sql — made-up test data for the DEV database (never prod).
--
-- * Schema: the EF schema (backend migrations up to AddDocumentLibrary). Run after the backend has migrated.
-- * Nothing is copied from the live system. Companies, people, equipment and certificates are invented:
--   names start with "TEST-", e-mail addresses end with "@example.com".
-- * Idempotent: every row has a fixed id (7e57xxxx-...) and is inserted with ON CONFLICT DO NOTHING,
--   so a second run adds nothing. To change a seeded row, run rollback.sql first, then this file again.
-- * Passwords are not in this file: the test users get the password in env SEED_PASSWORD (>= 10 chars).
-- * Reference data (provinces, a few districts, their municipalities, equipment categories, capacity table)
--   is not "TEST-" data and stays after rollback.sql.
-- * Documents of the Proje Takip rows need their files in MinIO: see upload-files.sh / files.txt.
--
-- Run (on the server, in the compose directory):
--   SEED_PASSWORD='...' docker compose -f docker-compose.server.yml exec -T -e SEED_PASSWORD db \
--     sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < seed.sql
--
-- Gensis test company (GENSIS_COMPANY_ID for dev): 7e570001-0000-4000-8000-000000000001
-- ============================================================

\getenv seed_password SEED_PASSWORD
\if :{?seed_password}
\else
  \echo 'SEED_PASSWORD is not set: nothing was written.'
  \quit
\endif
SELECT length(:'seed_password') >= 10 AS seed_password_ok \gset
\if :seed_password_ok
\else
  \echo 'SEED_PASSWORD must be at least 10 characters: nothing was written.'
  \quit
\endif

BEGIN;

-- ---------- Reference data (kept by rollback.sql) ----------

INSERT INTO public.provinces (id, name) VALUES
  (1,'Adana'),(2,'Adıyaman'),(3,'Afyonkarahisar'),(4,'Ağrı'),(5,'Amasya'),(6,'Ankara'),(7,'Antalya'),(8,'Artvin'),
  (9,'Aydın'),(10,'Balıkesir'),(11,'Bilecik'),(12,'Bingöl'),(13,'Bitlis'),(14,'Bolu'),(15,'Burdur'),(16,'Bursa'),
  (17,'Çanakkale'),(18,'Çankırı'),(19,'Çorum'),(20,'Denizli'),(21,'Diyarbakır'),(22,'Edirne'),(23,'Elazığ'),
  (24,'Erzincan'),(25,'Erzurum'),(26,'Eskişehir'),(27,'Gaziantep'),(28,'Giresun'),(29,'Gümüşhane'),(30,'Hakkari'),
  (31,'Hatay'),(32,'Isparta'),(33,'Mersin'),(34,'İstanbul'),(35,'İzmir'),(36,'Kars'),(37,'Kastamonu'),(38,'Kayseri'),
  (39,'Kırklareli'),(40,'Kırşehir'),(41,'Kocaeli'),(42,'Konya'),(43,'Kütahya'),(44,'Malatya'),(45,'Manisa'),
  (46,'Kahramanmaraş'),(47,'Mardin'),(48,'Muğla'),(49,'Muş'),(50,'Nevşehir'),(51,'Niğde'),(52,'Ordu'),(53,'Rize'),
  (54,'Sakarya'),(55,'Samsun'),(56,'Siirt'),(57,'Sinop'),(58,'Sivas'),(59,'Tekirdağ'),(60,'Tokat'),(61,'Trabzon'),
  (62,'Tunceli'),(63,'Şanlıurfa'),(64,'Uşak'),(65,'Van'),(66,'Yozgat'),(67,'Zonguldak'),(68,'Aksaray'),(69,'Bayburt'),
  (70,'Karaman'),(71,'Kırıkkale'),(72,'Batman'),(73,'Şırnak'),(74,'Bartın'),(75,'Ardahan'),(76,'Iğdır'),(77,'Yalova'),
  (78,'Karabük'),(79,'Kilis'),(80,'Osmaniye'),(81,'Düzce')
ON CONFLICT DO NOTHING;

INSERT INTO public.districts (id, province_id, name) VALUES
  ('7e570013-0000-4000-8000-000000000001', 34, 'Kadıköy'),
  ('7e570013-0000-4000-8000-000000000002', 34, 'Üsküdar'),
  ('7e570013-0000-4000-8000-000000000003', 34, 'Beşiktaş'),
  ('7e570013-0000-4000-8000-000000000004', 34, 'Şişli'),
  ('7e570013-0000-4000-8000-000000000005', 6, 'Çankaya'),
  ('7e570013-0000-4000-8000-000000000006', 6, 'Keçiören'),
  ('7e570013-0000-4000-8000-000000000007', 6, 'Yenimahalle'),
  ('7e570013-0000-4000-8000-000000000008', 35, 'Bornova'),
  ('7e570013-0000-4000-8000-000000000009', 35, 'Karşıyaka'),
  ('7e570013-0000-4000-8000-000000000010', 35, 'Konak'),
  ('7e570013-0000-4000-8000-000000000011', 16, 'Nilüfer'),
  ('7e570013-0000-4000-8000-000000000012', 16, 'Osmangazi'),
  ('7e570013-0000-4000-8000-000000000013', 7, 'Muratpaşa'),
  ('7e570013-0000-4000-8000-000000000014', 7, 'Konyaaltı'),
  ('7e570013-0000-4000-8000-000000000015', 41, 'İzmit'),
  ('7e570013-0000-4000-8000-000000000016', 41, 'Gebze')
ON CONFLICT DO NOTHING;

-- Municipalities for the seeded provinces and districts (same naming as db/14_belediye_seed.sql).
INSERT INTO public.ilgili_idareler (name, province_id, suffix)
SELECT n.name, n.province_id, 'belediye'
FROM (
  SELECT d.name || ' Belediyesi' AS name, d.province_id FROM public.districts d
  WHERE d.id::text LIKE '7e570013-%'
  UNION
  SELECT p.name || ' Belediyesi', p.id FROM public.provinces p WHERE p.id IN (6, 7, 16, 34, 35, 41)
) n
WHERE NOT EXISTS (SELECT 1 FROM public.ilgili_idareler i WHERE i.name = n.name);

INSERT INTO public.equipment_categories (id, code, name, sort_order, drive_type) VALUES
  ('7e570004-0000-4000-8000-000000000001', 'kabin',          'Kabin',              1, 'both'),
  ('7e570004-0000-4000-8000-000000000002', 'motor',          'Motor',              2, 'elektrik'),
  ('7e570004-0000-4000-8000-000000000003', 'kapi_kilidi',    'Kapı Kilidi',        3, 'both'),
  ('7e570004-0000-4000-8000-000000000004', 'kabin_kilidi',   'Kabin Kapı Kilidi',  4, 'both'),
  ('7e570004-0000-4000-8000-000000000005', 'tampon',         'Tampon',             5, 'both'),
  ('7e570004-0000-4000-8000-000000000006', 'regulator',      'Hız Regülatörü',     6, 'elektrik'),
  ('7e570004-0000-4000-8000-000000000007', 'fren',           'Paraşüt Fren',       7, 'both'),
  ('7e570004-0000-4000-8000-000000000008', 'kumanda',        'Kumanda Panosu',     8, 'both'),
  ('7e570004-0000-4000-8000-000000000009', 'hidrolik_unite', 'Hidrolik Ünite',     9, 'hidrolik')
ON CONFLICT DO NOTHING;

-- Example values for the declared-load table (not taken from any live table).
INSERT INTO public.capacity_table (beyan_yuku_kg, kisi_sayisi, kabin_agirlik_kg, karsi_agirlik_kg) VALUES
  (320, 4, 450, 610), (450, 6, 550, 775), (630, 8, 700, 1015), (800, 10, 850, 1250),
  (1000, 13, 1000, 1500), (1275, 17, 1200, 1840), (1600, 21, 1450, 2250)
ON CONFLICT DO NOTHING;

-- ---------- Made-up test data (removed by rollback.sql) ----------

INSERT INTO public.notified_bodies (id, identity_no, name, short_name, address, city, country) VALUES
  ('7e570002-0000-4000-8000-000000000001', 'T901', 'TEST-Onaylanmış Kuruluş A', 'TEST-OK-A', 'Test Cad. No:1', 'Ankara', 'Türkiye'),
  ('7e570002-0000-4000-8000-000000000002', 'T902', 'TEST-Onaylanmış Kuruluş B', 'TEST-OK-B', 'Test Cad. No:2', 'İstanbul', 'Türkiye')
ON CONFLICT DO NOTHING;

INSERT INTO public.companies (id, short_name, legal_name, address, mobile_phone, contact_mobile_phone, email, city,
  authorized_person, registered_brand, industry_reg_no, industry_reg_date, hyb_date, ce_module, category, sector, montaj_firma_id) VALUES
  ('7e570001-0000-4000-8000-000000000001', 'TEST-GENSIS', 'TEST-Gensis Mühendislik Ltd. Şti.', 'Test Mah. Örnek Sok. No:1 Çankaya',
   '0312 000 00 01', NULL, 'info@gensis.example.com', 'Ankara', 'TEST-Gensis Yetkili', 'TEST-GENSIS', 'TEST-SN-0001',
   '2015-01-15', '2016-03-01', 'B MR, B MRL, E', 'asansor', NULL, NULL),
  ('7e570001-0000-4000-8000-000000000002', 'TEST-ALFA', 'TEST-Alfa Asansör San. ve Tic. Ltd. Şti.', 'Test Mah. Alfa Sok. No:2 Kadıköy',
   '0216 000 00 02', '0500 000 00 02', 'info@alfa.example.com', 'İstanbul', 'TEST-Alfa Yetkili', 'TEST-ALFA', 'TEST-SN-0002',
   '2018-05-10', '2019-02-20', 'B MR, E', 'asansor', NULL, NULL),
  ('7e570001-0000-4000-8000-000000000004', 'TEST-HIZLI', 'TEST-Hızlı Montaj Asansör Ltd. Şti.', 'Test Mah. Hızlı Sok. No:4 Nilüfer',
   '0224 000 00 04', NULL, 'info@hizli.example.com', 'Bursa', 'TEST-Hızlı Yetkili', 'TEST-HIZLI', 'TEST-SN-0004',
   '2020-09-01', '2021-01-12', 'B MRL', 'asansor', NULL, NULL),
  ('7e570001-0000-4000-8000-000000000003', 'TEST-BETA', 'TEST-Beta Asansör ve Mühendislik A.Ş.', 'Test Mah. Beta Sok. No:3 Bornova',
   '0232 000 00 03', '0500 000 00 03', 'info@beta.example.com', 'İzmir', 'TEST-Beta Yetkili', 'TEST-BETA', 'TEST-SN-0003',
   '2017-11-20', '2018-06-05', 'B MRL, H', 'asansor', NULL, '7e570001-0000-4000-8000-000000000004'),
  ('7e570001-0000-4000-8000-000000000005', 'TEST-DELTA', 'TEST-Delta Mimarlık Ltd. Şti.', 'Test Mah. Delta Sok. No:5 Muratpaşa',
   '0242 000 00 05', NULL, 'info@delta.example.com', 'Antalya', 'TEST-Delta Yetkili', NULL, NULL,
   NULL, NULL, NULL, 'diger', 'Mimarlık', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.company_module_certs (id, company_id, module_type, belge_no, issue_date, notified_body_id) VALUES
  ('7e570012-0000-4000-8000-000000000001', '7e570001-0000-4000-8000-000000000001', 'B_MR', 'TEST-MB-0001', '2024-01-10', '7e570002-0000-4000-8000-000000000001'),
  ('7e570012-0000-4000-8000-000000000002', '7e570001-0000-4000-8000-000000000001', 'E',    'TEST-ME-0001', '2024-01-10', '7e570002-0000-4000-8000-000000000001'),
  ('7e570012-0000-4000-8000-000000000003', '7e570001-0000-4000-8000-000000000002', 'B_MR', 'TEST-MB-0002', '2024-03-05', '7e570002-0000-4000-8000-000000000001'),
  ('7e570012-0000-4000-8000-000000000004', '7e570001-0000-4000-8000-000000000002', 'E',    'TEST-ME-0002', '2024-03-05', '7e570002-0000-4000-8000-000000000002'),
  ('7e570012-0000-4000-8000-000000000005', '7e570001-0000-4000-8000-000000000003', 'B_MRL','TEST-MB-0003', '2023-09-15', '7e570002-0000-4000-8000-000000000002'),
  ('7e570012-0000-4000-8000-000000000006', '7e570001-0000-4000-8000-000000000003', 'H',    'TEST-MH-0003', '2023-09-15', '7e570002-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO public.engineers (id, full_name, discipline, title, chamber_reg_no, company_id, address, phone) VALUES
  ('7e570003-0000-4000-8000-000000000001', 'TEST-Mehmet Makineci', 'makine',   'Makine Mühendisi',  'TEST-MMO-0001', '7e570001-0000-4000-8000-000000000001', 'Test Adres 1', '0500 000 10 01'),
  ('7e570003-0000-4000-8000-000000000002', 'TEST-Elif Elektrikçi', 'elektrik', 'Elektrik Mühendisi','TEST-EMO-0001', '7e570001-0000-4000-8000-000000000001', 'Test Adres 2', '0500 000 10 02'),
  ('7e570003-0000-4000-8000-000000000003', 'TEST-Ali Alfa',        'makine',   'Makine Mühendisi',  'TEST-MMO-0002', '7e570001-0000-4000-8000-000000000002', 'Test Adres 3', '0500 000 10 03'),
  ('7e570003-0000-4000-8000-000000000004', 'TEST-Ayşe Alfa',       'elektrik', 'Elektrik Mühendisi','TEST-EMO-0002', '7e570001-0000-4000-8000-000000000002', 'Test Adres 4', '0500 000 10 04'),
  ('7e570003-0000-4000-8000-000000000005', 'TEST-Burak Beta',      'elektrik_elektronik', 'Elektrik-Elektronik Mühendisi', 'TEST-EMO-0003',
   '7e570001-0000-4000-8000-000000000003', 'Test Adres 5', '0500 000 10 05'),
  ('7e570003-0000-4000-8000-000000000006', 'TEST-Can Beta',        'mekatronik', 'Mekatronik Mühendisi', 'TEST-MMO-0003', '7e570001-0000-4000-8000-000000000003', 'Test Adres 6', '0500 000 10 06')
ON CONFLICT DO NOTHING;

-- One certificate per category, one brand per category, two models per brand.
INSERT INTO public.certificates (id, cert_no, notified_body_id, issue_date, valid_until, belge_tipi, category_id, firma_adi)
SELECT ('7e570007-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'TEST-CERT-' || lpad(n::text, 3, '0'),
       CASE WHEN n % 2 = 0 THEN '7e570002-0000-4000-8000-000000000002' ELSE '7e570002-0000-4000-8000-000000000001' END::uuid,
       '2024-01-01'::date, '2029-01-01'::date, CASE WHEN n % 3 = 0 THEN 'uygunluk_beyani' ELSE 'mod_b' END,
       ('7e570004-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'TEST-Üretici ' || n
FROM generate_series(1, 9) n
ON CONFLICT DO NOTHING;

INSERT INTO public.equipment_brands (id, category_id, name)
SELECT ('7e570005-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('7e570004-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'TEST-Marka ' || c.name
FROM generate_series(1, 9) n
JOIN public.equipment_categories c ON c.id = ('7e570004-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
ON CONFLICT DO NOTHING;

INSERT INTO public.equipment_models (id, brand_id, name, certificate_id)
SELECT ('7e570006-0000-4000-8000-0000000000' || lpad((n * 10 + m)::text, 2, '0'))::uuid,
       ('7e570005-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'TEST-Model ' || n || chr(64 + m),
       ('7e570007-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
FROM generate_series(1, 9) n, generate_series(1, 2) m
ON CONFLICT DO NOTHING;

INSERT INTO public.model_certificates (model_id, certificate_id)
SELECT m.id, m.certificate_id FROM public.equipment_models m
WHERE m.id::text LIKE '7e570006-%' AND m.certificate_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Users: password from SEED_PASSWORD (bcrypt, same format as the backend's BCrypt.Net).
INSERT INTO public.users (id, email, password_hash)
SELECT u.id, u.email, crypt(:'seed_password', gen_salt('bf', 11))
FROM (VALUES
  ('7e570008-0000-4000-8000-000000000001'::uuid, 'test-gensis@example.com'),
  ('7e570008-0000-4000-8000-000000000002'::uuid, 'test-alfa@example.com'),
  ('7e570008-0000-4000-8000-000000000003'::uuid, 'test-beta@example.com'),
  ('7e570008-0000-4000-8000-000000000004'::uuid, 'test-muhasebe@example.com')
) u(id, email)
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, full_name, role, company_id)
SELECT p.id, p.full_name, p.role::public.app_role, p.company_id
FROM (VALUES
  ('7e570008-0000-4000-8000-000000000001'::uuid, 'TEST-Gensis Personeli', 'gensis',     '7e570001-0000-4000-8000-000000000001'::uuid),
  ('7e570008-0000-4000-8000-000000000002'::uuid, 'TEST-Alfa Kullanıcısı', 'customer',   '7e570001-0000-4000-8000-000000000002'::uuid),
  ('7e570008-0000-4000-8000-000000000003'::uuid, 'TEST-Beta Kullanıcısı', 'customer',   '7e570001-0000-4000-8000-000000000003'::uuid),
  ('7e570008-0000-4000-8000-000000000004'::uuid, 'TEST-Muhasebeci',       'muhasebeci', NULL::uuid)
) p(id, full_name, role, company_id)
WHERE EXISTS (SELECT 1 FROM public.users x WHERE x.id = p.id)
ON CONFLICT DO NOTHING;

-- ---------- Proje Takip ----------
-- proje_no 9001+ (the counter starts at 1001, so these do not meet numbers the app hands out).
-- TAMAMLANDI rows are what the TD wizard will offer as "Proje No" (z8qgvcc7xf).

INSERT INTO public.takip_projeler (id, proje_no, proje_tipi, siparis_tarihi, company_id, montaj_firma_id, ada, parsel, ada_parsel,
  is_adi, asansor_sayisi, asansor_tipi, asansor_seri_no, province_id, district_id, il_adi, ilce_adi, fiyat, fatura_tipi, toplam_tutar,
  proje_sorumlusu_id, tahmini_tamamlanma, durum, bekliyor_aciklama, tamamlanma_tarihi, teslim_tipi, hard_copy_adedi,
  muhasebeye_gonderildi, muhasebe_durumu, created_by, parent_id, rev_no, rev_tarihi, rev_aciklama)
SELECT t.id::uuid, t.proje_no, t.proje_tipi, t.siparis::date, t.company::uuid, t.montaj::uuid, t.ada, t.parsel, t.ada || '/' || t.parsel,
  t.is_adi, t.sayi, t.tip, t.seri, t.il, (SELECT d.id::text FROM public.districts d WHERE d.province_id = t.il AND d.name = t.ilce),
  (SELECT p.name FROM public.provinces p WHERE p.id = t.il), t.ilce, t.fiyat, t.fatura,
  CASE WHEN t.fatura = 'faturali' THEN round(t.fiyat * 1.2, 2) ELSE t.fiyat END,
  '7e570008-0000-4000-8000-000000000001'::uuid, t.tahmini::date, t.durum, t.bekliyor, t.tamam::date, t.teslim, t.hc,
  t.durum = 'TAMAMLANDI', CASE WHEN t.durum = 'TAMAMLANDI' THEN t.muh END,
  '7e570008-0000-4000-8000-000000000001'::uuid, t.parent::uuid, t.rev_no, t.rev_tarihi::date, t.rev_aciklama
FROM (VALUES
  ('7e570009-0000-4000-8000-000000000001', 9001, 'uygulama', '2026-08-01', '7e570001-0000-4000-8000-000000000002', NULL,
   '101', '5', 'TEST-Kadıköy Konut Projesi', 2, 'MR', 'TEST-SERI-9001', 34, 'Kadıköy', 15000.00, 'faturali',
   '2026-10-01', 'TAMAMLANDI', NULL, '2026-10-15', 'dijital', NULL, 'bekliyor', NULL, NULL, NULL, NULL),
  ('7e570009-0000-4000-8000-000000000002', 9002, 'uygulama', '2026-07-10', '7e570001-0000-4000-8000-000000000002', NULL,
   '220', '14', 'TEST-Çankaya İş Merkezi', 1, 'MRL', 'TEST-SERI-9002', 6, 'Çankaya', 9000.00, 'faturasiz',
   '2026-09-01', 'TAMAMLANDI', NULL, '2026-09-05', 'hard_copy', 2, 'tamamlandi', NULL, NULL, NULL, NULL),
  ('7e570009-0000-4000-8000-000000000003', 9003, 'mimari', '2026-06-20', '7e570001-0000-4000-8000-000000000003', NULL,
   '35', '7', 'TEST-Bornova Hastane Ek Binası', 1, 'HD_INSAN', 'TEST-SERI-9003', 35, 'Bornova', 12000.00, 'faturali',
   '2026-08-15', 'TAMAMLANDI', NULL, '2026-08-20', 'dijital', NULL, 'bekliyor', NULL, NULL, NULL, NULL),
  ('7e570009-0000-4000-8000-000000000004', 9004, 'uygulama', '2026-09-02', '7e570001-0000-4000-8000-000000000003', '7e570001-0000-4000-8000-000000000004',
   '412', '3', 'TEST-Nilüfer Site A-B-C Blok', 3, 'MR', 'TEST-SERI-9004', 16, 'Nilüfer', 30000.00, 'faturali',
   '2026-10-20', 'TAMAMLANDI', NULL, '2026-10-28', 'dijital', NULL, 'bekliyor', NULL, NULL, NULL, NULL),
  ('7e570009-0000-4000-8000-000000000005', 9005, 'uygulama', '2026-10-25', '7e570001-0000-4000-8000-000000000002', NULL,
   '77', '9', 'TEST-Üsküdar Ofis Binası', 1, 'MRL', NULL, 34, 'Üsküdar', 8000.00, 'faturali',
   '2027-03-01', 'HAZIRLANIYOR', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('7e570009-0000-4000-8000-000000000006', 9006, 'mimari', '2026-10-01', '7e570001-0000-4000-8000-000000000003', NULL,
   '58', '21', 'TEST-Karşıyaka Konut', 2, 'HD_YUK', NULL, 35, 'Karşıyaka', 11000.00, 'faturasiz',
   '2027-02-01', 'BEKLIYOR', 'TEST - müşteriden yapı ruhsatı bekleniyor', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
) t(id, proje_no, proje_tipi, siparis, company, montaj, ada, parsel, is_adi, sayi, tip, seri, il, ilce, fiyat, fatura,
    tahmini, durum, bekliyor, tamam, teslim, hc, muh, parent, rev_no, rev_tarihi, rev_aciklama)
ON CONFLICT DO NOTHING;

-- A completed revision of 9003 (same proje_no, parent_id = the original row), as the app creates them.
INSERT INTO public.takip_projeler (id, proje_no, proje_tipi, siparis_tarihi, company_id, ada, parsel, ada_parsel, is_adi,
  asansor_sayisi, asansor_tipi, asansor_seri_no, province_id, district_id, il_adi, ilce_adi, fiyat, fatura_tipi, toplam_tutar,
  proje_sorumlusu_id, durum, tamamlanma_tarihi, teslim_tipi, muhasebeye_gonderildi, muhasebe_durumu, created_by,
  parent_id, rev_no, rev_tarihi, rev_aciklama)
SELECT '7e570009-0000-4000-8000-000000000031', p.proje_no, p.proje_tipi, p.siparis_tarihi, p.company_id, p.ada, p.parsel, p.ada_parsel,
  p.is_adi, p.asansor_sayisi, p.asansor_tipi, p.asansor_seri_no, p.province_id, p.district_id, p.il_adi, p.ilce_adi,
  3000.00, 'faturali', 3600.00, p.proje_sorumlusu_id, 'TAMAMLANDI', '2026-09-25', 'dijital', true, 'bekliyor', p.created_by,
  p.id, '1', '2026-09-10', 'TEST - kabin ölçüsü revizyonu'
FROM public.takip_projeler p WHERE p.id = '7e570009-0000-4000-8000-000000000003'
ON CONFLICT DO NOTHING;

-- 9002 is fully handled by accounting (cariye işlendi): its details are locked in the app.
INSERT INTO public.takip_muhasebe (id, takip_id, fatura_tarihi, fatura_no, cariye_islendi, teslim_yontemi, kargo_sirketi,
  kargo_takip_no, teslim_tarihi, created_by) VALUES
  ('7e570011-0000-4000-8000-000000000001', '7e570009-0000-4000-8000-000000000002', '2026-09-08', 'TEST-F-0001', true, 'kargo',
   'TEST-Kargo', 'TEST-000001', '2026-09-12', '7e570008-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

-- Documents: keys follow the app's pattern takip/<takip id>/<kind>-<uuid>.<ext>; files.txt lists the same keys.
INSERT INTO public.takip_dokumanlar (id, takip_id, kind, storage_path, original_name, uploaded_by)
SELECT d.id::uuid, d.takip::uuid, d.kind, 'takip/' || d.takip || '/' || d.kind || '-' || d.id || '.pdf', d.name,
       '7e570008-0000-4000-8000-000000000001'::uuid
FROM (VALUES
  ('7e570010-0000-4000-8000-000000000001', '7e570009-0000-4000-8000-000000000001', 'mimari_proje',     'TEST-9001-mimari-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000002', '7e570009-0000-4000-8000-000000000001', 'statik_projesi',   'TEST-9001-statik-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000003', '7e570009-0000-4000-8000-000000000001', 'elektrik_projesi', 'TEST-9001-elektrik-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000004', '7e570009-0000-4000-8000-000000000001', 'yapi_ruhsati',     'TEST-9001-yapi-ruhsati.pdf'),
  ('7e570010-0000-4000-8000-000000000005', '7e570009-0000-4000-8000-000000000001', 'tamamlanan_proje', 'TEST-9001-tamamlanan.pdf'),
  ('7e570010-0000-4000-8000-000000000006', '7e570009-0000-4000-8000-000000000002', 'mimari_proje',     'TEST-9002-mimari-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000007', '7e570009-0000-4000-8000-000000000002', 'yapi_ruhsati',     'TEST-9002-yapi-ruhsati.pdf'),
  ('7e570010-0000-4000-8000-000000000008', '7e570009-0000-4000-8000-000000000002', 'olcu_formu',       'TEST-9002-olcu-formu.pdf'),
  ('7e570010-0000-4000-8000-000000000009', '7e570009-0000-4000-8000-000000000002', 'tamamlanan_proje', 'TEST-9002-tamamlanan.pdf'),
  ('7e570010-0000-4000-8000-000000000010', '7e570009-0000-4000-8000-000000000003', 'mimari_proje',     'TEST-9003-mimari-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000011', '7e570009-0000-4000-8000-000000000003', 'tamamlanan_proje', 'TEST-9003-tamamlanan.pdf'),
  ('7e570010-0000-4000-8000-000000000012', '7e570009-0000-4000-8000-000000000031', 'revize_proje',     'TEST-9003-R1-revize.pdf'),
  ('7e570010-0000-4000-8000-000000000013', '7e570009-0000-4000-8000-000000000031', 'tamamlanan_proje', 'TEST-9003-R1-tamamlanan.pdf'),
  ('7e570010-0000-4000-8000-000000000014', '7e570009-0000-4000-8000-000000000004', 'mimari_proje',     'TEST-9004-mimari-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000015', '7e570009-0000-4000-8000-000000000004', 'elektrik_projesi', 'TEST-9004-elektrik-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000016', '7e570009-0000-4000-8000-000000000004', 'diger',            'TEST-9004-diger.pdf'),
  ('7e570010-0000-4000-8000-000000000017', '7e570009-0000-4000-8000-000000000004', 'tamamlanan_proje', 'TEST-9004-tamamlanan.pdf'),
  ('7e570010-0000-4000-8000-000000000018', '7e570009-0000-4000-8000-000000000005', 'mimari_proje',     'TEST-9005-mimari-proje.pdf'),
  ('7e570010-0000-4000-8000-000000000019', '7e570009-0000-4000-8000-000000000003', 'yapi_ruhsati',     'TEST-9003-yapi-ruhsati.pdf'),
  ('7e570010-0000-4000-8000-000000000020', '7e570009-0000-4000-8000-000000000004', 'yapi_ruhsati',     'TEST-9004-yapi-ruhsati.pdf')
) d(id, takip, kind, name)
ON CONFLICT DO NOTHING;

COMMIT;

-- Summary (counts of seeded rows; no row data).
SELECT 'companies' AS t, count(*) FROM public.companies WHERE id::text LIKE '7e570001-%'
UNION ALL SELECT 'notified_bodies', count(*) FROM public.notified_bodies WHERE id::text LIKE '7e570002-%'
UNION ALL SELECT 'engineers', count(*) FROM public.engineers WHERE id::text LIKE '7e570003-%'
UNION ALL SELECT 'equipment_categories', count(*) FROM public.equipment_categories WHERE id::text LIKE '7e570004-%'
UNION ALL SELECT 'equipment_brands', count(*) FROM public.equipment_brands WHERE id::text LIKE '7e570005-%'
UNION ALL SELECT 'equipment_models', count(*) FROM public.equipment_models WHERE id::text LIKE '7e570006-%'
UNION ALL SELECT 'certificates', count(*) FROM public.certificates WHERE id::text LIKE '7e570007-%'
UNION ALL SELECT 'users', count(*) FROM public.users WHERE id::text LIKE '7e570008-%'
UNION ALL SELECT 'takip_projeler', count(*) FROM public.takip_projeler WHERE id::text LIKE '7e570009-%'
UNION ALL SELECT 'takip_dokumanlar', count(*) FROM public.takip_dokumanlar WHERE id::text LIKE '7e570010-%'
UNION ALL SELECT 'provinces', count(*) FROM public.provinces
UNION ALL SELECT 'districts', count(*) FROM public.districts
UNION ALL SELECT 'ilgili_idareler', count(*) FROM public.ilgili_idareler;
