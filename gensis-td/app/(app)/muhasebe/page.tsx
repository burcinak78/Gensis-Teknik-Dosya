import { apiGet, requireMe } from "@/lib/api/server";
import { toSnake } from "@/lib/api/case";
import MuhasebeClient from "./MuhasebeClient";

export const dynamic = "force-dynamic";

type AccountingRow = { row: Record<string, unknown>; muhasebe: Record<string, unknown> | null };

export default async function MuhasebePage() {
  const me = await requireMe(["admin", "muhasebeci", "gensis"]);
  const readOnly = me.role === "gensis"; // Kullanıcı: salt-okunur

  const [rows, companies, sorumlular] = await Promise.all([
    apiGet<AccountingRow[]>("/api/muhasebe"),
    apiGet("/api/catalog/companies/names"),
    apiGet("/api/takip/sorumlular"),
  ]);

  return (
    <MuhasebeClient
      rows={(rows ?? []).map((r) => ({ ...toSnake<Record<string, any>>(r.row), muhasebe: toSnake(r.muhasebe) })) as any}
      companies={toSnake<any[]>(companies ?? [])}
      sorumlular={toSnake<any[]>(sorumlular ?? [])}
      readOnly={readOnly}
    />
  );
}
