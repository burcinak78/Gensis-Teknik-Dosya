-- Asansör Teknik Dosyası'ndan muhasebeye gönderilen kayıtlarda,
-- Muhasebe panelinde Proje No yerine TD No gösterebilmek için.
alter table public.takip_projeler add column if not exists td_no text;
create index if not exists takip_projeler_td_no_idx on public.takip_projeler (td_no);
