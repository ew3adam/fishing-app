#!/usr/bin/env node
/**
 * PII and secrets scanner — blocks commits/deploy when real personal data or
 * credentials appear in tracked files.
 *
 * Usage:
 *   node scripts/scan-pii.js --staged     (pre-commit; default)
 *   node scripts/scan-pii.js --all          (full repo audit)
 *   node scripts/scan-pii.js --paths src,public,data  (deploy subset)
 */
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var repoRoot = path.join(__dirname, "..");
var allowlistPath = path.join(__dirname, "pii-allowlist.txt");

// Directories never scanned
var SKIP_DIRS = {
  node_modules: true,
  dist: true,
  build: true,
  ".git": true,
  ".venv": true,
  ".cursor": true,
  ".claude": true,
};

// Binary / lock files skipped by extension
var SKIP_EXT = {
  ".png": true,
  ".jpg": true,
  ".jpeg": true,
  ".gif": true,
  ".webp": true,
  ".svg": true,
  ".ico": true,
  ".woff": true,
  ".woff2": true,
  ".ttf": true,
  ".eot": true,
  ".zip": true,
  ".pdf": true,
  ".lock": true,
};

// Filenames that must never be committed
var BLOCKED_FILENAMES = [
  /^service-account\.json$/i,
  /^serviceAccount.*\.json$/i,
  /firebase-adminsdk-.*\.json$/i,
  /^\.env\.local$/i,
  /^\.env$/i,
];

// Safe full email addresses (placeholders or public club contacts in UI)
var SAFE_EMAILS = {
  "you@email.com": true,
  "your@email.com": true,
  "riversidefishingclubil@gmail.com": true,
  "git@github.com": true,
};

// Safe email domains (placeholders / docs only)
var SAFE_EMAIL_DOMAINS = {
  "example.com": true,
  "example.org": true,
  "example.net": true,
  "test.com": true,
  "localhost": true,
};

var RULES = [
  {
    id: "private_key",
    label: "Private key material",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    id: "password_literal",
    label: "Hardcoded password",
    re: /(?:password|passwd|passphrase)\s*[:=]\s*['"][^'"\s]{4,}['"]/i,
  },
  {
    id: "secret_literal",
    label: "Hardcoded secret / API secret",
    re: /(?:api[_-]?secret|client[_-]?secret|private[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i,
  },
  {
    id: "email",
    label: "Email address",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    filter: function (match) {
      var lower = match.toLowerCase();
      if (SAFE_EMAILS[lower]) {
        return false;
      }
      var domain = lower.split("@")[1];
      return !SAFE_EMAIL_DOMAINS[domain];
    },
  },
  {
    id: "phone_us",
    label: "US phone number",
    re: /(?:\(\d{3}\)\s*\d{3}-\d{4}|\b(?:\+?1[-.\s]?)?(?:\d{3}[-.\s]?){2}\d{4}\b)/g,
    filter: function (match) {
      var digits = match.replace(/\D/g, "");
      if (digits.length === 11 && digits[0] === "1") {
        digits = digits.slice(1);
      }
      // Ignore obvious placeholders
      if (digits === "5555550100" || digits === "5555550000") {
        return false;
      }
      return digits.length === 10;
    },
  },
];

function readAllowlist() {
  if (!fs.existsSync(allowlistPath)) {
    return [];
  }
  return fs
    .readFileSync(allowlistPath, "utf8")
    .split(/\r?\n/)
    .map(function (line) {
      return line.replace(/\s+#.*$/, "").trim();
    })
    .filter(function (line) {
      return line && line.charAt(0) !== "#";
    });
}

/** Simple glob: * matches any path segment chars, ** not supported */
function matchGlob(relPath, pattern) {
  var norm = relPath.replace(/\\/g, "/");
  if (pattern.indexOf("*") < 0) {
    return norm === pattern || norm.endsWith("/" + pattern);
  }
  var escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp("^" + escaped + "$").test(norm);
}

function isAllowlisted(relPath, allowlist) {
  var norm = relPath.replace(/\\/g, "/");
  for (var i = 0; i < allowlist.length; i++) {
    if (matchGlob(norm, allowlist[i])) {
      return true;
    }
  }
  return false;
}

function getStagedFiles() {
  try {
    var out = cp.execSync("git diff --cached --name-only --diff-filter=ACMR", {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return out
      .split(/\r?\n/)
      .map(function (f) {
        return f.trim();
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function walkDir(dir, base, out) {
  if (!fs.existsSync(dir)) {
    return;
  }
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(function (ent) {
    if (SKIP_DIRS[ent.name]) {
      return;
    }
    var full = path.join(dir, ent.name);
    var rel = path.relative(base, full).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      walkDir(full, base, out);
    } else {
      out.push(rel);
    }
  });
}

function getAllFiles() {
  var out = [];
  walkDir(repoRoot, repoRoot, out);
  return out;
}

function getFilesForPaths(pathList) {
  var out = [];
  pathList.forEach(function (p) {
    var full = path.join(repoRoot, p);
    if (!fs.existsSync(full)) {
      return;
    }
    if (fs.statSync(full).isDirectory()) {
      walkDir(full, repoRoot, out);
    } else {
      out.push(p.replace(/\\/g, "/"));
    }
  });
  return out;
}

function shouldSkipFile(relPath) {
  var base = path.basename(relPath);
  var ext = path.extname(base).toLowerCase();
  if (SKIP_EXT[ext]) {
    return true;
  }
  if (base === "package-lock.json" || base === "scan-pii.js") {
    return true;
  }
  return false;
}

function checkBlockedFilename(relPath) {
  var base = path.basename(relPath);
  for (var i = 0; i < BLOCKED_FILENAMES.length; i++) {
    if (BLOCKED_FILENAMES[i].test(base)) {
      return {
        file: relPath,
        line: 0,
        rule: "blocked_filename",
        label: "Blocked secret file name: " + base,
        snippet: base,
      };
    }
  }
  return null;
}

function scanFileContent(relPath, content) {
  var findings = [];
  var lines = content.split(/\r?\n/);

  lines.forEach(function (line, idx) {
    RULES.forEach(function (rule) {
      var re = rule.re;
      var global = re.global;
      if (!global) {
        if (re.test(line)) {
          findings.push({
            file: relPath,
            line: idx + 1,
            rule: rule.id,
            label: rule.label,
            snippet: line.trim().slice(0, 120),
          });
        }
        return;
      }
      var m;
      var copy = new RegExp(re.source, re.flags);
      while ((m = copy.exec(line)) !== null) {
        if (rule.filter && !rule.filter(m[0])) {
          continue;
        }
        findings.push({
          file: relPath,
          line: idx + 1,
          rule: rule.id,
          label: rule.label,
          snippet: m[0],
        });
      }
    });
  });

  return findings;
}

function parseArgs(argv) {
  var mode = "staged";
  var paths = null;
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === "--all") {
      mode = "all";
    } else if (argv[i] === "--staged") {
      mode = "staged";
    } else if (argv[i] === "--paths" && argv[i + 1]) {
      mode = "paths";
      paths = argv[i + 1].split(",").map(function (p) {
        return p.trim();
      });
      i++;
    }
  }
  return { mode: mode, paths: paths };
}

function main() {
  var args = parseArgs(process.argv);
  var allowlist = readAllowlist();
  var files;

  if (args.mode === "all") {
    files = getAllFiles();
  } else if (args.mode === "paths" && args.paths) {
    files = getFilesForPaths(args.paths);
  } else {
    files = getStagedFiles();
  }

  var findings = [];

  files.forEach(function (relPath) {
    if (isAllowlisted(relPath, allowlist) || shouldSkipFile(relPath)) {
      return;
    }

    var blocked = checkBlockedFilename(relPath);
    if (blocked) {
      findings.push(blocked);
      return;
    }

    var full = path.join(repoRoot, relPath);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return;
    }

    var content;
    try {
      content = fs.readFileSync(full, "utf8");
    } catch (e) {
      return;
    }

    findings = findings.concat(scanFileContent(relPath, content));
  });

  if (findings.length === 0) {
    console.log("[scan-pii] OK — no PII or hardcoded secrets found (" + args.mode + ").");
    process.exit(0);
  }

  console.error("");
  console.error("╔══════════════════════════════════════════════════════════════╗");
  console.error("║  PII / SECRETS SCAN FAILED — do not commit or deploy         ║");
  console.error("╚══════════════════════════════════════════════════════════════╝");
  console.error("");
  console.error("Real emails, phones, passwords, or secret keys must not live in git.");
  console.error("Use Firebase Auth for passwords. Use .env.local (gitignored) for keys.");
  console.error("Add intentional safe templates only to scripts/pii-allowlist.txt");
  console.error("");

  findings.forEach(function (f) {
    var loc = f.line ? f.file + ":" + f.line : f.file;
    console.error("  [" + f.rule + "] " + loc);
    console.error("    " + f.label + (f.snippet ? " → " + f.snippet : ""));
  });

  console.error("");
  console.error("Found " + findings.length + " issue(s). Fix or redact before proceeding.");
  process.exit(1);
}

main();
