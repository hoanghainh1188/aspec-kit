# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "openpyxl>=3.1,<4",
#   "pdfplumber>=0.11,<1",
#   "reportlab>=4,<5",
# ]
# ///
"""Tests for .claude/scripts/convert-design.py (stdlib unittest; no pytest needed).

    uv run --script packages/aspec-kit/test/convert/test_convert_design.py
"""
from __future__ import annotations

import hashlib
import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[3]
SCRIPT = REPO_ROOT / ".claude" / "scripts" / "convert-design.py"
FIXTURE = HERE / "fixtures" / "detail-design-sample.xlsx"

_spec = importlib.util.spec_from_file_location("convert_design", SCRIPT)
cd = importlib.util.module_from_spec(_spec)
sys.modules["convert_design"] = cd  # dataclasses look the module up while executing it
_spec.loader.exec_module(cd)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class NamingTest(unittest.TestCase):
    def test_sanitize_keeps_japanese_and_replaces_unsafe_only(self) -> None:
        self.assertEqual(cd.sanitize_filename("画面項目定義"), "画面項目定義")
        self.assertEqual(cd.sanitize_filename('改訂履歴 <v1|v2>'), "改訂履歴 _v1_v2_")
        self.assertEqual(cd.sanitize_filename('a/b\\c:d*e?f"g'), "a_b_c_d_e_f_g")
        self.assertEqual(cd.sanitize_filename("  ...  "), "sheet")

    def test_slugify(self) -> None:
        self.assertEqual(cd.slugify("Field Spec  v1"), "field-spec-v1")
        self.assertEqual(cd.slugify("詳細設計 予約"), "詳細設計-予約")

    def test_cell_text_escapes_markdown(self) -> None:
        self.assertEqual(cd.cell_text("a | b"), "a \\| b")
        self.assertEqual(cd.cell_text("line1\r\nline2"), "line1<br>line2")
        self.assertEqual(cd.cell_text(20.0), "20")
        self.assertEqual(cd.cell_text(None), "")


class DefaultOutDirTest(unittest.TestCase):
    def test_inside_detail_design_folder(self) -> None:
        src = Path("/p/docs/02-detail-design/reservation/raw/v1.xlsx")
        self.assertEqual(cd.default_out_dir(src, Path("/p")), Path("/p/docs/02-detail-design/reservation"))

    def test_outside_detail_design_folder(self) -> None:
        src = Path("/downloads/詳細設計 予約.xlsx")
        self.assertEqual(cd.default_out_dir(src, Path("/p")), Path("/p/docs/02-detail-design/詳細設計-予約"))


class ExcelRoundTripTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="convert-design-")).resolve()
        self.feature_dir = self.tmp / "docs" / "02-detail-design" / "reservation"
        self.feature_dir.mkdir(parents=True)
        self.src = self.feature_dir / FIXTURE.name
        shutil.copyfile(FIXTURE, self.src)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def read(self, name: str) -> str:
        return (self.feature_dir / name).read_text(encoding="utf-8")

    def test_one_markdown_per_sheet_with_japanese_names(self) -> None:
        written = cd.convert(self.src, None, cwd=self.tmp)
        names = sorted(p.name for p in written)
        self.assertEqual(
            names,
            sorted(
                [
                    "detail-design-sample.md",
                    "detail-design-sample__01_表紙.md",
                    "detail-design-sample__02_画面項目定義.md",
                    "detail-design-sample__03_エラーメッセージ.md",
                    "detail-design-sample__04_改訂履歴 _v1_v2_.md",
                ]
            ),
        )
        self.assertTrue(all(p.parent == self.feature_dir for p in written))
        # The heading keeps the original (unsanitized) sheet name
        self.assertIn("# 改訂履歴 <v1|v2>", self.read("detail-design-sample__04_改訂履歴 _v1_v2_.md"))
        self.assertIn("detail-design-sample__02_画面項目定義.md", self.read("detail-design-sample.md"))

    def test_field_table_is_gfm_and_merged_cells_are_expanded(self) -> None:
        cd.convert(self.src, None, cwd=self.tmp)
        md = self.read("detail-design-sample__02_画面項目定義.md")
        self.assertIn("| No | 項目名 | 型 | 桁数 | 必須 | バリデーション |", md)
        self.assertIn("|---|---|---|---|---|---|", md)
        self.assertIn("| 1 | 予約者名 | 文字列 | 50 | ○ | 全角のみ。空白不可 |", md)
        # F4:F5 is merged vertically → the value is repeated in row 5; pipes are escaped
        self.assertIn("| 2 | メールアドレス | 文字列 | 254 | ○ | RFC 5322 形式 \\| 重複不可 |", md)
        self.assertIn("| 3 | 予約日 | 日付 | 10 | ○ | 本日以降<br>営業日のみ |", md)
        self.assertIn("| 4 | 人数 | 数値 | 2 |  | 1〜20 |", md)
        # B:C horizontal merges are collapsed into one column (no duplicated 項目名 column)
        self.assertNotIn("項目名 | 項目名", md)
        self.assertIn("`F4:F5`", md)
        self.assertIn("画面項目定義（予約登録画面）", md)

    def test_cover_sheet_dates_and_merged_labels(self) -> None:
        cd.convert(self.src, None, cwd=self.tmp)
        md = self.read("detail-design-sample__01_表紙.md")
        self.assertIn("詳細設計書", md)
        self.assertIn("| 作成日 | 2026-07-10 |", md)

    def test_original_untouched_and_changelog_appended(self) -> None:
        before = sha256(self.src)
        (self.feature_dir / "CHANGELOG.md").write_text("# CHANGELOG\n\n## v1 — 2026-07-10\n- 初版\n", encoding="utf-8")
        cd.convert(self.src, None, cwd=self.tmp)
        cd.convert(self.src, None, cwd=self.tmp)  # re-run overwrites its own output
        self.assertEqual(sha256(self.src), before)
        log = self.read("CHANGELOG.md")
        self.assertTrue(log.startswith("# CHANGELOG\n\n## v1 — 2026-07-10\n- 初版\n"))
        self.assertEqual(log.count("## Converted `detail-design-sample.xlsx` → Markdown"), 2)
        self.assertIn("**Affected issues:**", log)
        self.assertIn(before[:12], log)

    def test_refuses_to_overwrite_foreign_markdown(self) -> None:
        manual = self.feature_dir / "detail-design-sample.md"
        manual.write_text("hand-written export\n", encoding="utf-8")
        with self.assertRaises(cd.ConvertError):
            cd.convert(self.src, None, cwd=self.tmp)
        self.assertEqual(manual.read_text(encoding="utf-8"), "hand-written export\n")
        self.assertFalse((self.feature_dir / "CHANGELOG.md").exists())
        cd.convert(self.src, None, force=True, cwd=self.tmp)
        self.assertIn("aspec-kit convert", manual.read_text(encoding="utf-8"))

    def test_explicit_out_dir(self) -> None:
        out = self.tmp / "elsewhere"
        written = cd.convert(self.src, out)
        self.assertTrue(all(p.parent == out for p in written))
        self.assertTrue((out / "CHANGELOG.md").exists())

    def test_rejects_unsupported_files(self) -> None:
        for name in ("old.xls", "notes.docx"):
            path = self.tmp / name
            path.write_bytes(b"x")
            with self.assertRaises(cd.ConvertError):
                cd.convert(path, None, cwd=self.tmp)
        with self.assertRaises(cd.ConvertError):
            cd.convert(self.tmp / "missing.xlsx", None, cwd=self.tmp)

    def test_cli_entry_point(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), str(self.src)],
            cwd=self.tmp,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("detail-design-sample__02_画面項目定義.md", result.stdout)
        bad = subprocess.run(
            [sys.executable, str(SCRIPT), str(self.tmp / "missing.pdf")],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertEqual(bad.returncode, 1)
        self.assertIn("file not found", bad.stderr)


class PdfTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="convert-design-pdf-")).resolve()

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def make_pdf(self, path: Path) -> None:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet

        styles = getSampleStyleSheet()
        table = Table([["Field", "Type", "Rule"], ["name", "string", "required"], ["email", "string", "unique"]])
        table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, "black")]))
        doc = SimpleDocTemplate(str(path), pagesize=A4)
        doc.build(
            [
                Paragraph("Reservation field specification", styles["Title"]),
                table,
                PageBreak(),
                Paragraph("Error handling: show E001 under the field.", styles["Normal"]),
            ]
        )

    def test_text_and_tables_per_page(self) -> None:
        src = self.tmp / "field-spec.pdf"
        self.make_pdf(src)
        before = sha256(src)
        out = self.tmp / "out"
        written = cd.convert(src, out)
        self.assertEqual([p.name for p in written], ["field-spec.md"])
        md = (out / "field-spec.md").read_text(encoding="utf-8")
        self.assertIn("## Page 1", md)
        self.assertIn("## Page 2", md)
        self.assertIn("Reservation field specification", md)
        self.assertIn("| Field | Type | Rule |", md)
        self.assertIn("| email | string | unique |", md)
        self.assertIn("Error handling: show E001 under the field.", md)
        # Table cells are not duplicated in the page text
        self.assertNotIn("email string unique", md)
        self.assertEqual(sha256(src), before)
        self.assertIn("field-spec.pdf", (out / "CHANGELOG.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
