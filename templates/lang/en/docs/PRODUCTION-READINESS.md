# Production Readiness — Guardrails You Must Enable

The template provides the *workflow* (pipeline, traceability, review), while several guardrails are
declared as conventions until you wire them to your stack and GitHub repository. Complete this checklist
**once when starting a real project**, before a second developer joins.

## 1. Enable Human Governance Gates (Load-Bearing) — Mandatory

- [ ] **`.github/CODEOWNERS`**: replace `@your-lead-handle` with the real steward's GitHub handle.
- [ ] **Branch protection for `main`**: enable *Require PR* + *Require review from Code Owners* +
      *Require status checks* + *Require branches up to date*. See `docs/TEAM-WORKFLOW.md` section 9.

## 2. Enforce Quality in Project CI

- [ ] Add a project CI workflow (separate from `template-smoke-test`) running: `lint` → `test --coverage` →
      `build` for your stack. **Fail CI if coverage < Article W threshold (default 80%)**.
      - JS/TS: `vitest run --coverage` / `jest --coverage --coverageThreshold`
      - Go: `go test -cover ./...`, Python: `pytest --cov --cov-fail-under=80`, Java: JaCoCo `check`.
- [ ] Add this CI workflow to *Require status checks* in branch protection (section 1).

## 3. CI-Level Secret Scanning

- [ ] Enable GitHub *Secret scanning* + *Push protection* (Settings → Code security), or run
      `gitleaks`/`trufflehog` on every PR.

## 4. `security-reviewer` Gate for Sensitive Features

- [ ] Convention: PRs touching auth/PII/API/DB **must** attach a `security-reviewer` report with zero
      Blocking findings before approval.
