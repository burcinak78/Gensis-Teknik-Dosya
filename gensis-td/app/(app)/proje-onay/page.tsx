import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProjeOnayTable from "./ProjeOnayTable";

export const dynamic = "force-dynamic";

export default async function ProjeOnayListPage() {
  const supabase = createClient();
  const { data: list } = await supabase
    .from("proje_onay")
    .select("id, dosya_no, status, yapi_sahibi, beyan_yuku_kg, durak_sayisi, dilekce_tarihi, created_at, input_data, companies(short_name)")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div>
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-tight">Proje Onay Dosyaları</h1>
            <p className="text-sm text-slate-500">Avan proje onay dilekçesi ve proje müellifi dosyalarınız.</p>
          </div>
          <Link href="/proje-onay/yeni" className="gs-btn text-sm font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5">
            <span className="material-symbols-rounded text-[18px]">add</span> Yeni Dosya
          </Link>
        </div>
      </div>
      <div className="px-8 pb-8 gs-fade">
        <ProjeOnayTable rows={(list ?? []) as any} />
      </div>
    </div>
  );
}
