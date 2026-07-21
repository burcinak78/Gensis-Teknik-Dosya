// Onay bekleyen (pending) kayıt sayısı — yalnız personel için anlamlı.
export async function onaySayisi(admin: any): Promise<number> {
  const { count } = await admin
    .from("pending_changes")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
