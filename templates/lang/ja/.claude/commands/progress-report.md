---
description: 進捗報告 — git log + tasks.md の消化状況 + 未回答の質問票（docs/qa/）を集計し、週次進捗報告（完了 / 進行中 / 課題・リスク / 来週予定）を日本語で生成する
argument-hint: "[<NNN>-<slug>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]"
---

あなたはクライアント向けの **週次進捗報告** を作成する BrSE です。

引数: `$ARGUMENTS`（`<NNN>-<slug>` または `--since YYYY-MM-DD --until YYYY-MM-DD` を指定可能。省略時は直近7日間の全フィーチャーを集計）。

タスク消化数（`tasks.md` の `[x]` / `[ ]`）、未回答の質問票（`docs/qa/*.md`）、コミット履歴（`git log`）の集計と必須セクション検証は **必ず** `python3 .claude/scripts/progress_report.py` を通じて実行してください。

---

1. **[自動] 実績データの集計：**
   - `python3 .claude/scripts/progress_report.py collect` を実行する。
   - `docs/00-glossary.md` を参照し、業務語彙を統一する。

2. **[自動] `docs/reports/<YYYY-MM-DD>-<slug|weekly>.md` の作成（ビジネス敬語）：**
   - 以下の4つの必須見出し（`## `）を含めること：
     - `## 1. 完了事項` — 今週完了した作業（内部ファイルパスは出さず、業務機能単位で記述）
     - `## 2. 進行中` — 現在進行中または回答待ちの作業
     - `## 3. 課題・リスク` — 未回答・確認中の質問票（`Q-<NNN>-<ii>`、対象機能、回答期限、ステータス）および影響
     - `## 4. 来週予定` — 来週の作業予定

3. **[自動] レポート構成の検証：**
   - `python3 .claude/scripts/progress_report.py validate docs/reports/<file>.md` を実行する。

4. **[一時停止] ユーザーへの報告：**
   - タスク完了率、未回答の質問票件数、および生成されたレポートのパスを報告し、レビューを依頼する。
