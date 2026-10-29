# @hoanghainh1188/aspec-kit

CLI generator chính thức để khởi tạo dự án với **aspec-kit** — Template phát triển hướng đặc tả (Spec-Driven Development) kết hợp Claude Code và đọc tài liệu thiết kế tiếng Nhật (基本設計, 詳細設計, Figma).

## Khởi tạo nhanh (Quick Start)

Chạy một trong các lệnh sau tại terminal:

```bash
npx @hoanghainh1188/aspec-kit my-project
# hoặc
npm create @hoanghainh1188/aspec-kit@latest my-project
# hoặc
pnpm create @hoanghainh1188/aspec-kit my-project
# hoặc
yarn create @hoanghainh1188/aspec-kit my-project
```

## Cú pháp & Tùy chọn (Usage & Options)

```text
npx @hoanghainh1188/aspec-kit [project-directory] [options]
```

| Tùy chọn (Flags) | Mô tả | Mặc định |
|---|---|:---:|
| `[project-directory]` | Tên thư mục dự án cần tạo | `my-aspec-app` |
| `-y, --yes` | Bỏ qua các câu hỏi tương tác, dùng toàn bộ giá trị mặc định | `false` |
| `--steward <handle>` | Điền sẵn GitHub handle của Lead/Steward vào `.github/CODEOWNERS` | `@your-handle` |
| `--clean` | Tự động dọn dẹp feature mẫu (`000-example-reservation`) | `true` khi dùng `-y` |
| `--keep-example` | Giữ lại feature mẫu để tham khảo cấu trúc code & spec | `false` |
| `-v, --version` | In ra phiên bản hiện tại của CLI | — |
| `-h, --help` | In ra hướng dẫn sử dụng dòng lệnh | — |

### Ví dụ sử dụng:

```bash
# 1. Chế độ tương tác từng bước (Interactive - khuyên dùng)
npx @hoanghainh1188/aspec-kit my-app

# 2. Chế độ tự động hóa hoàn toàn (CI / Non-interactive)
npx @hoanghainh1188/aspec-kit my-app --yes

# 3. Chỉ định sẵn Steward và dọn dẹp feature mẫu
npx @hoanghainh1188/aspec-kit my-app --steward @hoanghainh1188 --clean
```

---

## Các câu hỏi tương tác (Interactive Prompts)

Khi chạy không kèm cờ `--yes`, CLI sẽ hỏi bạn 3 câu hỏi cơ bản:

1. **`Project directory name`**: Nhập tên thư mục dự án muốn tạo.
2. **`GitHub handle of project Steward`**: Nhập handle GitHub của người gác cổng (Steward) để tự động cập nhật vào `.github/CODEOWNERS` (ví dụ `@lead-dev`).
3. **`Keep sample feature for reference?`**: Chọn `y` nếu bạn muốn giữ lại code mẫu đặt chỗ `000-example-reservation` để tham khảo, hoặc `N` để xóa sạch và bắt đầu dự án mới tinh.

---

## Cấu trúc dự án được tạo ra

```text
my-project/
├── CLAUDE.md                       Quy ước dự án cho Claude Code
├── bootstrap.sh                    Script setup Spec Kit + agents/skills
├── .claude/
│   ├── settings.json              Permission deny/ask/allow
│   ├── agents/                    4 subagent (design-intake, code-reviewer, security-reviewer, glossary-steward)
│   ├── hooks/                     Format-on-save hook
│   └── commands/                  Command /design-to-code
├── docs/
│   ├── 00-glossary.md              Thuật ngữ nghiệp vụ Nhật-Việt-Anh
│   ├── 01-basic-design/            基本設計 gốc từ khách hàng
│   ├── 02-detail-design/           詳細設計 gốc
│   ├── 03-ui/                      Figma link + snapshots
│   ├── 04-decisions/               Câu trả lời ambiguity (INDEX.md)
│   ├── 05-lessons.md               Bài học/gotcha kỹ thuật khi code
│   └── CONSTITUTION_APPEND.md      Điều lệ gợi ý cho bối cảnh Nhật
├── src/                            Mã nguồn ứng dụng
└── tests/                          Kiểm thử tự động
```

---

## Các bước tiếp theo sau khi tạo dự án

```bash
# 1. Di chuyển vào thư mục dự án
cd my-project

# 2. Hoàn tất setup Spec Kit và các skill /speckit-*
bash bootstrap.sh

# 3. Khởi động Claude Code và chạy Hiến pháp dự án
claude
# Trong Claude Code gõ:
/speckit-constitution
```
