"""Test cho qa_sheet.py — chạy: python3 -m unittest discover -s .claude/scripts"""
from __future__ import annotations

import contextlib
import datetime as dt
import io
import json
import os
import tempfile
import unittest

import qa_sheet

HEADER = "| No | 対象画面/機能 | 質問内容 | 背景・提案 | 回答欄 | 回答期限 | ステータス |\n|---|---|---|---|---|---|---|\n"
INTAKE = "# Intake\n\n## Ambiguities to raise in /speckit-clarify\n1. A\n2. B\n\n## Khác\n1. không tính\n"


def sheet(*rows: str) -> str:
    meta = "| 項目 | 内容 |\n|---|---|\n| 作成日 | 2026-10-31 |\n\n"
    return meta + HEADER + "".join(r + "\n" for r in rows)


ROW1 = "| Q-042-01 | 画面A | 質問1でしょうか。 | 背景<br>提案 |  | 2026-11-06 | 未回答 |"
ROW2 = "| Q-042-02 | 画面B | 質問2 \\| 補足 | 背景 | メールのみ | 2026-11-06 | 回答済 |"


class Base(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        for d in ("docs/qa", "docs/intake", "docs/04-decisions"):
            os.makedirs(os.path.join(self.root, d))
        self.write("docs/intake/042-user-reservation.md", INTAKE)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, rel: str, text: str) -> str:
        path = os.path.join(self.root, rel)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return path

    def run_cli(self, *argv: str) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = qa_sheet.main(list(argv))
        return code, out.getvalue(), err.getvalue()


class ParseTest(Base):
    def test_parses_question_table_only(self) -> None:
        rows = qa_sheet.parse_markdown(sheet(ROW1, ROW2))
        self.assertEqual([r["No"] for r in rows], ["Q-042-01", "Q-042-02"])
        self.assertEqual(rows[0]["背景・提案"], "背景\n提案")
        self.assertEqual(rows[1]["質問内容"], "質問2 | 補足")

    def test_missing_table_raises(self) -> None:
        with self.assertRaises(qa_sheet.SheetError):
            qa_sheet.parse_markdown("# no table\n")

    def test_counts_only_ambiguity_section(self) -> None:
        path = os.path.join(self.root, "docs/intake/042-user-reservation.md")
        self.assertEqual(qa_sheet.count_ambiguities(path), 2)


class ValidateTest(Base):
    def rows(self, *lines: str) -> list[dict[str, str]]:
        return qa_sheet.parse_markdown(sheet(*lines))

    def test_rejects_wrong_feature_number(self) -> None:
        with self.assertRaisesRegex(qa_sheet.SheetError, "không khớp"):
            qa_sheet.validate(self.rows(ROW1.replace("Q-042", "Q-043")), "042-user-reservation")

    def test_rejects_gap_in_ids(self) -> None:
        with self.assertRaisesRegex(qa_sheet.SheetError, "liên tục"):
            qa_sheet.validate(self.rows(ROW2.replace("Q-042-02", "Q-042-03")), "042-user-reservation")

    def test_rejects_unknown_status(self) -> None:
        with self.assertRaisesRegex(qa_sheet.SheetError, "ステータス"):
            qa_sheet.validate(self.rows(ROW1.replace("未回答", "done")), "042-user-reservation")

    def test_warns_answered_without_answer(self) -> None:
        warnings = qa_sheet.validate(self.rows(ROW1.replace("未回答", "回答済")), "042-user-reservation")
        self.assertEqual(len(warnings), 1)


class ExportTest(Base):
    def test_writes_bom_csv_with_crlf(self) -> None:
        path = self.write("docs/qa/042-user-reservation.md", sheet(ROW1, ROW2))
        code, out, _ = self.run_cli("export", path)
        self.assertEqual(code, 0, out)
        with open(path[:-3] + ".csv", "rb") as f:
            raw = f.read()
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
        self.assertIn(b"\r\n", raw)
        rows = qa_sheet.parse_csv(raw.decode("utf-8-sig"))
        self.assertEqual(rows[0]["背景・提案"], "背景\n提案")

    def test_fails_when_ambiguity_has_no_question(self) -> None:
        path = self.write("docs/qa/042-user-reservation.md", sheet(ROW1))
        code, _, err = self.run_cli("export", path)
        self.assertEqual(code, 1)
        self.assertIn("thiếu câu hỏi", err)

    def test_extra_question_must_be_withdrawn(self) -> None:
        row3 = "| Q-042-03 | 画面C | 質問3 | 背景 |  |  | 未回答 |"
        path = self.write("docs/qa/042-user-reservation.md", sheet(ROW1, ROW2, row3))
        self.assertEqual(self.run_cli("export", path)[0], 1)
        self.write("docs/qa/042-user-reservation.md", sheet(ROW1, ROW2, row3.replace("未回答", "取下げ")))
        self.assertEqual(self.run_cli("export", path)[0], 0)


class IngestTest(Base):
    def ingest(self, path: str) -> dict:
        code, out, err = self.run_cli(
            "ingest", path, "--decisions-dir", os.path.join(self.root, "docs/04-decisions")
        )
        self.assertEqual(code, 0, err)
        return json.loads(out)

    def test_picks_answered_and_skips_recorded(self) -> None:
        path = self.write("docs/qa/042-user-reservation.md", sheet(ROW1, ROW2))
        result = self.ingest(path)
        self.assertEqual([p["id"] for p in result["pending"]], ["Q-042-02"])
        self.assertEqual(result["unanswered"], ["Q-042-01"])

        self.write("docs/04-decisions/2026-11-07-notify.md", "- Mã câu hỏi (質問票): `Q-042-02`\n")
        self.write("docs/04-decisions/INDEX.md", "Q-042-01 không được tính\n")
        result = self.ingest(path)
        self.assertEqual(result["pending"], [])
        self.assertEqual(result["already_recorded"], ["Q-042-02"])

    def test_reads_excel_shift_jis_csv(self) -> None:
        path = os.path.join(self.root, "docs/qa/042-user-reservation.csv")
        lines = [",".join(qa_sheet.COLUMNS), "Q-042-01,画面A,質問1,背景,両方,2026-11-06,回答済"]
        with open(path, "w", encoding="cp932", newline="") as f:
            f.write("\r\n".join(lines) + "\r\n")
        result = self.ingest(path)
        self.assertEqual(result["pending"][0]["answer"], "両方")

    def test_warns_when_answer_present_but_status_open(self) -> None:
        path = self.write("docs/qa/042-user-reservation.md", sheet(ROW1.replace("|  |", "| 両方 |"), ROW2.replace("回答済", "確認中")))
        result = self.ingest(path)
        self.assertEqual([p["id"] for p in result["pending"]], ["Q-042-01", "Q-042-02"])
        self.assertEqual(len(result["warnings"]), 2)


class DueTest(unittest.TestCase):
    def test_skips_weekend(self) -> None:
        # 2026-10-30 là thứ Sáu → +1 ngày làm việc = thứ Hai 2026-11-02
        self.assertEqual(qa_sheet.add_business_days(dt.date(2026, 10, 30), 1), dt.date(2026, 11, 2))


if __name__ == "__main__":
    unittest.main()
