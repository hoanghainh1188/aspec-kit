---
description: ハイブリッド・オーケストレーションパイプライン — 日本語設計書／Figmaの取り込みからSpec Kitワークフロー、テストゲート、デプロイまでを一貫誘導
---

あなたは**オーケストレーション・ランブック**です。`bootstrap.sh` によって `.claude/skills/speckit-*/` にインストールされたSpec Kitスキルを **Skillツール** で自動実行し、各ステップ後にユーザーのレビューを待ちます。サブエージェントは **Taskツール** で呼び出します。

凡例：
- **[AUTO]** = 自動実行（Git操作、サブエージェント呼び出し）
- **[SKILL]** = Skillツール（`skill: "speckit-x"`）を呼び出し、成果物を報告
- **[HANDOFF]** = フォールバック（スキル未導入・ブロック時に `/speckit-x` コマンドを表示してユーザー実行を待つ）
- **[PAUSE]** = 必須レビューゲート（ユーザーの確認を待ってから次へ進む）

---

1. **[AUTO] プロジェクトメモリの読み込み（Recall bootstrap）** — コンテキストドリフト防止のため最初に5つのメモリ（`.specify/memory/constitution.md`, `docs/00-glossary.md`, `docs/04-decisions/INDEX.md`, `docs/05-lessons.md`, `CLAUDE.md`）を読み込み要約します。

2. **[AUTO] フィーチャーブランチの作成** — `git checkout -b <NNN>-<feature-slug>`（`<NNN>` は3桁ゼロ埋めのGitHub Issue番号）。Issueが未作成の場合は停止して作成を促します。

3. **[AUTO] サブエージェント `design-intake` の呼び出し** — `docs/01-basic-design/`、`docs/02-detail-design/`、`docs/03-ui/` を渡し、`docs/intake/<NNN>-<slug>.md` を生成します。

4. **[PAUSE]** Intakeファイル（特に `/speckit-specify` 用プロンプトと Ambiguities）を表示し、ユーザー確認を待ちます。

5. **[SKILL + PAUSE] specify** — Intake内のプロンプト全文を `args` に渡して `speckit-specify` スキルを実行し、`specs/<…>/spec.md` を報告して一時停止します。

6. **[SKILL — 対話] clarify** — 未解決のAmbiguitiesがある場合に `speckit-clarify` を実行し、質問をユーザーへ中継します。完了後、回答を `docs/04-decisions/<YYYY-MM-DD>-<slug>.md` と `docs/04-decisions/INDEX.md` に記録します。

7. **[SKILL + PAUSE] plan** — `speckit-plan` スキルを実行し、`plan.md` を報告してレビューを待ちます。

8. **[SKILL + PAUSE] tasks** — `speckit-tasks` スキルを実行し、`tasks.md` を報告してレビューを待ちます。

9. **[SKILL + PAUSE] analyze** — `speckit-analyze` スキルを実行して整合性レポートを表示します。**ユーザーから明示的な実装承認（「OK implement」）を得るまで次へ進まないでください。**

10. **[SKILL] implement** — ステップ9の承認後、`speckit-implement` スキルを実行してコードを生成します。

11. **[AUTO] サブエージェント `code-reviewer` の呼び出し** — 4つの正本と照合し、**Blocking** 指摘があればすべて解消します。

12. **[AUTO] サブエージェント `glossary-steward` の呼び出し** — `docs/00-glossary.md` との用語一貫性を検証し、新規用語があればブランチ内で追記します。

13. **[AUTO] サブエージェント `security-reviewer` の呼び出し** — 機密領域に触れる機能のセキュリティ監査を実施し、**Blocking** 指摘を解消します。

14. **[PAUSE] テストゲート** — `lint` / `test` / `build` がすべて成功し、かつカバレッジがConstitution基準（Article W：デフォルト80%以上）を満たしていることを確認します。実装中に判明したGotchaは `docs/05-lessons.md` に追記します。

15. **[PAUSE] デプロイ** — `CLAUDE.md` の `## Deploy` セクションを読み取り、ユーザーの明示的な確認を得てからデプロイを実行します。
