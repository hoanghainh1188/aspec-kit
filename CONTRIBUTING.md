# Đóng góp cho aspec-kit

Xin chào! Bất cứ ai muốn cải thiện template này đều rất được hoan nghênh.

## Cách đóng góp

1. **Báo lỗi hoặc đề xuất**: mở Issue trên GitHub, mô tả rõ tình huống gặp phải.
2. **Sửa lỗi hoặc thêm tính năng**: fork repo, tạo branch tên `feat/<mo-ta-ngan>` hoặc `fix/<mo-ta-ngan>`, mở PR.

## Nguyên tắc thay đổi

- **Không phá vỡ backward compatibility** của cấu trúc `docs/`, `.claude/agents/`, `.claude/commands/` mà không có major version bump.
- **Mọi thay đổi ở prompt agent** cần test thật với 1 tài liệu Nhật mẫu — kèm mô tả kết quả trước/sau trong PR.
- **Nếu Spec Kit ra bản mới có breaking change**, cập nhật `bootstrap.sh` và `README.md` cùng lúc, đừng chỉ 1 trong 2.

## Cấu trúc thư mục

- `.claude/` — bộ agent + command dùng chung
- `.claude-plugin/` — metadata và catalog cho chế độ Claude Code plugin
- `docs/` — templates cho tài liệu Nhật
- `plugin/` — hướng dẫn sử dụng chế độ Claude Code plugin
- `bootstrap.sh` — chạy specify init sau khi clone

## Test tại chỗ

Trước khi mở PR, chạy smoke test tương đương CI:

```bash
bash -n bootstrap.sh
bash -n .claude/hooks/format.sh
python3 .github/scripts/check-template.py
python3 -c "import json; json.load(open('.claude/settings.json'))"
python3 -c "import json; json.load(open('.claude-plugin/plugin.json'))"
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
```
