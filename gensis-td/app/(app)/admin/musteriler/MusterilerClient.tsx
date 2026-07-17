"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany, updateCompany, deleteCompany, uploadCompanyDocument } from "../actions";

type Company = {
  id: string; short_name: string; legal_name: string | null; address: string | null;
  phone: string | null; mobile_phone: string | null; city: string | null;
  authorized_person: string | null; registered_brand: string | null; industry_reg_no: string | null;
};
type Doc = { id: string; company_id: string; doc_type: string; original_name: string | null; issue_date: string | null; valid_until: string | null; belge_no: string | null };
type DocForm = { issue_date: string; valid_until: string; file: File | null };

const BLANK: Record<string, string> = {
  short_name: "", legal_name: "", authorized_person: "", registered_brand: "",
  city: "", phone: "", mobile_phone: "", industry_reg_no: "", address: "",
};
const BELGE_TIPLERI = [
  { key: "sanayi_sicil", ad: "Sanayi Sicil Belgesi" },
  { key: "tse_hyb", ad: "TSE HYB Belgesi" },
];
const BADGE: Record<string, string> = {
  green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-500",
};
const RANK: Record<string, number> = { red: 3, amber: 2, green: 1, slate: 0 };

function belgeDurum(validUntil: string | null | undefined, hasFile: boolean): { t: string; c: string } {
  if (!validUntil) return hasFile ? { t: "Tarihsiz", c: "slate" } : { t: "Yok", c: "slate" };
  const d = new Date(validUntil); const now = new Date(); now.setHours(0, 0, 0, 0);
  const in30 = new Date(now); in30.setMonth(in30.getMonth() + 1);
  if (d < now) return { t: "Geçersiz", c: "red" };
  if (d < in30) return { t: "1 aydan az", c: "amber" };
  return { t: "Geçerli", c: "green" };
}

export default function MusterilerClient({
  companies, provinces, documents,
}: { companies: Company[]; provinces: string[]; documents: Doc[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...BLANK });
  const [docForms, setDocForms] = useState<Record<string, DocForm>>({});
  const [docKey, setDocKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const formRef = useRef<HTMLFormElement>(null);
  const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  const setDoc = (dt: string, patch: Partial<DocForm>) => setDocForms((s) => ({ ...s, [dt]: { issue_date: "", valid_until: "", file: null, ...s[dt], ...patch } }));

  const docsByComp = useMemo(() => {
    const m: Record<string, Record<string, Doc>> = {};
    for (const d of documents) { (m[d.company_id] ||= {})[d.doc_type] = d; }
    return m;
  }, [documents]);

  function compDurum(id: string): { t: string; c: string } {
    const map = docsByComp[id] || {};
    let worst = { t: "Belge yok", c: "slate" };
    let any = false;
    for (const t of BELGE_TIPLERI) {
      const d = map[t.key];
      if (!d) continue;
      any = true;
      const st = belgeDurum(d.valid_until, !!d.original_name);
      if (RANK[st.c] > RANK[worst.c]) worst = st;
    }
    if (any && worst.c === "slate") worst = { t: "Yüklendi", c: "green" };
    return worst;
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return companies;
    return companies.filter((c) => c.short_name.toLocaleLowerCase("tr").includes(s) || (c.legal_name ?? "").toLocaleLowerCase("tr").includes(s));
  }, [q, companies]);

  function initDocForms(compId: string | null) {
    const map = compId ? (docsByComp[compId] || {}) : {};
    const out: Record<string, DocForm> = {};
    for (const t of BELGE_TIPLERI) out[t.key] = { issue_date: map[t.key]?.issue_date ?? "", valid_until: map[t.key]?.valid_until ?? "", file: null };
    setDocForms(out); setDocKey((k) => k + 1);
  }

  function selectCompany(c: Company) {
    setEditId(c.id);
    setForm({
      short_name: c.short_name ?? "", legal_name: c.legal_name ?? "", authorized_person: c.authorized_person ?? "",
      registered_brand: c.registered_brand ?? "", city: c.city ?? "", phone: c.phone ?? "",
      mobile_phone: c.mobile_phone ?? "", industry_reg_no: c.industry_reg_no ?? "", address: c.address ?? "",
    });
    initDocForms(c.id); setMsg(null); scrollToForm();
  }
  function newCompany() { setEditId(null); setForm({ ...BLANK }); initDocForms(null); setMsg(null); scrollToForm(); }

  async function sil() {
    if (!editId) return;
    if (!confirm(`"${form.short_name}" müşterisini silmek istiyor musunuz?`)) return;
    setBusy(true); setMsg(null);
    const res = await deleteCompany(editId);
    setBusy(false);
    if (res.ok) { newCompany(); router.refresh(); }
    else setMsg({ ok: false, text: res.error });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = editId ? await updateCompany(editId, form) : await createCompany(form);
    if (!res.ok) { setBusy(false); setMsg({ ok: false, text: res.error }); return; }
    const compId = editId || res.id!;

    let docErr: string | null = null;
    for (const t of BELGE_TIPLERI) {
      const df = docForms[t.key];
      if (!df) continue;
      const ex = docsByComp[compId]?.[t.key];
      const changed = !!df.file || (df.issue_date && df.issue_date !== (ex?.issue_date ?? "")) || (df.valid_until && df.valid_until !== (ex?.valid_until ?? ""));
      if (!changed) continue;
      const fd = new FormData();
      fd.set("company_id", compId); fd.set("doc_type", t.key);
      fd.set("issue_date", df.issue_date); fd.set("valid_until", df.valid_until);
      if (df.file) fd.set("file", df.file);
      const r = await uploadCompanyDocument(fd);
      if (!r.ok) docErr = r.error;
    }

    setBusy(false);
    if (docErr) setMsg({ ok: false, text: "Müşteri kaydedildi, belge hatası: " + docErr });
    else setMsg({ ok: true, text: editId ? "Kaydedildi." : "Müşteri ve belgeler kaydedildi." });
    router.refresh();
    if (!editId) newCompany();
    else { setDocForms((s) => { const o: Record<string, DocForm> = {}; for (const k in s) o[k] = { ...s[k], file: null }; return o; }); setDocKey((k) => k + 1); }
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={newCompany} className="gs-btn text-sm font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[18px]">add</span> Yeni Müşteri Oluştur
        </button>
      </div>

      {/* Liste */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma adından ara…" className={inp} />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {filtered.map((c) => {
              const du = compDurum(c.id);
              return (
                <tr key={c.id} className={`border-b border-slate-100 last:border-0 ${editId === c.id ? "bg-brand-light" : ""}`}>
                  <td className="px-5 py-2.5 font-semibold">{c.short_name}</td>
                  <td className="px-5 py-2.5 text-slate-500">{c.city ?? "—"}</td>
                  <td className="px-5 py-2.5 text-slate-500">{c.authorized_person ?? "—"}</td>
                  <td className="px-5 py-2.5"><span className={`text-xs px-2 py-1 rounded-full font-semibold ${BADGE[du.c]}`}>{du.t}</span></td>
                  <td className="px-5 py-2.5 text-right">
                    <button onClick={() => selectCompany(c)} className="text-xs font-semibold text-brand hover:underline">Düzenle</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td className="px-5 py-4 text-sm text-slate-400">Sonuç yok.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Bilgiler (sol) + Belgeler (sağ) — tek Kaydet */}
      <form ref={formRef} onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start scroll-mt-6">
        {/* Sol: bilgiler */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
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
            <div><L>Sanayi Sicil No</L><input className={inp} value={form.industry_reg_no} onChange={(e) => set("industry_reg_no", e.target.value)} /></div>
            <div><L>Sabit Telefon</L><input type="tel" className={inp} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0 224 000 00 00" /></div>
            <div><L>Cep Telefonu</L><input type="tel" className={inp} value={form.mobile_phone} onChange={(e) => set("mobile_phone", e.target.value)} placeholder="0 5xx 000 00 00" /></div>
            <div className="col-span-2"><L>Adres</L><input className={inp} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          </div>
          {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
          <div className="mt-4 flex items-center gap-2">
            <button disabled={busy} className="bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
              {busy ? "Kaydediliyor…" : editId ? "Değişiklikleri Kaydet" : "Müşteriyi Kaydet"}
            </button>
            {editId && (
              <button type="button" onClick={sil} disabled={busy} className="text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">
                Müşteri Sil
              </button>
            )}
          </div>
        </div>

        {/* Sağ: belgeler */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-bold mb-1">Belgeler</h2>
          <p className="text-xs text-slate-400 mb-3">Dosya, veriliş ve geçerlilik tarihini gir; alttaki <b>Kaydet</b> ile müşteriyle birlikte yüklenir. 1 aydan az kalınca sarı, dolunca kırmızı.</p>
          <div className="space-y-3">
            {BELGE_TIPLERI.map((t) => (
              <BelgeSatiri
                key={`${editId || "new"}-${t.key}-${docKey}`}
                ad={t.ad}
                existingDoc={editId ? docsByComp[editId]?.[t.key] : undefined}
                issueDate={docForms[t.key]?.issue_date ?? ""}
                validUntil={docForms[t.key]?.valid_until ?? ""}
                file={docForms[t.key]?.file ?? null}
                onIssue={(v) => setDoc(t.key, { issue_date: v })}
                onValid={(v) => setDoc(t.key, { valid_until: v })}
                onFile={(f) => setDoc(t.key, { file: f })}
              />
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}

function BelgeSatiri({
  ad, existingDoc, issueDate, validUntil, file, onIssue, onValid, onFile,
}: {
  ad: string; existingDoc?: Doc; issueDate: string; validUntil: string; file: File | null;
  onIssue: (v: string) => void; onValid: (v: string) => void; onFile: (f: File | null) => void;
}) {
  const durum = belgeDurum(validUntil, !!existingDoc?.original_name || !!file);
  return (
    <div className="border border-slate-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-800">{ad}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${BADGE[durum.c]}`}>{durum.t}</span>
      </div>
      {existingDoc?.original_name && (
        <div className="mb-2 text-xs">
          <a href={`/api/belge/musteri?id=${existingDoc.id}`} target="_blank" rel="noreferrer" className="text-navy font-semibold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-rounded text-[15px]">description</span>{existingDoc.original_name}
          </a>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Veriliş Tarihi</label>
          <input type="date" value={issueDate} onChange={(e) => onIssue(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Geçerlilik Tarihi</label>
          <input type="date" value={validUntil} onChange={(e) => onValid(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand" />
        </div>
      </div>
      <input type="file" onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="text-xs w-full file:mr-2 file:text-xs file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
      {file && <div className="mt-1 text-xs text-slate-500">Yeni: {file.name}</div>}
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 mb-1">{children}</label>;
}
