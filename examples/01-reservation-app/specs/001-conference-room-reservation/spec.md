# Feature Specification — `001-conference-room-reservation`

- **Feature**: `001-conference-room-reservation` (会議室予約登録画面 `SCR-RES-01`)
- **Intake**: [`docs/intake/001-conference-room-reservation.md`](../../docs/intake/001-conference-room-reservation.md)
- **Decisions**: [`docs/04-decisions/2026-10-25-Q-001-01-approval-threshold.md`](../../docs/04-decisions/2026-10-25-Q-001-01-approval-threshold.md)

## Overview

Cung cấp nghiệp vụ kiểm tra hợp lệ và đăng ký đặt phòng họp nội bộ (`ROOM-A`, `ROOM-B`, `ROOM-EXEC`) theo đúng quy tắc trong `BD-RES-001 v1.1` và `DD-RES-001 v1.1`.

## Acceptance criteria

1. **AC 1 — Kiểm tra email nội bộ (`ERR-RES-001`)**: Từ chối đặt phòng nếu `organizerEmail` rỗng, sai cú pháp email, hoặc không thuộc domain `@example.co.jp` (không phân biệt hoa thường), trả về mã lỗi `ERR-RES-001`.
2. **AC 2 — Kiểm tra ngày làm việc (`ERR-RES-002`)**: Từ chối đặt phòng nếu `reservationDate` nhỏ hơn ngày hiện tại (`today`) hoặc rơi vào Thứ Bảy / Chủ Nhật, trả về mã lỗi `ERR-RES-002`.
3. **AC 3 — Kiểm tra khung giờ 30 phút & thời lượng tối đa (`ERR-RES-003`)**: Từ chối đặt phòng nếu `startTime` / `endTime` nằm ngoài khung `09:00`–`18:00`, không chẵn bước 30 phút (`:00` hoặc `:30`), `endTime <= startTime`, hoặc tổng thời lượng vượt quá `240` phút (4 giờ), trả về mã lỗi `ERR-RES-003`.
4. **AC 4 — Kiểm tra sức chứa phòng họp (`ERR-RES-004`)**: Từ chối đặt phòng nếu `attendeeCount < 1` hoặc vượt quá sức chứa của phòng (`ROOM-A`: 20, `ROOM-B`: 8, `ROOM-EXEC`: 12), trả về mã lỗi `ERR-RES-004`.
5. **AC 5 — Kiểm tra trùng lịch (`ERR-RES-005`)**: Từ chối đặt phòng nếu cùng `roomId` và `reservationDate` đã có lịch đặt giao nhau (`existingStart < newEnd && newStart < existingEnd`), trả về mã lỗi `ERR-RES-005`; cho phép đặt nối tiếp sát giờ (`10:00`–`11:00` rồi `11:00`–`12:00`).
6. **AC 6 — Phân loại trạng thái phê duyệt & chuẩn hoá thiết bị (`Q-001-01`, `Q-001-02`)**: Khi hợp lệ, tạo bản ghi đặt phòng với `status = 'PENDING_APPROVAL'` nếu `roomId === 'ROOM-EXEC'` hoặc `attendeeCount > 10`, ngược lại `status = 'CONFIRMED'`; đồng thời tự động đặt `requiresProjector = true` khi `roomId === 'ROOM-EXEC'`.
