import { redirect } from "next/navigation";
import { apiGet, isStaff, requireMe } from "@/lib/api/server";
import MuhendislerClient from "../admin/muhendisler/MuhendislerClient";

export const dynamic = "force-dynamic";

type EngineerApi = {
  id: string; fullName: string; discipline: string; chamberRegNo: string | null; companyId: string | null;
  companyShortName: string | null; address: string | null; phone: string | null;
};
type DocApi = { id: string; engineerId: string; docType: string; originalName: string | null; validUntil: string | null };

export default async function MuhendislerimPage() {
  const me = await requireMe();
  if (isStaff(me.role)) redirect("/admin/muhendisler");
  if (!me.companyId) redirect("/panel");

  // The API limits a customer to their own company's engineers and their documents.
  const [engineers, docs, company] = await Promise.all([
    apiGet<EngineerApi[]>("/api/engineers"),
    apiGet<DocApi[]>("/api/engineers/documents"),
    apiGet<{ id: string; shortName: string }>(`/api/catalog/companies/${me.companyId}`),
  ]);

  return (
    <div className="p-8 gs-fade">
      <MuhendislerClient
        engineers={(engineers ?? []).map((e) => ({
          id: e.id, full_name: e.fullName, discipline: e.discipline, chamber_reg_no: e.chamberRegNo, company_id: e.companyId,
          address: e.address, phone: e.phone, companies: e.companyShortName ? { short_name: e.companyShortName } : null,
        }))}
        companies={company ? [{ id: company.id, short_name: company.shortName }] : []}
        documents={(docs ?? []).map((d) => ({
          id: d.id, engineer_id: d.engineerId, doc_type: d.docType, original_name: d.originalName, valid_until: d.validUntil,
        }))}
        defaultCompanyId={me.companyId}
        mode="customer"
      />
    </div>
  );
}
