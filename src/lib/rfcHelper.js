// The RFC Helper is the club's one Cloudflare Worker (cloudflare/rfc-helper/). Its address is set
// once in .env.local as VITE_RFC_HELPER_URL; every feature that needs a server goes through it.
var BASE = String((import.meta.env && import.meta.env.VITE_RFC_HELPER_URL) || "").replace(/\/+$/, "");

export function helperReady() {
  return !!BASE;
}

/** Full URL for a helper route, e.g. helperUrl("/buoy"). Empty string when not set up. */
export function helperUrl(path) {
  return BASE ? BASE + path : "";
}
