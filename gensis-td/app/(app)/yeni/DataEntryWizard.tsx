"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveDraftProject, type DraftPayload } from "./actions";

type Company = {
  id: string; short_name: string; legal_name: string; address: string | null;
  phone: string | null; fax: string | null; city: string | null;
  authorized_person: string | null; registered_brand: string | null; industry_reg_no: string | null;
};
type Category = { id: string; code: string; name: string; sort_order: number };
type Brand = { id: string; category_id: string; name: string };
type Model = { id: string; brand_id: string; name: string; certificate_id: string | null };
type Certificate = { id: string; cert_no: string; notified_body_id: string | null };
type NotifiedBody = { id: string; identity_no: string | null; name: string };
type Province = { id: number; name: string };
type Capacity = { beyan_yuku_kg: number; kisi_sayisi: number | null; kabin_agirlik_kg: number | null; karsi_agirlik_kg: number | null };
type Lookup = { list_key: string; value: string; sort_order: number };
type District = { id: string; name: string };
type Engineer = { id: string; full_name: string; discipline: string; chamber_reg_no: string | null; company_id: string | null };

type Props = {
  companies: Company[]; categories: Category[]; brands: Brand[]; models: Model[];
  certificates: Certificate[]; notifiedBodies: NotifiedBody[]; provinces: Province[];
  capacity: Capacity[]; lookups: Lookup[];
  engineers: Engineer[]; gensisCompanyId: string | null;
};

const STEPS = ["Firma", "Yapı Ruhsatı", "Asansör", "Ekipmanlar", "Önizleme"];
const RANGE_100 = Array.from({ length: 100 }, (_, i) => i + 1);
const empty = (x: any) => x === "" || x === null || x === undefined;

export default function DataEntryWizard(props: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState("");
  const [dosyaNo, setDosyaNo] = useState("");
  const [dosyaTarihi, setDosyaTarihi] = useState(new Date().toISOString().slice(0, 10));
  const [binaAdi, setBinaAdi] = useState("");
  const [montajAdresi, setMontajAdresi] = useState("");
  const [provinceId, setProvinceId] = useState<number | "">("");
  const [districtId, setDistrictId] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [beyanYuku, setBeyanYuku] = useState<number | "">("");
  const [beyanHizi, setBeyanHizi] = useState("");
  const [katAdedi, setKatAdedi] = useState("");
  const [durakAdedi, setDurakAdedi] = useState("");
  const [imalYili, setImalYili] = useState("");
  const [askiTipi, setAskiTipi] = useState("");
  const [katKapisi, setKatKapisi] = useState("");
  const [pafta, setPafta] = useState("");
  const [ada, setAda] = useState("");
  const [parsel, setParsel] = useState("");
  const [yapiSahibi, setYapiSahibi] = useState("");
  const [yapiSahibiAdresi, setYapiSahibiAdresi] = useState("");
  const [asansorSeriNo, setAsansorSeriNo] = useState("");
  const [asansorKimlikNo, setAsansorKimlikNo] = useState("");
  const [seyirMesafesi, setSeyirMesafesi] = useState("");
  const [motorSeriNo, setMotorSeriNo] = useState("");
  const [motorGucu, setMotorGucu] = useState("");
  // proje müellifi mühendisler — default Gensis'e atanmış olanlar
  const gMak = props.engineers.find((e) => e.discipline === "makine" && e.company_id === props.gensisCompanyId);
  const gElk = props.engineers.find((e) => e.discipline === "elektrik" && e.company_id === props.gensisCompanyId);
  const [makineMuhId, setMakineMuhId] = useState(gMak?.id ?? "");
  const [elektrikMuhId, setElektrikMuhId] = useState(gElk?.id ?? "");
  const [equip, setEquip] = useState<Record<string, { brandId?: string; modelId?: string; seriNo?: string }>>({});

  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const lookupGroups = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const l of props.lookups) (g[l.list_key] ||= []).push(l.value);
    return g;
  }, [props.lookups]);

  const company = props.companies.find((c) => c.id === companyId) || null;

  // mühendis dropdown seçenekleri: Gensis'e bağlı + seçili firmaya bağlı olanlar
  const makineOptions = useMemo(
    () => props.engineers.filter((e) => e.discipline === "makine" && (e.company_id === props.gensisCompanyId || (!!companyId && e.company_id === companyId))),
    [props.engineers, props.gensisCompanyId, companyId]
  );
  const elektrikOptions = useMemo(
    () => props.engineers.filter((e) => e.discipline === "elektrik" && (e.company_id === props.gensisCompanyId || (!!companyId && e.company_id === companyId))),
    [props.engineers, props.gensisCompanyId, companyId]
  );
  const kisi = useMemo(() => {
    if (beyanYuku === "") return null;
    return props.capacity.find((c) => c.beyan_yuku_kg === beyanYuku)?.kisi_sayisi ?? null;
  }, [beyanYuku, props.capacity]);

  const certById = useMemo(() => new Map(props.certificates.map((c) => [c.id, c])), [props.certificates]);
  const nbById = useMemo(() => new Map(props.notifiedBodies.map((n) => [n.id, n])), [props.notifiedBodies]);

  // zorunlu alanlar
  const requiredMap: Record<string, any> = {
    companyId, dosyaNo, dosyaTarihi, makineMuhId, elektrikMuhId, binaAdi, montajAdresi, provinceId, districtId,
    pafta, ada, parsel, yapiSahibi, yapiSahibiAdresi, beyanYuku, beyanHizi, katAdedi,
    durakAdedi, imalYili, askiTipi, katKapisi, asansorSeriNo, asansorKimlikNo,
    seyirMesafesi, motorSeriNo, motorGucu,
  };
  // ekipman: marka + model + seri no dolu değilse eksik sayılır
  const eqIncomplete = (catId: string) => {
    const s = equip[catId];
    return !s?.modelId || !s?.seriNo || !s.seriNo.trim();
  };
  const missingText = Object.entries(requiredMap).filter(([, v]) => empty(v)).map(([k]) => k);
  const missingEquip = props.categories.filter((cat) => eqIncomplete(cat.id));
  const isValid = missingText.length === 0 && missingEquip.length === 0;
  const totalMissing = missingText.length + missingEquip.length;

  // hata sınıfı (SOFT kırmızı) helper
  const ec = (v: any) => (showErrors && empty(v) ? " !border-red-300 !bg-red-50" : "");

  // adım bazlı zorunlu alanlar
  const stepFieldMap: Record<number, Record<string, any>> = {
    0: { companyId, dosyaNo, dosyaTarihi, makineMuhId, elektrikMuhId },
    1: { binaAdi, montajAdresi, provinceId, districtId, pafta, ada, parsel, yapiSahibi, yapiSahibiAdresi },
    2: { beyanYuku, beyanHizi, katAdedi, durakAdedi, imalYili, askiTipi, katKapisi, asansorSeriNo, asansorKimlikNo, seyirMesafesi, motorSeriNo, motorGucu },
  };
  function stepMissing(i: number): number {
    if (i === 3) return props.categories.filter((c) => eqIncomplete(c.id)).length;
    const fields = stepFieldMap[i];
    if (!fields) return 0;
    return Object.values(fields).filter(empty).length;
  }
  function goNext() {
    const m = stepMissing(step);
    if (m > 0) {
      setShowErrors(true);
      setError(`Bu adımda ${m} zorunlu alan eksik. Lütfen kırmızı ile işaretli alanları doldurun.`);
      return;
    }
    setShowErrors(false);
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }
  function goToStep(i: number) {
    if (i <= step) { setStep(i); setShowErrors(false); setError(null); }
    else goNext();
  }

  async function onProvinceChange(idStr: string) {
    const id = idStr ? Number(idStr) : "";
    setProvinceId(id);
    setDistrictId("");
    setDistricts([]);
    if (id !== "") {
      const { data } = await supabase.from("districts").select("id, name").eq("province_id", id).order("name").limit(2000);
      setDistricts(data ?? []);
    }
  }

  function pickBrand(catId: string, brandId: string) {
    setEquip((e) => ({ ...e, [catId]: { brandId, modelId: undefined } }));
  }
  function pickModel(catId: string, modelId: string) {
    setEquip((e) => ({ ...e, [catId]: { ...e[catId], modelId } }));
  }
  function setSeriNo(catId: string, v: string) {
    setEquip((e) => ({ ...e, [catId]: { ...e[catId], seriNo: v } }));
  }

  const selectedEquipCount = props.categories.filter((c) => !eqIncomplete(c.id)).length;

  async function handleSave() {
    if (!isValid) {
      setShowErrors(true);
      setError(`Kırmızı ile işaretli ${totalMissing} zorunlu alan boş. Lütfen tümünü doldurun.`);
      if (missingEquip.length > 0 && missingText.length === 0) setStep(3);
      else if (missingText.length > 0) setStep(0);
      return;
    }
    setSaving(true);
    setError(null);
    const equipment = Object.entries(equip)
      .filter(([, val]) => val.modelId)
      .map(([category_id, val]) => {
        const model = props.models.find((m) => m.id === val.modelId);
        return { category_id, slot: "main", brand_id: val.brandId ?? null, model_id: val.modelId ?? null, certificate_id: model?.certificate_id ?? null, seri_no: val.seriNo?.trim() || null };
      });

    const payload: DraftPayload = {
      company_id: companyId, dosya_no: dosyaNo, dosya_tarihi: dosyaTarihi || null,
      makine_muhendis_id: makineMuhId || null, elektrik_muhendis_id: elektrikMuhId || null,
      bina_adi: binaAdi || null, montaj_adresi: montajAdresi || null,
      province_id: provinceId === "" ? null : provinceId, district_id: districtId || null,
      beyan_yuku_kg: beyanYuku === "" ? null : beyanYuku, kisi_sayisi: kisi,
      beyan_hizi: beyanHizi ? Number(beyanHizi) : null, kat_adedi: katAdedi ? Number(katAdedi) : null,
      durak_adedi: durakAdedi ? Number(durakAdedi) : null, imal_yili: imalYili ? Number(imalYili) : null,
      input_data: {
        aski_tipi: askiTipi, kat_kapisi: katKapisi, montaj_adresi: montajAdresi,
        pafta, ada, parsel, yapi_sahibi: yapiSahibi, yapi_sahibi_adresi: yapiSahibiAdresi,
        asansor_seri_no: asansorSeriNo, asansor_kimlik_no: asansorKimlikNo,
        seyir_mesafesi: seyirMesafesi, motor_seri_no: motorSeriNo, motor_gucu: motorGucu,
      },
      equipment,
    };

    const res = await saveDraftProject(payload);
    setSaving(false);
    if (res.ok) { setSavedId(res.id); router.refresh(); }
    else setError(res.error);
  }

  if (savedId) {
    return (
      <div className="p-7 max-w-2xl">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 grid place-items-center text-3xl mx-auto mb-4">✓</div>
          <h1 className="text-xl font-extrabold mb-1">Kaydedildi</h1>
          <p className="text-slate-500 mb-6">{dosyaNo} numaralı teknik dosya oluşturuldu.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/panel")} className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-lg">Panele dön</button>
            <button onClick={() => window.location.reload()} className="bg-slate-100 hover:bg-slate-200 font-bold px-5 py-2.5 rounded-lg">Yeni dosya</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-7 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="text-sm text-slate-500">
          Yeni Teknik Dosya › <b className="text-slate-900">{STEPS[step]}</b>
          {showErrors && totalMissing > 0 && (
            <span className="ml-3 text-xs text-red-600 font-semibold">{totalMissing} zorunlu alan eksik</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="text-sm font-bold px-4 py-2 rounded-xl border border-[#e5e9f0] bg-white hover:bg-slate-50 disabled:opacity-45">← Geri</button>
          {step < 4 ? (
            <button onClick={goNext}
              className="gs-btn text-sm font-bold px-5 py-2 rounded-xl">İleri →</button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="text-sm font-bold px-5 py-2 rounded-xl text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 6px 16px rgba(21,128,61,.26)" }}>
              {saving ? "Kaydediliyor…" : "✓ Kaydet"}
            </button>
          )}
        </div>
      </div>

      <div className="p-7 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 max-w-6xl">
        <div className="min-w-0">
          <div className="flex mb-7">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={s} className={`flex flex-col items-center relative ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
                  {i < STEPS.length - 1 && (
                    <span className="absolute top-[17px] left-1/2 w-full h-[3px] rounded-full"
                      style={{ background: done ? "linear-gradient(90deg,#16a34a,#15803d)" : "#e5e9f0" }} />
                  )}
                  <button onClick={() => goToStep(i)}
                    className="relative z-10 w-[34px] h-[34px] rounded-full grid place-items-center text-sm font-bold transition"
                    style={
                      done
                        ? { background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }
                        : active
                        ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)", color: "#fff", boxShadow: "0 4px 12px rgba(30,42,91,.26)" }
                        : { background: "#fff", color: "#94a3b8", border: "1.5px solid #e5e9f0" }
                    }>
                    {done ? <span className="material-symbols-rounded text-[20px]">check</span> : i + 1}
                  </button>
                  <span className={`mt-2 text-xs ${active ? "font-bold text-slate-800" : done ? "font-semibold text-slate-600" : "text-[#94a3b8]"}`}>{s}</span>
                </div>
              );
            })}
          </div>

          {showErrors && stepMissing(step) > 0 && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="material-symbols-rounded text-[18px]">error</span>
              Bu adımda {stepMissing(step)} zorunlu alan boş. Lütfen kırmızı ile işaretli alanları doldurun.
            </div>
          )}

          {step === 0 && (
            <Section title="Firma seçimi" desc="Tüm alanlar zorunludur. Firmayı seçince bilgileri otomatik gelir.">
              <Field label="Montaj / Mimarlık Firması *">
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={"inp" + ec(companyId)}>
                  <option value="">Firma seçiniz…</option>
                  {props.companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Dosya No *"><input className={"inp" + ec(dosyaNo)} value={dosyaNo} onChange={(e) => setDosyaNo(e.target.value)} placeholder="TD-2026-0001" /></Field>
                <Field label="Tarih *"><input type="date" className={"inp" + ec(dosyaTarihi)} value={dosyaTarihi} onChange={(e) => setDosyaTarihi(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Makine Mühendisi (Proje Müellifi) *">
                  <select className={"inp" + ec(makineMuhId)} value={makineMuhId} onChange={(e) => setMakineMuhId(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {makineOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.chamber_reg_no ? ` · ${m.chamber_reg_no}` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Elektrik Mühendisi (Proje Müellifi) *">
                  <select className={"inp" + ec(elektrikMuhId)} value={elektrikMuhId} onChange={(e) => setElektrikMuhId(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {elektrikOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.chamber_reg_no ? ` · ${m.chamber_reg_no}` : ""}</option>)}
                  </select>
                </Field>
              </div>
              <p className="text-xs text-slate-400">Varsayılan olarak Gensis'e atanmış mühendisler gelir; gerekirse firmaya bağlı diğer mühendisleri seçebilirsiniz.</p>
              {company && (
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Otomatik dolan bilgiler</div>
                  <AutoRow k="Ünvan" v={company.legal_name} /><AutoRow k="Adres" v={company.address} />
                  <AutoRow k="Telefon" v={company.phone} /><AutoRow k="Şehir" v={company.city} />
                  <AutoRow k="Yetkili" v={company.authorized_person} /><AutoRow k="Tescilli marka" v={company.registered_brand} />
                  <AutoRow k="Sanayi sicil no" v={company.industry_reg_no} />
                </div>
              )}
            </Section>
          )}

          {step === 1 && (
            <Section title="Yapı ruhsatı bilgileri" desc="Tüm alanlar zorunludur.">
              <Field label="Bina Adı *"><input className={"inp" + ec(binaAdi)} value={binaAdi} onChange={(e) => setBinaAdi(e.target.value)} /></Field>
              <Field label="Montaj Adresi *"><input className={"inp" + ec(montajAdresi)} value={montajAdresi} onChange={(e) => setMontajAdresi(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="İl *">
                  <select className={"inp" + ec(provinceId)} value={provinceId} onChange={(e) => onProvinceChange(e.target.value)}>
                    <option value="">İl seçiniz…</option>
                    {props.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Belediye *">
                  <select className={"inp" + ec(districtId)} value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={districts.length === 0}>
                    <option value="">{provinceId === "" ? "Önce il seçin" : "Belediye seçiniz…"}</option>
                    {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Pafta *"><input className={"inp" + ec(pafta)} value={pafta} onChange={(e) => setPafta(e.target.value)} /></Field>
                <Field label="Ada *"><input className={"inp" + ec(ada)} value={ada} onChange={(e) => setAda(e.target.value)} /></Field>
                <Field label="Parsel *"><input className={"inp" + ec(parsel)} value={parsel} onChange={(e) => setParsel(e.target.value)} /></Field>
              </div>
              <Field label="Yapı Sahibi *"><input className={"inp" + ec(yapiSahibi)} value={yapiSahibi} onChange={(e) => setYapiSahibi(e.target.value)} /></Field>
              <Field label="Yapı Sahibi Adresi *"><input className={"inp" + ec(yapiSahibiAdresi)} value={yapiSahibiAdresi} onChange={(e) => setYapiSahibiAdresi(e.target.value)} /></Field>
            </Section>
          )}

          {step === 2 && (
            <Section title="Asansör teknik bilgileri" desc="Tüm alanlar zorunludur. Kişi sayısı beyan yüküne göre otomatik gelir.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Beyan Yükü (kg) *">
                  <select className={"inp" + ec(beyanYuku)} value={beyanYuku} onChange={(e) => setBeyanYuku(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Seçiniz…</option>
                    {props.capacity.map((c) => <option key={c.beyan_yuku_kg} value={c.beyan_yuku_kg}>{c.beyan_yuku_kg}</option>)}
                  </select>
                </Field>
                <Field label="Kişi Sayısı (otomatik)"><input className="inp bg-slate-100" value={kisi ?? ""} disabled /></Field>
                <Field label="Beyan Hızı (m/s) *">
                  <select className={"inp" + ec(beyanHizi)} value={beyanHizi} onChange={(e) => setBeyanHizi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {(lookupGroups["beyan_hizi"] ?? ["0.63", "1", "1.6"]).map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="İmal Yılı *"><input className={"inp" + ec(imalYili)} value={imalYili} onChange={(e) => setImalYili(e.target.value)} placeholder="2026" /></Field>
                <Field label="Kat Adedi *">
                  <select className={"inp" + ec(katAdedi)} value={katAdedi} onChange={(e) => setKatAdedi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {RANGE_100.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Durak Adedi *">
                  <select className={"inp" + ec(durakAdedi)} value={durakAdedi} onChange={(e) => setDurakAdedi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {RANGE_100.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Askı Tipi *">
                  <select className={"inp" + ec(askiTipi)} value={askiTipi} onChange={(e) => setAskiTipi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {(lookupGroups["aski_tipi"] ?? ["1/1", "1/2", "2/1"]).map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Kat Kapısı *">
                  <select className={"inp" + ec(katKapisi)} value={katKapisi} onChange={(e) => setKatKapisi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {(lookupGroups["kat_kapisi"] ?? ["Otomatik Merkezi", "Otomatik Yandan"]).map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Asansör Seri No *"><input className={"inp" + ec(asansorSeriNo)} value={asansorSeriNo} onChange={(e) => setAsansorSeriNo(e.target.value)} /></Field>
                <Field label="Asansör Kimlik No *"><input className={"inp" + ec(asansorKimlikNo)} value={asansorKimlikNo} onChange={(e) => setAsansorKimlikNo(e.target.value)} /></Field>
                <Field label="Seyir Mesafesi (m) *"><input className={"inp" + ec(seyirMesafesi)} value={seyirMesafesi} onChange={(e) => setSeyirMesafesi(e.target.value)} /></Field>
                <Field label="Motor Seri No *"><input className={"inp" + ec(motorSeriNo)} value={motorSeriNo} onChange={(e) => setMotorSeriNo(e.target.value)} /></Field>
                <Field label="Motor Gücü (kW) *"><input className={"inp" + ec(motorGucu)} value={motorGucu} onChange={(e) => setMotorGucu(e.target.value)} /></Field>
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section title="Kritik ekipmanlar" desc="Tümü zorunludur. Önce marka, sonra model seçin.">
              <div className="space-y-4">
                {props.categories.map((cat) => {
                  const catBrands = props.brands.filter((b) => b.category_id === cat.id);
                  const sel = equip[cat.id] || {};
                  const catModels = sel.brandId ? props.models.filter((m) => m.brand_id === sel.brandId) : [];
                  const model = props.models.find((m) => m.id === sel.modelId);
                  const cert = model?.certificate_id ? certById.get(model.certificate_id) : undefined;
                  const nb = cert?.notified_body_id ? nbById.get(cert.notified_body_id) : undefined;
                  const eksik = showErrors && eqIncomplete(cat.id);
                  return (
                    <div key={cat.id} className={`bg-white border rounded-xl p-4 ${eksik ? "border-red-400 bg-red-50/40" : "border-slate-200"}`}>
                      <div className="font-bold mb-2">{cat.name} <span className="text-red-500">*</span></div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Marka</div>
                      <div className="flex flex-wrap gap-2 mb-1">
                        {catBrands.map((b) => (
                          <button key={b.id} onClick={() => pickBrand(cat.id, b.id)}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${sel.brandId === b.id ? "border-transparent text-white" : "bg-white border-slate-200 text-slate-700 hover:border-brand hover:text-brand"}`}
                            style={sel.brandId === b.id ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)", boxShadow: "0 4px 12px rgba(30,42,91,.22)" } : undefined}>
                            {b.name}
                          </button>
                        ))}
                      </div>
                      {sel.brandId && (
                        <div className="mt-3 rounded-xl border-2 border-brand/30 bg-brand-light p-3">
                          <div className="text-xs font-bold text-brand mb-2 uppercase tracking-wide">Model seçin</div>
                          <div className="flex flex-wrap gap-2">
                            {catModels.map((m) => (
                              <button key={m.id} onClick={() => pickModel(cat.id, m.id)}
                                className={`px-3 py-2 rounded-lg text-sm font-semibold border ${sel.modelId === m.id ? "border-transparent text-white" : "bg-white border-brand/40 text-brand hover:bg-white"}`}
                                style={sel.modelId === m.id ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)", boxShadow: "0 4px 12px rgba(30,42,91,.22)" } : undefined}>
                                {m.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {cert && (
                        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">Sertifika No</span><span className="font-semibold">{cert.cert_no}</span></div>
                          {nb && <div className="flex justify-between mt-1"><span className="text-slate-500">Onaylanmış Kuruluş</span><span className="font-semibold">{nb.identity_no} · {nb.name}</span></div>}
                        </div>
                      )}
                      {sel.modelId && (
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ekipman Seri No *</label>
                          <input
                            value={sel.seriNo ?? ""}
                            onChange={(e) => setSeriNo(cat.id, e.target.value)}
                            placeholder="Bu ekipmanın üzerindeki seri numarasını girin"
                            className={"inp" + (showErrors && (!sel.seriNo || !sel.seriNo.trim()) ? " !border-red-300 !bg-red-50" : "")}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {step === 4 && (
            <Section title="Önizleme" desc="Bilgileri kontrol edip kaydedin.">
              {showErrors && totalMissing > 0 && (
                <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {totalMissing} zorunlu alan eksik. Kaydetmeden önce tüm adımlardaki kırmızı alanları doldurun.
                </div>
              )}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <SummRow k="Firma" v={company?.short_name} /><SummRow k="Dosya No" v={dosyaNo} />
                <SummRow k="Bina" v={binaAdi} /><SummRow k="Kapasite" v={beyanYuku ? `${beyanYuku} kg · ${kisi ?? "—"} kişi` : "—"} />
                <SummRow k="Kat / Durak" v={`${katAdedi || "—"} / ${durakAdedi || "—"}`} />
                <SummRow k="Seçili ekipman" v={`${selectedEquipCount} / ${props.categories.length}`} />
              </div>
              {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
            </Section>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-500 uppercase mb-3">Özet</div>
            <SummRow k="Firma" v={company?.short_name} /><SummRow k="Dosya No" v={dosyaNo} />
            <SummRow k="İl" v={props.provinces.find((p) => p.id === provinceId)?.name} />
            <SummRow k="Kapasite" v={beyanYuku ? `${beyanYuku} kg` : "—"} />
            <SummRow k="Ekipman" v={`${selectedEquipCount} / ${props.categories.length}`} />
            <div className={`mt-3 text-xs font-semibold ${isValid ? "text-green-600" : "text-red-500"}`}>
              {isValid ? "✓ Tüm zorunlu alanlar dolu" : `${totalMissing} zorunlu alan eksik`}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .inp { width: 100%; font-size: 14px; padding: 11px 12px; border: 1.5px solid #e5e9f0; border-radius: 12px; background: #fff; }
        .inp:focus { outline: none; border-color: #1e2a5b; box-shadow: 0 0 0 3px #eef1f8; }
      `}</style>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (<div><h1 className="text-xl font-extrabold mb-1">{title}</h1>{desc && <p className="text-slate-500 text-sm mb-4">{desc}</p>}<div className="space-y-3">{children}</div></div>);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>{children}</div>);
}
function AutoRow({ k, v }: { k: string; v?: string | null }) {
  return (<div className="flex justify-between gap-3 py-1.5 border-b border-dashed border-slate-200 last:border-0 text-sm"><span className="text-slate-500">{k}</span><span className="font-semibold text-right">{v || "—"}</span></div>);
}
function SummRow({ k, v }: { k: string; v?: string | null }) {
  return (<div className="flex justify-between gap-3 py-1.5 border-b border-dashed border-slate-200 last:border-0 text-sm"><span className="text-slate-500">{k}</span><span className="font-semibold text-right">{v || "—"}</span></div>);
}
