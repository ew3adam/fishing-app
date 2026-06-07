RFC Fishing App — Complete Audit & Build Plan

Read src/App.jsx completely before doing anything. 
Then audit what exists vs what needs to be built.
Report findings before touching any code.

═══════════════════════════════════════════════════
PART 1 — AUDIT FIRST (read and report only)
═══════════════════════════════════════════════════

Check and report YES/NO for each item:

NAV STRUCTURE
□ Is "Lakes" removed from NAV array?
□ Is "Me" removed from NAV array?
□ Is "Scout" (🔍) present in NAV array?
□ Is final nav exactly: Home, Species, Spots, Tackle, Catch, Scout, Learn?

HEADER
□ Is there a persistent header bar at top of App()?
□ Does header have RFC logo/name on left?
□ Does header have 👤 avatar button on right?
□ Does avatar button open Profile when tapped?

SPOTSTAB
□ Does SpotsTab have a "Lakes" toggle as 3rd option?
□ Is Lakes toggle alongside "Local" and "Salmon Trail"?
□ Does Lakes toggle render LakesTab content inline?

CATCHTAB
□ Is step flow: 0 → 2 → 3 → 4 → 5 → 6?
□ Step 0: Photo or log only choice?
□ Step 2: Manual ruler with mouth/tail sliders?
□ Step 2: AI species ID fires in background?
□ Step 3: Shows AI result with confirm button?
□ Step 3: Shows manual species picker with search?
□ Step 3: Species picker scrollable list from SPECIES data?
□ Step 4: Catch details form (species, length, bait, spot, date, rod, notes)?
□ Step 5: Review screen with photo?
□ Step 6: Success + RFC email link?

SCOUТТAB — NEW FEATURE
□ Does ScoutTab component exist?
□ Section A "Identify This Spot":
  □ Photo upload button exists?
  □ AI call analyzes uploaded image?
  □ Returns probable location name?
  □ Returns confidence percentage?
  □ Returns species list for that water?
  □ Returns top 2 bait recommendations?
  □ Returns directions button (Google Maps + Apple Maps)?
  □ Graceful fallback if AI cannot identify?
□ Section B "Near Me Discovery":
  □ GPS fires on tab open?
  □ Finds water within 3 miles?
  □ Shows water name per result?
  □ Shows species per result?
  □ Shows bite score per result?
  □ Shows distance per result?
  □ Shows directions button per result?
  □ Hardcoded spots database exists with 25+ entries?
  □ Database covers Des Plaines River access points?
  □ Database covers Salt Creek access points?
  □ Database covers Cal-Sag Channel access points?
  □ Database covers Palos area lakes?
  □ Each spot has: name, lat, lng, parking notes, species array, water type?

HOMEТAB — UPGRADED
□ BFR dial present (animated needle, 0-100)?
□ BFR dial color coded (red/gold/green)?
□ Solunar feeding windows shown (major x2, minor x2)?
□ Solunar shows time and duration for each window?
□ Species-aware forecast (not just bass)?
□ Nearest water auto-detected from GPS?
□ Season-aware bait recommendations shown?
□ Wind DIRECTION shown (not just speed)?
□ Pressure trend shown (rising/falling/stable)?
□ Water temp estimate shown?
□ Best fishing hours timeline for today?
□ Existing weather card preserved?
□ Existing articles section preserved?
□ Existing fishing score notes preserved?

═══════════════════════════════════════════════════
PART 2 — BUILD PLAN (only after audit report)
═══════════════════════════════════════════════════

After you report the audit findings, build ONLY 
what is missing. Do one item at a time.
Wait for my OK after each change before continuing.
Run git add, git commit, git push after each 
approved change.

BUILD ORDER (if items are missing):

STEP 1 — NAV + HEADER (if not done)
- Remove Lakes and Me from NAV array
- Add Scout to NAV array
- Add persistent header to App() with:
  Left: "🎣 RFC" text
  Right: 👤 button that sets tab="me"
- Update App() render to include ScoutTab
- Update App() render to pass setTab to header

STEP 2 — SPOTSTAB LAKES TOGGLE (if not done)
- Add "Lakes" button to the Local/Salmon Trail toggle row
- When Lakes selected, render LakesTab content inline
- Keep all existing Spots functionality untouched

STEP 3 — CATCHTAB FIXES (if steps are wrong)
- Fix step numbering to: 0, 2, 3, 4, 5, 6
- Step 2: ruler overlay on photo with sliders
  - Mouth position slider (0-100%)
  - Tail position slider (0-100%)
  - Ruler inches input (default 24)
  - Live calculated length display
  - "Use this length → Species" button
  - AI fires in background on photo load
- Step 3: species confirmation
  - If AI succeeded: show species name + confidence % + notes + "Yes confirm" button
  - If AI failed: show "AI unavailable" orange card
  - Always show: search input + scrollable species list from SPECIES array
  - Each species row: emoji + name + checkmark if selected
  - "Confirm [species] →" button, disabled until selection made
- Steps 4/5/6: keep existing logic

STEP 4 — SCOUT TAB (if not done)
Build ScoutTab function with:

Section A — Identify This Spot:
- Header: "🔍 Identify This Spot"
- Subtitle: "Upload any fishing photo — Instagram, TikTok, or your own"
- Large upload button with camera icon
- Hidden file input, accept="image/*"
- On image select:
  - Show thumbnail of uploaded photo
  - Show loading state "Analyzing location..."
  - Call Anthropic API with image + this prompt:
    "You are a fishing location identification expert. 
    Analyze this photo for visual clues: bridges, 
    overpasses, skyline, water color and width, 
    vegetation, industrial structures, signage, 
    boat traffic. Focus on the Chicago metro area 
    including Des Plaines River, Cal-Sag Channel, 
    Salt Creek, Lake Michigan shoreline, Fox River, 
    Illinois River. Return ONLY raw JSON:
    {
      confidence: 85,
      location: 'Des Plaines River — Summit access',
      waterType: 'River',
      lat: 41.778,
      lng: -87.815,
      species: ['Largemouth Bass','Smallmouth Bass','Channel Catfish','Common Carp'],
      reasoning: 'Steel bridge structure and industrial background consistent with DPR near Stevenson',
      bait1: 'Texas Rig — green pumpkin plastic worm',
      bait2: 'Inline spinner — silver blade',
      cannotIdentify: false
    }
    If you cannot identify with any confidence set 
    cannotIdentify to true and leave other fields blank."
  - If cannotIdentify false: show result card with:
    - Confidence badge (green if >70%, gold if 50-70%, red if <50%)
    - Location name large
    - Water type pill
    - Species chips
    - Reasoning text in muted color
    - Bait 1 and Bait 2 highlighted
    - Google Maps + Apple Maps direction buttons using lat/lng
  - If cannotIdentify true: show orange card
    "Could not identify this location. Try a photo 
    with a visible bridge, road sign, or landmark."

Section B — Near Me Discovery:
- Header: "📍 Fishable Water Near You"
- Auto-runs GPS on tab open
- Shows loading state while locating
- Hardcode this spots database (SCOUT_SPOTS array):

  // DES PLAINES RIVER ACCESS POINTS
  {name:"DPR — Summit / Stevenson", lat:41.778, lng:-87.815, dist:0, waterType:"River", parking:"Pull off on Harlem Ave south of Stevenson overpass. Gravel shoulder.", species:["Largemouth Bass","Smallmouth Bass","Channel Catfish","Common Carp","Freshwater Drum"], tip:"Fish the eddies behind the bridge pilings. Night = catfish."},
  
  {name:"DPR — Lyons / 47th St Bridge", lat:41.812, lng:-87.819, dist:0, waterType:"River", parking:"Street parking on 47th St. Walk down the bank.", species:["Largemouth Bass","Common Carp","Channel Catfish"], tip:"Deep bend here holds carp and cats. Bass on the far bank riprap."},
  
  {name:"DPR — Thatcher Woods North", lat:41.874, lng:-87.831, dist:0, waterType:"River", parking:"FPDCC lot off Thatcher Ave, River Forest. Free.", species:["Largemouth Bass","Common Carp","Channel Catfish","Crappie","Northern Pike"], tip:"Eddies behind fallen logs hold bass. Night catfish in the deep bends."},
  
  {name:"DPR — Columbia Woods", lat:41.762, lng:-87.884, dist:0, waterType:"River", parking:"FPDCC lot off Willow Springs Rd. Free.", species:["Largemouth Bass","Channel Catfish","Common Carp","Crappie"], tip:"Best catfish holes on the DPR. Bring heavy gear and chicken liver."},
  
  {name:"DPR — Riverside Lagoon", lat:41.835, lng:-87.823, dist:0, waterType:"River/Lagoon", parking:"Street parking along Longcommon Rd, Riverside.", species:["Crappie","Bluegill","Largemouth Bass","Common Carp"], tip:"Calm water. Great for crappie under a bobber near the brush."},
  
  {name:"DPR — McCormick Woods", lat:41.800, lng:-87.837, dist:0, waterType:"River", parking:"FPDCC lot off 31st St, Brookfield.", species:["Largemouth Bass","Common Carp","Channel Catfish"], tip:"Less pressure than Thatcher. Good bass structure along the east bank."},

  // SALT CREEK ACCESS POINTS  
  {name:"Salt Creek — Brookfield Zoo South Bank", lat:41.831, lng:-87.836, dist:0, waterType:"Creek", parking:"Street parking on 31st St. Walk the path south.", species:["Largemouth Bass","Common Carp","Bluegill","Rock Bass"], tip:"Light tackle. Green pumpkin ned rig along the deep bends."},
  
  {name:"Salt Creek — Bemis Woods", lat:41.820, lng:-87.872, dist:0, waterType:"Creek", parking:"FPDCC Bemis Woods lot off Wolf Rd, Western Springs.", species:["Largemouth Bass","Common Carp","Bluegill","Channel Catfish"], tip:"Shaded banks hold bass midday. Carp in the slow shallow flats."},
  
  {name:"Salt Creek — Possum Hollow", lat:41.808, lng:-87.881, dist:0, waterType:"Creek", parking:"Small FPDCC lot off Wolf Rd south of Bemis.", species:["Largemouth Bass","Bluegill","Common Carp"], tip:"Undercut banks hold bass. Weedless Texas rig through the brush."},

  // CAL-SAG CHANNEL
  {name:"Cal-Sag — Hodgkins Access", lat:41.762, lng:-87.858, dist:0, waterType:"Channel", parking:"Pull off on Cal Sag Rd. Gravel lot near bridge.", species:["Common Carp","Channel Catfish","Largemouth Bass","Freshwater Drum"], tip:"Heavy rigs, long casts. Carp on corn hair rig. Cats on liver at night."},
  
  {name:"Cal-Sag — Lemont Road Bridge", lat:41.673, lng:-87.990, dist:0, waterType:"Channel", parking:"Street parking near Lemont Rd bridge.", species:["Common Carp","Channel Catfish","Freshwater Drum","Smallmouth Bass"], tip:"Deep water under bridge holds big cats and drum. Bottom rig only."},
  
  {name:"Cal-Sag — Blue Island Lakefront", lat:41.659, lng:-87.868, dist:0, waterType:"Channel", parking:"City of Blue Island park lot. Free weekends.", species:["Common Carp","Channel Catfish","White Bass","Freshwater Drum"], tip:"White bass run in spring. Blade baits and small jigs."},

  // PALOS AREA LAKES
  {name:"Sag Quarry East — North Aerator", lat:41.704, lng:-87.845, dist:0, waterType:"Quarry Lake", parking:"FPDCC Sag Quarry lot off 104th Ave, Palos Hills.", species:["Rainbow Trout","Largemouth Bass","Bluegill"], tip:"Cast toward aerator after stocking. PowerBait or inline spinner.", alert:"Trout Stamp required"},
  
  {name:"Horsetail Lake", lat:41.698, lng:-87.851, dist:0, waterType:"Lake", parking:"FPDCC lot off McCarthy Rd, Palos Hills.", species:["Rainbow Trout"], tip:"Smaller lake — easier to cover. Spinners and PowerBait.", alert:"Trout Stamp required"},
  
  {name:"Tampier Lake — North Flats", lat:41.656, lng:-87.845, dist:0, waterType:"Lake", parking:"FPDCC Tampier lot off 131st St, Palos Park.", species:["Largemouth Bass","Crappie","Bluegill","Channel Catfish","Yellow Perch"], tip:"Dawn topwater for bass on the north weed flats. Crappie on brush mid-lake."},
  
  {name:"Wolf Lake — North Shore", lat:41.663, lng:-87.533, dist:0, waterType:"Lake", parking:"Hammond lakefront park lot. Free.", species:["Crappie","Largemouth Bass","Yellow Perch","Northern Pike","Bluegill"], tip:"Best crappie lake in the region. Tiny jig under float at 4ft in May.", alert:"Straddles IL/IN border — check state regs"},

  // LAKE MICHIGAN SHORE
  {name:"Steelworkers Park — 87th St Slip", lat:41.734, lng:-87.527, dist:0, waterType:"Lake Michigan", parking:"Free lot at end of E 87th St, Chicago. Drive to the end.", species:["Coho Salmon","Chinook Salmon","Largemouth Bass","Yellow Perch","Freshwater Drum"], tip:"Rocks at first light for Coho. NW winds = go day. Community of regulars here."},
  
  {name:"31st St Harbor Breakwall", lat:41.838, lng:-87.614, dist:0, waterType:"Lake Michigan", parking:"31st St Beach lot, Chicago. Paid in summer.", species:["Coho Salmon","Yellow Perch","Freshwater Drum","Smallmouth Bass"], tip:"Harbor mouth early morning. Float rigs with spawn sacs for Coho."},

- Calculate distance from user GPS to each spot using:
  Math.sqrt((lat1-lat2)^2 + (lng1-lng2)^2) * 69
  (rough miles conversion)
- Filter to spots within 10 miles
- Sort by distance ascending
- Show each spot as a card with:
  - Water name + type pill
  - Distance in miles
  - Parking note
  - Species chips (first 4)
  - Tip text
  - Alert if present (orange)
  - Google Maps + Apple Maps buttons

STEP 5 — HOMEТAB UPGRADE (do this last)
- Keep everything existing
- ADD above the existing weather card:
  
  BFR DIAL:
  - SVG semicircle dial, 220px wide
  - Background arc gray
  - Colored arc animates from 0 to score on load
  - Needle animates to position
  - Score = calcBFR() function:
    Start at 50
    Temp 58-75F: +20, Temp 50-58: +10, Temp 75-85: +8
    Temp >85: -10, Temp <45: -25
    Wind 5-15mph: +10, Wind >20: -15, Wind <3: +5
    Precip <20%: +5, Precip >40%: -5, Precip >70%: -15
    New/Full moon: +15, Quarter moon: +8, else: +4
  - Score label: 85+ EPIC green, 70+ GREAT light green,
    55+ GOOD gold, 40+ FAIR orange, below POOR red
  
  SOLUNAR WINDOWS:
  - Calculate from moon position
  - Show 4 windows: Major x2, Minor x2
  - Each shows: type, time, duration
  - Major windows gold, Minor windows blue
  
  NEAREST WATER CARD:
  - Use same SCOUT_SPOTS database
  - Find closest spot to user GPS
  - Show: water name, distance, top species today
  - "Get forecast for this location" button
  - Tapping changes forecast context to that water's species
  
  SPECIES-AWARE BAITS:
  - Season detection (spring/summer/fall/winter by month)
  - Show top 3 baits for current season + conditions
  - Each bait: name, color, one-line why
  
  WIND DIRECTION:
  - Add to weather strip alongside speed
  - Show as compass direction (N, NE, NW etc)
  - Special note if NW wind: "NW wind — good day for Lake Michigan"
  
  PRESSURE TREND:
  - Show rising/stable/falling
  - Color: falling=green (fish feeding), rising=gold, stable=blue
  
  WATER TEMP ESTIMATE:
  - Estimate from air temp + month:
    Spring: air temp minus 8
    Summer: air temp minus 5  
    Fall: air temp minus 6
    Winter: air temp minus 10
  - Show as "~52°F est." in muted text
  
  GOLDEN HOUR COUNTDOWN:
  - Calculate minutes to next sunrise or sunset
  - Show: "🌅 Golden hour in 2h 14min" 
  - During golden hour: "🌅 Golden hour NOW — get fishing!"

═══════════════════════════════════════════════════
PART 3 — AFTER EACH CHANGE
═══════════════════════════════════════════════════

After each approved change:
1. git add src/App.jsx
2. git commit -m "RFC App — [describe what changed]"
3. git push
4. Tell me the commit was pushed
5. Wait for my OK before next step

DO NOT make multiple changes at once.
DO NOT refactor existing code.
DO NOT rename existing functions.
DO NOT change anything not listed above.

Start with PART 1 AUDIT only.
Read the file, check every item, report findings.
Do not write any code until I say go.

UPDATE DOCUMENTATION.

═══════════════════════════════════════════════════
PART 4 — AFTER EACH CHANGE
═══════════════════════════════════════════════════

Additional requirement for the HomeTab upgrade (Step 5):

Visual style — model it after BassForecast's UI:
- Dark background with subtle blue tint
- Clean bold typography, large numbers
- Cards with subtle borders, not flat boxes
- Color coded everything (green=good, gold=fair, red=poor)
- Premium fishing app feel, not generic

Target species selector:
- Row of species buttons at top of Home
- User picks what they are fishing for TODAY
- Everything below updates for that species:
  bait recommendations, bite tips, rig suggestions
- Default to "All Species" if nothing selected
- Remember last selection

First thing visible on Home when app opens:
- "What's biting near you right now" 
- Nearest water name + top species active today
- One clear bait recommendation
- Bite score for that location
- THEN the BFR dial and details below

This should feel like opening BassForecast — 
instant actionable intel, not a weather app.