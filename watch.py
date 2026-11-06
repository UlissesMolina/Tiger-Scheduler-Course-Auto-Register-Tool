"""Alert-only seat watcher: tells you when a watched section opens; you register yourself.

It never logs in. It reads Auburn's public class search, a couple of requests
per watched course, at a random 5-15 minute interval, pauses overnight, and
stops on its own after an end date so it cannot quietly run for months.

    python watch.py                 # watch COURSES from .env
    python watch.py --once          # one check, print the seats, exit
    python watch.py --test-alert    # send a test notification and exit
"""

import argparse
import logging
import os
import random
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta

from config import Config
from notifier import send_email_alert
from scripts.fetch_sections import BannerSession, FetchError, normalize

# However it is configured, never check more often than this.
MIN_INTERVAL_FLOOR = 3
DEFAULT_RUN_DAYS = 21
FAILURE_ALERT_AFTER = 5
REQUEST_GAP = 2  # seconds between courses within one check

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("logs/watch.log", encoding="utf-8")],
)
log = logging.getLogger("watch")


# ---------- schedule ----------

def parse_quiet_hours(value):
    """'23-7' -> (23, 7); '' -> None."""
    if not value:
        return None
    start, end = (int(x) for x in value.split("-"))
    return start % 24, end % 24


def is_quiet(now, quiet):
    if not quiet:
        return False
    start, end = quiet
    h = now.hour
    return (start <= h or h < end) if start > end else (start <= h < end)


def seconds_until_awake(now, quiet):
    """Seconds from a quiet-hours moment to the end of quiet hours."""
    wake = now.replace(hour=quiet[1], minute=0, second=0, microsecond=0)
    if wake <= now:
        wake += timedelta(days=1)
    return (wake - now).total_seconds()


def next_delay(min_minutes, max_minutes, failures=0):
    """A random wait in seconds, doubled per consecutive failure up to an hour."""
    low = max(MIN_INTERVAL_FLOOR, min_minutes)
    high = max(low, max_minutes)
    delay = random.uniform(low, high) * 60
    if failures:
        delay = min(delay * 2 ** failures, 3600)
    return delay


def watch_until(value, today):
    """The last day to watch: the configured date, or DEFAULT_RUN_DAYS from today."""
    if value:
        return date.fromisoformat(value)
    return today + timedelta(days=DEFAULT_RUN_DAYS)


# ---------- checking ----------

def fetch_courses(term, courses):
    """Every section of each watched course, from the public class search."""
    session = BannerSession()
    session.set_term(term)
    sections = []
    for i, code in enumerate(courses):
        if i:
            time.sleep(REQUEST_GAP)
        subject, number = code.split()
        page = session.json("searchResults/searchResults", {
            "txt_term": term,
            "txt_subject": subject,
            "txt_courseNumber": number,
            "pageOffset": 0,
            "pageMaxSize": 100,
            "sortColumn": "courseReferenceNumber",
            "sortDirection": "asc",
        })
        if not page.get("success") or page.get("data") is None:
            raise FetchError(f"search for {code} failed")
        if not page["data"]:
            log.info(f"{code}: no sections in term {term}")
        sections.extend(normalize(raw) for raw in page["data"])
        session.reset()
    return sections


def watched_sections(sections, crns):
    """With CRNs given, a course that has any of them is narrowed to just those sections."""
    if not crns:
        return sections
    courses_with_crn = {(s["subject"], s["number"]) for s in sections if s["crn"] in crns}
    return [s for s in sections if s["crn"] in crns or (s["subject"], s["number"]) not in courses_with_crn]


def newly_open(sections, previous):
    """Sections with seats now that had none (or were unseen) at the last check."""
    return [s for s in sections if (s["available"] or 0) > 0 and (previous.get(s["crn"]) or 0) <= 0]


def describe(s):
    code = f"{s['subject']} {s['number']}-{s['section']}"
    text = f"{code} (CRN {s['crn']}): {s['available']} open, {s['enrolled']}/{s['capacity']} enrolled."
    if s["waitlist"]:
        text += f" {s['waitlist']} on the waitlist, so the seat may be held for them."
    return code, text


# ---------- alerts ----------

def send_ntfy(title, message):
    if not Config.NTFY_TOPIC:
        return
    req = urllib.request.Request(
        f"{Config.NTFY_SERVER.rstrip('/')}/{Config.NTFY_TOPIC}",
        data=message.encode("utf-8"),
        headers={"Title": title, "Priority": "high", "Tags": "white_check_mark", "Click": Config.URL},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=20).close()
    except Exception as e:
        log.error(f"ntfy alert failed: {e}")


def alert(title, message):
    log.info(f"ALERT {title}: {message}")
    send_ntfy(title, message)
    send_email_alert(title, message)


# ---------- main ----------

def parse_args():
    p = argparse.ArgumentParser(description="Alert when a watched section has an open seat.")
    p.add_argument("--courses", help='Comma-separated courses, e.g. "COMP 1210,MATH 2660" (default: COURSES)')
    p.add_argument("--once", action="store_true", help="Check once, print every section's seats, and exit")
    p.add_argument("--test-alert", action="store_true", help="Send a test notification and exit")
    return p.parse_args()


def main():
    args = parse_args()
    if args.test_alert:
        alert("Test alert", "Seat watcher notifications are working.")
        return 0
    if not Config.NTFY_TOPIC and not Config.EMAIL_NOTIFICATIONS_ENABLED and not args.once:
        log.error("No way to alert you: set NTFY_TOPIC or enable email in .env.")
        return 2

    courses = [c.strip().upper() for c in (args.courses.split(",") if args.courses else Config.COURSES) if c.strip()]
    term, crns = Config.TERM_CODE, set(Config.WATCH_CRNS)
    quiet = parse_quiet_hours(Config.QUIET_HOURS)
    until = watch_until(Config.WATCH_UNTIL, date.today())

    if args.once:
        for s in watched_sections(fetch_courses(term, courses), crns):
            print(describe(s)[1])
        return 0

    log.info(f"Watching {', '.join(courses)} in term {term}"
             + (f", CRNs {', '.join(sorted(crns))}" if crns else "")
             + f"; every {Config.WATCH_MIN_MINUTES}-{Config.WATCH_MAX_MINUTES} min"
             + (f", quiet {quiet[0]}:00-{quiet[1]}:00" if quiet else "")
             + f", until {until}")

    previous, failures = {}, 0
    while True:
        now = datetime.now()
        if now.date() > until:
            log.info(f"Past the end date ({until}); stopping. Set WATCH_UNTIL to keep watching.")
            return 0
        if is_quiet(now, quiet):
            wait = seconds_until_awake(now, quiet)
            log.info(f"Quiet hours; sleeping {wait / 3600:.1f}h")
            time.sleep(wait + random.uniform(0, 300))
            continue

        try:
            sections = watched_sections(fetch_courses(term, courses), crns)
            for s in newly_open(sections, previous):
                code, text = describe(s)
                alert(f"Seat open: {code}", text)
            changed = [s for s in sections if previous.get(s["crn"]) != s["available"]]
            for s in changed:
                log.info(describe(s)[1])
            previous = {s["crn"]: s["available"] for s in sections}
            failures = 0
        except (FetchError, ValueError, KeyError) as e:
            failures += 1
            log.warning(f"Check failed ({failures} in a row): {e}")
            if failures == FAILURE_ALERT_AFTER:
                alert("Seat watcher can't reach Auburn", f"{failures} checks in a row failed; it will keep retrying, more slowly. Last error: {e}")

        delay = next_delay(Config.WATCH_MIN_MINUTES, Config.WATCH_MAX_MINUTES, failures)
        log.info(f"Next check in {delay / 60:.1f} min")
        time.sleep(delay)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log.info("Stopped.")
