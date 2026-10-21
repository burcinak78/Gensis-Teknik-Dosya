import { createServerClient } from "@supabase/ssr";
import { cookies, type UnsafeUnwrappedCookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// Sunucu tarafı Supabase istemcisi (server component / server action / route handler)
export function createClient() {
  // Next 15 still allows sync access (with a warning); this client goes away with the move to the C# API.
  const cookieStore = cookies() as unknown as UnsafeUnwrappedCookies;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component içinden set çağrılırsa yok sayılır (middleware yeniler).
          }
        },
      },
    }
  );
}
