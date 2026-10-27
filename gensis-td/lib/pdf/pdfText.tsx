import React from "react";
import { Page as PdfPage, Text as PdfText } from "@react-pdf/renderer";

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
