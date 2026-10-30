// `aspec-kit convert` — turn a 詳細設計 workbook/PDF into Markdown.
// The CLI stays zero-dependency: the real work is a Python script with PEP 723 inline dependencies
// (openpyxl, pdfplumber) that `uv run --script` executes in an isolated, cached environment.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import { CliError } from "../index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the converter script is looked up, in order:
 * 1. bundled into the npm package by `prepack` (packages/aspec-kit/python/convert-design.py)
 * 2. the kit repository checkout (canonical copy, also scaffolded into projects)
 */
export const CONVERTER_CANDIDATES = Object.freeze([
  path.resolve(HERE, "..", "..", "python", "convert-design.py"),
  path.resolve(HERE, "..", "..", "..", "..", ".claude", "scripts", "convert-design.py"),
]);

const SUPPORTED_EXTS = new Set([".xlsx", ".xlsm", ".pdf"]);

export const CONVERT_HELP = `Usage:
  npx @hoanghainh/aspec-kit convert <file.xlsx|file.xlsm|file.pdf> [--out <dir>] [--force]

Converts a 詳細設計 workbook or PDF to Markdown that Claude Code can read:
  - Excel: <stem>.md (index) + one <stem>__<NN>_<sheet>.md per sheet; merged cells expanded,
           tables kept as GFM tables, Japanese sheet names preserved.
  - PDF:   <stem>.md with text + tables per page.
The original file is never modified. An entry is appended to <out>/CHANGELOG.md.

Options:
  --out <dir>   Output folder (default: the docs/02-detail-design/<slug>/ folder holding the file,
                otherwise ./docs/02-detail-design/<slug-of-file-name>/)
  --force       Overwrite Markdown files that were not generated from this source
  -h, --help    Display this help message

Requires uv (https://docs.astral.sh/uv/) — the same tool Spec Kit uses.
`;

export const UV_MISSING_HINT = `\`aspec-kit convert\` needs uv to run its Python converter (openpyxl/pdfplumber),
but \`uv\` was not found on PATH. Install it, then re-run:
  macOS / Linux:  curl -LsSf https://astral.sh/uv/install.sh | sh     (or: brew install uv)
  Windows:        powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
Docs: https://docs.astral.sh/uv/getting-started/installation/`;

/** Parse `convert` arguments (everything after the subcommand). Throws CliError on bad input. */
export function parseConvertArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        out: { type: "string" },
        force: { type: "boolean" },
      },
    });
  } catch (err) {
    throw new CliError(`${err.message}\nRun 'aspec-kit convert --help' to see available options.`);
  }
  const { values, positionals } = parsed;
  if (values.help) return { help: true, input: null, out: null, force: false };

  if (positionals.length === 0) {
    throw new CliError("Missing input file.\nUsage: aspec-kit convert <file.xlsx|file.pdf> [--out <dir>]");
  }
  if (positionals.length > 1) {
    throw new CliError(`Unexpected arguments: ${positionals.slice(1).join(" ")}`);
  }
  const input = positionals[0];
  const ext = path.extname(input).toLowerCase();
  if (ext === ".xls") {
    throw new CliError("Legacy .xls is not supported — open it in Excel and save as .xlsx first.");
  }
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new CliError(`Unsupported file type "${ext || "(none)"}" — expected .xlsx, .xlsm or .pdf.`);
  }
  if (values.out !== undefined && values.out.trim() === "") {
    throw new CliError("--out must not be empty.");
  }
  return { help: false, input, out: values.out ?? null, force: Boolean(values.force) };
}

/** Return `uv --version` output, or throw CliError with an install hint when uv is missing. */
export function ensureUv(uvBin = "uv") {
  const result = spawnSync(uvBin, ["--version"], { encoding: "utf-8" });
  if (result.error?.code === "ENOENT") {
    throw new CliError(UV_MISSING_HINT);
  }
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? `exit code ${result.status}`;
    throw new CliError(`\`${uvBin} --version\` failed: ${detail}\n${UV_MISSING_HINT}`);
  }
  return result.stdout.trim();
}

export function resolveConverterScript(candidates = CONVERTER_CANDIDATES) {
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new CliError(
      `Converter script not found (looked in: ${candidates.join(", ")}). Reinstall @hoanghainh/aspec-kit.`
    );
  }
  return found;
}

/** Entry point for `aspec-kit convert ...`. */
export function runConvert(argv, { uvBin = process.env.ASPEC_KIT_UV || "uv" } = {}) {
  const opts = parseConvertArgs(argv);
  if (opts.help) {
    console.log(CONVERT_HELP);
    return;
  }

  const input = path.resolve(opts.input);
  if (!fs.existsSync(input) || !fs.statSync(input).isFile()) {
    throw new CliError(`File not found: ${input}`);
  }

  ensureUv(uvBin);
  const script = resolveConverterScript();
  const args = ["run", "--script", script, input];
  if (opts.out) args.push("--out", path.resolve(opts.out));
  if (opts.force) args.push("--force");

  const result = spawnSync(uvBin, args, { stdio: "inherit" });
  if (result.error) throw new CliError(`Failed to run uv: ${result.error.message}`);
  if (result.status !== 0) {
    throw new CliError(`Conversion failed (converter exited with code ${result.status}).`);
  }
}
