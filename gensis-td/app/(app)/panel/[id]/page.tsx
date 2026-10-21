import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api/server";
import BelgeListesi from "./BelgeListesi";

export const dynamic = "force-dynamic";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak", generating: "Üretiliyor", generated: "Üretildi", delivered: "Teslim edildi", canceled: "İptal",
};

export default async function ProjeDetay(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const p = await apiGet<{
    id: string; dosyaNo: string; binaAdi: string | null; status: string; beyanYukuKg: number | null;
    kisiSayisi: number | null; katAdedi: number | null; companyShortName: string | null;
  }>(`/api/projects/${encodeURIComponent(params.id)}`);
  if (!p) notFound();
  const status = p.status;

  return (
    <div className="px-8 py-6 gs-fade">
      <Link href="/panel" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy mb-4">
        <span className="material-symbols-rounded text-[18px]">arrow_back</span> Teknik Dosyalar
      </Link>

      {/* Hero banner */}
      <div className="gs-hero relative overflow-hidden rounded-[18px] p-7 mb-6">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-white/80 tracking-wide">{p.dosyaNo}</div>
            <h1 className="text-[24px] font-extrabold mt-0.5">{p.binaAdi || "Teknik Dosya"}</h1>
            <div className="text-sm text-white/80 mt-1">
              {p.beyanYukuKg ?? "—"} kg · {p.kisiSayisi ?? "—"} kişi · {p.katAdedi ?? "—"} kat · {p.companyShortName ?? "—"}
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/20 text-white">
            {STATUS_TR[status] ?? status}
          </span>
        </div>
      </div>

      <div className="max-w-3xl">
        <BelgeListesi projectId={p.id} />
        <p className="text-xs text-slate-400 mt-3">Not: Veri girişinde doldurulmayan alanlar belgede boş görünür.</p>
      </div>
    </div>
  );
}
