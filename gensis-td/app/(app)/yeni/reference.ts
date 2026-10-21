// Reference data for the teknik dosya wizard (new and edit pages), from the C# API.
// Shapes match what DataEntryWizard used to get from Supabase (snake_case).
import { apiGet } from "@/lib/api/server";

type CompanyApi = {
  id: string; shortName: string; legalName: string; address: string | null; phone: string | null; fax: string | null;
  city: string | null; authorizedPerson: string | null; registeredBrand: string | null; industryRegNo: string | null;
};
type EquipmentApi = {
  categories: { id: string; code: string; name: string; sortOrder: number; driveType: string }[];
  brands: { id: string; categoryId: string; name: string }[];
  models: { id: string; brandId: string; name: string; certificateId: string | null }[];
};
type CertificateApi = { id: string; certNo: string; notifiedBodyId: string | null; validUntil: string | null };
type NotifiedBodyApi = { id: string; identityNo: string | null; name: string; address: string | null };
type IlgiliIdareApi = { id: string; name: string; provinceId: number | null; suffix: string };
type CapacityApi = { beyanYukuKg: number; kisiSayisi: number | null; kabinAgirlikKg: number | null; karsiAgirlikKg: number | null };
type LookupApi = { listKey: string; value: string; sortOrder: number };
type EngineersApi = {
  gensisCompanyId: string | null;
  engineers: { id: string; fullName: string; discipline: string; chamberRegNo: string | null; companyId: string | null }[];
};
type CompanyDocApi = {
  id: string; companyId: string; docType: string; belgeNo: string | null; issueDate: string | null; validUntil: string | null;
  notifiedBodyId: string | null; originalName: string | null;
};
type EngineerDocApi = { id: string; engineerId: string; docType: string; validUntil: string | null };

export async function loadWizardReference() {
  const [companies, equipment, certificates, notifiedBodies, provinces, idareler, capacity, lookups, engineers, companyDocs, engDocs] =
    await Promise.all([
      apiGet<CompanyApi[]>("/api/catalog/companies"),
      apiGet<EquipmentApi>("/api/catalog/equipment"),
      apiGet<CertificateApi[]>("/api/catalog/certificates"),
      apiGet<NotifiedBodyApi[]>("/api/catalog/notified-bodies"),
      apiGet<{ id: number; name: string }[]>("/api/catalog/provinces"),
      apiGet<IlgiliIdareApi[]>("/api/catalog/ilgili-idareler"),
      apiGet<CapacityApi[]>("/api/catalog/capacity"),
      apiGet<LookupApi[]>("/api/catalog/lookups"),
      apiGet<EngineersApi>("/api/catalog/engineers"),
      apiGet<CompanyDocApi[]>("/api/catalog/company-documents"),
      // Staff only (as Supabase RLS); customers get an empty list, so no signature preview for them.
      apiGet<EngineerDocApi[]>("/api/catalog/engineer-documents"),
    ]);

  const imzaByEng = new Map((engDocs ?? []).filter((d) => d.docType === "imza").map((d) => [d.engineerId, d.id]));

  return {
    companies: (companies ?? []).map((c) => ({
      id: c.id, short_name: c.shortName, legal_name: c.legalName, address: c.address, phone: c.phone, fax: c.fax,
      city: c.city, authorized_person: c.authorizedPerson, registered_brand: c.registeredBrand, industry_reg_no: c.industryRegNo,
    })),
    categories: (equipment?.categories ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name, sort_order: c.sortOrder, drive_type: c.driveType })),
    brands: (equipment?.brands ?? []).map((b) => ({ id: b.id, category_id: b.categoryId, name: b.name })),
    models: (equipment?.models ?? []).map((m) => ({ id: m.id, brand_id: m.brandId, name: m.name, certificate_id: m.certificateId })),
    certificates: (certificates ?? []).map((c) => ({ id: c.id, cert_no: c.certNo, notified_body_id: c.notifiedBodyId, valid_until: c.validUntil })),
    notifiedBodies: (notifiedBodies ?? []).map((n) => ({ id: n.id, identity_no: n.identityNo, name: n.name, address: n.address })),
    provinces: provinces ?? [],
    ilgiliIdareler: (idareler ?? []).map((i) => ({ id: i.id, name: i.name, province_id: i.provinceId, suffix: i.suffix })),
    capacity: (capacity ?? []).map((c) => ({
      beyan_yuku_kg: c.beyanYukuKg, kisi_sayisi: c.kisiSayisi, kabin_agirlik_kg: c.kabinAgirlikKg, karsi_agirlik_kg: c.karsiAgirlikKg,
    })),
    lookups: (lookups ?? []).map((l) => ({ list_key: l.listKey, value: l.value, sort_order: l.sortOrder })),
    engineers: (engineers?.engineers ?? []).map((e) => ({
      id: e.id, full_name: e.fullName, discipline: e.discipline, chamber_reg_no: e.chamberRegNo, company_id: e.companyId,
      imzaDocId: imzaByEng.get(e.id) ?? null,
    })),
    gensisCompanyId: engineers?.gensisCompanyId ?? null,
    companyDocuments: (companyDocs ?? []).map((d) => ({
      id: d.id, company_id: d.companyId, doc_type: d.docType, belge_no: d.belgeNo, issue_date: d.issueDate,
      valid_until: d.validUntil, notified_body_id: d.notifiedBodyId, original_name: d.originalName,
    })),
    engineerDocuments: (engDocs ?? []).map((d) => ({ engineer_id: d.engineerId, doc_type: d.docType, valid_until: d.validUntil })),
  };
}
