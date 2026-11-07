import React from "react";
import { Page as PdfPage, Text as PdfText } from "@react-pdf/renderer";
import { fitText } from "./fit";
import { robotoMeasure } from "./robotoMeasure";

// react-pdf 4 resolves a unitless lineHeight against the element's own fontSize (or its 12pt default) and passes
// the result down in points, so a Page's lineHeight 1.45 at fontSize 10 gave every smaller text a 14.5pt line.
// react-pdf 3 multiplied it by each text's own fontSize, which is what the documents were laid out for.
// Page notes its values and Text re-applies them. Use these in place of react-pdf's Page and Text.
//
// Route handlers get the react-server build of React, which has no context, so the values travel in a module
// variable: React renders a Page's whole subtree before the next Page, and renderPdf runs one render at a time.
let current: { lineHeight: number; fontSize: number } | null = null;

const flatStyle = (style: any): any =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatStyle)) : (style || {});

export function Page(props: React.ComponentProps<typeof PdfPage>) {
  const { lineHeight, fontSize } = flatStyle(props.style);
  current = typeof lineHeight === "number" && typeof fontSize === "number" ? { lineHeight, fontSize } : null;
  return <PdfPage {...props} />;
}

export function Text(props: React.ComponentProps<typeof PdfText>) {
  const page = current;
  const s = flatStyle(props.style);
  let fix: { lineHeight: number } | { fontSize: number } | null = null;
  if (page && s.fontSize != null && s.lineHeight == null) fix = { lineHeight: page.lineHeight };
  else if (page && s.fontSize == null && typeof s.lineHeight === "number") fix = { fontSize: page.fontSize };
  if (!fix) return <PdfText {...props} />;
  return <PdfText {...props} style={[...(Array.isArray(props.style) ? props.style : [props.style]), fix] as any} />;
}

/**
 * A value in a cell of known width (z8qgvccjc8): wrapped, long tokens split, shrunk down to `min` and cut with "…"
 * by lib/pdf/fit.ts, measured with Roboto. `w` is the text area in pt (cell minus padding and borders). Size and
 * weight come from the style unless given; `lines` is how far the cell may grow (default: unlimited).
 */
// Compact pass (z8qgvccjc8): when a one-page document came out longer, the route renders it again with this on.
// Every FitText then shrinks first (down to its minimum), grows to at most 2 lines and takes the lowest cell. The document component sets
// it at the top of its own render, like Page sets `current`: renderPdf runs one render at a time, so it cannot leak.
let compact = false;
export function setCompactFit(on: boolean) {
  compact = on;
}

export function FitText({ w, size, min, lines, shrinkFirst, bold, style, children, ...rest }:
  Omit<React.ComponentProps<typeof PdfText>, "children"> & {
    w: number; size?: number; min?: number; lines?: number; shrinkFirst?: boolean; bold?: boolean; children?: unknown;
  }) {
  const s = flatStyle(style);
  const base = size ?? (typeof s.fontSize === "number" ? s.fontSize : current?.fontSize ?? 10);
  const heavy = bold ?? (s.fontWeight === "bold" || s.fontWeight === 700);
  const value = Array.isArray(children) ? children.join("") : children;
  const fitted = fitText(value, robotoMeasure(heavy), compact
    ? { width: w, size: base, minSize: min, maxLines: Math.min(lines ?? Infinity, 2), shrinkFirst: true, shrinkFloor: 0, lowest: true }
    : { width: w, size: base, minSize: min, maxLines: lines, shrinkFirst });
  return <Text {...rest} style={[...(Array.isArray(style) ? style : [style]), { fontSize: fitted.size }] as any}>{fitted.text}</Text>;
}
