// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { KILAVUZ_SCALE, shrinkPagesForFooter, shrunkY } from "./kilavuzLayout.ts";

const A4 = { w: 595.28, h: 841.89 };
const FOOTER_LINE = 32; // route.ts draws the footer line here

test("the lowest body line of the manuals clears the footer line", () => {
  // KBT_H p.7 reached 31 pt (measured 2026-11-06); keep at least 20 pt between it and the line.
  assert.ok(shrunkY(31, A4.h) - FOOTER_LINE >= 20);
  // The top of the page hardly moves: text 77 pt from the top stays within 3 pt of where it was.
  assert.ok(Math.abs((A4.h - shrunkY(A4.h - 77, A4.h)) - 77) < 3);
});

test("shrinking keeps the page count and sizes", async () => {
  const src = await PDFDocument.create();
  src.addPage([A4.w, A4.h]);
  src.addPage([A4.w, A4.h]);
  const out = await shrinkPagesForFooter(src);
  assert.equal(out.getPageCount(), 2);
  for (const p of out.getPages()) {
    const { width, height } = p.getSize();
    assert.equal(width, A4.w);
    assert.equal(height, A4.h);
  }
  assert.ok(KILAVUZ_SCALE < 1 && KILAVUZ_SCALE > 0.9);
});
