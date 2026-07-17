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
    await assertAdmin();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    const admin = createAdminClient();
    const { error } = await admin.from("companies").update({
      short_name: form.short_name,
      legal_name: form.legal_name,
      address: form.address || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      city: form.city || null,
      authorized_person: form.authorized_person || null,
      registered_brand: form.registered_brand || null,
      industry_reg_no: form.industry_reg_no || null,
      ce_module: form.ce_module || null,
    }).eq("id", id);
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
    const { count: pc } = await admin.from("projects").select("*", { count: "exact", head: true }).eq("company_id", id);
    if ((pc ?? 0) > 0) return { ok: false, error: "Bu firmanın teknik dosyaları var; silmeden önce onları kaldırın." };
    const { count: oc } = await admin.from("proje_onay").select("*", { count: "exact", head: true }).eq("company_id", id);
    if ((oc ?? 0) > 0) return { ok: false, error: "Bu firmanın proje onay dosyaları var; silinemez." };
    // bağlı referansları çöz (FK engellemesin)
    await admin.from("engineers").update({ company_id: null }).eq("company_id", id);
    await admin.from("profiles").update({ company_id: null }).eq("company_id", id);
    const { error } = await admin.from("companies").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Müşteri silindi." };
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
    const { error } = await admin.from("equipment_models").insert({
      brand_id: brandId,
      name: form.model_name,
      certificate_id: form.certificate_id || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/ekipmanlar");
    return { ok: true, message: "Ekipman modeli eklendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Yeni Mühendis (Proje Müellifi) ----------
export async function createEngineer(form: {
  full_name: string; discipline: string; chamber_reg_no: string; company_id: string; address?: string; phone?: string;
}): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.full_name) return { ok: false, error: "Ad Soyad zorunlu." };
    if (!["makine", "elektrik"].includes(form.discipline)) return { ok: false, error: "Branş seçin." };
    const admin = createAdminClient();
    const title = form.discipline === "makine" ? "Mak.Müh." : "Elk.Müh.";
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
    await assertAdmin();
    if (!id) return { ok: false, error: "Kayıt bulunamadı." };
    if (!["makine", "elektrik"].includes(form.discipline)) return { ok: false, error: "Branş seçin." };
    const admin = createAdminClient();
    const title = form.discipline === "makine" ? "Mak.Müh." : "Elk.Müh.";
    const { error } = await admin.from("engineers").update({
      full_name: form.full_name,
      discipline: form.discipline,
      title,
      chamber_reg_no: form.chamber_reg_no || null,
      company_id: form.company_id || null,
      address: form.address || null,
      phone: form.phone || null,
    }).eq("id", id);
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
    await assertAdmin();
    const company_id = String(formData.get("company_id") || "");
    const doc_type = String(formData.get("doc_type") || "");
    const belge_no = String(formData.get("belge_no") || "") || null;
    const issue_date = String(formData.get("issue_date") || "") || null;
    const valid_until = String(formData.get("valid_until") || "") || null;
    const notified_body_id = String(formData.get("notified_body_id") || "") || null;
    const file = formData.get("file") as File | null;
    if (!company_id || !doc_type) return { ok: false, error: "Eksik bilgi." };

    const doc_id = String(formData.get("doc_id") || "") || null;
    const admin = createAdminClient();
    const row: Record<string, any> = { company_id, doc_type, belge_no, issue_date, valid_until, notified_body_id };

    if (file && file.size > 0) {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const path = `musteri/${company_id}/${doc_type}-${randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) return { ok: false, error: "Dosya yüklenemedi: " + upErr.message };
      row.storage_path = path;
      row.original_name = file.name;
    }

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
    await assertAdmin();
    const engineer_id = String(formData.get("engineer_id") || "");
    const doc_type = String(formData.get("doc_type") || "");
    const valid_until = String(formData.get("valid_until") || "") || null;
    const file = formData.get("file") as File | null;
    if (!engineer_id || !doc_type) return { ok: false, error: "Eksik bilgi." };

    const admin = createAdminClient();
    const row: Record<string, any> = { engineer_id, doc_type, valid_until };

    if (file && file.size > 0) {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const path = `muhendis/${engineer_id}/${doc_type}-${randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) return { ok: false, error: "Dosya yüklenemedi: " + upErr.message };
      row.storage_path = path;
      row.original_name = file.name;
    }

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

// ---------- Yeni Sertifika (PDF yükleme + modele bağla) ----------
export async function createCertificate(formData: FormData): Promise<Result> {
  try {
    await assertAdmin();
    const cert_no = String(formData.get("cert_no") || "");
    const notified_body_id = String(formData.get("notified_body_id") || "");
    const model_id = String(formData.get("model_id") || "");
    const file = formData.get("file") as File | null;
    if (!cert_no) return { ok: false, error: "Sertifika no zorunlu." };

    const admin = createAdminClient();

    // sertifika kaydı (varsa mevcut cert_no'yu bul)
    let certId: string;
    const { data: existing } = await admin.from("certificates").select("id").eq("cert_no", cert_no).maybeSingle();
    if (existing) {
      certId = existing.id;
      await admin.from("certificates").update({ notified_body_id: notified_body_id || null }).eq("id", certId);
    } else {
      const { data: c, error: cErr } = await admin
        .from("certificates")
        .insert({ cert_no, notified_body_id: notified_body_id || null })
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
