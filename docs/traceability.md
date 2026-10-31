> ⚠️ **MA TRẬN TRUY VẾT MẪU — XOÁ HOẶC TÁI SINH TRƯỚC KHI DÙNG THẬT.**
> Đi kèm feature mẫu `000-example-reservation`, sinh tự động bằng `/traceability`
> (`python3 .claude/scripts/traceability.py generate`).

# Ma trận truy vết (Traceability Matrix — 要件トレーサビリティマトリクス)

Liên kết xuyên suốt từ **Tài liệu thiết kế / Intake** → **Spec Acceptance Criteria (AC)** →
**Tasks (`tasks.md`)** → **Source Code (`src/features/<slug>/`)** → **Test Cases**.

## Feature `000-example-reservation`

- **Nguồn tham chiếu:** [`docs/intake/000-example-reservation.md`](intake/000-example-reservation.md) · [`docs/02-detail-design/example-reservation/field-spec-v1.md`](02-detail-design/example-reservation/field-spec-v1.md) · [`docs/02-detail-design/example-reservation/field-spec-v2.md`](02-detail-design/example-reservation/field-spec-v2.md) · [`spec.md`](../specs/000-example-reservation/spec.md) · [`tasks.md`](../specs/000-example-reservation/tasks.md)

| AC | Mô tả yêu cầu (Spec AC) | Nguồn thiết kế / Intake | Tasks | Source Files | Test Cases | Trạng thái |
|---|---|---|---|---|---|---|
| **AC 1** | 担当者 thấy danh sách reservation trạng thái `pending` được gán cho mình. | [`000-example-reservation.md`](intake/000-example-reservation.md)<br>[`field-spec-v1.md`](02-detail-design/example-reservation/field-spec-v1.md)<br>[`field-spec-v2.md`](02-detail-design/example-reservation/field-spec-v2.md) | — | — | — | ⚠️ Missing test |
| **AC 2** | Mở chi tiết → **approval** hoặc từ chối (kèm lý do bắt buộc khi từ chối). | [`000-example-reservation.md`](intake/000-example-reservation.md)<br>[`field-spec-v1.md`](02-detail-design/example-reservation/field-spec-v1.md)<br>[`field-spec-v2.md`](02-detail-design/example-reservation/field-spec-v2.md) | ☑ `T1`<br>☑ `T3`<br>☑ `T4` | [`approveReservation.ts`](../src/features/example-reservation/approveReservation.ts) | [`approveReservation.test.ts`](../src/features/example-reservation/approveReservation.test.ts): từ chối kèm lý do → chuyển sang rejected (AC 2)<br>[`approveReservation.test.ts`](../src/features/example-reservation/approveReservation.test.ts): từ chối thiếu lý do → ValidationError (AC 2) | ✅ Covered |
| **AC 3** | Sau approval: trạng thái → `approved`, gửi thông báo cho 顧客 (customer). | [`000-example-reservation.md`](intake/000-example-reservation.md)<br>[`field-spec-v1.md`](02-detail-design/example-reservation/field-spec-v1.md)<br>[`field-spec-v2.md`](02-detail-design/example-reservation/field-spec-v2.md) | ☑ `T1`<br>☑ `T4`<br>☐ `T5` | [`approveReservation.ts`](../src/features/example-reservation/approveReservation.ts) | [`approveReservation.test.ts`](../src/features/example-reservation/approveReservation.test.ts): 担当者 được gán → chuyển pending sang approved (AC 3) | ⏳ Partial (pending task) |
| **AC 4** | Chỉ 担当者 **được gán** cho reservation đó mới thực hiện được — người khác nhận `403`. | [`000-example-reservation.md`](intake/000-example-reservation.md)<br>[`field-spec-v1.md`](02-detail-design/example-reservation/field-spec-v1.md)<br>[`field-spec-v2.md`](02-detail-design/example-reservation/field-spec-v2.md) | ☑ `T2`<br>☑ `T4` | [`approveReservation.ts`](../src/features/example-reservation/approveReservation.ts) | [`approveReservation.test.ts`](../src/features/example-reservation/approveReservation.test.ts): người KHÔNG phải 担当者 được gán → ForbiddenError → 403 (AC 4)<br>[`approveReservation.test.ts`](../src/features/example-reservation/approveReservation.test.ts): người khác từ chối hộ → ForbiddenError (AC 4) | ✅ Covered |

### Cảnh báo độ phủ & Khoảng trống (Gaps)

- ⚠️ **AC chưa có test case tự động:** `AC 1`
- ⏳ **AC có task đang treo (`[ ]`):** `AC 3`
- ℹ️ **Task chưa ghi mã `(AC N)` (VD task hạ tầng/test tổng hợp hoặc chờ clarify):** `T6`

<!-- sinh bởi: python3 .claude/scripts/traceability.py generate -->
