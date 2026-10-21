import { requireMe } from "@/lib/api/server";
import SignOutButton from "@/components/SignOutButton";
import SideNav from "@/components/SideNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const rol = me.role;
  // Menü sayaçları (bildirim, onay, takip, muhasebe) C# API'de uçları yazılınca geri gelecek.
  const bildirimCount = 0;
  const onayCount = 0;
  const takipCount = 0;
  const muhasebeCount = 0;
  const rolTr = rol === "admin" ? "Admin" : rol === "gensis" ? "Kullanıcı" : rol === "muhasebeci" ? "Muhasebe/Finans" : "Müşteri";
  const adSoyad = me.fullName ?? me.email;
  const bas = adSoyad.trim().slice(0, 2).toUpperCase() || "DL";

  return (
    <div className="grid grid-cols-[248px_1fr] min-h-screen">
      <aside className="bg-[#f8fafc] border-r border-[#e7ebf2] flex flex-col sticky top-0 h-screen">
        <div className="flex items-center px-5 py-5 border-b border-[#e7ebf2]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dosyalift" style={{ height: 78, width: "auto" }} />
        </div>

        <SideNav role={rol} bildirimCount={bildirimCount} onayCount={onayCount} takipCount={takipCount} muhasebeCount={muhasebeCount} />

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
