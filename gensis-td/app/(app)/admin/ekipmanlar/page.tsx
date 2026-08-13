import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import GuvenlikEkipmanlariClient from "./GuvenlikEkipmanlariClient";

export const dynamic = "force-dynamic";

export default async function GuvenlikEkipmanlariPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = user ? await supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null } as any;
  const isAdmin = prof?.role === "admin";

  const [
    { data: categories }, { data: brands }, { data: models },
    { data: certificates }, { data: certFiles }, { data: notifiedBodies }, { data: modelCerts },
  ] = await Promise.all([
    supabase.from("equipment_categories").select("id, name, sort_order").order("sort_order"),
    supabase.from("equipment_brands").select("id, category_id, name").order("name"),
    supabase.from("equipment_models").select("id, brand_id, name, certificate_id").limit(5000),
    supabase.from("certificates").select("id, cert_no, notified_body_id, issue_date, valid_until, belge_tipi, category_id, firma_adi").limit(5000),
    supabase.from("certificate_files").select("certificate_id, original_name").eq("is_current", true).limit(5000),
    supabase.from("notified_bodies").select("id, identity_no, name, address").order("name"),
    admin.from("model_certificates").select("model_id, certificate_id").limit(20000),
  ]);

  const certFileMap: Record<string, string> = {};
  for (const f of certFiles ?? []) if (f.certificate_id) certFileMap[f.certificate_id] = f.original_name ?? "";

  return (
    <GuvenlikEkipmanlariClient
      categories={(categories ?? []) as any}
      brands={(brands ?? []) as any}
      models={(models ?? []) as any}
      certificates={(certificates ?? []) as any}
      certFileMap={certFileMap}
      notifiedBodies={(notifiedBodies ?? []) as any}
      modelCerts={(modelCerts ?? []) as any}
      isAdmin={isAdmin}
    />
  );
}
