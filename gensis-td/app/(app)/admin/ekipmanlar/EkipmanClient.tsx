"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateEquipmentModel } from "../actions";

type Cat = { id: string; name: string };
type Brand = { id: string; category_id: string; name: string };
type Model = { id: string; brand_id: string; name: string; certificate_id: string | null };
type Cert = { id: string; cert_no: string };

export default function EkipmanClient({ categories, brands, models, certificates }: {
  categories: Cat[]; brands: Brand[]; models: Model[]; certificates: Cert[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCert, setEditCert] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const certNo = useMemo(() => new Map(certificates.map((c) => [c.id, c.cert_no])), [certificates]);
  const s = q.trim().toLocaleLowerCase("tr");
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";

  const match = (m: Model, b: Brand) =>
    !s || m.name.toLocaleLowerCase("tr").includes(s) || b.name.toLocaleLowerCase("tr").includes(s);

  function startEdit(m: Model) {
    setEditId(m.id); setEditName(m.name); setEditCert(m.certificate_id ?? ""); setMsg(null);
  }
  async function saveEdit() {
    if (!editId) return;
    setBusy(true); setMsg(null);
    const res = await updateEquipmentModel({ id: editId, name: editName, certificate_id: editCert });
    setBusy(false);
    if (res.ok) { setMsg({ ok: true, text: res.message ?? "Kaydedildi." }); setEditId(null); router.refresh(); }
    else setMsg({ ok: false, text: res.error });
  }
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
      <div className="p-3 border-b border-slate-100">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marka veya model ara…" className={inp} />
      </div>
      {msg && <div className={`mx-3 mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <div>
        {categories.map((cat) => {
          const catBrands = brands.filter((b) => b.category_id === cat.id);
          const rows = catBrands.map((b) => ({ b, ms: models.filter((m) => m.brand_id === b.id && match(m, b)) })).filter((x) => x.ms.length > 0);
          const total = rows.reduce((a, x) => a + x.ms.length, 0);
          if (s && total === 0) return null;
          const isOpen = open.has(cat.id) || !!s;
          return (
            <div key={cat.id} className="border-b border-slate-100 last:border-0">
              <button onClick={() => toggle(cat.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <span className="font-semibold text-sm">{cat.name}</span>
                <span className="text-xs text-slate-400">{total} model {isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="pb-2">
                  {rows.map(({ b, ms }) => (
                    <div key={b.id} className="px-5 py-1">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-2 mb-1">{b.name}</div>
                      {ms.map((m) => (
                        <div key={m.id} className="pl-2 border-l-2 border-slate-100">
                          {editId === m.id ? (
                            <div className="py-2 pr-2 bg-brand-light rounded-r-lg pl-3 my-1">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Model Adı</label>
                              <input className={inp} value={editName} onChange={(e) => setEditName(e.target.value)} />
                              <label className="block text-xs font-semibold text-slate-600 mb-1 mt-2">Sertifika</label>
                              <select className={inp} value={editCert} onChange={(e) => setEditCert(e.target.value)}>
                                <option value="">Bağlama yok</option>
                                {certificates.map((c) => <option key={c.id} value={c.id}>{c.cert_no}</option>)}
                              </select>
                              <div className="flex gap-2 mt-2">
                                <button disabled={busy} onClick={saveEdit} className="bg-brand text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">Kaydet</button>
                                <button onClick={() => setEditId(null)} className="text-xs font-semibold text-slate-500 px-2">İptal</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-sm">
                                {m.name}
                                {m.certificate_id
                                  ? <span className="ml-2 text-xs text-green-600">✓ {certNo.get(m.certificate_id) ?? "sertifikalı"}</span>
                                  : <span className="ml-2 text-xs text-slate-400">sertifika yok</span>}
                              </span>
                              <button onClick={() => startEdit(m)} className="text-xs font-semibold text-brand hover:underline">Düzenle</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
