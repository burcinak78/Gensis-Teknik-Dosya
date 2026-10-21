import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api/server";
import { getTakip, loadTakipReference } from "../../data";
import YeniProjeForm from "../../YeniProjeForm";

export const dynamic = "force-dynamic";

const SLOT_KINDS = ["mimari_proje", "elektrik_projesi", "statik_projesi", "olcu_formu", "yapi_ruhsati", "diger"];

export default async function DuzenlePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [p, ref] = await Promise.all([getTakip(params.id), loadTakipReference()]);
  if (!p) notFound();
  const docs = p.docs;

  const initialDistricts = p.province_id != null
    ? (await apiGet<{ id: string; name: string }[]>(`/api/catalog/provinces/${p.province_id}/districts`)) ?? []
    : [];

  const st = (v: any) => (v == null ? "" : String(v));
  const values = {
    proje_tipi: st(p.proje_tipi) || "mimari",
    siparis_tarihi: st(p.siparis_tarihi),
    company_id: st(p.company_id),
    ada: st(p.ada),
    parsel: st(p.parsel),
    is_adi: st(p.is_adi),
    asansor_sayisi: st(p.asansor_sayisi),
    asansor_tipi: st(p.asansor_tipi),
    asansor_seri_no: st(p.asansor_seri_no),
    province_id: st(p.province_id),
    district_id: st(p.district_id),
    fiyat: st(p.fiyat),
    fatura_tipi: st(p.fatura_tipi) || "faturasiz",
    proje_sorumlusu_id: st(p.proje_sorumlusu_id),
    tahmini_tamamlanma: st(p.tahmini_tamamlanma),
    montaj_firma_id: st(p.montaj_firma_id),
  };

  const slotDocs = (docs ?? []).filter((d: any) => SLOT_KINDS.includes(d.kind));
  const tamamlananDocs = (docs ?? []).filter((d: any) => d.kind === "tamamlanan_proje");

  // Muhasebe teslim edildi mi → fiyat/fatura/teslim/tamamlanma kilidi
  const kilitli = p.muhasebe?.cariye_islendi === true;

  return (
    <YeniProjeForm
      companies={ref.companies}
      provinces={ref.provinces}
      sorumlular={ref.sorumlular}
      edit={{
        id: p.id, proje_no: p.proje_no, values, initialDistricts, docs: slotDocs as any,
        durum: p.durum, tamamlanma_tarihi: p.tamamlanma_tarihi, teslim_tipi: p.teslim_tipi, hard_copy_adedi: p.hard_copy_adedi,
        tamamlananDocs: tamamlananDocs as any, kilitli,
      }}
    />
  );
}
