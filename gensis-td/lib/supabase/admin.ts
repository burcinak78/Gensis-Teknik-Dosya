import { createClient } from "@supabase/supabase-js";

// Service-role istemcisi — SADECE sunucu tarafında (server action) kullanılır.
// RLS'i baypas eder; kullanıcı oluşturma, Storage yükleme gibi yetkili işler için.
// SUPABASE_SERVICE_ROLE_KEY gizli tutulmalı (asla tarayıcıya gönderilmez).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
