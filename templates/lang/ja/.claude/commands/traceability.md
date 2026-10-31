---
description: 要件トレーサビリティマトリクス — 設計書/intake → spec AC → tasks → ソースコード → テストを紐付ける docs/traceability.md を生成し、漏れを検出する
argument-hint: "[<NNN>-<slug>] [--check] [--strict]"
---

あなたはプロジェクトの **要件トレーサビリティマトリクス (Traceability Matrix)** を監査する BrSE／テックリードです。
**上流設計書（基本設計・詳細設計）および Intake** → **Spec 受入基準 (AC)** → **タスク (`tasks.md`)** →
**ソースコード (`src/features/<slug>/`)** → **テストケース** を一貫して紐付け、以下の漏れを検出します：
- 自動テストが存在しない AC
- 未完了タスク（`[ ]`）またはタスク未割当の AC
- いかなる要件・タスクにも紐付かないソースファイル

引数: `$ARGUMENTS`
- 空欄 → `specs/` 配下の全フィーチャーを対象に `docs/traceability.md` を生成。
- `<NNN>-<slug>` → 指定フィーチャーのみ対象。
- `--check`（または `--strict`）→ カバレッジ検証を実行。

ファイル走査・`AC N` / `Tn` の照合・Markdown テーブル出力は **必ず** 決定論的スクリプト
`python3 .claude/scripts/traceability.py` を通じて実行してください（目視推測で書かないこと）。

---

1. **[自動] マトリクス生成と監査スクリプトの実行：**
   - `python3 .claude/scripts/traceability.py generate`（単一フィーチャー指定時は `--feature <NNN>-<slug>`）を実行し、`docs/traceability.md` を更新する。
   - `python3 .claude/scripts/traceability.py check --json` を実行し、行データと `gaps`（漏れ一覧）を取得する。

2. **[自動] 上流設計書 ID との照合（補足確認）：**
   - 生成された `docs/traceability.md` を確認する。
   - `docs/01-basic-design/<slug>/` や `docs/02-detail-design/<slug>/` 内の個別項目 ID（例：`V-01`, `U-02`, `SCR-RSV-02`）との対応関係を整理する。

3. **[一時停止] ユーザーへの報告：**
   - カバー済み AC（`✅ Covered`）、保留タスクのある AC（`⏳`）、テスト未作成の AC（`⚠️`）、未紐付けコード（`unlinked_code`）の件数を要約する。
   - 漏れがある場合は具体的な解消策（テスト名への `(AC N)` 追記、`tasks.md` の更新、未決事項に対する `/qa-sheet` や `/speckit-clarify` の実行）を提案する。
