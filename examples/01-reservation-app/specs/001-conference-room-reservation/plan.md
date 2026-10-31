# Implementation Plan — `001-conference-room-reservation`

## 1. Kiến trúc Module

```text
src/features/conference-room-reservation/
├── types.ts                  # Kiểu dữ liệu RoomId, ReservationInput, ConferenceRoomReservation, ValidationError
├── validateReservation.ts    # Hàm thuần kiểm tra ERR-RES-001 .. ERR-RES-005 (AC 1..5)
├── createReservation.ts      # Hàm nghiệp vụ tạo đặt phòng, phân loại CONFIRMED / PENDING_APPROVAL (AC 6)
└── createReservation.test.ts # Bộ unit test phủ toàn bộ AC 1..6 + biên
```

## 2. Quy tắc thiết kế

- **Zero external runtime dependencies**: Sử dụng TypeScript thuần, truyền `today` (`YYYY-MM-DD`) và danh sách `existingReservations` làm tham số để hàm hoàn toàn tất định (deterministic) và dễ test.
- **Chuẩn định danh**: Tuân thủ nghiêm ngặt `docs/00-glossary.md` (`ConferenceRoomReservation`, `roomId`, `organizerEmail`, `reservationDate`, `startTime`, `endTime`, `attendeeCount`, `requiresProjector`).
