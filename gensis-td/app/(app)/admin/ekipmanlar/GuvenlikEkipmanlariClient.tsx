"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCertificate, updateCertificate, deleteCertificate, createNotifiedBody,
  createEquipmentModel, updateEquipmentModel, deleteEquipmentModel, createEquipmentBrand,
} from "../actions";

type Cat = { id: string; name: string };
type Brand = { id: string; category_id: string; name: string };
type Model = { id: string; brand_id: string; name: string; certificate_id: string | null };
type Cert = { id: string; cert_no: string; notified_body_id: string | null; issue_date: string | null; valid_until: string | null; belge_tipi: string | null; category_id: string | null; firma_adi: string | null };
type NB = { id: string; identity_no: string | null; name: string; address: string | null };
type ModelCert = { model_id: string; certificate_id: string };

const BELGE_TIPI = [
  { v: "mod_b", t: "Mod B" },
  { v: "mod_c2", t: "Mod C2" },
  { v: "uygunluk_beyani", t: "Uygunluk Beyanı" },
  { v: "yangin", t: "Yangın Sertifikası" },
  { v: "deney_raporu", t: "Deney Raporu" },
];
const BELGE_TIPI_TR: Record<string, string> = Object.fromEntries(BELGE_TIPI.map((b) => [b.v, b.t]));

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const fInp = "w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-brand";
const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
const td = "px-3 py-2 text-sm whitespace-nowrap";
const fTh = "px-3 py-1.5 align-top";
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("tr-TR") : "—");
const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");
// Geçerlilik durumu: süresi geçen kırmızı, 1 aydan az sarı
function certDurum(valid: string | null | undefined): { t: string; c: string } | null {
  if (!valid) return null;
  const d = new Date(valid); const now = new Date(); now.setHours(0, 0, 0, 0);
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
  if (d < now) return { t: "Geçersiz", c: "text-red-600 font-bold" };
  if (d < in30) return { t: "1 aydan az", c: "text-amber-600 font-semibold" };
  return null;
}

export default function GuvenlikEkipmanlariClient({
  categories, brands, models, certificates, certFileMap, notifiedBodies, modelCerts, isAdmin = false,
}: {
  categories: Cat[]; brands: Brand[]; models: Model[]; certificates: Cert[];
  certFileMap: Record<string, string>; notifiedBodies: NB[]; modelCerts: ModelCert[]; isAdmin?: boolean;
}) {
  const [tab, setTab] = useState<"sertifika" | "ekipman">("sertifika");
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const brandById = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b])), [brands]);
  const certById = useMemo(() => Object.fromEntries(certificates.map((c) => [c.id, c])), [certificates]);
  const certsByModel = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const mc of modelCerts) (m[mc.model_id] ||= []).push(mc.certificate_id);
    return m;
  }, [modelCerts]);

  return (
    <div>
      {/* Alt sekmeler — sabit (listeyle kaymaz) */}
      <div className="flex gap-1 border-b border-slate-200 sticky top-[92px] z-30 bg-white -mx-8 px-8">
        {[{ v: "sertifika", t: "Sertifika" }, { v: "ekipman", t: "Güvenlik Ekipmanı" }].map((s) => (
          <button key={s.v} onClick={() => setTab(s.v as any)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-[2.5px] -mb-px transition ${tab === s.v ? "text-navy border-navy" : "text-slate-400 border-transparent hover:text-slate-600"}`}>
            {s.t}
          </button>
        ))}
      </div>

      {tab === "sertifika"
        ? <SertifikaTab categories={categories} certificates={certificates} certFileMap={certFileMap} notifiedBodies={notifiedBodies} catById={catById} isAdmin={isAdmin} />
        : <EkipmanTab categories={categories} brands={brands} models={models} certificates={certificates} catById={catById} brandById={brandById} certById={certById} certsByModel={certsByModel} isAdmin={isAdmin} />}
    </div>
  );
}

/* ============================ SERTİFİKA ============================ */
function SertifikaTab({ categories, certificates, certFileMap, notifiedBodies, catById, isAdmin }: {
  categories: Cat[]; certificates: Cert[]; certFileMap: Record<string, string>; notifiedBodies: NB[]; catById: Record<string, Cat>; isAdmin: boolean;
}) {
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fil, setFil] = useState({ kategori: "", belge: "", certNo: "", firma: "", gecerlilik: "" });
  const [modal, setModal] = useState<null | { cert?: Cert }>(null);
  const firmaOptions = useMemo(() => Array.from(new Set(certificates.map((c) => c.firma_adi).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "tr")), [certificates]);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    return certificates.filter((c) => {
      const gStr = dt(c.valid_until);
      if (s) {
        const hay = [c.cert_no, catById[c.category_id ?? ""]?.name, BELGE_TIPI_TR[c.belge_tipi ?? ""], c.firma_adi, gStr].map(tc).join(" ");
        if (!hay.includes(s)) return false;
      }
      if (fil.kategori && c.category_id !== fil.kategori) return false;
      if (fil.belge && c.belge_tipi !== fil.belge) return false;
      if (fil.certNo && !tc(c.cert_no).includes(tc(fil.certNo))) return false;
      if (fil.firma && !tc(c.firma_adi).includes(tc(fil.firma))) return false;
      if (fil.gecerlilik && !tc(gStr).includes(tc(fil.gecerlilik))) return false;
      return true;
    });
  }, [q, fil, certificates]);

  return (
    <div>
      <Toolbar onNew={() => setModal({})} newLabel="+ Yeni Sertifika" q={q} setQ={setQ} showFilters={showFilters} setShowFilters={setShowFilters} placeholder="Ara: sertifika no, kategori, belge tipi…" />
      <div className="bg-white border border-slate-200 rounded-2xl mt-4">
        <div>
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-[188px] z-20">
              <tr>
                <th className={th}>Kategori</th><th className={th}>Belge Tipi</th><th className={th}>Sertifika No</th><th className={th}>Firma</th><th className={th}>Geçerlilik Tarihi</th><th className={th}>İşlem</th>
              </tr>
              {showFilters && (
                <tr className="bg-white border-b border-slate-200">
                  <th className={fTh}>
                    <select className={fInp} value={fil.kategori} onChange={(e) => setFil((s) => ({ ...s, kategori: e.target.value }))}>
                      <option value="">Hepsi</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </th>
                  <th className={fTh}>
                    <select className={fInp} value={fil.belge} onChange={(e) => setFil((s) => ({ ...s, belge: e.target.value }))}>
                      <option value="">Hepsi</option>{BELGE_TIPI.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
                    </select>
                  </th>
                  <th className={fTh}><input className={fInp} value={fil.certNo} onChange={(e) => setFil((s) => ({ ...s, certNo: e.target.value }))} placeholder="Sertifika No" /></th>
                  <th className={fTh}><input className={fInp} value={fil.firma} onChange={(e) => setFil((s) => ({ ...s, firma: e.target.value }))} placeholder="Firma" /></th>
                  <th className={fTh}><input className={fInp} value={fil.gecerlilik} onChange={(e) => setFil((s) => ({ ...s, gecerlilik: e.target.value }))} placeholder="gg.aa.yyyy" /></th>
                  <th className={fTh}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((c) => {
                const du = certDurum(c.valid_until);
                return (
                  <tr key={c.id} className={"border-b border-slate-100 last:border-0" + (du?.c.includes("red") ? " bg-red-50/40" : "")}>
                    <td className={td}>{catById[c.category_id ?? ""]?.name ?? "—"}</td>
                    <td className={td}>{BELGE_TIPI_TR[c.belge_tipi ?? ""] ?? "—"}</td>
                    <td className={td + " font-semibold"}>{c.cert_no}</td>
                    <td className={td + " text-slate-500"}>{c.firma_adi || "—"}</td>
                    <td className={td + (du ? " " + du.c : " text-slate-500")}>{dt(c.valid_until)}{du && <span className="ml-1 text-[10px]">({du.t})</span>}</td>
                    <td className={td + " text-right"}><button onClick={() => setModal({ cert: c })} className="text-xs font-bold text-brand hover:underline">Düzenle</button></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <SertifikaModal cert={modal.cert} categories={categories} notifiedBodies={notifiedBodies} certFileMap={certFileMap} firmaOptions={firmaOptions} isAdmin={isAdmin} onClose={() => setModal(null)} />}
    </div>
  );
}

function SertifikaModal({ cert, categories, notifiedBodies, certFileMap, firmaOptions, isAdmin, onClose }: {
  cert?: Cert; categories: Cat[]; notifiedBodies: NB[]; certFileMap: Record<string, string>; firmaOptions: string[]; isAdmin: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!cert;
  const [f, setF] = useState({
    category_id: cert?.category_id ?? "", belge_tipi: cert?.belge_tipi ?? "", cert_no: cert?.cert_no ?? "",
    valid_until: cert?.valid_until ?? "", notified_body_id: cert?.notified_body_id ?? "", firma_adi: cert?.firma_adi ?? "",
  });
  const [suresiz, setSuresiz] = useState(cert ? !cert.valid_until : true); // varsayılan: süresiz
  const [file, setFile] = useState<File | null>(null);
  const [nbs, setNbs] = useState<NB[]>(notifiedBodies);
  const [showNb, setShowNb] = useState(false);
  const [nb, setNb] = useState({ name: "", identity_no: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const bad = (v: string) => touched && !v;
  const req = (v: string) => (bad(v) ? " !border-red-300 !bg-red-50" : "");
  const existingFile = cert ? certFileMap[cert.id] : "";

  async function addNb() {
    if (!nb.name.trim()) return setErr("Kuruluş adı zorunlu.");
    const res = await createNotifiedBody(nb);
    if (!res.ok) return setErr(res.error);
    const n: NB = { id: (res as any).id, name: nb.name.trim(), identity_no: nb.identity_no.trim() || null, address: nb.address.trim() || null };
    setNbs((a) => [...a, n]); set("notified_body_id", n.id); setNb({ name: "", identity_no: "", address: "" }); setShowNb(false); setErr(null);
  }

  async function submit() {
    setTouched(true); setErr(null);
    if (!f.category_id || !f.belge_tipi || !f.cert_no.trim() || !f.notified_body_id || !f.firma_adi.trim()) return setErr("Tüm alanları doldurun.");
    if (!suresiz && !f.valid_until) return setErr("Geçerlilik tarihini girin veya 'Süresiz' seçin.");
    if (!isEdit && !file) return setErr("Sertifika dosyasını yükleyin.");
    if (file && !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) return setErr("Sertifika dosyası yalnızca PDF olabilir.");
    setBusy(true);
    const fd = new FormData();
    if (isEdit) fd.set("id", cert!.id);
    fd.set("category_id", f.category_id); fd.set("belge_tipi", f.belge_tipi); fd.set("cert_no", f.cert_no.trim());
    fd.set("valid_until", suresiz ? "" : f.valid_until); fd.set("notified_body_id", f.notified_body_id); fd.set("firma_adi", f.firma_adi.trim());
    if (file) fd.set("file", file);
    const res = isEdit ? await updateCertificate(fd) : await createCertificate(fd);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    router.refresh(); onClose();
  }
  async function sil() {
    if (!cert) return;
    if (!confirm(`"${cert.cert_no}" sertifikası silinsin mi?`)) return;
    setBusy(true);
    const res = await deleteCertificate(cert.id);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    router.refresh(); onClose();
  }

  return (
    <Overlay title={isEdit ? "Sertifika Düzenle" : "Yeni Sertifika"} onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Kategori *"><select className={inp + req(f.category_id)} value={f.category_id} onChange={(e) => set("category_id", e.target.value)}><option value="">Seçiniz…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Belge Tipi *"><select className={inp + req(f.belge_tipi)} value={f.belge_tipi} onChange={(e) => set("belge_tipi", e.target.value)}><option value="">Seçiniz…</option>{BELGE_TIPI.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}</select></Field>
        <Field label="Sertifika No *"><input className={inp + req(f.cert_no)} value={f.cert_no} onChange={(e) => set("cert_no", e.target.value)} /></Field>
        <Field label="Geçerlilik Tarihi">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-1.5 cursor-pointer">
            <input type="checkbox" checked={suresiz} onChange={(e) => setSuresiz(e.target.checked)} className="w-4 h-4 accent-brand" /> Süresiz
          </label>
          <input type="date" disabled={suresiz} className={inp + (suresiz ? " bg-slate-50 text-slate-400" : "")} value={suresiz ? "" : f.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
        </Field>
        <Field label="Onaylanmış Kuruluş *">
          <div className="flex gap-2">
            <select className={inp + req(f.notified_body_id)} value={f.notified_body_id} onChange={(e) => set("notified_body_id", e.target.value)}>
              <option value="">Seçiniz…</option>{nbs.map((n) => <option key={n.id} value={n.id}>{n.identity_no ? `${n.identity_no} · ` : ""}{n.name}</option>)}
            </select>
            <button type="button" onClick={() => setShowNb((v) => !v)} className="flex-none text-xs font-bold text-brand border border-brand/30 rounded-lg px-2 hover:bg-brand-light whitespace-nowrap">{showNb ? "Kapat" : "+ Yeni"}</button>
          </div>
        </Field>
        <Field label="Verildiği Firma *">
          <input list="cert-firma-list" className={inp + req(f.firma_adi)} value={f.firma_adi} onChange={(e) => set("firma_adi", e.target.value)} placeholder="Listeden seç ya da yeni firma yaz" />
          <datalist id="cert-firma-list">{firmaOptions.map((o) => <option key={o} value={o} />)}</datalist>
        </Field>
        <Field label="Sertifika Dosyası (PDF) *">
          {existingFile && <a href={`/api/belge/sertifika?id=${cert!.id}`} target="_blank" rel="noreferrer" className="block text-xs text-navy font-semibold hover:underline mb-1">📎 {existingFile}</a>}
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs w-full file:mr-2 file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
          {file && <div className="mt-1 text-xs text-slate-500">Yeni: {file.name}</div>}
        </Field>
      </div>

      {showNb && (
        <div className="mt-3 bg-brand-light/40 border border-brand/15 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-slate-600">Yeni Onaylanmış Kuruluş</p>
          <div className="grid grid-cols-3 gap-2">
            <input className={inp} placeholder="Adı *" value={nb.name} onChange={(e) => setNb((s) => ({ ...s, name: e.target.value }))} />
            <input className={inp} placeholder="No" value={nb.identity_no} onChange={(e) => setNb((s) => ({ ...s, identity_no: e.target.value }))} />
            <input className={inp} placeholder="Adres" value={nb.address} onChange={(e) => setNb((s) => ({ ...s, address: e.target.value }))} />
          </div>
          <div className="flex justify-end"><button type="button" onClick={addNb} className="text-xs font-bold text-white bg-brand hover:bg-brand-dark px-4 py-2 rounded-lg">Ekle ve Seç</button></div>
        </div>
      )}

      {err && <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
      <div className="flex items-center justify-end gap-2 pt-3">
        {isEdit && isAdmin && <button type="button" onClick={sil} disabled={busy} className="mr-auto text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">Sil</button>}
        <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
        <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">{busy ? "Kaydediliyor…" : "Kaydet"}</button>
      </div>
    </Overlay>
  );
}

/* ============================ EKİPMAN ============================ */
function EkipmanTab({ categories, brands, models, certificates, catById, brandById, certById, certsByModel, isAdmin }: {
  categories: Cat[]; brands: Brand[]; models: Model[]; certificates: Cert[];
  catById: Record<string, Cat>; brandById: Record<string, Brand>; certById: Record<string, Cert>; certsByModel: Record<string, string[]>; isAdmin: boolean;
}) {
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fil, setFil] = useState({ kategori: "", marka: "", model: "", belge: "" });
  const [modal, setModal] = useState<null | { model?: Model }>(null);

  const modelCatId = (m: Model) => brandById[m.brand_id]?.category_id ?? "";
  const modelCertIds = (m: Model) => certsByModel[m.id] ?? (m.certificate_id ? [m.certificate_id] : []);
  // Ekipmana bağlı sertifikaların belge tipleri (benzersiz)
  const modelBelgeSet = (m: Model) => {
    const set = new Set<string>();
    for (const id of modelCertIds(m)) { const bt = certById[id]?.belge_tipi; if (bt) set.add(bt); }
    return set;
  };
  const modelBelgeTipleri = (m: Model) => {
    const labels = Array.from(modelBelgeSet(m)).map((v) => BELGE_TIPI_TR[v] ?? v);
    return labels.length ? labels.join(", ") : "—";
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    return models.filter((m) => {
      const b = brandById[m.brand_id];
      const catId = b?.category_id ?? "";
      const belgeTxt = modelBelgeTipleri(m);
      if (s) {
        const hay = [m.name, b?.name, catById[catId]?.name, belgeTxt].map(tc).join(" ");
        if (!hay.includes(s)) return false;
      }
      if (fil.kategori && catId !== fil.kategori) return false;
      if (fil.marka && m.brand_id !== fil.marka) return false;
      if (fil.model && !tc(m.name).includes(tc(fil.model))) return false;
      if (fil.belge && !modelBelgeSet(m).has(fil.belge)) return false;
      return true;
    });
  }, [q, fil, models]);

  return (
    <div>
      <Toolbar onNew={() => setModal({})} newLabel="+ Yeni Ekipman Ekle" q={q} setQ={setQ} showFilters={showFilters} setShowFilters={setShowFilters} placeholder="Ara: kategori, marka, model, belge tipi…" />
      <div className="bg-white border border-slate-200 rounded-2xl mt-4">
        <div>
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-[188px] z-20">
              <tr><th className={th}>Kategori</th><th className={th}>Marka</th><th className={th}>Model</th><th className={th}>Belge Tipleri</th><th className={th}>İşlem</th></tr>
              {showFilters && (
                <tr className="bg-white border-b border-slate-200">
                  <th className={fTh}><select className={fInp} value={fil.kategori} onChange={(e) => setFil((s) => ({ ...s, kategori: e.target.value, marka: "" }))}><option value="">Hepsi</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></th>
                  <th className={fTh}><select className={fInp} value={fil.marka} onChange={(e) => setFil((s) => ({ ...s, marka: e.target.value }))}><option value="">Hepsi</option>{brands.filter((b) => !fil.kategori || b.category_id === fil.kategori).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></th>
                  <th className={fTh}><input className={fInp} value={fil.model} onChange={(e) => setFil((s) => ({ ...s, model: e.target.value }))} placeholder="Model" /></th>
                  <th className={fTh}><select className={fInp} value={fil.belge} onChange={(e) => setFil((s) => ({ ...s, belge: e.target.value }))}><option value="">Hepsi</option>{BELGE_TIPI.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}</select></th>
                  <th className={fTh}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className={td}>{catById[modelCatId(m)]?.name ?? "—"}</td>
                  <td className={td}>{brandById[m.brand_id]?.name ?? "—"}</td>
                  <td className={td + " font-semibold"}>{m.name}</td>
                  <td className={td + " text-slate-500"}>{modelBelgeTipleri(m)}</td>
                  <td className={td + " text-right"}><button onClick={() => setModal({ model: m })} className="text-xs font-bold text-brand hover:underline">Düzenle</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">Kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <EkipmanModal model={modal.model} categories={categories} brands={brands} certificates={certificates} certsByModel={certsByModel} brandById={brandById} isAdmin={isAdmin} onClose={() => setModal(null)} />}
    </div>
  );
}

function EkipmanModal({ model, categories, brands, certificates, certsByModel, brandById, isAdmin, onClose }: {
  model?: Model; categories: Cat[]; brands: Brand[]; certificates: Cert[]; certsByModel: Record<string, string[]>; brandById: Record<string, Brand>; isAdmin: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!model;
  const initCat = model ? (brandById[model.brand_id]?.category_id ?? "") : "";
  const initCerts = model ? (certsByModel[model.id] ?? (model.certificate_id ? [model.certificate_id] : [])) : [];
  const [category_id, setCategory] = useState(initCat);
  const [brand_id, setBrand] = useState(model?.brand_id ?? "");
  const [model_name, setModelName] = useState(model?.name ?? "");
  const [certIds, setCertIds] = useState<string[]>(initCerts);
  const [belgeFilter, setBelgeFilter] = useState("");
  const [brandList, setBrandList] = useState<Brand[]>(brands);
  const [showBrand, setShowBrand] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const req = (v: string) => (touched && !v ? " !border-red-300 !bg-red-50" : "");

  const catBrands = brandList.filter((b) => b.category_id === category_id);
  const catCerts = certificates.filter((c) => c.category_id === category_id && (!belgeFilter || c.belge_tipi === belgeFilter));
  const toggleCert = (id: string) => setCertIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function addBrand() {
    if (!category_id) return setErr("Önce kategori seçin.");
    if (!newBrand.trim()) return setErr("Marka adı zorunlu.");
    const res = await createEquipmentBrand({ category_id, name: newBrand });
    if (!res.ok) return setErr(res.error);
    const b: Brand = { id: (res as any).id, category_id, name: newBrand.trim() };
    setBrandList((a) => [...a, b]); setBrand(b.id); setNewBrand(""); setShowBrand(false); setErr(null);
  }

  async function submit() {
    setTouched(true); setErr(null);
    if (!category_id) return setErr("Kategori seçin.");
    if (!brand_id) return setErr("Marka seçin veya ekleyin.");
    if (!model_name.trim()) return setErr("Model adı zorunlu.");
    setBusy(true);
    const res = isEdit
      ? await updateEquipmentModel({ id: model!.id, name: model_name.trim(), cert_ids: certIds })
      : await createEquipmentModel({ category_id, brand_id, new_brand: "", model_name: model_name.trim(), cert_ids: certIds });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    router.refresh(); onClose();
  }
  async function sil() {
    if (!model) return;
    if (!confirm(`"${model.name}" modeli silinsin mi?`)) return;
    setBusy(true);
    const res = await deleteEquipmentModel(model.id);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    router.refresh(); onClose();
  }

  return (
    <Overlay title={isEdit ? "Ekipman Düzenle" : "Yeni Güvenlik Ekipmanı"} onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Kategori *">
          <select className={inp + req(category_id)} value={category_id} disabled={isEdit} onChange={(e) => { setCategory(e.target.value); setBrand(""); setCertIds([]); }}>
            <option value="">Seçiniz…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Marka *">
          <div className="flex gap-2">
            <select className={inp + req(brand_id)} value={brand_id} disabled={!category_id} onChange={(e) => setBrand(e.target.value)}>
              <option value="">{category_id ? "Seçiniz…" : "Önce kategori"}</option>{catBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button type="button" onClick={() => setShowBrand((v) => !v)} disabled={!category_id} className="flex-none text-xs font-bold text-brand border border-brand/30 rounded-lg px-2 hover:bg-brand-light whitespace-nowrap disabled:opacity-40">{showBrand ? "Kapat" : "+ Marka"}</button>
          </div>
        </Field>
        <Field label="Model Adı *"><input className={inp + req(model_name)} value={model_name} onChange={(e) => setModelName(e.target.value)} /></Field>
        <Field label="Belge Tipi (filtre)">
          <select className={inp} value={belgeFilter} onChange={(e) => setBelgeFilter(e.target.value)}>
            <option value="">Tüm belge tipleri</option>{BELGE_TIPI.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
          </select>
        </Field>
      </div>

      {showBrand && (
        <div className="mt-2 bg-brand-light/40 border border-brand/15 rounded-lg p-3 flex gap-2 items-end">
          <div className="flex-1"><label className="block text-xs font-semibold text-slate-600 mb-1">Yeni Marka Adı</label><input className={inp} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} /></div>
          <button type="button" onClick={addBrand} className="text-xs font-bold text-white bg-brand hover:bg-brand-dark px-4 py-2.5 rounded-lg">Ekle</button>
        </div>
      )}

      {/* Sertifika Bağla / Belge Bağla */}
      <div className="mt-3">
        <label className="block text-xs font-semibold text-slate-600 mb-1">Sertifika Bağla (birden fazla seçilebilir)</label>
        <div className="border border-slate-200 rounded-lg p-2 max-h-52 overflow-y-auto space-y-1">
          {!category_id && <p className="text-xs text-slate-400 px-1 py-2">Önce kategori seçin.</p>}
          {category_id && catCerts.length === 0 && <p className="text-xs text-slate-400 px-1 py-2">Bu kategoride {belgeFilter ? "seçili belge tipinde " : ""}sertifika yok.</p>}
          {catCerts.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={certIds.includes(c.id)} onChange={() => toggleCert(c.id)} className="w-4 h-4 accent-brand" />
              <span className="font-semibold">{c.cert_no}</span>
              {c.belge_tipi && <span className="text-[11px] text-slate-400">· {BELGE_TIPI_TR[c.belge_tipi]}</span>}
            </label>
          ))}
        </div>
        {certIds.length > 0 && <p className="text-[11px] text-slate-500 mt-1">{certIds.length} sertifika bağlı.</p>}
      </div>

      {err && <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
      <div className="flex items-center justify-end gap-2 pt-3">
        {isEdit && isAdmin && <button type="button" onClick={sil} disabled={busy} className="mr-auto text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">Sil</button>}
        <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
        <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">{busy ? "Kaydediliyor…" : "Kaydet"}</button>
      </div>
    </Overlay>
  );
}

/* ============================ Ortak UI ============================ */
function Toolbar({ onNew, newLabel, q, setQ, showFilters, setShowFilters, placeholder }: {
  onNew: () => void; newLabel: string; q: string; setQ: (v: string) => void; showFilters: boolean; setShowFilters: (f: (v: boolean) => boolean) => void; placeholder: string;
}) {
  return (
    <div className="sticky top-[136px] z-20 bg-white -mx-8 px-8 py-3 border-b border-slate-100 flex items-center gap-3">
      <button onClick={onNew} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">{newLabel}</button>
      <div className="relative flex-1 max-w-md">
        <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={inp + " pl-10"} />
      </div>
      <button onClick={() => setShowFilters((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border ${showFilters ? "bg-brand-light text-brand border-brand/30" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
        <span className="material-symbols-rounded text-[18px]">filter_list</span> Filtrele
      </button>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>;
}
function Overlay({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-xl"} my-6`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-extrabold text-lg">{title}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
