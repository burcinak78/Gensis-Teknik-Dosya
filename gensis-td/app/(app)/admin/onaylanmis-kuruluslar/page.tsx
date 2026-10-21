import { apiGet, requireMe } from "@/lib/api/server";
import { toSnake } from "@/lib/api/case";
import OnaylanmisKuruluslarClient from "./OnaylanmisKuruluslarClient";

export const dynamic = "force-dynamic";

export default async function OnaylanmisKuruluslarPage() {
  const me = await requireMe(["admin", "gensis"]);
  const bodies = await apiGet("/api/catalog/notified-bodies");
  return <OnaylanmisKuruluslarClient bodies={toSnake<any[]>(bodies ?? [])} isAdmin={me.role === "admin"} />;
}
