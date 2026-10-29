// Implementation of aspec-kit CLI generator using native Node.js
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { execSync } from "node:child_process";
import https from "node:https";

const GITHUB_REPO_URL = "https://github.com/hoanghainh1188/aspec-kit.git";
const TARBALL_URL = "https://codeload.github.com/hoanghainh1188/aspec-kit/tar.gz/refs/heads/main";

// Color helpers
const isColorSupported =
  !process.env.NO_COLOR &&
  (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);

const CYAN = isColorSupported ? "\x1b[36m" : "";
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

function printBanner(version) {
  console.log(CYAN + BOLD + ASCII_LOGO + RESET);
  console.log(DIM + "   Spec-Driven Development for Claude Code & Japanese Design Docs" + RESET);
  console.log(DIM + `   Version: v${version}\n` + RESET);
}

// Helper for interactive prompt
async function promptUser(rl, question, defaultValue) {
  const displayPrompt = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;
  const answer = await rl.question(displayPrompt);
  return answer.trim() || defaultValue;
}

// Fetch template to temporary directory and copy to targetDir
async function fetchTemplate(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  const tempCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "aspec-kit-"));
  try {
    try {
      console.log("==> Fetching template via git clone...");
      execSync(`git clone --depth 1 "${GITHUB_REPO_URL}" "${tempCloneDir}"`, {
        stdio: "pipe",
      });
    } catch {
      console.log("==> Git clone failed, falling back to tarball download...");
      const tempTarPath = path.join(tempCloneDir, "template.tar.gz");
      await new Promise((resolve, reject) => {
        https.get(TARBALL_URL, (res) => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`Failed to download template archive: HTTP ${res.statusCode}`)
            );
          }
          const fileStream = fs.createWriteStream(tempTarPath);
          res.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });
          fileStream.on("error", reject);
        }).on("error", reject);
      });
      execSync(`tar -xzf "${tempTarPath}" --strip-components=1 -C "${tempCloneDir}"`, {
        stdio: "inherit",
      });
      fs.unlinkSync(tempTarPath);
    }

    // Clean internal items before copying
    fs.rmSync(path.join(tempCloneDir, ".git"), { recursive: true, force: true });
    fs.rmSync(path.join(tempCloneDir, "packages"), { recursive: true, force: true });

    // Copy template files to targetDir (supports copying into '.' as well)
    console.log("==> Scaffolding project files...");
    fs.cpSync(tempCloneDir, targetDir, { recursive: true });
  } finally {
    fs.rmSync(tempCloneDir, { recursive: true, force: true });
  }
}

export async function main() {
  const args = process.argv.slice(2);
  const pkgPath = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  // Handle help flag
  if (args.includes("--help") || args.includes("-h")) {
    printBanner(pkg.version);
    console.log(`Usage:
  npx @hoanghainh/aspec-kit init [project-directory] [options]
  npx @hoanghainh/aspec-kit [project-directory] [options]
  npm init @hoanghainh/aspec-kit [project-directory] [options]

Commands:
  init [dir]           Initialize a new aspec-kit project (use '.' for current dir)

Options:
  -v, --version        Display CLI version
  -h, --help           Display this help message
  -y, --yes            Use default settings without interactive prompts
  --steward <handle>   Specify GitHub handle for .github/CODEOWNERS
  --keep-example       Keep sample feature (000-example-reservation)
  --clean              Clean up sample feature

Examples:
  npx @hoanghainh/aspec-kit init my-app
  npx @hoanghainh/aspec-kit init .
  npm init @hoanghainh/aspec-kit my-app
  npx @hoanghainh/aspec-kit my-app --steward @lead-engineer --clean
`);
    return;
  }

  // Handle version flag
  if (args.includes("--version") || args.includes("-v")) {
    console.log(pkg.version);
    return;
  }

  printBanner(pkg.version);

  const isYes = args.includes("--yes") || args.includes("-y");
  const stewardArgIndex = args.indexOf("--steward");
  const stewardArg = stewardArgIndex !== -1 ? args[stewardArgIndex + 1] : null;
  const keepExampleArg = args.includes("--keep-example")
    ? "y"
    : args.includes("--clean")
      ? "n"
      : null;

  // Filter out flag options to find target directory name
  let positionalArgs = args.filter(
    (arg, i) =>
      !arg.startsWith("-") && (stewardArgIndex === -1 || i !== stewardArgIndex + 1)
  );

  // If first positional argument is 'init', treat it as subcommand
  if (positionalArgs[0] === "init") {
    positionalArgs.shift();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // 1. Get project directory
    const argTarget = positionalArgs[0];
    const projectName =
      argTarget ||
      (isYes
        ? "my-aspec-app"
        : await promptUser(rl, "Project directory name (or '.' for current directory)", "my-aspec-app"));
    const targetDir = path.resolve(process.cwd(), projectName);

    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      if (isYes) {
        console.error(`Error: Directory "${projectName}" already exists and is not empty.`);
        process.exit(1);
      }
      const dirDisplayName = projectName === "." ? "Current directory" : `Directory "${projectName}"`;
      const overwrite = await promptUser(
        rl,
        `${dirDisplayName} is not empty. Continue? (y/N)`,
        "N"
      );
      if (overwrite.toLowerCase() !== "y") {
        console.log("Aborted.");
        rl.close();
        return;
      }
    }

    // 2. Steward handle
    const stewardHandle =
      stewardArg ||
      (isYes
        ? "@your-handle"
        : await promptUser(
            rl,
            "GitHub handle of project Steward (for .github/CODEOWNERS)",
            "@your-handle"
          ));

    // 3. Keep sample feature
    const keepExample =
      keepExampleArg ||
      (isYes
        ? "n"
        : await promptUser(
            rl,
            "Keep sample feature (000-example-reservation) for reference? (y/N)",
            "N"
          ));

    rl.close();

    // 4. Download and setup template
    await fetchTemplate(targetDir);

    // 5. Customize project configuration
    console.log("==> Customizing project files...");

    // Update CODEOWNERS
    const codeownersPath = path.join(targetDir, ".github", "CODEOWNERS");
    if (fs.existsSync(codeownersPath) && stewardHandle !== "@your-handle") {
      const formattedHandle = stewardHandle.startsWith("@")
        ? stewardHandle
        : `@${stewardHandle}`;
      let content = fs.readFileSync(codeownersPath, "utf-8");
      content = content.replace(/@your-lead-handle/g, formattedHandle);
      fs.writeFileSync(codeownersPath, content, "utf-8");
      console.log(`✓ Updated .github/CODEOWNERS with ${formattedHandle}`);
    }

    // Remove sample feature if requested
    if (keepExample.toLowerCase() !== "y") {
      console.log("==> Removing sample feature...");
      const samplePaths = [
        path.join(targetDir, "specs", "000-example-reservation"),
        path.join(targetDir, "src", "features", "example-reservation"),
        path.join(targetDir, "docs", "intake", "000-example-reservation.md"),
        path.join(
          targetDir,
          "docs",
          "04-decisions",
          "2026-01-01-approval-vs-confirm.md"
        ),
      ];

      for (const p of samplePaths) {
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true });
        }
      }

      // Clean lines from INDEX.md
      const indexPath = path.join(targetDir, "docs", "04-decisions", "INDEX.md");
      if (fs.existsSync(indexPath)) {
        const lines = fs
          .readFileSync(indexPath, "utf-8")
          .split("\n")
          .filter((line) => !line.includes("000-example-reservation"));
        fs.writeFileSync(indexPath, lines.join("\n"), "utf-8");
      }

      // Clean line from docs/05-lessons.md
      const lessonsPath = path.join(targetDir, "docs", "05-lessons.md");
      if (fs.existsSync(lessonsPath)) {
        const lines = fs
          .readFileSync(lessonsPath, "utf-8")
          .split("\n")
          .filter((line) => !line.includes("000-example-reservation"));
        fs.writeFileSync(lessonsPath, lines.join("\n"), "utf-8");
      }
      console.log("✓ Sample feature cleaned up");
    }

    // 6. Initialize git repo if not already a git repository
    try {
      if (!fs.existsSync(path.join(targetDir, ".git"))) {
        execSync("git init", { cwd: targetDir, stdio: "ignore" });
        console.log("✓ Initialized fresh git repository");
      }
    } catch {
      // Git not installed, ignore
    }

    // 7. Output completion banner
    console.log(`\n=======================================================`);
    console.log(`🎉  Project ready in ${targetDir}!`);
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
  } catch (err) {
    rl.close();
    throw err;
  }
}
