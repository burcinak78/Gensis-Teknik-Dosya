"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany, updateCompany } from "../actions";

type Company = {
  id: string; short_name: string; legal_name: string | null; address: string | null;
  phone: string | null; mobile_phone: string | null; city: string | null;
  authorized_person: string | null; registered_brand: string | null; industry_reg_no: string | null;
};
const BLANK: Record<string, string> = {
  short_name: "", legal_name: "", authorized_person: "", registered_brand: "",
  city: "", phone: "", mobile_phone: "", industry_reg_no: "", address: "",
};

export default function MusterilerClient({ companies, provinces }: { companies: Company[]; provinces: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null); // null = yeni
  const [form, setForm] = useState<Record<string, string>>({ ...BLANK });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return companies;
    return companies.filter(
      (c) => c.short_name.toLocaleLowerCase("tr").includes(s) || (c.legal_name ?? "").toLocaleLowerCase("tr").includes(s)
    );
  }, [q, companies]);

  function selectCompany(c: Company) {
    setEditId(c.id);
    setForm({
      short_name: c.short_name ?? "", legal_name: c.legal_name ?? "", authorized_person: c.authorized_person ?? "",
      registered_brand: c.registered_brand ?? "", city: c.city ?? "", phone: c.phone ?? "",
      mobile_phone: c.mobile_phone ?? "", industry_reg_no: c.industry_reg_no ?? "", address: c.address ?? "",
    });
    setMsg(null);
  }
  function newCompany() { setEditId(null); setForm({ ...BLANK }); setMsg(null); }
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = editId ? await updateCompany(editId, form) : await createCompany(form);
    setBusy(false);
    if (res.ok) { setMsg({ ok: true, text: res.message ?? "Kaydedildi." }); router.refresh(); if (!editId) setForm({ ...BLANK }); }
    else setMsg({ ok: false, text: res.error });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
      {/* Liste + arama */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="p-3 border-b border-slate-100">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma adından ara…" className={inp} />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => selectCompany(c)}
              className={`w-full text-left px-5 py-2.5 border-b border-slate-100 last:border-0 hover:bg-brand-light ${editId === c.id ? "bg-brand-light" : ""}`}>
              <div className="font-semibold text-sm">{c.short_name}</div>
              <div className="text-xs text-slate-500">{c.city ?? "—"} · {c.authorized_person ?? "—"}</div>
            </button>
          ))}
          {filtered.length === 0 && <div className="px-5 py-4 text-sm text-slate-400">Sonuç yok.</div>}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">{editId ? "Müşteri Düzenle" : "Yeni Müşteri"}</h2>
          {editId && <button type="button" onClick={newCompany} className="text-xs font-semibold text-brand hover:underline">+ Yeni</button>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><L>Kısa Ad *</L><input className={inp} value={form.short_name} onChange={(e) => set("short_name", e.target.value)} /></div>
          <div className="col-span-2"><L>Ticari Ünvan *</L><input className={inp} value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} /></div>
          <div><L>Yetkili / Ünvanı</L><input className={inp} value={form.authorized_person} onChange={(e) => set("authorized_person", e.target.value)} /></div>
          <div><L>Tescilli Marka</L><input className={inp} value={form.registered_brand} onChange={(e) => set("registered_brand", e.target.value)} /></div>
          <div><L>Şehir</L>
            <select className={inp} value={form.city} onChange={(e) => set("city", e.target.value)}>
              <option value="">Seçiniz…</option>
              {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><L>Sanayi Sicil No</L><input className={inp} inputMode="numeric" value={form.industry_reg_no}
            onChange={(e) => set("industry_reg_no", e.target.value.replace(/\D/g, ""))} placeholder="Sadece rakam" /></div>
          <div><L>Sabit Telefon</L><input type="tel" className={inp} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0 224 000 00 00" /></div>
          <div><L>Cep Telefonu</L><input type="tel" className={inp} value={form.mobile_phone} onChange={(e) => set("mobile_phone", e.target.value)} placeholder="0 5xx 000 00 00" /></div>
          <div className="col-span-2"><L>Adres</L><input className={inp} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
        </div>
        {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
        <button disabled={busy} className="mt-4 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
          {busy ? "Kaydediliyor…" : editId ? "Değişiklikleri Kaydet" : "Müşteri Ekle"}
        </button>
      </form>
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 mb-1">{children}</label>;
}
