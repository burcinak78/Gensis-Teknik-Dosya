"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "../actions";

type User = {
  id: string; full_name: string | null; role: string; is_active: boolean;
  company_id: string | null; email: string; companies?: { short_name: string } | null;
};
type Company = { id: string; short_name: string };
const ROL: Record<string, string> = { admin: "Admin", gensis: "Gensis Kullanıcı", customer: "Müşteri" };

export default function KullanicilarClient({
  users, companies, defaultCompanyId,
}: { users: User[]; companies: Company[]; defaultCompanyId: string }) {
  const router = useRouter();
  const blank = { email: "", password: "", full_name: "", role: "customer", company_id: defaultCompanyId, is_active: "true" };
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...blank });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLocaleLowerCase("tr").includes(s) ||
        (u.companies?.short_name ?? "").toLocaleLowerCase("tr").includes(s) ||
        (u.email ?? "").toLocaleLowerCase("tr").includes(s)
    );
  }, [q, users]);

  function edit(u: User) {
    setEditId(u.id);
    setForm({
      email: u.email ?? "", password: "", full_name: u.full_name ?? "",
      role: u.role ?? "customer", company_id: u.company_id ?? "", is_active: u.is_active ? "true" : "false",
    });
    setMsg(null);
  }
  function yeni() { setEditId(null); setForm({ ...blank }); setMsg(null); }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true); setMsg(null);
    const res = editId
      ? await updateUser({ id: editId, full_name: form.full_name, role: form.role, company_id: form.company_id, is_active: form.is_active, password: form.password })
      : await createUser({ email: form.email, password: form.password, full_name: form.full_name, role: form.role, company_id: form.company_id });
    setBusy(false);
    if (res.ok) { setMsg({ ok: true, text: res.message ?? "Kaydedildi." }); router.refresh(); if (!editId) setForm({ ...blank }); }
    else setMsg({ ok: false, text: res.error });
  }

  const staff = form.role === "admin" || form.role === "gensis";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      {/* Liste */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim veya firmaya göre ara…" className={inp + " pl-10"} />
          </div>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className={`border-b border-slate-100 last:border-0 ${editId === u.id ? "bg-brand-light" : ""}`}>
                <td className="px-5 py-2.5">
                  <div className="font-semibold">{u.full_name ?? "—"}</div>
                  {u.email && <div className="text-xs text-slate-400">{u.email}</div>}
                </td>
                <td className="px-5 py-2.5">
                  <span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{ROL[u.role] ?? u.role}</span>
                </td>
                <td className="px-5 py-2.5 text-slate-500">{u.companies?.short_name ?? "—"}</td>
                <td className="px-5 py-2.5">
                  {u.is_active
                    ? <span className="text-xs font-semibold text-green-700">● Aktif</span>
                    : <span className="text-xs font-semibold text-slate-400">● Pasif</span>}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button onClick={() => edit(u)} className="text-xs font-semibold text-brand hover:underline">Düzenle</button>
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
          <h2 className="font-bold">{editId ? "Kullanıcı Düzenle" : "Yeni Kullanıcı"}</h2>
          {editId && <button type="button" onClick={yeni} className="text-xs font-semibold text-brand hover:underline">+ Yeni</button>}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">E-posta {editId ? "" : "*"}</label>
            {editId ? (
              <input value={form.email} disabled className={inp + " bg-slate-50 text-slate-500"} />
            ) : (
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inp} />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{editId ? "Yeni Şifre (boş = değişmez)" : "Şifre *"}</label>
            <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} className={inp} placeholder={editId ? "Değiştirmek için yeni şifre" : ""} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ad Soyad</label>
            <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Rol *</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)} className={inp}>
              <option value="customer">Müşteri</option>
              <option value="gensis">Gensis Kullanıcı</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Bağlı Şirket</label>
            <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inp} disabled={staff}>
              <option value="">Seçiniz…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
            {staff && <p className="text-xs text-slate-400 mt-1">Admin/Gensis personeli otomatik Gensis'e bağlanır.</p>}
          </div>
          {editId && (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.is_active === "true"} onChange={(e) => set("is_active", e.target.checked ? "true" : "false")} className="w-4 h-4 accent-brand" />
              Aktif kullanıcı
            </label>
          )}
        </div>
        {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
        <div className="mt-4">
          <button disabled={busy} className="bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
            {busy ? "Kaydediliyor…" : editId ? "Değişiklikleri Kaydet" : "Kullanıcı Ekle"}
          </button>
        </div>
      </form>
    </div>
  );
}
