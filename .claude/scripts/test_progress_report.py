"""Unit tests for progress_report.py — run: python3 -m unittest discover -s .claude/scripts"""
from __future__ import annotations

import contextlib
import io
import json
import os
import tempfile
import unittest

import progress_report

TASKS_MD = """# Tasks
- [x] **T1** — Implemented approval logic
- [x] **T2** — Added unit tests
- [ ] **T3** — Pending notification channel
"""

QA_MD = """# 質問票
| No | 対象画面/機能 | 質問内容 | 背景・提案 | 回答欄 | 回答期限 | ステータス |
|---|---|---|---|---|---|---|
| Q-042-01 | 通知機能 | 通知手段は？ | 背景 |  | 2026-11-06 | 未回答 |
| Q-042-02 | 再申請 | 再申請可否は？ | 背景 | 可能 | 2026-11-06 | 回答済 |
"""

VALID_REPORT = """# 週次進捗報告
## 1. 完了事項（今週の実績）
- 完了A
## 2. 進行中（現在着手中の作業）
- 進行B
## 3. 課題・リスク（ご確認事項）
- Q-042-01
## 4. 来週予定
- 予定C
"""


class ProgressReportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        for d in ("specs/042-user-reservation", "docs/qa", "docs/reports"):
            os.makedirs(os.path.join(self.root, d), exist_ok=True)
        self.write("specs/042-user-reservation/tasks.md", TASKS_MD)
        self.write("docs/qa/042-user-reservation.md", QA_MD)

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
            code = progress_report.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_collect_aggregates_tasks_and_open_qa(self) -> None:
        code, out, err = self.run_cli(
            "collect", "--root", self.root, "--since", "2026-10-25", "--until", "2026-10-31"
        )
        self.assertEqual(code, 0, err)
        data = json.loads(out)
        self.assertEqual(data["period"], {"since": "2026-10-25", "until": "2026-10-31"})
        self.assertEqual(len(data["tasks"]), 1)
        t = data["tasks"][0]
        self.assertEqual(t["completed_count"], 2)
        self.assertEqual(t["pending_count"], 1)
        self.assertEqual(t["progress_pct"], 66.7)

        self.assertEqual(len(data["qa"]), 1)
        q = data["qa"][0]
        self.assertEqual(q["open_count"], 1)
        self.assertEqual(q["answered_count"], 1)
        self.assertEqual(q["open_items"][0]["id"], "Q-042-01")

    def test_validate_checks_four_required_sections(self) -> None:
        good = self.write("docs/reports/2026-10-31-user-reservation.md", VALID_REPORT)
        self.assertEqual(self.run_cli("validate", good)[0], 0)

        bad = self.write(
            "docs/reports/bad.md",
            VALID_REPORT.replace("## 3. 課題・リスク（ご確認事項）", "## 3. その他"),
        )
        code, _, err = self.run_cli("validate", bad)
        self.assertEqual(code, 1)
        self.assertIn("課題・リスク", err)


if __name__ == "__main__":
    unittest.main()
