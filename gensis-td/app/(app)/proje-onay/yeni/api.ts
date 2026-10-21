// Proje onay saves against the C# API, with the old server actions' names and result shape.
import { api, ApiError } from "@/lib/api/client";

export type OnayResult = { ok: true; id: string } | { ok: false; error: string };

export type OnayPayload = {
  company_id: string; dosya_no: string | null; dilekce_tarihi: string | null; province_id: number | null;
  district_id: string | null; asansor_adedi: number | null; yapi_sahibi: string | null; montaj_adresi: string | null;
  pafta: string | null; ada: string | null; parsel: string | null; beyan_yuku_kg: number | null; kisi_sayisi: number | null;
  beyan_hizi: number | null; durak_sayisi: number | null; makine_muhendis_id: string | null; elektrik_muhendis_id: string | null;
  ilgili_idare_id: string | null; input_data: Record<string, unknown>;
};

const orNull = <T,>(v: T | "" | null | undefined): T | null => (v === "" || v === undefined ? null : v);

const toInput = (p: OnayPayload) => JSON.stringify({
  companyId: p.company_id, dosyaNo: p.dosya_no, dilekceTarihi: orNull(p.dilekce_tarihi), provinceId: orNull(p.province_id),
  districtId: orNull(p.district_id), asansorAdedi: p.asansor_adedi, yapiSahibi: p.yapi_sahibi, montajAdresi: p.montaj_adresi,
  pafta: p.pafta, ada: p.ada, parsel: p.parsel, beyanYukuKg: p.beyan_yuku_kg, kisiSayisi: p.kisi_sayisi, beyanHizi: p.beyan_hizi,
  durakSayisi: p.durak_sayisi, makineMuhendisId: orNull(p.makine_muhendis_id), elektrikMuhendisId: orNull(p.elektrik_muhendis_id),
  ilgiliIdareId: orNull(p.ilgili_idare_id), inputData: p.input_data,
});

const errorText = (e: unknown) =>
  e instanceof ApiError ? (e.status === 404 ? "Kayıt bulunamadı veya yetkiniz yok." : e.status === 403 ? "Bu firma için yetkiniz yok." : e.message) : "Kaydedilemedi.";

export async function saveProjeOnay(payload: OnayPayload): Promise<OnayResult> {
  if (!payload.company_id) return { ok: false, error: "Firma seçilmedi." };
  try {
    const r = await api<{ id: string }>("/api/proje-onay", { method: "POST", body: toInput(payload) });
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: errorText(e) };
  }
}

export async function updateProjeOnay(id: string, payload: OnayPayload): Promise<OnayResult> {
  if (!id) return { ok: false, error: "Kayıt bulunamadı." };
  try {
    await api(`/api/proje-onay/${id}`, { method: "PUT", body: toInput(payload) });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorText(e) };
  }
}
