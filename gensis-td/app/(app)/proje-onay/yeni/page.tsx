import { createClient } from "@/lib/supabase/server";
import ProjeOnayWizard from "./ProjeOnayWizard";

export const dynamic = "force-dynamic";

export default async function YeniProjeOnayPage() {
  const supabase = createClient();
  const [companies, provinces, capacity, engineers, idareler] = await Promise.all([
    supabase.from("companies").select("id, short_name, legal_name").order("short_name").limit(2000),
    supabase.from("provinces").select("id, name").order("name"),
    supabase.from("capacity_table").select("beyan_yuku_kg, kisi_sayisi").order("beyan_yuku_kg"),
    supabase.from("engineers").select("id, full_name, discipline, chamber_reg_no, company_id").order("full_name").limit(2000),
    supabase.from("ilgili_idareler").select("id, name, address").order("name").limit(2000),
  ]);
  const { data: imzaDocs } = await supabase.from("engineer_documents").select("id, engineer_id").eq("doc_type", "imza").limit(5000);
  const imzaByEng = new Map((imzaDocs ?? []).map((d: any) => [d.engineer_id, d.id]));
  const engineersWithImza = (engineers.data ?? []).map((e: any) => ({ ...e, imzaDocId: imzaByEng.get(e.id) ?? null }));

  const list = companies.data ?? [];
  const gensis = list.find((c) => (c.short_name ?? "").toLocaleLowerCase("tr").includes("gensis"));

  return (
    <ProjeOnayWizard
      companies={list}
      provinces={provinces.data ?? []}
      capacity={(capacity.data ?? []) as any}
      engineers={engineersWithImza}
      gensisCompanyId={gensis?.id ?? null}
      ilgiliIdareler={(idareler.data ?? []) as any}
    />
  );
}
