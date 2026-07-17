"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany, updateCompany, deleteCompany, uploadCompanyDocument, deleteCompanyDocument } from "../actions";

type Company = {
  id: string; short_name: string; legal_name: string | null; address: string | null;
  phone: string | null; mobile_phone: string | null; city: string | null;
  authorized_person: string | null; registered_brand: string | null; industry_reg_no: string | null; ce_module: string | null;
};
type Doc = { id: string; company_id: string; doc_type: string; original_name: string | null; issue_date: string | null; valid_until: string | null; belge_no: string | null; notified_body_id: string | null };
type NB = { id: string; identity_no: string | null; name: string };
type Row = { uid: string; id?: string; belge_no: string; issue_date: string; valid_until: string; notified_body_id: string; file: File | null; original_name?: string | null };
type DocsState = { sanayi_sicil: Row; tse_hyb: Row; ce_h1: Row; ce_e: Row; ce_tasarim: Row[]; ce_b: Row[] };

const BLANK: Record<string, string> = {
  short_name: "", legal_name: "", authorized_person: "", registered_brand: "",
  city: "", phone: "", mobile_phone: "", industry_reg_no: "", address: "",
};
const BADGE: Record<string, string> = {
  green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-500",
};
const RANK: Record<string, number> = { red: 3, amber: 2, green: 1, slate: 0 };
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
const emptyRow = (): Row => ({ uid: uid(), belge_no: "", issue_date: "", valid_until: "", notified_body_id: "", file: null });
const emptyDocs = (): DocsState => ({ sanayi_sicil: emptyRow(), tse_hyb: emptyRow(), ce_h1: emptyRow(), ce_e: emptyRow(), ce_tasarim: [], ce_b: [] });

function belgeDurum(validUntil: string | null | undefined, hasFile: boolean): { t: string; c: string } {
  if (!validUntil) return hasFile ? { t: "Tarihsiz", c: "slate" } : { t: "Yok", c: "slate" };
  const d = new Date(validUntil); const now = new Date(); now.setHours(0, 0, 0, 0);
  const in30 = new Date(now); in30.setMonth(in30.getMonth() + 1);
  if (d < now) return { t: "Geçersiz", c: "red" };
  if (d < in30) return { t: "1 aydan az", c: "amber" };
  return { t: "Geçerli", c: "green" };
}
const rowHasContent = (r: Row) => !!(r.file || r.belge_no.trim() || r.issue_date || r.valid_until || r.notified_body_id || r.original_name);

export default function MusterilerClient({
  companies, provinces, documents, notifiedBodies,
}: { companies: Company[]; provinces: string[]; documents: Doc[]; notifiedBodies: NB[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...BLANK });
  const [ceModule, setCeModule] = useState("H1");
  const [docs, setDocs] = useState<DocsState>(emptyDocs());
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [docKey, setDocKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const formRef = useRef<HTMLFormElement>(null);
  const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

  const rowFromDoc = (d: Doc): Row => ({ uid: uid(), id: d.id, belge_no: d.belge_no ?? "", issue_date: d.issue_date ?? "", valid_until: d.valid_until ?? "", notified_body_id: d.notified_body_id ?? "", file: null, original_name: d.original_name });
  function buildDocs(compId: string): DocsState {
    const all = documents.filter((d) => d.company_id === compId);
    const one = (t: string) => { const d = all.find((x) => x.doc_type === t); return d ? rowFromDoc(d) : emptyRow(); };
    const many = (t: string) => all.filter((x) => x.doc_type === t).map(rowFromDoc);
    return { sanayi_sicil: one("sanayi_sicil"), tse_hyb: one("tse_hyb"), ce_h1: one("ce_h1"), ce_e: one("ce_e"), ce_tasarim: many("ce_tasarim"), ce_b: many("ce_b") };
  }
  const setSingle = (t: keyof DocsState, patch: Partial<Row>) => setDocs((s) => ({ ...s, [t]: { ...(s[t] as Row), ...patch } }));
  const setListItem = (t: "ce_tasarim" | "ce_b", i: number, patch: Partial<Row>) => setDocs((s) => ({ ...s, [t]: (s[t]).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addListItem = (t: "ce_tasarim" | "ce_b") => setDocs((s) => ({ ...s, [t]: [...s[t], emptyRow()] }));
  const removeListItem = (t: "ce_tasarim" | "ce_b", i: number) => setDocs((s) => {
    const row = s[t][i];
    if (row?.id) setDeletedIds((d) => [...d, row.id!]);
    return { ...s, [t]: s[t].filter((_, j) => j !== i) };
  });

  const docsByComp = useMemo(() => {
    const m: Record<string, Doc[]> = {};
    for (const d of documents) (m[d.company_id] ||= []).push(d);
    return m;
  }, [documents]);
  function compDurum(id: string): { t: string; c: string } {
    const arr = docsByComp[id] || [];
    let worst = { t: "Belge yok", c: "slate" }; let any = false;
    for (const d of arr) { any = true; const st = belgeDurum(d.valid_until, !!d.original_name); if (RANK[st.c] > RANK[worst.c]) worst = st; }
    if (any && worst.c === "slate") worst = { t: "Yüklendi", c: "green" };
    return worst;
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return companies;
    return companies.filter((c) => c.short_name.toLocaleLowerCase("tr").includes(s) || (c.legal_name ?? "").toLocaleLowerCase("tr").includes(s));
  }, [q, companies]);

  function selectCompany(c: Company) {
    setEditId(c.id);
    setForm({
      short_name: c.short_name ?? "", legal_name: c.legal_name ?? "", authorized_person: c.authorized_person ?? "",
      registered_brand: c.registered_brand ?? "", city: c.city ?? "", phone: c.phone ?? "",
      mobile_phone: c.mobile_phone ?? "", industry_reg_no: c.industry_reg_no ?? "", address: c.address ?? "",
    });
    setCeModule(c.ce_module || "H1");
    setDocs(buildDocs(c.id)); setDeletedIds([]); setDocKey((k) => k + 1); setMsg(null); scrollToForm();
  }
  function newCompany() {
    setEditId(null); setForm({ ...BLANK }); setCeModule("H1");
    setDocs(emptyDocs()); setDeletedIds([]); setDocKey((k) => k + 1); setMsg(null); scrollToForm();
  }

  async function sil() {
    if (!editId) return;
    if (!confirm(`"${form.short_name}" müşterisini silmek istiyor musunuz?`)) return;
    setBusy(true); setMsg(null);
    const res = await deleteCompany(editId);
    setBusy(false);
    if (res.ok) { newCompany(); router.refresh(); } else setMsg({ ok: false, text: res.error });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = { ...form, ce_module: ceModule };
    const res = editId ? await updateCompany(editId, payload) : await createCompany(payload);
    if (!res.ok) { setBusy(false); setMsg({ ok: false, text: res.error }); return; }
    const compId = editId || res.id!;

    for (const id of deletedIds) await deleteCompanyDocument(id);

    type Job = { type: string; row: Row; save: (p: Partial<Row>) => void };
    const jobs: Job[] = [
      { type: "sanayi_sicil", row: docs.sanayi_sicil, save: (p) => setSingle("sanayi_sicil", p) },
      { type: "tse_hyb", row: docs.tse_hyb, save: (p) => setSingle("tse_hyb", p) },
    ];
    if (ceModule === "H1") {
      jobs.push({ type: "ce_h1", row: docs.ce_h1, save: (p) => setSingle("ce_h1", p) });
      docs.ce_tasarim.forEach((r, i) => jobs.push({ type: "ce_tasarim", row: r, save: (p) => setListItem("ce_tasarim", i, p) }));
    } else {
      docs.ce_b.forEach((r, i) => jobs.push({ type: "ce_b", row: r, save: (p) => setListItem("ce_b", i, p) }));
      jobs.push({ type: "ce_e", row: docs.ce_e, save: (p) => setSingle("ce_e", p) });
    }

    let docErr: string | null = null;
    for (const job of jobs) {
      if (!rowHasContent(job.row)) continue;
      const fd = new FormData();
      fd.set("company_id", compId); fd.set("doc_type", job.type);
      if (job.row.id) fd.set("doc_id", job.row.id);
      fd.set("belge_no", job.row.belge_no); fd.set("issue_date", job.row.issue_date);
      fd.set("valid_until", job.row.valid_until); fd.set("notified_body_id", job.row.notified_body_id);
      if (job.row.file) fd.set("file", job.row.file);
      const r = await uploadCompanyDocument(fd);
      if (r.ok) job.save({ id: (r as any).id ?? job.row.id, file: null });
      else docErr = r.error;
    }

    setBusy(false); setDeletedIds([]); setDocKey((k) => k + 1);
    if (docErr) setMsg({ ok: false, text: "Müşteri kaydedildi, belge hatası: " + docErr });
    else setMsg({ ok: true, text: editId ? "Kaydedildi." : "Müşteri ve belgeler kaydedildi." });
    router.refresh();
    if (!editId) newCompany();
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
        {/* Sol */}
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="font-bold">Belgeler</h2>
            <p className="text-xs text-slate-400">Dosya + tarihleri gir; alttaki <b>Kaydet</b> ile müşteriyle birlikte yüklenir. 1 aydan az kalınca sarı, dolunca kırmızı.</p>
          </div>

          <DocRow ad="Sanayi Sicil Belgesi" row={docs.sanayi_sicil} nbs={notifiedBodies} onChange={(p) => setSingle("sanayi_sicil", p)} rk={`${docKey}-sanayi`} />
          <DocRow ad="TSE HYB Belgesi" row={docs.tse_hyb} nbs={notifiedBodies} onChange={(p) => setSingle("tse_hyb", p)} rk={`${docKey}-hyb`} />

          {/* CE Belgeleri */}
          <div className="border border-brand/20 bg-brand-light/40 rounded-xl p-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-bold text-brand">CE Belgeleri</span>
              <div className="flex gap-1">
                {["H1", "B"].map((m) => (
                  <button key={m} type="button" onClick={() => setCeModule(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${ceModule === m ? "bg-brand text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                    Mod {m}
                  </button>
                ))}
              </div>
            </div>

            {ceModule === "H1" ? (
              <div className="space-y-3">
                <DocRow ad="Mod H1 Belgesi" row={docs.ce_h1} nbs={notifiedBodies} showBelgeNo showNb onChange={(p) => setSingle("ce_h1", p)} rk={`${docKey}-h1`} />
                <div className="text-xs font-semibold text-slate-600">Tasarım İnceleme Belgeleri</div>
                {docs.ce_tasarim.map((r, i) => (
                  <DocRow key={r.uid} ad={`Tasarım İnceleme ${i + 1}`} row={r} nbs={notifiedBodies} showBelgeNo showNb
                    onChange={(p) => setListItem("ce_tasarim", i, p)} onRemove={() => removeListItem("ce_tasarim", i)} rk={`${r.uid}`} />
                ))}
                <button type="button" onClick={() => addListItem("ce_tasarim")} className="text-xs font-semibold text-brand hover:underline">+ Tasarım İnceleme Ekle</button>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.ce_b.map((r, i) => (
                  <DocRow key={r.uid} ad={`Mod B Belgesi ${i + 1}`} row={r} nbs={notifiedBodies} showBelgeNo showNb
                    onChange={(p) => setListItem("ce_b", i, p)} onRemove={() => removeListItem("ce_b", i)} rk={`${r.uid}`} />
                ))}
                <button type="button" onClick={() => addListItem("ce_b")} className="text-xs font-semibold text-brand hover:underline">+ Mod B Ekle</button>
                <DocRow ad="Mod E Belgesi" row={docs.ce_e} nbs={notifiedBodies} showBelgeNo showNb onChange={(p) => setSingle("ce_e", p)} rk={`${docKey}-e`} />
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function DocRow({
  ad, row, nbs, showBelgeNo, showNb, onChange, onRemove, rk,
}: {
  ad: string; row: Row; nbs: NB[]; showBelgeNo?: boolean; showNb?: boolean;
  onChange: (p: Partial<Row>) => void; onRemove?: () => void; rk: string;
}) {
  const durum = belgeDurum(row.valid_until, !!row.original_name || !!row.file);
  const nb = nbs.find((n) => n.id === row.notified_body_id);
  const dinp = "w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  return (
    <div className="border border-slate-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-800">{ad}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${BADGE[durum.c]}`}>{durum.t}</span>
          {onRemove && <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:underline">Sil</button>}
        </div>
      </div>
      {row.id && row.original_name && (
        <div className="mb-2 text-xs">
          <a href={`/api/belge/musteri?id=${row.id}`} target="_blank" rel="noreferrer" className="text-navy font-semibold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-rounded text-[15px]">description</span>{row.original_name}
          </a>
        </div>
      )}
      {showBelgeNo && (
        <div className="mb-2">
          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Belge No</label>
          <input value={row.belge_no} onChange={(e) => onChange({ belge_no: e.target.value })} className={dinp} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Veriliş Tarihi</label>
          <input type="date" value={row.issue_date} onChange={(e) => onChange({ issue_date: e.target.value })} className={dinp} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Geçerlilik Tarihi</label>
          <input type="date" value={row.valid_until} onChange={(e) => onChange({ valid_until: e.target.value })} className={dinp} />
        </div>
      </div>
      {showNb && (
        <div className="grid grid-cols-[1fr_90px] gap-2 mb-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Onaylanmış Kuruluş</label>
            <select value={row.notified_body_id} onChange={(e) => onChange({ notified_body_id: e.target.value })} className={dinp}>
              <option value="">Seçiniz…</option>
              {nbs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Kuruluş No</label>
            <input value={nb?.identity_no ?? ""} disabled className={dinp + " bg-slate-100"} />
          </div>
        </div>
      )}
      <input key={rk} type="file" onChange={(e) => onChange({ file: e.target.files?.[0] ?? null })}
        className="text-xs w-full file:mr-2 file:text-xs file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
      {row.file && <div className="mt-1 text-xs text-slate-500">Yeni: {row.file.name}</div>}
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 mb-1">{children}</label>;
}
