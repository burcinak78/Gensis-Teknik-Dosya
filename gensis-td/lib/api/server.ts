// Server-side access to the C# API (server components, server actions, route handlers).
// The browser's session cookie (httpOnly, set by /api/auth/login) is forwarded as-is.
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "gtd_session";

export type Role = "admin" | "gensis" | "muhasebeci" | "customer";
export type Me = { id: string; email: string; fullName: string | null; role: Role; companyId: string | null };

function baseUrl(): string {
  // Address of the backend from the Next server (compose: http://backend:8080). Not exposed to the browser.
  const url = process.env.BACKEND_INTERNAL_URL;
  if (!url) throw new Error("BACKEND_INTERNAL_URL is not set");
  return url.replace(/\/$/, "");
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (session) headers.set("cookie", `${SESSION_COOKIE}=${session}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(baseUrl() + path, { ...init, headers, cache: "no-store" });
}

/** GET returning parsed JSON, or null for 404 (missing or not visible). Other errors throw. */
export async function apiGet<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** The API sends enum names ("Draft"); the UI uses the database names ("draft"). */
export const dbName = (value: string | null | undefined) => (value ? value.toLowerCase() : "");

/** The signed-in user, or null. Cached per request so layouts and pages share one /me call. */
export const getMe = cache(async (): Promise<Me | null> => {
  const res = await apiFetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`/api/auth/me failed: ${res.status}`);
  const u = await res.json();
  // The API sends enum names ("Admin"); the UI uses the database names ("admin").
  return { ...u, role: dbName(u.role) as Role };
});

/** Redirects to the login page without a session, and to /panel when the role is not allowed. */
export async function requireMe(roles?: Role[]): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/giris");
  if (roles && !roles.includes(me.role)) redirect("/panel");
  return me;
}

export const isStaff = (role: Role) => role === "admin" || role === "gensis";
