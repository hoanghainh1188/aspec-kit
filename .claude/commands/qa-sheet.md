---
description: 質問票 (Q&A sheet) — biến Ambiguities của intake thành bảng hỏi khách bằng 敬語 (.md + CSV Excel), và ghi câu trả lời về docs/04-decisions/
argument-hint: "<NNN>-<slug> | docs/intake/<NNN>-<slug>.md | --ingest docs/qa/<NNN>-<slug>.(md|csv)"
---

Bạn là BrSE soạn **質問票 (bảng câu hỏi gửi khách)** từ mục *Ambiguities* của intake, và khi khách
trả lời thì ghi câu trả lời thành quyết định trong `docs/04-decisions/`.

Đối số: `$ARGUMENTS`
- Có `--ingest <file>` → làm **Chế độ B (ingest)**.
- Còn lại (`<NNN>-<slug>` hoặc đường dẫn intake; trống → suy từ tên branch hiện tại) → **Chế độ A (sinh sheet)**.

Phần tất định (validate, CSV + BOM, lọc câu đã ghi) **luôn** chạy qua
`python3 .claude/scripts/qa_sheet.py` — không tự viết CSV hay tự đoán câu nào đã ghi.
Không có script (VD cài qua plugin) → DỪNG, bảo người dùng copy file đó từ repo aspec-kit.

---

## Chế độ A — sinh sheet `docs/qa/<NNN>-<slug>.md` + `.csv`

1. **Nạp ngữ cảnh.** Đọc `docs/intake/<NNN>-<slug>.md` (mục `## Ambiguities…`),
   `docs/00-glossary.md`, `docs/04-decisions/INDEX.md`. Thiếu intake → DỪNG, bảo người dùng chạy
   `design-intake` trước.

2. **Lọc câu đã chốt.** Ambiguity nào đã có quyết định trong `INDEX.md` → vẫn giữ 1 dòng (để ID ổn
   định) nhưng ghi `ステータス = 取下げ` và `背景・提案` = 「決定済み（docs/04-decisions/<file>）のため取下げ」.
   Không hỏi khách lại thứ đã chốt (rule 2 + 6 `CLAUDE.md`).

3. **Ánh xạ 1 ambiguity → đúng 1 câu hỏi, ID ổn định.** Ambiguity thứ *i* trong intake ↔
   `Q-<NNN>-<ii>` (2 chữ số, VD `Q-042-01`). **Nếu sheet đã tồn tại:** giữ nguyên mọi dòng cũ (kể cả
   回答欄 khách đã điền), chỉ **thêm** dòng mới cho ambiguity mới ở cuối — không đánh lại số, không
   xoá dòng (ambiguity bị bỏ → `取下げ`). Một ambiguity chứa nhiều ý → vẫn 1 câu, gộp ý con thành
   （1）（2） trong cùng ô.

4. **Viết từng ô bằng tiếng Nhật thương mại (敬語 / ビジネス丁寧語):**
   - `対象画面/機能`: tên màn hình/chức năng theo tài liệu gốc của khách (VD 「予約承認画面」).
   - `質問内容`: câu hỏi đóng, trả lời được ngay — kết bằng 「〜でしょうか。」「〜ご教示いただけますでしょうか。」.
     Đưa sẵn lựa chọn nếu có（A／B／両方）.
   - `背景・提案`: vì sao hỏi (trích nguồn: 基本設計書 / 詳細設計書 / Figma, chỗ nào mâu thuẫn hay bỏ
     trống) + **đề xuất của phía dev** 「弊社としては〜案をご提案いたします。」 để khách chỉ cần đồng ý.
   - `回答欄`: để trống. `回答期限`: lấy từ `python3 .claude/scripts/qa_sheet.py due --days 5`
     (+5 ngày làm việc; script **chưa trừ ngày lễ Nhật** — kiểm lịch 祝日 rồi chỉnh tay nếu cần, hoặc
     dùng hạn người dùng đưa). `ステータス`: `未回答`.
   - **Thuật ngữ nghiệp vụ lấy đúng cột 日本語 của `docs/00-glossary.md`** (VD 承認, không viết 確認).
     Không có trong glossary → liệt kê ở báo cáo cuối như *term mới* để append glossary (rule 5).
   - Trong ô dùng `<br>` để xuống dòng; ký tự `|` phải escape `\|`.

5. **Ghi file** theo đúng khung dưới (giữ nguyên header 7 cột — script dựa vào nó):

   ```markdown
   # 質問票 — <機能名>（<NNN>-<slug>）

   | 項目 | 内容 |
   |---|---|
   | 案件 | <tên dự án> |
   | 対象機能 | <機能名>（<NNN>-<slug>） |
   | 作成日 | YYYY-MM-DD |
   | 版数 | 第1版 |

   いつもお世話になっております。
   <機能名>の設計書を拝見し、実装前に確認させていただきたい点を下記にまとめました。
   お手数をおかけしますが、回答期限までに「回答欄」へご記入いただけますと幸いです。

   ## 質問一覧

   | No | 対象画面/機能 | 質問内容 | 背景・提案 | 回答欄 | 回答期限 | ステータス |
   |---|---|---|---|---|---|---|
   | Q-<NNN>-01 | … | … | … |  | YYYY-MM-DD | 未回答 |

   ステータス：未回答／確認中／回答済／取下げ

   以上、よろしくお願いいたします。

   <!-- nội bộ: nguồn = docs/intake/<NNN>-<slug>.md · ingest: /qa-sheet --ingest docs/qa/<NNN>-<slug>.csv -->
   ```

6. **Xuất CSV + validate:** `python3 .claude/scripts/qa_sheet.py export docs/qa/<NNN>-<slug>.md`.
   Script kiểm: header, định dạng/ID liên tục, ステータス hợp lệ, **số câu ≥ số ambiguity** và câu
   thừa phải là `取下げ`; rồi ghi `docs/qa/<NNN>-<slug>.csv` (UTF-8 BOM, CRLF — mở thẳng bằng Excel).
   Lỗi → sửa file `.md`, chạy lại. **Không** sửa tay file `.csv`.

7. **Gọi subagent `glossary-steward`** (Task tool) với phạm vi **chỉ** `docs/qa/<NNN>-<slug>.md`:
   kiểm thuật ngữ trong sheet khớp glossary. Term lệch → sửa sheet, chạy lại bước 6.

8. **[DỪNG] Báo cáo:** số câu (mới / giữ nguyên / 取下げ), đường dẫn `.md` + `.csv`, term mới cần
   append glossary. Người dùng review rồi tự gửi khách (CSV/Excel hoặc dán bảng) — bạn không gửi.

---

## Chế độ B — `--ingest <file>`: câu trả lời → `docs/04-decisions/`

Input: sheet khách trả về — `.csv` (Excel "CSV UTF-8" hoặc "CSV" Shift_JIS đều đọc được) hoặc `.md`
đã điền. Tên file phải giữ `<NNN>-<slug>`.

1. **Chạy** `python3 .claude/scripts/qa_sheet.py ingest <file>` → JSON gồm `pending` (câu đã có
   回答欄 nhưng **chưa** có file quyết định nào chứa ID đó), `already_recorded`, `unanswered`, `warnings`.
   Câu nào đã ghi thì script tự bỏ qua — **không** ghi lại.
2. **`warnings` khác rỗng** (VD có 回答欄 nhưng ステータス chưa `回答済`) → [DỪNG] hỏi người dùng
   từng câu: ghi hay chờ khách xác nhận.
3. **Mỗi câu trong `pending`** → 1 file `docs/04-decisions/<YYYY-MM-DD>-<slug>.md` (ngày = hôm nay,
   slug tiếng Anh kebab-case theo chủ đề) đúng template `docs/04-decisions/README.md`, thêm dòng mã câu hỏi:

   ```markdown
   # <Tiêu đề ngắn tiếng Việt>
   - Ngày: YYYY-MM-DD
   - Feature liên quan: `<NNN>-<slug>`
   - Mã câu hỏi (質問票): `Q-<NNN>-<ii>` — <link markdown tương đối tới ../qa/<NNN>-<slug>.md>
   - Câu hỏi gốc: <tóm tắt tiếng Việt của 質問内容>
   - Quyết định: <tóm tắt tiếng Việt> — nguyên văn khách: 「<回答欄>」
   - Người quyết định: <khách — hỏi người dùng tên người trả lời nếu sheet không ghi>
   ```

   Câu trả lời mơ hồ / chưa chốt (「検討中」「別途相談」…) → KHÔNG ghi quyết định; báo người dùng để hỏi lại.
4. **Thêm dòng vào `docs/04-decisions/INDEX.md`** cho mỗi file mới, đúng 4 cột
   `| Ngày | Quyết định | Feature | Thuật ngữ / chủ đề |`, chèn **trên cùng** bảng (mới nhất trên cùng).
5. **Cập nhật sheet nguồn `docs/qa/<NNN>-<slug>.md`:** chép 回答欄 khách điền vào đúng dòng, đặt
   `ステータス = 回答済`, rồi chạy lại `export` để `.csv` khớp `.md`.
6. **[DỪNG] Báo cáo:** file quyết định mới, ID đã bỏ qua (đã ghi / chưa trả lời), câu cần hỏi lại.
   Nếu đang giữa pipeline `/design-to-code`, nhắc chạy lại `/speckit-clarify` (hoặc `/speckit-analyze`)
   để spec hấp thụ quyết định mới.
