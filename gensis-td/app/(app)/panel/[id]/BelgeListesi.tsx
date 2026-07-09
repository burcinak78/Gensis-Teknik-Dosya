"use client";

import { useState } from "react";
import { TEKNIK_DOSYA_BELGELERI } from "@/lib/pdf/belgeler";

export default function BelgeListesi({ projectId }: { projectId: string }) {
  const base = `/api/pdf/teknik-dosya?projectId=${projectId}`;
  const hazir = TEKNIK_DOSYA_BELGELERI.filter((b) => b.hazir);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const toggle = (code: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  const allSelected = sel.size === hazir.length && hazir.length > 0;
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(hazir.map((b) => b.code)));

  const selParams = () =>
    hazir.filter((b) => sel.has(b.code)).map((b) => `&belge=${b.code}`).join("");
  const open = (url: string) => window.open(url, "_blank", "noopener");

  return (
    <div>
      {/* Üst aksiyonlar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => open(base)} className="bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2.5 rounded-lg">
          Tümü — Görüntüle
        </button>
        <button onClick={() => open(base + "&dl=1")} className="border border-slate-300 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-slate-50">
          Tümü — İndir
        </button>
        <span className="mx-1 text-slate-300">|</span>
        <button
          disabled={sel.size === 0}
          onClick={() => open(base + selParams())}
          className="bg-navy hover:bg-navy-dark text-white text-sm font-bold px-4 py-2.5 rounded-lg disabled:opacity-40"
        >
          Seçilenleri Birleştir — Görüntüle ({sel.size})
        </button>
        <button
          disabled={sel.size === 0}
          onClick={() => open(base + selParams() + "&dl=1")}
          className="border border-slate-300 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          İndir
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Belgeler</span>
          <button onClick={toggleAll} className="text-xs font-semibold text-brand hover:underline">
            {allSelected ? "Seçimi temizle" : "Tümünü seç"}
          </button>
        </div>
        <ul>
          {TEKNIK_DOSYA_BELGELERI.map((b, i) => (
            <li key={b.code} className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#0d8b8b]"
                disabled={!b.hazir}
                checked={sel.has(b.code)}
                onChange={() => toggle(b.code)}
              />
              <span className="w-6 text-slate-400 text-sm">{i + 1}</span>
              <span className={"flex-1 " + (b.hazir ? "text-slate-800" : "text-slate-400")}>{b.title}</span>
              {b.hazir ? (
                <span className="flex items-center gap-3">
                  <a href={`${base}&belge=${b.code}`} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold text-sm hover:underline">
                    Görüntüle
                  </a>
                  <a href={`${base}&belge=${b.code}&dl=1`} className="text-slate-600 font-semibold text-sm hover:underline">
                    İndir
                  </a>
                </span>
              ) : (
                <span className="text-xs text-slate-400">yakında</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Bir veya birden fazla belgeyi işaretleyip “Seçilenleri Birleştir” ile tek PDF olarak alabilirsiniz.
      </p>
    </div>
  );
}
