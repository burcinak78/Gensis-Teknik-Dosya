import { createClient } from "@/lib/supabase/server";
import ProjeOnayWizard from "./ProjeOnayWizard";

export const dynamic = "force-dynamic";

export default async function YeniProjeOnayPage() {
  const supabase = createClient();
  const [companies, provinces, capacity, engineers] = await Promise.all([
    supabase.from("companies").select("id, short_name, legal_name").order("short_name").limit(2000),
    supabase.from("provinces").select("id, name").order("name"),
    supabase.from("capacity_table").select("beyan_yuku_kg, kisi_sayisi").order("beyan_yuku_kg"),
    supabase.from("engineers").select("id, full_name, discipline, chamber_reg_no, company_id").order("full_name").limit(2000),
  ]);
  const list = companies.data ?? [];
  const gensis = list.find((c) => (c.short_name ?? "").toLocaleLowerCase("tr").includes("gensis"));

  return (
    <ProjeOnayWizard
      companies={list}
      provinces={provinces.data ?? []}
      capacity={(capacity.data ?? []) as any}
      engineers={engineers.data ?? []}
      gensisCompanyId={gensis?.id ?? null}
    />
  );
}
