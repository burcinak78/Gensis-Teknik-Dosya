import { createClient } from "@/lib/supabase/server";
import EkipmanClient from "./EkipmanClient";
import EkipmanForm from "./EkipmanForm";

export const dynamic = "force-dynamic";

export default async function EkipmanlarPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: brands }, { data: models }, { data: certificates }] = await Promise.all([
    supabase.from("equipment_categories").select("id, name").order("sort_order"),
    supabase.from("equipment_brands").select("id, category_id, name").order("name"),
    supabase.from("equipment_models").select("id, brand_id, name, certificate_id").order("name").limit(5000),
    supabase.from("certificates").select("id, cert_no").order("cert_no").limit(2000),
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <EkipmanClient categories={categories ?? []} brands={brands ?? []} models={models ?? []} certificates={certificates ?? []} />
      <EkipmanForm categories={categories ?? []} brands={brands ?? []} certificates={certificates ?? []} />
    </div>
  );
}
