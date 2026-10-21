import Link from "next/link";
import { apiGet, dbName } from "@/lib/api/server";
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

type ProjectStats = { total: number; thisMonth: number; draft: number; delivered: number };
type ProjectListItem = {
  id: string; dosyaNo: string; tdNo: string | null; status: string; binaAdi: string | null; beyanYukuKg: number | null;
  katAdedi: number | null; createdAt: string; companyShortName: string | null; adaParsel: string; seriNo: string;
};

export default async function PanelPage() {
  // Counts and the list are filtered by the API to what this user may see ("bu ay" in Turkey time).
  const [stats, list] = await Promise.all([
    apiGet<ProjectStats>("/api/projects/stats"),
    apiGet<ProjectListItem[]>("/api/projects?limit=100"),
  ]);
  const total = stats?.total ?? 0, thisMonth = stats?.thisMonth ?? 0, draft = stats?.draft ?? 0, delivered = stats?.delivered ?? 0;

  const projeler = (list ?? []).map((p) => ({
    id: p.id, dosya_no: p.dosyaNo, td_no: p.tdNo, status: dbName(p.status), bina_adi: p.binaAdi,
    beyan_yuku_kg: p.beyanYukuKg, kat_adedi: p.katAdedi, created_at: p.createdAt,
    ada_parsel: p.adaParsel, seri_no: p.seriNo,
    companies: p.companyShortName ? { short_name: p.companyShortName } : null,
  }));

  return (
    <div>
      <div className="px-8 pt-6 pb-4 sticky top-0 z-30 bg-white border-b border-[#e7ebf2]">
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
          <Stat icon="folder" color="#0d8b8b" value={total} label="Toplam dosya" />
          <Stat icon="trending_up" color="#1e2a5b" value={thisMonth} label="Bu ay üretilen" />
          <Stat icon="edit_document" color="#b45309" value={draft} label="Taslak" />
          <Stat icon="task_alt" color="#15803d" value={delivered} label="Teslim edildi" />
        </div>

        <PanelTable projects={projeler} />
      </div>
    </div>
  );
}
