"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createTakipProje, uploadTakipDoc, deleteTakipDoc,
  saveBekliyorAciklama, completeTakipProje, deleteTakipProje,
  type TakipPayload,
} from "./actions";

type Company = { id: string; short_name: string; legal_name: string | null; city: string | null };
type Province = { id: number; name: string };
type Sorumlu = { id: string; full_name: string | null; role: string };
type District = { id: string; name: string };
type Doc = { id: string; takip_id: string; kind: string; original_name: string | null };
type Row = {
  id: string; proje_no: number; proje_tipi: string; siparis_tarihi: string | null;
  company_id: string | null; ada_parsel: string | null; is_adi: string | null;
  asansor_sayisi: number | null; asansor_tipi: string | null;
  il_adi: string | null; ilce_adi: string | null; fiyat: number | null;
  fatura_tipi: string | null; toplam_tutar: number | null; proje_sorumlusu_id: string | null;
  tahmini_tamamlanma: string | null; durum: string; bekliyor_aciklama: string | null;
  tamamlanma_tarihi: string | null; teslim_tipi: string | null; hard_copy_adedi: number | null;
  muhasebeye_gonderildi: boolean; muhasebe_durumu: string | null;
  docs: Doc[]; muhasebe: { cariye_islendi: boolean; teslim_tarihi: string | null } | null;
};

const TIP_TR: Record<string, string> = { mimari: "Mimari", uygulama: "Uygulama" };
const AST: { v: string; t: string }[] = [
  { v: "MR", t: "MR" }, { v: "MRL", t: "MRL" }, { v: "HD_YUK", t: "HD Yük" }, { v: "HD_INSAN", t: "HD İnsan" },
];
const AST_TR: Record<string, string> = { MR: "MR", MRL: "MRL", HD_YUK: "HD Yük", HD_INSAN: "HD İnsan" };
const DURUM_BADGE: Record<string, string> = {
  HAZIRLANIYOR: "bg-amber-100 text-amber-700",
  BEKLIYOR: "bg-red-100 text-red-700",
  TAMAMLANDI: "bg-green-100 text-green-700",
};

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("tr-TR") : "—");

export default function ProjeTakipClient({
  rows, companies, provinces, sorumlular, currentUserId, today,
}: {
  rows: Row[]; companies: Company[]; provinces: Province[]; sorumlular: Sorumlu[];
  currentUserId: string; today: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [durumRow, setDurumRow] = useState<Row | null>(null);

  const sorumluAd = (id: string | null) => sorumlular.find((s) => s.id === id)?.full_name ?? "—";
  const firmaAd = (id: string | null) => companies.find((c) => c.id === id)?.short_name ?? "—";

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return rows;
    return rows.filter((r) =>
      String(r.proje_no).includes(s) ||
      (firmaAd(r.company_id) ?? "").toLocaleLowerCase("tr").includes(s) ||
      (r.is_adi ?? "").toLocaleLowerCase("tr").includes(s) ||
      (r.ada_parsel ?? "").toLocaleLowerCase("tr").includes(s)
    );
  }, [q, rows]);

  function rowClass(r: Row) {
    const muhDone = !!r.muhasebe?.cariye_islendi;
    const overdue = r.durum !== "TAMAMLANDI" && r.tahmini_tamamlanma && r.tahmini_tamamlanma < today;
    if (muhDone) return "bg-green-50";
    if (overdue || r.durum === "BEKLIYOR") return "bg-red-50";
    return "";
  }

  const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap";
  const td = "px-3 py-2 text-sm whitespace-nowrap";

  return (
    <div>
      <div className="bg-white/80 backdrop-blur border-b border-[#e5e9f0] px-8 pt-5 pb-4 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Proje Takip</h1>
          <p className="text-sm text-slate-500">Mimari / uygulama proje çizim talepleri ve tamamlanma takibi</p>
        </div>
        <button onClick={() => setShowForm(true)} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">
          + Yeni Proje
        </button>
      </div>

      <div className="p-8 gs-fade">
        <div className="mb-4 relative max-w-md">
          <span className="material-symbols-rounded text-[20px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Proje no, firma, işin adı, ada/parsel…" className={inp + " pl-10"} />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Proje No</th>
                  <th className={th}>Tip</th>
                  <th className={th}>Sipariş Tar.</th>
                  <th className={th}>Firma</th>
                  <th className={th}>Ada/Parsel</th>
                  <th className={th}>İşin Adı</th>
                  <th className={th}>Asn. Sayısı</th>
                  <th className={th}>Asn. Tipi</th>
                  <th className={th}>İl / İlçe</th>
                  <th className={th}>Fiyat</th>
                  <th className={th}>Toplam</th>
                  <th className={th}>Sorumlu</th>
                  <th className={th}>Tah. Tamamlanma</th>
                  <th className={th}>Durum</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${rowClass(r)}`}>
                    <td className={td + " font-bold text-navy"}>{r.proje_no}</td>
                    <td className={td}>{TIP_TR[r.proje_tipi] ?? r.proje_tipi}</td>
                    <td className={td + " text-slate-500"}>{dt(r.siparis_tarihi)}</td>
                    <td className={td + " font-semibold"}>{firmaAd(r.company_id)}</td>
                    <td className={td + " text-slate-500"}>{r.ada_parsel ?? "—"}</td>
                    <td className={td}>{r.is_adi ?? "—"}</td>
                    <td className={td + " text-center"}>{r.asansor_sayisi ?? "—"}</td>
                    <td className={td}>{r.asansor_tipi ? AST_TR[r.asansor_tipi] ?? r.asansor_tipi : "—"}</td>
                    <td className={td + " text-slate-500"}>{[r.il_adi, r.ilce_adi].filter(Boolean).join(" / ") || "—"}</td>
                    <td className={td}>{money(r.fiyat)}<span className="block text-[10px] text-slate-400">{r.fatura_tipi === "faturali" ? "Faturalı" : r.fatura_tipi === "faturasiz" ? "Faturasız" : ""}</span></td>
                    <td className={td + " font-semibold"}>{money(r.toplam_tutar)}</td>
                    <td className={td + " text-slate-600"}>{sorumluAd(r.proje_sorumlusu_id)}</td>
                    <td className={td + " text-slate-500"}>{dt(r.tahmini_tamamlanma)}</td>
                    <td className={td}>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${DURUM_BADGE[r.durum] ?? "bg-slate-100 text-slate-600"}`}>{r.durum}</span>
                      {r.muhasebe?.cariye_islendi && <span className="block text-[10px] text-green-600 font-semibold mt-0.5">Teslim edildi</span>}
                    </td>
                    <td className={td + " text-right"}>
                      <button onClick={() => setDurumRow(r)} className="text-xs font-bold text-brand hover:underline">Tamamlanma Durumu</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="px-5 py-8 text-center text-sm text-slate-400">Kayıt yok. Sağ üstten “Yeni Proje” ile başlayın.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <YeniProjeForm
          companies={companies} provinces={provinces} sorumlular={sorumlular}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); router.refresh(); }}
        />
      )}

      {durumRow && (
        <DurumModal
          row={durumRow} firmaAd={firmaAd(durumRow.company_id)} sorumluAd={sorumluAd(durumRow.proje_sorumlusu_id)}
          today={today}
          onClose={() => setDurumRow(null)}
          onChanged={() => { setDurumRow(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ============================ Yeni Proje Formu ============================ */

type UploadSlot = { kind: string; label: string; required: boolean };
const SLOTS_MIMARI: UploadSlot[] = [
  { kind: "mimari_proje", label: "Mimari Proje", required: true },
  { kind: "elektrik_projesi", label: "Elektrik Projesi", required: false },
  { kind: "statik_projesi", label: "Statik Projesi", required: false },
  { kind: "diger", label: "Diğer", required: false },
];
const SLOTS_UYGULAMA: UploadSlot[] = [
  { kind: "mimari_proje", label: "Mimari Proje", required: true },
  { kind: "elektrik_projesi", label: "Elektrik Projesi", required: false },
  { kind: "olcu_formu", label: "Ölçü Formu", required: false },
  { kind: "yapi_ruhsati", label: "Yapı Ruhsatı", required: true },
  { kind: "diger", label: "Diğer", required: false },
];

function YeniProjeForm({
  companies, provinces, sorumlular, onClose, onSaved,
}: {
  companies: Company[]; provinces: Province[]; sorumlular: Sorumlu[];
  onClose: () => void; onSaved: () => void;
}) {
  const supabase = createClient();
  const [f, setF] = useState<Record<string, string>>({
    proje_tipi: "mimari", siparis_tarihi: "", company_id: "", ada_parsel: "", is_adi: "",
    asansor_sayisi: "", asansor_tipi: "", province_id: "", district_id: "",
    fiyat: "", fatura_tipi: "faturasiz", proje_sorumlusu_id: "", tahmini_tamamlanma: "",
  });
  const [districts, setDistricts] = useState<District[]>([]);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const slots = f.proje_tipi === "uygulama" ? SLOTS_UYGULAMA : SLOTS_MIMARI;

  const fiyatNum = f.fiyat === "" ? null : Number(f.fiyat);
  const toplam = fiyatNum == null ? null : (f.fatura_tipi === "faturali" ? Math.round(fiyatNum * 1.2 * 100) / 100 : fiyatNum);

  async function onProvince(v: string) {
    set("province_id", v); set("district_id", "");
    setDistricts([]);
    if (v) {
      const { data } = await supabase.from("districts").select("id, name").eq("province_id", Number(v)).order("name").limit(2000);
      setDistricts(data ?? []);
    }
  }

  const missing = (k: string, v: string) => touched && !v;
  const reqField = (k: string) => (missing(k, f[k]) ? " border-red-400 bg-red-50" : "");

  function addFiles(kind: string, list: FileList | null) {
    if (!list || list.length === 0) return;
    setFiles((s) => ({ ...s, [kind]: [...(s[kind] ?? []), ...Array.from(list)] }));
  }
  function removeFile(kind: string, idx: number) {
    setFiles((s) => ({ ...s, [kind]: (s[kind] ?? []).filter((_, i) => i !== idx) }));
  }

  async function submit() {
    setTouched(true); setErr(null);
    // Zorunlu alanlar
    if (!f.company_id) return setErr("Firma seçiniz.");
    if (!f.proje_tipi) return setErr("Proje tipi seçiniz.");
    for (const s of slots) if (s.required && (files[s.kind] ?? []).length === 0)
      return setErr(`${s.label} zorunludur (en az bir dosya).`);

    setBusy(true);
    const prov = provinces.find((p) => String(p.id) === f.province_id);
    const dist = districts.find((d) => d.id === f.district_id);
    const payload: TakipPayload = {
      proje_tipi: f.proje_tipi as any,
      siparis_tarihi: f.siparis_tarihi || null,
      company_id: f.company_id,
      ada_parsel: f.ada_parsel || null,
      is_adi: f.is_adi || null,
      asansor_sayisi: f.asansor_sayisi ? Number(f.asansor_sayisi) : null,
      asansor_tipi: f.asansor_tipi || null,
      province_id: f.province_id ? Number(f.province_id) : null,
      district_id: f.district_id || null,
      il_adi: prov?.name ?? null,
      ilce_adi: dist?.name ?? null,
      fiyat: fiyatNum,
      fatura_tipi: f.fatura_tipi as any,
      proje_sorumlusu_id: f.proje_sorumlusu_id || null,
      tahmini_tamamlanma: f.tahmini_tamamlanma || null,
    };
    const res = await createTakipProje(payload);
    if (!res.ok) { setBusy(false); return setErr(res.error); }

    // Dosyaları yükle
    for (const [kind, arr] of Object.entries(files)) {
      for (const file of arr) {
        const fd = new FormData();
        fd.set("takip_id", res.id!); fd.set("kind", kind); fd.set("file", file);
        await uploadTakipDoc(fd);
      }
    }
    setBusy(false);
    onSaved();
  }

  return (
    <Overlay onClose={onClose} title="Yeni Proje Takip Kaydı">
      <div className="space-y-4">
        <div className="bg-brand-light/50 border border-brand/10 rounded-lg px-3 py-2 text-xs text-slate-600">
          Proje No otomatik ve sıralı atanır. Tamamlanma durumu <b>HAZIRLANIYOR</b> olarak başlar.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Proje Tipi *">
            <select className={inp} value={f.proje_tipi} onChange={(e) => set("proje_tipi", e.target.value)}>
              <option value="mimari">Mimari</option>
              <option value="uygulama">Uygulama</option>
            </select>
          </Field>
          <Field label="Sipariş Tarihi">
            <input type="date" className={inp} value={f.siparis_tarihi} onChange={(e) => set("siparis_tarihi", e.target.value)} />
          </Field>
        </div>

        <Field label="Firma Adı *">
          <div className="flex gap-2">
            <select className={inp + reqField("company_id")} value={f.company_id} onChange={(e) => set("company_id", e.target.value)}>
              <option value="">Müşteri seçiniz…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
            <a href="/admin/musteriler" target="_blank" rel="noreferrer"
               className="flex-none text-xs font-bold text-brand border border-brand/30 rounded-lg px-3 grid place-items-center hover:bg-brand-light whitespace-nowrap">
              + Yeni Oluştur
            </a>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ada / Parsel">
            <input className={inp} value={f.ada_parsel} onChange={(e) => set("ada_parsel", e.target.value)} />
          </Field>
          <Field label="İşin Adı">
            <input className={inp} value={f.is_adi} onChange={(e) => set("is_adi", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Asansör Sayısı">
            <input type="number" min={0} className={inp} value={f.asansor_sayisi} onChange={(e) => set("asansor_sayisi", e.target.value)} />
          </Field>
          <Field label="Asansör Tipi">
            <select className={inp} value={f.asansor_tipi} onChange={(e) => set("asansor_tipi", e.target.value)}>
              <option value="">Seçiniz…</option>
              {AST.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="İl">
            <select className={inp} value={f.province_id} onChange={(e) => onProvince(e.target.value)}>
              <option value="">İl seçiniz…</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="İlçe">
            <select className={inp} value={f.district_id} onChange={(e) => set("district_id", e.target.value)} disabled={districts.length === 0}>
              <option value="">{f.province_id ? "İlçe seçiniz…" : "Önce il seçin"}</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fiyat">
            <input type="number" min={0} step="0.01" className={inp} value={f.fiyat} onChange={(e) => set("fiyat", e.target.value)} placeholder="0.00" />
            <p className="text-[11px] font-bold text-amber-600 mt-1">⚠ KDV HARİÇ GİRİNİZ</p>
          </Field>
          <Field label="Fatura Durumu">
            <select className={inp} value={f.fatura_tipi} onChange={(e) => set("fatura_tipi", e.target.value)}>
              <option value="faturasiz">Faturasız</option>
              <option value="faturali">Faturalı (%20 KDV eklenir)</option>
            </select>
          </Field>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">Toplam Tutar</span>
          <span className="text-lg font-extrabold text-navy">{money(toplam)}</span>
        </div>

        {/* Dokümanlar */}
        <div>
          <h3 className="font-bold text-sm mb-2">Dokümanlar {f.proje_tipi === "uygulama" ? "(Uygulama)" : "(Mimari)"}</h3>
          <div className="space-y-2">
            {slots.map((s) => (
              <div key={s.kind} className={`border rounded-lg px-3 py-2 ${touched && s.required && (files[s.kind] ?? []).length === 0 ? "border-red-400 bg-red-50" : "border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    {s.label} {s.required ? <span className="text-red-500">*</span> : <span className="text-slate-400">(ops.)</span>}
                  </label>
                  <input type="file" multiple onChange={(e) => { addFiles(s.kind, e.target.files); e.currentTarget.value = ""; }}
                    className="text-xs file:mr-2 file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
                </div>
                {(files[s.kind] ?? []).length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {(files[s.kind] ?? []).map((file, i) => (
                      <li key={i} className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="truncate">📎 {file.name}</span>
                        <button onClick={() => removeFile(s.kind, i)} className="text-red-500 hover:underline ml-2">kaldır</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Proje Sorumlusu">
            <select className={inp} value={f.proje_sorumlusu_id} onChange={(e) => set("proje_sorumlusu_id", e.target.value)}>
              <option value="">Seçiniz…</option>
              {sorumlular.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? "—"}</option>)}
            </select>
          </Field>
          <Field label="Tahmini Tamamlanma Tarihi">
            <input type="date" className={inp} value={f.tahmini_tamamlanma} onChange={(e) => set("tahmini_tamamlanma", e.target.value)} />
          </Field>
        </div>

        {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
          <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ============================ Tamamlanma Durumu Modalı ============================ */

function DurumModal({
  row, firmaAd, sorumluAd, today, onClose, onChanged,
}: {
  row: Row; firmaAd: string; sorumluAd: string; today: string;
  onClose: () => void; onChanged: () => void;
}) {
  const [aciklama, setAciklama] = useState(row.bekliyor_aciklama ?? "");
  const [tarih, setTarih] = useState(row.tamamlanma_tarihi ?? today);
  const [teslimTipi, setTeslimTipi] = useState(row.teslim_tipi ?? "");
  const [adet, setAdet] = useState(row.hard_copy_adedi ? String(row.hard_copy_adedi) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const completed = row.durum === "TAMAMLANDI";
  const isBekliyor = row.durum === "BEKLIYOR";
  const tamamlananDocs = row.docs.filter((d) => d.kind === "tamamlanan_proje");

  async function uploadTamamlanan(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true); setErr(null);
    for (const file of Array.from(list)) {
      const fd = new FormData();
      fd.set("takip_id", row.id); fd.set("kind", "tamamlanan_proje"); fd.set("file", file);
      const res = await uploadTakipDoc(fd);
      if (!res.ok) { setBusy(false); return setErr(res.error); }
    }
    setBusy(false);
    router.refresh();
  }

  async function saveAciklama() {
    setTouched(true); setErr(null);
    if (!aciklama.trim()) return setErr("Açıklama zorunludur.");
    setBusy(true);
    const res = await saveBekliyorAciklama(row.id, aciklama);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onChanged();
  }

  async function tamamla() {
    setTouched(true); setErr(null);
    if (tamamlananDocs.length === 0) return setErr("Önce tamamlanan projeyi yükleyin.");
    if (!tarih) return setErr("Tamamlanma tarihi zorunludur.");
    if (!teslimTipi) return setErr("Teslim tipi seçiniz.");
    if (teslimTipi === "hard_copy" && (!adet || Number(adet) < 1)) return setErr("Hard Copy adedi giriniz.");
    setBusy(true);
    const res = await completeTakipProje(row.id, {
      tamamlanma_tarihi: tarih, teslim_tipi: teslimTipi as any,
      hard_copy_adedi: teslimTipi === "hard_copy" ? Number(adet) : null,
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onChanged();
  }

  return (
    <Overlay onClose={onClose} title={`Proje #${row.proje_no} — Tamamlanma Durumu`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold">{firmaAd}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">Sorumlu: {sorumluAd}</span>
          <span className={`ml-auto text-[11px] font-bold px-2 py-1 rounded-full ${DURUM_BADGE[row.durum]}`}>{row.durum}</span>
        </div>

        {completed ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 space-y-1">
            <div>✓ Proje tamamlandı. Tamamlanma tarihi: <b>{dt(row.tamamlanma_tarihi)}</b></div>
            <div>Teslim tipi: <b>{row.teslim_tipi === "hard_copy" ? `Hard Copy (${row.hard_copy_adedi} adet)` : "Dijital"}</b></div>
            <div>Muhasebe: <b>{row.muhasebe?.cariye_islendi ? "İşlendi / teslim edildi" : "Muhasebe bekleniyor"}</b></div>
          </div>
        ) : (
          <>
            {/* BEKLIYOR açıklaması */}
            {isBekliyor && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <label className="block text-xs font-bold text-red-700 mb-1">
                  Bu proje tahmini tarihte tamamlanmadı — Açıklama zorunlu *
                </label>
                <textarea rows={2} className={inp + (touched && !aciklama.trim() ? " border-red-400" : "")}
                  value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Gecikme nedeni / durum açıklaması…" />
                <div className="flex justify-end mt-2">
                  <button disabled={busy} onClick={saveAciklama} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-50">
                    Açıklamayı Kaydet
                  </button>
                </div>
              </div>
            )}

            {/* Tamamlama akışı */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-3">
              <h3 className="font-bold text-sm">Projeyi Tamamla</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">1. Tamamlanan Projeyi Yükle *</label>
                <input ref={fileRef} type="file" multiple onChange={(e) => { uploadTamamlanan(e.target.files); e.currentTarget.value = ""; }}
                  className="text-xs file:mr-2 file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
                {tamamlananDocs.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {tamamlananDocs.map((d) => (
                      <li key={d.id} className="flex items-center justify-between text-[11px]">
                        <a href={`/api/belge/takip?id=${d.id}`} target="_blank" rel="noreferrer" className="text-brand hover:underline truncate">📎 {d.original_name ?? "belge"}</a>
                        <button onClick={async () => { await deleteTakipDoc(d.id); router.refresh(); }} className="text-red-500 hover:underline ml-2">sil</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="2. Tamamlanma Tarihi *">
                  <input type="date" className={inp} value={tarih} onChange={(e) => setTarih(e.target.value)} />
                </Field>
                <Field label="3. Teslim Tipi *">
                  <select className={inp + (touched && !teslimTipi ? " border-red-400 bg-red-50" : "")} value={teslimTipi} onChange={(e) => setTeslimTipi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    <option value="hard_copy">Hard Copy</option>
                    <option value="dijital">Dijital</option>
                  </select>
                </Field>
              </div>

              {teslimTipi === "hard_copy" && (
                <Field label="Hard Copy Adedi *">
                  <input type="number" min={1} className={inp + (touched && (!adet || Number(adet) < 1) ? " border-red-400 bg-red-50" : "")} value={adet} onChange={(e) => setAdet(e.target.value)} />
                </Field>
              )}

              <button disabled={busy} onClick={tamamla} className="w-full gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
                {busy ? "İşleniyor…" : "Tamamlandı ve Muhasebeye Gönder"}
              </button>
            </div>
          </>
        )}

        {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
      </div>
    </Overlay>
  );
}

/* ============================ Ortak UI ============================ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-extrabold text-lg">{title}</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
