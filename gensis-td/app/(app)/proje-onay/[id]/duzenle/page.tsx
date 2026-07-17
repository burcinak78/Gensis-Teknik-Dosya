import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjeOnayWizard, { type OnayInitial } from "../../yeni/ProjeOnayWizard";

export const dynamic = "force-dynamic";

const s = (v: any) => (v == null ? "" : String(v));

export default async function DuzenleProjeOnayPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [companies, provinces, capacity, engineers, rowRes] = await Promise.all([
    supabase.from("companies").select("id, short_name, legal_name").order("short_name").limit(2000),
    supabase.from("provinces").select("id, name").order("name"),
    supabase.from("capacity_table").select("beyan_yuku_kg, kisi_sayisi").order("beyan_yuku_kg"),
    supabase.from("engineers").select("id, full_name, discipline, chamber_reg_no, company_id").order("full_name").limit(2000),
    supabase.from("proje_onay").select("*").eq("id", params.id).single(),
  ]);

  const row = rowRes.data as any;
  if (!row) notFound();

  let districts: { id: string; name: string }[] = [];
  if (row.province_id != null) {
    const { data } = await supabase.from("districts").select("id, name").eq("province_id", row.province_id).order("name").limit(2000);
    districts = data ?? [];
  }

  const inp = (row.input_data ?? {}) as any;
  const initial: OnayInitial = {
    id: row.id,
    companyId: row.company_id ?? "",
    dosyaNo: s(row.dosya_no),
    dilekceTarihi: row.dilekce_tarihi ? String(row.dilekce_tarihi).slice(0, 10) : new Date().toISOString().slice(0, 10),
    provinceId: row.province_id ?? "",
    districtId: s(row.district_id),
    districts,
    asansorAdedi: s(row.asansor_adedi ?? 1),
    yapiSahibi: s(row.yapi_sahibi),
    montajAdresi: s(row.montaj_adresi),
    pafta: s(row.pafta), ada: s(row.ada), parsel: s(row.parsel),
    beyanYuku: row.beyan_yuku_kg ?? "",
    beyanHizi: inp.beyan_hizi_txt || s(row.beyan_hizi),
    durak: s(row.durak_sayisi),
    makineMuhId: s(row.makine_muhendis_id),
    elektrikMuhId: s(row.elektrik_muhendis_id),
  };

  const list = companies.data ?? [];
  const gensis = list.find((c) => (c.short_name ?? "").toLocaleLowerCase("tr").includes("gensis"));

  return (
    <ProjeOnayWizard
      companies={list}
      provinces={provinces.data ?? []}
      capacity={(capacity.data ?? []) as any}
      engineers={engineers.data ?? []}
      gensisCompanyId={gensis?.id ?? null}
      initial={initial}
    />
  );
}
