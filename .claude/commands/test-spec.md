---
description: テスト仕様書 — sinh tài liệu đặc tả kiểm thử tiếng Nhật (No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考) dạng Markdown + CSV Excel từ spec.md
argument-hint: "<NNN>-<slug> | specs/<NNN>-<slug>/spec.md"
---

Bạn là BrSE / QA Lead biên soạn **テスト仕様書 (Test Specification — Đặc tả kiểm thử)** chuẩn tiếng Nhật
giao nộp khách hàng từ Acceptance Criteria trong `specs/*<slug>*/spec.md` và các quy tắc kiểm tra trong
`docs/02-detail-design/<slug>/`.

Đối số: `$ARGUMENTS` (`<NNN>-<slug>` hoặc đường dẫn `spec.md`; trống → suy từ tên branch hiện tại).

Phần tất định (validate cấu trúc 7 cột, kiểm độ phủ 100% AC của `spec.md`, xuất CSV UTF-8 BOM cho Excel)
**luôn** chạy qua `python3 .claude/scripts/test_spec.py` — không tự tạo CSV bằng tay.

---

1. **[TỰ CHẠY] Nạp ngữ cảnh:**
   - Đọc `specs/*<slug>*/spec.md` (mục `## Acceptance criteria`), `docs/02-detail-design/<slug>/` (nếu có
     bảng 入力チェック / 画面項目定義), `docs/00-glossary.md`, và các file test trong `src/features/<slug>/` (nếu đã viết).
   - Thiếu `spec.md` → DỪNG, bảo người dùng chạy `/speckit-specify` trước.

2. **[TỰ CHẠY] Thiết kế các test case tiếng Nhật:**
   - Mỗi Acceptance Criteria (`AC 1..N`) trong `spec.md` phải sinh ra **ít nhất 1 test case** (tách rõ
     `正常系` — luồng chuẩn, `異常系` — lỗi validation/quyền, `境界値` — biên nếu có trong 詳細設計).
   - Mã test case ổn định: `TC-<NNN>-<ii>` (2 chữ số, liên tục từ `01`, VD `TC-042-01`). Nếu file
     `docs/test-specs/<NNN>-<slug>.md` đã tồn tại, giữ nguyên ID các dòng cũ và kết quả `結果` đã điền, chỉ
     cập nhật hoặc thêm dòng mới ở cuối.
   - Ngôn ngữ: tiếng Nhật chuẩn テスト仕様書:
     - `観点`: `<正常系|異常系|境界値|権限>：<tóm tắt ngắn>（AC <n>）`
     - `前提条件`: kết bằng `〜こと`
     - `手順`: các bước đánh số `1. ...<br>2. ...`
     - `期待結果`: kết bằng `〜こと`
     - `結果`: nếu đã có unit/integration test tương ứng trong `src/features/<slug>/` đang pass → điền `OK`;
       nếu chưa có test hoặc đang chờ → điền `未実施`.
     - `備考`: ghi rõ `AC <n>`, mã rule `V-xx` của 詳細設計 (nếu có) và tên file test (VD `approveReservation.test.ts`).
   - **Thuật ngữ nghiệp vụ** phải khớp cột 日本語 trong `docs/00-glossary.md`.

3. **[TỰ CHẠY] Ghi file `docs/test-specs/<NNN>-<slug>.md`** theo đúng khung:

   ```markdown
   # テスト仕様書 — <機能名>（<NNN>-<slug>）

   | 項目 | 内容 |
   |---|---|
   | 案件 | <tên dự án> |
   | 対象機能 | <機能名>（<NNN>-<slug>） |
   | 作成日 | YYYY-MM-DD |
   | 版数 | 第1版 |

   ## テストケース一覧

   | No | 観点 | 前提条件 | 手順 | 期待結果 | 結果 | 備考 |
   |---|---|---|---|---|---|---|
   | TC-<NNN>-01 | 正常系：…（AC 1） | …こと | 1. …<br>2. … | …こと | 未実施 | AC 1 |

   結果：OK／NG／未実施／対象外／保留

   <!-- nội bộ: nguồn = specs/<NNN>-<slug>/spec.md · export: python3 .claude/scripts/test_spec.py export docs/test-specs/<NNN>-<slug>.md -->
   ```

4. **[TỰ CHẠY] Validate + Xuất CSV (UTF-8 BOM):**
   - Chạy `python3 .claude/scripts/test_spec.py export docs/test-specs/<NNN>-<slug>.md`.
   - Script kiểm: đúng 7 cột, ID `TC-<NNN>-<ii>` liên tục, không trống cột bắt buộc, và **mọi `AC 1..N`
     trong `spec.md` đều xuất hiện ít nhất 1 lần**. Nếu báo lỗi → sửa `.md` rồi chạy lại.

5. **[TỰ CHẠY] Gọi subagent `glossary-steward`** (Task tool) kiểm tra `docs/test-specs/<NNN>-<slug>.md`
   để chắc chắn thuật ngữ tiếng Nhật nhất quán với `docs/00-glossary.md`.

6. **[DỪNG] Báo cáo cho người dùng:**
   - Số lượng test case (`正常系` / `異常系`, `OK` / `未実施`), đường dẫn `.md` + `.csv` để mở bằng Excel gửi khách.
