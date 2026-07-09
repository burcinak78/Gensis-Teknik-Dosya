import { createClient } from "@/lib/supabase/server";
import SertifikaForm from "./SertifikaForm";

export const dynamic = "force-dynamic";

export default async function SertifikalarPage() {
  const supabase = createClient();
  const [{ data: nb }, { data: models }, { data: certs }] = await Promise.all([
    supabase.from("notified_bodies").select("id, identity_no, name").order("name"),
    supabase.from("equipment_models").select("id, name, equipment_brands(name)").order("name").limit(1000),
    supabase.from("certificates").select("id, cert_no, notified_body_id").order("cert_no").limit(50),
  ]);

  const modelOpts = (models ?? []).map((m: any) => ({ id: m.id, label: `${m.equipment_brands?.name ?? ""} ${m.name}`.trim() }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">Son sertifikalar</div>
        <table className="w-full text-sm">
          <tbody>
            {(certs ?? []).map((c: any) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-2.5 font-semibold">{c.cert_no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SertifikaForm notifiedBodies={nb ?? []} models={modelOpts} />
    </div>
  );
}
