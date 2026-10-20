import { createClient } from "@/lib/supabase/server";
import NotlarClient from "./NotlarClient";

export const dynamic = "force-dynamic";

export default async function NotlarPage() {
  const supabase = createClient();
  const { data: notlar } = await supabase
    .from("notlar")
    .select("id, icerik, sayac_baslangic, created_at")
    .order("created_at", { ascending: false });

  return <NotlarClient notlar={(notlar ?? []) as any} />;
}
