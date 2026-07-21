"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveDraftProject, updateDraftProject, uploadProjectFile, deleteProjectFile, type DraftPayload } from "./actions";

type Company = {
  id: string; short_name: string; legal_name: string; address: string | null;
  phone: string | null; fax: string | null; city: string | null;
  authorized_person: string | null; registered_brand: string | null; industry_reg_no: string | null;
};
type Category = { id: string; code: string; name: string; sort_order: number; drive_type?: string };
type Brand = { id: string; category_id: string; name: string };
type Model = { id: string; brand_id: string; name: string; certificate_id: string | null };
type Certificate = { id: string; cert_no: string; notified_body_id: string | null };
type NotifiedBody = { id: string; identity_no: string | null; name: string };
type Province = { id: number; name: string };
type Capacity = { beyan_yuku_kg: number; kisi_sayisi: number | null; kabin_agirlik_kg: number | null; karsi_agirlik_kg: number | null };
type Lookup = { list_key: string; value: string; sort_order: number };
type District = { id: string; name: string };
type Engineer = { id: string; full_name: string; discipline: string; chamber_reg_no: string | null; company_id: string | null };
type CompanyDoc = { id: string; company_id: string; doc_type: string; belge_no: string | null; valid_until: string | null };
type ProjectFile = { id: string; kind: string; original_name: string | null };

type EquipInit = Record<string, { brandId?: string; modelId?: string; seriNo?: string; seriList?: string[] }>;
// Düzenleme modunda mevcut projeyi dolduran başlangıç verisi
export type InitialData = {
  id: string;
  companyId: string; dosyaNo: string; dosyaTarihi: string;
  binaAdi: string; montajAdresi: string;
  provinceId: number | ""; districtId: string; districts: District[];
  beyanYuku: number | ""; beyanHizi: string; katAdedi: string; durakAdedi: string;
  girisSayisi: string; imalYili: string; askiTipi: string; katKapisi: string;
  pafta: string; ada: string; parsel: string; yapiSahibi: string; yapiSahibiAdresi: string;
  asansorSeriNo: string; asansorKimlikNo: string; seyirMesafesi: string; motorGucu: string;
  asansorTipi: string; pistonOlculeri: string; pistonYeri: string; debi: string; uniteBilgisi: string;
  asansorSinifi: string; kapiGenislik: string; kapiYukseklik: string;
  kabinGenislik: string; kabinDerinlik: string; kabinAgirligi: string; karsiAgirlikYeri: string;
  motorMarka: string; makineDairesi: string; katSayisi: string;
  baslangicKat: string; araKatlar: { after: string; label: string }[];
  makineMuhId: string; elektrikMuhId: string;
  equip: EquipInit;
  // Belgeler + Dosya İşlemleri (Faz 1 metadata)
  modulSecim?: string; modulBelgeIds?: string[];
  modulG?: { belge_no: string; verilis: string; gecerlilik: string; nb_id: string };
  faturaNo?: string; faturaTarihi?: string; periyodikTarihi?: string;
  faturali?: string; fiyat?: string; teslimDurumu?: string; teslimTarihi?: string;
  files?: ProjectFile[];
};

type Props = {
  companies: Company[]; categories: Category[]; brands: Brand[]; models: Model[];
  certificates: Certificate[]; notifiedBodies: NotifiedBody[]; provinces: Province[];
  capacity: Capacity[]; lookups: Lookup[];
  engineers: Engineer[]; gensisCompanyId: string | null;
  companyDocuments?: CompanyDoc[];
  initial?: InitialData | null;
};

const STEPS = ["Firma", "Yapı Ruhsatı", "Belgeler", "Asansör", "Ekipmanlar", "Dosya İşlemleri"];
// Adım indeksleri (tek kaynak — sabit sayı kullanma)
const S_FIRMA = 0, S_RUHSAT = 1, S_BELGELER = 2, S_ASANSOR = 3, S_EKIPMAN = 4, S_ISLEM = 5;
const LAST_STEP = STEPS.length - 1;
const MODUL_SECENEKLERI: { v: string; t: string }[] = [
  { v: "H1B", t: "Mod H1 / B" },
  { v: "G", t: "Mod G" },
];
// Asansör imal yılı listesi (gelecek yıldan 25 yıl geriye)
const IMAL_YILLARI = (() => { const y = new Date().getFullYear(); return Array.from({ length: 27 }, (_, i) => y + 1 - i); })();
const RANGE_3 = [1, 2, 3];
// Binlik ayraçlı sayı biçimi (ör. 25000 → "25.000")
const formatThousands = (s: string) => { const d = String(s ?? "").replace(/\D/g, ""); return d ? Number(d).toLocaleString("tr-TR") : ""; };
const COMPANY_DOC_ETIKET: Record<string, string> = {
  sanayi_sicil: "Sanayi Sicil Belgesi", tse_hyb: "TSE HYB Belgesi",
  ce_h1: "Mod H1 Belgesi", ce_tasarim: "Tasarım İnceleme Belgesi",
  ce_b: "Mod B Belgesi", ce_b_eki: "Mod B Eki", ce_e: "Mod E Belgesi",
};
const RANGE_100 = Array.from({ length: 100 }, (_, i) => i + 1);
// Her kat/giriş için ayrı seri no giren kategoriler:
//  - kapı kilidi: durak sayısı kadar (her katta bir kilit) → "Kat 1..N"
//  - kabin kapı kilidi: giriş sayısı kadar → "Giriş 1..N"
const MULTI_SERI: Record<string, { count: "durak" | "giris"; label: string }> = {
  kapi_kilidi: { count: "durak", label: "Kat" },
  kabin_kilidi: { count: "giris", label: "Giriş" },
};
const empty = (x: any) => x === "" || x === null || x === undefined;

const ASANSOR_SINIFLARI = [
  "Sınıf I: İnsan Asansörü",
  "Sınıf II: İnsan + Yük Asansörü",
  "Sınıf III: Sedye Asansörü",
  "Sınıf IV: Yük Asansörü",
  "Sınıf V: Servis (Monşarj) Asansörü",
  "Sınıf VI: Hızı 2,5 m/s Fazla Olan",
];
const KAPI_TIPLERI = ["Otomatik Merkezi", "Teleskopik Sağ", "Teleskopik Sol", "Manuel"];
const ASKI_TIPLERI = ["1/1", "2/1", "4/1"];
const PISTON_YERLERI = ["Tek Piston SAĞ", "Tek Piston SOL", "Tek Piston ARKA", "Çift Piston"];
const KARSI_AGIRLIK_YERLERI = ["Sağ", "Sol", "Arka"];
// Kat başlangıcı: bodrumlar → zemin → 1. kat
const KAT_BASLANGIC = ["-5B", "-4B", "-3B", "-2B", "-1B", "Z", "1"];
const RANGE_4 = [1, 2, 3, 4];

// Başlangıç katı + kat adedine göre kat etiketlerini üretir (ör. -2B + 6 → -2B,-1B,Z,1,2,3)
function buildFloors(start: string, count: number): string[] {
  const out: string[] = [];
  if (!start || !count || count < 1) return out;
  const base = KAT_BASLANGIC.slice(0, KAT_BASLANGIC.indexOf("Z") + 1); // -5B..Z
  const i0 = base.indexOf(start);
  if (i0 >= 0) {
    for (let i = i0; i < base.length && out.length < count; i++) out.push(base[i]);
    let n = 1;
    while (out.length < count) out.push(String(n++));
  } else {
    let n = parseInt(start, 10) || 1;
    while (out.length < count) out.push(String(n++));
  }
  return out;
}

export default function DataEntryWizard(props: Props) {
  const router = useRouter();
  const supabase = createClient();

  const init = props.initial;
  const isEdit = !!init?.id;

  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState(init?.companyId ?? "");
  const [dosyaNo, setDosyaNo] = useState(init?.dosyaNo ?? "");
  const [dosyaTarihi, setDosyaTarihi] = useState(init?.dosyaTarihi ?? new Date().toISOString().slice(0, 10));
  const [binaAdi, setBinaAdi] = useState(init?.binaAdi ?? "");
  const [montajAdresi, setMontajAdresi] = useState(init?.montajAdresi ?? "");
  const [provinceId, setProvinceId] = useState<number | "">(init?.provinceId ?? "");
  const [districtId, setDistrictId] = useState(init?.districtId ?? "");
  const [districts, setDistricts] = useState<District[]>(init?.districts ?? []);
  const [beyanYuku, setBeyanYuku] = useState<number | "">(init?.beyanYuku ?? "");
  const [beyanHizi, setBeyanHizi] = useState(init?.beyanHizi ?? "");
  const [katAdedi, setKatAdedi] = useState(init?.katAdedi ?? "");
  const [durakAdedi, setDurakAdedi] = useState(init?.durakAdedi ?? "");
  const [girisSayisi, setGirisSayisi] = useState(init?.girisSayisi ?? "");
  const [imalYili, setImalYili] = useState(init?.imalYili ?? "");
  const [askiTipi, setAskiTipi] = useState(init?.askiTipi ?? "");
  const [katKapisi, setKatKapisi] = useState(init?.katKapisi ?? "");
  const [pafta, setPafta] = useState(init?.pafta ?? "");
  const [ada, setAda] = useState(init?.ada ?? "");
  const [parsel, setParsel] = useState(init?.parsel ?? "");
  const [yapiSahibi, setYapiSahibi] = useState(init?.yapiSahibi ?? "");
  const [yapiSahibiAdresi, setYapiSahibiAdresi] = useState(init?.yapiSahibiAdresi ?? "");
  const [asansorSeriNo, setAsansorSeriNo] = useState(init?.asansorSeriNo ?? "");
  const [asansorKimlikNo, setAsansorKimlikNo] = useState(init?.asansorKimlikNo ?? "");
  const [seyirMesafesi, setSeyirMesafesi] = useState(init?.seyirMesafesi ?? "");
  const [motorGucu, setMotorGucu] = useState(init?.motorGucu ?? "");
  // asansör tahrik tipi + hidroliğe özgü alanlar
  const [asansorTipi, setAsansorTipi] = useState(init?.asansorTipi ?? "elektrik");
  const [pistonOlculeri, setPistonOlculeri] = useState(init?.pistonOlculeri ?? "");
  const [pistonYeri, setPistonYeri] = useState(init?.pistonYeri ?? "");
  const [debi, setDebi] = useState(init?.debi ?? "");
  const [uniteBilgisi, setUniteBilgisi] = useState(init?.uniteBilgisi ?? "");
  // yeni alanlar
  const [asansorSinifi, setAsansorSinifi] = useState(init?.asansorSinifi ?? "");
  const [kapiGenislik, setKapiGenislik] = useState(init?.kapiGenislik ?? "");
  const [kapiYukseklik, setKapiYukseklik] = useState(init?.kapiYukseklik ?? "");
  const [kabinGenislik, setKabinGenislik] = useState(init?.kabinGenislik ?? "");
  const [kabinDerinlik, setKabinDerinlik] = useState(init?.kabinDerinlik ?? "");
  const [kabinAgirligi, setKabinAgirligi] = useState(init?.kabinAgirligi ?? "");
  const [karsiAgirlikYeri, setKarsiAgirlikYeri] = useState(init?.karsiAgirlikYeri ?? "");
  const [motorMarka, setMotorMarka] = useState(init?.motorMarka ?? "");
  const [makineDairesi, setMakineDairesi] = useState(init?.makineDairesi ?? "");
  const [katSayisi, setKatSayisi] = useState(init?.katSayisi ?? "");
  const [baslangicKat, setBaslangicKat] = useState(init?.baslangicKat ?? "Z");
  const [araKatlar, setAraKatlar] = useState<{ after: string; label: string }[]>(init?.araKatlar ?? []);
  const [araKatAfter, setAraKatAfter] = useState("");
  const [araKatLabel, setAraKatLabel] = useState("ASMA KAT");
  // proje müellifi mühendisler — default Gensis'e atanmış olanlar (düzenlemede kayıtlı olan)
  const gMak = props.engineers.find((e) => e.discipline === "makine" && e.company_id === props.gensisCompanyId);
  const gElk = props.engineers.find((e) => e.discipline === "elektrik" && e.company_id === props.gensisCompanyId);
  const [makineMuhId, setMakineMuhId] = useState(init?.makineMuhId ?? gMak?.id ?? "");
  const [elektrikMuhId, setElektrikMuhId] = useState(init?.elektrikMuhId ?? gElk?.id ?? "");
  const [equip, setEquip] = useState<Record<string, { brandId?: string; modelId?: string; seriNo?: string; seriList?: string[] }>>(init?.equip ?? {});

  // Belgeler adımı (Faz 1 metadata)
  const [modulSecim, setModulSecim] = useState(init?.modulSecim ?? "");
  const [modulBelgeIds, setModulBelgeIds] = useState<string[]>(init?.modulBelgeIds ?? []);
  const [modulG, setModulG] = useState(init?.modulG ?? { belge_no: "", verilis: "", gecerlilik: "", nb_id: "" });
  const [faturaNo, setFaturaNo] = useState(init?.faturaNo ?? "");
  const [faturaTarihi, setFaturaTarihi] = useState(init?.faturaTarihi ?? "");
  const [periyodikTarihi, setPeriyodikTarihi] = useState(init?.periyodikTarihi ?? "");
  // Dosya İşlemleri adımı
  const [faturali, setFaturali] = useState(init?.faturali ?? "");
  const [fiyat, setFiyat] = useState(formatThousands(init?.fiyat ?? ""));
  const [teslimDurumu, setTeslimDurumu] = useState(init?.teslimDurumu ?? "taslak");
  const [teslimTarihi, setTeslimTarihi] = useState(init?.teslimTarihi ?? "");
  const [kopyalandi, setKopyalandi] = useState<string>("");
  // Yüklenecek (staged) ve mevcut dosyalar
  const [pending, setPending] = useState<Record<string, File[]>>({});
  const [existingFiles, setExistingFiles] = useState<ProjectFile[]>(init?.files ?? []);
  const addFiles = (kind: string, list: FileList | null) => {
    if (!list || !list.length) return;
    setPending((p) => ({ ...p, [kind]: [...(p[kind] ?? []), ...Array.from(list)] }));
  };
  const removeStaged = (kind: string, i: number) => setPending((p) => ({ ...p, [kind]: (p[kind] ?? []).filter((_, j) => j !== i) }));
  async function silExisting(id: string) {
    if (!confirm("Bu dosya silinsin mi?")) return;
    const r = await deleteProjectFile(id);
    if (r.ok) setExistingFiles((s) => s.filter((f) => f.id !== id));
    else alert("Silinemedi: " + (r.error ?? ""));
  }

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

  // asansör tipine göre geçerli ekipman kategorileri (drive_type: both/elektrik/hidrolik)
  const isHid = asansorTipi === "hidrolik";
  const applicableCats = props.categories.filter((c) => !c.drive_type || c.drive_type === "both" || c.drive_type === asansorTipi);
  // Kat listesi: başlangıç katı + kat adedi, ara katlar eklenmiş hali
  const baseFloors = useMemo(() => buildFloors(baslangicKat, Number(katSayisi || 0)), [baslangicKat, katSayisi]);
  const katListesi = useMemo(() => {
    const out = [...baseFloors];
    for (const m of araKatlar) {
      const i = out.indexOf(m.after);
      if (i >= 0) out.splice(i + 1, 0, m.label);
    }
    return out;
  }, [baseFloors, araKatlar]);
  // Toplam kat adedi kat listesinden otomatik dolar (ara katlar dahil)
  useEffect(() => {
    const toplam = katListesi.length;
    const yeni = toplam ? String(toplam) : "";
    if (yeni !== katAdedi) {
      setKatAdedi(yeni);
      if (durakAdedi && toplam && Number(durakAdedi) > toplam) setDurakAdedi("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [katListesi.length]);
  // Karşı ağırlık = kabin ağırlığı + beyan yükü / 2
  const karsiAgirlik = useMemo(() => {
    const k = Number(String(kabinAgirligi).replace(",", ".")) || 0;
    const b = beyanYuku === "" ? 0 : Number(beyanYuku);
    if (!k && !b) return "";
    return String(Math.round(k + b / 2));
  }, [kabinAgirligi, beyanYuku]);

  // tahrik tipine göre değişen zorunlu alanlar
  const driveReq: Record<string, any> = isHid
    ? { pistonOlculeri, pistonYeri, debi, uniteBilgisi, motorMarka, motorGucu }
    : { motorGucu, karsiAgirlikYeri };

  // zorunlu alanlar
  const requiredMap: Record<string, any> = {
    companyId, dosyaNo, dosyaTarihi, makineMuhId, elektrikMuhId, binaAdi, montajAdresi, provinceId, districtId,
    pafta, ada, parsel, yapiSahibi, yapiSahibiAdresi, beyanYuku, beyanHizi, katAdedi,
    durakAdedi, girisSayisi, imalYili, askiTipi, katKapisi, asansorSeriNo,
    seyirMesafesi, asansorSinifi, makineDairesi, baslangicKat, katSayisi, kapiGenislik, kapiYukseklik,
    kabinGenislik, kabinDerinlik, kabinAgirligi, ...driveReq,
  };
  // Ekipman kartları: tampon iki ayrı seçim (kabin / ağırlık) — aynı marka listesi, farklı slot
  const equipCards = applicableCats.flatMap((c) =>
    c.code === "tampon"
      ? [
          { key: `${c.id}|kabin`, catId: c.id, slot: "kabin", code: c.code, label: "Kabin Tamponu" },
          { key: `${c.id}|agirlik`, catId: c.id, slot: "agirlik", code: c.code, label: "Ağırlık Tamponu" },
        ]
      : [{ key: `${c.id}|main`, catId: c.id, slot: "main", code: c.code, label: c.name }]
  );
  // kategori her kat/giriş için ayrı seri no istiyorsa kaç adet? (0 = tekli)
  // Çoklu seri no satır etiketi: kapı kilidinde gerçek kat adı (Z, ASMA KAT, 1…), kabinde giriş no
  const seriEtiket = (code: string, i: number) =>
    code === "kapi_kilidi" ? (katListesi[i] || `Kat ${i + 1}`) : `${MULTI_SERI[code]?.label ?? ""} ${i + 1}`;
  const multiCountForCode = (code: string) => {
    const cfg = MULTI_SERI[code];
    if (!cfg) return 0;
    return cfg.count === "durak" ? Number(durakAdedi || 0) : Number(girisSayisi || 0);
  };
  // Asma (ara) kat satırları: kapı kilidinde ara kat karşısındaki seri no PASİF olur
  const araKatLabelSet = useMemo(() => new Set(araKatlar.map((m) => m.label)), [araKatlar]);
  const isPasifSeri = (code: string, i: number) => code === "kapi_kilidi" && araKatLabelSet.has(katListesi[i]);
  // ekipman: marka + model + seri no dolu değilse eksik sayılır (ara kat satırları hariç)
  const eqIncomplete = (card: { key: string; code: string }) => {
    const s = equip[card.key];
    if (!s?.modelId) return true;
    const n = multiCountForCode(card.code);
    if (n > 0) {
      const list = s.seriList || [];
      for (let i = 0; i < n; i++) {
        if (isPasifSeri(card.code, i)) continue;
        if (!list[i] || !list[i].trim()) return true;
      }
      return false;
    }
    return !s?.seriNo || !s.seriNo.trim();
  };
  const missingText = Object.entries(requiredMap).filter(([, v]) => empty(v)).map(([k]) => k);
  const missingEquip = equipCards.filter((card) => eqIncomplete(card));
  const isValid = missingText.length === 0 && missingEquip.length === 0;
  const totalMissing = missingText.length + missingEquip.length;

  // hata sınıfı (SOFT kırmızı) helper
  const ec = (v: any) => (showErrors && empty(v) ? " !border-red-300 !bg-red-50" : "");

  // adım bazlı zorunlu alanlar
  const stepFieldMap: Record<number, Record<string, any>> = {
    [S_FIRMA]: { companyId, dosyaNo, dosyaTarihi, makineMuhId, elektrikMuhId },
    [S_RUHSAT]: { binaAdi, montajAdresi, provinceId, districtId, pafta, ada, parsel, yapiSahibi, yapiSahibiAdresi },
    [S_ASANSOR]: { asansorSinifi, makineDairesi, beyanYuku, beyanHizi, baslangicKat, katSayisi, katAdedi, durakAdedi, girisSayisi, imalYili, askiTipi, katKapisi, kapiGenislik, kapiYukseklik, kabinGenislik, kabinDerinlik, kabinAgirligi, asansorSeriNo, seyirMesafesi, ...driveReq },
  };
  function stepMissing(i: number): number {
    if (i === S_EKIPMAN) return equipCards.filter((card) => eqIncomplete(card)).length;
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
    setStep((s) => Math.min(LAST_STEP, s + 1));
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
  function setSeriAt(catId: string, i: number, v: string) {
    setEquip((e) => {
      const cur = e[catId]?.seriList ? [...e[catId].seriList!] : [];
      cur[i] = v;
      return { ...e, [catId]: { ...e[catId], seriList: cur } };
    });
  }

  const selectedEquipCount = equipCards.filter((card) => !eqIncomplete(card)).length;

  // Dosya İşlemleri — metin + gönderim yardımcıları
  const faturaliTr = faturali === "faturali" ? "Faturalı" : faturali === "faturasiz" ? "Faturasız" : "—";
  const muhasebeMetni = () =>
    `Firma: ${company?.short_name ?? "—"}\nProje No: ${dosyaNo || "—"}\nFiyat + KDV: ${fiyat ? fiyat + " TL" : "—"}\nFatura: ${faturaliTr}` +
    (faturali === "faturali" ? `\nFatura No: ${faturaNo || "—"}\nFatura Tarihi: ${faturaTarihi || "—"}` : "");
  const musteriMetni = () =>
    `Sayın ${company?.short_name ?? ""},\n${dosyaNo || ""} numaralı teknik dosyanız hazırlanmıştır. Bilginize sunarız.`;
  const mailto = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
  async function kopyala(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setKopyalandi(key); setTimeout(() => setKopyalandi(""), 1500); } catch { /* yok say */ }
  }

  async function handleSave(opts?: { gotoBelge?: boolean }) {
    if (!isValid) {
      setShowErrors(true);
      setError(`Kırmızı ile işaretli ${totalMissing} zorunlu alan boş. Lütfen tümünü doldurun.`);
      if (missingEquip.length > 0 && missingText.length === 0) setStep(S_EKIPMAN);
      else if (missingText.length > 0) setStep(S_FIRMA);
      return;
    }
    setSaving(true);
    setError(null);
    const equipment = Object.entries(equip)
      .filter(([key, val]) => val.modelId && equipCards.some((c) => c.key === key))
      .map(([key, val]) => {
        const card = equipCards.find((c) => c.key === key)!;
        const model = props.models.find((m) => m.id === val.modelId);
        const n = multiCountForCode(card.code);
        let seri_no = val.seriNo?.trim() || null;
        let seri_list: string[] | null = null;
        if (n > 0) {
          seri_list = Array.from({ length: n }, (_, i) => (val.seriList?.[i] || "").trim());
          seri_no = seri_list.filter(Boolean).join("; ") || null;
        }
        return { category_id: card.catId, slot: card.slot, brand_id: val.brandId ?? null, model_id: val.modelId ?? null, certificate_id: model?.certificate_id ?? null, seri_no, seri_list };
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
        seyir_mesafesi: seyirMesafesi, motor_gucu: motorGucu, giris_sayisi: girisSayisi,
        asansor_tipi: asansorTipi,
        piston_olculeri: pistonOlculeri, piston_yeri: pistonYeri, debi: debi, unite_bilgisi: uniteBilgisi,
        asansor_sinifi: asansorSinifi,
        kapi_genislik: kapiGenislik, kapi_yukseklik: kapiYukseklik,
        kabin_genislik: kabinGenislik, kabin_derinlik: kabinDerinlik,
        kabin_agirligi: kabinAgirligi, karsi_agirlik_yeri: karsiAgirlikYeri, karsi_agirlik_agirligi: karsiAgirlik,
        motor_marka: motorMarka, makine_dairesi: makineDairesi,
        baslangic_kat: baslangicKat, kat_sayisi: katSayisi, ara_katlar: araKatlar, kat_listesi: katListesi,
        // Belgeler + Dosya İşlemleri (Faz 1 metadata)
        modul_secim: modulSecim, modul_belge_ids: modulBelgeIds,
        modul_g: modulG, fatura_no: faturaNo, fatura_tarihi: faturaTarihi, periyodik_tarihi: periyodikTarihi,
        faturali, fiyat, teslim_durumu: teslimDurumu, teslim_tarihi: teslimTarihi, proje_no: dosyaNo,
      },
      equipment,
    };

    const res = isEdit ? await updateDraftProject(init!.id, payload) : await saveDraftProject(payload);
    if (!res.ok) { setSaving(false); setError(res.error); return; }

    // Staged dosyaları yükle
    if (res.id) {
      for (const kind of Object.keys(pending)) {
        for (const file of pending[kind] ?? []) {
          const fd = new FormData();
          fd.set("project_id", res.id); fd.set("kind", kind); fd.set("file", file);
          if (kind === "modul_g_belge" || kind === "modul_g_rapor") {
            fd.set("belge_no", modulG.belge_no); fd.set("issue_date", modulG.verilis);
            fd.set("valid_until", modulG.gecerlilik); fd.set("notified_body_id", modulG.nb_id);
          } else if (kind === "fatura") { fd.set("fatura_no", faturaNo); fd.set("fatura_tarihi", faturaTarihi); }
          else if (kind === "periyodik_kontrol") { fd.set("report_date", periyodikTarihi); }
          else if (kind === "asansor_projesi") { fd.set("proje_no", dosyaNo); }
          await uploadProjectFile(fd);
        }
      }
      setPending({});
    }

    setSaving(false);
    if (opts?.gotoBelge && res.id) { router.push(`/panel/${res.id}`); return; }
    setSavedId(res.id); router.refresh();
  }

  if (savedId) {
    return (
      <div className="p-7 max-w-2xl">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 grid place-items-center text-3xl mx-auto mb-4">✓</div>
          <h1 className="text-xl font-extrabold mb-1">{isEdit ? "Güncellendi" : "Kaydedildi"}</h1>
          <p className="text-slate-500 mb-6">{dosyaNo} numaralı teknik dosya {isEdit ? "güncellendi" : "oluşturuldu"}.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/panel")} className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-lg">Panele dön</button>
            {isEdit ? (
              <button onClick={() => router.push(`/panel/${savedId}`)} className="bg-slate-100 hover:bg-slate-200 font-bold px-5 py-2.5 rounded-lg">Belgeleri gör</button>
            ) : (
              <button onClick={() => window.location.reload()} className="bg-slate-100 hover:bg-slate-200 font-bold px-5 py-2.5 rounded-lg">Yeni dosya</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-7 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="text-sm text-slate-500">
          {isEdit ? "Teknik Dosya Düzenle" : "Yeni Teknik Dosya"} › <b className="text-slate-900">{STEPS[step]}</b>
          {showErrors && totalMissing > 0 && (
            <span className="ml-3 text-xs text-red-600 font-semibold">{totalMissing} zorunlu alan eksik</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="text-sm font-bold px-4 py-2 rounded-xl border border-[#e5e9f0] bg-white hover:bg-slate-50 disabled:opacity-45">← Geri</button>
          {step < LAST_STEP ? (
            <button onClick={goNext}
              className="gs-btn text-sm font-bold px-5 py-2 rounded-xl">İleri →</button>
          ) : (
            <button onClick={() => handleSave()} disabled={saving}
              className="text-sm font-bold px-5 py-2 rounded-xl text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 6px 16px rgba(21,128,61,.26)" }}>
              {saving ? "Kaydediliyor…" : isEdit ? "✓ Güncelle" : "✓ Kaydet"}
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
              <Field label="Teknik Dosya Türü *">
                <div className="flex gap-2">
                  {[{ v: "elektrik", t: "Elektrikli TD" }, { v: "hidrolik", t: "Hidrolik TD" }].map((o) => (
                    <button key={o.v} type="button" onClick={() => setAsansorTipi(o.v)}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${asansorTipi === o.v ? "border-transparent text-white" : "bg-white border-slate-200 text-slate-700 hover:border-brand hover:text-brand"}`}
                      style={asansorTipi === o.v ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)", boxShadow: "0 4px 12px rgba(30,42,91,.22)" } : undefined}>
                      {o.t}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">Seçime göre asansör alanları ve ekipman listesi (motor ↔ hidrolik valfler) değişir.</p>
              </Field>
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
              <FileZone label="Yapı Ruhsatı Ekle" accept="application/pdf,image/*"
                staged={pending["yapi_ruhsati"] ?? []} existing={existingFiles.filter((f) => f.kind === "yapi_ruhsati")}
                onAdd={(l) => addFiles("yapi_ruhsati", l)} onRemoveStaged={(i) => removeStaged("yapi_ruhsati", i)} onDelete={silExisting} />
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

          {step === S_BELGELER && (
            <Section title="Belgeler" desc="Kullanılacak modül belgesi, fatura, periyodik kontrol ve asansör kimlik no.">
              {/* Kullanılacak Modül Belgesi */}
              <Field label="Kullanılacak Modül Belgesi *" full>
                <div className="flex gap-2">
                  {MODUL_SECENEKLERI.map((m) => {
                    const aktif = modulSecim === m.v || (m.v === "H1B" && (modulSecim === "H1" || modulSecim === "B"));
                    return (
                      <button key={m.v} type="button" onClick={() => setModulSecim(m.v)}
                        className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${aktif ? "border-transparent text-white" : "bg-white border-slate-200 text-slate-700 hover:border-brand hover:text-brand"}`}
                        style={aktif ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)" } : undefined}>
                        {m.t}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {(modulSecim === "H1B" || modulSecim === "H1" || modulSecim === "B") && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-bold text-slate-800 mb-1">Müşterinin CE belgelerinden seçin</div>
                  <div className="text-xs text-slate-500 mb-3">Bu asansör için kullanılacak, önceden yüklenmiş CE belgelerini (Mod B, Mod H1, Tasarım İnceleme, Mod E…) işaretleyin (birden fazla seçebilirsiniz).</div>
                  {(() => {
                    const docs = (props.companyDocuments ?? []).filter((d) => d.company_id === companyId && d.doc_type.startsWith("ce"));
                    if (!companyId) return <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Önce Firma adımında müşteri seçin.</div>;
                    if (docs.length === 0) return <div className="text-xs text-slate-400">Bu müşteriye ait yüklenmiş CE belgesi yok.</div>;
                    return (
                      <div className="space-y-1.5">
                        {docs.map((d) => {
                          const checked = modulBelgeIds.includes(d.id);
                          return (
                            <label key={d.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer ${checked ? "border-brand bg-brand-light" : "border-slate-200 hover:bg-slate-50"}`}>
                              <input type="checkbox" checked={checked}
                                onChange={() => setModulBelgeIds((s) => s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id])} />
                              <span className="text-sm text-slate-800 flex-1">{COMPANY_DOC_ETIKET[d.doc_type] ?? d.doc_type}</span>
                              {d.belge_no && <span className="text-xs text-slate-400">No: {d.belge_no}</span>}
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {modulSecim === "G" && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-800">Modül G Belgesi</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Belge No"><input className="inp" value={modulG.belge_no} onChange={(e) => setModulG({ ...modulG, belge_no: e.target.value })} /></Field>
                    <Field label="Onaylanmış Kuruluş">
                      <select className="inp" value={modulG.nb_id} onChange={(e) => setModulG({ ...modulG, nb_id: e.target.value })}>
                        <option value="">Seçiniz…</option>
                        {props.notifiedBodies.filter((n) => n.identity_no).map((n) => <option key={n.id} value={n.id}>{n.identity_no} · {n.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Veriliş Tarihi"><input type="date" className="inp" value={modulG.verilis} onChange={(e) => setModulG({ ...modulG, verilis: e.target.value })} /></Field>
                    <Field label="Geçerlilik Tarihi"><input type="date" className="inp" value={modulG.gecerlilik} onChange={(e) => setModulG({ ...modulG, gecerlilik: e.target.value })} /></Field>
                  </div>
                  <FileZone label="Modül G Belgesini Yükle" accept="application/pdf,image/*"
                    staged={pending["modul_g_belge"] ?? []} existing={existingFiles.filter((f) => f.kind === "modul_g_belge")}
                    onAdd={(l) => addFiles("modul_g_belge", l)} onRemoveStaged={(i) => removeStaged("modul_g_belge", i)} onDelete={silExisting} />
                  <FileZone label="Modül G Raporunu Yükle" accept="application/pdf,image/*"
                    staged={pending["modul_g_rapor"] ?? []} existing={existingFiles.filter((f) => f.kind === "modul_g_rapor")}
                    onAdd={(l) => addFiles("modul_g_rapor", l)} onRemoveStaged={(i) => removeStaged("modul_g_rapor", i)} onDelete={silExisting} />
                </div>
              )}

              {/* Fatura */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Fatura</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Fatura No"><input className="inp" value={faturaNo} onChange={(e) => setFaturaNo(e.target.value)} /></Field>
                  <Field label="Fatura Tarihi"><input type="date" className="inp" value={faturaTarihi} onChange={(e) => setFaturaTarihi(e.target.value)} /></Field>
                </div>
                <FileZone label="Fatura Yükle" accept="application/pdf,image/*"
                  staged={pending["fatura"] ?? []} existing={existingFiles.filter((f) => f.kind === "fatura")}
                  onAdd={(l) => addFiles("fatura", l)} onRemoveStaged={(i) => removeStaged("fatura", i)} onDelete={silExisting} />
              </div>

              {/* Periyodik Kontrol Raporu */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Periyodik Kontrol Raporu</div>
                <Field label="Rapor Tarihi"><input type="date" className="inp" value={periyodikTarihi} onChange={(e) => setPeriyodikTarihi(e.target.value)} /></Field>
                <FileZone label="Periyodik Kontrol Raporu Yükle" accept="application/pdf,image/*"
                  staged={pending["periyodik_kontrol"] ?? []} existing={existingFiles.filter((f) => f.kind === "periyodik_kontrol")}
                  onAdd={(l) => addFiles("periyodik_kontrol", l)} onRemoveStaged={(i) => removeStaged("periyodik_kontrol", i)} onDelete={silExisting} />
              </div>

              <Field label="Asansör Kimlik No"><input className="inp" value={asansorKimlikNo} onChange={(e) => setAsansorKimlikNo(e.target.value)} placeholder="Örn. 34-XX-XXXX" /></Field>
            </Section>
          )}

          {step === S_ASANSOR && (
            <Section title="Asansör teknik bilgileri" desc="Tüm alanlar zorunludur. Kişi sayısı beyan yüküne göre otomatik gelir.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Asansör Tipi (Sınıf) *" full>
                  <div className="grid grid-cols-3 gap-2">
                    {ASANSOR_SINIFLARI.map((x) => (
                      <button key={x} type="button" onClick={() => setAsansorSinifi(x)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-bold border text-left leading-snug transition-colors ${asansorSinifi === x ? "border-transparent text-white" : `bg-white text-slate-700 hover:border-brand hover:text-brand ${showErrors && !asansorSinifi ? "border-red-300" : "border-slate-200"}`}`}
                        style={asansorSinifi === x ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)", boxShadow: "0 4px 12px rgba(30,42,91,.22)" } : undefined}>
                        {x}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Makine Dairesi *" full>
                  <div className="flex gap-2">
                    {[{ v: "var", t: "Makine Dairesi VAR" }, { v: "yok", t: "Makine Dairesi YOK" }].map((o) => (
                      <button key={o.v} type="button" onClick={() => setMakineDairesi(o.v)}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${makineDairesi === o.v ? "border-transparent text-white" : `bg-white text-slate-700 hover:border-brand hover:text-brand ${showErrors && !makineDairesi ? "border-red-300" : "border-slate-200"}`}`}
                        style={makineDairesi === o.v ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)", boxShadow: "0 4px 12px rgba(30,42,91,.22)" } : undefined}>
                        {o.t}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Beyan Yükü (kg) *">
                  <select className={"inp" + ec(beyanYuku)} value={beyanYuku} onChange={(e) => setBeyanYuku(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Seçiniz…</option>
                    {props.capacity.map((c) => <option key={c.beyan_yuku_kg} value={c.beyan_yuku_kg}>{c.beyan_yuku_kg}</option>)}
                  </select>
                </Field>
                <Field label="Kişi Sayısı (otomatik)"><input className="inp bg-slate-100" value={kisi ?? ""} disabled /></Field>
                <Field label="Beyan Hızı (m/s) *">
                  <input className={"inp" + ec(beyanHizi)} value={beyanHizi} onChange={(e) => setBeyanHizi(e.target.value)} placeholder="Örn. 1.0" />
                </Field>
                <Field label="İmal Yılı *">
                  <select className={"inp" + ec(imalYili)} value={imalYili} onChange={(e) => setImalYili(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {IMAL_YILLARI.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>

                {/* Kat listesi — seçimler burada; toplam kat adedi otomatik dolar */}
                <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-4">
                  <div className="font-bold mb-1">Kat Listesi</div>
                  <p className="text-xs text-slate-400 mb-3">Başlangıç katı ve kat sayısını seçin; liste otomatik oluşur. Gerekirse ara kat ekleyin. Toplam kat adedi aşağıya otomatik yazılır.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Başlangıç Katı *">
                      <select className={"inp" + ec(baslangicKat)} value={baslangicKat} onChange={(e) => setBaslangicKat(e.target.value)}>
                        <option value="">Seçiniz…</option>
                        {KAT_BASLANGIC.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </Field>
                    <Field label="Kat Sayısı * (ara katlar hariç)">
                      <select className={"inp" + ec(katSayisi)} value={katSayisi} onChange={(e) => setKatSayisi(e.target.value)}>
                        <option value="">Seçiniz…</option>
                        {RANGE_100.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>
                  </div>

                  {katListesi.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {katListesi.map((k, i) => (
                        <span key={`${k}-${i}`} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${araKatlar.some((m) => m.label === k) ? "bg-amber-50 text-amber-700" : "bg-brand-light text-brand"}`}>{k}</span>
                      ))}
                    </div>
                  )}

                  {baseFloors.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="text-xs font-semibold text-slate-600 mb-2">Ara Kat Ekle</div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Hangi katların arasına?</label>
                          <select value={araKatAfter} onChange={(e) => setAraKatAfter(e.target.value)}
                            className="text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand">
                            <option value="">Seçiniz…</option>
                            {katListesi.slice(0, -1).map((k, i) => (
                              <option key={`${k}-${i}`} value={k}>{k} ile {katListesi[i + 1]} arası</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Ara Kat Adı</label>
                          <input value={araKatLabel} onChange={(e) => setAraKatLabel(e.target.value)}
                            className="text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand w-36" />
                        </div>
                        <button type="button"
                          onClick={() => { if (araKatAfter && araKatLabel.trim()) { setAraKatlar((a) => [...a, { after: araKatAfter, label: araKatLabel.trim() }]); setAraKatAfter(""); } }}
                          className="text-sm font-bold bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg">+ Ekle</button>
                      </div>
                      {araKatlar.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {araKatlar.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                              <span className="font-semibold">{m.label}</span>
                              <span className="text-slate-400">({m.after} üstüne)</span>
                              <button type="button" onClick={() => setAraKatlar((a) => a.filter((_, j) => j !== i))} className="text-red-500 hover:underline">kaldır</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Field label="Kat Adedi (otomatik — ara katlar dahil)">
                  <input className={"inp bg-slate-100" + ec(katAdedi)} value={katAdedi} disabled />
                </Field>
                <Field label="Durak Adedi * (kattan fazla olamaz)">
                  <select className={"inp" + ec(durakAdedi)} value={durakAdedi} onChange={(e) => setDurakAdedi(e.target.value)} disabled={!katAdedi}>
                    <option value="">{katAdedi ? "Seçiniz…" : "Önce kat adedi"}</option>
                    {RANGE_100.filter((n) => !katAdedi || n <= Number(katAdedi)).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Giriş Sayısı * (en fazla 3)">
                  <select className={"inp" + ec(girisSayisi)} value={girisSayisi} onChange={(e) => setGirisSayisi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {RANGE_3.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Askı Tipi *">
                  <select className={"inp" + ec(askiTipi)} value={askiTipi} onChange={(e) => setAskiTipi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {ASKI_TIPLERI.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Kapı Tipi *">
                  <select className={"inp" + ec(katKapisi)} value={katKapisi} onChange={(e) => setKatKapisi(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {KAPI_TIPLERI.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Kapı Genişliği (mm) *"><input className={"inp" + ec(kapiGenislik)} value={kapiGenislik} onChange={(e) => setKapiGenislik(e.target.value)} placeholder="Örn. 900" /></Field>
                <Field label="Kapı Yüksekliği (mm) *"><input className={"inp" + ec(kapiYukseklik)} value={kapiYukseklik} onChange={(e) => setKapiYukseklik(e.target.value)} placeholder="Örn. 2000" /></Field>
                <Field label="Kabin Genişliği (mm) *"><input className={"inp" + ec(kabinGenislik)} value={kabinGenislik} onChange={(e) => setKabinGenislik(e.target.value)} placeholder="Örn. 1350" /></Field>
                <Field label="Kabin Derinliği (mm) *"><input className={"inp" + ec(kabinDerinlik)} value={kabinDerinlik} onChange={(e) => setKabinDerinlik(e.target.value)} placeholder="Örn. 1400" /></Field>
                <Field label="Kabin Ağırlığı (kg) *"><input className={"inp" + ec(kabinAgirligi)} value={kabinAgirligi} onChange={(e) => setKabinAgirligi(e.target.value)} placeholder="Örn. 700" /></Field>
                {!isHid && (
                  <>
                    <Field label="Karşı Ağırlığın Yeri *">
                      <select className={"inp" + ec(karsiAgirlikYeri)} value={karsiAgirlikYeri} onChange={(e) => setKarsiAgirlikYeri(e.target.value)}>
                        <option value="">Seçiniz…</option>
                        {KARSI_AGIRLIK_YERLERI.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </Field>
                    <Field label="Karşı Ağırlık (kg) — otomatik">
                      <input className="inp bg-slate-100" value={karsiAgirlik} disabled />
                    </Field>
                  </>
                )}
                <Field label="Asansör Seri No *"><input className={"inp" + ec(asansorSeriNo)} value={asansorSeriNo} onChange={(e) => setAsansorSeriNo(e.target.value)} /></Field>
                <Field label="Seyir Mesafesi (m) *"><input className={"inp" + ec(seyirMesafesi)} value={seyirMesafesi} onChange={(e) => setSeyirMesafesi(e.target.value)} /></Field>
                {!isHid ? (
                  <Field label="Motor Gücü (kW) *"><input className={"inp" + ec(motorGucu)} value={motorGucu} onChange={(e) => setMotorGucu(e.target.value)} /></Field>
                ) : (
                  <>
                    <Field label="Motor / Ünite Markası *"><input className={"inp" + ec(motorMarka)} value={motorMarka} onChange={(e) => setMotorMarka(e.target.value)} /></Field>
                    <Field label="Motor Gücü (kW) *"><input className={"inp" + ec(motorGucu)} value={motorGucu} onChange={(e) => setMotorGucu(e.target.value)} /></Field>
                    <Field label="Ünite / Motor Bilgisi *"><input className={"inp" + ec(uniteBilgisi)} value={uniteBilgisi} onChange={(e) => setUniteBilgisi(e.target.value)} placeholder="Ek bilgi" /></Field>
                    <Field label="Piston Ölçüleri (mm) *" full>
                      <input className={"inp" + ec(pistonOlculeri)} value={pistonOlculeri} onChange={(e) => setPistonOlculeri(e.target.value)} placeholder="Örn. 165 x 8 x 4700" />
                      <p className="text-xs text-slate-500 mt-1">Piston Çapı × Et Kalınlığı × Piston Boyu olarak giriş yapınız.</p>
                    </Field>
                    <Field label="Piston Yeri *">
                      <select className={"inp" + ec(pistonYeri)} value={pistonYeri} onChange={(e) => setPistonYeri(e.target.value)}>
                        <option value="">Seçiniz…</option>
                        {PISTON_YERLERI.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </Field>
                    <Field label="Debi (l/d) *"><input className={"inp" + ec(debi)} value={debi} onChange={(e) => setDebi(e.target.value)} placeholder="Örn. 380" /></Field>
                  </>
                )}
              </div>

              {/* Kat listesi */}
            </Section>
          )}

          {step === S_EKIPMAN && (
            <Section title="Kritik ekipmanlar" desc="Tümü zorunludur. Önce marka, sonra model seçin.">
              <div className="space-y-4">
                {equipCards.map((cat) => {
                  const catBrands = props.brands.filter((b) => b.category_id === cat.catId);
                  const sel = equip[cat.key] || {};
                  const catModels = sel.brandId ? props.models.filter((m) => m.brand_id === sel.brandId) : [];
                  const model = props.models.find((m) => m.id === sel.modelId);
                  const cert = model?.certificate_id ? certById.get(model.certificate_id) : undefined;
                  const nb = cert?.notified_body_id ? nbById.get(cert.notified_body_id) : undefined;
                  const eksik = showErrors && eqIncomplete(cat);
                  const multiCfg = MULTI_SERI[cat.code];
                  const multiN = multiCountForCode(cat.code);
                  return (
                    <div key={cat.key} className={`bg-white border rounded-xl p-4 ${eksik ? "border-red-400 bg-red-50/40" : "border-slate-200"}`}>
                      <div className="font-bold mb-2">{cat.label} <span className="text-red-500">*</span></div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Marka</div>
                      <div className="flex flex-wrap gap-2 mb-1">
                        {catBrands.map((b) => (
                          <button key={b.id} onClick={() => pickBrand(cat.key, b.id)}
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
                              <button key={m.id} onClick={() => pickModel(cat.key, m.id)}
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
                      {sel.modelId && multiCfg && multiN > 0 && (
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Seri No — her {multiCfg.label.toLocaleLowerCase("tr")} için ayrı ({multiN} adet) *
                          </label>
                          <div className="space-y-2">
                            {Array.from({ length: multiN }).map((_, i) => {
                              const v = sel.seriList?.[i] ?? "";
                              const pasif = isPasifSeri(cat.code, i);
                              return (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="w-24 shrink-0 text-xs font-semibold text-slate-600">{seriEtiket(cat.code, i)}</span>
                                  {pasif ? (
                                    <input value="Giriş yapılamaz" disabled
                                      className="inp !bg-slate-100 !text-slate-400 !border-slate-200 cursor-not-allowed italic" />
                                  ) : (
                                    <input
                                      value={v}
                                      onChange={(e) => setSeriAt(cat.key, i, e.target.value)}
                                      placeholder="Seri no"
                                      className={"inp" + (showErrors && !v.trim() ? " !border-red-300 !bg-red-50" : "")}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {sel.modelId && multiCfg && multiN === 0 && (
                        <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Seri no kutuları için önce Asansör adımında {multiCfg.count === "durak" ? "durak" : "giriş"} sayısını girin.
                        </div>
                      )}
                      {sel.modelId && !multiCfg && (
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ekipman Seri No *</label>
                          <input
                            value={sel.seriNo ?? ""}
                            onChange={(e) => setSeriNo(cat.key, e.target.value)}
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

          {step === S_ISLEM && (
            <Section title="Dosya İşlemleri" desc="Dosyayı oluştur, gönder ve teslim durumunu yönet.">
              {showErrors && totalMissing > 0 && (
                <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {totalMissing} zorunlu alan eksik. İşlemlerden önce tüm adımlardaki kırmızı alanları doldurun.
                </div>
              )}

              {/* Üst: özet */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <SummRow k="Asansör Tipi" v={isHid ? "Hidrolik" : "Elektrikli"} />
                <SummRow k="Firma" v={company?.short_name} /><SummRow k="Proje / Dosya No" v={dosyaNo} />
                <SummRow k="Bina" v={binaAdi} /><SummRow k="Kapasite" v={beyanYuku ? `${beyanYuku} kg · ${kisi ?? "—"} kişi` : "—"} />
                <SummRow k="Kat / Durak" v={`${katAdedi || "—"} / ${durakAdedi || "—"}`} />
                <SummRow k="Seçili ekipman" v={`${selectedEquipCount} / ${equipCards.length}`} />
              </div>

              {/* Dosya oluşturma */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Dosya Oluştur</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => handleSave({ gotoBelge: true })}
                    className="gs-btn text-sm font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-1">
                    <span className="material-symbols-rounded text-[18px]">description</span> Full TD Oluştur
                  </button>
                  <button type="button" disabled title="İçerik daha sonra tanımlanacak"
                    className="text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-400 inline-flex items-center gap-1 cursor-not-allowed">
                    <span className="material-symbols-rounded text-[18px]">domain</span> Tescil Dosyası Oluştur
                  </button>
                  <button type="button" disabled title="İçerik daha sonra tanımlanacak"
                    className="text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-400 inline-flex items-center gap-1 cursor-not-allowed">
                    <span className="material-symbols-rounded text-[18px]">verified</span> OK için TD Oluştur
                  </button>
                  <button type="button" disabled title="İçerik daha sonra tanımlanacak"
                    className="text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-400 inline-flex items-center gap-1 cursor-not-allowed">
                    <span className="material-symbols-rounded text-[18px]">fact_check</span> PK Başvuru Dosyası Oluştur
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={mailto(`${dosyaNo} — Teknik Dosya`, musteriMetni())}
                    className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1">
                    <span className="material-symbols-rounded text-[16px]">mail</span> Müşteriye e-posta
                  </a>
                  <a href={waLink(musteriMetni())} target="_blank" rel="noreferrer"
                    className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1">
                    <span className="material-symbols-rounded text-[16px]">chat</span> WhatsApp
                  </a>
                  <button type="button" onClick={() => kopyala("musteri", musteriMetni())}
                    className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1">
                    <span className="material-symbols-rounded text-[16px]">content_copy</span> {kopyalandi === "musteri" ? "Kopyalandı" : "Metni kopyala"}
                  </button>
                </div>
                <div className="text-xs text-slate-400">"Full TD Oluştur" kaydeder ve belgelerin listelendiği ekrana götürür. Diğer üç dosya türünün içeriği daha sonra tanımlanacak.</div>
              </div>

              {/* Asansör Projesi (DWG) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Asansör Projesi (DWG)</div>
                <Field label="Proje No"><input className="inp !bg-slate-50" value={dosyaNo} readOnly /></Field>
                <FileZone label="Asansör Projesi Yükle (DWG)" accept=".dwg,application/acad,image/vnd.dwg,application/dwg,application/octet-stream"
                  staged={pending["asansor_projesi"] ?? []} existing={existingFiles.filter((f) => f.kind === "asansor_projesi")}
                  onAdd={(l) => addFiles("asansor_projesi", l)} onRemoveStaged={(i) => removeStaged("asansor_projesi", i)} onDelete={silExisting} />
              </div>

              {/* Fatura durumu + fiyat */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Fatura</div>
                <div className="flex gap-2">
                  {[{ v: "faturali", t: "FATURALI" }, { v: "faturasiz", t: "FATURASIZ" }].map((o) => (
                    <button key={o.v} type="button" onClick={() => setFaturali(o.v)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${faturali === o.v ? "border-transparent text-white" : "bg-white border-slate-200 text-slate-700 hover:border-brand hover:text-brand"}`}
                      style={faturali === o.v ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)" } : undefined}>
                      {o.t}
                    </button>
                  ))}
                </div>
                {faturali && (
                  <div className="space-y-2">
                    {faturali === "faturali" && (
                      <div className="text-xs text-slate-500">Fatura bilgileri (Belgeler adımından): No <b>{faturaNo || "—"}</b> · Tarih <b>{faturaTarihi || "—"}</b></div>
                    )}
                    <Field label="Fiyat + KDV (TL)"><input className="inp" value={fiyat} onChange={(e) => setFiyat(formatThousands(e.target.value))} placeholder="Örn. 25.000" inputMode="numeric" /></Field>
                  </div>
                )}
              </div>

              {/* Teslim durumu */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Teslim Durumu</div>
                <div className="flex gap-2">
                  {[{ v: "taslak", t: "Taslakta Bırak" }, { v: "teslim", t: "Teslim Edildi" }].map((o) => (
                    <button key={o.v} type="button" onClick={() => setTeslimDurumu(o.v)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${teslimDurumu === o.v ? "border-transparent text-white" : "bg-white border-slate-200 text-slate-700 hover:border-brand hover:text-brand"}`}
                      style={teslimDurumu === o.v ? { background: "linear-gradient(135deg,#16a34a,#15803d)" } : undefined}>
                      {o.t}
                    </button>
                  ))}
                </div>
                {teslimDurumu === "teslim" && (
                  <div className="space-y-3">
                    <Field label="Teslim Tarihi"><input type="date" className="inp" value={teslimTarihi} onChange={(e) => setTeslimTarihi(e.target.value)} /></Field>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-600 mb-1">Muhasebe bildirimi</div>
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{muhasebeMetni()}</pre>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <a href={mailto(`${dosyaNo} — Muhasebe Bildirimi`, muhasebeMetni())}
                          className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-white inline-flex items-center gap-1">
                          <span className="material-symbols-rounded text-[16px]">send</span> Muhasebeye Gönder (e-posta)
                        </a>
                        <button type="button" onClick={() => kopyala("muhasebe", muhasebeMetni())}
                          className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-white inline-flex items-center gap-1">
                          <span className="material-symbols-rounded text-[16px]">content_copy</span> {kopyalandi === "muhasebe" ? "Kopyalandı" : "Metni kopyala"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && <div className="mt-1 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
              <p className="text-xs text-slate-400">Kaydetmek için sağ üstteki {isEdit ? "Güncelle" : "Kaydet"} düğmesini kullanın. Yüklediğiniz dosyalar (Yapı Ruhsatı, Modül G, Fatura, Periyodik, DWG) kayıtla birlikte yüklenir.</p>
            </Section>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-500 uppercase mb-3">Özet</div>
            <SummRow k="Firma" v={company?.short_name} /><SummRow k="Dosya No" v={dosyaNo} />
            <SummRow k="İl" v={props.provinces.find((p) => p.id === provinceId)?.name} />
            <SummRow k="Kapasite" v={beyanYuku ? `${beyanYuku} kg` : "—"} />
            <SummRow k="Ekipman" v={`${selectedEquipCount} / ${equipCards.length}`} />
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
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (<div className={full ? "col-span-2" : undefined}><label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>{children}</div>);
}
function FileZone({
  label, accept, staged, existing, onAdd, onRemoveStaged, onDelete,
}: {
  label: string; accept?: string; staged: File[]; existing: ProjectFile[];
  onAdd: (l: FileList | null) => void; onRemoveStaged: (i: number) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="text-sm font-semibold text-slate-800">{label}</div>
      {existing.map((f) => (
        <div key={f.id} className="flex items-center justify-between text-xs">
          <a href={`/api/belge/proje?id=${f.id}`} target="_blank" rel="noreferrer" className="text-navy font-semibold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-rounded text-[15px]">description</span>{f.original_name ?? "dosya"}
          </a>
          <button type="button" onClick={() => onDelete(f.id)} className="text-red-500 hover:underline">Sil</button>
        </div>
      ))}
      {staged.map((f, i) => (
        <div key={i} className="flex items-center justify-between text-xs text-slate-600">
          <span className="inline-flex items-center gap-1"><span className="material-symbols-rounded text-[15px] text-amber-600">upload_file</span>{f.name} <span className="text-slate-400">· kaydedilecek</span></span>
          <button type="button" onClick={() => onRemoveStaged(i)} className="text-red-500 hover:underline">Kaldır</button>
        </div>
      ))}
      <input type="file" accept={accept} multiple onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
        className="text-xs w-full file:mr-2 file:text-xs file:font-semibold file:border-0 file:bg-brand-light file:text-brand file:px-2 file:py-1 file:rounded-md" />
    </div>
  );
}
function AutoRow({ k, v }: { k: string; v?: string | null }) {
  return (<div className="flex justify-between gap-3 py-1.5 border-b border-dashed border-slate-200 last:border-0 text-sm"><span className="text-slate-500">{k}</span><span className="font-semibold text-right">{v || "—"}</span></div>);
}
function SummRow({ k, v }: { k: string; v?: string | null }) {
  return (<div className="flex justify-between gap-3 py-1.5 border-b border-dashed border-slate-200 last:border-0 text-sm"><span className="text-slate-500">{k}</span><span className="font-semibold text-right">{v || "—"}</span></div>);
}
