"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
