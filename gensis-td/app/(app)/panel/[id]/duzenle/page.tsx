import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DataEntryWizard, { type InitialData } from "../../../yeni/DataEntryWizard";

export const dynamic = "force-dynamic";

const s = (v: any) => (v == null ? "" : String(v));

export default async function DuzenlePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [
    companies,
    categories,
    brands,
    models,
    certificates,
    notifiedBodies,
    provinces,
    capacity,
    lookups,
    engineers,
    companyDocsRes,
    projectRes,
    equipRes,
    filesRes,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, short_name, legal_name, address, phone, fax, city, authorized_person, registered_brand, industry_reg_no")
      .order("short_name"),
    supabase.from("equipment_categories").select("id, code, name, sort_order, drive_type").order("sort_order"),
    supabase.from("equipment_brands").select("id, category_id, name").order("name"),
    supabase.from("equipment_models").select("id, brand_id, name, certificate_id").order("name"),
    supabase.from("certificates").select("id, cert_no, notified_body_id"),
    supabase.from("notified_bodies").select("id, identity_no, name"),
    supabase.from("provinces").select("id, name").order("name"),
    supabase
      .from("capacity_table")
      .select("beyan_yuku_kg, kisi_sayisi, kabin_agirlik_kg, karsi_agirlik_kg")
      .order("beyan_yuku_kg"),
    supabase.from("lookup_values").select("list_key, value, sort_order").order("sort_order"),
    supabase.from("engineers").select("id, full_name, discipline, chamber_reg_no, company_id").order("full_name").limit(2000),
    supabase.from("company_documents").select("id, company_id, doc_type, belge_no, valid_until").limit(5000),
    supabase.from("projects").select("*").eq("id", params.id).single(),
    supabase
      .from("project_equipment")
      .select("category_id, slot, brand_id, model_id, seri_no, seri_list")
      .eq("project_id", params.id),
    supabase.from("project_files").select("id, kind, original_name").eq("project_id", params.id).order("uploaded_at"),
  ]);

  const project = projectRes.data as any;
  if (!project) notFound();

  // Seçili ile ait ilçeleri önden yükle (select için)
  let districts: { id: string; name: string }[] = [];
  if (project.province_id != null) {
    const { data } = await supabase
      .from("districts")
      .select("id, name")
      .eq("province_id", project.province_id)
      .order("name")
      .limit(2000);
    districts = data ?? [];
  }

  const inp = (project.input_data ?? {}) as Record<string, any>;

  // Ekipmanları wizard formatına çevir (kategori başına tek slot)
  // anahtar: "<kategoriId>|<slot>" (tampon kabin/agirlik ayrımı için)
  const equip: InitialData["equip"] = {};
  for (const e of (equipRes.data ?? []) as any[]) {
    equip[`${e.category_id}|${e.slot || "main"}`] = {
      brandId: e.brand_id ?? undefined,
      modelId: e.model_id ?? undefined,
      seriNo: e.seri_no ?? undefined,
      seriList: Array.isArray(e.seri_list) ? e.seri_list.map((x: any) => (x == null ? "" : String(x))) : undefined,
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
    districts,
    beyanYuku: project.beyan_yuku_kg ?? "",
    beyanHizi: s(project.beyan_hizi),
    katAdedi: s(project.kat_adedi),
    durakAdedi: s(project.durak_adedi),
    girisSayisi: s(inp.giris_sayisi),
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
    faturali: s(inp.faturali),
    fiyat: s(inp.fiyat),
    teslimDurumu: s(inp.teslim_durumu) || "taslak",
    teslimTarihi: s(inp.teslim_tarihi),
    files: (filesRes.data ?? []) as any,
    makineMuhId: project.makine_muhendis_id ?? "",
    elektrikMuhId: project.elektrik_muhendis_id ?? "",
    equip,
  };

  const companyList = companies.data ?? [];
  const gensis = companyList.find((c) => (c.short_name ?? "").toLocaleLowerCase("tr").includes("gensis"));

  return (
    <DataEntryWizard
      companies={companyList}
      categories={categories.data ?? []}
      brands={brands.data ?? []}
      models={models.data ?? []}
      certificates={certificates.data ?? []}
      notifiedBodies={notifiedBodies.data ?? []}
      provinces={provinces.data ?? []}
      capacity={capacity.data ?? []}
      lookups={lookups.data ?? []}
      engineers={engineers.data ?? []}
      gensisCompanyId={gensis?.id ?? null}
      companyDocuments={companyDocsRes.data ?? []}
      initial={initial}
    />
  );
}
