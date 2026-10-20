import { createClient } from "@/lib/supabase/server";
import IlgiliIdarelerClient from "./IlgiliIdarelerClient";

export const dynamic = "force-dynamic";

export default async function IlgiliIdarelerPage() {
  const supabase = createClient();
  const [{ data: rows }, { data: provinces }] = await Promise.all([
    supabase.from("ilgili_idareler").select("id, name, address, province_id, suffix").order("name").limit(8000),
    supabase.from("provinces").select("id, name").order("name"),
  ]);
  return <IlgiliIdarelerClient rows={(rows ?? []) as any} provinces={(provinces ?? []) as any} />;
}
