# Dev test data

Made-up data for the dev database only (ADR-004: no real data on dev). Nothing is copied from the live system.

| File | What |
|---|---|
| `seed.sql` | Inserts the test data (idempotent, fixed ids `7e57xxxx-…`, `TEST-` names, `@example.com` users). Needs env `SEED_PASSWORD` (≥ 10 chars) for the 4 test users. |
| `rollback.sql` | Deletes only the seeded rows. Reference data (provinces, districts, municipalities, equipment categories, capacity) stays. |
| `upload-files.sh`, `files.txt`, `files/test-belge.pdf` | Puts a small sample PDF at every Proje Takip document key (`upload`) or removes them (`remove`). |

Run from the compose directory on the server, with this folder copied next to it as `dev-seed/`:

```bash
SEED_PASSWORD='...' docker compose -f docker-compose.server.yml exec -T -e SEED_PASSWORD db \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < dev-seed/seed.sql
docker compose -f docker-compose.server.yml run --rm --no-deps -v "$PWD/dev-seed:/seed:ro" \
  --entrypoint /bin/bash storage-init /seed/upload-files.sh upload
```

Undo: `rollback.sql` the same way (no env needed), then `upload-files.sh remove`.

Contents: 5 companies (`TEST-GENSIS` = Gensis, id `7e570001-0000-4000-8000-000000000001` → dev `GENSIS_COMPANY_ID`; `TEST-ALFA`, `TEST-BETA` customers; `TEST-HIZLI` montaj firm of BETA; `TEST-DELTA` "diğer"), 2 notified bodies, 6 engineers, 9 equipment categories with brand/2 models/certificate each, users `test-gensis@` (gensis), `test-alfa@` and `test-beta@` (customer), `test-muhasebe@` (muhasebeci) — all `@example.com`.
Proje Takip: 9001–9004 TAMAMLANDI (9001 two lifts, 9004 three, 9003 with a completed revision, 9002 cariye işlendi), 9005 HAZIRLANIYOR, 9006 BEKLIYOR; 20 documents (mimari_proje, yapi_ruhsati, …).
