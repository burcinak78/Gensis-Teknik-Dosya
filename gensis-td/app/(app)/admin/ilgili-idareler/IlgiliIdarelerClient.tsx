"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createIlgiliIdare, updateIlgiliIdare, deleteIlgiliIdare } from "../actions";

type Prov = { id: number; name: string };
type Idare = { id: string; name: string; address: string | null; province_id: number | null; suffix: string | null };

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");

const SUFFIX_WORD: Record<string, string> = { belediye: "Belediyesi", baskanlik: "Başkanlığı" };
const composeName = (base: string, suffix: string) => `${base.trim()} ${SUFFIX_WORD[suffix] ?? "Belediyesi"}`.trim();
function splitName(name: string, suffix: string | null) {
  const w = SUFFIX_WORD[suffix ?? "belediye"];
  let base = name;
  for (const word of ["Belediyesi", "Başkanlığı"]) {
    if (base.toLocaleLowerCase("tr").endsWith(word.toLocaleLowerCase("tr"))) { base = base.slice(0, base.length - word.length).trim(); break; }
  }
  return base;
}

export default function IlgiliIdarelerClient({ rows, provinces }: { rows: Idare[]; provinces: Prov[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | { row?: Idare }>(null);

  const provName = useMemo(() => new Map(provinces.map((p) => [p.id, p.name])), [provinces]);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return rows;
    return rows.filter((r) => [r.name, provName.get(r.province_id ?? -1)].map(tc).join(" ").includes(s));
  }, [q, rows, provName]);

  // Şehir bazlı grupla
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; sehir: string; items: Idare[] }>();
    for (const r of filtered) {
      const key = r.province_id != null ? String(r.province_id) : "yok";
      const sehir = r.province_id != null ? (provName.get(r.province_id) ?? "Bilinmeyen İl") : "Şehir atanmamış";
      if (!m.has(key)) m.set(key, { key, sehir, items: [] });
      m.get(key)!.items.push(r);
    }
    const arr = Array.from(m.values());
    arr.forEach((g) => g.items.sort((a, b) => a.name.localeCompare(b.name, "tr")));
    arr.sort((a, b) => (a.key === "yok" ? 1 : b.key === "yok" ? -1 : a.sehir.localeCompare(b.sehir, "tr")));
    return arr;
  }, [filtered, provName]);

  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div>
      <div className="sticky top-[92px] z-10 bg-white/80 backdrop-blur -mx-8 px-8 py-3 border-b border-slate-100 mb-4 flex items-center gap-3">
        <button onClick={() => setModal({})} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">+ Yeni İlgili İdare</button>
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: şehir veya idare adı…" className={inp + " pl-10"} />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} idare · {groups.length} şehir</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {groups.map((g) => {
          const isOpen = open.has(g.key) || !!q.trim();
          return (
            <div key={g.key} className="border-b border-slate-100 last:border-0">
              <button type="button" onClick={() => toggle(g.key)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <span className="font-semibold text-sm inline-flex items-center gap-2">
                  <span className="material-symbols-rounded text-[18px] text-brand">location_city</span>{g.sehir}
                </span>
                <span className="text-xs text-slate-400">{g.items.length} idare {isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="pb-2">
                  {g.items.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-6 py-1.5 border-l-2 border-slate-100 ml-2">
                      <span className="text-sm">{r.name}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setModal({ row: r })} className="text-xs font-bold text-brand hover:underline">Düzenle</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-400">Kayıt yok.</div>}
      </div>

      {modal && <IdareModal row={modal.row} provinces={provinces} onClose={() => setModal(null)} onSaved={() => { setModal(null); router.refresh(); }} />}
    </div>
  );
}

function IdareModal({ row, provinces, onClose, onSaved }: { row?: Idare; provinces: Prov[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!row;
  const [provinceId, setProvinceId] = useState<number | "">(row?.province_id ?? "");
  const [base, setBase] = useState(row ? splitName(row.name, row.suffix) : "");
  const [suffix, setSuffix] = useState(row?.suffix ?? "belediye");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onizleme = base.trim() ? composeName(base, suffix) : "—";

  async function submit() {
    setErr(null);
    if (provinceId === "") return setErr("Şehir seçiniz.");
    if (!base.trim()) return setErr("İlçe / idare adı zorunlu.");
    setBusy(true);
    const payload = { name: composeName(base, suffix), province_id: Number(provinceId), suffix };
    const res = isEdit ? await updateIlgiliIdare(row!.id, payload) : await createIlgiliIdare(payload);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onSaved();
  }
  async function sil() {
    if (!row) return;
    if (!confirm(`"${row.name}" silinsin mi?`)) return;
    setBusy(true); setErr(null);
    const res = await deleteIlgiliIdare(row.id);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-lg">{isEdit ? "İlgili İdare Düzenle" : "Yeni İlgili İdare"}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Şehir *</label>
            <select className={inp} value={provinceId} onChange={(e) => setProvinceId(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">Seçiniz…</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">İlçe / İdare Adı *</label>
              <input className={inp} value={base} onChange={(e) => setBase(e.target.value)} placeholder="Örn. Nilüfer" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Son Ek *</label>
              <select className={inp} value={suffix} onChange={(e) => setSuffix(e.target.value)}>
                <option value="belediye">BELEDİYESİ</option>
                <option value="baskanlik">BAŞKANLIĞI</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-500">Kayıt adı: <span className="font-semibold text-slate-700">{onizleme}</span></div>
          {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            {isEdit && (
              <button type="button" onClick={sil} disabled={busy} className="mr-auto text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">Sil</button>
            )}
            <button onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
            <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
              {busy ? "Kaydediliyor…" : isEdit ? "Kaydet" : "Ekle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
