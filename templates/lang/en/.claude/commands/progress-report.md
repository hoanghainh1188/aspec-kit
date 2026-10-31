---
description: 進捗報告 (Weekly Progress Report) — summarize git log + tasks.md checkboxes + open Q&A items into a polite Japanese weekly report (完了 / 進行中 / 課題・リスク / 来週予定)
argument-hint: "[<NNN>-<slug>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]"
---

You are a BrSE authoring a business-polite Japanese **週次進捗報告 (Weekly Progress Report)** for the client.

Arguments: `$ARGUMENTS` (optional `<NNN>-<slug>` and/or `--since YYYY-MM-DD --until YYYY-MM-DD`; defaults to all
features over the last 7 days).

Deterministic metric collection (`tasks.md` completion counts, open `docs/qa/*.md` items, and `git log` commits)
and 4-section validation **always** run via `python3 .claude/scripts/progress_report.py`.

---

1. **[AUTO] Collect factual metrics:**
   - Run `python3 .claude/scripts/progress_report.py collect` (adding `--feature`, `--since`, `--until` as needed).
   - Read `docs/00-glossary.md` so domain terms match the Japanese column.

2. **[AUTO] Write `docs/reports/<YYYY-MM-DD>-<slug|weekly>.md` in polite Japanese (敬語):**
   - Must include the 4 required level-2 headings:
     - `## 1. 完了事項` — Completed work (from `[x]` tasks and commits, phrased in client-facing business terms).
     - `## 2. 進行中` — Work in progress or awaiting clarification (`[ ]` tasks).
     - `## 3. 課題・リスク` — Blockers/risks, specifically listing open 質問票 items (`Q-<NNN>-<ii>`, target screen,
       due date, status).
     - `## 4. 来週予定` — Planned tasks for next week.

3. **[AUTO] Validate report structure:**
   - Run `python3 .claude/scripts/progress_report.py validate docs/reports/<file>.md`.

4. **[PAUSE] Present report for user review:**
   - Summarize task completion percentage, open Q&A count, and path to the generated report.
