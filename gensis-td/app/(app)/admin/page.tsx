import { redirect } from "next/navigation";
import { requireMe } from "@/lib/api/server";

export default async function AdminHome() {
  const me = await requireMe(["admin", "gensis"]);
  // Admin → Kullanıcılar; Kullanıcı (gensis) → Müşteriler (Kullanıcılar sekmesi kapalı)
  redirect(me.role === "admin" ? "/admin/kullanicilar" : "/admin/musteriler");
}
