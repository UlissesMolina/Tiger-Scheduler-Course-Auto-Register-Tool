import sys
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import watch  # noqa: E402


def section(crn, available, subject="COMP", number="1210", waitlist=0):
    return {"crn": crn, "subject": subject, "number": number, "section": "001",
            "available": available, "enrolled": 30 - available, "capacity": 30, "waitlist": waitlist}


class ScheduleTest(unittest.TestCase):
    def test_quiet_hours_across_midnight(self):
        quiet = watch.parse_quiet_hours("23-7")
        self.assertTrue(watch.is_quiet(datetime(2026, 11, 6, 23, 30), quiet))
        self.assertTrue(watch.is_quiet(datetime(2026, 11, 6, 3, 0), quiet))
        self.assertFalse(watch.is_quiet(datetime(2026, 11, 6, 7, 0), quiet))
        self.assertFalse(watch.is_quiet(datetime(2026, 11, 6, 14, 0), quiet))

    def test_quiet_hours_same_day_and_off(self):
        self.assertTrue(watch.is_quiet(datetime(2026, 11, 6, 2, 0), (1, 6)))
        self.assertFalse(watch.is_quiet(datetime(2026, 11, 6, 2, 0), watch.parse_quiet_hours("")))

    def test_sleeps_until_quiet_hours_end(self):
        quiet = (23, 7)
        self.assertEqual(watch.seconds_until_awake(datetime(2026, 11, 6, 23, 0), quiet), 8 * 3600)
        self.assertEqual(watch.seconds_until_awake(datetime(2026, 11, 7, 6, 30), quiet), 1800)

    def test_delay_is_random_within_range_and_floored(self):
        for _ in range(50):
            self.assertTrue(5 * 60 <= watch.next_delay(5, 15) <= 15 * 60)
        # Misconfigured to every 10 seconds: still at least 3 minutes.
        self.assertGreaterEqual(watch.next_delay(0.1, 0.2), watch.MIN_INTERVAL_FLOOR * 60)

    def test_failures_back_off_up_to_an_hour(self):
        with mock.patch.object(watch.random, "uniform", return_value=10):
            self.assertEqual(watch.next_delay(5, 15, failures=1), 1200)
            self.assertEqual(watch.next_delay(5, 15, failures=10), 3600)

    def test_end_date_defaults_to_three_weeks(self):
        self.assertEqual(watch.watch_until("", date(2026, 11, 6)), date(2026, 11, 27))
        self.assertEqual(watch.watch_until("2027-01-15", date(2026, 11, 6)), date(2027, 1, 15))


class AlertLogicTest(unittest.TestCase):
    def test_alerts_once_when_a_seat_opens(self):
        self.assertEqual(watch.newly_open([section("1", 2)], {}), [section("1", 2)])  # open at first check
        self.assertEqual(watch.newly_open([section("1", 2)], {"1": 2}), [])  # still open: no repeat
        self.assertEqual(watch.newly_open([section("1", 1)], {"1": 0}), [section("1", 1)])  # reopened
        self.assertEqual(watch.newly_open([section("1", 0)], {"1": 3}), [])  # closed

    def test_crns_narrow_only_their_own_course(self):
        sections = [section("1", 1), section("2", 1), section("3", 1, number="2660", subject="MATH")]
        self.assertEqual([s["crn"] for s in watch.watched_sections(sections, {"2"})], ["2", "3"])
        self.assertEqual(len(watch.watched_sections(sections, set())), 3)

    def test_description_warns_about_waitlist(self):
        code, text = watch.describe(section("15801", 1, waitlist=4))
        self.assertEqual(code, "COMP 1210-001")
        self.assertIn("CRN 15801", text)
        self.assertIn("4 on the waitlist", text)


if __name__ == "__main__":
    unittest.main()
