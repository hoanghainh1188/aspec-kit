#!/usr/bin/env python3
"""Deterministic helper for `/progress-report` — 進捗報告 (Weekly Progress Report in Japanese).

Aggregates factual project metrics so the LLM never hallucinates task counts or question IDs:
  - `specs/*/tasks.md` checkboxes (`[x]` vs `[ ]`)
  - `docs/qa/*.md` question statuses (`未回答`, `確認中`, `回答済`, `取下げ`)
  - `git log` commits in the reporting window (`--since` .. `--until`)

And validates generated reports in `docs/reports/*.md` for the 4 mandatory Japanese sections:
  1. `## 1. 完了事項`
  2. `## 2. 進行中`
  3. `## 3. 課題・リスク`
  4. `## 4. 来週予定`

Usage:
    python3 .claude/scripts/progress_report.py collect [--root .] [--feature <NNN>-<slug>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
    python3 .claude/scripts/progress_report.py validate docs/reports/<file>.md

Uses Python standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
from typing import Any

TASK_RE = re.compile(
    r"^\s*-\s*\[([ xX])\]\s*(?:\*\*([A-Za-z0-9_-]+)\*\*\s*(?:[—–-]\s*)?)?(.+)$"
)
QA_HEADER = ("No", "対象画面/機能", "質問内容", "背景・提案", "回答欄", "回答期限", "ステータス")
BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)

REQUIRED_SECTIONS = (
    ("## 1. 完了", "完了事項"),
    ("## 2. 進行中", "進行中"),
    ("## 3. 課題・リスク", "課題・リスク"),
    ("## 4. 来週予定", "来週予定"),
)


class ProgressReportError(Exception):
    """Validation or data collection error for 進捗報告."""


def _split_md_row(line: str) -> list[str]:
    body = line.strip()
    if body.startswith("|"):
        body = body[1:]
    if body.endswith("|") and not body.endswith("\\|"):
        body = body[:-1]
    cells = re.split(r"(?<!\\)\|", body)
    return [BR_RE.sub(" ", c).strip().replace("\\|", "|") for c in cells]


def collect_tasks(root: str, feature_filter: str | None = None) -> list[dict[str, Any]]:
    specs_dir = os.path.join(root, "specs")
    if not os.path.isdir(specs_dir):
        return []
    out: list[dict[str, Any]] = []
    for entry in sorted(os.listdir(specs_dir)):
        if feature_filter and feature_filter not in entry:
            continue
        tasks_file = os.path.join(specs_dir, entry, "tasks.md")
        if not os.path.isfile(tasks_file):
            continue
        with open(tasks_file, encoding="utf-8") as f:
            lines = f.read().splitlines()

        done_items: list[dict[str, str]] = []
        pending_items: list[dict[str, str]] = []
        seq = 0
        current: dict[str, Any] | None = None

        for line in lines:
            m = TASK_RE.match(line)
            if m:
                if current is not None:
                    (done_items if current["done"] else pending_items).append(
                        {"id": current["id"], "summary": current["text"]}
                    )
                seq += 1
                current = {
                    "done": m.group(1).lower() == "x",
                    "id": m.group(2) or f"T{seq}",
                    "text": m.group(3).strip(),
                }
            elif current is not None and (line.startswith("  ") or line.startswith("\t")):
                current["text"] += " " + line.strip()
            else:
                if current is not None:
                    (done_items if current["done"] else pending_items).append(
                        {"id": current["id"], "summary": current["text"]}
                    )
                    current = None

        if current is not None:
            (done_items if current["done"] else pending_items).append(
                {"id": current["id"], "summary": current["text"]}
            )

        total = len(done_items) + len(pending_items)
        out.append({
            "feature": entry,
            "total": total,
            "completed_count": len(done_items),
            "pending_count": len(pending_items),
            "progress_pct": round((len(done_items) * 100.0 / total), 1) if total else 0.0,
            "completed": done_items,
            "pending": pending_items,
        })
    return out


def collect_qa(root: str, feature_filter: str | None = None) -> list[dict[str, Any]]:
    qa_dir = os.path.join(root, "docs", "qa")
    if not os.path.isdir(qa_dir):
        return []
    sheets: list[dict[str, Any]] = []
    for fn in sorted(os.listdir(qa_dir)):
        if not fn.endswith(".md") or fn == "README.md":
            continue
        stem = os.path.splitext(fn)[0]
        if feature_filter and feature_filter not in stem:
            continue
        path = os.path.join(qa_dir, fn)
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()

        rows: list[dict[str, str]] = []
        for i, line in enumerate(lines):
            if not line.lstrip().startswith("|"):
                continue
            if tuple(_split_md_row(line)) != QA_HEADER:
                continue
            for raw in lines[i + 2:]:
                if not raw.lstrip().startswith("|"):
                    break
                cells = _split_md_row(raw)
                if len(cells) == len(QA_HEADER):
                    rows.append(dict(zip(QA_HEADER, cells)))
            break

        open_items = [
            {
                "id": r["No"],
                "target": r["対象画面/機能"],
                "question": r["質問内容"],
                "due": r["回答期限"],
                "status": r["ステータス"],
            }
            for r in rows
            if r["ステータス"] in ("未回答", "確認中")
        ]
        answered_count = sum(1 for r in rows if r["ステータス"] == "回答済")
        withdrawn_count = sum(1 for r in rows if r["ステータス"] == "取下げ")
        sheets.append({
            "feature": stem,
            "total": len(rows),
            "open_count": len(open_items),
            "answered_count": answered_count,
            "withdrawn_count": withdrawn_count,
            "open_items": open_items,
        })
    return sheets


def collect_git_commits(root: str, since: str | None, until: str | None) -> list[dict[str, str]]:
    cmd = ["git", "log", "--no-merges", "--date=short", "--pretty=format:%h\t%ad\t%s", "-n", "50"]
    if since:
        cmd.append(f"--since={since}")
    if until:
        cmd.append(f"--until={until}")
    try:
        res = subprocess.run(cmd, cwd=root, capture_output=True, text=True, check=False)
        if res.returncode != 0:
            return []
        commits: list[dict[str, str]] = []
        for line in res.stdout.splitlines():
            parts = line.split("\t", 2)
            if len(parts) == 3:
                commits.append({"hash": parts[0], "date": parts[1], "subject": parts[2]})
        return commits
    except OSError:
        return []


def validate_report_text(text: str, path_label: str = "report") -> list[str]:
    """Ensure the progress report contains all 4 required Japanese headings."""
    headings = [line.strip() for line in text.splitlines() if line.startswith("## ")]
    missing: list[str] = []
    for prefix, label in REQUIRED_SECTIONS:
        if not any(h.startswith(prefix) for h in headings):
            missing.append(f"{path_label}: thiếu mục bắt buộc `{prefix}…` ({label})")
    if missing:
        raise ProgressReportError("; ".join(missing))
    return []


def cmd_collect(args: argparse.Namespace) -> int:
    root = os.path.abspath(args.root)
    today = dt.date.today()
    until = args.until or today.isoformat()
    since = args.since or (dt.date.fromisoformat(until) - dt.timedelta(days=7)).isoformat()

    tasks = collect_tasks(root, args.feature)
    qa = collect_qa(root, args.feature)
    commits = collect_git_commits(root, args.since, args.until)

    payload = {
        "period": {"since": since, "until": until},
        "tasks": tasks,
        "qa": qa,
        "commits": commits,
    }
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    if not os.path.isfile(args.report):
        raise ProgressReportError(f"không tìm thấy file {args.report}")
    with open(args.report, encoding="utf-8") as f:
        text = f.read()
    validate_report_text(text, args.report)
    print(f"✓ {args.report}: đủ 4 phần chuẩn 進捗報告 (完了 / 進行中 / 課題・リスク / 来週予定)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="進捗報告 (weekly progress report) collector & validator")
    sub = p.add_subparsers(dest="cmd", required=True)

    col = sub.add_parser("collect", help="thu thập số liệu tasks.md + docs/qa/ + git log ra JSON")
    col.add_argument("--root", default=".")
    col.add_argument("--feature", help="lọc theo feature (<NNN>-<slug>)")
    col.add_argument("--since", help="YYYY-MM-DD")
    col.add_argument("--until", help="YYYY-MM-DD")
    col.set_defaults(func=cmd_collect)

    val = sub.add_parser("validate", help="kiểm tra file báo cáo docs/reports/*.md có đủ 4 phần bắt buộc")
    val.add_argument("report")
    val.set_defaults(func=cmd_validate)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (ProgressReportError, ValueError, OSError) as e:
        print(f"✗ progress_report: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
