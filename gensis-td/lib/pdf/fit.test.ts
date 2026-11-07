// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { ELLIPSIS, fitText, wrapLines, type Measure } from "./fit.ts";

// Monospace stand-in: every character is 0.5 em wide.
const mono: Measure = (t, size) => Array.from(t).length * size * 0.5;
const widest = (lines: string[], size: number) => Math.max(...lines.map((l) => mono(l, size)));

test("words wrap at spaces and stay whole", () => {
  assert.deepEqual(wrapLines("ab cd ef", 25, 10, mono), ["ab cd", "ef"]);
});

test("a token wider than the cell is split, never left running over", () => {
  const lines = wrapLines("TESTMODELXK2000PLUSNOSPACE", 40, 10, mono);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(""), "TESTMODELXK2000PLUSNOSPACE"); // nothing lost, no hyphen added
  assert.ok(widest(lines, 10) <= 40);
});

test("fits within the allowed lines, shrinking only when it must", () => {
  const short = fitText("kısa", mono, { width: 100, size: 8, maxLines: 1 });
  assert.equal(short.size, 8);
  const long = fitText("a".repeat(30), mono, { width: 100, size: 8, maxLines: 1, minSize: 6 });
  assert.ok(long.size < 8 && long.size >= 6);
  assert.equal(long.lines.length, 1);
  assert.ok(widest(long.lines, long.size) <= 100);
});

test("one-page cells try a smaller size before taking a second line, but not much smaller", () => {
  const f = fitText("a".repeat(22), mono, { width: 100, size: 10, maxLines: 2, shrinkFirst: true, minSize: 6 });
  assert.equal(f.lines.length, 1);
  assert.ok(f.size < 10 && f.size >= 8.5);
  const far = fitText("a".repeat(36), mono, { width: 100, size: 10, maxLines: 2, shrinkFirst: true, minSize: 6 });
  assert.equal(far.lines.length, 2); // one line would need ~5.5 pt: wrap instead
  assert.ok(far.size >= 6);
  const compact = fitText("a".repeat(36), mono, { width: 100, size: 10, maxLines: 2, shrinkFirst: true, shrinkFloor: 0, minSize: 5 });
  assert.equal(compact.lines.length, 1); // compact pass: as small as needed before wrapping
  // Too long for one line even at the minimum: the compact pass takes the lowest cell, not the largest 2-line size.
  const low = fitText("a".repeat(60), mono, { width: 100, size: 10, maxLines: 2, shrinkFirst: true, shrinkFloor: 0, minSize: 5, lowest: true });
  const tall = fitText("a".repeat(60), mono, { width: 100, size: 10, maxLines: 2, minSize: 5 });
  assert.equal(low.lines.length, 2);
  assert.ok(low.size < tall.size);
  const g = fitText("a".repeat(22), mono, { width: 100, size: 10, maxLines: 2, minSize: 6 });
  assert.equal(g.lines.length, 2); // without shrinkFirst it wraps at the preferred size
  assert.equal(g.size, 10);
});

test("too long even at the smallest size: cut with an ellipsis inside the cell", () => {
  const f = fitText("x".repeat(500), mono, { width: 60, size: 8, maxLines: 2, minSize: 6 });
  assert.equal(f.truncated, true);
  assert.equal(f.lines.length, 2);
  assert.ok(f.text.endsWith(ELLIPSIS));
  assert.ok(widest(f.lines, f.size) <= 60);
});

test("empty values stay empty", () => {
  assert.equal(fitText(null, mono, { width: 50, size: 8 }).text, "");
  assert.equal(fitText("   ", mono, { width: 50, size: 8 }).text, "   ");
});
