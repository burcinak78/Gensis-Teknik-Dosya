// Proje Takip writes against the C# API (staff only there), with the old server actions' names and results.
import { api, ApiError } from "@/lib/api/client";

export type Result = { ok: true; message?: string; id?: string; proje_no?: number } | { ok: false; error: string };

export type TakipPayload = {
  proje_tipi: "mimari" | "uygulama"; siparis_tarihi: string | null; company_id: string; ada: string | null; parsel: string | null;
  is_adi: string | null; asansor_sayisi: number | null; asansor_tipi: string | null; asansor_seri_no: string | null;
  province_id: number | null; district_id: string | null; il_adi: string | null; ilce_adi: string | null; fiyat: number | null;
  fatura_tipi: "faturali" | "faturasiz"; proje_sorumlusu_id: string | null; tahmini_tamamlanma: string | null; montaj_firma_id: string | null;
};
export type RevizyonPayload = {
  rev_no: string | null; rev_tarihi: string | null; fiyat: number | null; fatura_tipi: "faturali" | "faturasiz"; rev_aciklama: string | null;
};

const orNull = <T,>(v: T | "" | null | undefined): T | null => (v === "" || v === undefined ? null : v);
const fail = (e: unknown, fallback: string): Result => ({
  ok: false, error: e instanceof ApiError ? (e.status === 404 ? "Kayıt bulunamadı." : e.status === 403 ? "Bu işlem için Gensis personeli yetkisi gerekli." : e.message) : fallback,
});

const takipBody = (p: TakipPayload) => JSON.stringify({
  projeTipi: p.proje_tipi, siparisTarihi: orNull(p.siparis_tarihi), companyId: p.company_id, ada: p.ada, parsel: p.parsel,
  isAdi: p.is_adi, asansorSayisi: p.asansor_sayisi, asansorTipi: p.asansor_tipi, asansorSeriNo: p.asansor_seri_no,
  provinceId: orNull(p.province_id), districtId: orNull(p.district_id), ilAdi: p.il_adi, ilceAdi: p.ilce_adi, fiyat: p.fiyat,
  faturaTipi: p.fatura_tipi, projeSorumlusuId: orNull(p.proje_sorumlusu_id), tahminiTamamlanma: orNull(p.tahmini_tamamlanma),
  montajFirmaId: orNull(p.montaj_firma_id),
});

export async function createTakipProje(p: TakipPayload): Promise<Result> {
  if (!p.company_id) return { ok: false, error: "Firma seçilmedi." };
  if (!p.proje_tipi) return { ok: false, error: "Proje tipi seçilmedi." };
  try {
    const r = await api<{ id: string; projeNo: number }>("/api/takip", { method: "POST", body: takipBody(p) });
    return { ok: true, id: r.id, proje_no: r.projeNo };
  } catch (e) {
    return fail(e, "Kayıt oluşturulamadı.");
  }
}

export async function updateTakipProje(id: string, p: TakipPayload): Promise<Result> {
  if (!p.company_id) return { ok: false, error: "Firma seçilmedi." };
  try {
    await api(`/api/takip/${id}`, { method: "PUT", body: takipBody(p) });
    return { ok: true, id };
  } catch (e) {
    return fail(e, "Kaydedilemedi.");
  }
}

export async function createRevision(parentId: string, r: RevizyonPayload): Promise<Result> {
  try {
    const res = await api<{ id: string; projeNo: number }>(`/api/takip/${parentId}/revisions`, {
      method: "POST",
      body: JSON.stringify({ revNo: r.rev_no, revTarihi: orNull(r.rev_tarihi), fiyat: r.fiyat, faturaTipi: r.fatura_tipi, revAciklama: r.rev_aciklama }),
    });
    return { ok: true, id: res.id, proje_no: res.projeNo };
  } catch (e) {
    return fail(e, "Revizyon oluşturulamadı.");
  }
}

export async function deleteTakipDoc(id: string): Promise<Result> {
  try {
    await api(`/api/takip/documents/${id}`, { method: "DELETE" });
    return { ok: true };
  } catch (e) {
    return fail(e, "Silinemedi.");
  }
}

export async function saveBekliyorAciklama(id: string, aciklama: string): Promise<Result> {
  if (!aciklama.trim()) return { ok: false, error: "Açıklama zorunludur." };
  try {
    const r = await api<{ message: string }>(`/api/takip/${id}/bekliyor`, { method: "POST", body: JSON.stringify({ aciklama }) });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Kaydedilemedi.");
  }
}

export async function completeTakipProje(
  id: string, data: { tamamlanma_tarihi: string; teslim_tipi: "hard_copy" | "dijital"; hard_copy_adedi: number | null },
): Promise<Result> {
  try {
    const r = await api<{ message: string }>(`/api/takip/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ tamamlanmaTarihi: orNull(data.tamamlanma_tarihi), teslimTipi: data.teslim_tipi, hardCopyAdedi: data.hard_copy_adedi }),
    });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Tamamlanamadı.");
  }
}

export async function deleteTakipProje(id: string): Promise<Result> {
  try {
    const r = await api<{ message: string }>(`/api/takip/${id}`, { method: "DELETE" });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Silinemedi.");
  }
}

/** Upload straight to storage, then record the document (a single-file kind replaces the previous one). */
export async function uploadTakipFile(takipId: string, kind: string, file: File): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const up = await api<{ key: string; url: string; contentType: string }>(`/api/takip/${takipId}/documents/upload-url`, {
      method: "POST", body: JSON.stringify({ kind, fileName: file.name, contentType: file.type || null }),
    });
    const put = await fetch(up.url, { method: "PUT", headers: { "content-type": up.contentType }, body: file });
    if (!put.ok) return { ok: false, error: `Depolamaya yüklenemedi (HTTP ${put.status}).` };
    const r = await api<{ id: string }>(`/api/takip/${takipId}/documents`, { method: "POST", body: JSON.stringify({ key: up.key, originalName: file.name }) });
    return { ok: true, id: r.id };
  } catch (e) {
    const r = fail(e, "Dosya yüklenemedi.");
    return { ok: false, error: r.ok ? undefined : r.error };
  }
}
