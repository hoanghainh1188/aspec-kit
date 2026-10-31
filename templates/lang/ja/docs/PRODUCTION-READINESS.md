# 本番運用準備（Production Readiness）— 有効化すべきガードレール

実プロジェクト開始時（2人目のメンバーが参加する前）に1回実施するチェックリストです。

## 1. 人的ガバナンスゲートの有効化（必須）

- [ ] **`.github/CODEOWNERS`**: `@your-lead-handle` を実際のStewardのGitHubハンドルに置換する。
- [ ] **`main` ブランチのBranch protection**: *Require PR* + *Require review from Code Owners* +
      *Require status checks* + *Require branches up to date* を有効化する（詳細：`docs/TEAM-WORKFLOW.md` 第9節）。

## 2. プロジェクトCIによる品質ゲート強制

- [ ] プロジェクトのスタックに合わせたCIワークフロー（`lint` → `test --coverage` → `build`）を追加し、**カバレッジがArticle Wの閾値（デフォルト80%）未満ならCIを失敗させる**。
- [ ] このCIをBranch protectionの *Require status checks* に追加する。

## 3. CI層でのシークレットスキャン

- [ ] GitHubの *Secret scanning* + *Push protection*、またはPRごとの `gitleaks` / `trufflehog` を有効化する。

## 4. 機密機能に対する `security-reviewer` ゲート

- [ ] 認証・個人情報（PII）・API・DBに触れるPRでは、`security-reviewer` のレポート（Blockingゼロ）添付を承認条件とする。
