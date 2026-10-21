import ProjeOnayWizard from "./ProjeOnayWizard";
import { loadWizardReference } from "../../yeni/reference";

export const dynamic = "force-dynamic";

export default async function YeniProjeOnayPage() {
  // Same reference data as the teknik dosya wizard (companies, engineers + Gensis id, capacity, ilgili idareler).
  const ref = await loadWizardReference();
  return (
    <ProjeOnayWizard
      companies={ref.companies}
      provinces={ref.provinces}
      capacity={ref.capacity}
      engineers={ref.engineers}
      gensisCompanyId={ref.gensisCompanyId}
      ilgiliIdareler={ref.ilgiliIdareler}
    />
  );
}
