-- Long made-up values for the PDF overflow check (z8qgvccjc8). Local / dev only, on top of db/dev-seed/seed.sql:
-- it only changes TEST- rows (7e57 ids), which db/dev-seed/rollback.sql removes. Never run on prod.
BEGIN;
UPDATE public.companies SET
  legal_name = 'TEST-ALFA ASANSÖR MÜHENDİSLİK İNŞAAT TAAHHÜT SANAYİ VE TİCARET LİMİTED ŞİRKETİ ŞUBESİ',
  address = 'TEST Mahallesi Çok Uzun Bulvar Adı Caddesi No: 123/45 Kat: 6 Daire: 78 Organize Sanayi Bölgesi Kadıköy İSTANBUL',
  authorized_person = 'TEST-Mehmetcan Abdülkerimoğlu Büyükkahramanoğulları',
  registered_brand = 'TESTALFAASANSORUZUNMARKAADI',
  industry_reg_no = 'TEST-SANAYISICIL-1234567890123456',
  email = 'cok.uzun.bir.eposta.adresi.test@alfa-asansor-muhendislik.example.com',
  mobile_phone = '0216 000 00 02 / 0532 000 00 02'
WHERE id = '7e570001-0000-4000-8000-000000000002';
-- Brand and model names: one with spaces, one without (the TD-26-004 case), per category.
UPDATE public.equipment_brands SET name = 'TEST-UZUN MARKA ADI ' || upper(name) || ' ELEVATOR COMPONENTS GMBH'
WHERE id::text LIKE '7e570005-%';
UPDATE public.equipment_models SET name = CASE WHEN right(name, 1) = 'A'
    THEN 'TESTMODEL' || replace(name, ' ', '') || 'XK2000PLUSSUPERLONGNOSPACEVARIANT0123456789'
    ELSE name || ' Uzun Model Açıklaması Seri 2000 Plus Tip B Çift Yönlü' END
WHERE id::text LIKE '7e570006-%';
UPDATE public.certificates SET cert_no = 'TEST-CERT-' || lpad(right(id::text, 2), 3, '0') || '-AB/2024/0000123456789/REV-07'
WHERE id::text LIKE '7e570007-%';
COMMIT;
