import { createClient } from "@/lib/supabase/server";
import MuhendislerClient from "./MuhendislerClient";

export const dynamic = "force-dynamic";

export default async function MuhendislerPage() {
  const supabase = createClient();
  const [{ data: engineers }, { data: companies }, { data: docs }] = await Promise.all([
    supabase
      .from("engineers")
      .select("id, full_name, discipline, chamber_reg_no, company_id, address, phone, companies(short_name)")
      .order("full_name")
      .limit(2000),
    supabase.from("companies").select("id, short_name").order("short_name").limit(2000),
    supabase.from("engineer_documents").select("id, engineer_id, doc_type, original_name, valid_until").limit(5000),
  ]);
  const gensis = (companies ?? []).find((c) => c.short_name.toLocaleLowerCase("tr").includes("gensis"));

  return (
    <MuhendislerClient
      engineers={(engineers ?? []) as any}
      companies={companies ?? []}
      documents={(docs ?? []) as any}
      defaultCompanyId={gensis?.id ?? ""}
    />
  );
}
