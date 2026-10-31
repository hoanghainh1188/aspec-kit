# Recommended Additions for .specify/memory/constitution.md

After running `/speckit-constitution` for the first time, consider adding the articles below to
`.specify/memory/constitution.md` for projects working with Japanese design documents:

## Article X — Terminology fidelity
Every Japanese domain term must be looked up in `docs/00-glossary.md` before being used in code or specs.
Translating terms into generic English without checking the glossary is prohibited.

## Article Y — Source-of-truth precedence
When contradictions arise between basic design (基本設計), detail design (詳細設計), and Figma,
agents MUST NOT silently pick one side. Contradictions must be raised in `/speckit-clarify`, and answers
must be recorded in `docs/04-decisions/`.

## Article Z — Intake artifact requirement
Never invoke `/speckit-specify` directly for features backed by Japanese design docs or Figma —
always run the `design-intake` subagent first to produce an intake file in `docs/intake/`.
This guarantees backward traceability to the upstream design documents.

## Article W — Test coverage & TDD
All new business logic must include automated tests; prefer writing tests first (TDD: RED → GREEN → refactor).
Minimum test coverage is **80%** on business logic (excluding scaffolding, generated code, and configuration).
The test gate requires both passing tests AND meeting this coverage threshold before merge/deploy.

> The 80% threshold is invariant; *how* coverage is measured depends on your tech stack — configure the
> project command (`jest --coverage`, `go test -cover`, `pytest --cov`, JaCoCo) in your test script/CI.
