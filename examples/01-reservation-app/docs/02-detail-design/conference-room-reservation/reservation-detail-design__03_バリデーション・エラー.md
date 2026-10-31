<!-- aspec-kit convert: source=reservation-detail-design.xlsx — generated file, do not edit; re-run the converter -->
# バリデーション・エラー

> Source: `reservation-detail-design.xlsx` › sheet `バリデーション・エラー` (3/4) · sha256 `6015d0a5985e`

**エラーメッセージ一覧（SCR-RES-01）**

| エラーコード | 対象項目 | 発火条件 | メッセージ（日本語） |
|---|---|---|---|
| ERR-RES-001 | organizerEmail | 空欄または社内ドメイン外 | 社内メールアドレス（@example.co.jp）を入力してください。 |
| ERR-RES-002 | reservationDate | 過去日または土日 | 利用日は本日以降の営業日を指定してください。 |
| ERR-RES-003 | startTime / endTime | 営業時間外・30分単位外・終了<=開始・240分超 | 利用時間は09:00〜18:00の間で30分単位、最大4時間以内で指定してください。 |
| ERR-RES-004 | attendeeCount | 1未満または会議室定員超過 | 参加人数が会議室の定員を超えています。 |
| ERR-RES-005 | roomId / 時刻 | 同一会議室・時間帯に既存予約あり | 指定された時間帯は既に予約されています。 |
