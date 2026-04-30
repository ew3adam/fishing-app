#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DEFAULT_INPUT = path.join(DATA_DIR, "contacts.template.csv");
const DEFAULT_ENC_OUT = path.join(DATA_DIR, "contacts.enc.json");
const DEFAULT_DEC_OUT = path.join(DATA_DIR, "contacts.decrypted.csv");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/contacts-secure.js encrypt [--input=<csv>] [--output=<enc.json>] [--password=<secret>]");
  console.log("  node scripts/contacts-secure.js decrypt [--input=<enc.json>] [--output=<csv>] [--password=<secret>]");
  console.log("  Or pass CONTACTS_KEY in environment instead of --password.");
}

function sanitizeCell(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function parseArgs(argv) {
  const out = {};
  argv.forEach((arg) => {
    const clean = sanitizeCell(arg);
    if (clean.indexOf("--") !== 0) return;
    const eq = clean.indexOf("=");
    if (eq < 0) out[clean.slice(2)] = "true";
    else out[clean.slice(2, eq)] = clean.slice(eq + 1);
  });
  return out;
}

function readSecret(args) {
  const raw = sanitizeCell(args.password || process.env.CONTACTS_KEY || "");
  if (!raw) throw new Error("Missing secret. Use --password or CONTACTS_KEY.");
  return raw;
}

function deriveKey(secret, saltB64) {
  const salt = saltB64 ? Buffer.from(saltB64, "base64") : crypto.randomBytes(16);
  const key = crypto.scryptSync(secret, salt, 32);
  return { key, salt };
}

function parseCsv(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => sanitizeCell(h));
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = sanitizeCell(cols[i] || "");
    });
    return row;
  });
}

function toCsv(rows, headers) {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((k) => sanitizeCell(r[k])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

function normalizeContacts(rows) {
  return rows
    .map((r) => {
      const first_name = sanitizeCell(r.first_name || r.firstName || r.name || "");
      const last_name = sanitizeCell(r.last_name || r.lastName || "");
      const email = sanitizeCell(r.email || "").toLowerCase();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!first_name || !emailValid) return null;
      return { first_name, last_name, email };
    })
    .filter(Boolean);
}

function encryptCsv(args) {
  const secret = readSecret(args);
  const inPath = path.resolve(ROOT, sanitizeCell(args.input || DEFAULT_INPUT));
  const outPath = path.resolve(ROOT, sanitizeCell(args.output || DEFAULT_ENC_OUT));
  const rawCsv = fs.readFileSync(inPath, "utf8");
  const contacts = normalizeContacts(parseCsv(rawCsv));
  const payload = JSON.stringify({
    version: 1,
    created_at: new Date().toISOString(),
    contacts,
  });
  const keyObj = deriveKey(secret, null);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyObj.key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = {
    algo: "aes-256-gcm",
    kdf: "scrypt",
    salt: keyObj.salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Encrypted contacts written:", outPath);
  console.log("Rows encrypted:", contacts.length);
}

function decryptCsv(args) {
  const secret = readSecret(args);
  const inPath = path.resolve(ROOT, sanitizeCell(args.input || DEFAULT_ENC_OUT));
  const outPath = path.resolve(ROOT, sanitizeCell(args.output || DEFAULT_DEC_OUT));
  const blob = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const derived = deriveKey(secret, blob.salt);
  const iv = Buffer.from(blob.iv, "base64");
  const tag = Buffer.from(blob.tag, "base64");
  const ciphertext = Buffer.from(blob.ciphertext, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", derived.key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(decrypted);
  const rows = Array.isArray(parsed.contacts) ? parsed.contacts : [];
  fs.writeFileSync(outPath, toCsv(rows, ["first_name", "last_name", "email"]), "utf8");
  console.log("Decrypted contacts written:", outPath);
  console.log("Rows decrypted:", rows.length);
}

function main() {
  const cmd = sanitizeCell(process.argv[2] || "").toLowerCase();
  const args = parseArgs(process.argv.slice(3));
  if (!cmd) {
    usage();
    process.exit(1);
  }
  if (cmd === "encrypt") return encryptCsv(args);
  if (cmd === "decrypt") return decryptCsv(args);
  usage();
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error("contacts-secure error:", err.message);
  process.exit(1);
}
