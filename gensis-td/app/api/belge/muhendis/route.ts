import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mühendis belgesini imzalı URL ile aç (private 'documents' kovası)
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("id gerekli.", { status: 400 });

  const { data: prof } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single();
  const staff = ["admin", "gensis"].includes(prof?.role ?? "");

  const admin = createAdminClient();
  const { data: doc } = await admin.from("engineer_documents").select("storage_path, engineer_id").eq("id", id).maybeSingle();
  if (!doc?.storage_path) return new Response("Belge bulunamadı.", { status: 404 });
  if (!staff) {
    const { data: eng } = await admin.from("engineers").select("company_id").eq("id", doc.engineer_id).maybeSingle();
    if (!prof?.company_id || eng?.company_id !== prof.company_id) return new Response("Yetkisiz.", { status: 403 });
  }

  const { data: signed, error } = await admin.storage.from("documents").createSignedUrl(doc.storage_path, 120);
  if (error || !signed?.signedUrl) return new Response("Dosya açılamadı.", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
