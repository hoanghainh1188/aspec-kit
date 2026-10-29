# aspec-kit — Spec-Driven Development Framework with Claude Code & Japanese Design Intake

[![npm version](https://img.shields.io/npm/v/@hoanghainh/aspec-kit.svg)](https://www.npmjs.com/package/@hoanghainh/aspec-kit)
[![CI Status](https://github.com/hoanghainh1188/aspec-kit/actions/workflows/smoke-test.yml/badge.svg)](https://github.com/hoanghainh1188/aspec-kit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Spec Kit](https://img.shields.io/badge/Powered%20by-GitHub%20Spec%20Kit-blue.svg)](https://github.com/github/spec-kit)

Production-ready greenfield project template and toolkit for **Claude Code**, specifically engineered for **Bridge Software Engineers (BrSE)** and development teams working with Japanese clients where upstream design artifacts come from **Basic Design (基本設計)**, **Detail Design (詳細設計)**, and **Figma**.

---

## Key Highlights

- **[GitHub Spec Kit](https://github.com/github/spec-kit) Backbone**: End-to-end specification-driven pipeline (`constitution` -> `specify` -> `clarify` -> `plan` -> `tasks` -> `analyze` -> `implement`).
- **4 Specialized Claude Code Subagents**: Fills the gap that raw Spec Kit does not cover:
  - `design-intake`: Parses Japanese specifications and Figma (via MCP) into structured intake artifacts.
  - `code-reviewer`: Cross-references implementation against 4 truth sources (constitution, spec, plan, tasks).
  - `glossary-steward`: Guards terminology fidelity across Japanese, Vietnamese, and English in code and specs.
  - `security-reviewer`: Specialized OWASP Top 10, secret detection, and PII audit pass.
- **5-Tier Git-Backed Project Memory**: Externalizes knowledge in Git files to eliminate AI context drift without database infrastructure overhead.
- **Zero-Conflict Team Workflow**: Combines GitHub Issue IDs for branch naming (`NNN-<slug>`) and timestamp-based specification paths to prevent collision during parallel feature development.

---

## 3 Ways to Use aspec-kit

### Method 1: Instant Start via npm CLI (Recommended — Fastest, Zero-Config)

```bash
npx @hoanghainh/aspec-kit my-project
# or
npm create @hoanghainh/aspec-kit@latest my-project
```

The CLI automatically fetches the latest template, interactively configures `.github/CODEOWNERS` with your Steward handle, and optionally cleans up the reference sample feature.

Options: `-y/--yes`, `--steward <handle>`, `--clean`, `--help` (see [`packages/aspec-kit/README.md`](packages/aspec-kit/README.md)).

After scaffolding:
```bash
cd my-project
bash bootstrap.sh
```

### Method 2: Use as GitHub Template Repository

1. Fork/clone this repository to your GitHub account.
2. In repository Settings, check **"Template repository"**.
3. For each new project, click **"Use this template"** -> **"Create a new repository"**.
4. Clone your new repo locally, and run `bash bootstrap.sh` to install Spec Kit CLI and generate `.claude/skills/`.
5. Launch Claude Code and run `/speckit-constitution`. Then consult [`docs/CONSTITUTION_APPEND.md`](docs/CONSTITUTION_APPEND.md) to add articles tailored for Japanese client contexts.

### Method 3: Install as Claude Code Plugin (For Existing Projects)

Ideal when you want to equip existing codebases with aspec-kit agents and slash commands:

```bash
# Inside Claude Code
/plugin marketplace add hoanghainh1188/aspec-kit
/plugin install aspec-kit@hoanghainh1188
```

Installs the 4 subagents (`design-intake`, `code-reviewer`, `security-reviewer`, `glossary-steward`) and `/design-to-code` into user scope (`~/.claude/`). See details in [`plugin/README.md`](plugin/README.md).

---

## Directory Structure

```text
<project>/
├── CLAUDE.md                       Core conventions read by AI agents first
├── bootstrap.sh                    Runs specify init and integrates skills & hooks
├── .claude/
│   ├── settings.json              Configured permission rules (deny -> ask -> allow)
│   ├── agents/
│   │   ├── design-intake.md       Extracts JP docs & Figma -> generates intake for /speckit-specify
│   │   ├── code-reviewer.md       Post-implementation verification against 4 sources
│   │   ├── security-reviewer.md   OWASP, secret detection, and PII audit
│   │   └── glossary-steward.md    Guards JP-VI-EN terminology consistency
│   ├── hooks/
│   │   └── format.sh              Format-on-save hook triggered on file edit
│   └── commands/
│       └── design-to-code.md      Hybrid orchestration runbook command
├── docs/
│   ├── 00-glossary.md              Single source of truth for JP / VI / EN business terms
│   ├── 01-basic-design/            基本設計 directly from client (read-only)
│   ├── 02-detail-design/           詳細設計 directly from client (read-only)
│   ├── 03-ui/                      Figma link registry & design snapshots
│   ├── 04-decisions/               Decisions from /speckit-clarify (INDEX.md = lookup table)
│   ├── 05-lessons.md               Technical gotchas and project lessons learned
│   ├── intake/                     Output artifacts from design-intake
│   └── CONSTITUTION_APPEND.md      Recommended constitution articles for JP projects
├── src/                            Application source code (src/features/<slug>/)
├── tests/                          Automated test suites
├── packages/
│   └── aspec-kit/                  Official CLI generator package (@hoanghainh/aspec-kit)
├── .claude-plugin/                 Plugin and marketplace catalog metadata
└── plugin/
    └── README.md                   Plugin usage guide
```

After running `bootstrap.sh`:
```text
├── .specify/
│   ├── memory/constitution.md      Generated by /speckit-constitution
│   ├── templates/                  Spec Kit templates
│   └── scripts/                    Spec Kit helper scripts
├── .claude/skills/speckit-*/       Spec Kit skills (specify, clarify, plan, tasks, analyze, implement...)
└── specs/                          Feature specifications directory
```

---

## Reference Sample Feature (Removable)

The template includes a miniature reference feature — **予約承認 (Reservation Approval)** — to demonstrate end-to-end traceability and code layout:
- `docs/intake/000-example-reservation.md`: Sample output from `design-intake`.
- `docs/04-decisions/2026-01-01-approval-vs-confirm.md`: Sample decision artifact.
- `specs/000-example-reservation/`: Sample `spec.md`, `plan.md`, and `tasks.md`.
- `src/features/example-reservation/`: Sample TypeScript implementation and unit tests illustrating TDD under Article W.

**To clean up the sample feature before starting a real project:**
```bash
rm -rf specs/000-example-reservation \
       src/features/example-reservation \
       docs/intake/000-example-reservation.md \
       docs/04-decisions/2026-01-01-approval-vs-confirm.md
# Remove the sample entry from INDEX.md:
python3 -c "
from pathlib import Path
p = Path('docs/04-decisions/INDEX.md')
lines = [l for l in p.read_text().splitlines() if '000-example-reservation' not in l]
p.write_text('\n'.join(lines) + '\n')
"
```
*(Note: If you use `npx @hoanghainh/aspec-kit --clean`, this clean-up is done automatically).*

---

## Feature Workflow

### Human Interaction Steps
1. **Create a GitHub Issue** for the feature (Issue # = Feature ID), then branch out as `NNN-<slug>` where `NNN` is zero-padded to at least 3 digits (e.g., Issue #42 -> `042-user-reservation`).
2. **Place upstream specifications** in dedicated folders:
   - `docs/01-basic-design/<slug>/` — 基本設計 (user stories & high-level behavior).
   - `docs/02-detail-design/<slug>/` — 詳細設計 (field tables, validation rules, business edges, errors).
   - `docs/03-ui/<slug>/figma-links.md` — Figma nodes and reference screenshots.
   *(Note: For binary `.docx/.xlsx/.pdf` files, export text/markdown copies alongside the originals for direct tool parsing).*
3. **Execute `/design-to-code`** in Claude Code, providing document paths when prompted.
4. At each **[HANDOFF]** step, copy and run the precise `/speckit-*` command output by Claude.
5. Review checkpoints at every **[PAUSE]** (intake review, analyze gate, test gate, deployment).

### Workflow Diagram

```mermaid
flowchart TD
    A["📁 Place design docs in docs/01-03/"]:::user --> B["⌨️ Run /design-to-code"]:::user
    B --> B2["Recall memory: constitution + glossary<br/>+ decisions INDEX + lessons"]:::auto
    B2 --> C["Create git branch NNN-feature"]:::auto
    C --> D["design-intake reads docs → docs/intake/"]:::auto
    D --> E{"PAUSE — Review intake<br/>prompt & ambiguities"}:::stop
    E --> F["/speckit-specify — prompt from intake"]:::handoff
    F --> G{"Ambiguities detected?"}:::stop
    G -- Yes --> H["/speckit-clarify → docs/04-decisions/"]:::handoff
    G -- No --> I["/speckit-plan"]:::handoff
    H --> I
    I --> J["/speckit-tasks"]:::handoff
    J --> K{"PAUSE — /speckit-analyze<br/>any warnings?"}:::stop
    K -- Yes, fix spec/plan/tasks --> F
    K -- No --> L["/speckit-implement → generate code"]:::handoff
    L --> M{"code-reviewer<br/>any Blocking issues?"}:::auto
    M -- Yes --> L
    M -- No --> Q["glossary-steward<br/>verify terms vs glossary"]:::auto
    Q --> R{"security-reviewer<br/>(if auth/data touched)<br/>any Blocking issues?"}:::auto
    R -- Yes --> L
    R -- No --> N{"PAUSE — test gate<br/>lint/test/build green<br/>+ coverage ≥ threshold?"}:::stop
    N -- Red --> L
    N -- Green --> O["PAUSE — deploy per CLAUDE.md"]:::stop
    O --> P["✅ Commit intake + decisions + specs"]:::user

    classDef user fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e
    classDef auto fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef handoff fill:#fef9c3,stroke:#a16207,color:#713f12
    classDef stop fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
```

**Step Categories:**
- 🟦 **User Action**: Manual inputs and reviews.
- 🟩 **[AUTO]**: Claude executes automatically (git branch, calling subagents).
- 🟨 **[HANDOFF]**: User pastes and runs the `/speckit-*` command printed by Claude.
- 🟥 **[PAUSE]**: Mandatory approval gate.

---

## Team Workflow & Conflict Prevention

When multiple team members collaborate on a single repository:

- **Feature ID = GitHub Issue Number**: Branch as `NNN-<slug>` (e.g., `#42` -> `042-user-reservation`). Global uniqueness guarantees zero branch collisions.
- **Timestamped Specs Directory**: `specs/<YYYYMMDD-HHMMSS>-<slug>` ensures parallel spec generation never collides in Git.
- **Physical Feature Isolation**: Code strictly under `src/features/<slug>/`. Shared directories (`src/shared/`, configs, routers) are modified with small, isolated commits.
- **Shared Files Governance**:
  - **ADDING** new terms to `docs/00-glossary.md` is allowed directly in the feature branch (Steward reviews during PR).
  - **EDITING or DELETING** existing terms or amending `.specify/memory/constitution.md` requires an isolated PR approved by the Steward.
- **Rebase Regularly**: Rebase onto `main` frequently; rerun `/speckit-analyze` to catch any drift when constitution or glossary updates.

For comprehensive team guidelines, consult [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md) and [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md).

---

## Environment Prerequisites

- **Node.js**: >= 18.0.0
- **Claude Code**: Latest release with subagent and slash command support.
- **Spec Kit CLI**: Installed via `uv` or `pipx` (`uvx --from git+https://github.com/github/spec-kit.git specify init ...`).
- **Git**: Installed and configured.
- **Figma MCP Server** (Optional): Pre-configured for both `mcp__figma__*` and `mcp__claude_ai_Figma__*`. If omitted, `design-intake` gracefully falls back to local snapshots in `docs/03-ui/`.

---

## Contributing & License

Contributions are welcome! Please refer to [`CONTRIBUTING.md`](CONTRIBUTING.md) for local smoke testing procedures and pull request guidelines.

Released under the [MIT License](LICENSE).
