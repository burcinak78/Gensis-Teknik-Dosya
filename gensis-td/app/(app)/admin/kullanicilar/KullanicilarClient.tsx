"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "../actions";

type User = {
  id: string; full_name: string | null; role: string; is_active: boolean;
  company_id: string | null; email: string; companies?: { short_name: string } | null;
};
type Company = { id: string; short_name: string };

const ROL: Record<string, string> = { admin: "Admin", gensis: "Kullanıcı", muhasebeci: "Muhasebe/Finans", customer: "Müşteri" };
const ROL_OPTS = [
  { v: "customer", t: "Müşteri" },
  { v: "gensis", t: "Kullanıcı" },
  { v: "muhasebeci", t: "Muhasebe/Finans" },
  { v: "admin", t: "Admin" },
];

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const fInp = "w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-brand";
const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
const td = "px-3 py-2 text-sm whitespace-nowrap";
const fTh = "px-3 py-1.5 align-top";

export default function KullanicilarClient({
  users, companies, defaultCompanyId,
}: { users: User[]; companies: Company[]; defaultCompanyId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ ad: "", email: "", rol: "", firma: "", durum: "" });
  const [modal, setModal] = useState<null | { mode: "new" | "edit"; user?: User }>(null);
  const setFilter = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    return users.filter((u) => {
      if (s) {
        const hay = [u.full_name, u.email, u.companies?.short_name, ROL[u.role]].map(tc).join(" ");
        if (!hay.includes(s)) return false;
      }
      if (f.ad && !tc(u.full_name).includes(tc(f.ad))) return false;
      if (f.email && !tc(u.email).includes(tc(f.email))) return false;
      if (f.rol && u.role !== f.rol) return false;
      if (f.firma && u.company_id !== f.firma) return false;
      if (f.durum && (f.durum === "aktif") !== u.is_active) return false;
      return true;
    });
  }, [q, f, users]);

  return (
    <div>
      {/* Sticky araç çubuğu */}
      <div className="sticky top-[92px] z-10 bg-white/80 backdrop-blur -mx-8 px-8 py-3 border-b border-slate-100 mb-4 flex items-center gap-3">
        <button onClick={() => setModal({ mode: "new" })} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">
          + Yeni Kullanıcı
        </button>
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: ad, e-posta, firma, rol…" className={inp + " pl-10"} />
        </div>
        <button onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border ${showFilters ? "bg-brand-light text-brand border-brand/30" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
          <span className="material-symbols-rounded text-[18px]">filter_list</span> Filtrele
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={th}>Ad Soyad</th>
                <th className={th}>E-posta</th>
                <th className={th}>Rol</th>
                <th className={th}>Firma</th>
                <th className={th}>Durum</th>
                <th className={th}>İşlem</th>
              </tr>
              {showFilters && (
                <tr className="bg-white border-b border-slate-200">
                  <th className={fTh}><input className={fInp} value={f.ad} onChange={(e) => setFilter("ad", e.target.value)} placeholder="Ad" /></th>
                  <th className={fTh}><input className={fInp} value={f.email} onChange={(e) => setFilter("email", e.target.value)} placeholder="E-posta" /></th>
                  <th className={fTh}>
                    <select className={fInp} value={f.rol} onChange={(e) => setFilter("rol", e.target.value)}>
                      <option value="">Hepsi</option>
                      {ROL_OPTS.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
                    </select>
                  </th>
                  <th className={fTh}>
                    <select className={fInp} value={f.firma} onChange={(e) => setFilter("firma", e.target.value)}>
                      <option value="">Hepsi</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                    </select>
                  </th>
                  <th className={fTh}>
                    <select className={fInp} value={f.durum} onChange={(e) => setFilter("durum", e.target.value)}>
                      <option value="">Hepsi</option><option value="aktif">Aktif</option><option value="pasif">Pasif</option>
                    </select>
                  </th>
                  <th className={fTh}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className={td + " font-semibold"}>{u.full_name ?? "—"}</td>
                  <td className={td + " text-slate-500"}>{u.email || "—"}</td>
                  <td className={td}><span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{ROL[u.role] ?? u.role}</span></td>
                  <td className={td + " text-slate-500"}>{u.companies?.short_name ?? "—"}</td>
                  <td className={td}>{u.is_active ? <span className="text-xs font-semibold text-green-700">● Aktif</span> : <span className="text-xs font-semibold text-slate-400">● Pasif</span>}</td>
                  <td className={td + " text-right"}>
                    <button onClick={() => setModal({ mode: "edit", user: u })} className="text-xs font-bold text-brand hover:underline">Düzenle</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Sonuç yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <UserModal
          mode={modal.mode} user={modal.user} companies={companies} defaultCompanyId={defaultCompanyId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inp + " pr-10"} autoComplete="new-password" />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
        className="material-symbols-rounded text-[18px] absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
        {show ? "visibility_off" : "visibility"}
      </button>
    </div>
  );
}

function UserModal({
  mode, user, companies, defaultCompanyId, onClose, onSaved,
}: {
  mode: "new" | "edit"; user?: User; companies: Company[]; defaultCompanyId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    email: user?.email ?? "",
    full_name: user?.full_name ?? "",
    role: user?.role ?? "customer",
    company_id: user?.company_id ?? defaultCompanyId,
    is_active: user ? (user.is_active ? "true" : "false") : "true",
  });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const staff = form.role === "admin" || form.role === "gensis" || form.role === "muhasebeci";

  async function submit() {
    setErr(null);
    if (!isEdit && !form.email.trim()) return setErr("E-posta zorunlu.");
    // Şifre kuralları
    if (!isEdit) {
      if (!pw) return setErr("Şifre zorunlu.");
      if (pw.length < 6) return setErr("Şifre en az 6 karakter olmalı.");
      if (pw !== pw2) return setErr("Şifreler eşleşmiyor.");
    } else if (pw || pw2) {
      if (pw.length < 6) return setErr("Yeni şifre en az 6 karakter olmalı.");
      if (pw !== pw2) return setErr("Şifreler eşleşmiyor.");
    }
    setBusy(true);
    const res = isEdit
      ? await updateUser({ id: user!.id, full_name: form.full_name, role: form.role, company_id: form.company_id, is_active: form.is_active, password: pw || undefined })
      : await createUser({ email: form.email, password: pw, full_name: form.full_name, role: form.role, company_id: form.company_id });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onSaved();
  }

  return (
    <Overlay title={isEdit ? "Kullanıcı Düzenle" : "Yeni Kullanıcı"} onClose={onClose}>
      <div className="space-y-3">
        <Field label={`E-posta ${isEdit ? "" : "*"}`}>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={isEdit} className={inp + (isEdit ? " bg-slate-50 text-slate-500" : "")} />
        </Field>
        <Field label="Ad Soyad">
          <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inp} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rol *">
            <select value={form.role} onChange={(e) => set("role", e.target.value)} className={inp}>
              {ROL_OPTS.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
            </select>
          </Field>
          <Field label="Bağlı Şirket">
            <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inp} disabled={staff}>
              <option value="">Seçiniz…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
          </Field>
        </div>
        {staff && <p className="text-[11px] text-slate-400 -mt-1">Admin / Kullanıcı / Muhasebe personeli otomatik Gensis'e bağlanır.</p>}

        {/* Şifre */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-slate-600">{isEdit ? "Yeni Şifre Ata (boş bırakırsanız değişmez)" : "Şifre"}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={isEdit ? "Yeni Şifre" : "Şifre *"}>
              <PasswordInput value={pw} onChange={setPw} placeholder={isEdit ? "Değiştirmek için giriniz" : "En az 6 karakter"} />
            </Field>
            <Field label={isEdit ? "Yeni Şifre (Tekrar)" : "Şifre (Tekrar) *"}>
              <PasswordInput value={pw2} onChange={setPw2} placeholder="Tekrar giriniz" />
            </Field>
          </div>
          {isEdit && <p className="text-[11px] text-slate-400">Güvenlik nedeniyle mevcut şifre görüntülenemez; yalnızca yeni şifre atanabilir.</p>}
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.is_active === "true"} onChange={(e) => set("is_active", e.target.checked ? "true" : "false")} className="w-4 h-4 accent-brand" />
            Aktif kullanıcı
          </label>
        )}

        {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
          <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
            {busy ? "Kaydediliyor…" : isEdit ? "Değişiklikleri Kaydet" : "Kullanıcı Ekle"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>;
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-extrabold text-lg">{title}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
