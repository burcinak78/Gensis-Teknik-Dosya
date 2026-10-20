"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const ROLES = ["admin", "muhasebeci"];
async function assertMuhasebe(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");
  const { data: prof } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!prof || prof.is_active === false) throw new Error("Hesap aktif değil.");
  if (!ROLES.includes(prof.role as string)) throw new Error("Bu işlem için muhasebe yetkisi gerekli.");
  return user.id;
}

export type MuhasebePayload = {
  takip_id: string;
  fatura_tarihi: string | null;
  fatura_no: string | null;
  teslim_tarihi: string | null;
  teslim_yontemi: "elden" | "kargo" | null;
  kargo_sirketi: string | null;
  kargo_takip_no: string | null;
};

export async function saveMuhasebe(p: MuhasebePayload): Promise<Result> {
  try {
    const userId = await assertMuhasebe();
    if (!p.takip_id) return { ok: false, error: "Kayıt yok." };
    const admin = createAdminClient();

    // Kaynak gerçek: takip kaydından teslim tipini al
    const { data: takip } = await admin.from("takip_projeler")
      .select("teslim_tipi, muhasebeye_gonderildi").eq("id", p.takip_id).maybeSingle();
    if (!takip) return { ok: false, error: "Proje bulunamadı." };
    if (!takip.muhasebeye_gonderildi) return { ok: false, error: "Bu proje henüz muhasebeye gönderilmedi." };

    // Fatura alanları opsiyonel (– ile geçilebilir)
    const fatura_tarihi = p.fatura_tarihi || null;
    const fatura_no = p.fatura_no?.trim() || null;
    const teslim_tarihi = p.teslim_tarihi || null;

    let teslim_yontemi: string | null = null;
    let kargo_sirketi: string | null = null;
    let kargo_takip_no: string | null = null;
    if (takip.teslim_tipi === "hard_copy") {
      teslim_yontemi = p.teslim_yontemi ?? null;
      if (p.teslim_yontemi === "kargo") {
        kargo_sirketi = p.kargo_sirketi?.trim() || null;
        kargo_takip_no = p.kargo_takip_no?.trim() || null;
      }
    }

    // "Teslim edildi" (tamamlandı) için tüm teslim bilgileri dolu olmalı.
    // Fatura bilgileri opsiyoneldir; tamamlanmayı etkilemez.
    const hard = takip.teslim_tipi === "hard_copy";
    const teslimTamam = hard
      ? (!!teslim_yontemi && (teslim_yontemi !== "kargo" || (!!kargo_sirketi && !!kargo_takip_no)))
      : true;
    const tamam = !!teslim_tarihi && teslimTamam;

    const { error } = await admin.from("takip_muhasebe").upsert({
      takip_id: p.takip_id,
      fatura_tarihi,
      fatura_no,
      cariye_islendi: tamam,
      teslim_yontemi,
      kargo_sirketi,
      kargo_takip_no,
      teslim_tarihi,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "takip_id" });
    if (error) return { ok: false, error: error.message };

    const { error: uErr } = await admin.from("takip_projeler")
      .update({ muhasebe_durumu: tamam ? "tamamlandi" : "bekliyor", updated_at: new Date().toISOString() })
      .eq("id", p.takip_id);
    if (uErr) return { ok: false, error: uErr.message };

    revalidatePath("/muhasebe");
    revalidatePath("/proje-takip");
    return { ok: true, message: tamam ? "Kaydedildi — teslim edildi." : "Kaydedildi (eksik bilgi — işlem bekliyor)." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
