// One rule for every PDF cell and value (z8qgvccjc8): text is measured with the real font, wrapped at spaces, and a
// token wider than the cell (a long model name, serial number, e-mail) is split where it has to be, so nothing runs
// into the next cell or off the page. If the lines do not fit, the size goes down to `minSize`, then the last line
// ends with "…". Pure: the caller passes the font measure (react-pdf: Roboto via fontkit, pdf-lib: widthOfTextAtSize).

export type Measure = (text: string, size: number) => number;

export type FitOptions = {
  width: number;          // text area in pt (cell width minus padding and borders)
  size: number;           // preferred font size
  minSize?: number;       // smallest size before truncating (default 6)
  maxLines?: number;      // lines the cell may grow to (default: unlimited)
  shrinkFirst?: boolean;  // try one line at a smaller size before wrapping
  shrinkFloor?: number;   // how far shrinkFirst may go, share of `size` (default 0.85; 0 = down to minSize)
  lowest?: boolean;       // compact pass: the size that gives the lowest cell (lines × size), not the largest
  step?: number;
};

export type Fitted = { text: string; size: number; lines: string[]; truncated: boolean };

export const ELLIPSIS = "…";
const SAFETY = 0.75; // pt: renderer rounding must not push a measured line over
export const SHRINK_FIRST_FLOOR = 0.85;

/** Greedy wrap at spaces; existing line breaks stay; a word wider than the line is split by characters. */
export function wrapLines(text: string, width: number, size: number, measure: Measure): string[] {
  const out: string[] = [];
  const fits = (s: string) => measure(s, size) <= width;
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/ +/).filter((w) => w !== "")) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) { line = candidate; continue; }
      if (line) { out.push(line); line = ""; }
      if (fits(word)) { line = word; continue; }
      // Too wide on its own: cut it into pieces that fit.
      let piece = "";
      for (const ch of Array.from(word)) {
        if (piece && !fits(piece + ch)) { out.push(piece); piece = ch; } else piece += ch;
      }
      line = piece;
    }
    out.push(line);
  }
  return out;
}

function sizes(from: number, to: number, step: number): number[] {
  const list: number[] = [];
  for (let s = from; s > to + 1e-9; s = Math.round((s - step) * 100) / 100) list.push(s);
  list.push(to);
  return list;
}

export function fitText(value: unknown, measure: Measure, opts: FitOptions): Fitted {
  const text = value === null || value === undefined ? "" : String(value);
  const width = Math.max(1, opts.width - SAFETY);
  const minSize = Math.min(opts.minSize ?? 6, opts.size);
  const maxLines = opts.maxLines ?? Infinity;
  const all = sizes(opts.size, minSize, opts.step ?? 0.25);
  if (!text.trim()) return { text, size: opts.size, lines: [text], truncated: false };

  // One-page cells: a little smaller on one line reads better than two lines, but not much smaller (85%).
  if (opts.shrinkFirst && maxLines > 1) {
    const floor = Math.max(minSize, opts.size * (opts.shrinkFloor ?? SHRINK_FIRST_FLOOR));
    for (const s of all.filter((x) => x >= floor)) {
      const lines = wrapLines(text, width, s, measure);
      if (lines.length === 1) return { text: lines[0], size: s, lines, truncated: false };
    }
  }
  let best: Fitted | null = null;
  for (const s of all) {
    const lines = wrapLines(text, width, s, measure);
    if (lines.length > maxLines) continue;
    const fitted = { text: lines.join("\n"), size: s, lines, truncated: false };
    if (!opts.lowest) return fitted;
    if (!best || lines.length * s < best.lines.length * best.size - 1e-9) best = fitted;
  }
  if (best) return best;
  // Still too long at the smallest size: keep what fits and mark the cut.
  const lines = wrapLines(text, width, minSize, measure).slice(0, maxLines);
  let last = lines[lines.length - 1];
  while (last && measure(last + ELLIPSIS, minSize) > width) last = Array.from(last).slice(0, -1).join("");
  lines[lines.length - 1] = last.trimEnd() + ELLIPSIS;
  return { text: lines.join("\n"), size: minSize, lines, truncated: true };
}
