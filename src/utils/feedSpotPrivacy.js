/**
 * Keep club feed locations to water names — never street addresses or raw GPS.
 */

var STREET_PATTERN = /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|hwy|highway)\b/i;
var HOUSE_NUMBER_PATTERN = /^\d+\s+/;
var COORD_PATTERN = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/;

function trim(s) {
  return String(s || "").trim();
}

/** True if text looks like a street address or coordinates, not a water name. */
export function looksLikePrivateAddress(text) {
  var t = trim(text);
  if (!t) return false;
  if (COORD_PATTERN.test(t)) return true;
  if (HOUSE_NUMBER_PATTERN.test(t) && STREET_PATTERN.test(t)) return true;
  if (STREET_PATTERN.test(t) && t.length < 80) return true;
  return false;
}

/**
 * Safe label for feed cards and club-shared catches.
 */
export function formatFeedSpotName(spot, spotDisplayName) {
  var preferred = trim(spotDisplayName) || trim(spot);
  if (!preferred) return "RFC water";
  if (looksLikePrivateAddress(preferred)) return "RFC water";
  return preferred;
}

/**
 * Pick a public spot name when saving a club catch.
 */
export function buildSpotDisplayName(spot) {
  var raw = trim(spot);
  if (!raw) return "RFC water";
  // Previously fell back to an arbitrary "known spot" name (always the same one, the first
  // entry of a caller-supplied list) instead of the generic label below -- misattributing the
  // catch to a real, specific spot the member may never have visited, silently, with no warning
  // shown to them. Match formatFeedSpotName's behavior (and this function's own other branches):
  // when the entered text looks like a private address, fall back to a safe generic label, never
  // a fabricated substitute.
  if (looksLikePrivateAddress(raw)) return "RFC water";
  return raw;
}

/**
 * Sanitize EXIF-derived spot before pre-filling the log form.
 */
export function sanitizeSpotForForm(resolvedSpot, resolvedSource) {
  var spot = trim(resolvedSpot);
  if (!spot) return { spot: "", source: "" };
  if (resolvedSource === "GPS coordinates") {
    return { spot: "", source: "" };
  }
  if (looksLikePrivateAddress(spot)) {
    return { spot: "", source: "" };
  }
  return { spot: spot, source: resolvedSource || "" };
}
