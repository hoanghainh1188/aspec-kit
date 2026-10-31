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

- `.claude/` — bộ 5 subagent, 3 command, hooks và scripts (`qa_sheet.py`, `convert-design.py`) dùng chung
- `.claude-plugin/` — metadata và catalog cho chế độ Claude Code plugin
- `docs/` — cấu trúc tài liệu Nhật, bộ nhớ 5 tầng (`00-glossary.md`, `04-decisions/`, `05-lessons.md`), `intake/`, `changes/`, `qa/`
- `packages/aspec-kit/` — mã nguồn CLI `@hoanghainh/aspec-kit` (`init`, `update`, `doctor`, `convert`)
- `plugin/` — hướng dẫn sử dụng chế độ Claude Code plugin
- `bootstrap.sh` — chạy `specify init` và tích hợp skills/hooks sau khi khởi tạo

## Test tại chỗ

Trước khi mở PR, chạy smoke test tương đương CI:

```bash
bash -n bootstrap.sh
bash -n .claude/hooks/format.sh
python3 .github/scripts/check-template.py
python3 -m unittest discover -s .claude/scripts -v
python3 -c "import json; json.load(open('.claude/settings.json'))"
python3 -c "import json; json.load(open('.claude-plugin/plugin.json'))"
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
```

Nếu sửa CLI (`packages/aspec-kit/`) hoặc converter — tương đương workflow `kit-ci`:

```bash
(cd packages/aspec-kit && npm test)                       # unit + e2e (dùng template local, không cần mạng)
(cd packages/aspec-kit && npm run test:python)            # test converter Excel/PDF → Markdown (cần uv)
node .github/scripts/sync-version.mjs --check             # version package.json == plugin.json
npx --yes vitest@3 run src/features/example-reservation   # test của feature mẫu
```

## Phát hành phiên bản mới

CLI tải template từ tag `v<version>` → commit được tag **phải** mang đúng version đó.

```bash
node .github/scripts/sync-version.mjs 0.2.0   # cập nhật package.json + plugin.json
git commit -am "chore: release v0.2.0"
git tag v0.2.0 && git push --follow-tags      # publish-npm sẽ fail nếu tag ≠ version
```

## File chỉ thuộc về kit

Các file phục vụ đóng gói/phát hành (workflow publish, `packages/`, plugin metadata…) được liệt kê trong
`.aspecignore` để CLI **không** copy sang dự án người dùng. Thêm file kit-only mới → nhớ thêm vào đây.
