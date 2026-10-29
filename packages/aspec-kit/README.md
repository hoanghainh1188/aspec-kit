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
```

### Commands
- `init [dir]`: Scaffolds a new project (pass `.` to initialize in the current directory).

### Options & Flags

| Flag | Description | Default |
|---|---|:---:|
| `[project-directory]` | Target directory name for the new project | `my-aspec-app` |
| `-y, --yes` | Skip interactive prompts and accept all defaults | `false` |
| `--steward <handle>` | Specify GitHub handle of project Steward for `.github/CODEOWNERS` | `@your-handle` |
| `--clean` | Automatically clean up reference sample feature (`000-example-reservation`) | `true` with `-y` |
| `--keep-example` | Keep the sample feature to inspect code & spec structure | `false` |
| `-v, --version` | Output current CLI version | — |
| `-h, --help` | Display usage guide and options | — |

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
│   ├── agents/                    4 subagents (design-intake, code-reviewer, security-reviewer, glossary-steward)
│   ├── hooks/                     Format-on-save hook
│   └── commands/                  Hybrid orchestration command /design-to-code
├── docs/
│   ├── 00-glossary.md              Single source of truth for JP / VI / EN business terms
│   ├── 01-basic-design/            基本設計 directly from client (read-only)
│   ├── 02-detail-design/           詳細設計 directly from client (read-only)
│   ├── 03-ui/                      Figma links and visual snapshots
│   ├── 04-decisions/               Decisions from /speckit-clarify (INDEX.md)
│   ├── 05-lessons.md               Technical gotchas and project lessons
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
