import { useState, useEffect, useRef, useCallback } from "react";
import exifr from "exifr";
import { subscribeAuthState, signInMemberEmail, sendSignInLink, isSignInLink, completeSignInWithLink, completeSignInWithLinkAndEmail, signInMemberOAuth, signOutMember, pullCloudProfile, syncLocalProfileToCloud } from "./services/authService.js";
import { listActiveMembers } from "./services/memberService.js";
import { mergeLocalCatchesToCloud, loadCatchesFromCloud, saveCatchToCloud, loadClubSharedSpots } from "./services/fishingSyncService.js";
import { checkRosterHealth } from "./services/rosterHealthService.js";
import ClubFeedList from "./components/ClubFeedList.jsx";
import SaveToast from "./components/SaveToast.jsx";
import { buildSpotDisplayName, sanitizeSpotForForm } from "./utils/feedSpotPrivacy.js";
import SpotMapPicker from "./components/SpotMapPicker.jsx";
import SpotMapThumb from "./components/SpotMapThumb.jsx";
import { SCOUT_SPOTS } from "./data/scoutSpots.js";
import { getInitialRoster, loadSeedRoster, importRosterFromCsvText, rosterForSharingPicker } from "./services/rosterImport.js";
import { getOAuthPlaceholderButtons } from "./config/authProviders.js";

// ─── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark:      { bg:"#0d1a0d", card:"rgba(255,255,255,0.06)", border:"#2a4a2a", green:"#6fcf6f", dim:"#3a6a3a", gold:"#d4a843", white:"#f0ece0", muted:"#8a9a7a", blue:"#5a9fd4", red:"#e05050", orange:"#e09030", teal:"#4ab8a0", indigo:"#5a6fd4", nav:"rgba(13,26,13,0.97)" },
  light:     { bg:"#f0f4f0", card:"rgba(255,255,255,0.9)", border:"#c0d4c0", green:"#2a7a2a", dim:"#7ab87a", gold:"#a07010", white:"#1a2a1a", muted:"#5a7a5a", blue:"#2a5fa0", red:"#c03030", orange:"#b06010", teal:"#1a8070", indigo:"#3a4fb0", nav:"rgba(240,244,240,0.97)" },
  bluesteel: { bg:"#0d1520", card:"rgba(255,255,255,0.06)", border:"#1a3050", green:"#40c0e0", dim:"#1a5070", gold:"#e0c040", white:"#e8f0f8", muted:"#6080a0", blue:"#60a0e0", red:"#e05050", orange:"#e09030", teal:"#40d0c0", indigo:"#8080e0", nav:"rgba(13,21,32,0.97)" },
};

// ─── KNOWN SPOTS (reverse-geocode EXIF + Scout tab) ──────────────────────────
const KNOWN_SPOTS = [
  { name:"Salt Creek",                   lat:41.826, lng:-87.845 },
  { name:"Thatcher Woods / Des Plaines", lat:41.874, lng:-87.831 },
  { name:"Columbia Woods / Des Plaines", lat:41.762, lng:-87.884 },
  { name:"Cal-Sag Channel",              lat:41.762, lng:-87.858 },
  { name:"Sag Quarry East",              lat:41.704, lng:-87.845 },
  { name:"Horsetail Lake",               lat:41.698, lng:-87.851 },
  { name:"Tampier Lake",                 lat:41.656, lng:-87.845 },
  { name:"Wolf Lake",                    lat:41.656, lng:-87.533 },
  { name:"Busse Lake",                   lat:42.018, lng:-88.045 },
  { name:"Burnham Harbor",               lat:41.838, lng:-87.614 },
  { name:"Steelworkers Park",            lat:41.734, lng:-87.527 },
  { name:"Waukegan Harbor Pier",         lat:42.359, lng:-87.829 },
  { name:"Hammond Marina Breakwall",     lat:41.694, lng:-87.512 },
];
function mapsUrl(lat, lng) {
  var coord = lat + "," + lng;
  return {
    apple:  "https://maps.apple.com/?daddr=" + coord,
    google: "https://www.google.com/maps/dir/?api=1&destination=" + coord,
  };
}

// Westcott 20-inch ruler PNG — full image width = 20 inches on the overlay scale.
var RULER_REF_INCHES = 20;
var RULER_REF_SRC = import.meta.env.BASE_URL + "ruler-20-inches.svg";
var RULER_STRIP_H = 56;
var RULER_STRIP_W = 88;
function haversineMi(lat1, lon1, lat2, lon2) {
  var R = 3958.8, r = Math.PI / 180;
  var dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

var SPECIES_ALIASES = {
  dogfish: "Bowfin",
  mudfish: "Bowfin",
  mudpuppy: "Bowfin",
  grinnel: "Bowfin",
  "freshwater dogfish": "Bowfin",
  striper: "White Bass",
  "white perch": "White Bass",
  "king salmon": "Chinook Salmon",
  "silver salmon": "Coho Salmon",
  steelhead: "Steelhead",
  "brown line": "Brown Trout",
};

var GLOSSARY = {
  "slip float": "A float that slides on the line so you can cast far and set exact depth.",
  "spawn sac": "Mesh bag of salmon eggs — top bait for pier coho.",
  "texas rig": "Worm on a hook with a bullet weight — weedless for bass.",
  "ned rig": "Tiny mushroom jig + short stick bait — great when fish are picky.",
  "hair rig": "Carp rig where bait hangs below the hook on a hair loop.",
};

var SCOUT_HISTORY_KEY = "rfc_scout_history_v1";
var RFC_CATCH_HINT_KEY = "rfc_catch_hint_seen_v1";

// Match AI species text to a known SPECIES entry when possible.
function matchSpeciesName(name) {
  if (!name || typeof name !== "string") return "";
  var trimmed = name.trim();
  if (!trimmed) return "";
  var aliasKey = trimmed.toLowerCase();
  if (SPECIES_ALIASES[aliasKey]) return SPECIES_ALIASES[aliasKey];
  var exact = SPECIES.find(function(s) { return s.name.toLowerCase() === trimmed.toLowerCase(); });
  if (exact) return exact.name;
  var partial = SPECIES.find(function(s) {
    var sn = s.name.toLowerCase();
    var tn = trimmed.toLowerCase();
    return tn.indexOf(sn) >= 0 || sn.indexOf(tn) >= 0;
  });
  return partial ? partial.name : trimmed;
}

function speciesAlsoKnownAs(speciesName) {
  var keys = Object.keys(SPECIES_ALIASES).filter(function(k) { return SPECIES_ALIASES[k] === speciesName; });
  return keys.length ? keys.slice(0, 3).join(", ") : "";
}

function findCatalogueForRig(rigName) {
  if (!rigName) return null;
  var rn = rigName.toLowerCase();
  return CATALOGUE.find(function(c) {
    return c.name.toLowerCase() === rn || rn.indexOf(c.name.toLowerCase()) >= 0 || c.name.toLowerCase().indexOf(rn) >= 0;
  }) || null;
}

function loadScoutHistory() {
  try {
    var raw = localStorage.getItem(SCOUT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveScoutHistoryEntry(entry) {
  var list = loadScoutHistory();
  list.unshift(entry);
  localStorage.setItem(SCOUT_HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
}

function scoutBiteHint(spot, season) {
  var count = (spot && spot.species && spot.species.length) || 0;
  if (count >= 4) return "Hot spot — " + count + " species possible (" + season + ")";
  if (count >= 2) return "Good variety — try " + (spot.species[0] || "bass");
  return "Light pressure — explore with live bait";
}

function exportProfileDataJson(profile) {
  var catches = [];
  try { catches = JSON.parse(localStorage.getItem("rfc_catches_v1") || "[]"); } catch (e) {}
  var blob = new Blob([JSON.stringify({ profile: profile, catches: catches, scoutHistory: loadScoutHistory(), exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "rfc-fishing-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

// Build a spot label from IPTC location fields, then GPS / nearest known spot.
function resolveSpotFromExif(exif) {
  if (!exif) return { spot:"", source:"" };
  var parts = [];
  if (exif.Location) parts.push(String(exif.Location).trim());
  else if (exif.Sublocation) parts.push(String(exif.Sublocation).trim());
  if (exif.City) parts.push(String(exif.City).trim());
  var state = exif.State || exif.ProvinceState;
  if (state) parts.push(String(state).trim());
  var country = exif.Country || exif.CountryName;
  if (country) parts.push(String(country).trim());
  var iptcSpot = parts.filter(Boolean).join(", ");
  if (iptcSpot) return { spot:iptcSpot, source:"Photo location (IPTC)" };

  if (exif.GPSLatitude != null && exif.GPSLongitude != null) {
    var nearest = KNOWN_SPOTS.reduce(function(best, s) {
      var d = haversineMi(exif.GPSLatitude, exif.GPSLongitude, s.lat, s.lng);
      return d < best.d ? { d:d, name:s.name } : best;
    }, { d:Infinity, name:null });
    if (nearest.name && nearest.d < 0.3) return { spot:nearest.name, source:"GPS near known spot" };
    return {
      spot:exif.GPSLatitude.toFixed(4) + ", " + exif.GPSLongitude.toFixed(4),
      source:"GPS coordinates",
    };
  }
  return { spot:"", source:"" };
}

function formatCatchLengthInches(inches) {
  var n = parseFloat(inches);
  if (!isFinite(n)) return "";
  return n.toFixed(1) + " inches";
}

// ─── WEIGHT ESTIMATION (length-weight regression) ─────────────────────────────
const WEIGHT_COEF = {
  "Largemouth Bass":  {a:0.000448, b:3.18}, "Smallmouth Bass": {a:0.000358, b:3.18},
  "Crappie":          {a:0.000500, b:3.00}, "Yellow Perch":    {a:0.000586, b:3.00},
  "Rainbow Trout":    {a:0.000278, b:3.10}, "Brown Trout":     {a:0.000278, b:3.10},
  "Brook Trout":      {a:0.000230, b:3.10}, "Lake Trout":      {a:0.000200, b:3.20},
  "Channel Catfish":  {a:0.000123, b:3.52}, "Flathead Catfish":{a:0.000120, b:3.55},
  "Blue Catfish":     {a:0.000125, b:3.50}, "Bullhead":        {a:0.000150, b:3.30},
  "Common Carp":      {a:0.000754, b:2.97}, "Coho Salmon":     {a:0.002240, b:2.65},
  "Chinook Salmon":   {a:0.000789, b:2.81}, "Steelhead":       {a:0.000350, b:3.15},
  "Walleye":          {a:0.000150, b:3.20}, "Sauger":          {a:0.000140, b:3.20},
  "Northern Pike":    {a:0.000615, b:2.71}, "Muskellunge":     {a:0.000581, b:2.41},
  "Bluegill":         {a:0.000650, b:3.00}, "Rock Bass":       {a:0.000600, b:3.00},
  "White Bass":       {a:0.000400, b:3.10}, "Freshwater Drum": {a:0.000400, b:3.20},
  "Bowfin":           {a:0.000200, b:3.30}, "Longnose Gar":    {a:0.000030, b:3.50},
};
function estimateWeightLbs(speciesName, lengthStr) {
  var m = (lengthStr || "").match(/([\d.]+)/);
  if (!m) return null;
  var L = parseFloat(m[1]);
  if (!L || L < 2) return null;
  var c = WEIGHT_COEF[speciesName];
  if (!c) return null;
  var w = c.a * Math.pow(L, c.b);
  if (w < 0.0625) return null;
  if (w < 1) return Math.round(w * 16) + " oz";
  return w.toFixed(2) + " lbs";
}

// ─── WEATHER LOOKUP ───────────────────────────────────────────────────────────
const WX_LABEL = {0:"Clear",1:"Mainly Clear",2:"Partly Cloudy",3:"Overcast",45:"Foggy",51:"Light Drizzle",61:"Light Rain",63:"Rain",65:"Heavy Rain",71:"Light Snow",80:"Showers",95:"Thunderstorm"};
const WX_ICON  = {0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",51:"🌦️",61:"🌧️",63:"🌧️",65:"⛈️",71:"🌨️",80:"🌦️",95:"⛈️"};

// ─── SPECIES DATA ─────────────────────────────────────────────────────────────
const SPECIES = [
  { id:"crappie", name:"Crappie", emoji:"🐟", color:"#4ab8a0", season:"Spring & Fall", bestTime:"Dawn & Dusk", habitat:"Brush piles, docks, submerged wood", level:"Beginner Friendly",
    rigs:[{name:"Jig Under Bobber",setup:"1/32 oz marabou jig, 18 inches under slip float"},{name:"Minnow & Bobber",setup:"Live minnow on #4 hook, 12-18 inches below bobber"}],
    bait:["Live minnows","Marabou jigs — pink, white, chartreuse","Crappie tubes 1.5 inch"],
    line:{main:"4–6 lb mono or 10 lb braid",leader:"4 lb fluorocarbon"},
    hookSet:"Gentle upward sweep when you feel the tap. Crappie have paper-thin mouths — yank hard and you rip through. Keep rod up, reel smooth.",
    tips:"Adjust bobber depth every few casts until you find the school. Spring = shallow near stumps. They school tight — catch one, keep dropping there."
  },
  { id:"bass", name:"Bass (Largemouth)", emoji:"🎣", color:"#6fcf6f", season:"May–Oct", bestTime:"Early Morning & Evening", habitat:"Weed edges, logs, rocky points", level:"Beginner Friendly",
    rigs:[{name:"Texas Rig",setup:"3/16 oz bullet weight, 3/0 offset hook, 4-5 inch plastic worm"},{name:"Ned Rig",setup:"1/15 oz mushroom head, 2.75 inch stick bait"},{name:"Carolina Rig",setup:"1/2 oz egg sinker, swivel, 18 inch leader, hook + nightcrawler"}],
    bait:["Plastic worms — green pumpkin, black/blue","Topwater frogs near lily pads","Nightcrawlers","Crawfish imitations"],
    line:{main:"15–20 lb braid or 12 lb mono",leader:"12–15 lb fluorocarbon"},
    hookSet:"Feel the hit — count one second — then SWEEP hard to the side. Bass have tough mouths. Keep rod tip UP while fighting.",
    tips:"Dawn topwater along lily pads is magic. Mid-day go slow and deep near logs. Des Plaines River: target eddies behind fallen trees."
  },
  { id:"perch", name:"Yellow Perch", emoji:"🐠", color:"#d4a843", season:"Year-Round (best Fall)", bestTime:"Midday", habitat:"Sandy bottom, open water near structure", level:"Great for Kids",
    rigs:[{name:"Perch Spreader",setup:"Wire spreader with two #6 hooks — simplest setup"},{name:"Drop Shot",setup:"1/4 oz weight, 10 inch leader, #4 hook + minnow"}],
    bait:["Live minnows","Wax worms","Small nightcrawlers","1 inch jig heads"],
    line:{main:"6–8 lb mono",leader:"Not needed"},
    hookSet:"When you feel pecking and the rod bends — just lift up firmly. They practically hook themselves. Great first fish for kids.",
    tips:"Catch one and stay right there — perch school tight. Lake Michigan piers May–July are prime."
  },
  { id:"trout", name:"Rainbow Trout", emoji:"🌈", color:"#5a9fd4", season:"Spring (Apr–May) & Fall (Oct–Nov)", bestTime:"Morning", habitat:"Stocked Cook County lakes", level:"Beginner Friendly",
    alert:"Requires Illinois Inland Trout Stamp (~$6.50)",
    rigs:[{name:"Slip Float + PowerBait",setup:"Slip float, split shot, #10 treble hook + PowerBait egg cluster"},{name:"Inline Spinner",setup:"1/8 oz Panther Martin — cast and slow retrieve"},{name:"Bottom Bait",setup:"1/4 oz egg sinker, swivel, 18 inch leader, #10 hook + marshmallow + corn"}],
    bait:["PowerBait — salmon egg or rainbow color","Corn + marshmallow on bottom","Inline spinners — silver or gold","Wax worms"],
    line:{main:"6 lb mono — clear/low-vis",leader:"4 lb fluorocarbon"},
    hookSet:"Watch your rod tip CONSTANTLY. The SECOND it dips — sweep up and KEEP ROD UP while reeling. Trout fight hard and jump. Loose rod = lost fish.",
    tips:"Go right after FPDCC stocking announcement. Fish cluster near aerators and inlet pipes. Sag Quarry East and Horsetail Lake are closest."
  },
  { id:"catfish", name:"Channel Catfish", emoji:"😺", color:"#e09030", season:"June–Sept", bestTime:"Night & Dusk", habitat:"Deep river holes, channel bends, below bridges", level:"Great Night Fish",
    alert:"PCB advisory on Des Plaines River — eat per IDPH limits",
    rigs:[{name:"Slip Sinker Rig",setup:"1-2 oz egg sinker, bead, swivel, 18-24 inch leader, 2/0 circle hook"},{name:"Santee Cooper Rig",setup:"Egg sinker + peg float 6 inches above hook — lifts bait off bottom"}],
    bait:["Chicken liver — fresh, #1 choice","Nightcrawlers","Stink bait or dip bait","Raw shrimp","Cut bluegill"],
    line:{main:"20–30 lb braid",leader:"20 lb mono"},
    hookSet:"Use a CIRCLE HOOK — just reel down and lift slowly. It sets itself in the corner of the mouth. Do NOT jerk hard.",
    tips:"Night fishing is when cats come alive. Cast into the deepest bend you can reach. Columbia Woods on the Des Plaines has solid holes."
  },
  { id:"carp", name:"Common Carp", emoji:"🐡", color:"#d4a843", season:"May–Oct", bestTime:"Morning & Evening", habitat:"Muddy flats, weed edges, slow river shallows", level:"Challenging",
    rigs:[{name:"Hair Rig (Euro style)",setup:"Hair rig, size 4-6 boilie hook, 18 inch 15 lb fluoro leader, 1-2 oz inline lead"},{name:"Basic Bottom Rig",setup:"2 oz egg sinker, swivel, 18 inch leader, #6 hook + sweet corn"}],
    bait:["Sweet corn (canned)","Dough balls — vanilla or anise scented","Boilies","Nightcrawlers"],
    line:{main:"17–20 lb mono or 30 lb braid",leader:"15 lb fluorocarbon"},
    hookSet:"When the rod loads up and line screams — reel down, lift firmly and HOLD ON. Multiple strong runs. Let them tire completely before landing.",
    tips:"Carp spook easily — move slow and quiet. Pre-bait with loose corn the day before for best results. Cal-Sag Channel holds big ones."
  },
  { id:"coho", name:"Coho Salmon", emoji:"🐟", color:"#5a9fd4", season:"Spring: Mar–May / Fall: Sep–Nov", bestTime:"Pre-Dawn to 9 AM", habitat:"Lake Michigan piers, breakwalls, harbor mouths", level:"Worth the Trip",
    alert:"Indiana waters need Indiana license. IL needs IL license + Salmon/Trout Stamp.",
    rigs:[{name:"Slip Float + Spawn Sac",setup:"Slip float, spawn sac on #2 hook, 4-6 ft below float"},{name:"Cast Spoon",setup:"3/4 oz Little Cleo or Krocodile — cast from pier, steady retrieve"},{name:"Inline Spinner (Spring)",setup:"1/2 oz Blue Fox — slow retrieve near warm water discharges"}],
    bait:["Spawn sacs — top choice","Live alewife on float","Bright spoons — silver, orange, glow","Streamers / egg flies"],
    line:{main:"20 lb braid",leader:"10–12 lb fluorocarbon"},
    hookSet:"Set with a firm sweep then KEEP ROD UP. When they jump — lower the tip slightly so line stays flexible. Never hold stiff during a jump.",
    tips:"Spring (Mar–May): Indiana shore first — Hammond, Portage, Michigan City. Fall (Sep–Nov): all piers fire. NW winds push fish to shore — that is your go day."
  },
  { id:"chinook", name:"Chinook Salmon", emoji:"👑", color:"#8b7fd4", season:"Spring–Fall (lake-run peaks vary)", bestTime:"Dawn & low light", habitat:"Lake Michigan harbors, piers, offshore when staging", level:"Big Water",
    alert:"Same licensing as other salmon — check IL / IN / WI rules for where you stand.",
    rigs:[{name:"Flashers + Fly / Spoon",setup:"Lake trolling setup — dodger or flasher ahead of spoon or fly"},{name:" Pier Spawn / Plug",setup:"Spawn sac under float or crankbait parallel to pier"}],
    bait:["Spawn sacs","Large spoons — silver, blue, glow","Crankbaits — deep diving","Cut alewife strips"],
    line:{main:"25–40 lb braid",leader:"15–20 lb fluorocarbon"},
    hookSet:"Hard strike — kings pull like freight trains. Keep drag smooth; chase down the pier if needed.",
    tips:"Often deeper than coho midsummer. Pier anglers watch for netting boats — fish push near shore after storms."
  },
  { id:"steelhead", name:"Steelhead", emoji:"🌊", color:"#7ec8e8", season:"Late fall–spring (trib runs)", bestTime:"Morning after rain", habitat:"Lake Michigan tributaries — snag-prone stretches", level:"River Trophy",
    alert:"Many streams have gear restrictions / closed seasons — verify IDNR / WI regs before fishing.",
    rigs:[{name:"Float + Spawn",setup:"Centrepin or long float, spawn bag on small hook"},{name:"Spawn Sac + Split Shot",setup:"Touch bottom in pocket water"}],
    bait:["Spawn sacs — pink, orange","Small beads","Woolly buggers / egg flies"],
    line:{main:"8–12 lb mono or 15 lb braid",leader:"6–10 lb fluorocarbon"},
    hookSet:"Soft lifts — trout bite can be shy. Pin slack fast when the float dives.",
    tips:"Within ~200 mi of Cook County you chase runs in IN / MI / WI creeks after lake storms. Dress for cold."
  },
  { id:"lake_trout", name:"Lake Trout", emoji:"🏔️", color:"#5a7a9a", season:"Year-round (deep in summer)", bestTime:"Low light", habitat:"Lake Michigan cold water — 80–120+ ft summer", level:"Boat / Pier Specialty",
    rigs:[{name:"Wire Line + Spoon",setup:"Downrigger or wire with Silver Streak / Sutton"},{name:"Jigging Rap",setup:"Heavy blade bait near bottom marks"}],
    bait:["Large spoons — white, glow","Smelt-imitation plastics","Cut bait legal where allowed"],
    line:{main:"20–30 lb braid",leader:"20 lb fluoro"},
    hookSet:"Often feels like grinding weight until it shakes its head — don’t confuse with zebra mussels.",
    tips:"Summer: boat anglers target thermocline breaks. Shore anglers occasionally hook lakers casting deep spoons off northern piers in spring."
  },
  { id:"brown_trout", name:"Brown Trout", emoji:"🟤", color:"#a07040", season:"Spring & Fall", bestTime:"Low light", habitat:"Lake Michigan shore, stocked inland lakes, some creeks", level:"Intermediate",
    rigs:[{name:"Spawn Under Float",setup:"Same as stocked rainbow — slightly larger hooks"},{name:"Crank / Jerkbait",setup:"Shallow runners near harbor walls"}],
    bait:["Spawn sacs","Minnow plugs","Nightcrawlers — tail hooked"],
    line:{main:"8–12 lb mono",leader:"8 lb fluorocarbon"},
    hookSet:"Brown hit like a freight train compared to stocked rainbow — strip slack fast.",
    tips:"Harbor walls at Waukegan / Wisconsin ports hold browns prowling for gobies. Follow stocking lists for inland puts-and-takes."
  },
  { id:"brook_trout", name:"Brook Trout", emoji:"💎", color:"#6ab0ff", season:"April–Oct (cold water)", bestTime:"Morning", habitat:"Northern WI / UP cold streams — driftless spring creeks", level:"Light Tackle",
    rigs:[{name:"Tiny Spinner",setup:"1/16 oz Panther Martin — cast upstream, drift through pocket"},{name:"Dry Fly",setup:"Size 14–18 Adams / elk hair — match hatch"}],
    bait:["Small worms","Panther Martin — gold","Terrestrial dries — ants, beetles"],
    line:{main:"4 lb mono",leader:"4 lb fluoro"},
    hookSet:"Quick strip — brookies slash fast in skinny water.",
    tips:"Within a few hours’ drive of Cook County: spring-fed creeks up toward Wisconsin driftless. Catch-and-release ethics keep fisheries healthy."
  },
  { id:"smallmouth", name:"Smallmouth Bass", emoji:"🪨", color:"#c9a227", season:"May–Oct", bestTime:"Morning & evening", habitat:"Rocky Lake Michigan shores, river current, quarry walls", level:"Regional Favorite",
    rigs:[{name:"Ned Rig",setup:"Mushroom head + TRD on 6 lb fluoro — finesse smallie standard"},{name:"Tube Jig",setup:"3/16 oz tube on rocky dropoffs"},{name:"Drop Shot",setup:"Small minnow imitation hovering off bottom"}],
    bait:["3 inch tubes — green pumpkin, smoke","Small jerkbaits — suspending","Live crayfish where legal"],
    line:{main:"8–15 lb braid",leader:"8–12 lb fluorocarbon"},
    hookSet:"Sweep sideways — bronzebacks have harder mouths than crappie but less jaw spread than largemouth.",
    tips:"Riprap harbors (Montrose, northern lakefront) and Fox Chain rocks hold football smallies. Wind stacks bait — fish windy sides."
  },
  { id:"walleye", name:"Walleye", emoji:"👁️", color:"#e8d060", season:"Spring & Fall peaks", bestTime:"Dusk & night", habitat:"Fox Chain, Heidecke, Illinois River, Mississippi pools", level:"Table Fare",
    rigs:[{name:"Lindy Rig",setup:"Walking sinker, 18–36 inch snell, hook + nightcrawler or minnow"},{name:"Jig + Minnow",setup:"1/8–1/4 oz jig tipped with fathead"}],
    bait:["Nightcrawlers — slow drag","Minnows — hooked through lips","Deep crankbaits — perch pattern"],
    line:{main:"10–15 lb braid",leader:"10 lb fluorocarbon"},
    hookSet:"Often a mushy tap — drop back slightly then sweep when weight loads.",
    tips:"Spring: river wing dams and gravel runs. Summer: deeper channel edges on big rivers. Check IL / WI slot rules where they apply."
  },
  { id:"sauger", name:"Sauger", emoji:"🌫️", color:"#9a8a70", season:"Fall–Spring", bestTime:"Low light", habitat:"Illinois / Mississippi River turbid holes", level:"River Bag Fish",
    rigs:[{name:"Vertical Jig",setup:"3/8 oz jig + twister tail — lift-drop in scour holes"},{name:"Three-Way Rig",setup:"River current — leader to jig or minnow"}],
    bait:["Twister tails — chartreuse, orange","Minnows","Rip rap crankbaits bumped along bottom"],
    line:{main:"10–14 lb braid",leader:"8–10 lb fluorocarbon"},
    hookSet:"Harder tick than walleye sometimes — don’t confuse with snag in rock.",
    tips:"Looks like small walleye with spotted dorsal and no white tail tip. Excellent eating — handle sizes per daily limits."
  },
  { id:"pike", name:"Northern Pike", emoji:"🐊", color:"#50b070", season:"Cool months best", bestTime:"Any (active predators)", habitat:"Weedy lakes, Fox Chain, scattered Cook forest preserves", level:"Toothy Fun",
    rigs:[{name:"Steel Leader + Spoon",setup:"12 inch wire, 3/4 oz weedless spoon — burn over cabbage"},{name:"Spinnerbait",setup:"White/chartreuse — slow roll edges"}],
    bait:["Large spoons — red/white","Sucker sections — legal where baitfish rules allow","Soft swimbaits — white pearl"],
    line:{main:"20–30 lb braid",leader:"Wire or heavy fluoro bite guard"},
    hookSet:"Sweep hard — long jaws need solid iron. Watch fingers at boat side.",
    tips:"Chain lakes and shallow bays after ice-out. Pike slash sideways — sudden slack means missed hook — reel fast."
  },
  { id:"musky", name:"Muskellunge", emoji:"🐉", color:"#406848", season:"Fall best", bestTime:"Figure-8 next to boat", habitat:"Sparse — Fox Chain, northern WI lakes within drive", level:"Fish of 10,000 Casts",
    rigs:[{name:"Bucktail",setup:"Double 10 blades — steady retrieve over weeds"},{name:"Jerkbaits — dive & rise",setup:"Suick-style — twitch/pause rhythm"}],
    bait:["Large bucktails","Rubber baits — slow roll","Live suckers — where regulations allow"],
    line:{main:"65–80 lb braid",leader:"Heavy wire or fluoro shock"},
    hookSet:"Figure-8 converts lazy follows — deep bend rod through figure next to hull.",
    tips:"Rare compared to pike locally but trophy hunters chase Chain muskies. Release giants quickly — revive boat-side."
  },
  { id:"bluegill", name:"Bluegill", emoji:"☀️", color:"#6fcfef", season:"May–Sept", bestTime:"Mid-morning & evening", habitat:"Every pond, lake margin, dock posts", level:"Perfect for Kids",
    rigs:[{name:"Bobber + Worm",setup:"Small float, split shot, #8 hook — chunk of worm"},{name:"Tungsten Jig + Plastics",setup:"1/64 oz ice-style jig under float for big gills"}],
    bait:["Red worms pieces","Cricket","Bread dough"],
    line:{main:"4–6 lb mono",leader:"Not needed"},
    hookSet:"Lift gentle — aggressive sets tear small mouths.",
    tips:"Fish bedding arcs late spring — visible shallow circles. Catch big gills on deeper weed edges midsummer."
  },
  { id:"rockbass", name:"Rock Bass", emoji:"🪨", color:"#b04040", season:"Year-Round", bestTime:"Whenever sunfish bite", habitat:"Rocky shores, pier pilings, river rip-rap", level:"Easy",
    rigs:[{name:"Same as Bluegill",setup:"Small hook + worm under bobber"}],
    bait:["Worms","Tiny tube jigs","Spinners"],
    line:{main:"6 lb mono",leader:"Not needed"},
    hookSet:"Quick hook — aggressive little guys.",
    tips:"Red eyes distinguish them. Often mixed with perch and bluegill packs near structure."
  },
  { id:"whitebass", name:"White Bass", emoji:"⚡", color:"#e0e080", season:"Spring spawn runs", bestTime:"Mid-day during run", habitat:"River mouths, Fox, Illinois tribs — open-water schools", level:"Fast Action",
    rigs:[{name:"Blade Bait / Slab",setup:"Lift drop on sonar marks"},{name:"Inline Spinner",setup:"1/4 oz — cast into breaking schools"}],
    bait:["Small jigs — white, chartreuse","Tiny crankbaits","Pieces of minnow"],
    line:{main:"8–12 lb mono",leader:"Optional light fluoro"},
    hookSet:"Strip sets when the school boils — chaotic fun.",
    tips:"When gulls dive, cast into the frenzy. Runs are short windows — watch DNR fishing reports."
  },
  { id:"freshwater_drum", name:"Freshwater Drum", emoji:"🥁", color:"#9b8b7a", season:"Warm months", bestTime:"Bottom oriented", habitat:"Lake Michigan nearshore, large river holes", level:"Oddball Eater",
    rigs:[{name:"Bottom Rig + Worm",setup:"3/4 oz sinker, crawler on circle hook"},{name:"Heavy Jig",setup:"Drag sand breaks in harbors"}],
    bait:["Nightcrawlers","Cut shrimp","Zebra mussel-sized goby imitations"],
    line:{main:"15–20 lb mono",leader:"12 lb fluorocarbon"},
    hookSet:"Rod loads slow — don't confuse with snag. Reel steady on circle hooks.",
    tips:"Confusingly called “sheepshead” locally — not salt fish. Firm white flesh if you keep legal size fish."
  },
  { id:"gar", name:"Longnose Gar", emoji:"🦴", color:"#889977", season:"Warm months", bestTime:"Surface slicks", habitat:"Backwaters, muddy bayous, slow Illinois back-channels", level:"Niche",
    rigs:[{name:"Rope Lure / Nylon fray",setup:"Gar teeth tangle in fibers — no hook swallowed"},{name:"Small Jighead",setup:"Tip with minnow — lip hook for jaw corner"}],
    bait:["Live minnows floated under bobber","Rope flies — local gar angler specialty"],
    line:{main:"20 lb mono",leader:"Wire if using trebles"},
    hookSet:"Side jaw hooksets — mouth is mostly bone.",
    tips:"Primitive fighters — explosive surface rolls. Practice catch-and-release for most."
  },
  { id:"bowfin", name:"Bowfin", emoji:"🐲", color:"#558866", season:"Summer", bestTime:"Night", habitat:"Vegetated sloughs, backwaters — rare but present regionally", level:"Tough Fighter",
    rigs:[{name:"Texas Worm",setup:"Heavy weedless through pads"},{name:"Topwater Frog",setup:"Walk the dog across muck bays"}],
    bait:["Large nightcrawlers","Chunk plastics — black/blue","Frogs"],
    line:{main:"30–50 lb braid",leader:"30 lb mono"},
    hookSet:"Bowfin gulps — delay half second then haul — don’t trout-set.",
    tips:"If you hook one in a Chicagoland backwater, you earned a story. Jaw is armored — use pliers."
  },
  { id:"flathead", name:"Flathead Catfish", emoji:"🐱", season:"Summer nights", bestTime:"Dark hours", habitat:"Deep timbered holes — Illinois / Mississippi navigation pools", level:"Heavy Tackle",
    rigs:[{name:"Live Bait Slip Rig",setup:"4–8 oz sinker, live bluegill or bullhead — check baitfish regs"},{name:"Drag Cut Bait",setup:"Heavy rod in anchored current"}],
    bait:["Live sunfish where legal","12 inch bullheads","Large cut shad"],
    line:{main:"40–65 lb braid",leader:"40–50 lb mono"},
    hookSet:"Let circle hook load — flatheads inhale baits.",
    tips:"Plan big nets and gloves — fish over 30 lb happen in big river pools. Know legal baitfish rules cold."
  },
  { id:"blue_cat", name:"Blue Catfish", emoji:"💙", season:"Summer–Fall", bestTime:"Night", habitat:"Lower Illinois / Mississippi — expanding range", level:"Heavy River",
    rigs:[{name:"Knocker Rig",setup:"Heavy sinker bumping structure in scour holes"},{name:"Drag Santee",setup:"Float pegged above chunk bait in flow"}],
    bait:["Fresh cut skipjack / shad","Chicken breast strips — channel-style","Large nightcrawlers"],
    line:{main:"50–80 lb braid",leader:"50 lb mono"},
    hookSet:"Load the rod then lift — blues bulldoze.",
    tips:"Filleted correctly they eat well. Trophy fish may be regulation-protected — measure fast and release giants."
  },
  { id:"bullhead", name:"Bullhead", emoji:"🐂", season:"Spring–Fall", bestTime:"Evening & mud-bottom days", habitat:"Farm ponds, river cuts, sluggish bays", level:"Kid Friendly",
    rigs:[{name:"Split Shot + Hook",setup:"Small hook, worm on mud line — wait for pull"}],
    bait:["Nightcrawlers","Stink baits","Corn"],
    line:{main:"8–10 lb mono",leader:"Not needed"},
    hookSet:"Don’t overset — pull steady into soft mouth.",
    tips:"Brown / yellow / black bullheads — whiskered cousins of channel cats. Perfect camp fish — watch fin spines."
  },
];

/** Real fish photos (Wikimedia Commons — free licenses; link in UI for attribution). */
var SPECIES_PHOTO_BY_ID = {
  crappie:"https://upload.wikimedia.org/wikipedia/commons/4/4e/Pomoxis_nigromaculatus1.jpg",
  bass:"https://upload.wikimedia.org/wikipedia/commons/9/96/Largemouth_bass_fish_underwater_micropterus_salmoides.jpg",
  perch:"https://upload.wikimedia.org/wikipedia/commons/0/07/Yellow_Perch_%28Perca_flavescens%29.jpg",
  trout:"https://upload.wikimedia.org/wikipedia/commons/b/b1/Oncorhynchus_mykiss.jpg",
  catfish:"https://upload.wikimedia.org/wikipedia/commons/5/5f/Channel_Catfish.jpg",
  carp:"https://upload.wikimedia.org/wikipedia/commons/a/a8/Common_carp.jpg",
  coho:"https://upload.wikimedia.org/wikipedia/commons/0/03/Oncorhynchus_kisutch.jpg",
  chinook:"https://upload.wikimedia.org/wikipedia/commons/1/14/Oncorhynchus_tshawytscha.jpg",
  steelhead:"https://upload.wikimedia.org/wikipedia/commons/b/b1/Oncorhynchus_mykiss.jpg",
  lake_trout:"https://upload.wikimedia.org/wikipedia/commons/b/ba/Lake_trout_fishes_salvelinus_namaycush.jpg",
  brown_trout:"https://upload.wikimedia.org/wikipedia/commons/2/2e/Salmo_trutta.jpg",
  brook_trout:"https://upload.wikimedia.org/wikipedia/commons/f/f9/Salvelinus_fontinalis.jpg",
  smallmouth:"https://upload.wikimedia.org/wikipedia/commons/9/9d/Micropterus_dolomieu2.jpg",
  walleye:"https://upload.wikimedia.org/wikipedia/commons/9/96/Sander_vitreus.jpg",
  sauger:"https://upload.wikimedia.org/wikipedia/commons/f/f6/Sander_canadensis_115635868.jpg",
  pike:"https://upload.wikimedia.org/wikipedia/commons/c/c6/Esox_lucius.jpg",
  musky:"https://upload.wikimedia.org/wikipedia/commons/b/b3/Esox_masquinongy.jpg",
  bluegill:"https://upload.wikimedia.org/wikipedia/commons/f/fa/Lepomis_macrochirus.jpg",
  rockbass:"https://upload.wikimedia.org/wikipedia/commons/9/9a/Ambloplites_rupestris.jpg",
  whitebass:"https://upload.wikimedia.org/wikipedia/commons/3/3b/Morone_chrysops.jpg",
  freshwater_drum:"https://upload.wikimedia.org/wikipedia/commons/f/fb/Aplodinotus_grunniens.jpg",
  gar:"https://upload.wikimedia.org/wikipedia/commons/4/47/Longnose_Gar_%28Lepisosteus_osseus%29.jpg",
  bowfin:"https://upload.wikimedia.org/wikipedia/commons/5/5a/Amia_calva.jpg",
  flathead:"https://upload.wikimedia.org/wikipedia/commons/8/84/Pylodictis_olivaris.jpg",
  blue_cat:"https://upload.wikimedia.org/wikipedia/commons/1/17/Ictalurus_furcatus.jpg",
  bullhead:"https://upload.wikimedia.org/wikipedia/commons/b/b4/Ameiurus_nebulosus.jpg",
};

// ─── LOCAL SPOTS ──────────────────────────────────────────────────────────────
const LOCAL_SPOTS = [
  {name:"Salt Creek",addr:"Brookfield, IL",dist:"~1 mi",lat:41.826,lng:-87.845,species:["Bass","Carp","Catfish"],tag:"Creek",color:"#4ab8a0",tip:"Light tackle. Deep bends hold big carp.",apple:"maps://maps.apple.com/?daddr=41.826,-87.845",google:"https://maps.google.com/?daddr=41.826,-87.845"},
  {name:"Thatcher Woods / Des Plaines",addr:"River Forest, IL",dist:"~3 mi",lat:41.874,lng:-87.831,species:["Bass","Carp","Catfish","Crappie","Pike"],tag:"River",color:"#5a9fd4",tip:"Eddies behind fallen logs = bass. Night = catfish.",apple:"maps://maps.apple.com/?daddr=41.874,-87.831",google:"https://maps.google.com/?daddr=41.874,-87.831"},
  {name:"Columbia Woods / Des Plaines",addr:"Willow Springs, IL",dist:"~6 mi",lat:41.762,lng:-87.884,species:["Bass","Catfish","Carp","Crappie"],tag:"River",color:"#5a9fd4",tip:"Best catfish holes on the Des Plaines. Night fish.",apple:"maps://maps.apple.com/?daddr=41.762,-87.884",google:"https://maps.google.com/?daddr=41.762,-87.884"},
  {name:"Cal-Sag Channel",addr:"Hodgkins, IL",dist:"~7 mi",lat:41.762,lng:-87.858,species:["Carp","Catfish","Bass"],tag:"Channel",color:"#e09030",tip:"Heavy rigs, long casts. Great carp fishing.",apple:"maps://maps.apple.com/?daddr=41.762,-87.858",google:"https://maps.google.com/?daddr=41.762,-87.858"},
  {name:"Sag Quarry East",addr:"Palos Hills, IL",dist:"~8 mi",lat:41.704,lng:-87.845,species:["Rainbow Trout","Bass"],tag:"Trout Lake",color:"#5a9fd4",tip:"PowerBait near aerators after stocking.",alert:"Trout Stamp required",apple:"maps://maps.apple.com/?daddr=41.704,-87.845",google:"https://maps.google.com/?daddr=41.704,-87.845"},
  {name:"Horsetail Lake",addr:"Palos Hills, IL",dist:"~9 mi",lat:41.698,lng:-87.851,species:["Rainbow Trout"],tag:"Trout Lake",color:"#5a9fd4",tip:"Smaller lake — easier to cover. Spinners work great.",alert:"Trout Stamp required",apple:"maps://maps.apple.com/?daddr=41.698,-87.851",google:"https://maps.google.com/?daddr=41.698,-87.851"},
];

// ─── SALMON TRAIL ─────────────────────────────────────────────────────────────
const SALMON_SPOTS = [
  {name:"Hammond Marina Breakwall",addr:"Hammond, IN",dist:"~20 mi",lat:41.694,lng:-87.512,season:"Mar–May",tag:"Indiana",color:"#e09030",tip:"Classic spring wall. Spinners + spawn sacs. Go weekday mornings.",apple:"maps://maps.apple.com/?daddr=41.694,-87.512",google:"https://maps.google.com/?daddr=41.694,-87.512"},
  {name:"Whiting / East Chicago Discharge",addr:"East Chicago, IN",dist:"~22 mi",lat:41.678,lng:-87.499,season:"Feb–Apr",tag:"Indiana",color:"#e09030",tip:"First action of spring. Warm discharge attracts fish Feb–March.",apple:"maps://maps.apple.com/?daddr=41.678,-87.499",google:"https://maps.google.com/?daddr=41.678,-87.499"},
  {name:"Portage Lakefront & Riverwalk",addr:"Portage, IN",dist:"~26 mi",lat:41.631,lng:-87.177,season:"Spring & Fall",tag:"Indiana",color:"#e09030",tip:"900-ft pier with handrails. Burns Ditch mouth nearby. Handicap accessible.",apple:"maps://maps.apple.com/?daddr=41.631,-87.177",google:"https://maps.google.com/?daddr=41.631,-87.177"},
  {name:"Port of Indiana / Burns Ditch",addr:"Portage, IN",dist:"~28 mi",lat:41.627,lng:-87.164,season:"Apr–May & Oct–Nov",tag:"Indiana",color:"#e09030",tip:"Indiana DNR top-recommended shore spot.",apple:"maps://maps.apple.com/?daddr=41.627,-87.164",google:"https://maps.google.com/?daddr=41.627,-87.164"},
  {name:"Michigan City — Washington Park",addr:"Michigan City, IN",dist:"~35 mi",lat:41.730,lng:-86.896,season:"Spring & Fall",tag:"Indiana",color:"#e09030",tip:"Trail Creek mouth in fall = money. Slip float + spawn sac from pier.",apple:"maps://maps.apple.com/?daddr=41.730,-86.896",google:"https://maps.google.com/?daddr=41.730,-86.896"},
  {name:"31st St / Burnham Harbor",addr:"Chicago, IL",dist:"~12 mi",lat:41.838,lng:-87.614,season:"Fall Sep–Nov",tag:"IL South",color:"#5a6fd4",tip:"Harbor mouth early morning. Float rigs with spawn sacs.",apple:"maps://maps.apple.com/?daddr=41.838,-87.614",google:"https://maps.google.com/?daddr=41.838,-87.614"},
  {name:"Steelworkers Park",addr:"87th St, Chicago, IL",dist:"~13 mi",lat:41.734,lng:-87.527,season:"Fall Sep–Nov",tag:"IL South",color:"#5a6fd4",tip:"Best south side Coho spot. Rocks at first light. NW winds = go day.",apple:"maps://maps.apple.com/?daddr=41.734,-87.527",google:"https://maps.google.com/?daddr=41.734,-87.527"},
  {name:"Waukegan Harbor Pier",addr:"Waukegan, IL",dist:"~40 mi",lat:42.359,lng:-87.829,season:"Coho: Apr–May & Oct",tag:"IL North",color:"#5a9fd4",tip:"Coho Capital of IL. Fish lake side only. Cleaning station on site.",apple:"maps://maps.apple.com/?daddr=42.359,-87.829",google:"https://maps.google.com/?daddr=42.359,-87.829"},
];

// ─── PRIVATE SPOTS + STORAGE (device-local; aligns with Private_Spots schema) ───
var PROFILE_STORAGE_KEY = "rfc_fishing_profile_v2";
var LOCATION_TRAIL_KEY = "rfc_location_trail_v1";

/** Build spot-sharing picker from cloud members or local imported roster. */
function sharingRosterFromSources(cloudMembers, localRoster, selfId) {
  if (cloudMembers && cloudMembers.length) {
    return cloudMembers.filter(function(m) { return m.isActive !== false && m.id !== selfId; }).map(function(m) {
      return { id: m.id, name: m.displayName || m.id };
    });
  }
  return rosterForSharingPicker(localRoster).filter(function(m) { return m.id !== selfId; });
}

var MOCK_CLUB_SHARED_SPOTS = [
  { id:"club_demo_busse", name:"Busse Lake — south cove", lat:42.018, lng:-88.045, credit:"Jim K.", species_present:["Largemouth Bass","Crappie"], isDemo:true },
];

function sanitizeStr(s, maxLen) {
  var m = maxLen != null ? maxLen : 4000;
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, m);
}

function parseCoordNum(v) {
  var n = parseFloat(String(v).trim());
  return isFinite(n) ? n : NaN;
}

function isValidLatLng(lat, lng) {
  return isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Pull lat,lng from pasted Google Maps URLs or plain "lat, lng" text. Short goo.gl links are not expanded here. */
function extractLatLngFromMapsText(raw) {
  if (!raw || typeof raw !== "string") return null;
  var t = raw.trim().slice(0, 8000);
  var plain = t.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
  if (plain) {
    var a = parseFloat(plain[1]), b = parseFloat(plain[2]);
    if (isValidLatLng(a, b)) return { lat:a, lng:b };
  }
  var patterns = [
    /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)(?:[,/]|\s|$)/,
    /[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /[?&]ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /[?&]center=(-?\d+\.?\d*)[%2c,]\s*(-?\d+\.?\d*)/i,
    /3d(-?\d+\.?\d*)[!]4d(-?\d+\.?\d*)/,
  ];
  var i;
  var m;
  for (i = 0; i < patterns.length; i++) {
    m = t.match(patterns[i]);
    if (m) {
      var la = parseFloat(m[1]), ln = parseFloat(m[2]);
      if (isValidLatLng(la, ln)) return { lat:la, lng:ln };
    }
  }
  return null;
}

function loadLocationTrail() {
  try {
    var raw = localStorage.getItem(LOCATION_TRAIL_KEY);
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveLocationTrail(points) {
  try {
    localStorage.setItem(LOCATION_TRAIL_KEY, JSON.stringify(points));
  } catch (e) {}
}

function pruneTrailPoints(points, nowMs) {
  var cutoff = nowMs - 48 * 60 * 60 * 1000;
  return points.filter(function(p) {
    return p && typeof p.t === "number" && p.t >= cutoff && typeof p.lat === "number" && typeof p.lng === "number";
  });
}

function clusterTrailPoints(points, decimals) {
  var d = decimals == null ? 3 : decimals;
  var map = {};
  points.forEach(function(p) {
    var key = p.lat.toFixed(d) + "," + p.lng.toFixed(d);
    if (!map[key]) map[key] = { lat:p.lat, lng:p.lng, count:0, lastT:p.t };
    map[key].count += 1;
    if (p.t > map[key].lastT) map[key].lastT = p.t;
  });
  return Object.keys(map).map(function(k) { return map[k]; }).sort(function(a, b) { return b.lastT - a.lastT; });
}

function loadStoredProfile() {
  try {
    var raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    return o && typeof o === "object" ? o : null;
  } catch (e) {
    return null;
  }
}

function persistProfileToStorage(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {}
}

function normalizeProfile(raw) {
  var p = raw && typeof raw === "object" ? raw : {};
  var out = {};
  out.name = typeof p.name === "string" ? p.name : "";
  out.email = typeof p.email === "string" ? p.email : "";
  out.level = p.level || "Beginner";
  out.favSpecies = Array.isArray(p.favSpecies) ? p.favSpecies : [];
  out.favSpots = Array.isArray(p.favSpots) ? p.favSpots : [];
  out.gear = Array.isArray(p.gear) ? p.gear : [];
  out.privateSpots = Array.isArray(p.privateSpots) ? p.privateSpots : [];
  out.spotActivityLog = Array.isArray(p.spotActivityLog) ? p.spotActivityLog : [];
  out.memberId = typeof p.memberId === "string" && p.memberId ? p.memberId : "";
  out.firebaseUid = typeof p.firebaseUid === "string" ? p.firebaseUid : "";
  out.cloudSyncedAt = typeof p.cloudSyncedAt === "string" ? p.cloudSyncedAt : "";
  if (out.email) out.email = out.email.replace(/\s+/g, "").trim().toLowerCase();
  return out;
}

function appendSpotActivity(setProfile, message) {
  var msg = sanitizeStr(message, 500);
  if (!msg) return;
  setProfile(function(p) {
    var base = normalizeProfile(p);
    var log = (base.spotActivityLog || []).slice();
    log.unshift({ id:String(Date.now()), at:new Date().toISOString(), message:msg });
    return Object.assign({}, base, { spotActivityLog:log.slice(0, 60) });
  });
}

function patchPrivateSpot(setProfile, id, patch) {
  setProfile(function(p) {
    var base = normalizeProfile(p);
    if (!base.memberId) base = Object.assign({}, base, { memberId:"mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10) });
    var list = (base.privateSpots || []).map(function(s) {
      if (s.id !== id) return s;
      var merged = Object.assign({}, s, patch, { updated_at:new Date().toISOString() });
      merged.is_shared = !!(merged.shareClub || (merged.sharedWith && merged.sharedWith.length > 0));
      return merged;
    });
    return Object.assign({}, base, { privateSpots:list });
  });
}

function setPinHomeSpot(setProfile, id, pin) {
  setProfile(function(p) {
    var base = normalizeProfile(p);
    var now = new Date().toISOString();
    var list = (base.privateSpots || []).map(function(s) {
      return Object.assign({}, s, { pinHome: pin ? s.id === id : (s.id === id ? false : s.pinHome), updated_at: s.id === id ? now : s.updated_at });
    });
    return Object.assign({}, base, { privateSpots:list });
  });
}

function deletePrivateSpotById(setProfile, id) {
  setProfile(function(p) {
    var base = normalizeProfile(p);
    return Object.assign({}, base, { privateSpots:(base.privateSpots || []).filter(function(s) { return s.id !== id; }) });
  });
}

function savePrivateSpotFull(setProfile, draft, editId) {
  var lat = parseCoordNum(draft.lat);
  var lng = parseCoordNum(draft.lng);
  if (!draft.name || !sanitizeStr(draft.name, 1)) return { error:"Add a spot name." };
  if (!isFinite(lat) || lat < -90 || lat > 90) return { error:"Latitude must be between -90 and 90." };
  if (!isFinite(lng) || lng < -180 || lng > 180) return { error:"Longitude must be between -180 and 180." };
  var nowIso = new Date().toISOString();
  var id = editId || ("ps_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9));
  var species = Array.isArray(draft.species_present) ? draft.species_present.filter(function(x) { return typeof x === "string"; }) : [];
  var spot = {
    id:id,
    member_id:null,
    name:sanitizeStr(draft.name, 200),
    lat:lat,
    lng:lng,
    notes:sanitizeStr(draft.notes || "", 2000),
    species_present:species,
    access_info:sanitizeStr(draft.access_info || "", 2000),
    is_shared:!!(draft.shareClub || (draft.sharedWith && draft.sharedWith.length)),
    shareClub:!!draft.shareClub,
    sharedWith:Array.isArray(draft.sharedWith) ? draft.sharedWith : [],
    pinHome:!!draft.pinHome,
    created_at:nowIso,
    updated_at:nowIso,
  };
  setProfile(function(p) {
    var base = normalizeProfile(p);
    if (!base.memberId) base = Object.assign({}, base, { memberId:"mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10) });
    var existing = (base.privateSpots || []).find(function(s) { return s.id === id; });
    if (existing) {
      spot.created_at = existing.created_at || nowIso;
      spot.member_id = existing.member_id || base.memberId;
      spot.is_shared = !!(spot.shareClub || (spot.sharedWith && spot.sharedWith.length > 0));
    } else {
      spot.member_id = base.memberId;
      spot.is_shared = !!(spot.shareClub || (spot.sharedWith && spot.sharedWith.length > 0));
    }
    var list = (base.privateSpots || []).filter(function(s) { return s.id !== id; }).map(function(s) {
      return spot.pinHome ? Object.assign({}, s, { pinHome:false }) : s;
    });
    list.unshift(spot);
    return Object.assign({}, base, { privateSpots:list });
  });
  return { ok:true };
}

function memberCreditFromProfile(profile) {
  var n = (profile && profile.name && profile.name.trim()) || "Member";
  var parts = n.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Member";
  return parts[0] + " " + parts[parts.length - 1].charAt(0).toUpperCase() + ".";
}

function formatShortDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
  } catch (e) {
    return "";
  }
}

function formatLongShareDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { month:"long", day:"numeric", year:"numeric" });
  } catch (e) {
    return "";
  }
}

// ─── LAKES DATABASE ───────────────────────────────────────────────────────────
const LAKES = [
  {id:"sag_east",name:"Sag Quarry East",aka:"Trout Lake",addr:"Palos Hills, IL",dist:"~8 mi",lat:41.704,lng:-87.845,maxDepth:45,avgDepth:22,species:["Rainbow Trout","Largemouth Bass","Bluegill"],primary:"Rainbow Trout",alert:"Trout Stamp required",
    zones:[{depth:"3–8 ft",loc:"North & east shoreline",tip:"Stocked trout stage here — float + PowerBait"},{depth:"12–20 ft",loc:"Center-west basin",tip:"Main trout holding zone mid-day"},{depth:"35–45 ft",loc:"South quarry wall",tip:"Deep refuge in summer heat — drop shot"}],
    bankSpots:[{name:"North Aerator",tip:"Cast toward the aerator — trout stack here after stocking."},{name:"East Inlet Pipe",tip:"Inlet brings oxygenated water — trout hold just downstream."},{name:"South Wall",tip:"Cast parallel to wall for deep trout mid-summer."}],
    season:{spring:"Go right after FPDCC stocking (April). PowerBait near aerators.",summer:"Trout go deep. Early morning only. Drop shot at 30+ ft.",fall:"Second stocking October. Same spring tactics. Spinners work well.",winter:"Check FPDCC ice advisories. No fishing during unsafe ice."},
    lakelink:"https://www.lakelink.com/lakes/illinois/cook-county/",apple:"maps://maps.apple.com/?daddr=41.704,-87.845",google:"https://maps.google.com/?daddr=41.704,-87.845"},
  {id:"tampier",name:"Tampier Lake",addr:"Palos Park, IL",dist:"~12 mi",lat:41.656,lng:-87.845,maxDepth:18,avgDepth:8,species:["Largemouth Bass","Crappie","Bluegill","Channel Catfish","Yellow Perch"],primary:"Largemouth Bass",
    zones:[{depth:"2–5 ft",loc:"North shallows and weed flats",tip:"Bass and bluegill spawn here — topwater frogs and poppers"},{depth:"8–12 ft",loc:"Main basin center",tip:"Crappie suspend at 8 ft near brush — slip float + minnow"},{depth:"14–18 ft",loc:"South channel near dam",tip:"Catfish and larger bass — slip sinker with chicken liver at night"}],
    bankSpots:[{name:"North Weed Flats",tip:"Dawn topwater for bass along the weed edge."},{name:"Main Launch Dock",tip:"Crappie stack under docks — tiny jig at 6-8 ft."},{name:"South Dam",tip:"Night fish catfish here. Slip sinker with chicken liver."}],
    season:{spring:"Bass spawn in shallows. Crappie on brush piles.",summer:"Night fish catfish near dam. Bass go deep mid-day.",fall:"Crappie and bass feed aggressively. Best all-around fall lake.",winter:"Perch and crappie through ice if conditions permit."},
    lakelink:"https://www.lakelink.com/lakes/illinois/cook-county/",apple:"maps://maps.apple.com/?daddr=41.656,-87.845",google:"https://maps.google.com/?daddr=41.656,-87.845"},
  {id:"wolf",name:"Wolf Lake",addr:"Hammond, IN / Chicago border",dist:"~16 mi",lat:41.656,lng:-87.533,maxDepth:11,avgDepth:5,species:["Largemouth Bass","Crappie","Bluegill","Yellow Perch","Channel Catfish","Carp","Northern Pike"],primary:"Crappie",stateNote:"Straddles IL/IN border — check which state waters you are in",
    zones:[{depth:"2–4 ft",loc:"Weed flats north and south",tip:"Bass and crappie in the weeds — weedless frog or jig under float"},{depth:"5–8 ft",loc:"Open basin center",tip:"Perch and crappie — drop shot with small minnow"},{depth:"8–11 ft",loc:"Channel near boat launch",tip:"Catfish and carp — bottom rig with corn or liver"}],
    bankSpots:[{name:"North Weed Edge",tip:"Crappie spawn in May — tiny jig under float at 4 ft."},{name:"East Shoreline",tip:"Bass along the reed edge — weedless frog at dawn."},{name:"Boat Launch Channel",tip:"Catfish and carp — bottom rig, night fishing."}],
    season:{spring:"Outstanding crappie spawn in May. Best crappie lake nearby. Tiny jigs everywhere.",summer:"Bass in weeds at dawn. Perch mid-day in open water.",fall:"Crappie and bass feed heavily. Pike active near weeds.",winter:"Ice fishing popular — perch and crappie through ice."},
    lakelink:"https://www.lakelink.com/lakes/illinois/cook-county/",apple:"maps://maps.apple.com/?daddr=41.656,-87.533",google:"https://maps.google.com/?daddr=41.656,-87.533"},
];

// ─── CATALOGUE DATA ───────────────────────────────────────────────────────────
const CATALOGUE_CATS = ["All","Rigs","Hard Lures","Soft Plastics","Natural Bait","Terminal Tackle"];
const CATALOGUE = [
  {id:"texas",cat:"Rigs",name:"Texas Rig",emoji:"🪱",what:"A soft plastic worm on a hook with a bullet weight above it. The hook point hides inside the worm so it slides through weeds without snagging.",when:"Anytime fishing near grass, weeds, wood, or rocks. Works year-round for bass.",species:["Largemouth Bass","Smallmouth Bass"],parts:["Bullet sinker 3/16 oz","3/0 EWG offset hook","4-5 inch plastic worm — green pumpkin or black/blue"],tip:"Cast it in, let it sink, then slowly drag and hop it along the bottom. Bass usually hit on the fall.",searchQ:"texas rig bass fishing setup",yt:"https://www.youtube.com/results?search_query=texas+rig+fishing+setup+beginners"},
  {id:"ned",cat:"Rigs",name:"Ned Rig",emoji:"🍄",what:"A tiny mushroom-shaped jig head with a small soft plastic stick bait. One of the simplest and deadliest rigs ever — works when nothing else does.",when:"When fish are not biting. Clear water, cold water, or after a cold front.",species:["Bass","Walleye","Perch"],parts:["1/15 oz mushroom jig head","2.75 inch stick bait — green pumpkin or brown"],tip:"Cast it out, let it hit bottom, then do almost nothing. Tiny twitches. Fish cannot resist it.",searchQ:"ned rig mushroom jig head fishing",yt:"https://www.youtube.com/results?search_query=ned+rig+fishing+beginners"},
  {id:"carolina",cat:"Rigs",name:"Carolina Rig",emoji:"⚖️",what:"A heavy egg sinker above a swivel with a long leader and hook below. The sinker stays on the bottom while the bait floats up and drifts naturally.",when:"Searching big open areas for bass or catfish. Great when fish are scattered.",species:["Largemouth Bass","Channel Catfish"],parts:["1/2 oz egg sinker","Red bead","Barrel swivel","18 inch fluorocarbon leader","2/0 hook","Nightcrawler or plastic"],tip:"Cast far, let it sink, then slowly drag it. The bait trails behind and looks like a real creature moving across the bottom.",searchQ:"carolina rig fishing setup diagram",yt:"https://www.youtube.com/results?search_query=carolina+rig+fishing+tutorial+beginners"},
  {id:"dropshot",cat:"Rigs",name:"Drop Shot Rig",emoji:"🎯",what:"Weight at the BOTTOM. Hook tied ABOVE it on the line. The bait floats up off the bottom at a fixed depth — exactly where fish suspend.",when:"When fish are holding at a specific depth off the bottom — perch, bass, walleye.",species:["Yellow Perch","Largemouth Bass","Walleye"],parts:["Drop shot weight 1/4 oz","Drop shot hook #4","8 lb fluorocarbon","Small minnow or soft plastic"],tip:"Shake your rod tip gently without moving the bait from its spot. The bait quivers in place — fish cannot resist it.",searchQ:"drop shot rig fishing setup",yt:"https://www.youtube.com/results?search_query=drop+shot+rig+fishing+beginners"},
  {id:"float",cat:"Rigs",name:"Slip Float / Bobber Rig",emoji:"🔴",what:"A float that slides freely on the line between two tiny stops. When the fish bites, the float goes under. The slip design lets you cast far and set the depth exactly.",when:"Trout, crappie, perch, coho salmon near piers. Any time fish are at a specific depth.",species:["Rainbow Trout","Crappie","Coho Salmon","Yellow Perch"],parts:["Slip float","2 bobber stops","Split shot sinker","Hook #4 to #10","Bait of choice"],tip:"Set the depth so your bait hangs just above where fish are. Move the top bobber stop up or down to adjust.",searchQ:"slip float bobber rig fishing setup",yt:"https://www.youtube.com/results?search_query=slip+float+bobber+rig+fishing+setup"},
  {id:"hairrig",cat:"Rigs",name:"Hair Rig",emoji:"🪝",what:"A European carp rig where the bait hangs on a short loop of line BELOW the hook — not on the hook itself. Fish suck in the bait and the hook catches the corner of its mouth.",when:"Carp fishing only. The gold standard worldwide for carp.",species:["Common Carp"],parts:["Size 4-6 carp hook","Hair rig needle","18 inch 15 lb fluorocarbon hooklink","1-2 oz flat lead","Sweet corn or boilie"],tip:"The carp sucks in the corn, the hook flips and catches the lip. You do not even need to set the hook — just reel down and lift.",searchQ:"hair rig carp fishing setup diagram",yt:"https://www.youtube.com/results?search_query=hair+rig+carp+fishing+how+to"},
  {id:"spoon",cat:"Hard Lures",name:"Casting Spoon",emoji:"🥄",what:"A curved shiny piece of metal shaped like the bowl of a spoon. When you reel it in, it wobbles and flashes like a wounded baitfish.",when:"Coho and Chinook salmon from Lake Michigan piers. Also great for pike and bass.",species:["Coho Salmon","Northern Pike","Largemouth Bass"],parts:["3/4 oz spoon — Little Cleo or Krocodile","Snap swivel","20 lb braid mainline"],tip:"Cast as far as you can from the pier, let it sink 3-5 seconds, then reel at a medium steady pace. The wobble does all the work.",searchQ:"casting spoon little cleo salmon fishing lure",yt:"https://www.youtube.com/results?search_query=casting+spoon+salmon+pier+fishing"},
  {id:"spinner",cat:"Hard Lures",name:"Inline Spinner",emoji:"🌀",what:"A metal blade that spins around a wire shaft as you reel it in. The spinning blade makes flash and vibration that fish detect from far away.",when:"Trout in stocked lakes, crappie, bass, and coho in spring near warm water discharges.",species:["Rainbow Trout","Crappie","Coho Salmon","Largemouth Bass"],parts:["1/8 oz Blue Fox Vibrax or Panther Martin","Snap swivel","6-10 lb mono or braid"],tip:"Cast it out and reel at a slow-medium steady pace. Silver blade in clear water, gold blade in murky water.",searchQ:"inline spinner blue fox panther martin trout fishing lure",yt:"https://www.youtube.com/results?search_query=inline+spinner+fishing+how+to+beginners"},
  {id:"swimbait",cat:"Hard Lures",name:"Swimbait",emoji:"🐠",what:"A soft plastic lure shaped exactly like a real baitfish — with a paddle tail that kicks back and forth as you reel. Looks exactly like a swimming shad or bluegill.",when:"Bass chasing baitfish near the surface or weed edges. Also good for pike.",species:["Largemouth Bass","Northern Pike","Coho Salmon"],parts:["3-5 inch paddle tail swimbait","1/4 oz swimbait jig head","15-20 lb braid"],tip:"Reel at a slow steady pace so the tail kicks back and forth. Bass follow it before striking.",searchQ:"swimbait paddle tail soft plastic bass fishing lure",yt:"https://www.youtube.com/results?search_query=swimbait+fishing+how+to+use+bass"},
  {id:"crankbait",cat:"Hard Lures",name:"Crankbait",emoji:"🎸",what:"A hard plastic lure with a lip on the front that makes it dive and wobble when you reel it in. The lip determines how deep it dives.",when:"Bass and walleye when fish are active and chasing. Cover water fast to find where fish are.",species:["Largemouth Bass","Walleye","Northern Pike"],parts:["Medium-diving crankbait — Rapala or Strike King","12-15 lb mono or fluorocarbon"],tip:"Reel fast enough that you feel it wobbling in your rod tip. Bump it into rocks or logs — that change in action triggers strikes.",searchQ:"crankbait fishing lure bass rapala",yt:"https://www.youtube.com/results?search_query=crankbait+fishing+how+to+use+bass+beginners"},
  {id:"topwater",cat:"Hard Lures",name:"Topwater / Frog",emoji:"💦",what:"A hollow body frog or hard popper that floats on the surface. When you twitch it, it splashes and pops like a frog or injured fish. Bass explode on it from below.",when:"DAWN and DUSK only. Summer mornings near lily pads, docks, or surface cover.",species:["Largemouth Bass","Northern Pike"],parts:["Hollow-body frog OR hard popper","30 lb braid for frogs in heavy cover","Long 7 ft rod"],tip:"Cast near lily pads, let it sit still 3-5 seconds, then twitch. Wait until you FEEL the fish before setting the hook — then sweep hard.",searchQ:"topwater hollow body frog popper bass fishing lure",yt:"https://www.youtube.com/results?search_query=topwater+frog+bass+fishing+how+to"},
  {id:"blade",cat:"Hard Lures",name:"Blade Bait",emoji:"🔪",what:"A thin flat metal lure shaped like a small fish. Very tight fast wiggle and intense vibration that fish feel through their lateral line even in murky water.",when:"Bass and walleye in cold water or winter. Drop it straight down and jig it vertically from piers or bridges.",species:["Largemouth Bass","Walleye","Yellow Perch"],parts:["1/2 oz blade bait — Silver Buddy or Heddon Sonar","10-15 lb mono or fluorocarbon"],tip:"Drop it to the bottom, then snap your wrist upward 6-12 inches and let it flutter back down. Fish hit it on the fall.",searchQ:"blade bait silver buddy fishing lure",yt:"https://www.youtube.com/results?search_query=blade+bait+fishing+how+to+use+bass+walleye"},
  {id:"jig",cat:"Hard Lures",name:"Jig",emoji:"🎣",what:"A hook with a weighted head molded onto it, usually with a skirt of rubber strands. Looks like a crawfish or baitfish on the bottom.",when:"Bass year-round — one of the most versatile lures ever. Especially deadly in cold water.",species:["Largemouth Bass","Crappie","Smallmouth Bass"],parts:["3/8 oz football or arkie jig head","Matching rubber skirt","Soft plastic trailer — chunk or craw","15-20 lb fluorocarbon"],tip:"Drag it slowly on the bottom, pausing every few seconds. Mimic a crawfish. Pause longer in cold water.",searchQ:"bass fishing jig rubber skirt crawfish trailer",yt:"https://www.youtube.com/results?search_query=jig+fishing+bass+how+to+use+beginners"},
  {id:"worm",cat:"Soft Plastics",name:"Plastic Worm",emoji:"🪱",what:"A soft rubber worm in various lengths and colors. One of the oldest and most effective bass lures ever invented. Fish it on a Texas rig, Carolina rig, or wacky rig.",when:"Bass fishing anytime, anywhere. If in doubt, throw a plastic worm.",species:["Largemouth Bass","Smallmouth Bass"],parts:["4-7 inch plastic worm — Zoom Trick Worm or Roboworm","Best colors: green pumpkin, black/blue, watermelon red"],tip:"Green pumpkin in clear water. Dark colors in murky water. Match the size to what baitfish look like in that lake.",searchQ:"soft plastic worm bass fishing lure colors",yt:"https://www.youtube.com/results?search_query=plastic+worm+bass+fishing+how+to+rig"},
  {id:"tube",cat:"Soft Plastics",name:"Tube Jig",emoji:"🧪",what:"A hollow soft plastic tube with tentacles at the tail. On a jig head inside the tube, it falls in a slow spinning spiral — exactly like a dying crawfish.",when:"Smallmouth bass on rocky bottom. Also great for crappie on lighter heads.",species:["Smallmouth Bass","Largemouth Bass","Crappie"],parts:["3-4 inch tube — Berkley Powerbait Tube","Internal tube jig head 1/8 oz","8-10 lb fluorocarbon"],tip:"Skip it under docks or let it spiral down along rocky points. The spinning fall triggers the bite.",searchQ:"tube jig soft plastic bass crappie fishing",yt:"https://www.youtube.com/results?search_query=tube+jig+fishing+how+to+rig+fish"},
  {id:"spawnsac",cat:"Natural Bait",name:"Spawn Sac / Egg Sac",emoji:"🟠",what:"A small mesh bag filled with salmon or trout eggs. Looks and smells exactly like what fish eat during spawning runs. The number 1 bait for Coho from Lake Michigan piers.",when:"Coho salmon spring run (Mar–May) and fall run (Sep–Nov). Also steelhead and brown trout.",species:["Coho Salmon","Chinook Salmon","Steelhead","Brown Trout"],parts:["Mesh spawn netting cut into 2 inch squares","Salmon or trout eggs — cured","#2 octopus hook","Thread or elastic to tie sac closed"],tip:"Buy pre-made sacs at any tackle shop near the lake. Fresh cured eggs outperform old ones. Fish under a slip float at 4-6 ft depth from the pier.",searchQ:"spawn sac egg sac coho salmon fishing bait",yt:"https://www.youtube.com/results?search_query=spawn+sac+salmon+fishing+how+to+make"},
  {id:"powerbait",cat:"Natural Bait",name:"PowerBait",emoji:"🌈",what:"A soft dough-like bait by Berkley infused with scents that trout cannot resist. Stocked rainbow trout are raised on pellet food — PowerBait smells similar.",when:"Stocked rainbow trout at Cook County Forest Preserve lakes after stocking.",species:["Rainbow Trout"],parts:["PowerBait dough — salmon egg or rainbow color","#10 treble hook","Slip float OR egg sinker + swivel"],tip:"Roll a pea-sized ball onto all 3 points of the treble hook. It floats up off the bottom naturally. Replace every 20-30 minutes.",searchQ:"berkley powerbait dough trout fishing bait",yt:"https://www.youtube.com/results?search_query=powerbait+trout+fishing+how+to+use+beginners"},
  {id:"liver",cat:"Natural Bait",name:"Chicken Liver",emoji:"🍖",what:"Fresh chicken liver from the grocery store. Extremely strong smell that spreads through water and draws catfish from long distances. The number 1 catfish bait.",when:"Channel catfish — especially at night in summer on the Des Plaines River.",species:["Channel Catfish"],parts:["Fresh chicken livers — NOT frozen, too mushy","2/0 circle hook","Pantyhose or mesh to hold bait on","1-2 oz egg sinker"],tip:"Wrap liver in a piece of pantyhose to keep it on the hook. Cast to the deepest hole you can reach and leave it. Check every 20 minutes.",searchQ:"chicken liver catfish bait fishing hook",yt:"https://www.youtube.com/results?search_query=chicken+liver+catfish+fishing+how+to"},
  {id:"crawler",cat:"Natural Bait",name:"Nightcrawler / Worm",emoji:"🪱",what:"A large earthworm — the most universal fishing bait on the planet. Every species eats them. Available at any bait shop or Walmart fishing section.",when:"Any species, any time. Especially good for perch, bass, trout, catfish, and carp.",species:["All Species"],parts:["Live nightcrawlers in a worm container — keep cold","#4 to 1/0 hook depending on species"],tip:"Thread the hook through the worm 2-3 times leaving a tail wiggling. Change worms every 30 min — a limp worm catches nothing.",searchQ:"nightcrawler worm fishing bait hook setup",yt:"https://www.youtube.com/results?search_query=how+to+put+worm+on+hook+fishing+beginners"},
  {id:"circlehook",cat:"Terminal Tackle",name:"Circle Hook",emoji:"⭕",what:"A hook where the point curves back toward the shank in a circle. Fish cannot swallow it — it slides out and catches in the corner of the mouth automatically.",when:"Catfish always. Any time you want a self-setting hook or catch-and-release fishing.",species:["Channel Catfish","Carp"],parts:["2/0 to 3/0 circle hook","Heavy mono or braid leader"],tip:"Do NOT jerk to set the hook — just reel down and lift. The hook rotates and catches the lip by itself.",searchQ:"circle hook fishing vs j hook diagram",yt:"https://www.youtube.com/results?search_query=circle+hook+fishing+how+to+use+catfish"},
  {id:"splitshot",cat:"Terminal Tackle",name:"Split Shot Sinker",emoji:"⚫",what:"A tiny round lead weight with a split groove. You pinch it onto your line with pliers. The smallest and simplest way to add weight to get your bait to the right depth.",when:"Float rigs for trout, perch, crappie. Any light presentation that needs a little weight.",species:["All Species"],parts:["Split shot sinker set — various sizes","Needle-nose pliers to crimp"],tip:"Place split shot 12-18 inches above your hook. Use the smallest size that gets your bait to the right depth — lighter is always better.",searchQ:"split shot sinker fishing weight setup",yt:"https://www.youtube.com/results?search_query=split+shot+sinker+how+to+use+fishing"},
];

// ─── LESSONS ──────────────────────────────────────────────────────────────────
const LESSONS = [
  {title:"How to Set the Hook",emoji:"🎣",subs:[
    {sub:"Trout",text:"Watch your rod tip CONSTANTLY. The second it dips — sweep upward IMMEDIATELY and keep the rod UP while reeling. Trout hit fast and soft. Hesitate and they are gone.",yt:"https://www.youtube.com/results?search_query=how+to+set+hook+trout+fishing+beginners"},
    {sub:"Bass",text:"Feel the hit — count one second — then SWEEP hard to the side. Bass have tough mouths. A wimpy set means a lost fish. Keep rod tip up while fighting.",yt:"https://www.youtube.com/results?search_query=how+to+set+hook+bass+fishing"},
    {sub:"Catfish (Circle Hook)",text:"Do not set at all. When the rod loads up — reel down to the fish and lift slowly. The circle hook sets itself in the corner of the mouth. Jerking pulls it out.",yt:"https://www.youtube.com/results?search_query=circle+hook+catfish+how+to+set"},
    {sub:"Crappie",text:"Gentle upward sweep when you feel the tap. Crappie mouths are paper-thin — too hard and you rip the hook through. Steady pressure, rod up, reel smooth.",yt:"https://www.youtube.com/results?search_query=how+to+catch+crappie+beginners"},
    {sub:"Coho Salmon",text:"Set with a firm sweep then KEEP ROD UP. When they jump — lower the tip slightly and bow to the fish. Never hold stiff during a jump or they snap the line.",yt:"https://www.youtube.com/results?search_query=coho+salmon+shore+fishing+fighting"},
  ]},
  {title:"Basic Knots",emoji:"🪡",subs:[
    {sub:"Improved Clinch (Learn This First)",text:"Thread 6 inches of line through hook eye. Wrap around main line 5 times. Thread tag end back through the small loop near the eye, then through the big loop. Wet it, pull tight slowly, trim close. Works for 90% of fishing.",yt:"https://www.youtube.com/results?search_query=improved+clinch+knot+how+to+tie+fishing"},
    {sub:"Palomar Knot (Strongest)",text:"Double 6 inches of line, push loop through hook eye. Tie a loose overhand knot with the doubled line. Pass the hook through the loop. Wet it, pull both ends tight. Hard to tie but almost unbreakable.",yt:"https://www.youtube.com/results?search_query=palomar+knot+how+to+tie+fishing"},
    {sub:"Uni-to-Uni (Braid to Leader)",text:"Overlap braid and leader 6 inches. Make a loop with braid tag, wrap around both lines 4-5 times, pull tag through loop. Repeat with leader. Slide knots together. Trim tags.",yt:"https://www.youtube.com/results?search_query=uni+to+uni+knot+braid+to+leader"},
  ]},
  {title:"Reading the Water",emoji:"📍",subs:[
    {sub:"Fish Are Lazy",text:"Fish do not swim around burning energy. They park near structure — logs, rocks, weeds, docks — where food comes to them. Cast near any edge you can see.",yt:"https://www.youtube.com/results?search_query=how+to+read+water+fishing+beginners"},
    {sub:"Rivers and Current",text:"Fish sit on the DOWNSTREAM side of any obstruction — behind rocks, logs, bridge pilings. The current brings food right to them. That calm pocket behind the object is the strike zone.",yt:"https://www.youtube.com/results?search_query=how+to+fish+rivers+current+structure"},
    {sub:"Depth and Temperature",text:"Hot summer = fish go deep for cold water. Cool fall = fish come shallow. Overcast = fish move shallower. Bright sun = fish hide in shadow or go deep.",yt:"https://www.youtube.com/results?search_query=fish+depth+temperature+fishing+tips"},
  ]},
  {title:"Weather and Fishing",emoji:"🌤️",subs:[
    {sub:"Best Days to Go",text:"Overcast with light wind = almost always a great bite. Day before a storm = fish go crazy feeding. Right after a cold front = tough bite for 1-2 days.",yt:"https://www.youtube.com/results?search_query=best+weather+conditions+fishing"},
    {sub:"Wind Direction",text:"For Lake Michigan: NW winds push baitfish toward the south shore. That is your signal to head to Indiana piers or Steelworkers Park.",yt:"https://www.youtube.com/results?search_query=wind+direction+fishing+lake+michigan"},
    {sub:"Barometric Pressure",text:"Pressure dropping = fish feed aggressively. Pressure rising after storm = fish slow. Find barometric pressure on any weather app.",yt:"https://www.youtube.com/results?search_query=barometric+pressure+fishing+explained"},
  ]},
  {title:"Gear for Beginners",emoji:"🎽",subs:[
    {sub:"Your First Rod",text:"A 6-7 ft medium power spinning rod handles most species. Pair with a size 2500-3000 spinning reel. Pre-spooled combos at Walmart or Bass Pro run $25-40 and catch just as many fish as expensive gear.",yt:"https://www.youtube.com/results?search_query=best+beginner+fishing+rod+reel+combo"},
    {sub:"Line",text:"Start with 8-10 lb monofilament — forgiving, stretchy, cheap. Later upgrade to braid plus fluorocarbon leader for more sensitivity.",yt:"https://www.youtube.com/results?search_query=fishing+line+explained+mono+braid+fluorocarbon"},
    {sub:"Terminal Tackle Box Starter",text:"You need: Size 4, 6, and 1/0 hooks. Split shot sinkers in 3 sizes. Small snap swivels. A handful of slip floats. About $15 at any tackle shop covers you for months.",yt:"https://www.youtube.com/results?search_query=beginner+fishing+tackle+box+setup"},
  ]},
];

// ─── ARTICLES ─────────────────────────────────────────────────────────────────
const ARTICLES = [
  {title:"Spring Crappie Tactics for Illinois Lakes",source:"MidwestOutdoors",url:"https://www.midwestoutdoors.com/fish/crappie/",species:"Crappie"},
  {title:"Des Plaines River Fishing Guide",source:"WindyCityFishing",url:"https://www.windycityfishing.com/",species:"Bass"},
  {title:"Lake Michigan Coho Shore Fishing 101",source:"Indiana DNR",url:"https://www.in.gov/dnr/fish-and-wildlife/fishing/lake-michigan-fishing/",species:"Coho Salmon"},
  {title:"Cook County Forest Preserve Fishing",source:"FPDCC",url:"https://fpdcc.com/things-to-do/fishing/",species:"Rainbow Trout"},
  {title:"Catfish Tactics for Midwest Rivers",source:"MidwestOutdoors",url:"https://www.midwestoutdoors.com/fish/catfish/",species:"Channel Catfish"},
  {title:"Waukegan Harbor Coho Reports",source:"MidwestOutdoors",url:"https://www.midwestoutdoors.com/fish/salmon/",species:"Coho Salmon"},
  {title:"Illinois Fishing Regulations and License",source:"IDNR",url:"https://www.ifishillinois.org/",species:"All"},
];

// ─── WEATHER UTIL ─────────────────────────────────────────────────────────────
function fishingScore(wx) {
  if (!wx) return null;
  let score = 60, notes = [];
  if (wx.temp < 35) { score -= 35; notes.push("Too cold — fish very sluggish"); }
  else if (wx.temp < 50) { score -= 15; notes.push("Cool — fish slow, try deep water"); }
  else if (wx.temp >= 60 && wx.temp <= 78) { score += 15; notes.push("Prime temperature range"); }
  else if (wx.temp > 88) { score -= 20; notes.push("Very hot — fish deep or night fish"); }
  if (wx.wind > 20) { score -= 25; notes.push("High winds — tough casting, stay off open piers"); }
  else if (wx.wind > 12) { score -= 8; notes.push("Breezy — fish the windward shore"); }
  else { score += 5; notes.push("Calm winds — great casting conditions"); }
  if (wx.precip > 60) { score -= 20; notes.push("Rain likely — fish aggressively before the storm"); }
  else { score += 5; notes.push("Low rain chance — comfortable day out"); }
  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? "GREAT DAY" : score >= 55 ? "GOOD DAY" : score >= 35 ? "FAIR DAY" : "STAY HOME";
  const emoji = score >= 75 ? "🎣" : score >= 55 ? "👍" : score >= 35 ? "😐" : "🚫";
  const color = score >= 75 ? "#6fcf6f" : score >= 55 ? "#d4a843" : score >= 35 ? "#e09030" : "#e05050";
  return { score, label, emoji, color, notes };
}

var HOME_TARGET_SPECIES_KEY = "rfc_home_target_species_v1";
var HOME_WATER_SPOTS = LOCAL_SPOTS.map(function(s) {
  return { name:s.name, lat:s.lat, lng:s.lng, species:s.species || [], waterType:s.tag || "Water", tip:s.tip || "", parking:s.addr || "" };
});

function getSeason(monthIndex) {
  if (monthIndex >= 2 && monthIndex <= 4) return "spring";
  if (monthIndex >= 5 && monthIndex <= 7) return "summer";
  if (monthIndex >= 8 && monthIndex <= 10) return "fall";
  return "winter";
}

function getMoonInfo(date) {
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
  return { phase:phase, label:label };
}

function calcBFR(wx, moonInfo) {
  if (!wx) return null;
  var score = 50;
  var temp = wx.temp;
  if (temp >= 58 && temp <= 75) score += 20;
  else if (temp >= 50 && temp < 58) score += 10;
  else if (temp > 75 && temp <= 85) score += 8;
  else if (temp > 85) score -= 10;
  else if (temp < 45) score -= 25;
  var wind = wx.wind || 0;
  if (wind >= 5 && wind <= 15) score += 10;
  else if (wind > 20) score -= 15;
  else if (wind < 3) score += 5;
  var precip = wx.precip || 0;
  if (precip < 20) score += 5;
  else if (precip > 70) score -= 15;
  else if (precip > 40) score -= 5;
  var moon = moonInfo || getMoonInfo();
  if (moon.label === "New" || moon.label === "Full") score += 15;
  else if (moon.label === "First Quarter" || moon.label === "Last Quarter") score += 8;
  else score += 4;
  score = Math.max(0, Math.min(100, Math.round(score)));
  var tierLabel = score >= 85 ? "EPIC" : score >= 70 ? "GREAT" : score >= 55 ? "GOOD" : score >= 40 ? "FAIR" : "POOR";
  var tierColor = score >= 85 ? "#3ddc84" : score >= 70 ? "#6fcf6f" : score >= 55 ? "#d4a843" : score >= 40 ? "#e09030" : "#e05050";
  return { score:score, label:tierLabel, color:tierColor };
}

function bfrTierColor(score) {
  if (score >= 85) return "#3ddc84";
  if (score >= 70) return "#6fcf6f";
  if (score >= 55) return "#d4a843";
  if (score >= 40) return "#e09030";
  return "#e05050";
}

function windCompass(deg) {
  if (deg == null || !isFinite(deg)) return "—";
  var dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function estimateWaterTemp(airTemp, monthIndex) {
  var season = getSeason(monthIndex);
  var offset = season === "spring" ? 8 : season === "summer" ? 5 : season === "fall" ? 6 : 10;
  return Math.round(airTemp - offset);
}

function pressureTrendLabel(current, prior) {
  if (current == null || prior == null) return { label:"Stable", color:"#5a9fd4" };
  var diff = current - prior;
  if (diff <= -1.5) return { label:"Falling", color:"#6fcf6f" };
  if (diff >= 1.5) return { label:"Rising", color:"#d4a843" };
  return { label:"Stable", color:"#5a9fd4" };
}

function formatTimeShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  } catch (e) { return "—"; }
}

function calcSolunarWindows(sunriseIso, sunsetIso) {
  var now = new Date();
  var sr = sunriseIso ? new Date(sunriseIso) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 30);
  var ss = sunsetIso ? new Date(sunsetIso) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0);
  function windowFrom(startMs, durationMin, type, color) {
    var start = new Date(startMs);
    var end = new Date(startMs + durationMin * 60000);
    return { type:type, start:start, end:end, durationMin:durationMin, color:color, label:formatTimeShort(start.toISOString()) + " – " + formatTimeShort(end.toISOString()) };
  }
  return [
    windowFrom(sr.getTime() + 90 * 60000, 120, "Major", "#d4a843"),
    windowFrom(ss.getTime() - 150 * 60000, 120, "Major", "#d4a843"),
    windowFrom(sr.getTime() + 6 * 3600000, 60, "Minor", "#5a9fd4"),
    windowFrom(ss.getTime() + 2 * 3600000, 60, "Minor", "#5a9fd4"),
  ];
}

function goldenHourMessage(sunriseIso, sunsetIso) {
  var now = Date.now();
  var sr = sunriseIso ? new Date(sunriseIso).getTime() : null;
  var ss = sunsetIso ? new Date(sunsetIso).getTime() : null;
  function minsUntil(t) { return Math.max(0, Math.round((t - now) / 60000)); }
  if (sr && now >= sr - 45 * 60000 && now <= sr + 45 * 60000) return "🌅 Golden hour NOW — get fishing!";
  if (ss && now >= ss - 45 * 60000 && now <= ss + 45 * 60000) return "🌅 Golden hour NOW — get fishing!";
  if (sr && now < sr) {
    var m = minsUntil(sr);
    return "🌅 Golden hour in " + Math.floor(m / 60) + "h " + (m % 60) + "min";
  }
  if (ss && now < ss) {
    var m2 = minsUntil(ss);
    return "🌅 Golden hour in " + Math.floor(m2 / 60) + "h " + (m2 % 60) + "min";
  }
  return "🌙 Evening bite window opening";
}

function findNearestHomeWater(lat, lng) {
  var best = null;
  HOME_WATER_SPOTS.forEach(function(s) {
    var d = haversineMi(lat, lng, s.lat, s.lng);
    if (!best || d < best.dist) best = { spot:s, dist:d };
  });
  return best;
}

function speciesBaitTips(targetSpecies, season) {
  var sp = targetSpecies && targetSpecies !== "All Species"
    ? SPECIES.find(function(s) { return s.name === targetSpecies || s.name.indexOf(targetSpecies) >= 0; })
    : null;
  if (!sp) {
    return [
      { name:"Live minnow under bobber", why:"Universal — crappie, perch, walleye all eat it." },
      { name:"Texas rig worm", why:"Bass staple in " + season + " — slow drag near cover." },
      { name:"Inline spinner", why:"Cover water fast when fish are active." },
    ];
  }
  return (sp.bait || []).slice(0, 3).map(function(b, i) {
    return { name:b, why:i === 0 ? (sp.tips || "Top pick for " + sp.name + " this season.") : (sp.season || "Seasonal favorite") };
  });
}

function BFRDial({ score, color, T }) {
  var th = THEMES[T];
  var [animScore, setAnimScore] = useState(0);
  useEffect(function() {
    var t = setTimeout(function() { setAnimScore(score || 0); }, 80);
    return function() { clearTimeout(t); };
  }, [score]);
  var pct = Math.max(0, Math.min(100, animScore)) / 100;
  var angle = -90 + pct * 180;
  var arcLen = Math.PI * 90;
  var filled = arcLen * pct;
  return (
    <div style={{ textAlign:"center", margin:"8px auto 4px" }}>
      <svg width="220" height="130" viewBox="0 0 220 130" style={{ display:"block", margin:"0 auto" }}>
        <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke={th.border} strokeWidth="10" strokeLinecap="round" />
        <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke={color || th.green} strokeWidth="10" strokeLinecap="round" strokeDasharray={filled + " " + arcLen} style={{ transition:"stroke-dasharray 1s ease-out" }} />
        <g transform={"rotate(" + angle + " 110 110)"} style={{ transition:"transform 1s ease-out" }}>
          <line x1="110" y1="110" x2="110" y2="32" stroke={th.white} strokeWidth="3" strokeLinecap="round" />
          <circle cx="110" cy="110" r="6" fill={color || th.green} />
        </g>
        <text x="110" y="98" textAnchor="middle" fill={th.white} fontSize="28" fontWeight="800">{animScore}</text>
        <text x="110" y="118" textAnchor="middle" fill={color || th.green} fontSize="11" fontWeight="700">BITE FORECAST</text>
      </svg>
    </div>
  );
}

async function loadWeather(lat, lng) {
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&current=temperature_2m,windspeed_10m,wind_direction_10m,weathercode,precipitation_probability,surface_pressure&hourly=surface_pressure&daily=sunrise,sunset&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FChicago");
    if (!r.ok) throw new Error("bad");
    const d = await r.json();
    const c = d.current;
    var pressureNow = c.surface_pressure;
    var pressurePrior = pressureNow;
    if (d.hourly && d.hourly.surface_pressure && d.hourly.surface_pressure.length > 3) {
      pressurePrior = d.hourly.surface_pressure[Math.max(0, d.hourly.surface_pressure.length - 4)];
    }
    var sunrise = d.daily && d.daily.sunrise ? d.daily.sunrise[0] : null;
    var sunset = d.daily && d.daily.sunset ? d.daily.sunset[0] : null;
    return {
      temp: Math.round(c.temperature_2m),
      wind: Math.round(c.windspeed_10m),
      windDir: c.wind_direction_10m,
      windCompass: windCompass(c.wind_direction_10m),
      pressure: Math.round(pressureNow * 10) / 10,
      pressureTrend: pressureTrendLabel(pressureNow, pressurePrior),
      sunrise: sunrise,
      sunset: sunset,
      code: c.weathercode,
      precip: c.precipitation_probability || 0,
      icon: WX_ICON[c.weathercode] || "🌡️",
      condition: WX_LABEL[c.weathercode] || "Unknown",
      lat: lat,
      lng: lng,
    };
  } catch(e) {
    // Fallback: ask Claude for estimate
    const now = new Date();
    const mo = now.toLocaleString("default",{month:"long"});
    const hr = now.getHours();
    const tod = hr < 12 ? "morning" : hr < 17 ? "afternoon" : "evening";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:150,
        messages:[{role:"user",content:"It is " + tod + " in " + mo + " near North Riverside IL. Give a realistic weather estimate. Respond ONLY with raw JSON, no markdown: {\"temp\":62,\"wind\":9,\"precip\":20,\"code\":2,\"icon\":\"⛅\",\"condition\":\"Partly Cloudy\"}"}]
      })
    });
    const data = await res.json();
    const txt = (data.content && data.content[0] && data.content[0].text) || "";
    const m = txt.match(/\{[^}]+\}/);
    if (m) return JSON.parse(m[0]);
    return null;
  }
}

async function loadFishingTip(temp, wind, condition) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:80,
        messages:[{role:"user",content:"Weather near North Riverside IL: " + temp + "F, " + wind + "mph wind, " + condition + ". Give ONE short fishing tip for the Des Plaines River, Cook County lakes, or Lake Michigan. One sentence, no preamble."}]
      })
    });
    const data = await res.json();
    return (data.content && data.content[0] && data.content[0].text && data.content[0].text.trim()) || "";
  } catch(e) { return ""; }
}

async function loadTackleImage(itemName) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        messages:[{role:"user",content:"Find a product photo for " + itemName + " fishing lure or bait. Search for a direct image URL ending in .jpg .png or .webp from walmart.com amazon.com basspro.com or tacklewarehouse.com. Return ONLY the image URL on one line. Nothing else."}]
      })
    });
    const data = await res.json();
    const allText = (data.content || []).map(function(b) {
      if (b.type === "text") return b.text;
      return JSON.stringify(b);
    }).join(" ");
    const m = allText.match(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp)(\?\S*)?/i);
    return m ? m[0] : null;
  } catch(e) { return null; }
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function Card({ children, style, borderColor, T }) {
  const th = THEMES[T || "dark"];
  return (
    <div style={{ background:th.card, border:"1px solid " + (borderColor || th.border), borderRadius:12, padding:14, marginBottom:10, ...style }}>
      {children}
    </div>
  );
}

function SecLabel({ text, T }) {
  const th = THEMES[T || "dark"];
  return <div style={{ fontSize:10, color:th.muted, fontFamily:"monospace", letterSpacing:2, marginBottom:8, textTransform:"uppercase" }}>{text}</div>;
}

function OBtn({ label, onClick, color, style }) {
  return (
    <button onClick={onClick} style={{ background:"transparent", color:color, border:"1px solid " + color, borderRadius:8, padding:"7px 13px", cursor:"pointer", fontSize:12, ...style }}>
      {label}
    </button>
  );
}

function Pill({ label, color }) {
  return <span style={{ background:color + "22", color:color, border:"1px solid " + color + "44", borderRadius:20, padding:"2px 8px", fontSize:10, fontFamily:"monospace", whiteSpace:"nowrap" }}>{label}</span>;
}

// ─── HOME TAB (BassForecast-style bite intel) ─────────────────────────────────
var HOME_SPECIES_PICKS = ["All Species", "Bass (Largemouth)", "Crappie", "Channel Catfish", "Coho Salmon", "Walleye", "Yellow Perch"];

function HomeTab({ profile, T, setTab, authMember, homeSection, setHomeSection }) {
  const th = THEMES[T];
  const section = homeSection || "forecast";
  const [wx, setWx] = useState(null);
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRefresh, setShowRefresh] = useState(false);
  const [expandArticles, setExpandArticles] = useState(false);
  const [targetSpecies, setTargetSpecies] = useState(function() {
    try { return localStorage.getItem(HOME_TARGET_SPECIES_KEY) || "All Species"; } catch (e) { return "All Species"; }
  });
  const [nearestWater, setNearestWater] = useState(null);
  const [userGps, setUserGps] = useState(null);
  const favSp = (profile && profile.favSpecies) || [];

  const load = useCallback(function() {
    setLoading(true); setShowRefresh(false);
    var lat = 41.84, lng = -87.83;
    function doLoad(la, ln) {
      setUserGps({ lat:la, lng:ln });
      loadWeather(la, ln).then(function(w) {
        setWx(w);
        setNearestWater(findNearestHomeWater(la, ln));
        setLoading(false);
        if (w) loadFishingTip(w.temp, w.wind, w.condition).then(setTip);
      });
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(pos) { doLoad(pos.coords.latitude, pos.coords.longitude); },
        function() { doLoad(lat, lng); },
        { timeout:6000 }
      );
    } else { doLoad(lat, lng); }
  }, []);

  useEffect(function() {
    load();
    var t = setInterval(function() { setShowRefresh(true); }, 30 * 60 * 1000);
    return function() { clearInterval(t); };
  }, []);

  function pickSpecies(sp) {
    setTargetSpecies(sp);
    try { localStorage.setItem(HOME_TARGET_SPECIES_KEY, sp); } catch (e) {}
  }

  var rating = fishingScore(wx);
  var moonInfo = getMoonInfo();
  var bfr = calcBFR(wx, moonInfo);
  var season = getSeason(new Date().getMonth());
  var baits = speciesBaitTips(targetSpecies, season);
  var solunar = wx ? calcSolunarWindows(wx.sunrise, wx.sunset) : [];
  var waterTemp = wx ? estimateWaterTemp(wx.temp, new Date().getMonth()) : null;
  var golden = wx ? goldenHourMessage(wx.sunrise, wx.sunset) : "";
  var displayName = (profile && profile.name) ? profile.name.split(" ")[0] : "Angler";
  var nearSpot = nearestWater && nearestWater.spot;
  var nearDist = nearestWater ? nearestWater.dist.toFixed(1) : null;
  var myPrivateSpots = (profile && profile.privateSpots) || [];
  var pinnedSpot = myPrivateSpots.find(function(s) { return s.pinHome; }) || null;
  var nearestPrivate = null;
  if (userGps && myPrivateSpots.length > 0) {
    myPrivateSpots.forEach(function(s) {
      if (!isFinite(s.lat) || !isFinite(s.lng)) return;
      var d = haversineMi(userGps.lat, userGps.lng, s.lat, s.lng);
      if (!nearestPrivate || d < nearestPrivate.dist) nearestPrivate = { spot:s, dist:d };
    });
  }
  var nearestPrivateSorted = userGps ? myPrivateSpots.filter(function(s) { return isFinite(s.lat) && isFinite(s.lng); }).map(function(s) {
    return { spot:s, dist:haversineMi(userGps.lat, userGps.lng, s.lat, s.lng) };
  }).sort(function(a, b) { return a.dist - b.dist; }) : [];
  var topSpeciesToday = nearSpot && nearSpot.species ? nearSpot.species.slice(0, 3).join(", ") : "Bass, Crappie, Catfish";
  var pinnedSpotDist = null;
  if (pinnedSpot && userGps && isFinite(pinnedSpot.lat) && isFinite(pinnedSpot.lng)) {
    pinnedSpotDist = haversineMi(userGps.lat, userGps.lng, pinnedSpot.lat, pinnedSpot.lng).toFixed(1);
  }
  var featuredSpotName = pinnedSpot ? pinnedSpot.name : (nearSpot ? nearSpot.name : null);
  var featuredDist = pinnedSpot ? pinnedSpotDist : nearDist;
  var featuredSpeciesList = pinnedSpot && pinnedSpot.species_present && pinnedSpot.species_present.length
    ? pinnedSpot.species_present.slice(0, 3).join(", ")
    : topSpeciesToday;
  var featuredPrimarySpecies = pinnedSpot && pinnedSpot.species_present && pinnedSpot.species_present.length
    ? pinnedSpot.species_present[0]
    : targetSpecies;
  var featuredBaits = speciesBaitTips(featuredPrimarySpecies, season);
  var biteScore = bfr ? bfr.score : (rating ? rating.score : 0);
  var articles = expandArticles ? ARTICLES : ARTICLES.filter(function(a) { return favSp.length === 0 || favSp.includes(a.species) || a.species === "All"; });
  if (articles.length === 0) articles = ARTICLES;
  var bfrBg = T === "bluesteel" ? "linear-gradient(180deg, #0d1520 0%, #122035 100%)" : "linear-gradient(180deg, #0a1418 0%, #0d1f2d 100%)";
  var hour = new Date().getHours();
  var timeLabel = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  var nextWindow = solunar && solunar[0];
  var windowLine = nextWindow
    ? (featuredSpotName ? "Best window at " + featuredSpotName + " — " + nextWindow.start : "Best feeding window — " + nextWindow.start)
    : null;

  return (
    <div style={{ paddingBottom:8 }}>
      <div style={{ display:"flex", gap:8, margin:"12px 0 10px" }}>
        <OBtn label="Forecast" onClick={function() { setHomeSection && setHomeSection("forecast"); }} color={section === "forecast" ? th.green : th.muted} style={{ flex:1, textAlign:"center" }} />
        <OBtn label="Club Feed" onClick={function() { setHomeSection && setHomeSection("feed"); }} color={section === "feed" ? th.green : th.muted} style={{ flex:1, textAlign:"center" }} />
      </div>

      {section === "feed" ? (
        <ClubFeedList authMember={authMember} T={T} setTab={setTab} onSignInClick={function() { setTab("me"); }} />
      ) : (
      <>
      {displayName !== "Angler" && !loading && (
        <div style={{ background:th.card, border:"1px solid " + th.border, borderRadius:12, padding:"12px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:12, animation:"fadeInUp 0.25s ease-out both" }}>
          <div style={{ fontSize:26, lineHeight:1 }}>{hour < 12 ? "🌅" : hour < 17 ? "☀️" : "🌙"}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, color:th.white, fontWeight:700, lineHeight:1.3 }}>Good {timeLabel}, {displayName}</div>
            {windowLine ? <div style={{ fontSize:12, color:th.green, marginTop:2, lineHeight:1.4 }}>{windowLine}</div> : null}
          </div>
        </div>
      )}
      <div style={{ background:bfrBg, borderRadius:14, border:"1px solid " + th.border, padding:"14px 12px 10px", marginBottom:12 }}>
        <div style={{ fontSize:11, color:th.blue, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", marginBottom:6 }}>RFC Bite Forecast</div>
        <div style={{ fontSize:20, color:th.white, fontWeight:800, lineHeight:1.25, marginBottom:4 }}>What&apos;s biting near you right now</div>
        {loading ? (
          <div style={{ fontSize:13, color:th.muted, padding:"12px 0" }}>Locating nearest water…</div>
        ) : (pinnedSpot || nearSpot) ? (
          <div>
            {pinnedSpot ? <div style={{ fontSize:10, color:th.blue, fontWeight:700, letterSpacing:0.8, textTransform:"uppercase", marginBottom:4 }}>📍 Your pinned spot</div> : null}
            <div style={{ fontSize:15, color:th.green, fontWeight:700 }}>{featuredSpotName}{featuredDist ? " · " + featuredDist + " mi" : ""}</div>
            {featuredSpeciesList ? <div style={{ fontSize:12, color:th.muted, marginTop:4 }}>Active: {featuredSpeciesList}</div> : null}
            <div style={{ fontSize:13, color:th.white, marginTop:8, lineHeight:1.45 }}>
              <span style={{ color:th.gold, fontWeight:700 }}>Try:</span> {featuredBaits[0] ? featuredBaits[0].name : "Live minnow"} — {featuredBaits[0] ? featuredBaits[0].why : "versatile starter bait"}
            </div>
            {pinnedSpot && pinnedSpot.notes ? <div style={{ fontSize:11, color:th.muted, marginTop:6, lineHeight:1.45, fontStyle:"italic" }}>{pinnedSpot.notes.slice(0, 120)}{pinnedSpot.notes.length > 120 ? "…" : ""}</div> : null}
            <div style={{ marginTop:8, display:"inline-block", background:bfrTierColor(biteScore) + "22", border:"1px solid " + bfrTierColor(biteScore), borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700, color:bfrTierColor(biteScore) }}>
              Bite score {biteScore}/100
            </div>
          </div>
        ) : null}
      </div>


      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:th.muted, marginBottom:6 }}>Fishing for today</div>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
          {HOME_SPECIES_PICKS.map(function(sp) {
            var on = targetSpecies === sp;
            return (
              <button key={sp} onClick={function() { pickSpecies(sp); }} style={{ flexShrink:0, background:on ? th.green + "33" : th.card, border:"1px solid " + (on ? th.green : th.border), borderRadius:20, padding:"6px 12px", color:on ? th.green : th.muted, fontSize:11, fontWeight:on ? 700 : 400, cursor:"pointer" }}>
                {sp}
              </button>
            );
          })}
        </div>
      </div>

      {showRefresh && (
        <div style={{ background:th.green + "22", border:"1px solid " + th.green + "55", borderRadius:10, padding:12, marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:th.green, fontSize:13, fontWeight:700 }}>Ready to refresh?</div>
            <div style={{ color:th.muted, fontSize:11 }}>Tap to load fresh bite intel</div>
          </div>
          <button onClick={load} style={{ background:th.green, color:"#000", border:"none", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:700 }}>Update</button>
        </div>
      )}

      <Card T={T} borderColor={bfr ? bfr.color : th.border} style={{ background:T === "bluesteel" ? "rgba(18,32,53,0.85)" : "rgba(10,22,28,0.9)" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"24px 0", color:th.muted }}>Calculating bite forecast…</div>
        ) : bfr && wx ? (
          <div>
            <BFRDial score={bfr.score} color={bfr.color} T={T} />
            <div style={{ textAlign:"center", fontSize:18, fontWeight:800, color:bfr.color, marginBottom:12 }}>{bfr.label} DAY</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              <div style={{ background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10 }}>
                <div style={{ fontSize:10, color:th.muted }}>Wind</div>
                <div style={{ fontSize:16, color:th.white, fontWeight:700 }}>{wx.wind} mph {wx.windCompass || ""}</div>
                {wx.windCompass === "NW" ? <div style={{ fontSize:10, color:th.green, marginTop:4 }}>NW wind — good day for Lake Michigan</div> : null}
              </div>
              <div style={{ background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10 }}>
                <div style={{ fontSize:10, color:th.muted }}>Pressure</div>
                <div style={{ fontSize:16, color:wx.pressureTrend ? wx.pressureTrend.color : th.white, fontWeight:700 }}>{wx.pressureTrend ? wx.pressureTrend.label : "—"}</div>
                <div style={{ fontSize:10, color:th.muted, marginTop:2 }}>{wx.pressure ? wx.pressure + " mb" : ""}</div>
              </div>
              <div style={{ background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10 }}>
                <div style={{ fontSize:10, color:th.muted }}>Water temp (est.)</div>
                <div style={{ fontSize:16, color:th.white, fontWeight:700 }}>~{waterTemp}°F</div>
              </div>
              <div style={{ background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10 }}>
                <div style={{ fontSize:10, color:th.muted }}>Moon</div>
                <div style={{ fontSize:16, color:th.gold, fontWeight:700 }}>{moonInfo.label}</div>
              </div>
            </div>
            {golden ? <div style={{ fontSize:12, color:th.gold, marginBottom:10, fontWeight:600 }}>{golden}</div> : null}
            <SecLabel text="Solunar feeding windows" T={T} />
            <div style={{ display:"grid", gap:6, marginBottom:10 }}>
              {solunar.map(function(w, i) {
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:th.card, border:"1px solid " + w.color + "55", borderRadius:8, padding:"8px 10px" }}>
                    <span style={{ fontSize:12, color:w.color, fontWeight:700 }}>{w.type}</span>
                    <span style={{ fontSize:11, color:th.white }}>{w.label}</span>
                    <span style={{ fontSize:10, color:th.muted }}>{w.durationMin}m</span>
                  </div>
                );
              })}
            </div>
            <SecLabel text={"Top baits — " + targetSpecies + " · " + season} T={T} />
            {baits.map(function(b, i) {
              return (
                <div key={i} style={{ marginBottom:8, paddingBottom:8, borderBottom: i < baits.length - 1 ? "1px solid " + th.border : "none" }}>
                  <div style={{ fontSize:13, color:th.white, fontWeight:700 }}>{b.name}</div>
                  <div style={{ fontSize:11, color:th.muted, marginTop:2 }}>{b.why}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color:th.red, fontSize:13, textAlign:"center", padding:16 }}>
            Forecast unavailable. <span style={{ color:th.green, cursor:"pointer" }} onClick={load}>Retry</span>
          </div>
        )}
      </Card>

      <Card T={T} borderColor={rating ? rating.color : undefined}>
        <SecLabel text="Today's Conditions" T={T} />
        {loading ? (
          <div style={{ textAlign:"center", padding:"20px 0", color:th.muted }}>Fetching live conditions...</div>
        ) : wx ? (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:42 }}>{wx.icon}</div>
                <div style={{ fontSize:26, color:th.white, fontWeight:700 }}>{wx.temp}°F</div>
                <div style={{ fontSize:12, color:th.muted }}>{wx.condition} · {wx.wind} mph {wx.windCompass || ""} · {wx.precip}% rain</div>
              </div>
              {rating && (
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:16, fontWeight:700, color:rating.color }}>{rating.emoji} {rating.label}</div>
                  <div style={{ width:90, height:8, background:th.border, borderRadius:4, marginTop:6, overflow:"hidden" }}>
                    <div style={{ width:rating.score + "%", height:"100%", background:rating.color, borderRadius:4 }} />
                  </div>
                  <div style={{ fontSize:11, color:th.muted, marginTop:3 }}>{rating.score}/100</div>
                </div>
              )}
            </div>
            {rating && (
              <div style={{ marginTop:10, borderTop:"1px solid " + th.border, paddingTop:8 }}>
                {rating.notes.map(function(n, i) { return <div key={i} style={{ fontSize:12, color:th.white, marginBottom:3 }}>{n}</div>; })}
              </div>
            )}
            {tip ? <div style={{ marginTop:8, fontSize:12, color:th.green, fontStyle:"italic" }}>💡 {tip}</div> : null}
            <div style={{ fontSize:10, color:th.muted, marginTop:6 }}>
              <span style={{ color:th.green, cursor:"pointer" }} onClick={load}>↻ Refresh conditions</span>
            </div>
          </div>
        ) : (
          <div style={{ color:th.red, fontSize:13 }}>
            Weather unavailable. <span style={{ color:th.green, cursor:"pointer" }} onClick={load}>Retry</span>
          </div>
        )}
      </Card>

      {nearSpot && !loading ? (
        <Card T={T} borderColor={th.blue + "55"}>
          <SecLabel text="Nearest water" T={T} />
          <div style={{ fontSize:15, color:th.white, fontWeight:700 }}>{nearSpot.name}</div>
          <div style={{ fontSize:12, color:th.muted, marginTop:4 }}>{nearDist} mi · {nearSpot.waterType}</div>
          <div style={{ fontSize:11, color:th.white, marginTop:6 }}>{nearSpot.tip}</div>
        </Card>
      ) : null}

      {myPrivateSpots.length > 0 && !loading ? (
        <Card T={T} borderColor={th.green + "66"}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <SecLabel text={"Your spots (" + myPrivateSpots.length + ")"} T={T} />
            {setTab ? <button type="button" onClick={function() { setTab("spots"); }} style={{ background:"transparent", border:"none", color:th.blue, cursor:"pointer", fontSize:12, padding:0 }}>View all →</button> : null}
          </div>
          {nearestPrivateSorted.slice(0, 3).map(function(item) {
            var s = item.spot;
            var sp = s.species_present && s.species_present.length ? s.species_present[0] : null;
            var bait = sp ? speciesBaitTips(sp, season)[0] : null;
            return (
              <div key={s.id} style={{ marginBottom:10, paddingBottom:10, borderBottom:"1px solid " + th.border }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ fontSize:14, color:th.white, fontWeight:700 }}>📍 {s.name}</div>
                  <div style={{ fontSize:11, color:th.green, fontWeight:700, flexShrink:0, marginLeft:8 }}>{item.dist.toFixed(1)} mi</div>
                </div>
                {s.species_present && s.species_present.length > 0 ? (
                  <div style={{ fontSize:11, color:th.muted, marginTop:3 }}>{s.species_present.slice(0, 3).join(" · ")}</div>
                ) : null}
                {bait ? (
                  <div style={{ fontSize:11, color:th.gold, marginTop:4 }}>Try: {bait.name} — {bait.why}</div>
                ) : null}
              </div>
            );
          })}
          {setTab ? <button type="button" onClick={function() { setTab("spots"); }} style={{ width:"100%", background:th.green + "22", border:"1px solid " + th.green + "55", borderRadius:8, padding:"8px 0", cursor:"pointer", fontSize:12, color:th.green, fontWeight:700 }}>Go to My Spots</button> : null}
        </Card>
      ) : null}

      {profile && profile.level === "Beginner" ? (
        <Card T={T} borderColor={th.green + "44"}>
          <div style={{ fontSize:14, color:th.white, fontWeight:700, marginBottom:6 }}>New to fishing? Start here</div>
          <div style={{ fontSize:12, color:th.muted, lineHeight:1.5, marginBottom:10 }}>Pick a species above, check the bite score, then open Learn for gear basics.</div>
          {setTab ? <button type="button" onClick={function() { setTab("learn"); }} style={{ background:th.green, color:"#000", border:"none", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:700 }}>Open Learn tab →</button> : null}
        </Card>
      ) : null}

      <Card T={T}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <SecLabel text="Fishing Articles" T={T} />
          <OBtn label={expandArticles ? "My Species" : "All Topics"} onClick={function() { setExpandArticles(function(e) { return !e; }); }} color={th.green} style={{ fontSize:10, padding:"3px 8px" }} />
        </div>
        {articles.map(function(a, i) {
          return (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none", borderBottom:"1px solid " + th.border, paddingBottom:8, marginBottom:8 }}>
              <div style={{ fontSize:13, color:th.white, fontWeight:600 }}>{a.title}</div>
              <div style={{ display:"flex", gap:6, marginTop:3 }}>
                <span style={{ fontSize:10, color:th.muted }}>{a.source}</span>
                <Pill label={a.species} color={th.green} />
              </div>
            </a>
          );
        })}
      </Card>
      </>
      )}
    </div>
  );
}

// ─── SPECIES TAB ──────────────────────────────────────────────────────────────
function SpeciesTab({ T, profile, setTab }) {
  const th = THEMES[T];
  const [sel, setSel] = useState(null);
  const [subTab, setSubTab] = useState("rigs");
  const [speciesPhotoFailed, setSpeciesPhotoFailed] = useState(false);

  useEffect(function() {
    setSpeciesPhotoFailed(false);
  }, [sel && sel.id]);

  if (sel) {
    var sp = sel;
    var speciesPhotoUrl = SPECIES_PHOTO_BY_ID[sp.id];
    return (
      <div>
        <OBtn label="Back" onClick={function() { setSel(null); }} color={th.green} style={{ margin:"12px 0 10px" }} />
        {speciesPhotoUrl && !speciesPhotoFailed ? (
          <div style={{ marginBottom:14 }}>
            <img
              src={speciesPhotoUrl}
              alt={sp.name}
              loading="lazy"
              decoding="async"
              onError={function() { setSpeciesPhotoFailed(true); }}
              style={{ width:"100%", maxHeight:240, objectFit:"cover", borderRadius:12, border:"1px solid " + th.border, display:"block", background:th.card }}
            />
            <div style={{ fontSize:10, color:th.muted, marginTop:8, lineHeight:1.45 }}>
              Photo:{" "}
              <a href={speciesPhotoUrl} target="_blank" rel="noopener noreferrer" style={{ color:th.blue }}>
                Wikimedia Commons
              </a>
              {" "}(species ID photo — compare to your catch before keeping fish).
            </div>
          </div>
        ) : null}
        <div style={{ borderLeft:"3px solid " + sp.color, paddingLeft:12, marginBottom:14 }}>
          <div style={{ fontSize:36 }}>{sp.emoji}</div>
          <div style={{ fontSize:21, color:th.white, fontWeight:700, marginTop:4 }}>{sp.name}</div>
          <div style={{ fontSize:11, color:sp.color, fontFamily:"monospace" }}>{sp.season} · {sp.bestTime}</div>
          <div style={{ fontSize:11, color:th.muted, marginTop:2 }}>{sp.habitat}</div>
        </div>
        {sp.alert ? <div style={{ background:th.orange + "22", border:"1px solid " + th.orange + "44", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:th.orange }}>⚠️ {sp.alert}</div> : null}
        {speciesAlsoKnownAs(sp.name) ? <div style={{ fontSize:11, color:th.muted, marginBottom:10 }}>Also known as: {speciesAlsoKnownAs(sp.name)}</div> : null}
        <Card T={T} borderColor={th.blue + "44"}>
          <SecLabel text="Compare to your catch" T={T} />
          {["Right number of fins and tail shape?","Color pattern matches this species?","Size fits typical range for local water?"].map(function(q, i) {
            return <div key={i} style={{ fontSize:12, color:th.white, marginBottom:6 }}>☐ {q}</div>;
          })}
        </Card>
        <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"wrap" }}>
          {["rigs","bait","line","hookset","tips"].map(function(t) {
            return (
              <button key={t} onClick={function() { setSubTab(t); }} style={{ background:subTab===t ? sp.color + "33" : "transparent", border:"1px solid " + (subTab===t ? sp.color : th.border), borderRadius:7, color:subTab===t ? sp.color : th.muted, padding:"6px 10px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
                {t.toUpperCase()}
              </button>
            );
          })}
        </div>
        {subTab === "rigs" && (
          <div>
            {sp.rigs.map(function(r, i) {
              var cat = findCatalogueForRig(r.name);
              return (
                <Card key={i} T={T}>
                  <div style={{ fontWeight:700, color:th.green, fontSize:13, marginBottom:4 }}>{r.name}</div>
                  <div style={{ fontSize:12, color:th.white, marginBottom:6, lineHeight:1.45 }}>{cat ? cat.what.slice(0, 120) + "…" : "Standard setup for " + sp.name + "."}</div>
                  <div style={{ fontSize:11, color:th.muted, fontFamily:"monospace" }}>{r.setup}</div>
                  {cat && setTab ? (
                    <button type="button" onClick={function() { setTab("catalogue"); }} style={{ marginTop:8, background:"transparent", border:"none", color:th.blue, cursor:"pointer", fontSize:12, padding:0, textDecoration:"underline" }}>See {cat.name} in Tackle →</button>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
        {subTab === "bait" && (
          <Card T={T}>
            {sp.bait.map(function(b, i) {
              return <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}><span style={{ color:sp.color }}>•</span><span style={{ fontSize:13, color:th.white }}>{b}</span></div>;
            })}
          </Card>
        )}
        {subTab === "line" && (
          <Card T={T}>
            <div style={{ fontSize:13, color:th.white, marginBottom:8 }}>Main: {sp.line.main}</div>
            <div style={{ fontSize:13, color:th.white }}>Leader: {sp.line.leader}</div>
          </Card>
        )}
        {subTab === "hookset" && (
          <Card T={T} borderColor={th.red + "44"}>
            <SecLabel text="How to Set the Hook" T={T} />
            <div style={{ fontSize:13, color:th.white, lineHeight:1.8 }}>{sp.hookSet}</div>
          </Card>
        )}
        {subTab === "tips" && (
          <Card T={T}>
            <div style={{ fontSize:13, color:th.white, lineHeight:1.8 }}>{sp.tips}</div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <SecLabel text="Tap a Fish for Full Details" T={T} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
        {SPECIES.slice().sort(function(a, b) {
          if (!profile || profile.level !== "Beginner") return 0;
          var ab = (a.level || "").indexOf("Beginner") >= 0 ? 0 : 1;
          var bb = (b.level || "").indexOf("Beginner") >= 0 ? 0 : 1;
          return ab - bb;
        }).map(function(sp) {
          return (
            <button key={sp.id} onClick={function() { setSel(sp); setSubTab("rigs"); }} style={{ background:th.card, border:"1px solid " + sp.color + "44", borderLeft:"3px solid " + sp.color, borderRadius:10, padding:"12px 10px", cursor:"pointer", textAlign:"left", color:th.white }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{sp.emoji}</div>
              <div style={{ fontWeight:700, fontSize:13, color:th.white }}>{sp.name}</div>
              <div style={{ fontSize:10, color:sp.color, marginTop:2 }}>{sp.season}</div>
              <div style={{ fontSize:10, color:th.muted, marginTop:1 }}>{sp.level}</div>
              {sp.alert ? <div style={{ fontSize:9, color:th.orange, marginTop:3 }}>⚠ See notes</div> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SPOTS TAB ────────────────────────────────────────────────────────────────
function SpotsTab({ profile, setProfile, T, spotsOpenSection, clearSpotsOpenSection, clubRoster, authMember, onMarkClubSpotsSeen }) {
  const th = THEMES[T];
  const [view, setView] = useState("local");
  const [clubSharedSpots, setClubSharedSpots] = useState([]);
  const [clubSpotsLoading, setClubSpotsLoading] = useState(false);
  const [selectedLake, setSelectedLake] = useState(null);
  const [lakeTab, setLakeTab] = useState("overview");
  const [privView, setPrivView] = useState("main");
  const [privSpotId, setPrivSpotId] = useState(null);
  const [saveDraft, setSaveDraft] = useState(null);
  const [saveErr, setSaveErr] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoErr, setGeoErr] = useState("");
  const [pastManualLat, setPastManualLat] = useState("");
  const [pastManualLng, setPastManualLng] = useState("");
  const [pastMapsPaste, setPastMapsPaste] = useState("");
  const [pastMapsParseMsg, setPastMapsParseMsg] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [pickCenter, setPickCenter] = useState({ lat:41.84, lng:-87.83 });
  const [pickPin, setPickPin] = useState(null);
  const [pickName, setPickName] = useState("");
  const [pickShare, setPickShare] = useState(false);
  const [pickPinHome, setPickPinHome] = useState(false);
  const [pickBackTo, setPickBackTo] = useState("my");
  const favSpots = (profile && profile.favSpots) || [];
  const mySpots = (profile && profile.privateSpots) || [];

  useEffect(function() {
    if (privView !== "club") return;
    if (typeof onMarkClubSpotsSeen === "function") onMarkClubSpotsSeen();
    if (!authMember) {
      setClubSharedSpots([]);
      return;
    }
    setClubSpotsLoading(true);
    loadClubSharedSpots().then(function(rows) {
      setClubSharedSpots(rows || []);
    }).catch(function() {
      setClubSharedSpots([]);
    }).finally(function() {
      setClubSpotsLoading(false);
    });
  }, [privView, authMember ? authMember.id : null]);

  useEffect(function() {
    if (spotsOpenSection === "my_spots") {
      setPrivView("my");
      setPrivSpotId(null);
      if (typeof clearSpotsOpenSection === "function") clearSpotsOpenSection();
    }
  }, [spotsOpenSection, clearSpotsOpenSection]);

  useEffect(function() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var now = Date.now();
        var pts = pruneTrailPoints(loadLocationTrail(), now);
        pts.push({ t:now, lat:pos.coords.latitude, lng:pos.coords.longitude });
        if (pts.length > 200) pts = pts.slice(-200);
        saveLocationTrail(pts);
      },
      function() {},
      { enableHighAccuracy:false, maximumAge:120000, timeout:15000 }
    );
  }, []);

  function toggleFav(name) {
    var updated = favSpots.includes(name) ? favSpots.filter(function(s) { return s !== name; }) : favSpots.concat([name]);
    setProfile(function(p) { return Object.assign({}, p, { favSpots:updated }); });
  }

  function openPickMap(centerLat, centerLng, pin, defaultName, backTo) {
    setSaveErr("");
    setPickCenter({ lat:centerLat || 41.84, lng:centerLng || -87.83 });
    setPickPin(pin || null);
    setPickName(defaultName || "");
    setPickShare(false);
    setPickBackTo(backTo || "my");
    setPrivView("pickmap");
  }

  function closePickMap() {
    setSaveErr("");
    setPickPin(null);
    setPickName("");
    setPickShare(false);
    setPrivView(pickBackTo === "main" ? "main" : "my");
  }

  function saveFromPickMap() {
    setSaveErr("");
    if (!pickPin) {
      setSaveErr("Tap the map to drop a pin first.");
      return;
    }
    var draft = {
      name:pickName.trim() || "My spot",
      lat:pickPin.lat,
      lng:pickPin.lng,
      notes:"",
      species_present:[],
      access_info:"",
      shareClub:!!pickShare,
      sharedWith:[],
      pinHome:!!pickPinHome,
    };
    var res = savePrivateSpotFull(setProfile, draft, null);
    if (res.error) {
      setSaveErr(res.error);
      return;
    }
    if (pickShare) {
      appendSpotActivity(setProfile, "Saved and shared " + sanitizeStr(draft.name, 120) + " with the club");
    }
    setPickPin(null);
    setPickName("");
    setPickShare(false);
    setPickPinHome(false);
    setPrivView("my");
  }

  function startPickMapHere() {
    setGeoErr("");
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoLoading(false);
      openPickMap(41.84, -87.83, null, "", "my");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        setGeoLoading(false);
        var la = pos.coords.latitude;
        var ln = pos.coords.longitude;
        openPickMap(la, ln, { lat:la, lng:ln }, "", "my");
      },
      function() {
        setGeoLoading(false);
        setGeoErr("GPS off — pan the map and tap to drop a pin.");
        openPickMap(41.84, -87.83, null, "", "my");
      },
      { enableHighAccuracy:true, maximumAge:60000, timeout:20000 }
    );
  }

  function openSaveWithCoords(lat, lng) {
    openPickMap(lat, lng, { lat:lat, lng:lng }, "", pickBackTo || "my");
  }

  function startSaveCurrentGps() {
    startPickMapHere();
  }

  function getPastClusters() {
    var now = Date.now();
    var pts = pruneTrailPoints(loadLocationTrail(), now);
    return clusterTrailPoints(pts, 3);
  }

  function submitSaveForm() {
    setSaveErr("");
    var res = savePrivateSpotFull(setProfile, saveDraft, privSpotId);
    if (res.error) {
      setSaveErr(res.error);
      return;
    }
    setPrivView("my");
    setPrivSpotId(null);
    setSaveDraft(null);
  }

  function setDraftField(k, v) {
    setSaveDraft(function(d) {
      if (!d) return d;
      var n = Object.assign({}, d);
      n[k] = v;
      return n;
    });
  }

  function toggleSpeciesSpecies(name) {
    setSaveDraft(function(d) {
      if (!d) return d;
      var arr = (d.species_present || []).slice();
      var i = arr.indexOf(name);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(name);
      return Object.assign({}, d, { species_present:arr });
    });
  }

  function openEditSpot(id) {
    var s = mySpots.find(function(x) { return x.id === id; });
    if (!s) return;
    setSaveDraft({
      name:s.name,
      lat:s.lat,
      lng:s.lng,
      notes:s.notes || "",
      species_present:(s.species_present || []).slice(),
      access_info:s.access_info || "",
      shareClub:!!s.shareClub,
      sharedWith:(s.sharedWith || []).slice(),
    });
    setPrivSpotId(s.id);
    setSaveErr("");
    setPrivView("save");
  }

  var selectedSpot = privSpotId ? mySpots.find(function(s) { return s.id === privSpotId; }) : null;

  function toggleShareClub() {
    if (!selectedSpot) return;
    var next = !selectedSpot.shareClub;
    var d = formatLongShareDate(new Date().toISOString());
    patchPrivateSpot(setProfile, selectedSpot.id, { shareClub:next });
    appendSpotActivity(
      setProfile,
      next
        ? ("Shared " + sanitizeStr(selectedSpot.name, 120) + " with the club on " + d)
        : ("Removed " + sanitizeStr(selectedSpot.name, 120) + " from the club map on " + d)
    );
  }

  function toggleShareMember(mem) {
    if (!selectedSpot) return;
    var sw = (selectedSpot.sharedWith || []).slice();
    var ix = sw.findIndex(function(m) { return m.id === mem.id; });
    var nextList;
    var msg;
    var d = formatLongShareDate(new Date().toISOString());
    if (ix >= 0) {
      nextList = sw.filter(function(m) { return m.id !== mem.id; });
      msg = ("Stopped sharing " + sanitizeStr(selectedSpot.name, 120) + " with " + mem.name + " on " + d);
    } else {
      nextList = sw.concat([{ id:mem.id, name:mem.name }]);
      msg = ("Shared " + sanitizeStr(selectedSpot.name, 120) + " with " + mem.name + " on " + d);
    }
    patchPrivateSpot(setProfile, selectedSpot.id, { sharedWith:nextList });
    appendSpotActivity(setProfile, msg);
  }

  if (selectedLake) {
    var lake = selectedLake;
    var now2 = new Date(); var mo2 = now2.getMonth();
    var curSeason = mo2 >= 2 && mo2 <= 4 ? "spring" : mo2 >= 5 && mo2 <= 7 ? "summer" : mo2 >= 8 && mo2 <= 10 ? "fall" : "winter";
    var zColors = [THEMES[T].teal, THEMES[T].blue, THEMES[T].indigo];
    var seasonIcons = { spring:"🌱", summer:"☀️", fall:"🍂", winter:"❄️" };
    return (
      <div>
        <OBtn label="← Back to Spots" onClick={function() { setSelectedLake(null); setLakeTab("overview"); }} color={th.green} style={{ margin:"12px 0 10px" }} />
        <div style={{ background:th.green + "18", border:"1px solid " + th.green + "44", borderRadius:12, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:20, color:th.white, fontWeight:700 }}>{lake.name}</div>
          {lake.aka ? <div style={{ fontSize:11, color:th.green, fontFamily:"monospace" }}>{lake.aka}</div> : null}
          <div style={{ fontSize:12, color:th.muted, marginTop:2 }}>{lake.addr} · {lake.dist}</div>
          <div style={{ display:"flex", gap:16, marginTop:10 }}>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:22, color:th.blue, fontWeight:700 }}>{lake.maxDepth}<span style={{ fontSize:12 }}> ft</span></div><div style={{ fontSize:10, color:th.muted, fontFamily:"monospace" }}>MAX DEPTH</div></div>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:22, color:th.teal, fontWeight:700 }}>{lake.avgDepth}<span style={{ fontSize:12 }}> ft</span></div><div style={{ fontSize:10, color:th.muted, fontFamily:"monospace" }}>AVG DEPTH</div></div>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:22, color:th.green, fontWeight:700 }}>{lake.species.length}</div><div style={{ fontSize:10, color:th.muted, fontFamily:"monospace" }}>SPECIES</div></div>
          </div>
          {lake.alert ? <div style={{ fontSize:11, color:th.orange, marginTop:8 }}>⚠️ {lake.alert}</div> : null}
          {lake.stateNote ? <div style={{ fontSize:11, color:th.blue, marginTop:4 }}>ℹ️ {lake.stateNote}</div> : null}
        </div>
        <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"wrap" }}>
          {["overview","depth","spots","season"].map(function(t) {
            return <button key={t} onClick={function() { setLakeTab(t); }} style={{ background:lakeTab===t ? th.green + "33" : "transparent", border:"1px solid " + (lakeTab===t ? th.green : th.border), borderRadius:8, color:lakeTab===t ? th.green : th.muted, padding:"6px 10px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>{t.toUpperCase()}</button>;
          })}
        </div>
        {lakeTab === "overview" && (
          <div>
            <Card T={T} borderColor={th.green + "44"}>
              <SecLabel text="Fishing Briefing — Right Now" T={T} />
              <div style={{ fontSize:13, color:th.white, marginBottom:6 }}>Best species today: <strong style={{ color:th.green }}>{lake.primary}</strong></div>
              <div style={{ fontSize:13, color:th.white, lineHeight:1.7 }}>{lake.season[curSeason]}</div>
            </Card>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <a href={mapsUrl(lake.lat, lake.lng).apple} target="_blank" rel="noopener noreferrer" style={{ flex:1, display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}><div style={{ fontSize:24 }}>🗺️</div><div style={{ fontSize:12, color:th.white, fontWeight:700, marginTop:4 }}>Apple Maps</div></a>
              <a href={mapsUrl(lake.lat, lake.lng).google} target="_blank" rel="noopener noreferrer" style={{ flex:1, display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}><div style={{ fontSize:24 }}>📍</div><div style={{ fontSize:12, color:th.white, fontWeight:700, marginTop:4 }}>Google Maps</div></a>
              <a href={lake.lakelink} target="_blank" rel="noopener noreferrer" style={{ flex:1, display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}><div style={{ fontSize:24 }}>🗺️</div><div style={{ fontSize:12, color:th.blue, fontWeight:700, marginTop:4 }}>LakeLink</div></a>
            </div>
          </div>
        )}
        {lakeTab === "depth" && (
          <div>
            {lake.zones.map(function(z, i) {
              return (
                <Card key={i} T={T}>
                  <div style={{ fontWeight:700, color:zColors[i], fontSize:13, marginBottom:2 }}>{z.depth}</div>
                  <div style={{ fontSize:11, color:th.muted, marginBottom:6 }}>{z.loc}</div>
                  <div style={{ width:"100%", height:8, background:th.border, borderRadius:4, overflow:"hidden", marginBottom:6 }}><div style={{ width:((i + 1) * 33) + "%", height:"100%", background:zColors[i], borderRadius:4 }} /></div>
                  <div style={{ fontSize:12, color:th.white }}>💡 {z.tip}</div>
                </Card>
              );
            })}
            <a href={lake.lakelink} target="_blank" rel="noopener noreferrer" style={{ display:"block", background:th.blue + "18", border:"1px solid " + th.blue + "44", borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}><div style={{ fontSize:13, color:th.blue, fontWeight:700 }}>View Full Contour Map on LakeLink</div></a>
          </div>
        )}
        {lakeTab === "spots" && (
          <div>
            {lake.bankSpots.map(function(s, i) {
              return <Card key={i} T={T} style={{ borderLeft:"3px solid " + th.green }}><div style={{ fontWeight:700, color:th.green, fontSize:13, marginBottom:4 }}>📌 {s.name}</div><div style={{ fontSize:13, color:th.white, lineHeight:1.7 }}>{s.tip}</div></Card>;
            })}
          </div>
        )}
        {lakeTab === "season" && (
          <div>
            {Object.entries(lake.season).map(function(entry) {
              var s = entry[0], tip = entry[1];
              return <Card key={s} T={T} borderColor={s === curSeason ? th.green : undefined}><div style={{ fontWeight:700, color:s === curSeason ? th.green : th.white, fontSize:13, marginBottom:4 }}>{seasonIcons[s]} {s.charAt(0).toUpperCase() + s.slice(1)}{s === curSeason ? " ← NOW" : ""}</div><div style={{ fontSize:13, color:th.white, lineHeight:1.7 }}>{tip}</div></Card>;
            })}
          </div>
        )}
      </div>
    );
  }

  if (privView === "pickmap") {
    var pickInp = { width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"9px 12px", color:th.white, fontSize:13, boxSizing:"border-box", outline:"none", marginBottom:10 };
    return (
      <div>
        <OBtn label="← Back" onClick={closePickMap} color={th.green} style={{ margin:"12px 0 10px" }} />
        <div style={{ fontSize:15, color:th.white, fontWeight:700, marginBottom:6 }}>Tap the map to place a pin</div>
        <div style={{ fontSize:12, color:th.muted, marginBottom:8 }}>Pan and zoom, then tap where you fish. Pin stays in the app.</div>
        <SpotMapPicker
          centerLat={pickCenter.lat}
          centerLng={pickCenter.lng}
          pinLat={pickPin ? pickPin.lat : null}
          pinLng={pickPin ? pickPin.lng : null}
          onPick={function(lat, lng) { setPickPin({ lat:lat, lng:lng }); setSaveErr(""); }}
          height={300}
        />
        {pickPin ? (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Spot name</div>
            <input value={pickName} onChange={function(e) { setPickName(e.target.value); }} placeholder="e.g. Busse south cove" style={pickInp} />
            <div style={{ fontSize:12, color:th.muted, marginBottom:6 }}>Keep private or share?</div>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <button type="button" onClick={function() { setPickShare(false); }} style={{ flex:1, background:!pickShare ? th.green + "33" : "transparent", border:"1px solid " + (!pickShare ? th.green : th.border), borderRadius:8, color:!pickShare ? th.green : th.muted, padding:"10px", cursor:"pointer", fontSize:12, fontWeight:!pickShare ? 700 : 400 }}>Private</button>
              <button type="button" onClick={function() { setPickShare(true); }} style={{ flex:1, background:pickShare ? th.gold + "33" : "transparent", border:"1px solid " + (pickShare ? th.gold : th.border), borderRadius:8, color:pickShare ? th.gold : th.muted, padding:"10px", cursor:"pointer", fontSize:12, fontWeight:pickShare ? 700 : 400 }}>Share with club</button>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, cursor:"pointer", background:pickPinHome ? th.blue + "18" : "transparent", border:"1px solid " + (pickPinHome ? th.blue : th.border), borderRadius:8, padding:"10px 12px" }}>
              <input type="checkbox" checked={!!pickPinHome} onChange={function(e) { setPickPinHome(e.target.checked); }} />
              <div>
                <div style={{ fontSize:12, color:pickPinHome ? th.blue : th.white, fontWeight:700 }}>Show on home page</div>
                <div style={{ fontSize:10, color:th.muted, marginTop:1 }}>Appears under RFC Bite Forecast with fishing tips</div>
              </div>
            </label>
            {saveErr ? <div style={{ color:th.red, fontSize:12, marginBottom:8 }}>{saveErr}</div> : null}
            <button type="button" onClick={saveFromPickMap} style={{ width:"100%", background:th.green, color:"#081208", border:"none", borderRadius:10, padding:"14px 0", cursor:"pointer", fontSize:15, fontWeight:800 }}>
              Save my spot
            </button>
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <a href={mapsUrl(pickPin.lat, pickPin.lng).google} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", fontSize:11, color:th.muted, textDecoration:"underline" }}>Open in Google Maps</a>
              <a href={mapsUrl(pickPin.lat, pickPin.lng).apple} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", fontSize:11, color:th.muted, textDecoration:"underline" }}>Open in Apple Maps</a>
            </div>
          </div>
        ) : (
          <div style={{ fontSize:12, color:th.muted, marginTop:10, textAlign:"center" }}>No pin yet — tap the map above.</div>
        )}
      </div>
    );
  }

  if (privView === "save" && saveDraft) {
    var inp = { width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"9px 12px", color:th.white, fontSize:13, boxSizing:"border-box", outline:"none", marginBottom:10 };
    return (
      <div>
        <OBtn label="Back" onClick={function() { setSaveErr(""); if (privSpotId) setPrivView("detail"); else setPrivView("main"); setSaveDraft(null); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:19, color:th.white, fontWeight:800, marginBottom:8 }}>{privSpotId ? "Edit your spot" : "Name your fishing spot"}</div>
        <p style={{ fontSize:13, color:th.muted, margin:"0 0 12px", lineHeight:1.5 }}>Give it a name you will recognize later. Coordinates fill in automatically — you can adjust them if needed.</p>
        <Card T={T}>
          <SecLabel text="Basics" T={T} />
          <div style={{ fontSize:13, color:th.muted, marginBottom:6 }}>Spot name</div>
          <input value={saveDraft.name} onChange={function(e) { setDraftField("name", e.target.value); }} placeholder="e.g. Busse south cove" style={inp} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <div style={{ fontSize:11, color:th.muted, marginBottom:4 }}>Latitude</div>
              <input value={String(saveDraft.lat)} onChange={function(e) { setDraftField("lat", e.target.value); }} style={inp} />
            </div>
            <div>
              <div style={{ fontSize:11, color:th.muted, marginBottom:4 }}>Longitude</div>
              <input value={String(saveDraft.lng)} onChange={function(e) { setDraftField("lng", e.target.value); }} style={inp} />
            </div>
          </div>
        </Card>
        <Card T={T}>
          <SecLabel text="Species present" T={T} />
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {SPECIES.map(function(sp) {
              var on = (saveDraft.species_present || []).indexOf(sp.name) >= 0;
              return (
                <button key={sp.id} type="button" onClick={function() { toggleSpeciesSpecies(sp.name); }} style={{ background:on ? sp.color + "33" : "transparent", border:"1px solid " + (on ? sp.color : th.border), borderRadius:20, color:on ? sp.color : th.muted, padding:"5px 10px", cursor:"pointer", fontSize:11 }}>
                  {sp.emoji} {sp.name}
                </button>
              );
            })}
          </div>
        </Card>
        <Card T={T}>
          <SecLabel text="Notes" T={T} />
          <textarea value={saveDraft.notes} onChange={function(e) { setDraftField("notes", e.target.value); }} placeholder="What worked, structure, depth…" rows={3} style={Object.assign({}, inp, { minHeight:72, resize:"vertical" })} />
        </Card>
        <Card T={T}>
          <SecLabel text="Access (parking, trail, shore vs boat)" T={T} />
          <textarea value={saveDraft.access_info} onChange={function(e) { setDraftField("access_info", e.target.value); }} placeholder="Where to park, path in, bank vs wading…" rows={3} style={Object.assign({}, inp, { minHeight:72, resize:"vertical" })} />
        </Card>
        {saveErr ? <div style={{ color:th.red, fontSize:12, marginBottom:10 }}>{saveErr}</div> : null}
        <button type="button" onClick={submitSaveForm} style={{ width:"100%", background:th.green, color:"#081208", border:"none", borderRadius:12, padding:"16px 0", cursor:"pointer", fontSize:17, fontWeight:800 }}>
          {privSpotId ? "Save changes" : "Save to my spots"}
        </button>
        <div style={{ fontSize:12, color:th.muted, marginTop:12, lineHeight:1.55 }}>Stays private until you choose sharing from your spot details.</div>
      </div>
    );
  }

  if (privView === "past") {
    var clusters = getPastClusters();
    return (
      <div>
        <OBtn label="Back to spots" onClick={function() { setPrivView("main"); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:19, color:th.white, fontWeight:800, marginBottom:8 }}>Save without GPS here</div>
        <p style={{ fontSize:13, color:th.muted, margin:"0 0 12px", lineHeight:1.55 }}>Pick a recent point from this device or type numbers — good when GPS is off or you are entering an old spot.</p>
        <Card T={T} borderColor={th.green + "44"}>
          <SecLabel text="Paste Google Maps link or coordinates" T={T} />
          <input
            value={pastMapsPaste}
            onChange={function(e) {
              setPastMapsPaste(e.target.value);
              setPastMapsParseMsg("");
            }}
            placeholder="Paste long Maps URL or two numbers: 41.826, -87.845"
            style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"11px 12px", color:th.white, fontSize:14, boxSizing:"border-box", marginBottom:10 }}
          />
          <button
            type="button"
            onClick={function() {
              setPastMapsParseMsg("");
              var ex = extractLatLngFromMapsText(pastMapsPaste);
              if (ex) {
                setPastManualLat(String(ex.lat));
                setPastManualLng(String(ex.lng));
                setPastMapsParseMsg("Coordinates filled below. Tap “Use these coordinates”.");
                return;
              }
              if (/goo\.gl|maps\.app\.goo\.gl/i.test(pastMapsPaste)) {
                setPastMapsParseMsg("Short links cannot be read here. Open the link in your browser, copy the long URL from the address bar, paste again.");
                return;
              }
              setPastMapsParseMsg("Could not find latitude and longitude. Use a Maps URL that contains @lat,lng or paste two numbers with a comma.");
            }}
            style={{ width:"100%", background:th.green, color:"#081208", border:"none", borderRadius:10, padding:"12px 0", cursor:"pointer", fontSize:15, fontWeight:800, marginBottom:8 }}
          >
            Fill latitude &amp; longitude from paste
          </button>
          {pastMapsParseMsg ? <div style={{ fontSize:13, color:pastMapsParseMsg.indexOf("filled") >= 0 ? th.green : th.orange, lineHeight:1.45 }}>{pastMapsParseMsg}</div> : null}
          <div style={{ fontSize:12, color:th.muted, marginTop:10, lineHeight:1.5 }}>
            Tip: Short share links often need one open in the browser — then paste the full URL from the address bar.
          </div>
        </Card>
        <Card T={T} borderColor={th.blue + "44"}>
          <div style={{ fontSize:12, color:th.white, lineHeight:1.7 }}>
            iPhone Significant Locations and Google Location History are not available to websites. This app only reads <strong style={{ color:th.green }}>a simple trail you collect here</strong> (GPS points while you use Spots) — it stays on your phone until you save a spot.
          </div>
        </Card>
        <Card T={T}>
          <SecLabel text="Recent clusters (last 48h, this device)" T={T} />
          {clusters.length === 0 ? (
            <div style={{ fontSize:12, color:th.muted }}>No trail yet. Move with the app open to build points, or use manual entry below.</div>
          ) : (
            clusters.map(function(c, i) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={function() {
                    if (window.confirm("Save a spot at " + c.lat.toFixed(5) + ", " + c.lng.toFixed(5) + "?")) openSaveWithCoords(c.lat, c.lng);
                  }}
                  style={{ width:"100%", textAlign:"left", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10, marginBottom:8, cursor:"pointer", color:th.white }}
                >
                  <div style={{ fontSize:13, fontWeight:700 }}>📍 Area · {c.count} point{c.count !== 1 ? "s" : ""}</div>
                  <div style={{ fontSize:11, color:th.muted, fontFamily:"monospace", marginTop:2 }}>{c.lat.toFixed(5)}, {c.lng.toFixed(5)}</div>
                  <div style={{ fontSize:10, color:th.green, marginTop:4 }}>Tap to use these coordinates →</div>
                </button>
              );
            })
          )}
        </Card>
        <Card T={T}>
          <SecLabel text="Or enter coordinates manually" T={T} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <input value={pastManualLat} onChange={function(e) { setPastManualLat(e.target.value); }} placeholder="Latitude" style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"9px 10px", color:th.white, fontSize:13, boxSizing:"border-box" }} />
            <input value={pastManualLng} onChange={function(e) { setPastManualLng(e.target.value); }} placeholder="Longitude" style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"9px 10px", color:th.white, fontSize:13, boxSizing:"border-box" }} />
          </div>
          <button
            type="button"
            onClick={function() {
              var la = parseCoordNum(pastManualLat);
              var ln = parseCoordNum(pastManualLng);
              if (!isFinite(la) || !isFinite(ln)) {
                alert("Enter valid latitude and longitude numbers.");
                return;
              }
              openSaveWithCoords(la, ln);
            }}
            style={{ width:"100%", marginTop:10, background:th.blue, color:"#fff", border:"none", borderRadius:8, padding:"10px 0", cursor:"pointer", fontSize:13, fontWeight:700 }}
          >
            Use these coordinates
          </button>
        </Card>
        <Card T={T}>
          <SecLabel text="Pick from a map" T={T} />
          <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" style={{ display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:12, textAlign:"center", textDecoration:"none", color:th.blue, fontWeight:700, fontSize:13 }}>
            Open Google Maps — long-press to copy coords, paste above
          </a>
        </Card>
      </div>
    );
  }

  if (privView === "detail" && selectedSpot) {
    var rosterF = (clubRoster || []).filter(function(m) {
      return !memberSearch || m.name.toLowerCase().indexOf(memberSearch.toLowerCase()) >= 0;
    });
    var shareLabel = selectedSpot.shareClub ? "Shared with Club" : (selectedSpot.sharedWith && selectedSpot.sharedWith.length ? "Shared with " + selectedSpot.sharedWith.map(function(m) { return m.name; }).join(", ") : "Private");
    return (
      <div>
        <OBtn label="Back" onClick={function() { setPrivView("my"); setPrivSpotId(null); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:17, color:th.white, fontWeight:700, marginBottom:6 }}>{selectedSpot.name}</div>
        <div style={{ fontSize:11, color:th.gold, marginBottom:12 }}>{shareLabel}</div>
        <div style={{ marginBottom:12 }}><SpotMapThumb lat={selectedSpot.lat} lng={selectedSpot.lng} height={200} zoom={15} /></div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <a href={mapsUrl(selectedSpot.lat, selectedSpot.lng).google} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10, textDecoration:"none", color:th.blue, fontSize:12, fontWeight:700 }}>Google Maps</a>
          <a href={mapsUrl(selectedSpot.lat, selectedSpot.lng).apple} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10, textDecoration:"none", color:th.green, fontSize:12, fontWeight:700 }}>Apple Maps</a>
        </div>
        <Card T={T}>
          <SecLabel text="Coordinates" T={T} />
          <div style={{ fontSize:12, color:th.white, fontFamily:"monospace" }}>{selectedSpot.lat.toFixed(6)}, {selectedSpot.lng.toFixed(6)}</div>
        </Card>
        {selectedSpot.species_present && selectedSpot.species_present.length ? (
          <Card T={T}>
            <SecLabel text="Species" T={T} />
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {selectedSpot.species_present.map(function(nm) { return <Pill key={nm} label={nm} color={th.green} />; })}
            </div>
          </Card>
        ) : null}
        {selectedSpot.notes ? (
          <Card T={T}><SecLabel text="Notes" T={T} /><div style={{ fontSize:13, color:th.white, lineHeight:1.7 }}>{selectedSpot.notes}</div></Card>
        ) : null}
        {selectedSpot.access_info ? (
          <Card T={T}><SecLabel text="Access" T={T} /><div style={{ fontSize:13, color:th.white, lineHeight:1.7 }}>{selectedSpot.access_info}</div></Card>
        ) : null}
        <Card T={T}>
          <SecLabel text="Sharing" T={T} />
          <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, cursor:"pointer" }}>
            <input type="checkbox" checked={!!selectedSpot.shareClub} onChange={toggleShareClub} />
            <span style={{ fontSize:13, color:th.white }}>Share with Club (club map)</span>
          </label>
          <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, cursor:"pointer", background:selectedSpot.pinHome ? th.blue + "18" : "transparent", border:"1px solid " + (selectedSpot.pinHome ? th.blue : th.border), borderRadius:8, padding:"8px 10px" }}>
            <input type="checkbox" checked={!!selectedSpot.pinHome} onChange={function(e) { setPinHomeSpot(setProfile, selectedSpot.id, e.target.checked); }} />
            <div>
              <div style={{ fontSize:13, color:selectedSpot.pinHome ? th.blue : th.white, fontWeight:selectedSpot.pinHome ? 700 : 400 }}>Show on home page</div>
              <div style={{ fontSize:10, color:th.muted }}>Pins this spot under RFC Bite Forecast — only one at a time</div>
            </div>
          </label>
          <div style={{ fontSize:11, color:th.muted, marginBottom:8 }}>Share with specific members</div>
          <input value={memberSearch} onChange={function(e) { setMemberSearch(e.target.value); }} placeholder="Search roster…" style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"8px 10px", color:th.white, fontSize:12, boxSizing:"border-box", marginBottom:8 }} />
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {rosterF.map(function(m) {
              var on = (selectedSpot.sharedWith || []).some(function(x) { return x.id === m.id; });
              return (
                <button key={m.id} type="button" onClick={function() { toggleShareMember(m); }} style={{ textAlign:"left", background:on ? th.green + "22" : th.card, border:"1px solid " + (on ? th.green : th.border), borderRadius:8, padding:8, color:th.white, cursor:"pointer", fontSize:12 }}>
                  {on ? "✓ " : ""}{m.name}
                </button>
              );
            })}
          </div>
        </Card>
        <button type="button" onClick={function() { openEditSpot(selectedSpot.id); }} style={{ width:"100%", background:th.card, border:"1px solid " + th.border, color:th.white, borderRadius:8, padding:10, cursor:"pointer", fontWeight:700, marginBottom:8 }}>
          Edit spot
        </button>
        <button
          type="button"
          onClick={function() {
            if (window.confirm("Delete this spot permanently?")) {
              deletePrivateSpotById(setProfile, selectedSpot.id);
              setPrivView("my");
              setPrivSpotId(null);
            }
          }}
          style={{ width:"100%", background:"transparent", border:"1px solid " + th.red, color:th.red, borderRadius:8, padding:10, cursor:"pointer", fontWeight:700 }}
        >
          Delete spot
        </button>
      </div>
    );
  }

  if (privView === "mymap") {
    return (
      <div>
        <OBtn label="← Back to my spots" onClick={function() { setPrivView("my"); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:19, color:th.white, fontWeight:800, marginBottom:10 }}>Pictures of each save</div>
        {mySpots.length === 0 ? <Card T={T}><div style={{ fontSize:13, color:th.muted }}>No private spots saved yet.</div></Card> : null}
        {mySpots.map(function(s) {
          return (
            <Card key={s.id} T={T}>
              <div style={{ fontWeight:700, color:th.white, marginBottom:6 }}>{s.name}</div>
              <SpotMapThumb lat={s.lat} lng={s.lng} height={160} zoom={15} />
              <OBtn label="Directions" onClick={function() { window.open(mapsUrl(s.lat, s.lng).apple, "_blank"); }} color={th.green} style={{ marginTop:8, fontSize:11 }} />
            </Card>
          );
        })}
      </div>
    );
  }

  if (privView === "club") {
    return (
      <div>
        <OBtn label="← Back to spots" onClick={function() { setPrivView("main"); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:19, color:th.white, fontWeight:800, marginBottom:8 }}>Club shared map</div>
        <div style={{ fontSize:11, color:th.muted, marginBottom:10 }}>Pins shared with the club by all members.</div>
        {!authMember ? (
          <Card T={T}><div style={{ fontSize:13, color:th.muted, lineHeight:1.5 }}>Sign in to see spots other members shared with the club.</div></Card>
        ) : clubSpotsLoading ? (
          <div style={{ fontSize:13, color:th.muted, padding:"16px 0" }}>Loading club spots…</div>
        ) : clubSharedSpots.length === 0 ? (
          <Card T={T}><div style={{ fontSize:13, color:th.muted }}>No shared pins yet. Save a spot and choose Share with club.</div></Card>
        ) : clubSharedSpots.map(function(s) {
          return (
            <Card key={s.id + "_" + s.memberId} T={T} borderColor={th.green + "44"}>
              <div style={{ fontSize:10, color:th.green, marginBottom:4 }}>Spotted by {s.credit || "Member"}</div>
              <div style={{ fontWeight:700, color:th.white, marginBottom:6 }}>{s.name}</div>
              <SpotMapThumb lat={s.lat} lng={s.lng} height={160} zoom={15} />
              <div style={{ fontSize:11, color:th.muted, marginTop:6 }}>{(s.species_present || []).join(" · ")}</div>
            </Card>
          );
        })}
      </div>
    );
  }

  if (privView === "my") {
    return (
      <div>
        <GuideMyToggle modeGuide={false} />
        <button type="button" disabled={geoLoading} onClick={startPickMapHere} style={{ width:"100%", background:th.green, color:"#081208", border:"none", borderRadius:10, padding:"12px 0", cursor:geoLoading ? "wait" : "pointer", fontSize:15, fontWeight:700, marginBottom:8 }}>
          {geoLoading ? "Finding GPS…" : "📍 Pick on map"}
        </button>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button type="button" onClick={function() { setPickBackTo("my"); setPrivView("past"); }} style={{ flex:1, background:"transparent", border:"1px solid " + th.border, borderRadius:8, padding:"8px", color:th.muted, fontSize:12, cursor:"pointer" }}>Paste coords</button>
          <button type="button" onClick={function() { setPrivView("club"); }} style={{ flex:1, background:"transparent", border:"1px solid " + th.border, borderRadius:8, padding:"8px", color:th.muted, fontSize:12, cursor:"pointer" }}>Club map</button>
        </div>
        {mySpots.length === 0 ? <div style={{ fontSize:13, color:th.muted, marginBottom:12 }}>No saved spots yet.</div> : null}
        {mySpots.map(function(s) {
          return (
            <button
              key={s.id}
              type="button"
              onClick={function() {
                setPrivSpotId(s.id);
                setMemberSearch("");
                setPrivView("detail");
              }}
              style={{ width:"100%", textAlign:"left", background:th.card, border:"1px solid " + th.border, borderRadius:10, overflow:"hidden", marginBottom:8, cursor:"pointer", color:th.white, padding:0 }}
            >
              <SpotMapThumb lat={s.lat} lng={s.lng} height={72} zoom={14} />
              <div style={{ padding:"8px 10px" }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
                <div style={{ fontSize:11, color:th.muted, marginTop:2 }}>{s.shareClub ? "Shared with club" : "Private"}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function SpotCard(props) {
    var s = props.s;
    return (
      <div style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:"10px 12px", marginBottom:8, color:th.white }}>
        <div onClick={function() { openPickMap(s.lat, s.lng, { lat:s.lat, lng:s.lng }, s.name, "main"); }} style={{ cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
              <div style={{ fontSize:11, color:th.muted, marginTop:2 }}>{s.dist}{s.tag ? " · " + s.tag : ""} · tap for map</div>
            </div>
            <button type="button" onClick={function(e) { e.stopPropagation(); toggleFav(s.name); }} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:18, padding:4, flexShrink:0 }}>
              {favSpots.includes(s.name) ? "⭐" : "☆"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function GuideMyToggle(props) {
    var modeGuide = props.modeGuide;
    return (
      <div style={{ display:"flex", gap:6, marginBottom:10 }} role="tablist" aria-label="Guide or my spots">
        <button type="button" role="tab" aria-selected={modeGuide} onClick={function() { setPrivView("main"); setPrivSpotId(null); }} style={{ flex:1, padding:"10px 8px", borderRadius:8, border:"1px solid " + (modeGuide ? th.green : th.border), background:modeGuide ? th.green + "33" : "transparent", color:modeGuide ? th.green : th.muted, fontWeight:700, fontSize:13, cursor:"pointer" }}>
          Guide spots
        </button>
        <button type="button" role="tab" aria-selected={!modeGuide} onClick={function() { setPrivView("my"); setPrivSpotId(null); }} style={{ flex:1, padding:"10px 8px", borderRadius:8, border:"1px solid " + (!modeGuide ? th.green : th.border), background:!modeGuide ? th.green + "33" : "transparent", color:!modeGuide ? th.green : th.muted, fontWeight:700, fontSize:13, cursor:"pointer" }}>
          My spots
        </button>
      </div>
    );
  }

  return (
    <div>
      <GuideMyToggle modeGuide={true} />
      {mySpots.length > 0 ? (
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontSize:13, color:th.green, fontWeight:700 }}>My saved spots ({mySpots.length})</div>
            <button type="button" onClick={function() { setPrivView("my"); }} style={{ background:"transparent", border:"none", color:th.blue, cursor:"pointer", fontSize:12, padding:0 }}>View all →</button>
          </div>
          {mySpots.slice(0, 3).map(function(s) {
            return (
              <button key={s.id} type="button" onClick={function() { setPrivSpotId(s.id); setMemberSearch(""); setPrivView("detail"); }} style={{ width:"100%", textAlign:"left", background:th.card, border:"1px solid " + th.green + "55", borderRadius:10, padding:"10px 12px", marginBottom:6, cursor:"pointer", color:th.white }}>
                <div style={{ fontWeight:700, fontSize:13 }}>📍 {s.name}</div>
                <div style={{ fontSize:11, color:th.muted, marginTop:2 }}>
                  {s.species_present && s.species_present.length ? s.species_present.slice(0, 3).join(", ") : "Tap to view"}
                  {s.shareClub ? " · Shared with club" : ""}
                </div>
              </button>
            );
          })}
          {mySpots.length > 3 ? <button type="button" onClick={function() { setPrivView("my"); }} style={{ background:"transparent", border:"none", color:th.blue, cursor:"pointer", fontSize:12, padding:0, marginTop:2 }}>+{mySpots.length - 3} more →</button> : null}
        </div>
      ) : null}
      {geoErr ? <div style={{ fontSize:12, color:th.orange, marginBottom:10 }}>{geoErr}</div> : null}

      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        <button
          type="button"
          onClick={function() { setView("local"); }}
          style={{
            padding:"10px 14px",
            borderRadius:10,
            border:"2px solid " + (view==="local" ? th.green : th.border),
            background:view==="local" ? th.green + "35" : "transparent",
            color:view==="local" ? th.green : th.muted,
            fontWeight:700,
            fontSize:14,
            cursor:"pointer",
          }}
        >
          Local
        </button>
        <button
          type="button"
          onClick={function() { setView("salmon"); }}
          style={{
            padding:"10px 14px",
            borderRadius:10,
            border:"2px solid " + (view==="salmon" ? th.blue : th.border),
            background:view==="salmon" ? th.blue + "35" : "transparent",
            color:view==="salmon" ? th.blue : th.muted,
            fontWeight:700,
            fontSize:14,
            cursor:"pointer",
          }}
        >
          Salmon trail
        </button>
        <button
          type="button"
          onClick={function() { setView("lakes"); }}
          style={{
            padding:"10px 14px",
            borderRadius:10,
            border:"2px solid " + (view==="lakes" ? th.teal : th.border),
            background:view==="lakes" ? th.teal + "35" : "transparent",
            color:view==="lakes" ? th.teal : th.muted,
            fontWeight:700,
            fontSize:14,
            cursor:"pointer",
          }}
        >
          Lakes 🌊
        </button>
        {favSpots.length > 0 ? (
          <button
            type="button"
            onClick={function() { setView("fav"); }}
            style={{
              padding:"10px 14px",
              borderRadius:10,
              border:"2px solid " + (view==="fav" ? th.gold : th.border),
              background:view==="fav" ? th.gold + "35" : "transparent",
              color:view==="fav" ? th.gold : th.muted,
              fontWeight:700,
              fontSize:14,
              cursor:"pointer",
            }}
          >
            My favorites ⭐
          </button>
        ) : null}
      </div>

      {view === "local" && LOCAL_SPOTS.map(function(s, i) { return <SpotCard key={i} s={s} />; })}
      {view === "lakes" && (
        <LakesTab
          T={T}
          onSelectLake={function(lake) {
            setSelectedLake(lake);
            setLakeTab("overview");
          }}
        />
      )}
      {view === "salmon" && SALMON_SPOTS.map(function(s, i) { return <SpotCard key={i} s={s} salmon />; })}
      {view === "fav" && (
        <div>
          {LOCAL_SPOTS.concat(SALMON_SPOTS).filter(function(s) { return favSpots.includes(s.name); }).map(function(s, i) { return <SpotCard key={i} s={s} />; })}
        </div>
      )}

    </div>
  );
}

// ─── LAKES TAB ────────────────────────────────────────────────────────────────
function LakesTab({ T, onSelectLake }) {
  const th = THEMES[T];
  const [search, setSearch] = useState("");

  var filtered = LAKES.filter(function(l) {
    return !search || l.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search lakes..." style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:"11px 14px", color:th.white, fontSize:14, boxSizing:"border-box", outline:"none", margin:"12px 0 10px" }} />
      <SecLabel text={filtered.length + " Lakes Within 50 Miles"} T={T} />
      {filtered.map(function(lake, i) {
        return (
          <div key={i} onClick={function() { if (typeof onSelectLake === "function") onSelectLake(lake); }} style={{ background:th.card, border:"1px solid " + th.border, borderRadius:12, padding:14, marginBottom:10, cursor:"pointer" }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontWeight:700, color:th.white, fontSize:14 }}>{lake.name}</div>
                {lake.aka ? <div style={{ fontSize:10, color:th.green, fontFamily:"monospace" }}>{lake.aka}</div> : null}
                <div style={{ fontSize:11, color:th.muted }}>{lake.addr} · {lake.dist}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:11, color:th.green, fontFamily:"monospace" }}>{lake.dist}</div>
                <div style={{ fontSize:10, color:th.muted }}>Max {lake.maxDepth} ft</div>
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:8 }}>
              {lake.species.slice(0,4).map(function(s) { return <Pill key={s} label={s} color={th.green} />; })}
            </div>
            <div style={{ fontSize:11, color:th.green, marginTop:6, textAlign:"right" }}>Tap for depth map + briefing →</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CATALOGUE TAB ────────────────────────────────────────────────────────────
function CatalogueTab({ T }) {
  const th = THEMES[T];
  const [cat, setCat] = useState("All");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const [img, setImg] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);

  useEffect(function() {
    if (!sel) return;
    setImg(null);
    setImgLoading(true);
    loadTackleImage(sel.name).then(function(url) {
      setImg(url);
      setImgLoading(false);
    });
  }, [sel]);

  var filtered = CATALOGUE.filter(function(item) {
    var mc = cat === "All" || item.cat === cat;
    var ms = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.what.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  if (sel) {
    return (
      <div>
        <OBtn label="Back" onClick={function() { setSel(null); }} color={th.green} style={{ margin:"12px 0 10px" }} />
        <Card T={T}>
          <div style={{ fontSize:36, marginBottom:6 }}>{sel.emoji}</div>
          <div style={{ fontSize:20, color:th.white, fontWeight:700 }}>{sel.name}</div>
          <div style={{ fontSize:10, color:th.green, fontFamily:"monospace", marginTop:2 }}>{sel.cat.toUpperCase()}</div>
        </Card>

        <div style={{ background:th.card, border:"1px solid " + th.border, borderRadius:12, overflow:"hidden", marginBottom:12, minHeight:180, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {imgLoading && (
            <div style={{ textAlign:"center", padding:24 }}>
              <div style={{ fontSize:32 }}>🔍</div>
              <div style={{ fontSize:12, color:th.muted, marginTop:8 }}>Loading photo...</div>
            </div>
          )}
          {img && !imgLoading && (
            <img src={img} alt={sel.name} style={{ width:"100%", maxHeight:220, objectFit:"contain", display:"block" }} onError={function() { setImg(null); }} />
          )}
          {!img && !imgLoading && (
            <div style={{ textAlign:"center", padding:24 }}>
              <div style={{ fontSize:48 }}>{sel.emoji}</div>
              <a href={"https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(sel.searchQ)} target="_blank" rel="noopener noreferrer" style={{ display:"block", fontSize:12, color:th.blue, marginTop:8 }}>Search Google Images for photo</a>
            </div>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
          <a href={"https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(sel.searchQ)} target="_blank" rel="noopener noreferrer" style={{ display:"block", background:"#1a3a5a", border:"1px solid #2a5a8a", borderRadius:10, padding:14, textDecoration:"none", textAlign:"center" }}>
            <div style={{ fontSize:24 }}>📸</div>
            <div style={{ fontSize:13, color:"#7ab8e8", fontWeight:700, marginTop:4 }}>More Photos</div>
            <div style={{ fontSize:10, color:th.muted, marginTop:2 }}>Google Images</div>
          </a>
          <a href={sel.yt} target="_blank" rel="noopener noreferrer" style={{ display:"block", background:"#3a1a1a", border:"1px solid #8a2a2a", borderRadius:10, padding:14, textDecoration:"none", textAlign:"center" }}>
            <div style={{ fontSize:24 }}>▶️</div>
            <div style={{ fontSize:13, color:"#e87a7a", fontWeight:700, marginTop:4 }}>Watch Tutorial</div>
            <div style={{ fontSize:10, color:th.muted, marginTop:2 }}>YouTube</div>
          </a>
        </div>

        <Card T={T}><SecLabel text="What Is It?" T={T} /><div style={{ fontSize:13, color:th.white, lineHeight:1.8 }}>{sel.what}</div></Card>
        <Card T={T}><SecLabel text="When to Use It" T={T} /><div style={{ fontSize:13, color:th.white, lineHeight:1.8 }}>{sel.when}</div></Card>
        <Card T={T}>
          <SecLabel text="What You Need to Buy" T={T} />
          {sel.parts.map(function(p, i) {
            return <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}><span style={{ color:th.green }}>✓</span><span style={{ fontSize:13, color:th.white }}>{p}</span></div>;
          })}
        </Card>
        <Card T={T} borderColor={th.green + "44"}><SecLabel text="Pro Tip" T={T} /><div style={{ fontSize:13, color:th.white, lineHeight:1.8 }}>{sel.tip}</div></Card>
        <Card T={T}>
          <SecLabel text="Target Species" T={T} />
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {sel.species.map(function(s, i) { return <Pill key={i} label={s} color={th.green} />; })}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search lures, rigs, bait..." style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:"11px 14px", color:th.white, fontSize:14, boxSizing:"border-box", outline:"none", margin:"12px 0 8px" }} />
      <div style={{ overflowX:"auto", whiteSpace:"nowrap", paddingBottom:8, marginBottom:10 }}>
        {CATALOGUE_CATS.map(function(c) {
          return (
            <button key={c} onClick={function() { setCat(c); }} style={{ display:"inline-block", marginRight:6, background:cat===c ? th.green + "33" : "transparent", border:"1px solid " + (cat===c ? th.green : th.border), borderRadius:20, color:cat===c ? th.green : th.muted, padding:"5px 14px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
              {c}
            </button>
          );
        })}
      </div>
      <SecLabel text={filtered.length + " items — tap for photos + tutorial"} T={T} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {filtered.map(function(item) {
          return (
            <button key={item.id} onClick={function() { setSel(item); }} style={{ background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, cursor:"pointer", textAlign:"left", color:th.white }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{item.emoji}</div>
              <div style={{ fontWeight:700, fontSize:13, color:th.white }}>{item.name}</div>
              <div style={{ fontSize:10, color:th.green, fontFamily:"monospace", marginTop:2 }}>{item.cat}</div>
              <div style={{ fontSize:10, color:th.muted, marginTop:4, lineHeight:1.4 }}>{item.species.slice(0,2).join(", ")}</div>
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                <span style={{ fontSize:10, background:"#1a3a5a", color:"#7ab8e8", borderRadius:4, padding:"2px 6px" }}>📸 Photo</span>
                <span style={{ fontSize:10, background:"#3a1a1a", color:"#e87a7a", borderRadius:4, padding:"2px 6px" }}>▶ Video</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── TROPHY SCREEN ────────────────────────────────────────────────────────────
function TrophyScreen({ T, form, photo, estWeightLabel, catchVisibility, catches, onOpenClubFeed, rfcLink, onReset }) {
  const th = THEMES[T];
  var isPersonalBest = false;
  if (form.species && form.length) {
    var myInches = parseFloat(form.length);
    if (!isNaN(myInches)) {
      var prevBest = 0;
      catches.forEach(function(c) {
        if (c.species === form.species) {
          var n = parseFloat(c.length);
          if (!isNaN(n) && n > prevBest) prevBest = n;
        }
      });
      isPersonalBest = myInches > prevBest && prevBest > 0;
    }
  }
  var confettiColors = ["#6fcf6f","#d4a843","#5a9fd4","#e05050","#4ab8a0","#e09030"];
  var particles = Array.from({ length: 18 }, function(_, i) {
    return { left: (8 + i * 5) % 92, delay: (i * 0.08).toFixed(2), color: confettiColors[i % confettiColors.length], size: 5 + (i % 4) * 2 };
  });
  var speciesEmoji = (SPECIES.find(function(s) { return s.name === form.species; }) || {}).emoji || "🐟";
  return (
    <div style={{ textAlign:"center", padding:"16px 0", animation:"scaleIn 0.3s ease-out both", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, width:"100%", pointerEvents:"none" }} aria-hidden="true">
        {particles.map(function(p, i) {
          return (
            <div key={i} style={{ position:"absolute", left:p.left + "%", top:0, width:p.size, height:p.size, borderRadius:i % 3 === 0 ? "50%" : 2, background:p.color, animation:"confettiFall 1.4s ease-in " + p.delay + "s both" }} />
          );
        })}
      </div>
      <div style={{ fontSize:72, marginBottom:8, display:"inline-block", animation:"fishBounce 0.6s ease-out both 0.1s" }}>{speciesEmoji}</div>
      {isPersonalBest && (
        <div style={{ display:"inline-block", background:th.gold + "22", border:"1px solid " + th.gold, borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700, color:th.gold, marginBottom:8, letterSpacing:0.5, marginLeft:8 }}>★ PERSONAL BEST</div>
      )}
      <div style={{ fontSize:22, color:th.white, fontWeight:800, marginBottom:4, lineHeight:1.2 }}>{form.species || "Fish logged!"}</div>
      <div style={{ fontSize:16, color:th.green, fontWeight:700, marginBottom:2 }}>
        {[form.length, estWeightLabel ? "~" + estWeightLabel : null].filter(Boolean).join(" · ")}
      </div>
      {form.spot ? <div style={{ fontSize:12, color:th.muted, marginBottom:16 }}>📍 {form.spot}</div> : <div style={{ marginBottom:16 }} />}
      {photo ? <img src={photo} alt="catch" style={{ width:"100%", borderRadius:12, marginBottom:16, maxHeight:220, objectFit:"cover", border:"2px solid " + th.green + "44" }} /> : null}
      {catchVisibility === "club" && onOpenClubFeed ? (
        <button type="button" onClick={onOpenClubFeed} style={{ width:"100%", background:th.gold + "22", border:"1px solid " + th.gold, borderRadius:10, padding:"11px 0", cursor:"pointer", color:th.gold, fontWeight:700, fontSize:14, marginBottom:10 }}>
          See it on the club feed →
        </button>
      ) : null}
      {rfcLink ? (
        <div style={{ background:th.green + "14", border:"1px solid " + th.green + "44", borderRadius:10, padding:14, marginBottom:14, textAlign:"left" }}>
          <div style={{ fontSize:13, color:th.green, fontWeight:700, marginBottom:4 }}>Email RFC members?</div>
          <a href={rfcLink} style={{ display:"block", background:th.green, color:"#000", borderRadius:8, padding:"10px 0", textDecoration:"none", textAlign:"center", fontWeight:700, fontSize:13 }}>Open Email to RFC</a>
        </div>
      ) : null}
      <button onClick={onReset} style={{ background:"transparent", border:"1px solid " + th.border, color:th.muted, borderRadius:8, padding:"10px 24px", cursor:"pointer", fontSize:13 }}>
        Log another catch
      </button>
    </div>
  );
}

// ─── CATCH TAB ────────────────────────────────────────────────────────────────
function CatchTab({ profile, authMember, T, onOpenClubFeed, onSaveToast }) {
  const th = THEMES[T];
  const [showMyLogs, setShowMyLogs] = useState(false);
  const fileRef = useRef();
  const multiFileRef = useRef();
  const refFileRef = useRef();
  const photoContainerRef = useRef();
  const photoAreaRef = useRef();
  const draggingMarker = useRef(null);
  const [catches, setCatches] = useState(function() {
    try { var s = JSON.parse(localStorage.getItem("rfc_catches_v1") || "[]"); if (s.length) return s; } catch(e) {}
    return [];
  });
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [referencePhotos, setReferencePhotos] = useState([]);
  const [photoB64, setPhotoB64] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [measurementOption, setMeasurementOption] = useState("1_ruler");
  const [rulerMaxInches, setRulerMaxInches] = useState(RULER_REF_INCHES);
  const [referenceInches, setReferenceInches] = useState("3.37");
  const [refStartPct, setRefStartPct] = useState(20);
  const [refEndPct, setRefEndPct] = useState(34);
  const [mouthPct, setMouthPct] = useState(10);
  const [tailPct, setTailPct] = useState(90);
  const [form, setForm] = useState({ species:"", length:"", bait:"", spot:"", rod:"", notes:"", date:new Date().toLocaleDateString() });
  const [rfcLink, setRfcLink] = useState("");
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [rulerOrientation, setRulerOrientation] = useState("horizontal");
  const [rulerBoxH, setRulerBoxH] = useState(360);
  const [spotMetaSource, setSpotMetaSource] = useState("");
  const [showAdvancedMeasure, setShowAdvancedMeasure] = useState(false);
  const [customSpecies, setCustomSpecies] = useState("");
  const [catchVisibility, setCatchVisibility] = useState("private");
  const [cloudSaving, setCloudSaving] = useState(false);
  const [showCatchHint, setShowCatchHint] = useState(function() {
    try { return !localStorage.getItem(RFC_CATCH_HINT_KEY); } catch (e) { return true; }
  });

  function setF(k, v) { setForm(function(f) { return Object.assign({}, f, { [k]: v }); }); }

  function dismissCatchHint() {
    setShowCatchHint(false);
    try { localStorage.setItem(RFC_CATCH_HINT_KEY, "1"); } catch (e) {}
  }

  function speciesAlertFor(name) {
    var sp = SPECIES.find(function(s) { return s.name === name || name.indexOf(s.name) >= 0; });
    return sp && sp.alert ? sp.alert : null;
  }

  function baitChipsForSpecies(speciesName) {
    return speciesBaitTips(speciesName, getSeason(new Date().getMonth())).map(function(b) { return b.name; });
  }

  useEffect(function() {
    if (step !== 2 || measurementOption !== "1_ruler" || rulerOrientation !== "vertical") return;
    function measureRulerBox() {
      if (photoContainerRef.current) {
        setRulerBoxH(photoContainerRef.current.offsetHeight || 360);
      }
    }
    measureRulerBox();
    window.addEventListener("resize", measureRulerBox);
    var timer = setTimeout(measureRulerBox, 250);
    return function() {
      window.removeEventListener("resize", measureRulerBox);
      clearTimeout(timer);
    };
  }, [step, photo, rulerOrientation, measurementOption, aiLoading]);

  function applyPhotoMetadata(exif) {
    if (!exif) return;
    var resolved = resolveSpotFromExif(exif);
    var safe = sanitizeSpotForForm(resolved.spot, resolved.source);
    if (safe.spot) {
      setF("spot", safe.spot);
      setSpotMetaSource(safe.source);
    }
    var dt = exif.DateTimeOriginal || exif.CreateDate;
    if (dt) setF("date", new Date(dt).toLocaleDateString());
  }
  useEffect(function() { localStorage.setItem("rfc_catches_v1", JSON.stringify(catches)); }, [catches]);
  function readImageFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        var full = ev.target.result;
        resolve({ full:full, b64:(full && full.split(",")[1]) || "", type:file.type || "image/jpeg" });
      };
      reader.onerror = function() { reject(new Error("read_failed")); };
      reader.readAsDataURL(file);
    });
  }

  function handlePhoto(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;
    var primary = files[0];
    // Parse EXIF GPS, IPTC location, and capture date for auto-fill.
    exifr.parse(primary, {
      gps:true,
      iptc:true,
      tiff:true,
      pick:[
        "GPSLatitude", "GPSLongitude", "DateTimeOriginal", "CreateDate",
        "Location", "Sublocation", "City", "State", "ProvinceState", "Country", "CountryName",
      ],
    }).then(function(exif) {
      applyPhotoMetadata(exif);
    }).catch(function() {});
    readImageFile(primary).then(function(img) {
      setPhoto(img.full);
      setPhotoB64(img.b64);
      setMeasurementOption("1_ruler");
      setRulerMaxInches(RULER_REF_INCHES);
      setReferenceInches("3.37");
      setRefStartPct(20);
      setRefEndPct(34);
      setMouthPct(10);
      setTailPct(90);
      setStep(2);
      // If multiple images are uploaded together, treat extras as reference shots.
      if (files.length > 1) {
        Promise.all(files.slice(1).map(readImageFile)).then(function(extra) {
          setReferencePhotos(extra.map(function(x) { return x.full; }).slice(0, 4));
        }).catch(function() { setReferencePhotos([]); });
      } else {
        setReferencePhotos([]);
      }
      setAiLoading(true);
      var photoDataUrl = img.full;
      fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:img.type,data:img.b64}},
            {type:"text",text:"Identify the fish species and analyze its orientation. Respond ONLY with raw JSON (no markdown, no extra text):\n{\"species\":\"Largemouth Bass\",\"confidence\":95,\"length\":\"12 inches\",\"notes\":\"Brief ID note\",\"rotation\":90,\"mouth_pct\":15,\"tail_pct\":85}\n\nRules:\n- rotation: degrees clockwise (0, 90, 180, or 270) needed to orient fish horizontally with mouth pointing LEFT\n- mouth_pct: horizontal % position (0=left edge, 100=right edge) of fish mouth AFTER applying that rotation\n- tail_pct: horizontal % position of fish tail tip AFTER applying that rotation\n- If no fish visible use rotation:0, mouth_pct:10, tail_pct:90\n- If ruler visible in photo, estimate length from it; otherwise estimate from body proportions"}
          ]}]
        })
      }).then(function(r) { return r.json(); }).then(function(data) {
        var txt = (data.content && data.content[0] && data.content[0].text) || "";
        var m = txt.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            var res = JSON.parse(m[0]);
            setAiResult(res);
            var matchedSpecies = matchSpeciesName(res.species);
            if (matchedSpecies) {
              setForm(function(f) { return Object.assign({}, f, { species:matchedSpecies }); });
            }
            var rot = parseInt(res.rotation, 10) || 0;
            var mPct = parseFloat(res.mouth_pct);
            var tPct = parseFloat(res.tail_pct);
            var applyMarkers = function() {
              if (isFinite(mPct) && isFinite(tPct)) {
                setMouthPct(Math.max(2, Math.min(98, mPct)));
                setTailPct(Math.max(2, Math.min(98, tPct)));
              }
            };
            if (rot !== 0) {
              applyCanvasRotation(photoDataUrl, rot).then(function(rotated) {
                setPhoto(rotated);
                applyMarkers();
              });
            } else {
              applyMarkers();
            }
          } catch(e) {}
        }
        setAiLoading(false);
      }).catch(function() { setAiLoading(false); });
    }).catch(function() {});
    e.target.value = "";
  }

  function applyCanvasRotation(dataUrl, degrees) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement("canvas");
        var rad = (degrees * Math.PI) / 180;
        if (degrees === 90 || degrees === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        var ctx = canvas.getContext("2d");
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = dataUrl;
    });
  }
  function rotatePhoto() {
    if (!photo) return;
    applyCanvasRotation(photo, 90).then(function(rotated) {
      setPhoto(rotated);
      setMouthPct(10);
      setTailPct(90);
    });
  }
  function overlayMeasureEl() {
    if (measurementOption === "1_ruler" && photoAreaRef.current) return photoAreaRef.current;
    return photoContainerRef.current;
  }
  function handleOverlayTouchStart(e) {
    var el = overlayMeasureEl();
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var touch = e.touches[0];
    var pct = rulerOrientation === "horizontal"
      ? ((touch.clientX - rect.left) / rect.width) * 100
      : ((touch.clientY - rect.top) / rect.height) * 100;
    pct = Math.max(0, Math.min(100, pct));
    draggingMarker.current = Math.abs(pct - mouthPct) <= Math.abs(pct - tailPct) ? "mouth" : "tail";
  }
  function handleOverlayTouchMove(e) {
    if (!draggingMarker.current) return;
    var el = overlayMeasureEl();
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var touch = e.touches[0];
    var pct = rulerOrientation === "horizontal"
      ? ((touch.clientX - rect.left) / rect.width) * 100
      : ((touch.clientY - rect.top) / rect.height) * 100;
    pct = Math.max(0, Math.min(100, pct));
    if (draggingMarker.current === "mouth") setMouthPct(pct);
    else setTailPct(pct);
  }
  function handleOverlayTouchEnd() { draggingMarker.current = null; }

  function handleReferencePhotos(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;
    Promise.all(files.map(readImageFile)).then(function(extra) {
      setReferencePhotos(function(prev) {
        return prev.concat(extra.map(function(x) { return x.full; })).slice(0, 4);
      });
    }).catch(function() {});
    e.target.value = "";
  }

  function submitCatch() {
    var vis = catchVisibility === "club" && authMember ? "club" : "private";
    var knownNames = KNOWN_SPOTS.map(function(s) { return s.name; }).concat(SCOUT_SPOTS.map(function(s) { return s.name; }));
    var spotDisplayName = buildSpotDisplayName(form.spot, knownNames);
    var entry = {
      id:Date.now(),
      user:(profile && profile.name) || "Angler",
      species:form.species,
      length:form.length,
      estWeight:estimateWeightLbs(form.species, form.length),
      bait:form.bait,
      rod:form.rod,
      spot:form.spot,
      spotDisplayName:spotDisplayName,
      notes:form.notes,
      date:form.date,
      photo:photo,
      visibility:vis,
      likeCount:0,
    };
    setCatches(function(c) { return [entry].concat(c); });
    var subj = encodeURIComponent("RFC Catch Report — " + form.species + " · " + form.length + " · " + ((profile && profile.name) || "Angler"));
    var body = encodeURIComponent("RFC Catch Report\n\nAngler: " + ((profile && profile.name) || "Angler") + "\nEmail: " + ((profile && profile.email) || "not provided") + "\nDate: " + form.date + "\n\nFish: " + form.species + "\nLength: " + form.length + "\nBait: " + form.bait + "\nRod: " + form.rod + "\nSpot: " + form.spot + "\nNotes: " + form.notes);
    setRfcLink("mailto:RiversideFishingClubil@gmail.com?subject=" + subj + "&body=" + body);
    function finishStep(msg, type) {
      if (onSaveToast && msg) onSaveToast(msg, type);
      setStep(6);
    }
    if (authMember && authMember.id) {
      setCloudSaving(true);
      saveCatchToCloud(authMember.id, entry).then(function(result) {
        if (result && result.photoUrl) {
          setCatches(function(list) {
            return list.map(function(c) {
              if (String(c.id) === String(entry.id)) {
                return Object.assign({}, c, { photoUrl: result.photoUrl });
              }
              return c;
            });
          });
        }
        finishStep(vis === "club" ? "Saved to cloud and shared with club." : "Saved to cloud.", "success");
      }).catch(function(err) {
        finishStep("Saved on this device — cloud sync failed. " + (err && err.message ? err.message : ""), "error");
      }).finally(function() {
        setCloudSaving(false);
      });
    } else {
      finishStep("Saved on this device only. Sign in to back up to RFC cloud.", "info");
    }
  }

  var gear = (profile && profile.gear) || [];
  // Clamp ruler input so the overlay always has a valid scale.
  var rulerInches = Math.max(10, Math.min(60, parseInt(rulerMaxInches, 10) || RULER_REF_INCHES));
  var effectiveRulerInches = measurementOption === "1_ruler" ? RULER_REF_INCHES : rulerInches;
  var usesObjectReference = measurementOption === "2_card" || measurementOption === "3_coin" || measurementOption === "4_custom" || measurementOption === "6_depth";
  var fishSpanPct = Math.abs(tailPct - mouthPct);
  var refSpanPct = Math.max(0.1, Math.abs(refEndPct - refStartPct));
  var customReferenceLen = Math.max(0, parseFloat(referenceInches) || 0);
  var referenceLenInches = measurementOption === "2_card" ? 3.37 : measurementOption === "3_coin" ? 0.955 : customReferenceLen;
  // Convert marker distance (percentage of image width) into inches.
  var measuredByRuler = (fishSpanPct / 100) * effectiveRulerInches;
  var measuredByReference = (fishSpanPct / refSpanPct) * referenceLenInches;
  var measuredInches = usesObjectReference && referenceLenInches > 0 ? measuredByReference : measuredByRuler;
  var estimatedLengthLabel = aiResult && aiResult.length ? aiResult.length + " (estimate)" : measuredByRuler.toFixed(1) + " inches (estimate)";
  var measuredLengthLabel = measurementOption === "5_none" ? estimatedLengthLabel : measuredInches.toFixed(1) + " inches";
  var needsMorePhotos = !!photo && referencePhotos.length === 0;
  var needsDepthPhotos = measurementOption === "6_depth" && referencePhotos.length < 2;
  var estWeightLabel = estimateWeightLbs(form.species, form.length);

  // Carry measured length + recognized species into the details form — skip re-entry.
  function continueFromMeasurement() {
    var len = measurementOption === "5_none" && aiResult && aiResult.length
      ? aiResult.length
      : formatCatchLengthInches(measuredInches);
    if (len) setF("length", len);
    var sp = form.species || (aiResult && matchSpeciesName(aiResult.species)) || "";
    if (sp) setF("species", sp);
    if (sp) {
      setStep(4);
    } else {
      setStep(3);
      setSpeciesSearch("");
    }
  }

  var inputStyle = { width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"10px 12px", color:th.white, fontSize:14, boxSizing:"border-box", outline:"none", marginBottom:10 };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", margin:"12px 0 8px", gap:8 }}>
        <div style={{ fontSize:16, color:th.white, fontWeight:700 }}>Log a Catch</div>
        {onOpenClubFeed ? (
          <button type="button" onClick={onOpenClubFeed} style={{ background:"transparent", border:"none", color:th.green, cursor:"pointer", fontSize:12, fontWeight:700, padding:0, textDecoration:"underline" }}>
            View club feed →
          </button>
        ) : null}
      </div>
      {catches.length > 0 ? (
        <Card T={T} borderColor={th.blue + "33"} style={{ marginBottom:10 }}>
          <button type="button" onClick={function() { setShowMyLogs(function(v) { return !v; }); }} style={{ width:"100%", background:"transparent", border:"none", color:th.white, cursor:"pointer", textAlign:"left", fontSize:13, fontWeight:700, padding:0 }}>
            My catches ({catches.length}) {showMyLogs ? "▾" : "▸"}
          </button>
          {showMyLogs ? catches.slice(0, 8).map(function(c, i) {
            return (
              <div key={i} style={{ borderTop:"1px solid " + th.border, paddingTop:8, marginTop:8 }}>
                <div style={{ fontWeight:700, color:th.white, fontSize:13 }}>{c.species}</div>
                <div style={{ fontSize:11, color:th.muted }}>{c.length} · {c.date}{c.visibility === "club" ? " · shared" : ""}</div>
              </div>
            );
          }) : null}
        </Card>
      ) : (
        <div style={{ textAlign:"center", padding:"28px 0 16px", animation:"fadeInUp 0.25s ease-out both" }}>
          <div style={{ fontSize:44, marginBottom:10 }}>🎣</div>
          <div style={{ fontSize:15, color:th.white, fontWeight:700, marginBottom:6 }}>No catches yet</div>
          <div style={{ fontSize:13, color:th.muted, lineHeight:1.55, marginBottom:0 }}>
            Add a photo for AI species ID and length measurement.
          </div>
        </div>
      )}
        <div>
          {showCatchHint && step === 0 ? (
            <Card T={T} borderColor={th.blue + "44"} style={{ marginBottom:10 }}>
              <div style={{ fontSize:13, color:th.white, fontWeight:700, marginBottom:6 }}>Log a catch in 3 steps</div>
              <div style={{ fontSize:12, color:th.muted, lineHeight:1.5 }}>1) Add photo · 2) Measure & pick species · 3) Review & save</div>
              <button type="button" onClick={dismissCatchHint} style={{ marginTop:8, background:th.green, color:"#000", border:"none", borderRadius:7, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:700 }}>Got it</button>
            </Card>
          ) : null}
          {step === 0 && (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
              <div style={{ fontSize:18, color:th.white, fontWeight:700, marginBottom:8 }}>Log a Catch</div>
              <div style={{ fontSize:13, color:th.muted, marginBottom:24 }}>Start with a photo or log without one</div>
              <input type="file" accept="image/*" capture="environment" ref={fileRef} onChange={handlePhoto} style={{ display:"none" }} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <button onClick={function() { fileRef.current.click(); }} style={{ background:th.green + "22", border:"1px solid " + th.green, borderRadius:10, padding:16, cursor:"pointer", color:th.green, fontSize:13, fontWeight:700 }}>📷 Use Photo</button>
                <button onClick={function() { setStep(3); }} style={{ background:th.blue + "22", border:"1px solid " + th.blue, borderRadius:10, padding:16, cursor:"pointer", color:th.blue, fontSize:13, fontWeight:700 }}>📝 Log Only</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>AI Fish Analysis</div>
              {photo ? (
                <div style={{ marginBottom:12 }}>
                  <div ref={photoContainerRef} style={{ position:"relative", borderRadius:10, overflow:"hidden", border:"1px solid " + th.border, background:"#000" }}>
                    <div
                      ref={photoAreaRef}
                      onTouchStart={handleOverlayTouchStart}
                      onTouchMove={handleOverlayTouchMove}
                      onTouchEnd={handleOverlayTouchEnd}
                      style={{
                        position:"relative",
                        touchAction:"none",
                        marginBottom: measurementOption === "1_ruler" && rulerOrientation === "horizontal" ? RULER_STRIP_H : 0,
                        marginRight: measurementOption === "1_ruler" && rulerOrientation === "vertical" ? RULER_STRIP_W : 0,
                      }}
                    >
                      <button onClick={rotatePhoto} style={{ position:"absolute", top:8, left:8, zIndex:10, background:"rgba(0,0,0,0.65)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:6, color:"#fff", fontSize:18, padding:"4px 9px", cursor:"pointer", lineHeight:1 }} title="Rotate 90°">↻</button>
                      {aiLoading && <div style={{ position:"absolute", inset:0, zIndex:9, background:"rgba(0,0,0,0.55)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}><div style={{ fontSize:22 }}>🤖</div><div style={{ fontSize:13, color:"#fff", fontWeight:600 }}>AI orienting photo…</div></div>}
                      <img src={photo} alt="catch" onLoad={function() { if (photoContainerRef.current) setRulerBoxH(photoContainerRef.current.offsetHeight || 360); }} style={{ width:"100%", maxHeight:360, objectFit:"contain", display:"block" }} />
                      {measurementOption === "1_ruler" ? (
                        rulerOrientation === "horizontal" ? (
                          <div style={{ position:"absolute", left:0, right:0, top:0, bottom:0, pointerEvents:"none" }}>
                            <div style={{ position:"absolute", left:Math.min(mouthPct,tailPct) + "%", width:Math.abs(tailPct-mouthPct) + "%", top:0, bottom:0, background:"rgba(111,207,111,0.22)" }} />
                            <div style={{ position:"absolute", left:mouthPct + "%", top:0, bottom:0, width:2, background:th.green, boxShadow:"0 0 4px rgba(0,0,0,0.8)" }}>
                              <div style={{ position:"absolute", top:8, left:-20, fontSize:10, color:th.green, fontWeight:700, textShadow:"0 1px 3px #000" }}>MOUTH</div>
                            </div>
                            <div style={{ position:"absolute", left:tailPct + "%", top:0, bottom:0, width:2, background:th.orange, boxShadow:"0 0 4px rgba(0,0,0,0.8)" }}>
                              <div style={{ position:"absolute", top:8, left:-12, fontSize:10, color:th.orange, fontWeight:700, textShadow:"0 1px 3px #000" }}>TAIL</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ position:"absolute", left:0, right:0, top:0, bottom:0, pointerEvents:"none" }}>
                            <div style={{ position:"absolute", top:Math.min(mouthPct,tailPct) + "%", height:Math.abs(tailPct-mouthPct) + "%", left:0, right:0, background:"rgba(111,207,111,0.22)" }} />
                            <div style={{ position:"absolute", top:mouthPct + "%", left:0, right:0, height:2, background:th.green, boxShadow:"0 0 4px rgba(0,0,0,0.8)" }}>
                              <div style={{ position:"absolute", left:8, top:-8, fontSize:10, color:th.green, fontWeight:700, textShadow:"0 1px 3px #000" }}>MOUTH</div>
                            </div>
                            <div style={{ position:"absolute", top:tailPct + "%", left:0, right:0, height:2, background:th.orange, boxShadow:"0 0 4px rgba(0,0,0,0.8)" }}>
                              <div style={{ position:"absolute", left:8, top:-8, fontSize:10, color:th.orange, fontWeight:700, textShadow:"0 1px 3px #000" }}>TAIL</div>
                            </div>
                          </div>
                        )
                      ) : (
                      rulerOrientation === "horizontal" ? (
                        <div style={{ position:"absolute", left:10, right:10, bottom:10, height:36, borderRadius:8, background:"rgba(0,0,0,0.55)", border:"1px solid rgba(255,255,255,0.2)", overflow:"hidden" }}>
                          {Array.from({ length:rulerInches + 1 }).map(function(_, i) {
                            var left = (i / rulerInches) * 100;
                            var major = i % 5 === 0;
                            return (
                              <div key={"tick_" + i} style={{ position:"absolute", left:left + "%", bottom:0, width:1, height:major ? 22 : 12, background:major ? "#fff" : "rgba(255,255,255,0.65)" }}>
                                {major ? <div style={{ position:"absolute", bottom:24, left:-8, fontSize:9, color:"#fff", fontFamily:"monospace" }}>{i}</div> : null}
                              </div>
                            );
                          })}
                          <div style={{ position:"absolute", left:Math.min(mouthPct,tailPct) + "%", width:Math.abs(tailPct-mouthPct) + "%", top:0, bottom:0, background:"rgba(111,207,111,0.18)" }} />
                          <div style={{ position:"absolute", left:mouthPct + "%", top:0, bottom:0, width:2, background:th.green }}>
                            <div style={{ position:"absolute", top:-16, left:-18, fontSize:10, color:th.green, fontWeight:700 }}>MOUTH</div>
                          </div>
                          <div style={{ position:"absolute", left:tailPct + "%", top:0, bottom:0, width:2, background:th.orange }}>
                            <div style={{ position:"absolute", top:-16, left:-13, fontSize:10, color:th.orange, fontWeight:700 }}>TAIL</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ position:"absolute", top:10, bottom:10, right:10, width:36, borderRadius:8, background:"rgba(0,0,0,0.55)", border:"1px solid rgba(255,255,255,0.2)", overflow:"hidden" }}>
                          {Array.from({ length:rulerInches + 1 }).map(function(_, i) {
                            var top = (i / rulerInches) * 100;
                            var major = i % 5 === 0;
                            return (
                              <div key={"tick_" + i} style={{ position:"absolute", top:top + "%", right:0, height:1, width:major ? 22 : 12, background:major ? "#fff" : "rgba(255,255,255,0.65)" }}>
                                {major ? <div style={{ position:"absolute", right:24, top:-6, fontSize:9, color:"#fff", fontFamily:"monospace" }}>{i}</div> : null}
                              </div>
                            );
                          })}
                          <div style={{ position:"absolute", top:Math.min(mouthPct,tailPct) + "%", height:Math.abs(tailPct-mouthPct) + "%", left:0, right:0, background:"rgba(111,207,111,0.18)" }} />
                          <div style={{ position:"absolute", top:mouthPct + "%", left:0, right:0, height:2, background:th.green }}>
                            <div style={{ position:"absolute", top:-8, right:38, fontSize:10, color:th.green, fontWeight:700 }}>MOUTH</div>
                          </div>
                          <div style={{ position:"absolute", top:tailPct + "%", left:0, right:0, height:2, background:th.orange }}>
                            <div style={{ position:"absolute", top:-8, right:38, fontSize:10, color:th.orange, fontWeight:700 }}>TAIL</div>
                          </div>
                        </div>
                      )
                    )}
                    </div>
                    {measurementOption === "1_ruler" && rulerOrientation === "horizontal" ? (
                      <div style={{ position:"absolute", left:0, right:0, bottom:0, height:RULER_STRIP_H, overflow:"hidden", pointerEvents:"none", borderTop:"1px solid rgba(255,255,255,0.15)", background:"#ebe3d3" }}>
                        <img src={RULER_REF_SRC} alt="20 inch ruler" draggable={false} style={{ width:"100%", height:"100%", objectFit:"fill", opacity:1, display:"block" }} />
                      </div>
                    ) : null}
                    {measurementOption === "1_ruler" && rulerOrientation === "vertical" ? (
                      <div style={{ position:"absolute", top:0, right:0, bottom:0, width:RULER_STRIP_W, overflow:"hidden", pointerEvents:"none", borderLeft:"1px solid rgba(255,255,255,0.15)", background:"#ebe3d3" }}>
                        <img
                          src={RULER_REF_SRC}
                          alt="20 inch ruler"
                          draggable={false}
                          style={{
                            position:"absolute",
                            top:0,
                            left:"100%",
                            width:rulerBoxH,
                            height:RULER_STRIP_W,
                            maxWidth:"none",
                            objectFit:"fill",
                            transformOrigin:"top left",
                            transform:"rotate(-90deg) translateX(-100%)",
                            display:"block",
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <button onClick={rotatePhoto} style={{ width:"100%", marginTop:8, background:"rgba(255,255,255,0.08)", border:"1px solid " + th.border, borderRadius:8, padding:"10px 0", cursor:"pointer", color:th.white, fontSize:14, fontWeight:600, letterSpacing:"0.02em" }}>↻ Rotate Photo</button>
                  <Card T={T} borderColor={th.blue + "44"} style={{ marginTop:10 }}>
                    <div style={{ fontSize:12, color:th.white, marginBottom:8, lineHeight:1.5 }}>
                      Move the markers so the fish starts at the closed mouth tip and ends at the farthest tail tip.
                    </div>
                    <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                      <button onClick={function() { setRulerOrientation("horizontal"); }} style={{ flex:1, background:rulerOrientation==="horizontal" ? th.green+"22" : "transparent", border:"1px solid "+(rulerOrientation==="horizontal" ? th.green : th.border), color:rulerOrientation==="horizontal" ? th.green : th.muted, borderRadius:7, padding:"7px 8px", cursor:"pointer", fontSize:12, fontWeight:rulerOrientation==="horizontal" ? 700 : 400 }}>↔ Horizontal</button>
                      <button onClick={function() { setRulerOrientation("vertical"); }} style={{ flex:1, background:rulerOrientation==="vertical" ? th.green+"22" : "transparent", border:"1px solid "+(rulerOrientation==="vertical" ? th.green : th.border), color:rulerOrientation==="vertical" ? th.green : th.muted, borderRadius:7, padding:"7px 8px", cursor:"pointer", fontSize:12, fontWeight:rulerOrientation==="vertical" ? 700 : 400 }}>↕ Vertical</button>
                    </div>
                    <div style={{ fontSize:12, color:th.muted, marginBottom:6 }}>Measurement method</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
                      {[
                        ["1_ruler","1. Westcott ruler (20 in)"],
                        ["2_card","2. Credit card ref"],
                        ["3_coin","3. Quarter ref"],
                        ["4_custom","4. Custom ref size"],
                        ["5_none","5. No reference (estimate)"],
                        ["6_depth","6. Multi-photo depth assist"],
                      ].filter(function(opt) {
                        if (!profile || profile.level !== "Beginner" || showAdvancedMeasure) return true;
                        return opt[0] === "1_ruler";
                      }).map(function(opt) {
                        return (
                          <button
                            key={opt[0]}
                            onClick={function() { setMeasurementOption(opt[0]); }}
                            style={{
                              background:measurementOption === opt[0] ? th.green + "33" : "transparent",
                              border:"1px solid " + (measurementOption === opt[0] ? th.green : th.border),
                              color:measurementOption === opt[0] ? th.green : th.muted,
                              borderRadius:7,
                              padding:"7px 8px",
                              cursor:"pointer",
                              fontSize:11,
                              textAlign:"left"
                            }}
                          >
                            {opt[1]}
                          </button>
                        );
                      })}
                    </div>
                    {profile && profile.level === "Beginner" && !showAdvancedMeasure ? (
                      <button type="button" onClick={function() { setShowAdvancedMeasure(true); }} style={{ width:"100%", background:"transparent", border:"1px dashed " + th.border, borderRadius:7, padding:"8px", cursor:"pointer", fontSize:12, color:th.muted, marginBottom:10 }}>Show more measure methods (2–6)</button>
                    ) : null}
                    {measurementOption === "1_ruler" ? (
                      <div>
                        <div style={{ fontSize:11, color:th.muted, marginBottom:4, lineHeight:1.45 }}>
                          The Westcott 20-inch ruler sits beside your photo. Drag markers on the fish only — each inch on the photo {rulerOrientation === "vertical" ? "height" : "width"} equals one real inch.
                        </div>
                        <div style={{ fontSize:12, color:th.green, marginBottom:8, fontWeight:700 }}>Reference scale: {RULER_REF_INCHES} inches (full {rulerOrientation === "vertical" ? "height" : "width"} of photo)</div>
                      </div>
                    ) : null}
                    {measurementOption === "4_custom" ? (
                      <div>
                        <div style={{ fontSize:11, color:th.muted, marginBottom:4 }}>Reference object length (inches)</div>
                        <input type="number" min="0.1" max="24" step="0.01" value={referenceInches} onChange={function(e) { setReferenceInches(e.target.value); }} style={Object.assign({}, inputStyle, { marginBottom:8 })} />
                      </div>
                    ) : null}
                    <div style={{ fontSize:11, color:th.muted, marginBottom:4 }}>{rulerOrientation === "vertical" ? "Mouth position (top=0%)" : "Mouth marker position"}</div>
                    <input type="range" min="0" max="100" step="1" value={mouthPct} onChange={function(e) { setMouthPct(parseFloat(e.target.value)); }} style={{ width:"100%", marginBottom:8 }} />
                    <div style={{ fontSize:11, color:th.muted, marginBottom:4 }}>{rulerOrientation === "vertical" ? "Tail position (top=0%)" : "Tail marker position"}</div>
                    <input type="range" min="0" max="100" step="1" value={tailPct} onChange={function(e) { setTailPct(parseFloat(e.target.value)); }} style={{ width:"100%", marginBottom:8 }} />
                    {usesObjectReference ? (
                      <div style={{ borderTop:"1px solid " + th.border, paddingTop:8, marginTop:4 }}>
                        <div style={{ fontSize:11, color:th.muted, marginBottom:4 }}>Reference start marker</div>
                        <input type="range" min="0" max="100" step="1" value={refStartPct} onChange={function(e) { setRefStartPct(parseFloat(e.target.value)); }} style={{ width:"100%", marginBottom:8 }} />
                        <div style={{ fontSize:11, color:th.muted, marginBottom:4 }}>Reference end marker</div>
                        <input type="range" min="0" max="100" step="1" value={refEndPct} onChange={function(e) { setRefEndPct(parseFloat(e.target.value)); }} style={{ width:"100%", marginBottom:10 }} />
                      </div>
                    ) : null}
                    <input type="file" accept="image/*" ref={refFileRef} multiple onChange={handleReferencePhotos} style={{ display:"none" }} />
                    {needsMorePhotos ? (
                      <div style={{ background:th.orange + "18", border:"1px solid " + th.orange + "55", borderRadius:8, padding:10, marginBottom:10 }}>
                        <div style={{ fontSize:12, color:th.white, lineHeight:1.45, marginBottom:7 }}>
                          To improve accuracy, add at least one more photo with a known object (ruler, credit card, or quarter) next to the fish.
                        </div>
                        <button onClick={function() { refFileRef.current.click(); }} style={{ background:th.orange, color:"#120900", border:"none", borderRadius:7, padding:"7px 10px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                          Add reference photo
                        </button>
                      </div>
                    ) : null}
                    {needsDepthPhotos ? (
                      <div style={{ background:th.blue + "18", border:"1px solid " + th.blue + "55", borderRadius:8, padding:10, marginBottom:10, fontSize:12, color:th.white, lineHeight:1.45 }}>
                        Option 6 works best with 2+ extra photos from slightly different angles. Add more reference photos to proceed confidently.
                      </div>
                    ) : null}
                    {referencePhotos.length > 0 ? (
                      <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:10 }}>
                        {referencePhotos.map(function(src, idx) {
                          return <img key={idx} src={src} alt={"reference_" + idx} style={{ width:72, height:72, objectFit:"cover", borderRadius:8, border:"1px solid " + th.border }} />;
                        })}
                      </div>
                    ) : null}
                    <div style={{ fontSize:13, color:th.white, fontWeight:700, marginBottom:4 }}>Measured length: {measuredLengthLabel}</div>
                    <div style={{ fontSize:11, color:th.muted, lineHeight:1.45 }}>This length will carry forward automatically — no need to enter it again on the next screen.</div>
                  </Card>
                </div>
              ) : null}
              <button onClick={continueFromMeasurement} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700, marginTop:8 }}>
                {form.species || (aiResult && aiResult.species) ? "Continue → Catch Details" : "Confirm Length → Pick Species"}
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>Identify Species</div>
              {aiLoading ? (
                <div style={{ textAlign:"center", color:th.muted, padding:"16px 0" }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>🔍</div>
                  AI identifying fish...
                </div>
              ) : null}
              {aiResult && !aiLoading ? (
                <Card T={T} borderColor={th.green + "44"}>
                  <div style={{ fontSize:11, color:th.green, fontFamily:"monospace", marginBottom:4 }}>AI RESULT — {aiResult.confidence}% CONFIDENT</div>
                  <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:4 }}>{aiResult.species}</div>
                  <div style={{ fontSize:12, color:th.muted, marginBottom:10 }}>{aiResult.notes}</div>
                  <button onClick={function() { setF("species", matchSpeciesName(aiResult.species)); setStep(4); }} style={{ background:th.green, color:"#000", border:"none", borderRadius:7, padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:700 }}>✓ Use "{matchSpeciesName(aiResult.species)}"</button>
                </Card>
              ) : null}
              {!aiResult && !aiLoading ? (
                <Card T={T} borderColor={th.orange + "44"}>
                  <div style={{ fontSize:13, color:th.orange }}>AI unavailable — pick species below</div>
                </Card>
              ) : null}
              <div style={{ fontSize:12, color:th.muted, margin:"12px 0 6px" }}>Search species:</div>
              <input value={speciesSearch} onChange={function(e) { setSpeciesSearch(e.target.value); }} placeholder="e.g. Bass, Trout..." style={inputStyle} />
              <div style={{ maxHeight:240, overflowY:"auto", marginBottom:12, border:"1px solid " + th.border, borderRadius:8 }}>
                {SPECIES.filter(function(sp) { return !speciesSearch || sp.name.toLowerCase().includes(speciesSearch.toLowerCase()); }).map(function(sp) {
                  var selected = form.species === sp.name;
                  return (
                    <button key={sp.id} onClick={function() { setF("species", sp.name); }} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:selected ? th.green + "22" : "transparent", border:"none", borderBottom:"1px solid " + th.border, cursor:"pointer", textAlign:"left" }}>
                      <span style={{ fontSize:20 }}>{sp.emoji}</span>
                      <span style={{ fontSize:14, color:th.white, flex:1 }}>{sp.name}</span>
                      {selected ? <span style={{ color:th.green, fontSize:16, fontWeight:700 }}>✓</span> : null}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:12, color:th.muted, margin:"12px 0 6px" }}>Not listed? Type your own:</div>
              <input value={customSpecies} onChange={function(e) { setCustomSpecies(e.target.value); }} placeholder="e.g. Hybrid sunfish" style={inputStyle} />
              <button type="button" onClick={function() { var n = customSpecies.trim(); if (n) setF("species", n); }} disabled={!customSpecies.trim()} style={{ width:"100%", background:customSpecies.trim() ? th.blue + "33" : th.border, color:customSpecies.trim() ? th.blue : th.muted, border:"1px solid " + (customSpecies.trim() ? th.blue : th.border), borderRadius:8, padding:"9px 0", cursor:customSpecies.trim() ? "pointer" : "not-allowed", fontSize:13, fontWeight:600, marginBottom:12 }}>
                Use custom species name
              </button>
              <button onClick={function() { if (form.length) setStep(4); else { setF("length", ""); setStep(4); } }} disabled={!form.species} style={{ width:"100%", background:form.species ? th.green : th.border, color:form.species ? "#000" : th.muted, border:"none", borderRadius:8, padding:"11px 0", cursor:form.species ? "pointer" : "not-allowed", fontSize:14, fontWeight:700 }}>
                {form.species ? "Continue → Catch Details" : "Select a species to continue"}
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>Catch Details</div>
              {photo ? (
                <Card T={T} borderColor={th.green + "44"} style={{ marginBottom:14 }}>
                  <SecLabel text="Already captured from your photo" T={T} />
                  {form.species ? (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:th.muted, marginBottom:2 }}>
                        Species{aiResult && aiResult.confidence ? " · AI " + aiResult.confidence + "% confident" : ""}
                      </div>
                      <div style={{ fontSize:16, color:th.white, fontWeight:700 }}>{form.species}</div>
                      <button type="button" onClick={function() { setStep(3); setSpeciesSearch(""); }} style={{ marginTop:6, background:"transparent", border:"none", color:th.green, cursor:"pointer", fontSize:12, padding:0, textDecoration:"underline" }}>Change species</button>
                    </div>
                  ) : null}
                  {form.length ? (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:th.muted, marginBottom:2 }}>Length · from ruler measure</div>
                      <div style={{ fontSize:16, color:th.white, fontWeight:700 }}>{form.length}</div>
                      <button type="button" onClick={function() { setStep(2); }} style={{ marginTop:6, background:"transparent", border:"none", color:th.green, cursor:"pointer", fontSize:12, padding:0, textDecoration:"underline" }}>Adjust measurement</button>
                    </div>
                  ) : null}
                  {form.date ? (
                    <div style={{ marginBottom:4 }}>
                      <div style={{ fontSize:11, color:th.muted, marginBottom:2 }}>Date · from photo metadata</div>
                      <div style={{ fontSize:14, color:th.white }}>{form.date}</div>
                    </div>
                  ) : null}
                </Card>
              ) : (
                ["species","length","spot","date"].map(function(k) {
                  return (
                    <div key={k}>
                      <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>{k.charAt(0).toUpperCase() + k.slice(1)}</div>
                      <input value={form[k]} onChange={function(e) { setF(k, e.target.value); }} style={inputStyle} />
                    </div>
                  );
                })
              )}
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>
                  Location name{spotMetaSource ? " · " + spotMetaSource : photo ? " · name this spot" : ""}
                </div>
                <input value={form.spot} onChange={function(e) { setF("spot", e.target.value); setSpotMetaSource(""); }} placeholder="e.g. Busse south cove" style={inputStyle} />
                {photo && spotMetaSource ? (
                  <div style={{ fontSize:11, color:th.muted, marginTop:-6, marginBottom:10, lineHeight:1.45 }}>Pre-filled from your photo. Edit the name if you want something easier to remember.</div>
                ) : null}
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Bait used</div>
                {form.species && baitChipsForSpecies(form.species).length ? (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                    {baitChipsForSpecies(form.species).map(function(b) {
                      var on = form.bait === b;
                      return (
                        <button key={b} type="button" onClick={function() { setF("bait", b); }} style={{ background:on ? th.green + "33" : "transparent", border:"1px solid " + (on ? th.green : th.border), borderRadius:20, color:on ? th.green : th.muted, padding:"5px 12px", cursor:"pointer", fontSize:11 }}>{b}</button>
                      );
                    })}
                  </div>
                ) : null}
                <input value={form.bait} onChange={function(e) { setF("bait", e.target.value); }} placeholder={photo ? "What did you catch it on?" : ""} style={inputStyle} />
              </div>
              {estWeightLabel ? <div style={{ fontSize:11, color:th.muted, marginBottom:12, fontStyle:"italic" }}>Est. weight: {estWeightLabel} (length-weight formula)</div> : null}
              {gear.length > 0 ? (
                <div>
                  <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Rod Used</div>
                  <select value={form.rod} onChange={function(e) { setF("rod", e.target.value); }} style={Object.assign({}, inputStyle, { background:th.card })}>
                    <option value="">Select rod...</option>
                    {gear.map(function(g, i) { return <option key={i} value={g.nickname || g.brand}>{g.nickname || (g.brand + " " + g.model)}</option>; })}
                  </select>
                </div>
              ) : null}
              <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Notes (optional)</div>
              <input value={form.notes} onChange={function(e) { setF("notes", e.target.value); }} placeholder="Technique, conditions..." style={inputStyle} />
              <button onClick={function() { setStep(5); }} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700 }}>Review</button>
            </div>
          )}

          {step === 5 && (
            <div>
              <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>Review Your Catch</div>
              {photo ? <img src={photo} alt="catch" style={{ width:"100%", borderRadius:10, marginBottom:12, maxHeight:180, objectFit:"cover" }} /> : null}
              <Card T={T}>
                {[["Species",form.species],["Length",form.length],["Est. Weight",estWeightLabel],["Bait",form.bait],["Rod",form.rod],["Spot",form.spot],["Date",form.date],["Notes",form.notes]].filter(function(r) { return r[1]; }).map(function(r, i) {
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:6, paddingBottom:6, borderBottom:"1px solid " + th.border }}>
                      <span style={{ fontSize:12, color:th.muted }}>{r[0]}</span>
                      <span style={{ fontSize:12, color:th.white, textAlign:"right", maxWidth:"60%" }}>{r[1]}</span>
                    </div>
                  );
                })}
              </Card>
              {speciesAlertFor(form.species) ? (
                <Card T={T} borderColor={th.orange + "44"} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12, color:th.orange, lineHeight:1.5 }}>⚠️ {speciesAlertFor(form.species)}</div>
                </Card>
              ) : null}
              <Card T={T} borderColor={th.blue + "44"} style={{ marginBottom:10 }}>
                <div style={{ fontSize:12, color:th.muted, marginBottom:8 }}>Who can see this catch?</div>
                <div style={{ display:"flex", gap:8 }}>
                  <button type="button" onClick={function() { setCatchVisibility("private"); }} style={{ flex:1, background:catchVisibility === "private" ? th.green + "33" : "transparent", border:"1px solid " + (catchVisibility === "private" ? th.green : th.border), borderRadius:8, color:catchVisibility === "private" ? th.green : th.muted, padding:"8px", cursor:"pointer", fontSize:12, fontWeight:catchVisibility === "private" ? 700 : 400 }}>Private (just me)</button>
                  <button type="button" onClick={function() { setCatchVisibility("club"); }} style={{ flex:1, background:catchVisibility === "club" ? th.gold + "33" : "transparent", border:"1px solid " + (catchVisibility === "club" ? th.gold : th.border), borderRadius:8, color:catchVisibility === "club" ? th.gold : th.muted, padding:"8px", cursor:"pointer", fontSize:12, fontWeight:catchVisibility === "club" ? 700 : 400 }}>Share with club</button>
                </div>
                {!authMember && catchVisibility === "club" ? <div style={{ fontSize:11, color:th.orange, marginTop:8 }}>Sign in to share with the club feed.</div> : null}
              </Card>
              <button onClick={submitCatch} disabled={cloudSaving} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:cloudSaving ? "wait" : "pointer", fontSize:14, fontWeight:700, marginBottom:8, opacity:cloudSaving ? 0.7 : 1 }}>{cloudSaving ? "Saving to cloud…" : (catchVisibility === "club" ? "Save & share with club" : "Save catch (private)")}</button>
              <OBtn label="Edit" onClick={function() { setStep(4); }} color={th.muted} style={{ width:"100%", boxSizing:"border-box" }} />
            </div>
          )}

          {step === 6 && (
            <TrophyScreen
              T={T}
              form={form}
              photo={photo}
              estWeightLabel={estWeightLabel}
              catchVisibility={catchVisibility}
              catches={catches}
              onOpenClubFeed={onOpenClubFeed}
              rfcLink={rfcLink}
              onReset={function() {
                setStep(0); setPhoto(null); setPhotoB64(null); setAiResult(null);
                setSpeciesSearch(""); setSpotMetaSource(""); setCustomSpecies("");
                setCatchVisibility("private");
                setForm({ species:"", length:"", bait:"", spot:"", rod:"", notes:"", date:new Date().toLocaleDateString() });
              }}
            />
          )}
        </div>
    </div>
  );
}

// ─── LEARN TAB ────────────────────────────────────────────────────────────────
function LearnTab({ T }) {
  const th = THEMES[T];
  const [sel, setSel] = useState(null);
  if (sel !== null) {
    var L = LESSONS[sel];
    return (
      <div>
        <OBtn label="Back" onClick={function() { setSel(null); }} color={th.green} style={{ margin:"12px 0 10px" }} />
        <div style={{ fontSize:20, color:th.white, fontWeight:700, marginBottom:14 }}>{L.emoji} {L.title}</div>
        {L.subs.map(function(s, i) {
          return (
            <Card key={i} T={T}>
              <div style={{ fontWeight:700, color:th.green, fontSize:13, marginBottom:6 }}>{s.sub}</div>
              <div style={{ fontSize:13, color:th.white, lineHeight:1.8, marginBottom:s.yt ? 10 : 0 }}>{s.text}</div>
              {s.yt ? (
                <a href={s.yt} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:th.red + "22", border:"1px solid " + th.red + "44", borderRadius:6, padding:"6px 12px", textDecoration:"none" }}>
                  <span style={{ fontSize:13, color:th.red, fontWeight:700 }}>▶ Watch Tutorial on YouTube</span>
                </a>
              ) : null}
            </Card>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <SecLabel text="Fishing School — All Levels" T={T} />
      {LESSONS.map(function(l, i) {
        return (
          <button key={i} onClick={function() { setSel(i); }} style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:14, cursor:"pointer", textAlign:"left", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:15, color:th.white, fontWeight:700 }}>{l.emoji} {l.title}</div>
              <div style={{ fontSize:11, color:th.muted, marginTop:3 }}>{l.subs.length} topics · includes video tutorials</div>
            </div>
            <span style={{ color:th.green, fontSize:20 }}>›</span>
          </button>
        );
      })}
      <Card T={T} borderColor={th.gold + "44"}>
        <div style={{ fontSize:13, color:th.gold, fontWeight:700, marginBottom:6 }}>New to Fishing?</div>
        <div style={{ fontSize:12, color:th.white, lineHeight:1.7 }}>Start with Perch or Crappie. They are forgiving, fun, and will teach you everything. Master one species before chasing all of them.</div>
      </Card>
    </div>
  );
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────────
function ProfileTab({ profile, setProfile, theme, setTheme, T, goMyPrivateSpots, authUser, authMember, authLoading, authError, onSignIn, onSendLink, onCompleteLink, pendingLinkHref, onSignOut, onOAuthSignIn, clubMembers, clubMembersLoading, localRoster, onLoadSeedRoster, onImportRosterCsv, rosterImportError, rosterImportBusy }) {
  const th = THEMES[T];
  const [view, setView] = useState("main");
  const [form, setForm] = useState(normalizeProfile(profile));
  const [saved, setSaved] = useState(false);
  const [signInEmail, setSignInEmail] = useState((profile && profile.email) || "");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInLocalError, setSignInLocalError] = useState("");
  const [signInMode, setSignInMode] = useState("link");
  const [showPassword, setShowPassword] = useState(false);
  const [linkSentEmail, setLinkSentEmail] = useState("");
  const [rosterHealth, setRosterHealth] = useState(null);
  const [newGear, setNewGear] = useState({ nickname:"", brand:"", model:"", length:"", power:"", action:"", reel:"", line_type:"Monofilament", line_weight:"", leader_type:"", leader_weight:"", notes:"" });

  useEffect(function() {
    setForm(normalizeProfile(profile));
  }, [profile]);

  useEffect(function() {
    checkRosterHealth().then(setRosterHealth);
  }, [authUser ? authUser.uid : null]);

  useEffect(function() {
    if (authMember && authMember.email) setSignInEmail(authMember.email);
  }, [authMember]);

  useEffect(function() {
    if (!pendingLinkHref || authUser) return;
    setSignInMode("link-completing");
    setSignInBusy(true);
    onCompleteLink("", pendingLinkHref).catch(function(err) {
      if (err && err.needsEmail) {
        setSignInMode("link-confirm");
      } else {
        setSignInLocalError(translateAuthError(err));
        setSignInMode("link");
      }
    }).finally(function() { setSignInBusy(false); });
  }, [pendingLinkHref]);

  function setF(k, v) { setForm(function(f) { return Object.assign({}, f, { [k]: v }); }); }
  function setG(k, v) { setNewGear(function(g) { return Object.assign({}, g, { [k]: v }); }); }
  function save() {
    setProfile(function(p) {
      var prev = normalizeProfile(p);
      return normalizeProfile(Object.assign({}, prev, form, { privateSpots:prev.privateSpots, spotActivityLog:prev.spotActivityLog, memberId:prev.memberId }));
    });
    setSaved(true);
    setTimeout(function() { setSaved(false); }, 2000);
  }
  function toggleSp(s) {
    var favSp = form.favSpecies || [];
    setF("favSpecies", favSp.includes(s) ? favSp.filter(function(x) { return x !== s; }) : favSp.concat([s]));
  }
  function addGear() {
    if (!newGear.brand) return;
    setF("gear", (form.gear || []).concat([newGear]));
    setNewGear({ nickname:"", brand:"", model:"", length:"", power:"", action:"", reel:"", line_type:"Monofilament", line_weight:"", leader_type:"", leader_weight:"", notes:"" });
  }
  function removeGear(i) { setF("gear", form.gear.filter(function(_, idx) { return idx !== i; })); }

  var iStyle = { width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"9px 12px", color:th.white, fontSize:13, boxSizing:"border-box", outline:"none", marginBottom:10 };
  var pwInputStyle = Object.assign({}, iStyle, { marginBottom:0, paddingRight:44 });
  var eyeBtnStyle = { position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", cursor:"pointer", color:th.muted, fontSize:12, padding:"0 2px", lineHeight:1 };

  if (view === "gear") {
    return (
      <div>
        <OBtn label="Back" onClick={function() { setView("main"); save(); }} color={th.green} style={{ margin:"12px 0 10px" }} />
        <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>My Gear</div>
        {(form.gear || []).map(function(g, i) {
          return (
            <Card key={i} T={T} borderColor={th.green + "44"}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontWeight:700, color:th.white, fontSize:13 }}>{g.nickname || (g.brand + " " + g.model)}</div>
                  <div style={{ fontSize:11, color:th.muted }}>{g.length} · {g.power} · {g.action}</div>
                  <div style={{ fontSize:11, color:th.green, marginTop:3 }}>Line: {g.line_weight} {g.line_type}</div>
                  {g.reel ? <div style={{ fontSize:11, color:th.muted }}>Reel: {g.reel}</div> : null}
                  {g.notes ? <div style={{ fontSize:11, color:th.muted, fontStyle:"italic" }}>{g.notes}</div> : null}
                </div>
                <button onClick={function() { removeGear(i); }} style={{ background:"transparent", border:"none", color:th.red, cursor:"pointer", fontSize:18 }}>✕</button>
              </div>
            </Card>
          );
        })}
        <Card T={T} borderColor={th.blue + "44"}>
          <SecLabel text="Add New Rod / Setup" T={T} />
          {[{label:"Nickname (e.g. My Trout Rod)",k:"nickname"},{label:"Rod Brand",k:"brand"},{label:"Rod Model",k:"model"},{label:"Length",k:"length"},{label:"Power (UL/L/M/MH/H)",k:"power"},{label:"Action (Fast/Moderate)",k:"action"},{label:"Reel Brand + Model",k:"reel"},{label:"Line Weight (lb)",k:"line_weight"},{label:"Leader Type",k:"leader_type"},{label:"Leader Weight",k:"leader_weight"},{label:"Notes",k:"notes"}].map(function(f) {
            return (
              <div key={f.k}>
                <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>{f.label}</div>
                <input value={newGear[f.k]} onChange={function(e) { setG(f.k, e.target.value); }} style={iStyle} />
              </div>
            );
          })}
          <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Line Type</div>
          <select value={newGear.line_type} onChange={function(e) { setG("line_type", e.target.value); }} style={Object.assign({}, iStyle, { background:th.card })}>
            {["Monofilament","Fluorocarbon","Braid"].map(function(l) { return <option key={l} value={l}>{l}</option>; })}
          </select>
          <button onClick={addGear} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700 }}>+ Add to My Gear</button>
        </Card>
      </div>
    );
  }

  function translateAuthError(err) {
    var code = err && err.code ? err.code : "";
    if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
      return "That email or password didn't work. Double-check what you typed and try again.";
    }
    if (code === "auth/too-many-requests") {
      return "You've tried too many times. Wait a few minutes, then try again. Or tap \"Forgot your password?\" below.";
    }
    if (code === "auth/user-disabled") {
      return "Your account has been turned off. Ask the club president for help.";
    }
    if (code === "auth/network-request-failed") {
      return "Can't connect to the internet. Check your Wi-Fi or cell signal, then try again.";
    }
    if (code === "auth/weak-password") {
      return "Your password needs to be at least 10 characters long. Try making it longer.";
    }
    return (err && err.message) ? err.message : "Something went wrong. Try again.";
  }

  function handleSendLinkClick() {
    setSignInLocalError("");
    if (!signInEmail) { setSignInLocalError("Type your email address first."); return; }
    setSignInBusy(true);
    onSendLink(signInEmail).then(function() {
      setLinkSentEmail(signInEmail);
      setSignInMode("link-sent");
    }).catch(function(err) {
      setSignInLocalError(translateAuthError(err));
    }).finally(function() { setSignInBusy(false); });
  }

  function handleCompleteLinkClick() {
    setSignInLocalError("");
    if (!signInEmail) { setSignInLocalError("Type your email address first."); return; }
    setSignInBusy(true);
    onCompleteLink(signInEmail, pendingLinkHref).catch(function(err) {
      setSignInLocalError(translateAuthError(err));
    }).finally(function() { setSignInBusy(false); });
  }

  function handlePasswordSignInClick() {
    setSignInLocalError("");
    setSignInBusy(true);
    onSignIn(signInEmail, signInPassword).catch(function(err) {
      setSignInLocalError(translateAuthError(err));
    }).finally(function() { setSignInBusy(false); });
  }

  var displayName = authMember ? authMember.displayName : (form.name || "Your Profile");
  var displayEmail = authMember ? authMember.email : form.email;

  return (
    <div>
      <div style={{ textAlign:"center", padding:"16px 0 12px" }}>
        <div style={{ fontSize:44 }}>{authUser ? "🎣" : "👤"}</div>
        <div style={{ fontSize:18, color:th.white, fontWeight:700, marginTop:4 }}>{displayName}</div>
        {authMember ? <div style={{ fontSize:11, color:th.muted, marginTop:4 }}>Member ID: {authMember.id}</div> : null}
      </div>

      <Card T={T} borderColor={authUser ? th.green + "55" : th.orange + "55"}>
        <SecLabel text={authUser ? "You're signed in!" : signInMode === "link-sent" ? "Check your email!" : signInMode === "link-confirm" ? "One more step" : signInMode === "password" ? "Sign in with password" : "Sign in to RFC Fishing"} T={T} />
        {authLoading ? (
          <div style={{ fontSize:13, color:th.muted }}>Checking sign-in…</div>
        ) : authUser && authMember ? (
          <div>
            <div style={{ fontSize:13, color:th.white, marginBottom:8 }}>{displayEmail}</div>
            <div style={{ fontSize:11, color:th.muted, marginBottom:10, lineHeight:1.5 }}>Your catches and spots are saved to the cloud. You can open the app on any phone or computer and see the same data.</div>
            {profile.cloudSyncedAt ? <div style={{ fontSize:10, color:th.green, marginBottom:8 }}>Last cloud sync: {new Date(profile.cloudSyncedAt).toLocaleString()}</div> : null}
            <button type="button" onClick={onSignOut} style={{ width:"100%", background:"transparent", border:"1px solid " + th.border, borderRadius:8, padding:"10px 0", cursor:"pointer", fontSize:13, color:th.muted }}>Sign out</button>
          </div>
        ) : signInMode === "link-completing" ? (
          <div style={{ fontSize:13, color:th.muted, paddingBottom:8 }}>Signing you in…</div>
        ) : signInMode === "link-sent" ? (
          <div>
            <div style={{ fontSize:13, color:th.white, marginBottom:10, lineHeight:1.6 }}>
              We sent a link to <strong>{linkSentEmail}</strong>.<br />Open your email, tap the link, and you'll be signed in automatically.
            </div>
            <div style={{ fontSize:11, color:th.muted, marginBottom:14, lineHeight:1.5 }}>
              Don't see it? Check your spam folder. The link is good for 1 hour.
            </div>
            <button type="button" onClick={function() { setSignInMode("link"); setSignInLocalError(""); setLinkSentEmail(""); }} style={{ background:"transparent", border:"none", color:th.muted, cursor:"pointer", fontSize:12, padding:0 }}>
              Start over
            </button>
          </div>
        ) : signInMode === "link-confirm" ? (
          <div>
            <div style={{ fontSize:11, color:th.muted, marginBottom:12, lineHeight:1.5 }}>
              Looks like you opened the link on a different device. Just type your club email below and we'll finish signing you in.
            </div>
            <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Your club email</div>
            <input type="email" value={signInEmail} onChange={function(e) { setSignInEmail(e.target.value.replace(/\s+/g, "").toLowerCase()); }} placeholder="you@email.com" style={iStyle} autoComplete="email" />
            {(signInLocalError || authError) ? <div style={{ fontSize:12, color:th.red, marginBottom:8 }}>{signInLocalError || authError}</div> : null}
            <button type="button" onClick={handleCompleteLinkClick} disabled={signInBusy} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:signInBusy ? "wait" : "pointer", fontSize:14, fontWeight:700, opacity:signInBusy ? 0.7 : 1 }}>
              {signInBusy ? "Signing in…" : "Sign me in"}
            </button>
          </div>
        ) : signInMode === "password" ? (
          <div>
            <div style={{ fontSize:11, color:th.muted, marginBottom:10, lineHeight:1.5 }}>Type the email address you gave the club and your password.</div>
            <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Email</div>
            <input type="email" value={signInEmail} onChange={function(e) { setSignInEmail(e.target.value.replace(/\s+/g, "").toLowerCase()); }} placeholder="you@email.com" style={iStyle} autoComplete="email" />
            <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Password</div>
            <div style={{ position:"relative", marginBottom:10 }}>
              <input type={showPassword ? "text" : "password"} value={signInPassword} onChange={function(e) { setSignInPassword(e.target.value); }} placeholder="Password" style={pwInputStyle} autoComplete="current-password" />
              <button type="button" onClick={function() { setShowPassword(function(v) { return !v; }); }} style={eyeBtnStyle}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            {(signInLocalError || authError) ? <div style={{ fontSize:12, color:th.red, marginBottom:8 }}>{signInLocalError || authError}</div> : null}
            <button type="button" onClick={handlePasswordSignInClick} disabled={signInBusy} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:signInBusy ? "wait" : "pointer", fontSize:14, fontWeight:700, opacity:signInBusy ? 0.7 : 1 }}>
              {signInBusy ? "Signing in…" : "Sign In"}
            </button>
            <div style={{ textAlign:"center", marginTop:12 }}>
              <button type="button" onClick={function() { setSignInMode("link"); setSignInLocalError(""); setSignInPassword(""); }} style={{ background:"transparent", border:"none", color:th.blue, cursor:"pointer", fontSize:12, padding:0 }}>
                Send me a sign-in link instead
              </button>
            </div>
          </div>
        ) : (
          <div>
            {rosterHealth && rosterHealth.message ? (
              <div style={{ fontSize:11, color:rosterHealth.ok ? th.green : th.orange, marginBottom:10, lineHeight:1.5 }}>
                {rosterHealth.ok ? "✓ " : "⚠ "}{rosterHealth.message}
              </div>
            ) : null}
            <div style={{ fontSize:11, color:th.muted, marginBottom:12, lineHeight:1.6 }}>
              Type your club email address below. We'll send you a link — tap it and you're in. No password needed.
            </div>
            <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Your club email</div>
            <input type="email" value={signInEmail} onChange={function(e) { setSignInEmail(e.target.value.replace(/\s+/g, "").toLowerCase()); }} placeholder="you@email.com" style={iStyle} autoComplete="email" />
            {(signInLocalError || authError) ? <div style={{ fontSize:12, color:th.red, marginBottom:8 }}>{signInLocalError || authError}</div> : null}
            <button type="button" onClick={handleSendLinkClick} disabled={signInBusy} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:signInBusy ? "wait" : "pointer", fontSize:14, fontWeight:700, opacity:signInBusy ? 0.7 : 1 }}>
              {signInBusy ? "Sending…" : "Send me a sign-in link"}
            </button>
            <div style={{ textAlign:"center", marginTop:12 }}>
              <button type="button" onClick={function() { setSignInMode("password"); setSignInLocalError(""); }} style={{ background:"transparent", border:"none", color:th.muted, cursor:"pointer", fontSize:12, padding:0 }}>
                I have a password — sign in with password
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card T={T} borderColor={th.gold + "44"}>
        <SecLabel text={"Club roster (" + (localRoster || []).length + " local)"} T={T} />
        <div style={{ fontSize:11, color:th.muted, marginBottom:8, lineHeight:1.5 }}>
          Import members for sharing pickers. Sign-in uses live Firebase roster (rfc-management). Saved on this device until cloud sync.
        </div>
        {rosterImportError ? <div style={{ fontSize:12, color:th.red, marginBottom:8 }}>{rosterImportError}</div> : null}
        <button type="button" disabled={rosterImportBusy} onClick={onLoadSeedRoster} style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"9px 0", cursor:"pointer", fontSize:12, color:th.white, marginBottom:8 }}>
          Load seed roster (Adam)
        </button>
        <label style={{ display:"block", width:"100%", background:th.green, color:"#000", borderRadius:8, padding:"9px 0", cursor:"pointer", fontSize:12, fontWeight:700, textAlign:"center" }}>
          {rosterImportBusy ? "Importing…" : "Import roster CSV"}
          <input type="file" accept=".csv,text/csv" style={{ display:"none" }} onChange={function(e) {
            var f = e.target.files && e.target.files[0];
            if (f && onImportRosterCsv) onImportRosterCsv(f);
            e.target.value = "";
          }} />
        </label>
        {!authUser && (localRoster || []).length ? (
          <div style={{ maxHeight:160, overflowY:"auto", marginTop:10 }}>
            {(localRoster || []).map(function(m) {
              return (
                <div key={m.id} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid " + th.border, fontSize:11 }}>
                  <span style={{ color:th.white }}>{m.name}</span>
                  <span style={{ color:th.muted }}>{m.email || m.id}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      {authUser ? (
        <Card T={T} borderColor={th.blue + "44"}>
          <SecLabel text={"Club members (" + (clubMembersLoading ? "…" : String((clubMembers || []).length)) + ")"} T={T} />
          {clubMembersLoading ? (
            <div style={{ fontSize:12, color:th.muted }}>Loading roster…</div>
          ) : (clubMembers || []).length ? (
            <div style={{ maxHeight:200, overflowY:"auto" }}>
              {(clubMembers || []).map(function(m) {
                return (
                  <div key={m.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid " + th.border, fontSize:12 }}>
                    <span style={{ color:th.white }}>{m.displayName || m.id}</span>
                    <span style={{ color:th.muted, fontSize:10 }}>{m.id}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize:12, color:th.muted }}>No members loaded — check Firestore rules or roster import.</div>
          )}
        </Card>
      ) : null}

      <Card T={T}>
        <SecLabel text="Your Info" T={T} />
        <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Name</div>
        <input value={form.name || ""} onChange={function(e) { setF("name", e.target.value); }} placeholder="First name or nickname" style={iStyle} />
        <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Email</div>
        <input type="email" value={form.email || ""} onChange={function(e) { setF("email", e.target.value); }} placeholder="your@email.com" style={iStyle} />
        <div style={{ fontSize:12, color:th.muted, marginBottom:6 }}>Experience Level</div>
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          {["Beginner","Intermediate","Experienced"].map(function(l) {
            return (
              <button key={l} onClick={function() { setF("level", l); }} style={{ flex:1, background:form.level===l ? th.green + "33" : "transparent", border:"1px solid " + (form.level===l ? th.green : th.border), borderRadius:8, color:form.level===l ? th.green : th.muted, padding:"7px 4px", cursor:"pointer", fontSize:11 }}>
                {l}
              </button>
            );
          })}
        </div>
        <button onClick={save} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700 }}>
          {saved ? "✓ Saved!" : "Save Profile"}
        </button>
      </Card>

      <button onClick={function() { setView("gear"); }} style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:14, cursor:"pointer", textAlign:"left", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:14, color:th.white, fontWeight:700 }}>My Gear</div>
          <div style={{ fontSize:11, color:th.muted, marginTop:2 }}>{(form.gear || []).length} rod{(form.gear || []).length !== 1 ? "s" : ""} saved</div>
        </div>
        <span style={{ color:th.green, fontSize:20 }}>›</span>
      </button>

      <button type="button" onClick={function() { if (typeof goMyPrivateSpots === "function") goMyPrivateSpots(); }} style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:14, cursor:"pointer", textAlign:"left", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:14, color:th.white, fontWeight:700 }}>My Private Spots</div>
          <div style={{ fontSize:11, color:th.muted, marginTop:2 }}>{(profile && profile.privateSpots && profile.privateSpots.length) || 0} saved · sharing controls</div>
        </div>
        <span style={{ color:th.green, fontSize:20 }}>›</span>
      </button>

      <Card T={T}>
        <SecLabel text="Favorite Species (for home feed)" T={T} />
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {SPECIES.map(function(sp) {
            var favSp = form.favSpecies || [];
            return (
              <button key={sp.id} onClick={function() { toggleSp(sp.name); }} style={{ background:favSp.includes(sp.name) ? sp.color + "33" : "transparent", border:"1px solid " + (favSp.includes(sp.name) ? sp.color : th.border), borderRadius:20, color:favSp.includes(sp.name) ? sp.color : th.muted, padding:"5px 12px", cursor:"pointer", fontSize:12 }}>
                {sp.emoji} {sp.name}
              </button>
            );
          })}
        </div>
        <button onClick={save} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"10px 0", cursor:"pointer", fontSize:13, fontWeight:700, marginTop:10 }}>Save Favorites</button>
      </Card>

      <Card T={T}>
        <SecLabel text="App Theme" T={T} />
        <div style={{ display:"flex", gap:8 }}>
          {[{id:"dark",label:"🌙 Dark"},{id:"light",label:"☀️ Light"},{id:"bluesteel",label:"🌊 Blue Steel"}].map(function(t) {
            return (
              <button key={t.id} onClick={function() { setTheme(t.id); }} style={{ flex:1, background:theme===t.id ? th.green + "33" : "transparent", border:"1px solid " + (theme===t.id ? th.green : th.border), borderRadius:8, color:theme===t.id ? th.green : th.muted, padding:"8px 4px", cursor:"pointer", fontSize:11 }}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize:10, color:th.muted, marginTop:6 }}>More themes coming in a future update.</div>
      </Card>

      <Card T={T} borderColor={th.blue + "44"}>
        <SecLabel text="Download my data" T={T} />
        <div style={{ fontSize:12, color:th.muted, lineHeight:1.5, marginBottom:10 }}>Export profile, catches, and scout history as a JSON backup file.</div>
        <button type="button" onClick={function() { exportProfileDataJson(profile); }} style={{ width:"100%", background:th.blue + "22", color:th.blue, border:"1px solid " + th.blue + "55", borderRadius:8, padding:"10px 0", cursor:"pointer", fontSize:13, fontWeight:700 }}>Download my data</button>
      </Card>

      <Card T={T}>
        <SecLabel text="Security and Privacy" T={T} />
        {[["Roster only","Only uploaded RFC members can sign in."],["Passwords","Hashed by Firebase — never stored in the app."],["Cloud sync","Signed-in data saves to RFC Firebase (rfc-management)."],["No ad tracking","Zero third-party analytics."]].map(function(item, i) {
          return (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
              <span style={{ color:th.green }}>✓</span>
              <div><div style={{ fontSize:12, color:th.white, fontWeight:600 }}>{item[0]}</div><div style={{ fontSize:11, color:th.muted }}>{item[1]}</div></div>
            </div>
          );
        })}
      </Card>

      <Card T={T} borderColor={th.blue + "44"}>
        <SecLabel text="Install on Your iPhone" T={T} />
        <div style={{ fontSize:13, color:th.white, lineHeight:1.8 }}>Open in Safari, tap the Share button (box with arrow), then tap Add to Home Screen. You get a real app icon — no App Store needed.</div>
      </Card>
    </div>
  );
}

// ─── SCOUT TAB ────────────────────────────────────────────────────────────────
function ScoutTab({ T, profile, setProfile, goMyPrivateSpots }) {
  var th = THEMES[T];
  var fileRef = useRef();
  var [section, setSection] = useState("near");
  var [scoutPhoto, setScoutPhoto] = useState(null);
  var [scoutB64, setScoutB64] = useState(null);
  var [scoutLoading, setScoutLoading] = useState(false);
  var [scoutResult, setScoutResult] = useState(null);
  var [gpsLoading, setGpsLoading] = useState(true);
  var [userPos, setUserPos] = useState({ lat:41.84, lng:-87.83 });
  var [history, setHistory] = useState(loadScoutHistory);
  var season = getSeason(new Date().getMonth());

  useEffect(function() {
    setGpsLoading(true);
    if (!navigator.geolocation) { setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      function(pos) { setUserPos({ lat:pos.coords.latitude, lng:pos.coords.longitude }); setGpsLoading(false); },
      function() { setGpsLoading(false); },
      { timeout:8000, enableHighAccuracy:true }
    );
  }, []);

  var nearSpots = SCOUT_SPOTS.map(function(s) {
    return Object.assign({}, s, { distMi: haversineMi(userPos.lat, userPos.lng, s.lat, s.lng) });
  }).filter(function(s) { return s.distMi <= 10; }).sort(function(a, b) { return a.distMi - b.distMi; });

  function handleScoutPhoto(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    readImageFileScout(f).then(function(img) {
      setScoutPhoto(img.full);
      setScoutB64(img.b64);
      setScoutResult(null);
      setScoutLoading(true);
      fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:600,
          messages:[{
            role:"user",
            content:[
              { type:"image", source:{ type:"base64", media_type:img.type || "image/jpeg", data:img.b64 } },
              { type:"text", text:"You are a fishing location identification expert for Chicago metro (DPR, Cal-Sag, Salt Creek, Lake Michigan). Return ONLY raw JSON: {\"confidence\":85,\"location\":\"Des Plaines River — Summit\",\"waterType\":\"River\",\"lat\":41.778,\"lng\":-87.815,\"species\":[\"Largemouth Bass\"],\"reasoning\":\"brief\",\"bait1\":\"rig + bait\",\"bait2\":\"second option\",\"cannotIdentify\":false}. If unknown set cannotIdentify true and blank other fields." },
            ],
          }],
        }),
      }).then(function(r) { return r.json(); }).then(function(data) {
        var txt = (data.content && data.content[0] && data.content[0].text) || "";
        var m = txt.match(/\{[\s\S]*\}/);
        var parsed = m ? JSON.parse(m[0]) : { cannotIdentify:true };
        setScoutResult(parsed);
        if (!parsed.cannotIdentify) {
          saveScoutHistoryEntry({ at:new Date().toISOString(), location:parsed.location, confidence:parsed.confidence });
          setHistory(loadScoutHistory());
        }
      }).catch(function() {
        setScoutResult({ cannotIdentify:true });
      }).finally(function() { setScoutLoading(false); });
    });
    e.target.value = "";
  }

  function readImageFileScout(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        var full = ev.target.result;
        resolve({ full:full, b64:(full && full.split(",")[1]) || "", type:file.type || "image/jpeg" });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function saveScoutToPrivateSpots() {
    if (!scoutResult || scoutResult.cannotIdentify || !setProfile) return;
    var spot = {
      id:"scout_" + Date.now(),
      name:scoutResult.location || "Scout spot",
      lat:parseFloat(scoutResult.lat) || userPos.lat,
      lng:parseFloat(scoutResult.lng) || userPos.lng,
      notes:scoutResult.reasoning || "",
      species_present:scoutResult.species || [],
      shareClub:false,
      sharedWith:[],
      created_at:new Date().toISOString(),
    };
    setProfile(function(p) {
      var base = normalizeProfile(p);
      var spots = (base.privateSpots || []).concat([spot]);
      return Object.assign({}, base, { privateSpots:spots });
    });
    appendSpotActivity(setProfile, "Saved scout result to My Private Spots");
    if (typeof goMyPrivateSpots === "function") goMyPrivateSpots();
  }

  var confColor = scoutResult && scoutResult.confidence >= 70 ? th.green : scoutResult && scoutResult.confidence >= 50 ? th.gold : th.red;

  return (
    <div>
      <div style={{ display:"flex", gap:8, margin:"12px 0" }}>
        <OBtn label="Near Me" onClick={function() { setSection("near"); }} color={section === "near" ? th.green : th.muted} />
        <OBtn label="Identify Spot" onClick={function() { setSection("identify"); }} color={section === "identify" ? th.green : th.muted} />
      </div>

      {section === "identify" ? (
        <div>
          <div style={{ fontSize:18, color:th.white, fontWeight:800, marginBottom:4 }}>🔍 Identify This Spot</div>
          <div style={{ fontSize:12, color:th.muted, marginBottom:12, lineHeight:1.5 }}>Upload any fishing photo — Instagram, TikTok, or your own.</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleScoutPhoto} />
          <button type="button" onClick={function() { fileRef.current && fileRef.current.click(); }} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:10, padding:"14px 0", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
            📷 Upload photo
          </button>
          {scoutPhoto ? <img src={scoutPhoto} alt="scout" style={{ width:"100%", borderRadius:10, marginBottom:12, maxHeight:200, objectFit:"cover" }} /> : null}
          {scoutLoading ? <Card T={T}><div style={{ textAlign:"center", padding:16, color:th.muted }}>Analyzing location…</div></Card> : null}
          {scoutResult && !scoutLoading && scoutResult.cannotIdentify ? (
            <Card T={T} borderColor={th.orange + "55"}>
              <div style={{ fontSize:14, color:th.orange, fontWeight:700, marginBottom:6 }}>Could not identify this location</div>
              <div style={{ fontSize:12, color:th.muted, lineHeight:1.5 }}>Try a photo with a visible bridge, road sign, or landmark.</div>
            </Card>
          ) : null}
          {scoutResult && !scoutLoading && !scoutResult.cannotIdentify ? (
            <Card T={T} borderColor={confColor + "55"}>
              <div style={{ fontSize:11, color:confColor, fontWeight:700, marginBottom:6 }}>{scoutResult.confidence}% confident</div>
              <div style={{ fontSize:17, color:th.white, fontWeight:800, marginBottom:6 }}>{scoutResult.location}</div>
              <Pill label={scoutResult.waterType || "Water"} color={th.blue} />
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, margin:"10px 0" }}>
                {(scoutResult.species || []).map(function(sp, i) { return <Pill key={i} label={sp} color={th.green} />; })}
              </div>
              <div style={{ fontSize:12, color:th.muted, marginBottom:8, lineHeight:1.5 }}>{scoutResult.reasoning}</div>
              <div style={{ fontSize:12, color:th.white, marginBottom:4 }}><strong>Bait 1:</strong> {scoutResult.bait1}</div>
              <div style={{ fontSize:12, color:th.white, marginBottom:10 }}><strong>Bait 2:</strong> {scoutResult.bait2}</div>
              <div style={{ display:"flex", gap:8 }}>
                <a href={mapsUrl(scoutResult.lat, scoutResult.lng).google} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10, color:th.blue, fontSize:12, fontWeight:700, textDecoration:"none" }}>Google Maps</a>
                <a href={mapsUrl(scoutResult.lat, scoutResult.lng).apple} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10, color:th.green, fontSize:12, fontWeight:700, textDecoration:"none" }}>Apple Maps</a>
              </div>
              <button type="button" onClick={saveScoutToPrivateSpots} style={{ width:"100%", marginTop:10, background:th.gold + "22", border:"1px solid " + th.gold, borderRadius:8, padding:"10px 0", color:th.gold, fontWeight:700, cursor:"pointer", fontSize:13 }}>Save to My Private Spots</button>
            </Card>
          ) : null}
        </div>
      ) : (
        <div>
          <div style={{ fontSize:18, color:th.white, fontWeight:800, marginBottom:4 }}>📍 Fishable Water Near You</div>
          <div style={{ fontSize:12, color:th.muted, marginBottom:12 }}>Within 10 miles · sorted nearest first</div>
          {gpsLoading ? <Card T={T}><div style={{ padding:16, color:th.muted, textAlign:"center" }}>Getting your location…</div></Card> : null}
          {!gpsLoading && nearSpots.length === 0 ? (
            <Card T={T}><div style={{ fontSize:13, color:th.muted }}>No scout spots within 10 miles. Try Identify Spot with a photo.</div></Card>
          ) : null}
          {nearSpots.map(function(s, idx) {
            var maps = mapsUrl(s.lat, s.lng);
            return (
              <Card key={idx} T={T} borderColor={th.blue + "33"}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ fontSize:14, color:th.white, fontWeight:700 }}>{s.name}</div>
                  <Pill label={s.waterType} color={th.blue} />
                </div>
                <div style={{ fontSize:12, color:th.green, fontWeight:700, marginBottom:6 }}>{s.distMi.toFixed(1)} mi · {scoutBiteHint(s, season)}</div>
                <div style={{ fontSize:11, color:th.muted, marginBottom:6 }}>🅿️ {s.parking}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                  {s.species.slice(0, 4).map(function(sp, i) { return <Pill key={i} label={sp} color={th.green} />; })}
                </div>
                <div style={{ fontSize:11, color:th.white, lineHeight:1.45, marginBottom:6 }}>{s.tip}</div>
                {s.alert ? <div style={{ fontSize:11, color:th.orange, marginBottom:8 }}>⚠️ {s.alert}</div> : null}
                <div style={{ display:"flex", gap:8 }}>
                  <a href={maps.google} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:8, color:th.blue, fontSize:11, fontWeight:700, textDecoration:"none" }}>Google</a>
                  <a href={maps.apple} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:8, color:th.green, fontSize:11, fontWeight:700, textDecoration:"none" }}>Apple</a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {history.length ? (
        <Card T={T} style={{ marginTop:12 }}>
          <SecLabel text="Recent scout results" T={T} />
          {history.slice(0, 5).map(function(h, i) {
            return <div key={i} style={{ fontSize:11, color:th.muted, marginBottom:4 }}>{h.location} · {h.confidence}%</div>;
          })}
        </Card>
      ) : null}
    </div>
  );
}

// ─── NAV + APP ────────────────────────────────────────────────────────────────
var NAV = [
  {id:"home",emoji:"🏠",label:"Home"},
  {id:"fish",emoji:"🐟",label:"Species"},
  {id:"spots",emoji:"📍",label:"Spots"},
  {id:"catalogue",emoji:"📚",label:"Tackle"},
  {id:"catch",emoji:"📸",label:"Catch"},
  {id:"scout",emoji:"🔍",label:"Scout"},
  {id:"learn",emoji:"📖",label:"Learn"},
];

export default function App() {
  const [tab, setTab] = useState("home");
  const [homeSection, setHomeSection] = useState("forecast");
  const [theme, setTheme] = useState("dark");
  const [spotsOpenSection, setSpotsOpenSection] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authMember, setAuthMember] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [pendingLinkHref, setPendingLinkHref] = useState(null);
  const [clubSpotsNewCount, setClubSpotsNewCount] = useState(0);
  const [clubMembers, setClubMembers] = useState([]);
  const [clubMembersLoading, setClubMembersLoading] = useState(false);
  const [localRoster, setLocalRoster] = useState(function() { return getInitialRoster(); });
  const [rosterImportError, setRosterImportError] = useState("");
  const [rosterImportBusy, setRosterImportBusy] = useState(false);
  const [profile, setProfile] = useState(function() {
    var stored = loadStoredProfile();
    var n = normalizeProfile(stored);
    if (!n.memberId) n.memberId = "mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    return n;
  });
  const [toast, setToast] = useState(null);
  var th = THEMES[theme];
  var cloudSaveTimer = useRef(null);
  var toastTimer = useRef(null);

  var showToast = useCallback(function(message, type) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: message, type: type || "success" });
    toastTimer.current = setTimeout(function() { setToast(null); }, 4500);
  }, []);

  var clearSpotsOpenSection = useCallback(function() { setSpotsOpenSection(null); }, []);
  var goMyPrivateSpots = useCallback(function() { setTab("spots"); setSpotsOpenSection("my_spots"); }, []);
  var openClubFeed = useCallback(function() {
    setHomeSection("feed");
    setTab("home");
  }, []);

  useEffect(function() {
    return subscribeAuthState(function(user, member, errMsg) {
      setAuthUser(user);
      setAuthMember(member);
      setAuthLoading(false);
      setAuthError(errMsg || "");
    });
  }, []);

  useEffect(function() {
    if (!isSignInLink(window.location.href)) return;
    setPendingLinkHref(window.location.href);
    setTab("me");
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(function() {
    if (!authUser || !authMember) return;
    var memberId = authMember.id;
    pullCloudProfile(memberId, profile).then(function(merged) {
      setProfile(function(p) {
        var prev = normalizeProfile(p);
        return normalizeProfile(Object.assign({}, prev, merged, {
          name: authMember.displayName || prev.name,
          email: authMember.email || prev.email,
          memberId: memberId,
          firebaseUid: authUser.uid,
        }));
      });
    }).catch(function() {});
    mergeLocalCatchesToCloud(memberId, JSON.parse(localStorage.getItem("rfc_catches_v1") || "[]")).catch(function() {});
    loadCatchesFromCloud(memberId).then(function(cloudCatches) {
      if (cloudCatches && cloudCatches.length) {
        try { localStorage.setItem("rfc_catches_v1", JSON.stringify(cloudCatches)); } catch (e) {}
      }
    }).catch(function() {});
  }, [authUser ? authUser.uid : null, authMember ? authMember.id : null]);

  useEffect(function() {
    if (!authUser || !authMember) return;
    setClubMembersLoading(true);
    listActiveMembers(150).then(function(list) {
      setClubMembers(list || []);
    }).catch(function() {
      setClubMembers([]);
    }).finally(function() {
      setClubMembersLoading(false);
    });
  }, [authUser ? authUser.uid : null]);

  var handleSignIn = useCallback(function(email, password) {
    return signInMemberEmail(email, password).then(function(result) {
      setAuthUser(result.user);
      setAuthMember(result.member);
      setAuthError("");
    });
  }, []);

  useEffect(function() {
    if (!authMember) { setClubSpotsNewCount(0); return; }
    var seenAt = "";
    try { seenAt = localStorage.getItem("rfc_club_spots_seen_at") || ""; } catch(e) {}
    if (!seenAt) return;
    loadClubSharedSpots().then(function(spots) {
      var count = (spots || []).filter(function(s) {
        return s.created_at && s.created_at > seenAt && s.memberId !== (authMember && authMember.id);
      }).length;
      setClubSpotsNewCount(count);
    }).catch(function() {});
  }, [authMember ? authMember.id : null]);

  var handleMarkClubSpotsSeen = useCallback(function() {
    try { localStorage.setItem("rfc_club_spots_seen_at", new Date().toISOString()); } catch(e) {}
    setClubSpotsNewCount(0);
  }, []);

  var handleSendLink = useCallback(function(email) {
    return sendSignInLink(email);
  }, []);

  var handleCompleteLink = useCallback(function(email, href) {
    var linkHref = href || pendingLinkHref;
    if (email) {
      return completeSignInWithLinkAndEmail(email, linkHref).then(function(result) {
        setAuthUser(result.user);
        setAuthMember(result.member);
        setAuthError("");
        setPendingLinkHref(null);
      });
    }
    return completeSignInWithLink(linkHref).then(function(result) {
      if (result.needsEmail) {
        throw Object.assign(new Error("needsEmail"), { needsEmail: true });
      }
      setAuthUser(result.user);
      setAuthMember(result.member);
      setAuthError("");
      setPendingLinkHref(null);
    });
  }, [pendingLinkHref]);

  var handleSignOut = useCallback(function() {
    signOutMember().then(function() {
      setAuthUser(null);
      setAuthMember(null);
      setClubMembers([]);
      setAuthError("");
    });
  }, []);

  var handleOAuthSignIn = useCallback(function(providerId) {
    return signInMemberOAuth(providerId);
  }, []);

  var handleLoadSeedRoster = useCallback(function() {
    setRosterImportError("");
    setRosterImportBusy(true);
    try {
      var rows = loadSeedRoster();
      setLocalRoster(rows);
    } catch (e) {
      setRosterImportError(e.message || "Seed load failed.");
    } finally {
      setRosterImportBusy(false);
    }
  }, []);

  var handleImportRosterCsv = useCallback(function(file) {
    setRosterImportError("");
    setRosterImportBusy(true);
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var rows = importRosterFromCsvText(String(ev.target.result || ""));
        setLocalRoster(rows);
      } catch (e) {
        setRosterImportError(e.message || "CSV import failed.");
      } finally {
        setRosterImportBusy(false);
      }
    };
    reader.onerror = function() {
      setRosterImportError("Could not read file.");
      setRosterImportBusy(false);
    };
    reader.readAsText(file);
  }, []);

  var sharingRoster = sharingRosterFromSources(clubMembers, localRoster, authMember ? authMember.id : null);

  useEffect(function() {
    persistProfileToStorage(profile);
    if (!authMember || !authMember.id) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(function() {
      syncLocalProfileToCloud(authMember.id, profile).then(function() {
        setProfile(function(p) {
          return Object.assign({}, p, { cloudSyncedAt: new Date().toISOString() });
        });
      }).catch(function(err) {
        showToast("Spots & profile could not sync: " + (err && err.message ? err.message : "unknown error"), "error");
      });
    }, 1500);
    return function() {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    };
  }, [profile, authMember ? authMember.id : null]);

  return (
    <div style={{ background:th.bg, minHeight:"100vh", maxWidth:480, margin:"0 auto", color:th.white, paddingBottom:80, paddingTop:48 }}>
      <SaveToast toast={toast} />
      <div style={{ position:"fixed", top:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:th.nav, borderBottom:"1px solid " + th.border, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", height:48, zIndex:100, backdropFilter:"blur(12px)", boxSizing:"border-box" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:22 }}>🎣</span>
          <span style={{ fontSize:15, fontWeight:700, color:th.white, letterSpacing:0.3 }}>RFC Fishing</span>
        </div>
        <button onClick={function() { setTab("me"); }} style={{ background:"transparent", border:"none", cursor:"pointer", padding:"6px 8px", borderRadius:20 }}>
          <span style={{ fontSize:22 }}>👤</span>
        </button>
      </div>
      <div key={tab} className="tab-content" style={{ padding:"0 14px" }}>
        {tab==="home"      && <HomeTab profile={profile} T={theme} setTab={setTab} authMember={authMember} homeSection={homeSection} setHomeSection={setHomeSection} />}
        {tab==="fish"      && <SpeciesTab T={theme} profile={profile} setTab={setTab} />}
        {tab==="spots"     && <SpotsTab profile={profile} setProfile={setProfile} T={theme} spotsOpenSection={spotsOpenSection} clearSpotsOpenSection={clearSpotsOpenSection} clubRoster={sharingRoster} authMember={authMember} onMarkClubSpotsSeen={handleMarkClubSpotsSeen} />}
        {tab==="catalogue" && <CatalogueTab T={theme} />}
        {tab==="catch"     && <CatchTab key={authMember ? authMember.id : "local"} profile={profile} authMember={authMember} T={theme} onOpenClubFeed={openClubFeed} onSaveToast={showToast} />}
        {tab==="scout"     && <ScoutTab T={theme} profile={profile} setProfile={setProfile} goMyPrivateSpots={goMyPrivateSpots} />}
        {tab==="learn"     && <LearnTab T={theme} />}
        {tab==="me"        && <ProfileTab profile={profile} setProfile={setProfile} theme={theme} setTheme={setTheme} T={theme} goMyPrivateSpots={goMyPrivateSpots} authUser={authUser} authMember={authMember} authLoading={authLoading} authError={authError} onSignIn={handleSignIn} onSendLink={handleSendLink} onCompleteLink={handleCompleteLink} pendingLinkHref={pendingLinkHref} onSignOut={handleSignOut} onOAuthSignIn={handleOAuthSignIn} clubMembers={clubMembers} clubMembersLoading={clubMembersLoading} localRoster={localRoster} onLoadSeedRoster={handleLoadSeedRoster} onImportRosterCsv={handleImportRosterCsv} rosterImportError={rosterImportError} rosterImportBusy={rosterImportBusy} />}
      </div>
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:th.nav, borderTop:"1px solid " + th.border, display:"flex", backdropFilter:"blur(12px)" }}>
        {NAV.map(function(n) {
          var badge = n.id === "spots" && clubSpotsNewCount > 0;
          return (
            <button key={n.id} onClick={function() { if (n.id === "home") setHomeSection("forecast"); setTab(n.id); }} style={{ flex:1, padding:"9px 0 6px", background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:1, borderTop: tab===n.id ? "2px solid " + th.green : "2px solid transparent" }}>
              <div style={{ position:"relative", display:"inline-flex" }}>
                <span style={{ fontSize:16 }}>{n.emoji}</span>
                {badge ? <span style={{ position:"absolute", top:-4, right:-7, background:th.red, borderRadius:"50%", minWidth:14, height:14, fontSize:8, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, padding:"0 2px", boxSizing:"border-box" }}>{clubSpotsNewCount > 9 ? "9+" : clubSpotsNewCount}</span> : null}
              </div>
              <span style={{ fontSize:9, color:tab===n.id ? th.green : th.muted, fontFamily:"monospace", letterSpacing:0.2 }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
