#!/usr/bin/env python3
"""Deterministic traceability matrix generator & auditor (`docs/traceability.md`).

Links upstream design items (基本設計 / 詳細設計 / intake) → spec Acceptance Criteria (AC) →
tasks (`tasks.md`) → source files (`src/features/<slug>/`) → test cases (`*.test.*` / `*_test.*`).
Flags gaps:
  - ACs with no completed task (`[x]`)
  - ACs with no automated test case referencing them
  - Source files not referenced by any task (`tasks.md`)

Usage:
    python3 .claude/scripts/traceability.py [generate] [--feature <NNN>-<slug>] [--out docs/traceability.md] [--json]
    python3 .claude/scripts/traceability.py check [--feature <NNN>-<slug>] [--strict]

Uses Python standard library only (zero external dependencies).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from typing import Any

FEATURE_DIR_RE = re.compile(r"^(\d{3,}|\d{8}-\d{6})-([a-z0-9][a-z0-9-]*)$")
AC_HEADING_RE = re.compile(r"^##\s+Acceptance\s+criteria\b", re.IGNORECASE)
NEXT_HEADING_RE = re.compile(r"^##\s+")
NUMBERED_ITEM_RE = re.compile(r"^\s*(\d+)\.\s+(.+)$")

# Matches task lines like: - [x] **T1** — `src/...`: description *(AC 2, 3)*
TASK_LINE_RE = re.compile(
    r"^\s*-\s*\[([ xX])\]\s*(?:\*\*([A-Za-z0-9_-]+)\*\*\s*(?:[—–-]\s*)?)?(.+)$"
)
# Matches AC references such as: AC 2, AC 2, 3, AC 2/3/4, AC-1, AC1..3
AC_GROUP_RE = re.compile(r"\bAC[-_\s]*(\d+(?:\s*(?:[,/&]|and)\s*\d+)*)", re.IGNORECASE)
BACKTICK_PATH_RE = re.compile(r"`([^`]+\.[a-zA-Z0-9]+)`")

# Matches test blocks: it("...", ...), test("...", ...), def test_...
TEST_CASE_RE = re.compile(
    r"""(?:^|\s)(?:it|test)\s*\(\s*(['"`])(.+?)\1|^\s*def\s+(test_[a-zA-Z0-9_]+)""",
    re.MULTILINE,
)

DESIGN_ID_RE = re.compile(r"^\|?\s*([A-Z]+-\d+|\d+)\s*\|")


class TraceabilityError(Exception):
    """Raised when project structure or arguments are invalid."""


def to_posix(path: str) -> str:
    return path.replace(os.sep, "/")


def is_test_file(rel_path: str) -> bool:
    name = os.path.basename(rel_path)
    return (
        ".test." in name
        or ".spec." in name
        or name.startswith("test_")
        or name.endswith("_test.py")
        or name.endswith("_test.go")
        or name.endswith("Test.java")
    )


def discover_features(root: str, feature_filter: str | None = None) -> list[dict[str, str]]:
    """Find features inside `specs/<id>-<slug>/` that contain `spec.md`."""
    specs_root = os.path.join(root, "specs")
    if not os.path.isdir(specs_root):
        return []
    features: list[dict[str, str]] = []
    for entry in sorted(os.listdir(specs_root)):
        spec_dir = os.path.join(specs_root, entry)
        if not os.path.isdir(spec_dir):
            continue
        if not os.path.isfile(os.path.join(spec_dir, "spec.md")):
            continue
        m = FEATURE_DIR_RE.match(entry)
        slug = m.group(2) if m else entry
        if feature_filter and feature_filter not in (entry, slug):
            continue
        features.append({
            "feature_id": entry,
            "slug": slug,
            "spec_dir": spec_dir,
        })
    return features


def parse_acs(spec_path: str) -> list[dict[str, Any]]:
    """Extract numbered Acceptance Criteria items from `spec.md`."""
    if not os.path.isfile(spec_path):
        return []
    with open(spec_path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    acs: list[dict[str, Any]] = []
    inside = False
    for line in lines:
        if line.startswith("## "):
            if AC_HEADING_RE.match(line):
                inside = True
                continue
            if inside and NEXT_HEADING_RE.match(line):
                break
        if inside:
            m = NUMBERED_ITEM_RE.match(line)
            if m:
                num = int(m.group(1))
                acs.append({
                    "num": num,
                    "id": f"AC {num}",
                    "text": m.group(2).strip(),
                })
    return acs


def extract_ac_numbers(text: str) -> list[int]:
    """Extract all AC numbers mentioned in a string (e.g. 'AC 2, 3' or 'AC 2/3/4')."""
    nums: set[int] = set()
    for group in AC_GROUP_RE.findall(text):
        for n in re.findall(r"\d+", group):
            nums.add(int(n))
    return sorted(nums)


def parse_tasks(tasks_path: str, slug: str) -> list[dict[str, Any]]:
    """Parse tasks from `tasks.md`, including checkbox status, referenced ACs and file paths."""
    if not os.path.isfile(tasks_path):
        return []
    with open(tasks_path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    tasks: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    seq = 0

    for line in lines:
        m = TASK_LINE_RE.match(line)
        if m:
            if current is not None:
                _finalize_task(current, slug)
                tasks.append(current)
            seq += 1
            done = m.group(1).lower() == "x"
            tid = m.group(2) or f"T{seq}"
            body = m.group(3).strip()
            current = {
                "id": tid,
                "done": done,
                "raw": body,
            }
        elif current is not None and (line.startswith("  ") or line.startswith("\t")):
            current["raw"] += " " + line.strip()
        else:
            if current is not None:
                _finalize_task(current, slug)
                tasks.append(current)
                current = None

    if current is not None:
        _finalize_task(current, slug)
        tasks.append(current)

    return tasks


def _finalize_task(task: dict[str, Any], slug: str) -> None:
    raw = task["raw"]
    task["acs"] = extract_ac_numbers(raw)
    paths: list[str] = []
    for candidate in BACKTICK_PATH_RE.findall(raw):
        if "/" in candidate:
            paths.append(candidate)
        else:
            paths.append(f"src/features/{slug}/{candidate}")
    task["files"] = paths


def scan_feature_code_and_tests(root: str, slug: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Scan `src/features/<slug>/` for source files and test files."""
    feature_src = os.path.join(root, "src", "features", slug)
    source_files: list[dict[str, Any]] = []
    test_cases: list[dict[str, Any]] = []

    if not os.path.isdir(feature_src):
        return source_files, test_cases

    for dirpath, _, filenames in os.walk(feature_src):
        for fn in sorted(filenames):
            if fn.startswith("."):
                continue
            abs_p = os.path.join(dirpath, fn)
            rel_p = to_posix(os.path.relpath(abs_p, root))
            with open(abs_p, encoding="utf-8", errors="replace") as f:
                content = f.read()

            if is_test_file(rel_p):
                for m in TEST_CASE_RE.finditer(content):
                    name = (m.group(2) or m.group(3) or "").strip()
                    acs = extract_ac_numbers(name)
                    test_cases.append({
                        "file": rel_p,
                        "name": name,
                        "acs": acs,
                    })
            else:
                source_files.append({
                    "file": rel_p,
                    "acs": extract_ac_numbers(content),
                })

    return source_files, test_cases


def collect_design_sources(root: str, feature_id: str, slug: str) -> list[str]:
    """Find upstream design docs and intake files related to this feature."""
    sources: list[str] = []
    intake_rel = f"docs/intake/{feature_id}.md"
    if os.path.isfile(os.path.join(root, intake_rel)):
        sources.append(intake_rel)

    for folder in ("01-basic-design", "02-detail-design", "03-ui"):
        d = os.path.join(root, "docs", folder, slug)
        if os.path.isdir(d):
            for fn in sorted(os.listdir(d)):
                if fn.endswith(".md") and fn != "CHANGELOG.md":
                    sources.append(to_posix(os.path.relpath(os.path.join(d, fn), root)))
    return sources


def analyze_feature(root: str, feat: dict[str, str]) -> dict[str, Any]:
    """Build the full traceability model for a single feature."""
    feature_id = feat["feature_id"]
    slug = feat["slug"]
    spec_dir = feat["spec_dir"]

    spec_path = os.path.join(spec_dir, "spec.md")
    tasks_path = os.path.join(spec_dir, "tasks.md")

    acs = parse_acs(spec_path)
    tasks = parse_tasks(tasks_path, slug)
    source_files, test_cases = scan_feature_code_and_tests(root, slug)
    design_sources = collect_design_sources(root, feature_id, slug)

    # Map tasks and files by AC
    rows: list[dict[str, Any]] = []
    acs_without_tests: list[str] = []
    acs_pending_tasks: list[str] = []

    for ac in acs:
        num = ac["num"]
        ac_id = ac["id"]
        matching_tasks = [t for t in tasks if num in t["acs"]]
        done_tasks = [t for t in matching_tasks if t["done"]]
        open_tasks = [t for t in matching_tasks if not t["done"]]

        # Source files linked via tasks or via inline AC comments
        ac_src_files: list[str] = []
        for t in matching_tasks:
            for p in t["files"]:
                if not is_test_file(p) and p not in ac_src_files:
                    ac_src_files.append(p)
        for sf in source_files:
            if num in sf["acs"] and sf["file"] not in ac_src_files:
                ac_src_files.append(sf["file"])

        matching_tests = [tc for tc in test_cases if num in tc["acs"]]

        if done_tasks and matching_tests and not open_tasks:
            status = "✅ Covered"
        elif done_tasks and matching_tests and open_tasks:
            status = "⏳ Partial (pending task)"
            acs_pending_tasks.append(ac_id)
        elif open_tasks and not done_tasks:
            status = "⏳ Pending task"
            acs_pending_tasks.append(ac_id)
            if not matching_tests:
                acs_without_tests.append(ac_id)
        else:
            status = "⚠️ Missing test" if not matching_tests else "⚠️ Missing task"
            if not matching_tests:
                acs_without_tests.append(ac_id)

        rows.append({
            "ac_id": ac_id,
            "ac_num": num,
            "ac_text": ac["text"],
            "design_sources": design_sources,
            "tasks": [
                {"id": t["id"], "done": t["done"]}
                for t in matching_tasks
            ],
            "source_files": ac_src_files,
            "tests": [
                {"file": tc["file"], "name": tc["name"]}
                for tc in matching_tests
            ],
            "status": status,
        })

    # Identify unlinked source files (not referenced in any task and not referencing any AC)
    task_referenced_files = {
        p for t in tasks for p in t["files"] if not is_test_file(p)
    }
    unlinked_code: list[str] = []
    for sf in source_files:
        if sf["file"] not in task_referenced_files and not sf["acs"]:
            unlinked_code.append(sf["file"])

    # Identify tasks with no AC mapping
    unmapped_tasks = [t["id"] for t in tasks if not t["acs"]]

    return {
        "feature_id": feature_id,
        "slug": slug,
        "spec_path": to_posix(os.path.relpath(spec_path, root)),
        "tasks_path": to_posix(os.path.relpath(tasks_path, root)) if os.path.isfile(tasks_path) else None,
        "design_sources": design_sources,
        "rows": rows,
        "gaps": {
            "acs_without_tests": acs_without_tests,
            "acs_pending_tasks": acs_pending_tasks,
            "unlinked_code": unlinked_code,
            "unmapped_tasks": unmapped_tasks,
        },
    }


def _escape_cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", "<br>")


def render_markdown(reports: list[dict[str, Any]], out_path: str, root: str) -> str:
    """Render `docs/traceability.md` from analyzed feature reports."""
    out_dir = os.path.dirname(os.path.abspath(out_path))

    def rel_link(repo_rel: str, label: str | None = None) -> str:
        abs_target = os.path.join(root, repo_rel)
        rel = to_posix(os.path.relpath(abs_target, out_dir))
        return f"[`{label or repo_rel}`]({rel})"

    is_sample_only = len(reports) == 1 and reports[0]["feature_id"] == "000-example-reservation"
    lines: list[str] = []
    if is_sample_only:
        lines.extend([
            "> ⚠️ **MA TRẬN TRUY VẾT MẪU — XOÁ HOẶC TÁI SINH TRƯỚC KHI DÙNG THẬT.**",
            "> Đi kèm feature mẫu `000-example-reservation`, sinh tự động bằng `/traceability`",
            "> (`python3 .claude/scripts/traceability.py generate`).",
            "",
        ])

    lines.extend([
        "# Ma trận truy vết (Traceability Matrix — 要件トレーサビリティマトリクス)",
        "",
        "Liên kết xuyên suốt từ **Tài liệu thiết kế / Intake** → **Spec Acceptance Criteria (AC)** →",
        "**Tasks (`tasks.md`)** → **Source Code (`src/features/<slug>/`)** → **Test Cases**.",
        "",
    ])

    for rep in reports:
        fid = rep["feature_id"]
        slug = rep["slug"]
        lines.append(f"## Feature `{fid}`")
        lines.append("")
        src_links = [rel_link(s) for s in rep["design_sources"]]
        src_links.append(rel_link(rep["spec_path"], "spec.md"))
        if rep["tasks_path"]:
            src_links.append(rel_link(rep["tasks_path"], "tasks.md"))
        lines.append("- **Nguồn tham chiếu:** " + " · ".join(src_links))
        lines.append("")
        lines.append("| AC | Mô tả yêu cầu (Spec AC) | Nguồn thiết kế / Intake | Tasks | Source Files | Test Cases | Trạng thái |")
        lines.append("|---|---|---|---|---|---|---|")

        design_cell = "<br>".join(rel_link(s, os.path.basename(s)) for s in rep["design_sources"]) or "—"

        for r in rep["rows"]:
            task_cell = (
                "<br>".join(f"{'☑' if t['done'] else '☐'} `{t['id']}`" for t in r["tasks"])
                if r["tasks"]
                else "—"
            )
            file_cell = (
                "<br>".join(rel_link(f, os.path.basename(f)) for f in r["source_files"])
                if r["source_files"]
                else "—"
            )
            test_cell = (
                "<br>".join(
                    f"{rel_link(tc['file'], os.path.basename(tc['file']))}: {_escape_cell(tc['name'])}"
                    for tc in r["tests"]
                )
                if r["tests"]
                else "—"
            )
            lines.append(
                f"| **{r['ac_id']}** | {_escape_cell(r['ac_text'])} | {design_cell} | {task_cell} | {file_cell} | {test_cell} | {r['status']} |"
            )

        lines.append("")
        lines.append("### Cảnh báo độ phủ & Khoảng trống (Gaps)")
        lines.append("")
        gaps = rep["gaps"]
        if not any(gaps.values()):
            lines.append("- ✅ Tất cả Acceptance Criteria đều đã có task hoàn thành, code và test case tương ứng.")
        else:
            if gaps["acs_without_tests"]:
                lines.append(
                    f"- ⚠️ **AC chưa có test case tự động:** {', '.join(f'`{a}`' for a in gaps['acs_without_tests'])}"
                )
            if gaps["acs_pending_tasks"]:
                lines.append(
                    f"- ⏳ **AC có task đang treo (`[ ]`):** {', '.join(f'`{a}`' for a in gaps['acs_pending_tasks'])}"
                )
            if gaps["unlinked_code"]:
                lines.append(
                    f"- ⚠️ **File code chưa gắn với task/AC nào:** {', '.join(f'`{f}`' for f in gaps['unlinked_code'])}"
                )
            if gaps["unmapped_tasks"]:
                lines.append(
                    f"- ℹ️ **Task chưa ghi mã `(AC N)` (VD task hạ tầng/test tổng hợp hoặc chờ clarify):** {', '.join(f'`{t}`' for t in gaps['unmapped_tasks'])}"
                )
        lines.append("")

    lines.append("<!-- sinh bởi: python3 .claude/scripts/traceability.py generate -->")
    return "\n".join(lines) + "\n"


def cmd_generate(args: argparse.Namespace) -> int:
    root = os.path.abspath(args.root)
    features = discover_features(root, args.feature)
    if not features:
        raise TraceabilityError(
            f"không tìm thấy feature nào trong {os.path.join(root, 'specs')}"
            + (f" khớp '{args.feature}'" if args.feature else "")
        )
    reports = [analyze_feature(root, f) for f in features]
    if args.json:
        json.dump({"features": reports}, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return 0

    out_path = args.out if os.path.isabs(args.out) else os.path.join(root, args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    md = render_markdown(reports, out_path, root)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"✓ Đã ghi ma trận truy vết ({len(reports)} feature) → {to_posix(os.path.relpath(out_path, root))}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    root = os.path.abspath(args.root)
    features = discover_features(root, args.feature)
    if not features:
        raise TraceabilityError("không tìm thấy feature nào trong specs/")
    reports = [analyze_feature(root, f) for f in features]
    if args.json:
        json.dump({"features": reports}, sys.stdout, ensure_ascii=False, indent=2)
        print()
    has_blocking = False
    for rep in reports:
        fid = rep["feature_id"]
        gaps = rep["gaps"]
        if gaps["unlinked_code"]:
            has_blocking = True
            print(
                f"✗ [{fid}] Code không gắn requirement/task: {', '.join(gaps['unlinked_code'])}",
                file=sys.stderr,
            )
        if gaps["acs_without_tests"]:
            msg = f"⚠ [{fid}] AC chưa có test case: {', '.join(gaps['acs_without_tests'])}"
            if args.strict:
                has_blocking = True
                print("✗ " + msg[2:], file=sys.stderr)
            else:
                print(msg, file=sys.stderr)
    if has_blocking:
        return 1
    print(f"✓ Traceability check hoàn tất ({len(reports)} feature)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Traceability matrix generator & checker")
    sub = p.add_subparsers(dest="cmd")

    gen = sub.add_parser("generate", help="sinh file docs/traceability.md")
    gen.add_argument("--root", default=".", help="thư mục gốc dự án")
    gen.add_argument("--feature", help="chỉ chạy cho 1 feature (<NNN>-<slug> hoặc <slug>)")
    gen.add_argument("--out", default=os.path.join("docs", "traceability.md"))
    gen.add_argument("--json", action="store_true", help="in JSON ra stdout thay vì ghi file")
    gen.set_defaults(func=cmd_generate)

    chk = sub.add_parser("check", help="kiểm tra độ phủ traceability")
    chk.add_argument("--root", default=".")
    chk.add_argument("--feature")
    chk.add_argument("--strict", action="store_true", help="exit 1 nếu có bất kỳ AC nào chưa có test")
    chk.add_argument("--json", action="store_true")
    chk.set_defaults(func=cmd_check)

    return p


def main(argv: list[str] | None = None) -> int:
    raw = list(sys.argv[1:] if argv is None else argv)
    if not raw or raw[0].startswith("-"):
        raw = ["generate", *raw]
    args = build_parser().parse_args(raw)
    try:
        return args.func(args)
    except (TraceabilityError, OSError) as e:
        print(f"✗ traceability: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
