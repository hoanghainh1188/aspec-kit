---
description: 要件トレーサビリティマトリクス — sinh ma trận truy vết (design/intake → spec AC → task → code → test) vào docs/traceability.md và phát hiện khoảng trống
argument-hint: "[<NNN>-<slug>] [--check] [--strict]"
---

Bạn là BrSE / Tech Lead kiểm toán **要件トレーサビリティマトリクス (Traceability Matrix)** của dự án,
liên kết xuyên suốt từ **Tài liệu thiết kế (基本設計 / 詳細設計) & Intake** → **Spec Acceptance Criteria (AC)** →
**Tasks (`tasks.md`)** → **Source Code (`src/features/<slug>/`)** → **Test Cases**, đồng thời chỉ ra:
- AC chưa có test case tự động
- AC có task đang treo (`[ ]`) hoặc chưa có task
- File code không gắn với bất kỳ requirement/task nào

Đối số: `$ARGUMENTS`
- Trống → sinh ma trận cho toàn bộ các feature trong `specs/` vào `docs/traceability.md`.
- Có `<NNN>-<slug>` → lọc theo feature đó.
- Có `--check` (hoặc `--strict`) → chạy kiểm tra nhanh độ phủ traceability.

Phần quét file, đối khớp mã `AC N` / `Tn` và xuất bảng chuẩn **luôn** chạy qua script tất định
`python3 .claude/scripts/traceability.py` — không tự đoán bằng mắt.

---

1. **[TỰ CHẠY] Chạy script sinh ma trận & kiểm toán:**
   - Gọi `python3 .claude/scripts/traceability.py generate` (thêm `--feature <NNN>-<slug>` nếu người dùng chỉ định 1 feature) để cập nhật `docs/traceability.md`.
   - Gọi `python3 .claude/scripts/traceability.py check --json` để lấy dữ liệu JSON chi tiết về các dòng và mục `gaps`.

2. **[TỰ CHẠY] Đối chiếu sâu với tài liệu thiết kế gốc (nếu cần làm giàu ngữ nghĩa):**
   - Mở `docs/traceability.md` vừa sinh và kiểm tra cột **Nguồn thiết kế / Intake**.
   - Nếu trong `docs/01-basic-design/<slug>/` hoặc `docs/02-detail-design/<slug>/` có mã mục cụ thể (VD `V-01`, `U-02`, `SCR-RSV-02`) tương ứng với từng AC mà tên file chung chưa thể hiện rõ, bạn có thể bổ sung chú thích ngắn bên dưới bảng hoặc gợi ý cập nhật `spec.md` / `tasks.md` để liên kết chặt hơn.

3. **[DỪNG] Báo cáo kết quả cho người dùng:**
   - Tóm tắt số lượng AC đã phủ kín (`✅ Covered`), số AC đang treo task (`⏳`), số AC thiếu test (`⚠️`), và các file code mồ côi (`unlinked_code`).
   - Nếu phát hiện khoảng trống:
     - **AC thiếu test:** gợi ý bổ sung unit/integration test trong `src/features/<slug>/` (ghi rõ `(AC N)` trong tên test `it("... (AC N)")` để script tự động bắt được).
     - **Code không gắn requirement:** gợi ý cập nhật `tasks.md` hoặc kiểm tra xem có phải dead code / scope creep không.
     - **Task đang treo chờ khách trả lời:** nhắc chạy `/qa-sheet` hoặc `/speckit-clarify`.
