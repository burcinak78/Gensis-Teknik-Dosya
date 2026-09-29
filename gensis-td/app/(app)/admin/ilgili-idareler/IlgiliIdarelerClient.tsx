"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createIlgiliIdare, updateIlgiliIdare, deleteIlgiliIdare } from "../actions";

type Idare = { id: string; name: string; address: string | null };

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
const td = "px-3 py-2 text-sm";

export default function IlgiliIdarelerClient({ rows }: { rows: Idare[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { row?: Idare }>(null);
  const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return rows;
    return rows.filter((r) => [r.name, r.address].map(tc).join(" ").includes(s));
  }, [q, rows]);

  return (
    <div>
      <div className="sticky top-[92px] z-10 bg-white/80 backdrop-blur -mx-8 px-8 py-3 border-b border-slate-100 mb-4 flex items-center gap-3">
        <button onClick={() => setModal({})} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">+ Yeni İlgili İdare</button>
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: idare adı, adres…" className={inp + " pl-10"} />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} / {rows.length}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl">
        <div className="overflow-auto max-h-[calc(100vh-220px)] rounded-2xl">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
              <tr><th className={th}>Adı</th><th className={th}>Adres</th><th className={th}>İşlem</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className={td + " font-semibold"}>{r.name}</td>
                  <td className={td + " text-slate-500"}>{r.address || "—"}</td>
                  <td className={td + " text-right whitespace-nowrap"}>
                    <button onClick={() => setModal({ row: r })} className="text-xs font-bold text-brand hover:underline">Düzenle</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-400">Kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <IdareModal row={modal.row} onClose={() => setModal(null)} onSaved={() => { setModal(null); router.refresh(); }} />}
    </div>
  );
}

function IdareModal({ row, onClose, onSaved }: { row?: Idare; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!row;
  const [name, setName] = useState(row?.name ?? "");
  const [address, setAddress] = useState(row?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!name.trim()) return setErr("İlgili idare adı zorunlu.");
    setBusy(true);
    const res = isEdit
      ? await updateIlgiliIdare(row!.id, { name, address })
      : await createIlgiliIdare({ name, address });
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-extrabold text-lg">{isEdit ? "İlgili İdare Düzenle" : "Yeni İlgili İdare"}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Adı *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="Örn. Nilüfer Belediyesi" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Adres (opsiyonel)</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inp} />
          </div>
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
