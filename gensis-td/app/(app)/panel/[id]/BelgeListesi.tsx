"use client";

import { useState } from "react";
import { TEKNIK_DOSYA_BELGELERI } from "@/lib/pdf/belgeler";

export default function BelgeListesi({ projectId }: { projectId: string }) {
  const base = `/api/pdf/teknik-dosya?projectId=${projectId}`;
  const hazir = TEKNIK_DOSYA_BELGELERI.filter((b) => b.hazir);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const toggle = (code: string) =>
    setSel((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const allSelected = sel.size === hazir.length && hazir.length > 0;
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(hazir.map((b) => b.code)));
  const selParams = () => hazir.filter((b) => sel.has(b.code)).map((b) => `&belge=${b.code}`).join("");
  const open = (url: string) => window.open(url, "_blank", "noopener");

  return (
    <div>
      {/* Aksiyon butonları */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => open(base)} className="gs-btn text-sm font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[18px]">visibility</span> Tümü — Görüntüle
        </button>
        <button onClick={() => open(base + "&dl=1")} className="text-sm font-bold px-4 py-2.5 rounded-xl border border-[#e5e9f0] bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[18px]">download</span> Tümü — İndir
        </button>
        <span className="mx-1 text-slate-300">|</span>
        <button disabled={sel.size === 0} onClick={() => open(base + selParams())}
          className="text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-40 flex items-center gap-1.5"
          style={{ background: "#1e2a5b" }}>
          <span className="material-symbols-rounded text-[18px]">merge</span> Seçilenleri Birleştir ({sel.size})
        </button>
        <button disabled={sel.size === 0} onClick={() => open(base + selParams() + "&dl=1")}
          className="text-sm font-bold px-4 py-2.5 rounded-xl border border-[#e5e9f0] bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          İndir
        </button>
      </div>

      <div className="gs-card rounded-[18px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e9f0]">
          <span className="text-[12px] font-bold text-[#64748b] uppercase tracking-wide">Belgeler · {hazir.length} kalem</span>
          <button onClick={toggleAll} className="text-xs font-semibold text-navy hover:underline">
            {allSelected ? "Seçimi temizle" : "Tümünü seç"}
          </button>
        </div>
        <ul>
          {TEKNIK_DOSYA_BELGELERI.map((b, i) => {
            const checked = sel.has(b.code);
            return (
              <li key={b.code}
                className={`flex items-center gap-3 px-5 py-3 border-b border-[#eef1f7] last:border-0 ${checked ? "bg-[#eef1f8]" : ""}`}>
                <button onClick={() => b.hazir && toggle(b.code)} disabled={!b.hazir} className="flex-none">
                  <span className="material-symbols-rounded text-[22px]"
                    style={{ color: !b.hazir ? "#cbd5e1" : checked ? "#1e2a5b" : "#94a3b8" }}>
                    {!b.hazir ? "disabled_by_default" : checked ? "check_box" : "check_box_outline_blank"}
                  </span>
                </button>
                <span className="w-6 text-[#94a3b8] text-sm">{i + 1}</span>
                <span className="material-symbols-rounded text-[20px] text-[#94a3b8]">description</span>
                <span className={"flex-1 text-sm " + (b.hazir ? "text-slate-800 font-medium" : "text-slate-400")}>{b.title}</span>
                {b.hazir ? (
                  <span className="flex items-center gap-3 text-sm">
                    <a href={`${base}&belge=${b.code}`} target="_blank" rel="noopener noreferrer" className="text-navy font-semibold hover:underline">Görüntüle</a>
                    <a href={`${base}&belge=${b.code}&dl=1`} className="text-slate-500 font-semibold hover:underline">İndir</a>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">yakında</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Bir veya birden fazla belgeyi işaretleyip “Seçilenleri Birleştir” ile tek PDF olarak alabilirsiniz.
      </p>
    </div>
  );
}
