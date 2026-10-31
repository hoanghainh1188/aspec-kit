# テスト仕様書 (Test Specification) — đặc tả kiểm thử chuẩn khách Nhật

Output của `/test-spec`. Mỗi feature 1 cặp file, **`<NNN>-<slug>` khớp tên branch**:

| File | Vai trò |
|---|---|
| `docs/test-specs/<NNN>-<slug>.md` | **Nguồn sự thật** của テスト仕様書 — biên soạn tiếng Nhật từ `spec.md` + `docs/02-detail-design/` |
| `docs/test-specs/<NNN>-<slug>.csv` | Bản Excel gửi khách nghiệm thu — **sinh tự động**, UTF-8 BOM + CRLF, không sửa tay |

Ví dụ mẫu (xoá khi bắt đầu dự án thật): `docs/test-specs/000-example-reservation.md` và `.csv`.

## Cấu trúc bảng 7 cột chuẩn Nhật

| Cột | Ý nghĩa |
|---|---|
| `No` | Mã test case ổn định `TC-<NNN>-<ii>` (VD `TC-042-01`), đánh số liên tục từ `01` |
| `観点` | Phân loại (`正常系` / `異常系` / `境界値` / `権限`) + tóm tắt góc kiểm thử |
| `前提条件` | Điều kiện tiên quyết (dữ liệu, trạng thái, quyền user) |
| `手順` | Các bước thao tác đánh số `1. ...<br>2. ...` |
| `期待結果` | Kết quả kỳ vọng (câu tiếng Nhật kết bằng `〜こと`) |
| `結果` | `OK` / `NG` / `未実施` / `対象外` / `保留` (hoặc để trống khi mới lập) |
| `備考` | Mã `AC N` tương ứng trong `spec.md`, mã rule `V-xx` trong 詳細設計, và tên file unit test nếu đã có |

## Script tất định

Mọi kiểm tra cấu trúc, độ phủ AC và xuất CSV đều chạy qua `.claude/scripts/test_spec.py` (stdlib):

```bash
python3 .claude/scripts/test_spec.py export docs/test-specs/042-user-reservation.md
python3 .claude/scripts/test_spec.py summary docs/test-specs/042-user-reservation.md
```

- `export` kiểm: đúng 7 cột, mã `TC-<NNN>-<ii>` liên tục và khớp số feature, không trống các cột bắt buộc (`観点`, `前提条件`, `手順`, `期待結果`), giá trị `結果` hợp lệ, và **mọi Acceptance Criteria (`AC 1..N`) trong `spec.md` đều được phủ ít nhất 1 dòng** (ghi `AC N` ở cột `備考` hoặc `観点`). Sau đó ghi file `.csv` (UTF-8 BOM + CRLF).
- `summary` xuất JSON thống kê số lượng `OK` / `NG` / `未実施` / `保留` để dùng cho báo cáo tiến độ (`/progress-report`).
