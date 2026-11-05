"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { TEKNIK_DOSYA_BELGELERI } from "@/lib/pdf/belgeler";

type ChoiceOption = { id: string; fileName: string; isDefault: boolean };
type ChoiceRow = { docType: string; source: "library" | "system" | "modul_g_rapor"; documentId: string | null; fileName: string | null; options: ChoiceOption[] };
export type DocumentChoices = { locked: boolean; rows: ChoiceRow[] };

const NOT = "Buradaki belgeler varsayılan seçimine göre gelmektedir. Belgelerde değişiklik yapmak isterseniz, satırın sonundaki Değiştir butonu ile müşteriye ait belgelere ulaşıp buradakiyle değiştirebilirsiniz.";

function kaynakYazisi(r: ChoiceRow) {
  if (r.source === "modul_g_rapor") return "Modül G raporu yüklü olduğu için rapor kullanılır; kütüphane ve Değiştir geçerli değildir.";
  return r.source === "library" ? `Kütüphane: ${r.fileName}` : "Sistem üretimi";
}

function DegistirModal({ projectId, title, row, onClose }: { projectId: string; title: string; row: ChoiceRow; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(libraryDocumentId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/document-choices/${row.docType}`, { method: "PUT", body: JSON.stringify({ libraryDocumentId }) });
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
      setBusy(false);
    }
  }

  const item = "w-full flex items-center justify-between gap-3 text-left text-sm px-4 py-3 rounded-xl border border-[#e5e9f0] hover:bg-slate-50 disabled:opacity-50";
  return (
    <div role="dialog" aria-label={`${title} değiştir`} className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {row.options.map((o) => {
            const selected = o.id === row.documentId;
            return (
              <button key={o.id} disabled={busy || selected} onClick={() => choose(o.id)} className={item + (selected ? " bg-[#eef1f8]" : "")}>
                <span className="min-w-0 truncate">{o.fileName}</span>
                <span className="flex-none flex items-center gap-1.5 text-xs">
                  {o.isDefault && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Varsayılan</span>}
                  {selected && <span className="font-semibold text-navy">Seçili</span>}
                </span>
              </button>
            );
          })}
          {row.options.length === 0 && <p className="text-sm text-slate-500 px-1 py-2">Bu müşteri ve tip için kayıtlı doküman yok.</p>}
          <button disabled={busy || row.source === "system"} onClick={() => choose(null)} className={item}>
            <span>Sistemin ürettiğine dön</span>
            {row.source === "system" && <span className="text-xs font-semibold text-navy">Seçili</span>}
          </button>
        </div>
        {error && <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{error}</div>}
      </div>
    </div>
  );
}

export default function BelgeListesi({ projectId, choices }: { projectId: string; choices?: DocumentChoices | null }) {
  const [editing, setEditing] = useState<string | null>(null);
  const rowOf = (code: string) => choices?.rows.find((r) => r.docType === code);
  const editingRow = editing ? rowOf(editing) : undefined;
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
      {choices && <p className="text-sm text-slate-600 bg-[#eef1f8] rounded-xl px-4 py-3 mb-4">{NOT}</p>}
      {editingRow && (
        <DegistirModal projectId={projectId} row={editingRow} onClose={() => setEditing(null)}
          title={TEKNIK_DOSYA_BELGELERI.find((b) => b.code === editing)?.title ?? ""} />
      )}
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
            const row = rowOf(b.code);
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
                <span className="flex-1 min-w-0">
                  <span className={"block text-sm " + (b.hazir ? "text-slate-800 font-medium" : "text-slate-400")}>{b.title}</span>
                  {row && <span className="block text-xs text-slate-400 truncate">{kaynakYazisi(row)}</span>}
                </span>
                {b.hazir ? (
                  <span className="flex items-center gap-3 text-sm">
                    <a href={`${base}&belge=${b.code}`} target="_blank" rel="noopener noreferrer" className="text-navy font-semibold hover:underline">Görüntüle</a>
                    <a href={`${base}&belge=${b.code}&dl=1`} className="text-slate-500 font-semibold hover:underline">İndir</a>
                    {row && (
                      <button disabled={choices!.locked || row.source === "modul_g_rapor"} onClick={() => setEditing(b.code)}
                        title={choices!.locked ? "Muhasebe teslim etti; değiştirilemez." : row.source === "modul_g_rapor" ? "Modül G raporu kullanılıyor." : undefined}
                        className="text-navy font-semibold hover:underline disabled:text-slate-300 disabled:no-underline">Değiştir</button>
                    )}
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
