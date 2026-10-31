// `.aspec-kit.json` — records which template ref a project was scaffolded from and a hash of every
// kit-owned file as it was written, so `aspec-kit update` can tell local edits from template changes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const MANIFEST_FILE = ".aspec-kit.json";
export const MANIFEST_SCHEMA = 1;

/**
 * sha256 of file content. CRLF is normalized to LF for text files so a checkout with
 * `core.autocrlf` does not look like a local modification.
 */
export function hashContent(buf) {
  const isBinary = buf.includes(0);
  const normalized = isBinary ? buf : Buffer.from(buf.toString("utf-8").replace(/\r\n/g, "\n"), "utf-8");
  return `sha256:${crypto.createHash("sha256").update(normalized).digest("hex")}`;
}

/** Hash a file on disk, or return null if it does not exist. */
export function hashFile(absPath) {
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null;
  return hashContent(fs.readFileSync(absPath));
}

/** A manifest key must be a plain relative POSIX path inside the project. */
export function isSafeRelPath(rel) {
  return (
    typeof rel === "string" &&
    rel.length > 0 &&
    !rel.startsWith("/") &&
    !/^[A-Za-z]:/.test(rel) &&
    !rel.includes("\\") &&
    !rel.split("/").some((seg) => seg === ".." || seg === "." || seg === "")
  );
}

/** Read the manifest of a project. Returns null when missing; throws on a corrupt file. */
export function readManifest(projectDir) {
  const file = path.join(projectDir, MANIFEST_FILE);
  if (!fs.existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    throw new Error(`${MANIFEST_FILE} is not valid JSON: ${err.message}`);
  }
  if (!data || typeof data !== "object" || typeof data.files !== "object" || data.files === null) {
    throw new Error(`${MANIFEST_FILE} is malformed (missing "files").`);
  }
  const files = Object.fromEntries(
    Object.entries(data.files).filter(([rel, hash]) => isSafeRelPath(rel) && typeof hash === "string")
  );
  return { ...data, files };
}

/**
 * Build a manifest object. `files` is a map rel → hash; keys are sorted for stable diffs.
 * @param {{ templateRef: string, cliVersion: string, steward?: string|null, stack?: string|null, lang?: string|null, files: Record<string,string> }} input
 */
export function buildManifest({ templateRef, cliVersion, steward = null, stack = null, lang = null, files }) {
  const sorted = Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]]));
  const out = {
    schema: MANIFEST_SCHEMA,
    templateRef,
    cliVersion,
    steward,
  };
  if (stack) out.stack = stack;
  if (lang) out.lang = lang;
  out.updatedAt = new Date().toISOString();
  out.files = sorted;
  return out;
}

export function writeManifest(projectDir, manifest) {
  fs.writeFileSync(path.join(projectDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

/** Hash the given relative paths as they currently exist in projectDir (missing files are skipped). */
export function hashProjectFiles(projectDir, relPaths) {
  const files = {};
  for (const rel of relPaths) {
    const hash = hashFile(path.join(projectDir, rel));
    if (hash) files[rel] = hash;
  }
  return files;
}
