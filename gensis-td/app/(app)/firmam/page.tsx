import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MusterilerClient from "../admin/musteriler/MusterilerClient";

export const dynamic = "force-dynamic";

export default async function FirmamPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { data: prof } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single();
  const staff = prof?.role === "admin" || prof?.role === "gensis";
  if (staff) redirect("/admin/musteriler");
  const companyId = prof?.company_id;
  if (!companyId) redirect("/panel");

  const admin = createAdminClient();
  const [{ data: company }, { data: provinces }, { data: docs }, { data: notifiedBodies }] = await Promise.all([
    admin.from("companies")
      .select("id, short_name, legal_name, address, phone, mobile_phone, email, city, authorized_person, registered_brand, industry_reg_no, ce_module")
      .eq("id", companyId).maybeSingle(),
    admin.from("provinces").select("name").order("name"),
    admin.from("company_documents")
      .select("id, company_id, doc_type, original_name, issue_date, valid_until, belge_no, notified_body_id, sub_type, parent_id")
      .eq("company_id", companyId).limit(2000),
    admin.from("notified_bodies").select("id, identity_no, name").order("name"),
  ]);
  if (!company) redirect("/panel");

  return (
    <div className="p-8 gs-fade">
      <MusterilerClient
        companies={[company] as any}
        provinces={(provinces ?? []).map((p) => p.name)}
        documents={(docs ?? []) as any}
        notifiedBodies={(notifiedBodies ?? []) as any}
        mode="customer"
      />
    </div>
  );
}
