/**
 * Unified RFC bite score — one number, one truth everywhere.
 */

export function getSeason(monthIndex) {
  if (monthIndex >= 2 && monthIndex <= 4) return "spring";
  if (monthIndex >= 5 && monthIndex <= 7) return "summer";
  if (monthIndex >= 8 && monthIndex <= 10) return "fall";
  return "winter";
}

export function getMoonInfo(date) {
  var d = date || new Date();
  var yr = d.getFullYear(), mo = d.getMonth() + 1, dy = d.getDate();
  var y = yr, m = mo;
  if (m < 3) { y--; m += 12; }
  var jd = 365.25 * y + 30.6 * m + dy - 694039.09;
  jd /= 29.5305882;
  var phase = jd - Math.floor(jd);
  var label = "Waxing";
  if (phase < 0.03 || phase > 0.97) label = "New";
  else if (phase >= 0.22 && phase < 0.28) label = "First Quarter";
  else if (phase >= 0.47 && phase < 0.53) label = "Full";
  else if (phase >= 0.72 && phase < 0.78) label = "Last Quarter";
  else if (phase >= 0.53) label = "Waning";
  return { phase: phase, label: label };
}

function tierFromScore(score) {
  if (score >= 85) return { label: "EPIC", emoji: "🎣", color: "#3ddc84" };
  if (score >= 70) return { label: "GREAT", emoji: "👍", color: "#6fcf6f" };
  if (score >= 55) return { label: "GOOD", emoji: "😐", color: "#d4a843" };
  if (score >= 40) return { label: "FAIR", emoji: "😐", color: "#e09030" };
  return { label: "POOR", emoji: "🚫", color: "#e05050" };
}

/**
 * Single bite score combining weather, moon, and pressure.
 */
export function calcBiteScore(wx, moonInfo) {
  if (!wx) return null;
  var score = 55;
  var notes = [];
  var temp = wx.temp;
  if (temp >= 58 && temp <= 75) { score += 18; notes.push("Prime temperature range"); }
  else if (temp >= 50 && temp < 58) { score += 8; notes.push("Cool — fish may be deeper"); }
  else if (temp > 75 && temp <= 85) { score += 5; }
  else if (temp > 88) { score -= 18; notes.push("Very hot — fish deep or night fish"); }
  else if (temp < 45) { score -= 22; notes.push("Too cold — fish sluggish"); }
  else if (temp < 50) { score -= 10; notes.push("Cool water — slow presentation"); }

  var wind = wx.wind || 0;
  if (wind >= 5 && wind <= 15) { score += 8; notes.push("Light wind — good casting"); }
  else if (wind > 20) { score -= 15; notes.push("High wind — tough casting"); }
  else if (wind < 3) { score += 4; notes.push("Calm — great casting"); }

  var precip = wx.precip || 0;
  if (precip < 20) { score += 5; }
  else if (precip >= 20 && precip <= 60) { score += 3; notes.push("Light rain can spark a bite"); }
  else if (precip > 70) { score -= 8; notes.push("Heavy rain — safety first"); }

  if (wx.pressureTrend) {
    if (wx.pressureTrend.label === "Falling") { score += 8; notes.push("Falling pressure — fish often feed"); }
    else if (wx.pressureTrend.label === "Rising") { score -= 3; }
  }

  var moon = moonInfo || getMoonInfo();
  if (moon.label === "New" || moon.label === "Full") { score += 10; notes.push(moon.label + " moon"); }
  else if (moon.label === "First Quarter" || moon.label === "Last Quarter") { score += 5; }

  score = Math.max(0, Math.min(100, Math.round(score)));
  var tier = tierFromScore(score);
  return {
    score: score,
    label: tier.label,
    emoji: tier.emoji,
    color: tier.color,
    notes: notes,
    dayLabel: score >= 75 ? "GREAT DAY" : score >= 55 ? "GOOD DAY" : score >= 35 ? "FAIR DAY" : "STAY HOME",
  };
}

function formatTimeShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch (e) { return "—"; }
}

/**
 * Honest peak-light windows tied to sunrise/sunset — not fake solunar.
 */
export function calcPeakLightWindows(sunriseIso, sunsetIso) {
  var now = new Date();
  var sr = sunriseIso ? new Date(sunriseIso) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 30);
  var ss = sunsetIso ? new Date(sunsetIso) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0);
  function windowFrom(startMs, durationMin, type, color) {
    var start = new Date(startMs);
    var end = new Date(startMs + durationMin * 60000);
    return {
      type: type,
      start: start,
      end: end,
      durationMin: durationMin,
      color: color,
      label: formatTimeShort(start.toISOString()) + " – " + formatTimeShort(end.toISOString()),
    };
  }
  return [
    windowFrom(sr.getTime() + 90 * 60000, 120, "Morning light", "#d4a843"),
    windowFrom(ss.getTime() - 150 * 60000, 120, "Dusk bite", "#d4a843"),
    windowFrom(sr.getTime() + 6 * 3600000, 60, "Midday shade", "#5a9fd4"),
    windowFrom(ss.getTime() + 2 * 3600000, 60, "Evening fade", "#5a9fd4"),
  ];
}

export function goldenHourMessage(sunriseIso, sunsetIso) {
  var now = Date.now();
  var sr = sunriseIso ? new Date(sunriseIso).getTime() : null;
  var ss = sunsetIso ? new Date(sunsetIso).getTime() : null;
  function minsUntil(t) { return Math.max(0, Math.round((t - now) / 60000)); }
  if (sr && now >= sr - 45 * 60000 && now <= sr + 45 * 60000) return "Golden hour NOW — get fishing!";
  if (ss && now >= ss - 45 * 60000 && now <= ss + 45 * 60000) return "Golden hour NOW — get fishing!";
  if (sr && now < sr) {
    var m = minsUntil(sr);
    return "Golden hour in " + Math.floor(m / 60) + "h " + (m % 60) + "min";
  }
  if (ss && now < ss) {
    var m2 = minsUntil(ss);
    return "Golden hour in " + Math.floor(m2 / 60) + "h " + (m2 % 60) + "min";
  }
  return "Evening bite window opening";
}
