# Team Workflow & Conflict Prevention

This guide explains how **multiple developers work on a single repository** scaffolded from this template
with **zero git conflicts** and **zero context drift** (glossary, constitution, upstream design docs).
Read alongside `CLAUDE.md` (mandatory rules) and `README.md` (single-feature workflow).

> ⚠️ **Load-bearing setup — complete these 2 items BEFORE the team starts:**
> 1. **`.github/CODEOWNERS`** — replace `@your-lead-handle` with the real GitHub handle(s) of your steward(s).
> 2. **Branch protection for `main`** — enable *Require PR* + *Require review from Code Owners* +
>    *Require status checks* (`template-smoke-test`) + *Require branches up to date*. See [section 9](#9-conflict-hotspots--branch-protection).

---

## 1. Repo & Branch Model

- **Single shared repository**, default branch `main` is always green (CI passing, deployable).
- Each feature = **1 short-lived branch** off `main`, merged via **Pull Request**.
- Merge into `main` only when: **CI is green** + **review passed** (code-owner approval if touching gated files).

---

## 2. Feature Numbering — Use GitHub Issue Numbers

1. **Every feature starts with a GitHub Issue** (using the `Feature` issue template). **Issue number = Feature ID.**
2. **Branch name**: `NNN-<slug>` where `NNN` is the issue number **zero-padded to at least 3 digits**
   (e.g., issue `#42` → `042-user-reservation`).
3. **`specs/` directory numbering = `timestamp`** (`bootstrap.sh` sets `"feature_numbering": "timestamp"` in
   `.specify/init-options.json`), generating `specs/<YYYYMMDD-HHMMSS>-<slug>` so parallel branches never collide.

| Layer | Value | Role |
|---|---|---|
| **Branch** name | `NNN-<slug>` (NNN = issue #) | PR / `Closes #` / human traceability |
| **`specs/`** folder | `<YYYYMMDD-HHMMSS>-<slug>` (timestamp) | Spec Kit internal, prevents parallel collisions |

> Keep `<slug>` identical across branch `NNN-<slug>`, design folders `docs/01-03/<slug>/`,
> intake `docs/intake/<NNN>-<slug>.md` (see [`docs/intake/README.md`](intake/README.md)), and code `src/features/<slug>/`.

---

## 3. Feature Lifecycle (Team)

```
1. Create GitHub issue (Feature template)      → issue # = ID; assign owner
2. git checkout main && git pull               → latest base
3. git checkout -b NNN-<slug>                  → add label in-progress on the issue
4. Place design docs in docs/01-basic-design/<slug>/, 02-detail-design/<slug>/, 03-ui/<slug>/
5. Run /design-to-code                         → intake → speckit → implement → review → test
6. Open PR "Closes #<issue>"                   (fill PR template)
7. code-reviewer + glossary-steward + security-reviewer + human review; fix Blocking items
8. Test gate: green + coverage ≥ constitution threshold (Article W, default 80%)
9. CI green + review pass → merge into main
```

---

## 4. Code Isolation by Feature (`src/`)

- **Feature-specific code** → `src/features/<slug>/`. Parallel features rarely touch the same files.
- **Shared areas** (`src/shared/`, root configs, routers, DI containers) are conflict hotspots: keep commits
  small, merge early, and prefer registry/append patterns over central lists. See [section 7](#7-glossary--constitution-governance).

---

## 5. Team Conflict Strategy

| | **Git conflict** (syntactic) | **Context drift** (semantic) |
|---|---|---|
| What it is | 2 branches edit the **same lines/file** | 2 branches rely on **different versions of glossary/constitution/design** |
| Detected by | Git (on merge/rebase) | **Nobody** automatically — merges cleanly but uses stale terms/rules |
| Prevented by | File isolation ([section 4](#4-code-isolation-by-feature-src)) + short-lived branches | Daily rebase + re-running `/speckit-analyze` + governance gates |

---

## 6. Preventing Context Drift

- **Rebase onto `main` daily** to pull the latest glossary and constitution updates.
- When `docs/00-glossary.md` or `.specify/memory/constitution.md` changes on `main`, rebase and re-run
  `/speckit-analyze` + `glossary-steward`.
- Before asking an ambiguity question, check `docs/04-decisions/` (starting at [`INDEX.md`](04-decisions/INDEX.md)).

---

## 7. Glossary & Constitution Governance

| Action | Process | Why |
|---|---|---|
| **ADD** a new term (append 1 row to glossary) | Done **directly in the feature branch**; steward reviews via CODEOWNERS on the PR | Appending rarely conflicts and avoids blocking developers |
| **EDIT / rename / delete** an existing term | **Separate, small PR** approved by steward | Changing a term's meaning ripples across the entire codebase |
| **Any change** to `constitution.md` | **Separate, small PR** approved by steward | Highest blast radius in Spec Kit |

---

## 8. Mid-Flight Design Updates (`docs/01-03`)

When the client sends a revised design while implementation is in progress:
- **Never overwrite** the previous version. Add a **new versioned file** + update `CHANGELOG.md` with
  **Affected issues**, then run `/design-change <old> <new>`.

---

## 9. Conflict Hotspots & Branch Protection

Configure branch protection on `main` (Settings → Branches → Add rule for `main`):
- ☑ Require a pull request before merging (≥1 approval)
- ☑ Require review from **Code Owners**
- ☑ Require status checks to pass (`template-smoke-test` + project CI)
- ☑ Require branches to be up to date before merging

---

## 10. Key Takeaways

1. **Enable load-bearing setup first:** set real CODEOWNERS + branch protection on `main`.
2. **Create issue first:** issue # = Feature ID → branch `NNN-<slug>`.
3. **One owner per feature** end-to-end; hand off only via the checklist in `docs/intake/README.md`.
4. **Editing glossary/constitution** requires a separate steward-approved PR; **adding** terms happens in-branch.
5. **Rebase onto `main` daily** and re-run `/speckit-analyze` + `glossary-steward` when shared memory changes.
