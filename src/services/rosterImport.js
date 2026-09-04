/**
 * Phase 2 — parse and validate club roster CSV/JSON; cache locally for sharing pickers.
 */
import seedRoster from "../../data/seeds/club-roster-v1.json";
import { normalizeEmail, isValidEmail, normalizePhoneDigits, formatPhoneUS } from "./memberService.js";

export var ROSTER_STORAGE_KEY = "rfc_club_roster_v1";

/** Demo fallback when no import yet. */
export var DEFAULT_CLUB_ROSTER = [
  { id: "roster_1", name: "Jim K.", memberId: "roster_1", firstName: "Jim", lastName: "K.", email: "", phone: "", active: true, role: "member" },
  { id: "roster_2", name: "Sarah M.", memberId: "roster_2", firstName: "Sarah", lastName: "M.", email: "", phone: "", active: true, role: "member" },
  { id: "roster_3", name: "Bob T.", memberId: "roster_3", firstName: "Bob", lastName: "T.", email: "", phone: "", active: true, role: "member" },
  { id: "roster_4", name: "Maria G.", memberId: "roster_4", firstName: "Maria", lastName: "G.", email: "", phone: "", active: true, role: "member" },
];

function sanitizeText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

/** Normalize one roster row to app shape. */
export function normalizeRosterRow(raw) {
  var r = raw && typeof raw === "object" ? raw : {};
  var memberId = sanitizeText(r.memberId || r.id);
  var firstName = sanitizeText(r.firstName);
  var lastName = sanitizeText(r.lastName);
  var email = normalizeEmail(r.email);
  var phone = normalizePhoneDigits(r.phone);
  var active = r.active === false || String(r.active).toLowerCase() === "false" ? false : true;
  var role = sanitizeText(r.role || "member").toLowerCase() === "admin" ? "admin" : "member";
  var displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || memberId;
  return {
    id: memberId,
    memberId: memberId,
    firstName: firstName,
    lastName: lastName,
    name: displayName,
    email: email,
    phone: phone,
    phoneDisplay: formatPhoneUS(phone),
    active: active,
    role: role,
  };
}

/** Validate array of rows; returns { ok, rows, errors }. */
export function validateRosterRows(rows) {
  var errors = [];
  var emails = {};
  var ids = {};
  var normalized = [];

  if (!Array.isArray(rows) || !rows.length) {
    return { ok: false, rows: [], errors: ["Roster is empty."] };
  }

  rows.forEach(function(raw, index) {
    var row = normalizeRosterRow(raw);
    var line = index + 1;
    if (!row.memberId) errors.push("Row " + line + ": missing memberId.");
    if (!row.firstName) errors.push("Row " + line + ": missing firstName.");
    if (!row.lastName) errors.push("Row " + line + ": missing lastName.");
    if (!row.email || !isValidEmail(row.email)) errors.push("Row " + line + ": invalid email.");
    if (row.memberId && ids[row.memberId]) errors.push("Row " + line + ": duplicate memberId " + row.memberId + ".");
    if (row.email && emails[row.email]) errors.push("Row " + line + ": duplicate email " + row.email + ".");
    if (row.memberId) ids[row.memberId] = true;
    if (row.email) emails[row.email] = true;
    normalized.push(row);
  });

  return { ok: errors.length === 0, rows: normalized, errors: errors };
}

/**
 * RFC 4180-aware CSV tokenizer: parses full CSV text into an array of rows, each row an array
 * of raw field strings. Handles quoted fields containing commas or embedded newlines, and a
 * doubled `""` as an escaped quote inside a quoted field -- a bare `line.split(",")` (the old
 * approach) shifts every column after the first quoted comma with no error surfaced (see BUG-5
 * in docs/BUG-TRIAGE-AND-FEATURE-ROADMAP.md).
 */
function tokenizeCsv(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  var s = String(text || "");
  var i = 0;
  var len = s.length;
  while (i < len) {
    var ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\r") {
      i++; // swallow CR; LF (below) ends the row -- normalizes CRLF and bare CR
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines (a lone empty field), matching the old behavior of skipping empty lines.
  return rows.filter(function(r) { return !(r.length === 1 && r[0].trim() === ""); });
}

/** Parse CSV text (RFC 4180: comma-separated, quoted fields may contain commas/newlines). */
export function parseRosterCsv(text) {
  var lines = tokenizeCsv(text);
  if (!lines.length) return [];
  var header = lines[0].map(function(h) { return sanitizeText(h).toLowerCase(); });
  var rows = [];
  var i;
  for (i = 1; i < lines.length; i++) {
    var parts = lines[i];
    if (parts.length !== header.length) {
      // Column count doesn't match the header -- most likely an unmatched quote somewhere
      // upstream in the export. Surface an error instead of silently importing shifted data.
      throw new Error(
        "Row " + (i + 1) + " has " + parts.length + " column" + (parts.length === 1 ? "" : "s") +
        ", expected " + header.length + " (matching the header row). Check for an unescaped or " +
        "unmatched quote in that row."
      );
    }
    var obj = {};
    header.forEach(function(key, idx) {
      var val = sanitizeText(parts[idx] != null ? parts[idx] : "");
      if (key === "active") obj.active = val.toLowerCase() !== "false" && val !== "0";
      else if (key === "memberid" || key === "member_id") obj.memberId = val;
      else if (key === "firstname" || key === "first") obj.firstName = val;
      else if (key === "lastname" || key === "last") obj.lastName = val;
      else if (key === "email") obj.email = val;
      else if (key === "phone" || key === "cell") obj.phone = val;
      else if (key === "role") obj.role = val;
    });
    rows.push(obj);
  }
  return rows;
}

export function parseRosterJson(text) {
  var data = JSON.parse(text);
  return Array.isArray(data) ? data : (data && data.members ? data.members : []);
}

export function loadStoredRoster() {
  try {
    var raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return null;
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return null;
    var v = validateRosterRows(arr);
    return v.ok ? v.rows : null;
  } catch (e) {
    return null;
  }
}

export function persistRoster(rows) {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(rows));
}

export function loadSeedRoster() {
  var v = validateRosterRows(seedRoster);
  if (!v.ok) throw new Error(v.errors.join(" "));
  persistRoster(v.rows);
  return v.rows;
}

export function importRosterFromCsvText(text) {
  var parsed = parseRosterCsv(text);
  var v = validateRosterRows(parsed);
  if (!v.ok) throw new Error(v.errors.join(" "));
  persistRoster(v.rows);
  return v.rows;
}

export function importRosterFromJsonText(text) {
  var parsed = parseRosterJson(text);
  var v = validateRosterRows(parsed);
  if (!v.ok) throw new Error(v.errors.join(" "));
  persistRoster(v.rows);
  return v.rows;
}

/** For spot sharing UI: { id, name }. */
export function rosterForSharingPicker(rows) {
  return (rows || []).filter(function(m) { return m.active !== false; }).map(function(m) {
    return { id: m.id || m.memberId, name: m.name || m.displayName || m.id };
  });
}

export function getInitialRoster() {
  return loadStoredRoster() || DEFAULT_CLUB_ROSTER;
}
