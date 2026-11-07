"""Overflow check for the PDFs from run.py (z8qgvccjc8): text that overprints other text, crosses a vertical table
line, or leaves the page. Needs pdfplumber. Exit 1 when anything is found.
  python3 -I measure.py <dir> [<public/kilavuz>]   (in a container: pip install pdfplumber)
Ready-made forms (Son Kontrol, kılavuzlar) carry some overprint of their own: with the kilavuz folder given, problems
already present in the untouched template are not counted.
"""
import glob, os, sys
from collections import Counter
import pdfplumber

MARGIN = 4.0          # pt from the page edge
MIN_OVERLAP = 0.35    # share of the smaller glyph box that must be covered to count as overprint
MIN_OVERLAP_PT = 1.5  # and at least this much horizontally: kerning (e.g. "T-" at 5 pt) touches by a fraction

def boxes_overlap(a, b):
    w = min(a["x1"], b["x1"]) - max(a["x0"], b["x0"]); h = min(a["bottom"], b["bottom"]) - max(a["top"], b["top"])
    if w < MIN_OVERLAP_PT or h <= 0: return 0.0
    small = min((a["x1"] - a["x0"]) * (a["bottom"] - a["top"]), (b["x1"] - b["x0"]) * (b["bottom"] - b["top"])) or 1
    return w * h / small

def check_page(page):
    problems = []
    words = [w for w in page.extract_words(use_text_flow=False, keep_blank_chars=False) if w["text"].strip()]
    for w in words:
        if w["x0"] < MARGIN or w["x1"] > page.width - MARGIN or w["top"] < 0 or w["bottom"] > page.height:
            problems.append(f"off page: {w['text'][:40]!r}")
    # Overprint: two words from different lines/columns on top of each other.
    for i, a in enumerate(words):
        for b in words[i + 1:]:
            if boxes_overlap(a, b) >= MIN_OVERLAP:
                problems.append(f"overprint: {a['text'][:30]!r} / {b['text'][:30]!r}")
    # Crossing a vertical cell border that runs through the word's line.
    verticals = [e for e in page.edges if abs(e["x0"] - e["x1"]) < 0.5 and (e["bottom"] - e["top"]) > 4]
    for w in words:
        for e in verticals:
            x = e["x0"]
            if w["x0"] + 1.0 < x < w["x1"] - 1.0 and e["top"] - 1 <= w["top"] and w["bottom"] <= e["bottom"] + 1:
                problems.append(f"crosses cell border: {w['text'][:40]!r}")
                break
    return problems

TEMPLATES = {"son_kontrol_formu": ["SON_KONTROL_FORMU.pdf"],
             "kullanma_bakim_klavuzu": ["KBT_E_1-1.pdf", "KBT_E_1-2.pdf", "KBT_H.pdf"]}

def problems(path):
    with pdfplumber.open(path) as pdf:
        return len(pdf.pages), [f"p{n}: {p}" for n, page in enumerate(pdf.pages, 1) for p in check_page(page)]

def main(root, kilavuz=None):
    total = 0
    known = {}
    if kilavuz:
        for code, files in TEMPLATES.items():
            c = Counter()
            for f in files:
                if os.path.exists(os.path.join(kilavuz, f)): c |= Counter(problems(os.path.join(kilavuz, f))[1])
            known[code] = c
    for f in sorted(glob.glob(os.path.join(root, "*", "*.pdf"))):
        pages, found = problems(f)
        code = os.path.splitext(os.path.basename(f))[0]
        if code in known: found = list((Counter(found) - known[code]).elements())
        name = os.path.relpath(f, root)
        if found:
            total += len(found)
            print(f"FAIL {name} ({pages} p) — {len(found)}")
            for p in found[:6]: print("     ", p)
        else:
            print(f"ok   {name} ({pages} p)")
    print(f"\n{total} problem(s)")
    return 1 if total else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
