import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MuhasebeLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin" && prof?.role !== "muhasebeci") redirect("/panel");
  return <>{children}</>;
}
