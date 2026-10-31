# 進捗報告 (Weekly Progress Reports) — báo cáo tiến độ tuần bằng tiếng Nhật

Output của `/progress-report`. Mỗi kỳ báo cáo ghi ra 1 file `docs/reports/<YYYY-MM-DD>-<slug|weekly>.md`.

Ví dụ mẫu (xoá khi bắt đầu dự án thật): `docs/reports/2026-10-31-example-reservation.md`.

## Cấu trúc 4 phần bắt buộc

Báo cáo gửi khách hàng Nhật viết bằng văn phong lịch sự (敬語), không lộ đường dẫn file nội bộ của dev
(`src/...`, `.specify/...`) trong phần mô tả nghiệp vụ, và luôn gồm 4 mục:

1. `## 1. 完了事項` — Các hạng mục đã hoàn thành trong tuần (tổng hợp từ `[x]` trong `tasks.md` và `git log`).
2. `## 2. 進行中` — Các hạng mục đang thực hiện hoặc đang tạm dừng chờ xác nhận (`[ ]` trong `tasks.md`).
3. `## 3. 課題・リスク` — Vấn đề/rủi ro cần khách hàng hỗ trợ, đặc biệt là các câu hỏi `未回答` / `確認中` trong `docs/qa/*.md` kèm hạn trả lời `回答期限`.
4. `## 4. 来週予定` — Kế hoạch công việc cho tuần kế tiếp.

## Script tất định

Để đảm bảo số liệu hoàn toàn khớp thực tế (số task `4/6`, danh sách mã `Q-NNN-ii` chưa trả lời, commit trong tuần),
`/progress-report` luôn gọi `.claude/scripts/progress_report.py` trước khi soạn:

```bash
# 1. Thu thập dữ liệu thật ra JSON
python3 .claude/scripts/progress_report.py collect --feature 042-user-reservation --since 2026-10-25 --until 2026-10-31

# 2. Kiểm tra báo cáo đã đủ 4 phần bắt buộc chưa
python3 .claude/scripts/progress_report.py validate docs/reports/2026-10-31-user-reservation.md
```
