"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createNote, snoozeNote, deleteNote, updateNote } from "./api";
import { TR_DATE } from "@/lib/trDate";

type Not = { id: string; icerik: string; sayac_baslangic: string; created_at: string };

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const th = "px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
const td = "px-4 py-3 text-sm align-top";
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("tr-TR", TR_DATE) : "—");
const bugunStr = new Date().toLocaleDateString("tr-TR", TR_DATE);

// 3 gün ve üzeri bekleyen not kırmızıya düşer (API'deki NoteOverdueDays ile aynı; menüdeki zil de bunu sayar)
function gecikti(sayacBaslangic: string): boolean {
  const start = new Date(sayacBaslangic).getTime();
  const gun = (Date.now() - start) / (1000 * 60 * 60 * 24);
  return gun >= 3;
}

export default function NotlarClient({ notlar }: { notlar: Not[] }) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [icerik, setIcerik] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Satır içi düzenleme (z8qgvccdud): Düzenle → metin kutusu → Kaydet / İptal
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...notlar].sort((a, b) => {
      const ga = gecikti(a.sayac_baslangic) ? 1 : 0;
      const gb = gecikti(b.sayac_baslangic) ? 1 : 0;
      if (ga !== gb) return gb - ga; // geciken üstte
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
    [notlar]
  );

  async function kaydet() {
    if (!icerik.trim()) { setErr("Not boş olamaz."); return; }
    setBusy(true); setErr(null);
    const res = await createNote(icerik);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setIcerik(""); setModal(false); router.refresh();
  }
  async function ertele(id: string) {
    setBusyId(id);
    const res = await snoozeNote(id);
    setBusyId(null);
    if (!res.ok) { alert(res.error); return; }
    router.refresh();
  }
  function duzenle(n: Not) { setEditId(n.id); setDraft(n.icerik); setEditErr(null); }
  async function guncelle(id: string) {
    if (!draft.trim()) { setEditErr("Not boş olamaz."); return; }
    setBusyId(id); setEditErr(null);
    const res = await updateNote(id, draft);
    setBusyId(null);
    if (!res.ok) { setEditErr(res.error); return; }
    setEditId(null); router.refresh();
  }
  async function sil(id: string) {
    if (!confirm("Bu not silinsin mi?")) return;
    setBusyId(id);
    const res = await deleteNote(id);
    setBusyId(null);
    if (!res.ok) { alert(res.error); return; }
    router.refresh();
  }

  return (
    <div>
      <div className="bg-white/80 backdrop-blur border-b border-[#e5e9f0] px-8 pt-5 pb-4 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Notlar</h1>
          <p className="text-sm text-slate-500">Kişisel notlarınız. 3 gün ve üzeri bekleyen notlar kırmızıya döner.</p>
        </div>
        <button onClick={() => { setIcerik(""); setErr(null); setModal(true); }} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[18px]">add</span> Yeni Not
        </button>
      </div>

      <div className="p-8 gs-fade">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={th}>Not</th>
                <th className={th + " w-40"}>Giriş Tarihi</th>
                <th className={th + " w-56 text-right"}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((n) => {
                const kirmizi = gecikti(n.sayac_baslangic);
                return (
                  <tr key={n.id} className={`border-b border-slate-100 last:border-0 ${kirmizi ? "bg-red-50" : ""}`}>
                    <td className={td + (kirmizi ? " text-red-700 font-semibold" : "")} style={{ whiteSpace: "pre-wrap" }}>
                      {editId === n.id ? (
                        <div>
                          <textarea className={inp + " min-h-[72px] text-slate-800 font-normal"} value={draft} autoFocus
                            onChange={(e) => setDraft(e.target.value)} />
                          {editErr && <p className="text-[11px] text-red-600 mt-1">{editErr}</p>}
                        </div>
                      ) : n.icerik}
                    </td>
                    <td className={td + " text-slate-500 whitespace-nowrap"}>{dt(n.created_at)}</td>
                    <td className={td + " text-right whitespace-nowrap"}>
                      <div className="inline-flex items-center gap-3">
                        <button onClick={() => ertele(n.id)} disabled={busyId === n.id || !kirmizi}
                          title={kirmizi ? "" : "Not henüz süresini doldurmadı"}
                          className="text-xs font-bold text-brand hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed">Ertele</button>
                        <button onClick={() => sil(n.id)} disabled={busyId === n.id}
                          className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50">Sil</button>
                        {editId === n.id ? (
                          <>
                            <button onClick={() => guncelle(n.id)} disabled={busyId === n.id}
                              className="text-xs font-bold text-white bg-navy rounded-md px-2.5 py-1 hover:opacity-90 disabled:opacity-50">Kaydet</button>
                            <button onClick={() => setEditId(null)} disabled={busyId === n.id}
                              className="text-xs font-bold text-slate-500 hover:underline disabled:opacity-50">İptal</button>
                          </>
                        ) : (
                          <button onClick={() => duzenle(n)} disabled={busyId === n.id}
                            className="text-xs font-bold text-navy hover:underline disabled:opacity-50">Düzenle</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400">Henüz not yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-extrabold text-lg">Yeni Not</h2>
              <button onClick={() => setModal(false)} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Not *</label>
                <textarea rows={5} className={inp} value={icerik} onChange={(e) => setIcerik(e.target.value)} placeholder="Notunuzu yazın…" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Giriş Tarihi</label>
                <input disabled className={inp + " bg-slate-50 text-slate-500"} value={bugunStr} />
              </div>
              {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModal(false)} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
                <button disabled={busy} onClick={kaydet} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
                  {busy ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
