"""Unit tests for test_spec.py — run: python3 -m unittest discover -s .claude/scripts"""
from __future__ import annotations

import contextlib
import io
import json
import os
import tempfile
import unittest

import test_spec

HEADER = "| No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考 |\n|---|---|---|---|---|---|---|\n"
SPEC = "# Spec\n\n## Acceptance criteria\n1. First AC\n2. Second AC\n"

ROW1 = "| TC-042-01 | 正常系：一覧表示（AC 1） | 予約が存在すること | 1. 画面を開く | 一覧が表示されること | OK | AC 1 |"
ROW2 = "| TC-042-02 | 異常系：権限エラー（AC 2） | 別担当者であること | 1. 承認を押す | 403エラーとなること | 未実施 | AC 2 |"


def make_sheet(*rows: str) -> str:
    meta = "| 項目 | 内容 |\n|---|---|\n| 作成日 | 2026-10-31 |\n\n"
    return meta + HEADER + "".join(r + "\n" for r in rows)


class TestSpecUnitTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        for d in ("docs/test-specs", "specs/042-user-reservation"):
            os.makedirs(os.path.join(self.root, d), exist_ok=True)
        self.write("specs/042-user-reservation/spec.md", SPEC)

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
            code = test_spec.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_export_writes_bom_csv_and_validates_ac_coverage(self) -> None:
        path = self.write("docs/test-specs/042-user-reservation.md", make_sheet(ROW1, ROW2))
        code, out, _ = self.run_cli("export", path)
        self.assertEqual(code, 0, out)
        csv_path = path[:-3] + ".csv"
        with open(csv_path, "rb") as f:
            raw = f.read()
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
        self.assertIn(b"\r\n", raw)
        rows = test_spec.parse_csv(raw.decode("utf-8-sig"))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["No"], "TC-042-01")

    def test_fails_when_ac_is_uncovered(self) -> None:
        path = self.write("docs/test-specs/042-user-reservation.md", make_sheet(ROW1))
        code, _, err = self.run_cli("export", path)
        self.assertEqual(code, 1)
        self.assertIn("AC 2", err)

    def test_rejects_non_contiguous_ids_or_invalid_result(self) -> None:
        bad_gap = ROW2.replace("TC-042-02", "TC-042-03")
        path = self.write("docs/test-specs/042-user-reservation.md", make_sheet(ROW1, bad_gap))
        self.assertEqual(self.run_cli("export", path)[0], 1)

        bad_res = ROW2.replace("未実施", "PASS")
        path = self.write("docs/test-specs/042-user-reservation.md", make_sheet(ROW1, bad_res))
        self.assertEqual(self.run_cli("export", path)[0], 1)

    def test_summary_outputs_counts_and_warnings(self) -> None:
        ng_row = ROW2.replace("未実施", "NG").replace("| AC 2 |", "|  |")
        path = self.write("docs/test-specs/042-user-reservation.md", make_sheet(ROW1, ng_row))
        code, out, _ = self.run_cli("summary", path)
        self.assertEqual(code, 0)
        data = json.loads(out)
        self.assertEqual(data["counts"]["OK"], 1)
        self.assertEqual(data["counts"]["NG"], 1)
        self.assertEqual(len(data["warnings"]), 1)


if __name__ == "__main__":
    unittest.main()
