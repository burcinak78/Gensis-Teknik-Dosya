import { NextRequest } from "next/server";
import React from "react";
import { renderPdf, withPdfBusy } from "@/lib/pdf/render";
import { PUBLIC_DIR, readAsset } from "@/lib/pdf/assets";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { apiFetch } from "@/lib/api/server";
import { TeknikDosyaDoc } from "@/lib/pdf/TeknikDosyaDoc";
import { TEKNIK_DOSYA_BELGELERI } from "@/lib/pdf/belgeler";
import { imzaToPngDataUri } from "@/lib/pdf/imzaUri";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rows from GET /api/projects/{id}/pdf-source (access-checked by the API).
type PdfSource = {
  context: any;
  project: { makineMuhendisId: string | null; elektrikMuhendisId: string | null; companyId: string; inputData: Record<string, any>; binaAdi: string | null; tdNo: string | null };
  company: { phone: string | null; mobilePhone: string | null; email: string | null } | null;
  projectFiles: { kind: string; path: string; sortOrder: number }[];
  engineerDocs: { engineerId: string; docType: string; path: string }[];
  companyDocs: { id: string; docType: string; path: string | null; belgeNo: string | null; issueDate: string | null; notifiedBodyId: string | null }[];
  notifiedBodies: { id: string; name: string; shortName: string | null; identityNo: string | null; address: string | null }[];
  equipmentCategories: { code: string; name: string; driveType: string }[];
  equipment: { slot: string; categoryCode: string; brandName: string | null; certificateId: string | null; seriList: unknown }[];
  certificateFiles: { certificateId: string; path: string }[];
};

async function handleGet(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return new Response("projectId gerekli.", { status: 400 });

  // Oturum ve erişim kontrolü API'de: görünmeyen proje 404.
  const srcRes = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/pdf-source`);
  if (srcRes.status === 401) return new Response("Yetkisiz.", { status: 401 });
  if (srcRes.status === 404) return new Response("Proje bulunamadı veya yetkiniz yok.", { status: 404 });
  if (!srcRes.ok) return new Response("Veri alınamadı.", { status: 500 });
  const src = (await srcRes.json()) as PdfSource;
  const ctx: any = src.context;

  // Fonts, CE mark and ready-made PDFs come from public/ on disk.
  const assetBase = PUBLIC_DIR;

  const belgeler = req.nextUrl.searchParams.getAll("belge");
  const dl = req.nextUrl.searchParams.get("dl") === "1";
  const only = belgeler.length === 0 ? undefined : belgeler;
  const codes = TEKNIK_DOSYA_BELGELERI
    .filter((b) => b.hazir && (!only || only.includes(b.code)))
    .map((b) => b.code);

  // Kullanma ve Bakım Kılavuzu: asansör tipi + askı tipine göre hazır PDF
  const cIsHid = ctx?.asansor_tipi === "hidrolik";
  const cAski = String(ctx?.aski_tipi || "");
  const kilavuzFile = cIsHid ? "KBT_H.pdf" : (cAski.startsWith("1/1") ? "KBT_E_1-1.pdf" : "KBT_E_1-2.pdf");

  // Ek dosyalar API üzerinden; yalnızca bu projeye ait olanlar verilir.
  async function download(bucket: string, path: string): Promise<Uint8Array | null> {
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId!)}/pdf-source/file?bucket=${bucket}&path=${encodeURIComponent(path)}`);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch { return null; }
  }

  // ---------- Yüklenmiş ekleri topla (hata olursa eksiz üret) ----------
  let attach: {
    isG: boolean;
    pf: Record<string, string[]>;
    engMakine: string[]; engElektrik: string[];
    coImza: string[]; coSanayi: string[]; coTse: string[]; coCe: string[]; coCeSelected: string[];
    motorCerts: string[]; otherCerts: string[];
  } = { isG: false, pf: {}, engMakine: [], engElektrik: [], coImza: [], coSanayi: [], coTse: [], coCe: [], coCeSelected: [], motorCerts: [], otherCerts: [] };
  // Müşteri logosu (varsa header'da kısa ad yerine kullanılır)
  let logoBytes: Uint8Array | null = null;
  let logoMime = "image/png";
  try {
    const prow = src.project;
    // Kapakta Dosya No karşısına TD No
    if (prow.tdNo != null) ctx.td_no = prow.tdNo;
    const inp = (prow.inputData ?? {}) as Record<string, any>;
    // Son Kontrol Formu bilgi tablosu için veriler (montaj adresi + input_data)
    ctx.__sk = {
      montaj_adresi: ctx.montaj_adresi || inp.montaj_adresi || null,
      ada: inp.ada ?? null, pafta: inp.pafta ?? null, parsel: inp.parsel ?? null,
      asansor_seri_no: inp.asansor_seri_no ?? null,
    };
    // Kapakta Bina Adı — render context'te yoksa projects tablosundan tamamla
    if (prow.binaAdi && !ctx.bina_adi) ctx.bina_adi = prow.binaAdi;
    attach.isG = inp.modul_secim === "G";
    // Firma Bilgileri: Telefon/E-posta render context'te boşsa companies tablosundan tamamla
    const crow = src.company;
    if (crow) {
      ctx.firma = ctx.firma || {};
      if (!ctx.firma.telefon) ctx.firma.telefon = crow.phone || crow.mobilePhone || null;
      if (!ctx.firma.email) ctx.firma.email = crow.email || null;
    }
    // Müşteri logosu (company_documents doc_type=logo) → header'da kısa ad yerine
    try {
      const logoPath = src.companyDocs.find((d) => d.docType === "logo" && d.path)?.path;
      if (logoPath) {
        const bytes = await download("documents", logoPath);
        if (bytes) {
          logoBytes = bytes;
          const ext = (logoPath.split(".").pop() || "").toLowerCase();
          logoMime = ext === "png" ? "image/png" : "image/jpeg";
          ctx.firma = ctx.firma || {};
          ctx.firma.logo = `data:${logoMime};base64,${Buffer.from(logoBytes).toString("base64")}`;
        }
      }
    } catch { /* logo alınamazsa kısa ad kalır */ }

    for (const f of src.projectFiles) {
      if (!f.path) continue;
      (attach.pf[f.kind] ||= []).push(f.path);
    }

    let imzaMakinePath: string | undefined, imzaElektrikPath: string | undefined;
    for (const d of src.engineerDocs) {
      // İmza (doc_type=imza) ayrı sayfa olarak eklenmez; Taahhütname'ye gömülür (seçiliyse).
      if (d.docType === "imza") {
        if (d.engineerId === prow.makineMuhendisId) imzaMakinePath = d.path;
        if (d.engineerId === prow.elektrikMuhendisId) imzaElektrikPath = d.path;
        continue;
      }
      if (d.engineerId === prow.makineMuhendisId) attach.engMakine.push(d.path);
      if (d.engineerId === prow.elektrikMuhendisId) attach.engElektrik.push(d.path);
    }
    // Taahhütname imzası: kullanıcı "İmza ekle" seçtiyse imzayı temiz PNG data URI olarak doc'a geçir.
    // NOT: TeknikDosyaDoc, müellif bilgisini ctx.muhendis üzerinden okur (buildCtx: muh = d.muhendis).
    try {
      const imzaDataUri = async (path?: string): Promise<string | null> => {
        if (!path) return null;
        const bytes = await download("documents", path);
        return bytes ? imzaToPngDataUri(bytes) : null;
      };
      if (inp.imza_makine && imzaMakinePath) {
        const uri = await imzaDataUri(imzaMakinePath);
        if (uri) { ctx.muhendis = ctx.muhendis || {}; ctx.muhendis.makine = ctx.muhendis.makine || {}; ctx.muhendis.makine.imza = uri; }
      }
      if (inp.imza_elektrik && imzaElektrikPath) {
        const uri = await imzaDataUri(imzaElektrikPath);
        if (uri) { ctx.muhendis = ctx.muhendis || {}; ctx.muhendis.elektrik = ctx.muhendis.elektrik || {}; ctx.muhendis.elektrik.imza = uri; }
      }
    } catch { /* imza gömülemezse taahhütname imzasız üretilir */ }

    const cdocs = src.companyDocs;
    for (const d of cdocs) {
      if (!d.path) continue;
      if (d.docType === "imza_sirkuleri") attach.coImza.push(d.path);
      else if (d.docType === "sanayi_sicil") attach.coSanayi.push(d.path);
      else if (d.docType === "tse_hyb") attach.coTse.push(d.path);
      else if (d.docType.startsWith("ce")) attach.coCe.push(d.path);
    }
    // Firma Bilgileri arkasına yalnızca Belgeler'de SEÇİLEN CE belgeleri (H1 → Tasarım → Mod B(+Eki) → Mod E sırasıyla)
    const selCeIds: string[] = Array.isArray(inp.modul_belge_ids) ? inp.modul_belge_ids : [];
    const ceRank: Record<string, number> = { ce_h1: 0, ce_tasarim: 1, ce_b: 2, ce_b_eki: 3, ce_e: 4 };
    attach.coCeSelected = cdocs
      .filter((d) => d.path && d.docType.startsWith("ce") && selCeIds.includes(d.id))
      .sort((a, b) => (ceRank[a.docType] ?? 9) - (ceRank[b.docType] ?? 9))
      .map((d) => d.path as string);
    // Firma CE modül belgeleri (ce_h1 / ce_b / ce_e) → tescil + AB Uygunluk Beyanı (API en yeni önce sıralar)
    const nbMap = new Map(src.notifiedBodies.map((n) => [n.id, n]));
    const pick = (dt: string) => {
      const d = cdocs.find((x) => x.docType === dt);
      if (!d) return null;
      const nb = d.notifiedBodyId ? nbMap.get(d.notifiedBodyId) : null;
      return { belge_no: d.belgeNo ?? null, tarih: d.issueDate ?? null, onaylanmis_kurulus: nb?.name ?? null, kurulus_no: nb?.identityNo ?? null, nb_adres: nb?.address ?? null };
    };
    // Mod G: kuruluş adresi kayıttaki kopyadan değil, anlık kuruluş kaydından (Yönetim'deki düzeltme hemen yansır)
    const gNb = inp.modul_secim === "G" && inp.modul_g?.nb_id ? nbMap.get(inp.modul_g.nb_id) : null;
    if (gNb) (ctx.input_data || ctx).modul_nb_adres = gNb.address ?? null; // belge inp'i böyle okur (buildCtx)
    const mH1 = pick("ce_h1"), mB = pick("ce_b"), mE = pick("ce_e");
    if (mH1) ctx.modulH1 = mH1;
    if (mB) ctx.modulB = mB;
    if (mE) ctx.modulE = mE;

    // Ekipman kategorileri (kod → ad) — Teknik Komponent'te hidrolik valfleri ada göre bulmak için
    ctx.equipCats = src.equipmentCategories.map((c) => ({ code: c.code, name: c.name, drive_type: c.driveType }));

    // Teknik Komponent'te ekipman OK'si TİCARİ ÜNVAN yerine KISA AD gösterilsin.
    // (RPC onaylanmis_kurulus'u ünvan=name ile dolduruyor; ünvan → kısa ad eşle.)
    // Tescil ve AB Uygunluk Beyanı kendi alanlarını kullandığından ünvanı korur.
    try {
      const shortByName = new Map(src.notifiedBodies.map((n) => [String(n.name || "").trim(), n.shortName]));
      const ek = ctx.ekipman;
      if (ek && typeof ek === "object") {
        for (const key of Object.keys(ek)) {
          const o = ek[key];
          if (o && typeof o === "object" && o.onaylanmis_kurulus) {
            const sn = shortByName.get(String(o.onaylanmis_kurulus).trim());
            if (sn) o.onaylanmis_kurulus = sn;
          }
        }
      }
    } catch { /* eşleşme kurulamazsa ünvan kalır */ }

    // Marka seçili ama model yok olan ekipmanlarda, RPC marka ismini doldurmamış olabilir.
    // Burada marka'yı brand_id üzerinden tamamlıyoruz (yalnızca boşsa) — böylece Teknik Komponent
    // ve Tescil tablolarında ilgili satırda marka görünür, model/seri boş kalır.
    {
      const ek = (ctx.ekipman = ctx.ekipman || {});
      const hasMarka = (...keys: string[]) => keys.some((k) => ek[k]?.marka);
      const fill = (key: string, bname: string) => { ek[key] = { ...(ek[key] || {}), marka: bname }; };
      for (const r of src.equipment) {
        const code = r.categoryCode;
        const bname = r.brandName;
        if (!code || !bname) continue;
        if (code === "tampon") {
          // Doc okuma yolu: agırlık → tampon_agirlik; kabin → tampon_kabin || tampon.
          // Yalnızca ilgili yolda marka boşsa doldur (RPC'nin dolu kaydını ezme).
          if ((r.slot || "kabin") === "agirlik") {
            if (!hasMarka("tampon_agirlik")) fill("tampon_agirlik", bname);
          } else if (!hasMarka("tampon_kabin", "tampon")) {
            fill("tampon_kabin", bname);
          }
        } else if (!ek[code]?.marka) {
          fill(code, bname);
        }
      }
    }

    // Tampon seri_list'i (kabin/ağırlık) ekipman nesnesine ekle — Teknik Komponent & Tescil'de çoklu seri no
    try {
      const ek = (ctx.ekipman = ctx.ekipman || {});
      for (const r of src.equipment) {
        if (r.categoryCode !== "tampon") continue;
        const list = Array.isArray(r.seriList) ? r.seriList : null;
        if (!list) continue;
        if ((r.slot || "kabin") === "agirlik") {
          ek.tampon_agirlik = { ...(ek.tampon_agirlik || {}), seri_list: list };
        } else if (ek.tampon_kabin) {
          ek.tampon_kabin = { ...ek.tampon_kabin, seri_list: list };
        } else {
          ek.tampon = { ...(ek.tampon || {}), seri_list: list };
        }
      }
    } catch { /* tampon seri_list eklenemezse tek seri_no gösterilir */ }

    const motorIds = new Set<string>(); const otherIds = new Set<string>();
    for (const e of src.equipment) {
      if (!e.certificateId) continue;
      if (e.categoryCode === "motor") motorIds.add(e.certificateId);
      else otherIds.add(e.certificateId);
    }
    const pathOf = (id: string) => src.certificateFiles.find((f) => f.certificateId === id)?.path;
    attach.motorCerts = Array.from(motorIds).map(pathOf).filter(Boolean) as string[];
    attach.otherCerts = Array.from(otherIds).map(pathOf).filter(Boolean) as string[];
  } catch { /* ekler alınamazsa yalnız üretilen belgeler basılır */ }

  // ---------- Birleştirme (pdf-lib) ----------
  const finalDoc = await PDFDocument.create();

  async function addPdfBytes(bytes: Uint8Array) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await finalDoc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => finalDoc.addPage(p));
  }
  async function addImageBytes(bytes: Uint8Array, kind: "png" | "jpg") {
    const img = kind === "png" ? await finalDoc.embedPng(bytes) : await finalDoc.embedJpg(bytes);
    const A4W = 595.28, A4H = 841.89, m = 28;
    const page = finalDoc.addPage([A4W, A4H]);
    const scale = Math.min((A4W - 2 * m) / img.width, (A4H - 2 * m) / img.height, 1);
    const w = img.width * scale, h = img.height * scale;
    page.drawImage(img, { x: (A4W - w) / 2, y: (A4H - h) / 2, width: w, height: h });
  }
  async function addFile(bucket: string, path?: string) {
    if (!path) return;
    const ext = (path.split(".").pop() || "").toLowerCase();
    const bytes = await download(bucket, path);
    if (!bytes) return;
    try {
      if (ext === "pdf") await addPdfBytes(bytes);
      else if (ext === "jpg" || ext === "jpeg") await addImageBytes(bytes, "jpg");
      else if (ext === "png") await addImageBytes(bytes, "png");
      // diğer türler (dwg vb.) gömülemez → atlanır
    } catch { /* bozuk dosyayı atla */ }
  }
  async function addDoc(code: string) {
    const buf = await renderPdf(
      React.createElement(TeknikDosyaDoc, { data: ctx, only: code, assetBase }) as any
    );
    await addPdfBytes(new Uint8Array(buf));
  }
  // Hazır kılavuz PDF'i getir, her sayfasının footer'ını (2 satır, sola dayalı, siyah) yaz, ekle
  let robotoBytes: Uint8Array | null = null;
  let robotoBoldBytes: Uint8Array | null = null;
  async function addKilavuz() {
    try {
      const kilavuzBytes = await readAsset(`kilavuz/${kilavuzFile}`);
      if (!kilavuzBytes) return;
      const doc = await PDFDocument.load(kilavuzBytes, { ignoreEncryption: true });
      // Footer: 1. satır Ticari Ünvan (kalın), 2. satır Adres · Telefon · E-posta — sola dayalı, siyah
      const cf = (ctx as any)?.firma || {};
      const fUnvan = String(cf.unvan || cf.kisa_ad || "").trim();
      const fAlt = [cf.adres, cf.telefon, cf.email].filter(Boolean).map((x: any) => String(x).trim()).join(" · ");
      if (fUnvan || fAlt) {
        try {
          if (!robotoBytes) robotoBytes = await readAsset("fonts/Roboto-Regular.ttf");
          if (!robotoBoldBytes) robotoBoldBytes = await readAsset("fonts/Roboto-Bold.ttf");
          if (robotoBytes) {
            doc.registerFontkit(fontkit);
            const font = await doc.embedFont(robotoBytes);
            const fontB = robotoBoldBytes ? await doc.embedFont(robotoBoldBytes) : font;
            const black = rgb(0, 0, 0);
            // Sol üst köşe logosu (yoksa kısa ad): 2 cm / 1 cm, 2×5 cm kutuya sığdır
            const CM = 28.3465, boxW = 4 * CM, boxH = 2 * CM;
            let logoImg: any = null;
            if (logoBytes) { try { logoImg = logoMime === "image/png" ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes); } catch { logoImg = null; } }
            const kisaAd = String(cf.kisa_ad || cf.unvan || "").trim();
            for (const pg of doc.getPages()) {
              const { width, height } = pg.getSize();
              const left = 42, right = width - 42, maxW = right - left;
              // Logo / kısa ad (sol üst)
              if (logoImg) {
                const ratio = logoImg.width / logoImg.height;
                let lw = boxW, lh = lw / ratio;
                if (lh > boxH) { lh = boxH; lw = lh * ratio; }
                pg.drawImage(logoImg, { x: 2 * CM, y: height - 1 * CM - lh, width: lw, height: lh });
              } else if (kisaAd) {
                pg.drawText(kisaAd, { x: 2 * CM, y: height - 1 * CM - 10, size: 10, font: fontB, color: black });
              }
              // Footer
              pg.drawLine({ start: { x: left, y: 32 }, end: { x: right, y: 32 }, thickness: 0.8, color: black });
              if (fUnvan) pg.drawText(fUnvan, { x: left, y: 22, size: 8, font: fontB, color: black });
              if (fAlt) {
                let asz = 7.5;
                while (asz > 5 && font.widthOfTextAtSize(fAlt, asz) > maxW) asz -= 0.3;
                pg.drawText(fAlt, { x: left, y: 13, size: asz, font, color: black });
              }
            }
          }
        } catch { /* footer eklenemezse kılavuz yine eklenir */ }
      }
      const pages = await finalDoc.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => finalDoc.addPage(p));
    } catch { /* kılavuz alınamazsa atla */ }
  }

  // Son Kontrol Formu: hazır PDF (public) — 1. sayfa başlık altına bilgi tablosu + sol üst firma kısa adı header
  async function addSonKontrol() {
    try {
      const formBytes = await readAsset("kilavuz/SON_KONTROL_FORMU.pdf");
      if (!formBytes) { await addDoc("son_kontrol_formu"); return; }
      const doc = await PDFDocument.load(formBytes, { ignoreEncryption: true });
      doc.registerFontkit(fontkit);
      if (!robotoBytes) robotoBytes = await readAsset("fonts/Roboto-Regular.ttf");
      if (!robotoBoldBytes) robotoBoldBytes = await readAsset("fonts/Roboto-Bold.ttf");
      const font = robotoBytes ? await doc.embedFont(robotoBytes) : null;
      const fontB = robotoBoldBytes ? await doc.embedFont(robotoBoldBytes) : font;
      if (font && fontB) {
        const cf = (ctx as any)?.firma || {};
        const sk = (ctx as any)?.__sk || {};
        const kisaAd = String(cf.kisa_ad || cf.unvan || "").trim();
        const montajAdresi = String(sk.montaj_adresi || "").trim();
        const adaPaftaParsel = [sk.ada, sk.pafta, sk.parsel].filter(Boolean).map((x: any) => String(x).trim()).join(" / ");
        const seriNo = String(sk.asansor_seri_no || "").trim();
        const black = rgb(0, 0, 0);
        const pages = doc.getPages();
        // Sol üst köşe: logo varsa logo, yoksa firma kısa adı (her sayfa)
        let logoImg: any = null;
        if (logoBytes) { try { logoImg = logoMime === "image/png" ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes); } catch { logoImg = null; } }
        // Logo: sol 2 cm / üst 1 cm; 2 cm (y) × 5 cm (g) kutuya sığacak şekilde (contain)
        const CM = 28.3465, boxW = 4 * CM, boxH = 2 * CM;
        for (const pg of pages) {
          const { height } = pg.getSize();
          if (logoImg) {
            const ratio = logoImg.width / logoImg.height;
            let lw = boxW, lh = lw / ratio;
            if (lh > boxH) { lh = boxH; lw = lh * ratio; }
            pg.drawImage(logoImg, { x: 2 * CM, y: height - 1 * CM - lh, width: lw, height: lh });
          } else if (kisaAd) {
            pg.drawText(kisaAd, { x: 2 * CM, y: height - 1 * CM - 10, size: 10, font: fontB, color: rgb(0, 0, 0) });
          }
        }
        // Bilgi: yalnız 1. sayfa, başlık altındaki boşluğa — çizgisiz (etiket : değer)
        const p1 = pages[0];
        const { width: PW, height: PH } = p1.getSize();
        const rows: [string, string][] = [
          ["Montaj Adresi", montajAdresi],
          ["Ada / Pafta / Parsel", adaPaftaParsel],
          ["Asansör Seri No", seriNo],
        ];
        // Başlık altındaki boş dikdörtgenin içine (ASANSÖR KUYUSU'nun hemen üstü)
        const tblX = 26, labelW = 120, rowH = 12.5, yTop = PH - 134;
        const maxVW = PW - 26 - (tblX + labelW) - 2;
        rows.forEach((r, i) => {
          const baseY = yTop - i * rowH - rowH + 3.7;
          p1.drawText(r[0], { x: tblX, y: baseY, size: 8, font: fontB, color: black });
          let vs = 8;
          while (vs > 5.5 && font.widthOfTextAtSize(r[1], vs) > maxVW) vs -= 0.3;
          p1.drawText(r[1], { x: tblX + labelW, y: baseY, size: vs, font, color: black });
        });
      }
      const copied = await finalDoc.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => finalDoc.addPage(p));
    } catch { await addDoc("son_kontrol_formu"); }
  }

  for (const code of codes) {
    // Kullanma ve Bakım Kılavuzu: üretilmez; hazır PDF (firma footer'lı) eklenir
    if (code === "kullanma_bakim_klavuzu") { await addKilavuz(); continue; }

    // Son Kontrol Formu: Modül G + rapor yüklüyse rapor; değilse hazır PDF (bilgi tablosu + header'lı)
    if (code === "son_kontrol_formu") {
      if (attach.isG && (attach.pf["modul_g_rapor"]?.length)) {
        for (const p of attach.pf["modul_g_rapor"]) await addFile("documents", p);
      } else {
        await addSonKontrol();
      }
      continue;
    }

    await addDoc(code);

    // Çapaya göre yüklenmiş ekleri araya koy
    if (code === "dilekce") {
      for (const p of attach.pf["yapi_ruhsati"] ?? []) await addFile("documents", p);
      for (const p of attach.pf["periyodik_kontrol"] ?? []) await addFile("documents", p);
    } else if (code === "garanti") {
      // Fatura, Garanti Belgesi'nin hemen arkasına
      for (const p of attach.pf["fatura"] ?? []) await addFile("documents", p);
    } else if (code === "firma_bilgileri") {
      // Firma Bilgileri'nden sonra, Sanayi Sicil'den önce: İmza Sirküleri
      for (const p of attach.coImza) await addFile("documents", p);
      for (const p of attach.coSanayi) await addFile("documents", p);
      for (const p of attach.coTse) await addFile("documents", p);
      // Mod G seçiliyse: yüklenen Modül G belgesi; değilse Belgeler'de seçilen CE belgeleri
      if (attach.isG) { for (const p of (attach.pf["modul_g_belge"] ?? [])) await addFile("documents", p); }
      else { for (const p of attach.coCeSelected) await addFile("documents", p); }
    } else if (code === "muh_taahhut_makine") {
      for (const p of attach.engMakine) await addFile("documents", p);
    } else if (code === "muh_taahhut_elektrik") {
      for (const p of attach.engElektrik) await addFile("documents", p);
    } else if (code === "teknik_komponent") {
      // Teknik Komponent Listesi ekleri: diğer komponent sertifikaları + motor beyannamesi sertifikası
      for (const p of attach.otherCerts) await addFile("certificates", p);
      for (const p of attach.motorCerts) await addFile("certificates", p);
    }
  }

  const out = await finalDoc.save();

  const dosyaNo = (ctx as any)?.dosya_no ?? projectId;
  const namePart = belgeler.length === 1 ? `${dosyaNo}_${belgeler[0]}` : belgeler.length > 1 ? `${dosyaNo}_secili` : `${dosyaNo}_tumu`;
  const disposition = dl ? "attachment" : "inline";
  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="Teknik_Dosya_${namePart}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = withPdfBusy(handleGet);
