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
  SUPPORTED_AGENTS,
  applyAgents,
  applySteward,
  copyTemplate,
  isExcluded,
  listTemplateFiles,
  normalizeAgents,
  normalizeSteward,
  parseCliArgs,
  readIgnoreFile,
  removeSampleFeature,
  writeProjectReadme,
} from "../src/index.js";
import { isProtected, parseUpdateArgs } from "../src/commands/update.js";
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
    const files = listTemplateFiles(src, [...DEFAULT_EXCLUDES, ...readIgnoreFile(src)]);
    for (const banned of [
      ".github/workflows/publish-npm.yml",
      "packages/aspec-kit/package.json",
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

    for (const must of ["CLAUDE.md", "bootstrap.sh", ".claude/settings.json", "README.md"]) {
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
      "docs/intake/a.md", "specs/x/spec.md", "src/a.ts", ".aspec-kit.json"]) {
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
