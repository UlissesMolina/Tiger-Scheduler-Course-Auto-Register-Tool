"""Snapshot every section of Auburn's open terms from the public Banner 9 class search.

No login: Banner's class search is anonymous once a term is set on the session.
Writes one file per term, data/sections-{term}.json, plus data/terms.json as an
index. Standard library only, so the Actions runner needs no pip install.

    python scripts/fetch_sections.py            # every term not marked "View Only"
    python scripts/fetch_sections.py 202720     # one term

FORCE_WRITE=1 writes a term even when it came back far smaller than the
committed file (a real shrink, e.g. a term's schedule being cut).
"""

import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://erpssb.auburn.edu/StudentRegistration/ssb"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PAGE_SIZE = 500  # Banner's maximum
PAGE_DELAY = 1.0  # seconds between requests, to be polite to a production system
RETRIES = 4
# A term that comes back with fewer than this share of the committed sections is
# treated as a broken run, not a real change, and is left alone.
SHRINK_FLOOR = 0.8
USER_AGENT = "auburn-sections-snapshot (+https://github.com/UlissesMolina/Tiger-Scheduler-Course-Auto-Register-Tool)"

DAYS = [("monday", "M"), ("tuesday", "T"), ("wednesday", "W"), ("thursday", "R"),
        ("friday", "F"), ("saturday", "S"), ("sunday", "U")]


class FetchError(Exception):
    pass


class BannerSession:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.opener.addheaders = [("User-Agent", USER_AGENT), ("Accept", "application/json, text/html")]

    def request(self, path, params=None, data=None):
        url = f"{BASE}/{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        for attempt in range(1, RETRIES + 1):
            try:
                with self.opener.open(url, data=body, timeout=90) as resp:
                    return resp.read().decode("utf-8")
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                if attempt == RETRIES:
                    raise FetchError(f"{path}: {e}") from e
                wait = 2 ** attempt
                print(f"  retry {attempt}/{RETRIES - 1} for {path} in {wait}s ({e})")
                time.sleep(wait)

    def json(self, path, params=None, data=None):
        text = self.request(path, params, data)
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise FetchError(f"{path}: expected JSON, got {text[:120]!r}") from e

    def set_term(self, term):
        self.request("term/termSelection", {"mode": "search"})
        self.request("term/search", {"mode": "search"}, {"term": term})

    def reset(self):
        # Banner keeps the last search on the session; without this the next
        # term's search can come back with the previous one's results.
        self.request("classSearch/resetDataForm", data={})


def get_terms(session):
    terms = session.json("classSearch/getTerms", {"searchTerm": "", "offset": 1, "max": 30})
    return [{"code": t["code"], "description": t["description"]} for t in terms]


def open_terms(terms):
    return [t for t in terms if "view only" not in t["description"].lower()]


def fetch_term(session, term):
    session.set_term(term)
    sections, offset, total = {}, 0, None
    while total is None or offset < total:
        page = session.json("searchResults/searchResults", {
            "txt_term": term,
            "pageOffset": offset,
            "pageMaxSize": PAGE_SIZE,
            # CRN is unique, so pages never overlap or skip a section.
            "sortColumn": "courseReferenceNumber",
            "sortDirection": "asc",
        })
        if not page.get("success") or page.get("data") is None:
            raise FetchError(f"term {term}: search failed at offset {offset}")
        total = page["totalCount"]
        if not page["data"] and offset < total:
            raise FetchError(f"term {term}: empty page at offset {offset} of {total}")
        for raw in page["data"]:
            sections[raw["courseReferenceNumber"]] = raw
        offset += PAGE_SIZE
        print(f"  {term}: {min(offset, total)}/{total}")
        time.sleep(PAGE_DELAY)
    session.reset()
    if len(sections) != total:
        raise FetchError(f"term {term}: got {len(sections)} sections, Banner reported {total}")
    return [normalize(sections[crn]) for crn in sorted(sections)]


def normalize(raw):
    """Keep what a course finder needs, in short keys, so a term stays a few MB."""
    meetings = []
    for mf in raw.get("meetingsFaculty") or []:
        m = mf.get("meetingTime") or {}
        meetings.append({
            "days": "".join(code for key, code in DAYS if m.get(key)),
            "begin": m.get("beginTime"),
            "end": m.get("endTime"),
            "building": m.get("building"),
            "room": m.get("room"),
            "type": m.get("meetingType"),
            "startDate": m.get("startDate"),
            "endDate": m.get("endDate"),
        })
    low, high = raw.get("creditHourLow"), raw.get("creditHourHigh")
    return {
        "crn": raw["courseReferenceNumber"],
        "subject": raw["subject"],
        "number": raw["courseNumber"],
        "section": raw["sequenceNumber"],
        "title": raw.get("courseTitle"),
        "credits": low if not high else [low, high],
        "schedule": raw.get("scheduleTypeDescription"),
        "method": raw.get("instructionalMethodDescription"),
        "campus": raw.get("campusDescription"),
        "partOfTerm": raw.get("partOfTerm"),
        "enrolled": raw.get("enrollment"),
        "capacity": raw.get("maximumEnrollment"),
        "available": raw.get("seatsAvailable"),
        "waitlist": raw.get("waitCount"),
        "waitCapacity": raw.get("waitCapacity"),
        "linked": bool(raw.get("isSectionLinked")),
        "instructors": [
            {"name": f["displayName"], "email": f.get("emailAddress"), "primary": bool(f.get("primaryIndicator"))}
            for f in raw.get("faculty") or []
        ],
        "meetings": meetings,
        "attributes": sorted(a["code"] for a in raw.get("sectionAttributes") or []),
    }


def term_path(term):
    return DATA_DIR / f"sections-{term}.json"


def load_committed(term):
    path = term_path(term)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def check_shrink(term, sections, committed, force):
    """Return an error message when a run looks broken rather than real."""
    if committed is None or force:
        return None
    before = committed.get("count", 0)
    if before and len(sections) < before * SHRINK_FLOOR:
        return (f"term {term}: {len(sections)} sections vs {before} committed; "
                f"refusing to write (set FORCE_WRITE=1 if the shrink is real)")
    return None


def dump(doc):
    """One section per line, so a git diff shows exactly which sections moved."""
    head = {k: v for k, v in doc.items() if k != "sections"}
    lines = [json.dumps(s, ensure_ascii=False, separators=(",", ":")) for s in doc["sections"]]
    head_json = json.dumps(head, ensure_ascii=False, indent=2)
    return head_json[:-2] + ',\n  "sections": [\n' + ",\n".join(lines) + "\n  ]\n}\n"


def write_term(term, description, sections, committed):
    """Write the term file; return the doc actually on disk. Untouched if nothing changed."""
    if committed is not None and committed.get("sections") == sections:
        print(f"  {term}: no change")
        return committed
    doc = {
        "term": term,
        "description": description,
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(sections),
        "sections": sections,
    }
    term_path(term).write_text(dump(doc), encoding="utf-8", newline="\n")
    print(f"  {term}: wrote {len(sections)} sections")
    return doc


def write_index(terms):
    """Index every term file on disk, newest first, so the site knows what to load."""
    descriptions = {t["code"]: t["description"] for t in terms}
    entries = []
    for path in sorted(DATA_DIR.glob("sections-*.json"), reverse=True):
        doc = json.loads(path.read_text(encoding="utf-8"))
        entries.append({
            "code": doc["term"],
            "description": descriptions.get(doc["term"], doc["description"]),
            "file": path.name,
            "count": doc["count"],
            "fetchedAt": doc["fetchedAt"],
        })
    text = json.dumps({"terms": entries}, indent=2) + "\n"
    index = DATA_DIR / "terms.json"
    if not index.exists() or index.read_text(encoding="utf-8") != text:
        index.write_text(text, encoding="utf-8", newline="\n")


def main(argv):
    force = os.getenv("FORCE_WRITE") == "1"
    DATA_DIR.mkdir(exist_ok=True)
    session = BannerSession()
    terms = get_terms(session)
    if argv:
        known = {t["code"]: t for t in terms}
        missing = [code for code in argv if code not in known]
        if missing:
            print(f"Unknown term(s): {', '.join(missing)}. Banner lists: {', '.join(known)}")
            return 2
        targets = [known[code] for code in argv]
    else:
        targets = open_terms(terms)
    if not targets:
        print("Banner lists no open terms; nothing to do.")
        return 1

    failures = []
    for t in targets:
        code = t["code"]
        print(f"{code} {t['description']}")
        try:
            sections = fetch_term(session, code)
        except FetchError as e:
            failures.append(str(e))
            print(f"  FAILED: {e}")
            session = BannerSession()  # start the next term on a clean session
            continue
        committed = load_committed(code)
        problem = check_shrink(code, sections, committed, force)
        if problem:
            failures.append(problem)
            print(f"  REFUSED: {problem}")
            continue
        write_term(code, t["description"], sections, committed)

    write_index(terms)
    # Terms that did succeed are already on disk, so the workflow can still
    # commit them before this exit code turns the job red.
    if failures:
        print("\n" + "\n".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
