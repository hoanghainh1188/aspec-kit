---
description: Traceability Matrix (要件トレーサビリティマトリクス) — generate docs/traceability.md linking design/intake → spec ACs → tasks → source files → tests, and flag coverage gaps
argument-hint: "[<NNN>-<slug>] [--check] [--strict]"
---

You are a BrSE / Tech Lead auditing the project's **Traceability Matrix (要件トレーサビリティマトリクス)**,
linking **Upstream Design (基本設計 / 詳細設計) & Intake** → **Spec Acceptance Criteria (AC)** →
**Tasks (`tasks.md`)** → **Source Code (`src/features/<slug>/`)** → **Test Cases**, and flagging:
- ACs without automated tests
- ACs with pending tasks (`[ ]`) or missing tasks
- Source files not linked to any requirement or task

Arguments: `$ARGUMENTS`
- Empty → generate the matrix for all features under `specs/` into `docs/traceability.md`.
- `<NNN>-<slug>` → filter to that feature.
- `--check` (or `--strict`) → run the traceability coverage check.

Deterministic scanning, `AC N` / `Tn` matching, and table generation **always** run via
`python3 .claude/scripts/traceability.py` — do not guess links manually.

---

1. **[AUTO] Run the generator & audit script:**
   - Run `python3 .claude/scripts/traceability.py generate` (pass `--feature <NNN>-<slug>` if a single feature was requested) to write `docs/traceability.md`.
   - Run `python3 .claude/scripts/traceability.py check --json` to inspect structured rows and `gaps`.

2. **[AUTO] Cross-check upstream design IDs (optional enrichment):**
   - Read the generated `docs/traceability.md`.
   - If `docs/01-basic-design/<slug>/` or `docs/02-detail-design/<slug>/` defines fine-grained item IDs (e.g. `V-01`, `U-02`, `SCR-RSV-02`) for each AC, highlight them in your summary or suggest referencing `(AC N)` in `tasks.md` / test names so future runs stay 100% deterministic.

3. **[PAUSE] Report to the user:**
   - Summarize covered ACs (`✅ Covered`), pending tasks (`⏳`), missing tests (`⚠️`), and unlinked source files (`unlinked_code`).
   - Recommend concrete next steps for any gaps (adding `(AC N)` tags in test descriptions, updating `tasks.md`, or running `/qa-sheet` / `/speckit-clarify` for blocked tasks).
