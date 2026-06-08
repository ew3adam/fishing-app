/**
 * Jobs 95% acceptance — rainy 6:30 PM DPR Summit scenario.
 */
import { buildScoutAdvisory } from "../src/services/scoutAdvisorService.js";

var summitNow = new Date("2026-06-07T18:30:00-05:00");
var wx = {
  temp: 62,
  wind: 10,
  precip: 55,
  sunrise: "2026-06-07T05:18:00",
  sunset: "2026-06-07T20:22:00",
  pressureTrend: { label: "Falling", color: "#6fcf6f" },
};

var card = buildScoutAdvisory({
  weather: wx,
  waterClarity: "muddy",
  spot: { name: "DPR — Summit / Stevenson", distMi: 0.4, lat: 41.778, lng: -87.815 },
  now: summitNow,
});

var ok = card.verdict === "good_window"
  && card.lure && card.lure.type === "Spinnerbait"
  && (card.lure.color || "").toLowerCase().indexOf("black") >= 0;

console.log(JSON.stringify({ ok: ok, verdict: card.verdictLabel, lure: card.lure, species: card.species }, null, 2));
process.exit(ok ? 0 : 1);
