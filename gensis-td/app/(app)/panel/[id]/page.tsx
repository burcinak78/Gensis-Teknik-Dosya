import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BelgeListesi from "./BelgeListesi";

export const dynamic = "force-dynamic";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak", generating: "Üretiliyor", generated: "Üretildi", delivered: "Teslim edildi", canceled: "İptal",
};

export default async function ProjeDetay({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: proje } = await supabase
    .from("projects")
    .select("id, dosya_no, bina_adi, status, beyan_yuku_kg, kisi_sayisi, kat_adedi, companies(short_name)")
    .eq("id", params.id)
    .single();

  if (!proje) notFound();
  const p = proje as any;

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
            <div className="text-xs font-bold text-white/80 tracking-wide">{p.dosya_no}</div>
            <h1 className="text-[24px] font-extrabold mt-0.5">{p.bina_adi || "Teknik Dosya"}</h1>
            <div className="text-sm text-white/80 mt-1">
              {p.beyan_yuku_kg ?? "—"} kg · {p.kisi_sayisi ?? "—"} kişi · {p.kat_adedi ?? "—"} kat · {p.companies?.short_name ?? "—"}
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/20 text-white">
            {STATUS_TR[p.status] ?? p.status}
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
