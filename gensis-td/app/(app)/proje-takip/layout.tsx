import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjeTakipLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  // Admin/Kullanıcı düzenleyebilir; Muhasebe/Finans salt-okunur görüntüler
  if (!["admin", "gensis", "muhasebeci"].includes(prof?.role as string)) redirect("/panel");
  return <>{children}</>;
}
