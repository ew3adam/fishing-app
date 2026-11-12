// AI fish species ID through the RFC Helper's /species-id route (cloudflare/rfc-helper/).
// The AI key lives only in the Helper; the app sends the signed-in member's Firebase ID token
// so the Helper can refuse anyone who isn't a club member. Helper not set up = feature off.
import { getFirebaseAuth } from "../lib/firebase.js";
import { compressDataUrl } from "./catchPhotoStorage.js";
import { helperUrl } from "../lib/rfcHelper.js";

/** Returns { suggestions:[{species,confidence,why}], length, rotation, mouth_pct, tail_pct } or null. */
export async function identifySpecies(photoDataUrl) {
  var url = helperUrl("/species-id");
  var user = getFirebaseAuth().currentUser;
  if (!url || !photoDataUrl || !user) return null;
  // 1024px is plenty to see field marks, and a smaller upload is faster and cheaper.
  var small = await compressDataUrl(photoDataUrl, 1024, 0.8);
  var r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (await user.getIdToken()) },
    body: JSON.stringify({ image: small.split(",")[1] || "", mediaType: "image/jpeg" }),
  });
  if (!r.ok) throw new Error("species id " + r.status);
  return r.json();
}
