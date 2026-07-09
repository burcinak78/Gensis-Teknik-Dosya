// Middleware devre dışı (matcher boş) — Edge Runtime'da Supabase modülü
// desteklenmediği için kaldırıldı. Giriş kontrolü korumalı sayfa
// yerleşiminde (app/(app)/layout.tsx) yapılıyor, güvenlik aynı.
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
