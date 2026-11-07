// KRR-025 stage 2: a nonce'd Content-Security-Policy on every page (lib/csp.ts). Session and role checks stay in the
// C# API and lib/api/server.ts requireMe; this only adds the header. Next.js reads the nonce from the request's CSP
// header and puts it on its inline scripts (pages render dynamically, app/layout.tsx).
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, cspHeaderName } from "./lib/csp";

export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, process.env.STORAGE_PUBLIC_URL);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(cspHeaderName(process.env.CSP_REPORT_ONLY), csp);
  return res;
}

export const config = {
  // Pages only: not the API (its own strict CSP in nginx), static chunks, images or public files.
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico|fonts/|kilavuz/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|ttf|woff2?|pdf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
