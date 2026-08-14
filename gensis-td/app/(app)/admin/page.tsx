import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = user ? await supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null } as any;
  // Admin → Kullanıcılar; Kullanıcı (gensis) → Müşteriler (Kullanıcılar sekmesi kapalı)
  redirect(prof?.role === "admin" ? "/admin/kullanicilar" : "/admin/musteriler");
}
