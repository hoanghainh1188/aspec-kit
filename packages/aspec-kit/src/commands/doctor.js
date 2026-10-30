// `aspec-kit doctor` — environment & guardrail health check for a scaffolded project.
// Zero dependencies. Every side effect (command execution, PATH lookup, home dir) is injectable
// so the checks can be unit-tested without touching the real machine or the network.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

export const STATUS = Object.freeze({ OK: "ok", WARN: "warn", FAIL: "fail", SKIP: "skip" });

// Same list as the drift guard in bootstrap.sh — the runbook assumes these skills exist.
export const BOOTSTRAP_SKILLS = Object.freeze([
  "constitution",
  "specify",
  "clarify",
  "plan",
  "tasks",
  "analyze",
  "implement",
]);

const CODEOWNERS_PLACEHOLDER = "@your-lead-handle";
const RUNBOOK_PATH = ".claude/commands/design-to-code.md";
const FORMAT_HOOK_PATH = ".claude/hooks/format.sh";

const HELP_TEXT = `Usage:
  npx @hoanghainh/aspec-kit doctor [project-directory] [options]

Checks the environment and guardrails of an aspec-kit project:
  - tools: git, uv/pipx, python3, Claude Code CLI, Figma MCP (optional)
  - .specify/ present and every /speckit-* skill used by /design-to-code installed
  - .github/CODEOWNERS placeholder replaced, .claude/hooks/format.sh configured
  - branch protection on 'main' (via 'gh api', only when gh is installed and authenticated)

Options:
  --json                 Print the report as JSON
  -h, --help             Display this help message

Exit code: 1 when any check fails, 0 otherwise (warnings do not fail).
`;

const check = (id, title, status, message, hint = null) => ({ id, title, status, message, hint });

// ─────────────────────────────────────────────────────────────────────────────
// Default (real) environment
// ─────────────────────────────────────────────────────────────────────────────

/** Run a command without a shell. Never throws. */
export function defaultRun(cmd, args, { cwd } = {}) {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf-8", timeout: 15000 });
  return {
    status: res.error ? null : res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? (res.error ? res.error.message : ""),
  };
}

/** PATH lookup (no shell, cross-platform). */
export function makeHasCommand(env = process.env, platform = process.platform) {
  const dirs = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts =
    platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").concat("") : [""];
  return (cmd) =>
    dirs.some((dir) =>
      exts.some((ext) => {
        try {
          const p = path.join(dir, cmd + ext);
          return fs.statSync(p).isFile() && (platform === "win32" || (fs.statSync(p).mode & 0o111) !== 0);
        } catch {
          return false;
        }
      })
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual checks
// ─────────────────────────────────────────────────────────────────────────────

export function checkTools({ hasCommand }) {
  const out = [];
  out.push(
    hasCommand("git")
      ? check("tool.git", "git", STATUS.OK, "found")
      : check("tool.git", "git", STATUS.FAIL, "not found", "Install git: https://git-scm.com/downloads")
  );

  const uv = hasCommand("uvx") || hasCommand("uv");
  const pipx = hasCommand("pipx");
  out.push(
    uv || pipx
      ? check("tool.uv", "uv / pipx", STATUS.OK, uv ? "uv found" : "pipx found")
      : check(
          "tool.uv",
          "uv / pipx",
          STATUS.FAIL,
          "neither uv nor pipx found (needed to install Spec Kit)",
          "Install uv: https://github.com/astral-sh/uv#installation"
        )
  );

  out.push(
    hasCommand("python3")
      ? check("tool.python3", "python3", STATUS.OK, "found")
      : check(
          "tool.python3",
          "python3",
          STATUS.WARN,
          "not found — bootstrap.sh cannot set feature_numbering=timestamp",
          'Install Python 3, or set "feature_numbering": "timestamp" in .specify/init-options.json by hand'
        )
  );

  out.push(
    hasCommand("claude")
      ? check("tool.claude", "Claude Code CLI", STATUS.OK, "found")
      : check(
          "tool.claude",
          "Claude Code CLI",
          STATUS.FAIL,
          "'claude' not found on PATH",
          "Install Claude Code: npm install -g @anthropic-ai/claude-code"
        )
  );
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

const hasFigmaServer = (servers) =>
  Boolean(servers) && typeof servers === "object" && Object.keys(servers).some((k) => /figma/i.test(k));

/** Optional: look for a Figma MCP server in project .mcp.json or the user's ~/.claude.json. */
export function checkFigmaMcp({ cwd, homeDir }) {
  const project = readJson(path.join(cwd, ".mcp.json"));
  const user = readJson(path.join(homeDir, ".claude.json"));
  const found =
    hasFigmaServer(project?.mcpServers) ||
    hasFigmaServer(user?.mcpServers) ||
    hasFigmaServer(user?.projects?.[cwd]?.mcpServers);
  return found
    ? check("tool.figma-mcp", "Figma MCP (optional)", STATUS.OK, "configured")
    : check(
        "tool.figma-mcp",
        "Figma MCP (optional)",
        STATUS.WARN,
        "not detected in .mcp.json or ~/.claude.json (a claude.ai Figma connector cannot be detected locally)",
        "Optional: claude mcp add figma … — without it design-intake falls back to docs/03-ui/ snapshots"
      );
}

/** Skill names referenced as /speckit-<name> in the runbook (placeholders like /speckit-x ignored). */
export function referencedSkills(runbookText) {
  const names = new Set();
  for (const m of runbookText.matchAll(/\/speckit-([a-z]{2,})\b/g)) names.add(m[1]);
  return [...names];
}

export function checkSpecKit({ cwd }) {
  const out = [];
  if (!fs.existsSync(path.join(cwd, ".specify"))) {
    out.push(
      check(
        "speckit.specify-dir",
        ".specify/",
        STATUS.FAIL,
        "missing — Spec Kit is not initialized",
        "Run: bash bootstrap.sh"
      )
    );
    return out;
  }
  out.push(check("speckit.specify-dir", ".specify/", STATUS.OK, "present"));

  const runbook = path.join(cwd, RUNBOOK_PATH);
  let fromRunbook = [];
  if (fs.existsSync(runbook)) {
    fromRunbook = referencedSkills(fs.readFileSync(runbook, "utf-8"));
  } else {
    out.push(
      check("speckit.runbook", RUNBOOK_PATH, STATUS.WARN, "missing — falling back to bootstrap.sh skill list")
    );
  }
  const required = [...new Set([...BOOTSTRAP_SKILLS, ...fromRunbook])];
  const missing = required.filter((s) => !fs.existsSync(path.join(cwd, ".claude/skills", `speckit-${s}`)));
  out.push(
    missing.length === 0
      ? check("speckit.skills", "/speckit-* skills", STATUS.OK, `all ${required.length} present`)
      : check(
          "speckit.skills",
          "/speckit-* skills",
          STATUS.FAIL,
          `missing in .claude/skills/: ${missing.map((s) => `speckit-${s}`).join(", ")}`,
          "Re-run bash bootstrap.sh; if Spec Kit renamed its skills, update /speckit-* names in " +
            `${RUNBOOK_PATH}, README.md, CLAUDE.md and docs/*`
        )
  );
  return out;
}

export function checkCodeowners({ cwd }) {
  const file = path.join(cwd, ".github/CODEOWNERS");
  if (!fs.existsSync(file)) {
    return check(
      "guard.codeowners",
      ".github/CODEOWNERS",
      STATUS.FAIL,
      "missing — shared files (glossary, constitution, design docs) are not gated",
      "Restore .github/CODEOWNERS from the template and set the steward handle"
    );
  }
  const effective = fs
    .readFileSync(file, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  return effective.some((l) => l.includes(CODEOWNERS_PLACEHOLDER))
    ? check(
        "guard.codeowners",
        ".github/CODEOWNERS",
        STATUS.FAIL,
        `placeholder ${CODEOWNERS_PLACEHOLDER} not replaced`,
        `Replace ${CODEOWNERS_PLACEHOLDER} with the real steward handle (e.g. @lead)`
      )
    : check("guard.codeowners", ".github/CODEOWNERS", STATUS.OK, "steward configured");
}

/** format.sh is "configured" when it runs something other than the template's bare `exit 0`. */
export function isFormatHookConfigured(content) {
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .some((l) => !/^exit\s+0\b/.test(l));
}

export function checkFormatHook({ cwd }) {
  const file = path.join(cwd, FORMAT_HOOK_PATH);
  if (!fs.existsSync(file)) {
    return check(
      "guard.format-hook",
      FORMAT_HOOK_PATH,
      STATUS.WARN,
      "missing — no format-on-save",
      "Restore .claude/hooks/format.sh from the template and add your formatter"
    );
  }
  return isFormatHookConfigured(fs.readFileSync(file, "utf-8"))
    ? check("guard.format-hook", FORMAT_HOOK_PATH, STATUS.OK, "formatter configured")
    : check(
        "guard.format-hook",
        FORMAT_HOOK_PATH,
        STATUS.WARN,
        "no formatter configured (template no-op)",
        "Add your stack's formatter (prettier / gofmt / black …) and remove the default `exit 0`"
      );
}

export function checkBranchProtection({ cwd, run, hasCommand }) {
  const id = "guard.branch-protection";
  const title = "branch protection (main)";
  if (!hasCommand("gh")) {
    return check(id, title, STATUS.SKIP, "skipped — GitHub CLI (gh) not installed", "Install gh to enable this check");
  }
  if (run("gh", ["auth", "status"], { cwd }).status !== 0) {
    return check(id, title, STATUS.SKIP, "skipped — gh is not authenticated", "Run: gh auth login");
  }
  const res = run("gh", ["api", "repos/{owner}/{repo}/branches/main/protection"], { cwd });
  if (res.status === 0) {
    let data;
    try {
      data = JSON.parse(res.stdout);
    } catch {
      return check(id, title, STATUS.SKIP, "skipped — unexpected response from gh api");
    }
    const reviews = data?.required_pull_request_reviews;
    const missing = [];
    if (!reviews) missing.push("Require a pull request");
    else if (!reviews.require_code_owner_reviews) missing.push("Require review from Code Owners");
    if (!data?.required_status_checks) missing.push("Require status checks");
    return missing.length === 0
      ? check(id, title, STATUS.OK, "PR + Code Owners review + status checks required")
      : check(
          id,
          title,
          STATUS.WARN,
          `enabled, but missing: ${missing.join(", ")}`,
          "Settings → Branches → main (see docs/TEAM-WORKFLOW.md section 9)"
        );
  }
  const err = `${res.stderr}\n${res.stdout}`;
  if (/Branch not protected/i.test(err)) {
    return check(
      id,
      title,
      STATUS.FAIL,
      "main is not protected — CODEOWNERS is only advisory",
      "Settings → Branches → main: require PR + Code Owners review + status checks (docs/PRODUCTION-READINESS.md)"
    );
  }
  if (/HTTP 403|Upgrade to GitHub Pro|make this repository public/i.test(err)) {
    return check(
      id,
      title,
      STATUS.WARN,
      "cannot read branch protection (no admin access, or plan does not support it)",
      "Ask a repo admin to verify Settings → Branches → main"
    );
  }
  return check(
    id,
    title,
    STATUS.SKIP,
    "skipped — could not query GitHub (no remote, no 'main' branch, or no access)",
    "Push the repository to GitHub and re-run doctor"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration & output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run all checks. Returns { cwd, ok, summary, checks }.
 * @param {{ cwd?: string, run?: Function, hasCommand?: Function, homeDir?: string }} deps
 */
export function runDoctor(deps = {}) {
  const ctx = {
    cwd: path.resolve(deps.cwd ?? process.cwd()),
    run: deps.run ?? defaultRun,
    hasCommand: deps.hasCommand ?? makeHasCommand(),
    homeDir: deps.homeDir ?? os.homedir(),
  };
  const checks = [
    ...checkTools(ctx),
    checkFigmaMcp(ctx),
    ...checkSpecKit(ctx),
    checkCodeowners(ctx),
    checkFormatHook(ctx),
    checkBranchProtection(ctx),
  ];
  const summary = Object.fromEntries(
    Object.values(STATUS).map((s) => [s, checks.filter((c) => c.status === s).length])
  );
  return { cwd: ctx.cwd, ok: summary.fail === 0, summary, checks };
}

export function formatReport(report, { color = false } = {}) {
  const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const icon = {
    ok: paint(32, "✓"),
    warn: paint(33, "⚠"),
    fail: paint(31, "✗"),
    skip: paint(2, "–"),
  };
  const lines = [`aspec-kit doctor — ${report.cwd}`, ""];
  for (const c of report.checks) {
    lines.push(`${icon[c.status]} ${c.title}: ${c.message}`);
    if (c.hint && c.status !== STATUS.OK) lines.push(paint(2, `    → ${c.hint}`));
  }
  const { ok, warn, fail, skip } = report.summary;
  lines.push("", `${ok} ok · ${warn} warn · ${fail} fail · ${skip} skipped`);
  return lines.join("\n");
}

/** CLI entry for `aspec-kit doctor [dir] [--json]`. Returns the exit code. */
export function doctorCommand(argv, { stdout = process.stdout, ...deps } = {}) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: { json: { type: "boolean" }, help: { type: "boolean", short: "h" } },
  });
  if (values.help) {
    stdout.write(HELP_TEXT);
    return 0;
  }
  if (positionals.length > 1) {
    throw new Error(`Unexpected arguments: ${positionals.slice(1).join(" ")}`);
  }
  const cwd = path.resolve(deps.cwd ?? process.cwd(), positionals[0] ?? ".");
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    throw new Error(`Not a directory: ${cwd}`);
  }
  const report = runDoctor({ ...deps, cwd });
  const color = !values.json && !process.env.NO_COLOR && Boolean(stdout.isTTY);
  stdout.write(values.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report, { color })}\n`);
  return report.ok ? 0 : 1;
}
