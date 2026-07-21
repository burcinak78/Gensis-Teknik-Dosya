import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Müşteri belgesini imzalı URL ile aç (private 'documents' kovası)
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
  const { data: doc } = await admin.from("company_documents").select("storage_path, company_id").eq("id", id).maybeSingle();
  if (!doc?.storage_path) return new Response("Belge bulunamadı.", { status: 404 });
  if (!staff && prof?.company_id !== doc.company_id) return new Response("Yetkisiz.", { status: 403 });

  const { data: signed, error } = await admin.storage.from("documents").createSignedUrl(doc.storage_path, 120);
  if (error || !signed?.signedUrl) return new Response("Dosya açılamadı.", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
