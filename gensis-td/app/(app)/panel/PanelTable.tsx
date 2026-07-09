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

export default function PanelTable({ projects }: { projects: Proje[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const s = q.trim().toLocaleLowerCase("tr");
  const rows = useMemo(() => {
    if (!s) return projects;
    return projects.filter(
      (p) =>
        p.dosya_no.toLocaleLowerCase("tr").includes(s) ||
        (p.bina_adi ?? "").toLocaleLowerCase("tr").includes(s) ||
        (p.companies?.short_name ?? "").toLocaleLowerCase("tr").includes(s)
    );
  }, [s, projects]);

  return (
    <div className="gs-card rounded-[18px] overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-[#e5e9f0]">
        <div className="relative flex-1">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dosya no, bina veya firma ara…"
            className="w-full pl-11 pr-3 py-2.5 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy" />
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 border border-[#e5e9f0] rounded-xl px-3 py-2.5">
          <span className="material-symbols-rounded text-[18px]">filter_list</span> Durum
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-slate-500">
          Kayıt yok. <Link href="/yeni" className="text-navy font-semibold">İlk dosyanı oluştur →</Link>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wide">
              <th className="px-5 py-3">Dosya No</th>
              <th className="px-5 py-3">Bina</th>
              <th className="px-5 py-3">Firma</th>
              <th className="px-5 py-3">Kapasite</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">Tarih</th>
              <th className="px-5 py-3">Belge</th>
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
                    <Link href={`/panel/${p.id}`} onClick={(e) => e.stopPropagation()} className="text-navy font-semibold hover:underline">Belgeler →</Link>
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
