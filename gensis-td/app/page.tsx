import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/server";

export default async function Home() {
  const me = await getMe();
  if (!me) redirect("/giris");
  redirect(me.role === "muhasebeci" ? "/muhasebe" : "/panel");
}
