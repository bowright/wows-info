# WoWs-Info Repository & Data Integrity Review

**Date**: 2026-09-23  
**Repository**: [`wows-info`](file:///home/zn/wows-info)  
**Status**: All 1,362 automated tests pass; production bundle builds cleanly. However, significant underlying **data fidelity, pipeline integrity, and data modeling issues** were identified that require remediation.

---

## 1. Executive Summary & Issue Matrix

| ID | Issue | Severity | Affected Files | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **D-01** | **Over-classification of Ships as "Testing"** | **Critical** | [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs)<br>[`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs)<br>[`public/data/catalog.json`](file:///home/zn/wows-info/public/data/catalog.json) | **272 ships (27.4% of catalog)** are marked as `Testing` / `in_testing`. 216 are real released premiums (e.g. *Atlanta*, *Saipan*, *Kidd*, *Sims*, *Ark Royal*) that disappear whenever users filter by acquisition categories. |
| **D-02** | **Clone Detection Logic & False Positives** | **Critical** | [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs) | Tech tree starter ship *Black Swan* is marked as a Black Friday clone; tech tree cruiser *Myōkō* is marked as a Collaboration clone of itself. |
| **D-03** | **Broken Clone Parent Overrides** | **Critical** | [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs) | Typos in parent ship keys cause *AL Montpelier*, *ARP Takao*, *AL Yukikaze*, and *Ship Smasha* to have `cloneOfShipId: null` or point to themselves. |
| **D-04** | **Unrecognized Clone / Variant Series** | **High** | [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs) | Colorful Regatta (`CLR`), Pirate, St. Patrick, 250th Golden, Pharaoh, and Test Evaluation (`TE`/`ST`) ships are dumped into `Testing` with `isClone: false`. |
| **D-05** | **Test Dummy Ship in Tech Tree** | **High** | [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs) | `PGSD111_Z_57` (a `demoWithoutStats` dummy) is classified as `Tech Tree` due to an unchecked `level === 11` condition. |
| **D-06** | **Secondary Battery (ATBA) Completely Missing** | **High** | [`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs)<br>[`public/data/catalog.json`](file:///home/zn/wows-info/public/data/catalog.json)<br>[`src/components/table/VirtualizedTable.tsx`](file:///home/zn/wows-info/src/components/table/VirtualizedTable.tsx) | Secondary armament (range, reload, caliber, DPM, fire chance, penetration) is not parsed. Ships like *Schlieffen*, *Ohio*, *Bismarck*, *Napoli* display 0 secondary stats. |
| **D-07** | **Incomplete Carrier (CV) & Submarine (SS) Models** | **Medium** | [`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs)<br>[`src/utils/comparisonMatrix.ts`](file:///home/zn/wows-info/src/utils/comparisonMatrix.ts) | CVs have 0 plane/squadron stats. Submarines lack dive capacity, submerged speed, and ping stats. `smokePenalty` defaults to `0`, awarding CVs/SSs false "Best" badges. |
| **D-08** | **Synthetic Server Statistics Pipeline** | **Medium** | [`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs)<br>[`server/sync_service.mjs`](file:///home/zn/wows-info/server/sync_service.mjs) | All 12 stats chunks in [`public/data/stats/`](file:///home/zn/wows-info/public/data/stats/) are 100% synthetically generated using `pseudoHash`. The sync engine does not query live external APIs. |
| **D-09** | **Armory 0-Price Early Access Bundles** | **Medium** | [`scripts/scrape_armory.mjs`](file:///home/zn/wows-info/scripts/scrape_armory.mjs)<br>[`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs) | Free sequential mission bundles for *Serrano* and *Almirante Villar* have `price: 0`, causing them to be classified as Doubloon ships costing 0 Doubloons. |
| **D-10** | **Raw Internal Currency Identifiers Exposed** | **Medium** | [`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs) | Event token ships display `"Armory (540,000 eventum_10)"` because `currencyLabels` lacks entries for `eventum_10`, `eventum_6`, and `eventum_4`. |
| **D-11** | **Superficial Stock Module Toggle** | **Medium** | [`src/stores/useShipStore.ts`](file:///home/zn/wows-info/src/stores/useShipStore.ts)<br>[`src/components/table/VirtualizedTable.tsx`](file:///home/zn/wows-info/src/components/table/VirtualizedTable.tsx) | Toggling `useTopModules: false` only reverts `health` to `stockHealth`. Guns, range (`stockRangeKm`), torpedoes, speed, and rudder remain locked to Top modules. |
| **D-12** | **Formatting & Calculation Glitches** | **Low** | [`src/components/table/VirtualizedTable.tsx`](file:///home/zn/wows-info/src/components/table/VirtualizedTable.tsx)<br>[`src/components/armory/ShortageCalculator.tsx`](file:///home/zn/wows-info/src/components/armory/ShortageCalculator.tsx)<br>[`scripts/scrape_armory.mjs`](file:///home/zn/wows-info/scripts/scrape_armory.mjs) | `sapDpm` on non-SAP ships renders empty colored cells instead of `—`. `ShortageCalculator` calculates `Infinity` if `dailyCoalRate` is 0. Obsolete brain path in `scrape_armory.mjs`. |

---

## 2. Detailed Technical Breakdown

### D-01: Massive Over-Classification of Ships as "Testing" (272 Ships)
- **Root Cause**: In [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L327) and [`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs#L68), any ship that is not matched by the 24 hardcoded Removed ships, 14 hardcoded Dockyard ships, Black Friday/Collab regexes, or the transient 189-ship Armory snapshot defaults to:
  ```javascript
  category = 'Testing';
  status = 'in_testing';
  obtainMethodText = 'Testing / Unreleased';
  ```
- **Breakdown of the 272 "Testing" Ships**:
  - **216 Real Released Premium / Special Ships**:
    - *Atlanta* (T7 Cruiser, `PASC006_Atlanta_1942`)
    - *Saipan* (T8 Carrier, `PASA528_Saipan`)
    - *Kidd* (T8 Destroyer, `PASD508_Kidd`)
    - *Sims* (T7 Destroyer, `PASD029_Sims_1941`)
    - *Indianapolis* (T7 Cruiser, `PASC507_Indianapolis_1945`)
    - *Boise* (T7 Cruiser, `PASC597_Nueve_de_Julio_1951`)
    - *Ark Royal*, *Colossus*, *Agincourt*, *Collingwood*, *Renown '44*, *Rodney*, *Cheshire*, *Dido*, *Belfast '43*
  - **Classic Rare / Removed Ships**:
    - *Imperator Nikolai I* (`PRSB001_Nikolay_I`)
    - *König Albert* (`PGSB503_Koenig_Albert`)
    - *Iwaki Alpha* (`PJSC026_Iwaki_1944`)
    - *Arkansas Beta* (`PASB013_Arkansas_1912`)
  - **Internal Test / Demo Clones**:
    - 20 `demoWithoutStats` (e.g. *Iowa 2*, *Montana 2*, *Colorado 2*, *North Carolina 2*, *Balao 2*)
    - 30 `demoWithoutStatsPrem` (e.g. *New Jersey*, *Frank Friday*, *Werner Voss*)
    - 6 `experimental`
- **UI Impact**: [`FilterBar.tsx`](file:///home/zn/wows-info/src/components/filters/FilterBar.tsx#L56) has no "Testing" filter button. When users click *Coal*, *Steel*, *Doubloons*, *Tech Tree*, etc., these 216 authentic premium ships disappear completely from the view.

---

### D-02: Clone Detection Bugs & Inaccurate Parent References
In [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs):
```javascript
// Lines 344-350 set Tech Tree:
if (group === 'upgradeable' || group === 'start') {
  category = 'Tech Tree';
  status = 'available_tech_tree';
  ...
}

// But lines 385-444 run afterwards and overwrite Tech Tree:
if (name.includes('_Black_')) {
  category = 'Black Friday';
  isClone = true;
}
...
const isCollab = name.includes('AZUR') || ... || name.includes('Myoko') || ...;
if (isCollab && !name.includes('_Black_')) {
  category = 'Collaboration';
  isClone = true;
}
```
1. **`Black Swan` (`PBSC101_Black_Swan`)**:
   - British Tier 1 Starter cruiser contains `_Black_` in its historical name.
   - Overwritten to `category: 'Black Friday'`, `isClone: true`, with `cloneOfShipId: null`.
2. **`Myōkō` (`PJSC008_Myoko_1945`)**:
   - Japanese Tier 7 Tech Tree cruiser matches `name.includes('Myoko')` (intended for ARP ships).
   - Overwritten to `category: 'Collaboration'`, `isClone: true`, and `cloneOfShipId: 4286494416` (clone of itself).

---

### D-03: Broken Clone Parent Overrides
In [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L286-L315), [`CLONE_PARENT_OVERRIDES`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L286) contains stale or mistyped internal identifiers:
- `'PASC718_AZUR_Montpelier': 'PASC015_Cleveland_1942'`  
  -> *Cleveland* in GameParams is [`PASC208_Cleveland`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L301). Results in `null`.
- `'PJSC708_ARP_Takao': 'PJSC017_Atago_1944'`  
  -> *Atago* in GameParams is [`PJSC038_Atago_1944`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L289). Results in `null`.
- `'PJSD718_AZUR_Yukikaze': 'PJSD012_Kagero_1943'`  
  -> *Kagero* in GameParams is [`PJSD208_Kagero`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L303) (`PJSD012` is *Shimakaze*). Results in `null`.
- `'PZSD718_Warhammer_Ork': 'PZSD508_Fenyang'`  
  -> *Fenyang* in GameParams is [`PZSD518_Fen_Yang`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L314). *Ship Smasha* falls back to marking itself as its own parent.

---

### D-04: Unrecognized Clone / Variant Series
The following ships are cosmetic/event clones of existing ships, but are not detected as clones and default to `category: 'Testing'`, `isClone: false`:
- **Colorful Regatta (`CLR`)**:
  - `PASB808_Colorful_North_Carolina` (*North Carolina CLR*) -> Parent: *North Carolina* (`PASB012_North_Carolina_1945` / `PASB008_North_Carolina_1941`)
  - `PBSB920_MC_Conqueror` (*Conqueror CLR*) -> Parent: *Conqueror* (`PBSB110_Conqueror`)
- **Pirate Series**:
  - `PASB909_Pirate_Delaware` (*Bird Cry*) -> Parent: *Delaware* (`PASB209_Delaware`)
  - `PBSC920_Pirate_Plymouth` (*Fearmaw*) -> Parent: *Plymouth* (`PBSC510_Plymouth`)
  - `PFSB909_Pirate_Jean_Bart` (*Dark Corsair*) -> Parent: *Jean Bart* (`PFSB518_Jean_Bart`)
  - `PGSB918_Pirate_Brandenburg` (*Sea Howl*) -> Parent: *Brandenburg* (`PGSB518_Brandenburg`)
  - `PISC908_East_Amalfi` (*Mirage*) -> Parent: *Amalfi* (`PISC108_Amalfi`)
- **St. Patrick Series**:
  - `PBSB747_STPatric_Duke_of_York` (*Danu*) -> Parent: *Duke of York* (`PBSB507_Duke_of_York`)
  - `PBSC707_STPatric_Belfast_1959` (*Bóinn*) -> Parent: *Belfast* (`PBSC507_Belfast_1959`)
- **250th Golden Anniversary Series**:
  - `PASB940_250TH_Wisconsin` (*Wisconsin Golden*) -> Parent: *Wisconsin* (`PASB730_Wisconsin`)
  - `PASC909_250TH_Fort_Worth` (*Fort Worth Golden*) -> Parent: *Fort Worth* (`PASC729_Fort_Worth`)
  - `PASC920_Gold_Hawaii` (*Hawaii Golden*) -> Parent: *Hawaii* (`PASC720_Hawaii`)
- **Pharaoh Series**:
  - `PASB908_East_North_Carolina_1945` (*Kheper*) -> Parent: *North Carolina*
- **Test Evaluation Variants**:
  - `PFSD820_Kleber_TE`, `PGSB828_Odin_TE`, `PRSB818_Borodino_TE`, `PASB528_Alabama_VL`, `PASB708_Alabama`

---

### D-05: Test Dummy Ship Misclassified as Tech Tree
In [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L352):
```javascript
else if (group === 'superShip' || level === 11) {
  category = 'Tech Tree';
  status = 'available_tech_tree';
  primaryCurrency = 'credits';
  price = costCR || 45000000;
  obtainMethodText = `Supership Tech Tree Purchase (${(price).toLocaleString()} Credits)`;
}
```
Ship `PGSD111_Z_57` is a Tier 11 German destroyer with `group: 'demoWithoutStats'` (a developer test hull). Because `level === 11`, it is assigned to `Tech Tree`, even though it is not a released supership.

---

### D-06: Secondary Battery (ATBA) Armament Completely Missing
Secondary battery combat is a core gameplay component in WoWs and on [shiptool.st](https://shiptool.st/) (`p=ATB` comparing range, caliber, reload, DPM, shell alpha, penetration, fire chance):
- In [`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs#L360), `atba` is only referenced to extract dual-purpose guns for AA calculations.
- Neither [`catalog.json`](file:///home/zn/wows-info/public/data/catalog.json) nor [`details/*.json`](file:///home/zn/wows-info/public/data/details/) extract secondary battery specs. Famous secondary ships (*Schlieffen*, *Bismarck*, *Ohio*, *Atlântico*, *Michelangelo*, *Napoli*) have zero secondary stats displayed in the app.

---

### D-07: Incomplete Carrier (CV) and Submarine (SS) Armament Data
- **Aircraft Carriers**: In [`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs#L143-L168), `rawAircraft` is only used for ASW airstrikes. All 38 aircraft carriers (*Midway*, *Hakuryu*, *Nakhimov*, etc.) have `artillery: null`, `torpedoes: null`, and **zero plane or squadron data** (no attack craft, torpedo bombers, dive bombers, plane HP, cruising speed, restoration time, or bomb alpha).
- **Submarines**: Submarines have `artillery: null` and only basic torpedo stats. Dive capacity, recharge rate, submerged speed, periscope concealment, sonar ping speed, and ping duration are completely missing.
- **Smoke Penalty Anomaly**: In [`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs#L234), `smokePenalty` defaults to `0` when `visibilityCoefGKInSmoke` is absent. For CVs and SSs, this causes [`computeAdvantage()`](file:///home/zn/wows-info/src/utils/comparisonMatrix.ts#L377) in the comparison matrix to award them the green "Best" badge for smoke firing detectability over surface ships.

---

### D-08: Synthetic Server Statistics Pipeline
- The 12 datasets in [`public/data/stats/`](file:///home/zn/wows-info/public/data/stats/) across EU, NA, and ASIA are generated synthetically in [`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs#L251-L414) using `pseudoHash(ship.id, ...)` and multiplier curves.
- While the mathematical distributions are coherent, [`server/sync_service.mjs`](file:///home/zn/wows-info/server/sync_service.mjs#L65) does not query external server statistics APIs (such as WoWs-Numbers or WG Public API); `/api/sync` simply re-executes the deterministic pseudo-hash generator.

---

### D-09: Armory Free Mission-Chain Bundle Price Glitches
In [`scratch/armory.html`](file:///home/zn/wows-info/scratch/armory.html), early-access sequential mission bundles for *Serrano* (`5000007650`) and *Almirante Villar* (`5000007648`) are listed with `"currency": "gold"` and `"price": 0`.
- [`scripts/scrape_armory.mjs`](file:///home/zn/wows-info/scripts/scrape_armory.mjs#L76-L89) parses them as `currency: 'gold'`, `price: 0`, `couponEligible: true`, `couponPrice: 0`.
- Consequently, both vessels appear in [`armory_master.json`](file:///home/zn/wows-info/public/data/armory_master.json) and [`catalog.json`](file:///home/zn/wows-info/public/data/catalog.json) as Doubloons ships with a cost of `0 Doubloons`.

---

### D-10: Unformatted Internal Event Currency Strings
In [`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs#L51-L59), [`currencyLabels`](file:///home/zn/wows-info/scripts/build_data.mjs#L51) lacks entries for event tokens.
Ships like *Kitakami* (540,000 tokens), *Nueva Esparta* (75 tokens), and *Kurama* (11,000 tokens) have user-facing text displaying raw internal engine tokens:
`Armory (540,000 eventum_10)`, `Armory (75 eventum_6)`, `Armory (11,000 eventum_4)`.

---

### D-11: Single-Module Lock-in & Superficial Stock Module Toggle
- Tech tree ships with distinct researchable modules only expose one leaf module. For example, *Shimakaze* is locked to 8km F3 torpedoes ([`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs#L326-L352)), with no option to inspect the standard 12km or 20km Type 93 torpedoes.
- In [`src/stores/useShipStore.ts`](file:///home/zn/wows-info/src/stores/useShipStore.ts#L387), toggling `useTopModules` to `false` only adjusts `ship.health` to `stockHealth`. Artillery reload, gun range ([`stockRangeKm`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs#L249)), torpedo range/damage, engine speed, and rudder time remain unchanged.

---

### D-12: UI & Minor Glitches
1. **Cell Formatting on Zero Values**:
   - In [`src/components/table/VirtualizedTable.tsx`](file:///home/zn/wows-info/src/components/table/VirtualizedTable.tsx#L368), `sapDpm` formats `0` as `null`, but the cell renderer checks `val == null`, which evaluates `0 == null` as `false`. This renders an empty colored rectangle instead of `—`.
   - Ships without HE shells (e.g. *Minotaur*) render `0` HE DPM in red instead of a dash (`—`).
2. **Division by Zero in Shortage Calculator**:
   - In [`src/components/armory/ShortageCalculator.tsx`](file:///home/zn/wows-info/src/components/armory/ShortageCalculator.tsx#L85), `pureCoalShortage / dailyCoalRate` calculates `Infinity` if `dailyCoalRate` is set to `0`.
3. **Hardcoded Brain Transcript Path**:
   - [`scripts/scrape_armory.mjs`](file:///home/zn/wows-info/scripts/scrape_armory.mjs#L11) includes an obsolete absolute directory fallback:
     `../../../../brain/97a87afa-13d4-4b68-8c2d-42d8aa3e1bb6/scratch/armory.html`.
4. **Duplicate Display Name**:
   - Two entries exist for display name `"Vrijheid"`: ID `3552491280` (Tier 8 Cruiser) and ID `3256792848` (Tier 10 demo dummy).

---

## 3. Actionable Remediation Plan for Implementation Agent

### Phase 1: Curated Acquisition & Clone Pipeline Fixes (Immediate)
1. **Fix Clone Overwrites in [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs)**:
   - Ensure `group === 'upgradeable' || group === 'start'` ships are **never** converted into clones.
   - Remove `Myoko` from `isCollab` regex (use `ARP_` or `PJS[A-Z]7` to target Arpeggio hulls).
   - Change `_Black_` check so `PBSC101_Black_Swan` is excluded.
   - Exclude `demoWithoutStats` ships from Supership Tech Tree (`PGSD111_Z_57`).
2. **Correct Clone Parent References in [`CLONE_PARENT_OVERRIDES`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs#L286)**:
   ```javascript
   'PASC718_AZUR_Montpelier': 'PASC208_Cleveland',
   'PJSC708_ARP_Takao': 'PJSC038_Atago_1944',
   'PJSD718_AZUR_Yukikaze': 'PJSD208_Kagero',
   'PZSD718_Warhammer_Ork': 'PZSD518_Fen_Yang',
   ```
3. **Add Known Clone Series**:
   - Add matching rules for `_Colorful_` / `_MC_` (Regatta), `_Pirate_`, `_STPatric_`, `_250TH_`, `_East_`.
4. **Categorize the 216 Unmapped Premiums**:
   - In [`scripts/build_curated_acquisition.mjs`](file:///home/zn/wows-info/scripts/build_curated_acquisition.mjs), assign ships with `group: 'special' | 'premium' | 'ultimate'` that are not in the Armory snapshot to `category: 'Doubloon'` (or 'Special') with standard tier Doubloon pricing baselines (e.g. T8: 11,500 Doubloons, T7: 8,500 Doubloons, T6: 6,500 Doubloons, etc.).
   - Explicitly add classic removed ships (*Nikolai I*, *König Albert*, *Iwaki Alpha*, *Arkansas Beta*) to `REMOVED_SHIPS_LIST`.

### Phase 2: Armory Scraping & Currency Polishing
1. **Filter 0-Price Early Access Bundles in [`scripts/scrape_armory.mjs`](file:///home/zn/wows-info/scripts/scrape_armory.mjs)**:
   - In [`normalizeArmoryData`](file:///home/zn/wows-info/scripts/scrape_armory.mjs#L45), skip offers where `bundleInfo.price <= 0` or title includes `_Free`.
2. **Expand `currencyLabels` in [`scripts/build_data.mjs`](file:///home/zn/wows-info/scripts/build_data.mjs#L51)**:
   ```javascript
   eventum_10: 'Expedition Tokens',
   eventum_6: 'Pan-American Tokens',
   eventum_4: 'Event Tokens',
   ```
3. **Remove Stale Brain Transcript Fallback**:
   - In [`scripts/scrape_armory.mjs`](file:///home/zn/wows-info/scripts/scrape_armory.mjs#L9), keep only `path.resolve(__dirname, '../scratch/armory.html')`.

### Phase 3: Secondary Battery (ATBA) & CV/SS Armament Extraction
1. **Secondary Battery Extraction in [`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs)**:
   - Iterate over `topHullUpgrade.components.atba` mounts to extract:
     - `rangeKm`: max secondary range (e.g. 7.3km - 8.3km).
     - `reload`: shot delay.
     - `caliberMm`: barrel diameter * 1000.
     - `heDpm` / `sapDpm` / `apDpm`: calculated using total barrels and projectile alpha.
     - `fireChance`: projectile `burnProb`.
     - `penetrationMm`: projectile `alphaPiercingHE` or `alphaPiercingCS`.
   - Expose in `catalog.json` under `ship.secondary` and create a Secondary preset in [`FilterBar.tsx`](file:///home/zn/wows-info/src/components/filters/FilterBar.tsx).
2. **Smoke Penalty Fix**:
   - In [`scripts/parse_gameparams.mjs`](file:///home/zn/wows-info/scripts/parse_gameparams.mjs#L234), if `visibilityCoefGKInSmoke` is 0 or absent, set `smokePenalty = null` (not `0`).
3. **Guard Against Zero in Shortage Calculator**:
   - In [`src/components/armory/ShortageCalculator.tsx`](file:///home/zn/wows-info/src/components/armory/ShortageCalculator.tsx#L85), verify `dailyCoalRate > 0` before division:
     ```typescript
     const daysToGoalPureCoal =
       dailyCoalRate > 0 && pureCoalShortage > 0
         ? Math.ceil(pureCoalShortage / dailyCoalRate)
         : 0;
     ```
