# Gensis Teknik Dosya — Web Uygulaması (İlk Sürüm)

Next.js 14 (App Router) + Supabase. Bu ilk dilim: **giriş** + **korumalı panel** + **canlı verili Veri Girişi ekranı** (firma / ekipman / il-belediye Supabase'den gelir, taslak proje kaydedilir).

## Ne var?

- `app/giris` — e-posta/şifre ile giriş
- `app/(app)/panel` — teknik dosya listesi
- `app/(app)/yeni` — 5 adımlı Veri Girişi sihirbazı (firma seçince otomatik dolan alanlar, kademeli ekipman + sertifika, taslak kaydetme)
- `lib/supabase/*` — Supabase istemci/sunucu/middleware (oturum yönetimi)
- Row Level Security veritabanı tarafında; kullanıcılar sadece yetkili oldukları veriyi görür.

## Önkoşul

Supabase şeması yüklü olmalı (`01`–`05` SQL dosyaları) ve en az bir **admin** kullanıcı oluşturulmuş olmalı.

## 1) Yerelde çalıştırma (opsiyonel)

```bash
npm install
cp .env.local.example .env.local     # sonra içini doldur
npm run dev                          # http://localhost:3000
```

`.env.local` içine Supabase **Project Settings > API**'dan:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...   (anon public key)
```

## 2) GitHub'a yükleme

```bash
git init
git add .
git commit -m "İlk sürüm: giriş + veri girişi"
git branch -M main
git remote add origin https://github.com/KULLANICI/gensis-td.git
git push -u origin main
```

> `node_modules`, `.next` ve `.env.local` `.gitignore` sayesinde gitmez — doğru.

## 3) Vercel'e deploy (Balcomb gibi)

1. Vercel'de **Add New > Project** → GitHub reposunu seç (Import).
2. Framework otomatik **Next.js** algılanır, ayar değiştirmeye gerek yok.
3. **Environment Variables** bölümüne iki değişkeni ekle (yereldekiyle aynı):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. Bitince Vercel bir `*.vercel.app` adresi verir.
5. **Cloudflare**'deki domaini Vercel projesine bağla (Balcomb'daki akış).

## 4) Supabase Auth ayarı

Supabase panelinde **Authentication > URL Configuration**:
- **Site URL**: Vercel/Cloudflare adresin (ör. `https://teknikdosya.senindomainin.com`)
- E-posta/şifre girişi için ekstra yönlendirme gerekmez.

## 5) İlk giriş

`05_bootstrap_admin.sql` ile oluşturduğun admin e-posta/şifresiyle `/giris`'ten gir. Panelde "+ Yeni Teknik Dosya" ile veri girişini dene: firma seç → bilgiler otomatik gelsin, ekipmanda marka→model seç → sertifika bağlansın, son adımda taslağı kaydet.

## Notlar

- Bu sürüm **taslak kaydeder**; PDF üretimi ve belge şablonları sonraki dilim.
- Ekipmanlar şimdilik tek slot (tampon çift slot sonra eklenecek).
- Middleware giriş yapmamış kullanıcıyı `/giris`'e yönlendirir.
