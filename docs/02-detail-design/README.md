# Detail design (詳細設計) — tài liệu GỐC

Mỗi feature 1 thư mục: `docs/02-detail-design/<slug>/` (`<slug>` khớp branch `NNN-<slug>` — xem
`01-basic-design/README.md`).

Cùng quy tắc đặt / không-sửa / versioning như `01-basic-design`, **gồm cả yêu cầu bản export
text-extractable** (VD `field-spec-v1.md`) nếu chưa cài Skill đọc Office.

**Excel / PDF → Markdown tự động** (cần [uv](https://docs.astral.sh/uv/), cùng công cụ Spec Kit dùng):

```bash
uv run --script .claude/scripts/convert-design.py docs/02-detail-design/<slug>/field-spec-v1.xlsx
# hoặc: npx @hoanghainh/aspec-kit convert docs/02-detail-design/<slug>/field-spec-v1.xlsx
```

- Ghi `field-spec-v1.md` (mục lục) + 1 file `field-spec-v1__<NN>_<tên sheet>.md` mỗi sheet, **cạnh file
  gốc** — file gốc không bị đụng tới. PDF → `<tên>.md`, text + bảng theo từng trang.
- Ô gộp (merged cell) được nhân bản giá trị; cột gộp kiểu Excel 方眼紙 được thu về 1 cột; bảng field /
  validation giữ dạng bảng GFM; tên sheet tiếng Nhật giữ nguyên (chỉ thay ký tự cấm trong tên file).
- Tự append 1 mục vào `CHANGELOG.md` của thư mục. Chỉ ghi đè file `.md` do chính tool sinh từ cùng
  nguồn (`--force` để ép). Bản mới của khách (`v2.xlsx`) → chạy lại, ra bộ `.md` riêng của v2.

Đây là nơi chứa phần "thịt" mà `design-intake` đọc kỹ nhất trước khi sinh prompt `/speckit-specify`:

- **Bảng field + validation rule** — đặc biệt bảng Excel (hay giấu rule nghiệp vụ). Export ra
  markdown để không mất cấu trúc bảng khi parse.
- **Business rule + edge case + error state** — các nhánh xử lý, thông báo lỗi, điều kiện biên.

Input càng đủ 2 nhóm này, spec sinh ra càng ít ambiguity phải đưa vào `/speckit-clarify`.

Cùng quy tắc `CHANGELOG.md` như `01-basic-design`: mỗi bản mới ghi 1 mục kèm **Affected issues** (bắt
buộc) — số issue của feature bị ảnh hưởng để biết cái nào phải re-run (TEAM-WORKFLOW mục 8).
