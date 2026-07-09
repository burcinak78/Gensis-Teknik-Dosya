"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/musteriler", label: "Müşteriler", icon: "business" },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: "group" },
  { href: "/admin/ekipmanlar", label: "Ekipman-Model", icon: "precision_manufacturing" },
  { href: "/admin/sertifikalar", label: "Sertifikalar", icon: "verified" },
];

export default function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 -mb-px">
      {TABS.map((t) => {
        const active = path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-[2.5px] transition ${
              active ? "text-navy border-navy" : "text-[#94a3b8] border-transparent hover:text-slate-600"
            }`}>
            <span className="material-symbols-rounded text-[19px]">{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
