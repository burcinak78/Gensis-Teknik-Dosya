"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveDraftProject, updateDraftProject, uploadProjectFile, deleteProjectFile, sendProjectToMuhasebe, removeProjectFromMuhasebe, type DraftPayload } from "./actions";
import { uploadEngineerDocument } from "../admin/actions";

type Company = {
  id: string; short_name: string; legal_name: string; address: string | null;
  phone: string | null; fax: string | null; city: string | null;
  authorized_person: string | null; registered_brand: string | null; industry_reg_no: string | null;
};
type Category = { id: string; code: string; name: string; sort_order: number; drive_type?: string };
type Brand = { id: string; category_id: string; name: string };
type Model = { id: string; brand_id: string; name: string; certificate_id: string | null };
type Certificate = { id: string; cert_no: string; notified_body_id: string | null };
type NotifiedBody = { id: string; identity_no: string | null; name: string; address?: string | null };
type Province = { id: number; name: string };
type Capacity = { beyan_yuku_kg: number; kisi_sayisi: number | null; kabin_agirlik_kg: number | null; karsi_agirlik_kg: number | null };
type Lookup = { list_key: string; value: string; sort_order: number };
type District = { id: string; name: string };
type Engineer = { id: string; full_name: string; discipline: string; chamber_reg_no: string | null; company_id: string | null; imzaDocId?: string | null };
type CompanyDoc = { id: string; company_id: string; doc_type: string; belge_no: string | null; issue_date: string | null; valid_until: string | null; notified_body_id: string | null; original_name?: string | null };
type ProjectFile = { id: string; kind: string; original_name: string | null };

type EquipInit = Record<string, { brandId?: string; modelId?: string; seriNo?: string; seriList?: string[] }>;
// Düzenleme modunda mevcut projeyi dolduran başlangıç verisi
export type InitialData = {
  id: string;
  companyId: string; dosyaNo: string; dosyaTarihi: string;
  binaAdi: string; montajAdresi: string;
  provinceId: number | ""; districtId: string; districts: District[];
  beyanYuku: number | ""; beyanHizi: string; katAdedi: string; durakAdedi: string;
  girisSayisi: string; asansorSayisi?: string; imalYili: string; askiTipi: string; katKapisi: string;
  pafta: string; ada: string; parsel: string; yapiSahibi: string; yapiSahibiAdresi: string;
  asansorSeriNo: string; asansorKimlikNo: string; seyirMesafesi: string; motorGucu: string;
  asansorTipi: string; pistonOlculeri: string; pistonYeri: string; debi: string; uniteBilgisi: string;
  asansorSinifi: string; kapiGenislik: string; kapiYukseklik: string;
  kabinGenislik: string; kabinDerinlik: string; kabinAgirligi: string; karsiAgirlikYeri: string;
  motorMarka: string; makineDairesi: string; katSayisi: string;
  baslangicKat: string; araKatlar: { after: string; label: string }[];
  makineMuhId: string; elektrikMuhId: string;
  equip: EquipInit;
  kabinYok?: boolean; // Kabin Kapı Kilidi = Yok (toggle) → Teknik Komponent'te kabin kapısı kilitleme satırı gelmez
  imzaMakine?: boolean; imzaElektrik?: boolean; // Taahhütnameye müellif imzası eklensin mi
  // Belgeler + Dosya İşlemleri (Faz 1 metadata)
  modulSecim?: string; modulBelgeIds?: string[];
  modulG?: { belge_no: string; verilis: string; gecerlilik: string; nb_id: string };
  faturaNo?: string; faturaTarihi?: string; periyodikTarihi?: string;
  faturali?: string; fiyat?: string; teslimDurumu?: string; teslimTarihi?: string; teslimTipi?: string;
  muhasebeKilit?: boolean; // muhasebe teslim edildi → Dosya Tamamlama kilitli
  files?: ProjectFile[];
};

type Props = {
  companies: Company[]; categories: Category[]; brands: Brand[]; models: Model[];
  certificates: Certificate[]; notifiedBodies: NotifiedBody[]; provinces: Province[];
  capacity: Capacity[]; lookups: Lookup[];
  engineers: Engineer[]; gensisCompanyId: string | null;
  companyDocuments?: CompanyDoc[];
  engineerDocuments?: { engineer_id: string; doc_type: string; valid_until: string | null }[];
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
const RANGE_10 = Array.from({ length: 10 }, (_, i) => i + 1);
// Binlik ayraçlı sayı biçimi (ör. 25000 → "25.000")
const formatThousands = (s: string) => { const d = String(s ?? "").replace(/\D/g, ""); return d ? Number(d).toLocaleString("tr-TR") : ""; };
const COMPANY_DOC_ETIKET: Record<string, string> = {
  sanayi_sicil: "Sanayi Sicil Belgesi", tse_hyb: "TSE HYB Belgesi",
  ce_h1: "Mod H1 Belgesi", ce_tasarim: "Tasarım İnceleme Belgesi",
  ce_b: "Mod B Belgesi", ce_b_eki: "Mod B Eki", ce_e: "Mod E Belgesi",
};
// CE belgelerinin gösterim/ekleme sırası: H1 → Tasarım İnceleme → Mod B (+Eki) → Mod E
const CE_ORDER: Record<string, number> = { ce_h1: 0, ce_tasarim: 1, ce_b: 2, ce_b_eki: 3, ce_e: 4 };
const RANGE_100 = Array.from({ length: 100 }, (_, i) => i + 1);
// Her kat/giriş için ayrı seri no giren kategoriler:
//  - kapı kilidi: KAT ADEDİ kadar (kat listesindeki her kat) → kat isimleri; asma katlar pasif
//  - kabin kapı kilidi: giriş sayısı kadar → "Giriş 1..N"
const MULTI_SERI: Record<string, { count: "durak" | "giris" | "kat"; label: string }> = {
  kapi_kilidi: { count: "kat", label: "Kat" },
  kabin_kilidi: { count: "giris", label: "Giriş" },
};
// Kapı kilidinde her kat için giriş sayısı kadar seri no vardır. Tek bir string olarak
// "seri1 / seri2" biçiminde saklanır; UI'de giriş sayısı kadar ayrı kutuya bölünür.
const splitSeri = (s: string | undefined, g: number): string[] => {
  const parts = String(s ?? "").split("/").map((x) => x.trim());
  while (parts.length < g) parts.push("");
  return parts.slice(0, Math.max(1, g));
};
const joinSeri = (parts: string[]): string => {
  const p = parts.map((x) => x.trim());
  while (p.length > 1 && p[p.length - 1] === "") p.pop();
  return p.join(" / ");
};
const empty = (x: any) => x === "" || x === null || x === undefined;

// Eksik alan pop-up'ında gösterilecek okunur alan adları
const DOC_AD: Record<string, string> = {
  imza_sirkuleri: "İmza Sirküleri", sanayi_sicil: "Sanayi Sicil Belgesi", tse_hyb: "TSE HYB Belgesi",
  ce_h1: "CE H1 Belgesi", ce_e: "CE Mod E Belgesi", ce_b: "CE Mod B Belgesi", ce_tasarim: "CE Tasarım İnceleme",
  // Mühendis belgeleri
  imza: "İmza", oda_kayit: "Oda Kayıt Belgesi", oda_sicil: "Oda Sicil Belgesi", smm: "SMM Belgesi",
  diploma: "Diploma", sgk: "SGK Belgesi", tescil: "Tescil Belgesi",
};
const FIELD_LABELS: Record<string, string> = {
  companyId: "Montaj / Mimarlık Firması", dosyaNo: "Proje No", dosyaTarihi: "Tarih",
  makineMuhId: "Makine Mühendisi (Proje Müellifi)", elektrikMuhId: "Elektrik Mühendisi (Proje Müellifi)",
  binaAdi: "Bina Adı", montajAdresi: "Montaj Adresi", provinceId: "İl", districtId: "Belediye",
  pafta: "Pafta", ada: "Ada", parsel: "Parsel", yapiSahibi: "Yapı Sahibi", yapiSahibiAdresi: "Yapı Sahibi Adresi",
  yapiRuhsati: "Yapı Ruhsatı (dosya yükleyin)",
  modulGOnaylanmisKurulus: "Onaylanmış Kuruluş (Mod G)",
  asansorSinifi: "Asansör Sınıfı", makineDairesi: "Makine Dairesi", beyanYuku: "Beyan Yükü", beyanHizi: "Beyan Hızı",
  baslangicKat: "Başlangıç Katı", katSayisi: "Kat Sayısı", katAdedi: "Kat Adedi", durakAdedi: "Durak Adedi",
  girisSayisi: "Giriş Sayısı", imalYili: "İmal Yılı", askiTipi: "Askı Tipi", katKapisi: "Kat Kapısı",
  kapiGenislik: "Kapı Genişliği", kapiYukseklik: "Kapı Yüksekliği", kabinGenislik: "Kabin Genişliği",
  kabinDerinlik: "Kabin Derinliği", kabinAgirligi: "Kabin Ağırlığı", asansorSeriNo: "Asansör Seri No",
  seyirMesafesi: "Seyir Mesafesi", pistonOlculeri: "Piston Ölçüleri", pistonYeri: "Piston Yeri", debi: "Debi",
  uniteBilgisi: "Ünite / Motor Seri No", motorMarka: "Motor Markası", motorGucu: "Motor Gücü",
  karsiAgirlikYeri: "Karşı Ağırlık Yeri",
};

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
  const [asansorSayisi, setAsansorSayisi] = useState(init?.asansorSayisi ?? "1");
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
  // Kabin Kapı Kilidi Var/Yok toggle (varsayılan: Var). Yok → kabin kapısı kilitleme satırı listeden çıkar.
  const [kabinYok, setKabinYok] = useState<boolean>(init?.kabinYok ?? false);
  // Taahhütnameye müellif imzası eklensin mi (imza yüklüyse)
  const [imzaMakine, setImzaMakine] = useState<boolean>(init?.imzaMakine ?? false);
  const [imzaElektrik, setImzaElektrik] = useState<boolean>(init?.imzaElektrik ?? false);

  // Belgeler adımı (Faz 1 metadata)
  const [modulSecim, setModulSecim] = useState(init?.modulSecim ?? "");
  const [modulBelgeIds, setModulBelgeIds] = useState<string[]>(init?.modulBelgeIds ?? []);
  const [modulG, setModulG] = useState(init?.modulG ?? { belge_no: "", verilis: "", gecerlilik: "", nb_id: "" });
  const [belgeModal, setBelgeModal] = useState<string | null>(null); // CE belge önizleme (modal)
  // Firma değişince, müşterinin yüklü Mod E belgesi varsa otomatik seç (ilk render/edit'te dokunma)
  const ceAutoRef = useRef(false);
  useEffect(() => {
    if (!ceAutoRef.current) { ceAutoRef.current = true; return; }
    const ceE = (props.companyDocuments ?? []).find((d) => d.company_id === companyId && d.doc_type === "ce_e");
    if (ceE) setModulBelgeIds((s) => (s.includes(ceE.id) ? s : [...s, ceE.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);
  const [faturaNo, setFaturaNo] = useState(init?.faturaNo ?? "");
  const [faturaTarihi, setFaturaTarihi] = useState(init?.faturaTarihi ?? "");
  const [periyodikTarihi, setPeriyodikTarihi] = useState(init?.periyodikTarihi ?? "");
  // Dosya İşlemleri adımı
  const [faturali, setFaturali] = useState(init?.faturali ?? "faturasiz");
  const [fiyat, setFiyat] = useState(formatThousands(init?.fiyat ?? ""));
  const [teslimDurumu, setTeslimDurumu] = useState(init?.teslimDurumu ?? "taslak");
  const [teslimTarihi, setTeslimTarihi] = useState(init?.teslimTarihi ?? "");
  const [teslimTipi, setTeslimTipi] = useState(init?.teslimTipi ?? "dijital"); // hard_copy | dijital
  const [kopyalandi, setKopyalandi] = useState<string>("");
  // Yüklenecek (staged) ve mevcut dosyalar
  const [pending, setPending] = useState<Record<string, File[]>>({});
  const [existingFiles, setExistingFiles] = useState<ProjectFile[]>(init?.files ?? []);
  const addFiles = (kind: string, list: FileList | null) => {
    if (!list || !list.length) return;
    const arr = Array.from(list); // input temizlenmeden ÖNCE yakala (updater içinde geç okuma boş döndürüyordu)
    setPending((p) => ({ ...p, [kind]: [...(p[kind] ?? []), ...arr] }));
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
  const [currentId, setCurrentId] = useState<string | null>(init?.id ?? null); // ilk kayıttan sonra güncelleme yapılır
  const [savedToast, setSavedToast] = useState(false); // "Başarıyla Kaydedildi" pop-up
  const [fullTdUyari, setFullTdUyari] = useState<{ eksik: string[]; evrak: string[]; suresi: string[] } | null>(null); // Full TD ön-uyarı
  // Muhasebe teslim edildi ise Dosya Tamamlama kilitli
  const muhasebeKilit = init?.muhasebeKilit === true;
  // Eksik alan/belge uyarı pop-up'ı (her adım sonunda)
  const [eksikModal, setEksikModal] = useState<{ adim: string; alanlar: string[] } | null>(null);

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
  // Beyan yükü seçenekleri: mevcut kapasite değerleri + 10 tona kadar 500'er kg
  const beyanYukuOptions = useMemo(() => {
    const set = new Set<number>(props.capacity.map((c) => c.beyan_yuku_kg));
    for (let w = 500; w <= 10000; w += 500) set.add(w);
    return Array.from(set).sort((a, b) => a - b);
  }, [props.capacity]);

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

  // Yapı ruhsatı dosyası yüklü mü (staged veya kayıtlı) — zorunlu
  const yapiRuhsatiVar = (pending["yapi_ruhsati"]?.length ?? 0) > 0 || existingFiles.some((f) => f.kind === "yapi_ruhsati");
  // zorunlu alanlar
  const requiredMap: Record<string, any> = {
    companyId, dosyaNo, dosyaTarihi, makineMuhId, elektrikMuhId, binaAdi, montajAdresi, provinceId, districtId,
    pafta, ada, parsel, yapiSahibi, yapiSahibiAdresi, beyanYuku, beyanHizi, katAdedi,
    durakAdedi, girisSayisi, imalYili, askiTipi, katKapisi, asansorSeriNo,
    seyirMesafesi, asansorSinifi, makineDairesi, baslangicKat, katSayisi, kapiGenislik, kapiYukseklik,
    kabinGenislik, kabinDerinlik, kabinAgirligi, yapiRuhsati: yapiRuhsatiVar ? "ok" : "", ...driveReq,
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
    if (cfg.count === "kat") return katListesi.length;      // kapı kilidi = kat adedi (kat listesi)
    if (cfg.count === "durak") return Number(durakAdedi || 0);
    return Number(girisSayisi || 0);                         // giriş
  };
  // Asma (ara) kat satırları: kapı kilidinde ara kat karşısındaki seri no PASİF olur
  const araKatLabelSet = useMemo(() => new Set(araKatlar.map((m) => m.label)), [araKatlar]);
  const isPasifSeri = (code: string, i: number) => code === "kapi_kilidi" && araKatLabelSet.has(katListesi[i]);
  // Kapı kilidinde bir kat için kaç seri no kutusu gösterileceği = giriş sayısı (en az 1)
  const GIRIS = Math.max(1, Number(girisSayisi) || 1);

  // Kat listesi değiştiğinde (ör. asma kat ekle/çıkar) kapı kilidi seri no'larını
  // KONUMA göre değil KAT İSMİNE göre yeniden hizala. Böylece araya kat eklenince
  // seri no'lar kaymaz; asma/ara katlar her zaman boş kalır. Her değişimde baştan yazılır.
  const prevKatRef = useRef<string[]>(katListesi);
  useEffect(() => {
    const prev = prevKatRef.current;
    const next = katListesi;
    if (prev.join("") === next.join("")) return; // değişiklik yok
    setEquip((e) => {
      const updated: typeof e = { ...e };
      let changed = false;
      for (const card of equipCards) {
        if (card.code !== "kapi_kilidi") continue;
        const cur = updated[card.key]?.seriList;
        if (!cur || cur.length === 0) continue;
        // önceki kat listesinden isim → seri no eşlemesi
        const byName: Record<string, string> = {};
        prev.forEach((name, idx) => { if (cur[idx] && cur[idx].trim()) byName[name] = cur[idx]; });
        const newList = next.map((name) => (araKatLabelSet.has(name) ? "" : (byName[name] ?? "")));
        updated[card.key] = { ...updated[card.key], seriList: newList };
        changed = true;
      }
      return changed ? updated : e;
    });
    prevKatRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [katListesi]);
  // ekipman: marka + model + seri no dolu değilse eksik sayılır (ara kat satırları hariç)
  const eqIncomplete = (card: { key: string; code: string }) => {
    const s = equip[card.key] || {};
    // Kabin Kapı Kilidi "Yok" ise geçerli (seçim beklenmez)
    if (card.code === "kabin_kilidi" && kabinYok) return false;
    // Model seçilmemiş / YOK (marka seçili olsa bile) → ekipman yok kabul edilir, geçerli.
    // Seri no yalnızca model seçildiğinde zorunludur.
    if (!s.modelId) return false;
    const n = multiCountForCode(card.code);
    if (n > 0) {
      const list = s.seriList || [];
      for (let i = 0; i < n; i++) {
        if (isPasifSeri(card.code, i)) continue;
        if (card.code === "kapi_kilidi") {
          // her kat için giriş sayısı kadar seri no dolu olmalı
          const parts = splitSeri(list[i], GIRIS);
          if (parts.some((p) => !p.trim())) return true;
        } else if (!list[i] || !list[i].trim()) {
          return true;
        }
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
    [S_RUHSAT]: { binaAdi, montajAdresi, provinceId, districtId, pafta, ada, parsel, yapiSahibi, yapiSahibiAdresi, yapiRuhsati: yapiRuhsatiVar ? "ok" : "" },
    [S_BELGELER]: modulSecim === "G" ? { modulGOnaylanmisKurulus: modulG.nb_id } : {},
    [S_ASANSOR]: { asansorSinifi, makineDairesi, beyanYuku, beyanHizi, baslangicKat, katSayisi, katAdedi, durakAdedi, girisSayisi, imalYili, askiTipi, katKapisi, kapiGenislik, kapiYukseklik, kabinGenislik, kabinDerinlik, kabinAgirligi, asansorSeriNo, seyirMesafesi, ...driveReq },
  };
  function stepMissing(i: number): number {
    if (i === S_EKIPMAN) return equipCards.filter((card) => eqIncomplete(card)).length;
    const fields = stepFieldMap[i];
    if (!fields) return 0;
    return Object.values(fields).filter(empty).length;
  }
  // Adımdaki eksik alanların okunur adları (pop-up için)
  function stepMissingLabels(i: number): string[] {
    if (i === S_EKIPMAN) return equipCards.filter((card) => eqIncomplete(card)).map((c) => c.label);
    const fields = stepFieldMap[i];
    if (!fields) return [];
    return Object.entries(fields).filter(([, v]) => empty(v)).map(([k]) => FIELD_LABELS[k] ?? k);
  }
  function goNext() {
    const alanlar = stepMissingLabels(step);
    if (alanlar.length > 0) {
      setShowErrors(true);
      setError(`Bu adımda ${alanlar.length} zorunlu alan eksik. Lütfen kırmızı ile işaretli alanları doldurun.`);
      setEksikModal({ adim: STEPS[step], alanlar });
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

  const YOK = "__YOK__";
  // Marka dropdown: YOK → marka+model temizlenir (ekipman yok); marka → model sıfırlanır
  function selectBrand(catId: string, value: string) {
    setEquip((e) =>
      value === YOK
        ? { ...e, [catId]: { ...e[catId], brandId: undefined, modelId: undefined } }
        : { ...e, [catId]: { ...e[catId], brandId: value, modelId: undefined } }
    );
  }
  // Model dropdown: YOK → sadece model temizlenir
  function selectModel(catId: string, value: string) {
    setEquip((e) =>
      value === YOK
        ? { ...e, [catId]: { ...e[catId], modelId: undefined } }
        : { ...e, [catId]: { ...e[catId], modelId: value } }
    );
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
  // Kapı kilidi: kat i'nin g. giriş seri no'sunu günceller (tek string olarak "s1 / s2" saklanır)
  function setSeriPartAt(catId: string, floorIdx: number, g: number, v: string) {
    setEquip((e) => {
      const cur = e[catId]?.seriList ? [...e[catId].seriList!] : [];
      const parts = splitSeri(cur[floorIdx], GIRIS);
      parts[g] = v;
      cur[floorIdx] = joinSeri(parts);
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

  async function handleSave(opts?: { gotoBelge?: boolean; silent?: boolean; force?: boolean }): Promise<{ id: string } | null> {
    if (!opts?.force && modulSecim === "G" && !modulG.nb_id) {
      setShowErrors(true);
      setError("Modül G için Onaylanmış Kuruluş seçimi zorunludur.");
      setEksikModal({ adim: STEPS[S_BELGELER], alanlar: ["Onaylanmış Kuruluş (Mod G)"] });
      setStep(S_BELGELER);
      return null;
    }
    if (!opts?.force && !isValid) {
      setShowErrors(true);
      setError(`Kırmızı ile işaretli ${totalMissing} zorunlu alan boş. Lütfen tümünü doldurun.`);
      const alanlar = [
        ...missingText.map((k) => FIELD_LABELS[k] ?? k),
        ...missingEquip.map((c) => c.label),
      ];
      setEksikModal({ adim: "Dosya oluşturma", alanlar });
      if (missingEquip.length > 0 && missingText.length === 0) setStep(S_EKIPMAN);
      else if (missingText.length > 0) setStep(S_FIRMA);
      return null;
    }
    setSaving(true);
    setError(null);
    const equipment = Object.entries(equip)
      .filter(([key, val]) => {
        const card = equipCards.find((c) => c.key === key);
        if (!card || (!val.modelId && !val.brandId)) return false; // ne marka ne model → kaydetme
        if (card.code === "kabin_kilidi" && kabinYok) return false; // Kabin Kapı Kilidi "Yok" → kaydetme
        return true;
      })
      .map(([key, val]) => {
        const card = equipCards.find((c) => c.key === key)!;
        const model = val.modelId ? props.models.find((m) => m.id === val.modelId) : undefined;
        const n = multiCountForCode(card.code);
        // Seri no / sertifika yalnızca model seçiliyse. Marka seçili + model yok → sadece marka kaydedilir.
        let seri_no = val.modelId ? (val.seriNo?.trim() || null) : null;
        let seri_list: string[] | null = null;
        if (val.modelId && n > 0) {
          seri_list = Array.from({ length: n }, (_, i) => (val.seriList?.[i] || "").trim());
          seri_no = seri_list.filter(Boolean).join("; ") || null;
        }
        return { category_id: card.catId, slot: card.slot, brand_id: val.brandId ?? null, model_id: val.modelId ?? null, certificate_id: model?.certificate_id ?? null, seri_no, seri_list };
      });

    // Tescil belgesi için müşteri belgelerinden çözümle (kayıt anında snapshot)
    const cdocs = (props.companyDocuments ?? []).filter((d) => d.company_id === companyId);
    const ssDoc = cdocs.find((d) => d.doc_type === "sanayi_sicil");
    const tseDoc = cdocs.find((d) => d.doc_type === "tse_hyb");
    let modulBelgeNo = "", modulBelgeTarihi = "", modulNbId = "";
    if (modulSecim === "G") { modulBelgeNo = modulG.belge_no; modulBelgeTarihi = modulG.verilis; modulNbId = modulG.nb_id; }
    else {
      const selDocs = modulBelgeIds.map((id) => cdocs.find((d) => d.id === id)).filter(Boolean) as typeof cdocs;
      // Mod H1 ve Tasarım İnceleme birlikte seçiliyse belge numarası Mod H1'den gelir
      const selDoc = selDocs.find((d) => d.doc_type === "ce_h1")
        || selDocs.find((d) => d.doc_type !== "ce_tasarim")
        || selDocs[0];
      if (selDoc) { modulBelgeNo = selDoc.belge_no ?? ""; modulBelgeTarihi = selDoc.issue_date ?? ""; modulNbId = selDoc.notified_body_id ?? ""; }
    }
    const modulNb = props.notifiedBodies.find((n) => n.id === modulNbId);

    // Uygunluk Beyanı: Modül B ve Modül E belgeleri (firma CE belgelerinden)
    const nbInfo = (id?: string | null) => {
      const n = props.notifiedBodies.find((x) => x.id === id);
      return { ad: n?.name ?? "", no: n?.identity_no ?? "", adres: n?.address ?? "" };
    };
    const ceB = cdocs.find((d) => d.doc_type === "ce_b" && modulBelgeIds.includes(d.id)) || cdocs.find((d) => d.doc_type === "ce_b");
    const ceE = cdocs.find((d) => d.doc_type === "ce_e" && modulBelgeIds.includes(d.id)) || cdocs.find((d) => d.doc_type === "ce_e");
    const bNb = nbInfo(ceB?.notified_body_id);
    const eNb = nbInfo(ceE?.notified_body_id);

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
        asansor_sayisi: asansorSayisi ? Number(asansorSayisi) : 1,
        kabin_kilidi_yok: kabinYok,
        imza_makine: imzaMakine, imza_elektrik: imzaElektrik,
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
        faturali, fiyat, teslim_durumu: teslimDurumu, teslim_tarihi: teslimTarihi, teslim_tipi: teslimTipi, proje_no: dosyaNo,
        // Tescil vb. için müşteri belgelerinden çözümlenen değerler
        sanayi_sicil_no: ssDoc?.belge_no ?? "", sanayi_sicil_tarihi: ssDoc?.issue_date ?? "",
        tse_tarihi: tseDoc?.issue_date ?? "", tse_gecerlilik: tseDoc?.valid_until ?? "",
        modul_belge_no: modulBelgeNo, modul_belge_tarihi: modulBelgeTarihi,
        modul_onaylanmis_kurulus: modulNb?.name ?? "", modul_kurulus_no: modulNb?.identity_no ?? "", modul_nb_adres: modulNb?.address ?? "",
        // Uygunluk Beyanı — Modül B / Modül E
        ub_b_belge_no: ceB?.belge_no ?? "", ub_b_nb: bNb.ad, ub_b_nb_no: bNb.no, ub_b_nb_adres: bNb.adres,
        ub_e_belge_no: ceE?.belge_no ?? "", ub_e_nb: eNb.ad, ub_e_nb_no: eNb.no, ub_e_nb_adres: eNb.adres,
      },
      equipment,
    };

    const res = currentId ? await updateDraftProject(currentId, payload) : await saveDraftProject(payload);
    if (!res.ok) { setSaving(false); setError(res.error); return null; }
    if (res.id && !currentId) setCurrentId(res.id); // ilk kayıttan sonra artık güncelle

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

    // Fiyat 0/boş ise ve daha önce muhasebeye düşmüşse, muhasebe kaydını kaldır (teslim edilmemişse)
    if (res.id && fiyatSayi <= 0) { try { await removeProjectFromMuhasebe(res.id); } catch { /* yoksay */ } }
    setSaving(false);
    if (opts?.silent) return res.id ? { id: res.id } : null;
    if (opts?.gotoBelge && res.id) { router.push(`/panel/${res.id}`); return res.id ? { id: res.id } : null; }
    // Düz kayıt: yönlendirme yok, "Başarıyla Kaydedildi" pop-up göster
    setSavedToast(true);
    router.refresh();
    return res.id ? { id: res.id } : null;
  }

  // Fiyatı sayıya çevir ("25.000" → 25000)
  const fiyatSayi = Number(String(fiyat).replace(/\./g, "").replace(/[^\d]/g, "")) || 0;

  // Muhasebeye Gönder: önce projeyi kaydet, sonra takip_projeler muhasebe kaydı oluştur
  async function handleMuhasebe() {
    const saved = await handleSave({ silent: true });
    if (!saved?.id) return; // doğrulama/kayıt hatası zaten gösterildi
    setSaving(true); setError(null);
    const r = await sendProjectToMuhasebe({
      projectId: saved.id,
      fiyat: fiyatSayi,
      fatura_tipi: (faturali === "faturali" ? "faturali" : "faturasiz"),
      teslim_tipi: (teslimTipi === "hard_copy" ? "hard_copy" : "dijital"),
    });
    setSaving(false);
    if (!r.ok) { setError(r.error ?? "Muhasebeye gönderilemedi."); return; }
    setSavedToast(true); router.refresh();
  }

  // "Başarıyla Kaydedildi" pop-up otomatik kapansın
  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(false), 2600);
    return () => clearTimeout(t);
  }, [savedToast]);

  // Full TD Oluştur öncesi: eksik bilgi + yüklenmeyen evrak + süresi geçmiş evrak uyarıları
  function openFullTdUyari() {
    const bugun = new Date().toISOString().slice(0, 10);
    const eksik = [
      ...missingText.map((k) => FIELD_LABELS[k] ?? k),
      ...missingEquip.map((c) => c.label),
    ];
    const cdocs = (props.companyDocuments ?? []).filter((d) => d.company_id === companyId);
    const has = (t: string) => cdocs.some((d) => d.doc_type === t);
    const evrak: string[] = [];
    if (!yapiRuhsatiVar) evrak.push("Yapı Ruhsatı");
    if (!has("imza_sirkuleri")) evrak.push("İmza Sirküleri (firma)");
    if (!has("sanayi_sicil")) evrak.push("Sanayi Sicil Belgesi (firma)");
    if (!has("tse_hyb")) evrak.push("TSE HYB Belgesi (firma)");
    if (modulSecim === "G") { if (!(pending["modul_g_belge"]?.length || existingFiles.some((f) => f.kind === "modul_g_belge"))) evrak.push("Modül G Belgesi"); }
    else if (modulBelgeIds.length === 0) evrak.push("CE / Modül belgesi (Belgeler adımında seçilmedi)");
    const suresi: string[] = [];
    const expired = (vu: string | null | undefined) => !!vu && String(vu).slice(0, 10) < bugun;
    // Firma belgeleri
    for (const d of cdocs) {
      if (expired(d.valid_until)) suresi.push(`${DOC_AD[d.doc_type] ?? d.doc_type} (firma) — geçerlilik ${String(d.valid_until).slice(0, 10)}`);
    }
    // Mühendis belgeleri (seçili makine/elektrik müellifleri)
    const selEng = [makineMuhId, elektrikMuhId].filter(Boolean);
    const engName = (id: string) => props.engineers.find((e) => e.id === id)?.full_name ?? "Mühendis";
    for (const ed of (props.engineerDocuments ?? [])) {
      if (!selEng.includes(ed.engineer_id)) continue;
      if (expired(ed.valid_until)) suresi.push(`${engName(ed.engineer_id)} — ${DOC_AD[ed.doc_type] ?? ed.doc_type} (geçerlilik ${String(ed.valid_until).slice(0, 10)})`);
    }
    setFullTdUyari({ eksik, evrak, suresi });
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
      {belgeModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setBelgeModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold text-sm">Belge Önizleme</h2>
              <div className="flex items-center gap-3">
                <a href={`/api/belge/musteri?id=${belgeModal}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
                  <span className="material-symbols-rounded text-[16px]">open_in_new</span>Yeni sekmede aç
                </a>
                <button onClick={() => setBelgeModal(null)} className="material-symbols-rounded text-slate-400 hover:text-slate-700">close</button>
              </div>
            </div>
            <iframe src={`/api/belge/musteri?id=${belgeModal}`} className="flex-1 w-full rounded-b-2xl" title="Belge" />
          </div>
        </div>
      )}
      {eksikModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setEksikModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 px-6 pt-6">
              <span className="material-symbols-rounded text-[28px] text-red-500">error</span>
              <div>
                <h2 className="font-extrabold text-lg leading-tight">Eksik zorunlu alanlar</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  <b>{eksikModal.adim}</b> adımında {eksikModal.alanlar.length} alan/belge eksik. Devam etmeden önce tamamlayın.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 max-h-[45vh] overflow-auto">
              <ul className="space-y-1.5">
                {eksikModal.alanlar.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="material-symbols-rounded text-[16px] text-red-400">close</span>{a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button onClick={() => setEksikModal(null)} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">Tamam</button>
            </div>
          </div>
        </div>
      )}
      {savedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[80] bg-green-600 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg inline-flex items-center gap-2">
          <span className="material-symbols-rounded text-[20px]">check_circle</span> Başarıyla Kaydedildi
        </div>
      )}
      {fullTdUyari && (
        <div className="fixed inset-0 z-[65] bg-black/40 flex items-center justify-center p-4" onClick={() => setFullTdUyari(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 px-6 pt-6">
              <span className="material-symbols-rounded text-[28px] text-amber-500">warning</span>
              <div>
                <h2 className="font-extrabold text-lg leading-tight">Full TD oluşturulmadan önce</h2>
                <p className="text-sm text-slate-500 mt-0.5">Aşağıdaki eksikler tespit edildi. Yine de devam edebilirsiniz.</p>
              </div>
            </div>
            <div className="px-6 py-4 max-h-[55vh] overflow-auto space-y-3">
              {fullTdUyari.eksik.length === 0 && fullTdUyari.evrak.length === 0 && fullTdUyari.suresi.length === 0 && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">Eksik bilgi veya evrak yok.</div>
              )}
              {fullTdUyari.eksik.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Eksik Bilgi ({fullTdUyari.eksik.length})</div>
                  <ul className="space-y-1">{fullTdUyari.eksik.map((a, i) => <li key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="material-symbols-rounded text-[16px] text-red-400">close</span>{a}</li>)}</ul>
                </div>
              )}
              {fullTdUyari.evrak.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Yüklenmeyen Evrak ({fullTdUyari.evrak.length})</div>
                  <ul className="space-y-1">{fullTdUyari.evrak.map((a, i) => <li key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="material-symbols-rounded text-[16px] text-amber-500">upload_file</span>{a}</li>)}</ul>
                </div>
              )}
              {fullTdUyari.suresi.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Süresi Geçmiş Evrak ({fullTdUyari.suresi.length})</div>
                  <ul className="space-y-1">{fullTdUyari.suresi.map((a, i) => <li key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="material-symbols-rounded text-[16px] text-red-500">event_busy</span>{a}</li>)}</ul>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button onClick={() => setFullTdUyari(null)} className="text-sm font-semibold text-slate-500 px-4 py-2.5">Vazgeç</button>
              <button onClick={() => { setFullTdUyari(null); handleSave({ gotoBelge: true, force: true }); }} className="gs-btn text-sm font-bold px-5 py-2.5 rounded-xl">Yine de Devam Et</button>
            </div>
          </div>
        </div>
      )}
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
                <Field label="Proje No *"><input className={"inp" + ec(dosyaNo)} value={dosyaNo} onChange={(e) => setDosyaNo(e.target.value)} placeholder="Proje No" /></Field>
                <Field label="Tarih *"><input type="date" className={"inp" + ec(dosyaTarihi)} value={dosyaTarihi} onChange={(e) => setDosyaTarihi(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Makine Mühendisi (Proje Müellifi) *">
                  <select className={"inp" + ec(makineMuhId)} value={makineMuhId} onChange={(e) => setMakineMuhId(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {makineOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.chamber_reg_no ? ` · ${m.chamber_reg_no}` : ""}</option>)}
                  </select>
                  {makineMuhId && <MuhImza engineerId={makineMuhId} imzaDocId={props.engineers.find((e) => e.id === makineMuhId)?.imzaDocId} checked={imzaMakine} onToggle={setImzaMakine} />}
                </Field>
                <Field label="Elektrik Mühendisi (Proje Müellifi) *">
                  <select className={"inp" + ec(elektrikMuhId)} value={elektrikMuhId} onChange={(e) => setElektrikMuhId(e.target.value)}>
                    <option value="">Seçiniz…</option>
                    {elektrikOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.chamber_reg_no ? ` · ${m.chamber_reg_no}` : ""}</option>)}
                  </select>
                  {elektrikMuhId && <MuhImza engineerId={elektrikMuhId} imzaDocId={props.engineers.find((e) => e.id === elektrikMuhId)?.imzaDocId} checked={imzaElektrik} onToggle={setImzaElektrik} />}
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
              <div className={showErrors && !yapiRuhsatiVar ? "rounded-xl border border-red-300 bg-red-50/40 p-2" : ""}>
                <FileZone label="Yapı Ruhsatı Ekle *" accept="application/pdf,image/*"
                  staged={pending["yapi_ruhsati"] ?? []} existing={existingFiles.filter((f) => f.kind === "yapi_ruhsati")}
                  onAdd={(l) => addFiles("yapi_ruhsati", l)} onRemoveStaged={(i) => removeStaged("yapi_ruhsati", i)} onDelete={silExisting} />
                {showErrors && !yapiRuhsatiVar && <p className="text-[11px] text-red-600 mt-1">Yapı ruhsatı dosyası zorunludur.</p>}
              </div>
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
                    const docs = (props.companyDocuments ?? [])
                      .filter((d) => d.company_id === companyId && d.doc_type.startsWith("ce"))
                      .sort((a, b) => (CE_ORDER[a.doc_type] ?? 9) - (CE_ORDER[b.doc_type] ?? 9));
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
                              <span className="flex-1 min-w-0">
                                <span className="text-sm text-slate-800">{COMPANY_DOC_ETIKET[d.doc_type] ?? d.doc_type}</span>
                                {d.original_name && <span className="ml-2 text-xs text-slate-400">({d.original_name})</span>}
                              </span>
                              {d.original_name && (
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBelgeModal(d.id); }}
                                  className="flex-none text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
                                  <span className="material-symbols-rounded text-[15px]">description</span>Belgeyi Aç
                                </button>
                              )}
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
                    <Field label="Onaylanmış Kuruluş *">
                      <select className={"inp" + ec(modulG.nb_id)} value={modulG.nb_id} onChange={(e) => setModulG({ ...modulG, nb_id: e.target.value })}>
                        <option value="">Seçiniz…</option>
                        {props.notifiedBodies.filter((n) => n.identity_no).map((n) => <option key={n.id} value={n.id}>{n.identity_no} · {n.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Veriliş Tarihi"><input type="date" className="inp" value={modulG.verilis} onChange={(e) => setModulG({ ...modulG, verilis: e.target.value })} /></Field>
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
                    {beyanYukuOptions.map((w) => <option key={w} value={w}>{w}</option>)}
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
                <Field label="Asansör Sayısı *">
                  <select className="inp" value={asansorSayisi} onChange={(e) => setAsansorSayisi(e.target.value)}>
                    {RANGE_10.map((n) => <option key={n} value={n}>{n}</option>)}
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
                    <Field label="Ünite / Motor Seri No *"><input className={"inp" + ec(uniteBilgisi)} value={uniteBilgisi} onChange={(e) => setUniteBilgisi(e.target.value)} placeholder="Seri no" /></Field>
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
            <Section title="Kritik ekipmanlar" desc="Marka ve modeli açılır listeden seçin. İlgili ekipman yoksa 'YOK' seçin.">
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
                  const kabinKilidi = cat.code === "kabin_kilidi";
                  const gizli = kabinKilidi && kabinYok; // Kabin Kapı Kilidi "Yok" → seçim alanları gizli
                  return (
                    <div key={cat.key} className={`bg-white border rounded-xl p-4 ${eksik ? "border-red-400 bg-red-50/40" : "border-slate-200"}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-bold">{cat.label}{!gizli && <span className="text-red-500"> *</span>}</div>
                        {kabinKilidi && (
                          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold shrink-0">
                            <button type="button" onClick={() => setKabinYok(false)}
                              className={`px-4 py-1.5 ${!kabinYok ? "text-white" : "bg-white text-slate-600 hover:text-brand"}`}
                              style={!kabinYok ? { background: "linear-gradient(135deg,#1e2a5b,#33478a)" } : undefined}>Var</button>
                            <button type="button" onClick={() => setKabinYok(true)}
                              className={`px-4 py-1.5 border-l border-slate-200 ${kabinYok ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:text-slate-800"}`}>Yok</button>
                          </div>
                        )}
                      </div>
                      {gizli ? (
                        <div className="text-xs text-slate-500 italic">Bu ekipman &quot;Yok&quot; olarak işaretlendi; Teknik Komponent Listesinde gösterilmez.</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Marka</div>
                            <select value={sel.brandId ?? YOK} onChange={(e) => selectBrand(cat.key, e.target.value)}
                              className={"inp" + (showErrors && eksik && !sel.brandId ? " !border-red-300 !bg-red-50" : "")}>
                              <option value={YOK}>YOK</option>
                              {catBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Model</div>
                            <select value={sel.modelId ?? YOK} onChange={(e) => selectModel(cat.key, e.target.value)}
                              disabled={!sel.brandId}
                              className={"inp disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" + (showErrors && eksik && sel.brandId && !sel.modelId ? " !border-red-300 !bg-red-50" : "")}>
                              <option value={YOK}>YOK</option>
                              {catModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                      {!gizli && cert && (
                        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">Sertifika No</span><span className="font-semibold">{cert.cert_no}</span></div>
                          {nb && <div className="flex justify-between mt-1"><span className="text-slate-500">Onaylanmış Kuruluş</span><span className="font-semibold">{nb.identity_no} · {nb.name}</span></div>}
                        </div>
                      )}
                      {!gizli && sel.modelId && multiCfg && multiN > 0 && (
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Seri No — her {multiCfg.label.toLocaleLowerCase("tr")} için ayrı ({multiN} adet) *
                          </label>
                          {cat.code === "kapi_kilidi" && GIRIS > 1 && (
                            <p className="text-[11px] text-slate-500 mb-1.5">
                              Giriş sayısı {GIRIS} olduğu için her kat için {GIRIS} adet seri no giriniz.
                            </p>
                          )}
                          <div className="space-y-2">
                            {Array.from({ length: multiN }).map((_, i) => {
                              const pasif = isPasifSeri(cat.code, i);
                              const parts = cat.code === "kapi_kilidi" ? splitSeri(sel.seriList?.[i], GIRIS) : [];
                              return (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="w-24 shrink-0 text-xs font-semibold text-slate-600">{seriEtiket(cat.code, i)}</span>
                                  {pasif ? (
                                    <input value="Giriş yapılamaz" disabled
                                      className="inp !bg-slate-100 !text-slate-400 !border-slate-200 cursor-not-allowed italic" />
                                  ) : cat.code === "kapi_kilidi" ? (
                                    <div className="flex flex-1 gap-2">
                                      {parts.map((pv, g) => (
                                        <input
                                          key={g}
                                          value={pv}
                                          onChange={(e) => setSeriPartAt(cat.key, i, g, e.target.value)}
                                          placeholder={GIRIS > 1 ? `Giriş ${g + 1} seri no` : "Seri no"}
                                          className={"inp flex-1" + (showErrors && !pv.trim() ? " !border-red-300 !bg-red-50" : "")}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <input
                                      value={sel.seriList?.[i] ?? ""}
                                      onChange={(e) => setSeriAt(cat.key, i, e.target.value)}
                                      placeholder="Seri no"
                                      className={"inp" + (showErrors && !(sel.seriList?.[i] ?? "").trim() ? " !border-red-300 !bg-red-50" : "")}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {!gizli && sel.modelId && multiCfg && multiN === 0 && (
                        <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Seri no kutuları için önce Asansör adımında {multiCfg.count === "durak" ? "durak" : "giriş"} sayısını girin.
                        </div>
                      )}
                      {!gizli && sel.modelId && !multiCfg && (
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
                  <button type="button" disabled={saving} onClick={openFullTdUyari}
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

              {/* Dosya Tamamlama */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Dosya Tamamlama</div>
                {muhasebeKilit && (
                  <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-[16px]">lock</span>
                    Muhasebe tarafından teslim edildi — fiyat, fatura durumu ve teslim tipi değiştirilemez.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Fiyat (TL)">
                    <input className="inp disabled:bg-slate-100 disabled:text-slate-500" disabled={muhasebeKilit} value={fiyat} onChange={(e) => setFiyat(formatThousands(e.target.value))} placeholder="Örn. 25.000" inputMode="numeric" />
                    <p className="text-[11px] text-amber-600 font-semibold mt-1">KDV HARİÇ GİRİNİZ</p>
                  </Field>
                  <Field label="Fatura Durumu">
                    <select className="inp disabled:bg-slate-100 disabled:text-slate-500" disabled={muhasebeKilit} value={faturali} onChange={(e) => setFaturali(e.target.value)}>
                      <option value="faturali">Faturalı</option>
                      <option value="faturasiz">Faturasız</option>
                    </select>
                    {faturali === "faturali" && <p className="text-[11px] text-slate-500 mt-1">%20 KDV eklenir</p>}
                  </Field>
                  <Field label="Teslim Tipi">
                    <select className="inp disabled:bg-slate-100 disabled:text-slate-500" disabled={muhasebeKilit} value={teslimTipi} onChange={(e) => setTeslimTipi(e.target.value)}>
                      <option value="hard_copy">Hard Copy</option>
                      <option value="dijital">Dijital</option>
                    </select>
                  </Field>
                </div>
                {fiyatSayi > 0 && faturali === "faturali" && (
                  <div className="text-xs text-slate-500">Toplam (KDV dahil): <b>{formatThousands(String(Math.round(fiyatSayi * 1.2)))} TL</b></div>
                )}
                {!muhasebeKilit && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {fiyatSayi > 0 ? (
                      <>
                        <button type="button" disabled={saving} onClick={handleMuhasebe}
                          className="gs-btn text-sm font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50">
                          <span className="material-symbols-rounded text-[18px]">send</span> Muhasebeye Gönder
                        </button>
                        <button type="button" disabled={saving} onClick={() => handleSave()}
                          className="text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 disabled:opacity-50">
                          <span className="material-symbols-rounded text-[18px]">save</span> Kaydet
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={saving} onClick={() => handleSave()}
                        className="gs-btn text-sm font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50">
                        <span className="material-symbols-rounded text-[18px]">check</span> Tamamla ve Kaydet
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-slate-400">Fiyat 0 veya boşsa kayıt muhasebeye düşmez; yalnızca dosya kaydedilir.</p>
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
// Seçili mühendisin imzası: yüklüyse otomatik göster, yoksa jpeg/png yüklemeye izin ver
function MuhImza({ engineerId, imzaDocId, checked, onToggle }: { engineerId: string; imzaDocId?: string | null; checked?: boolean; onToggle?: (v: boolean) => void }) {
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <img src={`/api/belge/muhendis?id=${imzaDocId}`} alt="İmza" className="h-10 max-w-[140px] object-contain border border-slate-100 rounded bg-white p-0.5" />
            <span className="text-[11px] text-green-600 font-semibold inline-flex items-center gap-0.5"><span className="material-symbols-rounded text-[14px]">check_circle</span>İmza yüklü</span>
          </div>
          {onToggle && (
            <label className="text-[11px] text-slate-600 inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={!!checked} onChange={(e) => onToggle(e.target.checked)} className="accent-brand" />
              Taahhütnameye imza ekle
            </label>
          )}
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
