/**
 * RFC Fishing Cloud Functions — verify catches + proxy AI (deploy separately).
 */
const { onRequest } = require("firebase-functions/v2/https");

function verifyLocally(payload) {
  var entry = payload.entry || {};
  var photos = payload.photos || [];
  var refIdx = -1;
  for (var i = 0; i < photos.length; i++) {
    if (photos[i].hasRulerInPhoto) { refIdx = i; break; }
  }
  var confidence = 0;
  var flags = [];
  if (refIdx < 0) {
    flags.push("missing_reference_ruler");
    return { verified: false, confidence: 0, flags: flags };
  }
  confidence += 45;
  var len = parseFloat(entry.lengthInches) || 0;
  if (len >= 4 && len <= 48) confidence += 25;
  else flags.push("length_out_of_range");
  var ref = photos[refIdx];
  if (ref.aiLengthInches >= 4) {
    if (Math.abs(ref.aiLengthInches - len) <= 2) confidence += 20;
    else flags.push("length_mismatch");
  }
  var verified = confidence >= 70;
  return {
    verified: verified,
    confidence: Math.min(100, confidence),
    flags: flags,
    referencePhotoIndex: refIdx,
  };
}

exports.verifyCatchPhotos = onRequest({ cors: true }, function(req, res) {
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    var result = verifyLocally(req.body || {});
    res.set("Access-Control-Allow-Origin", "*");
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: "verify failed" });
  }
});
