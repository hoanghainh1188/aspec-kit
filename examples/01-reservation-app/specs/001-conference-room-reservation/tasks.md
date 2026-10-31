# Tasks — `001-conference-room-reservation`

- [x] **T1** — `src/features/conference-room-reservation/types.ts`: Định nghĩa cấu trúc dữ liệu `RoomId`, `ROOM_CATALOG`, `ReservationInput`, `ConferenceRoomReservation` và mã lỗi `ERR-RES-001`..`ERR-RES-005` *(AC 1, 2, 3, 4, 5, 6)*
- [x] **T2** — `src/features/conference-room-reservation/validateReservation.ts`: Cài đặt kiểm tra email `@example.co.jp`, ngày làm việc, khung giờ 30 phút (`09:00`–`18:00`, tối đa 240 phút) và sức chứa từng phòng *(AC 1, 2, 3, 4)*
- [x] **T3** — `src/features/conference-room-reservation/validateReservation.ts`: Cài đặt kiểm tra trùng lịch theo khoảng nửa mở `[startTime, endTime)` trên cùng `roomId` và `reservationDate` *(AC 5)*
- [x] **T4** — `src/features/conference-room-reservation/createReservation.ts`: Cài đặt hàm `createReservation` phân loại trạng thái `CONFIRMED` / `PENDING_APPROVAL` và chuẩn hoá `requiresProjector` cho `ROOM-EXEC` *(AC 6)*
- [x] **T5** — `src/features/conference-room-reservation/createReservation.test.ts`: Viết bộ unit test Vitest kiểm chứng đầy đủ từng tiêu chí `AC 1`..`AC 6` và các ca biên *(AC 1, 2, 3, 4, 5, 6)*
