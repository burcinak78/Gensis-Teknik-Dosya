"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Row = {
  id: string; dosya_no: string | null; status: string; yapi_sahibi: string | null;
  beyan_yuku_kg: number | null; durak_sayisi: number | null; dilekce_tarihi: string | null;
  created_at: string; input_data: any; companies: { short_name: string } | null;
};

export default function ProjeOnayTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return rows;
    return rows.filter((r) =>
      (r.yapi_sahibi ?? "").toLocaleLowerCase("tr").includes(s) ||
      (r.companies?.short_name ?? "").toLocaleLowerCase("tr").includes(s) ||
      (r.input_data?.belediye ?? "").toLocaleLowerCase("tr").includes(s) ||
      (r.dosya_no ?? "").toLocaleLowerCase("tr").includes(s)
    );
  }, [q, rows]);

  return (
    <div className="gs-card rounded-[18px] overflow-hidden">
      <div className="p-3 border-b border-[#e5e9f0]">
        <div className="relative">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Yapı sahibi, firma veya belediye ara…"
            className="w-full pl-11 pr-3 py-2.5 bg-white border border-[#e5e9f0] rounded-xl text-sm focus:outline-none focus:border-navy" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-500">
          {rows.length === 0 ? (
            <>Kayıt yok. <Link href="/proje-onay/yeni" className="text-navy font-semibold">İlk dosyanı oluştur →</Link></>
          ) : "Sonuç yok."}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wide">
              <th className="px-5 py-3">Yapı Sahibi</th>
              <th className="px-5 py-3">Firma</th>
              <th className="px-5 py-3">Belediye / İl</th>
              <th className="px-5 py-3">Kapasite</th>
              <th className="px-5 py-3">Tarih</th>
              <th className="px-5 py-3">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => router.push(`/proje-onay/${r.id}`)}
                className="border-t border-[#e5e9f0] hover:bg-[#eef1f8] cursor-pointer">
                <td className="px-5 py-3 font-bold text-navy">{r.yapi_sahibi ?? r.dosya_no ?? "—"}</td>
                <td className="px-5 py-3 text-slate-500">{r.companies?.short_name ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">{[r.input_data?.belediye, r.input_data?.il].filter(Boolean).join(" / ") || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{r.beyan_yuku_kg ?? "—"} kg · {r.durak_sayisi ?? "—"} durak</td>
                <td className="px-5 py-3 text-[#94a3b8]">{r.dilekce_tarihi ? new Date(r.dilekce_tarihi).toLocaleDateString("tr-TR") : new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-4">
                    <Link href={`/proje-onay/${r.id}/duzenle`} onClick={(e) => e.stopPropagation()}
                      className="text-slate-600 font-semibold hover:text-navy hover:underline inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-[16px]">edit</span> Düzenle
                    </Link>
                    <Link href={`/proje-onay/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-navy font-semibold hover:underline">Belgeler →</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
