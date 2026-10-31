# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-10-31

### Added

- **BrSE Workflow & Japanese Client Deliverables**:
  - `/qa-sheet` command & `.claude/scripts/qa_sheet.py`: Generate polite Japanese 質問票 (`.md` + UTF-8 BOM Excel `.csv`) from intake ambiguities and ingest client answers into `docs/04-decisions/` ([#21](https://github.com/hoanghainh1188/aspec-kit/issues/21), [#40](https://github.com/hoanghainh1188/aspec-kit/pull/40)).
  - `aspec-kit convert` CLI & `.claude/scripts/convert-design.py`: Convert Japanese Detail/Basic Design `.xlsx`, `.xlsm`, and `.pdf` files into structured Markdown while expanding merged cells and recording SHA-256 hashes in `CHANGELOG.md` ([#22](https://github.com/hoanghainh1188/aspec-kit/issues/22), [#41](https://github.com/hoanghainh1188/aspec-kit/pull/41)).
  - `/design-change` command & `impact-analyzer` subagent: Analyze 仕様変更 (specification changes) across design docs, intake, spec ACs, tasks, code, and tests, generating `docs/changes/YYYY-MM-DD-<slug>.md` with a Japanese 影響範囲 summary ([#23](https://github.com/hoanghainh1188/aspec-kit/issues/23), [#42](https://github.com/hoanghainh1188/aspec-kit/pull/42)).
  - `/traceability` command & `.claude/scripts/traceability.py`: Generate and audit `docs/traceability.md` (要件トレーサビリティマトリクス) linking design/intake → spec ACs → tasks → source files → tests ([#31](https://github.com/hoanghainh1188/aspec-kit/issues/31), [#47](https://github.com/hoanghainh1188/aspec-kit/pull/47)).
  - `/test-spec` command & `.claude/scripts/test_spec.py`: Validate and export 7-column Japanese テスト仕様書 (`No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考`) in `docs/test-specs/<NNN>-<slug>.{md,csv}` with AC coverage checks ([#32](https://github.com/hoanghainh1188/aspec-kit/issues/32), [#48](https://github.com/hoanghainh1188/aspec-kit/pull/48)).
  - `/progress-report` command & `.claude/scripts/progress_report.py`: Aggregate factual `tasks.md` checkboxes, `docs/qa/` statuses, and `git log` commits into Japanese weekly progress reports (`docs/reports/YYYY-MM-DD-<slug>.md` — `完了事項 / 進行中 / 課題・リスク / 来週予定`) ([#33](https://github.com/hoanghainh1188/aspec-kit/issues/33), [#49](https://github.com/hoanghainh1188/aspec-kit/pull/49)).
- **CLI Lifecycle, Localization & Multi-Agent Support**:
  - `aspec-kit update [--dry-run] [--to <ref>]`: Upgrade kit-owned template files via a 3-way merge using `.aspec-kit.json` manifest hashes while never touching client docs, glossary, decisions, specs, or `src/` ([#24](https://github.com/hoanghainh1188/aspec-kit/issues/24), [#39](https://github.com/hoanghainh1188/aspec-kit/pull/39)).
  - `aspec-kit doctor [--json]`: Validate required tools (`git`, `uv`, `claude`, `python3`), Spec Kit skills, `CODEOWNERS`, formatter hook, and GitHub branch protection ([#25](https://github.com/hoanghainh1188/aspec-kit/issues/25), [#37](https://github.com/hoanghainh1188/aspec-kit/pull/37)).
  - `--stack ts|python|go|java` flag on `aspec-kit init`: Auto-configure `.claude/hooks/format.sh`, `.claude/settings.json` test runner permissions, and stack section in `CLAUDE.md` ([#28](https://github.com/hoanghainh1188/aspec-kit/issues/28), [#44](https://github.com/hoanghainh1188/aspec-kit/pull/44)).
  - `--lang vi|en|ja` flag on `aspec-kit init`: Overlay full localized documentation, subagents, and slash commands in Vietnamese (default), English, or Japanese while keeping Japanese domain artifacts intact ([#29](https://github.com/hoanghainh1188/aspec-kit/issues/29), [#45](https://github.com/hoanghainh1188/aspec-kit/pull/45)).
  - `--agent claude|gemini|copilot|cursor` flag on `aspec-kit init`: Generate synchronized instruction files (`GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/aspec-kit.mdc`) and wire `specify init --ai` inside `bootstrap.sh` ([#30](https://github.com/hoanghainh1188/aspec-kit/issues/30), [#46](https://github.com/hoanghainh1188/aspec-kit/pull/46)).
- **Documentation, Examples & Release Automation**:
  - End-to-end example project `examples/01-reservation-app/` (Basic Design PDF, Detail Design 4-sheet Excel, Figma SVG wireframe, Intake, 質問票, Decision log, Spec/Plan/Tasks, TypeScript + Vitest, Traceability, テスト仕様書, and 進捗報告) with walkthrough in `examples/README.md` ([#34](https://github.com/hoanghainh1188/aspec-kit/issues/34), [#50](https://github.com/hoanghainh1188/aspec-kit/pull/50)).
  - Keep-a-Changelog `CHANGELOG.md`, automatic changelog extraction for GitHub Releases in `publish-npm.yml`, and animated terminal demo in `README.md` ([#35](https://github.com/hoanghainh1188/aspec-kit/issues/35)).

### Changed

- `/design-to-code` orchestrator now invokes Spec Kit skills (`/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`) directly via the `Skill` tool instead of stopping for manual copy-paste handoffs ([#27](https://github.com/hoanghainh1188/aspec-kit/issues/27), [#38](https://github.com/hoanghainh1188/aspec-kit/pull/38)).

## [0.2.0] - 2026-10-30

### Added

- Hardened CLI scaffolding against accidental data loss (`--force` required to overwrite existing files), excluded kit-internal packaging files via `.aspecignore` and `DEFAULT_EXCLUDES`, pinned template downloads to release tag `v<version>`, and added `--steward`, `--clean`, `--keep-example`, and `--template-ref` options ([#18](https://github.com/hoanghainh1188/aspec-kit/issues/18), [#19](https://github.com/hoanghainh1188/aspec-kit/issues/19), [#20](https://github.com/hoanghainh1188/aspec-kit/issues/20), [#26](https://github.com/hoanghainh1188/aspec-kit/pull/26)).
- Added `kit-ci.yml` workflow testing the CLI across Node 18, 20, and 22, verifying version consistency (`sync-version.mjs`), and running Vitest on the reference feature ([#26](https://github.com/hoanghainh1188/aspec-kit/pull/26)).
- Added project social banner (`assets/aspec-kit-banner.png`) and GitHub Spec Kit attribution ([#10](https://github.com/hoanghainh1188/aspec-kit/pull/10)).

## [0.1.1] - 2026-10-29

### Fixed

- Configured native npm OIDC Trusted Publishing with Node.js 22 and latest `npm` in `.github/workflows/publish-npm.yml` and automatic GitHub Release creation ([#7](https://github.com/hoanghainh1188/aspec-kit/pull/7), [#8](https://github.com/hoanghainh1188/aspec-kit/pull/8), [#9](https://github.com/hoanghainh1188/aspec-kit/pull/9)).
- Translated npm package README and root README into English ([#5](https://github.com/hoanghainh1188/aspec-kit/pull/5), [#6](https://github.com/hoanghainh1188/aspec-kit/pull/6)).

## [0.1.0] - 2026-10-29

### Added

- Initial release of `aspec-kit` template, Claude Code plugin (`.claude-plugin/`), and zero-dependency `@hoanghainh/aspec-kit` npm CLI scaffolder ([#2](https://github.com/hoanghainh1188/aspec-kit/pull/2), [#3](https://github.com/hoanghainh1188/aspec-kit/pull/3), [#4](https://github.com/hoanghainh1188/aspec-kit/pull/4)).
- 4 core subagents (`design-intake`, `code-reviewer`, `security-reviewer`, `glossary-steward`), `/design-to-code` runbook, 5-tier Git-backed project memory (`docs/00-glossary.md`, `docs/04-decisions/`, `docs/05-lessons.md`), and worked reference feature `000-example-reservation`.

[Unreleased]: https://github.com/hoanghainh1188/aspec-kit/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/hoanghainh1188/aspec-kit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/hoanghainh1188/aspec-kit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/hoanghainh1188/aspec-kit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/hoanghainh1188/aspec-kit/releases/tag/v0.1.0
