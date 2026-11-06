-- ============================================================
-- dev-seed/rollback.sql — removes ONLY the rows seed.sql added (fixed ids 7e57xxxx-...), in one transaction.
-- Reference data (provinces, districts, municipalities, equipment categories, capacity table) stays.
-- If rows created later through the app point at test data (e.g. a TD of TEST-ALFA), a foreign key stops it
-- and nothing is deleted: remove those rows first.
-- Files in MinIO: upload-files.sh remove.
--   docker compose -f docker-compose.server.yml exec -T db \
--     sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < rollback.sql
-- ============================================================
BEGIN;
DELETE FROM public.takip_muhasebe   WHERE id::text LIKE '7e570011-%';
DELETE FROM public.takip_dokumanlar WHERE id::text LIKE '7e570010-%';
DELETE FROM public.takip_projeler   WHERE id::text LIKE '7e570009-%' AND parent_id IS NOT NULL;
DELETE FROM public.takip_projeler   WHERE id::text LIKE '7e570009-%';
DELETE FROM public.users            WHERE id::text LIKE '7e570008-%';  -- profiles cascade
DELETE FROM public.model_certificates WHERE model_id::text LIKE '7e570006-%';
DELETE FROM public.equipment_models WHERE id::text LIKE '7e570006-%';
DELETE FROM public.certificates     WHERE id::text LIKE '7e570007-%';
DELETE FROM public.equipment_brands WHERE id::text LIKE '7e570005-%';
DELETE FROM public.engineers        WHERE id::text LIKE '7e570003-%';
DELETE FROM public.company_module_certs WHERE id::text LIKE '7e570012-%';
UPDATE public.companies SET montaj_firma_id = NULL WHERE id::text LIKE '7e570001-%';
DELETE FROM public.companies        WHERE id::text LIKE '7e570001-%';
DELETE FROM public.notified_bodies  WHERE id::text LIKE '7e570002-%';
COMMIT;
SELECT count(*) AS seeded_rows_left FROM (
  SELECT id FROM public.companies WHERE id::text LIKE '7e57%' UNION ALL SELECT id FROM public.users WHERE id::text LIKE '7e57%'
  UNION ALL SELECT id FROM public.takip_projeler WHERE id::text LIKE '7e57%') x;
