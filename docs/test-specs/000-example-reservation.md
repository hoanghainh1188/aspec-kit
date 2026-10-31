> ⚠️ **テスト仕様書 MẪU — XOÁ TRƯỚC KHI DÙNG THẬT.** Đi kèm feature mẫu `000-example-reservation`, sinh bằng
> `/test-spec 000-example-reservation` từ [`specs/000-example-reservation/spec.md`](../../specs/000-example-reservation/spec.md).
> Xoá cùng `docs/test-specs/000-example-reservation.csv`.

# テスト仕様書 — 予約承認（000-example-reservation）

| 項目 | 内容 |
|---|---|
| 案件 | サンプル予約システム |
| 対象機能 | 予約承認（000-example-reservation） |
| 作成日 | 2026-10-31 |
| 版数 | 第1版 |

## テストケース一覧

| No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考 |
|---|---|---|---|---|---|---|
| TC-000-01 | 正常系：担当予約一覧の表示（AC 1） | 担当者Aに紐づくステータス「pending」の予約が存在すること | 1. 担当者Aでログインする<br>2. 予約承認一覧画面を開く | 自身に割り当てられたステータス「pending」の予約一覧が表示されること | 未実施 | AC 1 |
| TC-000-02 | 正常系：予約の承認（AC 2, AC 3） | 担当者Aに割り当てられたステータス「pending」の予約が存在すること | 1. 予約詳細画面を開く<br>2. 「承認」を実行する | ステータスが「approved」に遷移し、顧客へ通知が送信されること | OK | AC 2, AC 3 · `approveReservation.test.ts` |
| TC-000-03 | 正常系：理由入力ありでの予約却下（AC 2） | 担当者Aに割り当てられたステータス「pending」の予約が存在すること | 1. 予約詳細画面を開く<br>2. 却下理由を入力して「却下」を実行する | ステータスが「rejected」に遷移すること | OK | AC 2 · `approveReservation.test.ts` |
| TC-000-04 | 異常系：理由未入力での予約却下（AC 2） | 担当者Aに割り当てられたステータス「pending」の予約が存在すること | 1. 予約詳細画面を開く<br>2. 却下理由を空欄（または空白のみ）で「却下」を実行する | バリデーションエラー（「却下理由を入力してください」）となり、ステータスが「pending」のまま変化しないこと | OK | AC 2 · V-03 · `approveReservation.test.ts` |
| TC-000-05 | 異常系：別担当者による承認・却下操作（AC 4） | 担当者Aに割り当てられたステータス「pending」の予約が存在すること | 1. 担当者B（別担当者）で対象予約の承認または却下を実行する | 権限エラー（403 Forbidden）となり、ステータスが変化しないこと | OK | AC 4 · V-01 · `approveReservation.test.ts` |
| TC-000-06 | 異常系：処理済み予約の再承認・再却下（AC 2） | ステータスが既に「approved」または「rejected」の予約が存在すること | 1. 担当者Aで対象予約の承認または却下を実行する | エラー（「処理済みの予約です」）となり、処理が拒否されること | OK | AC 2 · V-02 · `approveReservation.test.ts` |

結果：OK／NG／未実施／対象外／保留

<!-- nội bộ: nguồn = specs/000-example-reservation/spec.md · export: python3 .claude/scripts/test_spec.py export docs/test-specs/000-example-reservation.md -->
