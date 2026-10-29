// Implementation of create-aspec-kit CLI generator using native Node.js
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execSync } from "node:child_process";
import https from "node:https";

const GITHUB_REPO_URL = "https://github.com/hoanghainh1188/aspec-kit.git";
const TARBALL_URL = "https://codeload.github.com/hoanghainh1188/aspec-kit/tar.gz/refs/heads/main";

// Helper for interactive prompt
async function promptUser(rl, question, defaultValue) {
  const displayPrompt = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;
  const answer = await rl.question(displayPrompt);
  return answer.trim() || defaultValue;
}

// Download and unpack via git or fallback to GitHub tarball
async function fetchTemplate(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  // Strategy 1: Git clone (fastest and most reliable if git is installed)
  try {
    console.log("==> Fetching template via git clone...");
    execSync(`git clone --depth 1 "${GITHUB_REPO_URL}" "${targetDir}"`, {
      stdio: "pipe",
    });
    // Remove original .git history
    fs.rmSync(path.join(targetDir, ".git"), { recursive: true, force: true });
    // Remove internal packages folder (CLI generator itself)
    fs.rmSync(path.join(targetDir, "packages"), { recursive: true, force: true });
    return;
  } catch {
    console.log("==> Git clone failed or git not available, falling back to tarball download...");
  }

  // Strategy 2: Download tarball and extract
  const tempTarPath = path.join(targetDir, "template.tar.gz");
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

  console.log("==> Extracting template archive...");
  execSync(`tar -xzf "${tempTarPath}" --strip-components=1 -C "${targetDir}"`, {
    stdio: "inherit",
  });

  fs.unlinkSync(tempTarPath);
  fs.rmSync(path.join(targetDir, "packages"), { recursive: true, force: true });
}

export async function main() {
  console.log("\n=======================================================");
  console.log("🚀  aspec-kit — Spec-Driven Project Generator");
  console.log("=======================================================\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // 1. Get project directory
    const argTarget = process.argv[2];
    const projectName =
      argTarget || (await promptUser(rl, "Project directory name", "my-aspec-app"));
    const targetDir = path.resolve(process.cwd(), projectName);

    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      const overwrite = await promptUser(
        rl,
        `Directory "${projectName}" already exists and is not empty. Continue? (y/N)`,
        "N"
      );
      if (overwrite.toLowerCase() !== "y") {
        console.log("Aborted.");
        rl.close();
        return;
      }
    }

    // 2. Steward handle
    const stewardHandle = await promptUser(
      rl,
      "GitHub handle of project Steward (for .github/CODEOWNERS)",
      "@your-handle"
    );

    // 3. Keep sample feature
    const keepExample = await promptUser(
      rl,
      "Keep sample feature (000-example-reservation) for reference? (y/N)",
      "N"
    );

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

    // 6. Initialize git repo
    try {
      execSync("git init", { cwd: targetDir, stdio: "ignore" });
      console.log("✓ Initialized fresh git repository");
    } catch {
      // Git not installed, ignore
    }

    // 7. Output completion banner
    console.log(`\n=======================================================`);
    console.log(`🎉  Project created successfully in ${targetDir}!`);
    console.log(`=======================================================\n`);
    console.log("Next steps:");
    console.log(`  1. cd ${projectName}`);
    console.log("  2. bash bootstrap.sh    # Setup Spec Kit CLI and hooks");
    console.log("  3. claude               # Launch Claude Code and run /speckit-constitution\n");
  } catch (err) {
    rl.close();
    throw err;
  }
}
