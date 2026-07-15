"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

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
    const { error } = await admin.from("companies").insert({
      short_name: form.short_name,
      legal_name: form.legal_name,
      address: form.address || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      city: form.city || null,
      authorized_person: form.authorized_person || null,
      registered_brand: form.registered_brand || null,
      industry_reg_no: form.industry_reg_no || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Müşteri eklendi." };
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
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/musteriler");
    return { ok: true, message: "Müşteri güncellendi." };
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
  full_name: string; discipline: string; chamber_reg_no: string; company_id: string;
}): Promise<Result> {
  try {
    await assertAdmin();
    if (!form.full_name) return { ok: false, error: "Ad Soyad zorunlu." };
    if (!["makine", "elektrik"].includes(form.discipline)) return { ok: false, error: "Branş seçin." };
    const admin = createAdminClient();
    const title = form.discipline === "makine" ? "Mak.Müh." : "Elk.Müh.";
    const { error } = await admin.from("engineers").insert({
      full_name: form.full_name,
      discipline: form.discipline,
      title,
      chamber_reg_no: form.chamber_reg_no || null,
      company_id: form.company_id || null,
      is_active: true,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/muhendisler");
    return { ok: true, message: "Mühendis eklendi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Mühendis Güncelle ----------
export async function updateEngineer(id: string, form: {
  full_name: string; discipline: string; chamber_reg_no: string; company_id: string;
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
