// Muhasebe writes against the C# API (admin and muhasebeci there), with the old server action's name and result.
import { api, ApiError } from "@/lib/api/client";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export type MuhasebePayload = {
  takip_id: string; fatura_tarihi: string | null; fatura_no: string | null; teslim_tarihi: string | null;
  teslim_yontemi: "elden" | "kargo" | null; kargo_sirketi: string | null; kargo_takip_no: string | null;
};

const orNull = (v: string | null | undefined) => (v ? v : null);

export async function saveMuhasebe(p: MuhasebePayload): Promise<Result> {
  if (!p.takip_id) return { ok: false, error: "Kayıt yok." };
  try {
    const r = await api<{ message: string }>(`/api/muhasebe/${p.takip_id}`, {
      method: "PUT",
      body: JSON.stringify({
        faturaTarihi: orNull(p.fatura_tarihi), faturaNo: p.fatura_no, teslimTarihi: orNull(p.teslim_tarihi),
        teslimYontemi: p.teslim_yontemi, kargoSirketi: p.kargo_sirketi, kargoTakipNo: p.kargo_takip_no,
      }),
    });
    return { ok: true, message: r.message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? (e.status === 403 ? "Bu işlem için muhasebe yetkisi gerekli." : e.status === 404 ? "Proje bulunamadı." : e.message) : "Kaydedilemedi.",
    };
  }
}
