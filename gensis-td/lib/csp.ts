// Content-Security-Policy for the pages (KRR-025 stage 2). Built per request with a fresh nonce in middleware.ts;
// Next.js puts the nonce on its own inline scripts. Pure, so it is unit tested (lib/csp.test.ts).
//
// - script-src: our chunks ('self') and nonce'd inline scripts. No 'strict-dynamic': it would ignore 'self' and block
//   Cloudflare's same-origin email-decode script (/cdn-cgi/..., Email Obfuscation is on for the zone).
// - style-src 'unsafe-inline': React style attributes and Next's style tags are everywhere; Material Symbols CSS
//   comes from Google Fonts. Plus Jakarta Sans is self-hosted by next/font.
// - The files host (presigned MinIO links, STORAGE_PUBLIC_URL) is needed for uploads (connect-src), previews of
//   logos/signatures (img-src) and documents opened in a frame (frame-src).
// - frame-ancestors 'none' repeats nginx's header (stage 1), which stays for every location.

export function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, filesUrl?: string | null): string {
  const files = originOf(filesUrl);
  const extra = files ? ` ${files}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob:${extra}`,
    `connect-src 'self'${extra}`,
    `frame-src 'self' blob:${extra}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Header name: CSP_REPORT_ONLY=1 sends it as Report-Only (browser console only, nothing blocked). */
export const cspHeaderName = (reportOnly: string | undefined) =>
  reportOnly === "1" || reportOnly === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
