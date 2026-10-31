#!/usr/bin/env python3
"""Kiểm tra nội dung template (không chỉ sự tồn tại của file).

Chạy trong CI (smoke-test) và chạy được cả ở local:
    python3 .github/scripts/check-template.py

Bắt các lỗi mà check `test -f` bỏ sót:
  1. Link nội bộ (markdown) trỏ tới file không tồn tại.
  2. Frontmatter của subagent thiếu key bắt buộc (name/description/tools).
  3. Runbook `design-to-code.md` đánh số bước không liên tục từ 1.
  4. Mermaid dùng class (`:::x`) chưa được `classDef`.
  5. Glossary có thuật ngữ 日本語 trùng nhau (2 dòng cùng 1 term → nhập nhằng).
  6. Báo cáo 仕様変更 `docs/changes/*.md` (output `/design-change`) thiếu 1 trong 3 phần bắt buộc.

Không phụ thuộc package ngoài — chỉ dùng stdlib, không cần mạng.
"""
from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def iter_markdown() -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules")]
        for fn in filenames:
            if fn.endswith(".md"):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
LANG_PACK_RE = re.compile(r"^templates/lang/[^/]+/(.+)$")


def check_internal_links(md_files: list[str]) -> None:
    for path in md_files:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        base = os.path.dirname(path)
        rel_from_root = os.path.relpath(path, ROOT).replace(os.sep, "/")
        lang_match = LANG_PACK_RE.match(rel_from_root)
        for target in LINK_RE.findall(text):
            target = target.strip()
            # bỏ qua link ngoài / anchor thuần / mailto
            if target.startswith(("http://", "https://", "mailto:", "#", "<")):
                continue
            # cắt anchor và query
            clean = target.split("#", 1)[0].split("?", 1)[0].strip()
            if not clean:
                continue
            resolved = os.path.normpath(os.path.join(base, clean))
            if os.path.exists(resolved):
                continue
            # Nếu file nằm trong templates/lang/<lang>/<subpath>, cho phép fallback về ROOT/<subpath>
            if lang_match:
                virtual_path = os.path.join(ROOT, lang_match.group(1))
                virtual_resolved = os.path.normpath(os.path.join(os.path.dirname(virtual_path), clean))
                if os.path.exists(virtual_resolved):
                    continue
            rel = os.path.relpath(path, ROOT)
            err(f"[link] {rel}: link trỏ tới file không tồn tại → {target}")


REQUIRED_FRONTMATTER = ("name:", "description:", "tools:")


def _check_agents_in_dir(agents_dir: str, label_prefix: str) -> None:
    if not os.path.isdir(agents_dir):
        err(f"[frontmatter] không tìm thấy {label_prefix}")
        return
    for fn in sorted(os.listdir(agents_dir)):
        if not fn.endswith(".md"):
            continue
        path = os.path.join(agents_dir, fn)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        if not text.startswith("---"):
            err(f"[frontmatter] {label_prefix}/{fn}: thiếu frontmatter mở đầu `---`")
            continue
        end = text.find("\n---", 3)
        if end == -1:
            err(f"[frontmatter] {label_prefix}/{fn}: thiếu `---` đóng frontmatter")
            continue
        block = text[3:end]
        for key in REQUIRED_FRONTMATTER:
            if key not in block:
                err(f"[frontmatter] {label_prefix}/{fn}: thiếu key `{key}`")


def check_agent_frontmatter() -> None:
    _check_agents_in_dir(os.path.join(ROOT, ".claude", "agents"), ".claude/agents")
    lang_root = os.path.join(ROOT, "templates", "lang")
    if os.path.isdir(lang_root):
        for lang in sorted(os.listdir(lang_root)):
            lang_agents = os.path.join(lang_root, lang, ".claude", "agents")
            if os.path.isdir(lang_agents):
                _check_agents_in_dir(lang_agents, f"templates/lang/{lang}/.claude/agents")


STEP_RE = re.compile(r"^(\d+)\.\s", re.MULTILINE)


def _check_runbook_file(path: str, label: str) -> None:
    if not os.path.exists(path):
        err(f"[steps] không tìm thấy {label}")
        return
    with open(path, encoding="utf-8") as f:
        text = f.read()
    nums = [int(n) for n in STEP_RE.findall(text)]
    expected = list(range(1, len(nums) + 1))
    if nums != expected:
        err(f"[steps] {label}: số bước không liên tục 1..N → thấy {nums}")


def check_runbook_numbering() -> None:
    _check_runbook_file(
        os.path.join(ROOT, ".claude", "commands", "design-to-code.md"),
        ".claude/commands/design-to-code.md",
    )
    lang_root = os.path.join(ROOT, "templates", "lang")
    if os.path.isdir(lang_root):
        for lang in sorted(os.listdir(lang_root)):
            rb = os.path.join(lang_root, lang, ".claude", "commands", "design-to-code.md")
            if os.path.exists(rb):
                _check_runbook_file(rb, f"templates/lang/{lang}/.claude/commands/design-to-code.md")


MERMAID_BLOCK_RE = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)
CLASSDEF_RE = re.compile(r"classDef\s+(\w+)")
CLASSUSE_RE = re.compile(r":::(\w+)")


def check_mermaid(md_files: list[str]) -> None:
    for path in md_files:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for block in MERMAID_BLOCK_RE.findall(text):
            defined = set(CLASSDEF_RE.findall(block))
            used = set(CLASSUSE_RE.findall(block))
            missing = used - defined
            if missing:
                rel = os.path.relpath(path, ROOT)
                err(f"[mermaid] {rel}: dùng class chưa classDef → {sorted(missing)}")


SEP_RE = re.compile(r"^[\s|:\-]+$")


def check_glossary_duplicates() -> None:
    path = os.path.join(ROOT, "docs", "00-glossary.md")
    if not os.path.exists(path):
        err("[glossary] không tìm thấy docs/00-glossary.md")
        return
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    seen: dict[str, int] = {}
    for i, line in enumerate(lines, start=1):
        s = line.strip()
        if not s.startswith("|"):
            continue
        if SEP_RE.match(s):  # dòng phân cách |---|
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if not cells:
            continue
        term = cells[0]
        if not term or term == "日本語":  # bỏ header
            continue
        if term in seen:
            err(f"[glossary] 日本語 '{term}' trùng ở dòng {seen[term]} và {i}")
        else:
            seen[term] = i


CHANGE_REPORT_SECTIONS = (
    ("## 1. Bảng tác động", "bảng tác động"),
    ("## 2. Đề xuất chạy lại", "đề xuất chạy lại"),
    ("## 3. 影響範囲", "tóm tắt 影響範囲 cho khách"),
)


def check_change_reports() -> None:
    changes_dir = os.path.join(ROOT, "docs", "changes")
    if not os.path.isdir(changes_dir):
        return
    for fn in sorted(os.listdir(changes_dir)):
        if not fn.endswith(".md") or fn == "README.md":
            continue
        with open(os.path.join(changes_dir, fn), encoding="utf-8") as f:
            headings = [line.strip() for line in f if line.startswith("## ")]
        for prefix, label in CHANGE_REPORT_SECTIONS:
            if not any(h.startswith(prefix) for h in headings):
                err(f"[changes] docs/changes/{fn}: thiếu phần `{prefix}…` ({label})")


def main() -> int:
    md_files = iter_markdown()
    check_internal_links(md_files)
    check_agent_frontmatter()
    check_runbook_numbering()
    check_mermaid(md_files)
    check_glossary_duplicates()
    check_change_reports()

    if errors:
        print("✗ check-template: phát hiện vấn đề\n")
        for e in errors:
            print("  " + e)
        print(f"\nTổng: {len(errors)} lỗi")
        return 1
    print("✓ check-template: link nội bộ, frontmatter, số bước, mermaid, glossary, báo cáo 仕様変更 đều hợp lệ")
    return 0


if __name__ == "__main__":
    sys.exit(main())
