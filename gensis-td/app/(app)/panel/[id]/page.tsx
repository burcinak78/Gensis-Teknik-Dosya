import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TEKNIK_DOSYA_BELGELERI } from "@/lib/pdf/belgeler";

export const dynamic = "force-dynamic";

export default async function ProjeDetay({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: proje } = await supabase
    .from("projects")
    .select("id, dosya_no, bina_adi, status, beyan_yuku_kg, kat_adedi, durak_adedi")
    .eq("id", params.id)
    .single();

  if (!proje) notFound();

  const pdfBase = `/api/pdf/teknik-dosya?projectId=${proje.id}`;

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-7 py-4 sticky top-0 z-10">
        <div className="text-sm text-slate-500 mb-1">
          <Link href="/panel" className="hover:underline">
            Teknik Dosyalar
          </Link>{" "}
          › <span className="text-slate-900 font-semibold">{proje.dosya_no}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{proje.dosya_no}</h1>
            <div className="text-sm text-slate-500">
              {proje.bina_adi || "—"} · {proje.beyan_yuku_kg ?? "—"} kg ·{" "}
              {proje.kat_adedi ?? "—"} kat
            </div>
          </div>
          <a
            href={pdfBase}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2.5 rounded-lg"
          >
            Tümü (Birleşik PDF)
          </a>
        </div>
      </div>

      <div className="p-7 max-w-3xl">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
            Belgeler — tek tek indir
          </div>
          <ul>
            {TEKNIK_DOSYA_BELGELERI.map((b, i) => (
              <li
                key={b.code}
                className="flex items-center justify-between px-5 py-3 border-b border-slate-100 last:border-0"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-slate-400 text-sm">{i + 1}</span>
                  <span className={b.hazir ? "text-slate-800" : "text-slate-400"}>
                    {b.title}
                  </span>
                </span>
                {b.hazir ? (
                  <a
                    href={`${pdfBase}&belge=${b.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand font-semibold text-sm hover:underline"
                  >
                    PDF indir
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">yakında</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Not: Bazı alanlar boş çıkabilir — veri girişinde doldurulmayan alanlar belgede boş görünür.
        </p>
      </div>
    </div>
  );
}
