# `.specify/memory/constitution.md` への追加推奨条項

初回に `/speckit-constitution` を実行した後、日本語設計書を扱うプロジェクト向けに以下の条項（Article）を追加することを推奨します：

## Article X — Terminology fidelity（用語の一貫性）
すべての業務語彙はコードや仕様書で使用する前に `docs/00-glossary.md` を参照しなければならない。
語彙集と照合せずに汎用的な英単語へ独自翻訳することを禁ずる。

## Article Y — Source-of-truth precedence（正本の優先順位と矛盾解決）
基本設計・詳細設計・Figmaの間で矛盾が生じた場合、独断で一方を選択してはならない。
必ず `/speckit-clarify`（または `/qa-sheet`）で提起し、決定内容を `docs/04-decisions/` に記録すること。

## Article Z — Intake artifact requirement（Intake成果物の必須化）
日本語設計書やFigmaが存在する機能では、直接 `/speckit-specify` を呼び出さず、必ずサブエージェント `design-intake` を経由して `docs/intake/` に成果物を生成すること。

## Article W — Test coverage & TDD（テストカバレッジとTDD）
新規ビジネスロジックには必ず自動テストを伴い、TDD（RED → GREEN → Refactor）を優先する。
ビジネスロジックのテストカバレッジは最低 **80%** とし、テストゲートでは全テスト通過かつカバレッジ基準達成を必須とする。
