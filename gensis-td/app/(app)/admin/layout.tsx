import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/admin/musteriler", label: "Müşteriler" },
  { href: "/admin/kullanicilar", label: "Kullanıcılar" },
  { href: "/admin/ekipmanlar", label: "Ekipman-Model" },
  { href: "/admin/sertifikalar", label: "Sertifikalar" },
];

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
      <div className="bg-white border-b border-slate-200 px-7 pt-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold mb-2">Yönetim</h1>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="px-3 py-2 text-sm font-semibold text-slate-600 rounded-t-lg hover:bg-slate-50 hover:text-brand">
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="p-7">{children}</div>
    </div>
  );
}
