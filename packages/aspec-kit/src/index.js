// Implementation of aspec-kit CLI generator using native Node.js (zero dependencies)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { execFileSync } from "node:child_process";
import https from "node:https";
import { parseArgs } from "node:util";
import { doctorCommand } from "./commands/doctor.js";

const GITHUB_OWNER_REPO = "hoanghainh1188/aspec-kit";
const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER_REPO}.git`;
const TARBALL_BASE_URL = `https://codeload.github.com/${GITHUB_OWNER_REPO}/tar.gz`;

// Placeholder used in the template's .github/CODEOWNERS
const CODEOWNERS_PLACEHOLDER = "@your-lead-handle";
// Default steward value meaning "user did not provide one"
const DEFAULT_STEWARD = "@your-handle";

/**
 * Paths (relative, POSIX style) from the kit repository that must NOT be copied into a
 * scaffolded project. They belong to the kit itself (packaging, release, marketing).
 * The template may extend this list with a root-level `.aspecignore` file.
 */
export const DEFAULT_EXCLUDES = Object.freeze([
  ".git",
  ".aspecignore",
  "packages",
  "assets",
  "plugin",
  ".claude-plugin",
  ".github/workflows/publish-npm.yml",
  ".github/workflows/kit-ci.yml",
  ".github/scripts/sync-version.mjs",
  "CONTRIBUTING.md",
  "LICENSE",
  // Kit README is replaced by a project README stub (see writeProjectReadme)
  "README.md",
]);

/** Files/directories that make up the removable sample feature. */
export const SAMPLE_FEATURE_PATHS = Object.freeze([
  "specs/000-example-reservation",
  "src/features/example-reservation",
  "docs/intake/000-example-reservation.md",
  "docs/04-decisions/2026-01-01-approval-vs-confirm.md",
  "docs/02-detail-design/example-reservation",
  "docs/changes/2026-10-31-example-reservation.md",
]);

/** Shared files that reference the sample feature and must be filtered line-by-line. */
const SAMPLE_REFERENCING_FILES = Object.freeze([
  "docs/04-decisions/INDEX.md",
  "docs/05-lessons.md",
]);

// Color helpers
const isColorSupported =
  !process.env.NO_COLOR &&
  (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);

const CYAN = isColorSupported ? "\x1b[36m" : "";
const YELLOW = isColorSupported ? "\x1b[33m" : "";
const BOLD = isColorSupported ? "\x1b[1m" : "";
const DIM = isColorSupported ? "\x1b[2m" : "";
const RESET = isColorSupported ? "\x1b[0m" : "";

const ASCII_LOGO = String.raw`
    ___   _____ ____  ______ ______        __ __ ____ ______
   /   | / ___// __ \/ ____// ____/       / //_//  _//_  __/
  / /| | \__ \/ /_/ / __/  / /   ______  / ,<   / /   / /   
 / ___ |___/ / ____/ /___ / /___/_____/ / /| |_/ /   / /    
/_/  |_/____/_/   /_____/ \____/       /_/ |_/___/  /_/     
`;

const HELP_TEXT = `Usage:
  npx @hoanghainh/aspec-kit init [project-directory] [options]
  npx @hoanghainh/aspec-kit [project-directory] [options]
  npm init @hoanghainh/aspec-kit [project-directory] [options]

Commands:
  init [dir]             Initialize a new aspec-kit project (use '.' for current dir)
  doctor [dir] [--json]  Check environment & guardrails of a project (exit 1 on failure)

Options:
  -v, --version          Display CLI version
  -h, --help             Display this help message
  -y, --yes              Use default settings without interactive prompts
  --steward <handle>     GitHub handle (or @org/team, or email) for .github/CODEOWNERS
  --keep-example         Keep sample feature (000-example-reservation)
  --clean                Clean up sample feature
  --force                Overwrite files that already exist in the target directory
                         (default: existing files are kept and reported as skipped)
  --template-ref <ref>   Git tag/branch of the template to fetch
                         (default: v<cli-version>, falls back to 'main' if the tag is missing)

Examples:
  npx @hoanghainh/aspec-kit init my-app
  npx @hoanghainh/aspec-kit init .
  npm init @hoanghainh/aspec-kit my-app
  npx @hoanghainh/aspec-kit my-app --steward @lead-engineer --clean
  npx @hoanghainh/aspec-kit doctor --json
`;

export class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliError";
  }
}

function printBanner(version) {
  console.log(CYAN + BOLD + ASCII_LOGO + RESET);
  console.log(DIM + "   Spec-Driven Development for Claude Code & Japanese Design Docs" + RESET);
  console.log(DIM + `   Version: v${version}\n` + RESET);
}

function warn(message) {
  console.warn(`${YELLOW}⚠ ${message}${RESET}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument parsing & validation
// ─────────────────────────────────────────────────────────────────────────────

const GITHUB_HANDLE_RE = /^@?[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\/[A-Za-z0-9._-]+)?$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Restrict refs to safe characters (they are passed to git / used in URLs)
const GIT_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/**
 * Normalize a CODEOWNERS owner: GitHub user/team gets an "@" prefix, emails are kept as-is.
 * Throws CliError on invalid input.
 */
export function normalizeSteward(raw) {
  const value = String(raw ?? "").trim();
  if (EMAIL_RE.test(value) && !value.startsWith("@")) {
    return value;
  }
  if (!GITHUB_HANDLE_RE.test(value)) {
    throw new CliError(
      `Invalid steward "${value}". Expected a GitHub handle (@user), team (@org/team) or email.`
    );
  }
  return value.startsWith("@") ? value : `@${value}`;
}

/**
 * Parse CLI arguments into a normalized options object.
 * Unknown flags or missing option values raise CliError (strict mode).
 */
export function parseCliArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        yes: { type: "boolean", short: "y" },
        steward: { type: "string" },
        "keep-example": { type: "boolean" },
        clean: { type: "boolean" },
        force: { type: "boolean" },
        "template-ref": { type: "string" },
      },
    });
  } catch (err) {
    throw new CliError(`${err.message}\nRun with --help to see available options.`);
  }

  const { values, positionals } = parsed;

  if (values["keep-example"] && values.clean) {
    throw new CliError("--keep-example and --clean cannot be used together.");
  }

  const rest = [...positionals];
  // Optional explicit subcommand
  if (rest[0] === "init") {
    rest.shift();
  }
  if (rest.length > 1) {
    throw new CliError(`Unexpected arguments: ${rest.slice(1).join(" ")}`);
  }

  const templateRef = values["template-ref"] ?? null;
  if (templateRef !== null && !GIT_REF_RE.test(templateRef)) {
    throw new CliError(`Invalid --template-ref "${templateRef}".`);
  }

  return {
    help: Boolean(values.help),
    version: Boolean(values.version),
    yes: Boolean(values.yes),
    steward: values.steward !== undefined ? normalizeSteward(values.steward) : null,
    // null = ask the user; true/false = decided by flag
    keepExample: values["keep-example"] ? true : values.clean ? false : null,
    force: Boolean(values.force),
    templateRef,
    target: rest[0] ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template copy (safe by default: never overwrite existing files unless --force)
// ─────────────────────────────────────────────────────────────────────────────

const toPosix = (p) => p.split(path.sep).join("/");

/** Read extra exclude entries from `<templateDir>/.aspecignore` (one path per line, # comments). */
export function readIgnoreFile(templateDir) {
  const ignorePath = path.join(templateDir, ".aspecignore");
  if (!fs.existsSync(ignorePath)) return [];
  return fs
    .readFileSync(ignorePath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^\/+/, "").replace(/\/+$/, ""));
}

export function isExcluded(relPath, excludes) {
  return excludes.some((e) => relPath === e || relPath.startsWith(`${e}/`));
}

/** List template files (relative POSIX paths), skipping excluded entries. */
export function listTemplateFiles(templateDir, excludes) {
  const out = [];
  const walk = (dirRel) => {
    const dirAbs = path.join(templateDir, dirRel);
    for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
      const rel = toPosix(path.join(dirRel, entry.name));
      if (isExcluded(rel, excludes)) continue;
      if (entry.isDirectory()) {
        walk(rel);
      } else {
        out.push(rel);
      }
    }
  };
  walk("");
  return out.sort();
}

/**
 * Copy template files into targetDir.
 * Existing files are skipped unless `force` is true (then they are overwritten).
 * Returns the lists of copied / skipped / overwritten relative paths.
 */
export function copyTemplate(templateDir, targetDir, { force = false, excludes = DEFAULT_EXCLUDES } = {}) {
  const allExcludes = [...new Set([...excludes, ...readIgnoreFile(templateDir)])];
  const files = listTemplateFiles(templateDir, allExcludes);
  const result = { copied: [], skipped: [], overwritten: [] };

  fs.mkdirSync(targetDir, { recursive: true });
  for (const rel of files) {
    const src = path.join(templateDir, rel);
    const dest = path.join(targetDir, rel);
    const exists = fs.existsSync(dest);
    if (exists && !force) {
      result.skipped.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    // Preserve executable bit (e.g. bootstrap.sh, hooks)
    fs.chmodSync(dest, fs.statSync(src).mode);
    (exists ? result.overwritten : result.copied).push(rel);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-copy customization — only ever touches files written by this CLI run
// ─────────────────────────────────────────────────────────────────────────────

/** Replace CODEOWNERS placeholder. Returns true if the file was updated. */
export function applySteward(targetDir, steward, ownedFiles) {
  const rel = ".github/CODEOWNERS";
  if (!steward || steward === DEFAULT_STEWARD || !ownedFiles.has(rel)) return false;
  const filePath = path.join(targetDir, rel);
  const content = fs.readFileSync(filePath, "utf-8");
  fs.writeFileSync(filePath, content.split(CODEOWNERS_PLACEHOLDER).join(steward), "utf-8");
  return true;
}

/** Recursively remove empty directories (bottom-up), including `dir` itself if it ends up empty. */
function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(path.join(dir, entry.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/**
 * Remove the sample feature. Only files created by this CLI run are deleted, so a
 * user's pre-existing files with the same names are never touched.
 */
export function removeSampleFeature(targetDir, ownedFiles) {
  const removed = [];
  for (const rel of ownedFiles) {
    if (!isExcluded(rel, SAMPLE_FEATURE_PATHS)) continue;
    const abs = path.join(targetDir, rel);
    fs.rmSync(abs, { force: true });
    removed.push(rel);
  }
  // Remove sample directories left empty, but keep their parents (specs/, src/features/...).
  // Directories still holding user files are kept.
  for (const rel of SAMPLE_FEATURE_PATHS) {
    pruneEmptyDirs(path.join(targetDir, rel));
  }

  for (const rel of SAMPLE_REFERENCING_FILES) {
    if (!ownedFiles.has(rel)) continue;
    const filePath = path.join(targetDir, rel);
    const lines = fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .filter((line) => !line.includes("000-example-reservation"));
    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  }
  return removed;
}

/** Write a minimal project README if the project does not have one. Returns true if written. */
export function writeProjectReadme(targetDir, projectName, cliVersion) {
  const readmePath = path.join(targetDir, "README.md");
  if (fs.existsSync(readmePath)) return false;
  const title = projectName === "." ? path.basename(targetDir) : path.basename(projectName);
  const content = `# ${title}

> Scaffolded with [aspec-kit](https://github.com/${GITHUB_OWNER_REPO}) v${cliVersion} —
> spec-driven development with Claude Code from Japanese design documents (基本設計 / 詳細設計 / Figma).

## Getting started

\`\`\`bash
bash bootstrap.sh   # install Spec Kit skills + hooks (run once)
claude              # then run /speckit-constitution
\`\`\`

## Feature workflow

1. Create a GitHub Issue → branch \`NNN-<slug>\` (NNN = issue number, zero-padded to 3 digits).
2. Put upstream design docs in \`docs/01-basic-design/<slug>/\`, \`docs/02-detail-design/<slug>/\`,
   \`docs/03-ui/<slug>/\`.
3. Run \`/design-to-code\` in Claude Code and follow the [HANDOFF] / [PAUSE] steps.

## Project conventions

- [CLAUDE.md](CLAUDE.md) — rules every AI agent reads first.
- [docs/TEAM-WORKFLOW.md](docs/TEAM-WORKFLOW.md) — team workflow & conflict prevention.
- [docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) — guardrails to enable before going live.
- Full framework guide: https://github.com/${GITHUB_OWNER_REPO}#readme
`;
  fs.writeFileSync(readmePath, content, "utf-8");
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template fetching (pinned to the CLI version by default)
// ─────────────────────────────────────────────────────────────────────────────

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => fileStream.close(resolve));
        fileStream.on("error", reject);
      })
      .on("error", reject);
  });
}

/** Fetch a single ref into a fresh temp dir. Returns the dir path or throws. */
async function fetchRef(ref) {
  const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-kit-"));
  try {
    execFileSync("git", ["clone", "--depth", "1", "--branch", ref, GITHUB_REPO_URL, cloneDir], {
      stdio: "pipe",
    });
    return cloneDir;
  } catch {
    // git missing or ref not found via git → try the tarball
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }

  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-kit-"));
  const tarPath = path.join(os.tmpdir(), `aspec-kit-${process.pid}-${Date.now()}.tar.gz`);
  try {
    await downloadFile(`${TARBALL_BASE_URL}/${encodeURIComponent(ref).replace(/%2F/g, "/")}`, tarPath);
    execFileSync("tar", ["-xzf", tarPath, "--strip-components=1", "-C", extractDir], {
      stdio: "pipe",
    });
    return extractDir;
  } catch (err) {
    fs.rmSync(extractDir, { recursive: true, force: true });
    throw err;
  } finally {
    fs.rmSync(tarPath, { force: true });
  }
}

/**
 * Resolve the template source directory.
 * Returns { dir, ref, cleanup }. `cleanup` must be called when done.
 */
async function fetchTemplate({ templateRef, cliVersion }) {
  // Dev/CI escape hatch: use a local checkout instead of downloading
  const localDir = process.env.ASPEC_KIT_TEMPLATE_DIR;
  if (localDir) {
    const resolved = path.resolve(localDir);
    if (!fs.existsSync(resolved)) {
      throw new CliError(`ASPEC_KIT_TEMPLATE_DIR does not exist: ${resolved}`);
    }
    console.log(`==> Using local template: ${resolved}`);
    return { dir: resolved, ref: "local", cleanup: () => {} };
  }

  const candidates = templateRef ? [templateRef] : [`v${cliVersion}`, "main"];
  let lastError;
  for (const ref of candidates) {
    try {
      console.log(`==> Fetching template (ref: ${ref})...`);
      const dir = await fetchRef(ref);
      if (!templateRef && ref !== candidates[0]) {
        warn(
          `Template tag v${cliVersion} not found — fell back to '${ref}'. ` +
            "The scaffolded template may not match this CLI version."
        );
      }
      return { dir, ref, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
    } catch (err) {
      lastError = err;
    }
  }
  throw new CliError(
    `Failed to fetch template (tried: ${candidates.join(", ")}): ${lastError?.message ?? "unknown error"}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function promptUser(rl, question, defaultValue) {
  const displayPrompt = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
  const answer = await rl.question(displayPrompt);
  return answer.trim() || defaultValue;
}

function printFileList(title, files, limit = 15) {
  if (files.length === 0) return;
  console.log(`${title} (${files.length}):`);
  for (const f of files.slice(0, limit)) console.log(`   - ${f}`);
  if (files.length > limit) console.log(`   … and ${files.length - limit} more`);
}

export async function main(argv = process.argv.slice(2)) {
  const pkgPath = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  if (argv[0] === "doctor") {
    process.exitCode = doctorCommand(argv.slice(1));
    return;
  }
  const opts = parseCliArgs(argv);

  if (opts.help) {
    printBanner(pkg.version);
    console.log(HELP_TEXT);
    return;
  }
  if (opts.version) {
    console.log(pkg.version);
    return;
  }

  printBanner(pkg.version);

  // Readline is created lazily so non-interactive runs (-y) never wait on stdin
  let rl = null;
  const ask = async (question, defaultValue) => {
    rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
    return promptUser(rl, question, defaultValue);
  };

  let templateHandle = null;
  try {
    // 1. Project directory
    const projectName =
      opts.target ||
      (opts.yes
        ? "my-aspec-app"
        : await ask("Project directory name (or '.' for current directory)", "my-aspec-app"));
    const targetDir = path.resolve(process.cwd(), projectName);

    const isNonEmpty = fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0;
    if (isNonEmpty && !opts.yes) {
      const dirDisplayName = projectName === "." ? "Current directory" : `Directory "${projectName}"`;
      const policy = opts.force
        ? "Existing files with the same name WILL BE OVERWRITTEN (--force)."
        : "Existing files will be kept; conflicting template files are skipped.";
      const answer = await ask(`${dirDisplayName} is not empty. ${policy} Continue? (y/N)`, "N");
      if (answer.toLowerCase() !== "y") {
        console.log("Aborted.");
        return;
      }
    }

    // 2. Steward handle (validated)
    let steward = opts.steward;
    if (!steward) {
      steward = opts.yes
        ? DEFAULT_STEWARD
        : await ask("GitHub handle of project Steward (for .github/CODEOWNERS)", DEFAULT_STEWARD);
      if (steward !== DEFAULT_STEWARD) steward = normalizeSteward(steward);
    }

    // 3. Keep sample feature?
    const keepExample =
      opts.keepExample ??
      (opts.yes
        ? false
        : (await ask("Keep sample feature (000-example-reservation) for reference? (y/N)", "N"))
            .toLowerCase() === "y");

    rl?.close();
    rl = null;

    // 4. Fetch template & copy (safe by default)
    templateHandle = await fetchTemplate({ templateRef: opts.templateRef, cliVersion: pkg.version });
    console.log("==> Scaffolding project files...");
    const result = copyTemplate(templateHandle.dir, targetDir, { force: opts.force });
    const ownedFiles = new Set([...result.copied, ...result.overwritten]);

    if (result.skipped.length > 0) {
      warn("Some files already existed and were kept unchanged (use --force to overwrite):");
      printFileList("   Skipped", result.skipped);
    }
    if (result.overwritten.length > 0) {
      printFileList(`${YELLOW}   Overwritten${RESET}`, result.overwritten);
    }

    // 5. Customize project configuration
    console.log("==> Customizing project files...");
    if (applySteward(targetDir, steward, ownedFiles)) {
      console.log(`✓ Updated .github/CODEOWNERS with ${steward}`);
    } else if (steward !== DEFAULT_STEWARD) {
      warn(".github/CODEOWNERS was not created by this run — steward not applied.");
    }

    if (!keepExample) {
      console.log("==> Removing sample feature...");
      removeSampleFeature(targetDir, ownedFiles);
      console.log("✓ Sample feature cleaned up");
    }

    if (writeProjectReadme(targetDir, projectName, pkg.version)) {
      console.log("✓ Created README.md");
    }

    // 6. Initialize git repo if not already a git repository
    try {
      if (!fs.existsSync(path.join(targetDir, ".git"))) {
        execFileSync("git", ["init"], { cwd: targetDir, stdio: "ignore" });
        console.log("✓ Initialized fresh git repository");
      }
    } catch {
      // Git not installed, ignore
    }

    // 7. Output completion banner
    console.log(`\n=======================================================`);
    console.log(`🎉  Project ready in ${targetDir}!`);
    console.log(`    Template ref: ${templateHandle.ref} · files copied: ${ownedFiles.size}`);
    console.log(`=======================================================\n`);
    console.log("Next steps:");
    if (projectName !== ".") {
      console.log(`  1. cd ${projectName}`);
      console.log("  2. bash bootstrap.sh    # Setup Spec Kit CLI and hooks");
      console.log("  3. claude               # Launch Claude Code and run /speckit-constitution\n");
    } else {
      console.log("  1. bash bootstrap.sh    # Setup Spec Kit CLI and hooks");
      console.log("  2. claude               # Launch Claude Code and run /speckit-constitution\n");
    }
  } finally {
    rl?.close();
    templateHandle?.cleanup();
  }
}
