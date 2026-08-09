import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MuhasebeClient from "./MuhasebeClient";

export const dynamic = "force-dynamic";

export default async function MuhasebePage() {
  const supabase = createClient();
  const admin = createAdminClient();

  const [{ data: projeler }, { data: muhasebe }, { data: companies }, { data: sorumlular }] = await Promise.all([
    admin.from("takip_projeler").select("*").order("proje_no", { ascending: false }).order("created_at", { ascending: true }).limit(5000),
    admin.from("takip_muhasebe").select("*").limit(5000),
    supabase.from("companies").select("id, short_name").order("short_name").limit(2000),
    admin.from("profiles").select("id, full_name").in("role", ["admin", "gensis"]).limit(1000),
  ]);

  const muhByTakip: Record<string, any> = {};
  for (const m of muhasebe ?? []) muhByTakip[m.takip_id] = m;

  const rows = (projeler ?? []).map((p: any) => ({ ...p, muhasebe: muhByTakip[p.id] ?? null }));

  return (
    <MuhasebeClient
      rows={rows as any}
      companies={(companies ?? []) as any}
      sorumlular={(sorumlular ?? []) as any}
    />
  );
}
