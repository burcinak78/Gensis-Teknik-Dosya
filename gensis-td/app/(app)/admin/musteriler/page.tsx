import { createClient } from "@/lib/supabase/server";
import MusterilerClient from "./MusterilerClient";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const supabase = createClient();
  const [{ data: companies }, { data: provinces }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, short_name, legal_name, address, phone, mobile_phone, city, authorized_person, registered_brand, industry_reg_no")
      .order("short_name")
      .limit(1000),
    supabase.from("provinces").select("name").order("name"),
  ]);

  return <MusterilerClient companies={companies ?? []} provinces={(provinces ?? []).map((p) => p.name)} />;
}
