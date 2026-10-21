import { apiGet } from "@/lib/api/server";
import { toSnake } from "@/lib/api/case";
import NotlarClient from "./NotlarClient";

export const dynamic = "force-dynamic";

export default async function NotlarPage() {
  // Only the user's own notes (the API filters by owner).
  const notlar = await apiGet("/api/notes");
  return <NotlarClient notlar={toSnake<any[]>(notlar ?? [])} />;
}
