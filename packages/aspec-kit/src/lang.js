// Language pack support for `--lang vi|en|ja` — overlays localized template files
// from `templates/lang/<lang>/` onto the scaffolded project.
import fs from "node:fs";
import path from "node:path";

export const SUPPORTED_LANGS = Object.freeze(["vi", "en", "ja"]);
export const DEFAULT_LANG = "vi";

const toPosix = (p) => p.split(path.sep).join("/");

/**
 * Validate and normalize a `--lang` value. Returns `"vi" | "en" | "ja"`
 * or throws an Error (or custom ErrorClass).
 */
export function normalizeLang(raw, ErrorClass = Error) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!SUPPORTED_LANGS.includes(value)) {
    throw new ErrorClass(
      `Invalid --lang "${raw}". Expected one of: ${SUPPORTED_LANGS.join(", ")}.`
    );
  }
  return value;
}

/**
 * Resolve the source path inside `templateDir` for a relative POSIX path `rel` and language `lang`.
 * For `"vi"` (or when no localized override exists), falls back to `<templateDir>/<rel>`.
 */
export function resolveLangSourcePath(templateDir, rel, lang = DEFAULT_LANG) {
  if (lang && lang !== DEFAULT_LANG) {
    const localized = path.join(templateDir, "templates", "lang", lang, rel);
    if (fs.existsSync(localized) && fs.statSync(localized).isFile()) {
      return localized;
    }
  }
  return path.join(templateDir, rel);
}

/** List all relative POSIX file paths inside `templates/lang/<lang>/`. */
export function listLangOverlayFiles(templateDir, lang) {
  if (!lang || lang === DEFAULT_LANG) return [];
  const langDir = path.join(templateDir, "templates", "lang", lang);
  if (!fs.existsSync(langDir) || !fs.statSync(langDir).isDirectory()) return [];
  const out = [];
  const walk = (dirRel) => {
    const abs = path.join(langDir, dirRel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = toPosix(path.join(dirRel, entry.name));
      if (entry.isDirectory()) walk(rel);
      else out.push(rel);
    }
  };
  walk("");
  return out.sort();
}

/**
 * Overlay localized files from `<templateDir>/templates/lang/<lang>/` onto `targetDir`.
 * Only writes files that are in `ownedFiles` (created by this CLI run) so pre-existing
 * user files are never overwritten unless `--force` was used.
 * Returns the list of relative POSIX paths updated.
 */
export function applyLang(targetDir, templateDir, lang, ownedFiles) {
  if (!lang || lang === DEFAULT_LANG) return [];
  const files = listLangOverlayFiles(templateDir, lang);
  const updated = [];
  for (const rel of files) {
    if (!ownedFiles.has(rel)) continue;
    const src = path.join(templateDir, "templates", "lang", lang, rel);
    const dest = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, fs.statSync(src).mode);
    updated.push(rel);
  }
  return updated;
}
