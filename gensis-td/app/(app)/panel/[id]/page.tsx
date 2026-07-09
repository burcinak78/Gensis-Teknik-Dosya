import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BelgeListesi from "./BelgeListesi";

export const dynamic = "force-dynamic";

export default async function ProjeDetay({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: proje } = await supabase
    .from("projects")
    .select("id, dosya_no, bina_adi, status, beyan_yuku_kg, kat_adedi, durak_adedi")
    .eq("id", params.id)
    .single();

  if (!proje) notFound();

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-7 py-4 sticky top-0 z-10">
        <div className="text-sm text-slate-500 mb-1">
          <Link href="/panel" className="hover:underline">
            Teknik Dosyalar
          </Link>{" "}
          › <span className="text-slate-900 font-semibold">{proje.dosya_no}</span>
        </div>
        <h1 className="text-lg font-bold">{proje.dosya_no}</h1>
        <div className="text-sm text-slate-500">
          {proje.bina_adi || "—"} · {proje.beyan_yuku_kg ?? "—"} kg · {proje.kat_adedi ?? "—"} kat
        </div>
      </div>

      <div className="p-7 max-w-3xl">
        <BelgeListesi projectId={proje.id} />
        <p className="text-xs text-slate-400 mt-3">
          Not: Veri girişinde doldurulmayan alanlar belgede boş görünür.
        </p>
      </div>
    </div>
  );
}
