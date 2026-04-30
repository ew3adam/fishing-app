import { useState, useEffect, useRef, useCallback } from "react";
import { createDataAdapter } from "./services/serviceFactory";

// ─── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark:      { bg:"#0d1a0d", card:"rgba(255,255,255,0.06)", border:"#2a4a2a", green:"#6fcf6f", dim:"#3a6a3a", gold:"#d4a843", white:"#f0ece0", muted:"#8a9a7a", blue:"#5a9fd4", red:"#e05050", orange:"#e09030", teal:"#4ab8a0", indigo:"#5a6fd4", nav:"rgba(13,26,13,0.97)" },
  light:     { bg:"#f0f4f0", card:"rgba(255,255,255,0.9)", border:"#c0d4c0", green:"#2a7a2a", dim:"#7ab87a", gold:"#a07010", white:"#1a2a1a", muted:"#5a7a5a", blue:"#2a5fa0", red:"#c03030", orange:"#b06010", teal:"#1a8070", indigo:"#3a4fb0", nav:"rgba(240,244,240,0.97)" },
  bluesteel: { bg:"#0d1520", card:"rgba(255,255,255,0.06)", border:"#1a3050", green:"#40c0e0", dim:"#1a5070", gold:"#e0c040", white:"#e8f0f8", muted:"#6080a0", blue:"#60a0e0", red:"#e05050", orange:"#e09030", teal:"#40d0c0", indigo:"#8080e0", nav:"rgba(13,21,32,0.97)" },
};

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

var CLUB_ROSTER = [
  { id:"roster_1", name:"Jim K.", email:"jim.k@riversidefishingclub.com" },
  { id:"roster_2", name:"Sarah M.", email:"sarah.m@riversidefishingclub.com" },
  { id:"roster_3", name:"Bob T.", email:"bob.t@riversidefishingclub.com" },
  { id:"roster_4", name:"Maria G.", email:"maria.g@riversidefishingclub.com" },
];

var MOCK_CLUB_SHARED_SPOTS = [
  { id:"club_demo_busse", name:"Busse Lake — south cove", lat:42.018, lng:-88.045, credit:"Jim K.", species_present:["Largemouth Bass","Crappie"], isDemo:true },
];

function sanitizeStr(s, maxLen) {
  var m = maxLen != null ? maxLen : 4000;
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, m);
}

function firstNameFromName(name) {
  var clean = sanitizeStr(name, 120);
  if (!clean) return "Member";
  return clean.split(/\s+/).filter(Boolean)[0] || "Member";
}

function parseCoordNum(v) {
  var n = parseFloat(String(v).trim());
  return isFinite(n) ? n : NaN;
}

function isValidLatLng(lat, lng) {
  return isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function milesBetween(lat1, lng1, lat2, lng2) {
  // Haversine distance in miles for nearest-spot ranking.
  var R = 3958.8;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
    var list = (base.privateSpots || []).filter(function(s) { return s.id !== id; });
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

async function loadWeather(lat, lng) {
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&current=temperature_2m,windspeed_10m,weathercode,precipitation_probability&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America/Chicago");
    if (!r.ok) throw new Error("bad");
    const d = await r.json();
    const c = d.current;
    return { temp: Math.round(c.temperature_2m), wind: Math.round(c.windspeed_10m), code: c.weathercode, precip: c.precipitation_probability || 0, icon: WX_ICON[c.weathercode] || "🌡️", condition: WX_LABEL[c.weathercode] || "Unknown" };
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

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ profile, T, onOpenSpots }) {
  const th = THEMES[T];
  const [wx, setWx] = useState(null);
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRefresh, setShowRefresh] = useState(false);
  const [expandArticles, setExpandArticles] = useState(false);
  const [nearbySpots, setNearbySpots] = useState([]);
  const favSp = (profile && profile.favSpecies) || [];

  const load = useCallback(function() {
    setLoading(true); setShowRefresh(false);
    var lat = 41.84, lng = -87.83;
    function doLoad(la, ln) {
      var rankedSpots = LOCAL_SPOTS.concat(SALMON_SPOTS).map(function(s) {
        return { spot:s, miles:milesBetween(la, ln, s.lat, s.lng) };
      }).sort(function(a, b) { return a.miles - b.miles; });
      setNearbySpots(rankedSpots.slice(0, 3));
      loadWeather(la, ln).then(function(w) {
        setWx(w);
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

  var rating = fishingScore(wx);
  var displayName = (profile && profile.name) ? ", " + profile.name.split(" ")[0] : "";
  var articles = expandArticles ? ARTICLES : ARTICLES.filter(function(a) { return favSp.length === 0 || favSp.includes(a.species) || a.species === "All"; });
  if (articles.length === 0) articles = ARTICLES;

  return (
    <div style={{ paddingBottom:8 }}>
      <div style={{ textAlign:"center", padding:"18px 0 12px" }}>
        <div style={{ fontSize:36 }}>🎣</div>
        <div style={{ fontSize:22, color:th.white, fontWeight:700, marginTop:4 }}>Hey{displayName}!</div>
        <div style={{ fontSize:12, color:th.muted }}>North Riverside · Lake Michigan Corridor</div>
      </div>

      <button
        type="button"
        onClick={function() { if (typeof onOpenSpots === "function") onOpenSpots(); }}
        style={{
          width:"100%",
          background:th.green,
          color:"#081208",
          border:"none",
          borderRadius:14,
          padding:"16px 14px",
          cursor:"pointer",
          fontSize:17,
          fontWeight:800,
          marginBottom:8,
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          gap:10,
          minHeight:54,
          boxShadow:"0 6px 22px rgba(0,0,0,0.45)",
        }}
      >
        <span style={{ fontSize:26 }} aria-hidden>📍</span>
        <span>Add my fishing spot</span>
      </button>
      <p style={{ fontSize:12, color:th.muted, textAlign:"center", marginBottom:14, lineHeight:1.45 }}>
        Saved only on this device. From here you can use GPS or paste a map link.
      </p>

      {showRefresh && (
        <div style={{ background:th.green + "22", border:"1px solid " + th.green + "55", borderRadius:10, padding:12, marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:th.green, fontSize:13, fontWeight:700 }}>Ready to refresh?</div>
            <div style={{ color:th.muted, fontSize:11 }}>Tap to load fresh weather + conditions</div>
          </div>
          <button onClick={load} style={{ background:th.green, color:"#000", border:"none", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:700 }}>Update</button>
        </div>
      )}

      <Card T={T} borderColor={rating ? rating.color : undefined}>
        <SecLabel text="Today's Conditions" T={T} />
        {loading ? (
          <div style={{ textAlign:"center", padding:"20px 0", color:th.muted }}>Fetching live conditions...</div>
        ) : wx ? (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:42 }}>{wx.icon}</div>
                <div style={{ fontSize:26, color:th.white, fontWeight:700 }}>{wx.temp}F</div>
                <div style={{ fontSize:12, color:th.muted }}>{wx.condition} · {wx.wind} mph · {wx.precip}% rain</div>
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

      <Card T={T}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <SecLabel text="Nearby fishing spots" T={T} />
          <OBtn label="Open Spots" onClick={function() { if (typeof onOpenSpots === "function") onOpenSpots(); }} color={th.teal} style={{ fontSize:10, padding:"3px 8px" }} />
        </div>
        {nearbySpots.length === 0 ? <div style={{ fontSize:12, color:th.muted }}>Loading nearby spots…</div> : null}
        {nearbySpots.map(function(row) {
          var s = row.spot;
          return (
            <div key={"home_near_" + s.name} style={{ borderBottom:"1px solid " + th.border, paddingBottom:8, marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                <div>
                  <div style={{ fontSize:13, color:th.white, fontWeight:700 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:th.muted }}>{s.addr}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:11, color:th.teal, fontFamily:"monospace" }}>{row.miles.toFixed(1)} mi</div>
                  <a href={s.google} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:th.blue, textDecoration:"none" }}>Directions</a>
                </div>
              </div>
            </div>
          );
        })}
      </Card>

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
    </div>
  );
}

// ─── SPECIES TAB ──────────────────────────────────────────────────────────────
function SpeciesTab({ T }) {
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
              return (
                <Card key={i} T={T}>
                  <div style={{ fontWeight:700, color:th.green, fontSize:13, marginBottom:4 }}>{r.name}</div>
                  <div style={{ fontSize:11, color:th.muted, fontFamily:"monospace" }}>{r.setup}</div>
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
        {SPECIES.map(function(sp) {
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
function SpotsTab({ profile, setProfile, T, spotsOpenSection, clearSpotsOpenSection }) {
  const th = THEMES[T];
  const [view, setView] = useState("local");
  const [mapSpot, setMapSpot] = useState(null);
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
  const [spotSearch, setSpotSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [closestLoading, setClosestLoading] = useState(false);
  const [closestErr, setClosestErr] = useState("");
  const [memberLocation, setMemberLocation] = useState(null);
  const [closestSpots, setClosestSpots] = useState([]);
  const favSpots = (profile && profile.favSpots) || [];
  const mySpots = (profile && profile.privateSpots) || [];
  // Keep invite/share targets restricted to known club emails.
  const allowedShareEmails = CLUB_ROSTER.map(function(m) { return sanitizeStr(m.email || "", 200).toLowerCase(); }).filter(Boolean);

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

  function openSaveWithCoords(lat, lng) {
    setSaveErr("");
    setSaveDraft({
      name:"",
      lat:lat,
      lng:lng,
      notes:"",
      species_present:[],
      access_info:"",
      shareClub:false,
      sharedWith:[],
    });
    setPrivSpotId(null);
    setPrivView("save");
  }

  function startSaveCurrentGps() {
    setGeoErr("");
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoLoading(false);
      setGeoErr("GPS not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        setGeoLoading(false);
        openSaveWithCoords(pos.coords.latitude, pos.coords.longitude);
      },
      function() {
        setGeoLoading(false);
        setGeoErr("Could not read GPS. Try Save Past Location to enter coordinates or pick from the map.");
      },
      { enableHighAccuracy:true, maximumAge:60000, timeout:25000 }
    );
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
    var memEmail = sanitizeStr(mem.email || "", 200).toLowerCase();
    if (!memEmail || allowedShareEmails.indexOf(memEmail) === -1) {
      alert("This member does not have an allowed club email yet.");
      return;
    }
    var sw = (selectedSpot.sharedWith || []).slice();
    var ix = sw.findIndex(function(m) { return m.id === mem.id; });
    var nextList;
    var msg;
    var d = formatLongShareDate(new Date().toISOString());
    if (ix >= 0) {
      nextList = sw.filter(function(m) { return m.id !== mem.id; });
      msg = ("Stopped sharing " + sanitizeStr(selectedSpot.name, 120) + " with " + mem.name + " on " + d);
    } else {
      nextList = sw.concat([{ id:mem.id, name:mem.name, firstName:firstNameFromName(mem.name), email:memEmail }]);
      msg = ("Shared " + sanitizeStr(selectedSpot.name, 120) + " with " + mem.name + " on " + d);
    }
    patchPrivateSpot(setProfile, selectedSpot.id, { sharedWith:nextList });
    appendSpotActivity(setProfile, msg);
  }

  function inviteMemberByEmail(mem) {
    var memEmail = sanitizeStr(mem.email || "", 200).toLowerCase();
    if (!memEmail || allowedShareEmails.indexOf(memEmail) === -1) {
      alert("This member does not have an allowed club email yet.");
      return;
    }
    var firstName = firstNameFromName(mem.name);
    var inviter = sanitizeStr((profile && profile.name) || "Your club member", 120);
    var appUrl = sanitizeStr((typeof window !== "undefined" && window.location && window.location.href) ? window.location.href : "", 1500);
    var subj = encodeURIComponent("Join me on the Riverside Fishing Club app");
    var body = encodeURIComponent("Hi " + firstName + ",\n\n" + inviter + " invited you to try the Riverside Fishing Club app.\n\nOpen app: " + appUrl + "\n\nSee you on the water!");
    window.location.href = "mailto:" + memEmail + "?subject=" + subj + "&body=" + body;
  }

  function findClosestSpotsForMember() {
    setClosestErr("");
    setClosestLoading(true);
    if (!navigator.geolocation) {
      setClosestLoading(false);
      setClosestErr("Location is not available in this browser.");
      setView("closest");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var ranked = LOCAL_SPOTS.concat(SALMON_SPOTS).map(function(s) {
          return { spot:s, miles:milesBetween(lat, lng, s.lat, s.lng) };
        }).sort(function(a, b) { return a.miles - b.miles; });
        setMemberLocation({ lat:lat, lng:lng });
        // Show a useful nearby list instead of just one item.
        setClosestSpots(ranked.slice(0, 10));
        setClosestLoading(false);
        setView("closest");
      },
      function() {
        setClosestLoading(false);
        setClosestErr("Could not read your location. Check location permissions and try again.");
        setView("closest");
      },
      { enableHighAccuracy:true, maximumAge:60000, timeout:20000 }
    );
  }

  function normalizeSpotQuery(raw) {
    return sanitizeStr(raw, 120).toLowerCase();
  }

  function spotMatchesQuery(spot, q) {
    if (!q) return true;
    if (q === "local" || q === "locals" || q === "nearby") return true;
    var bucket = [
      sanitizeStr(spot.name || "", 200),
      sanitizeStr(spot.addr || "", 200),
      sanitizeStr(spot.tag || "", 80),
      Array.isArray(spot.species) ? spot.species.join(" ") : "",
      sanitizeStr(spot.dist || "", 40),
    ].join(" ").toLowerCase();
    return bucket.indexOf(q) >= 0;
  }

  function searchFishingLocations() {
    var q = normalizeSpotQuery(spotSearch);
    if (!q) {
      setView("local");
      return;
    }
    if (q.indexOf("near me") >= 0 || q.indexOf("closest") >= 0 || q === "nearby") {
      findClosestSpotsForMember();
      return;
    }
    setView("local");
  }

  var searchQ = normalizeSpotQuery(spotSearch);
  var localFiltered = LOCAL_SPOTS.filter(function(s) { return spotMatchesQuery(s, searchQ); });
  var salmonFiltered = SALMON_SPOTS.filter(function(s) { return spotMatchesQuery(s, searchQ); });

  if (mapSpot) {
    return (
      <div>
        <OBtn label="Back" onClick={function() { setMapSpot(null); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:18, color:th.white, fontWeight:700, marginBottom:4 }}>Directions to</div>
        <div style={{ fontSize:15, color:th.green, marginBottom:16 }}>{mapSpot.name}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <a href={mapSpot.apple} style={{ display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:16, textDecoration:"none", textAlign:"center" }}>
            <div style={{ fontSize:32 }}>🗺️</div>
            <div style={{ fontSize:14, color:th.white, fontWeight:700, marginTop:6 }}>Apple Maps</div>
          </a>
          <a href={mapSpot.google} target="_blank" rel="noopener noreferrer" style={{ display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:16, textDecoration:"none", textAlign:"center" }}>
            <div style={{ fontSize:32 }}>📍</div>
            <div style={{ fontSize:14, color:th.white, fontWeight:700, marginTop:6 }}>Google Maps</div>
          </a>
        </div>
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
    var rosterF = CLUB_ROSTER.filter(function(m) {
      var q = sanitizeStr(memberSearch, 160).toLowerCase();
      var nm = sanitizeStr(m.name || "", 160).toLowerCase();
      var em = sanitizeStr(m.email || "", 200).toLowerCase();
      var fn = firstNameFromName(m.name).toLowerCase();
      return !q || nm.indexOf(q) >= 0 || em.indexOf(q) >= 0 || fn.indexOf(q) >= 0;
    });
    var mapImg = "https://staticmap.openstreetmap.de/staticmap.php?center=" + selectedSpot.lat + "," + selectedSpot.lng + "&zoom=15&size=400x200&markers=" + selectedSpot.lat + "," + selectedSpot.lng + ",red-pushpin";
    var shareLabel = selectedSpot.shareClub ? "Shared with Club" : (selectedSpot.sharedWith && selectedSpot.sharedWith.length ? "Shared with " + selectedSpot.sharedWith.map(function(m) { return m.name; }).join(", ") : "Private");
    return (
      <div>
        <OBtn label="Back" onClick={function() { setPrivView("my"); setPrivSpotId(null); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:17, color:th.white, fontWeight:700, marginBottom:6 }}>{selectedSpot.name}</div>
        <div style={{ fontSize:11, color:th.gold, marginBottom:12 }}>{shareLabel}</div>
        <img src={mapImg} alt="" style={{ width:"100%", borderRadius:10, border:"1px solid " + th.border, marginBottom:12 }} />
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <a href={"https://maps.google.com/?q=" + selectedSpot.lat + "," + selectedSpot.lng} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10, textDecoration:"none", color:th.blue, fontSize:12, fontWeight:700 }}>Google Maps</a>
          <a href={"maps://maps.apple.com/?daddr=" + selectedSpot.lat + "," + selectedSpot.lng} style={{ flex:1, textAlign:"center", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:10, textDecoration:"none", color:th.green, fontSize:12, fontWeight:700 }}>Apple Maps</a>
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
          <div style={{ fontSize:11, color:th.muted, marginBottom:8 }}>Share with specific members (allowable club emails)</div>
          <input value={memberSearch} onChange={function(e) { setMemberSearch(e.target.value); }} placeholder="Search first name or email…" style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"8px 10px", color:th.white, fontSize:12, boxSizing:"border-box", marginBottom:8 }} />
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {rosterF.map(function(m) {
              var on = (selectedSpot.sharedWith || []).some(function(x) { return x.id === m.id; });
              var first = firstNameFromName(m.name);
              return (
                <div key={m.id} style={{ background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:8 }}>
                  <button type="button" onClick={function() { toggleShareMember(m); }} style={{ width:"100%", textAlign:"left", background:on ? th.green + "22" : "transparent", border:"1px solid " + (on ? th.green : th.border), borderRadius:8, padding:8, color:th.white, cursor:"pointer", fontSize:12, marginBottom:6 }}>
                    {on ? "✓ " : ""}{first} <span style={{ color:th.muted }}>({m.email})</span>
                  </button>
                  <button type="button" onClick={function() { inviteMemberByEmail(m); }} style={{ width:"100%", textAlign:"center", background:th.blue + "20", border:"1px solid " + th.blue, borderRadius:8, padding:"7px 8px", color:th.blue, cursor:"pointer", fontSize:11, fontWeight:700 }}>
                    Invite {first} to app
                  </button>
                </div>
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
          var img = "https://staticmap.openstreetmap.de/staticmap.php?center=" + s.lat + "," + s.lng + "&zoom=15&size=400x160&markers=" + s.lat + "," + s.lng + ",green-pushpin";
          return (
            <Card key={s.id} T={T}>
              <div style={{ fontWeight:700, color:th.white, marginBottom:6 }}>{s.name}</div>
              <img src={img} alt="" style={{ width:"100%", borderRadius:8, border:"1px solid " + th.border }} />
              <OBtn label="Open in maps" onClick={function() { window.open("https://maps.google.com/?q=" + s.lat + "," + s.lng, "_blank"); }} color={th.blue} style={{ marginTop:8, fontSize:11 }} />
            </Card>
          );
        })}
      </div>
    );
  }

  if (privView === "club") {
    var myShared = mySpots.filter(function(s) { return s.shareClub; });
    var credit = memberCreditFromProfile(profile);
    return (
      <div>
        <OBtn label="← Back to spots" onClick={function() { setPrivView("main"); }} color={th.green} style={{ margin:"12px 0 14px" }} />
        <div style={{ fontSize:19, color:th.white, fontWeight:800, marginBottom:8 }}>Club shared map</div>
        <Card T={T} borderColor={th.gold + "44"}>
          <div style={{ fontSize:12, color:th.white, lineHeight:1.7 }}>Turning off &quot;Share with Club&quot; removes your pin from this list immediately. A full club sync would use the Private_Spots table on the server.</div>
        </Card>
        {MOCK_CLUB_SHARED_SPOTS.map(function(s) {
          var im = "https://staticmap.openstreetmap.de/staticmap.php?center=" + s.lat + "," + s.lng + "&zoom=14&size=400x160&markers=" + s.lat + "," + s.lng + ",blue-pushpin";
          return (
            <Card key={s.id} T={T}>
              <div style={{ fontSize:10, color:th.gold, marginBottom:4 }}>Spotted by {s.credit}</div>
              <div style={{ fontWeight:700, color:th.white, marginBottom:6 }}>{s.name}</div>
              <img src={im} alt="" style={{ width:"100%", borderRadius:8 }} />
              <div style={{ fontSize:11, color:th.muted, marginTop:6 }}>{(s.species_present || []).join(" · ")}</div>
            </Card>
          );
        })}
        {myShared.map(function(s) {
          var im = "https://staticmap.openstreetmap.de/staticmap.php?center=" + s.lat + "," + s.lng + "&zoom=15&size=400x160&markers=" + s.lat + "," + s.lng + ",green-pushpin";
          return (
            <Card key={s.id} T={T} borderColor={th.green + "44"}>
              <div style={{ fontSize:10, color:th.green, marginBottom:4 }}>Spotted by {credit}</div>
              <div style={{ fontWeight:700, color:th.white, marginBottom:6 }}>{s.name}</div>
              <img src={im} alt="" style={{ width:"100%", borderRadius:8 }} />
              <div style={{ fontSize:11, color:th.muted, marginTop:6 }}>{(s.species_present || []).join(" · ")}</div>
            </Card>
          );
        })}
        {myShared.length === 0 && MOCK_CLUB_SHARED_SPOTS.length === 0 ? <Card T={T}><div style={{ fontSize:13, color:th.muted }}>No shared pins yet.</div></Card> : null}
      </div>
    );
  }

  if (privView === "my") {
    var log = (profile && profile.spotActivityLog) || [];
    return (
      <div>
        <PrimarySaveStrip />

        <GuideMyToggle modeGuide={false} />

        <div style={{ fontSize:20, color:th.white, fontWeight:800, marginBottom:10 }}>My fishing spots</div>
        <p style={{ fontSize:13, color:th.muted, margin:"0 0 14px", lineHeight:1.55 }}>Everything here is yours. Names, notes, and map pins stay on this device until you share.</p>

        <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
          <button type="button" onClick={function() { setPrivView("mymap"); }} style={{ flex:1, minWidth:140, minHeight:48, padding:"10px 12px", borderRadius:10, border:"2px solid " + th.blue, background:th.blue + "15", color:th.blue, fontWeight:700, fontSize:14, cursor:"pointer" }}>
            🗺️ Map of my saves
          </button>
          <button type="button" onClick={function() { setPrivView("club"); }} style={{ flex:1, minWidth:140, minHeight:48, padding:"10px 12px", borderRadius:10, border:"2px solid " + th.gold, background:th.gold + "12", color:th.gold, fontWeight:700, fontSize:14, cursor:"pointer" }}>
            👥 Club map
          </button>
        </div>

        <OBtn label="← Back to fishing guide list" onClick={function() { setPrivView("main"); setPrivSpotId(null); }} color={th.green} style={{ margin:"0 0 14px", fontSize:13 }} />

        {mySpots.length === 0 ? (
          <Card T={T}>
            <div style={{ fontSize:15, color:th.white, fontWeight:700, marginBottom:8 }}>No spots saved yet</div>
            <div style={{ fontSize:13, color:th.muted, lineHeight:1.55 }}>Tap the big green <strong style={{ color:th.green }}>Save my fishing spot</strong> button — or use <strong style={{ color:th.white }}>Save another way</strong> from the guide tab.</div>
          </Card>
        ) : null}
        {mySpots.map(function(s) {
          var st = s.shareClub ? "Shared w/ Club" : (s.sharedWith && s.sharedWith.length ? "Shared w/ " + s.sharedWith[0].name + (s.sharedWith.length > 1 ? " +" + (s.sharedWith.length - 1) : "") : "Private");
          return (
            <button
              key={s.id}
              type="button"
              onClick={function() {
                setPrivSpotId(s.id);
                setMemberSearch("");
                setPrivView("detail");
              }}
              style={{ width:"100%", textAlign:"left", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, marginBottom:8, cursor:"pointer", color:th.white }}
            >
              <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
              <div style={{ fontSize:10, color:th.muted, marginTop:2 }}>Saved {formatShortDate(s.created_at)} · {st}</div>
              <div style={{ fontSize:11, color:th.green, marginTop:4 }}>{(s.species_present || []).slice(0, 4).join(", ")}{(s.species_present && s.species_present.length > 4 ? "…" : "")}</div>
            </button>
          );
        })}
        <Card T={T}>
          <SecLabel text="Sharing activity" T={T} />
          {log.length === 0 ? <div style={{ fontSize:12, color:th.muted }}>No sharing activity yet.</div> : null}
          {log.slice(0, 20).map(function(row) {
            return (
              <div key={row.id} style={{ fontSize:11, color:th.white, borderBottom:"1px solid " + th.border, paddingBottom:8, marginBottom:8 }}>
                <span style={{ color:th.muted }}>{formatShortDate(row.at)}</span>
                <br />
                {row.message}
              </div>
            );
          })}
        </Card>
      </div>
    );
  }

  function SpotCard(props) {
    var s = props.s;
    var distLabel = props.distanceLabel || s.dist;
    return (
      <Card T={T} borderColor={s.color + "44"} style={{ borderLeft:"3px solid " + s.color }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:th.white, fontSize:15 }}>{s.name}</div>
            <div style={{ fontSize:12, color:th.muted, fontFamily:"monospace", marginTop:2 }}>{s.addr}</div>
            {props.salmon ? <div style={{ fontSize:11, color:th.gold, marginTop:3 }}>📅 {s.season}</div> : null}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
            <Pill label={s.tag} color={s.color} />
            <span style={{ fontSize:11, color:th.green, fontFamily:"monospace" }}>{distLabel}</span>
            <button type="button" onClick={function() { toggleFav(s.name); }} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:22, minWidth:44, minHeight:44 }}>
              {favSpots.includes(s.name) ? "⭐" : "☆"}
            </button>
          </div>
        </div>
        {s.species ? (
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, margin:"8px 0" }}>
            {s.species.map(function(sp) { return <Pill key={sp} label={sp} color={th.green} />; })}
          </div>
        ) : null}
        <div style={{ fontSize:13, color:th.white, marginBottom:8, lineHeight:1.55 }}>💡 {s.tip}</div>
        {s.alert ? <div style={{ fontSize:11, color:th.orange, marginBottom:8 }}>⚠️ {s.alert}</div> : null}
        <OBtn label="Open directions" onClick={function() { setMapSpot(s); }} color={th.blue} style={{ fontSize:13, padding:"8px 14px" }} />
      </Card>
    );
  }

  function GuideMyToggle(props) {
    var modeGuide = props.modeGuide;
    return (
      <div style={{ display:"flex", gap:10, marginBottom:14 }} role="tablist" aria-label="Choose guide or your spots">
        <button
          type="button"
          role="tab"
          aria-selected={modeGuide}
          onClick={function() { setPrivView("main"); setPrivSpotId(null); }}
          style={{
            flex:1,
            minHeight:72,
            padding:"12px 10px",
            borderRadius:14,
            border:"3px solid " + (modeGuide ? th.green : th.border),
            background:modeGuide ? th.green + "40" : th.card,
            color:th.white,
            fontWeight:800,
            fontSize:15,
            lineHeight:1.25,
            cursor:"pointer",
            textAlign:"center",
          }}
        >
          Fishing areas<br />
          <span style={{ fontSize:12, fontWeight:600, color:modeGuide ? th.white : th.muted }}>(in this app)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!modeGuide}
          onClick={function() { setPrivView("my"); setPrivSpotId(null); }}
          style={{
            flex:1,
            minHeight:72,
            padding:"12px 10px",
            borderRadius:14,
            border:"3px solid " + (!modeGuide ? th.green : th.border),
            background:!modeGuide ? th.green + "40" : th.card,
            color:th.white,
            fontWeight:800,
            fontSize:15,
            lineHeight:1.25,
            cursor:"pointer",
            textAlign:"center",
          }}
        >
          My fishing spots<br />
          <span style={{ fontSize:12, fontWeight:600, color:!modeGuide ? th.white : th.muted }}>(your saves)</span>
        </button>
      </div>
    );
  }

  function PrimarySaveStrip() {
    return (
      <div style={{ marginBottom:14 }}>
        <button
          type="button"
          disabled={geoLoading}
          onClick={startSaveCurrentGps}
          style={{
            width:"100%",
            background:th.green,
            color:"#081208",
            border:"none",
            borderRadius:14,
            padding:"18px 16px",
            cursor:geoLoading ? "wait" : "pointer",
            fontSize:18,
            fontWeight:800,
            boxShadow:"0 6px 22px rgba(0,0,0,0.45)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            gap:12,
            minHeight:56,
          }}
        >
          <span style={{ fontSize:28 }} aria-hidden>📍</span>
          <span>{geoLoading ? "Finding where you are…" : "Save my fishing spot"}</span>
        </button>
        <p style={{ fontSize:13, color:th.muted, textAlign:"center", marginTop:10, marginBottom:0, lineHeight:1.5 }}>
          Stored on <strong style={{ color:th.white }}>this device only</strong> until you choose to share.
        </p>
      </div>
    );
  }

  function StickySaveBar() {
    return (
      <div
        style={{
          position:"sticky",
          bottom:76,
          zIndex:15,
          marginTop:20,
          paddingTop:12,
          paddingBottom:6,
          background:"linear-gradient(180deg, transparent 0%, " + th.bg + " 35%)",
        }}
      >
        <button
          type="button"
          disabled={geoLoading}
          onClick={startSaveCurrentGps}
          style={{
            width:"100%",
            background:th.green,
            color:"#081208",
            border:"2px solid " + th.dim,
            borderRadius:12,
            padding:"14px 12px",
            cursor:geoLoading ? "wait" : "pointer",
            fontSize:16,
            fontWeight:800,
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            gap:8,
            minHeight:52,
            boxShadow:"0 -2px 12px rgba(0,0,0,0.35)",
          }}
        >
          <span style={{ fontSize:22 }} aria-hidden>📍</span>
          {geoLoading ? "Working…" : "Save my spot"}
        </button>
        <div style={{ fontSize:11, color:th.muted, textAlign:"center", marginTop:6 }}>Tap here anytime while you scroll the list</div>
      </div>
    );
  }

  return (
    <div>
      <PrimarySaveStrip />

      <GuideMyToggle modeGuide={true} />
      {geoErr ? (
        <div style={{ fontSize:13, color:th.orange, marginBottom:12, padding:10, background:th.orange + "15", borderRadius:10, border:"1px solid " + th.orange + "55" }}>
          {geoErr}
        </div>
      ) : null}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <button
          type="button"
          onClick={function() { setPrivView("past"); }}
          style={{
            minHeight:64,
            padding:12,
            borderRadius:12,
            border:"2px solid " + th.blue,
            background:th.blue + "18",
            color:th.blue,
            fontWeight:700,
            fontSize:14,
            cursor:"pointer",
            lineHeight:1.35,
          }}
        >
          🗺️ Save another way<br />
          <span style={{ fontSize:11, fontWeight:600, color:th.muted }}>map, past point, type coords</span>
        </button>
        <button
          type="button"
          onClick={function() { setPrivView("club"); }}
          style={{
            minHeight:64,
            padding:12,
            borderRadius:12,
            border:"2px solid " + th.gold,
            background:th.gold + "12",
            color:th.gold,
            fontWeight:700,
            fontSize:14,
            cursor:"pointer",
            lineHeight:1.35,
          }}
        >
          👥 Club shared map<br />
          <span style={{ fontSize:11, fontWeight:600, color:th.muted }}>optional</span>
        </button>
      </div>

      <div style={{ fontSize:11, color:th.muted, fontFamily:"monospace", letterSpacing:1.2, marginBottom:6, textTransform:"uppercase" }}>Guide — picks in the app</div>
      <div style={{ fontSize:14, color:th.white, fontWeight:700, marginBottom:4 }}>Places in this app</div>
      <p style={{ fontSize:13, color:th.muted, margin:"0 0 12px", lineHeight:1.5 }}>
        These are <strong style={{ color:th.white }}>not</strong> your personal saves. Use the green <strong style={{ color:th.green }}>Save my fishing spot</strong> button above to keep your own place.
      </p>
      <Card T={T} borderColor={th.blue + "44"}>
        <SecLabel text="Find fishing locations" T={T} />
        <input
          value={spotSearch}
          onChange={function(e) { setSpotSearch(e.target.value); }}
          placeholder='Search by local, name, city, species, or type "near me"'
          style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"10px 12px", color:th.white, fontSize:13, boxSizing:"border-box", marginBottom:8 }}
        />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <button
            type="button"
            onClick={searchFishingLocations}
            style={{ background:th.blue + "22", border:"1px solid " + th.blue, borderRadius:8, padding:"9px 10px", color:th.blue, cursor:"pointer", fontWeight:700, fontSize:12 }}
          >
            Search spots
          </button>
          <button
            type="button"
            onClick={findClosestSpotsForMember}
            style={{ background:th.teal + "22", border:"1px solid " + th.teal, borderRadius:8, padding:"9px 10px", color:th.teal, cursor:"pointer", fontWeight:700, fontSize:12 }}
          >
            Search near me
          </button>
        </div>
      </Card>
      <button
        type="button"
        onClick={findClosestSpotsForMember}
        style={{
          width:"100%",
          background:th.teal + "22",
          border:"2px solid " + th.teal,
          borderRadius:12,
          padding:"12px 14px",
          cursor:"pointer",
          color:th.teal,
          fontWeight:800,
          fontSize:14,
          marginBottom:12,
        }}
      >
        🔎 Search fishing locations near me
      </button>

      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
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
        <button
          type="button"
          onClick={findClosestSpotsForMember}
          style={{
            padding:"10px 14px",
            borderRadius:10,
            border:"2px solid " + (view==="closest" ? th.teal : th.border),
            background:view==="closest" ? th.teal + "35" : "transparent",
            color:view==="closest" ? th.teal : th.muted,
            fontWeight:700,
            fontSize:14,
            cursor:"pointer",
          }}
        >
          Search near me 📍
        </button>
      </div>

      {view === "local" && (
        <div>
          {localFiltered.length === 0 ? (
            <Card T={T}><div style={{ fontSize:12, color:th.muted }}>No local fishing spots found for "<strong style={{ color:th.white }}>{sanitizeStr(spotSearch, 80)}</strong>".</div></Card>
          ) : null}
          {localFiltered.map(function(s, i) { return <SpotCard key={i} s={s} />; })}
        </div>
      )}
      {view === "salmon" && (
        <div>
          <div style={{ background:th.blue + "18", border:"1px solid " + th.blue + "44", borderRadius:10, padding:12, marginBottom:10 }}>
            <div style={{ fontSize:11, color:th.blue, fontFamily:"monospace", marginBottom:5 }}>SOUTH TO NORTH CORRIDOR</div>
            <div style={{ fontSize:13, color:th.white, lineHeight:1.6 }}>Spring run: Indiana first, Waukegan last. Fall run reverses. NW winds = go day on any pier.</div>
          </div>
          <div style={{ background:th.orange + "18", border:"1px solid " + th.orange + "44", borderRadius:8, padding:10, marginBottom:10 }}>
            <div style={{ fontSize:12, color:th.orange, marginBottom:3 }}>⚠️ Indiana license</div>
            <div style={{ fontSize:12, color:th.white }}>Illinois rules do not carry across the state line. Indiana spots need an Indiana license.</div>
          </div>
          {salmonFiltered.length === 0 ? (
            <Card T={T}><div style={{ fontSize:12, color:th.muted }}>No salmon trail spots found for "<strong style={{ color:th.white }}>{sanitizeStr(spotSearch, 80)}</strong>".</div></Card>
          ) : null}
          {salmonFiltered.map(function(s, i) { return <SpotCard key={i} s={s} salmon />; })}
        </div>
      )}
      {view === "fav" && (
        <div>
          {LOCAL_SPOTS.concat(SALMON_SPOTS).filter(function(s) { return favSpots.includes(s.name); }).map(function(s, i) { return <SpotCard key={i} s={s} />; })}
        </div>
      )}
      {view === "closest" && (
        <div>
          <Card T={T} borderColor={th.teal + "55"}>
            <SecLabel text="Nearby fishing locations list" T={T} />
            {closestLoading ? <div style={{ fontSize:12, color:th.muted }}>Finding your location and ranking spots...</div> : null}
            {closestErr ? <div style={{ fontSize:12, color:th.orange }}>{closestErr}</div> : null}
            {memberLocation ? (
              <div style={{ fontSize:12, color:th.white, marginBottom:8 }}>
                Member location: <span style={{ fontFamily:"monospace" }}>{memberLocation.lat.toFixed(5)}, {memberLocation.lng.toFixed(5)}</span>
              </div>
            ) : null}
            {!closestLoading ? (
              <button type="button" onClick={findClosestSpotsForMember} style={{ background:th.teal + "22", border:"1px solid " + th.teal, borderRadius:8, padding:"8px 12px", color:th.teal, cursor:"pointer", fontWeight:700, fontSize:12 }}>
                Search near me
              </button>
            ) : null}
          </Card>
          {!closestLoading && !closestErr && closestSpots.length === 0 ? (
            <Card T={T}>
              <div style={{ fontSize:12, color:th.muted }}>Tap <strong style={{ color:th.white }}>Search near me</strong> to list the closest fishing locations.</div>
            </Card>
          ) : null}
          {closestSpots.map(function(row) {
            return <SpotCard key={"closest_" + row.spot.name} s={row.spot} distanceLabel={row.miles.toFixed(1) + " mi away"} />;
          })}
        </div>
      )}

      <StickySaveBar />
    </div>
  );
}

// ─── LAKES TAB ────────────────────────────────────────────────────────────────
function LakesTab({ T }) {
  const th = THEMES[T];
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const [lakeTab, setLakeTab] = useState("overview");
  var now = new Date();
  var mo = now.getMonth();
  var curSeason = mo >= 2 && mo <= 4 ? "spring" : mo >= 5 && mo <= 7 ? "summer" : mo >= 8 && mo <= 10 ? "fall" : "winter";

  var filtered = LAKES.filter(function(l) {
    return !search || l.name.toLowerCase().includes(search.toLowerCase());
  });

  if (sel) {
    var lake = sel;
    var seasonColors = { spring:"#5a9a5a", summer:"#e09030", fall:"#c08040", winter:"#5a9fd4" };
    return (
      <div>
        <OBtn label="Back" onClick={function() { setSel(null); }} color={th.green} style={{ margin:"12px 0 10px" }} />
        <div style={{ background:th.green + "18", border:"1px solid " + th.green + "44", borderRadius:12, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:20, color:th.white, fontWeight:700 }}>{lake.name}</div>
          {lake.aka ? <div style={{ fontSize:11, color:th.green, fontFamily:"monospace" }}>{lake.aka}</div> : null}
          <div style={{ fontSize:12, color:th.muted, marginTop:2 }}>{lake.addr} · {lake.dist}</div>
          <div style={{ display:"flex", gap:16, marginTop:10 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, color:th.blue, fontWeight:700 }}>{lake.maxDepth}<span style={{ fontSize:12 }}> ft</span></div>
              <div style={{ fontSize:10, color:th.muted, fontFamily:"monospace" }}>MAX DEPTH</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, color:th.teal, fontWeight:700 }}>{lake.avgDepth}<span style={{ fontSize:12 }}> ft</span></div>
              <div style={{ fontSize:10, color:th.muted, fontFamily:"monospace" }}>AVG DEPTH</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, color:th.green, fontWeight:700 }}>{lake.species.length}</div>
              <div style={{ fontSize:10, color:th.muted, fontFamily:"monospace" }}>SPECIES</div>
            </div>
          </div>
          {lake.alert ? <div style={{ fontSize:11, color:th.orange, marginTop:8 }}>⚠️ {lake.alert}</div> : null}
          {lake.stateNote ? <div style={{ fontSize:11, color:th.blue, marginTop:4 }}>ℹ️ {lake.stateNote}</div> : null}
        </div>

        <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"wrap" }}>
          {["overview","depth","spots","season"].map(function(t) {
            return (
              <button key={t} onClick={function() { setLakeTab(t); }} style={{ background:lakeTab===t ? th.green + "33" : "transparent", border:"1px solid " + (lakeTab===t ? th.green : th.border), borderRadius:8, color:lakeTab===t ? th.green : th.muted, padding:"6px 10px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
                {t.toUpperCase()}
              </button>
            );
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
              <a href={lake.apple} style={{ flex:1, display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}>
                <div style={{ fontSize:24 }}>🗺️</div>
                <div style={{ fontSize:12, color:th.white, fontWeight:700, marginTop:4 }}>Apple Maps</div>
              </a>
              <a href={lake.google} target="_blank" rel="noopener noreferrer" style={{ flex:1, display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}>
                <div style={{ fontSize:24 }}>📍</div>
                <div style={{ fontSize:12, color:th.white, fontWeight:700, marginTop:4 }}>Google Maps</div>
              </a>
              <a href={lake.lakelink} target="_blank" rel="noopener noreferrer" style={{ flex:1, display:"block", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}>
                <div style={{ fontSize:24 }}>🗺️</div>
                <div style={{ fontSize:12, color:th.blue, fontWeight:700, marginTop:4 }}>LakeLink</div>
              </a>
            </div>
          </div>
        )}

        {lakeTab === "depth" && (
          <div>
            {lake.zones.map(function(z, i) {
              var zColors = [th.teal, th.blue, th.indigo];
              return (
                <Card key={i} T={T}>
                  <div style={{ fontWeight:700, color:zColors[i], fontSize:13, marginBottom:2 }}>{z.depth}</div>
                  <div style={{ fontSize:11, color:th.muted, marginBottom:6 }}>{z.loc}</div>
                  <div style={{ width:"100%", height:8, background:th.border, borderRadius:4, overflow:"hidden", marginBottom:6 }}>
                    <div style={{ width:((i + 1) * 33) + "%", height:"100%", background:zColors[i], borderRadius:4 }} />
                  </div>
                  <div style={{ fontSize:12, color:th.white }}>💡 {z.tip}</div>
                </Card>
              );
            })}
            <a href={lake.lakelink} target="_blank" rel="noopener noreferrer" style={{ display:"block", background:th.blue + "18", border:"1px solid " + th.blue + "44", borderRadius:10, padding:12, textDecoration:"none", textAlign:"center" }}>
              <div style={{ fontSize:13, color:th.blue, fontWeight:700 }}>View Full Contour Map on LakeLink</div>
            </a>
          </div>
        )}

        {lakeTab === "spots" && (
          <div>
            {lake.bankSpots.map(function(s, i) {
              return (
                <Card key={i} T={T} style={{ borderLeft:"3px solid " + th.green }}>
                  <div style={{ fontWeight:700, color:th.green, fontSize:13, marginBottom:4 }}>📌 {s.name}</div>
                  <div style={{ fontSize:13, color:th.white, lineHeight:1.7 }}>{s.tip}</div>
                </Card>
              );
            })}
          </div>
        )}

        {lakeTab === "season" && (
          <div>
            {Object.entries(lake.season).map(function(entry) {
              var s = entry[0], tip = entry[1];
              var icons = { spring:"🌱", summer:"☀️", fall:"🍂", winter:"❄️" };
              return (
                <Card key={s} T={T} borderColor={s === curSeason ? th.green : undefined}>
                  <div style={{ fontWeight:700, color:s === curSeason ? th.green : th.white, fontSize:13, marginBottom:4 }}>
                    {icons[s]} {s.charAt(0).toUpperCase() + s.slice(1)}{s === curSeason ? " ← NOW" : ""}
                  </div>
                  <div style={{ fontSize:13, color:th.white, lineHeight:1.7 }}>{tip}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search lakes..." style={{ width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:"11px 14px", color:th.white, fontSize:14, boxSizing:"border-box", outline:"none", margin:"12px 0 10px" }} />
      <SecLabel text={filtered.length + " Lakes Within 50 Miles"} T={T} />
      {filtered.map(function(lake, i) {
        return (
          <div key={i} onClick={function() { setSel(lake); setLakeTab("overview"); }} style={{ background:th.card, border:"1px solid " + th.border, borderRadius:12, padding:14, marginBottom:10, cursor:"pointer" }}>
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

// ─── CATCH TAB ────────────────────────────────────────────────────────────────
function CatchTab({ profile, T }) {
  const th = THEMES[T];
  const [view, setView] = useState("feed");
  const fileCameraRef = useRef();
  const fileLibraryRef = useRef();
  const [catches, setCatches] = useState([
    { id:1, user:"Mike R.", species:"Largemouth Bass", length:"14 inches", bait:"Texas Rig green pumpkin", spot:"Thatcher Woods", date:"Apr 24", notes:"Caught at sunrise near the fallen oak" },
    { id:2, user:"Sandra L.", species:"Rainbow Trout", length:"11 inches", bait:"PowerBait salmon egg", spot:"Sag Quarry East", date:"Apr 22", notes:"Right after stocking near aerator" },
  ]);
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [photoSource, setPhotoSource] = useState("");
  const [photoB64, setPhotoB64] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showRuler, setShowRuler] = useState(true);
  const [rulerInches, setRulerInches] = useState(18);
  const [form, setForm] = useState({ species:"", length:"", bait:"", spot:"", rod:"", notes:"", date:new Date().toLocaleDateString() });
  const [rfcLink, setRfcLink] = useState("");

  function setF(k, v) { setForm(function(f) { return Object.assign({}, f, { [k]: v }); }); }

  function openPhotoPicker(refObj) {
    if (!refObj || !refObj.current) return;
    // Clear previous value so selecting the same image again still triggers onChange.
    refObj.current.value = "";
    refObj.current.click();
  }

  function choosePresetLength(inches) {
    // Quick options to speed up logging for common fish sizes.
    setF("length", String(inches) + " inches");
  }

  function setLengthNotMeasured() {
    // Keep posting possible even when no reliable measurement is available.
    setF("length", "Length not measured");
  }

  function renderPhotoWithRuler(maxHeightPx) {
    if (!photo) return null;
    var ticks = [];
    var i;
    for (i = 0; i <= rulerInches; i++) ticks.push(i);
    return (
      <div style={{ position:"relative", marginBottom:12 }}>
        <img src={photo} alt="catch" style={{ width:"100%", borderRadius:10, maxHeight:maxHeightPx, objectFit:"cover", display:"block" }} />
        {showRuler ? (
          <div style={{ position:"absolute", left:8, right:8, bottom:8, background:"rgba(0,0,0,0.55)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:8, padding:"8px 10px 6px" }}>
            <div style={{ position:"relative", height:16, borderTop:"2px solid #ffffff" }}>
              {ticks.map(function(tick) {
                return (
                  <div key={tick} style={{ position:"absolute", left:(tick / rulerInches * 100) + "%", top:-2, transform:"translateX(-0.5px)" }}>
                    <div style={{ width:1, height:tick % 2 === 0 ? 10 : 6, background:"#ffffff" }} />
                    {tick % 2 === 0 ? <div style={{ fontSize:8, color:"#ffffff", marginTop:1 }}>{tick}</div> : null}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:10, color:"#ffffff", marginTop:2 }}>Ruler overlay ({rulerInches} in)</div>
          </div>
        ) : null}
      </div>
    );
  }

  function downscaleImageToWeb72(file, onDone) {
    // Convert to web-sized image so uploads are lightweight (72 DPI equivalent for screen use).
    var reader = new FileReader();
    reader.onload = function(ev) {
      var full = ev.target.result;
      var img = new Image();
      img.onload = function() {
        var maxW = 1600;
        var maxH = 1600;
        var srcW = img.width || maxW;
        var srcH = img.height || maxH;
        var scale = Math.min(1, maxW / srcW, maxH / srcH);
        var outW = Math.max(1, Math.round(srcW * scale));
        var outH = Math.max(1, Math.round(srcH * scale));
        var canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          onDone(full, full.split(",")[1] || "", file.type || "image/jpeg");
          return;
        }
        ctx.drawImage(img, 0, 0, outW, outH);
        var outType = "image/jpeg";
        var compressed = canvas.toDataURL(outType, 0.86);
        onDone(compressed, compressed.split(",")[1] || "", outType);
      };
      img.onerror = function() {
        onDone(full, full.split(",")[1] || "", file.type || "image/jpeg");
      };
      img.src = full;
    };
    reader.readAsDataURL(file);
  }

  function handlePhoto(e, sourceType) {
    var file = e.target.files[0];
    if (!file) return;
    setAiResult(null);
    setAiLoading(true);
    setStep(2);
    downscaleImageToWeb72(file, function(full, b64, mediaType) {
      setPhoto(full);
      setPhotoB64(b64);
      setPhotoSource(sourceType || "library");
      fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:mediaType || "image/jpeg",data:b64}},
            {type:"text",text:"Identify the fish species in this photo. If a ruler or reference object is visible estimate the length. If no ruler estimate from proportions. Respond ONLY with raw JSON no markdown: {\"species\":\"Largemouth Bass\",\"confidence\":95,\"length\":\"12 inches\",\"notes\":\"Typical largemouth coloring\"}"}
          ]}]
        })
      }).then(function(r) { return r.json(); }).then(function(data) {
        var txt = (data.content && data.content[0] && data.content[0].text) || "";
        var m = txt.match(/\{[^}]+\}/);
        if (m) {
          var res = JSON.parse(m[0]);
          setAiResult(res);
          setForm(function(f) { return Object.assign({}, f, { species: res.species || f.species, length: res.length || f.length }); });
        }
        setAiLoading(false);
      }).catch(function() { setAiLoading(false); });
    });
  }

  function submitCatch() {
    var userName = sanitizeStr(((profile && profile.name) || "Angler"), 120);
    var species = sanitizeStr(form.species, 120);
    var length = sanitizeStr(form.length, 120) || "Length not measured";
    var bait = sanitizeStr(form.bait, 200);
    var rod = sanitizeStr(form.rod, 200);
    var spot = sanitizeStr(form.spot, 200);
    var notes = sanitizeStr(form.notes, 1200);
    var date = sanitizeStr(form.date, 80);
    var anglerEmail = sanitizeStr(((profile && profile.email) || "not provided"), 160);
    var entry = { id:Date.now(), user:userName, species:species, length:length, bait:bait, rod:rod, spot:spot, notes:notes, date:date, photo:photo };
    setCatches(function(c) { return [entry].concat(c); });
    var subj = encodeURIComponent("RFC Catch Report — " + species + " · " + length + " · " + userName);
    var body = encodeURIComponent("RFC Catch Report\n\nAngler: " + userName + "\nEmail: " + anglerEmail + "\nDate: " + date + "\n\nFish: " + species + "\nLength: " + length + "\nBait: " + bait + "\nRod: " + rod + "\nSpot: " + spot + "\nNotes: " + notes);
    setRfcLink("mailto:RiversideFishingClubil@gmail.com?subject=" + subj + "&body=" + body);
    setStep(6);
  }

  var gear = (profile && profile.gear) || [];

  var inputStyle = { width:"100%", background:th.card, border:"1px solid " + th.border, borderRadius:8, padding:"10px 12px", color:th.white, fontSize:14, boxSizing:"border-box", outline:"none", marginBottom:10 };

  return (
    <div>
      <div style={{ display:"flex", gap:8, margin:"12px 0" }}>
        <OBtn label="Community Feed" onClick={function() { setView("feed"); }} color={view==="feed" ? th.green : th.muted} />
        <OBtn label="Log a Catch" onClick={function() { setView("log"); setStep(0); }} color={view==="log" ? th.green : th.muted} />
      </div>

      {view === "feed" && (
        <div>
          <SecLabel text="Recent Catches — All App Users" T={T} />
          {catches.map(function(c, i) {
            return (
              <Card key={i} T={T}>
                {c.photo ? <img src={c.photo} alt="catch" style={{ width:"100%", borderRadius:8, marginBottom:10, maxHeight:160, objectFit:"cover" }} /> : null}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:700, color:th.white, fontSize:14 }}>{c.species}</div>
                    <div style={{ fontSize:12, color:th.green }}>{c.length}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11, color:th.muted }}>{c.user}</div>
                    <div style={{ fontSize:10, color:th.muted, fontFamily:"monospace" }}>{c.date}</div>
                  </div>
                </div>
                <div style={{ fontSize:11, color:th.muted, marginTop:6 }}>{c.bait} · {c.spot}</div>
                {c.notes ? <div style={{ fontSize:12, color:th.white, marginTop:4, fontStyle:"italic" }}>"{c.notes}"</div> : null}
              </Card>
            );
          })}
        </div>
      )}

      {view === "log" && (
        <div>
          {step === 0 && (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
              <div style={{ fontSize:18, color:th.white, fontWeight:700, marginBottom:8 }}>Log a Catch</div>
              <div style={{ fontSize:13, color:th.muted, marginBottom:24 }}>Start with a photo or log without one</div>
              <input type="file" accept="image/*" capture="environment" ref={fileCameraRef} onChange={function(e) { handlePhoto(e, "camera"); }} style={{ display:"none" }} />
              <input type="file" accept="image/*" ref={fileLibraryRef} onChange={function(e) { handlePhoto(e, "library"); }} style={{ display:"none" }} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:10, marginBottom:12 }}>
                <button onClick={function() { openPhotoPicker(fileCameraRef); }} style={{ background:th.green + "22", border:"1px solid " + th.green, borderRadius:10, padding:16, cursor:"pointer", color:th.green, fontSize:13, fontWeight:700 }}>📷 Take Photo</button>
                <button onClick={function() { openPhotoPicker(fileLibraryRef); }} style={{ background:th.blue + "22", border:"1px solid " + th.blue, borderRadius:10, padding:16, cursor:"pointer", color:th.blue, fontSize:13, fontWeight:700 }}>🖼️ Upload from Device</button>
                <button onClick={function() { setStep(3); }} style={{ background:th.card, border:"1px solid " + th.border, borderRadius:10, padding:16, cursor:"pointer", color:th.white, fontSize:13, fontWeight:700 }}>📝 Log Without Photo</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>AI Fish Analysis</div>
              {renderPhotoWithRuler(220)}
              {photo ? <div style={{ fontSize:11, color:th.muted, marginTop:-4, marginBottom:10 }}>Photo source: {photoSource === "camera" ? "Camera" : "Photo library"}</div> : null}
              <Card T={T}>
                <div style={{ fontSize:12, color:th.muted, marginBottom:6 }}>Photo ruler in inches</div>
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:th.white }}>
                    <input type="checkbox" checked={showRuler} onChange={function(e) { setShowRuler(!!e.target.checked); }} />
                    Show ruler overlay
                  </label>
                  <select value={rulerInches} onChange={function(e) { setRulerInches(parseInt(e.target.value, 10) || 18); }} style={{ background:th.card, color:th.white, border:"1px solid " + th.border, borderRadius:8, padding:"6px 8px", fontSize:12 }}>
                    {[12,18,24,30].map(function(n) { return <option key={n} value={n}>{n} in</option>; })}
                  </select>
                </div>
              </Card>
              {aiLoading ? <div style={{ textAlign:"center", color:th.muted, padding:"20px 0" }}>Identifying fish...</div> : null}
              {aiResult && !aiLoading ? (
                <Card T={T} borderColor={th.green + "44"}>
                  <div style={{ fontSize:13, color:th.green, fontWeight:700, marginBottom:6 }}>AI Result — Please Verify</div>
                  <div style={{ fontSize:13, color:th.white, marginBottom:4 }}>Species: {aiResult.species} ({aiResult.confidence}% confident)</div>
                  <div style={{ fontSize:13, color:th.white }}>{aiResult.notes}</div>
                </Card>
              ) : null}
              <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Confirm species:</div>
              <input value={form.species} onChange={function(e) { setF("species", e.target.value); }} style={inputStyle} />
              <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Length options (inches or custom):</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                {[8,10,12,14,16,18,20,22,24].map(function(n) {
                  var label = n + " in";
                  var on = (form.length || "").toLowerCase() === (n + " inches");
                  return (
                    <button key={n} type="button" onClick={function() { choosePresetLength(n); }} style={{ background:on ? th.green + "33" : "transparent", border:"1px solid " + (on ? th.green : th.border), borderRadius:16, color:on ? th.green : th.muted, padding:"4px 10px", cursor:"pointer", fontSize:11 }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <input value={form.length} onChange={function(e) { setF("length", e.target.value); }} placeholder='Freeform: e.g. 17.5 inches or 45 cm' style={inputStyle} />
              <button type="button" onClick={setLengthNotMeasured} style={{ width:"100%", background:"transparent", border:"1px solid " + th.border, borderRadius:8, color:th.muted, padding:"8px 0", cursor:"pointer", fontSize:12, marginBottom:10 }}>
                Use "Length not measured"
              </button>
              <button onClick={function() { setStep(3); }} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700 }}>Next</button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>Catch Details</div>
              {["species","bait","spot","date"].map(function(k) {
                return (
                  <div key={k}>
                    <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>{k.charAt(0).toUpperCase() + k.slice(1)}</div>
                    <input value={form[k]} onChange={function(e) { setF(k, e.target.value); }} style={inputStyle} />
                  </div>
                );
              })}
              <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>Length (quick options or freeform)</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                {[8,10,12,14,16,18,20,22,24].map(function(n) {
                  var on = (form.length || "").toLowerCase() === (n + " inches");
                  return (
                    <button key={n} type="button" onClick={function() { choosePresetLength(n); }} style={{ background:on ? th.green + "33" : "transparent", border:"1px solid " + (on ? th.green : th.border), borderRadius:16, color:on ? th.green : th.muted, padding:"4px 10px", cursor:"pointer", fontSize:11 }}>
                      {n} in
                    </button>
                  );
                })}
              </div>
              <input value={form.length} onChange={function(e) { setF("length", e.target.value); }} placeholder="e.g. 13 inches, 17.5 in, 45 cm" style={inputStyle} />
              <button type="button" onClick={setLengthNotMeasured} style={{ width:"100%", background:"transparent", border:"1px solid " + th.border, borderRadius:8, color:th.muted, padding:"8px 0", cursor:"pointer", fontSize:12, marginBottom:10 }}>
                Use "Length not measured"
              </button>
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
              <button onClick={function() { setStep(4); }} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700 }}>Review</button>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ fontSize:16, color:th.white, fontWeight:700, marginBottom:12 }}>Review Your Catch</div>
              {renderPhotoWithRuler(200)}
              <Card T={T}>
                {[["Species",form.species],["Length",form.length],["Bait",form.bait],["Rod",form.rod],["Spot",form.spot],["Date",form.date],["Notes",form.notes]].filter(function(r) { return r[1]; }).map(function(r, i) {
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:6, paddingBottom:6, borderBottom:"1px solid " + th.border }}>
                      <span style={{ fontSize:12, color:th.muted }}>{r[0]}</span>
                      <span style={{ fontSize:12, color:th.white, textAlign:"right", maxWidth:"60%" }}>{r[1]}</span>
                    </div>
                  );
                })}
              </Card>
              <button onClick={submitCatch} style={{ width:"100%", background:th.green, color:"#000", border:"none", borderRadius:8, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700, marginBottom:8 }}>Post to Community Feed</button>
              <OBtn label="Edit" onClick={function() { setStep(3); }} color={th.muted} style={{ width:"100%", boxSizing:"border-box" }} />
            </div>
          )}

          {step === 6 && (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
              <div style={{ fontSize:18, color:th.white, fontWeight:700, marginBottom:6 }}>Catch Posted!</div>
              <div style={{ fontSize:13, color:th.muted, marginBottom:20 }}>Your catch is live on the community feed.</div>
              <div style={{ background:th.green + "18", border:"1px solid " + th.green + "44", borderRadius:10, padding:16, marginBottom:16, textAlign:"left" }}>
                <div style={{ fontSize:13, color:th.green, fontWeight:700, marginBottom:6 }}>Share with Riverside Fishing Club?</div>
                <div style={{ fontSize:12, color:th.muted, marginBottom:12 }}>Opens your email app pre-filled and ready to send.</div>
                <a href={rfcLink} style={{ display:"block", background:th.green, color:"#000", borderRadius:8, padding:"11px 0", textDecoration:"none", textAlign:"center", fontWeight:700, fontSize:14 }}>Open Email to RFC</a>
              </div>
              <button onClick={function() { setStep(0); setPhoto(null); setPhotoSource(""); setPhotoB64(null); setAiResult(null); setShowRuler(true); setRulerInches(18); setForm({ species:"", length:"", bait:"", spot:"", rod:"", notes:"", date:new Date().toLocaleDateString() }); }} style={{ background:"transparent", border:"1px solid " + th.green, color:th.green, borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:13 }}>
                Log Another Catch
              </button>
            </div>
          )}
        </div>
      )}
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
function ProfileTab({ profile, setProfile, theme, setTheme, T, goMyPrivateSpots }) {
  const th = THEMES[T];
  const [view, setView] = useState("main");
  const [form, setForm] = useState(normalizeProfile(profile));
  const [saved, setSaved] = useState(false);
  const [newGear, setNewGear] = useState({ nickname:"", brand:"", model:"", length:"", power:"", action:"", reel:"", line_type:"Monofilament", line_weight:"", leader_type:"", leader_weight:"", notes:"" });

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

  return (
    <div>
      <div style={{ textAlign:"center", padding:"16px 0 12px" }}>
        <div style={{ fontSize:44 }}>{form.email ? "🎣" : "👤"}</div>
        <div style={{ fontSize:18, color:th.white, fontWeight:700, marginTop:4 }}>{form.name || "Your Profile"}</div>
      </div>

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

      <Card T={T}>
        <SecLabel text="Security and Privacy" T={T} />
        {[["No login required","Browse everything without an account."],["Email only","No password ever."],["No data sold","Your info stays on your device."],["No ad tracking","Zero third-party analytics."]].map(function(item, i) {
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

// ─── NAV + APP ────────────────────────────────────────────────────────────────
var NAV = [
  {id:"home",emoji:"🏠",label:"Home"},
  {id:"fish",emoji:"🐟",label:"Species"},
  {id:"spots",emoji:"📍",label:"Spots"},
  {id:"lakes",emoji:"🌊",label:"Lakes"},
  {id:"catalogue",emoji:"📚",label:"Tackle"},
  {id:"catch",emoji:"📸",label:"Catch"},
  {id:"learn",emoji:"📖",label:"Learn"},
  {id:"me",emoji:"👤",label:"Me"},
];

export default function App() {
  const [tab, setTab] = useState("home");
  const [theme, setTheme] = useState("dark");
  const [spotsOpenSection, setSpotsOpenSection] = useState(null);
  const [profile, setProfile] = useState(function() {
    var stored = loadStoredProfile();
    var n = normalizeProfile(stored);
    if (!n.memberId) n.memberId = "mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    return n;
  });
  var th = THEMES[theme];
  // Backend adapter is instantiated once so future integrations route via one framework entry.
  const backendAdapter = useRef(null);
  if (!backendAdapter.current) {
    backendAdapter.current = createDataAdapter({
      provider: "local",
      firebase: { enabled:false },
    });
  }

  var clearSpotsOpenSection = useCallback(function() { setSpotsOpenSection(null); }, []);
  /** Opens Spots tab on the main screen (big green save / save another way). */
  var goSpotsMain = useCallback(function() {
    setTab("spots");
    setSpotsOpenSection(null);
  }, []);
  var goMyPrivateSpots = useCallback(function() { setTab("spots"); setSpotsOpenSection("my_spots"); }, []);

  useEffect(function() {
    persistProfileToStorage(profile);
  }, [profile]);

  return (
    <div style={{ background:th.bg, minHeight:"100vh", maxWidth:480, margin:"0 auto", fontFamily:"system-ui,-apple-system,sans-serif", color:th.white, paddingBottom:80 }}>
      <div style={{ padding:"0 14px" }}>
        {tab==="home"      && <HomeTab profile={profile} T={theme} onOpenSpots={goSpotsMain} />}
        {tab==="fish"      && <SpeciesTab T={theme} />}
        {tab==="spots"     && <SpotsTab profile={profile} setProfile={setProfile} T={theme} spotsOpenSection={spotsOpenSection} clearSpotsOpenSection={clearSpotsOpenSection} />}
        {tab==="lakes"     && <LakesTab T={theme} />}
        {tab==="catalogue" && <CatalogueTab T={theme} />}
        {tab==="catch"     && <CatchTab profile={profile} T={theme} />}
        {tab==="learn"     && <LearnTab T={theme} />}
        {tab==="me"        && <ProfileTab profile={profile} setProfile={setProfile} theme={theme} setTheme={setTheme} T={theme} goMyPrivateSpots={goMyPrivateSpots} />}
      </div>
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:th.nav, borderTop:"1px solid " + th.border, display:"flex", backdropFilter:"blur(12px)" }}>
        {NAV.map(function(n) {
          return (
            <button key={n.id} onClick={function() { setTab(n.id); }} style={{ flex:1, padding:"9px 0 6px", background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:1, borderTop: tab===n.id ? "2px solid " + th.green : "2px solid transparent" }}>
              <span style={{ fontSize:16 }}>{n.emoji}</span>
              <span style={{ fontSize:9, color:tab===n.id ? th.green : th.muted, fontFamily:"monospace", letterSpacing:0.2 }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
