import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import KullanicilarClient from "./KullanicilarClient";

export const dynamic = "force-dynamic";

export default async function KullanicilarPage() {
  const supabase = createClient();
  const [{ data: profiles }, { data: companies }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, company_id, companies(short_name)")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("companies").select("id, short_name").order("short_name").limit(1000),
  ]);

  // E-postalar profiles'da tutulmuyor; auth'tan çekip eşleştir
  const emailMap: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) emailMap[u.id] = u.email ?? "";
  } catch {
    /* e-posta getirilemezse liste yine çalışır */
  }

  const gensis = (companies ?? []).find((c) => c.short_name.toLocaleLowerCase("tr").includes("gensis"));
  const users = (profiles ?? []).map((p: any) => ({ ...p, email: emailMap[p.id] ?? "" }));

  return (
    <KullanicilarClient
      users={users as any}
      companies={companies ?? []}
      defaultCompanyId={gensis?.id ?? ""}
    />
  );
}
