// Proje onay records from the C# API, in the row shape the pages and PDF routes used with Supabase
// (snake_case, joined companies / provinces / districts / makine / elektrik).
import { apiFetch, apiGet } from "@/lib/api/server";

type Detail = {
  id: string; companyId: string; status: string; dosyaNo: string | null; dilekceTarihi: string | null; provinceId: number | null;
  districtId: string | null; asansorAdedi: number | null; yapiSahibi: string | null; montajAdresi: string | null; pafta: string | null;
  ada: string | null; parsel: string | null; beyanYukuKg: number | null; kisiSayisi: number | null; beyanHizi: number | null;
  durakSayisi: number | null; makineMuhendisId: string | null; elektrikMuhendisId: string | null; ilgiliIdareId: string | null;
  inputData: Record<string, any>; createdAt: string; updatedAt: string;
  company: { shortName: string; legalName: string; address: string | null; city: string | null; phone: string | null; mobilePhone: string | null; email: string | null };
  provinceName: string | null; districtName: string | null;
  makine: { fullName: string; chamberRegNo: string | null; address: string | null; phone: string | null } | null;
  elektrik: { fullName: string; chamberRegNo: string | null; address: string | null; phone: string | null } | null;
};
type ListItem = {
  id: string; dosyaNo: string | null; status: string; yapiSahibi: string | null; beyanYukuKg: number | null; durakSayisi: number | null;
  dilekceTarihi: string | null; createdAt: string; inputData: Record<string, any>; companyShortName: string | null;
};

const engineer = (e: Detail["makine"]) =>
  e ? { full_name: e.fullName, chamber_reg_no: e.chamberRegNo, address: e.address, phone: e.phone } : null;

/** One record the user may see, or null (missing or another company's). */
export async function getProjeOnay(id: string) {
  const d = await apiGet<Detail>(`/api/proje-onay/${encodeURIComponent(id)}`);
  if (!d) return null;
  return {
    id: d.id, company_id: d.companyId, status: d.status, dosya_no: d.dosyaNo, dilekce_tarihi: d.dilekceTarihi,
    province_id: d.provinceId, district_id: d.districtId, asansor_adedi: d.asansorAdedi, yapi_sahibi: d.yapiSahibi,
    montaj_adresi: d.montajAdresi, pafta: d.pafta, ada: d.ada, parsel: d.parsel, beyan_yuku_kg: d.beyanYukuKg,
    kisi_sayisi: d.kisiSayisi, beyan_hizi: d.beyanHizi, durak_sayisi: d.durakSayisi, makine_muhendis_id: d.makineMuhendisId,
    elektrik_muhendis_id: d.elektrikMuhendisId, ilgili_idare_id: d.ilgiliIdareId, input_data: d.inputData,
    created_at: d.createdAt, updated_at: d.updatedAt,
    companies: {
      short_name: d.company.shortName, legal_name: d.company.legalName, address: d.company.address, city: d.company.city,
      phone: d.company.phone, mobile_phone: d.company.mobilePhone, email: d.company.email,
    },
    provinces: d.provinceName ? { name: d.provinceName } : null,
    districts: d.districtName ? { name: d.districtName } : null,
    makine: engineer(d.makine),
    elektrik: engineer(d.elektrik),
  };
}

export async function listProjeOnay() {
  const rows = (await apiGet<ListItem[]>("/api/proje-onay?limit=300")) ?? [];
  return rows.map((r) => ({
    id: r.id, dosya_no: r.dosyaNo, status: r.status, yapi_sahibi: r.yapiSahibi, beyan_yuku_kg: r.beyanYukuKg,
    durak_sayisi: r.durakSayisi, dilekce_tarihi: r.dilekceTarihi, created_at: r.createdAt, input_data: r.inputData,
    companies: r.companyShortName ? { short_name: r.companyShortName } : null,
  }));
}

/** Signature (imza_makine / imza_elektrik) or company logo bytes for the PDF; null when there is none. */
export async function getProjeOnayFile(id: string, kind: "imza_makine" | "imza_elektrik" | "logo"): Promise<Uint8Array | null> {
  try {
    const res = await apiFetch(`/api/proje-onay/${encodeURIComponent(id)}/file?kind=${kind}`);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
