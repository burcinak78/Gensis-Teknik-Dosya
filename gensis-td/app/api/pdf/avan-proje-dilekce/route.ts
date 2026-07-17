import { NextRequest } from "next/server";
import React from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { AvanProjeDilekceDoc } from "@/lib/pdf/AvanProjeDilekceDoc";

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

// Kayıtlı proje onay dosyasından dilekçe üretimi (detay/liste linkleri için)
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("id gerekli.", { status: 400 });

  const { data: row } = await supabase
    .from("proje_onay")
    .select("*, companies(short_name, legal_name), provinces(name), districts(name)")
    .eq("id", id)
    .single();
  if (!row) return new Response("Kayıt bulunamadı veya yetkiniz yok.", { status: 404 });

  const inp = (row.input_data ?? {}) as any;
  const data = {
    firma_adi: (row as any).companies?.short_name || (row as any).companies?.legal_name || "",
    firma_unvan: (row as any).companies?.legal_name || "",
    il: (row as any).provinces?.name || inp.il || "",
    belediye: (row as any).districts?.name || inp.belediye || "",
    tarih: frmtTarih(row.dilekce_tarihi),
    adet: row.asansor_adedi ?? 1,
    yapi_sahibi: row.yapi_sahibi,
    montaj_adresi: row.montaj_adresi,
    pafta: row.pafta, ada: row.ada, parsel: row.parsel,
    beyan_yuku_kg: row.beyan_yuku_kg,
    kisi_sayisi: row.kisi_sayisi,
    beyan_hizi: inp.beyan_hizi_txt || row.beyan_hizi,
    durak_sayisi: row.durak_sayisi,
  };

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  registerFonts(`${proto}://${host}`);
  const buffer = await renderToBuffer(React.createElement(AvanProjeDilekceDoc, { data }) as any);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Avan_Proje_Dilekce.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Geçersiz veri.", { status: 400 });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  registerFonts(`${proto}://${host}`);

  const buffer = await renderToBuffer(
    React.createElement(AvanProjeDilekceDoc, { data: body }) as any
  );

  const ad = (body?.yapi_sahibi || body?.firma_adi || "dilekce")
    .toString()
    .replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Avan_Proje_Dilekce_${ad}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
