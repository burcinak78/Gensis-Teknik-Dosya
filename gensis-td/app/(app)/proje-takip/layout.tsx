import { requireMe } from "@/lib/api/server";

export default async function ProjeTakipLayout({ children }: { children: React.ReactNode }) {
  // Admin/Kullanıcı düzenleyebilir; Muhasebe/Finans salt-okunur görüntüler
  await requireMe(["admin", "gensis", "muhasebeci"]);
  return <>{children}</>;
}
