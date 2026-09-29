import { createClient } from "@/lib/supabase/server";
import IlgiliIdarelerClient from "./IlgiliIdarelerClient";

export const dynamic = "force-dynamic";

export default async function IlgiliIdarelerPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ilgili_idareler")
    .select("id, name, address")
    .order("name")
    .limit(5000);

  return <IlgiliIdarelerClient rows={(data ?? []) as any} />;
}
