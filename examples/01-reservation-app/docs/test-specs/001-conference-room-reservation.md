# テスト仕様書 (Test Specification) — `001-conference-room-reservation`

- **対象機能**: `001-conference-room-reservation`（会議室予約登録画面 `SCR-RES-01`）
- **参照仕様書**: [`specs/001-conference-room-reservation/spec.md`](../../specs/001-conference-room-reservation/spec.md)

| No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考 |
|---|---|---|---|---|---|---|
| TC-001-01 | 異常系：社内ドメイン外のメールアドレス拒否 | `today = 2026-11-02` | `organizerEmail = "user@gmail.com"` で予約登録を実行する | エラーコード `ERR-RES-001` が返却される | OK | AC 1 |
| TC-001-02 | 異常系：過去日および土日の予約拒否 | `today = 2026-11-02` | `reservationDate = "2026-11-07"`（土曜日）で予約登録を実行する | エラーコード `ERR-RES-002` が返却される | OK | AC 2 |
| TC-001-03 | 異常系：30分単位外または4時間超の時間指定拒否 | `today = 2026-11-02` | `startTime = "09:00"`, `endTime = "13:30"`（270分）で予約登録を実行する | エラーコード `ERR-RES-003` が返却される | OK | AC 3 |
| TC-001-04 | 異常系：会議室定員超過の拒否 | `today = 2026-11-02`, `roomId = "ROOM-B"`（定員8名） | `attendeeCount = 9` で予約登録を実行する | エラーコード `ERR-RES-004` が返却される | OK | AC 4 |
| TC-001-05 | 異常系・境界値：時間帯重複の拒否および連続予約の許可 | `ROOM-A` に `10:00〜11:00` の既存予約あり | 1) `10:30〜11:30` で登録<br>2) `11:00〜12:00` で登録 | 1) `ERR-RES-005` が返却される<br>2) 正常に登録される | OK | AC 5 |
| TC-001-06 | 正常系：承認要否判定および役員会議室プロジェクター常設補正 | `today = 2026-11-02` | 1) `ROOM-A`, `10名` で登録<br>2) `ROOM-A`, `11名` で登録<br>3) `ROOM-EXEC`, `4名`, `requiresProjector=false` で登録 | 1) `status = CONFIRMED`<br>2) `status = PENDING_APPROVAL`<br>3) `status = PENDING_APPROVAL`, `requiresProjector = true` | OK | AC 6 / Q-001-01 / Q-001-02 |
