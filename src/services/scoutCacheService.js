/**
 * Cache last Scout Now card for instant load + offline river banks.
 */

var CACHE_KEY = "rfc_scout_now_cache_v1";

export function loadCachedScoutCard() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function saveCachedScoutCard(card) {
  if (!card) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(card));
  } catch (e) {}
}

export function loadCachedWeather() {
  var card = loadCachedScoutCard();
  if (!card || !card.weather) return null;
  return card.weather;
}
