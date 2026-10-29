#!/usr/bin/env node
// CLI entry point for create-aspec-kit
import { main } from "../src/index.js";

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
