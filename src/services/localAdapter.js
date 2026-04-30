// Local adapter keeps the same API shape as future cloud adapters.
// This lets UI/business code call one interface now and swap providers later.

var CONTACTS_KEY = "rfc_contacts_v1";
var SPOTS_KEY = "rfc_spots_v1";
var CATCHES_KEY = "rfc_catches_v1";

function sanitizeStr(value, maxLen) {
  var m = maxLen == null ? 4000 : maxLen;
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, m);
}

function readJsonArray(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeJsonArray(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch (err) {}
}

export function createLocalAdapter() {
  return {
    provider: "local",

    // Contacts
    listContacts: function() {
      return Promise.resolve(readJsonArray(CONTACTS_KEY));
    },
    upsertContact: function(input) {
      var row = input && typeof input === "object" ? input : {};
      var email = sanitizeStr(row.email || "", 160).toLowerCase();
      var firstName = sanitizeStr(row.firstName || row.first_name || "", 80);
      if (!email || !firstName) return Promise.resolve({ ok:false, error:"Missing firstName/email" });
      var list = readJsonArray(CONTACTS_KEY);
      var idx = list.findIndex(function(c) { return String(c.email || "").toLowerCase() === email; });
      var next = {
        id: row.id || ("ct_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)),
        firstName: firstName,
        email: email,
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], next);
      else list.unshift(Object.assign({}, next, { createdAt:next.updatedAt }));
      writeJsonArray(CONTACTS_KEY, list);
      return Promise.resolve({ ok:true, contact:next });
    },

    // Spots
    listSpots: function() {
      return Promise.resolve(readJsonArray(SPOTS_KEY));
    },
    saveSpot: function(input) {
      var row = input && typeof input === "object" ? input : {};
      var name = sanitizeStr(row.name || "", 200);
      if (!name) return Promise.resolve({ ok:false, error:"Missing name" });
      var list = readJsonArray(SPOTS_KEY);
      var id = row.id || ("sp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
      var next = Object.assign({}, row, { id:id, name:name, updatedAt:new Date().toISOString() });
      var idx = list.findIndex(function(s) { return s.id === id; });
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], next);
      else list.unshift(Object.assign({}, next, { createdAt:next.updatedAt }));
      writeJsonArray(SPOTS_KEY, list);
      return Promise.resolve({ ok:true, spot:next });
    },

    // Catches
    listCatches: function() {
      return Promise.resolve(readJsonArray(CATCHES_KEY));
    },
    saveCatch: function(input) {
      var row = input && typeof input === "object" ? input : {};
      var species = sanitizeStr(row.species || "", 120);
      if (!species) return Promise.resolve({ ok:false, error:"Missing species" });
      var list = readJsonArray(CATCHES_KEY);
      var id = row.id || ("ca_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
      var next = Object.assign({}, row, { id:id, species:species, updatedAt:new Date().toISOString() });
      var idx = list.findIndex(function(c) { return c.id === id; });
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], next);
      else list.unshift(Object.assign({}, next, { createdAt:next.updatedAt }));
      writeJsonArray(CATCHES_KEY, list);
      return Promise.resolve({ ok:true, catch:next });
    },
  };
}

