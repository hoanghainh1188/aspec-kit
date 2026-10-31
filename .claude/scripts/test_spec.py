#!/usr/bin/env python3
"""Deterministic helper for `/test-spec` — テスト仕様書 (Japanese Test Specification).

Validates the 7-column Japanese test specification table (`No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考`)
in `docs/test-specs/<NNN>-<slug>.md`, checks that every Acceptance Criterion (AC) in `specs/*<slug>*/spec.md`
is covered, and exports an Excel-ready CSV (UTF-8 with BOM + CRLF).

Usage:
    python3 .claude/scripts/test_spec.py export docs/test-specs/<NNN>-<slug>.md [--spec <spec.md>]
    python3 .claude/scripts/test_spec.py summary docs/test-specs/<NNN>-<slug>.(md|csv)

Uses Python standard library only (no network, no third-party packages).
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys

COLUMNS = ("No", "観点", "前提条件", "手順", "期待結果", "結果", "備考")
RESULTS = ("", "OK", "NG", "未実施", "対象外", "保留")

FEATURE_RE = re.compile(r"^(\d{3,})-[a-z0-9][a-z0-9-]*$")
ID_RE = re.compile(r"^TC-(\d{3,})-(\d{2,})$")
BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
AC_HEADING_RE = re.compile(r"^##\s+Acceptance\s+criteria\b", re.IGNORECASE)
NUMBERED_RE = re.compile(r"^\s*(\d+)\.\s")
AC_REF_RE = re.compile(r"\bAC[-_\s]*(\d+)\b", re.IGNORECASE)


class TestSpecError(Exception):
    """Validation or file format error in a テスト仕様書."""


def feature_of(path: str) -> str:
    stem = os.path.splitext(os.path.basename(path))[0]
    if not FEATURE_RE.match(stem):
        raise TestSpecError(f"tên file phải là <NNN>-<slug>.md|csv (khớp branch), thấy: {stem}")
    return stem


def split_row(line: str) -> list[str]:
    """Split a Markdown table row, respecting escaped pipes `\\|`."""
    body = line.strip()
    if body.startswith("|"):
        body = body[1:]
    if body.endswith("|") and not body.endswith("\\|"):
        body = body[:-1]
    cells = re.split(r"(?<!\\)\|", body)
    return [c.strip().replace("\\|", "|") for c in cells]


def md_cell_to_text(cell: str) -> str:
    return BR_RE.sub("\n", cell).strip()


def parse_markdown(text: str) -> list[dict[str, str]]:
    """Extract the table whose header matches COLUMNS."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        if tuple(split_row(line)) != COLUMNS:
            continue
        rows: list[dict[str, str]] = []
        for raw in lines[i + 2:]:
            if not raw.lstrip().startswith("|"):
                break
            cells = split_row(raw)
            if len(cells) != len(COLUMNS):
                raise TestSpecError(f"dòng bảng có {len(cells)} cột, cần {len(COLUMNS)}: {raw.strip()}")
            rows.append({k: md_cell_to_text(v) for k, v in zip(COLUMNS, cells)})
        return rows
    raise TestSpecError("không tìm thấy bảng có header: | " + " | ".join(COLUMNS) + " |")


def read_csv_text(path: str) -> str:
    with open(path, "rb") as f:
        raw = f.read()
    for enc in ("utf-8-sig", "cp932"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise TestSpecError(f"{path}: không đọc được bằng UTF-8 hay Shift_JIS (cp932)")


def parse_csv(text: str) -> list[dict[str, str]]:
    reader = csv.reader(io.StringIO(text, newline=""))
    header = next(reader, None)
    if header is None or tuple(h.strip() for h in header) != COLUMNS:
        raise TestSpecError("header CSV phải là: " + ",".join(COLUMNS))
    rows: list[dict[str, str]] = []
    for cells in reader:
        if not any(c.strip() for c in cells):
            continue
        if len(cells) != len(COLUMNS):
            raise TestSpecError(f"dòng CSV có {len(cells)} cột, cần {len(COLUMNS)}: {cells}")
        rows.append({k: v.replace("\r\n", "\n").strip() for k, v in zip(COLUMNS, cells)})
    return rows


def load_rows(path: str) -> list[dict[str, str]]:
    if path.endswith(".csv"):
        return parse_csv(read_csv_text(path))
    with open(path, encoding="utf-8") as f:
        return parse_markdown(f.read())


def validate(rows: list[dict[str, str]], feature: str) -> list[str]:
    """Validate structure and IDs; return non-blocking warnings."""
    if not rows:
        raise TestSpecError("bảng テスト仕様書 rỗng")
    number = FEATURE_RE.match(feature).group(1)
    warnings: list[str] = []
    for idx, row in enumerate(rows, start=1):
        tc_id = row["No"]
        m = ID_RE.match(tc_id)
        if not m:
            raise TestSpecError(f"No '{tc_id}' sai định dạng — cần TC-{number}-NN")
        if m.group(1) != number:
            raise TestSpecError(f"No '{tc_id}' không khớp feature {feature} (cần TC-{number}-NN)")
        if int(m.group(2)) != idx:
            raise TestSpecError(f"No '{tc_id}' ở dòng {idx}: ID phải liên tục TC-{number}-01..NN")
        for req_col in ("観点", "前提条件", "手順", "期待結果"):
            if not row[req_col]:
                raise TestSpecError(f"{tc_id}: cột {req_col} không được để trống")
        if row["結果"] not in RESULTS:
            raise TestSpecError(
                f"{tc_id}: 結果 '{row['結果']}' không hợp lệ — dùng {'/'.join(r for r in RESULTS if r)} (hoặc để trống)"
            )
        if row["結果"] == "NG" and not row["備考"]:
            warnings.append(f"{tc_id}: 結果 là NG nhưng 備考 chưa ghi nguyên nhân / ticket lỗi")
    return warnings


def count_spec_acs(spec_path: str) -> int:
    with open(spec_path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    count, inside = 0, False
    for line in lines:
        if line.startswith("## "):
            inside = bool(AC_HEADING_RE.match(line))
            continue
        if inside and NUMBERED_RE.match(line):
            count += 1
    return count


def check_ac_coverage(rows: list[dict[str, str]], spec_path: str) -> None:
    """Ensure every AC 1..N in `spec.md` is referenced at least once in `備考` or `観点`."""
    total_acs = count_spec_acs(spec_path)
    if total_acs == 0:
        return
    covered: set[int] = set()
    for row in rows:
        combined = f"{row['観点']} {row['備考']}"
        for m in AC_REF_RE.finditer(combined):
            covered.add(int(m.group(1)))
    missing = [f"AC {i}" for i in range(1, total_acs + 1) if i not in covered]
    if missing:
        raise TestSpecError(
            f"spec {spec_path} có {total_acs} AC nhưng テスト仕様書 chưa phủ: {', '.join(missing)} "
            "(ghi mã `AC N` vào cột 備考 hoặc 観点)"
        )


def resolve_default_spec(sheet_path: str, feature: str) -> str | None:
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(sheet_path))))
    direct = os.path.join(root, "specs", feature, "spec.md")
    if os.path.isfile(direct):
        return direct
    slug = feature.split("-", 1)[1] if "-" in feature else feature
    specs_dir = os.path.join(root, "specs")
    if os.path.isdir(specs_dir):
        for entry in sorted(os.listdir(specs_dir)):
            if entry.endswith(f"-{slug}"):
                candidate = os.path.join(specs_dir, entry, "spec.md")
                if os.path.isfile(candidate):
                    return candidate
    return None


def write_csv(rows: list[dict[str, str]], out_path: str) -> None:
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
        writer.writerow(COLUMNS)
        for row in rows:
            writer.writerow([row[c] for c in COLUMNS])


def cmd_export(args: argparse.Namespace) -> int:
    if not args.sheet.endswith(".md"):
        raise TestSpecError("export nhận file .md (nguồn sự thật của テスト仕様書), CSV là output")
    feature = feature_of(args.sheet)
    rows = load_rows(args.sheet)
    warnings = validate(rows, feature)
    spec_path = args.spec or resolve_default_spec(args.sheet, feature)
    if spec_path and os.path.isfile(spec_path):
        check_ac_coverage(rows, spec_path)
    else:
        warnings.append("không tìm thấy spec.md tương ứng — bỏ qua kiểm độ phủ AC")
    out_path = os.path.splitext(args.sheet)[0] + ".csv"
    write_csv(rows, out_path)
    for w in warnings:
        print("⚠ " + w, file=sys.stderr)
    print(f"✓ {len(rows)} test case → {out_path} (UTF-8 BOM)")
    return 0


def cmd_summary(args: argparse.Namespace) -> int:
    feature = feature_of(args.sheet)
    rows = load_rows(args.sheet)
    warnings = validate(rows, feature)
    counts = {"total": len(rows), "OK": 0, "NG": 0, "未実施": 0, "対象外": 0, "保留": 0}
    for row in rows:
        res = row["結果"] or "未実施"
        counts[res] = counts.get(res, 0) + 1
    out = {
        "feature": feature,
        "sheet": args.sheet,
        "counts": counts,
        "warnings": warnings,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="テスト仕様書 (test specification) — validate / CSV / summary")
    sub = p.add_subparsers(dest="cmd", required=True)

    exp = sub.add_parser("export", help="validate file .md rồi xuất .csv (UTF-8 BOM) cạnh nó")
    exp.add_argument("sheet")
    exp.add_argument("--spec", help="đường dẫn tới spec.md (mặc định tự tìm trong specs/)")
    exp.set_defaults(func=cmd_export)

    summ = sub.add_parser("summary", help="tổng hợp thống kê kết quả test ra JSON")
    summ.add_argument("sheet")
    summ.set_defaults(func=cmd_summary)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (TestSpecError, OSError) as e:
        print(f"✗ test_spec: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
