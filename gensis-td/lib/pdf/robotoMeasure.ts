// Roboto widths for fit.ts on the react-pdf side: the same font files the documents are rendered with.
import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { PUBLIC_DIR } from "./assets";
import type { Measure } from "./fit";

type Font = ReturnType<typeof fontkit.create>;
const fonts: { regular?: Font; bold?: Font } = {};
const cache = new Map<string, number>();

function font(bold: boolean): Font {
  const key = bold ? "bold" : "regular";
  return (fonts[key] ??= fontkit.create(readFileSync(`${PUBLIC_DIR}/fonts/Roboto-${bold ? "Bold" : "Regular"}.ttf`)));
}

/** Width in pt of `text` at `size`. */
export const robotoMeasure = (bold: boolean): Measure => (text, size) => {
  const k = `${bold ? 1 : 0}|${text}`;
  let em = cache.get(k);
  if (em === undefined) {
    const f = font(bold);
    em = f.layout(text).advanceWidth / f.unitsPerEm;
    if (cache.size > 20000) cache.clear();
    cache.set(k, em);
  }
  return em * size;
};
