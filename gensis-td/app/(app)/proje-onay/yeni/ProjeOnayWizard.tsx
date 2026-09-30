"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProjeOnay, updateProjeOnay, type OnayPayload } from "./actions";
import { createIlgiliIdare, uploadEngineerDocument } from "@/app/(app)/admin/actions";

type Company = { id: string; short_name: string; legal_name: string | null };
type Province = { id: number; name: string };
type Cap = { beyan_yuku_kg: number; kisi_sayisi: number | null };
type District = { id: string; name: string };
type Engineer = { id: string; full_name: string; discipline: string; chamber_reg_no: string | null; company_id: string | null; imzaDocId?: string | null };
type Idare = { id: string; name: string; address: string | null };

export type OnayInitial = {
  id: string;
  companyId: string; dosyaNo: string; dilekceTarihi: string;
  provinceId: number | ""; districtId: string; districts: District[];
  asansorAdedi: string; yapiSahibi: string; montajAdresi: string;
  pafta: string; ada: string; parsel: string;
  beyanYuku: number | ""; beyanHizi: string; durak: string;
  makineMuhId: string; elektrikMuhId: string;
  ilgiliIdareId: string;
};

type Props = {
  companies: Company[]; provinces: Province[]; capacity: Cap[];
  engineers: Engineer[]; gensisCompanyId: string | null;
  ilgiliIdareler: Idare[];
  initial?: OnayInitial | null;
};

const STEPS = ["Dilekçe Bilgileri", "Proje Müellifi", "Önizleme"];
const RANGE_100 = Array.from({ length: 100 }, (_, i) => i + 1);
const empty = (x: any) => x === "" || x === null || x === undefined;
// Dropdown etiketi: büyük harf; adında "beled" yoksa sonuna BELEDİYESİ ekle
const idareLabel = (name: string) => {
  const up = (name || "").toLocaleUpperCase("tr");
  return up.includes("BELED") ? up : up + " BELEDİYESİ";
};

export default function ProjeOnayWizard(props: Props) {
  const router = useRouter();
  const supabase = createClient();
  const init = props.initial;
  const isEdit = !!init?.id;

  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState(init?.companyId ?? "");
  const [dosyaNo, setDosyaNo] = useState(init?.dosyaNo ?? "");
  const [dilekceTarihi, setDilekceTarihi] = useState(init?.dilekceTarihi ?? new Date().toISOString().slice(0, 10));
  const [provinceId, setProvinceId] = useState<number | "">(init?.provinceId ?? "");
  const [districtId, setDistrictId] = useState(init?.districtId ?? "");
  const [districts, setDistricts] = useState<District[]>(init?.districts ?? []);
  const [asansorAdedi, setAsansorAdedi] = useState(init?.asansorAdedi ?? "1");
  const [yapiSahibi, setYapiSahibi] = useState(init?.yapiSahibi ?? "");
  const [montajAdresi, setMontajAdresi] = useState(init?.montajAdresi ?? "");
  const [pafta, setPafta] = useState(init?.pafta ?? "");
  const [ada, setAda] = useState(init?.ada ?? "");
  const [parsel, setParsel] = useState(init?.parsel ?? "");
  const [beyanYuku, setBeyanYuku] = useState<number | "">(init?.beyanYuku ?? "");
  const [beyanHizi, setBeyanHizi] = useState(init?.beyanHizi ?? "");
  const [durak, setDurak] = useState(init?.durak ?? "");

  // İlgili İdare (dropdown + satır içi "Yeni" ekleme)
  const [idareList, setIdareList] = useState<Idare[]>(props.ilgiliIdareler ?? []);
  const [ilgiliIdareId, setIlgiliIdareId] = useState(init?.ilgiliIdareId ?? "");
  const [showAddIdare, setShowAddIdare] = useState(false);
  const [idareForm, setIdareForm] = useState({ name: "", address: "" });
  const [idareBusy, setIdareBusy] = useState(false);
  const [idareErr, setIdareErr] = useState<string | null>(null);
  async function addIdare() {
    if (!idareForm.name.trim()) { setIdareErr("İlgili idare adı zorunlu."); return; }
    setIdareBusy(true); setIdareErr(null);
    const res = await createIlgiliIdare(idareForm);
    setIdareBusy(false);
    if (!res.ok) { setIdareErr(res.error); return; }
    const yeni: Idare = { id: res.id, name: idareForm.name.trim(), address: idareForm.address.trim() || null };
    setIdareList((a) => [...a, yeni].sort((x, y) => x.name.localeCompare(y.name, "tr")));
    setIlgiliIdareId(yeni.id);
    setIdareForm({ name: "", address: "" }); setShowAddIdare(false);
  }

  const gMak = props.engineers.find((e) => e.discipline === "makine" && e.company_id === props.gensisCompanyId);
  const gElk = props.engineers.find((e) => e.discipline === "elektrik" && e.company_id === props.gensisCompanyId);
  const [makineMuhId, setMakineMuhId] = useState(init?.makineMuhId ?? gMak?.id ?? "");
  const [elektrikMuhId, setElektrikMuhId] = useState(init?.elektrikMuhId ?? gElk?.id ?? "");

  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const kisi = useMemo(
    () => (beyanYuku === "" ? null : props.capacity.find((c) => c.beyan_yuku_kg === beyanYuku)?.kisi_sayisi ?? null),
    [beyanYuku, props.capacity]
  );
  const company = props.companies.find((c) => c.id === companyId) || null;
  const provinceName = props.provinces.find((p) => p.id === provinceId)?.name;
  const districtName = districts.find((d) => d.id === districtId)?.name;
  const idareAdi = idareList.find((x) => x.id === ilgiliIdareId)?.name ?? "";

  const makineOptions = useMemo(
    () => props.engineers.filter((e) => e.discipline === "makine" && (e.company_id === props.gensisCompanyId || (!!companyId && e.company_id === companyId))),
    [props.engineers, props.gensisCompanyId, companyId]
  );
  const elektrikOptions = useMemo(
    () => props.engineers.filter((e) => e.discipline === "elektrik" && (e.company_id === props.gensisCompanyId || (!!companyId && e.company_id === companyId))),
    [props.engineers, props.gensisCompanyId, companyId]
  );

  const ec = (v: any) => (showErrors && empty(v) ? " !border-red-300 !bg-red-50" : "");
  const stepFields: Record<number, Record<string, any>> = {
    0: { companyId, provinceId, ilgiliIdareId, yapiSahibi, montajAdresi, beyanYuku, beyanHizi, durak },
    1: { makineMuhId, elektrikMuhId },
  };
  function stepMissing(i: number) {
    const f = stepFields[i];
    return f ? Object.values(f).filter(empty).length : 0;
  }
  const totalMissing = stepMissing(0) + stepMissing(1);

  function goNext() {
    const m = stepMissing(step);
    if (m > 0) { setShowErrors(true); setError(`Bu adımda ${m} zorunlu alan eksik.`); return; }
    setShowErrors(false); setError(null); setStep((s) => Math.min(2, s + 1));
  }
  function goToStep(i: number) {
    if (i <= step) { setStep(i); setShowErrors(false); setError(null); } else goNext();
  }

  async function onProvince(idStr: string) {
    const id = idStr ? Number(idStr) : "";
    setProvinceId(id); setDistrictId(""); setDistricts([]);
    if (id !== "") {
      const { data } = await supabase.from("districts").select("id, name").eq("province_id", id).order("name").limit(2000);
      setDistricts(data ?? []);
    }
  }

  async function handleSave() {
    if (totalMissing > 0) { setShowErrors(true); setError("Zorunlu alanlar eksik."); setStep(stepMissing(0) > 0 ? 0 : 1); return; }
    setSaving(true); setError(null);
    const payload: OnayPayload = {
      company_id: companyId,
      dosya_no: dosyaNo || null,
      dilekce_tarihi: dilekceTarihi || null,
      province_id: provinceId === "" ? null : provinceId,
      district_id: null,
      asansor_adedi: asansorAdedi ? Number(asansorAdedi) : 1,
      yapi_sahibi: yapiSahibi || null,
      montaj_adresi: montajAdresi || null,
      pafta: pafta || null, ada: ada || null, parsel: parsel || null,
      beyan_yuku_kg: beyanYuku === "" ? null : beyanYuku,
      kisi_sayisi: kisi,
      beyan_hizi: beyanHizi ? Number(String(beyanHizi).replace(",", ".")) : null,
      durak_sayisi: durak ? Number(durak) : null,
      makine_muhendis_id: makineMuhId || null,
      elektrik_muhendis_id: elektrikMuhId || null,
      ilgili_idare_id: ilgiliIdareId || null,
      input_data: { il: provinceName ?? "", belediye: "", ilgili_idare: idareAdi, beyan_hizi_txt: beyanHizi },
    };
    const res = isEdit ? await updateProjeOnay(init!.id, payload) : await saveProjeOnay(payload);
    setSaving(false);
    if (res.ok) { setSavedId(res.id); router.refresh(); } else setError(res.error);
  }

  if (savedId) {
    return (
      <div className="p-7 max-w-2xl">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 grid place-items-center text-3xl mx-auto mb-4">✓</div>
          <h1 className="text-xl font-extrabold mb-1">{isEdit ? "Güncellendi" : "Kaydedildi"}</h1>
          <p className="text-slate-500 mb-6">Proje onay dosyası {isEdit ? "güncellendi" : "oluşturuldu"}.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/proje-onay")} className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-lg">Listeye dön</button>
            <button onClick={() => router.push(`/proje-onay/${savedId}`)} className="bg-slate-100 hover:bg-slate-200 font-bold px-5 py-2.5 rounded-lg">Belgeler</button>
          </div>
        </div>
      </div>
    );
  }

  const inp = "w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand";

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-7 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="text-sm text-slate-500">
          {isEdit ? "Proje Onay Düzenle" : "Yeni Proje Onay Dosyası"} › <b className="text-slate-900">{STEPS[step]}</b>
          {showErrors && totalMissing > 0 && <span className="ml-3 text-xs text-red-600 font-semibold">{totalMissing} zorunlu alan eksik</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="text-sm font-bold px-4 py-2 rounded-xl border border-[#e5e9f0] bg-white hover:bg-slate-50 disabled:opacity-45">← Geri</button>
          {step < 2 ? (
            <button onClick={goNext} className="gs-btn text-sm font-bold px-5 py-2 rounded-xl">İleri →</button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="text-sm font-bold px-5 py-2 rounded-xl text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 6px 16px rgba(21,128,61,.26)" }}>
              {saving ? "Kaydediliyor…" : isEdit ? "✓ Güncelle" : "✓ Kaydet"}
            </button>
          )}
        </div>
      </div>

      <div className="p-7 max-w-4xl">
        <div className="flex mb-7">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => goToStep(i)} className="flex items-center gap-2 mr-6">
              <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${i === step ? "text-white" : i < step ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}
                style={i === step ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)" } : undefined}>
                {i < step ? "✓" : i + 1}
              </span>
              <span className={`text-sm font-semibold ${i === step ? "text-slate-900" : "text-slate-400"}`}>{s}</span>
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-bold mb-4">Dilekçe Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4">
              <F label="Montaj / Mimarlık Firması *" full>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inp + ec(companyId)}>
                  <option value="">Firma seçiniz…</option>
                  {props.companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                </select>
              </F>
              <F label="İl *">
                <select value={provinceId} onChange={(e) => onProvince(e.target.value)} className={inp + ec(provinceId)}>
                  <option value="">Seçiniz…</option>
                  {props.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </F>
              <F label="İlgili İdare *" full>
                <div className="flex gap-2">
                  <select value={ilgiliIdareId} onChange={(e) => setIlgiliIdareId(e.target.value)} className={inp + ec(ilgiliIdareId)}>
                    <option value="">Seçiniz…</option>
                    {idareList.map((x) => <option key={x.id} value={x.id}>{idareLabel(x.name)}</option>)}
                  </select>
                  <button type="button" onClick={() => { setShowAddIdare((v) => !v); setIdareErr(null); }}
                    className="flex-none text-xs font-bold text-brand border border-brand/30 rounded-lg px-3 hover:bg-brand-light whitespace-nowrap">
                    {showAddIdare ? "Kapat" : "+ Yeni"}
                  </button>
                </div>
                {showAddIdare && (
                  <div className="mt-2 bg-brand-light/40 border border-brand/15 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-600">Yeni İlgili İdare</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input className={inp + " col-span-1"} placeholder="Adı *" value={idareForm.name} onChange={(e) => setIdareForm((s) => ({ ...s, name: e.target.value }))} />
                      <input className={inp + " col-span-2"} placeholder="Adres (opsiyonel)" value={idareForm.address} onChange={(e) => setIdareForm((s) => ({ ...s, address: e.target.value }))} />
                    </div>
                    {idareErr && <div className="text-xs text-red-600">{idareErr}</div>}
                    <div className="flex justify-end">
                      <button type="button" onClick={addIdare} disabled={idareBusy}
                        className="text-xs font-bold text-white bg-brand hover:bg-brand-dark px-4 py-2 rounded-lg disabled:opacity-50">
                        {idareBusy ? "Ekleniyor…" : "Ekle ve Seç"}
                      </button>
                    </div>
                  </div>
                )}
              </F>
              <F label="Dilekçe Tarihi"><input type="date" value={dilekceTarihi} onChange={(e) => setDilekceTarihi(e.target.value)} className={inp} /></F>
              <F label="Asansör Adedi"><input type="number" min={1} value={asansorAdedi} onChange={(e) => setAsansorAdedi(e.target.value)} className={inp} /></F>
              <F label="Dosya No (opsiyonel)" full><input value={dosyaNo} onChange={(e) => setDosyaNo(e.target.value)} className={inp} /></F>
              <F label="Yapı Sahibi *" full><input value={yapiSahibi} onChange={(e) => setYapiSahibi(e.target.value)} className={inp + ec(yapiSahibi)} /></F>
              <F label="Montaj Adresi *" full><input value={montajAdresi} onChange={(e) => setMontajAdresi(e.target.value)} placeholder="Örn. YUNUSELİ MAH. OSMANGAZİ/BURSA" className={inp + ec(montajAdresi)} /></F>
              <F label="Pafta"><input value={pafta} onChange={(e) => setPafta(e.target.value)} className={inp} /></F>
              <F label="Ada"><input value={ada} onChange={(e) => setAda(e.target.value)} className={inp} /></F>
              <F label="Parsel"><input value={parsel} onChange={(e) => setParsel(e.target.value)} className={inp} /></F>
              <F label="Beyan Yükü (kg) *">
                <select value={beyanYuku} onChange={(e) => setBeyanYuku(e.target.value ? Number(e.target.value) : "")} className={inp + ec(beyanYuku)}>
                  <option value="">Seçiniz…</option>
                  {props.capacity.map((c) => <option key={c.beyan_yuku_kg} value={c.beyan_yuku_kg}>{c.beyan_yuku_kg}</option>)}
                </select>
              </F>
              <F label="Kişi Sayısı (otomatik)"><input value={kisi ?? ""} disabled className={inp + " bg-slate-100"} /></F>
              <F label="Beyan Hızı (m/s) *"><input value={beyanHizi} onChange={(e) => setBeyanHizi(e.target.value)} placeholder="Örn. 1,60" className={inp + ec(beyanHizi)} /></F>
              <F label="Durak Sayısı *">
                <select value={durak} onChange={(e) => setDurak(e.target.value)} className={inp + ec(durak)}>
                  <option value="">Seçiniz…</option>
                  {RANGE_100.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </F>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-bold mb-1">Proje Müellifi</h2>
            <p className="text-xs text-slate-400 mb-4">Varsayılan olarak Gensis'e atanmış mühendisler gelir; gerekirse seçili firmaya bağlı diğer mühendisleri seçebilirsiniz.</p>
            <div className="grid grid-cols-2 gap-4">
              <F label="Makine Mühendisi *">
                <select value={makineMuhId} onChange={(e) => setMakineMuhId(e.target.value)} className={inp + ec(makineMuhId)}>
                  <option value="">Seçiniz…</option>
                  {makineOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.chamber_reg_no ? ` · ${m.chamber_reg_no}` : ""}</option>)}
                </select>
                {makineMuhId && <MuhImza engineerId={makineMuhId} imzaDocId={props.engineers.find((e) => e.id === makineMuhId)?.imzaDocId} />}
              </F>
              <F label="Elektrik Mühendisi *">
                <select value={elektrikMuhId} onChange={(e) => setElektrikMuhId(e.target.value)} className={inp + ec(elektrikMuhId)}>
                  <option value="">Seçiniz…</option>
                  {elektrikOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.chamber_reg_no ? ` · ${m.chamber_reg_no}` : ""}</option>)}
                </select>
                {elektrikMuhId && <MuhImza engineerId={elektrikMuhId} imzaDocId={props.engineers.find((e) => e.id === elektrikMuhId)?.imzaDocId} />}
              </F>
            </div>
            <p className="mt-4 text-xs text-slate-500">Seçilen mühendisler için Makine ve Elektrik Mühendis Taahhütnameleri belgeler adımında ayrı ayrı üretilir.</p>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-bold mb-4">Önizleme</h2>
            {showErrors && totalMissing > 0 && (
              <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{totalMissing} zorunlu alan eksik.</div>
            )}
            <Summ k="Firma" v={company?.short_name} />
            <Summ k="İl" v={provinceName} />
            <Summ k="İlgili İdare" v={idareAdi} />
            <Summ k="Yapı Sahibi" v={yapiSahibi} />
            <Summ k="Montaj Adresi" v={montajAdresi} />
            <Summ k="Ada / Parsel" v={[ada, parsel].filter(Boolean).join(" / ")} />
            <Summ k="Kapasite" v={beyanYuku ? `${beyanYuku} kg · ${kisi ?? "—"} kişi` : ""} />
            <Summ k="Beyan Hızı / Durak" v={`${beyanHizi || "—"} m/s · ${durak || "—"} durak`} />
            <Summ k="Makine Müh." v={makineOptions.find((m) => m.id === makineMuhId)?.full_name} />
            <Summ k="Elektrik Müh." v={elektrikOptions.find((m) => m.id === elektrikMuhId)?.full_name} />
            {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          </div>
        )}

        {error && step < 2 && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      </div>
    </div>
  );
}

// Seçili mühendisin imzası: yüklüyse otomatik göster, yoksa jpeg/png yüklemeye izin ver
function MuhImza({ engineerId, imzaDocId }: { engineerId: string; imzaDocId?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function up(file: File | null) {
    if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set("engineer_id", engineerId); fd.set("doc_type", "imza"); fd.set("valid_until", "");
    fd.set("file", file);
    const r = await uploadEngineerDocument(fd);
    setBusy(false);
    setMsg(r.ok ? (r.message ?? "İmza yüklendi.") : ("Hata: " + r.error));
    if (r.ok) router.refresh();
  }
  return (
    <div className="mt-1.5">
      {imzaDocId ? (
        <div className="flex items-center gap-2">
          <img src={`/api/belge/muhendis?id=${imzaDocId}`} alt="İmza" className="h-10 max-w-[140px] object-contain border border-slate-100 rounded bg-white p-0.5" />
          <span className="text-[11px] text-green-600 font-semibold inline-flex items-center gap-0.5"><span className="material-symbols-rounded text-[14px]">check_circle</span>İmza yüklü</span>
        </div>
      ) : (
        <label className="text-[11px] text-slate-500 inline-flex items-center gap-1.5 cursor-pointer hover:text-brand">
          <span className="material-symbols-rounded text-[15px] text-brand">upload</span>
          {busy ? "Yükleniyor…" : "İmza ekle (JPEG / PNG)"}
          <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy} onChange={(e) => up(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {msg && <div className="text-[11px] text-slate-500 mt-0.5">{msg}</div>}
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
function Summ({ k, v }: { k: string; v?: any }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold text-slate-800 text-right">{v || "—"}</span>
    </div>
  );
}
