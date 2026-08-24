# Last-Mile Delivery Game — Complete Game Design Document

**Working Title:** Last Mile (or "Shiplyp Chronicles")
**Platform:** PC (Steam), Mobile (iOS/Android)
**Genre:** Action delivery simulator + progression/management
**Core Loop:** Pick up → navigate obstacles → deliver → earn → upgrade
**Target Audience:** Casual-to-mid-core players; strong appeal in India market

---

## 1. Game Overview & Pitch

### The Concept

A top-down arcade delivery game set in India where players experience the reality of last-mile delivery across four distinct job tracks: newspaper delivery, milk delivery (doodhwala), e-commerce courier, and postal distribution. Each track has its own identity, hazards, vehicles, and progression arc. The game celebrates the chaos, skill, and grit of Indian street delivery while offering genuine mechanical depth.

**Comparison:** Crazy Taxi meets Overcooked meets Euro Truck Simulator, wrapped in a Mumbai/Kolkata aesthetic.

### Why This Game?

1. **Untapped market:** No mainstream game has tackled Indian delivery logistics as a core gameplay experience. The setting is ripe with visual personality, hazards (dogs, cows, thieves, monsoons), and cultural specificity.

2. **Mechanical variety:** Each delivery job has distinct mechanics (toss, balance, measure, navigate) that don't feel redundant. Players aren't grinding one loop; they're mastering four mini-games.

3. **Scalable scope:** Can ship as a one-track demo, gradually unlock others via DLC, and culminate in a management/company-building endgame.

4. **Monetization alignment:** Works as premium (₹299 full game), freemium (free track + paid track DLC), or hybrid (free browser demo → paid Godot builds).

---

## 2. Core Pillars

### 2.1 Authenticity

- Real Indian city geography (start fictional, layer OSM road data as DLC)
- Actual delivery challenges: wrong addresses, gated societies, absent customers, OTP verification, aggressive dogs
- Cultural flavour: festivals cause delivery spikes, bandhs block routes, monsoon makes roads impassable
- Parody branding (Kwiksend instead of Amazon, Shiplyp instead of Flipkart) avoids IP friction while keeping humour

### 2.2 Mechanical Depth

Every action has skill expression:
- **Toss mechanic (newspaper):** Arc prediction, power, timing while moving
- **Balance mechanic (milk):** Keep cans level, avoid tilting; physics-based
- **Route puzzle (e-commerce):** Optimize drop sequence, manage package condition
- **Measure slider (milk delivery):** Time-pressure, customer satisfaction tied to accuracy

### 2.3 Emergent Storytelling

- NPC regulars develop relationships: milk customers give you tea, newspaper subscribers complain when you're late
- Random events: monsoon flooding, festival traffic, local bandh, suspicious theft patterns
- Track-specific narratives: "Last Mile" is about a fresh graduate paying off a scooter loan; "Doodhwala" is about building a trusted customer base

### 2.4 Fair Difficulty Scaling

- Tutorial level teaches mechanics risk-free
- Difficulty unlocks with progression (harder dogs, tighter time windows, more hazards)
- Assist options: GPS toggle, dog tranquilizer items, delivery failure doesn't end run

---

## 3. Vehicle Types & Specs

Each vehicle has distinct handling, capacity, vulnerability, and lore.

### 3.1 Cycle

**Role:** Newspaper boy, milk delivery foundation, gali infiltration
**Appearance:** Vintage Indian bicycle with weathered paint, cargo basket
**Stats:**
- Speed: 15% (slowest)
- Capacity: 10% (smallest load)
- Agility: 95% (fits anywhere)
- Theft risk: 5% (basically zero)
- Weather resistance: 20% (no protection)

**Mechanics:**
- Can navigate alleyways (galis) that no other vehicle can access
- Toss mechanic for newspapers: power + arc prediction
- Milk delivery: balance heavy cans on front rack; tilt angle = spill risk
- Zero fuel cost; pure human power
- Dogs more likely to chase (slow vehicle = easy target)
- Monsoon is deadly (slippery, hard to balance load)

**Hazards:**
- Potholes cause immediate package damage if hit at speed
- Speed breakers in residential areas throw off balance
- Heavy rain = visibility loss + slippery surfaces

**Upgrade Path:**
- Cargo rack (capacity +25%)
- Mudguards (monsoon resistance +30%)
- Dynamo headlight (night visibility +50%)
- Reinforced tires (pothole damage -40%)

---

### 3.2 Bike (Motorcycle/Scooter)

**Role:** E-commerce express, food delivery, last-mile dash
**Appearance:** Bajaj/Hero/TVS model (Indian standard scooter)
**Stats:**
- Speed: 65% (very fast)
- Capacity: 28% (small load, thermal bag)
- Agility: 80% (good lane-splitting)
- Theft risk: 50% (medium — thieves target bikes)
- Weather resistance: 30% (exposed to elements)

**Mechanics:**
- Lane splitting: navigate gridlock by going between cars (high-risk, high-reward)
- Fuel management: meter counts down; running out = stranded (cost to refuel)
- Thermal bag mechanic: hot food timer counting down; degradation by road/weather
- Speed burst: briefly exceed speed limit to escape threat (uses fuel)
- Snatcher risk on isolated roads: motorbike thieves try to grab packages
- Stunt shortcuts: wrong-way on one-way, parking lot cuts (risk/reward)

**Hazards:**
- Autos and buses change lanes without signal
- Monsoon: slippery, poor visibility, thermal bag heats up faster
- Speed breakers knock bike off balance, thermal bag falls

**Upgrade Path:**
- Better thermal bag (heat retention +40%)
- Upgraded engine (speed +10%, fuel consumption -15%)
- Anti-theft lock (theft risk -30%)
- Dashboard phone mount (GPS visibility +20%)

---

### 3.3 Car

**Role:** Premium deliveries, medical cold-chain, gated society access
**Appearance:** Maruti Swift or similar hatchback
**Stats:**
- Speed: 55% (moderate-fast)
- Capacity: 42% (boot for multiple packages)
- Agility: 45% (poor in narrow streets)
- Theft risk: 20% (low; thieves avoid enclosed vehicles)
- Weather resistance: 90% (full protection)

**Mechanics:**
- Parking puzzle: no-parking zones, tow truck despawn timer, must find spot
- Boot capacity Tetris: arrange packages in boot without exceeding weight/fragile limits
- AC toggle: required for medical deliveries (cold chain ≥2–8°C), drains fuel
- Gated society acceleration: guards respect car, skip ID hassle
- Cannot enter old-city galis at all; must park and walk final 200m
- Weather protection: AC keeps cabin dry during monsoon

**Hazards:**
- Traffic fines if parked illegally (small penalty, cosmetic)
- Car overheats if AC left on while stationary
- Heavy rain causes visibility issues (slower safe speed)
- Narrow alleys force abandonment

**Upgrade Path:**
- Dash cam (evidence against fines, aesthetics)
- Roof rack (capacity +20%)
- Better AC (cold chain compliance +40%)
- Windshield wipers (monsoon visibility +30%)

---

### 3.4 Mini-Truck (Tata Ace)

**Role:** Bulk e-commerce, bulk grocery, B2B wholesale
**Appearance:** Yellow Tata Ace pickup truck, iconic Indian image
**Stats:**
- Speed: 38% (moderate)
- Capacity: 72% (large load)
- Agility: 25% (poor, cannot fit narrow alleys)
- Theft risk: 30% (small truck target)
- Weather resistance: 50% (open bed, tarpaulin cover)

**Mechanics:**
- Loading dock mini-game: drag packages into truck; exceed weight limit = overload penalty; fragile items on bottom = breakage
- Cannot enter galis at all; triggers "sub-agent" mechanic (hire cycle delivery for final-mile galis)
- Reverse camera puzzle: back into tight delivery bays, visualize guide lines, misjudge = scrape fence
- Tarpaulin mechanic: slide tarpaulin to cover cargo during monsoon or it gets soaked
- Parking takes entire lane width; nearby NPCs get angry (small penalty)
- Full AC unavailable; fan only

**Hazards:**
- Heavy loads slow acceleration
- Overloaded suspension damage from potholes
- Tarpaulin flies off if not secured; cargo exposed
- Reverse blindness (no camera upgrade) causes collision risk

**Upgrade Path:**
- Hydraulic lifting platform (load/unload time -50%)
- Enhanced suspension (pothole damage -30%)
- GPS fleet tracker (theft risk -40%)
- Better tarpaulin (weather protection +40%)
- Backup camera (reverse visibility +50%)

---

### 3.5 Truck (Distribution/Highway)

**Role:** Inter-city highway, wholesale distribution, long-haul
**Appearance:** Ashok Leyland or Tata truck, highway-specific
**Stats:**
- Speed: 45% (moderate on highway)
- Capacity: 98% (massive load)
- Agility: 8% (essentially immobile in city)
- Theft risk: 70% (high-value cargo = ambush risk)
- Weather resistance: 60% (cab protected, bed partially)

**Mechanics:**
- Fatigue meter: longer runs degrade driver performance (swaying, slower reaction)
- Mandatory dhaba (rest stop) every X km: eat, sleep, refuel; skip = drowsy-driving penalty
- Toll gates: select right lane (FASTag), slow lane, or bribe; wrong selection = queue delay
- City entry permit: cannot enter city center at certain hours (no-truck zones); fine if violated
- Goods manifest: sign-off item list at stops; discrepancy = police stop for inspection
- High-value load: option to hire security escort (cost) or risk ambush at night
- No lane splitting, no shortcuts, pure route-following

**Hazards:**
- Drunk drivers spike at night (unpredictable swerving)
- Breakdowns (random mechanical failure; stranded until mechanic)
- Bandits ambush on isolated night roads
- Fatigue causes collision risk; must rest

**Upgrade Path:**
- Refrigeration unit (cold chain runs available, +₹500/run)
- Better suspension (pothole damage -50%)
- GPS tracker (theft recovery, insurance discount)
- Secondary locking mechanism (cargo security +50%)
- Sleeper cabin (fatigue accumulation -30%)

---

## 4. Delivery Job Tracks

Each track is a standalone progression system with 5–6 levels, unique mechanics, and vehicle unlock chains.

### 4.1 Track 1: Newspaper Boy

**Time Window:** 4–6 AM (early morning, dark streets)
**Primary Vehicle:** Cycle → E-cycle upgrade at Level 4
**Map Area:** Residential colony (compact, known routes)
**Duration to Complete:** 6–8 hours

#### Core Mechanic: Toss

Arcade-style aiming: predict arc while moving, adjust power, land in doorstep. Perfect toss = bonus points; miss = complaint (accumulate 3 = subscriber lost). Toss from moving cycle without stopping = difficulty spike.

#### Progression

**Level 1 — Paperboy Trainee**
- Route size: 30 newspapers
- Daily earnings: ₹120
- Mechanics unlocked: Toss, basic aim assist
- Hazards: None yet (safe introduction)
- Unlock condition: Complete 5 perfect runs

**Level 2 — Assistant Paperboy**
- Route size: 50 newspapers
- Daily earnings: ₹180
- Mechanics unlocked: Dog encounters
  - Dogs emerge from houses, chase cyclist
  - Three options: outrun them (risky), stop and wait (time loss), use dog treat item (consumable)
- Hazards: Dogs, occasional pothole
- Unlock condition: 10 completed runs with 80%+ on-time delivery

**Level 3 — Seasoned Delivery Agent**
- Route size: 70 newspapers
- Daily earnings: ₹250
- Mechanics unlocked: Monsoon weather state
  - Wet roads reduce traction
  - Visibility reduced (darker screen, shorter draw distance)
  - Newspaper must be wrapped in poly bag or it gets destroyed
- New zone unlocked: Expand to adjacent street
- Hazards: Dogs, potholes, weather
- Unlock condition: Complete 20 runs with average 4+ star rating

**Level 4 — E-Cycle Upgrade**
- Route size: 90 newspapers
- Daily earnings: ₹320
- Vehicle unlock: E-cycle (motorized)
  - Speed +40%, but battery mechanic (charge station required)
  - Can carry more papers (capacity +50%)
- Mechanics unlocked: Night runs (5–7 AM window expands)
- Hazards: Battery depletion mid-route, aggressive dogs at night
- Unlock condition: Grind 30 runs at Level 3

**Level 5 — Sunday Edition Master**
- Route size: 120 newspapers
- Daily earnings: ₹400
- Special mechanic: Sunday edition = thicker, heavier, toss is harder
- Route complexity: maze-like streets, multiple entry/exit points
- Event: Festival surge during Diwali (3× orders, 3× chaos)
- Track completion: Final run is a timed gauntlet (beat personal best)

#### Subscriber Management Mechanic

- Each customer = tracked NPC
- Miss delivery 3 days → they unsubscribe (lose route income)
- Extra copies on request = small bonus
- Holiday pauses reduce route size (summer shutdown)
- Accumulate subscriber count as meta-progression metric

#### Unique Story Beats

- Week 1: Training under grumpy newspaper stand owner
- Week 2: First dog encounter, learn escape routes
- Week 3: Old customer Mr. Sharma dies, his widow takes over
- Week 4: Monsoon floods your usual route; must navigate detour
- Week 5: Rival paperboy challenges you to speed run (competitive event)

---

### 4.2 Track 2: Doodhwala (Milk Delivery)

**Time Window:** 4–7 AM (dawn route)
**Primary Vehicle:** Cycle → Cargo e-cycle at Level 4
**Map Area:** Apartment complex (static, recurring locations)
**Duration to Complete:** 8–10 hours

#### Core Mechanic 1: Balance

Physics-based: heavy stainless steel milk cans on cycle front rack. Tilt angle matters. Too much angle = spill event (partial loss of milk, customer discount). Manage tilt while navigating potholes and speed breakers.

#### Core Mechanic 2: Measure

At each delivery: slider mechanic to pour exact quantity (500 mL, 1L, 2L, etc.). Tight time window (5 seconds). Short-pour = customer complaint; over-pour = your financial loss. Customer learns your "pouring patterns" over time (hidden stat).

#### Progression

**Level 1 — New Doodhwala**
- Regular customers: 25
- Daily earnings: ₹180
- Mechanics unlocked: Balance mechanic, measure slider
- Hazards: Impatient customers, occasional spills
- Unlock condition: 5 clean deliveries with zero spills

**Level 2 — Trusted Supplier**
- Regular customers: 40
- Daily earnings: ₹250
- Mechanics unlocked: Credit system
  - Some customers pay monthly-end (trust gauge)
  - Non-payment = escalation (friendly reminder → formal notice)
- Hazards: Credit collection stress, demanding customers
- Unlock condition: Maintain 35+ customers for 10 days

**Level 3 — Established Route**
- Regular customers: 60
- Daily earnings: ₹330
- Mechanics unlocked: Spill event (major)
  - If spill happens, customer rage event (1-star, refund required)
- New location: Adjacent apartment building (expand route)
- Hazards: More customers = higher spill risk, time pressure
- Unlock condition: Grind to 60 customers, weather at least one monsoon

**Level 4 — Premium Milk Supplier**
- Regular customers: 80
- Daily earnings: ₹420
- Vehicle unlock: Cargo e-cycle
  - Electric assist for heavy loads
  - Can carry more cans (double capacity)
  - Battery mechanic (charge between runs)
- Mechanics unlocked: Premium orders (higher-end milk, catering)
- Hazards: Battery management, cargo overweight
- Unlock condition: 30 runs at Level 3 with 80%+ customer satisfaction

**Level 5 — Doodhwala Legend**
- Regular customers: 100+
- Daily earnings: ₹500
- Mechanics unlocked: Festival spikes (Diwali, Durga Puja)
  - Mawa (condensed milk) orders triple
  - Special quantities, premium pricing
- Track completion: Reach 100 customers, achieve "trusted by the neighborhood" status

#### Relationship Mechanic

- Each customer is an NPC with preferences (Monday = 1.5L, Wednesday = 500mL, weekend = off)
- Mrs. Sharma gives you chai on Thursdays (morale boost)
- Uncle Vijay always tips ₹10 on Fridays (relationship tracker)
- Miss delivery = relationship degrades → they switch supplier
- Build relationships over 100+ days (real game time) for meta-progression

#### Unique Story Beats

- Week 1: Learn from senior doodhwala
- Week 2: First credit collection (awkward customer interaction)
- Week 3: Customer complains about short-pour; repair trust
- Week 4: Competitor doodhwala arrives; lose 5 customers
- Week 5: Win them back with premium service

---

### 4.3 Track 3: E-Commerce Delivery (Amazon/Flipkart/Meesho)

**Time Window:** 9 AM–9 PM (full-day delivery window)
**Primary Vehicles:** Bike (L1–2) → Car (L3–4) → Mini-truck (L5–6)
**Map Area:** Full city (diverse neighborhoods, gated societies, offices)
**Duration to Complete:** 12–16 hours (longest track)

#### Core Mechanic 1: OTP Verification

At delivery: customer provides OTP code. You enter it in 30 seconds. Wrong code or timeout = failed delivery (return to hub, refund issued). NPC variation: some customers are away, some code is wrong intentionally (scam test).

#### Core Mechanic 2: Route Optimization Puzzle

Pre-run screen: given 12 packages with addresses scattered across map. Plan optimal sequence (minimize distance, time-pressure bonuses). Visual path-tracing tool. Suboptimal routes = late penalties. Hazards cause route disruptions (detour around flood, reroute around theft area).

#### Core Mechanic 3: Package Condition Meter

Each package has condition: pristine → damaged → destroyed. Potholes, sharp turns, drops = condition loss. Deliver in perfect condition = bonus. Deliver damaged = discount (customer rated 3 stars). Destroyed = forced return, negative pay.

#### Progression

**Level 1 — New Partner Onboarding**
- Deliveries per shift: 8
- Avg earnings: ₹250
- Mechanics unlocked: OTP, route puzzle, package condition
- Hazards: Wrong addresses, absent customers, basic traffic
- Unlock condition: Complete 5 full routes with 80%+ success

**Level 2 — Established Delivery Agent**
- Deliveries per shift: 12
- Avg earnings: ₹360
- New zone unlocked: Expand to adjacent neighborhood
- Mechanics unlocked: Partial failure (customer not home = reschedule option)
- Hazards: Gated societies (security checks), traffic jams, dogs
- Unlock condition: 20 completed routes, maintain 3.8+ star average

**Level 3 — Premium Tier Access**
- Deliveries per shift: 15
- Avg earnings: ₹480
- Mechanics unlocked: COD (cash on delivery) collection
  - Count change correctly in 10-second timer
  - Customer disputes deduct from earnings
- Return logistics: pick up rejected packages same route (complex juggling)
- Hazards: COD time pressure, return load management
- Unlock condition: Grind to Level 2, complete 40 routes

**Level 4 — Car Partnership Tier**
- Deliveries per shift: 18
- Avg earnings: ₹600
- Vehicle unlock: Car
  - Capacity +80%, weather protection
  - Parking puzzle: must find legal spot (Tetris package arrangement in boot)
- Cannot enter narrow galis; must park and walk
- Mechanics unlocked: Medical/premium deliveries (cold chain, higher pay)
- Hazards: Parking fines, overloading, gali inaccessibility
- Unlock condition: 50 routes at Level 3, 4+ star average

**Level 5 — B2B Bulk Delivery**
- Deliveries per shift: 25
- Avg earnings: ₹800
- Company unlock: Corporate/bulk orders
  - Meesho bulk delivery to shops
  - Multi-package drops to same address
  - Route becomes warehouse-focused
- Mechanics unlocked: Loading dock mini-game (stack packages, weight limits)
- Hazards: Overload penalties, shop-owner grumpiness
- Unlock condition: 60 routes at Level 4, complete 3 "premium" runs

**Level 6 — Top-Tier Operator**
- Deliveries per shift: 30+
- Avg earnings: ₹1000
- Vehicle unlock: Mini-truck (Tata Ace)
  - Can carry 25+ packages
  - Sub-agent mechanic: hire cycle agents for gali-exclusive drops
  - Managing sub-agents = delegation puzzle
- Track completion: Scale to ₹1000/day, 30+ deliveries, 4.5+ star rating
- Endgame unlock: Eligible for company ownership mode

#### Rating Mechanic

- Every delivery generates 1–5 star rating
- Weekly average affects next week's incentive payout
- Maintain 4.5+: earn bonus
- Drop below 3.5: get warning, potential suspension
- Ratings tied to: on-time delivery, package condition, politeness (NPC mood), OTP accuracy

#### Unique Story Beats

- Week 1: Amazon onboarding, learn city zones
- Week 2: First wrong address; customer is furious
- Week 3: Monsoon causes chaos; find alternate routes
- Week 4: Theft incident; police statement, insurance claim
- Week 5: Big Billion Day (festival surge): 3× orders, pure chaos
- Week 6: Customer gives 5-star review with ₹50 tip (morale boost)

---

### 4.4 Track 4: Post Office Delivery

**Time Window:** 9 AM–5 PM (business hours)
**Primary Vehicles:** Cycle (L1–2) → Postal jeep (L3–4) → Truck (L5)
**Map Area:** City + rural suburbs (mixed urban/village)
**Duration to Complete:** 10–12 hours

#### Core Mechanic 1: Sorting Puzzle

Each morning: sort incoming mail by PIN code, building, sector. Visual match-and-drop puzzle (color-coded zones). Accuracy = speed to next delivery. Mis-sort = route disruption (wrong drop location, forced backtrack).

#### Core Mechanic 2: Package Registration

Formal signature on register at each delivery. Verify recipient ID. Special items (registered, insured, COD) require extra care. Lose package = police report + career damage.

#### Progression

**Level 1 — Postal Assistant**
- Mail items per day: 200
- Daily earnings: ₹150
- Mechanics unlocked: Sorting puzzle, basic delivery
- Hazards: Lost mail, difficult addresses, impatient customers
- Unlock condition: Sort 5 batches with 90%+ accuracy

**Level 2 — City Postal Officer**
- Mail items per day: 350
- Daily earnings: ₹220
- New zone unlocked: Rural routes (villages, farms)
  - Addresses harder to find (no GPS signals, dirt roads)
  - Delivery windows looser (farmers have unpredictable schedules)
- Mechanics unlocked: Registered mail (must get signature)
- Hazards: Rural navigation, animal encounters (cows, aggressive animals)
- Unlock condition: 20 routes, 85%+ success rate

**Level 3 — Regional Distributor**
- Mail items per day: 500
- Daily earnings: ₹300
- Vehicle unlock: Postal jeep (Bolero or similar)
  - Can handle rural roads (terrain mechanic)
  - Better capacity than cycle
  - Basic AC for comfort
- Mechanics unlocked: Package insurance claims (customer disputes)
- Hazards: Terrain damage, mechanical breakdown risk
- Unlock condition: Grind Level 2, 40 routes

**Level 4 — Multi-Route Coordinator**
- Mail items per day: 700
- Daily earnings: ₹400
- Mechanics unlocked: Bulk package registration
  - Institutional mail (government, corporate)
  - Signature logs get complex (multiple signees, timestamps)
- New zone unlocked: Industrial areas, government offices
- Hazards: Security checks at government buildings, bureaucratic delays
- Unlock condition: 50 routes, manage multiple document types

**Level 5 — Regional Manager**
- Mail items per day: 1000
- Daily earnings: ₹500
- Vehicle unlock: Distribution truck
  - Regional hub-to-hub runs (inter-city)
  - Manifest management, load verification
  - Fatigue/rest mechanics (like truck track)
- Mechanics unlocked: Franchise/sub-office management
  - Delegate delivery to sub-offices
  - Monitor their performance (trust system)
- Track completion: Scale to 1000 items/day, manage 3+ sub-offices, 90%+ delivery rate

#### Unique Story Beats

- Week 1: Training on mail sorting, postal regulations
- Week 2: First rural delivery; GPS fails, navigate by landmarks
- Week 3: Lost registered mail incident; fix customer trust
- Week 4: Government office delivery; navigate bureaucracy
- Week 5: Heavy package delivery (medical courier); care for contents

---

## 5. Game Mechanics (Global)

### 5.1 Hazards & Obstacles

**Static Hazards:**
- Potholes: reduce package condition, slow vehicle, can cause collision
- Speed breakers: force vehicle to slow or swerve, unbalance load
- Flooded underpasses: impassable during/after monsoon; force reroute
- Narrow galis: blocked for large vehicles (car, truck); must abandon and walk

**Dynamic Hazards:**
- Dogs: chase low-speed vehicles; triggered by proximity
  - Options: outrun, stop/wait, use dog treat item
  - Some dogs more aggressive than others
  - Scare dog away with honk (vehicle-dependent)
- Cows: immovable; must navigate around
  - Honk does nothing
  - Can't hit cow (crash, game over)
- Thieves: ambush on isolated roads
  - Motorcycle snatchers grab from bikes
  - Robbery of high-value packages
  - Can speed away or hire security
- Autos/buses: unpredictable lane changes, no-signal braking
- Pedestrians: emerge from between parked cars in markets
- Drunken drivers: spike at night, random swerving

**Environmental Hazards:**
- Monsoon: slippery roads, visibility reduced, flooding, equipment damage
- Dust storms: visibility near-zero, slow safe speed
- Festival congestion: Diwali/Durga Puja causes 3× traffic, celebration events block roads
- Bandh (strike): certain routes sealed off, full reroute
- Construction: lane closures, temporary detours, dusty work zones

### 5.2 Time Mechanics

**Time of Day System:**
- 4 AM–7 AM: Dawn (newspaper, milk routes; quiet, dark)
- 7 AM–10 AM: Morning (traffic builds; medium chaos)
- 10 AM–2 PM: Noon (peak traffic; high chaos, heat)
- 2 PM–5 PM: Afternoon (moderate; post-lunch calm)
- 5 PM–8 PM: Evening (traffic peak again; delivery window closes)
- 8 PM–11 PM: Night (low traffic; high theft risk, fatigue issues)

**Delivery Windows:**
- Each package has a promised delivery window (e.g., 10 AM–12 PM)
- Deliver within window = full bonus
- Deliver outside window = penalty on earnings
- Severely late (>2 hours) = auto-fail delivery, forced return

**Fatigue System (Truck/Long-Haul Only):**
- Fatigue meter accumulates with drive time
- At high fatigue: swerving, delayed reaction, collision risk
- Must stop at dhaba (rest stop) to reset fatigue
- Sleep and eat during rest (mini-game to recover)

### 5.3 Weather System

**States:**
- Clear: normal conditions, no penalties
- Dusty/hazy: visibility -30%, speed -10%
- Cloudy: minor rain threat, conditions normal
- Light rain: roads slightly slippery (-10% traction), visibility -15%
- Heavy rain: slippery (-30%), visibility -40%, flooding risk, equipment damage
- Monsoon: flooding underpasses, max chaos, package exposure risk

**Vehicle-specific effects:**
- Cycle: monsoon destroys newspapers (need poly bag), balance becomes extremely difficult
- Bike: thermal bag heat loss accelerates, visibility hazard for driver
- Car: AC must be on, fuel consumption increases, visibility aids help
- Truck: fatigue increases, routes may close, security escorts recommended

### 5.4 Difficulty Scaling

**Per-Track Tuning:**
- Level 1 = introduction, mechanics only, no failure state
- Level 2–3 = normal difficulty, hazards introduce, failure = time loss only
- Level 4–5 = hard, penalties stack, mistakes visible in earnings

**Assist Options:**
- GPS: always on for e-commerce (addresses); off for newspaper (pure memory)
- Dog tranquilizer: consumable item (limited per run)
- Delivery failure forgiveness: retry once per shift (Godot-exclusive feature)
- Slow-motion toggle: brief time dilation to plan route

### 5.5 Reputation & NPC Interactions

**Customer Ratings:**
- 1 star: terrible, refund issued, relation breaks
- 2 stars: poor, small penalty
- 3 stars: okay, no bonus
- 4 stars: good, small bonus
- 5 stars: excellent, bonus + morale boost

**NPC Memory:**
- Regular customers remember you across shifts
- Mrs. Sharma (milk) gives chai on Thursdays
- Angry customers recognize you (avoid them or repair relation)
- Rival paperboy/doodhwala remembers if you beat them in race

**Relationship Tracking:**
- Trust meter per customer
- Broken relation = customer leaves
- Strong relation = tips, referrals (route expansion)

---

## 6. Progression System

### 6.1 Progression Architecture

**Each track is independent:** Completing newspaper boy does NOT unlock e-commerce mechanics. They exist in parallel.

**Per-Track Progression:**
- 5–6 levels per track
- Level = earned through play time + performance metrics
- Vehicle unlocks tied to specific levels
- Mechanics gradually introduce with difficulty

**Cross-Track Mechanics:**
- Earnings from all tracks pool into shared currency
- Currency used for vehicle maintenance, upgrades, consumables
- Upgrades apply across all vehicles (e.g., better suspension helps all)

### 6.2 Specific Track Progressions (Summary)

| Track | L1 | L2 | L3 | L4 | L5 | L6 |
|-------|----|----|----|----|----|----|
| **Newspaper** | Cycle | Cycle | Cycle (zone) | E-cycle | E-cycle (final) | — |
| **Milk** | Cycle | Cycle | Cycle (zone) | E-cycle | E-cycle (final) | — |
| **E-commerce** | Bike | Bike | Bike (zone) | Car | Car (zone) | Mini-truck |
| **Post Office** | Cycle | Cycle (rural) | Postal jeep | Jeep (complex) | Truck (regional) | — |

### 6.3 Unlock Conditions

**Lock progression by:**
- Play time: at least 30 minutes at current level
- Performance: maintain 80%+ success rate for 10 runs
- Earnings: reach cumulative earnings threshold (₹5000, ₹15000, etc.)
- Special events: complete narrative story beat (e.g., repair relation after theft)

**Don't lock by:** Grinding single perfect run (demoralizing); harsh RNG requirements (inconsistent difficulty)

---

## 7. Endgame: Logistics Company Owner

### 7.1 Overview

Once all four tracks are completed, unlock company ownership mode. Shift from street-level delivery to management/strategy.

**Core Loop:** Hire agents → assign to tracks → manage routes/vehicles → balance profit vs. coverage → expand cities

### 7.2 Mechanics

**Agent Management:**
- Hire NPC delivery agents (visual character customization)
- Assign agent to track + vehicle
- Each agent has stats: speed, reliability, customer service, loyalty
- Pay agent daily wage; deduct from company earnings
- Agent morale degrades if overworked; boost with breaks/bonuses

**Performance Dashboard:**
- Total daily deliveries (target: 200+)
- Avg rating per track (target: 4.5+)
- Profit margin: revenue - payroll - fuel - maintenance
- Customer retention rate: % of regulars who stick
- Track-by-track breakdown: which track is most profitable

**Fleet Management:**
- Buy/sell vehicles (budget constraint)
- Assign vehicle to agent (right-size for track)
- Maintenance scheduling: neglect = breakdown cost
- Fuel refueling: auto at gas station or manual
- Insurance: optional; reduces theft loss if incident occurs

**Route Planning:**
- Manually optimize routes or auto-plan (less efficient)
- Assign agents to specific routes
- Handle dynamic events: agent calls in sick → reassign or hire temp

**City Expansion:**
- Start in home city (Kolkata/Mumbai)
- Unlock new city after hitting: 100+ agents, ₹1 lakh daily revenue, 90%+ avg rating
- Open branch office in new city (one-time cost ₹50k)
- Hire local agents, bootstrap operations

**B2B Contracts:**
- Unlock after completing each track:
  - Newspaper: bulk distribution to newsstands (₹5k/week)
  - Milk: corporate subscription service (₹8k/week)
  - E-commerce: regional Amazon partnership (₹15k/week)
  - Post office: rural delivery contracts (₹7k/week)
- Accept/decline contracts based on capacity

### 7.3 Progression Metrics (Endgame)

| Milestone | Reward |
|-----------|--------|
| 50 agents | Achievement: "Growing operation" |
| 100 agents | Unlock 2nd city |
| ₹1 lakh daily revenue | Achievement: "Major player" |
| 3+ cities | Unlock endgame finale: "National logistics network" |
| 200+ agents | Achievement: "Biggest network" (true ending) |

### 7.4 Victory Conditions

**Short term (1 week play):**
- Manage 20 agents, 50+ deliveries/day, ₹20k daily revenue

**Mid term (2–3 weeks):**
- Operate in 2 cities, 60+ agents, ₹50k daily revenue

**Long term (endgame):**
- 3+ cities, 200+ agents, ₹1 lakh+ daily revenue, 90%+ rating

---

## 8. Game Modes

### 8.1 Story Mode: "Last Mile"

Linear progression through all four tracks. Narrative: fresh college graduate (player) takes delivery job to pay off a scooter loan. Each track represents a season in their life:
- Newspaper boy: summer break (quick money)
- Milk delivery: monsoon (relationship building)
- E-commerce: festival season (saving hard)
- Post office: winter (steady income, career pivot)

Endgame: retirement of loan, offer from logistics company to become manager, opens company ownership mode.

### 8.2 Time Attack / Speedrun

- Locked routes, 15-minute timer
- Maximize deliveries in time limit
- Rankings: leaderboard (global or local)
- Accessible after completing track's Story mode

### 8.3 Endless / Survival

- Start with 1 vehicle, infinite deliveries
- Hazards increase: harder dogs, more traffic, cascading failures
- One mistake = run ends (rogue-like)
- Meta-progression: unlock cosmetics for high scores

### 8.4 Sandbox / Freeplay

- Unlock all routes, vehicles, mechanics
- No time pressure, no failure state
- Explore city, complete optional challenges
- Cosmetic cosmetics: custom liveries, vehicle skins

### 8.5 Multiplayer Race (Local/Online)

- Same map, same deliveries, same time limit
- First player to complete all drops wins
- Networked scoring via optional account integration

---

## 9. Monetization Strategy

### 9.1 PC/Steam (Premium)

**Model:** One-time purchase, all content included
**Price:** ₹299–499 (USD $4–7)
**Content:**
- All 4 tracks (Newspaper, Milk, E-commerce, Post Office)
- All vehicles + cosmetics
- Full story mode + company mode
- No IAP, no ads, no battle pass

**DLC Option (later):**
- City pack: Mumbai/Delhi (add new map with track variations) — ₹100–150
- Cosmetics: vehicle skins, character skins — ₹25–50 each

### 9.2 Mobile (Freemium)

**Base Game:** Free
- 1 complete track (Newspaper Boy)
- All core mechanics, 5 levels
- Can earn currency in-game to unlock others

**IAP:**
- Unlock Track 2 (Milk): ₹79
- Unlock Track 3 (E-commerce): ₹99
- Unlock Track 4 (Post Office): ₹79
- Full game bundle: ₹249 (vs. ₹259 separate)
- No pay-to-win; cosmetic-only premium currency

**Ad Integration (optional):**
- Skip delivery failure animation with short video ad
- Bonus currency chest after level completion (video opt-in)

### 9.3 Browser Demo (Itch.io/Web)

**Free, ad-supported**
- Newspaper Boy track (Level 1–2 only)
- Limited time (20 mins per session before cooldown)
- Share scores on social media
- Cross-link to Steam/mobile purchase

---

## 10. Technical Stack & Architecture

### 10.1 Engine Options

#### Godot 4 (Primary Recommendation)

**Why Godot:**
- Free, open-source
- Excellent 2D performance
- One codebase → export to PC, Android, iOS, Web
- You have prior interest in Godot
- Strong support for navigation meshes (road graph AI)

**Architecture:**
- Scenes: Player vehicle, NPC agents, UI screens, map zones
- Scripts: GDScript (Python-like)
- Navigation: NavigationAgent2D for pathfinding
- Graphics: Top-down 2D pixel or isometric low-poly

**Asset Pipeline:**
- Tile-based map (Aseprite or Krita for pixel art)
- Vehicle sprites (4-direction or 8-direction)
- NPC/pedestrian sprites (animated)
- UI designed in-engine

#### Phaser.js (Prototype/Browser)

**Why Phaser for prototype:**
- Fast iteration, immediate feedback in browser
- Zero installation friction for testers
- Excellent for arcade mechanics (toss, balance feedback)
- Can ship browser version to itch.io day one

**Architecture:**
- Scenes: preload, create, update, render loop
- Input: keyboard, mouse (for toss arc aiming)
- Physics: Arcade Physics (simple collision, not realistic)
- Networking: optional (Firebase for leaderboards)

**Recommendation:** Prototype Newspaper Boy in Phaser (2 weeks), validate mechanics, then port to Godot for full game.

### 10.2 Map & Navigation

**Approach 1: Procedural (Quick)**
- Generate small city sector procedurally
- 3×3 grid of neighborhoods
- Each neighborhood has fixed POIs (houses, shops, hubs)
- Roads auto-connect with simple rules

**Approach 2: Handcrafted (Best Quality)**
- Design single neighborhood in detail (artist time)
- Reuse/tile the neighborhood with variations
- Place unique landmarks (mosque, temple, market) manually
- OSM data integration (optional, for real city DLC)

**Navigation Mesh:**
- Build road graph (nodes = intersections, edges = roads)
- NavigationAgent2D computes A* path between pickup and delivery
- Mark impassable zones (galis for trucks, flooded areas)
- Update dynamically (monsoon flooding, construction)

### 10.3 Audio Design

**Engine:** Godot AudioStreamPlayer, or FMOD (for advanced features)

**Sounds:**
- Vehicle engines: distinct audio per vehicle (cycle=silence, bike=putt-putt, car=engine, truck=diesel rumble)
- Toss mechanic: satisfying "thunk" for landing, "swoosh" for miss
- Collision: impact sounds (pothole, bump, crash)
- Ambient: traffic, street vendors, morning birds
- UI: menu clicks, level-up fanfare, achievement ding

**Music:**
- Morning routes (newspaper/milk): soft, peaceful, flute/sitar
- Daytime routes (e-commerce): upbeat, dynamic, electric
- Endgame: triumphant, orchestral

**Dialogue:**
- No voice acting (cost/scope)
- Text-based NPC interactions with sound effects (door knock, phone ring)

### 10.4 Deployment Pipeline

| Platform | Engine | Export | File Size | Build Time |
|----------|--------|--------|-----------|------------|
| PC/Steam | Godot 4 | Godot export | 150–250 MB | 15 mins |
| Android | Godot 4 | APK/AAB | 100–150 MB | 20 mins |
| iOS | Godot 4 | XCFramework | 120–180 MB | 30 mins |
| Web/itch.io | Phaser/Godot HTML5 | HTML5 export | 50–80 MB | 10 mins |
| Steam demo | Godot 4 | Godot export | Same as full (Newspaper Boy playable 1-2 hrs) | — |

---

## 11. Art Style & Visual Direction

### 11.1 Art Style Options

#### Option A: Pixel Art Top-Down (Recommended for Solo Dev)

**Visual Reference:** Crazy Taxi art style, scaled to Indian setting
- 16×16 or 32×32 grid-based tileset
- Vehicle sprites: 4-direction or 8-direction
- NPC: simple, 2-3 frame walking animation
- Buildings: flat-colored, clear silhouettes
- UI: clear, readable, retro pixel font

**Production:** 1 artist can complete asset set in 2–3 months

**Tools:** Aseprite (€20 one-time), Krita (free)

#### Option B: Isometric Low-Poly (Higher Production, More Time)

**Visual Reference:** Overcooked aesthetic
- 3D models in isometric projection (fake 3D)
- Modular buildings, reusable props
- Vehicle models low-poly (200–500 triangles)
- Satisfying, cartoony feel

**Production:** 1 artist + outsourced 3D = 4–5 months

#### Option C: 3D Top-Down (Scope Creep Risk)

**Visual Reference:** Mini Metro, Death Stranding
- Real 3D camera, top-down orthographic
- Detailed environments, weather effects
- High polish but high scope

**Production:** Team required; not solo-friendly

**Recommendation:** Start with Pixel Art (Option A). It's closest to Crazy Taxi heritage, fastest to iterate on, and very serviceable for this genre.

### 11.2 Color Palette

**City Design:**
- Residential: warm beige, ochre buildings; green vegetation
- Old city (gali): darker, cramped, colorful shop awnings
- Industrial/office: gray concrete, glass facades
- Nature: monsoon-green, dust-brown, sunset oranges

**Vehicles:**
- Cycle: warm wood tones, chrome details
- Bike: bright (Hero Black, Bajaj blue), metallic
- Car: practical white/silver, some personalization
- Mini-truck: iconic yellow (Tata Ace), worn paint
- Truck: weathered blue/gray, hazard stripes

**UI:**
- Primary: warm amber/gold (Indian aesthetic)
- Secondary: cool teal (complementary)
- Danger: red, warning: orange
- Success: green

### 11.3 Animation & Polish

**Vehicle Movement:**
- Smooth tweening between grid cells (or continuous path)
- Lean into turns (cycle leans, truck straightens)
- Wheel rotation scaled to speed
- Visible tire wear/damage as visual feedback

**NPC Behavior:**
- Idle animations: stretch, look around, adjust clothes
- Walk cycles: distinct per NPC type (old person shuffles, child hops)
- Reaction animations: dog bark + lunge, customer wave, angry gesture

**Feedback:**
- Floating numbers on successful delivery (+₹20, +10 points)
- Screen shake on collision/failure
- Color flash on tier-up (e.g., Level 3 achieved)
- Particle effect on completed delivery (confetti, spark)

---

## 12. Project Timeline & Build Roadmap

### 12.1 Milestone Timeline (Solo Dev, Full-Time)

**Phase 1: Prototype (Weeks 1–4)**
- Engine: Phaser.js
- Content: Newspaper Boy, Level 1–2
- Map: Single neighborhood (handcrafted, 5×5 blocks)
- Mechanics: Toss, basic movement, scoring
- Deploy: itch.io (free web demo)
- **Outcome:** Validate core loop, gather feedback

**Phase 2: Core Game (Weeks 5–12)**
- Engine: Godot 4 (begin port/parallel build)
- Content: Newspaper Boy complete (Levels 1–5)
- Map: 2 neighborhoods, expand route complexity
- Mechanics: Dogs, monsoon, day/night cycle, subscriber management
- Vehicle: Cycle + E-cycle
- **Outcome:** Feature-complete single track, ready for beta

**Phase 3: Track 2 (Weeks 13–20)**
- Content: Milk delivery (doodhwala), Levels 1–5
- Mechanics: Balance, measure slider, credit system, relationship tracking
- Vehicle: Cycle + Cargo e-cycle
- Map: Apartment complex (interiors, stairwells for carry-up mechanic)
- **Outcome:** Second track playable

**Phase 4: Track 3 (Weeks 21–28)**
- Content: E-commerce, Levels 1–6
- Mechanics: OTP, route puzzle, package condition, COD, parking puzzle
- Vehicles: Bike, Car, Mini-truck
- Map: Full city (diverse zones: residential, commercial, industrial, gated society)
- **Outcome:** Largest track, most mechanics, peak complexity

**Phase 5: Track 4 (Weeks 29–36)**
- Content: Post office, Levels 1–5
- Mechanics: Sorting, rural navigation, registration, fatigue (limited)
- Vehicles: Cycle, Postal jeep, Truck
- Map: City + rural suburbs (new biome)
- **Outcome:** All four tracks playable

**Phase 6: Endgame (Weeks 37–42)**
- Content: Company ownership mode
- Mechanics: Agent hiring, fleet management, route planning, city expansion
- UI: Management dashboard, financial screens
- **Outcome:** Long-term play depth unlocked

**Phase 7: Polish & Shipping (Weeks 43–52)**
- Art pass: re-paint assets, particle effects, animations
- Audio: SFX, music, UI feedback
- Balance: economy tuning, difficulty curves, progression pacing
- Bug fixes, optimization, platform builds
- Steam release prep (store page, marketing)
- **Outcome:** Shippable 1.0 on Steam/Mobile

### 12.2 Part-Time Timeline (40 hrs/week ÷ 8 = 5 hrs/day)

**Double all timelines above (~2 years).**

Alternative: Ship Newspaper Boy as free browser demo (4 months), then iterate with community feedback before full game push.

### 12.3 Resource Allocation

| Role | Hours | Notes |
|------|-------|-------|
| Game Design | 200 | Mechanics, balance, systems design |
| Coding (Godot) | 800 | Vehicle controller, NPC AI, UI, menus |
| Art (pixel/animation) | 600 | Sprites, tilesets, animations, UI art |
| Audio (composer or library) | 150 | Mixing, SFX, music integration |
| QA/Testing | 200 | Playtesting, bug reports, balance |
| **Total** | **1950 hours** | ~12 months solo FT / ~2 years PT |

---

## 13. Scope Management & Risks

### 13.1 Scope Creep Mitigations

**Red Flags (Don't Do):**
- Voice acting for NPCs (cost, scope)
- Destructible environments (complex physics)
- PvP multiplayer (netcode, server costs)
- Photo-realistic graphics (artist bottleneck)
- Real city map data (legal, scope)

**Green Lights (Do These):**
- Procedural street layouts (fast iteration)
- Text-based NPC dialogue (cheap, scalable)
- Simple physics (arcade, not realistic)
- Pixel/isometric art (fast production)
- Fictional cities (creative freedom, no licensing)

### 13.2 Key Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Art bottleneck | Schedule slips 3+ months | Start with simple tileset, outsource polish later |
| Scope explosion (5+ tracks) | Never ships | Lock at 4 tracks; additional are DLC |
| Godot engine limits | Performance issues | Prototype in Phaser first; validate target specs |
| NPC AI bugs | Delivery logic breaks | Unit test pathfinding; start with basic FSM |
| Monetization backlash | Players upset about pricing | Transparent: free demo, clear premium tiers |
| Lack of player feedback | Wrong direction in dark | Stream playtesting monthly; engage early community |

### 13.3 Contingency Plans

**If timeline slips 3+ months:**
- Ship Newspaper Boy as standalone title (₹99)
- Other tracks released as seasonal DLC
- Spreads revenue, extends engagement

**If art becomes bottleneck:**
- Outsource character animation ($1k–2k)
- Use asset marketplace (itch.io, OpenGameArt)
- Reduce animation frame count (2-frame walk = still looks good)

**If performance issues on mobile:**
- Cap player count in company mode (50 instead of 200 agents)
- Reduce map resolution on low-end phones
- Ship as PC-primary (mobile = port later)

---

## 14. Marketing & Launch Strategy

### 14.1 Community Building (Pre-Launch)

- **Month 1–3:** Share pixel art WIPs on Twitter, Instagram
- **Month 3–4:** Release Phaser prototype to itch.io (free)
- **Month 5–6:** Early access Beta on Steam (discounted)
- **Month 7–8:** Streamer outreach (speedrunners, casual players)
- **Month 9–10:** Press release to game media (Indian game dev angle)

### 14.2 Launch Positioning

**Tagline:** "Deliver chaos. Build an empire. Indian delivery simulator with soul."

**Key Selling Points:**
1. Authentic Indian setting (underrepresented in games)
2. Four distinct game types in one package
3. Progression from street-level delivery → company management
4. Cozy mechanics (not stressful; rewarding, not punishing)

**Target Audience:**
- Casual gamers (30–50 years old, Indian diaspora)
- Speedrunners (mechanics depth, leaderboards)
- Logistics/business simulation fans (endgame company mode)

### 14.3 Launch Tiers

| Platform | Price | Release | Content |
|----------|-------|---------|---------|
| itch.io (Web) | Free | Month 4 | Newspaper Boy demo |
| Steam Early Access | ₹199 | Month 7 | Newspaper + Milk + partial E-commerce |
| Steam Full Release | ₹299 | Month 12 | All 4 tracks + company mode |
| Mobile (iOS/Android) | ₹99 (IAP structure) | Month 13 | Freemium: Newspaper free, others ₹79 each |
| DLC 1 (Mumbai) | ₹99 | Month 15 | New city, track variants |

---

## 15. Success Metrics

### 15.1 Quantitative Goals

- **Downloads:** 10k first month (web demo), 100k over year (all platforms)
- **Peak CCU:** 200 concurrent players (includes mobile)
- **Avg session length:** 45 minutes (arcade) to 3 hours (company mode)
- **Retention (Day 7):** 30% (casual), 50% (dedicated)
- **Revenue (Year 1):** $20k (modest indie target)

### 15.2 Qualitative Metrics

- **Reviews:** Target 4.2+ stars on Steam, App Store
- **Community:** Active Discord, weekly community highlights
- **Press:** Feature in 3–5 indie game publications
- **Player feedback:** 80%+ report enjoying multiple tracks (vs. playing one only)
- **Culture impact:** Recognized as "the delivery game that gets India right"

---

## 16. Post-Launch Support (Year 2+)

### 16.1 Content Updates

- **Month 13–15:** DLC City 1 (Mumbai variant of tracks)
- **Month 16–18:** DLC City 2 (Bengaluru)
- **Month 19–21:** New track (restaurant delivery / dabbawala bonus)
- **Ongoing:** Seasonal events (Diwali, Holi, IPL), cosmetics

### 16.2 Balance Patches

- Monthly: economy tuning, difficulty curves, bug fixes
- Quarterly: major balance overhaul based on player data
- Transparent patch notes, community voting on feature priorities

### 16.3 Community Programs

- Streamer partnerships (free keys, revenue share)
- Modding support (Godot is open; enable user mods)
- Speedrun leaderboards (global, regional)
- Fan art contests (cosmetics as prizes)

---

## Appendix A: Core Mechanics Deep-Dive

### Toss Mechanic (Newspaper)

**Input:** Power slider (0–100%) + arc prediction (angle -45° to +45°)
**Physics:** Parabolic trajectory with wind resistance (monsoon = stronger wind)
**Feedback:** Visual arc line, particle trail on throw, landing sound
**Difficulty:** Early levels: GPS-marked target; later: target disappears (pure memory)

### Balance Mechanic (Milk)

**Input:** Joystick analog (or mouse) to tilt load left/right
**Physics:** Center of mass shifts with load distribution; inertia on turns
**Feedback:** Load visual leans, spill warning sound, sloshing liquid
**Failure:** Tilt > 45° = spill event (visible milk on road, customer compensation)

### Route Puzzle (E-Commerce)

**Input:** Drag packages on map preview to order sequence; click "optimize" for AI suggestion
**Output:** Path visualization, time estimate, traffic prediction
**Feedback:** Real-time distance calc, estimated arrival per drop
**Failure:** Suboptimal order = time overrun, late penalty

### Measure Slider (Milk)

**Input:** Slide to exact quantity (e.g., 500 mL) in 5-second window
**Feedback:** Visual fill level, digital readout, "target" zone highlight
**Failure:** Short-pour (<50 mL under) = complaint; over-pour (>50 mL over) = financial loss

---

## Appendix B: NPC Dialogue Examples

### Newspaper Boy Track

**Mrs. Sharma (Regular Customer):**
- Day 1: "Ah, new paperboy? Careful of Fido, he bites."
- Day 50: "You're like the son I never had. Tea tomorrow?"
- Day 100: "I've told all my neighbors about you. Good boy."
- Missing 1 day: "Where were you? I was worried!"
- Missing 3 days: "I'm canceling. You're unreliable."

### Milk Delivery Track

**Uncle Vijay (Milk Customer):**
- Day 1: "Careful, I know the last doodhwala was cheating on quantity."
- Day 20: "You're honest. 10 rupees extra for you Friday."
- Day 60: "My friends say your milk is the best. Recommend you to them."
- Spill event: "You spilled my milk! ₹50 refund now."
- After refund: "I see you're learning. Let's try again."

---

## Appendix C: Audio Cue Examples

| Event | Sound | Duration |
|-------|-------|----------|
| Successful toss | "thunk" + chime | 0.5s |
| Failed toss | "swoosh" + deflate | 0.4s |
| Dog encounter | Bark (threatening) | 1.0s |
| Level up | Fanfare (sitar/flute) | 2.0s |
| Collision | Impact + crunch | 0.6s |
| Monsoon start | Thunder, rain ambience | 0.5s |
| OTP entered wrong | Buzzer + error tone | 0.3s |
| Delivery complete | Confirmation chime + music swell | 1.5s |

---

## Appendix D: Example Run Walkthroughs

### Newspaper Boy, Level 1

**Start:** 4:50 AM, 30 newspapers in cargo basket, route = 1 neighborhood (8 houses)

1. **House 1 (Sharma Manor):** Porch at 45° angle. Toss with 60% power, -20° angle. Land on porch. ✓ Perfect delivery (+5 points)
2. **House 2 (Auto repair shop):** Shop door facing road. Toss 70% power, 0°. Hit wall beside door. ✗ Miss (-2 points, complaint)
3. **House 3 (Apartment, 1st floor balcony):** Difficult angle, upward toss required. 80% power, +30°. Land on balcony rail. ✓ Good delivery (+3 points)
4. **[Encounter: Dog!]** Aggressive dog emerges from House 4. Options:
   - Continue (risky, dog chases, distract toss)
   - Stop (wait 10s, dog loses interest)
   - Use dog treat (item cost ₹20)
   - Choose: Stop + wait
5. Resume houses 5–8 (mix of successes/failures)
6. **End of run:** 6 successful, 2 failed. Earnings: ₹120. Rating: 4 stars. ✓ Level progression +10%

### Milk Delivery, Level 2

**Start:** 5:00 AM, 40 liters milk (4 cans of 10L each), route = 25 customers (apartment building)

1. **First floor, flat 101:** Customer opens door, requests 1L. Balance cans carefully on rack (tilt = risk). Pour 1L with measure slider (got 1.01L, acceptable). Customer satisfied. ✓
2. **First floor, flat 102:** Climb stairs (carry 1 can). Second floor is tiring (stamina loss, bike unlocks this later). Pour 500 mL. ✓
3. **Second floor, flat 201:** Heavy order, 2L. Balance critical. Tilt angle = 55° (warning sound). Recover by leaning right. Pour slowly. ✓
4. **[Encounter: Pothole on staircase landing]** Surprise obstacle. Lose balance. Spill 200 mL. Immediate customer anger. Offer ₹20 compensation. Relation damaged (-10 points with that customer).
5. **Continue:** 15 more customers, mix of 500 mL, 1L, 2L orders.
6. **End of run:** 23/25 successful. Earnings: ₹240 (after compensation deduction). Rating: 3.8 stars. Customer that day = will remember, harder to deliver to next week.

---

## Appendix E: Monetization Breakdown (Year 1 Projection)

**Assumptions:**
- 50k downloads (web + Steam + mobile combined)
- 30% convert to paid (15k customers)
- Average revenue per user: $1.33

| Channel | Units | Price | Revenue | Notes |
|---------|-------|-------|---------|-------|
| Steam | 8,000 | $5 | $40,000 | Primary PC market |
| Mobile IAP (all tracks) | 5,000 | $2.50 | $12,500 | Freemium conversion |
| Mobile IAP (selective) | 2,000 | $1.20 | $2,400 | Individual track purchases |
| DLC (new cities) | 3,000 | $1.50 | $4,500 | Year 1 content |
| itch.io donations | 500 | $2 | $1,000 | Community support |
| **Total** | — | — | **$60,400** | Conservative estimate |

---

## Appendix F: Quick Reference — Progression Table

| Track | L1 Vehicle | L2 Vehicle | L3 Vehicle | L4 Vehicle | L5 Vehicle | L6 Vehicle |
|-------|-----------|-----------|-----------|-----------|-----------|-----------|
| **Newspaper** | Cycle | Cycle | Cycle | E-cycle | E-cycle | — |
| **Milk** | Cycle | Cycle | Cycle | E-cycle | E-cycle | — |
| **E-commerce** | Bike | Bike | Bike | Car | Car | Mini-truck |
| **Post Office** | Cycle | Cycle | Postal jeep | Jeep | Truck | — |

---

## 17. Multi-City Pack Architecture & CHETNA-Road Environmental Engine

### 17.1 The Five Playable City Archetypes

All five launch cities (**Delhi, Mumbai, Kolkata, Pune, and Bengaluru**) share a unified road-emission and traffic-atmosphere data pipeline derived from the CHETNA-Road dataset and OpenStreetMap road hierarchies, while maintaining distinct regional gameplay identities:

| City Pack | Gameplay Identity | Strongest Delivery Challenges | Visual / Simulation Emphasis |
| :--- | :--- | :--- | :--- |
| **Delhi / New Delhi** | Large-area courier operations | Long routes, broad roads, service lanes, dense colonies, gated entries | Morning haze, heat, heavy arterial traffic, broad-to-narrow transitions |
| **Mumbai** | Dense high-pressure delivery | Short time windows, parking limits, tight cluster stops, rain protection | Heavy monsoon downpours, reflective asphalt, chawl frontage, coastal flood zones |
| **Kolkata** | Neighborhood familiarity & postal routes | Old heritage streets, market bottlenecks, frequent intersections, recurring customers | High humidity, vintage street texture, tram rails, intricate slow navigation |
| **Pune** | Scooter-first expanding network | Mixed suburban growth, campus/office clusters, construction detours | Broad-to-narrow transitions, construction dust, evening delivery surge |
| **Bengaluru** | Congestion & route-planning challenge | Time-sensitive tech office orders, gated campuses, traffic-driven rerouting | Wet roads, Gulmohar boulevards, dense junctions, timing over distance |

---

### 17.2 Data-to-Game Atmospheric Mapping

Scientific grid layers (NOx, CO2, PM2.5/PM10, road network density) are mapped into five intuitive gameplay-facing variables:

```
                  ┌────────────────────────────────────────┐
                  │ CHETNA-Road 500m Grid + OSM Road Class │
                  └───────────────────┬────────────────────┘
                                      │ (Offline Precomputation)
                                      ▼
      ┌───────────────────────────────────────────────────────────────┐
      │                   Game-Derived Tile Metrics                   │
      ├──────────────────────┬────────────────────────────────────────┤
      │ gali_score           │ Cycle/scooter only vs car access       │
      │ parking_pressure     │ Double-parking risk / Walk on foot     │
      │ haze_baseline        │ Atmospheric visual haze [0.0 - 1.0]    │
      │ flood_susceptibility │ Waterlogged slowdowns / splash drag    │
      │ customer_patience    │ Rating decay rate & OTP urgency        │
      │ traffic_baseline     │ Autonomous vehicle spawn multiplier    │
      └───────────────────────────────────────────────────────────────┘
```

**Player-Facing Environmental Statuses:**
- `"Clear morning"`
- `"Dusty afternoon"`
- `"Traffic haze"`
- `"Monsoon congestion"`
- `"Post-rain air"`
- `"Festival market rush"`

---

### 17.3 City Runtime Data Schema

```json
{
  "CITY": {
    "city_id": "mumbai",
    "city_name": "Mumbai",
    "world_seed": 400001,
    "traffic_profile": { "baseline": 1.4, "honk_rate": 0.22 },
    "weather_profile": { "rain_chance": 0.75, "flood_risk": 0.8 },
    "ambient_audio_profile": "marine_monsoon",
    "delivery_economy_profile": { "base_rate": 1.25, "tip_rate": 1.15 }
  }
}
```

---

**Document Version:** 2.0 (Multi-City Pack & Environmental Engine Update)  
**Last Updated:** August 2026  
**Author:** Neeraj Banerjee  
