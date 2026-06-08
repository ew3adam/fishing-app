var HEAD_KEY = "rfc_learned_head_inches_v1";
var DEFAULT_HEAD_INCHES = 9;

export function getLearnedHeadInches() {
  try {
    var raw = localStorage.getItem(HEAD_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (data && isFinite(data.avg) && data.avg >= 7 && data.avg <= 12) return data.avg;
  } catch (e) {}
  return null;
}

/** Running average from ruler-calibrated selfie catches. */
export function learnHeadInchesFromRatio(fishInches, fishSpanPct, headSpanPct) {
  if (!isFinite(fishInches) || fishInches < 6 || !isFinite(fishSpanPct) || fishSpanPct < 5) return null;
  if (!isFinite(headSpanPct) || headSpanPct < 3) return null;
  var headIn = fishInches * (headSpanPct / fishSpanPct);
  if (headIn < 7 || headIn > 12) return null;
  try {
    var prev = JSON.parse(localStorage.getItem(HEAD_KEY) || "{}");
    var count = (prev.count || 0) + 1;
    var avg = prev.avg != null ? ((prev.avg * (count - 1)) + headIn) / count : headIn;
    localStorage.setItem(HEAD_KEY, JSON.stringify({ avg:Math.round(avg * 10) / 10, count:count, updatedAt:new Date().toISOString() }));
    return avg;
  } catch (e) {
    return headIn;
  }
}

export function headInchesForMeasure() {
  return getLearnedHeadInches() || DEFAULT_HEAD_INCHES;
}
