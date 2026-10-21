import DataEntryWizard from "./DataEntryWizard";
import { loadWizardReference } from "./reference";

export const dynamic = "force-dynamic";

export default async function YeniPage() {
  // Referans verileri API'den (ilçeler il seçilince yüklenir)
  const ref = await loadWizardReference();
  return <DataEntryWizard {...ref} />;
}
