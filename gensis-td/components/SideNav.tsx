"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; match: (p: string) => boolean };

export default function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items: Item[] = [
    { href: "/panel", label: "Panel", icon: "dashboard", match: (p) => p === "/panel" || p.startsWith("/panel/") },
    { href: "/proje-onay", label: "Proje Onay Dosyası", icon: "fact_check", match: (p) => p.startsWith("/proje-onay") },
    { href: "/yeni", label: "Yeni Teknik Dosya", icon: "note_add", match: (p) => p === "/yeni" },
  ];
  if (isAdmin) items.push({ href: "/admin", label: "Yönetim", icon: "admin_panel_settings", match: (p) => p.startsWith("/admin") });

  return (
    <nav className="p-3 flex-1 space-y-1">
      {items.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.href}
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
          </Link>
        );
      })}
    </nav>
  );
}
