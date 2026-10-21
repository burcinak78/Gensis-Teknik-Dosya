// Company and engineer writes against the C# API, with the result shape of the old server actions
// in ./actions.ts. The API decides: staff write directly, customers' changes go to approval.
import { api, ApiError } from "@/lib/api/client";

export type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
type WriteResult = { pending: boolean; id: string | null };

const orNull = (v: FormDataEntryValue | string | null | undefined) => {
  const s = v == null ? "" : String(v);
  return s === "" ? null : s;
};
const fail = (e: unknown, fallback: string): Result => ({
  ok: false, error: e instanceof ApiError ? (e.status === 404 ? "Kayıt bulunamadı veya yetkiniz yok." : e.message) : fallback,
});
const done = (r: WriteResult, pendingMsg: string, directMsg: string): Result =>
  ({ ok: true, message: r.pending ? pendingMsg : directMsg, id: r.id ?? undefined });

/** Upload a file straight to storage; returns the key to confirm with, or null when there is no file. */
async function putFile(uploadUrlPath: string, docType: string, file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const up = await api<{ key: string; url: string; contentType: string }>(uploadUrlPath, {
    method: "POST", body: JSON.stringify({ docType, fileName: file.name, contentType: file.type || null }),
  });
  const res = await fetch(up.url, { method: "PUT", headers: { "content-type": up.contentType }, body: file });
  if (!res.ok) throw new Error("Dosya yüklenemedi.");
  return up.key;
}

export async function updateCompany(id: string, form: Record<string, string>): Promise<Result> {
  try {
    const r = await api<WriteResult>(`/api/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        shortName: form.short_name, legalName: form.legal_name, address: form.address, phone: form.phone,
        mobilePhone: form.mobile_phone, city: form.city, authorizedPerson: form.authorized_person,
        registeredBrand: form.registered_brand, industryRegNo: form.industry_reg_no, email: form.email,
        ceModule: form.ce_module, category: form.category, sector: form.sector,
      }),
    });
    return done(r, "Firma güncellemesi onaya gönderildi.", "Müşteri güncellendi.");
  } catch (e) {
    return fail(e, "Kaydedilemedi.");
  }
}

export async function uploadCompanyDocument(fd: FormData): Promise<Result> {
  const companyId = String(fd.get("company_id") || "");
  const docType = String(fd.get("doc_type") || "");
  if (!companyId || !docType) return { ok: false, error: "Eksik bilgi." };
  try {
    const file = fd.get("file") as File | null;
    const key = await putFile(`/api/companies/${companyId}/documents/upload-url`, docType, file);
    const r = await api<WriteResult>(`/api/companies/${companyId}/documents`, {
      method: "POST",
      body: JSON.stringify({
        docType, docId: orNull(fd.get("doc_id")), key, originalName: key ? file!.name : null,
        belgeNo: orNull(fd.get("belge_no")), issueDate: orNull(fd.get("issue_date")), validUntil: orNull(fd.get("valid_until")),
        notifiedBodyId: orNull(fd.get("notified_body_id")), subType: orNull(fd.get("sub_type")), parentId: orNull(fd.get("parent_id")),
      }),
    });
    return done(r, "Belge onaya gönderildi.", "Belge kaydedildi.");
  } catch (e) {
    return fail(e, "Belge kaydedilemedi.");
  }
}

type EngineerForm = { full_name: string; discipline: string; chamber_reg_no: string; company_id: string; address?: string; phone?: string };
const engineerBody = (f: EngineerForm) => JSON.stringify({
  fullName: f.full_name, discipline: f.discipline || null, chamberRegNo: f.chamber_reg_no,
  companyId: orNull(f.company_id), address: f.address, phone: f.phone,
});

export async function createEngineer(form: EngineerForm): Promise<Result> {
  try {
    const r = await api<WriteResult>("/api/engineers", { method: "POST", body: engineerBody(form) });
    return done(r, "Yeni mühendis onaya gönderildi.", "Mühendis eklendi.");
  } catch (e) {
    return fail(e, "Mühendis eklenemedi.");
  }
}

export async function updateEngineer(id: string, form: EngineerForm): Promise<Result> {
  try {
    const r = await api<WriteResult>(`/api/engineers/${id}`, { method: "PUT", body: engineerBody(form) });
    return done(r, "Mühendis güncellemesi onaya gönderildi.", "Mühendis güncellendi.");
  } catch (e) {
    return fail(e, "Mühendis güncellenemedi.");
  }
}

export async function uploadEngineerDocument(fd: FormData): Promise<Result> {
  const engineerId = String(fd.get("engineer_id") || "");
  const docType = String(fd.get("doc_type") || "");
  if (!engineerId || !docType) return { ok: false, error: "Eksik bilgi." };
  try {
    const file = fd.get("file") as File | null;
    const key = await putFile(`/api/engineers/${engineerId}/documents/upload-url`, docType, file);
    const r = await api<WriteResult>(`/api/engineers/${engineerId}/documents`, {
      method: "POST",
      body: JSON.stringify({ docType, key, originalName: key ? file!.name : null, validUntil: orNull(fd.get("valid_until")) }),
    });
    return done(r, "Belge onaya gönderildi.", "Belge kaydedildi.");
  } catch (e) {
    return fail(e, "Belge kaydedilemedi.");
  }
}

// Staff-only management actions; they move with the Yönetim screens.
const notYet = async (): Promise<Result> => ({ ok: false, error: "Bu yönetim işlemi yeni sisteme henüz taşınmadı." });
export const createCompany = (_form: Record<string, string>) => notYet();
export const deleteCompany = (_id: string) => notYet();
export const deleteCompanyDocument = (_id: string) => notYet();
export const deleteEngineer = (_id: string) => notYet();
export const createNotifiedBody = (_form: Record<string, unknown>) => notYet();

// Onaylar queue (staff only; the API re-checks the change against current data before applying it).
export async function approvePendingChange(id: string): Promise<Result> {
  try {
    const r = await api<{ message: string }>(`/api/pending-changes/${id}/approve`, { method: "POST" });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Onaylanamadı.");
  }
}

export async function rejectPendingChange(id: string, note?: string): Promise<Result> {
  try {
    const r = await api<{ message: string }>(`/api/pending-changes/${id}/reject`, { method: "POST", body: JSON.stringify({ note: note ?? null }) });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Reddedilemedi.");
  }
}
