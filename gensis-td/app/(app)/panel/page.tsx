import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PanelTable from "./PanelTable";

export const dynamic = "force-dynamic";

function Stat({ icon, color, value, label }: { icon: string; color: string; value: number | string; label: string }) {
  return (
    <div className="gs-card p-4">
      <span className="w-9 h-9 rounded-xl grid place-items-center material-symbols-rounded text-[20px]"
        style={{ background: color + "1f", color }}>{icon}</span>
      <div className="text-[30px] font-extrabold leading-tight mt-3">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default async function PanelPage() {
  const supabase = createClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [total, draft, delivered, thisMonth, list] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "delivered"),
    supabase.from("projects").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("projects")
      .select("id, dosya_no, status, bina_adi, beyan_yuku_kg, kat_adedi, created_at, companies(short_name)")
      .order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <div>
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-tight">Teknik Dosyalar</h1>
            <p className="text-sm text-slate-500">Oluşturulan teknik dosyalarınız ve durumları.</p>
          </div>
          <Link href="/yeni" className="gs-btn text-sm font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5">
            <span className="material-symbols-rounded text-[18px]">add</span> Yeni Teknik Dosya
          </Link>
        </div>
      </div>

      <div className="px-8 pb-8 gs-fade">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat icon="folder" color="#0d8b8b" value={total.count ?? 0} label="Toplam dosya" />
          <Stat icon="trending_up" color="#1e2a5b" value={thisMonth.count ?? 0} label="Bu ay üretilen" />
          <Stat icon="edit_document" color="#b45309" value={draft.count ?? 0} label="Taslak" />
          <Stat icon="task_alt" color="#15803d" value={delivered.count ?? 0} label="Teslim edildi" />
        </div>

        <PanelTable projects={(list.data ?? []) as any} />
      </div>
    </div>
  );
}
