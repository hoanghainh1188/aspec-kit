# Quyết định `Q-001-01` & `Q-001-02` — Ngưỡng phê duyệt và thiết bị mặc định

- **Ngày chốt**: `2026-10-25`
- **Người trả lời phía khách hàng**: 鈴木 花子 (Suzuki Hanako — Product Owner)
- **Nguồn**: [`docs/qa/001-conference-room-reservation.md`](../qa/001-conference-room-reservation.md)

## Nội dung quyết định

1. **Ngưỡng phê duyệt (`Q-001-01`)**:
   - Với `ROOM-A` (sức chứa 20 người): `1 <= attendeeCount <= 10` → `CONFIRMED`; `11 <= attendeeCount <= 20` → `PENDING_APPROVAL`.
   - Với `ROOM-EXEC` (sức chứa 12 người): Mọi `attendeeCount` hợp lệ (`1..12`) đều nhận trạng thái `PENDING_APPROVAL`.
2. **Thiết bị máy chiếu tại `ROOM-EXEC` (`Q-001-02`)**:
   - Vì `ROOM-EXEC` có máy chiếu lắp cố định, mọi đặt phòng tại `ROOM-EXEC` luôn lưu `requiresProjector = true` bất kể giá trị đầu vào.
