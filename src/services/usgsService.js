/**
 * USGS flow data for mapped scout spots — graceful empty when unavailable.
 */

var CACHE_KEY = "rfc_usgs_cache_v1";
var CACHE_MS = 15 * 60 * 1000;

/** Station IDs per spot name (extend as needed). */
var SPOT_USGS = {
  "DPR — Summit / Stevenson": "05536240",
  "DPR — Lyons / 47th St Bridge": "05536240",
  "DPR — Thatcher Woods North": "05536240",
};

function readCache(siteId) {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var all = JSON.parse(raw);
    var row = all[siteId];
    if (!row || Date.now() - row.at > CACHE_MS) return null;
    return row.data;
  } catch (e) { return null; }
}

function writeCache(siteId, data) {
  try {
    var all = {};
    var raw = localStorage.getItem(CACHE_KEY);
    if (raw) all = JSON.parse(raw) || {};
    all[siteId] = { at: Date.now(), data: data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch (e) {}
}

export function getUsgsSiteForSpot(spotName) {
  return SPOT_USGS[spotName] || null;
}

/**
 * Fetch discharge (cfs) and gage height for a USGS site.
 */
export async function fetchUsgsForSite(siteId) {
  if (!siteId) return null;
  var cached = readCache(siteId);
  if (cached) return cached;

  try {
    var url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + siteId + "&parameterCd=00060,00065&siteStatus=all";
    var r = await fetch(url);
    if (!r.ok) return null;
    var d = await r.json();
    var series = (d && d.value && d.value.timeSeries) || [];
    var cfs = null;
    var gageFt = null;
    series.forEach(function(ts) {
      var code = ts.variable && ts.variable.variableCode && ts.variable.variableCode[0] && ts.variable.variableCode[0].value;
      var val = ts.values && ts.values[0] && ts.values[0].value && ts.values[0].value[0] && ts.values[0].value[0].value;
      if (code === "00060") cfs = parseFloat(val);
      if (code === "00065") gageFt = parseFloat(val);
    });
    var out = {
      siteId: siteId,
      cfs: isFinite(cfs) ? cfs : null,
      gageFt: isFinite(gageFt) ? gageFt : null,
      label: isFinite(cfs) ? Math.round(cfs) + " cfs" : (isFinite(gageFt) ? gageFt.toFixed(1) + " ft" : null),
    };
    writeCache(siteId, out);
    return out;
  } catch (e) {
    return readCache(siteId);
  }
}

export async function fetchUsgsForSpot(spotName) {
  var siteId = getUsgsSiteForSpot(spotName);
  if (!siteId) return null;
  return fetchUsgsForSite(siteId);
}
