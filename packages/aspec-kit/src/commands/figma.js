// `aspec-kit figma` — sync Figma frames and vector assets directly via Figma REST API.
// Zero dependencies (uses native fetch in Node.js 18+).
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

export const FIGMA_API_BASE = "https://api.figma.com/v1";

const HELP_TEXT = `Usage:
  npx @hoanghainh/aspec-kit figma sync <file-key-or-url> [options]

Commands:
  sync <file-key|url>   Fetch Figma document frames and export render assets (SVG/PNG)

Options:
  --slug <feature-slug> Feature slug for docs/03-ui/<slug>/ (defaults to auto-derived from file name)
  --format <svg|png>    Export format for rendered frames (default: svg)
  --scale <1|2|3|4>     Export image render scale (default: 2 for png, 1 for svg)
  --token <token>       Figma Personal Access Token (defaults to env FIGMA_PERSONAL_TOKEN)
  --node-id <id>        Comma-separated Figma node IDs to filter (e.g. 1:23,4:56)
  --dir <path>          Project root directory (default: .)
  -h, --help            Display this help message

Authentication:
  Set FIGMA_PERSONAL_TOKEN in your environment or pass --token <token>.
  Generate a token in Figma: Account Settings -> Personal access tokens.
`;

/**
 * Custom error class for Figma CLI operations
 */
export class FigmaError extends Error {
  constructor(message) {
    super(message);
    this.name = "FigmaError";
  }
}

/**
 * Parse Figma file key and optional node-id from either:
 * - A full Figma URL (e.g. https://www.figma.com/design/AbCdEf12345/App-Design?node-id=1-23)
 * - A legacy Figma file URL (https://www.figma.com/file/AbCdEf12345/...)
 * - A raw file key string (e.g. AbCdEf12345)
 */
export function parseFigmaInput(input) {
  if (!input || typeof input !== "string") {
    return { fileKey: "", nodeId: null };
  }
  const trimmed = input.trim();
  const match = trimmed.match(
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9_-]+)(?:[/?][^ \t\r\n]*)?/
  );
  if (match) {
    const fileKey = match[1];
    let nodeId = null;
    try {
      const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const rawNodeId = urlObj.searchParams.get("node-id");
      if (rawNodeId) {
        nodeId = rawNodeId.replace("-", ":");
      }
    } catch {
      // ignore URL parse errors if malformed
    }
    return { fileKey, nodeId };
  }
  return { fileKey: trimmed, nodeId: null };
}

/**
 * Sanitize node name for safe file naming on disk.
 */
export function sanitizeNodeName(name) {
  if (!name) return "unnamed-frame";
  return name
    .toLowerCase()
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Recursively find top-level frames or components in a Figma document tree.
 */
export function extractFrames(node, acc = [], depth = 0) {
  if (!node) return acc;

  // In Figma, top-level screen frames typically live directly inside CANVAS (page)
  if (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET" ||
    node.type === "SECTION"
  ) {
    acc.push({
      id: node.id,
      name: node.name,
      type: node.type,
      width: node.absoluteBoundingBox?.width ?? null,
      height: node.absoluteBoundingBox?.height ?? null,
    });
    // Do not drill down deeper into children of a screen frame to avoid exploding asset count
    return acc;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      extractFrames(child, acc, depth + 1);
    }
  }

  return acc;
}

/**
 * Fetch Figma file metadata via REST API
 */
export async function getFigmaFile(fileKey, token, customFetch = fetch) {
  const url = `${FIGMA_API_BASE}/files/${fileKey}`;
  const res = await customFetch(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new FigmaError(
        `Figma API authentication failed (${res.status}). Verify your FIGMA_PERSONAL_TOKEN.`
      );
    }
    if (res.status === 404) {
      throw new FigmaError(`Figma file not found (404): ${fileKey}`);
    }
    const text = await res.text();
    throw new FigmaError(`Figma API request failed (${res.status}): ${text}`);
  }

  return await res.json();
}

/**
 * Render frames to SVG/PNG URLs via Figma REST API
 */
export async function renderFigmaImages(
  fileKey,
  nodeIds,
  format = "svg",
  scale = 1,
  token,
  customFetch = fetch
) {
  if (!nodeIds || nodeIds.length === 0) return {};
  const idsParam = nodeIds.map((id) => encodeURIComponent(id)).join(",");
  const url = `${FIGMA_API_BASE}/images/${fileKey}?ids=${idsParam}&format=${format}&scale=${scale}`;

  const res = await customFetch(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new FigmaError(`Figma image export request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.err) {
    throw new FigmaError(`Figma image export error: ${data.err}`);
  }

  return data.images || {};
}

/**
 * Update or create `docs/03-ui/<slug>/figma-links.md`
 */
export function recordFigmaLinks(uiDir, { fileKey, fileName, frames, format, dateStr = new Date().toISOString().split("T")[0] }) {
  const linksFilePath = path.join(uiDir, "figma-links.md");
  let existingContent = "";
  if (fs.existsSync(linksFilePath)) {
    existingContent = fs.readFileSync(linksFilePath, "utf8");
  }

  const lines = [];
  lines.push(`# UI Reference — Figma Live Assets`);
  lines.push(``);
  lines.push(`- **Figma File:** [${fileName || fileKey}](https://www.figma.com/design/${fileKey})`);
  lines.push(`- **File Key:** \`${fileKey}\``);
  lines.push(`- **Last Synced:** ${dateStr}`);
  lines.push(`- **Render Format:** \`${format.toUpperCase()}\``);
  lines.push(``);
  lines.push(`## Screen Frames`);
  lines.push(``);

  for (const frame of frames) {
    const sanitized = sanitizeNodeName(frame.name);
    const assetRelPath = `screens/${sanitized}.${format}`;
    const frameFigmaUrl = `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(frame.id.replace(":", "-"))}`;
    
    lines.push(`### ${frame.name}`);
    lines.push(`- **Node ID:** \`${frame.id}\``);
    lines.push(`- **Figma Node:** [Direct Link](${frameFigmaUrl})`);
    lines.push(`- **Snapshot ngày:** ${dateStr}`);
    lines.push(`- **Local Asset:** [${assetRelPath}](./${assetRelPath})`);
    if (frame.width && frame.height) {
      lines.push(`- **Dimensions:** ${Math.round(frame.width)}x${Math.round(frame.height)} px`);
    }
    lines.push(``);
  }

  // Preserve existing CHANGELOG if present in figma-links.md
  if (existingContent.includes("## Khi UI đổi giữa chừng") || existingContent.includes("## CHANGELOG")) {
    const marker = existingContent.includes("## CHANGELOG") ? "## CHANGELOG" : "## Khi UI đổi giữa chừng";
    const changelogPart = existingContent.substring(existingContent.indexOf(marker));
    lines.push(changelogPart.trim());
    lines.push(``);
  } else {
    lines.push(`## CHANGELOG UI`);
    lines.push(``);
    lines.push(`### v1 — ${dateStr}`);
    lines.push(`- Initial snapshot sync via \`aspec-kit figma sync\`.`);
    lines.push(`- **Affected issues:** #initial`);
    lines.push(``);
  }

  fs.writeFileSync(linksFilePath, lines.join("\n"), "utf8");
  return linksFilePath;
}

/**
 * Execute figma sync command
 */
export async function syncFigma({
  input,
  slug,
  format = "svg",
  scale,
  token,
  nodeIdsFilter = [],
  dir = ".",
  fetchFn = fetch,
  logger = console,
}) {
  const effectiveToken = token || process.env.FIGMA_PERSONAL_TOKEN;
  if (!effectiveToken) {
    throw new FigmaError(
      `Missing FIGMA_PERSONAL_TOKEN. Set it in your environment or provide --token <token>.\n` +
      `Generate a token in Figma: Account Settings -> Personal access tokens.`
    );
  }

  const { fileKey, nodeId } = parseFigmaInput(input);
  if (!fileKey) {
    throw new FigmaError(`Invalid Figma file key or URL provided: "${input}"`);
  }

  logger.log(`🔍 Inspecting Figma file: ${fileKey}...`);
  const fileData = await getFigmaFile(fileKey, effectiveToken, fetchFn);
  const fileName = fileData.name || "Figma Design";

  // Derive slug if not specified
  const effectiveSlug = slug || sanitizeNodeName(fileName) || "default";

  // Discover frames
  let allFrames = [];
  if (fileData.document) {
    allFrames = extractFrames(fileData.document);
  }

  // Filter if nodeIds are specified via URL query or --node-id flag
  const targetIds = [...nodeIdsFilter];
  if (nodeId && !targetIds.includes(nodeId)) {
    targetIds.push(nodeId);
  }

  const selectedFrames = targetIds.length > 0
    ? allFrames.filter((f) => targetIds.includes(f.id) || targetIds.includes(f.id.replace(":", "-")))
    : allFrames;

  if (selectedFrames.length === 0) {
    logger.log(`${YELLOW}⚠ No matching screen frames or components found in file ${fileKey}.${RESET}`);
    return { fileKey, fileName, count: 0 };
  }

  logger.log(`✓ Found ${selectedFrames.length} frame(s) in "${fileName}".`);

  // Setup directory docs/03-ui/<slug>/screens
  const targetProjectDir = path.resolve(dir);
  const uiDir = path.join(targetProjectDir, "docs", "03-ui", effectiveSlug);
  const screensDir = path.join(uiDir, "screens");
  fs.mkdirSync(screensDir, { recursive: true });

  // Render images
  const targetFormat = format.toLowerCase() === "png" ? "png" : "svg";
  const defaultScale = targetFormat === "png" ? 2 : 1;
  const effectiveScale = scale ? Number(scale) : defaultScale;

  logger.log(`📥 Requesting ${targetFormat.toUpperCase()} exports from Figma Render API...`);
  const frameIds = selectedFrames.map((f) => f.id);
  const imageUrlMap = await renderFigmaImages(
    fileKey,
    frameIds,
    targetFormat,
    effectiveScale,
    effectiveToken,
    fetchFn
  );

  let downloadedCount = 0;
  for (const frame of selectedFrames) {
    const imageUrl = imageUrlMap[frame.id];
    if (!imageUrl) {
      logger.log(`  ${YELLOW}⚠ Could not get export URL for "${frame.name}" (${frame.id})${RESET}`);
      continue;
    }

    const safeName = sanitizeNodeName(frame.name);
    const destFile = path.join(screensDir, `${safeName}.${targetFormat}`);

    const imgRes = await fetchFn(imageUrl);
    if (!imgRes.ok) {
      logger.log(`  ${RED}✖ Failed to download image for "${frame.name}" (${imgRes.status})${RESET}`);
      continue;
    }

    if (targetFormat === "svg") {
      const svgText = await imgRes.text();
      fs.writeFileSync(destFile, svgText, "utf8");
    } else {
      const arrayBuffer = await imgRes.arrayBuffer();
      fs.writeFileSync(destFile, Buffer.from(arrayBuffer));
    }
    logger.log(`  ${GREEN}✓${RESET} Saved: docs/03-ui/${effectiveSlug}/screens/${safeName}.${targetFormat}`);
    downloadedCount++;
  }

  // Record figma-links.md
  const linksPath = recordFigmaLinks(uiDir, {
    fileKey,
    fileName,
    frames: selectedFrames,
    format: targetFormat,
  });

  logger.log(`${GREEN}✓${RESET} UI metadata recorded to: ${path.relative(targetProjectDir, linksPath)}`);
  logger.log(`${GREEN}✓ Sync complete!${RESET} ${downloadedCount} wireframe(s) stored in docs/03-ui/${effectiveSlug}/screens/`);

  return {
    fileKey,
    fileName,
    slug: effectiveSlug,
    count: downloadedCount,
    linksPath,
  };
}

/**
 * CLI Entry point for `aspec-kit figma`
 */
export async function runFigma(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      slug: { type: "string" },
      format: { type: "string", default: "svg" },
      scale: { type: "string" },
      token: { type: "string" },
      "node-id": { type: "string" },
      dir: { type: "string", default: "." },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  const subcommand = positionals[0] === "sync" ? positionals[0] : (positionals[0] ? "sync" : null);
  const targetInput = positionals[0] === "sync" ? positionals[1] : positionals[0];

  if (!subcommand || !targetInput) {
    console.error(`${RED}Error: Missing required Figma file key or URL.${RESET}\n`);
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const nodeFilter = values["node-id"]
    ? values["node-id"].split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  try {
    await syncFigma({
      input: targetInput,
      slug: values.slug,
      format: values.format,
      scale: values.scale,
      token: values.token,
      nodeIdsFilter: nodeFilter,
      dir: values.dir,
      logger: console,
    });
  } catch (err) {
    if (err instanceof FigmaError) {
      console.error(`${RED}✖ [Figma Sync Error] ${err.message}${RESET}`);
      process.exit(1);
    }
    throw err;
  }
}
