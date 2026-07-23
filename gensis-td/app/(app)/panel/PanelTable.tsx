"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProject } from "../yeni/actions";

type Proje = {
  id: string; dosya_no: string; status: string; bina_adi: string | null;
  beyan_yuku_kg: number | null; kat_adedi: number | null; created_at: string;
  ada_parsel: string; seri_no: string;
  companies: { short_name: string } | null;
};

const STATUS: Record<string, { t: string; bg: string; fg: string }> = {
  draft: { t: "Taslak", bg: "#f1f5f9", fg: "#64748b" },
  generating: { t: "Üretiliyor", bg: "#fef3c7", fg: "#b45309" },
  generated: { t: "Üretildi", bg: "#e0f2f1", fg: "#0f766e" },
  delivered: { t: "Teslim edildi", bg: "#dcfce7", fg: "#15803d" },
  canceled: { t: "İptal", bg: "#fee2e2", fg: "#b91c1c" },
};

type ColKey = "ada_parsel" | "firma" | "bina_adi" | "seri_no" | "kapasite" | "created_at" | "status";
const coll = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
const emptyF: Record<ColKey, string> = { ada_parsel: "", firma: "", bina_adi: "", seri_no: "", kapasite: "", created_at: "", status: "" };

export default function PanelTable({ projects }: { projects: Proje[] }) {
  const router = useRouter();
  const [colF, setColF] = useState<Record<ColKey, string>>({ ...emptyF });
  const [sortKey, setSortKey] = useState<ColKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const setF = (k: ColKey, v: string) => setColF((s) => ({ ...s, [k]: v }));
  const anyFilter = Object.values(colF).some(Boolean);
  const clearAll = () => setColF({ ...emptyF });
  const [silId, setSilId] = useState<string | null>(null);

  async function sil(p: Proje) {
    if (!confirm(`"${p.dosya_no}" teknik dosyası tamamen silinsin mi? Bu işlem geri alınamaz.`)) return;
    setSilId(p.id);
    const r = await deleteProject(p.id);
    setSilId(null);
    if (r.ok) router.refresh();
    else alert("Silinemedi: " + (r.error ?? ""));
  }

  // Filtre açılır menüleri için listedeki benzersiz değerler
  const firms = useMemo(
    () => Array.from(new Set(projects.map((p) => p.companies?.short_name).filter(Boolean) as string[])).sort((a, b) => coll.compare(a, b)),
    [projects]
  );
  const statusesInData = useMemo(() => {
    const set = new Set(projects.map((p) => p.status));
    return Object.keys(STATUS).filter((s) => set.has(s));
  }, [projects]);

  // Bir projenin bir sütundaki görünen/karşılaştırma değeri
  function disp(p: Proje, key: ColKey): string {
    switch (key) {
      case "ada_parsel": return p.ada_parsel ?? "";
      case "firma": return p.companies?.short_name ?? "";
      case "bina_adi": return p.bina_adi ?? "";
      case "seri_no": return p.seri_no ?? "";
      case "kapasite": return `${p.beyan_yuku_kg ?? ""} kg · ${p.kat_adedi ?? ""} kat`;
      case "status": return STATUS[p.status]?.t ?? p.status;
      case "created_at": return new Date(p.created_at).toLocaleDateString("tr-TR");
    }
  }
  function sortVal(p: Proje, key: ColKey): string | number {
    if (key === "kapasite") return p.beyan_yuku_kg ?? -1;
    if (key === "created_at") return p.created_at ?? "";
    return disp(p, key);
  }

  const rows = useMemo(() => {
    let out = projects.filter((p) => {
      for (const k of Object.keys(colF) as ColKey[]) {
        const fv = colF[k];
        if (!fv) continue;
        if (k === "status") { if (p.status !== fv) return false; }
        else if (k === "firma") { if ((p.companies?.short_name ?? "") !== fv) return false; }
        else if (!disp(p, k).toLocaleLowerCase("tr").includes(fv.toLocaleLowerCase("tr"))) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = sortVal(a, sortKey), bv = sortVal(b, sortKey);
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : coll.compare(String(av), String(bv));
      return sortDir === "asc" ? c : -c;
    });
    return out;
  }, [colF, sortKey, sortDir, projects]);

  function toggleSort(k: ColKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "created_at" || k === "kapasite" ? "desc" : "asc"); }
  }

  function Th({ k, children }: { k: ColKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <th className="px-5 pt-3 pb-2 select-none">
        <button onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-navy transition-colors ${active ? "text-navy" : ""}`}>
          {children}
          <span className="material-symbols-rounded text-[16px] leading-none" style={{ opacity: active ? 1 : 0.25 }}>
            {active ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
          </span>
        </button>
      </th>
    );
  }

  const fInput = "w-full text-xs font-normal normal-case tracking-normal px-2 py-1.5 bg-white border border-[#e5e9f0] rounded-lg focus:outline-none focus:border-navy";
  function TextFilter({ k, ph }: { k: ColKey; ph: string }) {
    return <input value={colF[k]} onChange={(e) => setF(k, e.target.value)} placeholder={ph} className={fInput} />;
  }

  return (
    <div className="gs-card rounded-[18px]">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-[#e5e9f0] sticky top-[86px] z-20 bg-white rounded-t-[18px]">
        <div className="text-sm text-slate-500">
          <b className="text-slate-700">{rows.length}</b> / {projects.length} dosya
          {anyFilter && <span className="ml-2 text-xs text-slate-400">(filtreli)</span>}
        </div>
        {anyFilter && (
          <button onClick={clearAll} className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
            <span className="material-symbols-rounded text-[18px]">filter_alt_off</span> Filtreleri temizle
          </button>
        )}
      </div>

      <div>
        <table className="w-full text-sm">
          <thead className="sticky top-[132px] z-10 bg-white">
            <tr className="text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wide bg-white">
              <Th k="ada_parsel">Ada/Parsel</Th>
              <Th k="firma">Firma Adı</Th>
              <Th k="bina_adi">Bina Adı</Th>
              <Th k="seri_no">As. Seri No</Th>
              <Th k="kapasite">Kapasite</Th>
              <Th k="created_at">Tarih</Th>
              <Th k="status">Durum</Th>
              <th className="px-5 pt-3 pb-2">İşlemler</th>
            </tr>
            <tr className="border-b border-[#e5e9f0] bg-white">
              <td className="px-5 pb-3 align-top"><TextFilter k="ada_parsel" ph="Ada/Parsel…" /></td>
              <td className="px-5 pb-3 align-top">
                <select value={colF.firma} onChange={(e) => setF("firma", e.target.value)} className={fInput + " cursor-pointer"}>
                  <option value="">Tümü</option>
                  {firms.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </td>
              <td className="px-5 pb-3 align-top"><TextFilter k="bina_adi" ph="Bina…" /></td>
              <td className="px-5 pb-3 align-top"><TextFilter k="seri_no" ph="Seri no…" /></td>
              <td className="px-5 pb-3 align-top"><TextFilter k="kapasite" ph="ör. 630" /></td>
              <td className="px-5 pb-3 align-top"><TextFilter k="created_at" ph="ör. 07.2026" /></td>
              <td className="px-5 pb-3 align-top">
                <select value={colF.status} onChange={(e) => setF("status", e.target.value)} className={fInput + " cursor-pointer"}>
                  <option value="">Tümü</option>
                  {statusesInData.map((s) => <option key={s} value={s}>{STATUS[s].t}</option>)}
                </select>
              </td>
              <td className="px-5 pb-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-500">
                  {projects.length === 0 ? (
                    <>Kayıt yok. <Link href="/yeni" className="text-navy font-semibold">İlk dosyanı oluştur →</Link></>
                  ) : (
                    <>Filtreyle eşleşen kayıt yok. <button onClick={clearAll} className="text-navy font-semibold">Filtreleri temizle</button></>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const st = STATUS[p.status] ?? STATUS.draft;
                return (
                  <tr key={p.id} onClick={() => router.push(`/panel/${p.id}`)}
                    className="border-t border-[#e5e9f0] hover:bg-[#eef1f8] cursor-pointer">
                    <td className="px-5 py-3 font-bold text-navy">{p.ada_parsel || "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{p.companies?.short_name ?? "—"}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{p.bina_adi ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{p.seri_no || "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{p.beyan_yuku_kg ?? "—"} kg · {p.kat_adedi ?? "—"} kat</td>
                    <td className="px-5 py-3 text-[#94a3b8]">{new Date(p.created_at).toLocaleDateString("tr-TR")}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.t}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-4">
                        <Link href={`/panel/${p.id}/duzenle`} onClick={(e) => e.stopPropagation()}
                          className="text-slate-600 font-semibold hover:text-navy hover:underline inline-flex items-center gap-1">
                          <span className="material-symbols-rounded text-[16px]">edit</span> Güncelle
                        </Link>
                        <Link href={`/panel/${p.id}`} onClick={(e) => e.stopPropagation()} className="text-navy font-semibold hover:underline">Belgeler</Link>
                        <button onClick={(e) => { e.stopPropagation(); sil(p); }} disabled={silId === p.id}
                          className="text-red-600 font-semibold hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                          <span className="material-symbols-rounded text-[16px]">delete</span> {silId === p.id ? "Siliniyor…" : "Sil"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
