# `/design-to-code` tự gọi skill Spec Kit qua Skill tool, HANDOFF chỉ còn là fallback
- Ngày: 2026-10-31
- Feature liên quan: template (issue #27 — `[research] Reduce manual HANDOFF steps in /design-to-code`)
- Câu hỏi gốc: Runbook `/design-to-code` có tự gọi được các bước Spec Kit (`specify`, `clarify`, `plan`,
  `tasks`, `analyze`, `implement`) không, hay bắt buộc người dùng copy-paste lệnh `/speckit-*` khoảng 7 lần
  mỗi feature như hiện tại?
- Quyết định: **Gọi được — chuyển sang [SKILL].** Runbook gọi Skill tool (`skill: "speckit-x"`, `args: …`)
  cho cả 6 bước. Giữ nguyên các cổng người:
  - [DỪNG] review sau specify, plan, tasks; cổng analyze cần người dùng nói rõ "OK implement".
  - clarify vẫn **tương tác**: skill hỏi, runbook chuyển câu hỏi cho người dùng, không tự trả lời.
  - implement: `Skill(speckit-implement)` để ở `ask`, và `Edit/Write(src/**)` vẫn ở `ask` trong
    `.claude/settings.json`.
  - [HANDOFF] giữ làm **fallback** khi skill không tồn tại / bị chặn / người dùng muốn tự chạy.
  - `settings.json` allow `Skill(speckit-{specify,clarify,plan,tasks,analyze})` để khỏi hỏi quyền mỗi bước.
- Người quyết định: (steward template — duyệt qua PR đóng #27)

## Bằng chứng (kiểm chứng ngày 2026-10-31)

**1. Frontmatter skill do Spec Kit sinh KHÔNG chặn model invocation.** Cài vào thư mục scratch đúng như
`bootstrap.sh` (`uvx --from git+https://github.com/github/spec-kit.git@main specify init . --force
--integration claude`) → Specify CLI **1.2.6.dev0**, `github/spec-kit@7370e59` (main). Cả 10 skill
`.claude/skills/speckit-*/SKILL.md` đều khai báo tường minh:

```yaml
user-invocable: true
disable-model-invocation: false
```

Không skill nào có `allowed-tools` (không cấp/thu quyền gì thêm — quyền vẫn theo `settings.json`).
Chính Spec Kit cũng thiết kế để agent tự gọi skill: phần *Extension Hooks* trong mỗi SKILL.md ghi
agent "MUST actually invoke the hook" và "a skills-mode agent runs it as `/skill:speckit-...`".

**2. Tài liệu Claude Code** — <https://code.claude.com/docs/en/skills>:
- "Custom commands have been merged into skills" — `.claude/commands/design-to-code.md` chạy y như một skill.
- "By default, Claude can invoke any skill that doesn't have `disable-model-invocation: true` set."
- `disable-model-invocation: true` → "Claude can't invoke the skill on its own" (chặn cứng, Claude Code
  bảo người dùng tự gõ `/name`) — đây là điều kiện rơi về HANDOFF.
- Quyền: `Skill(name)` khớp chính xác, `Skill(name *)` khớp kèm tham số; có thể deny `Skill` toàn cục.
- Câu cũ trong `CLAUDE.md` "Claude Code không cho command gọi command" chỉ đúng với việc *gõ slash
  command* thay người dùng — không áp dụng cho Skill tool.

**3. Prototype chạy thật.** Claude Code **2.1.308**, thư mục scratch ở trên, một command thử
`.claude/commands/proto.md` dặn "dùng Skill tool gọi `speckit-specify`":

```text
claude -p "/proto" --model sonnet --permission-mode acceptEdits \
  --allowedTools "Bash Read Write Edit Glob Grep Skill" --output-format stream-json
TOOL Skill {"skill": "speckit-specify", "args": "A minimal todo list: ..."}
RES  Launching skill: speckit-specify
→ specs/001-todo-list/spec.md + checklists/requirements.md   (5 turns, ~0.51 USD, exit 0)
```

## Rủi ro & cách chặn
| Rủi ro | Chặn bằng |
|---|---|
| Bản Spec Kit sau đặt `disable-model-invocation: true` | Runbook rơi về [HANDOFF], nói rõ lý do; drift guard trong `bootstrap.sh` |
| Agent tự trả lời câu hỏi của specify/clarify | Runbook cấm rõ: chuyển câu hỏi cho người dùng, DỪNG chờ |
| implement chạy mà chưa duyệt analyze | Cổng bước 9 cần "OK implement" + `Skill(speckit-implement)` ở `ask` |
| Lách skill bị chặn bằng cách tự chép nội dung skill | Runbook cấm rõ; Claude Code cũng chặn và nhắc không tái hiện |

---
Nguồn: issue #27 · runbook [`.claude/commands/design-to-code.md`](../../.claude/commands/design-to-code.md)
