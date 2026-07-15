import { createClient } from "@/lib/supabase/server";
import KullaniciForm from "./KullaniciForm";

export const dynamic = "force-dynamic";

const ROL_TR: Record<string, string> = { admin: "Admin", gensis: "Gensis Kullanıcı", customer: "Müşteri" };

export default async function KullanicilarPage() {
  const supabase = createClient();
  const [{ data: profiles }, { data: companies }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, is_active, companies(short_name)").order("created_at", { ascending: false }).limit(500),
    supabase.from("companies").select("id, short_name").order("short_name").limit(500),
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
          Kullanıcılar ({profiles?.length ?? 0})
        </div>
        <table className="w-full text-sm">
          <tbody>
            {(profiles ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-2.5 font-semibold">{p.full_name ?? "—"}</td>
                <td className="px-5 py-2.5">
                  <span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{ROL_TR[p.role] ?? p.role}</span>
                </td>
                <td className="px-5 py-2.5 text-slate-500">{p.companies?.short_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <KullaniciForm companies={companies ?? []} />
    </div>
  );
}
