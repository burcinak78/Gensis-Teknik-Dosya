-- ============================================================
-- 15_td_no.sql — Teknik Dosya No (TD-YY-0001) kolonu
-- Supabase SQL editöründe çalıştırın.
-- ============================================================

-- Her teknik dosyaya otomatik atanan sıra numarası (TD-25-0001 vb.)
alter table public.projects
  add column if not exists td_no text;

create index if not exists idx_projects_td_no on public.projects (td_no);

-- Kontrol: select td_no, dosya_no, created_at from public.projects order by created_at desc limit 20;
