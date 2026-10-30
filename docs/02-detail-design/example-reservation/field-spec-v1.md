> ⚠️ **TÀI LIỆU KHÁCH MẪU — XOÁ TRƯỚC KHI DÙNG THẬT.** Đi kèm feature mẫu `000-example-reservation`.
> Đây là bản **export text** của `field-spec-v1.xlsx` (file gốc giả định, không kèm) — đúng quy ước
> `docs/02-detail-design/README.md`. Giữ nguyên tiếng Nhật như tài liệu khách gửi. **Không sửa** —
> bản mới thêm file `field-spec-v2.md` + `CHANGELOG.md`.

# 詳細設計書 — 予約承認 項目定義

| 文書 | 版数 | 発行日 |
|---|---|---|
| field-spec | v1 | 2026-01-05 |

## 1. 項目定義（予約）

| No | 項目名 | 物理名 | 型 | 必須 | 備考 |
|---|---|---|---|---|---|
| 1 | 予約ID | id | 文字列 | ○ | |
| 2 | ステータス | status | 区分 | ○ | pending / approved / rejected |
| 3 | 担当者ID | assigneeId | 文字列 | ○ | 承認・却下できるのはこの担当者のみ |
| 4 | 顧客ID | customerId | 文字列 | ○ | 承認後の通知先 |

## 2. 入力チェック

| No | 対象 | ルール | エラー時 |
|---|---|---|---|
| V-01 | 操作者 | 予約の担当者IDと一致すること | 403（権限なし） |
| V-02 | ステータス | pending であること | 「処理済みの予約です」 |
| V-03 | 却下理由 | 却下時は必須（空白のみ不可） | 「却下理由を入力してください」 |

## 3. 画面項目定義（SCR-RSV-02 予約詳細）

| No | 項目 | 種別 | 動作 |
|---|---|---|---|
| U-01 | 予約情報 | 表示 | 予約ID・顧客・ステータスを表示 |
| U-02 | 承認ボタン | ボタン | 押下で即時承認する |
| U-03 | 却下ボタン | ボタン | 押下で却下する（U-04 必須） |
| U-04 | 却下理由 | テキストエリア | 却下時のみ入力 |
