import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  generating: "Üretiliyor",
  generated: "Üretildi",
  delivered: "Teslim edildi",
  canceled: "İptal",
};

export default async function PanelPage() {
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, dosya_no, status, bina_adi, beyan_yuku_kg, kat_adedi, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-7 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-bold">Teknik Dosyalar</h1>
        <Link
          href="/yeni"
          className="bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2.5 rounded-lg"
        >
          + Yeni Teknik Dosya
        </Link>
      </div>

      <div className="p-7">
        {!projects || projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            Henüz teknik dosya yok.{" "}
            <Link href="/yeni" className="text-brand font-semibold">
              İlk dosyanı oluştur →
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Dosya No</th>
                  <th className="px-4 py-3 font-semibold">Bina</th>
                  <th className="px-4 py-3 font-semibold">Yük</th>
                  <th className="px-4 py-3 font-semibold">Kat</th>
                  <th className="px-4 py-3 font-semibold">Durum</th>
                  <th className="px-4 py-3 font-semibold">Tarih</th>
                  <th className="px-4 py-3 font-semibold">Belge</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{p.dosya_no}</td>
                    <td className="px-4 py-3">{p.bina_adi ?? "—"}</td>
                    <td className="px-4 py-3">{p.beyan_yuku_kg ?? "—"} kg</td>
                    <td className="px-4 py-3">{p.kat_adedi ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">
                        {STATUS_TR[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(p.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/api/pdf/teknik-dosya?projectId=${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand font-semibold hover:underline"
                      >
                        Teknik Dosya PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
