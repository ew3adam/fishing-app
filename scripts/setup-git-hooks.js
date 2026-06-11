/**
 * Installs the pre-commit hook that runs PII / secrets scan on staged files.
 * Runs automatically via npm "prepare" after npm install.
 */
var fs = require("fs");
var path = require("path");

var repoRoot = path.join(__dirname, "..");
var hooksDir = path.join(repoRoot, ".git", "hooks");
var hookPath = path.join(hooksDir, "pre-commit");

var hookBody = [
  "#!/bin/sh",
  "# RFC PII / secrets scan — auto-installed by scripts/setup-git-hooks.js",
  "cd \"$(git rev-parse --show-toplevel)\" || exit 1",
  "node scripts/scan-pii.js --staged",
  "exit $?",
  "",
].join("\n");

if (!fs.existsSync(hooksDir)) {
  console.warn("[setup-git-hooks] No .git/hooks folder — skipping (not a git repo?).");
  process.exit(0);
}

fs.writeFileSync(hookPath, hookBody, { mode: 0o755 });
console.log("[setup-git-hooks] Installed pre-commit hook → .git/hooks/pre-commit");
