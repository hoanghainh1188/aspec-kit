"""Unit tests for traceability.py — run: python3 -m unittest discover -s .claude/scripts"""
from __future__ import annotations

import contextlib
import io
import json
import os
import tempfile
import unittest

import traceability


SPEC_MD = """# Spec — Sample Feature
## Acceptance criteria
1. User can view pending reservations.
2. Assignee can approve or reject with reason.
"""

TASKS_MD = """# Tasks
- [x] **T1** — `src/features/demo/approve.ts`: implement approval *(AC 2)*
- [ ] **T2** — `src/features/demo/list.ts`: implement list *(AC 1)*
- [ ] **T3** — Future task awaiting clarify
"""


class TraceabilityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        for d in (
            "docs/intake",
            "docs/02-detail-design/demo",
            "specs/042-demo",
            "src/features/demo",
        ):
            os.makedirs(os.path.join(self.root, d), exist_ok=True)
        self.write("docs/intake/042-demo.md", "# Intake\n")
        self.write("docs/02-detail-design/demo/field-spec-v1.md", "# Detail Design\n")
        self.write("specs/042-demo/spec.md", SPEC_MD)
        self.write("specs/042-demo/tasks.md", TASKS_MD)
        self.write("src/features/demo/approve.ts", "// AC 2\nexport function approve() {}\n")
        self.write(
            "src/features/demo/approve.test.ts",
            'import { it } from "vitest";\nit("approves reservation (AC 2)", () => {});\n',
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, rel: str, text: str) -> str:
        path = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return path

    def run_cli(self, *argv: str) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = traceability.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_extracts_ac_numbers_variants(self) -> None:
        self.assertEqual(traceability.extract_ac_numbers("*(AC 2, 3)*"), [2, 3])
        self.assertEqual(traceability.extract_ac_numbers("AC 2/3/4 of spec.md"), [2, 3, 4])
        self.assertEqual(traceability.extract_ac_numbers("AC-1 and AC 4"), [1, 4])

    def test_analyze_maps_acs_tasks_files_and_tests(self) -> None:
        feats = traceability.discover_features(self.root)
        self.assertEqual(len(feats), 1)
        rep = traceability.analyze_feature(self.root, feats[0])
        self.assertEqual(rep["feature_id"], "042-demo")
        self.assertEqual(len(rep["rows"]), 2)

        r1, r2 = rep["rows"]
        self.assertEqual(r1["ac_id"], "AC 1")
        self.assertEqual(r1["status"], "⏳ Pending task")
        self.assertEqual(r2["ac_id"], "AC 2")
        self.assertEqual(r2["status"], "✅ Covered")
        self.assertEqual(r2["source_files"], ["src/features/demo/approve.ts"])
        self.assertEqual(len(r2["tests"]), 1)

        self.assertEqual(rep["gaps"]["acs_without_tests"], ["AC 1"])
        self.assertEqual(rep["gaps"]["acs_pending_tasks"], ["AC 1"])
        self.assertEqual(rep["gaps"]["unlinked_code"], [])
        self.assertEqual(rep["gaps"]["unmapped_tasks"], ["T3"])

    def test_flags_unlinked_source_file(self) -> None:
        self.write("src/features/demo/orphan.ts", "export const x = 1;\n")
        code, _, err = self.run_cli("check", "--root", self.root)
        self.assertEqual(code, 1)
        self.assertIn("orphan.ts", err)

    def test_strict_check_fails_on_missing_test(self) -> None:
        code_non_strict, _, _ = self.run_cli("check", "--root", self.root)
        self.assertEqual(code_non_strict, 0)
        code_strict, _, err = self.run_cli("check", "--root", self.root, "--strict")
        self.assertEqual(code_strict, 1)
        self.assertIn("AC 1", err)

    def test_generate_writes_markdown(self) -> None:
        out_file = os.path.join(self.root, "docs", "traceability.md")
        code, out, _ = self.run_cli("generate", "--root", self.root, "--out", out_file)
        self.assertEqual(code, 0, out)
        self.assertTrue(os.path.isfile(out_file))
        with open(out_file, encoding="utf-8") as f:
            md = f.read()
        self.assertIn("## Feature `042-demo`", md)
        self.assertIn("| **AC 2** |", md)
        self.assertIn("✅ Covered", md)


if __name__ == "__main__":
    unittest.main()
