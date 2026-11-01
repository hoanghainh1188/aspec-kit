// `aspec-kit figma diff` — compare Figma wireframe/screen SVGs across versions.
// Zero dependencies (native Node.js XML/SVG parsing & rendering).
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const isColorSupported =
  !process.env.NO_COLOR &&
  (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);
const GREEN = isColorSupported ? "\x1b[32m" : "";
const YELLOW = isColorSupported ? "\x1b[33m" : "";
const RED = isColorSupported ? "\x1b[31m" : "";
const BOLD = isColorSupported ? "\x1b[1m" : "";
const RESET = isColorSupported ? "\x1b[0m" : "";

export const DIFF_HELP_TEXT = `Usage:
  npx @hoanghainh/aspec-kit figma diff <file1.svg> <file2.svg> [options]
  npx @hoanghainh/aspec-kit figma diff <slug> [v1] [v2] [options]

Options:
  --out <dir>           Output directory for diff artifacts (default: docs/03-ui/<slug>/diffs/)
  --dir <path>          Project root directory (default: .)
  --threshold <number>  Position movement sensitivity in pixels (default: 2)
  -h, --help            Display this help message

Outputs generated:
  • Visual Overlay SVG with green (added), red (removed), yellow (modified) highlights
  • Japanese Markdown Visual Diff Report for BrSE & client 仕様変更 communication
`;

/**
 * Extract SVG width and height from attributes or viewBox
 */
export function extractSvgDimensions(svgText) {
  let width = 800;
  let height = 600;

  const viewBoxMatch = svgText.match(/viewBox=["']([0-9. -]+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) {
      width = parts[2] || width;
      height = parts[3] || height;
      return { width, height, viewBox: viewBoxMatch[1] };
    }
  }

  const widthMatch = svgText.match(/width=["']([0-9.]+)p?x?["']/i);
  const heightMatch = svgText.match(/height=["']([0-9.]+)p?x?["']/i);
  if (widthMatch) width = parseFloat(widthMatch[1]);
  if (heightMatch) height = parseFloat(heightMatch[1]);

  return { width, height, viewBox: `0 0 ${width} ${height}` };
}

/**
 * Lightweight SVG element parser extracting text, rects, paths, and circles
 */
export function parseSvgElements(svgText) {
  if (!svgText || typeof svgText !== "string") return [];
  const elements = [];

  // 1. Extract <text> elements
  const textRegex = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match;
  while ((match = textRegex.exec(svgText)) !== null) {
    const attrsStr = match[1];
    const textContent = match[2].replace(/<[^>]+>/g, "").trim();
    if (!textContent) continue;

    const x = parseFloat((attrsStr.match(/\bx=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const y = parseFloat((attrsStr.match(/\by=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const fill = (attrsStr.match(/\bfill=["']([^"']+)["']/i) || [])[1] || "inherit";
    const fontSize = parseFloat((attrsStr.match(/\bfont-size=["']([0-9.-]+)["']/i) || [])[1] || 12);

    elements.push({
      type: "text",
      tag: "text",
      text: textContent,
      x,
      y,
      fill,
      fontSize,
      rawAttrs: attrsStr,
    });
  }

  // 2. Extract <rect> elements
  const rectRegex = /<rect\b([^>]*)\/?>/gi;
  while ((match = rectRegex.exec(svgText)) !== null) {
    const attrsStr = match[1];
    const x = parseFloat((attrsStr.match(/\bx=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const y = parseFloat((attrsStr.match(/\by=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const width = parseFloat((attrsStr.match(/\bwidth=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const height = parseFloat((attrsStr.match(/\bheight=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const fill = (attrsStr.match(/\bfill=["']([^"']+)["']/i) || [])[1] || "none";
    const stroke = (attrsStr.match(/\bstroke=["']([^"']+)["']/i) || [])[1] || "none";

    // Ignore full-canvas background rects
    if (width > 2000 || height > 2000) continue;

    elements.push({
      type: "rect",
      tag: "rect",
      x,
      y,
      width,
      height,
      fill,
      stroke,
      rawAttrs: attrsStr,
    });
  }

  // 3. Extract <circle> / <ellipse> elements
  const circleRegex = /<(?:circle|ellipse)\b([^>]*)\/?>/gi;
  while ((match = circleRegex.exec(svgText)) !== null) {
    const attrsStr = match[1];
    const cx = parseFloat((attrsStr.match(/\bcx=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const cy = parseFloat((attrsStr.match(/\bcy=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const r = parseFloat((attrsStr.match(/\br=["']([0-9.-]+)["']/i) || [])[1] || 0);
    const fill = (attrsStr.match(/\bfill=["']([^"']+)["']/i) || [])[1] || "none";

    elements.push({
      type: "circle",
      tag: "circle",
      cx,
      cy,
      r,
      fill,
      rawAttrs: attrsStr,
    });
  }

  return elements;
}

/**
 * Compare two sets of SVG elements and detect additions, removals, and modifications
 */
export function diffSvgElements(oldElements, newElements, { threshold = 2 } = {}) {
  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  const oldPool = [...oldElements];
  const newPool = [...newElements];

  // Pass 1: Exact matches or text matches
  for (let i = newPool.length - 1; i >= 0; i--) {
    const newItem = newPool[i];
    let matchedOldIndex = -1;

    for (let j = 0; j < oldPool.length; j++) {
      const oldItem = oldPool[j];
      if (oldItem.type !== newItem.type) continue;

      if (newItem.type === "text") {
        if (oldItem.text === newItem.text) {
          matchedOldIndex = j;
          break;
        }
      } else if (newItem.type === "rect") {
        const dx = Math.abs(oldItem.x - newItem.x);
        const dy = Math.abs(oldItem.y - newItem.y);
        const dw = Math.abs(oldItem.width - newItem.width);
        const dh = Math.abs(oldItem.height - newItem.height);
        if (dx <= threshold && dy <= threshold && dw <= threshold && dh <= threshold) {
          matchedOldIndex = j;
          break;
        }
      } else if (newItem.type === "circle") {
        const dcx = Math.abs(oldItem.cx - newItem.cx);
        const dcy = Math.abs(oldItem.cy - newItem.cy);
        if (dcx <= threshold && dcy <= threshold) {
          matchedOldIndex = j;
          break;
        }
      }
    }

    if (matchedOldIndex !== -1) {
      const oldItem = oldPool.splice(matchedOldIndex, 1)[0];
      newPool.splice(i, 1);

      // Check if modified (e.g. position moved or styling changed)
      let isModified = false;
      const changes = [];

      if (newItem.type === "text") {
        const dx = Math.abs(oldItem.x - newItem.x);
        const dy = Math.abs(oldItem.y - newItem.y);
        if (dx > threshold || dy > threshold) {
          isModified = true;
          changes.push(`Position moved by (${Math.round(newItem.x - oldItem.x)}, ${Math.round(newItem.y - oldItem.y)})px`);
        }
        if (oldItem.fill !== newItem.fill && oldItem.fill !== "inherit" && newItem.fill !== "inherit") {
          isModified = true;
          changes.push(`Color changed: ${oldItem.fill} ➔ ${newItem.fill}`);
        }
      } else if (newItem.type === "rect") {
        if (oldItem.fill !== newItem.fill && oldItem.fill !== "none" && newItem.fill !== "none") {
          isModified = true;
          changes.push(`Fill changed: ${oldItem.fill} ➔ ${newItem.fill}`);
        }
      }

      if (isModified) {
        modified.push({ oldItem, newItem, changes });
      } else {
        unchanged.push({ oldItem, newItem });
      }
    }
  }

  // Pass 2: Remaining in oldPool are removed, remaining in newPool are added
  for (const rem of oldPool) {
    removed.push(rem);
  }
  for (const add of newPool) {
    added.push(add);
  }

  return { added, removed, modified, unchanged };
}

/**
 * Generate Visual Overlay SVG with green (added), red (removed), yellow (modified) highlights
 */
export function generateOverlaySvg(oldSvgText, newSvgText, diff) {
  const { width, height, viewBox } = extractSvgDimensions(newSvgText || oldSvgText);

  const overlayElements = [];
  overlayElements.push(`<!-- Base SVG Content -->`);
  overlayElements.push(`<g opacity="0.45">`);

  // Strip XML prolog or svg root tag
  const cleanedNewSvg = newSvgText
    .replace(/<\?xml[\s\S]*?\?>/i, "")
    .replace(/<svg\b[^>]*>/i, "")
    .replace(/<\/svg>/i, "");
  overlayElements.push(cleanedNewSvg);
  overlayElements.push(`</g>`);

  overlayElements.push(`<!-- Visual Diff Annotations -->`);
  overlayElements.push(`<g id="diff-overlay">`);

  // 1. Added elements (Green: #22c55e)
  for (const item of diff.added) {
    if (item.type === "rect") {
      overlayElements.push(
        `<rect x="${item.x - 2}" y="${item.y - 2}" width="${item.width + 4}" height="${item.height + 4}" fill="rgba(34, 197, 94, 0.25)" stroke="#22c55e" stroke-width="2" stroke-dasharray="4" rx="4"/>`
      );
    } else if (item.type === "text") {
      const estimatedWidth = (item.text.length * (item.fontSize || 12)) * 0.7;
      const estimatedHeight = (item.fontSize || 12) * 1.4;
      overlayElements.push(
        `<rect x="${item.x - 4}" y="${item.y - estimatedHeight + 4}" width="${estimatedWidth + 8}" height="${estimatedHeight}" fill="rgba(34, 197, 94, 0.3)" stroke="#22c55e" stroke-width="1.5" rx="3"/>`
      );
    }
  }

  // 2. Removed elements (Red: #ef4444)
  for (const item of diff.removed) {
    if (item.type === "rect") {
      overlayElements.push(
        `<rect x="${item.x - 2}" y="${item.y - 2}" width="${item.width + 4}" height="${item.height + 4}" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" stroke-width="2" stroke-dasharray="3" rx="4"/>`
      );
    } else if (item.type === "text") {
      const estimatedWidth = (item.text.length * (item.fontSize || 12)) * 0.7;
      const estimatedHeight = (item.fontSize || 12) * 1.4;
      overlayElements.push(
        `<g opacity="0.8">` +
        `<rect x="${item.x - 4}" y="${item.y - estimatedHeight + 4}" width="${estimatedWidth + 8}" height="${estimatedHeight}" fill="rgba(239, 68, 68, 0.35)" stroke="#ef4444" stroke-width="1.5" rx="3"/>` +
        `<line x1="${item.x - 2}" y1="${item.y - estimatedHeight / 2 + 2}" x2="${item.x + estimatedWidth + 2}" y2="${item.y - estimatedHeight / 2 + 2}" stroke="#ef4444" stroke-width="2"/>` +
        `</g>`
      );
    }
  }

  // 3. Modified elements (Yellow: #eab308)
  for (const item of diff.modified) {
    const ni = item.newItem;
    if (ni.type === "rect") {
      overlayElements.push(
        `<rect x="${ni.x - 2}" y="${ni.y - 2}" width="${ni.width + 4}" height="${ni.height + 4}" fill="rgba(234, 179, 8, 0.25)" stroke="#eab308" stroke-width="2" rx="4"/>`
      );
    } else if (ni.type === "text") {
      const estimatedWidth = (ni.text.length * (ni.fontSize || 12)) * 0.7;
      const estimatedHeight = (ni.fontSize || 12) * 1.4;
      overlayElements.push(
        `<rect x="${ni.x - 4}" y="${ni.y - estimatedHeight + 4}" width="${estimatedWidth + 8}" height="${estimatedHeight}" fill="rgba(234, 179, 8, 0.3)" stroke="#eab308" stroke-width="1.5" rx="3"/>`
      );
    }
  }

  // 4. Add Visual Legend Banner at top-right
  overlayElements.push(`
    <g id="diff-legend" transform="translate(${Math.max(10, width - 260)}, 10)" opacity="0.95">
      <rect width="250" height="75" fill="#0f172a" stroke="#334155" rx="6" />
      <text x="12" y="20" fill="#f8fafc" font-size="12" font-family="sans-serif" font-weight="bold">Figma Visual Diff Legend</text>
      <circle cx="20" cy="38" r="5" fill="#22c55e" />
      <text x="32" y="42" fill="#94a3b8" font-size="11" font-family="sans-serif">Added (${diff.added.length})</text>
      <circle cx="105" cy="38" r="5" fill="#ef4444" />
      <text x="117" y="42" fill="#94a3b8" font-size="11" font-family="sans-serif">Removed (${diff.removed.length})</text>
      <circle cx="20" cy="58" r="5" fill="#eab308" />
      <text x="32" y="62" fill="#94a3b8" font-size="11" font-family="sans-serif">Modified (${diff.modified.length})</text>
    </g>
  `);

  overlayElements.push(`</g>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">
${overlayElements.join("\n")}
</svg>
`;
}

/**
 * Generate Japanese Markdown Visual Diff Report for BrSE & client communication
 */
export function generateMarkdownDiffReport({
  screenName = "wireframe",
  oldPath = "v1",
  newPath = "v2",
  diff,
  dateStr = new Date().toISOString().split("T")[0],
}) {
  const lines = [];
  lines.push(`# 画面デザイン差分報告書 (Visual Diff Report) — ${screenName}`);
  lines.push(``);
  lines.push(`- **対象画面**: \`${screenName}\``);
  lines.push(`- **比較元 (v1)**: \`${oldPath}\``);
  lines.push(`- **比較先 (v2)**: \`${newPath}\``);
  lines.push(`- **差分解析日**: ${dateStr}`);
  lines.push(``);

  lines.push(`## 1. 差分サマリー (Diff Summary)`);
  lines.push(``);
  lines.push(`| 変更種別 | 件数 | 主な内容 |`);
  lines.push(`|---|:---:|---|`);
  lines.push(`| 🟢 **追加 (Added)** | ${diff.added.length} | 新規追加された項目・ボタン・文言 |`);
  lines.push(`| 🔴 **削除 (Removed)** | ${diff.removed.length} | 削除された項目・UIコンポーネント |`);
  lines.push(`| 🟡 **変更 (Modified)** | ${diff.modified.length} | 位置移動、配色変更、文言変更 |`);
  lines.push(``);

  lines.push(`## 2. 詳細変更箇所 (Detailed Visual Changes)`);
  lines.push(``);

  if (diff.added.length > 0) {
    lines.push(`### 🟢 追加項目 (${diff.added.length}件)`);
    for (const item of diff.added) {
      if (item.type === "text") {
        lines.push(`- **文言項目**: 「\`${item.text}\`」 (座標: x=${item.x}, y=${item.y})`);
      } else {
        lines.push(`- **UI要素 (${item.type})**: 座標 (x=${item.x || item.cx}, y=${item.y || item.cy})`);
      }
    }
    lines.push(``);
  }

  if (diff.removed.length > 0) {
    lines.push(`### 🔴 削除項目 (${diff.removed.length}件)`);
    for (const item of diff.removed) {
      if (item.type === "text") {
        lines.push(`- **文言項目**: 「\`${item.text}\`」 (旧座標: x=${item.x}, y=${item.y})`);
      } else {
        lines.push(`- **UI要素 (${item.type})**: 旧座標 (x=${item.x || item.cx}, y=${item.y || item.cy})`);
      }
    }
    lines.push(``);
  }

  if (diff.modified.length > 0) {
    lines.push(`### 🟡 変更・調整項目 (${diff.modified.length}件)`);
    for (const item of diff.modified) {
      const label = item.newItem.text ? `「${item.newItem.text}」` : item.newItem.type;
      lines.push(`- **${label}**: ${item.changes.join(", ")}`);
    }
    lines.push(``);
  }

  if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
    lines.push(`- 検出された視覚的な差分はありません（完全一致）。`);
    lines.push(``);
  }

  lines.push(`## 3. 仕様変更への影響度 (Impact Analysis for /design-change)`);
  lines.push(``);
  const impactLevel = diff.added.length + diff.removed.length > 2 ? "中 (Medium)" : (diff.added.length + diff.removed.length > 0 ? "小 (Low)" : "なし (None)");
  lines.push(`- **影響度**: **${impactLevel}**`);
  lines.push(`- **推奨アクション**:`);
  if (diff.added.length > 0 || diff.removed.length > 0) {
    lines.push(`  1. \`docs/02-detail-design/\` の画面項目定義とバリデーションを更新`);
    lines.push(`  2. \`specs/\` の Acceptance Criteria (AC) へのマッピング見直し`);
    lines.push(`  3. \`/design-change\` コマンドを実行して影響範囲レポートを生成`);
  } else {
    lines.push(`  - コードおよび設計書への影響はありません。`);
  }
  lines.push(``);

  return lines.join("\n");
}

/**
 * Execute figma diff between two files or versions
 */
export async function compareFigmaSvgFiles(oldPath, newPath, options = {}) {
  const { outDir, threshold = 2, logger = console } = options;

  if (!fs.existsSync(oldPath)) {
    throw new Error(`Base SVG file not found: ${oldPath}`);
  }
  if (!fs.existsSync(newPath)) {
    throw new Error(`Target SVG file not found: ${newPath}`);
  }

  const oldSvgText = fs.readFileSync(oldPath, "utf8");
  const newSvgText = fs.readFileSync(newPath, "utf8");

  const oldElements = parseSvgElements(oldSvgText);
  const newElements = parseSvgElements(newSvgText);
  const diff = diffSvgElements(oldElements, newElements, { threshold });

  const screenName = path.basename(newPath, ".svg").replace(/[-_]v[0-9]+$/, "");
  const targetOutDir = outDir || path.dirname(newPath);
  fs.mkdirSync(targetOutDir, { recursive: true });

  const overlaySvg = generateOverlaySvg(oldSvgText, newSvgText, diff);
  const overlaySvgPath = path.join(targetOutDir, `${screenName}-diff.svg`);
  fs.writeFileSync(overlaySvgPath, overlaySvg, "utf8");

  const mdReport = generateMarkdownDiffReport({
    screenName,
    oldPath: path.basename(oldPath),
    newPath: path.basename(newPath),
    diff,
  });
  const mdReportPath = path.join(targetOutDir, `${screenName}-diff.md`);
  fs.writeFileSync(mdReportPath, mdReport, "utf8");

  logger.log(`${GREEN}✓ Visual diff generated successfully!${RESET}`);
  logger.log(`  Overlay SVG: ${overlaySvgPath}`);
  logger.log(`  Report:      ${mdReportPath}`);
  logger.log(`  Summary:     🟢 +${diff.added.length} | 🔴 -${diff.removed.length} | 🟡 ~${diff.modified.length}`);

  return {
    screenName,
    diff,
    overlaySvgPath,
    mdReportPath,
  };
}

/**
 * CLI Runner for `aspec-kit figma diff`
 */
export async function runFigmaDiff(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      out: { type: "string" },
      dir: { type: "string", default: "." },
      threshold: { type: "string", default: "2" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(DIFF_HELP_TEXT);
    return;
  }

  const inputs = positionals.filter((p) => p !== "diff");
  if (inputs.length < 2) {
    console.error(`${RED}Error: Missing required files or versions to compare.${RESET}\n`);
    console.log(DIFF_HELP_TEXT);
    process.exit(1);
  }

  const [path1, path2] = inputs;
  const projectRoot = path.resolve(values.dir);
  const file1 = path.isAbsolute(path1) ? path1 : path.resolve(projectRoot, path1);
  const file2 = path.isAbsolute(path2) ? path2 : path.resolve(projectRoot, path2);

  try {
    await compareFigmaSvgFiles(file1, file2, {
      outDir: values.out ? path.resolve(projectRoot, values.out) : null,
      threshold: parseFloat(values.threshold) || 2,
      logger: console,
    });
  } catch (err) {
    console.error(`${RED}✖ [Figma Diff Error] ${err.message}${RESET}`);
    process.exit(1);
  }
}
