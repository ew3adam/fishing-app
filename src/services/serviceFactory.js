import { createLocalAdapter } from "./localAdapter";
import { createFirebaseAdapter } from "./firebaseAdapter";

function sanitizeProvider(raw) {
  var v = String(raw || "").trim().toLowerCase();
  if (v === "firebase") return "firebase";
  return "local";
}

/**
 * Creates a backend adapter with safe local fallback.
 * This is the main integration framework entry point.
 */
export function createDataAdapter(options) {
  var opts = options || {};
  var provider = sanitizeProvider(opts.provider || (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_DATA_PROVIDER));
  if (provider === "firebase") {
    try {
      return createFirebaseAdapter(opts.firebase || {});
    } catch (e) {
      return createLocalAdapter(opts.local || {});
    }
  }
  return createLocalAdapter(opts.local || {});
}

