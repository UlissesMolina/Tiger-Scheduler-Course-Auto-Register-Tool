import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fetch_sections as fs  # noqa: E402

RAW = {
    "courseReferenceNumber": "11213",
    "subject": "ACCT",
    "courseNumber": "2110",
    "sequenceNumber": "001",
    "courseTitle": "Principles of Financial Accounting",
    "creditHourLow": 3,
    "creditHourHigh": None,
    "scheduleTypeDescription": "Lecture",
    "instructionalMethodDescription": "Campus",
    "campusDescription": "Auburn Main Campus",
    "partOfTerm": "1",
    "enrollment": 50,
    "maximumEnrollment": 400,
    "seatsAvailable": 350,
    "waitCount": 0,
    "waitCapacity": 5,
    "isSectionLinked": False,
    "faculty": [{"displayName": "Heston, Gregory", "emailAddress": "glh0039@auburn.edu", "primaryIndicator": True}],
    "meetingsFaculty": [{"meetingTime": {
        "monday": True, "wednesday": True, "beginTime": "1230", "endTime": "1345",
        "building": "LOWDR", "room": "113A", "meetingType": "CLAS",
        "startDate": "01/06/2027", "endDate": "04/30/2027",
    }}],
    "sectionAttributes": [{"code": "CMPS"}, {"code": "BU"}],
}


class NormalizeTest(unittest.TestCase):
    def test_keeps_seats_instructors_and_meetings(self):
        s = fs.normalize(RAW)
        self.assertEqual((s["crn"], s["subject"], s["number"], s["section"]), ("11213", "ACCT", "2110", "001"))
        self.assertEqual((s["enrolled"], s["capacity"], s["available"]), (50, 400, 350))
        self.assertEqual((s["waitlist"], s["waitCapacity"]), (0, 5))
        self.assertEqual(s["instructors"], [{"name": "Heston, Gregory", "email": "glh0039@auburn.edu", "primary": True}])
        self.assertEqual(s["meetings"][0]["days"], "MW")
        self.assertEqual((s["meetings"][0]["begin"], s["meetings"][0]["end"]), ("1230", "1345"))
        self.assertEqual(s["attributes"], ["BU", "CMPS"])
        self.assertEqual(s["credits"], 3)

    def test_variable_credits_and_missing_lists(self):
        raw = dict(RAW, creditHourLow=1, creditHourHigh=6, faculty=None, meetingsFaculty=None, sectionAttributes=None)
        s = fs.normalize(raw)
        self.assertEqual(s["credits"], [1, 6])
        self.assertEqual((s["instructors"], s["meetings"], s["attributes"]), ([], [], []))

    def test_thursday_is_r(self):
        raw = dict(RAW, meetingsFaculty=[{"meetingTime": {"tuesday": True, "thursday": True}}])
        self.assertEqual(fs.normalize(raw)["meetings"][0]["days"], "TR")


class TermsTest(unittest.TestCase):
    def test_open_terms_skip_view_only(self):
        terms = [{"code": "202720", "description": "Spring 2027"},
                 {"code": "202630", "description": "Summer 2026 (View Only)"}]
        self.assertEqual([t["code"] for t in fs.open_terms(terms)], ["202720"])


class ShrinkGuardTest(unittest.TestCase):
    def test_first_run_always_writes(self):
        self.assertIsNone(fs.check_shrink("202720", [1] * 10, None, force=False))

    def test_refuses_big_shrink(self):
        self.assertIn("refusing", fs.check_shrink("202720", [1] * 79, {"count": 100}, force=False))

    def test_allows_small_shrink(self):
        self.assertIsNone(fs.check_shrink("202720", [1] * 80, {"count": 100}, force=False))

    def test_force_overrides(self):
        self.assertIsNone(fs.check_shrink("202720", [1], {"count": 100}, force=True))


class FetchTermTest(unittest.TestCase):
    def session(self, pages):
        s = mock.Mock(spec=fs.BannerSession)
        s.json.side_effect = pages
        return s

    @mock.patch.object(fs, "PAGE_DELAY", 0)
    @mock.patch.object(fs, "PAGE_SIZE", 1)
    def test_pages_until_total_and_sorts_by_crn(self):
        b = dict(RAW, courseReferenceNumber="2")
        a = dict(RAW, courseReferenceNumber="1")
        s = self.session([{"success": True, "totalCount": 2, "data": [b]},
                          {"success": True, "totalCount": 2, "data": [a]}])
        self.assertEqual([x["crn"] for x in fs.fetch_term(s, "202720")], ["1", "2"])
        s.reset.assert_called_once()

    @mock.patch.object(fs, "PAGE_DELAY", 0)
    def test_short_result_is_an_error(self):
        s = self.session([{"success": True, "totalCount": 3, "data": [RAW]},
                          {"success": True, "totalCount": 3, "data": []}])
        with mock.patch.object(fs, "PAGE_SIZE", 1), self.assertRaises(fs.FetchError):
            fs.fetch_term(s, "202720")

    def test_failed_search_is_an_error(self):
        s = self.session([{"success": False, "data": None}])
        with self.assertRaises(fs.FetchError):
            fs.fetch_term(s, "202720")


class WriteTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        patcher = mock.patch.object(fs, "DATA_DIR", Path(self.tmp.name))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)

    def test_dump_is_valid_json_one_section_per_line(self):
        sections = [fs.normalize(RAW), fs.normalize(dict(RAW, courseReferenceNumber="11214"))]
        doc = fs.write_term("202720", "Spring 2027", sections, None)
        text = fs.term_path("202720").read_text(encoding="utf-8")
        self.assertEqual(json.loads(text), doc)
        self.assertEqual(sum(1 for line in text.splitlines() if line.startswith('{"crn"')), 2)

    def test_unchanged_sections_leave_file_alone(self):
        sections = [fs.normalize(RAW)]
        doc = fs.write_term("202720", "Spring 2027", sections, None)
        before = fs.term_path("202720").read_bytes()
        again = fs.write_term("202720", "Spring 2027", sections, doc)
        self.assertIs(again, doc)
        self.assertEqual(fs.term_path("202720").read_bytes(), before)

    def test_index_lists_term_files_newest_first(self):
        fs.write_term("202710", "Fall 2026", [fs.normalize(RAW)], None)
        fs.write_term("202720", "Spring 2027", [fs.normalize(RAW)], None)
        fs.write_index([{"code": "202720", "description": "Spring 2027"}])
        index = json.loads((Path(self.tmp.name) / "terms.json").read_text(encoding="utf-8"))
        self.assertEqual([t["code"] for t in index["terms"]], ["202720", "202710"])
        self.assertEqual(index["terms"][1]["description"], "Fall 2026")


if __name__ == "__main__":
    unittest.main()
