# AIエージェント向けプロジェクト規約

## 概要
<記入：プロジェクトの目的、クライアント、上流設計書の言語>

## Tech stack
<実装開始時に記入 — Spec Kitの `impl-planner` も自動検出しますが、ここに明記することで全エージェントが最初から一貫して動作します>

> 技術スタック確定後、`.claude/hooks/format.sh` にフォーマッタコマンドを設定して保存時フォーマット
> （Edit/Write後のPostToolUseフック）を有効化してください。標準品質順序：format → lint → type check → build。
>
> ⚠️ **`.claude/settings.json` のallowリストはデフォルトで `npm` を前提としています**。JS/TS以外のスタックを
> 使用する場合は、対応するコマンド（`go test ./...`、`pytest`、`./gradlew test|build` など）に変更してください。

## ディレクトリ構成と役割

- **`docs/01-basic-design/`, `docs/02-detail-design/`, `docs/03-ui/`** — クライアントから受領した**唯一の正（Source of Truth）**。
  エージェントはここを決して変更してはいけません。新版受領時は新ファイル追加＋`CHANGELOG.md`更新とし、上書きしないでください。

- **`docs/00-glossary.md`** — 日・越・英の業務語彙集。すべてのエージェントは業務変数・フィールド名を決める前に必ず参照してください。
  未登録の業務語彙はフィーチャーブランチ内で末尾に追記（append）します（ルール5参照）。

- **`docs/04-decisions/`** — `/speckit-clarify` や `/qa-sheet --ingest` で解決した仕様確認の決定記録（`INDEX.md` が索引）。

- **`docs/05-lessons.md`** — 実装中に判明したプロジェクト固有の技術的注意点（Gotcha）。パイプライン冒頭で読み込み、同じ不具合の再発を防ぎます。

- **`docs/intake/`** — サブエージェント `design-intake` の出力。日本語設計書／FigmaとSpec Kitを橋渡しします。

- **`docs/changes/`** — `/design-change <旧版> <新版>`（サブエージェント `impact-analyzer`）が生成する仕様変更影響レポート。

- **`docs/qa/`** — `/qa-sheet` が生成するお客様向け質問票（`<NNN>-<slug>.md`＋Excel用UTF-8 BOM付 `.csv`）。詳細は `docs/qa/README.md`。

- **`docs/reports/`** — `/progress-report`（`progress_report.py collect`）が生成する週次進捗報告（`完了事項`／`進行中`／`課題・リスク`／`来週予定`）。詳細は `docs/reports/README.md`。

- **`specs/<feature>/`** — Spec Kitが生成する仕様・計画・タスク（`spec.md`, `plan.md`, `tasks.md`）。手作業で編集せず、パイプラインから再生成します。

- **`.specify/memory/constitution.md`** — プロジェクトの不変原則（Constitution）。Spec Kitワークフロー内で最優先されます。

- **`src/`** — 実装コード。**フィーチャー単位の分離：** 機能固有のコードは `src/features/<slug>/` に配置し、並行開発時のコンフリクトを防ぎます。詳細は `docs/TEAM-WORKFLOW.md`。

## Memory（プロジェクトメモリ）

パイプライン内の各エージェントは**ステートレス**であるため、知識は5つのGit管理ファイルに外部化します：

| ソース | メモリ種別 | 更新方法 |
|---|---|---|
| `.specify/memory/constitution.md` | 不変原則 | `/speckit-constitution` + Steward PR |
| `docs/00-glossary.md` | 業務語彙 | ブランチ内で追記（append）；既存変更はSteward PR |
| `docs/04-decisions/` + `INDEX.md` | 仕様決定履歴 | `/speckit-clarify` / `/qa-sheet --ingest` |
| `docs/05-lessons.md` | 技術的知見・Gotcha | ブランチ内で追記 |
| `CLAUDE.md` | プロジェクト規約 | PR |

## 設計書からのコード生成パイプライン（`/design-to-code`）
Claude Codeで `/design-to-code` を実行し、設計書パスやFigmaリンクを指定します。

- **サブエージェント**（`design-intake`, `code-reviewer` 等）→ Taskツール経由で自動実行。
- **Spec Kitスキル**（`speckit-specify|clarify|plan|tasks|analyze|implement`）→ Skillツール経由で自動実行し、各ステップ後にレビューのため一時停止します（スキル未導入時は **[HANDOFF]** にフォールバック。詳細は `docs/04-decisions/2026-10-31-runbook-auto-invoke-speckit.md`）。

順序：**メモリ読込** → design-intake → specify → clarify → plan → tasks → analyze → implement → code-reviewer → glossary-steward → security-reviewer → **テストゲート** → **デプロイ**。

## Deploy
<プロジェクト固有のデプロイ手順を記入 — `/design-to-code` のステップ15が参照します。未記入の場合はデプロイ前に確認のため停止します。>

## 必須ルール
1. 基本設計・詳細設計・Figma間の矛盾はすべて `/speckit-clarify` に提起し、独断で一方を採用して黙殺しないこと。
2. `clarify` の回答はすべて `docs/04-decisions/` に記録すること。
3. `docs/intake/` と `specs/` はGitにコミットし、実装時点の仕様理解の証跡を残すこと。
4. **フィーチャーID＝GitHub Issue番号。** ブランチ名は `NNN-<slug>`（3桁ゼロ埋め、例：Issue #42 → `042-user-reservation`）。
5. **共有ファイルのガバナンス（追加と変更の区別）：**
   - `docs/00-glossary.md` の**既存語彙の変更・削除**および `.specify/memory/constitution.md` の変更 → Steward承認の**専用PR**が必須。
   - `docs/00-glossary.md` への**新規語彙の追記（append）** → フィーチャーブランチ内で直接実施可（PR時にCODEOWNERSがStewardレビューを要求）。
6. **コンテキストドリフト防止：** 着手前に `main` を同期し、constitutionやglossaryが更新された場合はリベース後に `/speckit-analyze` を再実行すること。

> チーム開発・コンフリクト防止の詳細は [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md) を参照してください。
