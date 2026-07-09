import { createClient } from "@/lib/supabase/server";
import EkipmanForm from "./EkipmanForm";

export const dynamic = "force-dynamic";

export default async function EkipmanlarPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: brands }, { data: certificates }, { data: models }] = await Promise.all([
    supabase.from("equipment_categories").select("id, name").order("sort_order"),
    supabase.from("equipment_brands").select("id, category_id, name").order("name"),
    supabase.from("certificates").select("id, cert_no").order("cert_no").limit(1000),
    supabase.from("equipment_models").select("id, name, equipment_brands(name)").order("created_at", { ascending: false }).limit(40),
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">Son eklenen modeller</div>
        <table className="w-full text-sm">
          <tbody>
            {(models ?? []).map((m: any) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-2.5 text-slate-500">{m.equipment_brands?.name ?? "—"}</td>
                <td className="px-5 py-2.5 font-semibold">{m.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EkipmanForm categories={categories ?? []} brands={brands ?? []} certificates={certificates ?? []} />
    </div>
  );
}
