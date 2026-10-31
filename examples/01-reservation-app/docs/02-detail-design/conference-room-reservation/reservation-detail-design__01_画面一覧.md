<!-- aspec-kit convert: source=reservation-detail-design.xlsx — generated file, do not edit; re-run the converter -->
# 画面一覧

> Source: `reservation-detail-design.xlsx` › sheet `画面一覧` (1/4) · sha256 `6015d0a5985e`

**詳細設計書 — 会議室予約システム (Conference Room Reservation)**

文書番号 | DD-RES-001 | 版数 | 1.1 | 作成日 | 2026-10-20

| 画面ID | 画面名 | URL / ルート | 対象ロール | 概要 |
|---|---|---|---|---|
| SCR-RES-01 | 会議室予約登録画面 | /reservations/new | 一般社員 / 管理者 | 会議室・利用日時・参加人数・備品を入力して予約を作成する |
| SCR-RES-02 | 会議室予約詳細画面 | /reservations/:id | 一般社員 / 管理者 | 作成された予約のステータス（仮予約／確定／承認待ち）を確認する |
