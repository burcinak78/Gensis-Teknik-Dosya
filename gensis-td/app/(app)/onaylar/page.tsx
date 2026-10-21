import { apiGet, requireMe } from "@/lib/api/server";
import OnaylarClient from "./OnaylarClient";

export const dynamic = "force-dynamic";

type PendingItem = {
  id: string; kind: string; docType: string | null; payload: Record<string, any>; companyName: string;
  engineerName: string | null; submitter: string; submittedAt: string; originalName: string | null;
  fileUrl: string | null; isUpdate: boolean;
};

export default async function OnaylarPage() {
  await requireMe(["admin", "gensis"]);
  // Pending customer changes with names and a 30-minute preview link (staff only in the API).
  const items = (await apiGet<PendingItem[]>("/api/pending-changes")) ?? [];
  return <OnaylarClient items={items} />;
}
