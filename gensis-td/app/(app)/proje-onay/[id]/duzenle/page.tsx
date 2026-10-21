import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api/server";
import { loadWizardReference } from "../../../yeni/reference";
import { getProjeOnay } from "../../data";
import ProjeOnayWizard, { type OnayInitial } from "../../yeni/ProjeOnayWizard";

export const dynamic = "force-dynamic";

const s = (v: any) => (v == null ? "" : String(v));

export default async function DuzenleProjeOnayPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [ref, row] = await Promise.all([loadWizardReference(), getProjeOnay(params.id)]);
  if (!row) notFound();

  const districts = row.province_id != null
    ? (await apiGet<{ id: string; name: string }[]>(`/api/catalog/provinces/${row.province_id}/districts`)) ?? []
    : [];

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
    ilgiliIdareId: s(row.ilgili_idare_id),
    imzaMakine: inp.imza_makine === true,
    imzaElektrik: inp.imza_elektrik === true,
  };

  return (
    <ProjeOnayWizard
      companies={ref.companies}
      provinces={ref.provinces}
      capacity={ref.capacity}
      engineers={ref.engineers}
      gensisCompanyId={ref.gensisCompanyId}
      ilgiliIdareler={ref.ilgiliIdareler}
      initial={initial}
    />
  );
}
