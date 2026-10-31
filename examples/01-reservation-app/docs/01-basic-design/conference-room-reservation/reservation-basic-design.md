<!-- aspec-kit convert: source=reservation-basic-design.pdf — generated file, do not edit; re-run the converter -->
# reservation-basic-design

> Converted from `reservation-basic-design.pdf` (sha256 `cad6b6875ef2`) by `aspec-kit convert`. The original file is the source of truth — do not edit this Markdown by hand.

## Page 1

基本設計書 ̶ 会議室予約システム (BD-RES-001 v1.1)
1. 業務概要: 社員が社内会議室（ROOM-A, ROOM-B, ROOM-EXEC）を30分単位で予約する。
2. 会議室マスタ仕様および業務ルール (BR-01〜BR-05)
DING_APPROVAL)

**Table 1.1**

| 会議室ID | 名称 | 定員 | 承認要否ルール |
|---|---|---|---|
| ROOM-A | 大会議室A | 20名 | 10名以下は即時確定(CONFIRMED)、11名以上は承認待ち(PEN |
| ROOM-B | 小会議室B | 8名 | 定員8名まで即時確定(CONFIRMED) |
| ROOM-EXEC | 役員会議室 | 12名 | 人数に関わらず常に承認待ち(PENDING_APPROVAL) |
