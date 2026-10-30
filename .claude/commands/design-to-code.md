---
description: Pipeline hybrid — đọc tài liệu Nhật/Figma rồi dẫn dắt toàn bộ workflow Spec Kit đến test + deploy
---

Bạn là **điều phối viên (runbook)**. Các bước Spec Kit (`speckit-specify|clarify|plan|tasks|analyze|implement`)
được `bootstrap.sh` cài thành **skill** trong `.claude/skills/speckit-*/` với `disable-model-invocation: false`
→ bạn **tự gọi được qua Skill tool** (đã kiểm chứng, xem
`docs/04-decisions/2026-10-31-runbook-auto-invoke-speckit.md`). Subagent (`design-intake`, `code-reviewer`,
`glossary-steward`, `security-reviewer`) thì gọi qua Task tool như cũ.

Tự động hoá chỉ bỏ thao tác **copy-paste**, KHÔNG bỏ **review của người**: sau mỗi bước Spec Kit vẫn có
[DỪNG] để người dùng xem artifact rồi mới đi tiếp.

Quy ước:
- **[TỰ CHẠY]** = bạn tự làm (git, gọi subagent).
- **[SKILL]** = bạn gọi Skill tool: `skill: "speckit-x"`, `args: "<…>"`. Chạy hết skill, rồi báo artifact.
- **[HANDOFF]** = *fallback* — in lệnh `/speckit-x …` cho người dùng tự dán và chạy, rồi DỪNG chờ xác nhận.
- **[DỪNG]** = checkpoint bắt buộc chờ người dùng review trước khi đi tiếp.

**Khi nào rơi về [HANDOFF]** (với bước đó — các bước sau vẫn thử [SKILL] lại):
- Skill tool báo không tìm thấy `speckit-x` (chưa chạy `bootstrap.sh`, hoặc Spec Kit đổi tên skill — xem
  drift guard của `bootstrap.sh`).
- Skill bị chặn: người dùng từ chối quyền, `settings.json` deny `Skill(...)`, hoặc bản Spec Kit mới đặt
  `disable-model-invocation: true` (Claude Code sẽ chặn và bảo người dùng tự gõ `/speckit-x`).
- Người dùng nói rõ muốn tự chạy lệnh.
Khi rơi về HANDOFF, nói rõ **vì sao** (trích lỗi) rồi in đúng lệnh như mô tả ở từng bước.

**Câu hỏi của skill là của NGƯỜI DÙNG trả lời.** `speckit-specify` (tối đa 3 `[NEEDS CLARIFICATION]`),
`speckit-clarify` (tối đa 5 câu) và `speckit-analyze` (đề xuất remediation) có thể hỏi ngược. Khi đó bạn
chuyển nguyên văn câu hỏi + phương án cho người dùng và DỪNG chờ — **không bao giờ tự chọn đáp án thay họ**
(rule 1 `CLAUDE.md`: không tự chọn 1 bên rồi im lặng).

Sau mỗi bước: báo cáo ngắn — vừa làm gì, artifact ở đâu, bước kế tiếp là gì.

---

1. **[TỰ CHẠY] Nạp memory dự án** (*recall bootstrap* — làm TRƯỚC mọi việc để không lệch ngữ cảnh).
   Đọc và tóm tắt ngắn cho người dùng 5 nguồn memory dạng file (bộ nhớ dài hạn của dự án, xem
   `CLAUDE.md` mục "Memory"):
   - `.specify/memory/constitution.md` — nguyên tắc bất biến (nếu đã có).
   - `docs/00-glossary.md` — thuật ngữ Nhật-Việt-Anh.
   - `docs/04-decisions/INDEX.md` — ambiguity đã chốt (đừng hỏi lại thứ đã có).
   - `docs/05-lessons.md` — gotcha/cạm bẫy đã gặp (đừng lặp lại).
   - `CLAUDE.md` — quy ước dự án.
   File nào chưa tồn tại (dự án mới) → nói rõ "chưa có", không bịa. Mục tiêu: recall là **luôn xảy
   ra**, không phó mặc cho agent tự nhớ đọc — đây chính là tuyến chống *context drift* của TEAM-WORKFLOW.

2. **[TỰ CHẠY] Tạo git branch mới** cho feature: `git checkout -b <NNN>-<feature-slug>`.
   `<NNN>` = **số GitHub issue** của feature, zero-pad tối thiểu 3 chữ số (VD issue #42 →
   `042-user-reservation`). Nếu chưa có issue, DỪNG và yêu cầu người dùng tạo issue trước (dùng
   `Feature` issue template). Số issue là ID toàn cục → tránh trùng khi nhiều người cùng làm.
   Xem `docs/TEAM-WORKFLOW.md`. Spec Kit dùng tên branch để phát hiện feature đang active.

3. **[TỰ CHẠY] Gọi subagent `design-intake`** (qua Task tool) với đường dẫn tài liệu trong
   `docs/01-basic-design/`, `docs/02-detail-design/` và link/node Figma trong `docs/03-ui/`.
   Nó ghi ra `docs/intake/<NNN>-<slug>.md` (khớp tên branch).

4. **[DỪNG]** Hiển thị file intake, đặc biệt mục "Prompt for /speckit-specify" và "Ambiguities".
   Chờ người dùng xác nhận trước khi tiếp tục.

5. **[SKILL + DỪNG] specify** — Gọi Skill tool `speckit-specify` với `args` = **nguyên văn** đoạn
   "Prompt for /speckit-specify" trong file intake (không tóm tắt, không sửa). Xong → báo đường dẫn
   `specs/<…>/spec.md` và DỪNG cho người dùng review spec.
   *Fallback [HANDOFF]:* in `/speckit-specify <đoạn prompt lấy nguyên từ file intake>`, chờ báo `spec.md` xong.

6. **[SKILL — tương tác] clarify** (chỉ khi file intake có "Ambiguities", hoặc spec còn
   `[NEEDS CLARIFICATION]`) — Trước tiên tra `docs/04-decisions/INDEX.md`: câu nào đã có quyết định thì
   đưa luôn quyết định đó vào `args`, không hỏi lại. Gọi Skill tool `speckit-clarify` với `args` = các câu
   hỏi/tiêu điểm còn lại từ mục Ambiguities. Skill sẽ hỏi **từng câu** — chuyển cho người dùng, chờ họ
   trả lời trong chat, đưa câu trả lời lại cho skill; tuyệt đối không tự trả lời.
   Sau khi xong, **[TỰ CHẠY]** ghi câu trả lời vào `docs/04-decisions/<YYYY-MM-DD>-<slug>.md` (được phép
   Write) **và append 1 dòng vào `docs/04-decisions/INDEX.md`** rồi tiếp tục.
   *Fallback [HANDOFF]:* in `/speckit-clarify <các câu hỏi/tiêu điểm lấy từ mục Ambiguities>`.

7. **[SKILL + DỪNG] plan** — Gọi Skill tool `speckit-plan` (`args` = tech stack/constraint lấy từ
   `CLAUDE.md` mục "Tech stack" nếu đã điền, nếu không để trống). Xong → báo `plan.md` (+ `research.md`,
   `data-model.md`, `contracts/` nếu có) và DỪNG cho người dùng review.
   *Fallback [HANDOFF]:* in `/speckit-plan`, chờ `plan.md`.

8. **[SKILL + DỪNG] tasks** — Gọi Skill tool `speckit-tasks`. Xong → báo `tasks.md` và DỪNG cho người
   dùng review.
   *Fallback [HANDOFF]:* in `/speckit-tasks`, chờ `tasks.md`.

9. **[SKILL + DỪNG] analyze** — Gọi Skill tool `speckit-analyze` (read-only, không sửa file). Hiển thị
   **đầy đủ** báo cáo cross-artifact analysis cho người dùng. Nếu có vấn đề, quay lại sửa spec/plan/tasks
   (lặp bước 5–8) **trước khi** sang implement. Không đi tiếp khi analyze còn cảnh báo chưa xử lý.
   **Cổng này cần người dùng nói rõ "OK implement"** — không tự suy ra từ im lặng.
   *Fallback [HANDOFF]:* in `/speckit-analyze`, yêu cầu người dùng dán lại kết quả.

10. **[SKILL] implement** — Chỉ sau khi người dùng duyệt ở bước 9: gọi Skill tool `speckit-implement`.
    Mọi `Edit/Write(src/**)` vẫn đi qua quyền `ask` trong `.claude/settings.json` — người dùng duyệt
    từng thay đổi code như khi tự chạy lệnh. Xong → báo tóm tắt task đã làm/chưa làm.
    *Fallback [HANDOFF]:* in `/speckit-implement`, chờ người dùng báo code đã sinh xong.

11. **[TỰ CHẠY] Gọi subagent `code-reviewer`** (qua Task tool) để đối chiếu code với 4 nguồn
    (constitution, spec, plan, tasks). Mọi mục **Blocking** phải xử lý (thường bằng cách gọi lại
    skill `speckit-implement` với `args` = yêu cầu sửa cụ thể) trước khi sang test gate.

12. **[TỰ CHẠY] Gọi subagent `glossary-steward`** (qua Task tool) để đối chiếu tên biến/field nghiệp
    vụ trong code + spec với `docs/00-glossary.md`. Term lệch → phải sửa rồi mới đi tiếp; term nghiệp
    vụ **mới** → **append thẳng vào `docs/00-glossary.md` ngay trong branch feature** này (CODEOWNERS
    tự kéo steward review phần glossary khi mở PR — đúng rule 5 `CLAUDE.md`). Chỉ khi cần **SỬA / đổi
    tên / xoá** term đã có mới tách **PR glossary riêng** cho steward duyệt. `glossary-steward` là
    read-only: nó chỉ đề xuất, người phụ trách feature append.

13. **[TỰ CHẠY] Gọi subagent `security-reviewer`** (qua Task tool) — chỉ khi feature đụng auth / dữ
    liệu người dùng / API / DB / crypto / thanh toán (nếu không, agent tự in `SKIPPED`). Nó soi
    OWASP + secret + PII, đối chiếu với `docs/04-decisions/` và constitution. Mọi **Blocking** phải
    xử lý (gọi lại skill `speckit-implement` với yêu cầu fix) trước khi sang test gate.

14. **[DỪNG] Test gate** — Format đã tự chạy qua PostToolUse hook (`.claude/hooks/format.sh`) sau mỗi
    Edit/Write, nên test gate chỉ *verify*: chạy `npm run lint`, `npm run test`, `npm run build`
    (hoặc lệnh tương đương của dự án). **Bắt buộc xanh VÀ coverage đạt ngưỡng constitution**
    (Article W — mặc định ≥ 80% business logic) mới đi tiếp; nếu đỏ hoặc coverage dưới ngưỡng, báo
    và dừng — không deploy. (Tuỳ chọn: chạy `git diff --exit-code` sau format để chắc code đã format
    sạch trước commit.) **Trước khi rời bước này**, nếu trong lúc implement phát hiện gotcha/cạm bẫy
    đặc thù dự án → **append 1 dòng vào `docs/05-lessons.md`** để lần sau không vấp lại.

15. **[DỪNG] Deploy** — Đọc mục **"## Deploy"** trong `CLAUDE.md` để lấy phương thức deploy cụ thể
    của dự án (VD: Vercel, CI/CD, container…). Xác nhận build production ok, rồi thực hiện deploy theo
    đúng phương thức đó. Đây là hành động ra bên ngoài — luôn xin xác nhận rõ ràng trước khi chạy.
    Nếu `CLAUDE.md` chưa khai báo phương thức deploy, DỪNG và hỏi người dùng.

Không tự ý bỏ qua bước [DỪNG] dù người dùng có vẻ vội — luôn chờ xác nhận rõ ràng. Không bao giờ
giả vờ đã chạy một skill/lệnh `/speckit-*`: nếu Skill tool lỗi hoặc bị từ chối, nói thật và rơi về
[HANDOFF]. Không tự tái hiện nội dung skill bằng tay để "lách" khi skill bị chặn.
