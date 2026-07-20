import { createClient } from "@/lib/supabase/server";
import EkipmanClient from "./EkipmanClient";

export const dynamic = "force-dynamic";

export default async function EkipmanlarPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: brands }, { data: models }, { data: certificates }, { data: certFiles }, { data: notifiedBodies }] =
    await Promise.all([
      supabase.from("equipment_categories").select("id, name").order("sort_order"),
      supabase.from("equipment_brands").select("id, category_id, name").order("name"),
      supabase.from("equipment_models").select("id, brand_id, name, certificate_id").order("name").limit(5000),
      supabase.from("certificates").select("id, cert_no, notified_body_id, issue_date, valid_until").order("cert_no").limit(3000),
      supabase.from("certificate_files").select("certificate_id, original_name").eq("is_current", true).limit(3000),
      supabase.from("notified_bodies").select("id, identity_no, name").order("name"),
    ]);

  return (
    <EkipmanClient
      categories={categories ?? []}
      brands={brands ?? []}
      models={models ?? []}
      certificates={(certificates ?? []) as any}
      certFiles={(certFiles ?? []) as any}
      notifiedBodies={(notifiedBodies ?? []) as any}
    />
  );
}
