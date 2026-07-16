import { createClient } from "@/lib/supabase/server";
import DataEntryWizard from "./DataEntryWizard";

export const dynamic = "force-dynamic";

export default async function YeniPage() {
  const supabase = createClient();

  // Referans verileri paralel çek (districts on-demand yüklenir — 1000 satır sınırı için)
  const [
    companies,
    categories,
    brands,
    models,
    certificates,
    notifiedBodies,
    provinces,
    capacity,
    lookups,
    engineers,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, short_name, legal_name, address, phone, fax, city, authorized_person, registered_brand, industry_reg_no"
      )
      .order("short_name"),
    supabase.from("equipment_categories").select("id, code, name, sort_order, drive_type").order("sort_order"),
    supabase.from("equipment_brands").select("id, category_id, name").order("name"),
    supabase.from("equipment_models").select("id, brand_id, name, certificate_id").order("name"),
    supabase.from("certificates").select("id, cert_no, notified_body_id"),
    supabase.from("notified_bodies").select("id, identity_no, name"),
    supabase.from("provinces").select("id, name").order("name"),
    supabase
      .from("capacity_table")
      .select("beyan_yuku_kg, kisi_sayisi, kabin_agirlik_kg, karsi_agirlik_kg")
      .order("beyan_yuku_kg"),
    supabase.from("lookup_values").select("list_key, value, sort_order").order("sort_order"),
    supabase.from("engineers").select("id, full_name, discipline, chamber_reg_no, company_id").order("full_name").limit(2000),
  ]);

  const companyList = companies.data ?? [];
  const gensis = companyList.find((c) => (c.short_name ?? "").toLocaleLowerCase("tr").includes("gensis"));

  return (
    <DataEntryWizard
      companies={companyList}
      categories={categories.data ?? []}
      brands={brands.data ?? []}
      models={models.data ?? []}
      certificates={certificates.data ?? []}
      notifiedBodies={notifiedBodies.data ?? []}
      provinces={provinces.data ?? []}
      capacity={capacity.data ?? []}
      lookups={lookups.data ?? []}
      engineers={engineers.data ?? []}
      gensisCompanyId={gensis?.id ?? null}
    />
  );
}
