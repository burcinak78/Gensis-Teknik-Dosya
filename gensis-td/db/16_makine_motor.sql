-- "Makine Motoru" kategorisinin adını "Makine/Motor" olarak günceller.
-- Yönetim / Güvenlik ekipmanları ekranında görünen kategori adıdır.
update public.equipment_categories
set name = 'Makine/Motor'
where code = 'motor';
