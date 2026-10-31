---
description: テスト仕様書 (Test Specification) — generate Japanese-standard test specification table (No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考) as Markdown + Excel CSV from spec.md ACs
argument-hint: "<NNN>-<slug> | specs/<NNN>-<slug>/spec.md"
---

You are a BrSE / QA Lead authoring a Japanese-standard **テスト仕様書 (Test Specification)** deliverable
from the Acceptance Criteria in `specs/*<slug>*/spec.md` and validation rules in `docs/02-detail-design/<slug>/`.

Arguments: `$ARGUMENTS` (`<NNN>-<slug>` or path to `spec.md`; if empty, infer from current git branch).

Deterministic validation (7-column header, contiguous `TC-<NNN>-<ii>` IDs, 100% AC coverage check, and
Excel-ready UTF-8 BOM CSV export) **always** runs via `python3 .claude/scripts/test_spec.py`.

---

1. **[AUTO] Load context:**
   - Read `specs/*<slug>*/spec.md` (`## Acceptance criteria`), `docs/02-detail-design/<slug>/` (if present),
     `docs/00-glossary.md`, and existing test files under `src/features/<slug>/`.
   - If `spec.md` is missing → STOP and ask the user to run `/speckit-specify` first.

2. **[AUTO] Design Japanese test cases:**
   - Every Acceptance Criterion (`AC 1..N`) in `spec.md` must map to **at least 1 test case** (splitting normal
     cases `正常系`, error/validation cases `異常系`, and boundary cases `境界値`).
   - Use stable IDs `TC-<NNN>-<ii>` (`01..NN`). If `docs/test-specs/<NNN>-<slug>.md` already exists, preserve
     existing rows and recorded `結果` values, appending new cases at the bottom.
   - Use standard Japanese test specification phrasing (`前提条件` and `期待結果` ending with `〜こと`,
     numbered steps separated by `<br>`).
   - Include `AC <n>` in `備考` (or `観点`) so `test_spec.py` can verify 100% AC coverage.

3. **[AUTO] Write `docs/test-specs/<NNN>-<slug>.md`** with the 7-column table:
   `| No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考 |`.

4. **[AUTO] Validate & Export CSV:**
   - Run `python3 .claude/scripts/test_spec.py export docs/test-specs/<NNN>-<slug>.md`.
   - Fix any reported validation or AC coverage errors in `.md` and re-run until clean.

5. **[AUTO] Invoke `glossary-steward`** (Task tool) scoped to `docs/test-specs/<NNN>-<slug>.md` to verify
   Japanese business terms against `docs/00-glossary.md`.

6. **[PAUSE] Report:**
   - Summarize total test cases (`正常系` / `異常系`, `OK` / `未実施`) and paths to `.md` and `.csv`.
