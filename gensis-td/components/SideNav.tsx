"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; match: (p: string) => boolean; badge?: number };

export default function SideNav({ isAdmin, bildirimCount = 0 }: { isAdmin: boolean; bildirimCount?: number }) {
  const path = usePathname();
  const items: Item[] = [
    { href: "/bildirimler", label: "Bildirimler", icon: "notifications", match: (p) => p.startsWith("/bildirimler"), badge: bildirimCount },
    { href: "/proje-onay", label: "Proje Onay Dosyası", icon: "fact_check", match: (p) => p.startsWith("/proje-onay") },
    { href: "/panel", label: "Asansör Teknik Dosyası", icon: "note_add", match: (p) => p === "/panel" || p.startsWith("/panel/") || p === "/yeni" },
  ];
  if (isAdmin) items.push({ href: "/admin", label: "Yönetim", icon: "admin_panel_settings", match: (p) => p.startsWith("/admin") });

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
