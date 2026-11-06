"""Snapshot every undergraduate major's curriculum and the Core curriculum from Auburn's bulletin.

Writes data/majors.json, which the site uses to filter sections by major:
the courses a major requires (and in which year), the Core areas its plan
leaves open ("Core Literature", "Core Science Sequence", ...), and the
subjects its own courses are in, for suggesting electives.

    python scripts/fetch_majors.py

FORCE_WRITE=1 writes even when far fewer majors come back than are committed.
Standard library only.
"""

import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BULLETIN = "https://bulletin.auburn.edu"
MAJORS_INDEX = f"{BULLETIN}/undergraduate/majors/"
CORE_PAGE = f"{BULLETIN}/Policies/Academic/thecorecurriculum/"
OUT = Path(__file__).resolve().parent.parent / "data" / "majors.json"
PAGE_DELAY = 0.5
RETRIES = 4
SHRINK_FLOOR = 0.8
USER_AGENT = "auburn-majors-snapshot (+https://github.com/UlissesMolina/Tiger-Scheduler-Course-Auto-Register-Tool)"

# Core page section headings -> the area names the site uses.
CORE_AREAS = {
    "English Composition": "Composition",
    "Literature": "Literature",
    "Fine Arts": "Fine Arts",
    "Other Humanities": "Humanities",
    "Mathematics": "Mathematics",
    "Science sequence": "Science",
    "History": "History",
    "Other Social Sciences": "Social Science",
}

# Words in a plan-grid placeholder row -> Core areas that satisfy it, checked
# in order so "Social Science" is not mistaken for "Science".
PLACEHOLDER_AREAS = [
    ("history or literature", ["History", "Literature"]),
    ("social science", ["Social Science", "History"]),
    ("science", ["Science"]),
    ("literature", ["Literature"]),
    ("history", ["History"]),
    ("fine art", ["Fine Arts"]),
    ("humanit", ["Humanities", "Fine Arts", "Literature"]),
    ("math", ["Mathematics"]),
]

YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Fifth Year"]
CODE = re.compile(r"^([A-Z]{2,4})\s?(\d{4}|\d[A-Z0-9]{3})$")


class FetchError(Exception):
    pass


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if isinstance(e, urllib.error.HTTPError) and e.code == 404:
                raise FetchError(f"{url}: 404") from e
            if attempt == RETRIES:
                raise FetchError(f"{url}: {e}") from e
            time.sleep(2 ** attempt)


def text(fragment):
    plain = html.unescape(re.sub(r"<[^>]+>", " ", fragment)).replace(chr(0x200B), "")  # zero-width spaces in names
    return re.sub(r"\s+", " ", plain).strip()


def expand_codes(title):
    """'ENGL 2200/2207' -> ['ENGL 2200', 'ENGL 2207']; 'ENGL 1100/' -> ['ENGL 1100']."""
    title = html.unescape(title).replace("\xa0", " ").strip()
    m = re.match(r"^([A-Z]{2,4})\s?(.*)$", title)
    if not m:
        return []
    subject, numbers = m.groups()
    codes = []
    for n in numbers.split("/"):
        n = n.strip()
        if CODE.match(f"{subject} {n}"):
            codes.append(f"{subject} {n}")
    return codes


def course_titles(fragment):
    """Course codes from CourseLeaf's bubble links; the title holds the full code even for 'or 1110'."""
    codes = []
    for tag in re.findall(r'<a [^>]*bubblelink code[^>]*>', fragment):
        m = re.search(r'title="([^"]+)"', tag)
        if m:
            codes.extend(expand_codes(m.group(1)))
    return codes


def tables(page, cls):
    return re.findall(rf'<table class="{cls}[^"]*".*?</table>', page, re.S)


def parse_core(page):
    """Core area -> sorted course codes, from the first list under each area heading."""
    heads = [(m.start(), text(m.group(0))) for m in re.finditer(r"<h[1-5][^>]*>.*?</h[1-5]>", page, re.S)]
    core = {}
    for m in re.finditer(r'<table class="sc_courselist.*?</table>', page, re.S):
        before = [h for pos, h in heads if pos < m.start()]
        if not before:
            continue
        for prefix, area in CORE_AREAS.items():
            if before[-1].startswith(prefix) and area not in core:
                core[area] = sorted(set(course_titles(m.group(0))))
    return core


def parse_major(page):
    """Required courses with the year they fall in, and the Core areas left open."""
    required, areas, placeholders = {}, set(), set()
    grids = tables(page, "sc_plangrid")
    for grid in grids:
        year = None
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", grid, re.S):
            row_text = text(row)
            if row_text in YEARS:
                year = row_text
                continue
            for cell in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S):
                codes = course_titles(cell)
                for code in codes:
                    required.setdefault(code, year)
                label = text(cell)
                if not codes and label and not re.fullmatch(r"[\d\s.\-]+", label):
                    placeholders.add(re.sub(r"\s*\d+$", "", label))
    if not grids:
        # Some majors list a curriculum instead of a year-by-year plan.
        for table in tables(page, "sc_courselist"):
            for code in course_titles(table):
                required.setdefault(code, None)
    for p in placeholders:
        low = p.lower()
        if "core" not in low and "sequence" not in low:
            continue
        for words, satisfies in PLACEHOLDER_AREAS:
            if words in low:
                areas.update(satisfies)
                break
    return required, sorted(areas), sorted(placeholders)


def home_subjects(required):
    """The subjects a major's own courses are in, for suggesting electives.

    Judged by upper-level (3000+) requirements, because the early years are
    full of other departments' gateway courses (ENGL, MATH, ACCT for business).
    Majors with few upper-level requirements fall back to every level.
    """
    upper = Counter(code.split()[0] for code in required if code.split()[1][0] in "3456")
    if upper and upper.most_common(1)[0][1] >= 2:
        top = upper.most_common(1)[0][1]
        return sorted(s for s, n in upper.items() if n >= max(2, top * 0.5))
    counts = Counter(code.split()[0] for code in required)
    if not counts:
        return []
    top = counts.most_common(1)[0][1]
    return sorted(s for s, n in counts.items() if n >= max(3, top * 0.5))


def list_majors(index_page):
    majors = {}
    for href, label in re.findall(r'<a href="(/undergraduate/[^"]+_major/)"[^>]*>(.*?)</a>', index_page, re.S):
        name = text(label)
        if name and href not in majors:
            majors[href] = name
    return majors


def main():
    sys.stdout.reconfigure(errors="replace")  # Windows consoles can't print every name
    force = os.getenv("FORCE_WRITE") == "1"
    core = parse_core(get(CORE_PAGE))
    if len(core) < len(CORE_AREAS) - 1:
        print(f"Core page parsed into only {sorted(core)}; its layout may have changed.")
        return 1

    listing = list_majors(get(MAJORS_INDEX))
    print(f"{len(listing)} majors listed")
    majors, failures = [], []
    for href, name in sorted(listing.items(), key=lambda kv: kv[1]):
        time.sleep(PAGE_DELAY)
        try:
            page = get(BULLETIN + href)
        except FetchError as e:
            failures.append(str(e))
            continue
        required, areas, placeholders = parse_major(page)
        if not required:
            failures.append(f"{name}: no courses found")
            continue
        majors.append({
            "id": href.rstrip("/").split("/")[-1].removesuffix("_major"),
            "name": name,
            "url": BULLETIN + href,
            "subjects": home_subjects(required),
            "required": dict(sorted(required.items())),
            "coreAreas": areas,
            "placeholders": placeholders,
        })
        print(f"  {name}: {len(required)} required, core {areas}")

    if OUT.exists() and not force:
        before = len(json.loads(OUT.read_text(encoding="utf-8")).get("majors", []))
        if before and len(majors) < before * SHRINK_FLOOR:
            print(f"Only {len(majors)} majors vs {before} committed; refusing to write (FORCE_WRITE=1 to override).")
            return 1

    doc = {"core": core, "majors": majors}
    if OUT.exists():
        old = json.loads(OUT.read_text(encoding="utf-8"))
        if {k: old.get(k) for k in doc} == doc:
            print("No change.")
            return 1 if failures else 0
    doc = {"fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), **doc}
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {len(majors)} majors")
    if failures:
        print("\n" + "\n".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
