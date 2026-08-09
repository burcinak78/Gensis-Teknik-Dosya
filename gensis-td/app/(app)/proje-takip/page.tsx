import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ProjeTakipClient from "./ProjeTakipClient";

export const dynamic = "force-dynamic";

export default async function ProjeTakipPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);
  // Tahmini tamamlanma tarihi geçmiş ve hâlâ HAZIRLANIYOR olanları otomatik BEKLIYOR yap
  try {
    await admin.from("takip_projeler")
      .update({ durum: "BEKLIYOR" })
      .eq("durum", "HAZIRLANIYOR")
      .lt("tahmini_tamamlanma", today);
  } catch { /* yoksay */ }

  const [{ data: projeler }, { data: docs }, { data: muhasebe }, { data: companies }, { data: provinces }, { data: sorumlular }] =
    await Promise.all([
      admin.from("takip_projeler").select("*").order("proje_no", { ascending: false }).order("created_at", { ascending: true }).limit(5000),
      admin.from("takip_dokumanlar").select("id, takip_id, kind, original_name, created_at").limit(20000),
      admin.from("takip_muhasebe").select("takip_id, cariye_islendi, teslim_tarihi").limit(5000),
      supabase.from("companies").select("id, short_name, legal_name, city").order("short_name").limit(2000),
      supabase.from("provinces").select("id, name").order("name"),
      admin.from("profiles").select("id, full_name, role").in("role", ["admin", "gensis"]).order("full_name").limit(1000),
    ]);

  const docsByTakip: Record<string, any[]> = {};
  for (const d of docs ?? []) (docsByTakip[d.takip_id] ||= []).push(d);
  const muhByTakip: Record<string, any> = {};
  for (const m of muhasebe ?? []) muhByTakip[m.takip_id] = m;

  const rows = (projeler ?? []).map((p: any) => ({
    ...p,
    docs: docsByTakip[p.id] ?? [],
    muhasebe: muhByTakip[p.id] ?? null,
  }));

  return (
    <ProjeTakipClient
      rows={rows as any}
      companies={(companies ?? []) as any}
      provinces={(provinces ?? []) as any}
      sorumlular={(sorumlular ?? []) as any}
      currentUserId={user?.id ?? ""}
      today={today}
    />
  );
}
