# チーム開発ワークフロー＆コンフリクト防止ガイド

本ドキュメントでは、複数メンバーが1つのリポジトリで並行開発する際に **Gitコンフリクト** と **コンテキストドリフト**（語彙集・Constitution・上流設計書の認識ズレ）を防ぐ方法を説明します。`CLAUDE.md` および `README.md` と併せて参照してください。

> ⚠️ **チーム開発開始前の必須セットアップ（2項目）：**
> 1. **`.github/CODEOWNERS`** — `@your-lead-handle` を実際のStewardのGitHubハンドルに変更する。
> 2. **`main` のBranch protection** — *Require PR* + *Require review from Code Owners* + *Require status checks* + *Require branches up to date* を有効化する（[第9節](#9-コンフリクトホットスポットとbranch-protection)参照）。

---

## 1. リポジトリ＆ブランチモデル

- **単一リポジトリ**、デフォルトブランチ `main` は常にグリーン（CI通過・デプロイ可能）に保つ。
- 1フィーチャー＝`main` から切る**短命ブランチ**とし、Pull Request経由でマージする。

---

## 2. フィーチャー採番規約 — GitHub Issue番号の活用

1. **すべてのフィーチャーはGitHub Issueから開始する**（Issue番号＝フィーチャーID）。
2. **ブランチ名**: `NNN-<slug>`（`NNN` は少なくとも3桁ゼロ埋めのIssue番号、例：Issue `#42` → `042-user-reservation`）。
3. **`specs/` ディレクトリ採番＝`timestamp`**（`bootstrap.sh` が `.specify/init-options.json` に `"feature_numbering": "timestamp"` を設定）。並行作業でも `specs/<YYYYMMDD-HHMMSS>-<slug>` が衝突しません。

> ブランチ名 `NNN-<slug>`、設計書フォルダ `docs/01-03/<slug>/`、Intake `docs/intake/<NNN>-<slug>.md`（[`docs/intake/README.md`](intake/README.md)参照）、実装コード `src/features/<slug>/` で同じ `<slug>` を一貫して使用します。

---

## 3. フィーチャーのライフサイクル

```
1. GitHub Issue作成（Featureテンプレート）      → Issue番号＝ID、Assignee設定
2. git checkout main && git pull               → 最新化
3. git checkout -b NNN-<slug>                  → Issueに in-progress ラベル付与
4. 設計書を docs/01-basic-design/<slug>/, 02-detail-design/<slug>/, 03-ui/<slug>/ に配置
5. /design-to-code 実行                        → intake → speckit → implement → review → test
6. PR作成 "Closes #<issue>"
7. code-reviewer + glossary-steward + security-reviewer + 人的レビュー（Blocking解消）
8. テストゲート通過（カバレッジ ≥ Article W 80%）→ mainへマージ
```

---

## 4. フィーチャー単位のコード分離（`src/`）

- **機能固有コード** → `src/features/<slug>/` に隔離し、並行ブランチ間のファイル衝突を防ぎます。
- **共有領域**（`src/shared/`、設定、ルーター等）を変更する場合は、小さなコミットに分けて早期にマージします（[第7節](#7-glossaryとconstitutionのガバナンス)参照）。

---

## 5. チームコンフリクト対策

| | **Gitコンフリクト**（構文的衝突） | **コンテキストドリフト**（意味的ズレ） |
|---|---|---|
| 内容 | 2つのブランチが**同じ行／ファイル**を編集 | 2つのブランチが**異なる版の語彙集／Constitution／設計書**に依存 |
| 検出者 | Git（マージ／リベース時） | 自動検出なし（マージは通るが古い用語や規約違反が混入） |
| 防止策 | ファイル分離（[第4節](#4-フィーチャー単位のコード分離src)）＋短命ブランチ | 日次リベース＋`/speckit-analyze` 再実行＋CODEOWNERSゲート |

---

## 6. コンテキストドリフトの防止

- **毎日 `main` をリベース**し、最新の語彙集・Constitutionを取り込む。
- `docs/00-glossary.md` または `.specify/memory/constitution.md` が更新された場合は、リベース後に `/speckit-analyze` と `glossary-steward` を再実行する。
- 仕様の疑問点を質問する前に `docs/04-decisions/`（[`INDEX.md`](04-decisions/INDEX.md)）を確認する。

---

## 7. GlossaryとConstitutionのガバナンス

| 操作 | 手順 | 理由 |
|---|---|---|
| 新規用語の**追加（append）** | **フィーチャーブランチ内で直接追記**（PR時にCODEOWNERSでStewardがレビュー） | 追記は衝突しにくく、開発の手を止めないため |
| 既存用語の**変更・改名・削除** | Steward承認の**個別PR** | 用語の意味変更はコードベース全体に波及するため |
| `constitution.md` の**あらゆる変更** | Steward承認の**個別PR** | Spec Kit全体の最上位規約であり影響範囲が最大のため |

---

## 8. 開発途中の上流設計書更新（`docs/01-03`）

実装中にクライアントから改訂版設計書（仕様変更）が届いた場合：
- 旧版を**上書きせず**、新バージョンのファイルを追加し、`CHANGELOG.md` に **Affected issues** を記載した上で `/design-change <旧版> <新版>` を実行します。

---

## 9. コンフリクトホットスポットとBranch Protection

GitHubの Settings → Branches → `main` のルールで以下を有効化してください：
- ☑ Require a pull request before merging（承認1名以上）
- ☑ Require review from **Code Owners**
- ☑ Require status checks to pass（`template-smoke-test` およびプロジェクトCI）
- ☑ Require branches to be up to date before merging

---

## 10. 要点まとめ

1. **最初にCODEOWNERSとBranch protectionを設定する。**
2. **Issueを先に作成し**、Issue番号をブランチ `NNN-<slug>` に使う。
3. **1フィーチャー1担当者**で最後まで完結させる（引き継ぎ時は `docs/intake/README.md` のチェックリストを使用）。
4. **既存用語・Constitutionの変更は個別PR**、新規用語の追加はブランチ内でappendする。
5. **毎日 `main` をリベース**し、共有メモリ変更時は `/speckit-analyze` と `glossary-steward` を再実行する。
