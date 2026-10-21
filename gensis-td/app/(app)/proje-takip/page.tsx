import { requireMe } from "@/lib/api/server";
import { listTakip, loadTakipReference } from "./data";
import ProjeTakipClient from "./ProjeTakipClient";

export const dynamic = "force-dynamic";

export default async function ProjeTakipPage() {
  const me = await requireMe(["admin", "gensis", "muhasebeci"]);
  const readOnly = me.role === "muhasebeci";
  const today = new Date().toISOString().slice(0, 10);
  // The API moves overdue HAZIRLANIYOR jobs to BEKLIYOR when the list is read, and leaves out TD rows.
  const [rows, ref] = await Promise.all([listTakip(), loadTakipReference()]);

  return (
    <ProjeTakipClient
      rows={rows as any}
      companies={ref.companies}
      provinces={ref.provinces}
      sorumlular={ref.sorumlular}
      currentUserId={me.id}
      today={today}
      readOnly={readOnly}
    />
  );
}
