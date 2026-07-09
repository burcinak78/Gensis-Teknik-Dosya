import { createClient } from "@/lib/supabase/server";
import SertifikaForm from "./SertifikaForm";
import SertifikaClient, { type CertGroup, type CertItem } from "./SertifikaClient";

export const dynamic = "force-dynamic";

export default async function SertifikalarPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: models }, { data: certs }, { data: nb }] = await Promise.all([
    supabase.from("equipment_categories").select("id, name").order("sort_order"),
    supabase.from("equipment_models").select("id, name, certificate_id, equipment_brands(name, category_id)").limit(5000),
    supabase.from("certificates").select("id, cert_no").order("cert_no").limit(3000),
    supabase.from("notified_bodies").select("id, identity_no, name").order("name"),
  ]);

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
