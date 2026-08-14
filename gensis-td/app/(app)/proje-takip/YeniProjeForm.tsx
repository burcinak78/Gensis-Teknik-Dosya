"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createTakipProje, updateTakipProje, createRevision, completeTakipProje,
  deleteTakipDoc, type TakipPayload,
} from "./actions";
import { createCompany } from "@/app/(app)/admin/actions";
import { uploadTakipFile } from "@/lib/takipUpload";

type Company = { id: string; short_name: string; legal_name: string | null; city: string | null; category?: string | null };
type Province = { id: number; name: string };
type Sorumlu = { id: string; full_name: string | null; role: string };
type District = { id: string; name: string };
type Doc = { id: string; kind: string; original_name: string | null };
type EditData = {
  id: string;
  proje_no: number;
  values: Record<string, string>;
  initialDistricts: District[];
  docs: Doc[];
  durum?: string;
  tamamlanma_tarihi?: string | null;
  teslim_tipi?: string | null;
  hard_copy_adedi?: number | null;
  tamamlananDocs?: Doc[];
};

const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";
const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";

const AST = [
  { v: "MR", t: "MR" }, { v: "MRL", t: "MRL" }, { v: "HD_YUK", t: "HD Yük" }, { v: "HD_INSAN", t: "HD İnsan" },
];
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
// Proje çizimleri yalnızca DWG kabul eder (Ölçü Formu / Yapı Ruhsatı / Diğer serbest)
const DWG_KINDS = ["mimari_proje", "elektrik_projesi", "statik_projesi", "tamamlanan_proje"];

export default function YeniProjeForm({
  companies: companiesInit, provinces, sorumlular, nextNo = null, edit,
}: {
  companies: Company[]; provinces: Province[]; sorumlular: Sorumlu[];
  nextNo?: number | null; edit?: EditData;
}) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!edit;
  const [companies, setCompanies] = useState<Company[]>(companiesInit);

  const [f, setF] = useState<Record<string, string>>(edit?.values ?? {
    proje_tipi: "mimari", siparis_tarihi: "", company_id: "", ada: "", parsel: "", is_adi: "",
    asansor_sayisi: "", asansor_tipi: "", province_id: "", district_id: "",
    fiyat: "", fatura_tipi: "faturasiz", proje_sorumlusu_id: "", tahmini_tamamlanma: "", montaj_firma_id: "",
  });
  const [districts, setDistricts] = useState<District[]>(edit?.initialDistricts ?? []);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [existingDocs, setExistingDocs] = useState<Doc[]>(edit?.docs ?? []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Revizyon modu
  const [revMode, setRevMode] = useState(false);
  const [rev, setRev] = useState({ rev_no: "", rev_tarihi: "", fiyat: "", fatura_tipi: "faturasiz", rev_aciklama: "" });

  // Yeni müşteri modalı (aktif sekmede)
  const [showMusteri, setShowMusteri] = useState(false);

  // Proje tamamlama (güncelle ekranında)
  const today = new Date().toISOString().slice(0, 10);
  const isTamamlandi = edit?.durum === "TAMAMLANDI";
  const [compTarih, setCompTarih] = useState(edit?.tamamlanma_tarihi || today);
  const [compTeslim, setCompTeslim] = useState(edit?.teslim_tipi || "");
  const [compAdet, setCompAdet] = useState(edit?.hard_copy_adedi ? String(edit.hard_copy_adedi) : "");
  const [compStaged, setCompStaged] = useState<File[]>([]);
  const [compExisting, setCompExisting] = useState<Doc[]>(edit?.tamamlananDocs ?? []);

  // Yeni müşteri Yönetim'de açıldıktan sonra bu sekmeye dönünce firma listesini tazele
  useEffect(() => {
    async function refresh() {
      const { data } = await supabase.from("companies").select("id, short_name, legal_name, city, category").order("short_name").limit(2000);
      if (data) setCompanies(data as any);
    }
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const setRevF = (k: string, v: string) => setRev((s) => ({ ...s, [k]: v }));
  // Seçili firma "Diğer" kategorisinde mi? (montaj firması bağlama bu durumda gösterilir)
  const selectedCompany = companies.find((c) => c.id === f.company_id);
  const selectedIsDiger = (selectedCompany?.category ?? "asansor") === "diger";
  const slots = f.proje_tipi === "uygulama" ? SLOTS_UYGULAMA : SLOTS_MIMARI;
  const fiyatNum = f.fiyat === "" ? null : Number(f.fiyat);
  const toplam = fiyatNum == null ? null : (f.fatura_tipi === "faturali" ? Math.round(fiyatNum * 1.2 * 100) / 100 : fiyatNum);
  const revFiyatNum = rev.fiyat === "" ? null : Number(rev.fiyat);
  const revToplam = revFiyatNum == null ? null : (rev.fatura_tipi === "faturali" ? Math.round(revFiyatNum * 1.2 * 100) / 100 : revFiyatNum);
  const reqCls = (bad: boolean) => (touched && bad ? " border-red-400 bg-red-50" : "");
  const safeProvinces = (provinces ?? []).filter((p) => p && p.name != null);
  const safeDistricts = (districts ?? []).filter((d) => d && d.name != null);
  const cityOptions = safeProvinces.map((p) => p.name);

  async function onProvince(v: string) {
    set("province_id", v); set("district_id", ""); setDistricts([]);
    if (v) {
      const { data } = await supabase.from("districts").select("id, name").eq("province_id", Number(v)).order("name").limit(2000);
      setDistricts(data ?? []);
    }
  }

  // "diger" çoklu; diğerleri tek (yeni seçim öncekini değiştirir)
  function addFiles(kind: string, list: FileList | null) {
    let arr = list ? Array.from(list).filter((x): x is File => !!x) : [];
    if (arr.length === 0) return;
    // Proje çizimleri yalnızca DWG
    if (DWG_KINDS.includes(kind)) {
      const bad = arr.filter((fl) => !fl.name.toLowerCase().endsWith(".dwg"));
      arr = arr.filter((fl) => fl.name.toLowerCase().endsWith(".dwg"));
      if (bad.length) setErr("Proje çizimleri yalnızca DWG dosyası olabilir.");
      if (arr.length === 0) return;
    }
    const multiple = kind === "diger";
    setFiles((s) => ({ ...s, [kind]: multiple ? [...(s[kind] ?? []), ...arr] : [arr[0]] }));
  }
  function removeFile(kind: string, idx: number) {
    setFiles((s) => ({ ...s, [kind]: (s[kind] ?? []).filter((_, i) => i !== idx) }));
  }
  async function deleteExisting(id: string) {
    const res = await deleteTakipDoc(id);
    if (!res.ok) return setErr(res.error);
    setExistingDocs((d) => d.filter((x) => x.id !== id));
    router.refresh();
  }

  // --- Proje tamamlama (yalnız güncelle ekranında) ---
  function addCompFiles(list: FileList | null) {
    let arr = list ? Array.from(list).filter((x): x is File => !!x) : [];
    if (arr.length === 0) return;
    const bad = arr.filter((fl) => !fl.name.toLowerCase().endsWith(".dwg"));
    arr = arr.filter((fl) => fl.name.toLowerCase().endsWith(".dwg"));
    if (bad.length) setErr("Tamamlanan proje yalnızca DWG dosyası olabilir.");
    if (arr.length === 0) return;
    setCompStaged((s) => [...s, ...arr]);
  }
  async function compDeleteExisting(id: string) {
    const res = await deleteTakipDoc(id);
    if (!res.ok) return setErr(res.error);
    setCompExisting((d) => d.filter((x) => x.id !== id));
  }
  async function tamamla() {
    if (!edit) return;
    setTouched(true); setErr(null);
    if (compExisting.length + compStaged.length === 0) return setErr("Tamamlanan projeyi yükleyin (DWG).");
    if (!compTarih) return setErr("Tamamlanma tarihi zorunludur.");
    if (!compTeslim) return setErr("Teslim tipi seçiniz.");
    if (compTeslim === "hard_copy" && (!compAdet || Number(compAdet) < 1)) return setErr("Hard Copy adedi giriniz.");
    setBusy(true);
    for (let i = 0; i < compStaged.length; i++) {
      setProgress(`Tamamlanan proje yükleniyor… (${i + 1}/${compStaged.length})`);
      const up = await uploadTakipFile(supabase, edit.id, "tamamlanan_proje", compStaged[i]);
      if (!up.ok) { setBusy(false); setProgress(""); return setErr(up.error); }
    }
    setProgress("");
    const res = await completeTakipProje(edit.id, {
      tamamlanma_tarihi: compTarih, teslim_tipi: compTeslim as any,
      hard_copy_adedi: compTeslim === "hard_copy" ? Number(compAdet) : null,
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    router.push("/proje-takip"); router.refresh();
  }

  function buildPayload(): TakipPayload {
    const prov = safeProvinces.find((p) => String(p.id) === f.province_id);
    const dist = safeDistricts.find((d) => d.id === f.district_id);
    return {
      proje_tipi: f.proje_tipi as any,
      siparis_tarihi: f.siparis_tarihi || null,
      company_id: f.company_id,
      ada: f.ada || null,
      parsel: f.parsel || null,
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
      montaj_firma_id: selectedIsDiger ? (f.montaj_firma_id || null) : null,
    };
  }

  // Bekleyen dosyaları hedef kayda yükle — doğrudan Supabase Storage'a (Vercel 4.5MB sınırına takılmaz)
  // Sadece geçerli slot türlerini yükle (proje tipi değişince kalan eski türler atlanır)
  async function uploadStaged(targetId: string): Promise<string[]> {
    const validKinds = new Set(slots.map((s) => s.kind));
    const failed: string[] = [];
    const all = Object.entries(files).filter(([kind]) => validKinds.has(kind));
    const total = all.reduce((n, [, arr]) => n + arr.length, 0);
    let done = 0;
    for (const [kind, arr] of all) {
      for (const file of arr) {
        setProgress(`Dosyalar yükleniyor… (${++done}/${total})`);
        const up = await uploadTakipFile(supabase, targetId, kind, file);
        if (!up.ok) failed.push(`${file.name}: ${up.error}`);
      }
    }
    setProgress("");
    return failed;
  }

  async function submit() {
    setTouched(true); setErr(null);

    // --- Revizyon ---
    if (revMode && edit) {
      if (!rev.rev_no.trim()) return setErr("Revizyon numarası zorunludur.");
      setBusy(true); setProgress("Revizyon oluşturuluyor…");
      const res = await createRevision(edit.id, {
        rev_no: rev.rev_no.trim(),
        rev_tarihi: rev.rev_tarihi || null,
        fiyat: revFiyatNum,
        fatura_tipi: rev.fatura_tipi as any,
        rev_aciklama: rev.rev_aciklama || null,
      });
      if (!res.ok) { setBusy(false); setProgress(""); return setErr(res.error); }
      // Yüklenen dosyalar orijinal (ana) kayıttaki dosyayı değiştirir — dokümanlar zorunlu değil
      const failed = await uploadStaged(edit.id);
      setBusy(false);
      if (failed.length) return setErr("Revizyon oluşturuldu ancak bazı dosyalar yüklenemedi:\n" + failed.join("\n"));
      router.push("/proje-takip"); router.refresh();
      return;
    }

    // --- Yeni / Güncelle ---
    if (!f.company_id) return setErr("Firma seçiniz.");
    if (!f.proje_tipi) return setErr("Proje tipi seçiniz.");
    for (const s of slots) {
      const have = (files[s.kind] ?? []).length + existingDocs.filter((d) => d.kind === s.kind).length;
      if (s.required && have === 0) return setErr(`${s.label} zorunludur (bir dosya seçin).`);
    }
    setBusy(true); setProgress(isEdit ? "Güncelleniyor…" : "Proje kaydı oluşturuluyor…");
    const payload = buildPayload();
    const res = isEdit ? await updateTakipProje(edit!.id, payload) : await createTakipProje(payload);
    if (!res.ok) { setBusy(false); setProgress(""); return setErr(res.error); }
    const id = isEdit ? edit!.id : res.id!;
    const failed = await uploadStaged(id);
    setBusy(false);
    if (failed.length) {
      setErr((isEdit ? "Güncellendi" : "Proje oluşturuldu") + " ancak bazı dosyalar yüklenemedi:\n" + failed.join("\n"));
      return;
    }
    router.push("/proje-takip"); router.refresh();
  }

  const projeNoText = isEdit ? String(edit!.proje_no) : (nextNo ?? "—");

  // Dokümanlar bölümü — hem yeni, hem güncelle, hem revizyonda aynı slotlar
  const documentsSection = (
    <div>
      <h3 className="font-bold text-sm mb-2">
        Dokümanlar {f.proje_tipi === "uygulama" ? "(Uygulama)" : "(Mimari)"}
        {revMode && <span className="text-slate-400 font-normal"> · opsiyonel, yüklenen orijinal dosyayı değiştirir</span>}
      </h3>
      <div className="space-y-2">
        {slots.map((s) => (
          <DocSlot key={s.kind} label={s.label}
            required={!revMode && s.required}
            multiple={s.kind === "diger"}
            accept={DWG_KINDS.includes(s.kind) ? ".dwg" : undefined}
            invalid={!revMode && touched && s.required && (files[s.kind] ?? []).length + existingDocs.filter((d) => d.kind === s.kind).length === 0}
            existing={existingDocs.filter((d) => d.kind === s.kind)}
            staged={files[s.kind] ?? []}
            onAdd={(l) => addFiles(s.kind, l)}
            onRemoveStaged={(i) => removeFile(s.kind, i)}
            onDeleteExisting={deleteExisting} />
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="bg-white/80 backdrop-blur border-b border-[#e5e9f0] px-8 pt-5 pb-4 sticky top-0 z-20 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">{isEdit ? (revMode ? "Revizyon Ekle" : "Proje Güncelle") : "Yeni Proje Takip Kaydı"}</h1>
          <p className="text-sm text-slate-500">
            {revMode ? "Yeni revizyon HAZIRLANIYOR durumuyla oluşturulur." : isEdit ? "Bilgileri ve dosyaları güncelleyin." : "Proje No otomatik ve sıralı atanır · Durum: HAZIRLANIYOR"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && isTamamlandi && (
            <button onClick={() => { setRevMode((v) => !v); setErr(null); setTouched(false); }}
              className={`text-sm font-bold px-4 py-2 rounded-xl border ${revMode ? "bg-brand-light text-brand border-brand/30" : "bg-white text-brand border-brand/40 hover:bg-brand-light"}`}>
              {revMode ? "Revizyondan Çık" : "+ Revizyon Ekle"}
            </button>
          )}
          <Link href="/proje-takip" className="text-sm font-semibold text-slate-500 hover:text-slate-700">← Listeye dön</Link>
        </div>
      </div>

      <div className="p-8 gs-fade max-w-4xl">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          {/* Proje No — en üstte */}
          <div className="flex items-center justify-between bg-navy/5 border border-navy/10 rounded-xl px-4 py-3">
            <span className="text-sm font-semibold text-slate-600">Proje No {revMode && <span className="text-brand">· Revizyon</span>}</span>
            <span className="text-2xl font-extrabold text-navy">{projeNoText}</span>
          </div>

          {/* Revizyon konteyneri — dokümanlardan önce */}
          {revMode && (
            <div className="bg-brand-light/40 border border-brand/20 rounded-xl p-4 space-y-4">
              <h3 className="font-extrabold text-sm text-brand">Revizyon Bilgileri</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Revizyon Numarası *"><input className={inp + reqCls(!rev.rev_no.trim())} value={rev.rev_no} onChange={(e) => setRevF("rev_no", e.target.value)} placeholder="Örn: 1, 2, A…" /></Field>
                <Field label="Revizyon Tarihi"><input type="date" className={inp} value={rev.rev_tarihi} onChange={(e) => setRevF("rev_tarihi", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fiyat">
                  <input type="number" min={0} step="0.01" className={inp} value={rev.fiyat} onChange={(e) => setRevF("fiyat", e.target.value)} placeholder="0.00" />
                  <p className="text-[11px] font-bold text-amber-600 mt-1">⚠ KDV HARİÇ GİRİNİZ</p>
                </Field>
                <Field label="Fatura Durumu">
                  <select className={inp} value={rev.fatura_tipi} onChange={(e) => setRevF("fatura_tipi", e.target.value)}>
                    <option value="faturasiz">Faturasız</option>
                    <option value="faturali">Faturalı (%20 KDV eklenir)</option>
                  </select>
                </Field>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Revizyon Toplam Tutar</span>
                <span className="text-lg font-extrabold text-navy">{money(revToplam)}</span>
              </div>
              <Field label="Revizyon Açıklaması">
                <textarea rows={2} className={inp} value={rev.rev_aciklama} onChange={(e) => setRevF("rev_aciklama", e.target.value)} placeholder="Revizyon nedeni / kapsamı…" />
              </Field>
            </div>
          )}

          {/* Ana bilgiler — revizyonda ana projeden devralınır (referans, kilitli) */}
          <div className={revMode ? "opacity-60 pointer-events-none" : ""}>
            <div className="space-y-5">
              {revMode && <p className="text-xs text-slate-500">Aşağıdaki bilgiler ana projeden devralınır (revizyonda değiştirilmez).</p>}
              <div className="grid grid-cols-2 gap-4">
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
                  <select className={inp + reqCls(!f.company_id)} value={f.company_id} onChange={(e) => set("company_id", e.target.value)}>
                    <option value="">Müşteri seçiniz…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                  </select>
                  {!revMode && (
                    <button type="button" onClick={() => setShowMusteri(true)}
                      className="flex-none text-xs font-bold text-brand border border-brand/30 rounded-lg px-3 hover:bg-brand-light whitespace-nowrap">
                      + Yeni Oluştur
                    </button>
                  )}
                </div>
              </Field>

              {selectedIsDiger && (
                <Field label="Montaj Firması Bağla">
                  <select className={inp} value={f.montaj_firma_id} onChange={(e) => set("montaj_firma_id", e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {companies.filter((c) => c.id !== f.company_id).map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Listede yoksa, Yönetim Panelinden &apos;Yeni Müşteri Oluştur&apos;a gidin.</p>
                </Field>
              )}

              <div className="grid grid-cols-3 gap-4">
                <Field label="Ada"><input className={inp} value={f.ada} onChange={(e) => set("ada", e.target.value)} /></Field>
                <Field label="Parsel"><input className={inp} value={f.parsel} onChange={(e) => set("parsel", e.target.value)} /></Field>
                <Field label="İşin Adı"><input className={inp} value={f.is_adi} onChange={(e) => set("is_adi", e.target.value)} /></Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Asansör Sayısı"><input type="number" min={0} className={inp} value={f.asansor_sayisi} onChange={(e) => set("asansor_sayisi", e.target.value)} /></Field>
                <Field label="Asansör Tipi">
                  <select className={inp} value={f.asansor_tipi} onChange={(e) => set("asansor_tipi", e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {AST.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="İl">
                  <select className={inp} value={f.province_id} onChange={(e) => onProvince(e.target.value)}>
                    <option value="">İl seçiniz…</option>
                    {safeProvinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="İlçe">
                  <select className={inp} value={f.district_id} onChange={(e) => set("district_id", e.target.value)} disabled={safeDistricts.length === 0}>
                    <option value="">{f.province_id ? "İlçe seçiniz…" : "Önce il seçin"}</option>
                    {safeDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
              </div>

              {!revMode && (
                <>
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">Toplam Tutar</span>
                    <span className="text-xl font-extrabold text-navy">{money(toplam)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dokümanlar — her modda aktif */}
          {documentsSection}

          {/* Sorumlu / tarih — revizyonda devralınır (kilitli) */}
          <div className={revMode ? "opacity-60 pointer-events-none" : ""}>
            <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Proje Tamamlama — yalnız güncelle ekranında (revizyon modunda değil) */}
          {isEdit && !revMode && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="font-bold text-sm">Proje Tamamlama</h3>
              {isTamamlandi ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 space-y-1">
                  <div>✓ Proje tamamlandı{edit?.tamamlanma_tarihi ? ` (${new Date(edit.tamamlanma_tarihi).toLocaleDateString("tr-TR")})` : ""}.</div>
                  <div>Teslim: {edit?.teslim_tipi === "hard_copy" ? `Hard Copy (${edit?.hard_copy_adedi ?? "?"} adet)` : "Dijital"} · Muhasebeye gönderildi.</div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tamamlanma Tarihi *"><input type="date" className={inp} value={compTarih} onChange={(e) => setCompTarih(e.target.value)} /></Field>
                    <Field label="Teslim Tipi *">
                      <select className={inp} value={compTeslim} onChange={(e) => setCompTeslim(e.target.value)}>
                        <option value="">Seçiniz…</option><option value="hard_copy">Hard Copy</option><option value="dijital">Dijital</option>
                      </select>
                    </Field>
                  </div>
                  {compTeslim === "hard_copy" && <Field label="Hard Copy Adedi *"><input type="number" min={1} className={inp} value={compAdet} onChange={(e) => setCompAdet(e.target.value)} /></Field>}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Projeyi Yükle (tamamlanan proje) · yalnızca DWG *</label>
                    {compExisting.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-xs mb-1">
                        <a href={`/api/belge/takip?id=${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-navy font-semibold hover:underline truncate"><span className="material-symbols-rounded text-[15px]">description</span>{d.original_name ?? "dosya"}</a>
                        <button type="button" onClick={() => compDeleteExisting(d.id)} className="text-red-500 hover:underline">Sil</button>
                      </div>
                    ))}
                    {compStaged.map((file, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-slate-600 mb-1">
                        <span className="inline-flex items-center gap-1"><span className="material-symbols-rounded text-[15px] text-amber-600">upload_file</span>{file?.name ?? "dosya"} <span className="text-slate-400">· kaydedilecek</span></span>
                        <button type="button" onClick={() => setCompStaged((s) => s.filter((_, j) => j !== i))} className="text-red-500 hover:underline">Kaldır</button>
                      </div>
                    ))}
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-brand bg-brand-light px-3 py-2 rounded-lg hover:bg-brand/10 w-fit">
                      <span className="material-symbols-rounded text-[16px]">attach_file</span> Dosya Seç
                      <input type="file" multiple accept=".dwg" className="hidden" onChange={(e) => { addCompFiles(e.target.files); e.currentTarget.value = ""; }} />
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600 whitespace-pre-line">{err}</div>}

          <div className="flex items-center justify-end gap-3 pt-1">
            {progress && <span className="text-xs text-slate-500">{progress}</span>}
            {isEdit && !revMode && !isTamamlandi && (
              <button type="button" disabled={busy} onClick={tamamla} className="mr-auto text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-5 py-2.5 rounded-xl disabled:opacity-50">
                Tamamla ve Muhasebeye Gönder
              </button>
            )}
            <Link href="/proje-takip" className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</Link>
            <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-50">
              {busy ? "Kaydediliyor…" : revMode ? "Revizyonu Kaydet" : isEdit ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>

      {showMusteri && (
        <YeniMusteriModal
          provinces={safeProvinces.map((p) => p.name)}
          onClose={() => setShowMusteri(false)}
          onCreated={(c) => {
            setCompanies((cs) => [...cs, c].sort((a, b) => a.short_name.localeCompare(b.short_name, "tr")));
            set("company_id", c.id);
            setShowMusteri(false);
          }}
        />
      )}
    </div>
  );
}

function YeniMusteriModal({ provinces, onClose, onCreated }: {
  provinces: string[]; onClose: () => void; onCreated: (c: Company) => void;
}) {
  const [category, setCategory] = useState("asansor");
  const [f, setF] = useState<Record<string, string>>({
    short_name: "", legal_name: "", authorized_person: "", registered_brand: "", city: "",
    industry_reg_no: "", sector: "", mobile_phone: "", email: "", address: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const req = category === "diger"
    ? ["short_name", "legal_name", "authorized_person", "sector", "city", "mobile_phone", "address"]
    : ["short_name", "legal_name", "authorized_person", "registered_brand", "city", "industry_reg_no", "address"];
  const rc = (k: string) => (touched && req.includes(k) && !(f[k] ?? "").trim() ? " !border-red-300 !bg-red-50" : "");

  async function submit() {
    setTouched(true); setErr(null);
    if (req.some((k) => !(f[k] ?? "").trim())) return setErr("Lütfen kırmızı ile işaretli zorunlu alanları doldurun.");
    setBusy(true);
    const res = await createCompany({ ...f, category, ce_module: category === "asansor" ? "H1" : "" });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onCreated({ id: (res as any).id, short_name: f.short_name, legal_name: f.legal_name || null, city: f.city || null, category });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-extrabold text-lg">Yeni Müşteri</h2>
          <button onClick={onClose} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Müşteri Kategorisi *</label>
            <div className="flex gap-2">
              {[{ v: "asansor", t: "Asansör" }, { v: "diger", t: "Diğer" }].map((k) => (
                <button key={k.v} type="button" onClick={() => setCategory(k.v)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border ${category === k.v ? "bg-brand text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-brand"}`}>{k.t}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Belgeler (CE vb.) için Yönetim → Müşteriler'den daha sonra düzenleyebilirsiniz.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Field label="Kısa Ad *"><input className={inp + rc("short_name")} value={f.short_name} onChange={(e) => set("short_name", e.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="Ticari Ünvan *"><input className={inp + rc("legal_name")} value={f.legal_name} onChange={(e) => set("legal_name", e.target.value)} /></Field></div>
            <Field label="Yetkili Ad / Soyad *"><input className={inp + rc("authorized_person")} value={f.authorized_person} onChange={(e) => set("authorized_person", e.target.value)} /></Field>
            {category === "diger"
              ? <Field label="Sektör / Meslek *"><input className={inp + rc("sector")} value={f.sector} onChange={(e) => set("sector", e.target.value)} /></Field>
              : <Field label="Tescilli Marka *"><input className={inp + rc("registered_brand")} value={f.registered_brand} onChange={(e) => set("registered_brand", e.target.value)} /></Field>}
            <Field label="Şehir *">
              <select className={inp + rc("city")} value={f.city} onChange={(e) => set("city", e.target.value)}>
                <option value="">Seçiniz…</option>{provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            {category === "diger"
              ? <Field label="Cep Telefonu *"><input className={inp + rc("mobile_phone")} value={f.mobile_phone} onChange={(e) => set("mobile_phone", e.target.value)} placeholder="0 5xx xxx xx xx" /></Field>
              : <Field label="Sanayi Sicil No *"><input className={inp + rc("industry_reg_no")} value={f.industry_reg_no} onChange={(e) => set("industry_reg_no", e.target.value)} /></Field>}
            {category !== "diger" && <Field label="Cep Telefonu"><input className={inp} value={f.mobile_phone} onChange={(e) => set("mobile_phone", e.target.value)} placeholder="0 5xx xxx xx xx" /></Field>}
            <Field label="E-Posta (opsiyonel)"><input type="email" className={inp} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Adres *"><input className={inp + rc("address")} value={f.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
          </div>

          {err && <div className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2.5">İptal</button>
            <button disabled={busy} onClick={submit} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">{busy ? "Kaydediliyor…" : "Kaydet ve Seç"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>;
}

// Mevcut yüklenen + yeni seçilen dosyaları gösteren yükleme kutusu (Teknik Dosya FileZone ile aynı davranış)
function DocSlot({
  label, required, multiple, invalid, existing, staged, onAdd, onRemoveStaged, onDeleteExisting, accept,
}: {
  label: string; required: boolean; multiple: boolean; invalid: boolean;
  existing: Doc[]; staged: File[];
  onAdd: (l: FileList | null) => void; onRemoveStaged: (i: number) => void; onDeleteExisting: (id: string) => void; accept?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-3 space-y-2 ${invalid ? "border-red-400 bg-red-50" : "border-slate-200"}`}>
      <div className="text-sm font-semibold text-slate-800">
        {label} {required ? <span className="text-red-500">*</span> : <span className="text-slate-400 text-xs font-normal">({multiple ? "çoklu, opsiyonel" : "tek dosya, opsiyonel"})</span>}
        {accept === ".dwg" && <span className="text-slate-400 text-xs font-normal"> · yalnızca DWG</span>}
      </div>
      {existing.map((d) => (
        <div key={d.id} className="flex items-center justify-between text-xs">
          <a href={`/api/belge/takip?id=${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-navy font-semibold hover:underline truncate">
            <span className="material-symbols-rounded text-[15px]">description</span>{d.original_name ?? "dosya"}
          </a>
          <button type="button" onClick={() => onDeleteExisting(d.id)} className="text-red-500 hover:underline">Sil</button>
        </div>
      ))}
      {staged.map((file, i) => (
        <div key={i} className="flex items-center justify-between text-xs text-slate-600">
          <span className="inline-flex items-center gap-1"><span className="material-symbols-rounded text-[15px] text-amber-600">upload_file</span>{file?.name ?? "dosya"} <span className="text-slate-400">· kaydedilecek{!multiple && existing.length > 0 ? " (öncekini değiştirir)" : ""}</span></span>
          <button type="button" onClick={() => onRemoveStaged(i)} className="text-red-500 hover:underline">Kaldır</button>
        </div>
      ))}
      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-brand bg-brand-light px-3 py-2 rounded-lg hover:bg-brand/10 w-fit">
        <span className="material-symbols-rounded text-[16px]">attach_file</span>
        {multiple ? "Dosya Seç (çoklu)" : "Dosya Seç"}
        <input type="file" multiple={multiple} accept={accept} className="hidden" onChange={(e) => { onAdd(e.target.files); e.currentTarget.value = ""; }} />
      </label>
    </div>
  );
}
