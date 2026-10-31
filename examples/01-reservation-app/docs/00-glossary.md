# Bảng thuật ngữ dự án (用語集 — Glossary)

| Tiếng Nhật (JP) | Tiếng Việt (VI) | Tiếng Anh (EN) | Định danh chuẩn (Identifier) | Ghi chú |
|---|---|---|---|---|
| 会議室予約 | Đặt phòng họp | Conference Room Reservation | `ConferenceRoomReservation` | Thực thể chính của phân hệ `001` |
| 会議室ID | Mã phòng họp | Room ID | `roomId` | `ROOM-A` / `ROOM-B` / `ROOM-EXEC` |
| 予約者メール | Email người đặt | Organizer Email | `organizerEmail` | Bắt buộc thuộc miền `@example.co.jp` |
| 利用日 | Ngày sử dụng | Reservation Date | `reservationDate` | Định dạng `YYYY-MM-DD`, chỉ ngày làm việc |
| 開始時刻 / 終了時刻 | Giờ bắt đầu / kết thúc | Start / End Time | `startTime` / `endTime` | Khung `09:00`–`18:00`, bội số 30 phút |
| 参加人数 | Số người tham dự | Attendee Count | `attendeeCount` | Số nguyên dương, không vượt sức chứa phòng |
| プロジェクター利用 | Sử dụng máy chiếu | Requires Projector | `requiresProjector` | `ROOM-EXEC` luôn có sẵn (`true`) |
| 即時確定 | Xác nhận ngay | Confirmed | `CONFIRMED` | Phòng thường với `attendeeCount <= 10` |
| 承認待ち | Chờ phê duyệt | Pending Approval | `PENDING_APPROVAL` | `ROOM-EXEC` hoặc `attendeeCount > 10` |
