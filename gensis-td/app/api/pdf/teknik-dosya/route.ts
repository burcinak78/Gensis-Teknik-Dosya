import { NextRequest } from "next/server";
import React from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
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

  // ---------- Yüklenmiş ekleri topla (hata olursa eksiz üret) ----------
  const admin = createAdminClient();
  let attach: {
    isG: boolean;
    pf: Record<string, string[]>;
    engMakine: string[]; engElektrik: string[];
    coSanayi: string[]; coTse: string[]; coCe: string[];
    motorCerts: string[]; otherCerts: string[];
  } = { isG: false, pf: {}, engMakine: [], engElektrik: [], coSanayi: [], coTse: [], coCe: [], motorCerts: [], otherCerts: [] };
  try {
    const { data: prow } = await admin.from("projects")
      .select("makine_muhendis_id, elektrik_muhendis_id, company_id, input_data").eq("id", projectId).single();
    const inp = (prow?.input_data ?? {}) as Record<string, any>;
    attach.isG = inp.modul_secim === "G";
    const companyId = prow?.company_id ?? null;
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
    }

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

  for (const code of codes) {
    // Son Kontrol Formu: Modül G seçildiyse ve rapor yüklendiyse onun yerine Modül G raporu
    if (code === "son_kontrol_formu" && attach.isG && (attach.pf["modul_g_rapor"]?.length)) {
      for (const p of attach.pf["modul_g_rapor"]) await addFile("documents", p);
      continue;
    }

    await addDoc(code);

    // Çapaya göre yüklenmiş ekleri araya koy
    if (code === "dilekce") {
      for (const p of attach.pf["yapi_ruhsati"] ?? []) await addFile("documents", p);
      for (const p of attach.pf["periyodik_kontrol"] ?? []) await addFile("documents", p);
      for (const p of attach.pf["fatura"] ?? []) await addFile("documents", p);
    } else if (code === "firma_bilgileri") {
      for (const p of attach.coSanayi) await addFile("documents", p);
      for (const p of attach.coTse) await addFile("documents", p);
      for (const p of attach.coCe) await addFile("documents", p);
    } else if (code === "muh_taahhut_makine") {
      for (const p of attach.engMakine) await addFile("documents", p);
    } else if (code === "muh_taahhut_elektrik") {
      for (const p of attach.engElektrik) await addFile("documents", p);
    } else if (code === "motor_beyannamesi") {
      for (const p of attach.motorCerts) await addFile("certificates", p);
    } else if (code === "teknik_komponent") {
      for (const p of attach.otherCerts) await addFile("certificates", p);
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
