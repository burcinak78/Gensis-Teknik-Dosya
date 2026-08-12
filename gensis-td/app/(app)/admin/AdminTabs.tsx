"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: "group" },
  { href: "/admin/muhendisler", label: "Yetkili Mühendisler", icon: "engineering" },
  { href: "/admin/musteriler", label: "Müşteriler", icon: "business" },
  { href: "/admin/ekipmanlar", label: "Güvenlik Ekipmanları", icon: "verified_user" },
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
