"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type EquipmentSel = {
  category_id: string;
  slot: string;
  brand_id: string | null;
  model_id: string | null;
  certificate_id: string | null;
  seri_no: string | null;
  seri_list?: string[] | null;
};

export type DraftPayload = {
  company_id: string;
  dosya_no: string;
  dosya_tarihi: string | null;
  makine_muhendis_id: string | null;
  elektrik_muhendis_id: string | null;
  bina_adi: string | null;
  montaj_adresi: string | null;
  province_id: number | null;
  district_id: string | null;
  beyan_yuku_kg: number | null;
  kisi_sayisi: number | null;
  beyan_hizi: number | null;
  kat_adedi: number | null;
  durak_adedi: number | null;
  imal_yili: number | null;
  input_data: Record<string, unknown>;
  equipment: EquipmentSel[];
};

export async function saveDraftProject(payload: DraftPayload): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };

  if (!payload.company_id) return { ok: false, error: "Firma seçilmedi." };
  if (!payload.dosya_no) return { ok: false, error: "Dosya no boş olamaz." };

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      company_id: payload.company_id,
      created_by: user.id,
      status: "draft",
      dosya_no: payload.dosya_no,
      dosya_tarihi: payload.dosya_tarihi,
      makine_muhendis_id: payload.makine_muhendis_id,
      elektrik_muhendis_id: payload.elektrik_muhendis_id,
      bina_adi: payload.bina_adi,
      montaj_adresi: payload.montaj_adresi,
      province_id: payload.province_id,
      district_id: payload.district_id,
      beyan_yuku_kg: payload.beyan_yuku_kg,
      kisi_sayisi: payload.kisi_sayisi,
      beyan_hizi: payload.beyan_hizi,
      kat_adedi: payload.kat_adedi,
      durak_adedi: payload.durak_adedi,
      imal_yili: payload.imal_yili,
      input_data: payload.input_data,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { ok: false, error: error?.message ?? "Proje kaydedilemedi." };
  }

  const eq = payload.equipment.filter((e) => e.model_id);
  if (eq.length > 0) {
    const { error: eqErr } = await supabase.from("project_equipment").insert(
      eq.map((e) => ({
        project_id: project.id,
        category_id: e.category_id,
        slot: e.slot,
        brand_id: e.brand_id,
        model_id: e.model_id,
        certificate_id: e.certificate_id,
        seri_no: e.seri_no,
        seri_list: e.seri_list ?? null,
      }))
    );
    if (eqErr) return { ok: false, error: "Ekipman kaydı: " + eqErr.message };
  }

  return { ok: true, id: project.id };
}

// ---------- Mevcut teknik dosyayı güncelle (düzenleme) ----------
export async function updateDraftProject(id: string, payload: DraftPayload): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  if (!id) return { ok: false, error: "Kayıt bulunamadı." };
  if (!payload.company_id) return { ok: false, error: "Firma seçilmedi." };
  if (!payload.dosya_no) return { ok: false, error: "Dosya no boş olamaz." };

  const { error } = await supabase
    .from("projects")
    .update({
      company_id: payload.company_id,
      dosya_no: payload.dosya_no,
      dosya_tarihi: payload.dosya_tarihi,
      makine_muhendis_id: payload.makine_muhendis_id,
      elektrik_muhendis_id: payload.elektrik_muhendis_id,
      bina_adi: payload.bina_adi,
      montaj_adresi: payload.montaj_adresi,
      province_id: payload.province_id,
      district_id: payload.district_id,
      beyan_yuku_kg: payload.beyan_yuku_kg,
      kisi_sayisi: payload.kisi_sayisi,
      beyan_hizi: payload.beyan_hizi,
      kat_adedi: payload.kat_adedi,
      durak_adedi: payload.durak_adedi,
      imal_yili: payload.imal_yili,
      input_data: payload.input_data,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // ekipmanları sıfırla ve yeniden yaz (en güvenilir senkron yöntemi)
  const { error: delErr } = await supabase.from("project_equipment").delete().eq("project_id", id);
  if (delErr) return { ok: false, error: "Eski ekipman temizlenemedi: " + delErr.message };

  const eq = payload.equipment.filter((e) => e.model_id);
  if (eq.length > 0) {
    const { error: eqErr } = await supabase.from("project_equipment").insert(
      eq.map((e) => ({
        project_id: id,
        category_id: e.category_id,
        slot: e.slot,
        brand_id: e.brand_id,
        model_id: e.model_id,
        certificate_id: e.certificate_id,
        seri_no: e.seri_no,
        seri_list: e.seri_list ?? null,
      }))
    );
    if (eqErr) return { ok: false, error: "Ekipman kaydı: " + eqErr.message };
  }

  revalidatePath("/panel");
  revalidatePath(`/panel/${id}`);
  return { ok: true, id };
}

// ---------- Projeye dosya yükle (Yapı Ruhsatı, Modül G, Fatura, Periyodik, DWG) ----------
const PROJE_KIND = ["yapi_ruhsati", "modul_g_belge", "modul_g_rapor", "fatura", "periyodik_kontrol", "asansor_projesi"];
export async function uploadProjectFile(formData: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  const project_id = String(formData.get("project_id") || "");
  const kind = String(formData.get("kind") || "");
  const file = formData.get("file") as File | null;
  if (!project_id || !kind || !file || file.size === 0) return { ok: false, error: "Eksik bilgi." };
  if (!PROJE_KIND.includes(kind)) return { ok: false, error: "Geçersiz dosya türü." };

  // Erişim kontrolü (RLS): kullanıcı bu projeyi görebiliyor mu?
  const { data: proj } = await supabase.from("projects").select("id").eq("id", project_id).maybeSingle();
  if (!proj) return { ok: false, error: "Proje bulunamadı veya yetkiniz yok." };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `proje/${project_id}/${kind}-${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, {
    contentType: file.type || "application/octet-stream", upsert: false,
  });
  if (upErr) return { ok: false, error: "Dosya yüklenemedi: " + upErr.message };

  // Aynı proje+kind içinde sona ekle (sort_order = mevcut adet)
  const { count } = await admin.from("project_files").select("id", { count: "exact", head: true }).eq("project_id", project_id).eq("kind", kind);

  const row: Record<string, any> = {
    project_id, kind, storage_path: path, original_name: file.name, sort_order: count ?? 0,
    belge_no: String(formData.get("belge_no") || "") || null,
    issue_date: String(formData.get("issue_date") || "") || null,
    valid_until: String(formData.get("valid_until") || "") || null,
    notified_body_id: String(formData.get("notified_body_id") || "") || null,
    report_date: String(formData.get("report_date") || "") || null,
    fatura_no: String(formData.get("fatura_no") || "") || null,
    fatura_tarihi: String(formData.get("fatura_tarihi") || "") || null,
    proje_no: String(formData.get("proje_no") || "") || null,
    uploaded_by: user.id,
  };
  const { data, error } = await admin.from("project_files").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Dosya kaydedilemedi." };
  revalidatePath(`/panel/${project_id}`);
  return { ok: true, id: data.id };
}

// ---------- Proje dosyasını sil ----------
export async function deleteProjectFile(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  if (!id) return { ok: false, error: "Kayıt bulunamadı." };
  const admin = createAdminClient();
  const { data: f } = await admin.from("project_files").select("storage_path, project_id").eq("id", id).maybeSingle();
  if (!f) return { ok: false, error: "Kayıt bulunamadı." };
  // Erişim kontrolü
  const { data: proj } = await supabase.from("projects").select("id").eq("id", f.project_id).maybeSingle();
  if (!proj) return { ok: false, error: "Yetkiniz yok." };
  if (f.storage_path) await admin.storage.from("documents").remove([f.storage_path]);
  const { error } = await admin.from("project_files").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------- Teknik dosyayı tamamen sil ----------
export async function deleteProject(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  if (!id) return { ok: false, error: "Kayıt bulunamadı." };
  await supabase.from("project_equipment").delete().eq("project_id", id);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel");
  return { ok: true };
}
