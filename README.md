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

## 🧪 Phase 1 & 2 Verification Results

The automated test suite (`npm test`) executes **119 total tests** across 11 validation suites with **100% passing status**:

*   **Phase 1 Verification (`scripts/verify_phase1.mjs`)**: 51/51 tests passing.
    *   Catalog Completeness: 993/993 ships ingested with valid typed fields and non-zero HP.
    *   Top Module Resolution: Iowa 79,000 HP (Hull B), 23.35 km range, 28mm overmatch. Fletcher top Mk 16 torpedoes. Mogami top 203mm artillery.
    *   Armory Strict Filtering: Exactly 228 active offers across 224 bundles, 0 false-positive camos/commanders.
    *   Historical Catalog: Removed ships (*Musashi, Småland, Enterprise, Belfast, Georgia, Alaska, Thunderer, Somers*) marked `santa_supercontainer_only`. Dockyard ships marked `dockyard_historical`. Clones linked to parent ships.
    *   Krupp Ballistics & Overmatch Precision: Authentic WoWs penetration formulas and overmatch thresholds.
*   **Phase 2 Verification (`scripts/verify_phase2.mjs`)**: 68/68 tests passing.
    *   **Consumables Ingestion**: `abilityMap` resolves all 993 ships; full slot trees with charges (`numConsumables`), cooldown (`reloadTime`), duration (`workTime`), localized names, and logic modifiers (e.g. Iowa DCP 80s/20s/-1 charges, Des Moines 10km Radar 35s, Shimakaze Smoke 1.8km detect).
    *   **AA Defense & Flak**: Extracted continuous DPS (near, mid, far), max AA range, flak burst count, and flak damage (e.g. Iowa 1,033 continuous DPS, 5.8 km range, 8 flak bursts, 1,610 damage).
    *   **ASW Armament**: Extracted airstrike stats (range, reload, flight time, payload count, bomb damage) across 570 ships and ship-mounted depth charges across destroyers.
    *   **Promoted Table Matrix Columns**: `traverse180`, `horizontalDispersion`, `verticalDispersion`, `heAlpha`, `apAlpha`, `sapAlpha`, `torpedoDetect`, `aaRange`, `aaDps`, `flakCount`, `aswRange`, and `smokePenalty` promoted directly to `catalog.json` for 60fps virtualized matrix rendering.
    *   **Dynamic Build Modifier Engine**: `calcModifiedStats` verified with exact compound multipliers:
        *   CE + CSM1 on Iowa: 15.7 km $\rightarrow$ 12.72 km detectability (exact 0.81 compound multiplier).
        *   Main Battery Mod 3: 30.0s $\rightarrow$ 26.4s reload (-12%).
        *   Sierra Mike Signal: 33.0 kts $\rightarrow$ 34.65 kts (+5%).
        *   Adrenaline Rush at 50% HP: 30.0s $\rightarrow$ 27.0s (-10% reload).
        *   Superintendent: finite consumable charges incremented by +1; unlimited (-1) charges preserved.

---

## 📋 Independent Audit Sign-Off (Phase 1)

* **Audit Status**: **CONDITIONAL PASS (Approved to Proceed)** (2026-09-22)
* **Auditor**: Independent Phase 1 Reviewer
* **Key Findings**:
  * 100% Top-module DAG resolution verified across 318 upgraded hulls.
  * 0 false-positive ship bundles in Armory scraping (75+ non-ship bundles eliminated).
  * Storage footprint: `catalog.json` is 116 KB gzipped (target was < 320 KB gz).
  * Consumable array indexing defect noted in Phase 1 audit completely resolved in Phase 2.

---

## 🗺️ Roadmap & Phase Progression

- [x] **Phase 1: Data Normalization, Ingestion Engine & Background Sync Service (Option B)**
- [x] **Phase 2: Ballistics, Modifier Engine & Consumables Pipeline**
  - [x] Fix consumable lookup via `abilityMap`.
  - [x] Extract AA defense (near, mid, far continuous DPS, max range, flak count, flak damage).
  - [x] Extract ASW airstrike stats on hull (range, reload, flight time, payload, bomb damage).
  - [x] Promote key table metrics (`horizontalDispersion`, `verticalDispersion`, `traverse180`, `heAlpha`, `apAlpha`, `sapAlpha`, `torpedoDetect`, `aaRange`, `aaDps`, `flakCount`, `aswRange`, `smokePenalty`) into `catalog.json`.
  - [x] Implement dynamic build modifier engine (`calcModifiedStats` for upgrades, commander skills, signals) in `src/utils/modifiers.ts` and `scripts/modifiers.mjs`.
  - [x] Automated test suite: `scripts/verify_phase2.mjs` (68/68 passing).
- [ ] **Phase 3: Virtualized Parameter Matrix (`/params`)**
  - TanStack Table v8 + TanStack Virtual v3 implementation.
  - Pinned columns (Checkbox, Tier, Type, Nation, Name, Acquisition Badge).
  - Multi-select filters (Nation, Tier, Class, Group, Acquisition source).
  - -25% Armory coupon toggle & "Hide clones" switch.
- [ ] **Phase 4: Acquisition Center & Resource Planner (`/armory`)**
  - Armory catalog cards with coupon calculations.
  - Steel-to-Coal shortage converter.
  - Removed ships and Dockyard history pages.
- [ ] **Phase 5: Server Statistics View (`/stats`)**
  - Region (EU/NA/Asia), Timespan, and Skill Bracket filtering.
  - Battle-weighted normalization and Personal Rating (PR) engine.
- [ ] **Phase 6: PWA, Offline Caching & Final Polish**

