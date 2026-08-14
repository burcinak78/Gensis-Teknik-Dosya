"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadTakipFile } from "@/lib/takipUpload";
import {
  deleteTakipDoc, saveBekliyorAciklama, completeTakipProje,
} from "./actions";

type Company = { id: string; short_name: string; legal_name: string | null; city: string | null };
type Province = { id: number; name: string };
type Sorumlu = { id: string; full_name: string | null; role: string };
type District = { id: string; name: string };
type Doc = { id: string; takip_id: string; kind: string; original_name: string | null };
type Row = {
  id: string; proje_no: number; parent_id: string | null; rev_no: string | null;
  rev_tarihi: string | null; rev_aciklama: string | null;
  proje_tipi: string; siparis_tarihi: string | null;
  company_id: string | null; ada_parsel: string | null; is_adi: string | null;
  asansor_sayisi: number | null; asansor_tipi: string | null;
  il_adi: string | null; ilce_adi: string | null; fiyat: number | null;
  fatura_tipi: string | null; toplam_tutar: number | null; proje_sorumlusu_id: string | null;
  tahmini_tamamlanma: string | null; durum: string; bekliyor_aciklama: string | null;
  tamamlanma_tarihi: string | null; teslim_tipi: string | null; hard_copy_adedi: number | null;
  muhasebeye_gonderildi: boolean; muhasebe_durumu: string | null;
  docs: Doc[]; muhasebe: { cariye_islendi: boolean; teslim_tarihi: string | null } | null;
};

const TIP_TR: Record<string, string> = { mimari: "Mimari", uygulama: "Uygulama" };
const AST: { v: string; t: string }[] = [
  { v: "MR", t: "MR" }, { v: "MRL", t: "MRL" }, { v: "HD_YUK", t: "HD Yük" }, { v: "HD_INSAN", t: "HD İnsan" },
];
const AST_TR: Record<string, string> = { MR: "MR", MRL: "MRL", HD_YUK: "HD Yük", HD_INSAN: "HD İnsan" };
const DURUM_BADGE: Record<string, string> = {
  HAZIRLANIYOR: "bg-amber-100 text-amber-700",
  BEKLIYOR: "bg-red-100 text-red-700",
  TAMAMLANDI: "bg-green-100 text-green-700",
};

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("tr-TR") : "—");

export default function ProjeTakipClient({
  rows, companies, provinces, sorumlular, currentUserId, today, readOnly = false,
}: {
  rows: Row[]; companies: Company[]; provinces: Province[]; sorumlular: Sorumlu[];
  currentUserId: string; today: string; readOnly?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ projeNo: "", adaParsel: "", tip: "", firma: "", isAdi: "", sorumlu: "", durum: "" });
  const [durumRow, setDurumRow] = useState<Row | null>(null);
  const setFilter = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const sorumluAd = (id: string | null) => sorumlular.find((s) => s.id === id)?.full_name ?? "—";
  const firmaAd = (id: string | null) => companies.find((c) => c.id === id)?.short_name ?? "—";

  const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");
  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    return rows.filter((r) => {
      if (s) {
        const hay = [String(r.proje_no), firmaAd(r.company_id), r.is_adi, r.ada_parsel, sorumluAd(r.proje_sorumlusu_id)]
          .map(tc).join(" ");
        if (!hay.includes(s)) return false;
      }
      if (f.projeNo && !String(r.proje_no).includes(f.projeNo.trim())) return false;
      if (f.adaParsel && !tc(r.ada_parsel).includes(tc(f.adaParsel))) return false;
      if (f.tip && r.proje_tipi !== f.tip) return false;
      if (f.firma && r.company_id !== f.firma) return false;
      if (f.isAdi && !tc(r.is_adi).includes(tc(f.isAdi))) return false;
      if (f.sorumlu && r.proje_sorumlusu_id !== f.sorumlu) return false;
      if (f.durum && r.durum !== f.durum) return false;
      return true;
    });
  }, [q, f, rows]);

  function rowClass(r: Row) {
    const muhDone = !!r.muhasebe?.cariye_islendi;
    const overdue = r.durum !== "TAMAMLANDI" && r.tahmini_tamamlanma && r.tahmini_tamamlanma < today;
    if (muhDone) return "bg-green-50";
    if (overdue || r.durum === "BEKLIYOR") return "bg-red-50";
    return "";
  }

  const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
  const td = "px-3 py-2 text-sm whitespace-nowrap";
  const fInp = "w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-brand";
  const fTh = "px-3 py-1.5 align-top";

  return (
    <div>
      <div className="bg-white/80 backdrop-blur border-b border-[#e5e9f0] px-8 pt-5 pb-4 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Proje Takip</h1>
          <p className="text-sm text-slate-500">Mimari / uygulama proje çizim talepleri ve tamamlanma takibi</p>
        </div>
        {!readOnly && (
          <Link href="/proje-takip/yeni" className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">
            + Yeni Proje
          </Link>
        )}
      </div>

      <div className="p-8 gs-fade">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: proje no, firma, işin adı, ada/parsel, sorumlu…" className={inp + " pl-10"} />
          </div>
          <button onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border ${showFilters ? "bg-brand-light text-brand border-brand/30" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            <span className="material-symbols-rounded text-[18px]">filter_list</span> Filtrele
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl">
          <div className="overflow-auto max-h-[calc(100vh-220px)] rounded-2xl">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className={th}>Durum</th>
                  <th className={th}>Proje No</th>
                  <th className={th}>Ada/Parsel</th>
                  <th className={th}>Tip</th>
                  <th className={th}>Firma</th>
                  <th className={th}>İşin Adı</th>
                  <th className={th}>Sipariş Tar.</th>
                  <th className={th}>Sorumlu</th>
                  <th className={th}>Tamamlanma Tar.</th>
                  <th className={th}>İşlem</th>
                </tr>
                {showFilters && (
                  <tr className="bg-white border-b border-slate-200">
                    <th className={fTh}>
                      <select className={fInp} value={f.durum} onChange={(e) => setFilter("durum", e.target.value)}>
                        <option value="">Hepsi</option><option value="HAZIRLANIYOR">HAZIRLANIYOR</option><option value="BEKLIYOR">BEKLIYOR</option><option value="TAMAMLANDI">TAMAMLANDI</option>
                      </select>
                    </th>
                    <th className={fTh}><input className={fInp} value={f.projeNo} onChange={(e) => setFilter("projeNo", e.target.value)} placeholder="No" /></th>
                    <th className={fTh}><input className={fInp} value={f.adaParsel} onChange={(e) => setFilter("adaParsel", e.target.value)} placeholder="Ada/Parsel" /></th>
                    <th className={fTh}>
                      <select className={fInp} value={f.tip} onChange={(e) => setFilter("tip", e.target.value)}>
                        <option value="">Hepsi</option><option value="mimari">Mimari</option><option value="uygulama">Uygulama</option>
                      </select>
                    </th>
                    <th className={fTh}>
                      <select className={fInp} value={f.firma} onChange={(e) => setFilter("firma", e.target.value)}>
                        <option value="">Hepsi</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                      </select>
                    </th>
                    <th className={fTh}><input className={fInp} value={f.isAdi} onChange={(e) => setFilter("isAdi", e.target.value)} placeholder="İşin adı" /></th>
                    <th className={fTh}></th>
                    <th className={fTh}>
                      <select className={fInp} value={f.sorumlu} onChange={(e) => setFilter("sorumlu", e.target.value)}>
                        <option value="">Hepsi</option>
                        {sorumlular.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? "—"}</option>)}
                      </select>
                    </th>
                    <th className={fTh}></th>
                    <th className={fTh}></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${rowClass(r)}`}>
                    <td className={td}>
                      {readOnly ? (
                        <span className={r.durum === "HAZIRLANIYOR"
                          ? "text-xs font-semibold text-slate-600"
                          : `text-[11px] font-bold px-2 py-1 rounded-full ${DURUM_BADGE[r.durum] ?? "bg-slate-100 text-slate-600"}`}>
                          {r.durum}
                        </span>
                      ) : (
                        <button onClick={() => setDurumRow(r)} title="Durumu aç"
                          className={r.durum === "HAZIRLANIYOR"
                            ? "text-xs font-semibold text-slate-600 hover:underline"
                            : `text-[11px] font-bold px-2 py-1 rounded-full hover:opacity-80 ${DURUM_BADGE[r.durum] ?? "bg-slate-100 text-slate-600"}`}>
                          {r.durum}
                        </button>
                      )}
                      {r.muhasebe?.cariye_islendi && <span className="block text-[10px] text-green-600 font-semibold mt-0.5">Teslim edildi</span>}
                    </td>
                    <td className={td + " font-bold text-navy"}>
                      {r.proje_no}
                      {r.parent_id && <span className="ml-1.5 text-[10px] font-bold bg-brand-light text-brand px-1.5 py-0.5 rounded">Rev {r.rev_no ?? ""}</span>}
                    </td>
                    <td className={td + " text-slate-500"}>{r.ada_parsel ?? "—"}</td>
                    <td className={td}>{TIP_TR[r.proje_tipi] ?? r.proje_tipi}</td>
                    <td className={td + " font-semibold"}>{firmaAd(r.company_id)}</td>
                    <td className={td}>{r.is_adi ?? "—"}</td>
                    <td className={td + " text-slate-500"}>{dt(r.siparis_tarihi)}</td>
                    <td className={td + " text-slate-600"}>{sorumluAd(r.proje_sorumlusu_id)}</td>
                    <td className={td + " text-slate-500"}>{r.durum === "TAMAMLANDI" ? dt(r.tamamlanma_tarihi) : ""}</td>
                    <td className={td + " text-right"}>
                      {readOnly
                        ? <span className="text-xs text-slate-300">—</span>
                        : <Link href={`/proje-takip/${r.id}/duzenle`} className="text-xs font-bold text-brand hover:underline">Güncelle</Link>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-slate-400">Kayıt yok. Sağ üstten “Yeni Proje” ile başlayın.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {durumRow && (
        <DurumModal
          row={durumRow} firmaAd={firmaAd(durumRow.company_id)} sorumluAd={sorumluAd(durumRow.proje_sorumlusu_id)}
          today={today}
          onClose={() => setDurumRow(null)}
          onChanged={() => { setDurumRow(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ============================ Tamamlanma Durumu Modalı ============================ */

function DurumModal({
  row, firmaAd, sorumluAd, today, onClose, onChanged,
}: {
  row: Row; firmaAd: string; sorumluAd: string; today: string;
  onClose: () => void; onChanged: () => void;
}) {
  const [aciklama, setAciklama] = useState(row.bekliyor_aciklama ?? "");
  const [tarih, setTarih] = useState(row.tamamlanma_tarihi ?? today);
  const [teslimTipi, setTeslimTipi] = useState(row.teslim_tipi ?? "");
  const [adet, setAdet] = useState(row.hard_copy_adedi ? String(row.hard_copy_adedi) : "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);
  const [existingDocs, setExistingDocs] = useState<Doc[]>(row.docs.filter((d) => d.kind === "tamamlanan_proje"));
  const router = useRouter();
  const supabase = createClient();

  const completed = row.durum === "TAMAMLANDI";
  const isBekliyor = row.durum === "BEKLIYOR";

  function addStaged(list: FileList | null) {
    let arr = list ? Array.from(list).filter((x): x is File => !!x) : [];
    if (arr.length === 0) return;
    const bad = arr.filter((fl) => !fl.name.toLowerCase().endsWith(".dwg"));
    arr = arr.filter((fl) => fl.name.toLowerCase().endsWith(".dwg"));
    if (bad.length) { setErr("Tamamlanan proje yalnızca DWG dosyası olabilir."); if (arr.length === 0) return; }
    else setErr(null);
    setStaged((s) => [...s, ...arr]);
  }
  function removeStaged(i: number) { setStaged((s) => s.filter((_, idx) => idx !== i)); }
  async function deleteExisting(id: string) {
    const res = await deleteTakipDoc(id);
    if (!res.ok) return setErr(res.error);
    setExistingDocs((d) => d.filter((x) => x.id !== id));
    router.refresh();
  }

  async function saveAciklama() {
    setTouched(true); setErr(null);
    if (!aciklama.trim()) return setErr("Açıklama zorunludur.");
    setBusy(true);
    const res = await saveBekliyorAciklama(row.id, aciklama);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onChanged();
  }

  async function tamamla() {
    setTouched(true); setErr(null);
    if (existingDocs.length + staged.length === 0) return setErr("Önce tamamlanan projeyi ekleyin (Dosya Seç).");
    if (!tarih) return setErr("Tamamlanma tarihi zorunludur.");
    if (!teslimTipi) return setErr("Teslim tipi seçiniz.");
    if (teslimTipi === "hard_copy" && (!adet || Number(adet) < 1)) return setErr("Hard Copy adedi giriniz.");
    setBusy(true);
    // Önce bekleyen dosyaları doğrudan Supabase Storage'a yükle (Vercel 4.5MB sınırına takılmaz)
    for (let i = 0; i < staged.length; i++) {
      setProgress(`Dosyalar yükleniyor… (${i + 1}/${staged.length})`);
      const up = await uploadTakipFile(supabase, row.id, "tamamlanan_proje", staged[i]);
      if (!up.ok) { setBusy(false); setProgress(""); return setErr(`${staged[i].name}: ${up.error}`); }
    }
    setProgress("");
    const res = await completeTakipProje(row.id, {
      tamamlanma_tarihi: tarih, teslim_tipi: teslimTipi as any,
      hard_copy_adedi: teslimTipi === "hard_copy" ? Number(adet) : null,
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onChanged();
  }

  return (
    <Overlay onClose={onClose} title={`Proje #${row.proje_no} — Tamamlanma Durumu`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold">{firmaAd}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">Sorumlu: {sorumluAd}</span>
          {row.durum === "HAZIRLANIYOR"
            ? <span className="ml-auto text-xs font-semibold text-slate-600">{row.durum}</span>
            : <span className={`ml-auto text-[11px] font-bold px-2 py-1 rounded-full ${DURUM_BADGE[row.durum]}`}>{row.durum}</span>}
        </div>

        {/* Standart bilgilerin altında proje detayları (tüm durumlarda) */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
          <Info l="Tahmini Tamamlanma" v={dt(row.tahmini_tamamlanma)} />
          <Info l="Asansör Sayısı" v={row.asansor_sayisi != null ? String(row.asansor_sayisi) : "—"} />
          <Info l="Asansör Tipi" v={row.asansor_tipi ? AST_TR[row.asansor_tipi] ?? row.asansor_tipi : "—"} />
          <Info l="İl / İlçe" v={[row.il_adi, row.ilce_adi].filter(Boolean).join(" / ") || "—"} />
        </div>

        {/* BEKLIYOR: bekleme açıklaması bilgisi (varsa) */}
        {row.durum === "BEKLIYOR" && row.bekliyor_aciklama && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <span className="text-red-700 font-bold text-xs block mb-0.5">Bekleme Açıklaması</span>
            <span className="text-slate-700">{row.bekliyor_aciklama}</span>
          </div>
        )}

        {completed ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 space-y-1">
            <div>✓ Proje tamamlandı. Tamamlanma tarihi: <b>{dt(row.tamamlanma_tarihi)}</b></div>
            <div>Teslim tipi: <b>{row.teslim_tipi === "hard_copy" ? `Hard Copy (${row.hard_copy_adedi} adet)` : "Dijital"}</b></div>
            <div>Muhasebe: <b>{row.muhasebe?.cariye_islendi ? "İşlendi / teslim edildi" : "Muhasebe bekleniyor"}</b></div>
          </div>
        ) : (
          <>
            {/* BEKLIYOR açıklaması */}
            {isBekliyor && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <label className="block text-xs font-bold text-red-700 mb-1">
                  Bu proje tahmini tarihte tamamlanmadı — Açıklama zorunlu *
                </label>
                <textarea rows={2} className={inp + (touched && !aciklama.trim() ? " border-red-400" : "")}
                  value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Gecikme nedeni / durum açıklaması…" />
                <div className="flex justify-end mt-2">
                  <button disabled={busy} onClick={saveAciklama} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-50">
                    Açıklamayı Kaydet
                  </button>
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Projeyi tamamlamak ve muhasebeye göndermek için <b>Güncelle</b> ekranını kullanın (en altta “Tamamla ve Muhasebeye Gönder”).
            </div>
          </>
        )}

        {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
      </div>
    </Overlay>
  );
}

/* ============================ Ortak UI ============================ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return <div><span className="text-slate-400 text-xs">{l}: </span><span className="font-semibold">{v}</span></div>;
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-extrabold text-lg">{title}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
