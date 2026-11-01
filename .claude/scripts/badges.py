#!/usr/bin/env python3
"""Generate standard SVG quality badges for Traceability and Test Specification coverage.

Extracts live metrics from `docs/traceability.md` and `docs/test-specs/*.{md,csv}`:
  1. `docs/badges/traceability.svg` (e.g. `traceability: 100% - passing` or `92% - gap`)
  2. `docs/badges/test-specs.svg` (e.g. `test specs: 6/6 ACs covered` or `5/6 ACs - warning`)

Usage:
    python3 .claude/scripts/badges.py [--root .] [--out docs/badges] [--json]

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

# Color palette (Flat Shields style)
COLOR_SUCCESS = "#22c55e"  # Green
COLOR_WARNING = "#eab308"  # Yellow/Amber
COLOR_DANGER = "#ef4444"   # Red
COLOR_LABEL_BG = "#1e293b" # Slate-800


def render_svg_badge(label: str, message: str, color: str = COLOR_SUCCESS) -> str:
    """Render a flat SVG badge similar to Shields.io."""
    # Approximate text width calculation (assuming ~7px per character at 11px font)
    label_width = max(len(label) * 7 + 14, 40)
    message_width = max(len(message) * 7 + 14, 50)
    total_width = label_width + message_width
    height = 20

    label_x = label_width / 2
    message_x = label_width + (message_width / 2)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="{height}" role="img" aria-label="{label}: {message}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="{total_width}" height="{height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="{label_width}" height="{height}" fill="{COLOR_LABEL_BG}"/>
    <rect x="{label_width}" width="{message_width}" height="{height}" fill="{color}"/>
    <rect width="{total_width}" height="{height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="{label_x}" y="15" fill="#010101" fill-opacity=".3">{label}</text>
    <text x="{label_x}" y="14">{label}</text>
    <text aria-hidden="true" x="{message_x}" y="15" fill="#010101" fill-opacity=".3">{message}</text>
    <text x="{message_x}" y="14">{message}</text>
  </g>
</svg>
"""


def evaluate_traceability(root: str) -> dict[str, Any]:
    """Inspect docs/traceability.md for AC coverage percentage."""
    trace_file = os.path.join(root, "docs", "traceability.md")
    if not os.path.exists(trace_file):
        return {"total": 0, "covered": 0, "percentage": 0, "status": "missing"}

    with open(trace_file, "r", encoding="utf-8") as f:
        content = f.read()

    total_acs = 0
    covered_acs = 0

    in_table = False
    for line in content.splitlines():
        line_s = line.strip()
        if not in_table and (line_s.startswith("| AC") or line_s.startswith("| **AC")):
            in_table = True
            continue
        if in_table and line_s.startswith("|---"):
            continue
        if in_table and line_s.startswith("|"):
            parts = [p.strip() for p in line_s.split("|")[1:-1]]
            if len(parts) >= 7:
                total_acs += 1
                status_col = parts[6]
                if "Covered" in status_col or "✅" in status_col or "OK" in status_col:
                    covered_acs += 1
        elif in_table and line_s and not line_s.startswith("|"):
            in_table = False

    pct = round((covered_acs / total_acs * 100), 1) if total_acs > 0 else 100.0
    return {
        "total": total_acs,
        "covered": covered_acs,
        "percentage": pct,
        "status": "ok" if pct >= 100.0 else "gap",
    }


def evaluate_test_specs(root: str) -> dict[str, Any]:
    """Inspect docs/test-specs/*.{md,csv} and count covered ACs."""
    test_spec_dir = os.path.join(root, "docs", "test-specs")
    if not os.path.exists(test_spec_dir):
        return {"total_cases": 0, "covered_acs": 0, "status": "none"}

    files = glob.glob(os.path.join(test_spec_dir, "*.*"))
    spec_files = [f for f in files if f.endswith(".md") or f.endswith(".csv")]

    total_tcs = 0
    referenced_acs = set()

    for sf in spec_files:
        with open(sf, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        # Find TC-NNN-NN
        total_tcs += len(re.findall(r"\bTC-\d+-\d+\b", text))
        # Find AC references: AC 1, AC 2, AC 1 / Q-001
        for m in re.finditer(r"\bAC[-_\s]*(\d+)\b", text, re.IGNORECASE):
            referenced_acs.add(m.group(1))

    return {
        "total_cases": total_tcs,
        "covered_acs": len(referenced_acs),
        "status": "ok" if total_tcs > 0 else "empty",
    }


def generate_badges(root: str = ".", out_dir: str = "docs/badges") -> dict[str, Any]:
    """Generate traceability.svg and test-specs.svg badges."""
    target_out = os.path.join(root, out_dir)
    os.makedirs(target_out, exist_ok=True)

    # 1. Traceability
    t_data = evaluate_traceability(root)
    if t_data["total"] == 0:
        t_msg = "no specs"
        t_color = COLOR_WARNING
    elif t_data["status"] == "ok":
        t_msg = f"{t_data['percentage']}% covered"
        t_color = COLOR_SUCCESS
    else:
        t_msg = f"{t_data['percentage']}% ({t_data['covered']}/{t_data['total']})"
        t_color = COLOR_WARNING if t_data["percentage"] >= 80.0 else COLOR_DANGER

    t_svg = render_svg_badge("traceability", t_msg, t_color)
    t_path = os.path.join(target_out, "traceability.svg")
    with open(t_path, "w", encoding="utf-8") as f:
        f.write(t_svg)

    # 2. Test Specifications
    ts_data = evaluate_test_specs(root)
    if ts_data["total_cases"] == 0:
        ts_msg = "no test specs"
        ts_color = COLOR_WARNING
    else:
        ts_msg = f"{ts_data['total_cases']} cases ({ts_data['covered_acs']} ACs)"
        ts_color = COLOR_SUCCESS

    ts_svg = render_svg_badge("test specs", ts_msg, ts_color)
    ts_path = os.path.join(target_out, "test-specs.svg")
    with open(ts_path, "w", encoding="utf-8") as f:
        f.write(ts_svg)

    return {
        "traceability": {"file": t_path, "message": t_msg, "color": t_color, "data": t_data},
        "testSpecs": {"file": ts_path, "message": ts_msg, "color": ts_color, "data": ts_data},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", default=".", help="Root directory of the project (default: .)")
    parser.add_argument("--out", default="docs/badges", help="Output badges directory (default: docs/badges)")
    parser.add_argument("--json", action="store_true", help="Print result summary as JSON")
    args = parser.parse_args()

    res = generate_badges(root=args.root, out_dir=args.out)

    if args.json:
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print("✓ Generated CI Quality Badges:")
        print(f"  - Traceability: {res['traceability']['file']} ({res['traceability']['message']})")
        print(f"  - Test Specs:   {res['testSpecs']['file']} ({res['testSpecs']['message']})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
