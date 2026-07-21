"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function assertAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin") throw new Error("Bu işlem için admin yetkisi gerekli.");
  return user;
}

// Oturumdaki kullanıcının rol + firma bilgisi (rol-farkında aksiyonlar için)
const isStaffRole = (r: string) => r === "admin" || r === "gensis";
async function getActor(): Promise<{ userId: string; role: string; companyId: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");
  const { data: prof } = await supabase.from("profiles").select("role, company_id, is_active").eq("id", user.id).single();
  if (!prof || prof.is_active === false) throw new Error("Hesap aktif değil.");
  return { userId: user.id, role: (prof.role as string) ?? "customer", companyId: (prof.company_id as string | null) ?? null };
}
async function assertStaff() {
  const a = await getActor();
  if (!isStaffRole(a.role)) throw new Error("Bu işlem için personel yetkisi gerekli.");
  return a;
}

// ---------- Yeni Müşteri (firma) ----------
export async function createCompany(form: Record<string, string>): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.short_name || !form.legal_name) return { ok: false, error: "Kısa ad ve ünvan zorunlu." };
    const admin = createAdminClient();
    const { data, error } = await admin.from("companies").insert({
      short_name: form.short_name,
      legal_name: form.legal_name,
      address: form.address || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      city: form.city || null,
      authorized_person: form.authorized_person || null,
      registered_brand: form.registered_brand || null,
      industry_reg_no: form.industry_reg_no || null,
      email: form.email || null,
      ce_module: form.ce_module || null,
    }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Müşteri eklenemedi." };
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Müşteri eklendi.", id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Müşteri Güncelle ----------
export async function updateCompany(id: string, form: Record<string, string>): Promise<Result> {
  try {
    const actor = await getActor();
    const staff = isStaffRole(actor.role);
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    if (!staff && actor.companyId !== id) return { ok: false, error: "Yalnız kendi firmanızı düzenleyebilirsiniz." };
    const admin = createAdminClient();
    const cols = {
      short_name: form.short_name,
      legal_name: form.legal_name,
      address: form.address || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      city: form.city || null,
      authorized_person: form.authorized_person || null,
      registered_brand: form.registered_brand || null,
      industry_reg_no: form.industry_reg_no || null,
      email: form.email || null,
      ce_module: form.ce_module || null,
    };
    if (!staff) {
      const { error } = await admin.from("pending_changes").insert({
        kind: "company_edit", company_id: id, target_id: id, payload: cols, submitted_by: actor.userId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: "Firma güncellemesi onaya gönderildi." };
    }
    const { error } = await admin.from("companies").update(cols).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Müşteri güncellendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Müşteri Sil ----------
export async function deleteCompany(id: string): Promise<Result> {
  try {
    await assertAdmin();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    const admin = createAdminClient();
    // Güvenlik: teknik dosyası / proje onayı olan firma silinmesin (bu kayıtlar sessizce yok olmasın)
    const { count: pc } = await admin.from("projects").select("*", { count: "exact", head: true }).eq("company_id", id);
    if ((pc ?? 0) > 0) return { ok: false, error: "Bu firmanın teknik dosyaları var; önce onları silin." };
    const { count: oc } = await admin.from("proje_onay").select("*", { count: "exact", head: true }).eq("company_id", id);
    if ((oc ?? 0) > 0) return { ok: false, error: "Bu firmanın proje onay dosyaları var; önce onları silin." };

    // 1) Firma belgeleri + depodaki dosyalar
    const { data: cdocs } = await admin.from("company_documents").select("storage_path").eq("company_id", id);
    const cPaths = (cdocs ?? []).map((d: any) => d.storage_path).filter(Boolean);
    if (cPaths.length) await admin.storage.from("documents").remove(cPaths);
    await admin.from("company_documents").delete().eq("company_id", id);

    // 2) Bağlı mühendisler + belgeleri + depodaki dosyalar
    const { data: engs } = await admin.from("engineers").select("id").eq("company_id", id);
    const engIds = (engs ?? []).map((e: any) => e.id);
    if (engIds.length) {
      const { data: edocs } = await admin.from("engineer_documents").select("storage_path").in("engineer_id", engIds);
      const ePaths = (edocs ?? []).map((d: any) => d.storage_path).filter(Boolean);
      if (ePaths.length) await admin.storage.from("documents").remove(ePaths);
      await admin.from("engineer_documents").delete().in("engineer_id", engIds);
      // projelerdeki mühendis referanslarını çöz (FK engellemesin)
      await admin.from("projects").update({ makine_muhendis_id: null }).in("makine_muhendis_id", engIds);
      await admin.from("projects").update({ elektrik_muhendis_id: null }).in("elektrik_muhendis_id", engIds);
      await admin.from("engineers").delete().in("id", engIds);
    }

    // 3) Firmaya bağlı bekleyen onaylar (tablo yoksa yok say)
    await admin.from("pending_changes").delete().eq("company_id", id);

    // 4) Kullanıcı profillerini firmadan çöz
    await admin.from("profiles").update({ company_id: null }).eq("company_id", id);

    const { error } = await admin.from("companies").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Müşteri, belgeleri ve bağlı mühendisleri silindi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// Gensis (operatör) firmasını bul/oluştur — personel kullanıcılar buna bağlanır
async function ensureGensisCompany(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data: g } = await admin.from("companies").select("id").ilike("short_name", "gensis").maybeSingle();
  if (g) return g.id;
  const { data: created } = await admin
    .from("companies")
    .insert({ short_name: "GENSİS", legal_name: "GENSİS", city: "BURSA" })
    .select("id")
    .single();
  return created?.id ?? null;
}

// ---------- Yeni Kullanıcı (rol + firma) ----------
export async function createUser(form: {
  email: string; password: string; full_name: string; role: string; company_id: string;
}): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.email || !form.password) return { ok: false, error: "E-posta ve şifre zorunlu." };
    if (!["admin", "gensis", "customer"].includes(form.role)) return { ok: false, error: "Geçersiz rol." };
    const admin = createAdminClient();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.full_name },
    });
    if (cErr || !created?.user) return { ok: false, error: cErr?.message ?? "Kullanıcı oluşturulamadı." };
    // Admin/Gensis personeli otomatik Gensis firmasına bağlanır (müşteriye değil)
    const staff = form.role === "admin" || form.role === "gensis";
    const companyId = staff ? await ensureGensisCompany(admin) : form.company_id || null;
    // profil satırı trigger ile oluşur; rol ve firmayı ata
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        full_name: form.full_name || form.email,
        role: form.role,
        company_id: companyId,
        is_active: true,
      },
      { onConflict: "id" }
    );
    if (pErr) return { ok: false, error: "Kullanıcı açıldı ama profil güncellenemedi: " + pErr.message };
    revalidatePath("/admin/kullanicilar");
    return { ok: true, message: "Kullanıcı oluşturuldu." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Kullanıcı Güncelle (profil + opsiyonel şifre) ----------
export async function updateUser(form: {
  id: string; full_name: string; role: string; company_id: string; is_active: string; password?: string;
}): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.id) return { ok: false, error: "Kullanıcı bulunamadı." };
    if (!["admin", "gensis", "customer"].includes(form.role)) return { ok: false, error: "Geçersiz rol." };
    const admin = createAdminClient();
    // Admin/Gensis personeli otomatik Gensis firmasına bağlanır
    const staff = form.role === "admin" || form.role === "gensis";
    const companyId = staff ? await ensureGensisCompany(admin) : form.company_id || null;
    const { error: pErr } = await admin
      .from("profiles")
      .update({
        full_name: form.full_name || null,
        role: form.role,
        company_id: companyId,
        is_active: form.is_active === "true",
      })
      .eq("id", form.id);
    if (pErr) return { ok: false, error: pErr.message };
    // yeni şifre girildiyse güncelle
    if (form.password && form.password.length > 0) {
      if (form.password.length < 6) return { ok: false, error: "Şifre en az 6 karakter olmalı." };
      const { error: aErr } = await admin.auth.admin.updateUserById(form.id, { password: form.password });
      if (aErr) return { ok: false, error: "Şifre güncellenemedi: " + aErr.message };
    }
    revalidatePath("/admin/kullanicilar");
    return { ok: true, message: "Kullanıcı güncellendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Yeni Ekipman-Model ----------
export async function createEquipmentModel(form: {
  category_id: string; brand_id: string; new_brand: string; model_name: string; certificate_id: string;
}): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.category_id || !form.model_name) return { ok: false, error: "Kategori ve model adı zorunlu." };
    const admin = createAdminClient();
    let brandId = form.brand_id;
    if (!brandId && form.new_brand) {
      const { data: b, error: bErr } = await admin
        .from("equipment_brands")
        .insert({ category_id: form.category_id, name: form.new_brand })
        .select("id")
        .single();
      if (bErr || !b) return { ok: false, error: "Marka eklenemedi: " + (bErr?.message ?? "") };
      brandId = b.id;
    }
    if (!brandId) return { ok: false, error: "Marka seçin veya yeni marka girin." };
    const { data, error } = await admin.from("equipment_models").insert({
      brand_id: brandId,
      name: form.model_name,
      certificate_id: form.certificate_id || null,
    }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Model eklenemedi." };
    revalidatePath("/admin/ekipmanlar");
    return { ok: true, message: "Ekipman modeli eklendi.", id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Yeni Mühendis (Proje Müellifi) ----------
export async function createEngineer(form: {
  full_name: string; discipline: string; chamber_reg_no: string; company_id: string; address?: string; phone?: string;
}): Promise<Result> {
  try {
    const actor = await getActor();
    const staff = isStaffRole(actor.role);
    if (!form.full_name) return { ok: false, error: "Ad Soyad zorunlu." };
    if (!["makine", "elektrik"].includes(form.discipline)) return { ok: false, error: "Branş seçin." };
    const admin = createAdminClient();
    const title = form.discipline === "makine" ? "Mak.Müh." : "Elk.Müh.";
    if (!staff) {
      // Müşteri kendi firmasına ekleyebilir; onaya düşer
      const company_id = actor.companyId;
      if (!company_id) return { ok: false, error: "Firmanız bulunamadı." };
      const { error } = await admin.from("pending_changes").insert({
        kind: "engineer_new", company_id,
        payload: {
          full_name: form.full_name, discipline: form.discipline, title,
          chamber_reg_no: form.chamber_reg_no || null, company_id,
          address: form.address || null, phone: form.phone || null,
        },
        submitted_by: actor.userId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: "Yeni mühendis onaya gönderildi." };
    }
    const { data, error } = await admin.from("engineers").insert({
      full_name: form.full_name,
      discipline: form.discipline,
      title,
      chamber_reg_no: form.chamber_reg_no || null,
      company_id: form.company_id || null,
      address: form.address || null,
      phone: form.phone || null,
      is_active: true,
    }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Mühendis eklenemedi." };
    revalidatePath("/admin/muhendisler");
    return { ok: true, message: "Mühendis eklendi.", id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Mühendis Güncelle ----------
export async function updateEngineer(id: string, form: {
  full_name: string; discipline: string; chamber_reg_no: string; company_id: string; address?: string; phone?: string;
}): Promise<Result> {
  try {
    const actor = await getActor();
    const staff = isStaffRole(actor.role);
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    if (!["makine", "elektrik"].includes(form.discipline)) return { ok: false, error: "Branş seçin." };
    const admin = createAdminClient();
    const title = form.discipline === "makine" ? "Mak.Müh." : "Elk.Müh.";
    const cols = {
      full_name: form.full_name,
      discipline: form.discipline,
      title,
      chamber_reg_no: form.chamber_reg_no || null,
      company_id: form.company_id || null,
      address: form.address || null,
      phone: form.phone || null,
    };
    if (!staff) {
      // Müşteri yalnız kendi firmasının mühendisini düzenleyebilir; onaya düşer
      const { data: eng } = await admin.from("engineers").select("company_id").eq("id", id).maybeSingle();
      if (!actor.companyId || eng?.company_id !== actor.companyId) return { ok: false, error: "Yalnız kendi mühendislerinizi düzenleyebilirsiniz." };
      const { error } = await admin.from("pending_changes").insert({
        kind: "engineer_edit", company_id: actor.companyId, target_id: id, engineer_id: id,
        payload: { ...cols, company_id: actor.companyId }, submitted_by: actor.userId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: "Mühendis güncellemesi onaya gönderildi." };
    }
    const { error } = await admin.from("engineers").update(cols).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/muhendisler");
    return { ok: true, message: "Mühendis güncellendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Mühendis Sil ----------
export async function deleteEngineer(id: string): Promise<Result> {
  try {
    await assertAdmin();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    const admin = createAdminClient();
    // projelerdeki referansları temizle (FK engellemesin)
    await admin.from("projects").update({ makine_muhendis_id: null }).eq("makine_muhendis_id", id);
    await admin.from("projects").update({ elektrik_muhendis_id: null }).eq("elektrik_muhendis_id", id);
    const { error } = await admin.from("engineers").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/muhendisler");
    return { ok: true, message: "Mühendis silindi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Müşteri Belgesi Yükle / Güncelle (Sanayi Sicil, TSE HYB ...) ----------
export async function uploadCompanyDocument(formData: FormData): Promise<Result> {
  try {
    const actor = await getActor();
    const staff = isStaffRole(actor.role);
    const company_id = String(formData.get("company_id") || "");
    const doc_type = String(formData.get("doc_type") || "");
    const belge_no = String(formData.get("belge_no") || "") || null;
    const issue_date = String(formData.get("issue_date") || "") || null;
    const valid_until = String(formData.get("valid_until") || "") || null;
    const notified_body_id = String(formData.get("notified_body_id") || "") || null;
    const doc_id = String(formData.get("doc_id") || "") || null;
    const sub_type = String(formData.get("sub_type") || "") || null;
    const parent_id = String(formData.get("parent_id") || "") || null;
    const file = formData.get("file") as File | null;
    if (!company_id || !doc_type) return { ok: false, error: "Eksik bilgi." };
    if (!staff && actor.companyId !== company_id) return { ok: false, error: "Yalnız kendi firmanızın belgelerini yükleyebilirsiniz." };

    const admin = createAdminClient();

    // Dosya: personel → kalıcı yol; müşteri → pending/ yolu (onay sonrası taşınır)
    let storage_path: string | null = null;
    let original_name: string | null = null;
    if (file && file.size > 0) {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const base = `musteri/${company_id}/${doc_type}-${randomUUID()}.${ext}`;
      const path = staff ? base : `pending/${base}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) return { ok: false, error: "Dosya yüklenemedi: " + upErr.message };
      storage_path = path;
      original_name = file.name;
    }

    if (!staff) {
      const { error } = await admin.from("pending_changes").insert({
        kind: "company_doc", company_id, target_id: doc_id, doc_type,
        payload: { belge_no, issue_date, valid_until, notified_body_id, sub_type, parent_id },
        storage_path, original_name, submitted_by: actor.userId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: "Belge onaya gönderildi." };
    }

    const row: Record<string, any> = { company_id, doc_type, belge_no, issue_date, valid_until, notified_body_id, sub_type, parent_id };
    if (storage_path) { row.storage_path = storage_path; row.original_name = original_name; }

    let newId: string | undefined;
    if (doc_id) {
      const { error } = await admin.from("company_documents").update(row).eq("id", doc_id);
      if (error) return { ok: false, error: error.message };
      newId = doc_id;
    } else {
      const { data, error } = await admin.from("company_documents").insert(row).select("id").single();
      if (error || !data) return { ok: false, error: error?.message ?? "Belge kaydedilemedi." };
      newId = data.id;
    }

    // Belge veriliş tarihlerini firma kartına da yansıt (belgelerde kullanılır)
    if (issue_date && doc_type === "sanayi_sicil") await admin.from("companies").update({ industry_reg_date: issue_date }).eq("id", company_id);
    if (issue_date && doc_type === "tse_hyb") await admin.from("companies").update({ hyb_date: issue_date }).eq("id", company_id);

    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Belge kaydedildi.", id: newId };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Müşteri Belgesi Sil ----------
export async function deleteCompanyDocument(id: string): Promise<Result> {
  try {
    await assertAdmin();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    const admin = createAdminClient();
    const { data: doc } = await admin.from("company_documents").select("storage_path").eq("id", id).maybeSingle();
    if (doc?.storage_path) await admin.storage.from("documents").remove([doc.storage_path]);
    const { error } = await admin.from("company_documents").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Belge silindi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Mühendis Belgesi Yükle / Güncelle (dosya + geçerlilik) ----------
export async function uploadEngineerDocument(formData: FormData): Promise<Result> {
  try {
    const actor = await getActor();
    const staff = isStaffRole(actor.role);
    const engineer_id = String(formData.get("engineer_id") || "");
    const doc_type = String(formData.get("doc_type") || "");
    const valid_until = String(formData.get("valid_until") || "") || null;
    const file = formData.get("file") as File | null;
    if (!engineer_id || !doc_type) return { ok: false, error: "Eksik bilgi." };

    const admin = createAdminClient();

    // Müşteri: mühendis kendi firmasına ait olmalı
    let engCompanyId: string | null = null;
    if (!staff) {
      const { data: eng } = await admin.from("engineers").select("company_id").eq("id", engineer_id).maybeSingle();
      engCompanyId = eng?.company_id ?? null;
      if (!actor.companyId || engCompanyId !== actor.companyId) return { ok: false, error: "Yalnız kendi mühendislerinizin belgelerini yükleyebilirsiniz." };
    }

    let storage_path: string | null = null;
    let original_name: string | null = null;
    if (file && file.size > 0) {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const base = `muhendis/${engineer_id}/${doc_type}-${randomUUID()}.${ext}`;
      const path = staff ? base : `pending/${base}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) return { ok: false, error: "Dosya yüklenemedi: " + upErr.message };
      storage_path = path;
      original_name = file.name;
    }

    if (!staff) {
      const { error } = await admin.from("pending_changes").insert({
        kind: "engineer_doc", company_id: engCompanyId, engineer_id, doc_type,
        payload: { valid_until }, storage_path, original_name, submitted_by: actor.userId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: "Belge onaya gönderildi." };
    }

    const row: Record<string, any> = { engineer_id, doc_type, valid_until };
    if (storage_path) { row.storage_path = storage_path; row.original_name = original_name; }
    const { error } = await admin.from("engineer_documents").upsert(row, { onConflict: "engineer_id,doc_type" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/muhendisler");
    return { ok: true, message: "Belge kaydedildi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Mühendis Belgesi Sil ----------
export async function deleteEngineerDocument(id: string): Promise<Result> {
  try {
    await assertAdmin();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    const admin = createAdminClient();
    const { data: doc } = await admin.from("engineer_documents").select("storage_path").eq("id", id).maybeSingle();
    if (doc?.storage_path) await admin.storage.from("documents").remove([doc.storage_path]);
    const { error } = await admin.from("engineer_documents").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/muhendisler");
    return { ok: true, message: "Belge silindi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Ekipman-Model Güncelle (isim + sertifika bağla) ----------
export async function updateEquipmentModel(form: {
  id: string; name: string; certificate_id: string;
}): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.id) return { ok: false, error: "Model bulunamadı." };
    const admin = createAdminClient();
    const { error } = await admin.from("equipment_models").update({
      name: form.name,
      certificate_id: form.certificate_id || null,
    }).eq("id", form.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/ekipmanlar");
    revalidatePath("/admin/sertifikalar");
    return { ok: true, message: "Model güncellendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Yeni Onaylanmış Kuruluş ----------
export async function createNotifiedBody(form: { name: string; identity_no: string; address: string }): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.name?.trim()) return { ok: false, error: "Kuruluş adı zorunlu." };
    const admin = createAdminClient();
    const { data, error } = await admin.from("notified_bodies").insert({
      name: form.name.trim(),
      identity_no: form.identity_no?.trim() || null,
      address: form.address?.trim() || null,
    }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Kuruluş eklenemedi." };
    revalidatePath("/admin/ekipmanlar");
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Onaylanmış kuruluş eklendi.", id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Yeni Sertifika (PDF yükleme + modele bağla) ----------
export async function createCertificate(formData: FormData): Promise<Result> {
  try {
    await assertAdmin();
    const cert_no = String(formData.get("cert_no") || "");
    const notified_body_id = String(formData.get("notified_body_id") || "");
    const model_id = String(formData.get("model_id") || "");
    const issue_date = String(formData.get("issue_date") || "") || null;
    const valid_until = String(formData.get("valid_until") || "") || null;
    const file = formData.get("file") as File | null;
    if (!cert_no) return { ok: false, error: "Sertifika no zorunlu." };

    const admin = createAdminClient();

    // sertifika kaydı (varsa mevcut cert_no'yu bul)
    let certId: string;
    const { data: existing } = await admin.from("certificates").select("id").eq("cert_no", cert_no).maybeSingle();
    if (existing) {
      certId = existing.id;
      await admin.from("certificates")
        .update({ notified_body_id: notified_body_id || null, issue_date, valid_until })
        .eq("id", certId);
    } else {
      const { data: c, error: cErr } = await admin
        .from("certificates")
        .insert({ cert_no, notified_body_id: notified_body_id || null, issue_date, valid_until })
        .select("id")
        .single();
      if (cErr || !c) return { ok: false, error: "Sertifika kaydı oluşturulamadı: " + (cErr?.message ?? "") };
      certId = c.id;
    }

    // dosya yükleme (varsa)
    if (file && file.size > 0) {
      const path = `${certId}/${randomUUID()}.pdf`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from("certificates").upload(path, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) return { ok: false, error: "Dosya yüklenemedi: " + upErr.message };
      // eski geçerli sürümü pasifle, yeni sürüm ekle
      await admin.from("certificate_files").update({ is_current: false }).eq("certificate_id", certId).eq("is_current", true);
      const { count } = await admin
        .from("certificate_files")
        .select("*", { count: "exact", head: true })
        .eq("certificate_id", certId);
      const { error: fErr } = await admin.from("certificate_files").insert({
        certificate_id: certId,
        version: (count ?? 0) + 1,
        storage_path: path,
        original_name: file.name,
        is_current: true,
      });
      if (fErr) return { ok: false, error: "Dosya kaydı oluşturulamadı: " + fErr.message };
    }

    // modele bağla
    if (model_id) {
      await admin.from("equipment_models").update({ certificate_id: certId }).eq("id", model_id);
    }

    revalidatePath("/admin/sertifikalar");
    return { ok: true, message: "Sertifika kaydedildi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ==================== ONAY KUYRUĞU (FAZ 2) ====================

// ---------- Onayla: bekleyen değişikliği gerçek tabloya uygula ----------
export async function approvePendingChange(id: string): Promise<Result> {
  try {
    const actor = await assertStaff();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    const admin = createAdminClient();
    const { data: pc } = await admin.from("pending_changes").select("*").eq("id", id).maybeSingle();
    if (!pc) return { ok: false, error: "Kayıt bulunamadı." };
    if (pc.status !== "pending") return { ok: false, error: "Bu kayıt zaten işlenmiş." };
    const p = (pc.payload ?? {}) as Record<string, any>;

    // Geçici dosyayı kalıcı yola taşı
    const moveFile = async (): Promise<string | null> => {
      let sp: string | null = pc.storage_path;
      if (sp && sp.startsWith("pending/")) {
        const finalPath = sp.replace(/^pending\//, "");
        const { error: mvErr } = await admin.storage.from("documents").move(sp, finalPath);
        if (!mvErr) sp = finalPath;
      }
      return sp;
    };

    if (pc.kind === "company_doc") {
      const sp = await moveFile();
      const row: Record<string, any> = {
        company_id: pc.company_id, doc_type: pc.doc_type,
        belge_no: p.belge_no ?? null, issue_date: p.issue_date ?? null, valid_until: p.valid_until ?? null,
        notified_body_id: p.notified_body_id ?? null, sub_type: p.sub_type ?? null, parent_id: p.parent_id ?? null,
      };
      if (pc.storage_path) { row.storage_path = sp; row.original_name = pc.original_name; }
      if (pc.target_id) {
        const { error } = await admin.from("company_documents").update(row).eq("id", pc.target_id);
        if (error) return { ok: false, error: error.message };
      } else {
        const { error } = await admin.from("company_documents").insert(row);
        if (error) return { ok: false, error: error.message };
      }
      if (p.issue_date && pc.doc_type === "sanayi_sicil") await admin.from("companies").update({ industry_reg_date: p.issue_date }).eq("id", pc.company_id);
      if (p.issue_date && pc.doc_type === "tse_hyb") await admin.from("companies").update({ hyb_date: p.issue_date }).eq("id", pc.company_id);
    } else if (pc.kind === "engineer_doc") {
      const sp = await moveFile();
      const row: Record<string, any> = { engineer_id: pc.engineer_id, doc_type: pc.doc_type, valid_until: p.valid_until ?? null };
      if (pc.storage_path) { row.storage_path = sp; row.original_name = pc.original_name; }
      const { error } = await admin.from("engineer_documents").upsert(row, { onConflict: "engineer_id,doc_type" });
      if (error) return { ok: false, error: error.message };
    } else if (pc.kind === "engineer_new") {
      const { error } = await admin.from("engineers").insert({
        full_name: p.full_name, discipline: p.discipline, title: p.title,
        chamber_reg_no: p.chamber_reg_no ?? null, company_id: p.company_id ?? pc.company_id,
        address: p.address ?? null, phone: p.phone ?? null, is_active: true,
      });
      if (error) return { ok: false, error: error.message };
    } else if (pc.kind === "engineer_edit") {
      if (!pc.target_id) return { ok: false, error: "Hedef mühendis bulunamadı." };
      const { error } = await admin.from("engineers").update({
        full_name: p.full_name, discipline: p.discipline, title: p.title,
        chamber_reg_no: p.chamber_reg_no ?? null, company_id: p.company_id ?? null,
        address: p.address ?? null, phone: p.phone ?? null,
      }).eq("id", pc.target_id);
      if (error) return { ok: false, error: error.message };
    } else if (pc.kind === "company_edit") {
      if (!pc.target_id) return { ok: false, error: "Hedef firma bulunamadı." };
      const { error } = await admin.from("companies").update(p).eq("id", pc.target_id);
      if (error) return { ok: false, error: error.message };
    } else {
      return { ok: false, error: "Bilinmeyen değişiklik türü." };
    }

    await admin.from("pending_changes").update({
      status: "approved", reviewed_by: actor.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    revalidatePath("/onaylar"); revalidatePath("/admin/musteriler"); revalidatePath("/admin/muhendisler"); revalidatePath("/bildirimler");
    return { ok: true, message: "Onaylandı." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Reddet: bekleyen değişikliği iptal et (geçici dosyayı sil) ----------
export async function rejectPendingChange(id: string, note?: string): Promise<Result> {
  try {
    const actor = await assertStaff();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    const admin = createAdminClient();
    const { data: pc } = await admin.from("pending_changes").select("storage_path, status").eq("id", id).maybeSingle();
    if (!pc) return { ok: false, error: "Kayıt bulunamadı." };
    if (pc.status !== "pending") return { ok: false, error: "Bu kayıt zaten işlenmiş." };
    if (pc.storage_path) await admin.storage.from("documents").remove([pc.storage_path]);
    await admin.from("pending_changes").update({
      status: "rejected", note: note || null, reviewed_by: actor.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    revalidatePath("/onaylar"); revalidatePath("/bildirimler");
    return { ok: true, message: "Reddedildi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
