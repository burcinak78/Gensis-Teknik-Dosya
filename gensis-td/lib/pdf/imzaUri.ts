// Mühendis imzasını react-pdf'in basabileceği bir data URI'ye çevirir.
// (Harici bağımlılık yok — Vercel derlemesinde sorun çıkmaması için sharp kullanılmaz.)
// MIME türü dosya içeriğinin sihirli baytlarından belirlenir; PNG değilse JPEG varsayılır.
export async function imzaToPngDataUri(bytes: Uint8Array): Promise<string | null> {
  try {
    if (!bytes || bytes.length < 4) return null;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const mime = isPng ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
