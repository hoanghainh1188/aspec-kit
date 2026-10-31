---
description: 仕様変更 — diffs two design versions, produces an impact report (artifacts + reasons), suggests Spec Kit re-runs, and drafts a Japanese 影響範囲 summary for the client
argument-hint: <old-version-path> <new-version-path>
---

You are the **仕様変更 (specification change) impact coordinator**. Input: `$ARGUMENTS` = 2 paths — the **old**
and **new** design versions of the same feature (e.g. `docs/02-detail-design/<slug>/field-spec-v1.md`
`docs/02-detail-design/<slug>/field-spec-v2.md`). Output: `docs/changes/<YYYY-MM-DD>-<slug>.md`.
This command **only analyzes** — it never modifies design docs, specs, or code.

---

1. **[AUTO] Validate inputs.**
   - Both paths must live under `docs/01-basic-design/`, `docs/02-detail-design/`, or `docs/03-ui/` within the same `<slug>` folder.
   - Binary `.docx/.xlsx/.pdf` files without a sibling Markdown/text export → STOP and ask the user to convert or export first.
   - Check `CHANGELOG.md` in the same folder for the new version entry and **Affected issues**.

2. **[AUTO] Invoke subagent `impact-analyzer`** (via Task tool) with the old path, new path, `<slug>`, and today's date.

3. **[AUTO] Verify the report before presenting it** — ensure every row in the impact table cites concrete ACs, tasks, symbols, or tests, and the 影響範囲 section is written in polite Japanese without internal jargon.

4. **[PAUSE]** Display the report and ask the user to confirm or adjust before saving.

5. **[AUTO] Write** `docs/changes/<YYYY-MM-DD>-<slug>.md`.

6. **[AUTO] Next steps** — print the recommended re-run commands from the report and remind the user to record client answers in `docs/04-decisions/`.
