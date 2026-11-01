// Unit + integration tests for the aspec-kit CLI (node:test, zero dependencies).
// Run: npm test  (from packages/aspec-kit)  or  node --test packages/aspec-kit/test/cli.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  AGENT_METADATA,
  CliError,
  DEFAULT_AGENTS,
  DEFAULT_EXCLUDES,
  DEFAULT_LANG,
  STACK_CONFIGS,
  SUPPORTED_AGENTS,
  SUPPORTED_LANGS,
  SUPPORTED_STACKS,
  applyAgents,
  applyLang,
  applyStack,
  applySteward,
  copyTemplate,
  detectDefaultSteward,
  isExcluded,
  listTemplateFiles,
  normalizeAgents,
  normalizeLang,
  normalizeStack,
  normalizeSteward,
  parseCliArgs,
  promptMultiSelect,
  promptSelect,
  promptUser,
  readIgnoreFile,
  removeSampleFeature,
  transformCiWorkflow,
  writeProjectReadme,
} from "../src/index.js";
import { isProtected, parseUpdateArgs } from "../src/commands/update.js";
import {
  checkHookStatus,
  installHook,
  runHook,
  uninstallHook,
} from "../src/commands/hook.js";
import {
  FigmaError,
  extractFrames,
  parseFigmaInput,
  recordFigmaLinks,
  sanitizeNodeName,
  syncFigma,
} from "../src/commands/figma.js";
import {
  collectDashboardData,
  exportDashboardHtml,
  parseCsv,
  renderDashboardHtml,
  runDashboard,
  startDashboardServer,
} from "../src/commands/dashboard.js";
import {
  compareFigmaSvgFiles,
  diffSvgElements,
  extractSvgDimensions,
  generateMarkdownDiffReport,
  generateOverlaySvg,
  parseSvgElements,
} from "../src/commands/figma-diff.js";
import {
  BOOTSTRAP_SKILLS,
  checkBranchProtection,
  doctorCommand,
  isFormatHookConfigured,
  makeHasCommand,
  referencedSkills,
  runDoctor,
} from "../src/commands/doctor.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const BIN = path.resolve(HERE, "..", "bin", "run.js");

// Helpers ────────────────────────────────────────────────────────────────────
function writeFile(root, rel, content = "x") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-test-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Build a tiny fake template that mimics the real repo layout. */
function makeTemplate(root) {
  writeFile(root, "CLAUDE.md", "# rules");
  writeFile(root, "README.md", "# kit readme");
  writeFile(root, "LICENSE", "MIT");
  writeFile(root, "bootstrap.sh", "#!/usr/bin/env bash\n");
  fs.chmodSync(path.join(root, "bootstrap.sh"), 0o755);
  writeFile(root, ".github/CODEOWNERS", "docs/00-glossary.md  @your-lead-handle\n");
  writeFile(root, ".github/workflows/publish-npm.yml", "name: publish");
  writeFile(root, ".github/workflows/smoke-test.yml", "name: smoke");
  writeFile(root, "packages/aspec-kit/package.json", "{}");
  writeFile(root, "docs/04-decisions/INDEX.md", "| a | keep |\n| b | 000-example-reservation |\n");
  writeFile(root, "docs/05-lessons.md", "keep\n000-example-reservation line\n");
  writeFile(root, "docs/intake/000-example-reservation.md", "sample");
  writeFile(root, "docs/04-decisions/2026-01-01-approval-vs-confirm.md", "sample");
  writeFile(root, "specs/000-example-reservation/spec.md", "sample");
  writeFile(root, "src/features/example-reservation/a.ts", "sample");
  writeFile(root, "docs/02-detail-design/example-reservation/field-spec-v2.md", "sample");
  writeFile(root, "docs/02-detail-design/README.md", "keep");
  writeFile(root, "docs/changes/2026-10-31-example-reservation.md", "sample");
  writeFile(root, "docs/changes/README.md", "keep");
  writeFile(root, "src/.gitkeep", "");
  writeFile(root, ".aspecignore", "# comment\n/docs/private/\n");
  writeFile(root, "docs/private/secret.md", "kit only");
}

// parseCliArgs ───────────────────────────────────────────────────────────────
describe("parseCliArgs", () => {
  test("parses init subcommand, target and flags", () => {
    const o = parseCliArgs(["init", "my-app", "-y", "--steward", "lead", "--clean", "--force"]);
    assert.equal(o.target, "my-app");
    assert.equal(o.yes, true);
    assert.equal(o.steward, "@lead");
    assert.equal(o.keepExample, false);
    assert.equal(o.force, true);
    assert.equal(o.templateRef, null);
  });

  test("target without init subcommand", () => {
    assert.equal(parseCliArgs(["my-app"]).target, "my-app");
    assert.equal(parseCliArgs([]).target, null);
  });

  test("--steward without value is rejected", () => {
    assert.throws(() => parseCliArgs(["--steward"]), CliError);
  });

  test("--steward followed by another flag is rejected (no silent swallow)", () => {
    assert.throws(() => parseCliArgs(["--steward", "--clean"]), CliError);
  });

  test("unknown flag is rejected", () => {
    assert.throws(() => parseCliArgs(["--cleen"]), CliError);
  });

  test("--keep-example and --clean conflict", () => {
    assert.throws(() => parseCliArgs(["--keep-example", "--clean"]), /cannot be used together/);
  });

  test("extra positional arguments are rejected", () => {
    assert.throws(() => parseCliArgs(["init", "a", "b"]), /Unexpected arguments/);
  });

  test("--template-ref is validated", () => {
    assert.equal(parseCliArgs(["--template-ref", "v1.2.3"]).templateRef, "v1.2.3");
    assert.equal(parseCliArgs(["--template-ref", "feat/x"]).templateRef, "feat/x");
    assert.throws(() => parseCliArgs(["--template-ref", "main; rm -rf /"]), CliError);
  });

  test("--agent parses single, comma-separated, and repeated flags (defaults to ['claude'])", () => {
    assert.deepEqual(parseCliArgs([]).agents, ["claude"]);
    assert.deepEqual(parseCliArgs(["--agent", "gemini"]).agents, ["gemini"]);
    assert.deepEqual(parseCliArgs(["--agent", "gemini,copilot"]).agents, ["gemini", "copilot"]);
    assert.deepEqual(
      parseCliArgs(["--agent", "cursor", "--agent", "claude,gemini"]).agents,
      ["claude", "gemini", "cursor"]
    );
    assert.throws(() => parseCliArgs(["--agent", "unknown"]), CliError);
    assert.throws(() => parseCliArgs(["--agent", ""]), CliError);
  });

  test("--lang is parsed and validated (defaults to vi)", () => {
    assert.equal(parseCliArgs([]).lang, DEFAULT_LANG);
    for (const l of SUPPORTED_LANGS) {
      assert.equal(parseCliArgs(["--lang", l]).lang, l);
      assert.equal(parseCliArgs(["--lang", l.toUpperCase()]).lang, l);
    }
    assert.throws(() => parseCliArgs(["--lang", "fr"]), CliError);
    assert.throws(() => parseCliArgs(["--lang"]), CliError);
  });

  test("--stack is parsed and validated", () => {
    assert.equal(parseCliArgs([]).stack, null);
    for (const s of SUPPORTED_STACKS) {
      assert.equal(parseCliArgs(["--stack", s]).stack, s);
      assert.equal(parseCliArgs(["--stack", s.toUpperCase()]).stack, s);
    }
    assert.throws(() => parseCliArgs(["--stack", "ruby"]), CliError);
    assert.throws(() => parseCliArgs(["--stack"]), CliError);
  });

  test("--interactive and -i are parsed and conflict with -y", () => {
    assert.equal(parseCliArgs([]).interactive, false);
    assert.equal(parseCliArgs(["--interactive"]).interactive, true);
    assert.equal(parseCliArgs(["-i"]).interactive, true);
    assert.throws(
      () => parseCliArgs(["-y", "--interactive"]),
      /--yes and --interactive cannot be used together/
    );
    assert.throws(
      () => parseCliArgs(["-y", "-i"]),
      /--yes and --interactive cannot be used together/
    );
  });

  test("explicit flags are tracked correctly for wizard defaults", () => {
    const empty = parseCliArgs([]);
    assert.equal(empty.stewardExplicit, false);
    assert.equal(empty.stackExplicit, false);
    assert.equal(empty.langExplicit, false);
    assert.equal(empty.agentsExplicit, false);

    const full = parseCliArgs([
      "--steward", "my-lead",
      "--stack", "ts",
      "--lang", "ja",
      "--agent", "gemini",
    ]);
    assert.equal(full.stewardExplicit, true);
    assert.equal(full.stackExplicit, true);
    assert.equal(full.langExplicit, true);
    assert.equal(full.agentsExplicit, true);
  });
});

describe("wizard prompts & helpers", () => {
  const makeMockRl = (responses) => {
    const queue = [...responses];
    return {
      question: async () => queue.shift() ?? "",
    };
  };

  test("detectDefaultSteward returns a handle starting with @", () => {
    const handle = detectDefaultSteward();
    assert.ok(typeof handle === "string");
    assert.ok(handle.startsWith("@"));
  });

  test("promptUser returns trimmed input or default", async () => {
    const rl1 = makeMockRl(["  my-app  "]);
    assert.equal(await promptUser(rl1, "Project name", "default-app"), "my-app");

    const rl2 = makeMockRl([""]);
    assert.equal(await promptUser(rl2, "Project name", "default-app"), "default-app");
  });

  test("promptSelect accepts index, value, or falls back to default", async () => {
    const options = [
      { value: "vi", label: "Tiếng Việt" },
      { value: "en", label: "English" },
      { value: "ja", label: "Japanese" },
    ];

    // Empty answer -> default
    assert.equal(await promptSelect(makeMockRl([""]), "Lang", options, "vi"), "vi");

    // 1-based index
    assert.equal(await promptSelect(makeMockRl(["2"]), "Lang", options, "vi"), "en");
    assert.equal(await promptSelect(makeMockRl(["3"]), "Lang", options, "vi"), "ja");

    // Match by value
    assert.equal(await promptSelect(makeMockRl(["en"]), "Lang", options, "vi"), "en");
    assert.equal(await promptSelect(makeMockRl(["JA"]), "Lang", options, "vi"), "ja");

    // Invalid choice -> fallback to default
    assert.equal(await promptSelect(makeMockRl(["99"]), "Lang", options, "vi"), "vi");
    assert.equal(await promptSelect(makeMockRl(["unknown"]), "Lang", options, "vi"), "vi");
  });

  test("promptMultiSelect accepts single, multiple, or falls back to default", async () => {
    const options = [
      { value: "claude", label: "Claude" },
      { value: "gemini", label: "Gemini" },
      { value: "copilot", label: "Copilot" },
      { value: "cursor", label: "Cursor" },
    ];

    // Empty answer -> default
    assert.deepEqual(
      await promptMultiSelect(makeMockRl([""]), "Agents", options, ["claude"]),
      ["claude"]
    );

    // Numbered selection
    assert.deepEqual(
      await promptMultiSelect(makeMockRl(["2"]), "Agents", options, ["claude"]),
      ["gemini"]
    );
    assert.deepEqual(
      await promptMultiSelect(makeMockRl(["1,3"]), "Agents", options, ["claude"]),
      ["claude", "copilot"]
    );

    // Named selection
    assert.deepEqual(
      await promptMultiSelect(makeMockRl(["gemini, cursor"]), "Agents", options, ["claude"]),
      ["gemini", "cursor"]
    );

    // Invalid choices -> fallback
    assert.deepEqual(
      await promptMultiSelect(makeMockRl(["99, foo"]), "Agents", options, ["claude"]),
      ["claude"]
    );
  });
});

describe("normalizeSteward", () => {
  test("adds @ prefix to user and team handles", () => {
    assert.equal(normalizeSteward("lead-dev"), "@lead-dev");
    assert.equal(normalizeSteward("@org/team"), "@org/team");
  });
  test("keeps emails as-is", () => {
    assert.equal(normalizeSteward("lead@example.com"), "lead@example.com");
  });
  test("rejects garbage", () => {
    assert.throws(() => normalizeSteward("bad handle!"), CliError);
    assert.throws(() => normalizeSteward(""), CliError);
  });
});

// Exclusion & copy ───────────────────────────────────────────────────────────
describe("template copy", () => {
  test("isExcluded matches exact path and children only", () => {
    assert.equal(isExcluded("packages/a/b.js", ["packages"]), true);
    assert.equal(isExcluded("packages", ["packages"]), true);
    assert.equal(isExcluded("packages-extra/x", ["packages"]), false);
  });

  test("readIgnoreFile strips comments and slashes", () => {
    const src = path.join(tmp, "tpl");
    makeTemplate(src);
    assert.deepEqual(readIgnoreFile(src), ["docs/private"]);
  });

  test("kit-only files are never copied", () => {
    const src = path.join(tmp, "tpl");
    makeTemplate(src);
    writeFile(src, "examples/01-reservation-app/README.md", "example");
    writeFile(src, "CHANGELOG.md", "# kit changelog");
    const files = listTemplateFiles(src, [...DEFAULT_EXCLUDES, ...readIgnoreFile(src)]);
    for (const banned of [
      ".github/workflows/publish-npm.yml",
      "packages/aspec-kit/package.json",
      "examples/01-reservation-app/README.md",
      "CHANGELOG.md",
      "README.md",
      "LICENSE",
      ".aspecignore",
      "docs/private/secret.md",
    ]) {
      assert.ok(!files.includes(banned), `${banned} should be excluded`);
    }
    assert.ok(files.includes(".github/workflows/smoke-test.yml"));
    assert.ok(files.includes("CLAUDE.md"));
  });

  test("existing files are skipped by default (no data loss)", () => {
    const src = path.join(tmp, "tpl");
    const dest = path.join(tmp, "proj");
    makeTemplate(src);
    writeFile(dest, "CLAUDE.md", "MY OWN RULES");

    const r = copyTemplate(src, dest);
    assert.ok(r.skipped.includes("CLAUDE.md"));
    assert.ok(!r.copied.includes("CLAUDE.md"));
    assert.equal(fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf-8"), "MY OWN RULES");
  });

  test("--force overwrites and reports overwritten files", () => {
    const src = path.join(tmp, "tpl");
    const dest = path.join(tmp, "proj");
    makeTemplate(src);
    writeFile(dest, "CLAUDE.md", "MY OWN RULES");

    const r = copyTemplate(src, dest, { force: true });
    assert.deepEqual(r.overwritten, ["CLAUDE.md"]);
    assert.equal(fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf-8"), "# rules");
  });

  test("executable bit is preserved", { skip: process.platform === "win32" }, () => {
    const src = path.join(tmp, "tpl");
    const dest = path.join(tmp, "proj");
    makeTemplate(src);
    copyTemplate(src, dest);
    assert.ok(fs.statSync(path.join(dest, "bootstrap.sh")).mode & 0o100);
  });
});

// Customization ──────────────────────────────────────────────────────────────
describe("customization", () => {
  test("applySteward only edits CODEOWNERS created by this run", () => {
    const src = path.join(tmp, "tpl");
    const dest = path.join(tmp, "proj");
    makeTemplate(src);
    const r = copyTemplate(src, dest);
    assert.equal(applySteward(dest, "@lead", new Set(r.copied)), true);
    assert.match(fs.readFileSync(path.join(dest, ".github/CODEOWNERS"), "utf-8"), /@lead\n/);

    // Pre-existing CODEOWNERS (not owned) must stay untouched
    writeFile(dest, ".github/CODEOWNERS", "* @someone");
    assert.equal(applySteward(dest, "@lead", new Set()), false);
    assert.equal(fs.readFileSync(path.join(dest, ".github/CODEOWNERS"), "utf-8"), "* @someone");
  });

  test("removeSampleFeature removes only owned sample files and filters references", () => {
    const src = path.join(tmp, "tpl");
    const dest = path.join(tmp, "proj");
    makeTemplate(src);
    // User already has a file inside the sample folder → must survive
    writeFile(dest, "src/features/example-reservation/user-file.ts", "mine");
    const r = copyTemplate(src, dest);
    removeSampleFeature(dest, new Set(r.copied));

    assert.ok(!fs.existsSync(path.join(dest, "specs/000-example-reservation")));
    assert.ok(!fs.existsSync(path.join(dest, "docs/intake/000-example-reservation.md")));
    assert.ok(!fs.existsSync(path.join(dest, "src/features/example-reservation/a.ts")));
    assert.ok(fs.existsSync(path.join(dest, "src/features/example-reservation/user-file.ts")));
    assert.ok(!fs.existsSync(path.join(dest, "docs/02-detail-design/example-reservation")));
    assert.ok(!fs.existsSync(path.join(dest, "docs/changes/2026-10-31-example-reservation.md")));
    assert.ok(fs.existsSync(path.join(dest, "docs/changes/README.md")), "docs/changes/ README is kept");
    assert.ok(fs.existsSync(path.join(dest, "specs")), "parent specs/ dir is kept");

    const index = fs.readFileSync(path.join(dest, "docs/04-decisions/INDEX.md"), "utf-8");
    assert.equal(index, "| a | keep |\n");
    const lessons = fs.readFileSync(path.join(dest, "docs/05-lessons.md"), "utf-8");
    assert.equal(lessons, "keep\n");
  });

  test("writeProjectReadme does not overwrite an existing README", () => {
    assert.equal(writeProjectReadme(tmp, "my-app", "1.0.0"), true);
    assert.match(fs.readFileSync(path.join(tmp, "README.md"), "utf-8"), /^# my-app/);
    fs.writeFileSync(path.join(tmp, "README.md"), "mine");
    assert.equal(writeProjectReadme(tmp, "my-app", "1.0.0"), false);
    assert.equal(fs.readFileSync(path.join(tmp, "README.md"), "utf-8"), "mine");
  });

  test("applyStack configures format.sh, settings.json, CLAUDE.md and ci.yml for each stack", () => {
    for (const stack of SUPPORTED_STACKS) {
      const dest = path.join(tmp, `stack-${stack}`);
      fs.mkdirSync(path.join(dest, ".claude/hooks"), { recursive: true });
      fs.mkdirSync(path.join(dest, ".github/workflows"), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, ".claude/hooks/format.sh"), path.join(dest, ".claude/hooks/format.sh"));
      fs.copyFileSync(path.join(REPO_ROOT, ".claude/settings.json"), path.join(dest, ".claude/settings.json"));
      fs.copyFileSync(path.join(REPO_ROOT, "CLAUDE.md"), path.join(dest, "CLAUDE.md"));
      fs.copyFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), path.join(dest, ".github/workflows/ci.yml"));

      const owned = new Set([
        ".claude/hooks/format.sh",
        ".claude/settings.json",
        "CLAUDE.md",
        ".github/workflows/ci.yml",
      ]);
      const modified = applyStack(dest, stack, owned);
      assert.deepEqual(modified, [
        ".claude/hooks/format.sh",
        ".claude/settings.json",
        "CLAUDE.md",
        ".github/workflows/ci.yml",
      ]);

      const hookText = fs.readFileSync(path.join(dest, ".claude/hooks/format.sh"), "utf-8");
      assert.equal(isFormatHookConfigured(hookText), true, `format.sh for ${stack} must be active`);
      assert.ok(hookText.includes(STACK_CONFIGS[stack].formatCmd));

      const settings = JSON.parse(fs.readFileSync(path.join(dest, ".claude/settings.json"), "utf-8"));
      for (const allowEntry of STACK_CONFIGS[stack].allow) {
        assert.ok(settings.permissions.allow.includes(allowEntry), `${stack} missing allow: ${allowEntry}`);
      }
      if (stack !== "ts") {
        assert.ok(!settings.permissions.allow.includes("Bash(npm run lint)"), `${stack} should replace npm allow`);
        assert.ok(!settings.permissions.ask.includes("Bash(npm install *)"), `${stack} should replace npm ask`);
      }

      const claudeMd = fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf-8");
      assert.ok(claudeMd.includes(STACK_CONFIGS[stack].label), `CLAUDE.md for ${stack} should include stack label`);
      assert.ok(!claudeMd.includes("<Điền khi bắt đầu code"), `CLAUDE.md placeholder should be replaced for ${stack}`);

      const ciYaml = fs.readFileSync(path.join(dest, ".github/workflows/ci.yml"), "utf-8");
      if (stack === "ts") assert.ok(ciYaml.includes("setup-node"));
      if (stack === "python") assert.ok(ciYaml.includes("setup-python"));
      if (stack === "go") assert.ok(ciYaml.includes("setup-go"));
      if (stack === "java") assert.ok(ciYaml.includes("setup-java"));
    }
  });

  test("transformCiWorkflow preserves content for unknown stack", () => {
    const raw = "test:\n  steps:\n    # BEGIN STACK_TEST_STEPS\n    - run: echo\n    # END STACK_TEST_STEPS\n";
    assert.equal(transformCiWorkflow(raw, "unknown"), raw);
  });

  test("applyStack skips files not owned by the current run", () => {
    const dest = path.join(tmp, "unowned");
    writeFile(dest, ".claude/hooks/format.sh", "# custom\n");
    writeFile(dest, ".claude/settings.json", '{"custom":true}');
    writeFile(dest, "CLAUDE.md", "# custom");
    assert.deepEqual(applyStack(dest, "python", new Set()), []);
    assert.equal(fs.readFileSync(path.join(dest, ".claude/hooks/format.sh"), "utf-8"), "# custom\n");
  });
});

// End-to-end against the real repository as local template ──────────────────
describe("CLI end-to-end (local template)", () => {
  const run = (args, cwd) =>
    execFileSync(process.execPath, [BIN, ...args], {
      cwd,
      env: { ...process.env, ASPEC_KIT_TEMPLATE_DIR: REPO_ROOT, NO_COLOR: "1" },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });

  test("--version prints package version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(HERE, "..", "package.json"), "utf-8"));
    assert.equal(run(["--version"], tmp).trim(), pkg.version);
  });

  test("unknown flag exits non-zero", () => {
    assert.throws(() => run(["--nope"], tmp));
  });

  test("init -y --clean scaffolds a clean project that passes template checks", () => {
    run(["init", "demo", "-y", "--clean", "--steward", "@lead"], tmp);
    const proj = path.join(tmp, "demo");

    for (const must of ["CLAUDE.md", "bootstrap.sh", ".claude/settings.json", "README.md", ".github/workflows/ci.yml"]) {
      assert.ok(fs.existsSync(path.join(proj, must)), `${must} should exist`);
    }
    for (const banned of [
      ".github/workflows/publish-npm.yml",
      ".github/workflows/kit-ci.yml",
      ".github/scripts/sync-version.mjs",
      "packages",
      "assets",
      ".claude-plugin",
      "CONTRIBUTING.md",
      "LICENSE",
      ".aspecignore",
      "specs/000-example-reservation",
    ]) {
      assert.ok(!fs.existsSync(path.join(proj, banned)), `${banned} should not exist`);
    }
    assert.match(fs.readFileSync(path.join(proj, ".github/CODEOWNERS"), "utf-8"), /@lead/);

    // The scaffolded project must pass its own CI check (no broken internal links etc.)
    execFileSync("python3", [path.join(proj, ".github/scripts/check-template.py")], {
      stdio: "pipe",
    });
  });

  test("init . into a non-empty dir keeps user files", () => {
    writeFile(tmp, "CLAUDE.md", "MY OWN RULES");
    const out = run(["init", ".", "-y", "--clean"], tmp);
    assert.match(out, /Skipped/);
    assert.equal(fs.readFileSync(path.join(tmp, "CLAUDE.md"), "utf-8"), "MY OWN RULES");
  });

  test("init --agent claude,gemini,copilot,cursor generates synchronized rules, updates bootstrap.sh and passes check-template.py", () => {
    run(
      ["init", "multi", "-y", "--clean", "--steward", "@lead", "--agent", "claude,gemini,copilot,cursor"],
      tmp
    );
    const proj = path.join(tmp, "multi");

    for (const f of ["CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md", "AGENTS.md", ".cursorrules"]) {
      assert.ok(fs.existsSync(path.join(proj, f)), `${f} should exist`);
      const text = fs.readFileSync(path.join(proj, f), "utf-8");
      if (f !== "CLAUDE.md") {
        assert.match(text, /Multi-Agent Compatibility & Graceful Degradation/);
      }
    }

    // .github/copilot-instructions.md lives one directory deep -> relative link to docs/TEAM-WORKFLOW.md is rewritten to ../docs/TEAM-WORKFLOW.md
    const copilotText = fs.readFileSync(path.join(proj, ".github/copilot-instructions.md"), "utf-8");
    assert.match(copilotText, /\(\.\.\/docs\/TEAM-WORKFLOW\.md\)/);

    const bootstrapText = fs.readFileSync(path.join(proj, "bootstrap.sh"), "utf-8");
    assert.match(bootstrapText, /SPEC_KIT_INTEGRATION="\$\{SPEC_KIT_INTEGRATION:-claude,gemini,copilot,cursor\}"/);

    const manifest = JSON.parse(fs.readFileSync(path.join(proj, ".aspec-kit.json"), "utf-8"));
    assert.deepEqual(manifest.agents, ["claude", "gemini", "copilot", "cursor"]);
    assert.ok(manifest.files["GEMINI.md"]);
    assert.ok(manifest.files[".github/copilot-instructions.md"]);
    assert.ok(manifest.files["AGENTS.md"]);

    execFileSync("python3", [path.join(proj, ".github/scripts/check-template.py")], {
      stdio: "pipe",
    });
  });

  test("init --lang en and --lang ja overlay localized docs/agents and pass check-template.py", () => {
    for (const [lang, expectedHeading] of [
      ["en", "# Project Conventions for AI Agents"],
      ["ja", "# AIエージェント向けプロジェクト規約"],
    ]) {
      const dirName = `demo-${lang}`;
      run(["init", dirName, "-y", "--clean", "--steward", "@lead", "--lang", lang], tmp);
      const proj = path.join(tmp, dirName);

      assert.ok(!fs.existsSync(path.join(proj, "templates")), "templates/ pack dir must not be copied");
      const claudeMd = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf-8");
      assert.ok(claudeMd.startsWith(expectedHeading), `CLAUDE.md for ${lang} should start with ${expectedHeading}`);

      const manifest = JSON.parse(fs.readFileSync(path.join(proj, ".aspec-kit.json"), "utf-8"));
      assert.equal(manifest.lang, lang);

      execFileSync("python3", [path.join(proj, ".github/scripts/check-template.py")], {
        stdio: "pipe",
      });
    }
  });

  test("init --stack go configures formatter, permissions, CLAUDE.md and manifest", () => {
    run(["init", "go-app", "-y", "--clean", "--steward", "@lead", "--stack", "go"], tmp);
    const proj = path.join(tmp, "go-app");
    const manifest = JSON.parse(fs.readFileSync(path.join(proj, ".aspec-kit.json"), "utf-8"));
    assert.equal(manifest.stack, "go");

    const hook = fs.readFileSync(path.join(proj, ".claude/hooks/format.sh"), "utf-8");
    assert.match(hook, /gofmt -w "\$FILE"/);
    assert.equal(isFormatHookConfigured(hook), true);

    const settings = JSON.parse(fs.readFileSync(path.join(proj, ".claude/settings.json"), "utf-8"));
    assert.ok(settings.permissions.allow.includes("Bash(go test ./...)"));
    assert.ok(!settings.permissions.allow.includes("Bash(npm run lint)"));

    const claudeMd = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf-8");
    assert.match(claudeMd, /golangci-lint run/);

    const ciYaml = fs.readFileSync(path.join(proj, ".github/workflows/ci.yml"), "utf-8");
    assert.match(ciYaml, /actions\/setup-go/);
    assert.match(ciYaml, /go test -v \.\/\.\.\./);

    execFileSync("python3", [path.join(proj, ".github/scripts/check-template.py")], {
      stdio: "pipe",
    });
  });
});

// update ─────────────────────────────────────────────────────────────────────
describe("aspec-kit update", () => {
  const runWith = (templateDir, args, cwd) =>
    execFileSync(process.execPath, [BIN, ...args], {
      cwd,
      env: { ...process.env, ASPEC_KIT_TEMPLATE_DIR: templateDir, NO_COLOR: "1" },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf-8");
  const manifestOf = (root) => JSON.parse(read(root, ".aspec-kit.json"));

  /** Scaffold a project from template v1 (with the sample kept), then return paths. */
  function scaffold() {
    const v1 = path.join(tmp, "v1");
    makeTemplate(v1);
    writeFile(v1, ".claude/agents/reviewer.md", "reviewer v1");
    writeFile(v1, "docs/runbook.md", "runbook v1");
    writeFile(v1, "docs/old.md", "old v1");
    writeFile(v1, "docs/00-glossary.md", "glossary v1");
    writeFile(v1, "docs/01-basic-design/README.md", "basic v1");
    runWith(v1, ["init", "proj", "-y", "--keep-example", "--steward", "@lead"], tmp);
    const proj = path.join(tmp, "proj");

    // v2: everything kit-owned and protected changes, docs/old.md removed, a new hook added
    const v2 = path.join(tmp, "v2");
    makeTemplate(v2);
    writeFile(v2, ".claude/agents/reviewer.md", "reviewer v2");
    writeFile(v2, "docs/runbook.md", "runbook v2");
    writeFile(v2, "CLAUDE.md", "# rules v2");
    writeFile(v2, ".github/CODEOWNERS", "docs/00-glossary.md  @your-lead-handle\nsrc/  @your-lead-handle\n");
    writeFile(v2, ".claude/hooks/new.sh", "#!/bin/sh\n");
    writeFile(v2, "docs/00-glossary.md", "glossary v2");
    writeFile(v2, "docs/01-basic-design/README.md", "basic v2");
    writeFile(v2, "docs/05-lessons.md", "lessons v2");
    writeFile(v2, "specs/000-example-reservation/spec.md", "spec v2");
    writeFile(v2, "src/features/example-reservation/a.ts", "code v2");
    return { v1, v2, proj };
  }

  test("init writes a manifest with ref, steward and a hash per scaffolded file", () => {
    const { proj } = scaffold();
    const m = manifestOf(proj);
    assert.equal(m.templateRef, "local");
    assert.equal(m.steward, "@lead");
    assert.match(m.files["CLAUDE.md"], /^sha256:[0-9a-f]{64}$/);
    assert.ok(m.files[".claude/agents/reviewer.md"]);
    assert.ok(!m.files["README.md"], "generated README is not kit-owned");
    assert.ok(!m.files["LICENSE"], "excluded files are not recorded");
  });

  test("--dry-run prints the plan and writes nothing", () => {
    const { v2, proj } = scaffold();
    const before = read(proj, ".aspec-kit.json");
    const out = runWith(v2, ["update", "--dry-run"], proj);
    assert.match(out, /\[dry-run\] Updated \(\d+\):[\s\S]*\.claude\/agents\/reviewer\.md/);
    assert.match(out, /\[dry-run\] Added \(1\):\n   - \.claude\/hooks\/new\.sh/);
    assert.match(out, /Dry run — no files were written/);
    assert.equal(read(proj, ".claude/agents/reviewer.md"), "reviewer v1");
    assert.ok(!fs.existsSync(path.join(proj, ".claude/hooks/new.sh")));
    assert.equal(read(proj, ".aspec-kit.json"), before);
  });

  test("clean update overwrites untouched files, adds, removes and refreshes the manifest", () => {
    const { v2, proj } = scaffold();
    runWith(v2, ["update"], proj);
    assert.equal(read(proj, ".claude/agents/reviewer.md"), "reviewer v2");
    assert.equal(read(proj, "CLAUDE.md"), "# rules v2");
    assert.equal(read(proj, ".claude/hooks/new.sh"), "#!/bin/sh\n");
    assert.ok(!fs.existsSync(path.join(proj, "docs/old.md")), "removed upstream & untouched → deleted");
    // Recorded steward is re-applied to the new CODEOWNERS
    assert.equal(read(proj, ".github/CODEOWNERS"), "docs/00-glossary.md  @lead\nsrc/  @lead\n");

    const m = manifestOf(proj);
    assert.ok(m.files[".claude/hooks/new.sh"]);
    assert.ok(!m.files["docs/old.md"]);
    // Second run is a no-op
    const out = runWith(v2, ["update"], proj);
    assert.doesNotMatch(out, /^(Updated|Added|Conflicts) /m);
  });

  test("update refreshes generated multi-agent instruction files when CLAUDE.md changes upstream", () => {
    const v1 = path.join(tmp, "agent-v1");
    makeTemplate(v1);
    writeFile(v1, "bootstrap.sh", '#!/usr/bin/env bash\nSPEC_KIT_INTEGRATION="${SPEC_KIT_INTEGRATION:-claude}"\n');
    runWith(v1, ["init", "agent-proj", "-y", "--clean", "--agent", "gemini,copilot"], tmp);
    const proj = path.join(tmp, "agent-proj");
    assert.match(read(proj, "GEMINI.md"), /# rules/);

    const v2 = path.join(tmp, "agent-v2");
    makeTemplate(v2);
    writeFile(v2, "CLAUDE.md", "# rules v2 updated");
    writeFile(v2, "bootstrap.sh", '#!/usr/bin/env bash\nSPEC_KIT_INTEGRATION="${SPEC_KIT_INTEGRATION:-claude}"\n# v2\n');

    const out = runWith(v2, ["update"], proj);
    assert.doesNotMatch(out, /Conflicts/);
    assert.match(read(proj, "GEMINI.md"), /# rules v2 updated/);
    assert.match(read(proj, ".github/copilot-instructions.md"), /# rules v2 updated/);
    assert.match(read(proj, "bootstrap.sh"), /SPEC_KIT_INTEGRATION="\$\{SPEC_KIT_INTEGRATION:-gemini,copilot\}"/);
    assert.deepEqual(manifestOf(proj).agents, ["gemini", "copilot"]);
  });

  test("update uses recorded lang pack from manifest", () => {
    const v1 = path.join(tmp, "lang-v1");
    makeTemplate(v1);
    writeFile(v1, "templates/lang/en/CLAUDE.md", "# English rules v1");
    runWith(v1, ["init", "en-proj", "-y", "--clean", "--lang", "en"], tmp);
    const proj = path.join(tmp, "en-proj");
    assert.equal(read(proj, "CLAUDE.md"), "# English rules v1");

    const v2 = path.join(tmp, "lang-v2");
    makeTemplate(v2);
    writeFile(v2, "templates/lang/en/CLAUDE.md", "# English rules v2");
    const out = runWith(v2, ["update"], proj);
    assert.doesNotMatch(out, /Conflicts/);
    assert.equal(read(proj, "CLAUDE.md"), "# English rules v2");
    assert.equal(manifestOf(proj).lang, "en");
  });

  test("update preserves --stack customization when template files change", () => {
    const v1 = path.join(tmp, "stack-v1");
    makeTemplate(v1);
    fs.mkdirSync(path.join(v1, ".claude/hooks"), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, ".claude/hooks/format.sh"), path.join(v1, ".claude/hooks/format.sh"));
    fs.copyFileSync(path.join(REPO_ROOT, ".claude/settings.json"), path.join(v1, ".claude/settings.json"));
    fs.copyFileSync(path.join(REPO_ROOT, "CLAUDE.md"), path.join(v1, "CLAUDE.md"));

    runWith(v1, ["init", "py-proj", "-y", "--clean", "--stack", "python"], tmp);
    const proj = path.join(tmp, "py-proj");

    const v2 = path.join(tmp, "stack-v2");
    makeTemplate(v2);
    fs.mkdirSync(path.join(v2, ".claude/hooks"), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, ".claude/hooks/format.sh"), path.join(v2, ".claude/hooks/format.sh"));
    fs.copyFileSync(path.join(REPO_ROOT, ".claude/settings.json"), path.join(v2, ".claude/settings.json"));
    const v2Claude = fs.readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf-8") + "\n<!-- v2 note -->\n";
    writeFile(v2, "CLAUDE.md", v2Claude);

    const out = runWith(v2, ["update"], proj);
    assert.doesNotMatch(out, /Conflicts/);
    assert.match(read(proj, "CLAUDE.md"), /<!-- v2 note -->/);
    assert.match(read(proj, "CLAUDE.md"), /Python 3/);
    assert.equal(manifestOf(proj).stack, "python");
  });

  test("local-only changes are kept; changes on both sides become conflicts", () => {
    const { v1, v2, proj } = scaffold();
    writeFile(proj, "bootstrap.sh", "#!/usr/bin/env bash\n# my tweak\n"); // unchanged in v2
    writeFile(proj, ".claude/agents/reviewer.md", "reviewer MINE"); // changed in v2 too
    writeFile(proj, "docs/old.md", "old MINE"); // removed in v2

    const out = runWith(v2, ["update"], proj);
    assert.match(out, /Conflicts \(kept[^\n]*\) \(1\):\n   - \.claude\/agents\/reviewer\.md/);
    assert.match(out, /Kept \(changed only locally\) \(1\):\n   - bootstrap\.sh/);
    assert.equal(read(proj, ".claude/agents/reviewer.md"), "reviewer MINE", "never overwritten");
    assert.equal(read(proj, ".claude/agents/reviewer.md.aspec-new"), "reviewer v2");
    assert.equal(read(proj, "bootstrap.sh"), "#!/usr/bin/env bash\n# my tweak\n");
    assert.equal(read(proj, "docs/old.md"), "old MINE");

    // After a conflict the base moves to the new template: a later run with the same template
    // keeps the user's resolution instead of reporting the conflict again.
    const again = runWith(v2, ["update"], proj);
    assert.doesNotMatch(again, /Conflicts/);
    assert.ok(fs.existsSync(v1));
  });

  test("protected paths are never touched", () => {
    const { v2, proj } = scaffold();
    const protectedFiles = [
      "docs/00-glossary.md",
      "docs/01-basic-design/README.md",
      "docs/05-lessons.md",
      "docs/04-decisions/INDEX.md",
      "specs/000-example-reservation/spec.md",
      "src/features/example-reservation/a.ts",
    ];
    const before = Object.fromEntries(protectedFiles.map((rel) => [rel, read(proj, rel)]));
    fs.rmSync(path.join(proj, "docs/intake/000-example-reservation.md"));

    const out = runWith(v2, ["update"], proj);
    assert.match(out, /protected \(never touched\): \d+/);
    for (const rel of protectedFiles) {
      assert.equal(read(proj, rel), before[rel], `${rel} must be unchanged`);
      assert.ok(!fs.existsSync(path.join(proj, `${rel}.aspec-new`)));
    }
    assert.ok(!fs.existsSync(path.join(proj, "docs/intake/000-example-reservation.md")), "not re-added");
  });

  test("project without a manifest: identical files update cleanly, differing ones conflict", () => {
    const { v2, proj } = scaffold();
    fs.rmSync(path.join(proj, ".aspec-kit.json"));
    const out = runWith(v2, ["update"], proj);
    assert.match(out, /No \.aspec-kit\.json found/);
    // reviewer.md is v1 on disk, v2 upstream, unknown base → treated as user-modified
    assert.equal(read(proj, ".claude/agents/reviewer.md"), "reviewer v1");
    assert.equal(read(proj, ".claude/agents/reviewer.md.aspec-new"), "reviewer v2");
    assert.equal(read(proj, ".claude/hooks/new.sh"), "#!/bin/sh\n");
    assert.ok(manifestOf(proj).files["CLAUDE.md"], "manifest is created");
  });

  test("refuses a directory that is not an aspec-kit project", () => {
    const tpl = path.join(tmp, "tpl");
    makeTemplate(tpl);
    fs.mkdirSync(path.join(tmp, "empty"));
    assert.throws(() => runWith(tpl, ["update", "empty"], tmp), /does not look like an aspec-kit project/);
  });

  test("update args are validated", () => {
    assert.deepEqual(parseUpdateArgs(["proj", "--to", "v0.3.0", "--dry-run"]), {
      help: false,
      dryRun: true,
      to: "v0.3.0",
      target: "proj",
    });
    assert.throws(() => parseUpdateArgs(["--to", "main; rm -rf /"]), CliError);
    assert.throws(() => parseUpdateArgs(["--force"]), CliError);
    assert.throws(() => parseUpdateArgs(["a", "b"]), /Unexpected arguments/);
  });

  test("isProtected covers client docs, memory, specs and src only", () => {
    for (const p of ["docs/01-basic-design/a.md", "docs/02-detail-design/x", "docs/03-ui/y",
      "docs/00-glossary.md", "docs/04-decisions/INDEX.md", "docs/05-lessons.md",
      "docs/intake/a.md", "docs/changes/a.md", "docs/qa/a.md", "specs/x/spec.md",
      "src/a.ts", "tests/a.test.ts", ".aspec-kit.json"]) {
      assert.equal(isProtected(p), true, p);
    }
    for (const p of ["docs/TEAM-WORKFLOW.md", "CLAUDE.md", ".claude/agents/a.md", "srcx/a", "docs/10-x"]) {
      assert.equal(isProtected(p), false, p);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// aspec-kit doctor (all side effects injected — no network, no real gh/claude)
// ─────────────────────────────────────────────────────────────────────────────

/** Project that passes every file-based check. */
function makeHealthyProject(root) {
  fs.mkdirSync(path.join(root, ".specify"), { recursive: true });
  writeFile(root, ".claude/commands/design-to-code.md", "Run /speckit-specify then /speckit-x and /speckit-plan\n");
  for (const s of BOOTSTRAP_SKILLS) writeFile(root, `.claude/skills/speckit-${s}/SKILL.md`, "skill");
  writeFile(root, ".github/CODEOWNERS", "# replace @your-lead-handle\ndocs/00-glossary.md  @lead\n");
  writeFile(root, ".claude/hooks/format.sh", "#!/usr/bin/env bash\n# exit 0\ngofmt -w \"$FILE\"\n");
  writeFile(root, ".git/hooks/pre-commit", "# aspec-kit pre-commit hook\n");
  writeFile(root, ".mcp.json", JSON.stringify({ mcpServers: { figma: {} } }));
}

const ALL_TOOLS = () => true;
const PROTECTED = JSON.stringify({
  required_pull_request_reviews: { require_code_owner_reviews: true },
  required_status_checks: { contexts: ["ci"] },
});

/** Fake runner: `responses` maps "cmd arg0 arg1" prefixes to results; records calls. */
function fakeRun(responses = {}) {
  const calls = [];
  const runner = (cmd, args) => {
    const key = [cmd, ...args].join(" ");
    calls.push(key);
    const hit = Object.keys(responses).find((k) => key.startsWith(k));
    return hit ? { stdout: "", stderr: "", status: 0, ...responses[hit] } : { status: 1, stdout: "", stderr: "" };
  };
  runner.calls = calls;
  return runner;
}
const ghOk = (protection = { stdout: PROTECTED }) =>
  fakeRun({ "gh auth status": { status: 0 }, "gh api": protection });

const byId = (report, id) => report.checks.find((c) => c.id === id);

describe("doctor", () => {
  test("healthy project → all ok, exit 0", () => {
    makeHealthyProject(tmp);
    const report = runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: tmp });
    assert.deepEqual(
      report.checks.filter((c) => c.status !== "ok").map((c) => c.id),
      []
    );
    assert.equal(report.ok, true);
  });

  test("missing tools: git/uv/claude fail, python3 warns, uvx alone is enough", () => {
    makeHealthyProject(tmp);
    const none = runDoctor({ cwd: tmp, hasCommand: () => false, run: fakeRun(), homeDir: tmp });
    assert.equal(byId(none, "tool.git").status, "fail");
    assert.equal(byId(none, "tool.uv").status, "fail");
    assert.equal(byId(none, "tool.claude").status, "fail");
    assert.equal(byId(none, "tool.python3").status, "warn");
    assert.ok(byId(none, "tool.git").hint);
    assert.equal(none.ok, false);

    const onlyPipx = runDoctor({ cwd: tmp, hasCommand: (c) => c === "pipx", run: fakeRun(), homeDir: tmp });
    assert.equal(byId(onlyPipx, "tool.uv").status, "ok");
  });

  test("Figma MCP: detected in ~/.claude.json project scope, otherwise warn only", () => {
    makeHealthyProject(tmp);
    fs.rmSync(path.join(tmp, ".mcp.json"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-home-"));
    try {
      let report = runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: home });
      assert.equal(byId(report, "tool.figma-mcp").status, "warn");
      assert.equal(report.ok, true, "a missing Figma MCP must not fail doctor");

      writeFile(home, ".claude.json", JSON.stringify({ projects: { [tmp]: { mcpServers: { Figma: {} } } } }));
      report = runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: home });
      assert.equal(byId(report, "tool.figma-mcp").status, "ok");
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test(".specify/ missing → fail with bootstrap hint", () => {
    makeHealthyProject(tmp);
    fs.rmSync(path.join(tmp, ".specify"), { recursive: true });
    const report = runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: tmp });
    assert.equal(byId(report, "speckit.specify-dir").status, "fail");
    assert.match(byId(report, "speckit.specify-dir").hint, /bootstrap\.sh/);
    assert.equal(byId(report, "speckit.skills"), undefined);
  });

  test("skill referenced by the runbook but not installed → fail (drift guard)", () => {
    makeHealthyProject(tmp);
    writeFile(tmp, ".claude/commands/design-to-code.md", "/speckit-specify /speckit-checklist\n");
    fs.rmSync(path.join(tmp, ".claude/skills/speckit-tasks"), { recursive: true });
    const c = byId(runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: tmp }), "speckit.skills");
    assert.equal(c.status, "fail");
    assert.match(c.message, /speckit-tasks/);
    assert.match(c.message, /speckit-checklist/);
  });

  test("referencedSkills ignores placeholders and dedupes", () => {
    assert.deepEqual(referencedSkills("/speckit-plan /speckit-x /speckit-* /speckit-plan /speckit-tasks"), [
      "plan",
      "tasks",
    ]);
  });

  test("CODEOWNERS placeholder (outside comments) → fail; missing file → fail", () => {
    makeHealthyProject(tmp);
    writeFile(tmp, ".github/CODEOWNERS", "docs/00-glossary.md  @your-lead-handle\n");
    let report = runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: tmp });
    assert.equal(byId(report, "guard.codeowners").status, "fail");
    fs.rmSync(path.join(tmp, ".github/CODEOWNERS"));
    report = runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: tmp });
    assert.equal(byId(report, "guard.codeowners").status, "fail");
  });

  test("format.sh: template no-op is not configured, real command is", () => {
    const template = fs.readFileSync(path.join(REPO_ROOT, ".claude/hooks/format.sh"), "utf-8");
    assert.equal(isFormatHookConfigured(template), false);
    assert.equal(isFormatHookConfigured("#!/bin/sh\nnpx --no-install prettier --write \"$F\"\n"), true);

    makeHealthyProject(tmp);
    writeFile(tmp, ".claude/hooks/format.sh", template);
    const report = runDoctor({ cwd: tmp, hasCommand: ALL_TOOLS, run: ghOk(), homeDir: tmp });
    assert.equal(byId(report, "guard.format-hook").status, "warn");
    assert.equal(report.ok, true);
  });

  describe("branch protection", () => {
    const ctx = (run, hasCommand = ALL_TOOLS) => ({ cwd: tmp, run, hasCommand });

    test("gh not installed → skip without running anything", () => {
      const run = fakeRun();
      const c = checkBranchProtection(ctx(run, (cmd) => cmd !== "gh"));
      assert.equal(c.status, "skip");
      assert.deepEqual(run.calls, []);
    });

    test("gh not authenticated → skip, no api call", () => {
      const run = fakeRun({ "gh auth status": { status: 1 } });
      const c = checkBranchProtection(ctx(run));
      assert.equal(c.status, "skip");
      assert.ok(!run.calls.some((k) => k.startsWith("gh api")));
    });

    test("fully protected → ok; queries main via gh api", () => {
      const run = ghOk();
      assert.equal(checkBranchProtection(ctx(run)).status, "ok");
      assert.ok(run.calls.includes("gh api repos/{owner}/{repo}/branches/main/protection"));
    });

    test("protected without Code Owners review → warn", () => {
      const stdout = JSON.stringify({ required_pull_request_reviews: {}, required_status_checks: {} });
      const c = checkBranchProtection(ctx(ghOk({ stdout })));
      assert.equal(c.status, "warn");
      assert.match(c.message, /Code Owners/);
    });

    test("branch not protected → fail", () => {
      const c = checkBranchProtection(ctx(ghOk({ status: 1, stderr: "gh: Branch not protected (HTTP 404)" })));
      assert.equal(c.status, "fail");
    });

    test("403 → warn; other errors (no remote) → skip", () => {
      assert.equal(checkBranchProtection(ctx(ghOk({ status: 1, stderr: "HTTP 403" }))).status, "warn");
      assert.equal(
        checkBranchProtection(ctx(ghOk({ status: 1, stderr: "none of the git remotes point to a known GitHub host" })))
          .status,
        "skip"
      );
    });
  });

  test("doctorCommand: text vs --json output and exit codes", () => {
    makeHealthyProject(tmp);
    const capture = () => {
      const out = { text: "", write: (s) => (out.text += s) };
      return out;
    };
    const deps = { hasCommand: ALL_TOOLS, run: ghOk(), homeDir: tmp };

    let stdout = capture();
    assert.equal(doctorCommand([tmp], { stdout, ...deps }), 0);
    assert.match(stdout.text, /✓ git: found/);
    assert.match(stdout.text, /0 fail/);

    fs.rmSync(path.join(tmp, ".specify"), { recursive: true });
    stdout = capture();
    assert.equal(doctorCommand(["--json", tmp], { stdout, ...deps }), 1);
    const report = JSON.parse(stdout.text);
    assert.equal(report.ok, false);
    assert.equal(report.summary.fail, 1);
    assert.equal(byId(report, "speckit.specify-dir").status, "fail");

    assert.throws(() => doctorCommand(["--nope"], { stdout: capture(), ...deps }));
    assert.throws(() => doctorCommand([path.join(tmp, "missing")], { stdout: capture(), ...deps }), /Not a directory/);
  });

  test("makeHasCommand finds executables on PATH only", () => {
    const bin = path.join(tmp, "bin");
    writeFile(bin, "mytool", "#!/bin/sh\n");
    fs.chmodSync(path.join(bin, "mytool"), 0o755);
    writeFile(bin, "notexec", "x");
    const has = makeHasCommand({ PATH: bin }, "linux");
    assert.equal(has("mytool"), true);
    assert.equal(has("notexec"), false);
    assert.equal(has("missing"), false);
  });

  test("CLI: doctor --json on a fresh scaffold exits 1 and prints valid JSON", () => {
    makeHealthyProject(tmp);
    fs.rmSync(path.join(tmp, ".specify"), { recursive: true });
    let stdout = "";
    let status = 0;
    try {
      // Empty PATH except node's dir → gh is absent, so no network call is attempted
      stdout = execFileSync(process.execPath, [BIN, "doctor", "--json", tmp], {
        encoding: "utf-8",
        env: { PATH: path.dirname(process.execPath), HOME: tmp },
      });
    } catch (err) {
      status = err.status;
      stdout = err.stdout;
    }
    assert.equal(status, 1);
    const report = JSON.parse(stdout);
    assert.equal(byId(report, "speckit.specify-dir").status, "fail");
    assert.equal(byId(report, "guard.branch-protection").status, "skip");
  });
});

describe("aspec-kit hook", () => {
  test("installHook creates executable pre-commit hook in git repo", () => {
    const gitDir = path.join(tmp, ".git");
    fs.mkdirSync(gitDir, { recursive: true });

    const res = installHook(tmp);
    assert.equal(res.action, "installed");
    assert.ok(fs.existsSync(res.path));

    const content = fs.readFileSync(res.path, "utf-8");
    assert.match(content, /# aspec-kit pre-commit hook/);
    assert.match(content, /Unresolved merge conflict marker/);
    assert.match(content, /docs\/\(01-basic-design\|02-detail-design\|03-ui\)/);
    assert.match(content, /docs\/00-glossary\.md/);
    assert.match(content, /\.claude\/hooks\/format\.sh/);

    const mode = fs.statSync(res.path).mode;
    assert.equal((mode & 0o111) !== 0, true, "hook must be executable");

    // Re-install updates cleanly
    assert.equal(installHook(tmp).action, "updated");
  });

  test("installHook appends block if user has an existing custom pre-commit hook", () => {
    const hooksDir = path.join(tmp, ".git/hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    writeFile(tmp, ".git/hooks/pre-commit", "#!/bin/sh\necho 'my custom hook'\n");

    const res = installHook(tmp);
    assert.equal(res.action, "appended");

    const content = fs.readFileSync(res.path, "utf-8");
    assert.match(content, /my custom hook/);
    assert.match(content, /# BEGIN ASPEC_KIT_HOOK/);
    assert.match(content, /# END ASPEC_KIT_HOOK/);

    // Uninstall unlinks block while preserving custom hook
    const unres = uninstallHook(tmp);
    assert.equal(unres.action, "unlinked_block");
    const preserved = fs.readFileSync(res.path, "utf-8");
    assert.match(preserved, /my custom hook/);
    assert.doesNotMatch(preserved, /# BEGIN ASPEC_KIT_HOOK/);
  });

  test("uninstallHook removes standalone hook", () => {
    const gitDir = path.join(tmp, ".git");
    fs.mkdirSync(gitDir, { recursive: true });
    installHook(tmp);
    assert.equal(checkHookStatus(tmp).installed, true);

    const res = uninstallHook(tmp);
    assert.equal(res.action, "removed");
    assert.equal(fs.existsSync(res.path), false);
    assert.equal(checkHookStatus(tmp).installed, false);
  });

  test("installHook throws if directory is not a git repo", () => {
    assert.throws(() => installHook(tmp), /not a git repository/);
  });

  test("runHook CLI handles subcommands and help", () => {
    const gitDir = path.join(tmp, ".git");
    fs.mkdirSync(gitDir, { recursive: true });

    assert.equal(runHook(["--help"]), 0);
    assert.equal(runHook(["install", tmp]), 0);
    assert.equal(runHook(["status", tmp]), 0);
    assert.equal(runHook(["uninstall", tmp]), 0);
    assert.equal(runHook(["status", tmp]), 1); // Not installed -> exit 1
  });
});

describe("aspec-kit figma sync", () => {
  test("parseFigmaInput handles URLs, file keys, and node-id", () => {
    assert.deepEqual(
      parseFigmaInput("https://www.figma.com/design/AbCdEf12345/App-Design?node-id=1-23"),
      { fileKey: "AbCdEf12345", nodeId: "1:23" }
    );
    assert.deepEqual(
      parseFigmaInput("https://www.figma.com/file/xyz890/Legacy-Link?node-id=4:56"),
      { fileKey: "xyz890", nodeId: "4:56" }
    );
    assert.deepEqual(
      parseFigmaInput("AbCdEf12345"),
      { fileKey: "AbCdEf12345", nodeId: null }
    );
    assert.deepEqual(parseFigmaInput(""), { fileKey: "", nodeId: null });
  });

  test("sanitizeNodeName formats valid file names", () => {
    assert.equal(sanitizeNodeName("Screen / Login & Sign Up"), "screen-login-&-sign-up");
    assert.equal(sanitizeNodeName("Header? *Component* <v1>"), "header-component-v1");
    assert.equal(sanitizeNodeName(""), "unnamed-frame");
  });

  test("extractFrames extracts top-level frames and components", () => {
    const doc = {
      id: "0:0",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          type: "CANVAS",
          name: "Page 1",
          children: [
            {
              id: "1:2",
              type: "FRAME",
              name: "Home Screen",
              absoluteBoundingBox: { width: 375, height: 812 },
              children: [
                { id: "1:3", type: "RECTANGLE", name: "Bg" },
              ],
            },
            {
              id: "1:4",
              type: "COMPONENT",
              name: "Navbar",
              absoluteBoundingBox: { width: 375, height: 60 },
            },
          ],
        },
      ],
    };

    const frames = extractFrames(doc);
    assert.equal(frames.length, 2);
    assert.equal(frames[0].id, "1:2");
    assert.equal(frames[0].name, "Home Screen");
    assert.equal(frames[1].id, "1:4");
  });

  test("recordFigmaLinks creates structured markdown with changelog", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-figma-"));
    const uiDir = path.join(tmp, "docs/03-ui/reservation");
    fs.mkdirSync(uiDir, { recursive: true });

    const linksPath = recordFigmaLinks(uiDir, {
      fileKey: "AbCd123",
      fileName: "Reservation App",
      frames: [{ id: "1:2", name: "List View", width: 400, height: 800 }],
      format: "svg",
      dateStr: "2026-11-01",
    });

    assert.equal(fs.existsSync(linksPath), true);
    const content = fs.readFileSync(linksPath, "utf-8");
    assert.match(content, /# UI Reference — Figma Live Assets/);
    assert.match(content, /List View/);
    assert.match(content, /\*\*Node ID:\*\* `1:2`/);
    assert.match(content, /screens\/list-view\.svg/);
    assert.match(content, /## CHANGELOG UI/);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test("syncFigma downloads SVG wireframes and updates figma-links.md via mock fetch", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-figma-"));

    const mockFetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes("/files/test-file-key")) {
        return {
          ok: true,
          json: async () => ({
            name: "Mock Wireframes",
            document: {
              type: "DOCUMENT",
              children: [
                {
                  type: "CANVAS",
                  children: [
                    { id: "10:1", type: "FRAME", name: "User Profile", absoluteBoundingBox: { width: 375, height: 812 } },
                  ],
                },
              ],
            },
          }),
        };
      }
      if (urlStr.includes("/images/test-file-key")) {
        return {
          ok: true,
          json: async () => ({
            images: {
              "10:1": "https://figma-export.mock/10-1.svg",
            },
          }),
        };
      }
      if (urlStr.includes("figma-export.mock")) {
        return {
          ok: true,
          text: async () => `<svg viewBox="0 0 375 812"><text>Mock Screen</text></svg>`,
        };
      }
      return { ok: false, status: 404 };
    };

    const res = await syncFigma({
      input: "test-file-key",
      slug: "mock-feature",
      token: "mock-token",
      dir: tmp,
      fetchFn: mockFetch,
      logger: { log: () => {} },
    });

    assert.equal(res.count, 1);
    assert.equal(res.slug, "mock-feature");

    const savedSvg = path.join(tmp, "docs/03-ui/mock-feature/screens/user-profile.svg");
    assert.equal(fs.existsSync(savedSvg), true);
    assert.match(fs.readFileSync(savedSvg, "utf-8"), /Mock Screen/);

    const linksMd = path.join(tmp, "docs/03-ui/mock-feature/figma-links.md");
    assert.equal(fs.existsSync(linksMd), true);
    assert.match(fs.readFileSync(linksMd, "utf-8"), /User Profile/);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test("syncFigma throws FigmaError when token is missing", async () => {
    const oldToken = process.env.FIGMA_PERSONAL_TOKEN;
    delete process.env.FIGMA_PERSONAL_TOKEN;
    try {
      await assert.rejects(
        async () => {
          await syncFigma({ input: "any-key", token: "" });
        },
        FigmaError
      );
    } finally {
      if (oldToken) process.env.FIGMA_PERSONAL_TOKEN = oldToken;
    }
  });
});

describe("aspec-kit view / dashboard", () => {
  test("parseCsv handles commas, multiline fields, and quotes", () => {
    const csv = `"No","Title","Notes"\n"1","Hello, World","Line 1\nLine 2"\n"2","Simple",""`;
    const rows = parseCsv(csv);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], ["No", "Title", "Notes"]);
    assert.equal(rows[1][1], "Hello, World");
    assert.equal(rows[1][2], "Line 1\nLine 2");
    assert.equal(rows[2][0], "2");
  });

  test("collectDashboardData parses deliverables from project directory", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-dash-"));
    const qaDir = path.join(tmp, "docs/qa");
    const testSpecDir = path.join(tmp, "docs/test-specs");
    const reportsDir = path.join(tmp, "docs/reports");
    fs.mkdirSync(qaDir, { recursive: true });
    fs.mkdirSync(testSpecDir, { recursive: true });
    fs.mkdirSync(reportsDir, { recursive: true });

    // Mock traceability.md
    fs.writeFileSync(
      path.join(tmp, "docs/traceability.md"),
      `# Traceability Matrix\n\n| AC | Mô tả | Nguồn | Tasks | Files | Tests | Trạng thái |\n|---|---|---|---|---|---|---|\n| **AC 1** | Desc 1 | Source | T1 | file.ts | test.ts | ✅ Covered |\n`
    );

    // Mock Q&A CSV
    fs.writeFileSync(
      path.join(qaDir, "001-feature.csv"),
      `"No","対象画面/機能","質問内容","背景・提案","回答欄","回答期限","ステータス"\n"Q-01","SCR-01","Question?","Background","Answer","2026-11-01","回答済"\n`
    );

    // Mock Test Spec CSV
    fs.writeFileSync(
      path.join(testSpecDir, "001-feature.csv"),
      `"No","観点","前提条件","手順","期待結果","結果","備考"\n"TC-01","Login","Valid","Step 1","Expect 1","OK","AC 1"\n`
    );

    // Mock Weekly Report
    fs.writeFileSync(
      path.join(reportsDir, "2026-10-31-progress.md"),
      `# Weekly Report — Feature 001\n\nCompleted tasks.\n`
    );

    const data = collectDashboardData(tmp);
    assert.equal(data.traceability.length, 1);
    assert.equal(data.traceability[0].ac, "AC 1");
    assert.equal(data.qaSheets.length, 1);
    assert.equal(data.qaSheets[0].items.length, 1);
    assert.equal(data.qaSheets[0].items[0]["No"], "Q-01");
    assert.equal(data.testSpecs.length, 1);
    assert.equal(data.testSpecs[0].items[0]["No"], "TC-01");
    assert.equal(data.reports.length, 1);
    assert.equal(data.reports[0].title, "Weekly Report — Feature 001");

    const html = renderDashboardHtml(data);
    assert.match(html, /aspec-kit Deliverables Dashboard/);
    assert.match(html, /要件トレーサビリティマトリクス/);
    assert.match(html, /Q-01/);
    assert.match(html, /TC-01/);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test("startDashboardServer spins up HTTP server and answers /api/data & /", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-server-"));
    const serverInstance = await startDashboardServer({
      projectDir: tmp,
      port: 0, // dynamic port
      host: "127.0.0.1",
      logger: { log: () => {} },
    });

    const addr = serverInstance.server.address();
    const port = addr.port;

    // Test GET /
    const htmlRes = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(htmlRes.status, 200);
    const htmlText = await htmlRes.text();
    assert.match(htmlText, /<!DOCTYPE html>/);
    assert.match(htmlText, /aspec-kit Deliverables Dashboard/);

    // Test GET /api/data
    const jsonRes = await fetch(`http://127.0.0.1:${port}/api/data`);
    assert.equal(jsonRes.status, 200);
    const jsonData = await jsonRes.json();
    assert.equal(Array.isArray(jsonData.traceability), true);
    assert.equal(Array.isArray(jsonData.qaSheets), true);

    await serverInstance.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test("exportDashboardHtml writes self-contained static deliverables.html", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-export-"));
    const dest = exportDashboardHtml(tmp, null, { log: () => {} });

    assert.equal(fs.existsSync(dest), true);
    assert.equal(dest, path.join(tmp, "docs/deliverables.html"));

    const content = fs.readFileSync(dest, "utf8");
    assert.match(content, /<!DOCTYPE html>/);
    assert.match(content, /aspec-kit Deliverables Dashboard/);
    assert.match(content, /DASHBOARD_DATA/);

    // Custom output path
    const customDest = path.join(tmp, "custom/report.html");
    exportDashboardHtml(tmp, customDest, { log: () => {} });
    assert.equal(fs.existsSync(customDest), true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("aspec-kit figma diff", () => {
  test("extractSvgDimensions reads width, height and viewBox", () => {
    const svg1 = `<svg width="400px" height="300px"><rect /></svg>`;
    const dims1 = extractSvgDimensions(svg1);
    assert.equal(dims1.width, 400);
    assert.equal(dims1.height, 300);

    const svg2 = `<svg viewBox="0 0 1024 768"></svg>`;
    const dims2 = extractSvgDimensions(svg2);
    assert.equal(dims2.width, 1024);
    assert.equal(dims2.height, 768);
  });

  test("parseSvgElements extracts text, rects, and circles", () => {
    const svg = `
      <svg viewBox="0 0 500 500">
        <rect x="10" y="20" width="100" height="40" fill="#38bdf8" />
        <text x="25" y="45" fill="#ffffff" font-size="14">Submit</text>
        <circle cx="50" cy="50" r="15" fill="#ef4444" />
      </svg>
    `;
    const elements = parseSvgElements(svg);
    assert.equal(elements.length, 3);
    assert.equal(elements[0].type, "text");
    assert.equal(elements[0].text, "Submit");
    assert.equal(elements[1].type, "rect");
    assert.equal(elements[1].width, 100);
    assert.equal(elements[2].type, "circle");
    assert.equal(elements[2].r, 15);
  });

  test("diffSvgElements detects added, removed, and modified elements", () => {
    const oldSvg = `
      <svg viewBox="0 0 500 500">
        <rect x="10" y="20" width="100" height="40" fill="#000000" />
        <text x="25" y="45" fill="#ffffff">Old Title</text>
        <circle cx="200" cy="200" r="10" />
      </svg>
    `;
    const newSvg = `
      <svg viewBox="0 0 500 500">
        <rect x="10" y="20" width="100" height="40" fill="#38bdf8" />
        <text x="25" y="80" fill="#ffffff">Old Title</text>
        <text x="50" y="150" fill="#22c55e">New Button</text>
      </svg>
    `;

    const oldEl = parseSvgElements(oldSvg);
    const newEl = parseSvgElements(newSvg);
    const diff = diffSvgElements(oldEl, newEl);

    // Added: "New Button"
    assert.equal(diff.added.length, 1);
    assert.equal(diff.added[0].text, "New Button");

    // Removed: circle
    assert.equal(diff.removed.length, 1);
    assert.equal(diff.removed[0].type, "circle");

    // Modified: rect fill changed & text position moved
    assert.equal(diff.modified.length, 2);
  });

  test("compareFigmaSvgFiles generates overlay SVG and Markdown report", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-diff-"));
    const v1Path = path.join(tmp, "reservation-v1.svg");
    const v2Path = path.join(tmp, "reservation-v2.svg");

    fs.writeFileSync(
      v1Path,
      `<svg viewBox="0 0 400 300"><text x="10" y="30">Screen V1</text><rect x="20" y="50" width="80" height="30" fill="#ccc"/></svg>`
    );
    fs.writeFileSync(
      v2Path,
      `<svg viewBox="0 0 400 300"><text x="10" y="30">Screen V1</text><rect x="20" y="50" width="80" height="30" fill="#00f"/><text x="120" y="50">New Field</text></svg>`
    );

    const res = await compareFigmaSvgFiles(v1Path, v2Path, {
      outDir: path.join(tmp, "diffs"),
      logger: { log: () => {} },
    });

    assert.equal(fs.existsSync(res.overlaySvgPath), true);
    assert.equal(fs.existsSync(res.mdReportPath), true);

    const svgContent = fs.readFileSync(res.overlaySvgPath, "utf8");
    assert.match(svgContent, /Figma Visual Diff Legend/);
    assert.match(svgContent, /rgba\(34, 197, 94/); // green highlight

    const mdContent = fs.readFileSync(res.mdReportPath, "utf8");
    assert.match(mdContent, /画面デザイン差分報告書/);
    assert.match(mdContent, /New Field/);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
