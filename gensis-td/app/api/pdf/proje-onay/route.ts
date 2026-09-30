import { NextRequest } from "next/server";
import React from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjeOnayDoc } from "@/lib/pdf/ProjeOnayDoc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let fontsRegistered = false;
function registerFonts(base: string) {
  if (fontsRegistered) return;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: `${base}/fonts/Roboto-Regular.ttf` },
      { src: `${base}/fonts/Roboto-Bold.ttf`, fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

function frmtTarih(d: any): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("tr-TR"); } catch { return String(d); }
}

const VALID = ["dilekce", "makine_taahhut", "elektrik_taahhut"];

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("id gerekli.", { status: 400 });
  const docParam = req.nextUrl.searchParams.get("doc") || "hepsi";
  const docs = docParam === "hepsi" ? VALID : VALID.filter((c) => c === docParam);
  if (docs.length === 0) return new Response("Geçersiz belge.", { status: 400 });

  const { data: row } = await supabase
    .from("proje_onay")
    .select("*, companies(short_name, legal_name, address, city, phone, mobile_phone, email), provinces(name), districts(name), makine:engineers!makine_muhendis_id(full_name, chamber_reg_no, address, phone), elektrik:engineers!elektrik_muhendis_id(full_name, chamber_reg_no, address, phone)")
    .eq("id", id)
    .single();
  if (!row) return new Response("Kayıt bulunamadı veya yetkiniz yok.", { status: 404 });

  const r = row as any;
  const inp = (r.input_data ?? {}) as any;
  const data = {
    firma: { unvan: r.companies?.legal_name, kisa_ad: r.companies?.short_name, adres: r.companies?.address, sehir: r.companies?.city, telefon: r.companies?.phone || r.companies?.mobile_phone || "", email: r.companies?.email || "" },
    firma_adi: r.companies?.short_name || r.companies?.legal_name || "",
    il: r.provinces?.name || inp.il || "",
    belediye: r.districts?.name || inp.belediye || "",
    ilgili_idare: inp.ilgili_idare || "",
    tarih: frmtTarih(r.dilekce_tarihi),
    adet: r.asansor_adedi ?? 1,
    asansor_tipi: r.asansor_tipi ?? inp.asansor_tipi ?? null,
    yapi_sahibi: r.yapi_sahibi,
    yapi_sahibi_adresi: inp.yapi_sahibi_adresi || "",
    montaj_adresi: r.montaj_adresi,
    pafta: r.pafta, ada: r.ada, parsel: r.parsel,
    beyan_yuku_kg: r.beyan_yuku_kg,
    kisi_sayisi: r.kisi_sayisi,
    beyan_hizi: inp.beyan_hizi_txt || r.beyan_hizi,
    durak_sayisi: r.durak_sayisi,
    muh: {
      makine: { ad: r.makine?.full_name, oda_sicil: r.makine?.chamber_reg_no, adres: r.makine?.address, telefon: r.makine?.phone },
      elektrik: { ad: r.elektrik?.full_name, oda_sicil: r.elektrik?.chamber_reg_no, adres: r.elektrik?.address, telefon: r.elektrik?.phone },
    },
    projeTuru: "ASANSÖR",
  };

  // Taahhütname imzası: "İmza ekle" seçili müellif için imzayı (engineer_documents doc_type=imza) göm
  try {
    const admin = createAdminClient();
    const engPairs: [string | null | undefined, "makine" | "elektrik", boolean][] = [
      [r.makine_muhendis_id, "makine", !!inp.imza_makine],
      [r.elektrik_muhendis_id, "elektrik", !!inp.imza_elektrik],
    ];
    const wantIds = engPairs.filter(([id, , want]) => id && want).map(([id]) => id) as string[];
    if (wantIds.length) {
      const { data: edocs } = await admin.from("engineer_documents")
        .select("engineer_id, storage_path").eq("doc_type", "imza").in("engineer_id", wantIds);
      for (const [id, disc, want] of engPairs) {
        if (!id || !want) continue;
        const ed = (edocs ?? []).find((d: any) => d.engineer_id === id);
        if (!ed?.storage_path) continue;
        const { data: blob } = await admin.storage.from("documents").download(ed.storage_path);
        if (!blob) continue;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const ext = (ed.storage_path.split(".").pop() || "").toLowerCase();
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        (data.muh as any)[disc] = { ...(data.muh as any)[disc], imza: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` };
      }
    }
  } catch { /* imza gömülemezse taahhütname imzasız üretilir */ }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  registerFonts(`${proto}://${host}`);
  const buffer = await renderToBuffer(React.createElement(ProjeOnayDoc, { data, docs }) as any);

  const fn = docParam === "hepsi" ? "Proje_Onay_Dosyasi" : docParam;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fn}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
