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
  CliError,
  DEFAULT_EXCLUDES,
  applySteward,
  copyTemplate,
  isExcluded,
  listTemplateFiles,
  normalizeSteward,
  parseCliArgs,
  readIgnoreFile,
  removeSampleFeature,
  writeProjectReadme,
} from "../src/index.js";

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
});
