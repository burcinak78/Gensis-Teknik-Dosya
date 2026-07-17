import { createClient } from "@/lib/supabase/server";
import MusterilerClient from "./MusterilerClient";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const supabase = createClient();
  const [{ data: companies }, { data: provinces }, { data: docs }, { data: notifiedBodies }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, short_name, legal_name, address, phone, mobile_phone, city, authorized_person, registered_brand, industry_reg_no, ce_module")
      .order("short_name")
      .limit(1000),
    supabase.from("provinces").select("name").order("name"),
    supabase.from("company_documents").select("id, company_id, doc_type, original_name, issue_date, valid_until, belge_no, notified_body_id").limit(5000),
    supabase.from("notified_bodies").select("id, identity_no, name").order("name"),
  ]);

  return (
    <MusterilerClient
      companies={companies ?? []}
      provinces={(provinces ?? []).map((p) => p.name)}
      documents={(docs ?? []) as any}
      notifiedBodies={(notifiedBodies ?? []) as any}
    />
  );
}
