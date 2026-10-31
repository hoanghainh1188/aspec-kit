<!-- aspec-kit convert: source=reservation-detail-design.xlsx — generated file, do not edit; re-run the converter -->
# 画面項目定義

> Source: `reservation-detail-design.xlsx` › sheet `画面項目定義` (2/4) · sha256 `6015d0a5985e`

**画面項目定義（SCR-RES-01: 会議室予約登録画面）**

| No | 項目名 | 論理名 (EN) | 型 | 桁数/範囲 | 必須 | バリデーション・備考 |
|---|---|---|---|---|---|---|
| 1 | 会議室ID | roomId | 文字列 | 1〜32 | ○ | ROOM-A / ROOM-B / ROOM-EXEC のいずれか |
| 2 | 予約者メール | organizerEmail | 文字列 | 〜254 | ○ | 社内ドメイン (@example.co.jp) 必須 |
| 3 | 利用日 | reservationDate | 日付 (YYYY-MM-DD) | 10 | ○ | 本日以降の営業日（土日不可） |
| 4 | 開始時刻 | startTime | 時刻 (HH:MM) | 5 | ○ | 09:00〜18:00（30分単位） |
| 5 | 終了時刻 | endTime | 時刻 (HH:MM) | 5 | ○ | 開始時刻より後、最大4時間（240分）まで |
| 6 | 参加人数 | attendeeCount | 整数 | 1〜50 | ○ | 1名以上かつ会議室定員以下（10名超は部長承認対象） |
| 7 | プロジェクター利用 | requiresProjector | 真偽値 | - |  | ROOM-EXEC は常設のため常に true |
