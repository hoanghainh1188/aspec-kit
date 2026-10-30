> ⚠️ **CHANGELOG MẪU — XOÁ TRƯỚC KHI DÙNG THẬT.** Đi kèm feature mẫu `000-example-reservation`.

# CHANGELOG — `example-reservation` (詳細設計)

Quy ước: thêm version mới ở trên cùng, **không sửa** file version cũ (xem `docs/02-detail-design/README.md`).

## v2 — 2026-10-20
- Thay đổi so với v1 (`field-spec-v2.md`):
  1. **Field:** thêm `承認日時` (`approvedAt`) — ghi thời điểm phê duyệt, lưu UTC, hiển thị JST.
  2. **Validation:** V-03 `却下理由` — từ "bắt buộc (không chỉ khoảng trắng)" thành "10〜200 ký tự sau khi bỏ khoảng trắng hai đầu".
  3. **Màn hình:** SCR-RSV-02 — nút `承認` không duyệt ngay nữa mà mở `承認確認ダイアログ` (U-05).
- **Affected issues:** `000-example-reservation` (feature mẫu — dự án thật ghi số issue, VD `#42`)
- Phân tích tác động: chạy `/design-change docs/02-detail-design/example-reservation/field-spec-v1.md docs/02-detail-design/example-reservation/field-spec-v2.md`
  → báo cáo `docs/changes/2026-10-31-example-reservation.md`.

## v1 — 2026-01-05
- Bản đầu tiên.
- **Affected issues:** `000-example-reservation`
