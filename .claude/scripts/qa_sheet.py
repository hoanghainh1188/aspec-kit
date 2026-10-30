#!/usr/bin/env python3
"""Phần tất định (deterministic) của /qa-sheet — 質問票 (Q&A sheet).

LLM viết nội dung câu hỏi (敬語) vào `docs/qa/<NNN>-<slug>.md`; script này lo những việc
KHÔNG được để LLM tự do: validate bảng, xuất CSV (UTF-8 BOM, CRLF → mở thẳng bằng Excel),
đọc lại sheet đã có câu trả lời, lọc câu đã ghi vào `docs/04-decisions/`.

    python3 .claude/scripts/qa_sheet.py due [--days 5] [--from YYYY-MM-DD]
    python3 .claude/scripts/qa_sheet.py export docs/qa/<NNN>-<slug>.md [--intake <file>]
    python3 .claude/scripts/qa_sheet.py ingest docs/qa/<NNN>-<slug>.(md|csv) [--decisions-dir <dir>]

Chỉ dùng stdlib, không cần mạng.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import re
import sys

COLUMNS = ("No", "対象画面/機能", "質問内容", "背景・提案", "回答欄", "回答期限", "ステータス")
STATUSES = ("未回答", "確認中", "回答済", "取下げ")
ANSWERED = "回答済"
WITHDRAWN = "取下げ"

FEATURE_RE = re.compile(r"^(\d{3,})-[a-z0-9][a-z0-9-]*$")
ID_RE = re.compile(r"^Q-(\d{3,})-(\d{2,})$")
BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
AMBIGUITY_HEADING_RE = re.compile(r"^##\s+Ambiguities\b", re.IGNORECASE)
NUMBERED_RE = re.compile(r"^(\d+)\.\s")


class SheetError(Exception):
    """Lỗi nội dung sheet — in ra cho người dùng, exit 1."""


# ---------- parse ----------

def feature_of(path: str) -> str:
    stem = os.path.splitext(os.path.basename(path))[0]
    if not FEATURE_RE.match(stem):
        raise SheetError(f"tên file phải là <NNN>-<slug>.md|csv (khớp branch), thấy: {stem}")
    return stem


def split_row(line: str) -> list[str]:
    """Tách 1 dòng bảng markdown; tôn trọng `\\|` (pipe đã escape trong ô)."""
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
    """Lấy bảng có header đúng COLUMNS (bỏ qua bảng metadata và mọi nội dung khác)."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        if tuple(split_row(line)) != COLUMNS:
            continue
        rows = []
        for raw in lines[i + 2:]:  # bỏ header + dòng |---|
            if not raw.lstrip().startswith("|"):
                break
            cells = split_row(raw)
            if len(cells) != len(COLUMNS):
                raise SheetError(f"dòng bảng có {len(cells)} cột, cần {len(COLUMNS)}: {raw.strip()}")
            rows.append({k: md_cell_to_text(v) for k, v in zip(COLUMNS, cells)})
        return rows
    raise SheetError("không tìm thấy bảng có header: | " + " | ".join(COLUMNS) + " |")


def read_csv_text(path: str) -> str:
    with open(path, "rb") as f:
        raw = f.read()
    # Excel "CSV UTF-8" giữ BOM; Excel "CSV" thường lưu Shift_JIS (cp932) — chấp nhận cả hai.
    for enc in ("utf-8-sig", "cp932"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise SheetError(f"{path}: không đọc được bằng UTF-8 hay Shift_JIS (cp932)")


def parse_csv(text: str) -> list[dict[str, str]]:
    reader = csv.reader(io.StringIO(text, newline=""))
    header = next(reader, None)
    if header is None or tuple(h.strip() for h in header) != COLUMNS:
        raise SheetError("header CSV phải là: " + ",".join(COLUMNS))
    rows = []
    for cells in reader:
        if not any(c.strip() for c in cells):
            continue
        if len(cells) != len(COLUMNS):
            raise SheetError(f"dòng CSV có {len(cells)} cột, cần {len(COLUMNS)}: {cells}")
        rows.append({k: v.replace("\r\n", "\n").strip() for k, v in zip(COLUMNS, cells)})
    return rows


def load_rows(path: str) -> list[dict[str, str]]:
    if path.endswith(".csv"):
        return parse_csv(read_csv_text(path))
    with open(path, encoding="utf-8") as f:
        return parse_markdown(f.read())


# ---------- validate ----------

def validate(rows: list[dict[str, str]], feature: str) -> list[str]:
    """Raise nếu sai cấu trúc; trả về danh sách cảnh báo (không chặn)."""
    if not rows:
        raise SheetError("bảng câu hỏi rỗng")
    number = FEATURE_RE.match(feature).group(1)
    warnings = []
    for idx, row in enumerate(rows, start=1):
        qid = row["No"]
        m = ID_RE.match(qid)
        if not m:
            raise SheetError(f"No '{qid}' sai định dạng — cần Q-{number}-NN")
        if m.group(1) != number:
            raise SheetError(f"No '{qid}' không khớp feature {feature} (cần Q-{number}-NN)")
        if int(m.group(2)) != idx:
            raise SheetError(f"No '{qid}' ở dòng {idx}: ID phải liên tục Q-{number}-01..NN, không đánh lại số")
        if row["ステータス"] not in STATUSES:
            raise SheetError(f"{qid}: ステータス '{row['ステータス']}' không hợp lệ — dùng {'/'.join(STATUSES)}")
        if not row["質問内容"]:
            raise SheetError(f"{qid}: 質問内容 trống")
        if row["回答期限"] and not _is_date(row["回答期限"]):
            raise SheetError(f"{qid}: 回答期限 '{row['回答期限']}' phải là YYYY-MM-DD")
        if row["ステータス"] == ANSWERED and not row["回答欄"]:
            warnings.append(f"{qid}: ステータス 回答済 nhưng 回答欄 trống")
    return warnings


def _is_date(value: str) -> bool:
    try:
        dt.date.fromisoformat(value)
        return True
    except ValueError:
        return False


def count_ambiguities(intake_path: str) -> int:
    """Đếm mục đánh số trong section `## Ambiguities…` của file intake."""
    with open(intake_path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    count, inside = 0, False
    for line in lines:
        if line.startswith("## "):
            inside = bool(AMBIGUITY_HEADING_RE.match(line))
            continue
        if inside and NUMBERED_RE.match(line):
            count += 1
    return count


def check_coverage(rows: list[dict[str, str]], intake_path: str) -> None:
    """Mỗi ambiguity thứ i ↔ đúng 1 câu Q-NNN-i. Câu thừa chỉ hợp lệ khi đã 取下げ."""
    n = count_ambiguities(intake_path)
    if len(rows) < n:
        raise SheetError(f"intake có {n} ambiguity nhưng sheet chỉ có {len(rows)} câu — thiếu câu hỏi")
    for row in rows[n:]:
        if row["ステータス"] != WITHDRAWN:
            raise SheetError(
                f"{row['No']}: không có ambiguity tương ứng trong {intake_path} "
                f"(thêm ambiguity vào intake, hoặc đặt ステータス = {WITHDRAWN})"
            )


# ---------- commands ----------

def add_business_days(start: dt.date, days: int) -> dt.date:
    d = start
    while days > 0:
        d += dt.timedelta(days=1)
        if d.weekday() < 5:
            days -= 1
    return d


def cmd_due(args: argparse.Namespace) -> int:
    start = dt.date.fromisoformat(args.from_date) if args.from_date else dt.date.today()
    print(add_business_days(start, args.days).isoformat())
    return 0


def default_intake(sheet_path: str, feature: str) -> str:
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(sheet_path))))
    return os.path.join(root, "docs", "intake", f"{feature}.md")


def write_csv(rows: list[dict[str, str]], out_path: str) -> None:
    # utf-8-sig = có BOM → Excel (Windows/Mac) nhận đúng tiếng Nhật; CRLF theo chuẩn RFC 4180.
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
        writer.writerow(COLUMNS)
        for row in rows:
            writer.writerow([row[c] for c in COLUMNS])


def cmd_export(args: argparse.Namespace) -> int:
    if not args.sheet.endswith(".md"):
        raise SheetError("export nhận file .md (nguồn sự thật của sheet), CSV là output")
    feature = feature_of(args.sheet)
    rows = load_rows(args.sheet)
    warnings = validate(rows, feature)
    intake = args.intake or default_intake(args.sheet, feature)
    if os.path.exists(intake):
        check_coverage(rows, intake)
    else:
        warnings.append(f"không thấy intake {intake} — bỏ qua kiểm ambiguity ↔ câu hỏi")
    out_path = os.path.splitext(args.sheet)[0] + ".csv"
    write_csv(rows, out_path)
    for w in warnings:
        print("⚠ " + w, file=sys.stderr)
    print(f"✓ {len(rows)} câu hỏi → {out_path} (UTF-8 BOM)")
    return 0


def recorded_ids(decisions_dir: str) -> set[str]:
    """ID câu hỏi đã có trong file quyết định (bỏ qua INDEX.md / README.md)."""
    found: set[str] = set()
    if not os.path.isdir(decisions_dir):
        return found
    for fn in os.listdir(decisions_dir):
        if not fn.endswith(".md") or fn in ("INDEX.md", "README.md"):
            continue
        with open(os.path.join(decisions_dir, fn), encoding="utf-8") as f:
            found.update(re.findall(r"Q-\d{3,}-\d{2,}", f.read()))
    return found


def cmd_ingest(args: argparse.Namespace) -> int:
    feature = feature_of(args.sheet)
    rows = load_rows(args.sheet)
    warnings = validate(rows, feature)
    done = recorded_ids(args.decisions_dir)
    pending, recorded, unanswered = [], [], []
    for row in rows:
        qid = row["No"]
        if row["ステータス"] == WITHDRAWN:
            continue
        if not row["回答欄"]:
            unanswered.append(qid)
            continue
        if qid in done:
            recorded.append(qid)
            continue
        if row["ステータス"] != ANSWERED:
            warnings.append(f"{qid}: có 回答欄 nhưng ステータス là {row['ステータス']} — cần xác nhận trước khi ghi")
        pending.append({
            "id": qid,
            "target": row["対象画面/機能"],
            "question": row["質問内容"],
            "background": row["背景・提案"],
            "answer": row["回答欄"],
            "status": row["ステータス"],
        })
    result = {
        "feature": feature,
        "sheet": args.sheet,
        "pending": pending,
        "already_recorded": recorded,
        "unanswered": unanswered,
        "warnings": warnings,
    }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="質問票 (Q&A sheet) — validate / CSV / ingest")
    sub = p.add_subparsers(dest="cmd", required=True)

    due = sub.add_parser("due", help="ngày hết hạn = +N ngày làm việc (T2–T6, CHƯA trừ ngày lễ Nhật)")
    due.add_argument("--days", type=int, default=5)
    due.add_argument("--from", dest="from_date")
    due.set_defaults(func=cmd_due)

    exp = sub.add_parser("export", help="validate sheet .md rồi ghi .csv (UTF-8 BOM) cạnh nó")
    exp.add_argument("sheet")
    exp.add_argument("--intake", help="mặc định docs/intake/<NNN>-<slug>.md")
    exp.set_defaults(func=cmd_export)

    ing = sub.add_parser("ingest", help="đọc sheet đã trả lời → JSON các câu cần ghi quyết định")
    ing.add_argument("sheet")
    ing.add_argument("--decisions-dir", default=os.path.join("docs", "04-decisions"))
    ing.set_defaults(func=cmd_ingest)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (SheetError, OSError) as e:
        print(f"✗ qa_sheet: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
