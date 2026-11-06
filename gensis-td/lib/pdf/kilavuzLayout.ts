// Ready-made manuals (public/kilavuz/KBT_*.pdf) get the company footer stamped at a fixed height (line 32 pt from
// the bottom, see app/api/pdf/teknik-dosya/route.ts). Their body text reaches 31-57 pt on some pages, so it ran
// into the footer (z8qgvcc825). Every page is redrawn slightly smaller, anchored at the top and centred: the lowest
// line (31 pt) moves to ~55 pt and the header area stays where it was.
import { PDFDocument } from "pdf-lib";

export const KILAVUZ_SCALE = 0.97;

/** Where a point of the original page ends up after the shrink (same page size). */
export function shrunkY(y: number, pageHeight: number, scale = KILAVUZ_SCALE): number {
  return pageHeight * (1 - scale) + y * scale;
}

/** A new document with every page of `src` drawn at `scale`, top-aligned and horizontally centred. */
export async function shrinkPagesForFooter(src: PDFDocument, scale = KILAVUZ_SCALE): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const pages = src.getPages();
  const embedded = await out.embedPages(pages);
  embedded.forEach((page, i) => {
    const { width, height } = pages[i].getSize();
    out.addPage([width, height]).drawPage(page, {
      x: (width * (1 - scale)) / 2, y: height * (1 - scale), xScale: scale, yScale: scale,
    });
  });
  return out;
}
