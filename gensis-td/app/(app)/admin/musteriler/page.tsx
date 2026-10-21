import { loadCompaniesScreen } from "../data";
import MusterilerClient from "./MusterilerClient";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const d = await loadCompaniesScreen();
  return <MusterilerClient companies={d.companies} provinces={d.provinces} documents={d.documents} notifiedBodies={d.notifiedBodies} />;
}
