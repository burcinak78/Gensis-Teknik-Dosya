import { createClient } from "@/lib/supabase/server";
import OnaylanmisKuruluslarClient from "./OnaylanmisKuruluslarClient";

export const dynamic = "force-dynamic";

export default async function OnaylanmisKuruluslarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = user ? await supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null } as any;
  const isAdmin = prof?.role === "admin" || prof?.role === "gensis";

  const { data: bodies } = await supabase
    .from("notified_bodies")
    .select("id, short_name, name, identity_no, city, country, address")
    .order("short_name");

  return <OnaylanmisKuruluslarClient bodies={(bodies ?? []) as any} isAdmin={isAdmin} />;
}
