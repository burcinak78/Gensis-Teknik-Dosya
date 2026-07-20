import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ekipman sertifikasının güncel PDF'ini imzalı URL ile aç ('certificates' kovası)
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const certId = req.nextUrl.searchParams.get("id");
  if (!certId) return new Response("id gerekli.", { status: 400 });

  const admin = createAdminClient();
  const { data: f } = await admin
    .from("certificate_files")
    .select("storage_path")
    .eq("certificate_id", certId)
    .eq("is_current", true)
    .maybeSingle();
  if (!f?.storage_path) return new Response("Sertifika dosyası bulunamadı.", { status: 404 });

  const { data: signed, error } = await admin.storage.from("certificates").createSignedUrl(f.storage_path, 120);
  if (error || !signed?.signedUrl) return new Response("Dosya açılamadı.", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
