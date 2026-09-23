# AGENTS.md

## Repository Overview
**Project**: Local World of Warships Ship Information Platform (`wows-info`)  
**Objective**: High-performance local web application delivering full feature parity with [shiptool.st](https://shiptool.st/) augmented with rich, real-time and historical **ship acquisition source data** (Coal, Steel, Doubloons, Research Bureau, Dockyards, Santa/Supercontainer exclusivity, and Tech Tree costs).  
**Data Strategy**: **Option B (Hybrid Offline-First with Background Check & Sync)**. The application is completely operational offline using pre-compiled local JSON datasets under `public/data/`, but includes a background check service and a "Check for Updates" sync engine to fetch the latest Armory bundles and server statistics when online.

---

## Architecture & Technology Stack
- **Frontend**: React 19, TypeScript 5.5+, Vite 6, Tailwind CSS v4, Lucide React icons.
- **Table Engine**: `@tanstack/react-table` (v8) + `@tanstack/react-virtual` for 60fps virtualized rendering across 1,000+ ships and 60+ parameters.
- **State Management**: Zustand for client filters, build modifiers, and resource calculations; URL Search Params for deep linking and shareable URLs.
- **Data Pipeline**: Node.js ESM scripts (`scripts/`) compiling raw GameParams, live Armory snapshots, and server performance metrics into split, columnar JSON artifacts (`catalog.json`, `details/[id].json`, `armory_master.json`, `stats/*.json`).
- **Sync Engine**: Embedded Express/Node local API endpoint (`/api/sync`) and client background worker for polling Armory updates.

---

## Directory Structure
```
/home/zn/wows-info/
├── AGENTS.md                       # Agent instructions and architectural guidelines
├── README.md                       # User-facing documentation and quick start guide
├── package.json
├── tsconfig.json
├── vite.config.ts
├── start.sh                        # One-command quick launch orchestrator
├── scripts/
│   ├── build_data.mjs              # Main compiler producing public/data/
│   ├── scrape_armory.mjs           # Scrapes and normalizes live Armory bundles
│   ├── parse_gameparams.mjs        # Extracts ship components, resolves Top modules & Survivability
│   ├── calculate_ballistics.mjs    # Generates Krupp AP penetration and trajectories
│   ├── build_curated_acquisition.mjs # Generates curated historical catalog
│   ├── acquisition_curated.json    # Curated registry of removed/dockyard/clones
│   ├── modifiers.mjs               # Shared dynamic build modifier engine
│   ├── verify_phase1.mjs           # Data pipeline & Top module resolution tests
│   ├── verify_phase2.mjs           # Ballistics & consumable ingestion tests
│   ├── verify_phase3.mjs           # Virtualized table & filter matrix tests
│   ├── verify_phase4.mjs           # Armory offers & shortage calculator tests
│   ├── verify_phase5.mjs           # Server statistics & PR calculator tests
│   ├── verify_phase6.mjs           # PWA, offline caching & compare view tests
│   ├── verify_filter_controls.mjs  # All/None filter controls & tier coverage tests
│   └── verify_shiptool_columns.mjs # Shiptool column headers & survivability tests
├── server/
│   └── sync_service.mjs            # Local sync API and background polling service
├── public/
│   ├── manifest.json               # PWA Web App Manifest
│   ├── sw.js                       # Service worker with offline caching
│   └── data/
│       ├── catalog.json            # Flat columnar table index (993 ships, ~136 KB gz)
│       ├── armory_master.json      # Full acquisition registry and coupon models
│       ├── details/                # 993 code-split ship module and ballistics files
│       ├── locales/en.json         # Localized English strings (~120 KB gz)
│       └── stats/                  # Chunked server statistics by server & span
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/                      # TypeScript definitions (Ship, Acquisition, Stats)
    ├── stores/                     # Zustand stores (useShipStore, useArmoryStore, useStatsStore)
    ├── utils/                      # Modifiers, PR calculator, ballistics, comparison matrix, useOnlineStatus
    ├── components/
    │   ├── common/                 # Header, Nav, AcquisitionBadge, Tooltips, Modals
    │   ├── table/                  # VirtualizedTable, PinnedColumns, ColumnHeaders
    │   ├── filters/                # FilterBar with Nation, Tier, Class, Source pills & All/None
    │   ├── modifiers/              # BuildModifierDrawer (slots 1-6, commander skills, signals)
    │   ├── ballistics/             # BallisticsChart (SVG Krupp AP penetration curves)
    │   ├── compare/                # CompareBar, ShipDuel comparison matrix
    │   └── armory/                 # ArmoryCard, ShortageCalculator, CouponToggle
    └── views/
        ├── ShipParametersView.tsx  # /params
        ├── ServerStatsView.tsx     # /stats
        ├── ArmoryView.tsx          # /armory
        └── ShipCompareView.tsx     # /compare
```

---

## Implementation Workflow Rules
All implementation across phases must adhere to the **Phased Implementation & Independent Review Protocol**:

1. **Phase Implementation**:
   - An implementation subagent (`TypeName: 'self'`) implements the phase deliverables.
   - Code must be robust, typed, and accompanied by automated tests or verification scripts.
2. **Independent Phase Review**:
   - An independent subagent (`TypeName: 'research'` or independent reviewer) is invoked to rigorously audit the phase against specification criteria, performance requirements, and edge cases.
3. **Documentation & Repo Updates**:
   - Following each phase review, update `README.md`, phase documentation, and repository guides to reflect the latest state.
4. **No Regressions**:
   - Verify that prior phase features and data contracts remain unbroken.

---

## Build & Run Commands
- `npm start` or `./start.sh` — One-command launch (sync daemon on port 3001, Vite app on port 5173).
- `npm run dev` — Launch Vite local development server.
- `npm run build` — Build production bundle (`tsc && vite build`).
- `npm run sync` — Run data ingestion and update `public/data/` from live sources.
- `npm test` — Run complete automated verification test suite (1,362/1,362 passing tests across 44 suites).
- `npm run test:phase1` .. `npm run test:phase6` — Run individual phase verification suites.
- `npm run test:filters` — Run filter controls & tier coverage verification suite.
- `npm run test:shiptool` — Run shiptool column headers & survivability matrix verification suite.
