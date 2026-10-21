import { redirect } from "next/navigation";
import { apiGet, requireMe } from "@/lib/api/server";
import { toSnake } from "@/lib/api/case";
import KullanicilarClient from "./KullanicilarClient";

export const dynamic = "force-dynamic";

export default async function KullanicilarPage() {
  // Only admins manage users; Gensis staff land on Müşteriler, as before.
  const me = await requireMe(["admin", "gensis"]);
  if (me.role !== "admin") redirect("/admin/musteriler");

  const [users, companies, catalog] = await Promise.all([
    apiGet<Record<string, any>[]>("/api/users"),
    apiGet("/api/catalog/companies/names"),
    apiGet<{ gensisCompanyId: string | null }>("/api/catalog/engineers"),
  ]);

  return (
    <KullanicilarClient
      users={toSnake<any[]>(users ?? []).map(({ company_short_name, ...u }) => ({
        ...u, companies: company_short_name ? { short_name: company_short_name } : null,
      }))}
      companies={toSnake<any[]>(companies ?? [])}
      defaultCompanyId={catalog?.gensisCompanyId ?? ""}
    />
  );
}
