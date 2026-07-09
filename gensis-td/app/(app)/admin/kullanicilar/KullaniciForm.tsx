"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "../actions";

const ROLLER = [
  { v: "admin", label: "Admin — her türlü veriyi yönetir" },
  { v: "gensis", label: "Gensis Kullanıcı — dosya oluşturur, atanan müşterileri görür" },
  { v: "customer", label: "Müşteri — yalnız kendi dosyalarını yönetir" },
];

export default function KullaniciForm({ companies }: { companies: { id: string; short_name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", full_name: "", role: "customer", company_id: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: string) => setF((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await createUser(f);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: res.message ?? "Oluşturuldu." });
      setF({ email: "", password: "", full_name: "", role: "customer", company_id: "" });
      router.refresh();
    } else setMsg({ ok: false, text: res.error });
  }

  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold mb-4">Yeni Kullanıcı</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Ad Soyad</label>
          <input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">E-posta *</label>
          <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Geçici Şifre *</label>
          <input value={f.password} onChange={(e) => set("password", e.target.value)} className={inp} placeholder="En az 6 karakter" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Rol *</label>
          <select value={f.role} onChange={(e) => set("role", e.target.value)} className={inp}>
            {ROLLER.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Bağlı Firma {f.role === "customer" ? "*" : "(opsiyonel)"}
          </label>
          <select value={f.company_id} onChange={(e) => set("company_id", e.target.value)} className={inp}>
            <option value="">Firma seçiniz…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
          </select>
        </div>
      </div>
      {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <button disabled={busy} className="mt-4 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
        {busy ? "Oluşturuluyor…" : "Kullanıcı Oluştur"}
      </button>
    </form>
  );
}
