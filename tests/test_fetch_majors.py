import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fetch_majors as fm  # noqa: E402


def link(code, shown=None):
    return (f'<a href="/search/?P={code.replace(" ", "%20")}" title="{code}" '
            f'class="bubblelink code">{shown or code}</a>')


PLAN = f"""
<table class="sc_plangrid">
<tr class="plangridyear"><th colspan="4">Freshman</th></tr>
<tr><th>Fall</th><th>Hours</th><th>Spring</th><th>Hours</th></tr>
<tr><td>{link("COMP 1210")} Fundamentals I</td><td>3</td><td>{link("COMP 2210")} Fundamentals II</td><td>4</td></tr>
<tr><td>Core Science Sequence (Series B, D, H) 1</td><td>4</td><td>Core Literature</td><td>3</td></tr>
<tr class="plangridyear"><th colspan="4">Junior</th></tr>
<tr><td>{link("PHIL 1020")} Ethics or {link("PHIL 1110", " 1110")} Ethics and Science</td><td>3</td>
<td>Technical Elective 1</td><td>9</td></tr>
<tr><td>Core Social Science Elective</td><td>3</td><td>{link("COMP 3270")}</td><td>3</td></tr>
</table>
"""

CORE = f"""
<h2>English Composition: 6 hours required</h2>
<table class="sc_courselist"><tr><td>{link("ENGL 1100/")}</td></tr></table>
<h2>Literature (at least 3 hours)</h2>
<table class="sc_courselist"><tr><td>{link("ENGL 2200/2207")}</td><td>{link("ENGL 2230")}</td></tr></table>
<h2>History (at least 3 hours)</h2>
<table class="sc_courselist"><tr><td>{link("HIST 1010/1017")}</td></tr></table>
<h3>Read and think critically (SL-B)</h3>
<table class="sc_courselist"><tr><td>{link("ENGL 9999")}</td></tr></table>
"""


class ParseTest(unittest.TestCase):
    def test_expand_codes(self):
        self.assertEqual(fm.expand_codes("ENGL 2200/2207"), ["ENGL 2200", "ENGL 2207"])
        self.assertEqual(fm.expand_codes("ENGL 1100/"), ["ENGL 1100"])
        self.assertEqual(fm.expand_codes("ENGL\xa02230"), ["ENGL 2230"])
        self.assertEqual(fm.expand_codes("UNIV 4AA0"), ["UNIV 4AA0"])

    def test_plan_grid_courses_years_and_core_areas(self):
        required, areas, placeholders = fm.parse_major(PLAN)
        self.assertEqual(required["COMP 1210"], "Freshman")
        self.assertEqual(required["COMP 2210"], "Freshman")
        self.assertEqual(required["COMP 3270"], "Junior")
        # "or 1110" is shown without its subject; the link title has it.
        self.assertEqual(required["PHIL 1110"], "Junior")
        self.assertEqual(areas, ["History", "Literature", "Science", "Social Science"])
        self.assertIn("Technical Elective", placeholders)

    def test_core_lists_by_heading(self):
        core = fm.parse_core(CORE)
        self.assertEqual(core["Composition"], ["ENGL 1100"])
        self.assertEqual(core["Literature"], ["ENGL 2200", "ENGL 2207", "ENGL 2230"])
        self.assertEqual(core["History"], ["HIST 1010", "HIST 1017"])
        self.assertNotIn("ENGL 9999", sum(core.values(), []))

    def test_home_subjects_ignore_gateway_courses(self):
        finance = {"ACCT 2110": None, "ACCT 2210": None, "ENGL 1100": None, "ENGL 1120": None,
                   "FINC 3610": None, "FINC 3620": None, "FINC 3630": None, "BUSI 3100": None}
        self.assertEqual(fm.home_subjects(finance), ["FINC"])
        # Few upper-level requirements: fall back to every level.
        psych = {"PSYC 2010": None, "PSYC 2120": None, "PSYC 2130": None, "MATH 1100": None}
        self.assertEqual(fm.home_subjects(psych), ["PSYC"])

    def test_list_majors_strips_zero_width_spaces(self):
        page = '<a href="/undergraduate/x/computerscience_major/">Computer​ Science</a>'
        self.assertEqual(fm.list_majors(page), {"/undergraduate/x/computerscience_major/": "Computer Science"})


if __name__ == "__main__":
    unittest.main()
