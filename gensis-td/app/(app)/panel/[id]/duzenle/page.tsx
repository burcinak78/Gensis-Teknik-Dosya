import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api/server";
import DataEntryWizard, { type InitialData } from "../../../yeni/DataEntryWizard";
import { loadWizardReference } from "../../../yeni/reference";

export const dynamic = "force-dynamic";

const s = (v: any) => (v == null ? "" : String(v));

type ProjectApi = {
  id: string; companyId: string; dosyaNo: string; dosyaTarihi: string | null; tdNo: string | null; binaAdi: string | null;
  montajAdresi: string | null; provinceId: number | null; districtId: string | null; elektrikMuhendisId: string | null;
  makineMuhendisId: string | null; beyanYukuKg: number | null; kisiSayisi: number | null; beyanHizi: number | null;
  katAdedi: number | null; durakAdedi: number | null; imalYili: number | null; inputData: Record<string, any>;
};
type EquipmentApi = { categoryId: string; slot: string; brandId: string | null; modelId: string | null; seriNo: string | null; seriList: unknown };

export default async function DuzenlePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const pid = encodeURIComponent(params.id);

  const [ref, p, equipRows, files, muhasebe] = await Promise.all([
    loadWizardReference(),
    apiGet<ProjectApi>(`/api/projects/${pid}`),
    apiGet<EquipmentApi[]>(`/api/projects/${pid}/equipment`),
    apiGet<{ id: string; kind: string; originalName: string | null }[]>(`/api/projects/${pid}/files`),
    // Muhasebe teslim edildi mi (cariye işlendi) → Dosya Tamamlama kilitli
    apiGet<{ sent: boolean; posted: boolean }>(`/api/projects/${pid}/muhasebe`),
  ]);
  if (!p) notFound();

  // Aşağıdaki eşleme Supabase satır adlarını (snake_case) kullanıyor.
  const project = {
    id: p.id, company_id: p.companyId, dosya_no: p.dosyaNo, dosya_tarihi: p.dosyaTarihi, td_no: p.tdNo, bina_adi: p.binaAdi,
    montaj_adresi: p.montajAdresi, province_id: p.provinceId, district_id: p.districtId,
    elektrik_muhendis_id: p.elektrikMuhendisId, makine_muhendis_id: p.makineMuhendisId,
    beyan_yuku_kg: p.beyanYukuKg, kisi_sayisi: p.kisiSayisi, beyan_hizi: p.beyanHizi, kat_adedi: p.katAdedi,
    durak_adedi: p.durakAdedi, imal_yili: p.imalYili, input_data: p.inputData,
  };

  // Seçili ile ait ilçeleri önden yükle (select için)
  const districts = project.province_id != null
    ? (await apiGet<{ id: string; name: string }[]>(`/api/catalog/provinces/${project.province_id}/districts`)) ?? []
    : [];

  const inp = (project.input_data ?? {}) as Record<string, any>;
  const muhasebeKilit = muhasebe?.posted === true;

  // Ekipmanları wizard formatına çevir (kategori başına tek slot)
  // anahtar: "<kategoriId>|<slot>" (tampon kabin/agirlik ayrımı için)
  const equip: InitialData["equip"] = {};
  for (const e of equipRows ?? []) {
    equip[`${e.categoryId}|${e.slot || "main"}`] = {
      brandId: e.brandId ?? undefined,
      modelId: e.modelId ?? undefined,
      seriNo: e.seriNo ?? undefined,
      seriList: Array.isArray(e.seriList) ? e.seriList.map((x: any) => (x == null ? "" : String(x))) : undefined,
    };
  }

  const initial: InitialData = {
    id: project.id,
    companyId: project.company_id ?? "",
    dosyaNo: project.dosya_no ?? "",
    dosyaTarihi: project.dosya_tarihi ? String(project.dosya_tarihi).slice(0, 10) : new Date().toISOString().slice(0, 10),
    binaAdi: project.bina_adi ?? "",
    montajAdresi: project.montaj_adresi ?? inp.montaj_adresi ?? "",
    provinceId: project.province_id ?? "",
    districtId: s(project.district_id),
    ilgiliIdare: s(inp.ilgili_idare),
    districts,
    beyanYuku: project.beyan_yuku_kg ?? "",
    beyanHizi: s(project.beyan_hizi),
    katAdedi: s(project.kat_adedi),
    durakAdedi: s(project.durak_adedi),
    girisSayisi: s(inp.giris_sayisi),
    asansorSayisi: s(inp.asansor_sayisi) || "1",
    tamponKabinSayisi: s(inp.tampon_kabin_sayisi) || "1",
    tamponAgirlikSayisi: s(inp.tampon_agirlik_sayisi) || "1",
    kabinYok: inp.kabin_kilidi_yok === true,
    imzaMakine: inp.imza_makine === true,
    imzaElektrik: inp.imza_elektrik === true,
    imalYili: s(project.imal_yili),
    askiTipi: inp.aski_tipi ?? "",
    katKapisi: inp.kat_kapisi ?? "",
    pafta: inp.pafta ?? "",
    ada: inp.ada ?? "",
    parsel: inp.parsel ?? "",
    yapiSahibi: inp.yapi_sahibi ?? "",
    yapiSahibiAdresi: inp.yapi_sahibi_adresi ?? "",
    asansorSeriNo: inp.asansor_seri_no ?? "",
    asansorKimlikNo: inp.asansor_kimlik_no ?? "",
    seyirMesafesi: s(inp.seyir_mesafesi),
    motorGucu: s(inp.motor_gucu),
    asansorTipi: inp.asansor_tipi === "hidrolik" ? "hidrolik" : "elektrik",
    pistonOlculeri: s(inp.piston_olculeri),
    pistonYeri: inp.piston_yeri ?? "",
    debi: s(inp.debi),
    uniteBilgisi: s(inp.unite_bilgisi),
    asansorSinifi: s(inp.asansor_sinifi),
    kapiGenislik: s(inp.kapi_genislik),
    kapiYukseklik: s(inp.kapi_yukseklik),
    kabinGenislik: s(inp.kabin_genislik),
    kabinDerinlik: s(inp.kabin_derinlik),
    kabinAgirligi: s(inp.kabin_agirligi),
    karsiAgirlikYeri: s(inp.karsi_agirlik_yeri),
    motorMarka: s(inp.motor_marka),
    makineDairesi: s(inp.makine_dairesi),
    katSayisi: s(inp.kat_sayisi) || s(project.kat_adedi),
    baslangicKat: s(inp.baslangic_kat) || "Z",
    araKatlar: Array.isArray(inp.ara_katlar) ? inp.ara_katlar : [],
    // Belgeler + Dosya İşlemleri (Faz 1 metadata)
    modulSecim: s(inp.modul_secim),
    modulBelgeIds: Array.isArray(inp.modul_belge_ids) ? inp.modul_belge_ids : [],
    modulG: inp.modul_g && typeof inp.modul_g === "object"
      ? { belge_no: s(inp.modul_g.belge_no), verilis: s(inp.modul_g.verilis), gecerlilik: s(inp.modul_g.gecerlilik), nb_id: s(inp.modul_g.nb_id) }
      : { belge_no: "", verilis: "", gecerlilik: "", nb_id: "" },
    faturaNo: s(inp.fatura_no),
    faturaTarihi: s(inp.fatura_tarihi),
    periyodikTarihi: s(inp.periyodik_tarihi),
    faturali: s(inp.faturali) || "faturasiz",
    teslimTipi: s(inp.teslim_tipi) || "dijital",
    muhasebeKilit,
    fiyat: s(inp.fiyat),
    teslimDurumu: s(inp.teslim_durumu) || "taslak",
    teslimTarihi: s(inp.teslim_tarihi),
    files: (files ?? []).map((f) => ({ id: f.id, kind: f.kind, original_name: f.originalName })),
    makineMuhId: project.makine_muhendis_id ?? "",
    elektrikMuhId: project.elektrik_muhendis_id ?? "",
    equip,
  };

  return <DataEntryWizard {...ref} initial={initial} />;
}
