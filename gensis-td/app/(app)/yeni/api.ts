// Wizard calls to the C# API. Same names and result shapes as the old server actions in ./actions.ts,
// so the wizard component only changes its imports.
import { api, ApiError } from "@/lib/api/client";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

type EquipmentSel = {
  category_id: string; slot: string; brand_id: string | null; model_id: string | null;
  certificate_id: string | null; seri_no: string | null; seri_list?: string[] | null;
};

export type DraftPayload = {
  company_id: string; dosya_no: string; dosya_tarihi: string | null;
  makine_muhendis_id: string | null; elektrik_muhendis_id: string | null;
  bina_adi: string | null; montaj_adresi: string | null; province_id: number | null; district_id: string | null;
  beyan_yuku_kg: number | null; kisi_sayisi: number | null; beyan_hizi: number | null;
  kat_adedi: number | null; durak_adedi: number | null; imal_yili: number | null;
  input_data: Record<string, unknown>;
  equipment: EquipmentSel[];
};

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? (e.status === 404 ? "Kayıt bulunamadı veya yetkiniz yok." : e.message) : fallback;
// Empty strings from form fields are "not set" for the API (dates, ids).
const orNull = <T,>(v: T | "" | null | undefined): T | null => (v === "" || v === undefined ? null : v);

function toProjectInput(p: DraftPayload) {
  return {
    companyId: p.company_id, dosyaNo: p.dosya_no, dosyaTarihi: orNull(p.dosya_tarihi),
    makineMuhendisId: orNull(p.makine_muhendis_id), elektrikMuhendisId: orNull(p.elektrik_muhendis_id),
    binaAdi: p.bina_adi, montajAdresi: p.montaj_adresi, provinceId: orNull(p.province_id), districtId: orNull(p.district_id),
    beyanYukuKg: p.beyan_yuku_kg, kisiSayisi: p.kisi_sayisi, beyanHizi: p.beyan_hizi,
    katAdedi: p.kat_adedi, durakAdedi: p.durak_adedi, imalYili: p.imal_yili,
    inputData: p.input_data,
    equipment: p.equipment.map((e) => ({
      categoryId: e.category_id, slot: e.slot, brandId: orNull(e.brand_id), modelId: orNull(e.model_id),
      certificateId: orNull(e.certificate_id), seriNo: e.seri_no, seriList: e.seri_list ?? null,
    })),
  };
}

export async function saveDraftProject(payload: DraftPayload): Promise<SaveResult> {
  if (!payload.company_id) return { ok: false, error: "Firma seçilmedi." };
  if (!payload.dosya_no) return { ok: false, error: "Proje no boş olamaz." };
  try {
    const r = await api<{ id: string }>("/api/projects", { method: "POST", body: JSON.stringify(toProjectInput(payload)) });
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: errorText(e, "Proje kaydedilemedi.") };
  }
}

export async function updateDraftProject(id: string, payload: DraftPayload): Promise<SaveResult> {
  if (!payload.company_id) return { ok: false, error: "Firma seçilmedi." };
  if (!payload.dosya_no) return { ok: false, error: "Dosya no boş olamaz." };
  try {
    await api(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(toProjectInput(payload)) });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorText(e, "Proje kaydedilemedi.") };
  }
}

/** Upload straight to storage: get a signed URL, PUT the file, then record it with its metadata. */
export async function uploadProjectFile(fd: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const projectId = String(fd.get("project_id") || "");
  const kind = String(fd.get("kind") || "");
  const file = fd.get("file") as File | null;
  if (!projectId || !kind || !file || file.size === 0) return { ok: false, error: "Eksik bilgi." };
  const field = (name: string) => orNull(String(fd.get(name) ?? ""));
  try {
    const up = await api<{ key: string; url: string; contentType: string }>(`/api/projects/${projectId}/files/upload-url`, {
      method: "POST", body: JSON.stringify({ kind, fileName: file.name, contentType: file.type || null }),
    });
    const put = await fetch(up.url, { method: "PUT", headers: { "content-type": up.contentType }, body: file });
    if (!put.ok) return { ok: false, error: "Dosya yüklenemedi." };
    const r = await api<{ id: string }>(`/api/projects/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify({
        key: up.key, originalName: file.name,
        belgeNo: field("belge_no"), issueDate: field("issue_date"), validUntil: field("valid_until"),
        notifiedBodyId: field("notified_body_id"), reportDate: field("report_date"),
        faturaNo: field("fatura_no"), faturaTarihi: field("fatura_tarihi"), projeNo: field("proje_no"),
      }),
    });
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: errorText(e, "Dosya yüklenemedi.") };
  }
}

export async function deleteProjectFile(projectId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/api/projects/${projectId}/files/${id}`, { method: "DELETE" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorText(e, "Silinemedi.") };
  }
}

export type MuhasebeGonderPayload = {
  projectId: string; fiyat: number; fatura_tipi: "faturali" | "faturasiz"; teslim_tipi: "hard_copy" | "dijital";
};

export async function sendProjectToMuhasebe(p: MuhasebeGonderPayload): Promise<{ ok: boolean; error?: string }> {
  if (!p.fiyat || p.fiyat <= 0) return { ok: false, error: "Muhasebeye göndermek için fiyat girilmeli." };
  try {
    await api(`/api/projects/${p.projectId}/muhasebe`, {
      method: "PUT", body: JSON.stringify({ fiyat: p.fiyat, faturaTipi: p.fatura_tipi, teslimTipi: p.teslim_tipi }),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { ok: false, error: "Muhasebe kaydı teslim edilmiş; değiştirilemez." };
    return { ok: false, error: errorText(e, "Muhasebeye gönderilemedi.") };
  }
}

export async function removeProjectFromMuhasebe(projectId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/api/projects/${projectId}/muhasebe`, { method: "DELETE" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorText(e, "Muhasebeden çıkarılamadı.") };
  }
}

export async function loadDistricts(provinceId: number): Promise<{ id: string; name: string }[]> {
  try {
    return await api<{ id: string; name: string }[]>(`/api/catalog/provinces/${provinceId}/districts`);
  } catch {
    return [];
  }
}

// Signature upload: same endpoint as the engineer screens (customers' uploads go to approval).
export { uploadEngineerDocument } from "../admin/api";
