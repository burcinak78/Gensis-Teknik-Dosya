// Middleware devre dışı (matcher boş). Oturum ve rol kontrolü C# API'de; sayfalar
// lib/api/server.ts requireMe ile yönlendirir (app/(app)/layout.tsx ve rol kısıtlı sayfalar).
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
