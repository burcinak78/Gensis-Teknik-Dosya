import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MuhendislerClient from "../admin/muhendisler/MuhendislerClient";

export const dynamic = "force-dynamic";

export default async function MuhendislerimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { data: prof } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single();
  const staff = prof?.role === "admin" || prof?.role === "gensis";
  if (staff) redirect("/admin/muhendisler");
  const companyId = prof?.company_id;
  if (!companyId) redirect("/panel");

  const admin = createAdminClient();
  const [{ data: engineers }, { data: company }] = await Promise.all([
    admin.from("engineers")
      .select("id, full_name, discipline, chamber_reg_no, company_id, address, phone, companies(short_name)")
      .eq("company_id", companyId).order("full_name").limit(2000),
    admin.from("companies").select("id, short_name").eq("id", companyId).maybeSingle(),
  ]);
  const engIds = (engineers ?? []).map((e: any) => e.id);
  let docs: any[] = [];
  if (engIds.length) {
    const { data } = await admin.from("engineer_documents")
      .select("id, engineer_id, doc_type, original_name, valid_until")
      .in("engineer_id", engIds).limit(5000);
    docs = data ?? [];
  }

  return (
    <div className="p-8 gs-fade">
      <MuhendislerClient
        engineers={(engineers ?? []) as any}
        companies={company ? ([company] as any) : []}
        documents={docs as any}
        defaultCompanyId={companyId}
        mode="customer"
      />
    </div>
  );
}
