/**
 * RFC Lake Michigan buoy proxy — Cloudflare Worker.
 *
 * Not part of the app's build (nothing here is imported by src/) — deployed separately, on its
 * own, via the Cloudflare dashboard. See docs/BUOY-PROXY-DEPLOY.md for exact steps.
 *
 * Why this exists: the fishing app is a static, client-side-only site (see CLAUDE.md) — every
 * fetch it makes runs in the member's own browser, where CORS applies. NOAA's NDBC buoy data
 * (https://www.ndbc.noaa.gov/data/realtime2/{station}.txt) is a plain public text file meant for
 * server-side tools (curl, scripts) and doesn't send CORS headers, so a direct browser fetch to
 * it fails (confirmed live: "Load failed" on a real device, 2026-09-25). This Worker fetches that
 * same public data server-side (CORS never applies server-to-server) and re-serves it as JSON
 * with permissive CORS headers, so the browser-side app can fetch this Worker instead.
 *
 * Also serves as the honest data source: not limno.io (which turned out to be a manually-browsed
 * page, not an API — see the App.jsx buoy-report comments) and not raw NDBC directly from the
 * browser (CORS-blocked) — this Worker calls NDBC directly, server-side, and that's what the
 * app's "Source: NOAA NDBC" footer actually refers to.
 */

var STATIONS = ["45186", "45187", "45174", "45198", "45170"];

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      // Public, non-credentialed, government-source data -- no reason to restrict origin.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "public, max-age=300",
    },
  });
}

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

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return jsonResponse({}, 204);

    var stations = {};
    var errors = {};
    await Promise.all(STATIONS.map(async function (id) {
      try {
        var res = await fetch("https://www.ndbc.noaa.gov/data/realtime2/" + id + ".txt");
        if (!res.ok) { errors[id] = "HTTP " + res.status; return; }
        var text = await res.text();
        var parsed = parseNdbcText(text);
        if (parsed) stations[id] = parsed;
        else errors[id] = "No data rows in NDBC response";
      } catch (e) {
        errors[id] = String((e && e.message) || e);
      }
    }));

    return jsonResponse({ generatedAt: new Date().toISOString(), stations: stations, errors: errors });
  },
};
