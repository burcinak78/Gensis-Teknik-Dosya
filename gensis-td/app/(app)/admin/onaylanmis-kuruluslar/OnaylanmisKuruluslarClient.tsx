"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import OkFormModal, { OkNB } from "./OkFormModal";
import { deleteNotifiedBody } from "../api";

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const fInp = "w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-brand";
const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
const td = "px-3 py-2 text-sm whitespace-nowrap";
const fTh = "px-3 py-1.5 align-top";
const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");

export default function OnaylanmisKuruluslarClient({ bodies, isAdmin }: { bodies: OkNB[]; isAdmin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fil, setFil] = useState({ kisa: "", unvan: "", no: "", sehir: "", ulke: "" });
  const [modal, setModal] = useState<null | { edit?: OkNB | null }>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const ulkeler = useMemo(
    () => Array.from(new Set(bodies.map((b) => b.country).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "tr")),
    [bodies]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    return bodies
      .filter((b) => {
        if (s) {
          const hay = [b.short_name, b.name, b.identity_no, b.city, b.country].map(tc).join(" ");
          if (!hay.includes(s)) return false;
        }
        if (fil.kisa && !tc(b.short_name).includes(tc(fil.kisa))) return false;
        if (fil.unvan && !tc(b.name).includes(tc(fil.unvan))) return false;
        if (fil.no && !tc(b.identity_no).includes(tc(fil.no))) return false;
        if (fil.sehir && !tc(b.city).includes(tc(fil.sehir))) return false;
        if (fil.ulke && tc(b.country) !== tc(fil.ulke)) return false;
        return true;
      })
      .sort((a, b) => tc(a.short_name || a.name).localeCompare(tc(b.short_name || b.name), "tr"));
  }, [q, fil, bodies]);

  async function sil(b: OkNB) {
    if (!confirm(`"${b.short_name || b.name}" onaylanmış kuruluşu silinsin mi? Sertifika ve belge bağlantıları kaldırılır. Bu işlem geri alınamaz.`)) return;
    setBusyId(b.id);
    const res = await deleteNotifiedBody(b.id);
    setBusyId(null);
    if (!res.ok) { alert(res.error); return; }
    router.refresh();
  }

  return (
    <div>
      <div className="sticky top-[92px] z-10 bg-white/80 backdrop-blur -mx-8 px-8 py-3 border-b border-slate-100 mb-4 flex items-center gap-3">
        <button onClick={() => setModal({ edit: null })} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">+ Yeni OK Ekle</button>
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: kısa ad, ünvan, no, şehir, ülke…" className={inp + " pl-10"} />
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
                <th className={th}>Kısa Ad</th>
                <th className={th}>Ticari Ünvan</th>
                <th className={th}>Kuruluş No</th>
                <th className={th}>Şehir</th>
                <th className={th}>Ülke</th>
                <th className={th}>İşlem</th>
              </tr>
              {showFilters && (
                <tr className="bg-white border-b border-slate-200">
                  <th className={fTh}><input className={fInp} value={fil.kisa} onChange={(e) => setFil((s) => ({ ...s, kisa: e.target.value }))} placeholder="Kısa ad" /></th>
                  <th className={fTh}><input className={fInp} value={fil.unvan} onChange={(e) => setFil((s) => ({ ...s, unvan: e.target.value }))} placeholder="Ünvan" /></th>
                  <th className={fTh}><input className={fInp} value={fil.no} onChange={(e) => setFil((s) => ({ ...s, no: e.target.value }))} placeholder="No" /></th>
                  <th className={fTh}><input className={fInp} value={fil.sehir} onChange={(e) => setFil((s) => ({ ...s, sehir: e.target.value }))} placeholder="Şehir" /></th>
                  <th className={fTh}>
                    <select className={fInp} value={fil.ulke} onChange={(e) => setFil((s) => ({ ...s, ulke: e.target.value }))}>
                      <option value="">Hepsi</option>
                      {ulkeler.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </th>
                  <th className={fTh}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className={td + " font-semibold"}>{b.short_name || "—"}</td>
                  <td className={td + " text-slate-500"}>{b.name || "—"}</td>
                  <td className={td + " text-slate-500"}>{b.identity_no || "—"}</td>
                  <td className={td + " text-slate-500"}>{b.city || "—"}</td>
                  <td className={td + " text-slate-500"}>{b.country || "—"}</td>
                  <td className={td + " text-right"}>
                    <div className="inline-flex items-center gap-3">
                      <button onClick={() => setModal({ edit: b })} className="text-xs font-bold text-brand hover:underline">Düzenle</button>
                      {isAdmin && (
                        <button onClick={() => sil(b)} disabled={busyId === b.id} className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50">
                          {busyId === b.id ? "Siliniyor…" : "Sil"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <OkFormModal
          edit={modal.edit}
          z={50}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
