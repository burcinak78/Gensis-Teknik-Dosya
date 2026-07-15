import { createClient } from "@/lib/supabase/server";
import MuhendisForm from "./MuhendisForm";

export const dynamic = "force-dynamic";

const BRANS: Record<string, string> = { makine: "Makine Mühendisi", elektrik: "Elektrik Mühendisi" };

export default async function MuhendislerPage() {
  const supabase = createClient();
  const [{ data: engineers }, { data: companies }] = await Promise.all([
    supabase.from("engineers").select("id, full_name, discipline, chamber_reg_no, companies(short_name)").order("full_name").limit(1000),
    supabase.from("companies").select("id, short_name").order("short_name").limit(1000),
  ]);
  const gensis = (companies ?? []).find((c) => c.short_name.toLocaleLowerCase("tr").includes("gensis"));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
          Mühendisler ({engineers?.length ?? 0})
        </div>
        <table className="w-full text-sm">
          <tbody>
            {(engineers ?? []).map((m: any) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-2.5 font-semibold">{m.full_name}</td>
                <td className="px-5 py-2.5">
                  <span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{BRANS[m.discipline] ?? m.discipline}</span>
                </td>
                <td className="px-5 py-2.5 text-slate-500">{m.chamber_reg_no ?? "—"}</td>
                <td className="px-5 py-2.5 text-slate-500">{m.companies?.short_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MuhendisForm companies={companies ?? []} defaultCompanyId={gensis?.id ?? ""} />
    </div>
  );
}
