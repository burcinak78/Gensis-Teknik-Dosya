"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Proje = {
  id: string; dosya_no: string; status: string; bina_adi: string | null;
  beyan_yuku_kg: number | null; kat_adedi: number | null; created_at: string;
  companies: { short_name: string } | null;
};

const STATUS: Record<string, { t: string; bg: string; fg: string }> = {
  draft: { t: "Taslak", bg: "#f1f5f9", fg: "#64748b" },
  generating: { t: "Üretiliyor", bg: "#fef3c7", fg: "#b45309" },
  generated: { t: "Üretildi", bg: "#e0f2f1", fg: "#0f766e" },
  delivered: { t: "Teslim edildi", bg: "#dcfce7", fg: "#15803d" },
  canceled: { t: "İptal", bg: "#fee2e2", fg: "#b91c1c" },
};

type SortKey = "dosya_no" | "bina_adi" | "firma" | "kapasite" | "status" | "created_at";
const coll = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

export default function PanelTable({ projects }: { projects: Proje[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // hangi durumlar listede var (filtre seçenekleri için)
  const statusesInData = useMemo(() => {
    const set = new Set(projects.map((p) => p.status));
    return Object.keys(STATUS).filter((s) => set.has(s));
  }, [projects]);

  function val(p: Proje, key: SortKey): string | number {
    switch (key) {
      case "dosya_no": return p.dosya_no ?? "";
      case "bina_adi": return p.bina_adi ?? "";
      case "firma": return p.companies?.short_name ?? "";
      case "kapasite": return p.beyan_yuku_kg ?? -1;
      case "status": return STATUS[p.status]?.t ?? p.status;
      case "created_at": return p.created_at ?? "";
    }
  }

  const rows = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    let out = projects.filter((p) => {
      const okText =
        !s ||
        p.dosya_no.toLocaleLowerCase("tr").includes(s) ||
        (p.bina_adi ?? "").toLocaleLowerCase("tr").includes(s) ||
        (p.companies?.short_name ?? "").toLocaleLowerCase("tr").includes(s);
      const okStatus = !statusF || p.status === statusF;
      return okText && okStatus;
    });
    out = [...out].sort((a, b) => {
      const av = val(a, sortKey);
      const bv = val(b, sortKey);
      let c: number;
      if (typeof av === "number" && typeof bv === "number") c = av - bv;
      else c = coll.compare(String(av), String(bv));
      return sortDir === "asc" ? c : -c;
    });
    return out;
  }, [q, statusF, sortKey, sortDir, projects]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "created_at" || k === "kapasite" ? "desc" : "asc"); }
  }

  function Th({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) {
    const active = sortKey === k;
    return (
      <th className={`px-5 py-3 select-none ${className}`}>
        <button onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-navy transition-colors ${active ? "text-navy" : ""}`}>
          {children}
          <span className="material-symbols-rounded text-[16px] leading-none"
            style={{ opacity: active ? 1 : 0.25 }}>
            {active ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div className="gs-card rounded-[18px] overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-[#e5e9f0]">
        <div className="relative flex-1">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dosya no, bina veya firma ara…"
            className="w-full pl-11 pr-3 py-2.5 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy" />
        </div>
        <div className="relative">
          <span className="material-symbols-rounded text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none">filter_list</span>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
            className="appearance-none pl-10 pr-8 py-2.5 bg-white border border-[#e5e9f0] rounded-xl text-sm text-slate-600 focus:outline-none focus:border-navy cursor-pointer">
            <option value="">Tüm durumlar</option>
            {statusesInData.map((s) => <option key={s} value={s}>{STATUS[s].t}</option>)}
          </select>
          <span className="material-symbols-rounded text-[18px] absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none">expand_more</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-slate-500">
          {projects.length === 0 ? (
            <>Kayıt yok. <Link href="/yeni" className="text-navy font-semibold">İlk dosyanı oluştur →</Link></>
          ) : (
            <>Filtreyle eşleşen kayıt yok. <button onClick={() => { setQ(""); setStatusF(""); }} className="text-navy font-semibold">Filtreleri temizle</button></>
          )}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wide">
              <Th k="dosya_no">Dosya No</Th>
              <Th k="bina_adi">Bina</Th>
              <Th k="firma">Firma</Th>
              <Th k="kapasite">Kapasite</Th>
              <Th k="status">Durum</Th>
              <Th k="created_at">Tarih</Th>
              <th className="px-5 py-3">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const st = STATUS[p.status] ?? STATUS.draft;
              return (
                <tr key={p.id} onClick={() => router.push(`/panel/${p.id}`)}
                  className="border-t border-[#e5e9f0] hover:bg-[#eef1f8] cursor-pointer">
                  <td className="px-5 py-3 font-bold text-navy">{p.dosya_no}</td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{p.bina_adi ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{p.companies?.short_name ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{p.beyan_yuku_kg ?? "—"} kg · {p.kat_adedi ?? "—"} kat</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.t}</span>
                  </td>
                  <td className="px-5 py-3 text-[#94a3b8]">{new Date(p.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-4">
                      <Link href={`/panel/${p.id}/duzenle`} onClick={(e) => e.stopPropagation()}
                        className="text-slate-600 font-semibold hover:text-navy hover:underline inline-flex items-center gap-1">
                        <span className="material-symbols-rounded text-[16px]">edit</span> Düzenle
                      </Link>
                      <Link href={`/panel/${p.id}`} onClick={(e) => e.stopPropagation()} className="text-navy font-semibold hover:underline">Belgeler →</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
