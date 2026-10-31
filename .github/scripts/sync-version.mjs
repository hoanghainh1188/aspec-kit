#!/usr/bin/env node
// sync-version.mjs — keep every version field of the kit in lock-step and extract CHANGELOG release notes.
//
// Usage:
//   node .github/scripts/sync-version.mjs 0.3.0                  # write version to all files
//   node .github/scripts/sync-version.mjs --check                # verify all files agree + CHANGELOG entry exists (CI)
//   node .github/scripts/sync-version.mjs --check v0.3.0         # verify all files equal the given tag + CHANGELOG entry
//   node .github/scripts/sync-version.mjs --extract-notes [tag]  # print CHANGELOG.md section for the version to stdout
//
// Why it matters: the CLI downloads the template from tag `v<package.json version>`, so the
// tagged commit MUST carry the same version in package.json (and plugin.json for consistency).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILES = ["packages/aspec-kit/package.json", ".claude-plugin/plugin.json"];
const CHANGELOG_FILE = path.join(ROOT, "CHANGELOG.md");
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const readVersion = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf-8")).version;

function writeVersion(rel, version) {
  const abs = path.join(ROOT, rel);
  const data = JSON.parse(fs.readFileSync(abs, "utf-8"));
  data.version = version;
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

/**
 * Extract the release notes body for `## [<version>]` from CHANGELOG.md.
 * Returns null if CHANGELOG.md or the version heading is missing.
 */
export function extractChangelogSection(version, changelogPath = CHANGELOG_FILE) {
  if (!fs.existsSync(changelogPath)) return null;
  const lines = fs.readFileSync(changelogPath, "utf-8").split(/\r?\n/);
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRe = new RegExp(`^##\\s+\\[${escaped}\\](?:\\s+-\\s+\\S+)?\\s*$`);
  const nextHeadingRe = /^##\s+\[/;
  const linkRefRe = /^\[[^\]]+\]:\s+https?:\/\//;

  let inside = false;
  const body = [];
  for (const line of lines) {
    if (!inside) {
      if (startRe.test(line)) {
        inside = true;
      }
      continue;
    }
    if (nextHeadingRe.test(line) || linkRefRe.test(line)) {
      break;
    }
    body.push(line);
  }
  if (!inside) return null;
  return body.join("\n").trim();
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const extractNotes = args.includes("--extract-notes");
const explicit = args.find((a) => !a.startsWith("--"))?.replace(/^v/, "");

if (explicit && !SEMVER_RE.test(explicit)) {
  console.error(`✗ Invalid version "${explicit}"`);
  process.exit(1);
}

if (extractNotes) {
  const targetVersion = explicit ?? readVersion(FILES[0]);
  const notes = extractChangelogSection(targetVersion);
  if (!notes) {
    console.error(`✗ CHANGELOG.md has no non-empty section for [${targetVersion}]`);
    process.exit(1);
  }
  process.stdout.write(`${notes}\n`);
} else if (check) {
  const versions = Object.fromEntries(FILES.map((f) => [f, readVersion(f)]));
  const expected = explicit ?? versions[FILES[0]];
  const mismatched = Object.entries(versions).filter(([, v]) => v !== expected);
  if (mismatched.length > 0) {
    console.error(`✗ Version mismatch (expected ${expected}):`);
    for (const [f, v] of Object.entries(versions)) console.error(`   ${f}: ${v}`);
    console.error("  → run: node .github/scripts/sync-version.mjs <version>");
    process.exit(1);
  }
  const notes = extractChangelogSection(expected);
  if (!notes) {
    console.error(`✗ CHANGELOG.md is missing a non-empty section for ## [${expected}]`);
    process.exit(1);
  }
  console.log(`✓ All versions = ${expected} (CHANGELOG section verified)`);
} else {
  if (!explicit) {
    console.error("Usage: sync-version.mjs <version> | --check [tag] | --extract-notes [tag]");
    process.exit(1);
  }
  for (const f of FILES) writeVersion(f, explicit);
  console.log(`✓ Set version ${explicit} in: ${FILES.join(", ")}`);
}
