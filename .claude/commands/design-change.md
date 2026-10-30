---
description: 仕様変更 — so 2 version design, lập báo cáo tác động (artifact + lý do), đề xuất chạy lại Spec Kit và tóm tắt 影響範囲 cho khách
argument-hint: <đường-dẫn-bản-cũ> <đường-dẫn-bản-mới>
---

Bạn là **điều phối viên phân tích 仕様変更**. Input: `$ARGUMENTS` = 2 đường dẫn — bản design **cũ**
và **mới** của cùng 1 feature (VD `docs/02-detail-design/<slug>/field-spec-v1.md`
`docs/02-detail-design/<slug>/field-spec-v2.md`). Output: 1 file báo cáo
`docs/changes/<YYYY-MM-DD>-<slug>.md`. Command này **chỉ phân tích** — không sửa design, spec hay code;
việc sửa đi qua pipeline `/design-to-code` theo đề xuất trong báo cáo.

Quy ước: **[TỰ CHẠY]** = bạn tự làm · **[DỪNG]** = chờ người dùng xác nhận.

---

1. **[TỰ CHẠY] Kiểm input.**
   - Thiếu 1 trong 2 đường dẫn → hỏi lại, không đoán. Đường dẫn là thư mục → liệt kê file trong đó và
     hỏi cặp file nào.
   - Cả 2 phải nằm dưới `docs/01-basic-design/`, `docs/02-detail-design/` hoặc `docs/03-ui/`, cùng
     thư mục `<slug>`. Lấy `<slug>` từ tên thư mục đó.
   - File `.docx/.xlsx/.pdf` không có bản export text cạnh bên → DỪNG, yêu cầu bản export (như
     `design-intake`).
   - Đọc `CHANGELOG.md` cùng thư mục: phải có mục cho version mới kèm **Affected issues** (TEAM-WORKFLOW
     mục 8). Thiếu → cảnh báo người dùng (vẫn phân tích được, nhưng nhắc bổ sung CHANGELOG).

2. **[TỰ CHẠY] Gọi subagent `impact-analyzer`** (qua Task tool) với: đường dẫn cũ, mới, `<slug>`,
   ngày hôm nay. Nó diff theo đơn vị nghiệp vụ (field / validation / màn hình), lần ngược tới
   `docs/intake/`, AC trong `specs/*<slug>*/spec.md`, `plan.md`, task trong `tasks.md`,
   `src/features/<slug>/` và test — và trả về nội dung báo cáo 3 phần.

3. **[TỰ CHẠY] Soát báo cáo trước khi cho người dùng xem** — đây là tài liệu sẽ gửi khách, sai lý do
   là mất uy tín:
   - Mỗi dòng bảng tác động có **lý do cụ thể** trỏ tới AC / task / symbol / test thật. Mở file kiểm
     ngẫu nhiên ít nhất các dòng `Fail → sửa`.
   - Mọi thay đổi `Cn` trong diff đều xuất hiện trong bảng tác động (kể cả khi `Không đổi`).
   - Mục 影響範囲 viết tiếng Nhật, không lộ tên file / AC / task nội bộ.
   Thiếu sót → gọi lại `impact-analyzer` kèm chỉ ra chỗ thiếu.

4. **[DỪNG]** Hiển thị báo cáo. Hỏi người dùng xác nhận (hoặc sửa) — đặc biệt mục ご確認事項 và
   影響度 trước khi gửi khách.

5. **[TỰ CHẠY] Ghi file** `docs/changes/<YYYY-MM-DD>-<slug>.md` (trùng tên → thêm hậu tố `-2`, `-3`).
   Không ghi vào `docs/01-03`, `specs/`, `src/`.

6. **[TỰ CHẠY] Báo bước kế tiếp** — in lại mục "Đề xuất chạy lại" của báo cáo, và nhắc:
   - Mở **issue re-run** cho feature bị ảnh hưởng (TEAM-WORKFLOW mục 8) và dán link báo cáo.
   - Câu hỏi ご確認事項 cần khách trả lời → khi có câu trả lời, ghi vào `docs/04-decisions/` qua
     `/speckit-clarify` (rule 2 `CLAUDE.md`), đừng chỉ trả lời trong chat.
   - Thực hiện việc sửa bằng `/design-to-code` (từ bước `design-intake`) — command này không tự chạy
     `/speckit-*`.
