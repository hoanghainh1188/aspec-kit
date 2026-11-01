// `aspec-kit hook` — install & manage Git pre-commit quality guardrail hook.
// Zero dependencies. Validates glossary, blocks conflict markers, guards docs/01-03,
// and runs format.sh on staged code files.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

export const HOOK_PATH = ".git/hooks/pre-commit";
export const HOOK_MARKER = "# aspec-kit pre-commit hook";
export const HOOK_START_TAG = "# BEGIN ASPEC_KIT_HOOK";
export const HOOK_END_TAG = "# END ASPEC_KIT_HOOK";

const isColorSupported =
  !process.env.NO_COLOR &&
  (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);
const GREEN = isColorSupported ? "\x1b[32m" : "";
const YELLOW = isColorSupported ? "\x1b[33m" : "";
const RED = isColorSupported ? "\x1b[31m" : "";
const BOLD = isColorSupported ? "\x1b[1m" : "";
const RESET = isColorSupported ? "\x1b[0m" : "";

const HELP_TEXT = `Usage:
  npx @hoanghainh/aspec-kit hook [install|uninstall|status] [project-dir]

Commands:
  install [dir]       Install Git pre-commit quality guardrail hook (default)
  uninstall [dir]     Remove or unlink aspec-kit pre-commit hook
  status [dir]        Check if pre-commit hook is installed and active

Options:
  -h, --help          Display this help message

Guardrails enforced by the pre-commit hook:
  1. Blocks unresolved merge conflict markers (<<<<<<< / >>>>>>>)
  2. Protects upstream client design documents (docs/01-03) from accidental edits
  3. Validates glossary consistency (docs/00-glossary.md)
  4. Runs .claude/hooks/format.sh on staged files if configured
`;

/** Generate the bash content of the aspec-kit pre-commit hook. */
export function buildPreCommitHookScript() {
  return [
    "#!/usr/bin/env bash",
    HOOK_MARKER + " — Git quality guardrails",
    "# Installed by `aspec-kit hook install`",
    "set -euo pipefail",
    "",
    "# 1. Block unresolved merge conflict markers in staged files",
    "STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM || true)",
    'if [ -n "$STAGED_FILES" ]; then',
    "  for file in $STAGED_FILES; do",
    '    [ -f "$file" ] || continue',
    '    case "$file" in',
    "      *.png|*.jpg|*.jpeg|*.gif|*.ico|*.pdf|*.xlsx|*.xlsm|*.cast) continue ;;",
    "    esac",
    "    if grep -nE '^(<<<<<<<|>>>>>>>)( |$)' \"$file\" > /dev/null 2>&1; then",
    '      echo "❌ [aspec-kit pre-commit] Unresolved merge conflict marker found in: $file"',
    '      echo "   Please resolve all conflict markers (<<<<<<< / >>>>>>>) before committing."',
    "      exit 1",
    "    fi",
    "  done",
    "fi",
    "",
    "# 2. Guard protected upstream client design directories (docs/01-03)",
    "MODIFIED_CLIENT_DOCS=$(git diff --cached --name-only --diff-filter=M | grep -E '^docs/(01-basic-design|02-detail-design|03-ui)/' || true)",
    'if [ -n "$MODIFIED_CLIENT_DOCS" ]; then',
    '  echo "⚠️  [aspec-kit pre-commit] Notice: Modifying existing upstream client design files:"',
    '  echo "$MODIFIED_CLIENT_DOCS" | sed \'s/^/   - /\'',
    '  echo "   Reminder: Client design documents are Single Source of Truth."',
    '  echo "   When client delivers revisions, add new files and record in CHANGELOG.md rather than overwriting."',
    "fi",
    "",
    "# 3. Validate glossary consistency (docs/00-glossary.md)",
    'if echo "$STAGED_FILES" | grep -q \'docs/00-glossary.md\'; then',
    "  if [ -f .github/scripts/check-template.py ]; then",
    "    python3 .github/scripts/check-template.py > /dev/null || {",
    '      echo "❌ [aspec-kit pre-commit] Glossary validation failed in docs/00-glossary.md!"',
    "      python3 .github/scripts/check-template.py",
    "      exit 1",
    "    }",
    "  fi",
    "fi",
    "",
    "# 4. Run format hook on staged code files if configured",
    "if [ -x .claude/hooks/format.sh ]; then",
    "  for file in $STAGED_FILES; do",
    '    [ -f "$file" ] || continue',
    '    case "$file" in',
    "      *.ts|*.js|*.mjs|*.cjs|*.jsx|*.tsx|*.py|*.go|*.java|*.kt)",
    '        echo "{\\"tool_input\\": {\\"file_path\\": \\"$file\\"}}" | .claude/hooks/format.sh 2>/dev/null || true',
    '        git add "$file" 2>/dev/null || true',
    "        ;;",
    "    esac",
    "  done",
    "fi",
    "",
    "exit 0",
    "",
  ].join("\n");
}

/** Install the pre-commit hook into targetDir/.git/hooks/pre-commit. */
export function installHook(targetDir = process.cwd()) {
  const gitDir = path.join(targetDir, ".git");
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    throw new Error(`Target directory "${targetDir}" is not a git repository (missing .git).`);
  }
  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookFile = path.join(hooksDir, "pre-commit");
  const scriptContent = buildPreCommitHookScript();

  if (!fs.existsSync(hookFile)) {
    fs.writeFileSync(hookFile, scriptContent, "utf-8");
    fs.chmodSync(hookFile, 0o755);
    return { action: "installed", path: hookFile };
  }

  const existing = fs.readFileSync(hookFile, "utf-8");
  if (existing.includes(HOOK_MARKER)) {
    // Already standalone or contains marker — refresh script
    fs.writeFileSync(hookFile, scriptContent, "utf-8");
    fs.chmodSync(hookFile, 0o755);
    return { action: "updated", path: hookFile };
  }

  // Existing custom hook from user: append wrapped block
  const block = `\n${HOOK_START_TAG}\n${scriptContent}\n${HOOK_END_TAG}\n`;
  fs.writeFileSync(hookFile, existing + block, "utf-8");
  fs.chmodSync(hookFile, 0o755);
  return { action: "appended", path: hookFile };
}

/** Remove the aspec-kit pre-commit hook from targetDir/.git/hooks/pre-commit. */
export function uninstallHook(targetDir = process.cwd()) {
  const hookFile = path.join(targetDir, HOOK_PATH);
  if (!fs.existsSync(hookFile)) {
    return { action: "not_installed", path: hookFile };
  }

  const existing = fs.readFileSync(hookFile, "utf-8");
  if (!existing.includes(HOOK_MARKER) && !existing.includes(HOOK_START_TAG)) {
    return { action: "not_installed", path: hookFile };
  }

  // If it's a standalone aspec-kit hook, remove the file
  if (existing.startsWith("#!/usr/bin/env bash\n" + HOOK_MARKER) && !existing.includes(HOOK_START_TAG)) {
    fs.unlinkSync(hookFile);
    return { action: "removed", path: hookFile };
  }

  // Otherwise, remove the wrapped block
  const blockRe = new RegExp(`\\r?\\n${HOOK_START_TAG}[\\s\\S]*?${HOOK_END_TAG}\\r?\\n`, "g");
  const cleaned = existing.replace(blockRe, "\n").trim();
  if (!cleaned || cleaned === "#!/usr/bin/env bash") {
    fs.unlinkSync(hookFile);
    return { action: "removed", path: hookFile };
  }

  fs.writeFileSync(hookFile, `${cleaned}\n`, "utf-8");
  return { action: "unlinked_block", path: hookFile };
}

/** Check whether the pre-commit hook is installed. */
export function checkHookStatus(targetDir = process.cwd()) {
  const hookFile = path.join(targetDir, HOOK_PATH);
  if (!fs.existsSync(hookFile)) {
    return { installed: false, path: hookFile, reason: "file missing" };
  }
  const content = fs.readFileSync(hookFile, "utf-8");
  const installed = content.includes(HOOK_MARKER) || content.includes(HOOK_START_TAG);
  return {
    installed,
    path: hookFile,
    reason: installed ? "installed & active" : "custom hook without aspec-kit guardrails",
  };
}

/** CLI entry point for `aspec-kit hook [subcommand] [dir]`. Returns exit code. */
export function runHook(argv = process.argv.slice(3)) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`${RED}❌ Error:${RESET} ${err.message}\nRun with --help to see available options.`);
    return 1;
  }

  if (parsed.values.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  const sub = parsed.positionals[0] ?? "install";
  const validSubs = ["install", "uninstall", "status"];
  let command = "install";
  let targetDir = process.cwd();

  if (validSubs.includes(sub)) {
    command = sub;
    if (parsed.positionals[1]) targetDir = path.resolve(process.cwd(), parsed.positionals[1]);
  } else {
    // Argument was a directory (e.g. `aspec-kit hook my-dir`)
    targetDir = path.resolve(process.cwd(), sub);
  }

  try {
    if (command === "install") {
      const res = installHook(targetDir);
      console.log(`${GREEN}✓${RESET} Git pre-commit hook ${BOLD}${res.action}${RESET} in ${res.path}`);
      console.log(`  Guardrails active: conflict detector, client docs protect, glossary validator, format-on-save`);
      return 0;
    }
    if (command === "uninstall") {
      const res = uninstallHook(targetDir);
      if (res.action === "not_installed") {
        console.log(`${YELLOW}ℹ${RESET} No aspec-kit pre-commit hook was found in ${res.path}`);
      } else {
        console.log(`${GREEN}✓${RESET} aspec-kit pre-commit hook successfully ${BOLD}${res.action}${RESET}`);
      }
      return 0;
    }
    if (command === "status") {
      const res = checkHookStatus(targetDir);
      if (res.installed) {
        console.log(`${GREEN}✓${RESET} Pre-commit hook is ${BOLD}active${RESET} (${res.path})`);
      } else {
        console.log(`${YELLOW}⚠${RESET} Pre-commit hook is ${BOLD}not installed${RESET} (${res.reason})`);
        console.log(`  Run: ${BOLD}npx @hoanghainh/aspec-kit hook install${RESET} to enable`);
      }
      return res.installed ? 0 : 1;
    }
  } catch (err) {
    console.error(`${RED}❌ Error:${RESET} ${err.message}`);
    return 1;
  }

  return 0;
}
