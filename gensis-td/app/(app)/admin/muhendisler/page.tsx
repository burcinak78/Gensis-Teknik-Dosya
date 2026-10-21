import { loadEngineersScreen } from "../data";
import MuhendislerClient from "./MuhendislerClient";

export const dynamic = "force-dynamic";

export default async function MuhendislerPage() {
  const d = await loadEngineersScreen();
  return <MuhendislerClient engineers={d.engineers} companies={d.companies} documents={d.documents} defaultCompanyId={d.gensisCompanyId} />;
}
