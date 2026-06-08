/**
 * Scout Now — rules + weather + clarity → single advisory card.
 */
import scoutRules from "../data/scoutRules.js";
import { calcBiteScore } from "./biteScoreService.js";
import { loadWaterClarity } from "./clubReportService.js";
import { fetchUsgsForSpot } from "./usgsService.js";

function haversineMi(lat1, lon1, lat2, lon2) {
  var R = 3958.8;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestScoutSpot(lat, lng, spots) {
  var best = null;
  (spots || []).forEach(function(s) {
    var d = haversineMi(lat, lng, s.lat, s.lng);
    if (!best || d < best.distMi) {
      best = Object.assign({}, s, { distMi: d });
    }
  });
  return best;
}

function getTimePhase(now, wx) {
  var hr = now.getHours();
  var sunset = wx && wx.sunset ? new Date(wx.sunset).getTime() : null;
  var sunrise = wx && wx.sunrise ? new Date(wx.sunrise).getTime() : null;
  var t = now.getTime();
  if (sunrise && t >= sunrise - 45 * 60000 && t <= sunrise + 90 * 60000) return "dawn";
  if (sunset && t >= sunset - 120 * 60000 && t <= sunset + 45 * 60000) return "dusk";
  if (hr < 10) return "morning";
  if (hr >= 17) return "evening";
  return "midday";
}

function ruleMatches(rule, ctx) {
  var w = rule.when || {};
  if (w.waterClarity && w.waterClarity.length && w.waterClarity.indexOf(ctx.waterClarity) < 0) return false;
  if (w.timePhase && w.timePhase.length && w.timePhase.indexOf(ctx.timePhase) < 0) return false;
  if (w.precipMin != null && (ctx.precip || 0) < w.precipMin) return false;
  if (w.precipMax != null && (ctx.precip || 0) > w.precipMax) return false;
  if (w.biteScoreMin != null && (ctx.biteScore || 0) < w.biteScoreMin) return false;
  return true;
}

function pickRule(ctx) {
  var rules = (scoutRules.rules || []).slice().sort(function(a, b) {
    return (b.priority || 0) - (a.priority || 0);
  });
  for (var i = 0; i < rules.length; i++) {
    if (ruleMatches(rules[i], ctx)) return rules[i];
  }
  return rules[rules.length - 1] || null;
}

/**
 * Build Scout Now advisory card from inputs.
 */
export function buildScoutAdvisory(opts) {
  var wx = opts.weather;
  var now = opts.now || new Date();
  var clarity = opts.waterClarity || loadWaterClarity();
  var bite = calcBiteScore(wx);
  var timePhase = getTimePhase(now, wx);
  var ctx = {
    waterClarity: clarity,
    timePhase: timePhase,
    precip: wx ? wx.precip : 0,
    biteScore: bite ? bite.score : 50,
  };
  var rule = pickRule(ctx);
  var spot = opts.spot || null;

  return {
    generatedAt: now.toISOString(),
    spotName: spot ? spot.name : "Nearest water",
    spotDistMi: spot ? spot.distMi : null,
    waterClarity: clarity,
    timePhase: timePhase,
    biteScore: bite,
    verdict: rule ? rule.verdict : "fair",
    verdictLabel: rule ? rule.verdictLabel : "Fair",
    species: rule ? rule.species : [],
    lure: rule ? rule.lure : null,
    retrieval: rule ? rule.retrieval : "",
    tactical: rule ? rule.tactical : "",
    why: rule ? rule.why : "",
    ruleId: rule ? rule.id : "default",
    usgs: opts.usgs || null,
    weatherSummary: wx ? (wx.temp + "°F · " + wx.wind + " mph · " + wx.precip + "% rain") : null,
  };
}

/**
 * Full Scout Now pipeline — spot, weather, USGS, rules.
 */
export async function runScoutNow(lat, lng, spots, weather, waterClarity) {
  var spot = findNearestScoutSpot(lat, lng, spots);
  var usgs = null;
  if (spot) {
    try {
      usgs = await fetchUsgsForSpot(spot.name);
    } catch (e) { usgs = null; }
  }
  return buildScoutAdvisory({
    weather: weather,
    spot: spot,
    waterClarity: waterClarity,
    usgs: usgs,
  });
}
