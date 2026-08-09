"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Result = { ok: true; message?: string; id?: string; proje_no?: number } | { ok: false; error: string };

const STAFF = ["admin", "gensis"];
async function assertStaff(): Promise<{ userId: string; role: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");
  const { data: prof } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!prof || prof.is_active === false) throw new Error("Hesap aktif değil.");
  if (!STAFF.includes(prof.role as string)) throw new Error("Bu işlem için Gensis personeli yetkisi gerekli.");
  return { userId: user.id, role: prof.role as string };
}

// ---------- Hızlı müşteri ekle (wizard içinden) ----------
export async function createQuickCompany(form: { short_name: string; legal_name: string; city: string }):
  Promise<{ ok: true; id: string; short_name: string; legal_name: string; city: string | null } | { ok: false; error: string }> {
  try {
    await assertStaff();
    if (!form.short_name?.trim()) return { ok: false, error: "Firma kısa adı zorunlu." };
    const admin = createAdminClient();
    const { data, error } = await admin.from("companies").insert({
      short_name: form.short_name.trim(),
      legal_name: (form.legal_name?.trim() || form.short_name.trim()),
      city: form.city?.trim() || null,
    }).select("id, short_name, legal_name, city").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Müşteri eklenemedi." };
    revalidatePath("/proje-takip");
    return { ok: true, id: data.id, short_name: data.short_name, legal_name: data.legal_name, city: data.city };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export type TakipPayload = {
  proje_tipi: "mimari" | "uygulama";
  siparis_tarihi: string | null;
  company_id: string;
  ada: string | null;
  parsel: string | null;
  is_adi: string | null;
  asansor_sayisi: number | null;
  asansor_tipi: string | null;
  province_id: number | null;
  district_id: string | null;
  il_adi: string | null;
  ilce_adi: string | null;
  fiyat: number | null;
  fatura_tipi: "faturali" | "faturasiz";
  proje_sorumlusu_id: string | null;
  tahmini_tamamlanma: string | null;
};

// ---------- Yeni proje takip kaydı ----------
export async function createTakipProje(p: TakipPayload): Promise<Result> {
  try {
    const actor = await assertStaff();
    if (!p.company_id) return { ok: false, error: "Firma seçilmedi." };
    if (!p.proje_tipi) return { ok: false, error: "Proje tipi seçilmedi." };
    const admin = createAdminClient();

    // Otomatik sıralı proje no
    const { data: noData, error: noErr } = await admin.rpc("next_takip_no");
    if (noErr || noData == null) return { ok: false, error: "Proje no üretilemedi: " + (noErr?.message ?? "") };
    const proje_no = Number(noData);

    const fiyat = p.fiyat ?? null;
    const toplam_tutar = fiyat == null ? null : (p.fatura_tipi === "faturali" ? Math.round(fiyat * 1.2 * 100) / 100 : fiyat);

    const { data, error } = await admin.from("takip_projeler").insert({
      proje_no,
      proje_tipi: p.proje_tipi,
      siparis_tarihi: p.siparis_tarihi,
      company_id: p.company_id,
      ada: p.ada,
      parsel: p.parsel,
      ada_parsel: [p.ada, p.parsel].filter(Boolean).join(" / ") || null,
      is_adi: p.is_adi,
      asansor_sayisi: p.asansor_sayisi,
      asansor_tipi: p.asansor_tipi,
      province_id: p.province_id,
      district_id: p.district_id,
      il_adi: p.il_adi,
      ilce_adi: p.ilce_adi,
      fiyat,
      fatura_tipi: p.fatura_tipi,
      toplam_tutar,
      proje_sorumlusu_id: p.proje_sorumlusu_id,
      tahmini_tamamlanma: p.tahmini_tamamlanma,
      durum: "HAZIRLANIYOR",
      created_by: actor.userId,
    }).select("id, proje_no").single();

    if (error || !data) return { ok: false, error: error?.message ?? "Kayıt oluşturulamadı." };
    revalidatePath("/proje-takip");
    return { ok: true, id: data.id, proje_no: data.proje_no };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Doküman yükle ----------
const TAKIP_KIND = ["mimari_proje", "elektrik_projesi", "statik_projesi", "olcu_formu", "yapi_ruhsati", "diger", "tamamlanan_proje"];
export async function uploadTakipDoc(formData: FormData): Promise<Result> {
  try {
    const actor = await assertStaff();
    const takip_id = String(formData.get("takip_id") || "");
    const kind = String(formData.get("kind") || "");
    const file = formData.get("file") as File | null;
    if (!takip_id || !kind || !file || file.size === 0) return { ok: false, error: "Eksik bilgi." };
    if (!TAKIP_KIND.includes(kind)) return { ok: false, error: "Geçersiz doküman türü." };
    const admin = createAdminClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `takip/${takip_id}/${kind}-${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from("documents").upload(path, bytes, {
      contentType: file.type || "application/octet-stream", upsert: false,
    });
    if (upErr) return { ok: false, error: "Dosya yüklenemedi: " + upErr.message };
    const { data, error } = await admin.from("takip_dokumanlar").insert({
      takip_id, kind, storage_path: path, original_name: file.name, uploaded_by: actor.userId,
    }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Doküman kaydedilemedi." };
    revalidatePath("/proje-takip");
    return { ok: true, id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Doğrudan-depolama yükleme (büyük dosyalar için) ----------
// 1) İmzalı yükleme adresi üret (tarayıcı depoya doğrudan yükler → fonksiyon gövde limiti aşılmaz)
export async function createTakipUploadUrl(takip_id: string, kind: string, filename: string):
  Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  try {
    await assertStaff();
    if (!takip_id || !kind || !filename) return { ok: false, error: "Eksik bilgi." };
    if (!TAKIP_KIND.includes(kind)) return { ok: false, error: "Geçersiz doküman türü." };
    const admin = createAdminClient();
    const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `takip/${takip_id}/${kind}-${randomUUID()}.${ext}`;
    const { data, error } = await admin.storage.from("documents").createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? "Yükleme adresi alınamadı." };
    return { ok: true, path: data.path, token: data.token };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// 2) Depoya yüklenen dosyanın kaydını oluştur
export async function recordTakipDoc(takip_id: string, kind: string, path: string, original_name: string): Promise<Result> {
  try {
    const actor = await assertStaff();
    if (!takip_id || !kind || !path) return { ok: false, error: "Eksik bilgi." };
    if (!TAKIP_KIND.includes(kind)) return { ok: false, error: "Geçersiz doküman türü." };
    const admin = createAdminClient();
    const { data, error } = await admin.from("takip_dokumanlar").insert({
      takip_id, kind, storage_path: path, original_name, uploaded_by: actor.userId,
    }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Doküman kaydedilemedi." };
    revalidatePath("/proje-takip");
    return { ok: true, id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function deleteTakipDoc(id: string): Promise<Result> {
  try {
    await assertStaff();
    if (!id) return { ok: false, error: "Kayıt yok." };
    const admin = createAdminClient();
    const { data: d } = await admin.from("takip_dokumanlar").select("storage_path").eq("id", id).maybeSingle();
    if (d?.storage_path) await admin.storage.from("documents").remove([d.storage_path]);
    const { error } = await admin.from("takip_dokumanlar").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/proje-takip");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- BEKLIYOR açıklaması kaydet ----------
export async function saveBekliyorAciklama(id: string, aciklama: string): Promise<Result> {
  try {
    await assertStaff();
    if (!id) return { ok: false, error: "Kayıt yok." };
    if (!aciklama.trim()) return { ok: false, error: "Açıklama zorunludur." };
    const admin = createAdminClient();
    const { error } = await admin.from("takip_projeler")
      .update({ durum: "BEKLIYOR", bekliyor_aciklama: aciklama.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/proje-takip");
    return { ok: true, message: "Açıklama kaydedildi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ---------- Projeyi tamamla ve muhasebeye gönder ----------
export async function completeTakipProje(
  id: string,
  data: { tamamlanma_tarihi: string; teslim_tipi: "hard_copy" | "dijital"; hard_copy_adedi: number | null }
): Promise<Result> {
  try {
    await assertStaff();
    if (!id) return { ok: false, error: "Kayıt yok." };
    if (!data.tamamlanma_tarihi) return { ok: false, error: "Tamamlanma tarihi zorunludur." };
    if (!data.teslim_tipi) return { ok: false, error: "Teslim tipi seçilmelidir." };
    if (data.teslim_tipi === "hard_copy" && (!data.hard_copy_adedi || data.hard_copy_adedi < 1))
      return { ok: false, error: "Hard Copy adedi giriniz." };
    const admin = createAdminClient();
    // Tamamlanan proje dokümanı yüklenmiş mi?
    const { count } = await admin.from("takip_dokumanlar")
      .select("id", { count: "exact", head: true }).eq("takip_id", id).eq("kind", "tamamlanan_proje");
    if ((count ?? 0) === 0) return { ok: false, error: "Önce tamamlanan projeyi yükleyin." };

    const { error } = await admin.from("takip_projeler").update({
      durum: "TAMAMLANDI",
      tamamlanma_tarihi: data.tamamlanma_tarihi,
      teslim_tipi: data.teslim_tipi,
      hard_copy_adedi: data.teslim_tipi === "hard_copy" ? data.hard_copy_adedi : null,
      muhasebeye_gonderildi: true,
      muhasebe_durumu: "bekliyor",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/proje-takip");
    revalidatePath("/muhasebe");
    return { ok: true, message: "Proje tamamlandı ve muhasebeye gönderildi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function deleteTakipProje(id: string): Promise<Result> {
  try {
    await assertStaff();
    if (!id) return { ok: false, error: "Kayıt yok." };
    const admin = createAdminClient();
    const { data: docs } = await admin.from("takip_dokumanlar").select("storage_path").eq("takip_id", id);
    const paths = (docs ?? []).map((d: any) => d.storage_path).filter(Boolean);
    if (paths.length) await admin.storage.from("documents").remove(paths);
    const { error } = await admin.from("takip_projeler").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/proje-takip");
    return { ok: true, message: "Kayıt silindi." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
