// Proje Takip data from the C# API (office roles only there), converted to the column names the screens use.
import { apiGet } from "@/lib/api/server";
import { toSnake } from "@/lib/api/case";

/** Companies (names only), provinces and the Gensis staff who can be put in charge of a job. */
export async function loadTakipReference() {
  const [companies, provinces, sorumlular] = await Promise.all([
    apiGet("/api/catalog/companies/names"),
    apiGet<{ id: number; name: string }[]>("/api/catalog/provinces"),
    apiGet("/api/takip/sorumlular"),
  ]);
  return { companies: toSnake<any[]>(companies ?? []), provinces: provinces ?? [], sorumlular: toSnake<any[]>(sorumlular ?? []) };
}

type ListRow = { row: Record<string, unknown>; docs: unknown[]; muhasebe: unknown };

/** Jobs with their documents and accounting state, as rows of takip_projeler plus docs / muhasebe. */
const flatten = (r: ListRow): Record<string, any> =>
  ({ ...toSnake<Record<string, any>>(r.row), docs: toSnake<any[]>(r.docs), muhasebe: toSnake(r.muhasebe) });

export async function listTakip(): Promise<Record<string, any>[]> {
  return ((await apiGet<ListRow[]>("/api/takip")) ?? []).map(flatten);
}

export async function getTakip(id: string): Promise<Record<string, any> | null> {
  const r = await apiGet<ListRow>(`/api/takip/${encodeURIComponent(id)}`);
  return r ? flatten(r) : null;
}
