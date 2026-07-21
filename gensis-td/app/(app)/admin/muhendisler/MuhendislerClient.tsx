"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createEngineer, updateEngineer, deleteEngineer, uploadEngineerDocument } from "../actions";

type Engineer = {
  id: string; full_name: string; discipline: string; chamber_reg_no: string | null; company_id: string | null;
  address: string | null; phone: string | null;
  companies?: { short_name: string } | null;
};
type Company = { id: string; short_name: string };
type Doc = { id: string; engineer_id: string; doc_type: string; original_name: string | null; valid_until: string | null };
type DocForm = { valid_until: string; file: File | null };

const BRANS: Record<string, string> = { makine: "Makine Mühendisi", elektrik: "Elektrik Mühendisi" };
const BELGE_TIPLERI: Record<string, { key: string; ad: string }[]> = {
  makine: [
    { key: "asansor_avan_yetki", ad: "Asansör Avan Yetki" },
    { key: "asansor_muh_yetki", ad: "Asansör Mühendis Yetki" },
    { key: "buro_tescil", ad: "Büro Tescil" },
  ],
  elektrik: [
    { key: "asansor_tescil", ad: "Asansör Tescil Belgesi" },
    { key: "buro_tescil", ad: "Büro Tescil Belgesi" },
  ],
};
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

export default function MuhendislerClient({
  engineers, companies, documents, defaultCompanyId, mode = "admin",
}: { engineers: Engineer[]; companies: Company[]; documents: Doc[]; defaultCompanyId: string; mode?: "admin" | "customer" }) {
  const isCustomer = mode === "customer";
  const router = useRouter();
  const snapshotRef = useRef<string>("");
  const blank = { full_name: "", discipline: "makine", chamber_reg_no: "", company_id: defaultCompanyId, address: "", phone: "" };
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...blank });
  const [docForms, setDocForms] = useState<Record<string, DocForm>>({});
  const [docKey, setDocKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setDoc = (dt: string, patch: Partial<DocForm>) => setDocForms((s) => ({ ...s, [dt]: { valid_until: "", file: null, ...s[dt], ...patch } }));
  const formRef = useRef<HTMLFormElement>(null);
  const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  const searchParams = useSearchParams();
  useEffect(() => {
    if (isCustomer) return;
    const id = searchParams.get("edit");
    if (id) { const e = engineers.find((x) => x.id === id); if (e) edit(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const docsByEng = useMemo(() => {
    const m: Record<string, Record<string, Doc>> = {};
    for (const d of documents) { (m[d.engineer_id] ||= {})[d.doc_type] = d; }
    return m;
  }, [documents]);

  function engDurum(e: Engineer): { t: string; c: string } {
    const map = docsByEng[e.id] || {};
    const tipler = BELGE_TIPLERI[e.discipline] || [];
    let worst = { t: "Belge yok", c: "slate" };
    let any = false;
    for (const t of tipler) {
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
    if (!s) return engineers;
    return engineers.filter((e) => e.full_name.toLocaleLowerCase("tr").includes(s));
  }, [q, engineers]);

  function initDocForms(engId: string | null, discipline: string) {
    const map = engId ? (docsByEng[engId] || {}) : {};
    const out: Record<string, DocForm> = {};
    for (const t of BELGE_TIPLERI[discipline] || []) out[t.key] = { valid_until: map[t.key]?.valid_until ?? "", file: null };
    setDocForms(out);
    setDocKey((k) => k + 1);
  }

  function edit(e: Engineer) {
    setEditId(e.id);
    const f = {
      full_name: e.full_name ?? "", discipline: e.discipline ?? "makine",
      chamber_reg_no: e.chamber_reg_no ?? "", company_id: e.company_id ?? "",
      address: e.address ?? "", phone: e.phone ?? "",
    };
    setForm(f);
    snapshotRef.current = JSON.stringify(f);
    initDocForms(e.id, e.discipline ?? "makine");
    setMsg(null); if (!isCustomer) scrollToForm();
  }
  function yeni() { setEditId(null); setForm({ ...blank }); snapshotRef.current = ""; initDocForms(null, "makine"); setMsg(null); scrollToForm(); }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true); setMsg(null);
    let engId: string | null = editId;
    if (editId) {
      const changed = JSON.stringify(form) !== snapshotRef.current;
      if (!isCustomer || changed) {
        const res = await updateEngineer(editId, form as any);
        if (!res.ok) { setBusy(false); setMsg({ ok: false, text: res.error }); return; }
      }
    } else {
      const res = await createEngineer(form as any);
      if (!res.ok) { setBusy(false); setMsg({ ok: false, text: res.error }); return; }
      engId = res.id ?? null; // müşteri: yeni mühendis onaya düştüğü için id yok
    }

    // staged belgeleri yükle (yalnız mevcut mühendis + değişenler)
    let docErr: string | null = null;
    if (engId) {
      const tipler = BELGE_TIPLERI[form.discipline] || [];
      for (const t of tipler) {
        const df = docForms[t.key];
        if (!df) continue;
        const existing = docsByEng[engId]?.[t.key];
        const changed = !!df.file || (df.valid_until && df.valid_until !== (existing?.valid_until ?? ""));
        if (!changed) continue;
        const fd = new FormData();
        fd.set("engineer_id", engId); fd.set("doc_type", t.key); fd.set("valid_until", df.valid_until);
        if (df.file) fd.set("file", df.file);
        const r = await uploadEngineerDocument(fd);
        if (!r.ok) docErr = r.error;
      }
    }

    setBusy(false);
    if (!editId && isCustomer) setMsg({ ok: true, text: "Yeni mühendis onaya gönderildi. Onaylandıktan sonra belgelerini yükleyebilirsiniz." });
    else if (docErr) setMsg({ ok: false, text: (isCustomer ? "Gönderildi, belge hatası: " : "Mühendis kaydedildi, belge hatası: ") + docErr });
    else setMsg({ ok: true, text: isCustomer ? "Değişiklikleriniz onaya gönderildi." : (editId ? "Kaydedildi." : "Mühendis ve belgeler kaydedildi.") });
    router.refresh();
    if (!editId && !isCustomer) yeni();
    else if (editId) { setDocForms((s) => { const o: Record<string, DocForm> = {}; for (const k in s) o[k] = { ...s[k], file: null }; return o; }); setDocKey((k) => k + 1); }
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

  const docTipleri = BELGE_TIPLERI[form.discipline] || [];

  return (
    <div className="space-y-6">
      {isCustomer && (
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Mühendislerim</h1>
          <p className="text-sm text-slate-500">Firmanıza bağlı mühendisleri ve belgelerini yönetin. Yeni mühendis ve belge yüklemeleri Gensis onayına gönderilir.</p>
        </div>
      )}

      {/* Liste (tam genişlik) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mühendis adından ara…" className={inp} />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {filtered.map((m) => {
              const du = engDurum(m);
              return (
                <tr key={m.id} className={`border-b border-slate-100 last:border-0 ${editId === m.id ? "bg-brand-light" : ""}`}>
                  <td className="px-5 py-2.5 font-semibold">{m.full_name}</td>
                  <td className="px-5 py-2.5">
                    <span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{BRANS[m.discipline] ?? m.discipline}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${BADGE[du.c]}`}>{du.t}</span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{m.companies?.short_name ?? "—"}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button onClick={() => edit(m)} className="text-xs font-semibold text-brand hover:underline">Düzenle</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td className="px-5 py-4 text-sm text-slate-400">Sonuç yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bilgiler (sol) + Belgeler (sağ) — tek Kaydet */}
      <form ref={formRef} onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start scroll-mt-6">
        {/* Sol: bilgiler */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
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
              <select value={form.discipline} onChange={(e) => { set("discipline", e.target.value); initDocForms(editId, e.target.value); }} className={inp}>
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
            {!isCustomer && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bağlı Şirket</label>
                <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inp}>
                  <option value="">Seçiniz…</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                </select>
              </div>
            )}
          </div>
          {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
          <div className="mt-4 flex items-center gap-2">
            <button disabled={busy} className="bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
              {busy ? "Kaydediliyor…" : isCustomer ? "Onaya Gönder" : editId ? "Değişiklikleri Kaydet" : "Mühendisi Kaydet"}
            </button>
            {!isCustomer && editId && (
              <button type="button" onClick={sil} disabled={busy} className="text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">
                Mühendisi Sil
              </button>
            )}
          </div>
        </div>

        {/* Sağ: belgeler */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-bold mb-1">Belgeler</h2>
          <p className="text-xs text-slate-400 mb-3">Dosya ve geçerlilik tarihini gir; alttaki <b>Kaydet</b> ile mühendisle birlikte yüklenir. 1 aydan az kalınca sarı, dolunca kırmızı.</p>
          <div className="space-y-3">
            {docTipleri.map((t) => (
              <BelgeSatiri
                key={`${editId || "new"}-${t.key}-${docKey}`}
                ad={t.ad}
                existingDoc={editId ? docsByEng[editId]?.[t.key] : undefined}
                validUntil={docForms[t.key]?.valid_until ?? ""}
                file={docForms[t.key]?.file ?? null}
                onDate={(v) => setDoc(t.key, { valid_until: v })}
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
  ad, existingDoc, validUntil, file, onDate, onFile,
}: {
  ad: string; existingDoc?: Doc; validUntil: string; file: File | null;
  onDate: (v: string) => void; onFile: (f: File | null) => void;
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
          <a href={`/api/belge/muhendis?id=${existingDoc.id}`} target="_blank" rel="noreferrer" className="text-navy font-semibold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-rounded text-[15px]">description</span>{existingDoc.original_name}
          </a>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={validUntil} onChange={(e) => onDate(e.target.value)}
          className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand" />
        <input type="file" onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="text-xs flex-1 min-w-[120px] file:mr-2 file:text-xs file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
      </div>
      {file && <div className="mt-1 text-xs text-slate-500">Yeni: {file.name}</div>}
    </div>
  );
}
