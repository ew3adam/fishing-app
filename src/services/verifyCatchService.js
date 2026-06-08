/**
 * Catch photo verification — local logic + optional Cloud Function proxy.
 */

var FN_URL_KEY = "rfc_verify_fn_url_v1";

/** Default Firebase function URL pattern (set after deploy). */
export function getVerifyFunctionUrl() {
  try {
    return localStorage.getItem(FN_URL_KEY) || "";
  } catch (e) { return ""; }
}

/**
 * Local verification when Cloud Function unavailable.
 */
export function verifyCatchLocally(entry, photos) {
  var heroIdx = entry.heroPhotoIndex != null ? entry.heroPhotoIndex : 0;
  var refIdx = entry.referencePhotoIndex != null ? entry.referencePhotoIndex : findReferenceIndex(photos);
  var refPhoto = photos && photos[refIdx];
  var heroPhoto = photos && photos[heroIdx];
  var confidence = 0;
  var flags = [];
  var verified = false;

  if (!refPhoto || !refPhoto.hasRulerInPhoto) {
    flags.push("missing_reference_ruler");
    return { verified: false, confidence: 0, flags: flags };
  }

  confidence += 40;
  if (entry.lengthInches >= 4 && entry.lengthInches <= 48) {
    confidence += 25;
  } else {
    flags.push("length_out_of_range");
  }

  if (refPhoto.aiLengthInches >= 4) {
    var diff = Math.abs(refPhoto.aiLengthInches - entry.lengthInches);
    if (diff <= 2) confidence += 20;
    else flags.push("length_mismatch");
  }

  if (heroPhoto && refPhoto && heroPhoto !== refPhoto) {
    confidence += 15;
    var heroSpan = Math.abs((heroPhoto.markers && heroPhoto.markers.tailPct) - (heroPhoto.markers && heroPhoto.markers.mouthPct));
    var refSpan = Math.abs((refPhoto.markers && refPhoto.markers.tailPct) - (refPhoto.markers && refPhoto.markers.mouthPct));
    if (heroSpan > 0 && refSpan > 0 && heroSpan / refSpan > 1.45) {
      flags.push("forced_perspective_suspect");
      confidence -= 15;
    }
  } else {
    flags.push("missing_hero");
    confidence -= 10;
  }

  verified = confidence >= 70 && flags.indexOf("missing_reference_ruler") < 0;
  return {
    verified: verified,
    confidence: Math.max(0, Math.min(100, confidence)),
    flags: flags,
    heroPhotoIndex: heroIdx,
    referencePhotoIndex: refIdx,
  };
}

function findReferenceIndex(photos) {
  if (!photos) return -1;
  for (var i = 0; i < photos.length; i++) {
    if (photos[i].hasRulerInPhoto) return i;
  }
  return -1;
}

/**
 * Try Cloud Function, fall back to local verify.
 */
export async function verifyCatchPhotos(entry, photos) {
  var fnUrl = getVerifyFunctionUrl();
  if (fnUrl && navigator.onLine) {
    try {
      var r = await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: entry, photos: photos }),
      });
      if (r.ok) return await r.json();
    } catch (e) { /* fall through */ }
  }
  return verifyCatchLocally(entry, photos);
}
