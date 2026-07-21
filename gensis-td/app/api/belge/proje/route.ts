import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Projeye bağlı yüklenen dosyayı imzalı URL ile aç (private 'documents' kovası)
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("id gerekli.", { status: 400 });

  const admin = createAdminClient();
  const { data: f } = await admin.from("project_files").select("storage_path, project_id").eq("id", id).maybeSingle();
  if (!f?.storage_path) return new Response("Belge bulunamadı.", { status: 404 });

  // Erişim kontrolü (RLS): kullanıcı bu projeyi görebiliyor mu?
  const { data: proj } = await supabase.from("projects").select("id").eq("id", f.project_id).maybeSingle();
  if (!proj) return new Response("Yetkisiz.", { status: 403 });

  const { data: signed, error } = await admin.storage.from("documents").createSignedUrl(f.storage_path, 120);
  if (error || !signed?.signedUrl) return new Response("Dosya açılamadı.", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
