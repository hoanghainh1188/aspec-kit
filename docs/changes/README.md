# Changes — báo cáo tác động 仕様変更

Output của command `/design-change <bản-cũ> <bản-mới>` (subagent `impact-analyzer`). Mỗi lần khách
gửi bản design mới (`docs/01-03/<slug>/` thêm version + `CHANGELOG.md`), chạy command để biết **cái gì
phải sửa và vì sao** trước khi re-run pipeline.

Mỗi báo cáo 1 file: `docs/changes/<YYYY-MM-DD>-<slug>.md`, gồm 3 phần bắt buộc (CI
`check-template.py` kiểm đủ 3 heading):

1. **Bảng tác động** — mỗi thay đổi → artifact bị ảnh hưởng (`docs/intake/`, AC trong `spec.md`,
   `plan.md`, task trong `tasks.md`, file trong `src/features/<slug>/`, test, glossary/decisions/lessons),
   **mỗi dòng kèm lý do** trỏ tới AC / task / symbol / test cụ thể.
2. **Đề xuất chạy lại** — lệnh `/speckit-*` (và `design-intake`) cần chạy lại theo thứ tự, kèm câu hỏi
   cho `/speckit-clarify`.
3. **影響範囲（お客様向けサマリー）** — tóm tắt tiếng Nhật gửi khách: 影響範囲, 影響度, ご確認事項.

Quy tắc:
- Báo cáo là **ảnh chụp tại thời điểm phân tích** — commit vào Git, không sửa lại sau khi gửi khách;
  phân tích lại → file mới.
- Báo cáo **không thay** `CHANGELOG.md` (khách đổi gì) hay `docs/04-decisions/` (đã chốt gì) — nó nối
  hai thứ đó với code. Câu trả lời cho ご確認事項 vẫn ghi vào `docs/04-decisions/` qua `/speckit-clarify`.
- Feature mẫu `000-example-reservation` có sẵn 1 báo cáo ví dụ (`2026-10-31-example-reservation.md`,
  phân tích `field-spec-v1.md` → `field-spec-v2.md`) — xoá cùng feature mẫu.
