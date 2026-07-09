import { NextRequest } from "next/server";
import React from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { UygunlukBeyaniDoc } from "@/lib/pdf/UygunlukBeyaniDoc";

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
  // Türkçe kelime bölünmesini kapat (satır sonu tirelemesi istenmiyor)
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

  // Yetki kontrolü RLS üzerinden: kullanıcı bu projeyi görebiliyor mu?
  const { data: proj } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  if (!proj) return new Response("Proje bulunamadı veya yetkiniz yok.", { status: 404 });

  // Zengin bağlamı SQL fonksiyonundan al
  const { data: ctx, error } = await supabase.rpc("project_render_context", {
    p_id: projectId,
  });
  if (error || !ctx) {
    return new Response("Veri alınamadı: " + (error?.message ?? ""), { status: 500 });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  registerFonts(`${proto}://${host}`);

  const buffer = await renderToBuffer(
    React.createElement(UygunlukBeyaniDoc, { data: ctx }) as any
  );

  const dosyaNo = (ctx as any)?.dosya_no ?? projectId;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Uygunluk_Beyani_${dosyaNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
