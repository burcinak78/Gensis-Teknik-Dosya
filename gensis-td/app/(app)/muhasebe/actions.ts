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
  cariye_islendi: boolean;
  teslim_yontemi: "elden" | "kargo" | null;
  kargo_sirketi: string | null;
  kargo_takip_no: string | null;
};

export async function saveMuhasebe(p: MuhasebePayload): Promise<Result> {
  try {
    const userId = await assertMuhasebe();
    if (!p.takip_id) return { ok: false, error: "Kayıt yok." };
    const admin = createAdminClient();

    // Kaynak gerçek: takip kaydından fatura/teslim tipini al
    const { data: takip } = await admin.from("takip_projeler")
      .select("fatura_tipi, teslim_tipi, muhasebeye_gonderildi").eq("id", p.takip_id).maybeSingle();
    if (!takip) return { ok: false, error: "Proje bulunamadı." };
    if (!takip.muhasebeye_gonderildi) return { ok: false, error: "Bu proje henüz muhasebeye gönderilmedi." };

    // Zorunlu alan doğrulaması
    if (takip.fatura_tipi === "faturali") {
      if (!p.fatura_tarihi) return { ok: false, error: "Fatura tarihi zorunludur." };
      if (!p.fatura_no?.trim()) return { ok: false, error: "Fatura no zorunludur." };
    }
    if (!p.cariye_islendi) return { ok: false, error: "Cariye işleme (Tamamlandı) zorunludur." };

    const bugun = new Date().toISOString().slice(0, 10);
    let teslim_tarihi = bugun;
    let teslim_yontemi: string | null = null;
    let kargo_sirketi: string | null = null;
    let kargo_takip_no: string | null = null;

    if (takip.teslim_tipi === "hard_copy") {
      if (!p.teslim_yontemi) return { ok: false, error: "Elden / Kargo seçiniz." };
      teslim_yontemi = p.teslim_yontemi;
      if (p.teslim_yontemi === "kargo") {
        if (!p.kargo_sirketi?.trim()) return { ok: false, error: "Kargo şirketi zorunludur." };
        if (!p.kargo_takip_no?.trim()) return { ok: false, error: "Kargo takip no zorunludur." };
        kargo_sirketi = p.kargo_sirketi.trim();
        kargo_takip_no = p.kargo_takip_no.trim();
      }
      teslim_tarihi = bugun; // elden ve kargo için bugün
    } else {
      teslim_tarihi = bugun; // dijital
    }

    const { error } = await admin.from("takip_muhasebe").upsert({
      takip_id: p.takip_id,
      fatura_tarihi: takip.fatura_tipi === "faturali" ? p.fatura_tarihi : null,
      fatura_no: takip.fatura_tipi === "faturali" ? (p.fatura_no?.trim() || null) : null,
      cariye_islendi: true,
      teslim_yontemi,
      kargo_sirketi,
      kargo_takip_no,
      teslim_tarihi,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "takip_id" });
    if (error) return { ok: false, error: error.message };

    const { error: uErr } = await admin.from("takip_projeler")
      .update({ muhasebe_durumu: "tamamlandi", updated_at: new Date().toISOString() })
      .eq("id", p.takip_id);
    if (uErr) return { ok: false, error: uErr.message };

    revalidatePath("/muhasebe");
    revalidatePath("/proje-takip");
    return { ok: true, message: "Muhasebe işlemi kaydedildi, teslim tamamlandı." };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
