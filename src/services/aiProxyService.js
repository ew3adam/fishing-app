/**
 * Proxy AI catch analysis through Cloud Function when configured.
 */
import { analyzeCatchPhotos as analyzeLocal } from "../utils/analyzeCatchPhotos.js";

var FN_URL_KEY = "rfc_analyze_fn_url_v1";

export function getAnalyzeFunctionUrl() {
  try {
    return localStorage.getItem(FN_URL_KEY) || "";
  } catch (e) { return ""; }
}

export function analyzeCatchPhotosProxy(images) {
  var fnUrl = getAnalyzeFunctionUrl();
  if (fnUrl && navigator.onLine) {
    return fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: images.map(function(img) { return { b64: img.b64, type: img.type }; }) }),
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .catch(function() { return null; })
      .then(function(data) {
        if (data) return data;
        return analyzeLocal(images);
      });
  }
  return analyzeLocal(images);
}
