import { apiGet, isStaff as staffRole, requireMe } from "@/lib/api/server";
import BildirimlerClient from "./BildirimlerClient";

export const dynamic = "force-dynamic";

type Notifications = {
  musteri: { id: string; companyId: string; firma: string; docType: string; belgeNo: string | null; validUntil: string }[];
  muhendis: { id: string; engineerId: string; ad: string; brans: string; docType: string; validUntil: string }[];
  ekipman: { id: string; kategori: string | null; belgeTipi: string | null; certNo: string; firma: string | null; validUntil: string }[];
};

export default async function BildirimlerPage() {
  const me = await requireMe();
  const role = me.role;
  const isStaff = staffRole(role);

  // Valid until within 30 days or already expired; the API applies the role rules (equipment: staff only).
  const BELGE_TIPI_TR: Record<string, string> = {
    mod_b: "Mod B", mod_c2: "Mod C2", mod_e: "Mod E", modul_h: "Modül H", uygunluk_beyani: "Uygunluk Beyanı", tip_inceleme: "Tip İnceleme", yangin: "Yangın Sertifikası", deney_raporu: "Deney Raporu",
  };
  const n = (await apiGet<Notifications>("/api/notifications")) ?? { musteri: [], muhendis: [], ekipman: [] };

  const musteri = n.musteri.map((d) => ({
    id: d.id, companyId: d.companyId, firma: d.firma ?? "—", docType: d.docType, belgeNo: d.belgeNo, valid_until: d.validUntil,
  }));
  const muhendis = n.muhendis.map((d) => ({
    id: d.id, engineerId: d.engineerId, ad: d.ad ?? "—", brans: d.brans ?? "", docType: d.docType, valid_until: d.validUntil,
  }));
  const ekipman = n.ekipman.map((c) => ({
    id: c.id, kategori: c.kategori ?? "—", belgeTipi: BELGE_TIPI_TR[c.belgeTipi ?? ""] ?? "—", certNo: c.certNo ?? "",
    firma: c.firma ?? "—", valid_until: c.validUntil,
  }));

  return <BildirimlerClient role={role} isStaff={isStaff} musteri={musteri} muhendis={muhendis} ekipman={ekipman} />;
}
