# UI Design & Figma Snapshot — `SCR-RES-01` (会議室予約登録画面)

- **Figma File**: `https://www.figma.com/design/example-jp-reservation/Conference-Room-Booking?node-id=101-204`
- **Screen ID**: `SCR-RES-01` (`会議室予約登録画面`)
- **Snapshot nội bộ**: [`screen-scr-res-01.svg`](./screen-scr-res-01.svg)

## Danh sách Component & Mapping với 詳細設計 (`02_画面項目定義`)

| UI Element | Nhãn tiếng Nhật trên Figma | Field (`02_画面項目定義`) | Hành vi UI |
|---|---|---|---|
| Select Box | 会議室 (`Room`) | `roomId` | Chọn `ROOM-A (20名)`, `ROOM-B (8名)`, `ROOM-EXEC (12名・要承認)` |
| Text Input | 予約者メールアドレス | `organizerEmail` | Placeholder: `taro.tanaka@example.co.jp` |
| Date Picker | 利用日 | `reservationDate` | Chỉ cho phép chọn ngày làm việc (`>= today`, T2–T6) |
| Time Select | 開始時刻 / 終了時刻 | `startTime` / `endTime` | Dropdown bước nhảy 30 phút (`09:00` – `18:00`) |
| Number Input | 参加人数 | `attendeeCount` | Hiển thị badge cảnh báo `部長承認が必要` khi `> 10` hoặc chọn `ROOM-EXEC` |
| Checkbox | プロジェクターを利用する | `requiresProjector` | Tự động check & disable khi chọn `ROOM-EXEC` |
| Primary Button | 予約を登録する | — | Submit form → chuyển sang `SCR-RES-02` |
