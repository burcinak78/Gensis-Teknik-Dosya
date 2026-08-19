import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BildirimlerClient from "./BildirimlerClient";

export const dynamic = "force-dynamic";

export default async function BildirimlerPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = user
    ? await supabase.from("profiles").select("role, company_id").eq("id", user.id).single()
    : { data: null };
  const role = prof?.role ?? "customer";
  const companyId = prof?.company_id ?? null;
  const isStaff = role === "admin" || role === "gensis";

  // Geçerliliğe 1 aydan az kalan VEYA süresi dolmuş (tarihsizler hariç)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const admin = createAdminClient();

  // Müşteri belgeleri
  let compQ = admin
    .from("company_documents")
    .select("id, company_id, doc_type, belge_no, original_name, valid_until, companies(short_name)")
    .not("valid_until", "is", null)
    .lte("valid_until", cutoffStr)
    .order("valid_until", { ascending: true });
  if (!isStaff) compQ = compQ.eq("company_id", companyId ?? "00000000-0000-0000-0000-000000000000");
  const { data: compDocs } = await compQ;

  // Mühendis belgeleri
  const { data: engDocs } = await admin
    .from("engineer_documents")
    .select("id, engineer_id, doc_type, original_name, valid_until, engineers(full_name, discipline, company_id)")
    .not("valid_until", "is", null)
    .lte("valid_until", cutoffStr)
    .order("valid_until", { ascending: true });
  const engFiltered = (engDocs ?? []).filter((d: any) => isStaff || d.engineers?.company_id === companyId);

  // Ekipman sertifikaları — yalnız personel (modele bağlı olmasa da doğrudan sertifika bazlı)
  const BELGE_TIPI_TR: Record<string, string> = {
    mod_b: "Mod B", mod_c2: "Mod C2", uygunluk_beyani: "Uygunluk Beyanı", tip_inceleme: "Tip İnceleme", yangin: "Yangın Sertifikası", deney_raporu: "Deney Raporu",
  };
  let ekipman: any[] = [];
  if (isStaff) {
    const { data: certs } = await admin
      .from("certificates")
      .select("id, cert_no, valid_until, belge_tipi, firma_adi, equipment_categories(name)")
      .not("valid_until", "is", null)
      .lte("valid_until", cutoffStr)
      .order("valid_until", { ascending: true });
    ekipman = (certs ?? []).map((c: any) => ({
      id: c.id,
      kategori: c.equipment_categories?.name ?? "—",
      belgeTipi: BELGE_TIPI_TR[c.belge_tipi ?? ""] ?? "—",
      certNo: c.cert_no ?? "",
      firma: c.firma_adi ?? "—",
      valid_until: c.valid_until ?? null,
    }));
  }

  const musteri = (compDocs ?? []).map((d: any) => ({
    id: d.id, companyId: d.company_id, firma: d.companies?.short_name ?? "—",
    docType: d.doc_type, belgeNo: d.belge_no, valid_until: d.valid_until,
  }));
  const muhendis = engFiltered.map((d: any) => ({
    id: d.id, engineerId: d.engineer_id, ad: d.engineers?.full_name ?? "—",
    brans: d.engineers?.discipline ?? "", docType: d.doc_type, valid_until: d.valid_until,
  }));

  return <BildirimlerClient role={role} isStaff={isStaff} musteri={musteri} muhendis={muhendis} ekipman={ekipman} />;
}
