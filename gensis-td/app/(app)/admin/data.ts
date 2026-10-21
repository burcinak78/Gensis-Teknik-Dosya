// Company and engineer data from the C# API in the row shapes of the Müşteriler / Mühendisler screens.
// The API limits customers to their own company; staff get everything.
import { apiGet, requireMe } from "@/lib/api/server";
import { toSnake } from "@/lib/api/case";

export async function loadCompaniesScreen(companyId?: string) {
  if (!companyId) await requireMe(["admin", "gensis"]);
  const [companies, provinces, docs, notifiedBodies] = await Promise.all([
    companyId ? apiGet(`/api/catalog/companies/${companyId}`).then((c) => (c ? [c] : [])) : apiGet<unknown[]>("/api/catalog/companies"),
    apiGet<{ id: number; name: string }[]>("/api/catalog/provinces"),
    apiGet("/api/catalog/company-documents"),
    apiGet("/api/catalog/notified-bodies"),
  ]);
  return {
    companies: toSnake<any[]>(companies ?? []),
    provinces: (provinces ?? []).map((p) => p.name),
    documents: toSnake<any[]>(docs ?? []),
    notifiedBodies: toSnake<any[]>(notifiedBodies ?? []),
  };
}

// Layout and page render in parallel, so the staff screens check the role themselves before loading.
export async function loadEngineersScreen() {
  await requireMe(["admin", "gensis"]);
  const [engineers, docs, companies, catalog] = await Promise.all([
    apiGet<Record<string, any>[]>("/api/engineers"),
    apiGet("/api/engineers/documents"),
    apiGet("/api/catalog/companies/names"),
    apiGet<{ gensisCompanyId: string | null }>("/api/catalog/engineers"),
  ]);
  return {
    engineers: toSnake<any[]>(engineers ?? []).map(({ company_short_name, ...e }) => ({
      ...e, companies: company_short_name ? { short_name: company_short_name } : null,
    })),
    documents: toSnake<any[]>(docs ?? []),
    companies: toSnake<any[]>(companies ?? []),
    // New engineers default to Gensis's company (GENSIS_COMPANY_ID).
    gensisCompanyId: catalog?.gensisCompanyId ?? "",
  };
}

type Equipment = {
  categories: { id: string; code: string; name: string; sortOrder: number; driveType: string }[];
  brands: { id: string; categoryId: string; name: string }[];
  models: { id: string; brandId: string; name: string; certificateId: string | null }[];
  modelCertificates: { modelId: string; certificateId: string }[];
};

/** Equipment, certificates and notified bodies for the Ekipmanlar / Sertifikalar screens. */
export async function loadCatalogScreen() {
  const me = await requireMe(["admin", "gensis"]);
  const [equipment, certificates, notifiedBodies] = await Promise.all([
    apiGet<Equipment>("/api/catalog/equipment"),
    apiGet<Record<string, any>[]>("/api/catalog/certificates"),
    apiGet("/api/catalog/notified-bodies"),
  ]);
  const eq = equipment ?? { categories: [], brands: [], models: [], modelCertificates: [] };
  return {
    isAdmin: me.role === "admin",
    categories: toSnake<any[]>(eq.categories),
    brands: toSnake<any[]>(eq.brands),
    models: toSnake<any[]>(eq.models),
    modelCerts: toSnake<any[]>(eq.modelCertificates),
    certificates: toSnake<any[]>(certificates ?? []),
    notifiedBodies: toSnake<any[]>(notifiedBodies ?? []),
  };
}
