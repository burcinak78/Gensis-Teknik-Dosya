"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createEquipmentModel, updateEquipmentModel, createCertificate, createNotifiedBody } from "../actions";

type Cat = { id: string; name: string };
type Brand = { id: string; category_id: string; name: string };
type Model = { id: string; brand_id: string; name: string; certificate_id: string | null };
type Cert = { id: string; cert_no: string; notified_body_id: string | null; issue_date: string | null; valid_until: string | null };
type CertFile = { certificate_id: string; original_name: string | null };
type NB = { id: string; identity_no: string | null; name: string };

const BADGE: Record<string, string> = {
  green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-500",
};
function belgeDurum(validUntil: string | null | undefined, hasFile: boolean): { t: string; c: string } {
  if (!validUntil) return hasFile ? { t: "Tarihsiz", c: "slate" } : { t: "Yok", c: "slate" };
  const d = new Date(validUntil); const now = new Date(); now.setHours(0, 0, 0, 0);
  const in30 = new Date(now); in30.setMonth(in30.getMonth() + 1);
  if (d < now) return { t: "Geçersiz", c: "red" };
  if (d < in30) return { t: "1 aydan az", c: "amber" };
  return { t: "Geçerli", c: "green" };
}

export default function EkipmanClient({
  categories, brands, models, certificates, certFiles, notifiedBodies,
}: { categories: Cat[]; brands: Brand[]; models: Model[]; certificates: Cert[]; certFiles: CertFile[]; notifiedBodies: NB[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  // form (ekipman)
  const [editId, setEditId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [modelName, setModelName] = useState("");
  // form (sertifika)
  const [certNo, setCertNo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [nbId, setNbId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [curCertId, setCurCertId] = useState<string | null>(null);
  // yeni onaylanmış kuruluş
  const [nbOpen, setNbOpen] = useState(false);
  const [nbForm, setNbForm] = useState({ name: "", identity_no: "", address: "" });

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
  const formRef = useRef<HTMLFormElement>(null);
  const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

  const certById = useMemo(() => new Map(certificates.map((c) => [c.id, c])), [certificates]);
  const fileByCert = useMemo(() => new Map(certFiles.map((f) => [f.certificate_id, f.original_name])), [certFiles]);
  const catBrands = useMemo(() => brands.filter((b) => b.category_id === categoryId), [brands, categoryId]);
  const nb = notifiedBodies.find((n) => n.id === nbId);
  const s = q.trim().toLocaleLowerCase("tr");
  const match = (m: Model, b: Brand) => !s || m.name.toLocaleLowerCase("tr").includes(s) || b.name.toLocaleLowerCase("tr").includes(s);
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function resetForm() {
    setEditId(null); setCategoryId(""); setBrandId(""); setNewBrand(""); setModelName("");
    setCertNo(""); setIssueDate(""); setValidUntil(""); setNbId(""); setFile(null); setCurCertId(null);
    setFileKey((k) => k + 1); setNbOpen(false); setMsg(null);
  }
  function yeni() { resetForm(); scrollToForm(); }

  function startEdit(m: Model, b: Brand) {
    setEditId(m.id);
    setCategoryId(b.category_id); setBrandId(b.id); setNewBrand(""); setModelName(m.name);
    const c = m.certificate_id ? certById.get(m.certificate_id) : undefined;
    setCurCertId(c?.id ?? null);
    setCertNo(c?.cert_no ?? ""); setIssueDate(c?.issue_date ?? ""); setValidUntil(c?.valid_until ?? "");
    setNbId(c?.notified_body_id ?? ""); setFile(null); setFileKey((k) => k + 1);
    setNbOpen(false); setMsg(null); scrollToForm();
  }

  async function kurulusEkle() {
    if (!nbForm.name.trim()) { setMsg({ ok: false, text: "Kuruluş adı zorunlu." }); return; }
    setBusy(true); setMsg(null);
    const res = await createNotifiedBody(nbForm);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Onaylanmış kuruluş eklendi." });
      if (res.id) setNbId(res.id);
      setNbForm({ name: "", identity_no: "", address: "" }); setNbOpen(false);
      router.refresh();
    } else setMsg({ ok: false, text: res.error });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelName.trim()) { setMsg({ ok: false, text: "Model adı zorunlu." }); return; }
    if (!editId && !categoryId) { setMsg({ ok: false, text: "Kategori seçin." }); return; }
    setBusy(true); setMsg(null);

    let modelId = editId;
    if (editId) {
      const r = await updateEquipmentModel({ id: editId, name: modelName, certificate_id: curCertId ?? "" });
      if (!r.ok) { setBusy(false); setMsg({ ok: false, text: r.error }); return; }
    } else {
      const r = await createEquipmentModel({ category_id: categoryId, brand_id: brandId, new_brand: newBrand, model_name: modelName, certificate_id: "" });
      if (!r.ok) { setBusy(false); setMsg({ ok: false, text: r.error }); return; }
      modelId = r.id ?? null;
    }

    // sertifika (no girildiyse kaydet/güncelle + dosya + modele bağla)
    let certErr: string | null = null;
    if (certNo.trim()) {
      const fd = new FormData();
      fd.set("cert_no", certNo.trim());
      fd.set("notified_body_id", nbId);
      fd.set("issue_date", issueDate);
      fd.set("valid_until", validUntil);
      if (modelId) fd.set("model_id", modelId);
      if (file) fd.set("file", file);
      const rc = await createCertificate(fd);
      if (!rc.ok) certErr = rc.error;
    }

    setBusy(false); setFile(null); setFileKey((k) => k + 1);
    if (certErr) setMsg({ ok: false, text: "Model kaydedildi, sertifika hatası: " + certErr });
    else setMsg({ ok: true, text: editId ? "Kaydedildi." : "Ekipman ve sertifika kaydedildi." });
    router.refresh();
    if (!editId) resetForm();
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={yeni} className="gs-btn text-sm font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[18px]">add</span> Yeni Ekipman Ekle
        </button>
      </div>

      {/* Liste (tam genişlik) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marka veya model ara…" className={inp} />
        </div>
        <div>
          {categories.map((cat) => {
            const catBs = brands.filter((b) => b.category_id === cat.id);
            const rows = catBs.map((b) => ({ b, ms: models.filter((m) => m.brand_id === b.id && match(m, b)) })).filter((x) => x.ms.length > 0);
            const total = rows.reduce((a, x) => a + x.ms.length, 0);
            if (s && total === 0) return null;
            const isOpen = open.has(cat.id) || !!s;
            return (
              <div key={cat.id} className="border-b border-slate-100 last:border-0">
                <button type="button" onClick={() => toggle(cat.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <span className="font-semibold text-sm">{cat.name}</span>
                  <span className="text-xs text-slate-400">{total} model {isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="pb-2">
                    {rows.map(({ b, ms }) => (
                      <div key={b.id} className="px-5 py-1">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-2 mb-1">{b.name}</div>
                        {ms.map((m) => {
                          const c = m.certificate_id ? certById.get(m.certificate_id) : undefined;
                          const du = belgeDurum(c?.valid_until, !!(c && fileByCert.get(c.id)));
                          return (
                            <div key={m.id} className={`flex items-center justify-between py-1.5 pl-2 border-l-2 ${editId === m.id ? "border-brand bg-brand-light/50" : "border-slate-100"}`}>
                              <span className="text-sm">
                                {m.name}
                                {c ? <span className="ml-2 text-xs text-slate-500">· {c.cert_no}</span> : <span className="ml-2 text-xs text-slate-400">sertifika yok</span>}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${BADGE[du.c]}`}>{du.t}</span>
                                <button type="button" onClick={() => startEdit(m, b)} className="text-xs font-semibold text-brand hover:underline">Düzenle</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sol: ekipman · Sağ: sertifika — tek Kaydet */}
      <form ref={formRef} onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start scroll-mt-6">
        {/* Sol */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{editId ? "Ekipman Düzenle" : "Yeni Ekipman-Model"}</h2>
            {editId && <button type="button" onClick={yeni} className="text-xs font-semibold text-brand hover:underline">+ Yeni</button>}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori *</label>
              <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setBrandId(""); }} className={inp} disabled={!!editId}>
                <option value="">Seçiniz…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Marka (mevcut)</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp} disabled={!categoryId || !!editId}>
                <option value="">{categoryId ? "Seçiniz veya yeni ekleyin…" : "Önce kategori seçin"}</option>
                {catBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {!editId && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">…veya Yeni Marka</label>
                <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className={inp} placeholder="Marka listede yoksa buraya yazın" disabled={!!brandId} />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Model Adı *</label>
              <input value={modelName} onChange={(e) => setModelName(e.target.value)} className={inp} />
            </div>
          </div>
          {msg && <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
          <button disabled={busy} className="mt-4 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
            {busy ? "Kaydediliyor…" : editId ? "Değişiklikleri Kaydet" : "Ekipmanı Kaydet"}
          </button>
        </div>

        {/* Sağ: sertifika */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-bold mb-1">Sertifika</h2>
          <p className="text-xs text-slate-400 mb-3">Sertifika no girilirse kaydedilir ve modele bağlanır. 1 aydan az kalınca sarı, dolunca kırmızı.</p>

          {curCertId && fileByCert.get(curCertId) && (
            <div className="mb-3 text-xs">
              <a href={`/api/belge/sertifika?id=${curCertId}`} target="_blank" rel="noreferrer" className="text-navy font-semibold hover:underline inline-flex items-center gap-1">
                <span className="material-symbols-rounded text-[15px]">description</span>{fileByCert.get(curCertId)}
              </a>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Sertifika No</label>
              <input value={certNo} onChange={(e) => setCertNo(e.target.value)} className={inp} placeholder="Örn. LDsq08-0117-0240-24" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Veriliş Tarihi</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Geçerlilik Tarihi</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Onaylanmış Kuruluş</label>
                <select value={nbId} onChange={(e) => setNbId(e.target.value)} className={inp}>
                  <option value="">Seçiniz…</option>
                  {notifiedBodies.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kuruluş No</label>
                <input value={nb?.identity_no ?? ""} disabled className={inp + " bg-slate-100"} />
              </div>
            </div>

            <button type="button" onClick={() => setNbOpen((o) => !o)} className="text-xs font-semibold text-brand hover:underline">
              {nbOpen ? "− Vazgeç" : "+ Yeni Onaylanmış Kuruluş Ekle"}
            </button>
            {nbOpen && (
              <div className="border border-brand/30 bg-brand-light/40 rounded-xl p-3 space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Kuruluş Adı *</label>
                  <input value={nbForm.name} onChange={(e) => setNbForm((f) => ({ ...f, name: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Kuruluş Numarası</label>
                  <input value={nbForm.identity_no} onChange={(e) => setNbForm((f) => ({ ...f, identity_no: e.target.value }))} className={inp} placeholder="Örn. 2528" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Adres</label>
                  <input value={nbForm.address} onChange={(e) => setNbForm((f) => ({ ...f, address: e.target.value }))} className={inp} />
                </div>
                <button type="button" onClick={kurulusEkle} disabled={busy}
                  className="bg-brand hover:bg-brand-dark text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">
                  Kuruluşu Ekle
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Sertifika Dosyası (PDF)</label>
              <input key={fileKey} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-xs w-full file:mr-2 file:text-xs file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
              {file && <div className="mt-1 text-xs text-slate-500">Yeni: {file.name}</div>}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
