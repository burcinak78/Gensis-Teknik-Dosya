"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; match: (p: string) => boolean; badge?: number };

export default function SideNav({
  role, bildirimCount = 0, onayCount = 0, takipCount = 0, muhasebeCount = 0,
}: { role: string; bildirimCount?: number; onayCount?: number; takipCount?: number; muhasebeCount?: number }) {
  const path = usePathname();
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "gensis";
  const isMuhasebeci = role === "muhasebeci";
  const isCustomer = !isStaff && !isMuhasebeci;

  const items: Item[] = [];
  // Bildirimler: Muhasebe/Finans hariç herkes (muhasebeci sadece Muhasebe + Proje Takip görür)
  if (!isMuhasebeci) items.push(
    { href: "/bildirimler", label: "Bildirimler", icon: "notifications", match: (p) => p.startsWith("/bildirimler"), badge: bildirimCount },
  );
  // Proje Takip, Bildirimler'in hemen altında
  if (isStaff) items.push({ href: "/proje-takip", label: "Proje Takip", icon: "table_view", match: (p) => p.startsWith("/proje-takip"), badge: takipCount });
  if (isStaff) items.push({ href: "/onaylar", label: "Onay Bekleyenler", icon: "rate_review", match: (p) => p.startsWith("/onaylar"), badge: onayCount });
  if (isStaff) items.push(
    { href: "/proje-onay", label: "Proje Onay Dosyası", icon: "fact_check", match: (p) => p.startsWith("/proje-onay") },
    { href: "/panel", label: "Asansör Teknik Dosyası", icon: "note_add", match: (p) => p === "/panel" || p.startsWith("/panel/") || p === "/yeni" },
  );
  // Muhasebe/Finans: sadece Proje Takip (salt-okunur) + Muhasebe
  if (isMuhasebeci) items.push(
    { href: "/proje-takip", label: "Proje Takip", icon: "table_view", match: (p) => p.startsWith("/proje-takip") },
  );
  if (isCustomer) items.push(
    { href: "/proje-onay", label: "Proje Onay Dosyası", icon: "fact_check", match: (p) => p.startsWith("/proje-onay") },
    { href: "/panel", label: "Asansör Teknik Dosyası", icon: "note_add", match: (p) => p === "/panel" || p.startsWith("/panel/") || p === "/yeni" },
    { href: "/firmam", label: "Firmam", icon: "apartment", match: (p) => p.startsWith("/firmam") },
    { href: "/muhendislerim", label: "Mühendislerim", icon: "engineering", match: (p) => p.startsWith("/muhendislerim") },
  );
  // Muhasebe: Admin ve Muhasebe/Finans tam; Kullanıcı (gensis) salt-okunur
  if (isAdmin || isMuhasebeci || isStaff) items.push({ href: "/muhasebe", label: "Muhasebe", icon: "account_balance", match: (p) => p.startsWith("/muhasebe"), badge: (isAdmin || isMuhasebeci) ? muhasebeCount : 0 });
  // Yönetim: Admin ve Kullanıcı (gensis)
  if (isStaff) items.push({ href: "/admin", label: "Yönetim", icon: "admin_panel_settings", match: (p) => p.startsWith("/admin") });

  return (
    <nav className="p-3 flex-1 space-y-1">
      {items.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.label}
            href={it.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
              active ? "text-navy" : "text-[#5b6472] hover:bg-[#eef1f7]"
            }`}
            style={active ? { background: "linear-gradient(90deg, rgba(30,42,91,.12), rgba(30,42,91,.02))" } : undefined}
          >
            <span className="material-symbols-rounded text-[20px]" style={{ color: active ? "#1e2a5b" : "#94a3b8" }}>
              {it.icon}
            </span>
            {it.label}
            {!!it.badge && it.badge > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
