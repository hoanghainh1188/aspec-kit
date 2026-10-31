---
description: Hybrid orchestration pipeline — extracts Japanese design docs/Figma and drives the full Spec Kit workflow through test gate and deploy
---

You are the **orchestration runbook**. Spec Kit steps (`speckit-specify|clarify|plan|tasks|analyze|implement`)
are installed by `bootstrap.sh` as **skills** in `.claude/skills/speckit-*/` with `disable-model-invocation: false`,
so you can **invoke them directly via the Skill tool** (see `docs/04-decisions/2026-10-31-runbook-auto-invoke-speckit.md`).
Subagents (`design-intake`, `code-reviewer`, `glossary-steward`, `security-reviewer`) are invoked via the Task tool.

Conventions:
- **[AUTO]** = executed automatically by you (git, subagents).
- **[SKILL]** = invoke the Skill tool (`skill: "speckit-x"`, `args: "<…>"`), then report the generated artifact.
- **[HANDOFF]** = *fallback* — print `/speckit-x …` for the user to paste and run, then PAUSE.
- **[PAUSE]** = mandatory review checkpoint waiting for user confirmation before proceeding.

**Questions from skills belong to the USER.** Whenever `speckit-specify`, `speckit-clarify`, or `speckit-analyze`
asks a question, forward the exact question and options to the user and PAUSE — **never pick an answer on their behalf**
(Rule 1 of `CLAUDE.md`).

---

1. **[AUTO] Recall project memory** (*recall bootstrap* — run BEFORE anything else to prevent context drift).
   Read and briefly summarize the 5 file-backed memory sources (`CLAUDE.md` "Memory" section):
   - `.specify/memory/constitution.md` — immutable principles (if present).
   - `docs/00-glossary.md` — JP-VI-EN domain glossary.
   - `docs/04-decisions/INDEX.md` — resolved ambiguities.
   - `docs/05-lessons.md` — recorded technical gotchas.
   - `CLAUDE.md` — project conventions.

2. **[AUTO] Create feature git branch**: `git checkout -b <NNN>-<feature-slug>`.
   `<NNN>` = **GitHub Issue number**, zero-padded to at least 3 digits (e.g. issue #42 → `042-user-reservation`).
   If no issue exists yet, PAUSE and ask the user to create one first. See `docs/TEAM-WORKFLOW.md`.

3. **[AUTO] Invoke subagent `design-intake`** (via Task tool) with document paths in
   `docs/01-basic-design/`, `docs/02-detail-design/`, and Figma links/nodes in `docs/03-ui/`.
   It writes `docs/intake/<NNN>-<slug>.md`.

4. **[PAUSE]** Display the intake file, highlighting "Prompt for /speckit-specify" and "Ambiguities".
   Wait for user confirmation before continuing.

5. **[SKILL + PAUSE] specify** — Invoke Skill tool `speckit-specify` with `args` set **verbatim** to the
   "Prompt for /speckit-specify" section of the intake file. Report `specs/<…>/spec.md` and PAUSE for review.
   *Fallback [HANDOFF]:* print `/speckit-specify <prompt from intake>`.

6. **[SKILL — interactive] clarify** (when intake lists "Ambiguities" or `spec.md` has `[NEEDS CLARIFICATION]`) —
   First check `docs/04-decisions/INDEX.md` so already-decided questions are not re-asked. Invoke Skill tool
   `speckit-clarify` with the remaining ambiguities, relay each question to the user, and after completion
   **[AUTO]** record decisions in `docs/04-decisions/<YYYY-MM-DD>-<slug>.md` and append to `docs/04-decisions/INDEX.md`.
   *Fallback [HANDOFF]:* print `/speckit-clarify <ambiguity questions>`.

7. **[SKILL + PAUSE] plan** — Invoke Skill tool `speckit-plan` (passing tech stack constraints from `CLAUDE.md`
   if configured). Report `plan.md` and PAUSE for user review.
   *Fallback [HANDOFF]:* print `/speckit-plan`.

8. **[SKILL + PAUSE] tasks** — Invoke Skill tool `speckit-tasks`. Report `tasks.md` and PAUSE for user review.
   *Fallback [HANDOFF]:* print `/speckit-tasks`.

9. **[SKILL + PAUSE] analyze** — Invoke Skill tool `speckit-analyze` (read-only). Show the full cross-artifact
   analysis report. If warnings exist, fix spec/plan/tasks (steps 5–8) before implementing.
   **Require explicit user approval ("OK implement")** before moving to step 10.
   *Fallback [HANDOFF]:* print `/speckit-analyze`.

10. **[SKILL] implement** — Only after user approval in step 9: invoke Skill tool `speckit-implement`.
    Report completed and remaining tasks when finished.
    *Fallback [HANDOFF]:* print `/speckit-implement`.

11. **[AUTO] Invoke subagent `code-reviewer`** (via Task tool) to verify code against the 4 truth sources
    (constitution, spec, plan, tasks). All **Blocking** items must be resolved before the test gate.

12. **[AUTO] Invoke subagent `glossary-steward`** (via Task tool) to verify domain identifiers in code and specs
    against `docs/00-glossary.md`. Fix mismatched terms; append **new** domain terms directly to `docs/00-glossary.md`
    in the feature branch (Rule 5 of `CLAUDE.md`).

13. **[AUTO] Invoke subagent `security-reviewer`** (via Task tool) when the feature touches auth / user data /
    API / DB / crypto / payments. Resolve all **Blocking** findings before the test gate.

14. **[PAUSE] Test gate** — Run project quality checks (`npm run lint`, `npm run test`, `npm run build` or stack
    equivalents). **All checks must pass AND coverage must meet the constitutional threshold** (Article W —
    default ≥ 80% business logic). Append any newly discovered project gotchas to `docs/05-lessons.md`.

15. **[PAUSE] Deploy** — Read **"## Deploy"** in `CLAUDE.md` for the project's deployment method. Confirm
    production build succeeded and ask for explicit user confirmation before deploying.
