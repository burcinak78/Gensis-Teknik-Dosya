import { NextRequest } from "next/server";
import React from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeknikDosyaDoc } from "@/lib/pdf/TeknikDosyaDoc";
import { TEKNIK_DOSYA_BELGELERI } from "@/lib/pdf/belgeler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let fontsRegistered = false;
function registerFonts(base: string) {
  if (fontsRegistered) return;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: `${base}/fonts/Roboto-Regular.ttf` },
      { src: `${base}/fonts/Roboto-Bold.ttf`, fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return new Response("projectId gerekli.", { status: 400 });

  // Erişim kontrolü (RLS)
  const { data: proj } = await supabase.from("projects").select("id").eq("id", projectId).single();
  if (!proj) return new Response("Proje bulunamadı veya yetkiniz yok.", { status: 404 });

  const { data: ctx, error } = await supabase.rpc("project_render_context", { p_id: projectId });
  if (error || !ctx) return new Response("Veri alınamadı: " + (error?.message ?? ""), { status: 500 });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  const assetBase = `${proto}://${host}`;
  registerFonts(assetBase);

  const belgeler = req.nextUrl.searchParams.getAll("belge");
  const dl = req.nextUrl.searchParams.get("dl") === "1";
  const only = belgeler.length === 0 ? undefined : belgeler;
  const codes = TEKNIK_DOSYA_BELGELERI
    .filter((b) => b.hazir && (!only || only.includes(b.code)))
    .map((b) => b.code);

  // Kullanma ve Bakım Kılavuzu: asansör tipi + askı tipine göre hazır PDF
  const cIsHid = (ctx as any)?.asansor_tipi === "hidrolik";
  const cAski = String((ctx as any)?.aski_tipi || "");
  const kilavuzFile = cIsHid ? "KK_HID.pdf" : (cAski.startsWith("1/1") ? "KK_E_MR.pdf" : "KK_E_MRL.pdf");

  // ---------- Yüklenmiş ekleri topla (hata olursa eksiz üret) ----------
  const admin = createAdminClient();
  let attach: {
    isG: boolean;
    pf: Record<string, string[]>;
    engMakine: string[]; engElektrik: string[];
    coSanayi: string[]; coTse: string[]; coCe: string[];
    motorCerts: string[]; otherCerts: string[];
  } = { isG: false, pf: {}, engMakine: [], engElektrik: [], coSanayi: [], coTse: [], coCe: [], motorCerts: [], otherCerts: [] };
  // Müşteri logosu (varsa header'da kısa ad yerine kullanılır)
  let logoBytes: Uint8Array | null = null;
  let logoMime = "image/png";
  try {
    const { data: prow } = await admin.from("projects")
      .select("makine_muhendis_id, elektrik_muhendis_id, company_id, input_data, bina_adi, td_no").eq("id", projectId).single();
    // Kapakta Dosya No karşısına TD No
    if (prow?.td_no != null) (ctx as any).td_no = prow.td_no;
    const inp = (prow?.input_data ?? {}) as Record<string, any>;
    // Son Kontrol Formu bilgi tablosu için veriler (montaj adresi + input_data)
    (ctx as any).__sk = {
      montaj_adresi: (ctx as any).montaj_adresi || inp.montaj_adresi || null,
      ada: inp.ada ?? null, pafta: inp.pafta ?? null, parsel: inp.parsel ?? null,
      asansor_seri_no: inp.asansor_seri_no ?? null,
    };
    // Kapakta Bina Adı — render context'te yoksa projects tablosundan tamamla
    if (prow?.bina_adi && !(ctx as any).bina_adi) (ctx as any).bina_adi = prow.bina_adi;
    attach.isG = inp.modul_secim === "G";
    const companyId = prow?.company_id ?? null;
    // Firma Bilgileri: Telefon/E-posta render context'te boşsa companies tablosundan tamamla
    if (companyId) {
      const { data: crow } = await admin.from("companies").select("phone, mobile_phone, email").eq("id", companyId).single();
      if (crow) {
        (ctx as any).firma = (ctx as any).firma || {};
        if (!(ctx as any).firma.telefon) (ctx as any).firma.telefon = crow.phone || crow.mobile_phone || null;
        if (!(ctx as any).firma.email) (ctx as any).firma.email = crow.email || null;
      }
      // Müşteri logosu (company_documents doc_type=logo) → header'da kısa ad yerine
      try {
        const { data: logoDoc } = await admin.from("company_documents")
          .select("storage_path").eq("company_id", companyId).eq("doc_type", "logo").limit(1).maybeSingle();
        if (logoDoc?.storage_path) {
          const { data: blob } = await admin.storage.from("documents").download(logoDoc.storage_path);
          if (blob) {
            logoBytes = new Uint8Array(await blob.arrayBuffer());
            const ext = (logoDoc.storage_path.split(".").pop() || "").toLowerCase();
            logoMime = ext === "png" ? "image/png" : "image/jpeg";
            (ctx as any).firma = (ctx as any).firma || {};
            (ctx as any).firma.logo = `data:${logoMime};base64,${Buffer.from(logoBytes).toString("base64")}`;
          }
        }
      } catch { /* logo alınamazsa kısa ad kalır */ }
    }
    const engIds = [prow?.makine_muhendis_id, prow?.elektrik_muhendis_id].filter(Boolean) as string[];

    const { data: pfiles } = await admin.from("project_files")
      .select("kind, storage_path, sort_order").eq("project_id", projectId).order("sort_order");
    for (const f of pfiles ?? []) {
      if (!f.storage_path) continue;
      (attach.pf[f.kind] ||= []).push(f.storage_path);
    }

    if (engIds.length) {
      const { data: edocs } = await admin.from("engineer_documents")
        .select("engineer_id, storage_path").in("engineer_id", engIds);
      for (const d of edocs ?? []) {
        if (!d.storage_path) continue;
        if (d.engineer_id === prow?.makine_muhendis_id) attach.engMakine.push(d.storage_path);
        if (d.engineer_id === prow?.elektrik_muhendis_id) attach.engElektrik.push(d.storage_path);
      }
    }

    if (companyId) {
      const { data: cdocs } = await admin.from("company_documents")
        .select("doc_type, storage_path").eq("company_id", companyId);
      for (const d of cdocs ?? []) {
        if (!d.storage_path) continue;
        if (d.doc_type === "sanayi_sicil") attach.coSanayi.push(d.storage_path);
        else if (d.doc_type === "tse_hyb") attach.coTse.push(d.storage_path);
        else if (String(d.doc_type).startsWith("ce")) attach.coCe.push(d.storage_path);
      }
      // Firma CE modül belgeleri (ce_h1 / ce_b / ce_e) → tescil + AB Uygunluk Beyanı
      const { data: ceDocs } = await admin.from("company_documents")
        .select("doc_type, belge_no, issue_date, notified_body_id")
        .eq("company_id", companyId).in("doc_type", ["ce_h1", "ce_b", "ce_e"])
        .order("issue_date", { ascending: false });
      if (ceDocs && ceDocs.length) {
        const nbIds = Array.from(new Set(ceDocs.map((d: any) => d.notified_body_id).filter(Boolean)));
        const nbMap = new Map<string, any>();
        if (nbIds.length) {
          const { data: nbs } = await admin.from("notified_bodies").select("id, name, identity_no, address").in("id", nbIds as string[]);
          for (const n of nbs ?? []) nbMap.set(n.id, n);
        }
        const pick = (dt: string) => {
          const d = ceDocs.find((x: any) => x.doc_type === dt); // sıralı: en yeni önce
          if (!d) return null;
          const nb = d.notified_body_id ? nbMap.get(d.notified_body_id) : null;
          return { belge_no: d.belge_no ?? null, tarih: d.issue_date ?? null, onaylanmis_kurulus: nb?.name ?? null, kurulus_no: nb?.identity_no ?? null, nb_adres: nb?.address ?? null };
        };
        const mH1 = pick("ce_h1"), mB = pick("ce_b"), mE = pick("ce_e");
        if (mH1) (ctx as any).modulH1 = mH1;
        if (mB) (ctx as any).modulB = mB;
        if (mE) (ctx as any).modulE = mE;
      }
    }

    // Ekipman kategorileri (kod → ad) — Teknik Komponent'te hidrolik valfleri ada göre bulmak için
    const { data: allCats } = await admin.from("equipment_categories").select("code, name, drive_type");
    if (allCats) (ctx as any).equipCats = allCats;

    const { data: peq } = await admin.from("project_equipment")
      .select("certificate_id, equipment_categories(code)").eq("project_id", projectId);
    const motorIds = new Set<string>(); const otherIds = new Set<string>();
    for (const e of (peq ?? []) as any[]) {
      if (!e.certificate_id) continue;
      const code = e.equipment_categories?.code;
      if (code === "motor") motorIds.add(e.certificate_id);
      else otherIds.add(e.certificate_id);
    }
    const allIds = Array.from(new Set([...motorIds, ...otherIds]));
    if (allIds.length) {
      const { data: cfiles } = await admin.from("certificate_files")
        .select("certificate_id, storage_path").in("certificate_id", allIds).eq("is_current", true);
      const pathOf = (id: string) => (cfiles ?? []).find((f: any) => f.certificate_id === id)?.storage_path as string | undefined;
      attach.motorCerts = Array.from(motorIds).map(pathOf).filter(Boolean) as string[];
      attach.otherCerts = Array.from(otherIds).map(pathOf).filter(Boolean) as string[];
    }
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
  async function download(bucket: string, path: string): Promise<Uint8Array | null> {
    try {
      const { data } = await admin.storage.from(bucket).download(path);
      if (!data) return null;
      return new Uint8Array(await data.arrayBuffer());
    } catch { return null; }
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
    const buf = await renderToBuffer(
      React.createElement(TeknikDosyaDoc, { data: ctx, only: code, assetBase }) as any
    );
    await addPdfBytes(new Uint8Array(buf));
  }
  // Hazır kılavuz PDF'i getir, her sayfasının footer'ını (2 satır, sola dayalı, siyah) yaz, ekle
  let robotoBytes: Uint8Array | null = null;
  let robotoBoldBytes: Uint8Array | null = null;
  async function addKilavuz() {
    try {
      const res = await fetch(`${assetBase}/kilavuz/${kilavuzFile}`);
      if (!res.ok) return;
      const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()), { ignoreEncryption: true });
      // Footer: 1. satır Ticari Ünvan (kalın), 2. satır Adres · Telefon · E-posta — sola dayalı, siyah
      const cf = (ctx as any)?.firma || {};
      const fUnvan = String(cf.unvan || cf.kisa_ad || "").trim();
      const fAlt = [cf.adres, cf.telefon, cf.email].filter(Boolean).map((x: any) => String(x).trim()).join(" · ");
      if (fUnvan || fAlt) {
        try {
          if (!robotoBytes) { const fr = await fetch(`${assetBase}/fonts/Roboto-Regular.ttf`); if (fr.ok) robotoBytes = new Uint8Array(await fr.arrayBuffer()); }
          if (!robotoBoldBytes) { const fb = await fetch(`${assetBase}/fonts/Roboto-Bold.ttf`); if (fb.ok) robotoBoldBytes = new Uint8Array(await fb.arrayBuffer()); }
          if (robotoBytes) {
            doc.registerFontkit(fontkit);
            const font = await doc.embedFont(robotoBytes);
            const fontB = robotoBoldBytes ? await doc.embedFont(robotoBoldBytes) : font;
            const black = rgb(0, 0, 0);
            for (const pg of doc.getPages()) {
              const { width } = pg.getSize();
              const left = 42, right = width - 42, maxW = right - left;
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
      const res = await fetch(`${assetBase}/kilavuz/SON_KONTROL_FORMU.pdf`);
      if (!res.ok) { await addDoc("son_kontrol_formu"); return; }
      const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()), { ignoreEncryption: true });
      doc.registerFontkit(fontkit);
      if (!robotoBytes) { const fr = await fetch(`${assetBase}/fonts/Roboto-Regular.ttf`); if (fr.ok) robotoBytes = new Uint8Array(await fr.arrayBuffer()); }
      if (!robotoBoldBytes) { const fb = await fetch(`${assetBase}/fonts/Roboto-Bold.ttf`); if (fb.ok) robotoBoldBytes = new Uint8Array(await fb.arrayBuffer()); }
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
        for (const pg of pages) {
          const { height } = pg.getSize();
          if (logoImg) {
            let lh = 28, lw = (logoImg.width / logoImg.height) * lh;
            if (lw > 120) { lw = 120; lh = (logoImg.height / logoImg.width) * lw; }
            pg.drawImage(logoImg, { x: 30, y: height - 10 - lh, width: lw, height: lh });
          } else if (kisaAd) {
            pg.drawText(kisaAd, { x: 30, y: height - 16, size: 8, font: fontB, color: rgb(0.25, 0.25, 0.25) });
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
        const tblX = 18, labelW = 130, rowH = 12.5, yTop = PH - 85;
        const maxVW = PW - 18 - (tblX + labelW) - 2;
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
      for (const p of attach.coSanayi) await addFile("documents", p);
      for (const p of attach.coTse) await addFile("documents", p);
      // Mod G seçiliyse: müşteri CE belgeleri yerine yüklenen Modül G belgesi
      if (attach.isG) { for (const p of (attach.pf["modul_g_belge"] ?? [])) await addFile("documents", p); }
      else { for (const p of attach.coCe) await addFile("documents", p); }
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
