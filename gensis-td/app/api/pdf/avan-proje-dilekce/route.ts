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
