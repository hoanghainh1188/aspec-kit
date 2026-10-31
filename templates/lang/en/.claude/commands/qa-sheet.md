---
description: 質問票 (Q&A sheet) — turns intake Ambiguities into a polite Japanese (敬語) client Q&A sheet (.md + Excel CSV), and ingests client answers into docs/04-decisions/
argument-hint: "<NNN>-<slug> | docs/intake/<NNN>-<slug>.md | --ingest docs/qa/<NNN>-<slug>.(md|csv)"
---

You are a BrSE preparing a **質問票 (client Q&A sheet)** from the *Ambiguities* section of an intake file,
and ingesting the client's answers into `docs/04-decisions/`.

Arguments: `$ARGUMENTS`
- With `--ingest <file>` → run **Mode B (ingest)**.
- Otherwise (`<NNN>-<slug>` or intake path; if empty, infer from current branch) → **Mode A (generate sheet)**.

Deterministic operations (validation, UTF-8 BOM CSV export, filtering recorded answers) **always** run via
`python3 .claude/scripts/qa_sheet.py`.

---

## Mode A — Generate `docs/qa/<NNN>-<slug>.md` + `.csv`

1. **Load context:** Read `docs/intake/<NNN>-<slug>.md`, `docs/00-glossary.md`, and `docs/04-decisions/INDEX.md`.
2. **Filter resolved items:** Keep row IDs stable (`Q-<NNN>-<ii>`); mark already-decided items as `ステータス = 取下げ`.
3. **Draft each row in polite business Japanese (敬語):**
   - Columns: `No | 対象画面/機能 | 質問内容 | 背景・提案 | 回答欄 | 回答期限 | ステータス`
   - Get default due date (+5 business days) via `python3 .claude/scripts/qa_sheet.py due --days 5`.
4. **Write `docs/qa/<NNN>-<slug>.md`** and run `python3 .claude/scripts/qa_sheet.py export docs/qa/<NNN>-<slug>.md` to validate and generate the UTF-8 BOM `.csv`.
5. **Run `glossary-steward`** on `docs/qa/<NNN>-<slug>.md` to verify Japanese domain terms match `docs/00-glossary.md`.
6. **[PAUSE] Report** question counts and paths (`.md` + `.csv`) for the user to review before sending to the client.

---

## Mode B — `--ingest <file>`: Client Answers → `docs/04-decisions/`

1. **Run** `python3 .claude/scripts/qa_sheet.py ingest <file>` to get JSON (`pending`, `already_recorded`, `unanswered`, `warnings`).
2. **If `warnings` is non-empty** → [PAUSE] and ask the user how to handle each warning.
3. **For each item in `pending`** → write `docs/04-decisions/<YYYY-MM-DD>-<slug>.md` and prepend a row to `docs/04-decisions/INDEX.md`.
4. **Update `docs/qa/<NNN>-<slug>.md`** with the client's answers (`ステータス = 回答済`) and re-run `export`.
5. **[PAUSE] Report** newly recorded decision files, skipped IDs, and any follow-up questions needed.
