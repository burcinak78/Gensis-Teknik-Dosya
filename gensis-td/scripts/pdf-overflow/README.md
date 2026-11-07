# PDF overflow check (z8qgvccjc8)

Generates every teknik dosya document with made-up long values and fails when text overprints other text, crosses a
table cell border or leaves the page. Run after changing a PDF template or `lib/pdf/fit.ts`. Local stack only
(or dev); never prod.

```bash
# 1. local stack up, test data in (password of the test users from env, see db/dev-seed/README.md)
docker exec -i -e SEED_PASSWORD gensis-td-db-1 sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/dev-seed/seed.sql
# 2. everyday lengths: page counts must match EXPECTED_PAGES in app/api/pdf/teknik-dosya/route.ts
python3 -I scripts/pdf-overflow/run.py --password-file <file> --out /tmp/pdf-normal --values normal
# 3. long values
docker exec -i gensis-td-db-1 sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < scripts/pdf-overflow/fixture.sql
python3 -I scripts/pdf-overflow/run.py --password-file <file> --out /tmp/pdf-long
# 4. measure (pdfplumber in a container); the kilavuz folder lets it ignore what the ready-made forms already have
docker run --rm -v /tmp/pdf-long:/pdf:ro -v "$PWD/public/kilavuz":/kil:ro -v "$PWD/scripts/pdf-overflow/measure.py":/m.py:ro \
  python:3.12-slim sh -c 'pip install -q pdfplumber && python -I /m.py /pdf /kil'
# 5. clean up: db/dev-seed/rollback.sql
```

Result on 2026-11-07: before the fix 121 problems in 8 document types (Tescil, Teknik & Komponent, Bakım Sözleşmesi,
Kapak, Motor Beyannamesi, Teslim / Eğitim Tutanağı, Yazılı Beyanname); after, 0 in all 17 types for both lengths.
Not covered: Proje Onay and Avan Proje Dilekçesi (separate routes).
