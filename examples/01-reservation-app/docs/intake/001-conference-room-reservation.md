# Design Intake — `001-conference-room-reservation`

- **Feature**: `001-conference-room-reservation` (会議室予約登録機能 — `SCR-RES-01`)
- **Nguồn thiết kế đầu vào**:
  - 基本設計: [`docs/01-basic-design/conference-room-reservation/reservation-basic-design.pdf`](../01-basic-design/conference-room-reservation/reservation-basic-design.pdf) ([Markdown chuyển đổi](../01-basic-design/conference-room-reservation/reservation-basic-design.md))
  - 詳細設計: [`docs/02-detail-design/conference-room-reservation/reservation-detail-design.xlsx`](../02-detail-design/conference-room-reservation/reservation-detail-design.xlsx) ([Index Markdown](../02-detail-design/conference-room-reservation/reservation-detail-design.md))
  - UI / Figma: [`docs/03-ui/conference-room-reservation/figma-links.md`](../03-ui/conference-room-reservation/figma-links.md) ([Wireframe SVG](../03-ui/conference-room-reservation/screen-scr-res-01.svg))

---

## 1. Danh mục phòng họp & Sức chứa (`BR-01`)

| Mã phòng (`roomId`) | Tên phòng | Sức chứa tối đa | Quy tắc phê duyệt & Thiết bị |
|---|---|---|---|
| `ROOM-A` | 大会議室A | `20` | `<= 10` người: `CONFIRMED`; `> 10` người: `PENDING_APPROVAL` |
| `ROOM-B` | 小会議室B | `8` | Luôn `CONFIRMED` (vì tối đa 8 người) |
| `ROOM-EXEC` | 役員会議室 | `12` | Luôn `PENDING_APPROVAL` mọi quy mô; máy chiếu cố định (`requiresProjector = true`) |

---

## 2. Cấu trúc trường dữ liệu (`02_画面項目定義`)

| No | 項目名 | Field | Kiểu | Bắt buộc | Quy tắc kiểm tra | Mã lỗi |
|---|---|---|---|---|---|---|
| 1 | 会議室ID | `roomId` | `RoomId` | ○ | Thuộc `ROOM-A \| ROOM-B \| ROOM-EXEC` | `ERR-RES-004` |
| 2 | 予約者メール | `organizerEmail` | `string` | ○ | Kết thúc bằng `@example.co.jp`, không rỗng | `ERR-RES-001` |
| 3 | 利用日 | `reservationDate` | `string` (`YYYY-MM-DD`) | ○ | `>= today` và là ngày làm việc (Thứ Hai–Thứ Sáu) | `ERR-RES-002` |
| 4 | 開始時刻 | `startTime` | `string` (`HH:MM`) | ○ | Trong khoảng `09:00`–`18:00`, phút là `00` hoặc `30` | `ERR-RES-003` |
| 5 | 終了時刻 | `endTime` | `string` (`HH:MM`) | ○ | Trong khoảng `09:00`–`18:00`, `> startTime`, thời lượng `<= 240` phút | `ERR-RES-003` |
| 6 | 参加人数 | `attendeeCount` | `number` | ○ | Số nguyên `>= 1` và `<= roomCapacity` | `ERR-RES-004` |
| 7 | プロジェクター利用 | `requiresProjector` | `boolean` | — | Nếu `roomId === 'ROOM-EXEC'` thì tự động ép thành `true` | — |

---

## 3. Kiểm tra trùng lịch (`BR-05`)

- Hai đặt phòng trên cùng `roomId` và `reservationDate` bị coi là trùng lịch (`ERR-RES-005`) nếu khoảng `[startTime, endTime)` giao nhau với bất kỳ đặt phòng hiện có nào (`existingStart < newEnd && newStart < existingEnd`).
- Đặt phòng nối tiếp sát giờ (`10:00–11:00` rồi `11:00–12:00`) là **hợp lệ**.

---

## Ambiguities (Điểm cần làm rõ & Quyết định)

1. **[RESOLVED → `Q-001-01`]** Ngưỡng chuyển sang `PENDING_APPROVAL` ở `ROOM-A` là `>= 10` hay `> 10` người?
   - **Quyết định khách hàng** ([`2026-10-25-Q-001-01-approval-threshold.md`](../04-decisions/2026-10-25-Q-001-01-approval-threshold.md)): Từ **11 người trở lên (`attendeeCount > 10`)** mới cần `PENDING_APPROVAL`; từ 10 người trở xuống là `CONFIRMED`.
2. **[RESOLVED → `Q-001-02`]** Khi chọn `ROOM-EXEC` nhưng truyền `requiresProjector: false`, hệ thống báo lỗi hay tự động chuẩn hoá thành `true`?
   - **Quyết định khách hàng**: Tự động chuẩn hoá `requiresProjector = true` theo đúng UI checkbox disabled trên Figma.
