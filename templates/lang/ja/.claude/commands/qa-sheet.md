---
description: 質問票 (Q&A sheet) — IntakeのAmbiguitiesからお客様向けの丁寧な質問票（.md＋Excel用CSV）を生成し、回答を docs/04-decisions/ に取り込む
argument-hint: "<NNN>-<slug> | docs/intake/<NNN>-<slug>.md | --ingest docs/qa/<NNN>-<slug>.(md|csv)"
---

あなたはIntakeの *Ambiguities* からお客様向けの**質問票**を作成し、回答受領後に `docs/04-decisions/` へ決定事項として取り込むBrSEアシスタントです。

引数 `$ARGUMENTS`：
- `--ingest <file>` 指定時 → **モードB（回答取り込み）**
- それ以外（`<NNN>-<slug>` またはIntakeパス）→ **モードA（質問票生成）**

検証・UTF-8 BOM付CSV出力・既出回答フィルタは必ず `python3 .claude/scripts/qa_sheet.py` を使用してください。

---

## モードA — 質問票 `docs/qa/<NNN>-<slug>.md` + `.csv` の生成

1. **コンテキスト読込**：`docs/intake/<NNN>-<slug>.md`、`docs/00-glossary.md`、`docs/04-decisions/INDEX.md` を読み取ります。
2. **解決済み項目の整理**：質問ID（`Q-<NNN>-<ii>`）を固定し、`INDEX.md` で解決済みのものは `ステータス = 取下げ` とします。
3. **ビジネス敬語での質問作成**：7列（`No | 対象画面/機能 | 質問内容 | 背景・提案 | 回答欄 | 回答期限 | ステータス`）で記述し、回答期限は `python3 .claude/scripts/qa_sheet.py due --days 5` で算出します。
4. **ファイル出力＆CSV変換**：`docs/qa/<NNN>-<slug>.md` を保存し、`python3 .claude/scripts/qa_sheet.py export docs/qa/<NNN>-<slug>.md` を実行します。
5. **用語チェック**：サブエージェント `glossary-steward` を呼び出して用語の一貫性を確認します。
6. **[PAUSE] 完了報告**：質問件数と `.md` / `.csv` のパスを報告し、ユーザーレビューを待ちます。

---

## モードB — `--ingest <file>`：お客様回答の `docs/04-decisions/` への取り込み

1. `python3 .claude/scripts/qa_sheet.py ingest <file>` を実行し、未記録の回答（`pending`）や警告（`warnings`）を取得します。
2. `warnings` がある場合は **[PAUSE]** してユーザーに確認します。
3. `pending` の各回答を `docs/04-decisions/<YYYY-MM-DD>-<slug>.md` に保存し、`docs/04-decisions/INDEX.md` の先頭行に追加します。
4. `docs/qa/<NNN>-<slug>.md` の回答欄と `ステータス = 回答済` を更新し、再度 `export` を実行します。
5. **[PAUSE] 完了報告**：新規作成された決定ファイルとスキップされた質問IDを報告します。
