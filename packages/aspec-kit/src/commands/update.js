// `aspec-kit update` — upgrade the kit-owned template files of an existing project.
// Per file it compares base (hash in .aspec-kit.json), ours (disk) and theirs (new template):
//   ours == base            → overwrite with theirs
//   base == theirs          → keep (changed only locally)
//   ours != base != theirs  → conflict: write <file>.aspec-new, never overwrite
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  CODEOWNERS_PLACEHOLDER,
  CliError,
  DEFAULT_EXCLUDES,
  fetchTemplate,
  isExcluded,
  listTemplateFiles,
  readIgnoreFile,
} from "../index.js";
import { MANIFEST_FILE, buildManifest, hashContent, hashFile, readManifest, writeManifest } from "../manifest.js";
import { DEFAULT_LANG, resolveLangSourcePath } from "../lang.js";

export const CONFLICT_SUFFIX = ".aspec-new";

/** Project-owned paths: client design docs, memory, specs and code. `update` never touches them. */
export const PROTECTED_PATHS = Object.freeze([
  "docs/00-glossary.md",
  "docs/04-decisions",
  "docs/05-lessons.md",
  "docs/intake",
  "specs",
  "src",
  MANIFEST_FILE,
]);
// docs/01-basic-design, docs/02-detail-design, docs/03-ui (and any other docs/01-*…03-* folder)
const PROTECTED_DOCS_RE = /^docs\/0[1-3]-/;

const GIT_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

const UPDATE_HELP = `Usage:
  npx @hoanghainh/aspec-kit update [project-directory] [options]

Upgrades kit-owned files (agents, runbooks, hooks, CI…) of a project created by aspec-kit,
using the hashes recorded in ${MANIFEST_FILE} to tell your edits from template changes:
  - unchanged locally         → updated to the new template
  - changed only locally      → kept as-is
  - changed on both sides     → conflict: kept as-is, new version written to <file>${CONFLICT_SUFFIX}
Never touched: docs/01-* docs/02-* docs/03-*, docs/00-glossary.md, docs/04-decisions/,
docs/05-lessons.md, docs/intake/, specs/, src/.

Options:
  --to <ref>             Git tag/branch of the template to upgrade to
                         (default: v<cli-version>, falls back to 'main' if the tag is missing)
  --dry-run              Print the planned changes without writing anything
  -h, --help             Display this help message
`;

export function isProtected(relPath) {
  return PROTECTED_DOCS_RE.test(relPath) || isExcluded(relPath, PROTECTED_PATHS);
}

export function parseUpdateArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        "dry-run": { type: "boolean" },
        to: { type: "string" },
      },
    });
  } catch (err) {
    throw new CliError(`${err.message}\nRun 'aspec-kit update --help' to see available options.`);
  }
  const { values, positionals } = parsed;
  if (positionals.length > 1) {
    throw new CliError(`Unexpected arguments: ${positionals.slice(1).join(" ")}`);
  }
  const to = values.to ?? null;
  if (to !== null && !GIT_REF_RE.test(to)) {
    throw new CliError(`Invalid --to "${to}".`);
  }
  return {
    help: Boolean(values.help),
    dryRun: Boolean(values["dry-run"]),
    to,
    target: positionals[0] ?? null,
  };
}

/** Template content as it would be scaffolded (CODEOWNERS gets the recorded steward; localized files resolve via lang). */
function readTheirs(templateDir, rel, steward, lang = DEFAULT_LANG) {
  const srcPath = resolveLangSourcePath(templateDir, rel, lang);
  const buf = fs.readFileSync(srcPath);
  if (rel === ".github/CODEOWNERS" && steward) {
    return Buffer.from(buf.toString("utf-8").split(CODEOWNERS_PLACEHOLDER).join(steward), "utf-8");
  }
  return buf;
}

/**
 * Decide what to do with every kit-owned file. Reads only; writes nothing.
 * Each entry: { rel, action, theirs?: Buffer, mode?: number }, where action is one of
 * add | update | unchanged | keep | conflict | remove | keep-removed | deleted-locally | protected.
 * `files` is the refreshed manifest file map to write once the plan is applied.
 */
export function planUpdate({ projectDir, templateDir, manifest }) {
  const excludes = [...new Set([...DEFAULT_EXCLUDES, ...readIgnoreFile(templateDir)])];
  const templateFiles = new Set(
    listTemplateFiles(templateDir, excludes).filter((rel) => !rel.endsWith(CONFLICT_SUFFIX))
  );
  const baseFiles = manifest?.files ?? {};
  const steward = manifest?.steward ?? null;
  const lang = manifest?.lang ?? DEFAULT_LANG;
  const all = [...new Set([...templateFiles, ...Object.keys(baseFiles)])].sort();

  const entries = [];
  const files = {};
  for (const rel of all) {
    const base = baseFiles[rel] ?? null;
    if (isProtected(rel)) {
      if (base) files[rel] = base;
      if (templateFiles.has(rel)) entries.push({ rel, action: "protected" });
      continue;
    }

    const ours = hashFile(path.join(projectDir, rel));
    if (!templateFiles.has(rel)) {
      // Removed upstream: delete only if untouched locally; either way it is no longer kit-owned
      if (ours === null) continue;
      entries.push({ rel, action: ours === base ? "remove" : "keep-removed" });
      continue;
    }

    const theirsBuf = readTheirs(templateDir, rel, steward, lang);
    const theirs = hashContent(theirsBuf);
    const mode = fs.statSync(path.join(templateDir, rel)).mode;
    files[rel] = theirs;

    let action;
    if (ours === null) action = base ? "deleted-locally" : "add";
    else if (ours === theirs) action = "unchanged";
    else if (base && ours === base) action = "update";
    else if (base === theirs) action = "keep";
    else action = "conflict"; // includes files with no recorded base (projects without a manifest)
    entries.push({ rel, action, theirs: theirsBuf, mode });
  }
  return { entries, files };
}

/** Write the plan to disk. Conflicting files are never overwritten. */
export function applyUpdate(projectDir, plan) {
  for (const { rel, action, theirs, mode } of plan.entries) {
    const dest = path.join(projectDir, rel);
    if (action === "add" || action === "update") {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, theirs);
      fs.chmodSync(dest, mode);
    } else if (action === "conflict") {
      fs.writeFileSync(`${dest}${CONFLICT_SUFFIX}`, theirs);
    } else if (action === "remove") {
      fs.rmSync(dest, { force: true });
    }
  }
}

const SECTIONS = [
  ["add", "Added"],
  ["update", "Updated"],
  ["remove", "Removed (deleted from template, unchanged locally)"],
  ["conflict", `Conflicts (kept your version, new template written to <file>${CONFLICT_SUFFIX})`],
  ["keep", "Kept (changed only locally)"],
  ["keep-removed", "Kept (deleted from template but changed locally — no longer kit-managed)"],
  ["deleted-locally", "Skipped (you deleted it)"],
];

function printPlan(plan, dryRun) {
  const byAction = (a) => plan.entries.filter((e) => e.action === a).map((e) => e.rel);
  const prefix = dryRun ? "[dry-run] " : "";
  for (const [action, title] of SECTIONS) {
    const list = byAction(action);
    if (list.length === 0) continue;
    console.log(`${prefix}${title} (${list.length}):`);
    for (const rel of list) console.log(`   - ${rel}`);
  }
  console.log(
    `Up to date: ${byAction("unchanged").length} · protected (never touched): ${byAction("protected").length}`
  );
}

/**
 * Entry point for `aspec-kit update`. Returns the plan (useful for tests), or null for --help.
 * @param {string[]} argv arguments after "update"
 * @param {{ cliVersion: string }} ctx
 */
export async function runUpdate(argv, { cliVersion }) {
  const opts = parseUpdateArgs(argv);
  if (opts.help) {
    console.log(UPDATE_HELP);
    return null;
  }

  const projectDir = path.resolve(process.cwd(), opts.target ?? ".");
  const manifest = readManifest(projectDir);
  if (!manifest && !fs.existsSync(path.join(projectDir, "CLAUDE.md"))) {
    throw new CliError(`${projectDir} does not look like an aspec-kit project (no ${MANIFEST_FILE} or CLAUDE.md).`);
  }
  if (!manifest) {
    console.log(
      `⚠ No ${MANIFEST_FILE} found (project created before aspec-kit tracked versions). ` +
        "Files that differ from the new template are treated as locally modified."
    );
  }

  const handle = await fetchTemplate({ templateRef: opts.to, cliVersion });
  try {
    console.log(
      `==> Comparing ${manifest ? `template ${manifest.templateRef}` : "project"} with ${handle.ref}` +
        (opts.dryRun ? " (dry run)" : "")
    );
    const plan = planUpdate({ projectDir, templateDir: handle.dir, manifest });
    printPlan(plan, opts.dryRun);

    if (opts.dryRun) {
      console.log("\nDry run — no files were written.");
      return plan;
    }
    applyUpdate(projectDir, plan);
    writeManifest(
      projectDir,
      buildManifest({
        templateRef: handle.ref,
        cliVersion,
        steward: manifest?.steward ?? null,
        lang: manifest?.lang ?? null,
        files: plan.files,
      })
    );
    const conflicts = plan.entries.filter((e) => e.action === "conflict").length;
    console.log(`\n✓ Updated to template ${handle.ref} and refreshed ${MANIFEST_FILE}`);
    if (conflicts > 0) {
      console.log(
        `⚠ ${conflicts} conflict(s): merge each <file>${CONFLICT_SUFFIX} into <file> by hand, then delete it.`
      );
    }
    return plan;
  } finally {
    handle.cleanup();
  }
}
