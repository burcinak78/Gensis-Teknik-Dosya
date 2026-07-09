import { createBrowserClient } from "@supabase/ssr";

// Tarayıcı tarafı Supabase istemcisi (client component'lerde kullanılır)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
