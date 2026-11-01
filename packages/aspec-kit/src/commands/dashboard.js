// `aspec-kit view` (or `aspec-kit dashboard`) — local HTTP deliverables dashboard for BrSE & PM.
// Zero dependencies (uses native Node.js `node:http`).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { parseArgs } from "node:util";

const isColorSupported =
  !process.env.NO_COLOR &&
  (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);
const GREEN = isColorSupported ? "\x1b[32m" : "";
const CYAN = isColorSupported ? "\x1b[36m" : "";
const YELLOW = isColorSupported ? "\x1b[33m" : "";
const BOLD = isColorSupported ? "\x1b[1m" : "";
const RESET = isColorSupported ? "\x1b[0m" : "";

const HELP_TEXT = `Usage:
  npx @hoanghainh/aspec-kit view [project-dir] [options]
  npx @hoanghainh/aspec-kit dashboard [project-dir] [options]

Options:
  -p, --port <number>   Port to listen on (default: 3000)
  --host <string>       Host interface to bind (default: 127.0.0.1)
  --no-open             Do not attempt to open browser automatically
  --export [path]       Export standalone static HTML deliverable without starting server
                        (default: docs/deliverables.html)
  -h, --help            Display this help message

Deliverables available in the dashboard:
  • Traceability Matrix (Design -> AC -> Tasks -> Code -> Tests)
  • Q&A Sheet (質問票) viewer with status filters
  • Weekly Progress Reports timeline (docs/reports/)
  • Test Specifications (テスト仕様書) with export view
`;

/**
 * Parse CSV content with quotes support
 */
export function parseCsv(text) {
  if (!text || typeof text !== "string") return [];
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Collect all deliverables data from an aspec-kit project directory
 */
export function collectDashboardData(projectDir = ".") {
  const root = path.resolve(projectDir);
  const data = {
    projectName: path.basename(root),
    rootPath: root,
    timestamp: new Date().toISOString(),
    traceability: [],
    qaSheets: [],
    reports: [],
    testSpecs: [],
  };

  // 1. Traceability Matrix
  const tracePath = path.join(root, "docs", "traceability.md");
  if (fs.existsSync(tracePath)) {
    const content = fs.readFileSync(tracePath, "utf8");
    const lines = content.split("\n");
    let inTable = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!inTable && (trimmed.startsWith("| AC") || trimmed.startsWith("| **AC"))) {
        inTable = true;
        continue;
      }
      if (inTable && trimmed.startsWith("|---")) continue;
      if (inTable && trimmed.startsWith("|")) {
        const cols = trimmed.split("|").slice(1, -1).map((c) => c.trim());
        if (cols.length >= 7) {
          data.traceability.push({
            ac: cols[0].replace(/\*\*/g, ""),
            description: cols[1].replace(/<br>/g, "\n"),
            intakeSource: cols[2].replace(/<br>/g, "\n"),
            tasks: cols[3].replace(/<br>/g, "\n"),
            sourceFiles: cols[4].replace(/<br>/g, "\n"),
            testCases: cols[5].replace(/<br>/g, "\n"),
            status: cols[6],
          });
        }
      } else if (inTable && !trimmed.startsWith("|") && trimmed) {
        inTable = false;
      }
    }
  }

  // 2. Q&A Sheets (docs/qa/*.csv)
  const qaDir = path.join(root, "docs", "qa");
  if (fs.existsSync(qaDir)) {
    const files = fs.readdirSync(qaDir).filter((f) => f.endsWith(".csv"));
    for (const file of files) {
      const fullPath = path.join(qaDir, file);
      const csvContent = fs.readFileSync(fullPath, "utf8");
      const rows = parseCsv(csvContent);
      if (rows.length > 1) {
        const headers = rows[0];
        const items = rows.slice(1).map((r) => {
          const item = {};
          headers.forEach((h, idx) => {
            item[h] = r[idx] || "";
          });
          return item;
        });
        data.qaSheets.push({
          file,
          slug: file.replace(/\.csv$/, ""),
          items,
        });
      }
    }
  }

  // 3. Weekly Reports (docs/reports/*.md)
  const reportsDir = path.join(root, "docs", "reports");
  if (fs.existsSync(reportsDir)) {
    const files = fs.readdirSync(reportsDir).filter((f) => f.endsWith(".md")).sort().reverse();
    for (const file of files) {
      const fullPath = path.join(reportsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const firstLine = content.split("\n")[0] || file;
      const title = firstLine.replace(/^#\s*/, "");
      data.reports.push({
        file,
        title,
        content,
      });
    }
  }

  // 4. Test Specifications (docs/test-specs/*.csv)
  const testSpecDir = path.join(root, "docs", "test-specs");
  if (fs.existsSync(testSpecDir)) {
    const files = fs.readdirSync(testSpecDir).filter((f) => f.endsWith(".csv"));
    for (const file of files) {
      const fullPath = path.join(testSpecDir, file);
      const csvContent = fs.readFileSync(fullPath, "utf8");
      const rows = parseCsv(csvContent);
      if (rows.length > 1) {
        const headers = rows[0];
        const items = rows.slice(1).map((r) => {
          const item = {};
          headers.forEach((h, idx) => {
            item[h] = r[idx] || "";
          });
          return item;
        });
        data.testSpecs.push({
          file,
          slug: file.replace(/\.csv$/, ""),
          items,
        });
      }
    }
  }

  return data;
}

/**
 * Generate full self-contained dashboard HTML page
 */
export function renderDashboardHtml(data) {
  const jsonPayload = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.projectName} — aspec-kit Deliverables Dashboard</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #4ade80;
      --warning: #facc15;
      --danger: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      background: #0284c7;
      color: white;
    }
    nav {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    button.tab-btn {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    button.tab-btn:hover { border-color: var(--primary); }
    button.tab-btn.active {
      background: var(--primary);
      color: #0f172a;
      border-color: var(--primary);
      font-weight: bold;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 12px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #0f172a;
      color: var(--primary);
      position: sticky;
      top: 0;
    }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-ok { background: rgba(74, 222, 128, 0.2); color: var(--success); }
    .status-warn { background: rgba(250, 204, 21, 0.2); color: var(--warning); }
    .status-open { background: rgba(248, 113, 113, 0.2); color: var(--danger); }
    .filter-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }
    select, input {
      background: #0f172a;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 10px;
      border-radius: 4px;
    }
    pre {
      background: #0f172a;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: Consolas, monospace;
      font-size: 13px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-value { font-size: 28px; font-weight: bold; color: var(--primary); }
    .stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>⚡ ${data.projectName} <span class="badge">aspec-kit v0.4.0</span></h1>
      <p style="color: var(--text-muted); font-size: 13px;">BrSE & Project Manager Deliverables Dashboard · ${data.rootPath}</p>
    </div>
    <div style="font-size: 12px; color: var(--text-muted);">
      Synced: ${new Date(data.timestamp).toLocaleString()}
    </div>
  </header>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" id="count-trace">${data.traceability.length}</div>
      <div class="stat-label">Traceability Items</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="count-qa">${data.qaSheets.reduce((acc, q) => acc + q.items.length, 0)}</div>
      <div class="stat-label">Q&A Questions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="count-testspecs">${data.testSpecs.reduce((acc, t) => acc + t.items.length, 0)}</div>
      <div class="stat-label">Test Specifications</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="count-reports">${data.reports.length}</div>
      <div class="stat-label">Weekly Reports</div>
    </div>
  </div>

  <nav>
    <button class="tab-btn active" onclick="showTab('trace')">📋 Traceability Matrix</button>
    <button class="tab-btn" onclick="showTab('qa')">💬 Q&A Sheets (質問票)</button>
    <button class="tab-btn" onclick="showTab('testspecs')">🧪 Test Specs (テスト仕様書)</button>
    <button class="tab-btn" onclick="showTab('reports')">📅 Progress Reports (週次進捗)</button>
  </nav>

  <!-- 1. Traceability Tab -->
  <section id="tab-trace" class="tab-content active">
    <div class="card">
      <h2>要件トレーサビリティマトリクス (Traceability Matrix)</h2>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">
        Liên kết xuyên suốt từ Design Intake ➔ AC ➔ Tasks ➔ Code ➔ Test Cases
      </p>
      <table>
        <thead>
          <tr>
            <th>AC</th>
            <th>Mô tả yêu cầu (Spec AC)</th>
            <th>Nguồn thiết kế / Intake</th>
            <th>Tasks</th>
            <th>Source Files</th>
            <th>Test Cases</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${data.traceability.map((row) => `
            <tr>
              <td><strong>${escapeHtml(row.ac)}</strong></td>
              <td>${formatMultiline(row.description)}</td>
              <td>${formatMultiline(row.intakeSource)}</td>
              <td>${formatMultiline(row.tasks)}</td>
              <td>${formatMultiline(row.sourceFiles)}</td>
              <td>${formatMultiline(row.testCases)}</td>
              <td><span class="status-pill status-ok">${escapeHtml(row.status)}</span></td>
            </tr>
          `).join("")}
          ${data.traceability.length === 0 ? `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Không tìm thấy dữ liệu trong docs/traceability.md</td></tr>` : ""}
        </tbody>
      </table>
    </div>
  </section>

  <!-- 2. Q&A Sheets Tab -->
  <section id="tab-qa" class="tab-content">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2>質問票 (Q&A Sheets)</h2>
        <div class="filter-bar">
          <label style="font-size: 13px;">Lọc trạng thái:</label>
          <select id="qa-filter" onchange="filterQa()">
            <option value="ALL">Tất cả</option>
            <option value="回答済">回答済 (Answered)</option>
            <option value="未回答">未回答 (Open)</option>
          </select>
        </div>
      </div>
      ${data.qaSheets.map((sheet) => `
        <h3 style="margin-top: 16px; color: var(--primary);">${escapeHtml(sheet.file)}</h3>
        <table class="qa-table">
          <thead>
            <tr>
              <th>No</th>
              <th>対象画面/機能</th>
              <th>質問内容</th>
              <th>背景・提案</th>
              <th>回答欄</th>
              <th>回答期限</th>
              <th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            ${sheet.items.map((it) => `
              <tr data-status="${escapeHtml(it["ステータス"] || "")}">
                <td><strong>${escapeHtml(it["No"] || "")}</strong></td>
                <td>${escapeHtml(it["対象画面/機能"] || "")}</td>
                <td>${escapeHtml(it["質問内容"] || "")}</td>
                <td>${escapeHtml(it["背景・提案"] || "")}</td>
                <td>${escapeHtml(it["回答欄"] || "")}</td>
                <td>${escapeHtml(it["回答期限"] || "")}</td>
                <td>
                  <span class="status-pill ${(it["ステータス"] || "").includes("済") ? "status-ok" : "status-open"}">
                    ${escapeHtml(it["ステータス"] || "Open")}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `).join("")}
      ${data.qaSheets.length === 0 ? `<p style="color: var(--text-muted);">Chưa có file CSV nào trong docs/qa/</p>` : ""}
    </div>
  </section>

  <!-- 3. Test Specs Tab -->
  <section id="tab-testspecs" class="tab-content">
    <div class="card">
      <h2>テスト仕様書 (Test Specifications)</h2>
      ${data.testSpecs.map((spec) => `
        <h3 style="margin-top: 16px; color: var(--primary);">${escapeHtml(spec.file)}</h3>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>観点</th>
              <th>前提条件</th>
              <th>手順</th>
              <th>期待結果</th>
              <th>結果</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody>
            ${spec.items.map((it) => `
              <tr>
                <td><strong>${escapeHtml(it["No"] || "")}</strong></td>
                <td>${escapeHtml(it["観点"] || "")}</td>
                <td>${escapeHtml(it["前提条件"] || "")}</td>
                <td>${formatMultiline(it["手順"] || "")}</td>
                <td>${formatMultiline(it["期待結果"] || "")}</td>
                <td><span class="status-pill status-ok">${escapeHtml(it["結果"] || "")}</span></td>
                <td>${escapeHtml(it["備考"] || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `).join("")}
      ${data.testSpecs.length === 0 ? `<p style="color: var(--text-muted);">Chưa có file CSV nào trong docs/test-specs/</p>` : ""}
    </div>
  </section>

  <!-- 4. Progress Reports Tab -->
  <section id="tab-reports" class="tab-content">
    <div class="card">
      <h2>週次進捗報告書 (Weekly Progress Reports)</h2>
      ${data.reports.map((rep) => `
        <details style="margin-top: 12px; border: 1px solid var(--border); border-radius: 6px; padding: 12px;" open>
          <summary style="font-weight: bold; cursor: pointer; color: var(--primary);">
            ${escapeHtml(rep.title)} (${escapeHtml(rep.file)})
          </summary>
          <pre style="margin-top: 10px;">${escapeHtml(rep.content)}</pre>
        </details>
      `).join("")}
      ${data.reports.length === 0 ? `<p style="color: var(--text-muted);">Chưa có báo cáo nào trong docs/reports/</p>` : ""}
    </div>
  </section>

  <script>
    const DASHBOARD_DATA = ${jsonPayload};

    function showTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      document.getElementById('tab-' + tabId).classList.add('active');
      event.target.classList.add('active');
    }

    function filterQa() {
      const val = document.getElementById('qa-filter').value;
      document.querySelectorAll('.qa-table tbody tr').forEach(tr => {
        const status = tr.getAttribute('data-status') || '';
        if (val === 'ALL' || status.includes(val)) {
          tr.style.display = '';
        } else {
          tr.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMultiline(str) {
  if (!str) return "";
  return escapeHtml(str).replace(/\n/g, "<br>");
}

/**
 * Export standalone static dashboard HTML to file
 */
export function exportDashboardHtml(projectDir = ".", outputPath = null, logger = console) {
  const root = path.resolve(projectDir);
  const data = collectDashboardData(root);
  const html = renderDashboardHtml(data);

  const destPath = outputPath
    ? (path.isAbsolute(outputPath) ? outputPath : path.resolve(root, outputPath))
    : path.join(root, "docs", "deliverables.html");

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, html, "utf8");

  logger.log(`${GREEN}✓ Static Deliverables Dashboard exported successfully!${RESET}`);
  logger.log(`  File: ${CYAN}${BOLD}${destPath}${RESET}`);
  logger.log(`  Items: ${data.traceability.length} ACs, ${data.qaSheets.length} Q&A sheets, ${data.testSpecs.length} Test specs, ${data.reports.length} reports`);

  return destPath;
}

/**
 * Start the HTTP dashboard server
 */
export function startDashboardServer({
  projectDir = ".",
  port = 3000,
  host = "127.0.0.1",
  openBrowser = false,
  logger = console,
}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${host}:${port}`);

      if (url.pathname === "/api/data") {
        const data = collectDashboardData(projectDir);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(data));
        return;
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        const data = collectDashboardData(projectDir);
        const html = renderDashboardHtml(data);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    server.on("error", (err) => {
      reject(err);
    });

    server.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      logger.log(`${GREEN}✓ aspec-kit Deliverables Dashboard started!${RESET}`);
      logger.log(`  URL: ${CYAN}${BOLD}${url}${RESET}`);
      logger.log(`  Target Project: ${path.resolve(projectDir)}`);
      logger.log(`  Press ${BOLD}Ctrl+C${RESET} to stop.`);
      resolve({ server, url, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

/**
 * CLI Runner for `aspec-kit view` / `aspec-kit dashboard`
 */
export async function runDashboard(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      port: { type: "string", short: "p", default: "3000" },
      host: { type: "string", default: "127.0.0.1" },
      open: { type: "boolean", default: true },
      export: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  const projectDir = positionals[0] || ".";

  // Check if export flag is used (either --export or --export <path>)
  if (values.export !== undefined || args.includes("--export")) {
    const rawExportIdx = args.indexOf("--export");
    let exportTarget = values.export;
    if (!exportTarget && rawExportIdx !== -1 && args[rawExportIdx + 1] && !args[rawExportIdx + 1].startsWith("-")) {
      exportTarget = args[rawExportIdx + 1];
    }
    exportDashboardHtml(projectDir, exportTarget, console);
    return;
  }

  const port = parseInt(values.port, 10) || 3000;

  try {
    await startDashboardServer({
      projectDir,
      port,
      host: values.host,
      openBrowser: values.open,
      logger: console,
    });
  } catch (err) {
    console.error(`\x1b[31m✖ Failed to start dashboard:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}
