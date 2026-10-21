import { loadCatalogScreen } from "../data";
import SertifikaForm from "./SertifikaForm";
import SertifikaClient, { type CertGroup, type CertItem } from "./SertifikaClient";

export const dynamic = "force-dynamic";

export default async function SertifikalarPage() {
  const d = await loadCatalogScreen();
  const categories = d.categories;
  const brandById = new Map(d.brands.map((b: any) => [b.id, b]));
  // Models with their brand (name, category), as the Supabase join returned them.
  const models = d.models.map((m: any) => ({ ...m, equipment_brands: brandById.get(m.brand_id) ?? null }));
  const certs = d.certificates;
  const nb = d.notifiedBodies;

  const cats = categories ?? [];
  const ms = (models ?? []) as any[];
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  const info = new Map<string, { cat: string | null; models: string[] }>();
  for (const cert of certs ?? []) info.set(cert.id, { cat: null, models: [] });
  for (const m of ms) {
    if (!m.certificate_id) continue;
    const it = info.get(m.certificate_id);
    if (!it) continue;
    const catId = m.equipment_brands?.category_id ?? null;
    if (!it.cat) it.cat = catId;
    it.models.push(`${m.equipment_brands?.name ?? ""} ${m.name}`.trim());
  }

  const byCat: Record<string, CertItem[]> = {};
  const unassigned: CertItem[] = [];
  for (const cert of certs ?? []) {
    const it = info.get(cert.id)!;
    const item: CertItem = { id: cert.id, cert_no: cert.cert_no, models: it.models };
    if (it.cat) (byCat[it.cat] ||= []).push(item);
    else unassigned.push(item);
  }
  const groups: CertGroup[] = cats
    .filter((c) => byCat[c.id]?.length)
    .map((c) => ({ key: c.id, name: catName.get(c.id)!, certs: byCat[c.id] }));
  if (unassigned.length) groups.push({ key: "_none", name: "Bağlanmamış Sertifikalar", certs: unassigned });

  const modelOpts = ms.map((m) => ({ id: m.id, label: `${m.equipment_brands?.name ?? ""} ${m.name}`.trim() }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <SertifikaClient groups={groups} />
      <SertifikaForm notifiedBodies={nb ?? []} models={modelOpts} />
    </div>
  );
}
