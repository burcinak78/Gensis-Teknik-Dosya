// Proje takip bildirim sayaçları.

// Proje sorumlusuna göre: tahmini tamamlanma tarihi geçmiş / bugün olan ve
// henüz tamamlanmamış proje sayısı (app içi bildirim).
export async function takipBildirimSayisi(admin: any, userId: string | null): Promise<number> {
  if (!userId) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await admin
    .from("takip_projeler")
    .select("id", { count: "exact", head: true })
    .eq("proje_sorumlusu_id", userId)
    .neq("durum", "TAMAMLANDI")
    .not("tahmini_tamamlanma", "is", null)
    .lte("tahmini_tamamlanma", today);
  return count ?? 0;
}

// Muhasebeye gönderilmiş ama işlenmemiş kayıt sayısı.
export async function muhasebeBekleyenSayisi(admin: any): Promise<number> {
  const { count } = await admin
    .from("takip_projeler")
    .select("id", { count: "exact", head: true })
    .eq("muhasebeye_gonderildi", true)
    .or("muhasebe_durumu.is.null,muhasebe_durumu.neq.tamamlandi");
  return count ?? 0;
}
