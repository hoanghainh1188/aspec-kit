// Stack presets for `--stack ts|python|go|java` — configures `.claude/hooks/format.sh`,
// `.claude/settings.json` allow/ask entries, and the `## Tech stack` section of `CLAUDE.md`.
import fs from "node:fs";
import path from "node:path";

export const SUPPORTED_STACKS = Object.freeze(["ts", "python", "go", "java"]);

// Default npm entries shipped in the template's `.claude/settings.json`
const TEMPLATE_NPM_ALLOW = Object.freeze([
  "Bash(npm run lint)",
  "Bash(npm run test *)",
  "Bash(npm run build)",
]);
const TEMPLATE_NPM_ASK = Object.freeze(["Bash(npm install *)"]);

// Placeholder inside `CLAUDE.md` (and localized variants) under `## Tech stack`
const TECH_STACK_PLACEHOLDER_RE =
  /^(## Tech stack\r?\n)<[^\r\n]+(?:\r?\n[^\r\n>]+)*>/m;

export const STACK_CONFIGS = Object.freeze({
  ts: Object.freeze({
    id: "ts",
    label: "TypeScript / Node.js",
    formatCmd: 'npx --no-install prettier --write "$FILE"',
    allow: Object.freeze([
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Bash(npm run build)",
    ]),
    ask: Object.freeze(["Bash(npm install *)"]),
    techStackSection: [
      "- **Language / Runtime**: TypeScript / Node.js",
      "- **Formatter (PostToolUse hook)**: `npx --no-install prettier --write \"$FILE\"`",
      "- **Quality gates**: `npm run lint` → `npm run test` → `npm run build`",
    ].join("\n"),
  }),
  python: Object.freeze({
    id: "python",
    label: "Python",
    formatCmd: 'python3 -m black "$FILE"',
    allow: Object.freeze([
      "Bash(pytest)",
      "Bash(pytest *)",
      "Bash(flake8)",
      "Bash(flake8 *)",
      "Bash(mypy)",
      "Bash(mypy *)",
      "Bash(ruff *)",
    ]),
    ask: Object.freeze(["Bash(pip install *)", "Bash(uv add *)"]),
    techStackSection: [
      "- **Language / Runtime**: Python 3",
      "- **Formatter (PostToolUse hook)**: `python3 -m black \"$FILE\"`",
      "- **Quality gates**: `ruff` / `flake8` → `mypy` → `pytest`",
    ].join("\n"),
  }),
  go: Object.freeze({
    id: "go",
    label: "Go",
    formatCmd: 'gofmt -w "$FILE"',
    allow: Object.freeze([
      "Bash(go test ./...)",
      "Bash(go test *)",
      "Bash(golangci-lint run)",
      "Bash(golangci-lint run *)",
      "Bash(go build ./...)",
      "Bash(go build *)",
    ]),
    ask: Object.freeze(["Bash(go get *)"]),
    techStackSection: [
      "- **Language / Runtime**: Go",
      "- **Formatter (PostToolUse hook)**: `gofmt -w \"$FILE\"`",
      "- **Quality gates**: `golangci-lint run` → `go test ./...` → `go build ./...`",
    ].join("\n"),
  }),
  java: Object.freeze({
    id: "java",
    label: "Java / Kotlin (Gradle)",
    formatCmd: "./gradlew spotlessApply",
    allow: Object.freeze([
      "Bash(./gradlew test)",
      "Bash(./gradlew test *)",
      "Bash(./gradlew check)",
      "Bash(./gradlew build)",
      "Bash(./gradlew build *)",
    ]),
    ask: Object.freeze(["Bash(./gradlew dependencies *)"]),
    techStackSection: [
      "- **Language / Runtime**: Java / Kotlin (Gradle)",
      "- **Formatter (PostToolUse hook)**: `./gradlew spotlessApply`",
      "- **Quality gates**: `./gradlew check` → `./gradlew test` → `./gradlew build`",
    ].join("\n"),
  }),
});

/**
 * Validate and normalize a `--stack` value. Returns the stack id (`ts|python|go|java`)
 * or throws an Error with message suitable for CliError.
 */
export function normalizeStack(raw, ErrorClass = Error) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!SUPPORTED_STACKS.includes(value)) {
    throw new ErrorClass(
      `Invalid --stack "${raw}". Expected one of: ${SUPPORTED_STACKS.join(", ")}.`
    );
  }
  return value;
}

/** Build the contents of `.claude/hooks/format.sh` for a given stack. */
export function buildFormatHook(stack) {
  const cfg = STACK_CONFIGS[stack];
  if (!cfg) return null;
  return [
    "#!/usr/bin/env bash",
    `# Format-on-save hook (${cfg.label}) — runs after Edit/Write (PostToolUse).`,
    "# Configured by `aspec-kit --stack " + cfg.id + "`.",
    "set -euo pipefail",
    "",
    "if command -v jq >/dev/null 2>&1; then",
    "  FILE=$(cat | jq -r '.tool_input.file_path // empty')",
    "elif command -v python3 >/dev/null 2>&1; then",
    '  FILE=$(python3 -c \'import json,sys; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")\' 2>/dev/null || true)',
    "else",
    '  FILE=""',
    "fi",
    "",
    `[ -n "$FILE" ] && [ -f "$FILE" ] && ${cfg.formatCmd} || true`,
    "",
  ].join("\n");
}

/** Transform `.claude/settings.json` text for the selected stack. */
export function transformSettingsJson(rawJson, stack) {
  const cfg = STACK_CONFIGS[stack];
  if (!cfg) return rawJson;
  let data;
  try {
    data = JSON.parse(rawJson);
  } catch {
    return rawJson;
  }
  if (data?.permissions) {
    if (Array.isArray(data.permissions.allow)) {
      const idx = data.permissions.allow.findIndex((item) => TEMPLATE_NPM_ALLOW.includes(item));
      const filtered = data.permissions.allow.filter((item) => !TEMPLATE_NPM_ALLOW.includes(item));
      const insertAt = idx >= 0 ? idx : filtered.length;
      filtered.splice(insertAt, 0, ...cfg.allow);
      data.permissions.allow = [...new Set(filtered)];
    }
    if (Array.isArray(data.permissions.ask)) {
      const idx = data.permissions.ask.findIndex((item) => TEMPLATE_NPM_ASK.includes(item));
      const filtered = data.permissions.ask.filter((item) => !TEMPLATE_NPM_ASK.includes(item));
      const insertAt = idx >= 0 ? idx : filtered.length;
      filtered.splice(insertAt, 0, ...cfg.ask);
      data.permissions.ask = [...new Set(filtered)];
    }
  }
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Transform `CLAUDE.md` text by filling in the `## Tech stack` placeholder. */
export function transformClaudeMdStack(rawText, stack) {
  const cfg = STACK_CONFIGS[stack];
  if (!cfg) return rawText;
  return rawText.replace(TECH_STACK_PLACEHOLDER_RE, `$1${cfg.techStackSection}`);
}

/**
 * Apply the stack configuration to a scaffolded project directory.
 * Only modifies files that are in `ownedFiles` (written by this CLI run).
 * Returns the list of relative POSIX paths modified.
 */
export function applyStack(targetDir, stack, ownedFiles) {
  if (!stack || !STACK_CONFIGS[stack]) return [];
  const modified = [];

  const hookRel = ".claude/hooks/format.sh";
  if (ownedFiles.has(hookRel)) {
    const hookPath = path.join(targetDir, hookRel);
    const mode = fs.existsSync(hookPath) ? fs.statSync(hookPath).mode : 0o755;
    fs.writeFileSync(hookPath, buildFormatHook(stack), "utf-8");
    fs.chmodSync(hookPath, mode | 0o111);
    modified.push(hookRel);
  }

  const settingsRel = ".claude/settings.json";
  if (ownedFiles.has(settingsRel)) {
    const settingsPath = path.join(targetDir, settingsRel);
    const current = fs.readFileSync(settingsPath, "utf-8");
    fs.writeFileSync(settingsPath, transformSettingsJson(current, stack), "utf-8");
    modified.push(settingsRel);
  }

  const claudeRel = "CLAUDE.md";
  if (ownedFiles.has(claudeRel)) {
    const claudePath = path.join(targetDir, claudeRel);
    const current = fs.readFileSync(claudePath, "utf-8");
    const updated = transformClaudeMdStack(current, stack);
    if (updated !== current) {
      fs.writeFileSync(claudePath, updated, "utf-8");
      modified.push(claudeRel);
    }
  }

  return modified;
}
