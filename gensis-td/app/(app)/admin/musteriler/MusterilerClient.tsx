"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createCompany, updateCompany, deleteCompany, uploadCompanyDocument, deleteCompanyDocument } from "../actions";

type Company = {
  id: string; short_name: string; legal_name: string | null; address: string | null;
  phone: string | null; mobile_phone: string | null; email: string | null; city: string | null;
  authorized_person: string | null; registered_brand: string | null; industry_reg_no: string | null; ce_module: string | null;
  category?: string | null; sector?: string | null;
};
type Doc = { id: string; company_id: string; doc_type: string; original_name: string | null; issue_date: string | null; valid_until: string | null; belge_no: string | null; notified_body_id: string | null; sub_type: string | null; parent_id: string | null };
type NB = { id: string; identity_no: string | null; name: string };
type Row = { uid: string; id?: string; belge_no: string; issue_date: string; valid_until: string; notified_body_id: string; file: File | null; original_name?: string | null; sub_type?: string };
type BRow = Row & { sub_type: string; eki: Row[] };
type DocsState = { sanayi_sicil: Row; tse_hyb: Row; ce_h1: Row; ce_e: Row; ce_tasarim: Row[]; ce_b: BRow[] };

const BLANK: Record<string, string> = {
  short_name: "", legal_name: "", authorized_person: "", registered_brand: "",
  city: "", phone: "", mobile_phone: "", email: "", industry_reg_no: "", address: "", sector: "",
};
const B_TIPLERI = [
  { v: "mr", ad: "Mod B MR — Elektrikli Makine Daireli" },
  { v: "mrl", ad: "Mod B MRL — Elektrikli Makine Dairesiz" },
  { v: "hid_1_1", ad: "Mod B Hidrolik 1/1 Askı" },
  { v: "hid_2_1", ad: "Mod B Hidrolik 2/1 Askı" },
  { v: "mr_ra", ad: "Mod B- MR-RA" },
  { v: "mrl_ra", ad: "Mod B-MRL-RA" },
  { v: "hid_2_1_tandem", ad: "Mod B- Hidrolik 2/1 Askı TANDEM" },
];
const TI_TIPLERI = [
  { v: "ti_makine_dairesi", ad: "Tİ - Makine Dairesi" },
  { v: "ti_kuyu_ust", ad: "Tİ - Kuyu Üst Boşluğu" },
  { v: "ti_kuyu_dibi", ad: "Tİ - Kuyu Dibi" },
];
const ZORUNLU_ASANSOR = ["short_name", "legal_name", "authorized_person", "registered_brand", "city", "industry_reg_no", "address"];
const ZORUNLU_DIGER = ["short_name", "legal_name", "authorized_person", "sector", "city", "mobile_phone", "address"];
const BADGE: Record<string, string> = {
  green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-500",
};
const RANK: Record<string, number> = { red: 3, amber: 2, green: 1, slate: 0 };
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
const emptyRow = (): Row => ({ uid: uid(), belge_no: "", issue_date: "", valid_until: "", notified_body_id: "", file: null });
const emptyBRow = (): BRow => ({ ...emptyRow(), sub_type: "", eki: [] });
const emptyDocs = (): DocsState => ({ sanayi_sicil: emptyRow(), tse_hyb: emptyRow(), ce_h1: emptyRow(), ce_e: emptyRow(), ce_tasarim: [], ce_b: [] });

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const fInp = "w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-brand";

function fmtPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  const p: string[] = [d.slice(0, 1)];
  if (d.length > 1) p.push(d.slice(1, 4));
  if (d.length > 4) p.push(d.slice(4, 7));
  if (d.length > 7) p.push(d.slice(7, 9));
  if (d.length > 9) p.push(d.slice(9, 11));
  return p.join(" ");
}
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
  companies, provinces, documents, notifiedBodies, mode = "admin",
}: { companies: Company[]; provinces: string[]; documents: Doc[]; notifiedBodies: NB[]; mode?: "admin" | "customer" }) {
  const isCustomer = mode === "customer";
  const router = useRouter();
  const snapshotRef = useRef<string>("");
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fil, setFil] = useState({ sehir: "", yetkili: "", kategori: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState("asansor");
  const [form, setForm] = useState<Record<string, string>>({ ...BLANK });
  const [ceModule, setCeModule] = useState("H1");
  const [docs, setDocs] = useState<DocsState>(emptyDocs());
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [docKey, setDocKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReq, setShowReq] = useState(false);
  const reqList = category === "diger" ? ZORUNLU_DIGER : ZORUNLU_ASANSOR;
  const reqCls = (k: string) => (showReq && reqList.includes(k) && !(form[k] ?? "").trim() ? " !border-red-300 !bg-red-50" : "");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");
  const searchParams = useSearchParams();
  useEffect(() => {
    if (isCustomer) { if (companies[0]) selectCompany(companies[0]); return; }
    const id = searchParams.get("edit");
    if (id) { const c = companies.find((x) => x.id === id); if (c) selectCompany(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowFromDoc = (d: Doc): Row => ({ uid: uid(), id: d.id, belge_no: d.belge_no ?? "", issue_date: d.issue_date ?? "", valid_until: d.valid_until ?? "", notified_body_id: d.notified_body_id ?? "", file: null, original_name: d.original_name, sub_type: d.sub_type ?? "" });
  function buildDocs(compId: string): DocsState {
    const all = documents.filter((d) => d.company_id === compId);
    const one = (t: string) => { const d = all.find((x) => x.doc_type === t); return d ? rowFromDoc(d) : emptyRow(); };
    const many = (t: string) => all.filter((x) => x.doc_type === t).map(rowFromDoc);
    const bList: BRow[] = all.filter((x) => x.doc_type === "ce_b").map((d) => ({
      ...rowFromDoc(d), sub_type: d.sub_type ?? "",
      eki: all.filter((x) => x.doc_type === "ce_b_eki" && x.parent_id === d.id).map(rowFromDoc),
    }));
    return { sanayi_sicil: one("sanayi_sicil"), tse_hyb: one("tse_hyb"), ce_h1: one("ce_h1"), ce_e: one("ce_e"), ce_tasarim: many("ce_tasarim"), ce_b: bList };
  }
  const setSingle = (t: "sanayi_sicil" | "tse_hyb" | "ce_h1" | "ce_e", patch: Partial<Row>) => setDocs((s) => ({ ...s, [t]: { ...s[t], ...patch } }));
  const setTasarim = (i: number, patch: Partial<Row>) => setDocs((s) => ({ ...s, ce_tasarim: s.ce_tasarim.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addTasarim = () => setDocs((s) => ({ ...s, ce_tasarim: [...s.ce_tasarim, emptyRow()] }));
  const removeTasarim = (i: number) => setDocs((s) => { const r = s.ce_tasarim[i]; if (r?.id) setDeletedIds((d) => [...d, r.id!]); return { ...s, ce_tasarim: s.ce_tasarim.filter((_, j) => j !== i) }; });
  const setB = (i: number, patch: Partial<BRow>) => setDocs((s) => ({ ...s, ce_b: s.ce_b.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const addB = () => setDocs((s) => ({ ...s, ce_b: [...s.ce_b, emptyBRow()] }));
  const removeB = (i: number) => setDocs((s) => {
    const b = s.ce_b[i]; const ids = [b.id, ...b.eki.map((e) => e.id)].filter(Boolean) as string[];
    if (ids.length) setDeletedIds((d) => [...d, ...ids]);
    return { ...s, ce_b: s.ce_b.filter((_, j) => j !== i) };
  });
  const setBEki = (i: number, j: number, patch: Partial<Row>) => setDocs((s) => ({ ...s, ce_b: s.ce_b.map((b, bi) => (bi === i ? { ...b, eki: b.eki.map((e, ej) => (ej === j ? { ...e, ...patch } : e)) } : b)) }));
  const addBEki = (i: number) => setDocs((s) => ({ ...s, ce_b: s.ce_b.map((b, bi) => (bi === i ? { ...b, eki: [...b.eki, emptyRow()] } : b)) }));
  const removeBEki = (i: number, j: number) => setDocs((s) => {
    const e = s.ce_b[i].eki[j]; if (e?.id) setDeletedIds((d) => [...d, e.id!]);
    return { ...s, ce_b: s.ce_b.map((b, bi) => (bi === i ? { ...b, eki: b.eki.filter((_, ej) => ej !== j) } : b)) };
  });

  const docsByComp = useMemo(() => {
    const m: Record<string, Doc[]> = {};
    for (const d of documents) (m[d.company_id] ||= []).push(d);
    return m;
  }, [documents]);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    return companies.filter((c) => {
      if (s) {
        const hay = [c.short_name, c.legal_name, c.city, c.authorized_person, c.mobile_phone, c.phone].map(tc).join(" ");
        if (!hay.includes(s)) return false;
      }
      if (fil.sehir && tc(c.city) !== tc(fil.sehir)) return false;
      if (fil.yetkili && !tc(c.authorized_person).includes(tc(fil.yetkili))) return false;
      if (fil.kategori && (c.category || "asansor") !== fil.kategori) return false;
      return true;
    });
  }, [q, fil, companies]);

  function selectCompany(c: Company) {
    setEditId(c.id);
    setCategory(c.category || "asansor");
    const f = {
      short_name: c.short_name ?? "", legal_name: c.legal_name ?? "", authorized_person: c.authorized_person ?? "",
      registered_brand: c.registered_brand ?? "", city: c.city ?? "", phone: c.phone ?? "",
      mobile_phone: c.mobile_phone ?? "", email: c.email ?? "", industry_reg_no: c.industry_reg_no ?? "", address: c.address ?? "",
      sector: c.sector ?? "",
    };
    setForm(f);
    setCeModule(c.ce_module || "H1");
    snapshotRef.current = JSON.stringify({ ...f, ce_module: c.ce_module || "H1", category: c.category || "asansor" });
    setDocs(buildDocs(c.id)); setDeletedIds([]); setDocKey((k) => k + 1); setMsg(null); setShowReq(false);
    if (!isCustomer) setModalOpen(true);
  }
  function newCompany(cat: string) {
    setEditId(null); setCategory(cat); setForm({ ...BLANK }); setCeModule("H1");
    setDocs(emptyDocs()); setDeletedIds([]); setDocKey((k) => k + 1); setMsg(null); setShowReq(false); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditId(null); setForm({ ...BLANK }); setDocs(emptyDocs()); setMsg(null); }

  async function sil() {
    if (!editId) return;
    if (!confirm(`"${form.short_name}" müşterisi; belgeleri ve bağlı mühendisleriyle birlikte tamamen silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(true); setMsg(null);
    const res = await deleteCompany(editId);
    setBusy(false);
    if (res.ok) { closeModal(); router.refresh(); } else setMsg({ ok: false, text: res.error });
  }

  const wantUp = (r: Row) => (isCustomer ? (!!r.file || (!r.id && rowHasContent(r))) : rowHasContent(r));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const eksik = reqList.filter((k) => !(form[k] ?? "").trim());
    if (eksik.length) { setShowReq(true); setMsg({ ok: false, text: "Lütfen kırmızı ile işaretli zorunlu alanları doldurun." }); return; }
    setShowReq(false);
    setBusy(true); setMsg(null);
    const payload = { ...form, ce_module: ceModule, category };
    const formChanged = JSON.stringify(payload) !== snapshotRef.current;
    let compId: string | null = editId;
    if (!isCustomer || formChanged) {
      const res = editId ? await updateCompany(editId, payload) : await createCompany(payload);
      if (!res.ok) { setBusy(false); setMsg({ ok: false, text: res.error }); return; }
      if (!editId) compId = res.id ?? null;
    }
    if (!compId) { setBusy(false); return; }

    // "Diğer" kategorisinde belge yönetimi yok
    if (category === "diger") {
      setBusy(false);
      router.refresh();
      if (!isCustomer) closeModal();
      return;
    }

    if (!isCustomer) for (const id of deletedIds) await deleteCompanyDocument(id);

    let docErr: string | null = null;
    async function up(type: string, row: Row, extra?: { sub_type?: string; parent_id?: string }): Promise<Row> {
      const fd = new FormData();
      fd.set("company_id", compId!); fd.set("doc_type", type);
      if (row.id) fd.set("doc_id", row.id);
      fd.set("belge_no", row.belge_no); fd.set("issue_date", row.issue_date);
      fd.set("valid_until", row.valid_until); fd.set("notified_body_id", row.notified_body_id);
      if (extra?.sub_type != null) fd.set("sub_type", extra.sub_type);
      if (extra?.parent_id != null) fd.set("parent_id", extra.parent_id);
      if (row.file) fd.set("file", row.file);
      const r = await uploadCompanyDocument(fd);
      if (r.ok) return { ...row, id: (r as any).id ?? row.id, file: null };
      docErr = r.error; return { ...row, file: null };
    }

    const nd = emptyDocs();
    nd.sanayi_sicil = wantUp(docs.sanayi_sicil) ? await up("sanayi_sicil", docs.sanayi_sicil) : { ...docs.sanayi_sicil, file: null };
    nd.tse_hyb = wantUp(docs.tse_hyb) ? await up("tse_hyb", docs.tse_hyb) : { ...docs.tse_hyb, file: null };

    if (ceModule === "H1") {
      nd.ce_h1 = wantUp(docs.ce_h1) ? await up("ce_h1", docs.ce_h1) : { ...docs.ce_h1, file: null };
      nd.ce_tasarim = [];
      for (const r of docs.ce_tasarim) nd.ce_tasarim.push(wantUp(r) ? await up("ce_tasarim", r, { sub_type: r.sub_type }) : { ...r, file: null });
      nd.ce_b = docs.ce_b;
    } else {
      nd.ce_b = [];
      for (const b of docs.ce_b) {
        const bHas = isCustomer ? (!!b.file || (!b.id && (rowHasContent(b) || !!b.sub_type))) : (rowHasContent(b) || !!b.sub_type);
        const savedB = bHas ? await up("ce_b", b, { sub_type: b.sub_type }) : { ...b, file: null };
        const parentId = savedB.id;
        const savedEki: Row[] = [];
        for (const e of b.eki) {
          const wantEki = isCustomer ? !!e.file : (e.file || e.id);
          if (wantEki && parentId) savedEki.push(await up("ce_b_eki", e, { parent_id: parentId }));
          else savedEki.push({ ...e, file: null });
        }
        nd.ce_b.push({ ...(savedB as Row), sub_type: b.sub_type, eki: savedEki });
      }
      nd.ce_e = wantUp(docs.ce_e) ? await up("ce_e", docs.ce_e) : { ...docs.ce_e, file: null };
    }

    setBusy(false); setDocs(nd); setDeletedIds([]); setDocKey((k) => k + 1);
    if (docErr) { setMsg({ ok: false, text: (isCustomer ? "Bilgiler gönderildi, belge hatası: " : "Müşteri kaydedildi, belge hatası: ") + docErr }); router.refresh(); return; }
    router.refresh();
    if (isCustomer) setMsg({ ok: true, text: "Değişiklikleriniz onaya gönderildi." });
    else closeModal();
  }

  // ---------- Temel bilgi alanları ----------
  const temelBilgiler = category === "diger" ? (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="md:col-span-2"><L>Kısa Ad *</L><input className={inp + reqCls("short_name")} value={form.short_name} onChange={(e) => set("short_name", e.target.value)} /></div>
      <div className="md:col-span-2"><L>Ticari Ünvan *</L><input className={inp + reqCls("legal_name")} value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} /></div>
      <div><L>Yetkili Ad / Soyad *</L><input className={inp + reqCls("authorized_person")} value={form.authorized_person} onChange={(e) => set("authorized_person", e.target.value)} /></div>
      <div><L>Sektör / Meslek *</L><input className={inp + reqCls("sector")} value={form.sector} onChange={(e) => set("sector", e.target.value)} /></div>
      <div><L>Şehir *</L>
        <select className={inp + reqCls("city")} value={form.city} onChange={(e) => set("city", e.target.value)}>
          <option value="">Seçiniz…</option>
          {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><L>Cep Telefonu *</L><input type="tel" className={inp + reqCls("mobile_phone")} value={form.mobile_phone} onChange={(e) => set("mobile_phone", fmtPhone(e.target.value))} placeholder="0 5xx xxx xx xx" /></div>
      <div><L>E-Posta (opsiyonel)</L><input type="email" className={inp} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="ornek@firma.com" /></div>
      <div className="md:col-span-2"><L>Adres *</L><input className={inp + reqCls("address")} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="md:col-span-2"><L>Kısa Ad *</L><input className={inp + reqCls("short_name")} value={form.short_name} onChange={(e) => set("short_name", e.target.value)} /></div>
      <div className="md:col-span-2"><L>Ticari Ünvan *</L><input className={inp + reqCls("legal_name")} value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} /></div>
      <div><L>Yetkili / Ünvanı *</L><input className={inp + reqCls("authorized_person")} value={form.authorized_person} onChange={(e) => set("authorized_person", e.target.value)} /></div>
      <div><L>Tescilli Marka *</L><input className={inp + reqCls("registered_brand")} value={form.registered_brand} onChange={(e) => set("registered_brand", e.target.value)} /></div>
      <div><L>Şehir *</L>
        <select className={inp + reqCls("city")} value={form.city} onChange={(e) => set("city", e.target.value)}>
          <option value="">Seçiniz…</option>
          {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><L>Sanayi Sicil No *</L><input className={inp + reqCls("industry_reg_no")} value={form.industry_reg_no} onChange={(e) => set("industry_reg_no", e.target.value)} /></div>
      <div><L>Cep Telefonu</L><input type="tel" className={inp} value={form.mobile_phone} onChange={(e) => set("mobile_phone", fmtPhone(e.target.value))} placeholder="0 5xx xxx xx xx" /></div>
      <div><L>Müşteri E-posta (opsiyonel)</L><input type="email" className={inp} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="ornek@firma.com" /></div>
      <div className="md:col-span-2"><L>Adres *</L><input className={inp + reqCls("address")} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
    </div>
  );

  const belgelerBolumu = (
    <div className="space-y-3">
      <div>
        <h3 className="font-bold text-sm">Belgeler</h3>
        <p className="text-xs text-slate-400">Dosya + tarihleri gir; Kaydet ile birlikte yüklenir. 1 aydan az kalınca sarı, dolunca kırmızı.</p>
      </div>
      <DocRow ad="Sanayi Sicil Belgesi" row={docs.sanayi_sicil} nbs={notifiedBodies} onChange={(p) => setSingle("sanayi_sicil", p)} rk={`${docKey}-sanayi`} />
      <DocRow ad="TSE HYB Belgesi" row={docs.tse_hyb} nbs={notifiedBodies} onChange={(p) => setSingle("tse_hyb", p)} rk={`${docKey}-hyb`} />
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
              <div key={r.uid} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">Tasarım İnceleme {i + 1}</span>
                  <button type="button" onClick={() => removeTasarim(i)} className="text-xs text-red-500 hover:underline">Sil</button>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Tasarım İnceleme Tipi</label>
                  <select value={r.sub_type ?? ""} onChange={(e) => setTasarim(i, { sub_type: e.target.value })} className={fInp}>
                    <option value="">Seçiniz…</option>
                    {TI_TIPLERI.map((t) => <option key={t.v} value={t.v}>{t.ad}</option>)}
                  </select>
                </div>
                <DocRow ad="Belge Bilgileri" row={r} nbs={notifiedBodies} showBelgeNo showNb onChange={(p) => setTasarim(i, p)} rk={r.uid} />
              </div>
            ))}
            <button type="button" onClick={addTasarim} className="text-xs font-semibold text-brand hover:underline">+ Tasarım İnceleme Ekle</button>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.ce_b.map((b, i) => (
              <div key={b.uid} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">Mod B Belgesi {i + 1}</span>
                  <button type="button" onClick={() => removeB(i)} className="text-xs text-red-500 hover:underline">Sil</button>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Mod B Belge Tipi</label>
                  <select value={b.sub_type} onChange={(e) => setB(i, { sub_type: e.target.value })} className={fInp}>
                    <option value="">Seçiniz…</option>
                    {B_TIPLERI.map((t) => <option key={t.v} value={t.v}>{t.ad}</option>)}
                  </select>
                </div>
                <DocRow ad="Belge Bilgileri" row={b} nbs={notifiedBodies} showBelgeNo showNb onChange={(p) => setB(i, p)} rk={b.uid} />
                <div className="pl-3 border-l-2 border-brand/20 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">Bu Mod B'ye ait ekler (sadece dosya)</div>
                  {b.eki.map((e, j) => (
                    <DocRow key={e.uid} ad={`Ek ${j + 1}`} row={e} nbs={[]} hideDates onlyFile onChange={(p) => setBEki(i, j, p)} onRemove={() => removeBEki(i, j)} rk={e.uid} />
                  ))}
                  <button type="button" onClick={() => addBEki(i)} className="text-xs font-semibold text-brand hover:underline">+ Ek Ekle</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addB} className="text-xs font-semibold text-brand hover:underline">+ Mod B Ekle</button>
            <DocRow ad="Mod E Belgesi" row={docs.ce_e} nbs={notifiedBodies} showBelgeNo showNb onChange={(p) => setSingle("ce_e", p)} rk={`${docKey}-e`} />
          </div>
        )}
      </div>
    </div>
  );

  const formBody = (
    <form onSubmit={submit} className="space-y-4">
      {!isCustomer && (
        <div>
          <L>Müşteri Kategorisi *</L>
          <div className="flex gap-2">
            {[{ v: "asansor", t: "Asansör" }, { v: "diger", t: "Diğer" }].map((k) => (
              <button key={k.v} type="button" onClick={() => setCategory(k.v)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border ${category === k.v ? "bg-brand text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-brand"}`}>
                {k.t}
              </button>
            ))}
          </div>
        </div>
      )}
      {temelBilgiler}
      {category === "asansor" && belgelerBolumu}
      {msg && <div className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <div className="flex items-center justify-end gap-2 pt-1">
        {!isCustomer && editId && (
          <button type="button" onClick={sil} disabled={busy} className="mr-auto text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">
            Müşteri Sil
          </button>
        )}
        {!isCustomer && <button type="button" onClick={closeModal} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>}
        <button disabled={busy} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
          {busy ? "Kaydediliyor…" : isCustomer ? "Onaya Gönder" : editId ? "Değişiklikleri Kaydet" : "Kaydet"}
        </button>
      </div>
    </form>
  );

  // ---------------- Müşteri (inline) ----------------
  if (isCustomer) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Firmam</h1>
          <p className="text-sm text-slate-500">Firma bilgilerinizi ve belgelerinizi güncelleyin. Değişiklikleriniz Gensis onayına gönderilir.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">{formBody}</div>
      </div>
    );
  }

  // ---------------- Admin (sticky + tablo + modal) ----------------
  const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
  const td = "px-3 py-2 text-sm whitespace-nowrap";
  const fTh = "px-3 py-1.5 align-top";
  return (
    <div>
      <div className="sticky top-[92px] z-10 bg-white/80 backdrop-blur -mx-8 px-8 py-3 border-b border-slate-100 mb-4 flex items-center gap-3">
        <button onClick={() => newCompany("asansor")} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">+ Yeni Müşteri Oluştur</button>
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: firma, şehir, yetkili, telefon…" className={inp + " pl-10"} />
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
                <th className={th}>Firma Adı</th>
                <th className={th}>Şehir</th>
                <th className={th}>Yetkili Ad-Soyad</th>
                <th className={th}>Telefon</th>
                <th className={th}>Kategori</th>
                <th className={th}>İşlem</th>
              </tr>
              {showFilters && (
                <tr className="bg-white border-b border-slate-200">
                  <th className={fTh}></th>
                  <th className={fTh}>
                    <select className={fInp} value={fil.sehir} onChange={(e) => setFil((s) => ({ ...s, sehir: e.target.value }))}>
                      <option value="">Hepsi</option>
                      {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </th>
                  <th className={fTh}><input className={fInp} value={fil.yetkili} onChange={(e) => setFil((s) => ({ ...s, yetkili: e.target.value }))} placeholder="Yetkili" /></th>
                  <th className={fTh}></th>
                  <th className={fTh}>
                    <select className={fInp} value={fil.kategori} onChange={(e) => setFil((s) => ({ ...s, kategori: e.target.value }))}>
                      <option value="">Hepsi</option><option value="asansor">Asansör</option><option value="diger">Diğer</option>
                    </select>
                  </th>
                  <th className={fTh}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className={td + " font-semibold"}>{c.short_name}</td>
                  <td className={td + " text-slate-500"}>{c.city ?? "—"}</td>
                  <td className={td + " text-slate-500"}>{c.authorized_person ?? "—"}</td>
                  <td className={td + " text-slate-500"}>{c.mobile_phone || c.phone || "—"}</td>
                  <td className={td}><span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{(c.category || "asansor") === "diger" ? "Diğer" : "Asansör"}</span></td>
                  <td className={td + " text-right"}><button onClick={() => selectCompany(c)} className="text-xs font-bold text-brand hover:underline">Düzenle</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Sonuç yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-extrabold text-lg">{editId ? "Müşteri Düzenle" : "Yeni Müşteri"}</h2>
              <button onClick={closeModal} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
            </div>
            <div className="px-6 py-5">{formBody}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocRow({
  ad, row, nbs, showBelgeNo, showNb, hideDates, onlyFile, onChange, onRemove, rk,
}: {
  ad: string; row: Row; nbs: NB[]; showBelgeNo?: boolean; showNb?: boolean; hideDates?: boolean; onlyFile?: boolean;
  onChange: (p: Partial<Row>) => void; onRemove?: () => void; rk: string;
}) {
  const durum = (hideDates || onlyFile)
    ? (row.original_name || row.file ? { t: "Yüklendi", c: "green" } : { t: "Yok", c: "slate" })
    : belgeDurum(row.valid_until, !!row.original_name || !!row.file);
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
      {!onlyFile && showBelgeNo && (
        <div className="mb-2">
          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Belge No</label>
          <input value={row.belge_no} onChange={(e) => onChange({ belge_no: e.target.value })} className={dinp} />
        </div>
      )}
      {!onlyFile && !hideDates && (
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
      )}
      {!onlyFile && showNb && (
        <div className="grid grid-cols-[1fr_90px] gap-2 mb-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Onaylanmış Kuruluş</label>
            <select value={row.notified_body_id} onChange={(e) => onChange({ notified_body_id: e.target.value })} className={dinp}>
              <option value="">Seçiniz…</option>
              {nbs.filter((n) => n.identity_no).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
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
