// prepack: copy the canonical converter (.claude/scripts/convert-design.py, also scaffolded into
// projects) into the package so `npx @hoanghainh/aspec-kit convert` works outside the kit repo.
// The copy (python/) is git-ignored — there is exactly one source file to edit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.resolve(PKG_ROOT, "..", "..", ".claude", "scripts", "convert-design.py");
const DEST = path.join(PKG_ROOT, "python", "convert-design.py");

if (!fs.existsSync(SOURCE)) {
  console.error(`bundle-converter: source not found: ${SOURCE}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.copyFileSync(SOURCE, DEST);
console.error(`bundle-converter: ${path.relative(PKG_ROOT, SOURCE)} → ${path.relative(PKG_ROOT, DEST)}`);
