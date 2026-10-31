// Multi-agent support (`--agent claude|gemini|copilot|cursor`):
// Keeps `CLAUDE.md` as the Single Source of Truth and generates equivalent instruction
// files (`GEMINI.md`, `.github/copilot-instructions.md`, `AGENTS.md` + `.cursorrules`)
// with graceful degradation guidance for subagents and slash commands.
import fs from "node:fs";
import path from "node:path";

export const SUPPORTED_AGENTS = Object.freeze(["claude", "gemini", "copilot", "cursor"]);
export const DEFAULT_AGENTS = Object.freeze(["claude"]);

export const AGENT_METADATA = Object.freeze({
  claude: Object.freeze({
    id: "claude",
    label: "Claude Code",
    files: Object.freeze([]), // CLAUDE.md is always kept as the canonical source
  }),
  gemini: Object.freeze({
    id: "gemini",
    label: "Gemini CLI",
    files: Object.freeze(["GEMINI.md"]),
  }),
  copilot: Object.freeze({
    id: "copilot",
    label: "GitHub Copilot",
    files: Object.freeze([".github/copilot-instructions.md"]),
  }),
  cursor: Object.freeze({
    id: "cursor",
    label: "Cursor / Agents",
    files: Object.freeze(["AGENTS.md", ".cursorrules"]),
  }),
});

/**
 * Parse and validate `--agent` value(s). Accepts a string or array of strings
 * (comma-separated or repeated flags), e.g. `["claude,gemini"]` or `["gemini", "copilot"]`.
 * Returns a deduplicated array of agent IDs in canonical order.
 */
export function normalizeAgents(raw, ErrorClass = Error) {
  const inputs = Array.isArray(raw) ? raw : [raw];
  const tokens = inputs
    .flatMap((item) => String(item ?? "").split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new ErrorClass(
      `Invalid --agent value. Expected one or more of: ${SUPPORTED_AGENTS.join(", ")}.`
    );
  }

  for (const token of tokens) {
    if (!SUPPORTED_AGENTS.includes(token)) {
      throw new ErrorClass(
        `Invalid --agent "${token}". Expected one or more of: ${SUPPORTED_AGENTS.join(", ")}.`
      );
    }
  }

  // Deduplicate while preserving SUPPORTED_AGENTS order
  return SUPPORTED_AGENTS.filter((a) => tokens.includes(a));
}

const DEGRADATION_SECTION = `
---

## Multi-Agent Compatibility & Graceful Degradation

> **Single Source of Truth:** \`CLAUDE.md\` is the canonical project convention file. This file is
> synchronized from \`CLAUDE.md\` by \`aspec-kit\` so your AI coding agent shares the exact same rules.

### Subagents & Commands Without Native Claude Code Subagent Support

In Claude Code, \`.claude/agents/*.md\` run as isolated subagents via the \`Task\` tool and \`.claude/commands/*.md\`
run as slash commands. On agents that do not natively execute \`.claude/agents/*.md\` subagents (such as Gemini CLI,
GitHub Copilot, or Cursor), **degrade gracefully** by using those files directly as **reference prompt playbooks**:

- **Design Intake**: Read \`.claude/agents/design-intake.md\` and follow its step-by-step instructions to generate \`docs/intake/<NNN>-<slug>.md\`.
- **Code Review**: Read \`.claude/agents/code-reviewer.md\` to cross-check implementation against \`.specify/memory/constitution.md\`, \`spec.md\`, \`plan.md\`, and \`tasks.md\`.
- **Glossary Audit**: Read \`.claude/agents/glossary-steward.md\` to verify domain identifiers against \`docs/00-glossary.md\`.
- **Security Audit**: Read \`.claude/agents/security-reviewer.md\` to run the OWASP / secret / PII checklist before the test gate.
- **Specification Change (仕様変更)**: Read \`.claude/commands/design-change.md\` and \`.claude/agents/impact-analyzer.md\` to produce \`docs/changes/<YYYY-MM-DD>-<slug>.md\`.
- **Client Q&A Sheet (質問票)**: Read \`.claude/commands/qa-sheet.md\` and run \`python3 .claude/scripts/qa_sheet.py\` for deterministic CSV/ingest operations.
- **Orchestration Runbook**: Read \`.claude/commands/design-to-code.md\` and execute each checkpoint sequentially, pausing for human review at every **[PAUSE]** / **[DỪNG]** gate.
`;

/**
 * Rewrite relative markdown links when an instruction file lives in a subdirectory
 * (e.g., `.github/copilot-instructions.md` needs `../docs/...` instead of `docs/...`).
 */
function adjustRelativeLinks(markdown, relTargetPath) {
  const dir = path.posix.dirname(relTargetPath);
  if (!dir || dir === ".") return markdown;
  const prefix = dir
    .split("/")
    .filter(Boolean)
    .map(() => "..")
    .join("/");
  return markdown.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (full, text, href) => {
    const trimmed = href.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("<") ||
      trimmed.startsWith("/")
    ) {
      return full;
    }
    return `[${text}](${prefix}/${trimmed})`;
  });
}

/** Build the instruction file content for a target relative path from `CLAUDE.md` content. */
export function buildAgentInstructionContent(claudeMdContent, relTargetPath) {
  const adjusted = adjustRelativeLinks(claudeMdContent.trimEnd(), relTargetPath);
  return `${adjusted}\n${DEGRADATION_SECTION}`;
}

/** Update `SPEC_KIT_INTEGRATION` default in `bootstrap.sh` content. */
export function transformBootstrapAgents(bootstrapContent, agents) {
  if (!Array.isArray(agents) || agents.length === 0) return bootstrapContent;
  const integrationValue = agents.join(",");
  return bootstrapContent.replace(
    /SPEC_KIT_INTEGRATION="\$\{SPEC_KIT_INTEGRATION:-[^}]*\}"/,
    `SPEC_KIT_INTEGRATION="\${SPEC_KIT_INTEGRATION:-${integrationValue}}"`
  );
}

/** List all extra instruction files generated for a given list of agents. */
export function listAgentInstructionFiles(agents) {
  if (!Array.isArray(agents)) return [];
  const files = new Set();
  for (const agent of agents) {
    const meta = AGENT_METADATA[agent];
    if (!meta) continue;
    for (const rel of meta.files) files.add(rel);
  }
  return [...files].sort();
}

/**
 * Generate multi-agent instruction files from `<targetDir>/CLAUDE.md` and update `bootstrap.sh`.
 * Respects `force`: existing user files that were not created by this CLI run are not overwritten
 * unless `force` is true.
 * Returns the list of relative POSIX paths created or updated.
 */
export function applyAgents(targetDir, agents, ownedFiles, { force = false } = {}) {
  if (!Array.isArray(agents) || agents.length === 0) return [];
  const claudePath = path.join(targetDir, "CLAUDE.md");
  if (!fs.existsSync(claudePath)) return [];
  const claudeContent = fs.readFileSync(claudePath, "utf-8");

  const written = [];
  for (const rel of listAgentInstructionFiles(agents)) {
    const dest = path.join(targetDir, rel);
    if (fs.existsSync(dest) && !ownedFiles.has(rel) && !force) {
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buildAgentInstructionContent(claudeContent, rel), "utf-8");
    ownedFiles.add(rel);
    written.push(rel);
  }

  const bootstrapRel = "bootstrap.sh";
  if (ownedFiles.has(bootstrapRel)) {
    const bootstrapPath = path.join(targetDir, bootstrapRel);
    const current = fs.readFileSync(bootstrapPath, "utf-8");
    const updated = transformBootstrapAgents(current, agents);
    if (updated !== current) {
      fs.writeFileSync(bootstrapPath, updated, "utf-8");
      if (!written.includes(bootstrapRel)) written.push(bootstrapRel);
    }
  }

  return written;
}
