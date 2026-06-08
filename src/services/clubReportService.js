/**
 * Club water clarity reports — manual slider fallback when USGS turbidity unavailable.
 */

var CLARITY_KEY = "rfc_club_water_clarity_v1";
var CLARITY_OPTIONS = ["clear", "stained", "muddy", "flooded"];

export function getClarityOptions() {
  return CLARITY_OPTIONS.slice();
}

export function getClarityLabel(key) {
  var labels = { clear: "Clear", stained: "Stained", muddy: "Muddy", flooded: "Flooded" };
  return labels[key] || "Stained";
}

export function loadWaterClarity() {
  try {
    var v = localStorage.getItem(CLARITY_KEY);
    if (v && CLARITY_OPTIONS.indexOf(v) >= 0) return v;
  } catch (e) {}
  return "stained";
}

export function saveWaterClarity(value) {
  var v = String(value || "stained").toLowerCase();
  if (CLARITY_OPTIONS.indexOf(v) < 0) v = "stained";
  try {
    localStorage.setItem(CLARITY_KEY, v);
  } catch (e) {}
  return v;
}
