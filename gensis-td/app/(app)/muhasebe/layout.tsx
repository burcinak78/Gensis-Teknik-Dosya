import { requireMe } from "@/lib/api/server";

export default async function MuhasebeLayout({ children }: { children: React.ReactNode }) {
  // Admin/Muhasebe tam yetki; Kullanıcı (gensis) salt-okunur görüntüler
  await requireMe(["admin", "muhasebeci", "gensis"]);
  return <>{children}</>;
}
