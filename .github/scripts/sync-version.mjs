#!/usr/bin/env node
// sync-version.mjs — keep every version field of the kit in lock-step.
//
// Usage:
//   node .github/scripts/sync-version.mjs 0.2.0          # write version to all files
//   node .github/scripts/sync-version.mjs --check        # verify all files agree (CI)
//   node .github/scripts/sync-version.mjs --check v0.2.0 # verify all files equal the given tag
//
// Why it matters: the CLI downloads the template from tag `v<package.json version>`, so the
// tagged commit MUST carry the same version in package.json (and plugin.json for consistency).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILES = ["packages/aspec-kit/package.json", ".claude-plugin/plugin.json"];
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const readVersion = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf-8")).version;

function writeVersion(rel, version) {
  const abs = path.join(ROOT, rel);
  const data = JSON.parse(fs.readFileSync(abs, "utf-8"));
  data.version = version;
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const explicit = args.find((a) => !a.startsWith("--"))?.replace(/^v/, "");

if (explicit && !SEMVER_RE.test(explicit)) {
  console.error(`✗ Invalid version "${explicit}"`);
  process.exit(1);
}

if (check) {
  const versions = Object.fromEntries(FILES.map((f) => [f, readVersion(f)]));
  const expected = explicit ?? versions[FILES[0]];
  const mismatched = Object.entries(versions).filter(([, v]) => v !== expected);
  if (mismatched.length > 0) {
    console.error(`✗ Version mismatch (expected ${expected}):`);
    for (const [f, v] of Object.entries(versions)) console.error(`   ${f}: ${v}`);
    console.error("  → run: node .github/scripts/sync-version.mjs <version>");
    process.exit(1);
  }
  console.log(`✓ All versions = ${expected}`);
} else {
  if (!explicit) {
    console.error("Usage: sync-version.mjs <version> | --check [tag]");
    process.exit(1);
  }
  for (const f of FILES) writeVersion(f, explicit);
  console.log(`✓ Set version ${explicit} in: ${FILES.join(", ")}`);
}
