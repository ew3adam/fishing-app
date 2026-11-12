/**
 * RFC Helper: the club's one small server (a Cloudflare Worker).
 *
 * The fishing app is a static site, so anything that needs a secret key or a server-side fetch
 * lives here instead of in the browser. One Worker, several routes:
 *
 *   GET  /health       quick "is it up" check (no data)
 *   GET  /buoy         Lake Michigan buoy readings from NOAA NDBC (public data, cached 5 min)
 *   POST /species-id   AI fish ID for a photo (signed-in club members only)
 *
 * Planned next on this same Worker: /invite (send member invite email), voice catch logging.
 *
 * Settings (wrangler.toml [vars] or the Cloudflare dashboard):
 *   ANTHROPIC_API_KEY    Secret. Set with: npx wrangler secret put ANTHROPIC_API_KEY
 *   FIREBASE_PROJECT_ID  default "rfc-management"
 *   ALLOWED_ORIGINS      comma list of sites allowed to call member-only routes
 *   MODEL                AI model for species ID, default "claude-sonnet-5-5"
 * Deploy steps: docs/RFC-HELPER-DEPLOY.md
 */

var DEFAULT_ORIGINS = "https://ew3adam.github.io,http://localhost:5173,http://localhost:5174";

function corsHeaders(origin, env) {
  var allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map(function(s) { return s.trim(); });
  return {
    "Access-Control-Allow-Origin": allowed.indexOf(origin) >= 0 ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json" }, headers) });
}

// ---------------------------------------------------------------- /buoy
var STATIONS = ["45186", "45187", "45174", "45198", "45170"];

/**
 * Parses an NDBC realtime2 standard meteorological text file. Format (two "#"-prefixed header
 * lines, then data rows, NEWEST READING FIRST):
 *   #YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
 *   #yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi   hPa    ft
 *   2026 09 24 23 50  270  4.1  5.2   0.4   3.0   2.5  280 1013.2  15.6  15.5    MM    MM   MM     MM
 * Missing values are "MM". Column positions are read from the header line rather than
 * hardcoded, so this doesn't break if NDBC ever reorders/adds columns.
 */
function parseNdbcText(text) {
  var lines = text.split("\n").filter(function (l) { return l.trim().length > 0; });
  if (!lines.length) return null;
  var headerCols = lines[0].replace(/^#/, "").trim().split(/\s+/);
  var dataLines = lines.filter(function (l) { return l.indexOf("#") !== 0; });
  if (!dataLines.length) return null;
  var cols = dataLines[0].trim().split(/\s+/);
  var idx = {};
  headerCols.forEach(function (name, i) { idx[name] = i; });
  function num(name) {
    var pos = idx[name];
    if (pos == null) return null;
    var v = cols[pos];
    if (v == null || v === "MM") return null;
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  var yy = cols[idx.YY], mo = cols[idx.MM], dd = cols[idx.DD], hh = cols[idx.hh], mn = cols[idx.mm];
  var iso = (yy && mo && dd && hh && mn) ? (yy + "-" + mo + "-" + dd + "T" + hh + ":" + mn + ":00Z") : null;
  return {
    time: iso,
    windDirDeg: num("WDIR"),
    windMs: num("WSPD"),
    waveM: num("WVHT"),
    waterC: num("WTMP"),
  };
}

async function handleBuoy(cors) {
  var stations = {};
  var errors = {};
  await Promise.all(STATIONS.map(async function(id) {
    try {
      var res = await fetch("https://www.ndbc.noaa.gov/data/realtime2/" + id + ".txt", { cf: { cacheTtl: 300 } });
      if (!res.ok) { errors[id] = "HTTP " + res.status; return; }
      var parsed = parseNdbcText(await res.text());
      if (parsed) stations[id] = parsed; else errors[id] = "No data rows in NDBC response";
    } catch (e) {
      errors[id] = String((e && e.message) || e);
    }
  }));
  // Public government data: any site may read it.
  return json({ generatedAt: new Date().toISOString(), stations: stations, errors: errors }, 200,
    Object.assign({}, cors, { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" }));
}

// ---------------------------------------------------------------- /species-id
var CLUB_SPECIES = [
  "Bass (Largemouth)", "Smallmouth Bass", "Rock Bass", "White Bass", "Bluegill", "Crappie",
  "Yellow Perch", "Walleye", "Sauger", "Northern Pike", "Muskellunge", "Channel Catfish",
  "Flathead Catfish", "Blue Catfish", "Bullhead", "Common Carp", "Freshwater Drum", "Longnose Gar",
  "Bowfin", "Rainbow Trout", "Brown Trout", "Brook Trout", "Lake Trout", "Steelhead",
  "Coho Salmon", "Chinook Salmon",
];

// Local field marks for look-alikes members mix up most (Chicago-area waters).
var ID_TIPS = [
  "Largemouth vs Smallmouth: largemouth upper jaw extends PAST the rear of the eye and it has one dark HORIZONTAL stripe; smallmouth jaw ends under the eye, bronze/brown body with faint VERTICAL bars, often red eye.",
  "Rock Bass: red eye, rows of dark spots, thick body, 6 anal spines. Bluegill: dark ear flap, dark spot at rear of soft dorsal, small mouth.",
  "Crappie: speckled/blotched, large mouth, high arched dorsal. White Bass: silver with thin dark horizontal lines.",
  "Walleye: white tip on lower tail lobe, large glassy eye, no spots on spiny dorsal. Sauger: dark spots on spiny dorsal, no white tail tip.",
  "Northern Pike: light bean-shaped spots on dark body. Muskellunge: dark bars or spots on light body, pointed tail lobes.",
  "Channel Catfish: forked tail, often dark spots. Flathead: flat head, square tail, protruding lower jaw. Blue Catfish: forked tail, straight-edged anal fin, no spots. Bullhead: square tail, small.",
  "Freshwater Drum: humped back, rounded tail, lateral line reaching the tail. Common Carp: barbels at mouth, large scales.",
  "Bowfin: very long dorsal fin, rounded tail, eyespot near tail on males. Longnose Gar: long narrow snout.",
];

// Google's public signing keys for Firebase ID tokens ("@" written as %40 in the URL).
var JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken%40system.gserviceaccount.com";
var jwksCache = { at: 0, keys: null };



function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  var bin = atob(s);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getJwks() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600000) return jwksCache.keys;
  var r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error("jwks");
  var data = await r.json();
  jwksCache = { at: Date.now(), keys: data.keys || [] };
  return jwksCache.keys;
}

/** Verifies a Firebase ID token (RS256) for this project. Returns the payload or throws. */
async function verifyFirebaseToken(token, projectId) {
  var parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("bad token");
  var header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  var payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if (header.alg !== "RS256") throw new Error("alg");
  var now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error("aud");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("iss");
  if (!payload.exp || payload.exp < now) throw new Error("expired");
  if (!payload.sub) throw new Error("sub");
  var keys = await getJwks();
  var jwk = keys.find(function(k) { return k.kid === header.kid; });
  if (!jwk) throw new Error("kid");
  var key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  var ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("sig");
  return payload;
}

function buildPrompt() {
  return "You identify freshwater fish caught by members of a fishing club in the Chicago area (Des Plaines River, Salt Creek, Cook County forest preserve lakes, Lake Michigan).\n" +
    "Pick species ONLY from this list (exact spelling): " + CLUB_SPECIES.join(", ") + ". If none fits, use \"Other\".\n" +
    "Field marks to check:\n- " + ID_TIPS.join("\n- ") + "\n\n" +
    "Respond ONLY with raw JSON, no markdown:\n" +
    "{\"suggestions\":[{\"species\":\"Smallmouth Bass\",\"confidence\":85,\"why\":\"jaw ends under eye; vertical bars\"},{\"species\":\"Bass (Largemouth)\",\"confidence\":12,\"why\":\"...\"}],\"length\":\"14 inches\",\"rotation\":0,\"mouth_pct\":15,\"tail_pct\":85}\n" +
    "Rules: up to 3 suggestions, best first, confidences add up to about 100; \"why\" is under 12 words and names the visible field mark. " +
    "rotation = degrees clockwise (0, 90, 180, 270) so the fish is horizontal with its mouth pointing LEFT; mouth_pct and tail_pct = horizontal % (0 = left edge) of mouth tip and tail tip AFTER that rotation. " +
    "length = rough estimate only if a hand, ruler or known object gives scale, else \"\".";
}

async function handleSpeciesId(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not configured" }, 500, cors);
  var auth = request.headers.get("Authorization") || "";
  try {
    await verifyFirebaseToken(auth.indexOf("Bearer ") === 0 ? auth.slice(7) : "", env.FIREBASE_PROJECT_ID || "rfc-management");
  } catch (e) {
    return json({ error: "sign in required" }, 401, cors);
  }
  var body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400, cors); }
  var image = String((body && body.image) || "");
  var mediaType = String((body && body.mediaType) || "image/jpeg");
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) return json({ error: "unsupported image type" }, 400, cors);
  if (!image || image.length > 2800000) return json({ error: "image missing or too large" }, 413, cors);

  var r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: env.MODEL || "claude-sonnet-5-5",
      max_tokens: 500,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: buildPrompt() },
      ] }],
    }),
  });
  if (!r.ok) return json({ error: "ai error", status: r.status }, 502, cors);
  var data = await r.json();
  var m = ((data.content && data.content[0] && data.content[0].text) || "").match(/\{[\s\S]*\}/);
  var res;
  try { res = JSON.parse(m ? m[0] : ""); } catch (e) { return json({ error: "bad answer" }, 502, cors); }
  var sugg = (Array.isArray(res.suggestions) ? res.suggestions : []).slice(0, 3).map(function(s) {
    return { species: String(s.species || "").slice(0, 60), confidence: Math.max(0, Math.min(100, parseInt(s.confidence, 10) || 0)), why: String(s.why || "").slice(0, 120) };
  }).filter(function(s) { return s.species; });
  var rot = parseInt(res.rotation, 10);
  return json({
    suggestions: sugg,
    length: String(res.length || "").slice(0, 30),
    rotation: [0, 90, 180, 270].indexOf(rot) >= 0 ? rot : 0,
    mouth_pct: parseFloat(res.mouth_pct),
    tail_pct: parseFloat(res.tail_pct),
  }, 200, cors);
}

// ---------------------------------------------------------------- router
export default {
  async fetch(request, env) {
    var cors = corsHeaders(request.headers.get("Origin") || "", env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    var path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/health" && request.method === "GET") return json({ ok: true }, 200, cors);
      if (path === "/buoy" && request.method === "GET") return handleBuoy(cors);
      if (path === "/species-id" && request.method === "POST") return await handleSpeciesId(request, env, cors);
      return json({ error: "not found" }, 404, cors);
    } catch (e) {
      return json({ error: "server error" }, 500, cors);
    }
  },
};
