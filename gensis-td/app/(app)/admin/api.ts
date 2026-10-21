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

const companyBody = (form: Record<string, string>) => JSON.stringify({
  shortName: form.short_name, legalName: form.legal_name, address: form.address, phone: form.phone,
  mobilePhone: form.mobile_phone, city: form.city, authorizedPerson: form.authorized_person,
  registeredBrand: form.registered_brand, industryRegNo: form.industry_reg_no, email: form.email,
  ceModule: form.ce_module, category: form.category, sector: form.sector,
});

export async function createCompany(form: Record<string, string>): Promise<Result> {
  try {
    const r = await api<WriteResult>("/api/companies", { method: "POST", body: companyBody(form) });
    return done(r, "", "Müşteri eklendi.");
  } catch (e) {
    return fail(e, "Müşteri eklenemedi.");
  }
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

// Staff-only deletes (the API refuses a company with files and Gensis's own company).
async function remove(path: string, fallback: string): Promise<Result> {
  try {
    const r = await api<{ message: string }>(path, { method: "DELETE" });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, fallback);
  }
}
export const deleteCompany = (id: string) => remove(`/api/companies/${id}`, "Müşteri silinemedi.");
export const deleteCompanyDocument = (id: string) => remove(`/api/companies/documents/${id}`, "Belge silinemedi.");
export const deleteEngineer = (id: string) => remove(`/api/engineers/${id}`, "Mühendis silinemedi.");
export const deleteEngineerDocument = (id: string) => remove(`/api/engineers/documents/${id}`, "Belge silinemedi.");


// New ilgili idare from the proje onay wizard (staff only in the API).
export async function createIlgiliIdare(form: { name: string; address?: string; province_id?: number | null; suffix?: string }): Promise<Result> {
  try {
    const r = await api<{ id: string }>("/api/catalog/ilgili-idareler", {
      method: "POST", body: JSON.stringify({ name: form.name, address: form.address, provinceId: form.province_id ?? null, suffix: form.suffix }),
    });
    return { ok: true, message: "İlgili idare eklendi.", id: r.id };
  } catch (e) {
    return fail(e, "İlgili idare eklenemedi.");
  }
}

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

// User management (admin only in the API).
export async function createUser(form: { email: string; password: string; full_name: string; role: string; company_id: string }): Promise<Result> {
  try {
    const r = await api<{ id: string; message: string }>("/api/users", {
      method: "POST",
      body: JSON.stringify({ email: form.email, password: form.password, fullName: form.full_name, role: form.role || null, companyId: orNull(form.company_id) }),
    });
    return { ok: true, message: r.message, id: r.id };
  } catch (e) {
    return fail(e, "Kullanıcı oluşturulamadı.");
  }
}

export async function updateUser(form: {
  id: string; full_name: string; role: string; company_id: string; is_active: string; password?: string;
}): Promise<Result> {
  try {
    const r = await api<{ message: string }>(`/api/users/${form.id}`, {
      method: "PUT",
      body: JSON.stringify({
        fullName: form.full_name, role: form.role || null, companyId: orNull(form.company_id),
        isActive: form.is_active === "true", password: form.password || null,
      }),
    });
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e, "Kullanıcı güncellenemedi.");
  }
}

export const deleteUser = (id: string) => remove(`/api/users/${id}`, "Kullanıcı silinemedi.");

// ---- Catalog management (staff only in the API) ----
async function post<T>(path: string, method: "POST" | "PUT", body: unknown, fallback: string): Promise<Result & { data?: T }> {
  try {
    const r = await api<T & { id?: string; message?: string }>(path, { method, body: JSON.stringify(body) });
    return { ok: true, message: r.message, id: r.id, data: r };
  } catch (e) {
    return fail(e, fallback);
  }
}

export const createEquipmentBrand = (form: { category_id: string; name: string }) =>
  post("/api/catalog/equipment/brands", "POST", { categoryId: form.category_id, name: form.name }, "Marka eklenemedi.");

export const createEquipmentModel = (form: {
  category_id: string; brand_id: string; new_brand: string; model_name: string; certificate_id?: string; cert_ids?: string[];
}) => post("/api/catalog/equipment/models", "POST", {
  categoryId: form.category_id, brandId: orNull(form.brand_id), newBrand: form.new_brand, modelName: form.model_name,
  certificateId: orNull(form.certificate_id), certIds: (form.cert_ids ?? []).filter(Boolean),
}, "Model eklenemedi.");

export const updateEquipmentModel = (form: { id: string; name: string; certificate_id?: string; cert_ids?: string[] }) =>
  post(`/api/catalog/equipment/models/${form.id}`, "PUT", {
    name: form.name, certificateId: orNull(form.certificate_id), certIds: (form.cert_ids ?? []).filter(Boolean),
  }, "Model güncellenemedi.");

export const deleteEquipmentModel = (id: string) => remove(`/api/catalog/equipment/models/${id}`, "Model silinemedi.");

const certificateBody = (fd: FormData) => ({
  certNo: String(fd.get("cert_no") || "").trim(), notifiedBodyId: orNull(fd.get("notified_body_id")),
  issueDate: orNull(fd.get("issue_date")), validUntil: orNull(fd.get("valid_until")), belgeTipi: orNull(fd.get("belge_tipi")),
  categoryId: orNull(fd.get("category_id")), firmaAdi: orNull(fd.get("firma_adi")), modelId: orNull(fd.get("model_id")),
});

/** Uploads the PDF (if any) as the certificate's new current version. */
async function uploadCertificateFile(certId: string, file: File | null): Promise<void> {
  if (!file || file.size === 0) return;
  const up = await api<{ key: string; url: string; contentType: string }>(`/api/catalog/certificates/${certId}/files/upload-url`, {
    method: "POST", body: JSON.stringify({ fileName: file.name }),
  });
  const put = await fetch(up.url, { method: "PUT", headers: { "content-type": up.contentType }, body: file });
  if (!put.ok) throw new Error("Dosya yüklenemedi.");
  await api(`/api/catalog/certificates/${certId}/files`, { method: "POST", body: JSON.stringify({ key: up.key, originalName: file.name }) });
}

export async function createCertificate(fd: FormData): Promise<Result> {
  if (!String(fd.get("cert_no") || "").trim()) return { ok: false, error: "Sertifika no zorunlu." };
  try {
    const r = await api<{ id: string; message: string }>("/api/catalog/certificates", { method: "POST", body: JSON.stringify(certificateBody(fd)) });
    await uploadCertificateFile(r.id, fd.get("file") as File | null);
    return { ok: true, message: r.message, id: r.id };
  } catch (e) {
    return fail(e, "Sertifika kaydedilemedi.");
  }
}

export async function updateCertificate(fd: FormData): Promise<Result> {
  const id = String(fd.get("id") || "");
  if (!id) return { ok: false, error: "Sertifika bulunamadı." };
  try {
    const r = await api<{ id: string; message: string }>(`/api/catalog/certificates/${id}`, { method: "PUT", body: JSON.stringify(certificateBody(fd)) });
    await uploadCertificateFile(id, fd.get("file") as File | null);
    return { ok: true, message: r.message, id };
  } catch (e) {
    return fail(e, "Sertifika güncellenemedi.");
  }
}

export const deleteCertificate = (id: string) => remove(`/api/catalog/certificates/${id}`, "Sertifika silinemedi.");

type IdareForm = { name: string; address?: string; province_id?: number | null; suffix?: string };
export const updateIlgiliIdare = (id: string, form: IdareForm) =>
  post(`/api/catalog/ilgili-idareler/${id}`, "PUT", { name: form.name, address: form.address, provinceId: form.province_id ?? null, suffix: form.suffix }, "İlgili idare güncellenemedi.");
export const deleteIlgiliIdare = (id: string) => remove(`/api/catalog/ilgili-idareler/${id}`, "İlgili idare silinemedi.");

type NbForm = { name: string; identity_no?: string; address?: string; short_name?: string; city?: string; country?: string };
const nbBody = (f: NbForm) => ({ name: f.name, identityNo: f.identity_no, address: f.address, shortName: f.short_name, city: f.city, country: f.country });
export const createNotifiedBody = (form: NbForm) => post("/api/catalog/notified-bodies", "POST", nbBody(form), "Kuruluş eklenemedi.");
export const updateNotifiedBody = (id: string, form: NbForm) => post(`/api/catalog/notified-bodies/${id}`, "PUT", nbBody(form), "Kuruluş güncellenemedi.");
export const deleteNotifiedBody = (id: string) => remove(`/api/catalog/notified-bodies/${id}`, "Kuruluş silinemedi.");
