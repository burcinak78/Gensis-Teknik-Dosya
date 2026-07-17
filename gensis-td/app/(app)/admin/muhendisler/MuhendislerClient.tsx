"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createEngineer, updateEngineer, deleteEngineer } from "../actions";

type Engineer = {
  id: string; full_name: string; discipline: string; chamber_reg_no: string | null; company_id: string | null;
  address: string | null; phone: string | null;
  companies?: { short_name: string } | null;
};
type Company = { id: string; short_name: string };
const BRANS: Record<string, string> = { makine: "Makine Mühendisi", elektrik: "Elektrik Mühendisi" };

export default function MuhendislerClient({
  engineers, companies, defaultCompanyId,
}: { engineers: Engineer[]; companies: Company[]; defaultCompanyId: string }) {
  const router = useRouter();
  const blank = { full_name: "", discipline: "makine", chamber_reg_no: "", company_id: defaultCompanyId, address: "", phone: "" };
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...blank });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return engineers;
    return engineers.filter((e) => e.full_name.toLocaleLowerCase("tr").includes(s));
  }, [q, engineers]);

  function edit(e: Engineer) {
    setEditId(e.id);
    setForm({
      full_name: e.full_name ?? "", discipline: e.discipline ?? "makine",
      chamber_reg_no: e.chamber_reg_no ?? "", company_id: e.company_id ?? "",
      address: e.address ?? "", phone: e.phone ?? "",
    });
    setMsg(null);
  }
  function yeni() { setEditId(null); setForm({ ...blank }); setMsg(null); }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true); setMsg(null);
    const res = editId ? await updateEngineer(editId, form as any) : await createEngineer(form as any);
    setBusy(false);
    if (res.ok) { setMsg({ ok: true, text: res.message ?? "Kaydedildi." }); router.refresh(); if (!editId) setForm({ ...blank }); }
    else setMsg({ ok: false, text: res.error });
  }
  async function sil() {
    if (!editId) return;
    if (!confirm(`"${form.full_name}" mühendisini silmek istiyor musunuz?`)) return;
    setBusy(true); setMsg(null);
    const res = await deleteEngineer(editId);
    setBusy(false);
    if (res.ok) { yeni(); router.refresh(); }
    else setMsg({ ok: false, text: res.error });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      {/* Liste */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="p-3 border-b border-slate-100">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mühendis adından ara…" className={inp} />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className={`border-b border-slate-100 last:border-0 ${editId === m.id ? "bg-brand-light" : ""}`}>
                <td className="px-5 py-2.5 font-semibold">{m.full_name}</td>
                <td className="px-5 py-2.5">
                  <span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{BRANS[m.discipline] ?? m.discipline}</span>
                </td>
                <td className="px-5 py-2.5 text-slate-500">{m.chamber_reg_no ?? "—"}</td>
                <td className="px-5 py-2.5 text-slate-500">{m.companies?.short_name ?? "—"}</td>
                <td className="px-5 py-2.5 text-right">
                  <button onClick={() => edit(m)} className="text-xs font-semibold text-brand hover:underline">Düzenle</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="px-5 py-4 text-sm text-slate-400">Sonuç yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">{editId ? "Mühendis Düzenle" : "Yeni Mühendis (Proje Müellifi)"}</h2>
          {editId && <button type="button" onClick={yeni} className="text-xs font-semibold text-brand hover:underline">+ Yeni</button>}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ad Soyad *</label>
            <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Branş *</label>
            <select value={form.discipline} onChange={(e) => set("discipline", e.target.value)} className={inp}>
              <option value="makine">Makine Mühendisi</option>
              <option value="elektrik">Elektrik Mühendisi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Oda Sicil No</label>
            <input value={form.chamber_reg_no} onChange={(e) => set("chamber_reg_no", e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Adres</label>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inp} placeholder="Mühendisin açık adresi" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Telefon</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inp} placeholder="Örn. 0 224 441 96 65" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Bağlı Şirket</label>
            <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inp}>
              <option value="">Seçiniz…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
          </div>
        </div>
        {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
        <div className="mt-4 flex items-center gap-2">
          <button disabled={busy} className="bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
            {busy ? "Kaydediliyor…" : editId ? "Değişiklikleri Kaydet" : "Mühendis Ekle"}
          </button>
          {editId && (
            <button type="button" onClick={sil} disabled={busy} className="text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">
              Mühendisi Sil
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
