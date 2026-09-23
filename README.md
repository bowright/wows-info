# World of Warships Ship Information Platform (`wows-info`)

A high-performance local web application delivering feature parity with [shiptool.st](https://shiptool.st/) augmented with rich, real-time and historical **ship acquisition source data** (Coal, Steel, Doubloons, Research Bureau, Dockyards, Santa/Supercontainer exclusivity, and Tech Tree costs).

---

## 🚀 Architecture & Key Features

*   **Hybrid Offline-First (Option B)**: Fully operational offline with pre-compiled columnar datasets under `public/data/`, backed by an embedded background polling engine and `/api/sync` endpoint to check live WG Armory updates.
*   **Tiered Ingestion Pipeline**:
    *   **Catalog (`catalog.json`)**: Ultra-compact flat array of all 993 ships (~755 KB) designed for 60fps virtualized table rendering.
    *   **Armory Master (`armory_master.json`)**: Complete acquisition database with active bundle pricing, 25% coupon models, Steel-to-Coal substitutions, and historical registry.
    *   **Code-Split Details (`details/[shipId].json`)**: 993 modular JSON files containing full module trees, consumables, and Krupp AP penetration curves.
    *   **Lean Locales (`locales/en.json`)**: Filtered English translation payload (5,049 keys, ~642 KB uncompressed, ~120 KB gzip), stripping 80%+ of unused translation bloat.
    *   **Server Statistics (`stats/`)**: Precomputed battle-weighted server stats across EU, NA, and Asia.
*   **Top-Module Resolution**: Automatically resolves top configurations as default (Hull B/C, upgraded artillery, top torpedoes, FCS range multipliers).
*   **Ballistics & Overmatch Precision**: Krupp AP formula ($\text{Krupp} \cdot (\text{Mass} \cdot v^2)^{0.69} \cdot \text{Diameter}^{-1.07} \cdot 10^{-7}$) and dynamic overmatch verification ($\lfloor\text{Caliber}/14.3\rfloor$).
*   **Strict Armory Filtering**: Enforces strict entitlement checking (`type === 'ship'`), completely eliminating commander and camo false positives.

---

## 📂 Directory Structure

```
/home/zn/wows-info/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── scripts/
│   ├── build_data.mjs              # Main data compiler producing public/data/
│   ├── scrape_armory.mjs           # Live Armory scraper with snapshot fallback
│   ├── parse_gameparams.mjs        # GameParams parser & Top module resolver
│   ├── calculate_ballistics.mjs    # Krupp AP penetration & overmatch engine
│   ├── build_curated_acquisition.mjs # Generates curated historical catalog
│   ├── acquisition_curated.json    # Curated registry of removed/dockyard/clones
│   └── verify_phase1.mjs           # Automated Phase 1 verification test suite
├── server/
│   └── sync_service.mjs            # Background polling daemon & /api/sync endpoint
├── public/
│   └── data/
│       ├── catalog.json            # Flat columnar table index (993 ships)
│       ├── armory_master.json      # Acquisition & coupon database (228 offers)
│       ├── details/                # 993 code-split ship module & ballistics files
│       ├── locales/en.json         # English strings
│       └── stats/                  # Server statistics chunks (EU, NA, Asia)
└── src/                            # Frontend application (React 19 + TypeScript)
```

---

## 🛠️ Commands & Quick Start

```bash
# Ingest data and compile public/data/ artifacts
npm run sync

# Run Phase 1 automated verification test suite (51/51 passing tests)
npm run test

# Launch background sync service (/api/sync and /api/status on port 3001)
npm start

# Launch Vite local development server
npm run dev

# Build production bundle
npm run build
```

---

## 🧪 Phase 1 Verification Results

The automated test suite (`scripts/verify_phase1.mjs`) executes 51 tests across 6 validation suites:

1. **Catalog Completeness**: 100% of 993 ships ingested with valid typed fields and non-zero HP.
2. **Top Module Resolution**:
   * Iowa resolved to 79,000 HP (Hull B, stock 68,100 HP) and 23.35 km range (FCS upgrade).
   * Fletcher resolved to top Mk 16 torpedoes (10.5 km range, 19,033 damage, 66 kts).
   * Mogami resolved to top 203mm artillery (10 barrels, 14s reload, 2.0 sigma).
3. **Armory Strict Filtering**:
   * Exactly 228 active armory ship bundle offers matched across 224 ship bundles.
   * 0 false positives (commanders like Quán Róng and steel camos excluded).
   * 100% of armory offers matched to valid catalog ships.
   * Accurate 25% coupon discounts on Coal, Steel, and Doubloons; 1:10 Steel-to-Coal substitution.
4. **Historical Catalog**:
   * Removed ships (*Musashi, Småland, Enterprise, Belfast, Georgia, Alaska, Thunderer, Somers*) marked `santa_supercontainer_only`.
   * Dockyard ships (*Wisconsin, Michelangelo, Atlântico, Odin, Anchorage*) marked `dockyard_historical` with required Doubloon phases.
   * Black Friday and Collab ships (*Tirpitz B, Jean Bart B, ARP Yamato*) marked `isClone === true` with parent ship linkages.
5. **Krupp Ballistics & Overmatch Precision**:
   * Overmatch: Yamato 460mm $\rightarrow$ 32mm, Iowa 406mm $\rightarrow$ 28mm, Bismarck 380mm $\rightarrow$ 26mm, Des Moines 203mm $\rightarrow$ 14mm, Cleveland 152mm $\rightarrow$ 10mm.
   * Penetration: Iowa AP muzzle = 847.6mm, Yamato AP muzzle = 883.0mm.
6. **Tiered Store**:
   * Exactly 993 files in `public/data/details/`.
   * 5,049 strings in `locales/en.json`.
   * 12 server stats chunks in `public/data/stats/`.

---

---

## 🧪 Phase 1, 2, 3, 4, 5 & 6 Verification Results

The automated test suite (`npm test`) executes **1,138 total tests** across 35 validation suites with **100% passing status**:

*   **Phase 1 Verification (`scripts/verify_phase1.mjs`)**: 51/51 tests passing.
    *   Catalog Completeness: 993/993 ships ingested with valid typed fields and non-zero HP.
    *   Top Module Resolution: Iowa 79,000 HP (Hull B), 23.35 km range, 28mm overmatch. Fletcher top Mk 16 torpedoes. Mogami top 203mm artillery.
    *   Armory Strict Filtering: Exactly 228 active offers across 224 bundles, 0 false-positive camos/commanders.
    *   Historical Catalog: Removed ships (*Musashi, Småland, Enterprise, Belfast, Georgia, Alaska, Thunderer, Somers*) marked `santa_supercontainer_only`. Dockyard ships marked `dockyard_historical`. Clones linked to parent ships.
    *   Krupp Ballistics & Overmatch Precision: Authentic WoWs penetration formulas and overmatch thresholds.
*   **Phase 2 Verification (`scripts/verify_phase2.mjs`)**: 68/68 tests passing.
    *   **Consumables Ingestion**: `abilityMap` resolves all 993 ships; full slot trees with charges (`numConsumables`), cooldown (`reloadTime`), duration (`workTime`), localized names, and logic modifiers.
    *   **AA Defense & Flak**: Continuous DPS (near, mid, far), max AA range, flak burst count, and flak damage.
    *   **ASW Armament**: Airstrike stats across 570 ships and ship-mounted depth charges across destroyers.
    *   **Promoted Table Matrix Columns**: 12 key scalar metrics promoted directly to `catalog.json` for 60fps virtualized matrix rendering.
    *   **Dynamic Build Modifier Engine**: Compound multipliers verified for upgrades, commander skills, and signals.
*   **Phase 3 Verification (`scripts/verify_phase3.mjs`)**: 68/68 tests passing.
    *   **Acquisition Filtering**: Filter by Coal returns exactly 35 ships; Steel returns exactly 21 ships; Research Bureau returns 19 ships; Dockyard returns 14 ships; Removed returns 26 ships.
    *   **Coupon Modeling**: -25% Armory coupon toggle accurately discounts Coal and Steel ships without affecting non-eligible currencies (Research Bureau RP stays unchanged).
    *   **Clone & Replica Management**: Hide Clones toggle removes all 84 clone ships (993 $\rightarrow$ 909 ships), while filtering specifically by Clones returns all 84 replicas.
    *   **Search Query Precision**: Substring and case-insensitive matching across ship name, localized name, and index.
    *   **Compound Filtering**: Multi-dimensional filtering across tier, nation, and class (e.g. Tier 10 US Battleships).
    *   **TanStack Table v8 + TanStack Virtual v3**: Virtualized table container rendering 993 rows with 6 sticky pinned columns (`compare`, `tier`, `class`, `nation`, `name`, `acquisition`).
    *   **Preset Column Views**: 7 preset views (`general`, `survivability`, `artillery`, `torpedoes`, `aa`, `asw`, `all`) with dynamic stat heatmaps.
    *   **Live Recomputation**: Real-time updates from BuildModifierDrawer (slots 1-6, commander skills with dynamic HP slider, and signals).
*   **Phase 4 Verification (`scripts/verify_phase4.mjs`)**: 379/379 tests passing.
    *   **Armory Offers Breakdown**: 228 active offers verified across 5 categories (52 Coal, 21 Steel, 19 Research Bureau, 126 Doubloons, 10 Event Tokens). 100% matched to catalog ships with 0 orphans.
    *   **Coupon Calculation Precision**: 100% of Coal, Steel, and Doubloon offers verified with exact `Math.round(price * 0.75)` discounts; Research Bureau (RP) and Event tokens verified strictly ineligible (0% discount, full price).
    *   **Shortage Calculator Math**: Verified pure Coal affordability, exact shortage calculation, 1:10 Steel substitution (`1 Steel = 10 Coal`), leftover resources, and time-to-goal estimation based on user daily collection rates.
    *   **Dockyard Archive Completeness**: Verified all 14 historical dockyard campaigns (*Wisconsin, Michelangelo, Lüshun, Daisen, Atlântico, Puerto Rico, Marlborough, De Zeven Provinciën, Hizen, Anchorage, Odin, Almirante Oquendo, Niord, Schill*) with total phases, free mission phases, and starter pack Doubloon requirements.
    *   **Removed Ships Hall of Fame**: Verified all 26 removed ships (*Musashi, Småland, Enterprise, Belfast, Georgia, Alaska, Thunderer, Somers, Missouri, Massachusetts, Nelson, Jean Bart, etc.*) with Santa Tier 1 drop ratings, historical removal versions, and original acquisition prices.
    *   **Frontend UI & Component Contract**: Full export and prop verification for `ArmoryCard.tsx`, `ShortageCalculator.tsx`, and `ArmoryView.tsx` with all 8 tab triggers.
*   **Phase 5 Verification (`scripts/verify_phase5.mjs`)**: 489/489 tests passing.
    *   **12 Dynamic Chunks**: Verified all 12 combinations load and parse valid 993 ship records (`stats-[server]-[span].json` across EU, NA/com, ASIA for spans 1, 3, 12, all).
    *   **Skill Bracket & Mathematical Exactness**: Verified exact battles and raw metric accumulators conservation ($b_{\text{all}} = \sum b_i, \text{wins}_{\text{all}} = \sum \text{wins}_i, \text{dmg}_{\text{all}} = \sum \text{dmg}_i, \text{frags}_{\text{all}} = \sum \text{frags}_i$) across All, Low (<47.5%), Medium (47.5–52.5%), High (52.5–60%), and Top 1% Unicum (>60%).
    *   **Battle-Weighted Normalization**: Verified exact weighted aggregate metrics: $\text{WR} = \sum \text{wins} / \sum \text{games} \times 100\%$, $\text{AvgDmg} = \sum \text{dmg} / \sum \text{games}$, $\text{FragRate} = \sum \text{frags} / \sum \text{games}$, $\text{SurvRate} = \sum \text{surv} / \sum \text{games} \times 100\%$, $\text{AvgXP} = \sum \text{xp} / \sum \text{games}$.
    *   **Personal Rating (PR) Engine**: Verified community standard formula ($r\text{Dmg} = \text{avgDmg}/\text{expDmg}$, $r\text{Frags} = \text{avgFrags}/\text{expFrags}$, $r\text{Win} = \text{winRate}/\text{expWinRate}$, $n\text{Dmg} = \max(0, (r\text{Dmg}-0.4)/0.6)$, $n\text{Frags} = \max(0, (r\text{Frags}-0.1)/0.9)$, $n\text{Win} = \max(0, (r\text{Win}-0.7)/0.3)$, $\text{PR} = 700 \cdot n\text{Dmg} + 300 \cdot n\text{Frags} + 150 \cdot n\text{Win}$) with PR = 1150 at baseline, PR = 0 at zero, and exact tier boundaries/hex colors across all 7 tiers (<750 Below Average, 750–1100 Average, 1100–1350 Good, 1350–1550 Very Good, 1550–1750 Great, 1750–2100 Unicum, 2100+ Super Unicum).
    *   **Cross-Domain Acquisition Filtering**: Verified filtering server performance statistics across Coal, Steel, Research Bureau, Dockyard, Tech Tree, and Removed categories.
    *   **Frontend UI & Store Integration**: Full verification for `useStatsStore.ts`, `prCalculator.ts`, and `ServerStatsView.tsx` with sticky pinned columns, interactive sorting, min-max heatmap coloring, and battle-weighted KPI summary row.
*   **Phase 6 Verification (`scripts/verify_phase6.mjs`)**: 83/83 tests passing.
    *   **PWA Web App Manifest (`manifest.json`)**: Configured standalone display, `#020617` theme/background color, icon suite (192px, 512px, SVG), and meta headers.
    *   **Service Worker Offline Caching (`sw.js`)**: Cache-first strategy for static assets and Stale-While-Revalidate caching for core columnar datasets (`/data/catalog.json`, `/data/locales/en.json`, `/data/armory_master.json`, `/data/stats/`, `/data/details/`). Offline fallback handling for `/api/`.
    *   **Network Offline Detection Hook (`useOnlineStatus`)**: Real-time detection using `navigator.onLine` and window `online`/`offline` listeners, integrated with visual status pill and offline notification banner in `Header.tsx`.
    *   **Enhanced Ship Duel & Comparison Matrix (`/compare`)**: Side-by-side matrix comparing 2 to 4 warships across 8 domains (Acquisition & Economy, Survivability, Artillery, Torpedoes, AA, ASW, Mobility, Concealment). Color-coded directional advantage highlights (highest/lowest best).
    *   **SVG AP Penetration & Ballistics Overlay (`BallisticsChart.tsx`)**: Responsive SVG trajectory curves over 0 to 25 km distance with interactive scrub crosshair, multi-metric toggle (Penetration mm, Flight Time s, Impact Velocity m/s, Impact Angle °), and dynamic per-ship tooltips.
    *   **One-Command Launch Orchestrator (`start.sh`)**: Executable launcher (`npm start` or `./start.sh`) verifying environment, building production bundle, launching Option B sync daemon on port 3001, launching web app on port 5173, and trapping SIGINT/SIGTERM for clean shutdown.

---

## 📋 Independent Audit Sign-Off (Phases 1, 2, 3, 4, 5 & 6)

* **Phase 1 Audit Status**: **CONDITIONAL PASS (Approved)** (2026-09-22)
* **Phase 2 Audit Status**: **PASS (Full Unconditional Approval)** (2026-09-22)
* **Phase 3 Audit Status**: **PASS (Remediated & Approved)** (2026-09-22)
* **Phase 4 Audit Status**: **PASS (Full Unconditional Approval)** (2026-09-22)
* **Phase 5 Audit Status**: **PASS (Full Unconditional Approval)** (2026-09-22)
* **Phase 6 Audit Status**: **PASS (Full Unconditional Approval)** (2026-09-23)
* **Auditor**: Independent Phase 6 Reviewer
* **Key Findings (Phase 6)**:
  * Full PWA offline caching (`manifest.json`, `sw.js` with Stale-While-Revalidate for `/data/` and Cache-First for static assets).
  * Real-time network detection hook and offline status banner in `Header.tsx`.
  * Enhanced 4-way Ship Duel Matrix across 8 domains with directional advantage highlighting.
  * Interactive SVG Krupp AP ballistics chart plotting penetration, flight time, velocity, and impact angles across 0–25 km.
  * Executable one-command quick launch orchestrator (`start.sh` / `npm start`).
  * Grand Total: **1,138 / 1,138 passing tests (100% pass rate)**; clean production build.

---

## 🗺️ Roadmap & Phase Progression

- [x] **Phase 1: Data Normalization, Ingestion Engine & Background Sync Service (Option B)**
- [x] **Phase 2: Ballistics, Modifier Engine & Consumables Pipeline**
- [x] **Phase 3: Virtualized Parameter Matrix (`/params`)**
- [x] **Phase 4: Acquisition Center & Resource Planner (`/armory`)**
- [x] **Phase 5: Server Statistics View (`/stats`) & Personal Rating Engine**
- [x] **Phase 6: PWA, Offline Caching, Polish & One-Command Launch**
  - Progressive Web App (PWA) manifest and Service Worker offline caching.
  - Offline resilience testing (verifying 100% functionality without internet connection).
  - Quick launch script (`./start.sh` or `npm start`) orchestrating Vite preview and Option B sync service.
  - Comprehensive end-to-end integration and documentation updates.

