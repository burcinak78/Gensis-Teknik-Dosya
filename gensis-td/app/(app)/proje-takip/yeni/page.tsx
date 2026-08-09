import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import YeniProjeForm from "../YeniProjeForm";

export const dynamic = "force-dynamic";

export default async function YeniTakipPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const [{ data: companies }, { data: provinces }, { data: sorumlular }] = await Promise.all([
    supabase.from("companies").select("id, short_name, legal_name, city").order("short_name").limit(2000),
    supabase.from("provinces").select("id, name").order("name"),
    admin.from("profiles").select("id, full_name, role").in("role", ["admin", "gensis"]).order("full_name").limit(1000),
  ]);

  return (
    <YeniProjeForm
      companies={(companies ?? []) as any}
      provinces={(provinces ?? []) as any}
      sorumlular={(sorumlular ?? []) as any}
    />
  );
}
