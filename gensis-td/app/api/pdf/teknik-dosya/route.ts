import { NextRequest } from "next/server";
import React from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { TeknikDosyaDoc } from "@/lib/pdf/TeknikDosyaDoc";

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

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return new Response("projectId gerekli.", { status: 400 });

  const { data: proj } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  if (!proj) return new Response("Proje bulunamadı veya yetkiniz yok.", { status: 404 });

  const { data: ctx, error } = await supabase.rpc("project_render_context", {
    p_id: projectId,
  });
  if (error || !ctx) {
    return new Response("Veri alınamadı: " + (error?.message ?? ""), { status: 500 });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  registerFonts(`${proto}://${host}`);

  // ?belge=<code> (bir veya birden fazla) verilirse yalnız onlar; verilmezse tümü.
  // ?dl=1 verilirse tarayıcıda açmak yerine indirir.
  const belgeler = req.nextUrl.searchParams.getAll("belge");
  const dl = req.nextUrl.searchParams.get("dl") === "1";
  const only =
    belgeler.length === 0 ? undefined : belgeler.length === 1 ? belgeler[0] : belgeler;

  const buffer = await renderToBuffer(
    React.createElement(TeknikDosyaDoc, { data: ctx, only, assetBase: `${proto}://${host}` }) as any
  );

  const dosyaNo = (ctx as any)?.dosya_no ?? projectId;
  const namePart =
    belgeler.length === 1 ? `${dosyaNo}_${belgeler[0]}` : belgeler.length > 1 ? `${dosyaNo}_secili` : `${dosyaNo}_tumu`;
  const disposition = dl ? "attachment" : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="Teknik_Dosya_${namePart}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
