import { createClient } from "@/lib/supabase/server";
import ProjeOnayClient from "./ProjeOnayClient";

export const dynamic = "force-dynamic";

export default async function ProjeOnayPage() {
  const supabase = createClient();
  const [companies, provinces, capacity] = await Promise.all([
    supabase.from("companies").select("id, short_name, legal_name").order("short_name").limit(2000),
    supabase.from("provinces").select("id, name").order("name"),
    supabase.from("capacity_table").select("beyan_yuku_kg, kisi_sayisi").order("beyan_yuku_kg"),
  ]);

  return (
    <div>
      <div className="px-8 pt-6 pb-4 border-b border-[#e7ebf2]">
        <h1 className="text-[24px] font-extrabold tracking-tight">Proje Onay Dosyası</h1>
        <p className="text-sm text-slate-500">Avan Proje Onay Dilekçesi bilgilerini girip belgeyi oluşturun.</p>
      </div>
      <div className="px-8 py-6 gs-fade">
        <ProjeOnayClient
          companies={companies.data ?? []}
          provinces={provinces.data ?? []}
          capacity={(capacity.data ?? []) as any}
        />
      </div>
    </div>
  );
}
