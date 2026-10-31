# @hoanghainh/aspec-kit

<p align="center">
  <img src="https://raw.githubusercontent.com/hoanghainh1188/aspec-kit/main/assets/aspec-kit-banner.png" alt="aspec-kit banner" width="100%">
</p>

[![npm version](https://img.shields.io/npm/v/@hoanghainh/aspec-kit.svg)](https://www.npmjs.com/package/@hoanghainh/aspec-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Inspired by GitHub's Spec-Driven Development initiative**, `aspec-kit` is reimagined as an ultra-lightweight, zero-dependency toolkit tailored for **Claude Code** and AI-first engineering teams.

Official CLI generator to scaffold a new **aspec-kit** project — an Agentic Spec-Driven Development (SDD) framework integrating **Claude Code** with Japanese design specifications intake (**Basic Design 基本設計**, **Detail Design 詳細設計**, and **Figma**).

---

## Quick Start

Run any of the following commands in your terminal:

```bash
# 1. Initialize into a new directory
npx @hoanghainh/aspec-kit init my-project

# 2. Or initialize directly into the current directory
npx @hoanghainh/aspec-kit init .

# 3. Or use standard npm init / create syntax
npm init @hoanghainh/aspec-kit my-project
# or
npm create @hoanghainh/aspec-kit@latest my-project
# or
pnpm create @hoanghainh/aspec-kit my-project
```

---

## Usage & Options

```text
npx @hoanghainh/aspec-kit init [project-directory] [options]
# or
npx @hoanghainh/aspec-kit [project-directory] [options]
# work on an existing project
npx @hoanghainh/aspec-kit update [project-directory] [--to <ref>] [--dry-run]
npx @hoanghainh/aspec-kit doctor [project-directory] [--json]
npx @hoanghainh/aspec-kit convert <file.xlsx|file.xlsm|file.pdf> [--out <dir>] [--force]
```

### Commands
- `init [dir]`: Scaffolds a new project (pass `.` to initialize in the current directory).
- `update [dir]`: Upgrades the kit-owned files of an existing project (see [Updating a project](#updating-a-project)).
- `doctor [dir] [--json]`: Health check of an existing project's environment and guardrails
  (see [Health check](#health-check-aspec-kit-doctor)).
- `convert <file.xlsx|file.xlsm|file.pdf> [--out <dir>] [--force]`: Converts a 詳細設計 workbook or PDF
  to Markdown (see [Convert design documents](#convert-design-documents)).

> `update`, `doctor` and `convert` are command names, so `npx @hoanghainh/aspec-kit update` no longer
> scaffolds into a directory called `update`. To create a directory with one of these names, use
> `init <name>`.

### Options & Flags (`init`)

| Flag | Description | Default |
|---|---|:---:|
| `[project-directory]` | Target directory name for the new project | `my-aspec-app` |
| `-y, --yes` | Skip interactive prompts and accept all defaults | `false` |
| `--steward <handle>` | Specify GitHub handle of project Steward for `.github/CODEOWNERS` | `@your-handle` |
| `--agent <agents>` | Target AI agent(s): `claude`, `gemini`, `copilot`, `cursor` (comma-separated or repeatable). Keeps `CLAUDE.md` as Single Source of Truth, generates `GEMINI.md` / `.github/copilot-instructions.md` / `AGENTS.md` + `.cursorrules`, and configures `SPEC_KIT_INTEGRATION` in `bootstrap.sh` | `claude` |
| `--clean` | Automatically clean up reference sample feature (`000-example-reservation`) | `true` with `-y` |
| `--keep-example` | Keep the sample feature to inspect code & spec structure | `false` |
| `--force` | Overwrite files that already exist in the target directory | `false` (existing files are kept & reported) |
| `--template-ref <ref>` | Git tag/branch of the template to fetch | `v<cli-version>` (falls back to `main` with a warning) |
| `-v, --version` | Output current CLI version | — |
| `-h, --help` | Display usage guide and options | — |

> Unknown flags and missing option values (e.g. `--steward` without a handle) are rejected with an error.
> `--steward` accepts a GitHub user (`@lead`), a team (`@org/team`) or an email.

### Safety guarantees

- **No silent overwrite**: when scaffolding into a non-empty directory (e.g. `init .`), existing files are
  **kept** and listed as *Skipped*. Pass `--force` to overwrite them.
- **Reproducible template**: the template is fetched from the git tag matching the CLI version
  (`v<version>`), not from a moving `main` branch.
- **Kit-only files are excluded**: npm publish workflow, `packages/`, plugin metadata, banner, kit
  `README`/`LICENSE`/`CONTRIBUTING` are not copied (see `.aspecignore`). A project `README.md` stub is
  generated instead (only if none exists).
- Post-copy customization (CODEOWNERS, sample cleanup) only touches files created by the current run.
- **Version manifest**: `init` writes `.aspec-kit.json` (template ref, CLI version, steward and a
  sha256 of every scaffolded file). Commit it — `aspec-kit update` relies on it.

### Examples

```bash
# 1. Interactive onboarding (Recommended)
npx @hoanghainh/aspec-kit init my-app

# 2. Non-interactive automated scaffolding (CI friendly)
npx @hoanghainh/aspec-kit init my-app --yes

# 3. Custom Steward handle with automatic cleanup of sample feature
npx @hoanghainh/aspec-kit init my-app --steward @lead-engineer --clean
```

---

## Updating a project

Projects keep receiving fixes to agents, runbooks, hooks and CI with:

```bash
npx @hoanghainh/aspec-kit update --dry-run     # preview
npx @hoanghainh/aspec-kit update               # apply (template v<cli-version>)
npx @hoanghainh/aspec-kit update --to v0.3.0   # or a specific tag/branch
```

For every kit-owned file the CLI compares the hash recorded in `.aspec-kit.json` (base), the file on
disk (yours) and the new template (theirs):

| Situation | Result |
|---|---|
| You did not change the file | Overwritten with the new template |
| Only you changed it | Kept as-is |
| Both you and the template changed it | **Conflict** — your file is kept, the new version is written to `<file>.aspec-new` |
| New in the template | Added |
| Removed from the template | Deleted if you never changed it, otherwise kept (no longer kit-managed) |

Then `.aspec-kit.json` is refreshed. Resolve each conflict by merging `<file>.aspec-new` into `<file>`
and deleting the `.aspec-new` file. `--dry-run` prints the plan and writes nothing.

**Never touched:** client design docs (`docs/01-*`, `docs/02-*`, `docs/03-*`), `docs/00-glossary.md`,
`docs/04-decisions/`, `docs/05-lessons.md`, `docs/intake/`, `specs/` and `src/`.

> Projects created before `.aspec-kit.json` existed have no recorded base, so every file that differs
> from the new template is treated as locally modified (reported as a conflict with an `.aspec-new`
> copy). After the first update the manifest exists and later updates are fully automatic.

---

## Health check (`aspec-kit doctor`)

Run inside a scaffolded project (or pass its path) to see what is still missing before the team starts:

```bash
npx @hoanghainh/aspec-kit doctor          # human-readable report
npx @hoanghainh/aspec-kit doctor --json   # machine-readable, e.g. for CI
```

| Check | Result when not satisfied |
|---|---|
| `git`, `uv` or `pipx`, Claude Code CLI (`claude`) on `PATH` | fail |
| `python3` on `PATH` (used by `bootstrap.sh`) | warn |
| Figma MCP server in `.mcp.json` / `~/.claude.json` (optional) | warn |
| `.specify/` present, and every `/speckit-*` skill used by `/design-to-code` exists in `.claude/skills/` (same drift guard as `bootstrap.sh`) | fail |
| `.github/CODEOWNERS` placeholder `@your-lead-handle` replaced | fail |
| `.claude/hooks/format.sh` has a formatter configured | warn |
| Branch protection on `main` (PR + Code Owners review + status checks) via `gh api` | fail if unprotected, warn if partial; **skipped** when `gh` is missing, not authenticated, or the repo is not on GitHub |

Every non-ok line comes with a fix hint. The exit code is `1` when any check fails and `0` otherwise
(warnings and skipped checks do not fail).

---

## Convert design documents

Claude Code's `Read` tool cannot parse binary `.xlsx`/`.pdf`. `convert` turns a 詳細設計 file into
Markdown next to the original:

```bash
npx @hoanghainh/aspec-kit convert docs/02-detail-design/user-reservation/field-spec-v1.xlsx
```

- **Excel** → `field-spec-v1.md` (sheet index) + one `field-spec-v1__<NN>_<sheet>.md` per sheet.
  Merged cells are expanded (value repeated), Excel 方眼紙 column spans are collapsed, tables stay GFM
  tables, Japanese sheet names are kept (only characters illegal in file names are replaced).
- **PDF** → `field-spec-v1.md` with text + tables per page (no OCR for scanned pages).
- The original is never modified; an entry is appended to `CHANGELOG.md` in the output folder.
- Existing Markdown is only overwritten when it was generated from the same source (`--force` to override).
- `--out` defaults to the `docs/02-detail-design/<slug>/` folder that holds the file (or
  `./docs/02-detail-design/<slug-of-file-name>/` when the file lives elsewhere).

**Requires [uv](https://docs.astral.sh/uv/)** (Spec Kit needs it too). The CLI stays zero-dependency: it
runs a Python script with inline [PEP 723](https://peps.python.org/pep-0723/) dependencies
(`openpyxl`, `pdfplumber`) via `uv run --script`, which caches an isolated environment on first use.
The same script is scaffolded into projects as `.claude/scripts/convert-design.py`.

---

## Interactive Prompts

When run without the `--yes` flag, the CLI guides you through 3 simple setup questions:

1. **`Project directory name`**: Target directory name (enter `.` to scaffold into the current folder).
2. **`GitHub handle of project Steward`**: GitHub username of the lead/steward to automatically configure in `.github/CODEOWNERS` (e.g., `@lead-dev`).
3. **`Keep sample feature for reference?`**: Choose `y` to keep the reference reservation feature (`000-example-reservation`), or `N` to start with a completely clean workspace.

---

## Generated Project Layout

```text
my-project/
├── CLAUDE.md                       Core conventions read by AI agents first
├── bootstrap.sh                    Script to initialize Spec Kit CLI and hooks
├── .claude/
│   ├── settings.json              Permission boundaries (deny -> ask -> allow)
│   ├── agents/                    5 subagents (design-intake, code-reviewer, security-reviewer, glossary-steward, impact-analyzer)
│   ├── hooks/                     Format-on-save hook
│   ├── commands/                  /design-to-code (orchestration), /design-change (仕様変更 impact), /qa-sheet (質問票)
│   └── scripts/                   qa_sheet.py (/qa-sheet CSV/ingest) + convert-design.py (詳細設計 .xlsx/.pdf → Markdown, via uv)
├── docs/
│   ├── 00-glossary.md              Single source of truth for JP / VI / EN business terms
│   ├── 01-basic-design/            基本設計 directly from client (read-only)
│   ├── 02-detail-design/           詳細設計 directly from client (read-only)
│   ├── 03-ui/                      Figma links and visual snapshots
│   ├── 04-decisions/               Decisions from /speckit-clarify (INDEX.md)
│   ├── 05-lessons.md               Technical gotchas and project lessons
│   ├── intake/                     Output artifacts from design-intake
│   ├── changes/                    仕様変更 impact reports from /design-change
│   ├── qa/                         質問票 (Q&A sheets) for the client, from /qa-sheet
│   └── CONSTITUTION_APPEND.md      Recommended constitution articles for JP projects
├── src/                            Application source code (src/features/<slug>/)
└── tests/                          Automated test suites
```

---

## Next Steps

```bash
# 1. Navigate to the project directory
cd my-project

# 2. Complete Spec Kit CLI & skills setup
bash bootstrap.sh

# 3. Launch Claude Code and initialize project constitution
claude
# Inside Claude Code:
/speckit-constitution
```

---

## Repository & License

- **GitHub Repository**: [hoanghainh1188/aspec-kit](https://github.com/hoanghainh1188/aspec-kit)
- **License**: Released under the [MIT License](https://opensource.org/licenses/MIT).
