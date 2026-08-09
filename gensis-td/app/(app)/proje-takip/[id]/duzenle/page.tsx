import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import YeniProjeForm from "../../YeniProjeForm";

export const dynamic = "force-dynamic";

const SLOT_KINDS = ["mimari_proje", "elektrik_projesi", "statik_projesi", "olcu_formu", "yapi_ruhsati", "diger"];

export default async function DuzenlePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: p } = await admin.from("takip_projeler").select("*").eq("id", params.id).maybeSingle();
  if (!p) notFound();

  const [{ data: companies }, { data: provinces }, { data: sorumlular }, { data: docs }] = await Promise.all([
    supabase.from("companies").select("id, short_name, legal_name, city").order("short_name").limit(2000),
    supabase.from("provinces").select("id, name").order("name"),
    admin.from("profiles").select("id, full_name, role").in("role", ["admin", "gensis"]).order("full_name").limit(1000),
    admin.from("takip_dokumanlar").select("id, kind, original_name").eq("takip_id", params.id),
  ]);

  let initialDistricts: { id: string; name: string }[] = [];
  if (p.province_id != null) {
    const { data: d } = await supabase.from("districts").select("id, name").eq("province_id", p.province_id).order("name").limit(2000);
    initialDistricts = d ?? [];
  }

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
    province_id: st(p.province_id),
    district_id: st(p.district_id),
    fiyat: st(p.fiyat),
    fatura_tipi: st(p.fatura_tipi) || "faturasiz",
    proje_sorumlusu_id: st(p.proje_sorumlusu_id),
    tahmini_tamamlanma: st(p.tahmini_tamamlanma),
  };

  const slotDocs = (docs ?? []).filter((d: any) => SLOT_KINDS.includes(d.kind));

  return (
    <YeniProjeForm
      companies={(companies ?? []) as any}
      provinces={(provinces ?? []) as any}
      sorumlular={(sorumlular ?? []) as any}
      edit={{ id: p.id, proje_no: p.proje_no, values, initialDistricts, docs: slotDocs as any }}
    />
  );
}
