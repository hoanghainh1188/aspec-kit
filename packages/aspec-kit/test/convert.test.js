// Tests for `aspec-kit convert` argument handling and the uv precondition (node:test, no uv needed).
// The Python converter itself is tested by test/convert/test_convert_design.py (npm run test:python).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { CliError, DEFAULT_EXCLUDES, listTemplateFiles, readIgnoreFile } from "../src/index.js";
import {
  CONVERTER_CANDIDATES,
  ensureUv,
  parseConvertArgs,
  resolveConverterScript,
  runConvert,
} from "../src/commands/convert.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(PKG_ROOT, "..", "..");
const BIN = path.join(PKG_ROOT, "bin", "run.js");
const FIXTURE = path.join(HERE, "convert", "fixtures", "detail-design-sample.xlsx");
const MISSING_UV = "aspec-kit-test-no-such-uv-binary";

describe("parseConvertArgs", () => {
  test("accepts xlsx/xlsm/pdf with optional --out and --force", () => {
    assert.deepEqual(parseConvertArgs(["spec.xlsx"]), {
      help: false,
      input: "spec.xlsx",
      out: null,
      force: false,
    });
    assert.deepEqual(parseConvertArgs(["詳細設計.PDF", "--out", "docs/02-detail-design/x", "--force"]), {
      help: false,
      input: "詳細設計.PDF",
      out: "docs/02-detail-design/x",
      force: true,
    });
    assert.equal(parseConvertArgs(["macro.xlsm"]).input, "macro.xlsm");
  });

  test("--help needs no input file", () => {
    assert.equal(parseConvertArgs(["--help"]).help, true);
    assert.equal(parseConvertArgs(["-h"]).help, true);
  });

  test("rejects missing, extra and unsupported inputs", () => {
    assert.throws(() => parseConvertArgs([]), /Missing input file/);
    assert.throws(() => parseConvertArgs(["a.xlsx", "b.xlsx"]), /Unexpected arguments: b\.xlsx/);
    assert.throws(() => parseConvertArgs(["old.xls"]), /save as \.xlsx/);
    assert.throws(() => parseConvertArgs(["notes.docx"]), /Unsupported file type "\.docx"/);
    assert.throws(() => parseConvertArgs(["noext"]), /Unsupported file type "\(none\)"/);
  });

  test("rejects unknown flags and a missing/empty --out value", () => {
    assert.throws(() => parseConvertArgs(["a.xlsx", "--bogus"]), CliError);
    assert.throws(() => parseConvertArgs(["a.xlsx", "--out"]), CliError);
    assert.throws(() => parseConvertArgs(["a.xlsx", "--out", " "]), /--out must not be empty/);
  });
});

describe("uv precondition", () => {
  test("ensureUv throws a CliError with an install hint when uv is missing", () => {
    assert.throws(
      () => ensureUv(MISSING_UV),
      (err) =>
        err instanceof CliError &&
        /uv` was not found on PATH/.test(err.message) &&
        /astral\.sh\/uv\/install\.sh/.test(err.message)
    );
  });

  test("runConvert validates the input file before checking uv", () => {
    assert.throws(
      () => runConvert([path.join(os.tmpdir(), "aspec-kit-missing-file.xlsx")], { uvBin: MISSING_UV }),
      /File not found/
    );
    assert.throws(() => runConvert([FIXTURE], { uvBin: MISSING_UV }), /uv` was not found on PATH/);
  });

  test("CLI prints the hint and exits 1 when uv is not on PATH", () => {
    const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-no-uv-"));
    try {
      const result = spawnSync(process.execPath, [BIN, "convert", FIXTURE], {
        encoding: "utf-8",
        env: { ...process.env, PATH: emptyBin, ASPEC_KIT_UV: "" },
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /needs uv/);
      assert.match(result.stderr, /docs\.astral\.sh\/uv/);
    } finally {
      fs.rmSync(emptyBin, { recursive: true, force: true });
    }
  });

  test("CLI rejects bad arguments without needing uv", () => {
    const result = spawnSync(process.execPath, [BIN, "convert", "notes.docx"], {
      encoding: "utf-8",
      env: { ...process.env, PATH: "" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported file type/);
  });

  test("convert --help prints usage", () => {
    const out = execFileSync(process.execPath, [BIN, "convert", "--help"], { encoding: "utf-8" });
    assert.match(out, /aspec-kit convert <file\.xlsx\|file\.xlsm\|file\.pdf>/);
    const topHelp = execFileSync(process.execPath, [BIN, "--help"], { encoding: "utf-8" });
    assert.match(topHelp, /convert <file>/);
  });
});

describe("converter script distribution", () => {
  test("is found from a repo checkout", () => {
    assert.equal(
      resolveConverterScript(),
      CONVERTER_CANDIDATES.find((p) => fs.existsSync(p))
    );
    assert.throws(() => resolveConverterScript([path.join(os.tmpdir(), "nope.py")]), /Converter script not found/);
  });

  test("canonical script is scaffolded into projects (not excluded)", () => {
    const excludes = [...new Set([...DEFAULT_EXCLUDES, ...readIgnoreFile(REPO_ROOT)])];
    const files = listTemplateFiles(REPO_ROOT, excludes);
    assert.ok(files.includes(".claude/scripts/convert-design.py"));
    assert.ok(!files.some((f) => f.startsWith("packages/")), "kit tests/fixtures must not be scaffolded");
  });

  test("npm pack bundles the converter", () => {
    const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: PKG_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    const jsonStart = out.search(/^\s*[\[{]/m);
    const parsed = JSON.parse(out.slice(jsonStart));
    const entry = Array.isArray(parsed)
      ? parsed[0]
      : parsed.files
        ? parsed
        : Object.values(parsed)[0];
    const { files } = entry;
    const paths = files.map((f) => f.path);
    assert.ok(paths.includes("python/convert-design.py"), paths.join(", "));
    assert.ok(paths.includes("src/commands/convert.js"));
    assert.ok(!paths.some((p) => p.startsWith("test/")));
    const bundled = fs.readFileSync(path.join(PKG_ROOT, "python", "convert-design.py"), "utf-8");
    const canonical = fs.readFileSync(path.join(REPO_ROOT, ".claude", "scripts", "convert-design.py"), "utf-8");
    assert.equal(bundled, canonical);
  });
});
