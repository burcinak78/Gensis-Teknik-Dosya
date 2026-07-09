import { createClient } from "@/lib/supabase/server";
import MusteriForm from "./MusteriForm";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const supabase = createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, short_name, legal_name, city, authorized_person")
    .order("short_name")
    .limit(500);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
          Müşteriler ({companies?.length ?? 0})
        </div>
        <table className="w-full text-sm">
          <tbody>
            {(companies ?? []).map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-2.5 font-semibold">{c.short_name}</td>
                <td className="px-5 py-2.5 text-slate-500">{c.city ?? "—"}</td>
                <td className="px-5 py-2.5 text-slate-500">{c.authorized_person ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MusteriForm />
    </div>
  );
}
