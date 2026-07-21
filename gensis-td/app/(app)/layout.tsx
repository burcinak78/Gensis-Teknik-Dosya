import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bildirimSayisi } from "@/lib/bildirimSayisi";
import { onaySayisi } from "@/lib/onaySayisi";
import SignOutButton from "@/components/SignOutButton";
import SideNav from "@/components/SideNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, company_id")
    .eq("id", user.id)
    .single();

  const rol = profile?.role ?? "customer";
  const isStaff = rol === "admin" || rol === "gensis";
  let bildirimCount = 0;
  let onayCount = 0;
  try {
    const admin = createAdminClient();
    bildirimCount = await bildirimSayisi(admin, rol, profile?.company_id ?? null);
    if (isStaff) onayCount = await onaySayisi(admin);
  } catch {
    /* sayaç alınamazsa menü yine çalışır */
  }
  const rolTr = rol === "admin" ? "Admin" : rol === "gensis" ? "Gensis Kullanıcı" : "Müşteri";
  const adSoyad = profile?.full_name ?? user.email ?? "";
  const bas = adSoyad.trim().slice(0, 2).toUpperCase() || "GT";

  return (
    <div className="grid grid-cols-[248px_1fr] min-h-screen">
      <aside className="bg-[#f8fafc] border-r border-[#e7ebf2] flex flex-col sticky top-0 h-screen">
        <div className="flex items-center px-5 py-5 border-b border-[#e7ebf2]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GENSIS" style={{ height: 26, width: "auto" }} />
        </div>

        <SideNav role={rol} bildirimCount={bildirimCount} onayCount={onayCount} />

        <div className="p-3">
          <div className="flex items-center gap-3 bg-[#eef1f8] rounded-xl p-3">
            <span
              className="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-bold flex-none"
              style={{ background: "linear-gradient(135deg,#1e2a5b,#33478a)" }}
            >
              {bas}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-slate-800 truncate">{adSoyad}</div>
              <div className="text-[11px] text-[#94a3b8]">{rolTr}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
