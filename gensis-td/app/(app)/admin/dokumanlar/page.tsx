import { apiGet, requireMe } from "@/lib/api/server";
import DokumanlarClient, { type LibraryItem } from "./DokumanlarClient";

export const dynamic = "force-dynamic";

export default async function DokumanlarPage() {
  await requireMe(["admin", "gensis"]);
  const [documents, companies] = await Promise.all([
    apiGet<LibraryItem[]>("/api/document-library?archived=true"),
    apiGet<{ id: string; shortName: string }[]>("/api/catalog/companies/names"),
  ]);
  return <DokumanlarClient documents={documents ?? []} companies={companies ?? []} />;
}
