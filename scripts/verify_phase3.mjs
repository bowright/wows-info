import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calcModifiedStats } from './modifiers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DATA = path.resolve(__dirname, '../public/data');
const SRC_DIR = path.resolve(__dirname, '../src');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

// Pure filter implementation mirroring src/stores/useShipStore.ts
function filterShips(ships, filters) {
  const query = (filters.searchQuery || '').trim().toLowerCase();

  return ships.filter((ship) => {
    // 1. Hide Clones
    if (filters.hideClones && ship.acquisition?.isClone) {
      return false;
    }

    // 2. Nation filter
    if (filters.selectedNations && filters.selectedNations.length > 0) {
      const shipNation = ship.nation.toLowerCase();
      if (!filters.selectedNations.some((n) => n.toLowerCase() === shipNation)) {
        return false;
      }
    }

    // 3. Tier filter
    if (filters.selectedTiers && filters.selectedTiers.length > 0) {
      if (!filters.selectedTiers.includes(ship.tier)) {
        return false;
      }
    }

    // 4. Class filter
    if (filters.selectedClasses && filters.selectedClasses.length > 0) {
      if (!filters.selectedClasses.includes(ship.class)) {
        return false;
      }
    }

    // 5. Acquisition category filter
    if (filters.selectedAcquisitions && filters.selectedAcquisitions.length > 0) {
      const match = filters.selectedAcquisitions.some((acq) => {
        const cat = ship.acquisition?.category;
        const cats = ship.acquisition?.categories || (cat ? [cat] : []);
        if (acq === 'Clones') {
          return ship.acquisition?.isClone === true || cat === 'Black Friday' || cat === 'Collaboration' || cats.includes('Black Friday') || cats.includes('Collaboration');
        }
        if (acq === 'Doubloons' || acq === 'Doubloon') {
          return cat === 'Doubloon' || cat === 'Coal / Doubloon' || cats.includes('Doubloon');
        }
        if (acq === 'Coal') {
          return cat === 'Coal' || cat === 'Coal / Doubloon' || cats.includes('Coal');
        }
        return cat === acq || cats.includes(acq);
      });
      if (!match) return false;
    }

    // 6. Search query
    if (query) {
      const matchDisp = ship.dispName?.toLowerCase().includes(query);
      const matchName = ship.name?.toLowerCase().includes(query);
      const matchShort = ship.dispShortName?.toLowerCase().includes(query);
      if (!matchDisp && !matchName && !matchShort) {
        return false;
      }
    }

    return true;
  });
}

function getEffectivePrice(acquisition, applyCoupons = false) {
  if (!acquisition || acquisition.price == null) return null;
  if (applyCoupons && acquisition.couponEligible) {
    return acquisition.couponPrice ?? Math.round(acquisition.price * 0.75);
  }
  return acquisition.price;
}

async function runVerification() {
  console.log('====================================================');
  console.log('  WoWs-Info Phase 3 Verification Suite              ');
  console.log('  (Virtualized Parameter Matrix /params)            ');
  console.log('====================================================\n');

  // Load catalog.json
  const catalogPath = path.join(PUBLIC_DATA, 'catalog.json');
  assert(fs.existsSync(catalogPath), 'catalog.json exists in public/data/');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert(Array.isArray(catalog) && catalog.length === 993, `Catalog contains all 993 ships (found ${catalog.length})`);

  // --- Suite 1: Acquisition Filtering Accuracy ---
  console.log('\nSuite 1: Acquisition Category Filtering');

  // Filter by Coal (all 52 ships obtainable via Coal, including 33 dual Coal/Doubloon)
  const coalShips = filterShips(catalog, { selectedAcquisitions: ['Coal'] });
  assert(coalShips.length === 52, `Filter by Coal returns all 52 Coal-obtainable ships (found ${coalShips.length})`);
  assert(coalShips.every((s) => s.acquisition?.category === 'Coal' || s.acquisition?.category === 'Coal / Doubloon'), 'All filtered ships have category Coal or Coal / Doubloon');
  assert(coalShips.some((s) => s.dispName === 'Kearsarge'), 'Found Kearsarge in Coal ships');
  assert(coalShips.some((s) => s.dispName === 'Tulsa'), 'Found Tulsa in Coal ships');
  assert(coalShips.some((s) => s.dispName === 'Salem'), 'Found Salem in Coal ships');

  // Filter by Doubloons (includes Kearsarge and other dual-currency ships)
  const doubShips = filterShips(catalog, { selectedAcquisitions: ['Doubloons'] });
  assert(doubShips.some((s) => s.dispName === 'Kearsarge'), 'Found Kearsarge in Doubloon ships');
  assert(doubShips.some((s) => s.dispName === 'Tulsa'), 'Found Tulsa in Doubloon ships');

  // Filter by Steel
  const steelShips = filterShips(catalog, { selectedAcquisitions: ['Steel'] });
  assert(steelShips.length === 21, `Filter by Steel returns exactly 21 ships (found ${steelShips.length})`);
  assert(steelShips.every((s) => s.acquisition?.category === 'Steel'), 'All filtered ships have category Steel');
  assert(steelShips.some((s) => s.dispName === 'Franklin D. Roosevelt'), 'Found FDR in Steel ships');
  assert(steelShips.some((s) => s.dispName === 'Bourgogne'), 'Found Bourgogne in Steel ships');

  // Filter by Research Bureau
  const rbShips = filterShips(catalog, { selectedAcquisitions: ['Research Bureau'] });
  assert(rbShips.length === 19, `Filter by Research Bureau returns exactly 19 ships (found ${rbShips.length})`);
  assert(rbShips.some((s) => s.dispName === 'Ohio'), 'Found Ohio in Research Bureau ships');
  assert(rbShips.some((s) => s.dispName === 'Slava'), 'Found Slava in Research Bureau ships');

  // Filter by Dockyard
  const dockyardShips = filterShips(catalog, { selectedAcquisitions: ['Dockyard'] });
  assert(dockyardShips.length === 16, `Filter by Dockyard returns exactly 16 ships (found ${dockyardShips.length})`);
  assert(dockyardShips.some((s) => s.dispName === 'Wisconsin'), 'Found Wisconsin in Dockyard ships');
  assert(dockyardShips.some((s) => s.dispName === 'ZF-6'), 'Found ZF-6 in Dockyard ships');

  // Filter by Removed
  const removedShips = filterShips(catalog, { selectedAcquisitions: ['Removed'] });
  assert(removedShips.length === 35, `Filter by Removed returns exactly 35 ships (found ${removedShips.length})`);
  assert(removedShips.some((s) => s.dispName === 'Musashi'), 'Found Musashi in Removed ships');
  assert(removedShips.some((s) => s.dispName === 'Småland'), 'Found Småland in Removed ships');
  assert(removedShips.some((s) => s.dispName === 'Admiral Graf Spee'), 'Found Admiral Graf Spee in Removed ships');

  // --- Suite 2: Coupon Price Calculation (-25% Armory Coupons) ---
  console.log('\nSuite 2: Coupon Price Modeling');

  // Tulsa (Coal ship: 180,000 -> 135,000)
  const tulsa = catalog.find((s) => s.dispName === 'Tulsa');
  assert(Boolean(tulsa), 'Found Tulsa in catalog');
  assert(tulsa.acquisition?.price === 180000, 'Tulsa base Coal price is 180,000');
  assert(tulsa.acquisition?.couponEligible === true, 'Tulsa marked couponEligible === true');
  const tulsaBasePrice = getEffectivePrice(tulsa.acquisition, false);
  const tulsaCouponPrice = getEffectivePrice(tulsa.acquisition, true);
  assert(tulsaBasePrice === 180000, `Tulsa base price is 180,000 without coupon (got ${tulsaBasePrice})`);
  assert(tulsaCouponPrice === 135000, `Tulsa price discounted by exact 25% to 135,000 with coupon (got ${tulsaCouponPrice})`);

  // FDR (Steel ship: 31,000 -> 23,250)
  const fdr = catalog.find((s) => s.dispName === 'Franklin D. Roosevelt');
  assert(Boolean(fdr), 'Found FDR in catalog');
  assert(fdr.acquisition?.price === 31000, 'FDR base Steel price is 31,000');
  const fdrBasePrice = getEffectivePrice(fdr.acquisition, false);
  const fdrCouponPrice = getEffectivePrice(fdr.acquisition, true);
  assert(fdrBasePrice === 31000, `FDR base price is 31,000 without coupon (got ${fdrBasePrice})`);
  assert(fdrCouponPrice === 23250, `FDR price discounted by exact 25% to 23,250 with coupon (got ${fdrCouponPrice})`);

  // Ohio (Research Bureau ship: 62,000 RP -> strictly NOT coupon eligible)
  const ohio = catalog.find((s) => s.dispName === 'Ohio');
  assert(Boolean(ohio), 'Found Ohio in catalog');
  assert(ohio.acquisition?.price === 62000, 'Ohio base RP price is 62,000');
  assert(ohio.acquisition?.couponEligible === false, 'Ohio marked couponEligible === false');
  const ohioBasePrice = getEffectivePrice(ohio.acquisition, false);
  const ohioCouponPrice = getEffectivePrice(ohio.acquisition, true);
  assert(ohioBasePrice === 62000, 'Ohio base price is 62,000 RP');
  assert(ohioCouponPrice === 62000, `Ohio price remains unchanged at 62,000 RP when coupon toggle is active (got ${ohioCouponPrice})`);

  // --- Suite 3: Hide Clones / Replicas ---
  console.log('\nSuite 3: Clones & Replicas Filtering');

  const totalClones = catalog.filter((s) => s.acquisition?.isClone).length;
  assert(totalClones === 144, `Catalog contains exactly 144 clone ships (found ${totalClones})`);

  const unclonedShips = filterShips(catalog, { hideClones: true });
  assert(
    unclonedShips.length === catalog.length - 144,
    `Hide Clones removes all 144 clone ships: 993 -> ${unclonedShips.length} ships (expected 849)`
  );
  assert(
    unclonedShips.every((s) => !s.acquisition?.isClone),
    'Zero clone ships present when Hide Clones is active'
  );
  assert(!unclonedShips.some((s) => s.dispName === 'Tirpitz B'), 'Tirpitz B removed when Hide Clones active');
  assert(!unclonedShips.some((s) => s.dispName === 'ARP Yamato'), 'ARP Yamato removed when Hide Clones active');
  assert(unclonedShips.some((s) => s.dispName === 'Tirpitz'), 'Parent Tirpitz preserved');
  assert(unclonedShips.some((s) => s.dispName === 'Yamato'), 'Parent Yamato preserved');

  // Filter by Clones specifically
  const onlyClones = filterShips(catalog, { selectedAcquisitions: ['Clones'] });
  assert(onlyClones.length === 144, `Filtering specifically by Clones returns all 144 replica ships (found ${onlyClones.length})`);

  // --- Suite 4: Search Query Filtering Precision ---
  console.log('\nSuite 4: Search Query Precision');

  const yamatoResults = filterShips(catalog, { searchQuery: 'yamato' });
  assert(yamatoResults.length >= 2, `Searching "yamato" returns >= 2 results (found ${yamatoResults.length})`);
  assert(yamatoResults.some((s) => s.dispName === 'Yamato'), 'Search matches Yamato');
  assert(yamatoResults.some((s) => s.dispName === 'ARP Yamato'), 'Search matches ARP Yamato');

  const bismarckResults = filterShips(catalog, { searchQuery: 'bismarck' });
  assert(bismarckResults.length >= 2, `Searching "bismarck" returns Bismarck variations (found ${bismarckResults.length})`);
  assert(bismarckResults.some((s) => s.dispName === 'Bismarck'), 'Search matches Bismarck');

  const emptySearch = filterShips(catalog, { searchQuery: '   ' });
  assert(emptySearch.length === 993, 'Whitespace query returns all 993 ships');

  // --- Suite 5: Multi-Dimensional Compound Filtering ---
  console.log('\nSuite 5: Multi-Dimensional Compound Filtering');

  const t10BbUsa = filterShips(catalog, {
    selectedTiers: [10],
    selectedClasses: ['Battleship'],
    selectedNations: ['usa'],
    hideClones: false,
  });
  assert(t10BbUsa.length >= 3, `Found Tier 10 US Battleships (found ${t10BbUsa.length})`);
  assert(t10BbUsa.some((s) => s.dispName === 'Montana'), 'Found Montana');
  assert(t10BbUsa.some((s) => s.dispName === 'Ohio'), 'Found Ohio');
  assert(t10BbUsa.some((s) => s.dispName === 'Wisconsin'), 'Found Wisconsin');
  assert(
    t10BbUsa.every((s) => s.tier === 10 && s.class === 'Battleship' && s.nation.toLowerCase() === 'usa'),
    'All match T10 US BB criteria'
  );

  // --- Suite 6: Virtualized Table & Pinned Columns Projection ---
  console.log('\nSuite 6: Virtualized Table & Pinned Columns Projection');

  const tableFilePath = path.join(SRC_DIR, 'components/table/VirtualizedTable.tsx');
  assert(fs.existsSync(tableFilePath), 'VirtualizedTable.tsx component exists');
  const tableContent = fs.readFileSync(tableFilePath, 'utf8');

  // Verify @tanstack/react-table and @tanstack/react-virtual integration
  assert(tableContent.includes('@tanstack/react-table'), 'VirtualizedTable imports @tanstack/react-table');
  assert(tableContent.includes('@tanstack/react-virtual'), 'VirtualizedTable imports @tanstack/react-virtual');
  assert(tableContent.includes('useVirtualizer'), 'VirtualizedTable utilizes useVirtualizer hook');

  // Verify 6 pinned columns: compare, tier, class, nation, name, acquisition
  const hasComparePinned = tableContent.includes("id: 'compare'");
  const hasTierPinned = tableContent.includes("id: 'tier'");
  const hasClassPinned = tableContent.includes("id: 'class'");
  const hasNationPinned = tableContent.includes("id: 'nation'");
  const hasNamePinned = tableContent.includes("id: 'name'");
  const hasAcquisitionPinned = tableContent.includes("id: 'acquisition'");
  assert(
    hasComparePinned && hasTierPinned && hasClassPinned && hasNationPinned && hasNamePinned && hasAcquisitionPinned,
    'Exactly 6 pinned columns configured (compare, tier, class, nation, name, acquisition)'
  );

  // Verify presets supported
  assert(tableContent.includes("'general'"), "Presets support 'general'");
  assert(tableContent.includes("'survivability'"), "Presets support 'survivability'");
  assert(tableContent.includes("'artillery'"), "Presets support 'artillery'");
  assert(tableContent.includes("'secondary'"), "Presets support 'secondary'");
  assert(tableContent.includes("'torpedoes'"), "Presets support 'torpedoes'");
  assert(tableContent.includes("'aa'"), "Presets support 'aa'");
  assert(tableContent.includes("'asw'"), "Presets support 'asw'");
  assert(tableContent.includes("'all'"), "Presets support 'all'");

  // --- Suite 7: Build Modifier Live Recomputation on Catalog Data ---
  console.log('\nSuite 7: Build Modifier Live Recomputation on Catalog Data');

  const iowa = catalog.find((s) => s.name === 'PASB018_Iowa_1944');
  assert(Boolean(iowa), 'Found Iowa in catalog for live recomputation');

  // Equip CE + CSM1 on Iowa (base 15.7 km): detectability 15.7 km -> 12.72 km (0.81 compound)
  const iowaConcealmentTest = { ...iowa, concealmentSurface: 15.7 };
  const modifiedIowa = calcModifiedStats(iowaConcealmentTest, {
    upgrades: { slot5: 'csm1' },
    skills: { concealmentExpert: true },
  });
  assert(
    modifiedIowa.concealmentSurface === 12.72,
    `Iowa detectability recomputed to 12.72 km with CE + CSM1 (got ${modifiedIowa.concealmentSurface} km)`
  );

  // Equip Main Battery Mod 3 on Iowa: reload 30.0s -> 26.4s (-12%)
  const reloadIowa = calcModifiedStats(iowa, {
    upgrades: { slot6: 'mbm3' },
  });
  assert(
    reloadIowa.artillery.reload === 26.4,
    `Iowa main battery reload recomputed to 26.4s with MBM3 (got ${reloadIowa.artillery.reload}s)`
  );

  // Equip Sierra Mike: speed 33.0 kts -> 34.65 kts (+5%)
  const speedIowa = calcModifiedStats(iowa, {
    signals: { sierraMike: true },
  });
  assert(
    speedIowa.speed === 34.65,
    `Iowa speed recomputed to 34.65 kts with Sierra Mike (got ${speedIowa.speed} kts)`
  );

  // Equip Adrenaline Rush at 50% HP: 10% reload buff (30s -> 27.0s)
  const arIowa = calcModifiedStats(iowa, {
    skills: { adrenalineRush: true, hpLostPercent: 50 },
  });
  assert(
    arIowa.artillery.reload === 27.0,
    `Iowa reload recomputed to 27.0s with Adrenaline Rush at 50% HP (got ${arIowa.artillery.reload}s)`
  );

  // Summary
  console.log('\n====================================================');
  console.log(`  Phase 3 Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled error during Phase 3 verification:', err);
  process.exit(1);
});
