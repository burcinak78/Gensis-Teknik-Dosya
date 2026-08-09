import { createTakipUploadUrl, recordTakipDoc } from "@/app/(app)/proje-takip/actions";

// Tarayıcıdan doğrudan Supabase Storage'a yükleme (Vercel fonksiyon gövde
// limitine takılmaz — büyük mimari/proje dosyaları için gerekli).
export async function uploadTakipFile(
  supabase: any, takipId: string, kind: string, file: File
): Promise<{ ok: boolean; error?: string }> {
  const up = await createTakipUploadUrl(takipId, kind, file.name);
  if (!up.ok) return { ok: false, error: up.error };
  const { error } = await supabase.storage.from("documents").uploadToSignedUrl(up.path, up.token, file);
  if (error) return { ok: false, error: "Depolamaya yüklenemedi: " + error.message };
  const rec = await recordTakipDoc(takipId, kind, up.path, file.name);
  if (!rec.ok) return { ok: false, error: rec.error };
  return { ok: true };
}
