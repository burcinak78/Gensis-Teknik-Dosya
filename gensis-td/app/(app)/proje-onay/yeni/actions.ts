"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OnayResult = { ok: true; id: string } | { ok: false; error: string };

export type OnayPayload = {
  company_id: string;
  dosya_no: string | null;
  dilekce_tarihi: string | null;
  province_id: number | null;
  district_id: string | null;
  asansor_adedi: number | null;
  yapi_sahibi: string | null;
  montaj_adresi: string | null;
  pafta: string | null;
  ada: string | null;
  parsel: string | null;
  beyan_yuku_kg: number | null;
  kisi_sayisi: number | null;
  beyan_hizi: number | null;
  durak_sayisi: number | null;
  makine_muhendis_id: string | null;
  elektrik_muhendis_id: string | null;
  input_data: Record<string, unknown>;
};

export async function saveProjeOnay(payload: OnayPayload): Promise<OnayResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  if (!payload.company_id) return { ok: false, error: "Firma seçilmedi." };
  const { data, error } = await supabase
    .from("proje_onay")
    .insert({ ...payload, created_by: user.id, status: "draft" })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Kaydedilemedi." };
  revalidatePath("/proje-onay");
  return { ok: true, id: data.id };
}

export async function updateProjeOnay(id: string, payload: OnayPayload): Promise<OnayResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  if (!id) return { ok: false, error: "Kayıt bulunamadı." };
  const { error } = await supabase.from("proje_onay").update({ ...payload }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/proje-onay");
  revalidatePath(`/proje-onay/${id}`);
  return { ok: true, id };
}
