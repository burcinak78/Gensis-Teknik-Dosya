// Geçerliliğine 1 aydan az kalan veya süresi dolmuş belge sayısı (rol bazlı).
// Bildirimler menüsündeki rozet ve sayfa ile aynı kuralı kullanır.
export async function bildirimSayisi(admin: any, role: string, companyId: string | null): Promise<number> {
  const isStaff = role === "admin" || role === "gensis";
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const HIC = "00000000-0000-0000-0000-000000000000";
  let total = 0;

  // Müşteri belgeleri
  let cq = admin.from("company_documents").select("id", { count: "exact", head: true })
    .not("valid_until", "is", null).lte("valid_until", cutoffStr);
  if (!isStaff) cq = cq.eq("company_id", companyId ?? HIC);
  const { count: cCount } = await cq;
  total += cCount ?? 0;

  // Mühendis belgeleri
  if (isStaff) {
    const { count } = await admin.from("engineer_documents").select("id", { count: "exact", head: true })
      .not("valid_until", "is", null).lte("valid_until", cutoffStr);
    total += count ?? 0;
  } else {
    const { data } = await admin.from("engineer_documents").select("id, engineers(company_id)")
      .not("valid_until", "is", null).lte("valid_until", cutoffStr);
    total += (data ?? []).filter((d: any) => d.engineers?.company_id === companyId).length;
  }

  // Ekipman sertifikaları — yalnız personel (modele bağlı olmasa da sayılır)
  if (isStaff) {
    const { count } = await admin.from("certificates").select("id", { count: "exact", head: true })
      .not("valid_until", "is", null).lte("valid_until", cutoffStr);
    total += count ?? 0;
  }

  return total;
}
