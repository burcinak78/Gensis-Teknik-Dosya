import { loadCatalogScreen } from "../data";
import GuvenlikEkipmanlariClient from "./GuvenlikEkipmanlariClient";

export const dynamic = "force-dynamic";

export default async function EkipmanlarPage() {
  const d = await loadCatalogScreen();
  // Current PDF name per certificate (shown next to the certificate).
  const certFileMap: Record<string, string> = {};
  for (const c of d.certificates) if (c.current_file_name) certFileMap[c.id] = c.current_file_name;
  return (
    <GuvenlikEkipmanlariClient
      categories={d.categories}
      brands={d.brands}
      models={d.models}
      certificates={d.certificates}
      certFileMap={certFileMap}
      notifiedBodies={d.notifiedBodies}
      modelCerts={d.modelCerts}
      isAdmin={d.isAdmin}
    />
  );
}
