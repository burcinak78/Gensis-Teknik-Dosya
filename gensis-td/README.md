# Gensis Teknik Dosya

Asansör teknik dosyası, proje onay ve proje takip/muhasebe uygulaması.

## Yapı

| Servis | Teknoloji | Klasör |
|---|---|---|
| frontend | Next.js 15 (App Router), PDF üretimi (react-pdf, pdf-lib) | kök (`app/`, `components/`, `lib/`) |
| backend | ASP.NET Core 10 minimal API + EF Core (PostgreSQL) | `backend/` |
| db | PostgreSQL 17 | compose |
| storage | MinIO (S3) — `documents`, `certificates` | compose |
| proxy | nginx: `/api/pdf/` → frontend, diğer `/api/` → backend, `/` → frontend | `deploy/proxy/` |

- Oturum: backend httpOnly çerez (`gtd_session`); frontend sunucu tarafında çerezi backend'e iletir (`lib/api/server.ts`), tarayıcıda `/api` çağırır (`lib/api/client.ts`).
- Yetki kuralları backend'de (`backend/GensisTd.Api/Auth/`); dosyalar tarayıcıdan imzalı adresle doğrudan MinIO'ya yüklenir.
- Tek seferlik servisler: `migrate` (migration, uygulama DB rolü, ilk admin) ve `storage-init` (bucket'lar, backend'in kısıtlı anahtarı).

## Lokal çalıştırma

```bash
cp .env.example .env      # değerleri doldur
docker compose up -d --build
```

Uygulama: http://localhost:10201 (proxy). İlk admin `.env`'deki `ADMIN_EMAIL` / `ADMIN_PASSWORD` ile, kullanıcı tablosu boşken oluşur.

Frontend'i compose'suz geliştirmek için (backend compose'da çalışırken):

```bash
BACKEND_INTERNAL_URL=http://localhost:10202 API_PROXY_URL=http://localhost:10202 npx next dev
```

## Testler

```bash
docker run --rm -v "$PWD/backend":/src -w /src mcr.microsoft.com/dotnet/sdk:10.0 dotnet test GensisTd.Api.Tests
```

## Deploy

`server01-migration` dalına push → TeamCity: test, image build (`linux/amd64`), registry, server01 (`deploy/docker-compose.server.yml`). Image'lar: kökteki `Dockerfile` (frontend), `backend/Dockerfile`.
