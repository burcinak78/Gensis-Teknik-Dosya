import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import Logo from "@/components/Logo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const rol = profile?.role ?? "customer";

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen">
      <aside className="bg-side text-slate-300 flex flex-col sticky top-0 h-screen">
        <div className="px-4 py-4 border-b border-white/10">
          <Logo variant="light" height={26} />
        </div>
        <nav className="p-3 flex-1 space-y-1">
          <Link
            href="/panel"
            className="block px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm font-semibold"
          >
            Panel
          </Link>
          <Link
            href="/yeni"
            className="block px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm font-semibold"
          >
            + Yeni Teknik Dosya
          </Link>
          {rol === "admin" && (
            <Link
              href="/admin"
              className="block px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm font-semibold"
            >
              Yönetim
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs">
          <div className="text-slate-200 font-semibold">
            {profile?.full_name ?? user.email}
          </div>
          <div className="mb-2 capitalize">{rol}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
