# Chỉ mục Quyết định Thiết kế (Decision Log Index)

| Ngày | Mã Q&A / Chủ đề | Feature | Tóm tắt quyết định | File chi tiết |
|---|---|---|---|---|
| 2026-10-25 | `Q-001-01` / `Q-001-02` | `001-conference-room-reservation` | `ROOM-A` chỉ yêu cầu `PENDING_APPROVAL` khi `attendeeCount > 10`; `ROOM-EXEC` luôn `PENDING_APPROVAL` và tự động đặt `requiresProjector = true`. | [`2026-10-25-Q-001-01-approval-threshold.md`](./2026-10-25-Q-001-01-approval-threshold.md) |
