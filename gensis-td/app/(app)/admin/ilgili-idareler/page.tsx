import { apiGet, requireMe } from "@/lib/api/server";
import { toSnake } from "@/lib/api/case";
import IlgiliIdarelerClient from "./IlgiliIdarelerClient";

export const dynamic = "force-dynamic";

export default async function IlgiliIdarelerPage() {
  await requireMe(["admin", "gensis"]);
  const [rows, provinces] = await Promise.all([
    apiGet("/api/catalog/ilgili-idareler"),
    apiGet<{ id: number; name: string }[]>("/api/catalog/provinces"),
  ]);
  return <IlgiliIdarelerClient rows={toSnake<any[]>(rows ?? [])} provinces={provinces ?? []} />;
}
