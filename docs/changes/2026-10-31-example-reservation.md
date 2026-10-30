> ⚠️ **BÁO CÁO MẪU — XOÁ TRƯỚC KHI DÙNG THẬT.** Đi kèm feature mẫu `000-example-reservation`.
> Output thật của `/design-change docs/02-detail-design/example-reservation/field-spec-v1.md docs/02-detail-design/example-reservation/field-spec-v2.md`
> (subagent `impact-analyzer`), đã soát lý do theo bước 3 của command. Số dòng trỏ tới bản code mẫu tại thời điểm phân tích.

# 仕様変更 — 予約承認 (`example-reservation`) · field-spec v1 → v2

- **Ngày phân tích:** 2026-10-31 · **Feature:** `000-example-reservation` · **Affected issues:** `000-example-reservation` (theo [CHANGELOG](../02-detail-design/example-reservation/CHANGELOG.md) mục v2 — feature mẫu, dự án thật sẽ là số issue)
- **So sánh:** [`docs/02-detail-design/example-reservation/field-spec-v1.md`](../02-detail-design/example-reservation/field-spec-v1.md) → [`docs/02-detail-design/example-reservation/field-spec-v2.md`](../02-detail-design/example-reservation/field-spec-v2.md)

## Thay đổi phát hiện (diff)

| ID | Loại | Mục gốc | v_cũ (v1) | v_mới (v2) |
|---|---|---|---|---|
| C1 | Field: thêm | 項目定義 No.5 `承認日時` | (không có) | `approvedAt`, kiểu `日時`, bắt buộc khi 承認 (`承認時○`). Lưu thời gian hệ thống lúc 承認 theo UTC, màn hình hiển thị JST |
| C2 | Validation: đổi điều kiện | V-03 `却下理由` | Bắt buộc khi 却下, không cho phép chỉ có khoảng trắng | Bắt buộc. Sau khi bỏ khoảng trắng hai đầu phải dài **10〜200 文字** |
| C3 | Validation: đổi thông báo lỗi | V-03 (cột エラー時) | 「却下理由を入力してください」 | 「却下理由は10〜200文字で入力してください」 |
| C4 | Màn hình: đổi hành vi | SCR-RSV-02 U-02 `承認ボタン` | Bấm là duyệt ngay | Bấm thì mở U-05, **không** duyệt ngay |
| C5 | Màn hình: thêm phần tử | SCR-RSV-02 U-05 `承認確認ダイアログ` | (không có) | Dialog với nội dung 「この予約を承認しますか？」. Bấm 「承認する」 thì chốt 承認. Bấm 「キャンセル」 thì đóng dialog và không thay đổi gì |

**Phần không tác động** (đã đối chiếu, nội dung y hệt v1): field No.1–4 (`id`, `status`, `assigneeId`, `customerId`), V-01 (403), V-02 (「処理済みの予約です」), U-01, U-03, U-04. Header 版数/発行日 chỉ đổi metadata.

**Đối chiếu CHANGELOG với diff tự tìm.** CHANGELOG không mâu thuẫn với diff, nhưng **ghi thiếu** 3 điểm — nhắc người nhận bản v2 bổ sung CHANGELOG:
- (a) CHANGELOG không nhắc việc đổi **thông báo lỗi** của V-03 (C3).
- (b) Mục 1 của CHANGELOG không ghi field này **bắt buộc khi 承認** (`承認時○`).
- (c) Mục 3 của CHANGELOG không ghi **nội dung dialog** và **hành vi nút 「キャンセル」** (C5).

**Điểm v2 bỏ trống (cần hỏi):** v2 yêu cầu 「画面表示はJST」 cho `承認日時`, nhưng **không có phần tử màn hình nào hiển thị field này**. U-01 vẫn chỉ ghi 「予約ID・顧客・ステータスを表示」.

## 1. Bảng tác động

| # | Thay đổi | Artifact | Vị trí | Tác động | Lý do |
|---|---|---|---|---|---|
| 1 | C1–C5 | [intake](../intake/000-example-reservation.md) | Mục "Input sources", dòng 12 | Sửa | Dòng này trỏ `field-spec-v1.xlsx`. Phải chuyển sang v2 và kèm bản export `field-spec-v2.md` |
| 2 | C1, C2, C4, C5 | intake | Mục "Prompt for /speckit-specify", dòng 17–21 | Sửa | Prompt chỉ viết "thực hiện 承認 … hoặc từ chối kèm lý do". Chưa có: bước dialog trước khi 承認 (C4, C5), việc ghi lại thời điểm 承認 (C1), độ dài lý do 10〜200 (C2) |
| 3 | C1, C2, C5 | intake | Mục "Ambiguities to raise", dòng 23–25 | Thêm | Có ambiguity mới: cách đếm 文字 và định nghĩa "khoảng trắng"; dữ liệu `approved` cũ không có `approvedAt`; màn hình nào hiển thị 承認日時 (xem mục 2). Ambiguity #1 (kênh thông báo) và #2 (再申請) cũ **vẫn mở**, vì v2 không nhắc tới |
| 4 | C1, C5 | intake | Mục "Thuật ngữ mới", dòng 28 | Sửa | Hiện ghi "Không có". v2 đưa vào `承認日時` và `承認確認ダイアログ`, cả hai chưa có trong glossary (xem #29, #30) |
| 5 | C2 | [spec.md](../../specs/000-example-reservation/spec.md) | AC 2 | Sửa | AC 2 ghi "kèm lý do bắt buộc khi từ chối". Phải đổi thành "lý do sau khi trim dài 10〜200 文字" kèm thông báo lỗi ở C3 |
| 6 | C4, C5 | spec.md | AC 2 (phần "→ **approval**") | Sửa | Theo v2, 承認 không còn là thao tác một bước. Cần thêm AC mới, đề xuất **AC 5**: "Bấm 承認 thì hiện dialog 「この予約を承認しますか？」. 「承認する」 thì chốt. 「キャンセル」 thì đóng dialog, reservation giữ nguyên" |
| 7 | C1 | spec.md | AC 3 | Sửa | AC 3 ghi "Sau approval: trạng thái → `approved`". Cần bổ sung "ghi `approvedAt` = thời điểm hệ thống, lưu UTC, hiển thị JST". Có thể tách ra thành AC 6 |
| 8 | C1–C5 | spec.md | AC 1, AC 4 | Không đổi | AC 1 (danh sách `pending`) và AC 4 (403 nếu không phải 担当者 được gán, tức V-01) không bị v2 động tới |
| 9 | C1 | [plan.md](../../specs/000-example-reservation/plan.md) | Mục "Cách tiếp cận" + "Cấu trúc file" | Sửa | Plan yêu cầu domain là "hàm thuần (không I/O)". Hàm này nay phải gán "thời gian hệ thống", nên **không được gọi `Date.now()` bên trong**. Phải tiêm thời điểm vào, đổi chữ ký `approveReservation` (xem #19). Plan cần chốt data model của `approvedAt`: chuỗi ISO 8601 UTC hay `Date`, optional hay discriminated union theo `status` |
| 10 | C4, C5 | plan.md | Đoạn "Tầng vận chuyển … *ngoài phạm vi bản mẫu này*" | Cần xác nhận | Dialog U-05 thuần UI. Plan hiện chỉ đưa domain core vào phạm vi, chưa có tầng UI. Cần quyết định đưa tầng UI vào phạm vi hay để treo như T5 |
| 11 | C1 | plan.md | Mục "Rủi ro / phụ thuộc" | Thêm | Rủi ro múi giờ: lessons ghi "承認 API trả `approved_at` theo giờ JST, không UTC" (xem #33). Cần ghi rõ: convert sang UTC ở boundary, map `approved_at` → `approvedAt` |
| 12 | C1 | [tasks.md](../../specs/000-example-reservation/tasks.md) | **T1** `[x]` | Sửa (mở lại `[ ]`) | T1 định nghĩa hàm thuần nhận `reservation` + `actorAssigneeId`. Nay phải nhận thêm thời điểm 承認 và trả về `approvedAt` |
| 13 | C2, C3 | tasks.md | **T3** `[x]` | Sửa (mở lại `[ ]`) | T3 hiện ghi "thiếu `reason` khi `reject` → lỗi validation". Phải đổi thành "trim rồi kiểm 10〜200 文字, kèm thông báo lỗi C3" |
| 14 | C1, C2 | tasks.md | **T4** `[x]` | Sửa (mở lại `[ ]`) | Test phải thêm biên độ dài và assert `approvedAt`. Phải viết RED trước (Article W). Chi tiết ở #23–#28 |
| 15 | C4, C5 | tasks.md | (chưa có) | Thêm | Đề xuất **T7**: UI SCR-RSV-02, U-02 mở U-05, chỉ gọi `approveReservation` khi bấm 「承認する」 (AC 5 mới). Treo nếu tầng UI ngoài phạm vi (#10) |
| 16 | C1 | tasks.md | **T5** `[ ]` (route + thông báo) | Cần xác nhận | Tầng route/persistence là nơi convert JST → UTC (theo lesson) và lưu `approvedAt`. Nên bổ sung vào mô tả T5. T5 vẫn treo vì ambiguity #1 |
| 17 | — | tasks.md | **T2**, **T6** | Không đổi | T2 (`Forbidden`/403, V-01) không đổi. T6 (再申請) vẫn treo vì v2 không nhắc |
| 18 | C1 | [approveReservation.ts](../../src/features/example-reservation/approveReservation.ts) | `interface Reservation` (dòng 15–22) | Thêm | Chưa có field `approvedAt`. Cần thêm theo kiểu đã chốt ở plan (#9). Đặt tên bám glossary: `approvedAt` (承認 → approval/approve) |
| 19 | C1 | approveReservation.ts | `approveReservation(reservation, actorAssigneeId)` (dòng 51–60), lệnh `return { ...reservation, status: "approved" }` | Sửa | Return chưa có `approvedAt`. Cần thêm tham số thời điểm (VD `now: Date`) và trả `approvedAt: now.toISOString()` (UTC), vẫn immutable |
| 20 | C2 | approveReservation.ts | `rejectReservation`, điều kiện `if (reason.trim() === "")` (dòng 75) | Sửa | Điều kiện này chỉ chặn chuỗi rỗng. Phải kiểm `reason.trim().length` nằm trong [10, 200]. Nên đưa 10 và 200 thành hằng số, không hardcode. Lưu ý: `.length` của JS đếm UTF-16 code unit, nên ký tự ngoài BMP (VD 𠮷, emoji) bị tính là 2. Cách đếm này phải chờ clarify (Q1) |
| 21 | C3 | approveReservation.ts | `new ValidationError("Từ chối bắt buộc kèm lý do")` (dòng 76) và JSDoc của `ValidationError` "Ném khi từ chối mà thiếu lý do bắt buộc" (dòng 32) | Sửa | Message hiện tại không phải literal của v1, cũng không phải của v2. Cần thống nhất với 「却下理由は10〜200文字で入力してください」, hoặc map ở tầng UI. Cần sửa JSDoc vì giờ còn có nhánh "quá ngắn/quá dài" |
| 22 | C4, C5 | approveReservation.ts | `ForbiddenError`, `ValidationError` (class), `assertAssignee`, nhánh `status !== "pending"` (dòng 56, 72) | Không đổi | V-01 và V-02 giữ nguyên. Dialog U-05 thuần UI: 「キャンセル」 không gọi hàm domain, 「承認する」 gọi đúng `approveReservation` như cũ. `src/` chưa có tầng UI |
| 23 | C2 | [approveReservation.test.ts](../../src/features/example-reservation/approveReservation.test.ts) | `it("từ chối kèm lý do → chuyển sang rejected (AC 2)")`, reason `"Hết chỗ"` (dòng 45) | Fail → sửa | `"Hết chỗ"` dài 7 ký tự, dưới min 10 của v2, nên sẽ nhận `ValidationError` thay vì `status: "rejected"`. Cần đổi sang lý do hợp lệ dài ≥ 10 ký tự |
| 24 | C2 | test | `it("từ chối thiếu lý do → ValidationError (AC 2)")`, reason `"  "` (dòng 50) | Không đổi | Sau trim độ dài là 0, nhỏ hơn 10, vẫn ném `ValidationError`. Test chỉ assert kiểu lỗi, không assert message |
| 25 | C2 | test | `it("người khác từ chối hộ → ForbiddenError (AC 4)")`, reason `"x"` (dòng 54) | Không đổi (có điều kiện) | Test vẫn pass vì `assertAssignee` (dòng 71) chạy **trước** check độ dài (dòng 75). Nếu sau này đảo thứ tự check, `"x"` (1 ký tự) sẽ ném `ValidationError` và test fail. Phải giữ thứ tự: quyền trước, validation sau |
| 26 | C1 | test | `it("担当者 được gán → chuyển pending sang approved (AC 3)")` (dòng 23–26) | Sửa | Hiện chỉ `expect(result.status).toBe("approved")`. Phải truyền thời điểm cố định và assert `approvedAt` (UTC). Nếu tham số thời điểm là bắt buộc, cả 4 lời gọi `approveReservation(...)` (dòng 24, 29, 34, 39) sẽ lỗi compile cho tới khi sửa |
| 27 | C1 | test | `it("không sửa reservation gốc — immutable")`, `it("người KHÔNG phải 担当者 …")`, `it("… không ở trạng thái pending → ValidationError")` | Không đổi / Cần xác nhận | Logic không đổi. Có một ngoại lệ: fixture `{ ...base, status: "approved" }` (dòng 38) không có `approvedAt`. Nếu `Reservation` thành discriminated union bắt buộc `approvedAt` khi `approved`, fixture này lỗi type và phải thêm field |
| 28 | C1, C2 | test | (chưa có) | Thêm | Cần thêm các ca: biên 9 / 10 / 200 / 201 ký tự sau trim; chuỗi có khoảng trắng hai đầu mà lõi đủ 10 ký tự thì pass; literal message C3; `rejectReservation` **không** gán `approvedAt`; ký tự đa byte/全角 (sau khi Q1 và Q2 được chốt). Thư mục `tests/` chưa có, chỉ có test đặt cạnh code |
| 29 | C1 | [glossary](../00-glossary.md) | (chưa có) | Thêm (đề xuất) | Đề xuất dòng `承認日時 \| Thời điểm phê duyệt \| approvedAt \| lưu UTC, hiển thị JST`. Append ngay trong branch feature (rule 5) |
| 30 | C5 | glossary + [quyết định 2026-01-01](../04-decisions/2026-01-01-approval-vs-confirm.md) | (chưa có) | Cần xác nhận | Dịch thẳng `承認確認ダイアログ` sẽ ra `ConfirmDialog`/`confirmApproval`, nhưng quyết định 2026-01-01 cấm "confirm" (trùng nghĩa với xác nhận email). Đề xuất `ApprovalDialog`, append glossary, steward xác nhận. Quyết định 2026-01-01 **vẫn hiệu lực** |
| 31 | C2 | glossary | (thiếu sẵn từ trước) | Thêm (đề xuất) | Code đã dùng `rejectReservation`/`reason` nhưng glossary chưa có `却下` / `却下理由`. v2 nhắc thẳng tới V-03. Đề xuất append `却下 → reject`, `却下理由 → rejection reason` |
| 32 | C1–C5 | [decisions INDEX](../04-decisions/INDEX.md) | Dòng 2026-01-01 | Không đổi | Chỉ có 1 quyết định (approval vs confirm), vẫn hiệu lực và ràng buộc #30. Chưa có quyết định nào về cách đếm 文字, múi giờ hay data cũ, nên các câu Q1–Q5 đều là câu hỏi mới. Câu trả lời phải ghi vào `docs/04-decisions/` |
| 33 | C1 | [lessons](../05-lessons.md) | Dòng "承認 API trả `approved_at` theo giờ JST, không UTC" | Cần xác nhận | Lesson này dính trực tiếp vào C1 (v2 yêu cầu lưu UTC). Cần xác nhận "承認 API" trong lesson có phải nguồn của `承認日時` không. v2 nói giá trị là "thời gian hệ thống", có thể do backend tự sinh. Nếu đúng là cùng nguồn thì convert ở boundary (T5), không so sánh trực tiếp |
| 34 | — | constitution | `.specify/memory/constitution.md` | Chưa có | Repo chưa có `.specify/` (chưa chạy `bootstrap.sh`). plan.md có nhắc Article W (TDD, coverage ≥ 80%) nhưng không kiểm được trực tiếp từ file |

## 2. Đề xuất chạy lại

1. **Subagent `design-intake`** với `field-spec-v2.md`. Lý do: Input sources đang trỏ v1, prompt chưa có C1/C2/C4/C5, cần thêm ambiguity mới và thuật ngữ mới (#1–#4).
2. **`/speckit-specify`** (dùng prompt intake mới). Lý do: AC 2 và AC 3 phải sửa, cần thêm AC 5 (dialog) và có thể thêm AC 6 (`approvedAt`) (#5–#7).
3. **`/speckit-clarify`**, ghi câu trả lời vào `docs/04-decisions/` và `INDEX.md`. Các câu cần hỏi:
   - Q1: Cách đếm 10〜200 文字: theo ký tự hiển thị (grapheme), code point hay byte? 全角 và 半角 có tính như nhau không?
   - Q2: "前後の空白" có gồm 全角スペース (U+3000), tab, xuống dòng không? Khoảng trắng và xuống dòng **ở giữa** chuỗi có được tính vào độ dài không?
   - Q3: Khi 却下理由 để trống, dùng chung message 「却下理由は10〜200文字で入力してください」, hay giữ message 「却下理由を入力してください」 của v1?
   - Q4: Các reservation đã `approved` trước v2 không có `approvedAt`: để trống hay migrate (lấy giá trị nào)?
   - Q5: `承認日時` hiển thị ở phần tử/màn hình nào, định dạng ra sao? U-01 không liệt kê field này.
   - Q6 (nội bộ, cho steward): đặt tên dialog là `ApprovalDialog` để tránh "confirm" (#30)?
   - Nhắc lại ambiguity cũ #1 (kênh thông báo) và #2 (再申請), vẫn chưa chốt.
4. **`/speckit-plan`**. Lý do: phải đổi chữ ký `approveReservation` (tiêm thời điểm, giữ hàm thuần), chốt data model `approvedAt`, quyết định phạm vi tầng UI cho U-05, ghi rủi ro JST/UTC (#9–#11).
5. **`/speckit-tasks`**. Lý do: mở lại T1, T3, T4; thêm T7 (dialog UI); bổ sung T5 phần convert và lưu `approvedAt` (#12–#16).
6. **`/speckit-analyze`**. Lý do: kiểm lại tính nhất quán spec ↔ plan ↔ tasks sau khi AC và chữ ký hàm đổi, và bắt drift với glossary và quyết định 2026-01-01.
7. **`/speckit-implement`** theo TDD. Viết RED trước: sửa test `"Hết chỗ"`, thêm test biên 9/10/200/201 và test `approvedAt`, rồi mới sửa `rejectReservation` và `approveReservation` (#18–#28).
8. **`code-reviewer`**. Lý do: đối chiếu code với AC mới, giữ immutable, giữ thứ tự check quyền trước validation (#25).
9. **`glossary-steward`**. Lý do: có thuật ngữ mới `承認日時`, `承認確認ダイアログ`, `却下`/`却下理由`, và nguy cơ đặt tên "confirm" (#29–#31).
10. **`security-reviewer`** (phạm vi hẹp). Lý do: V-03 là validation input văn bản của người dùng, cận trên 200 chặn payload quá dài. V-01 (403) không đổi nên không cần audit lại phần quyền.
11. **Test gate**, rồi **deploy** theo mục Deploy của `CLAUDE.md`.

Không bỏ bước nào. Mọi bước từ intake trở đi đều có ít nhất một artifact phải đổi. Thực hiện qua `/design-to-code` (từ bước `design-intake`).

## 3. 影響範囲（お客様向けサマリー）

詳細設計書 v2（2026-10-20 発行）の変更内容を確認し、影響範囲を以下のとおり整理いたしました。

### 変更点ごとの影響範囲・影響度

| 変更点 | 影響範囲 | 影響度 |
|---|---|---|
| 1. 「承認日時」の追加（承認時に記録、UTC保存・JST表示） | 予約データの項目追加、承認処理への日時記録の追加、関連テストの修正が必要です。あわせて、既存の承認済みデータの扱いについて方針の確定が必要です。 | 中 |
| 2. 却下理由のチェック変更（前後の空白を除いて10〜200文字）およびエラーメッセージ変更 | 却下時の入力チェック処理と、関連テストの修正・追加が必要です。文字数の数え方によって実装が変わるため、事前のご確認をお願いいたします。 | 小 |
| 3. 承認ボタン押下時の確認ダイアログ追加 | 画面上の操作のみの変更で、承認処理そのものに変更はございません。画面部分の実装時に対応いたします。 | 小 |

上記以外の項目（予約ID・ステータス・担当者ID・顧客ID、担当者チェック、ステータスチェック、却下ボタン・却下理由欄）に変更はなく、影響はございません。

### ご確認事項（ご質問）

1. 却下理由の「10〜200文字」は、どのように数えればよろしいでしょうか。全角・半角を同じ1文字として数える理解でよろしいでしょうか。また、絵文字や一部の漢字（例：「𠮷」）も1文字として扱う想定でしょうか。
2. 「前後の空白」には、全角スペース・タブ・改行も含まれますでしょうか。また、文章の途中にある空白や改行は文字数に含める想定でしょうか。
3. 却下理由が未入力の場合も、新しいメッセージ「却下理由は10〜200文字で入力してください」を表示する想定でよろしいでしょうか。それとも、従来の「却下理由を入力してください」を継続して使用しますでしょうか。
4. 本変更より前に承認された予約には「承認日時」がございません。これらは空欄で表示する形でよろしいでしょうか。あるいは、何らかの値を補完する必要がございますでしょうか。
5. 「承認日時」はどの画面のどの位置に表示する想定でしょうか。表示形式（例：YYYY/MM/DD HH:mm）もあわせてご教示ください。現行の画面項目定義には、表示箇所の記載がございません。

### 今後の進め方

1. 上記ご確認事項へのご回答をいただいたのち、仕様書・設計・作業計画を更新いたします。
2. テストを先に作成・修正したうえで、承認日時の記録処理と却下理由チェックを修正いたします。確認ダイアログは、画面部分の実装時に対応いたします。
3. コードレビュー、セキュリティ確認、テストを経てリリースいたします。

なお、以前よりご確認をお願いしている2点（承認後の通知方法、却下後の再申請の可否）は、今回の v2 でも記載がございません。引き続きご回答をお待ちしております。
