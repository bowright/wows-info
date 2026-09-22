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
├── tailwind.config.ts
├── scripts/
│   ├── build_data.mjs              # Main compiler producing public/data/
│   ├── scrape_armory.mjs           # Scrapes and normalizes live Armory bundles
│   ├── parse_gameparams.mjs        # Extracts ship components and resolves Top modules
│   └── calculate_ballistics.mjs    # Generates Krupp AP penetration and trajectories
├── server/
│   └── sync_service.mjs            # Local sync API and background polling service
├── public/
│   └── data/
│       ├── catalog.json            # Flat columnar table index (~320 KB gz)
│       ├── armory_master.json      # Full acquisition registry and coupon models
│       ├── details/                # Code-split ship module and consumable trees
│       ├── locales/                # Localized strings (en.json, etc.)
│       └── stats/                  # Chunked server statistics by server & span
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/                      # TypeScript definitions (Ship, Acquisition, Stats)
    ├── stores/                     # Zustand stores (filters, modifiers, user resources)
    ├── components/
    │   ├── common/                 # Header, Nav, Badges, Tooltips, Modals
    │   ├── table/                  # VirtualizedTable, PinnedColumns, ColumnHeaders
    │   ├── filters/                # Nation, Tier, Class, Acquisition filter pills
    │   ├── ballistics/             # SVG Penetration and Trajectory curves
    │   └── armory/                 # ArmoryCard, CouponToggle, ShortageCalculator
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
- `npm run dev` — Launch Vite local development server.
- `npm run build` — Build production bundle.
- `npm run sync` — Run data ingestion and update `public/data/` from live sources.
- `npm run test` — Run verification test suite.
