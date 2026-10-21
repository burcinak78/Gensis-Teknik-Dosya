import { redirect } from "next/navigation";
import { apiGet, isStaff, requireMe } from "@/lib/api/server";
import MusterilerClient from "../admin/musteriler/MusterilerClient";

export const dynamic = "force-dynamic";

type CompanyApi = {
  id: string; shortName: string; legalName: string; address: string | null; phone: string | null; mobilePhone: string | null;
  email: string | null; city: string | null; authorizedPerson: string | null; registeredBrand: string | null;
  industryRegNo: string | null; ceModule: string | null; category: string; sector: string | null;
};
type DocApi = {
  id: string; companyId: string; docType: string; originalName: string | null; issueDate: string | null; validUntil: string | null;
  belgeNo: string | null; notifiedBodyId: string | null; subType: string | null; parentId: string | null;
};

export default async function FirmamPage() {
  const me = await requireMe();
  if (isStaff(me.role)) redirect("/admin/musteriler");
  if (!me.companyId) redirect("/panel");

  // The API limits a customer to their own company and its documents.
  const [company, provinces, docs, notifiedBodies] = await Promise.all([
    apiGet<CompanyApi>(`/api/catalog/companies/${me.companyId}`),
    apiGet<{ id: number; name: string }[]>("/api/catalog/provinces"),
    apiGet<DocApi[]>("/api/catalog/company-documents"),
    apiGet<{ id: string; identityNo: string | null; name: string; shortName: string | null }[]>("/api/catalog/notified-bodies"),
  ]);
  if (!company) redirect("/panel");

  return (
    <div className="p-8 gs-fade">
      <MusterilerClient
        companies={[{
          id: company.id, short_name: company.shortName, legal_name: company.legalName, address: company.address,
          phone: company.phone, mobile_phone: company.mobilePhone, email: company.email, city: company.city,
          authorized_person: company.authorizedPerson, registered_brand: company.registeredBrand,
          industry_reg_no: company.industryRegNo, ce_module: company.ceModule, category: company.category, sector: company.sector,
        }]}
        provinces={(provinces ?? []).map((p) => p.name)}
        documents={(docs ?? []).map((d) => ({
          id: d.id, company_id: d.companyId, doc_type: d.docType, original_name: d.originalName, issue_date: d.issueDate,
          valid_until: d.validUntil, belge_no: d.belgeNo, notified_body_id: d.notifiedBodyId, sub_type: d.subType, parent_id: d.parentId,
        }))}
        notifiedBodies={(notifiedBodies ?? []).map((n) => ({ id: n.id, identity_no: n.identityNo, name: n.name, short_name: n.shortName }))}
        mode="customer"
      />
    </div>
  );
}
