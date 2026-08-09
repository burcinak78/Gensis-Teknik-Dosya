"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMuhasebe, type MuhasebePayload } from "./actions";

type Company = { id: string; short_name: string };
type Sorumlu = { id: string; full_name: string | null };
type Muh = {
  cariye_islendi: boolean; fatura_tarihi: string | null; fatura_no: string | null;
  teslim_yontemi: string | null; kargo_sirketi: string | null; kargo_takip_no: string | null; teslim_tarihi: string | null;
};
type Row = {
  id: string; proje_no: number; proje_tipi: string; company_id: string | null;
  ada_parsel: string | null; is_adi: string | null; il_adi: string | null; ilce_adi: string | null;
  fiyat: number | null; fatura_tipi: string | null; toplam_tutar: number | null;
  proje_sorumlusu_id: string | null; durum: string; tamamlanma_tarihi: string | null;
  teslim_tipi: string | null; hard_copy_adedi: number | null;
  muhasebeye_gonderildi: boolean; muhasebe_durumu: string | null; muhasebe: Muh | null;
};

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("tr-TR") : "—");
const TIP_TR: Record<string, string> = { mimari: "Mimari", uygulama: "Uygulama" };

export default function MuhasebeClient({
  rows, companies, sorumlular,
}: { rows: Row[]; companies: Company[]; sorumlular: Sorumlu[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ durum: "", projeNo: "", tip: "", firma: "", adaParsel: "", isAdi: "", fatura: "", teslim: "" });
  const [modalRow, setModalRow] = useState<Row | null>(null);
  const setFilter = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const firmaAd = (id: string | null) => companies.find((c) => c.id === id)?.short_name ?? "—";
  const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");

  // muhasebe durum kategorisi
  const muhCat = (r: Row) => r.muhasebe?.cariye_islendi ? "tamamlandi" : (r.muhasebeye_gonderildi ? "bekliyor" : "diger");

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    return rows.filter((r) => {
      if (s) {
        const hay = [String(r.proje_no), firmaAd(r.company_id), r.ada_parsel, r.is_adi].map(tc).join(" ");
        if (!hay.includes(s)) return false;
      }
      if (f.durum && muhCat(r) !== f.durum) return false;
      if (f.projeNo && !String(r.proje_no).includes(f.projeNo.trim())) return false;
      if (f.tip && r.proje_tipi !== f.tip) return false;
      if (f.firma && r.company_id !== f.firma) return false;
      if (f.adaParsel && !tc(r.ada_parsel).includes(tc(f.adaParsel))) return false;
      if (f.isAdi && !tc(r.is_adi).includes(tc(f.isAdi))) return false;
      if (f.fatura && r.fatura_tipi !== f.fatura) return false;
      if (f.teslim && r.teslim_tipi !== f.teslim) return false;
      return true;
    });
  }, [q, f, rows]);

  const bekleyen = rows.filter((r) => r.muhasebeye_gonderildi && r.muhasebe_durumu !== "tamamlandi").length;

  function rowClass(r: Row) {
    if (r.muhasebe?.cariye_islendi) return "bg-green-50";
    if (r.muhasebeye_gonderildi && r.muhasebe_durumu !== "tamamlandi") return "bg-amber-50";
    return "";
  }

  function teslimText(r: Row) {
    if (r.teslim_tipi === "dijital") return "Dijital";
    if (r.teslim_tipi === "hard_copy") {
      const y = r.muhasebe?.teslim_yontemi === "elden" ? " · Elden" : r.muhasebe?.teslim_yontemi === "kargo" ? " · Kargo" : "";
      return `Hard Copy (${r.hard_copy_adedi ?? "?"})${y}`;
    }
    return "—";
  }

  const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
  const td = "px-3 py-2 text-sm whitespace-nowrap";
  const fInp = "w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-brand";
  const fTh = "px-3 py-1.5 align-top";
  const TIP_KISA: Record<string, string> = { mimari: "M", uygulama: "U" };

  return (
    <div>
      <div className="bg-white/80 backdrop-blur border-b border-[#e5e9f0] px-8 pt-5 pb-4 sticky top-0 z-20">
        <h1 className="text-[22px] font-extrabold tracking-tight">Muhasebe</h1>
        <p className="text-sm text-slate-500">
          Proje takip listesi — muhasebeye gönderilen{bekleyen > 0 ? <b className="text-amber-600"> {bekleyen} yeni işlem</b> : " işlem yok"} bekliyor.
        </p>
      </div>

      <div className="p-8 gs-fade">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: proje no, firma, ada/parsel, işin adı…" className={inp + " pl-10"} />
          </div>
          <button onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border ${showFilters ? "bg-brand-light text-brand border-brand/30" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            <span className="material-symbols-rounded text-[18px]">filter_list</span> Filtrele
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Durum</th>
                  <th className={th}>Proje No</th>
                  <th className={th}>Tip</th>
                  <th className={th}>Firma</th>
                  <th className={th}>Ada/Parsel</th>
                  <th className={th}>İşin Adı</th>
                  <th className={th}>Toplam Tutar</th>
                  <th className={th}>Fatura</th>
                  <th className={th}>Teslim Tipi</th>
                  <th className={th}>Teslim Tarihi</th>
                </tr>
                {showFilters && (
                  <tr className="bg-white border-b border-slate-200">
                    <th className={fTh}>
                      <select className={fInp} value={f.durum} onChange={(e) => setFilter("durum", e.target.value)}>
                        <option value="">Hepsi</option><option value="bekliyor">İşlem bekliyor</option><option value="tamamlandi">Teslim edildi</option><option value="diger">Gönderilmedi</option>
                      </select>
                    </th>
                    <th className={fTh}><input className={fInp} value={f.projeNo} onChange={(e) => setFilter("projeNo", e.target.value)} placeholder="No" /></th>
                    <th className={fTh}>
                      <select className={fInp} value={f.tip} onChange={(e) => setFilter("tip", e.target.value)}>
                        <option value="">Hepsi</option><option value="mimari">M</option><option value="uygulama">U</option>
                      </select>
                    </th>
                    <th className={fTh}>
                      <select className={fInp} value={f.firma} onChange={(e) => setFilter("firma", e.target.value)}>
                        <option value="">Hepsi</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                      </select>
                    </th>
                    <th className={fTh}><input className={fInp} value={f.adaParsel} onChange={(e) => setFilter("adaParsel", e.target.value)} placeholder="Ada/Parsel" /></th>
                    <th className={fTh}><input className={fInp} value={f.isAdi} onChange={(e) => setFilter("isAdi", e.target.value)} placeholder="İşin adı" /></th>
                    <th className={fTh}></th>
                    <th className={fTh}>
                      <select className={fInp} value={f.fatura} onChange={(e) => setFilter("fatura", e.target.value)}>
                        <option value="">Hepsi</option><option value="faturali">Faturalı</option><option value="faturasiz">Faturasız</option>
                      </select>
                    </th>
                    <th className={fTh}>
                      <select className={fInp} value={f.teslim} onChange={(e) => setFilter("teslim", e.target.value)}>
                        <option value="">Hepsi</option><option value="hard_copy">Hard Copy</option><option value="dijital">Dijital</option>
                      </select>
                    </th>
                    <th className={fTh}></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const sent = r.muhasebeye_gonderildi;
                  const done = r.muhasebe?.cariye_islendi;
                  return (
                    <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${rowClass(r)}`}>
                      <td className={td}>
                        {done
                          ? <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">Teslim edildi</span>
                          : sent
                            ? <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">İşlem bekliyor</span>
                            : <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500">{r.durum}</span>}
                      </td>
                      <td className={td + " font-bold text-navy"}>
                        {sent && !done && <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle" title="Yeni" />}
                        {sent
                          ? <button onClick={() => setModalRow(r)} title="Muhasebe işlemleri" className="text-navy hover:underline">{r.proje_no}</button>
                          : <span>{r.proje_no}</span>}
                      </td>
                      <td className={td + " font-semibold text-center"}>{TIP_KISA[r.proje_tipi] ?? "—"}</td>
                      <td className={td + " font-semibold"}>{firmaAd(r.company_id)}</td>
                      <td className={td + " text-slate-500"}>{r.ada_parsel ?? "—"}</td>
                      <td className={td}>{r.is_adi ?? "—"}</td>
                      <td className={td + " font-semibold"}>{money(r.toplam_tutar)}</td>
                      <td className={td}>{r.fatura_tipi === "faturali" ? "Faturalı" : r.fatura_tipi === "faturasiz" ? "Faturasız" : "—"}</td>
                      <td className={td}>{teslimText(r)}</td>
                      <td className={td + " text-slate-500"}>{dt(r.muhasebe?.teslim_tarihi)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-slate-400">Kayıt yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalRow && (
        <MuhModal
          row={modalRow} firmaAd={firmaAd(modalRow.company_id)}
          onClose={() => setModalRow(null)}
          onSaved={() => { setModalRow(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function MuhModal({ row, firmaAd, onClose, onSaved }: { row: Row; firmaAd: string; onClose: () => void; onSaved: () => void }) {
  const m = row.muhasebe;
  const faturali = row.fatura_tipi === "faturali";
  const hardCopy = row.teslim_tipi === "hard_copy";
  const bugun = new Date().toISOString().slice(0, 10);

  const [faturaTarihi, setFaturaTarihi] = useState(m?.fatura_tarihi ?? "");
  const [faturaNo, setFaturaNo] = useState(m?.fatura_no ?? "");
  const [cariye, setCariye] = useState(m?.cariye_islendi ?? false);
  const [yontem, setYontem] = useState(m?.teslim_yontemi ?? "");
  const [kargoSirket, setKargoSirket] = useState(m?.kargo_sirketi ?? "");
  const [kargoNo, setKargoNo] = useState(m?.kargo_takip_no ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const readonly = !!m?.cariye_islendi;
  const teslimTarihi = m?.teslim_tarihi ?? bugun;

  const req = (bad: boolean) => (touched && bad ? " border-red-400 bg-red-50" : "");

  async function submit() {
    setTouched(true); setErr(null);
    if (faturali && !faturaTarihi) return setErr("Fatura tarihi zorunludur.");
    if (faturali && !faturaNo.trim()) return setErr("Fatura no zorunludur.");
    if (!cariye) return setErr("Cariye işleme (Tamamlandı) zorunludur.");
    if (hardCopy && !yontem) return setErr("Elden / Kargo seçiniz.");
    if (hardCopy && yontem === "kargo" && !kargoSirket.trim()) return setErr("Kargo şirketi zorunludur.");
    if (hardCopy && yontem === "kargo" && !kargoNo.trim()) return setErr("Kargo takip no zorunludur.");
    setBusy(true);
    const payload: MuhasebePayload = {
      takip_id: row.id,
      fatura_tarihi: faturali ? (faturaTarihi || null) : null,
      fatura_no: faturali ? (faturaNo.trim() || null) : null,
      cariye_islendi: cariye,
      teslim_yontemi: hardCopy ? (yontem as any) : null,
      kargo_sirketi: hardCopy && yontem === "kargo" ? kargoSirket.trim() : null,
      kargo_takip_no: hardCopy && yontem === "kargo" ? kargoNo.trim() : null,
    };
    const res = await saveMuhasebe(payload);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-lg">Muhasebe İşlemleri — Proje #{row.proje_no}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Otomatik gelen bilgiler */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
            <Info l="Firma" v={firmaAd} />
            <Info l="Proje No" v={String(row.proje_no)} />
            <Info l="Ada / Parsel" v={row.ada_parsel ?? "—"} />
            <Info l="Fiyat" v={money(row.fiyat)} />
            <Info l="Fatura" v={faturali ? "Faturalı" : "Faturasız"} />
            <Info l="Toplam" v={money(row.toplam_tutar)} />
            <Info l="Teslim Tipi" v={hardCopy ? `Hard Copy (${row.hard_copy_adedi ?? "?"} adet)` : "Dijital"} />
          </div>

          {readonly && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              ✓ Bu proje teslim edildi ({dt(teslimTarihi)}). Kayıt görüntüleniyor.
            </div>
          )}

          {/* Girilecek alanlar */}
          {faturali && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fatura Tarihi *">
                <input type="date" disabled={readonly} className={inp + req(!faturaTarihi)} value={faturaTarihi} onChange={(e) => setFaturaTarihi(e.target.value)} />
              </Field>
              <Field label="Fatura No *">
                <input disabled={readonly} className={inp + req(!faturaNo.trim())} value={faturaNo} onChange={(e) => setFaturaNo(e.target.value)} />
              </Field>
            </div>
          )}

          <label className={`flex items-center gap-2 text-sm font-semibold cursor-pointer px-3 py-2 rounded-lg border ${touched && !cariye ? "border-red-400 bg-red-50" : "border-slate-200"}`}>
            <input type="checkbox" disabled={readonly} checked={cariye} onChange={(e) => setCariye(e.target.checked)} className="w-4 h-4 accent-brand" />
            Cariye İşleme — Tamamlandı *
          </label>

          {hardCopy ? (
            <div className="border border-slate-200 rounded-lg p-3 space-y-3">
              <Field label="Teslim Şekli *">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="yontem" disabled={readonly} checked={yontem === "elden"} onChange={() => setYontem("elden")} className="accent-brand" /> Elden
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="yontem" disabled={readonly} checked={yontem === "kargo"} onChange={() => setYontem("kargo")} className="accent-brand" /> Kargo
                  </label>
                </div>
                {touched && !yontem && <p className="text-[11px] text-red-500 mt-1">Elden veya Kargo seçiniz.</p>}
              </Field>
              {yontem === "kargo" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kargo Şirketi *">
                    <input disabled={readonly} className={inp + req(!kargoSirket.trim())} value={kargoSirket} onChange={(e) => setKargoSirket(e.target.value)} />
                  </Field>
                  <Field label="Kargo Takip No *">
                    <input disabled={readonly} className={inp + req(!kargoNo.trim())} value={kargoNo} onChange={(e) => setKargoNo(e.target.value)} />
                  </Field>
                </div>
              )}
              <Field label="Teslim Tarihi (otomatik)">
                <input disabled className={inp + " bg-slate-50 text-slate-500"} value={dt(teslimTarihi)} />
              </Field>
            </div>
          ) : (
            <Field label="Teslim Tarihi (otomatik)">
              <input disabled className={inp + " bg-slate-50 text-slate-500"} value={dt(teslimTarihi)} />
            </Field>
          )}

          {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}

          {!readonly && (
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
              <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return <div><span className="text-slate-400 text-xs">{l}: </span><span className="font-semibold">{v}</span></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>;
}
