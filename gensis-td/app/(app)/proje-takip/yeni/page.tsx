import { apiGet, requireMe } from "@/lib/api/server";
import { loadTakipReference } from "../data";
import YeniProjeForm from "../YeniProjeForm";

export const dynamic = "force-dynamic";

export default async function YeniTakipPage() {
  await requireMe(["admin", "gensis", "muhasebeci"]);
  const [ref, next] = await Promise.all([loadTakipReference(), apiGet<{ nextNo: number | null }>("/api/takip/next-no")]);
  return (
    <YeniProjeForm
      companies={ref.companies}
      provinces={ref.provinces}
      sorumlular={ref.sorumlular}
      nextNo={next?.nextNo ?? null}
    />
  );
}
