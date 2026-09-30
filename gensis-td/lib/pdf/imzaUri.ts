import sharp from "sharp";

// Mühendis imzasını react-pdf'in güvenle basabileceği temiz bir PNG data URI'ye çevirir.
// Telefonla çekilmiş progressive/CMYK JPEG'ler react-pdf'te sessizce düşebildiği için
// görsel her durumda yeniden kodlanır; şeffaflık korunur.
export async function imzaToPngDataUri(bytes: Uint8Array): Promise<string | null> {
  try {
    const png = await sharp(Buffer.from(bytes))
      .rotate() // EXIF yönünü uygula
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    // sharp çözemezse ham baytları PNG/JPEG olarak denemeye bırak (son çare)
    try {
      return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    } catch {
      return null;
    }
  }
}
