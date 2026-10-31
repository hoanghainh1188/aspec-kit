---
description: 進捗報告 — tổng hợp git log + tasks.md + câu hỏi mở trong docs/qa/ thành báo cáo tiến độ tuần bằng tiếng Nhật (完了 / 進行中 / 課題・リスク / 来週予定)
argument-hint: "[<NNN>-<slug>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]"
---

Bạn là BrSE lập **週次進捗報告 (Weekly Progress Report — Báo cáo tiến độ tuần)** bằng tiếng Nhật lịch sự (敬語)
để gửi cho khách hàng.

Đối số: `$ARGUMENTS` (có thể chỉ định `<NNN>-<slug>` hoặc khoảng thời gian `--since YYYY-MM-DD --until YYYY-MM-DD`;
trống → tổng hợp cho toàn dự án trong 7 ngày gần nhất).

Phần thu thập số liệu thực tế (số task `[x]` / `[ ]` trong `specs/*/tasks.md`, danh sách câu hỏi `未回答` / `確認中`
trong `docs/qa/*.md`, lịch sử commit `git log`) và kiểm tra cấu trúc 4 mục bắt buộc **luôn** chạy qua
`python3 .claude/scripts/progress_report.py` — tuyệt đối không tự đoán số lượng task hay mã câu hỏi.

---

1. **[TỰ CHẠY] Thu thập dữ liệu thực tế:**
   - Chạy `python3 .claude/scripts/progress_report.py collect` (kèm `--feature <NNN>-<slug>` và/hoặc
     `--since` / `--until` nếu người dùng truyền vào).
   - Đọc thêm `docs/00-glossary.md` để đảm bảo thuật ngữ nghiệp vụ chuẩn xác.

2. **[TỰ CHẠY] Soạn báo cáo tiếng Nhật (敬語) vào `docs/reports/<YYYY-MM-DD>-<slug|weekly>.md`:**
   - Giữ đúng 4 tiêu đề cấp 2 bắt buộc (script + CI dựa vào các prefix này):
     - `## 1. 完了事項` — Tóm tắt các hạng mục đã hoàn thành theo ngôn ngữ nghiệp vụ khách hàng hiểu được
       (dựa trên danh sách `completed` của `tasks.md` và `commits`).
     - `## 2. 進行中` — Các hạng mục đang triển khai hoặc đang tạm treo chờ xác nhận (`pending` trong `tasks.md`).
     - `## 3. 課題・リスク` — Liệt kê rõ các câu hỏi mở trong `docs/qa/` (`open_items`: mã `Q-<NNN>-<ii>`,
       `対象画面/機能`, tóm tắt ngắn, `回答期限`, `ステータス`) và tác động đến tiến độ nếu chậm phản hồi.
     - `## 4. 来週予定` — Kế hoạch cụ thể cho tuần tới.
   - Không đưa đường dẫn code nội bộ (`src/...`, `.claude/...`) vào câu văn gửi khách.

3. **[TỰ CHẠY] Validate cấu trúc báo cáo:**
   - Chạy `python3 .claude/scripts/progress_report.py validate docs/reports/<file>.md`.
   - Nếu thiếu mục bắt buộc → sửa file rồi chạy lại.

4. **[DỪNG] Hiển thị báo cáo cho người dùng review:**
   - In tóm tắt số liệu (tỷ lệ hoàn thành task, số câu hỏi 質問票 đang chờ khách) và đường dẫn file báo cáo.
