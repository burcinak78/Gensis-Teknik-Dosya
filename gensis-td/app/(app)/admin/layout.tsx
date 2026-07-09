import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminTabs from "./AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin") redirect("/panel");

  return (
    <div>
      <div className="bg-white/80 backdrop-blur border-b border-[#e5e9f0] px-8 pt-5 sticky top-0 z-20">
        <h1 className="text-[22px] font-extrabold tracking-tight mb-2">Yönetim</h1>
        <AdminTabs />
      </div>
      <div className="p-8 gs-fade">{children}</div>
    </div>
  );
}
