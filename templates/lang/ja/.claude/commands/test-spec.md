---
description: テスト仕様書 — spec.md の受入基準（AC）から日本標準のテスト仕様書（No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考）を Markdown + Excel 用 CSV で生成する
argument-hint: "<NNN>-<slug> | specs/<NNN>-<slug>/spec.md"
---

あなたはクライアント提出用の **テスト仕様書** を作成する BrSE／QAリードです。
`specs/*<slug>*/spec.md` の受入基準（Acceptance Criteria）および `docs/02-detail-design/<slug>/` の入力チェック・画面定義からテストケースを設計します。

引数: `$ARGUMENTS`（`<NNN>-<slug>` または `spec.md` のパス。空欄の場合は現在のブランチ名から推定）。

7列テーブルの構文検証・AC網羅率100%チェック・Excel用CSV（UTF-8 BOM + CRLF）出力は **必ず**
`python3 .claude/scripts/test_spec.py` を通じて実行してください（CSVを直接手書きしないこと）。

---

1. **[自動] コンテキストの読み込み：**
   - `specs/*<slug>*/spec.md`（`## Acceptance criteria`）、`docs/02-detail-design/<slug>/`、`docs/00-glossary.md`、および `src/features/<slug>/` 内の既存テストを確認する。
   - `spec.md` が存在しない場合は停止し、先に `/speckit-specify` の実行を案内する。

2. **[自動] テストケースの設計：**
   - `spec.md` の各受入基準（`AC 1..N`）につき **最低1件以上** のテストケース（`正常系`・`異常系`・`境界値`）を作成する。
   - IDは `TC-<NNN>-<ii>`（2桁連番）。既存ファイルがある場合は既存行と `結果` を維持し、新規ケースを末尾に追記する。
   - `前提条件` と `期待結果` は「〜こと」で結び、`備考`（または `観点`）に対象の `AC <n>` を明記する。
   - 業務語彙は `docs/00-glossary.md` の「日本語」列に厳密に合わせる。

3. **[自動] `docs/test-specs/<NNN>-<slug>.md` の作成：**
   ヘッダー `| No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考 |` の7列テーブルで出力する。

4. **[自動] 検証および CSV 出力：**
   - `python3 .claude/scripts/test_spec.py export docs/test-specs/<NNN>-<slug>.md` を実行する。
   - エラーがあれば `.md` を修正して再実行する。

5. **[自動] サブエージェント `glossary-steward` の呼び出し：**
   `docs/test-specs/<NNN>-<slug>.md` の用語が `docs/00-glossary.md` と一致しているか検証する。

6. **[一時停止] ユーザーへの報告：**
   テストケース件数（正常系／異常系、OK／未実施）と生成された `.md`・`.csv` のパスを報告する。
