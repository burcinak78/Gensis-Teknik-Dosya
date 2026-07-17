import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Row({ k, v }: { k: string; v?: any }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold text-slate-800 text-right">{v || "—"}</span>
    </div>
  );
}

export default async function ProjeOnayDetayPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: r } = await supabase
    .from("proje_onay")
    .select("*, companies(short_name, legal_name), provinces(name), districts(name), makine:engineers!makine_muhendis_id(full_name, chamber_reg_no), elektrik:engineers!elektrik_muhendis_id(full_name, chamber_reg_no)")
    .eq("id", params.id)
    .single();
  if (!r) notFound();

  const row = r as any;
  const belediye = row.districts?.name || row.input_data?.belediye || "";
  const il = row.provinces?.name || row.input_data?.il || "";
  const hiz = row.input_data?.beyan_hizi_txt || row.beyan_hizi;

  const belgeler = [
    { ad: "Avan Proje Onay Dilekçesi", href: `/api/pdf/avan-proje-dilekce?id=${row.id}`, hazir: true },
    { ad: "Makine Mühendisi Taahhütnamesi", href: "#", hazir: false },
    { ad: "Elektrik Mühendisi Taahhütnamesi", href: "#", hazir: false },
  ];

  return (
    <div>
      <div className="px-8 pt-6 pb-4 flex items-center justify-between border-b border-[#e7ebf2]">
        <div>
          <Link href="/proje-onay" className="text-xs text-slate-400 hover:text-navy">← Proje Onay Dosyaları</Link>
          <h1 className="text-[22px] font-extrabold tracking-tight mt-1">{row.yapi_sahibi || row.dosya_no || "Proje Onay Dosyası"}</h1>
        </div>
        <Link href={`/proje-onay/${row.id}/duzenle`} className="text-sm font-bold px-4 py-2.5 rounded-xl border border-[#e5e9f0] bg-white hover:bg-slate-50 inline-flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[18px]">edit</span> Düzenle
        </Link>
      </div>

      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 max-w-5xl gs-fade">
        {/* Belgeler */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 h-fit">
          <h2 className="font-bold mb-3">Belgeler</h2>
          <div className="space-y-2">
            {belgeler.map((b) => (
              <div key={b.ad} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded text-[20px] text-brand">picture_as_pdf</span>
                  <span className="text-sm font-semibold text-slate-800">{b.ad}</span>
                </div>
                {b.hazir ? (
                  <a href={b.href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-navy hover:underline">Aç / İndir →</a>
                ) : (
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">yakında</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Mühendis taahhütnameleri ve toplu PDF bir sonraki aşamada eklenecek.</p>
        </div>

        {/* Özet */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 h-fit">
          <div className="text-xs font-bold text-slate-500 uppercase mb-3">Dosya Özeti</div>
          <Row k="Firma" v={row.companies?.short_name} />
          <Row k="Belediye / İl" v={[belediye, il].filter(Boolean).join(" / ")} />
          <Row k="Yapı Sahibi" v={row.yapi_sahibi} />
          <Row k="Montaj Adresi" v={row.montaj_adresi} />
          <Row k="Ada / Parsel" v={[row.ada, row.parsel].filter(Boolean).join(" / ")} />
          <Row k="Kapasite" v={row.beyan_yuku_kg ? `${row.beyan_yuku_kg} kg · ${row.kisi_sayisi ?? "—"} kişi` : ""} />
          <Row k="Beyan Hızı / Durak" v={`${hiz ?? "—"} m/s · ${row.durak_sayisi ?? "—"} durak`} />
          <Row k="Makine Müh." v={row.makine?.full_name} />
          <Row k="Elektrik Müh." v={row.elektrik?.full_name} />
        </div>
      </div>
    </div>
  );
}
