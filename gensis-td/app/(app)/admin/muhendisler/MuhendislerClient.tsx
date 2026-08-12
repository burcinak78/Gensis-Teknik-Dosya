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

const BRANS: Record<string, string> = {
  makine: "Makine Mühendisi",
  elektrik: "Elektrik Mühendisi",
  elektrik_elektronik: "Elektrik/Elektronik Mühendisi",
  mekatronik: "Mekatronik Mühendisi",
};
const BRANS_OPTS = Object.entries(BRANS).map(([v, t]) => ({ v, t }));
const ELEKTRIK_BELGE = [
  { key: "asansor_tescil", ad: "Asansör Tescil Belgesi" },
  { key: "buro_tescil", ad: "Büro Tescil Belgesi" },
];
const BELGE_TIPLERI: Record<string, { key: string; ad: string }[]> = {
  makine: [
    { key: "asansor_avan_yetki", ad: "Asansör Avan Yetki" },
    { key: "asansor_muh_yetki", ad: "Asansör Mühendis Yetki" },
    { key: "buro_tescil", ad: "Büro Tescil" },
  ],
  elektrik: ELEKTRIK_BELGE,
  elektrik_elektronik: ELEKTRIK_BELGE,
  mekatronik: ELEKTRIK_BELGE,
};
const BADGE: Record<string, string> = {
  green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-500",
};
const RANK: Record<string, number> = { red: 3, amber: 2, green: 1, slate: 0 };

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const fInp = "w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-brand";

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
  const [showFilters, setShowFilters] = useState(false);
  const [fil, setFil] = useState({ ad: "", brans: "", belge: "", firma: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false); // admin: modal aç/kapa
  const [form, setForm] = useState<Record<string, string>>({ ...blank });
  const [docForms, setDocForms] = useState<Record<string, DocForm>>({});
  const [docKey, setDocKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setDoc = (dt: string, patch: Partial<DocForm>) => setDocForms((s) => ({ ...s, [dt]: { valid_until: "", file: null, ...s[dt], ...patch } }));
  const tc = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr");
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
    return engineers.filter((e) => {
      if (s) {
        const hay = [e.full_name, BRANS[e.discipline], e.companies?.short_name, e.chamber_reg_no, engDurum(e).t].map(tc).join(" ");
        if (!hay.includes(s)) return false;
      }
      if (fil.ad && !tc(e.full_name).includes(tc(fil.ad))) return false;
      if (fil.brans && e.discipline !== fil.brans) return false;
      if (fil.belge && engDurum(e).c !== fil.belge) return false;
      if (fil.firma && e.company_id !== fil.firma) return false;
      return true;
    });
  }, [q, fil, engineers]);

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
    setMsg(null); setModalOpen(true);
  }
  function yeni() { setEditId(null); setForm({ ...blank }); snapshotRef.current = ""; initDocForms(null, "makine"); setMsg(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditId(null); setForm({ ...blank }); setDocForms({}); setMsg(null); }

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
      engId = res.id ?? null;
    }

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
    if (docErr) { setMsg({ ok: false, text: (isCustomer ? "Gönderildi, belge hatası: " : "Kaydedildi, belge hatası: ") + docErr }); router.refresh(); return; }
    router.refresh();
    if (isCustomer) {
      setMsg({ ok: true, text: !editId ? "Yeni mühendis onaya gönderildi." : "Değişiklikleriniz onaya gönderildi." });
      if (editId) { setDocForms((s) => { const o: Record<string, DocForm> = {}; for (const k in s) o[k] = { ...s[k], file: null }; return o; }); setDocKey((k) => k + 1); }
    } else {
      closeModal(); // admin: modalı kapat
    }
  }

  async function sil() {
    if (!editId) return;
    if (!confirm(`"${form.full_name}" mühendisini silmek istiyor musunuz?`)) return;
    setBusy(true); setMsg(null);
    const res = await deleteEngineer(editId);
    setBusy(false);
    if (res.ok) { closeModal(); router.refresh(); }
    else setMsg({ ok: false, text: res.error });
  }

  const docTipleri = BELGE_TIPLERI[form.discipline] || [];

  // Form gövdesi (hem modal hem müşteri inline için)
  const formBody = (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Ad Soyad *</label>
          <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mühendislik Tipi *</label>
            <select value={form.discipline} onChange={(e) => { set("discipline", e.target.value); initDocForms(editId, e.target.value); }} className={inp}>
              {BRANS_OPTS.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Oda Sicil No</label>
            <input value={form.chamber_reg_no} onChange={(e) => set("chamber_reg_no", e.target.value)} className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Adres</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inp} placeholder="Mühendisin açık adresi" />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
      </div>

      {/* Belgeler */}
      <div className="border border-slate-200 rounded-xl p-3">
        <h3 className="font-bold text-sm mb-1">Belgeler</h3>
        <p className="text-[11px] text-slate-400 mb-2">Dosya ve geçerlilik tarihini gir; Kaydet ile birlikte yüklenir.</p>
        <div className="space-y-2">
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

      {msg && <div className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
      <div className="flex items-center justify-end gap-2 pt-1">
        {!isCustomer && editId && (
          <button type="button" onClick={sil} disabled={busy} className="mr-auto text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-lg disabled:opacity-50">
            Sil
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
          <h1 className="text-[22px] font-extrabold tracking-tight">Mühendislerim</h1>
          <p className="text-sm text-slate-500">Firmanıza bağlı mühendisleri ve belgelerini yönetin. Yeni mühendis ve belge yüklemeleri Gensis onayına gönderilir.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl">
          <div className="p-3 border-b border-slate-100"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mühendis adından ara…" className={inp} /></div>
          <table className="w-full text-sm"><tbody>
            {filtered.map((m) => (
              <tr key={m.id} className={`border-b border-slate-100 last:border-0 ${editId === m.id ? "bg-brand-light" : ""}`}>
                <td className="px-5 py-2.5 font-semibold">{m.full_name}</td>
                <td className="px-5 py-2.5"><span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{BRANS[m.discipline] ?? m.discipline}</span></td>
                <td className="px-5 py-2.5 text-right"><button onClick={() => { setEditId(m.id); const f = { full_name: m.full_name ?? "", discipline: m.discipline ?? "makine", chamber_reg_no: m.chamber_reg_no ?? "", company_id: m.company_id ?? "", address: m.address ?? "", phone: m.phone ?? "" }; setForm(f); snapshotRef.current = JSON.stringify(f); initDocForms(m.id, m.discipline ?? "makine"); }} className="text-xs font-semibold text-brand hover:underline">Düzenle</button></td>
              </tr>
            ))}
          </tbody></table>
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
        <button onClick={yeni} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">+ Yeni Mühendis</button>
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: ad, tip, firma, oda sicil…" className={inp + " pl-10"} />
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
                <th className={th}>Mühendislik Tipi</th>
                <th className={th}>Belge Durumu</th>
                <th className={th}>Firma</th>
                <th className={th}>İşlem</th>
              </tr>
              {showFilters && (
                <tr className="bg-white border-b border-slate-200">
                  <th className={fTh}><input className={fInp} value={fil.ad} onChange={(e) => setFil((s) => ({ ...s, ad: e.target.value }))} placeholder="Ad" /></th>
                  <th className={fTh}>
                    <select className={fInp} value={fil.brans} onChange={(e) => setFil((s) => ({ ...s, brans: e.target.value }))}>
                      <option value="">Hepsi</option>
                      {BRANS_OPTS.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
                    </select>
                  </th>
                  <th className={fTh}>
                    <select className={fInp} value={fil.belge} onChange={(e) => setFil((s) => ({ ...s, belge: e.target.value }))}>
                      <option value="">Hepsi</option>
                      <option value="green">Geçerli</option><option value="amber">1 aydan az</option><option value="red">Geçersiz</option><option value="slate">Belge yok</option>
                    </select>
                  </th>
                  <th className={fTh}>
                    <select className={fInp} value={fil.firma} onChange={(e) => setFil((s) => ({ ...s, firma: e.target.value }))}>
                      <option value="">Hepsi</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                    </select>
                  </th>
                  <th className={fTh}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((m) => {
                const du = engDurum(m);
                return (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                    <td className={td + " font-semibold"}>{m.full_name}</td>
                    <td className={td}><span className="text-xs bg-brand-light text-brand px-2 py-1 rounded-full font-semibold">{BRANS[m.discipline] ?? m.discipline}</span></td>
                    <td className={td}><span className={`text-xs px-2 py-1 rounded-full font-semibold ${BADGE[du.c]}`}>{du.t}</span></td>
                    <td className={td + " text-slate-500"}>{m.companies?.short_name ?? "—"}</td>
                    <td className={td + " text-right"}><button onClick={() => edit(m)} className="text-xs font-bold text-brand hover:underline">Düzenle</button></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">Sonuç yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-extrabold text-lg">{editId ? "Mühendis Düzenle" : "Yeni Mühendis"}</h2>
              <button onClick={closeModal} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
            </div>
            <div className="px-6 py-5">{formBody}</div>
          </div>
        </div>
      )}
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
