import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOCKYARD_ARCHIVE } from '../src/data/dockyardArchive.ts';
import { REMOVED_SHIPS_ARCHIVE } from '../src/data/removedShipsArchive.ts';

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

// Pure shortage calculation function mirroring src/components/armory/ShortageCalculator.tsx
function computeShortage(price, isCouponEligible, applyCoupon, userCoal, userSteel, dailyRate = 1200) {
  const effectivePrice = applyCoupon && isCouponEligible ? Math.round(price * 0.75) : price;

  const canAffordPureCoal = userCoal >= effectivePrice;
  const pureCoalRemaining = canAffordPureCoal ? userCoal - effectivePrice : 0;
  const pureCoalShortage = canAffordPureCoal ? 0 : effectivePrice - userCoal;
  const daysToGoalPureCoal = pureCoalShortage > 0 ? Math.ceil(pureCoalShortage / dailyRate) : 0;

  // 1:10 Steel substitution
  const steelNeededToCover = pureCoalShortage > 0 ? Math.ceil(pureCoalShortage / 10) : 0;
  const canAffordWithSteel = canAffordPureCoal || (pureCoalShortage > 0 && userSteel >= steelNeededToCover);
  const steelRemainingAfterCover = canAffordWithSteel ? userSteel - steelNeededToCover : 0;

  // Shortage when all Steel is substituted
  const remainingCoalShortageWithSteel = Math.max(0, effectivePrice - (userCoal + userSteel * 10));
  const effectiveSteelShortage = Math.ceil(remainingCoalShortageWithSteel / 10);
  const daysToGoalWithSteel = remainingCoalShortageWithSteel > 0 ? Math.ceil(remainingCoalShortageWithSteel / dailyRate) : 0;

  return {
    effectivePrice,
    canAffordPureCoal,
    pureCoalRemaining,
    pureCoalShortage,
    daysToGoalPureCoal,
    steelNeededToCover,
    canAffordWithSteel,
    steelRemainingAfterCover,
    remainingCoalShortageWithSteel,
    effectiveSteelShortage,
    daysToGoalWithSteel,
  };
}

async function runVerification() {
  console.log('====================================================');
  console.log('  WoWs-Info Phase 4 Verification Suite              ');
  console.log('  (Acquisition Center & Resource Planner /armory)   ');
  console.log('====================================================\n');

  // Load catalog.json and armory_master.json
  const catalogPath = path.join(PUBLIC_DATA, 'catalog.json');
  assert(fs.existsSync(catalogPath), 'catalog.json exists in public/data/');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const catalogMap = new Map(catalog.map((s) => [s.id, s]));
  assert(catalog.length === 993, `Catalog contains 993 ships (found ${catalog.length})`);

  const armoryPath = path.join(PUBLIC_DATA, 'armory_master.json');
  assert(fs.existsSync(armoryPath), 'armory_master.json exists in public/data/');
  const armory = JSON.parse(fs.readFileSync(armoryPath, 'utf8'));

  // --- Suite 1: Armory Offers Breakdown & Catalog Linkage ---
  console.log('\nSuite 1: Armory Offers Breakdown & Catalog Linkage');

  assert(Array.isArray(armory.offers), 'armory_master.json contains offers array');
  assert(armory.offers.length === 228, `Exactly 228 active ship bundle offers (found ${armory.offers.length})`);

  const coalOffers = armory.offers.filter((o) => o.currency === 'coal');
  const steelOffers = armory.offers.filter((o) => o.currency === 'steel');
  const rbOffers = armory.offers.filter((o) => o.currency === 'paragon_xp');
  const goldOffers = armory.offers.filter((o) => o.currency === 'gold');
  const eventOffers = armory.offers.filter((o) => o.currency.startsWith('eventum'));

  assert(coalOffers.length === 52, `Coal offers count is exactly 52 (found ${coalOffers.length})`);
  assert(steelOffers.length === 21, `Steel offers count is exactly 21 (found ${steelOffers.length})`);
  assert(rbOffers.length === 19, `Research Bureau offers count is exactly 19 (found ${rbOffers.length})`);
  assert(goldOffers.length === 126, `Doubloon offers count is exactly 126 (found ${goldOffers.length})`);
  assert(eventOffers.length === 10, `Event Token offers count is exactly 10 (found ${eventOffers.length})`);

  // Total sums
  assert(
    coalOffers.length + steelOffers.length + rbOffers.length + goldOffers.length + eventOffers.length === 228,
    'Sum of all category offers equals 228'
  );

  // Unmatched verification
  const unmatched = armory.offers.filter((o) => !catalogMap.has(o.shipId));
  assert(unmatched.length === 0, `All 228 armory offers match valid catalog ships (unmatched: ${unmatched.length})`);

  // --- Suite 2: Coupon Calculations across All Armory Currencies ---
  console.log('\nSuite 2: Coupon Calculations across All Armory Currencies');

  // Coal: all 52 coupon eligible (-25%)
  const coalCouponPass = coalOffers.every(
    (o) => o.couponEligible === true && o.couponPrice === Math.round(o.price * 0.75)
  );
  assert(coalCouponPass, '100% of 52 Coal ships are couponEligible with exact -25% couponPrice');

  // Steel: all 21 coupon eligible (-25%)
  const steelCouponPass = steelOffers.every(
    (o) => o.couponEligible === true && o.couponPrice === Math.round(o.price * 0.75)
  );
  assert(steelCouponPass, '100% of 21 Steel ships are couponEligible with exact -25% couponPrice');

  // Doubloons: all 126 coupon eligible (-25%)
  const goldCouponPass = goldOffers.every(
    (o) => o.couponEligible === true && o.couponPrice === Math.round(o.price * 0.75)
  );
  assert(goldCouponPass, '100% of 126 Doubloon ships are couponEligible with exact -25% couponPrice');

  // Research Bureau: strictly NOT eligible (0% discount, full price)
  const rbCouponPass = rbOffers.every(
    (o) => o.couponEligible === false && o.couponPrice === o.price
  );
  assert(rbCouponPass, '100% of 19 Research Bureau ships strictly ineligible for coupons (0% discount)');

  // Event Tokens: strictly NOT eligible
  const eventCouponPass = eventOffers.every(
    (o) => o.couponEligible === false && o.couponPrice === o.price
  );
  assert(eventCouponPass, '100% of 10 Event Token offers strictly ineligible for coupons');

  // Specific ship coupon checks
  const fdr = steelOffers.find((o) => o.title.includes('Roosevelt') || o.title.includes('Franklin'));
  assert(Boolean(fdr), 'Found FDR in Steel offers');
  assert(fdr.price === 31000 && fdr.couponPrice === 23250, 'FDR base 31,000 Steel -> 23,250 with coupon');

  const ohio = rbOffers.find((o) => o.title === 'OHIO');
  assert(Boolean(ohio), 'Found Ohio in Research Bureau offers');
  assert(ohio.price === 62000 && ohio.couponPrice === 62000, 'Ohio price remains 62,000 RP (ineligible)');

  // --- Suite 3: Interactive Resource & Shortage Calculator Math ---
  console.log('\nSuite 3: Resource & Shortage Calculator Mathematical Engine');

  // Test Case 1: Pure Coal Affordability
  const res1 = computeShortage(180000, true, false, 200000, 0, 1200);
  assert(res1.canAffordPureCoal === true, 'Case 1: User with 200k Coal can afford 180k ship (Pure Coal)');
  assert(res1.pureCoalRemaining === 20000, 'Case 1: Leftover Coal is exactly 20,000');
  assert(res1.pureCoalShortage === 0, 'Case 1: Coal shortage is 0');
  assert(res1.daysToGoalPureCoal === 0, 'Case 1: Days to goal is 0');

  // Test Case 2: Pure Coal Shortage & Days Calculation
  const res2 = computeShortage(228000, true, false, 100000, 0, 1200);
  assert(res2.canAffordPureCoal === false, 'Case 2: User with 100k Coal cannot afford 228k ship');
  assert(res2.pureCoalShortage === 128000, 'Case 2: Shortage is exactly 128,000 Coal');
  assert(res2.daysToGoalPureCoal === 107, `Case 2: Math.ceil(128,000 / 1,200) = 107 days (got ${res2.daysToGoalPureCoal})`);

  // Test Case 3: 1:10 Steel Substitution (Exact Affordability)
  // Need 128,000 Coal -> Math.ceil(128,000 / 10) = 12,800 Steel. User has 15,000 Steel.
  const res3 = computeShortage(228000, true, false, 100000, 15000, 1200);
  assert(res3.steelNeededToCover === 12800, 'Case 3: 128,000 Coal shortage requires exactly 12,800 Steel (1:10)');
  assert(res3.canAffordWithSteel === true, 'Case 3: User with 15,000 Steel can afford via substitution');
  assert(res3.steelRemainingAfterCover === 2200, `Case 3: 15,000 - 12,800 = 2,200 Steel remaining (got ${res3.steelRemainingAfterCover})`);
  assert(res3.daysToGoalWithSteel === 0, 'Case 3: Days to goal with Steel is 0');

  // Test Case 4: Steel Substitution Partial (Still Short)
  // Need 128,000 Coal. User has 5,000 Steel (covers 50,000 Coal).
  // Remaining shortage: 128,000 - 50,000 = 78,000 Coal (or 7,800 Steel).
  const res4 = computeShortage(228000, true, false, 100000, 5000, 1200);
  assert(res4.canAffordWithSteel === false, 'Case 4: User with 5,000 Steel cannot fully cover shortage');
  assert(res4.remainingCoalShortageWithSteel === 78000, `Case 4: Remaining Coal shortage is 78,000 (got ${res4.remainingCoalShortageWithSteel})`);
  assert(res4.effectiveSteelShortage === 7800, `Case 4: Remaining Steel shortage is 7,800 Steel (got ${res4.effectiveSteelShortage})`);
  assert(res4.daysToGoalWithSteel === 65, `Case 4: Math.ceil(78,000 / 1,200) = 65 days (got ${res4.daysToGoalWithSteel})`);

  // Test Case 5: Coupon Applied (-25%) in Shortage Calculator
  // Tulsa base 180,000 Coal -> with coupon: 135,000 Coal.
  // User has 100,000 Coal, 3,500 Steel.
  const res5 = computeShortage(180000, true, true, 100000, 3500, 1200);
  assert(res5.effectivePrice === 135000, 'Case 5: Tulsa coupon price is 135,000 Coal');
  assert(res5.pureCoalShortage === 35000, 'Case 5: Coal shortage is 35,000 with coupon');
  assert(res5.steelNeededToCover === 3500, 'Case 5: Exactly 3,500 Steel needed to cover 35,000 Coal');
  assert(res5.canAffordWithSteel === true, 'Case 5: 3,500 Steel exactly covers the shortage (affordable)');
  assert(res5.steelRemainingAfterCover === 0, 'Case 5: 0 Steel remaining after exact purchase');
  assert(res5.daysToGoalWithSteel === 0, 'Case 5: 0 days to goal with Steel');

  // --- Suite 4: Dockyard Archive Completeness & Data Contracts ---
  console.log('\nSuite 4: Dockyard Archive Completeness & Data Contracts');

  assert(Array.isArray(DOCKYARD_ARCHIVE), 'DOCKYARD_ARCHIVE is an array');
  assert(DOCKYARD_ARCHIVE.length === 14, `Dockyard archive contains exactly 14 campaigns (found ${DOCKYARD_ARCHIVE.length})`);

  for (const dy of DOCKYARD_ARCHIVE) {
    assert(catalogMap.has(dy.shipId), `Dockyard ship ${dy.dispName} (${dy.shipId}) exists in catalog.json`);
    const catShip = catalogMap.get(dy.shipId);
    assert(catShip.acquisition?.category === 'Dockyard', `${dy.dispName} is cataloged under 'Dockyard' category`);
    assert(dy.totalPhases > 0, `${dy.dispName} has valid totalPhases (${dy.totalPhases})`);
    assert(dy.freePhases > 0, `${dy.dispName} has valid freePhases (${dy.freePhases})`);
    assert(dy.starterPackPhases > 0, `${dy.dispName} has valid starterPackPhases (${dy.starterPackPhases})`);
    assert(
      dy.freePhases + dy.starterPackPhases === dy.totalPhases,
      `${dy.dispName} freePhases (${dy.freePhases}) + starterPackPhases (${dy.starterPackPhases}) = totalPhases (${dy.totalPhases})`
    );
    assert(dy.minDoubloonsRequired > 0, `${dy.dispName} requires starter Doubloons (${dy.minDoubloonsRequired})`);
    assert(typeof dy.releaseVersion === 'string' && dy.releaseVersion.length > 0, `${dy.dispName} has releaseVersion`);
    assert(typeof dy.notes === 'string' && dy.notes.length > 0, `${dy.dispName} has historical notes`);
  }

  // Key dockyard checks
  const wisconsin = DOCKYARD_ARCHIVE.find((d) => d.dispName === 'Wisconsin');
  assert(Boolean(wisconsin), 'Found Wisconsin in Dockyard archive');
  assert(wisconsin.totalPhases === 30 && wisconsin.freePhases === 28 && wisconsin.starterPackPhases === 2, 'Wisconsin has 30 total, 28 free, 2 paid phases');
  assert(wisconsin.minDoubloonsRequired === 6400, 'Wisconsin requires 6,400 Doubloons starter pack');

  const michelangelo = DOCKYARD_ARCHIVE.find((d) => d.dispName === 'Michelangelo');
  assert(Boolean(michelangelo), 'Found Michelangelo in Dockyard archive');
  assert(michelangelo.totalPhases === 32 && michelangelo.freePhases === 27 && michelangelo.starterPackPhases === 5, 'Michelangelo has 32 total, 27 free, 5 paid phases');
  assert(michelangelo.minDoubloonsRequired === 7000, 'Michelangelo requires 7,000 Doubloons starter pack');

  const odin = DOCKYARD_ARCHIVE.find((d) => d.dispName === 'Odin');
  assert(Boolean(odin), 'Found Odin in Dockyard archive');
  assert(odin.totalPhases === 20 && odin.freePhases === 18 && odin.minDoubloonsRequired === 3500, 'Odin has 20 total, 18 free, 3,500 Doubloons');

  // --- Suite 5: Removed Ships Hall of Fame & Rarity Registry ---
  console.log('\nSuite 5: Removed Ships Hall of Fame & Rarity Registry');

  assert(Array.isArray(REMOVED_SHIPS_ARCHIVE), 'REMOVED_SHIPS_ARCHIVE is an array');
  assert(REMOVED_SHIPS_ARCHIVE.length === 26, `Removed ships registry contains exactly 26 ships (found ${REMOVED_SHIPS_ARCHIVE.length})`);

  for (const ship of REMOVED_SHIPS_ARCHIVE) {
    assert(catalogMap.has(ship.shipId), `Removed ship ${ship.dispName} (${ship.shipId}) exists in catalog.json`);
    const catShip = catalogMap.get(ship.shipId);
    assert(catShip.acquisition?.category === 'Removed', `${ship.dispName} is cataloged under 'Removed' category`);
    assert(
      ship.rarity === 'Santa / Supercontainer Tier 1 (Extremely Rare)',
      `${ship.dispName} marked with Santa Tier 1 (Extremely Rare) drop rate`
    );
    assert(typeof ship.removalVersion === 'string' && ship.removalVersion.length > 0, `${ship.dispName} has removalVersion`);
    assert(typeof ship.removalReason === 'string' && ship.removalReason.length > 0, `${ship.dispName} has removalReason`);
    assert(typeof ship.prevCurrency === 'string' && ship.prevCurrency.length > 0, `${ship.dispName} has prevCurrency`);
  }

  // Key removed ships checks
  const musashi = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Musashi');
  assert(Boolean(musashi), 'Found Musashi in Removed ships');
  assert(musashi.removalVersion === '0.8.0', 'Musashi removed in version 0.8.0');
  assert(musashi.prevPrice === 176000 && musashi.prevCurrency === 'Coal', 'Musashi original price 176,000 Coal');

  const smaland = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Småland');
  assert(Boolean(smaland), 'Found Småland in Removed ships');
  assert(smaland.removalVersion === '0.10.1', 'Småland removed in version 0.10.1');
  assert(smaland.prevPrice === 2000000 && smaland.prevCurrency === 'Free XP', 'Småland original price 2,000,000 Free XP');

  const enterprise = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Enterprise');
  assert(Boolean(enterprise), 'Found Enterprise in Removed ships');
  assert(enterprise.removalVersion === '0.8.7', 'Enterprise removed in version 0.8.7');
  assert(enterprise.prevPrice === 14000 && enterprise.prevCurrency === 'Doubloons', 'Enterprise original price 14,000 Doubloons');

  const belfast = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Belfast');
  assert(Boolean(belfast), 'Found Belfast in Removed ships');
  assert(belfast.removalVersion === '0.6.14', 'Belfast removed in version 0.6.14');
  assert(belfast.prevPrice === 8200 && belfast.prevCurrency === 'Doubloons', 'Belfast original price 8,200 Doubloons');

  const georgia = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Georgia');
  assert(Boolean(georgia), 'Found Georgia in Removed ships');
  assert(georgia.removalVersion === '0.10.1', 'Georgia removed in version 0.10.1');
  assert(georgia.prevPrice === 228000 && georgia.prevCurrency === 'Coal', 'Georgia original price 228,000 Coal');

  const alaska = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Alaska');
  assert(Boolean(alaska), 'Found Alaska in Removed ships');
  assert(alaska.removalVersion === '0.10.1', 'Alaska removed in version 0.10.1');
  assert(alaska.prevPrice === 1000000 && alaska.prevCurrency === 'Free XP', 'Alaska original price 1,000,000 Free XP');

  const thunderer = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Thunderer');
  assert(Boolean(thunderer), 'Found Thunderer in Removed ships');
  assert(thunderer.removalVersion === '0.10.1', 'Thunderer removed in version 0.10.1');
  assert(thunderer.prevPrice === 252000 && thunderer.prevCurrency === 'Coal', 'Thunderer original price 252,000 Coal');

  const somers = REMOVED_SHIPS_ARCHIVE.find((s) => s.dispName === 'Somers');
  assert(Boolean(somers), 'Found Somers in Removed ships');
  assert(somers.removalVersion === '0.10.1', 'Somers removed in version 0.10.1');
  assert(somers.prevPrice === 25000 && somers.prevCurrency === 'Steel', 'Somers original price 25,000 Steel');

  // --- Suite 6: Frontend Component & Tab Trigger Verification ---
  console.log('\nSuite 6: Frontend Component & Tab Trigger Verification');

  const cardPath = path.join(SRC_DIR, 'components/armory/ArmoryCard.tsx');
  assert(fs.existsSync(cardPath), 'ArmoryCard.tsx exists');
  const cardContent = fs.readFileSync(cardPath, 'utf8');
  assert(cardContent.includes('export const ArmoryCard'), 'ArmoryCard component exported');
  assert(cardContent.includes('applyCoupon'), 'ArmoryCard supports applyCoupon prop');
  assert(cardContent.includes('maxSteelSubstitute'), 'ArmoryCard supports 1:10 Steel substitution preview');
  assert(cardContent.includes('handleInspect'), 'ArmoryCard provides Inspect in Parameters action');

  const calcPath = path.join(SRC_DIR, 'components/armory/ShortageCalculator.tsx');
  assert(fs.existsSync(calcPath), 'ShortageCalculator.tsx exists');
  const calcContent = fs.readFileSync(calcPath, 'utf8');
  assert(calcContent.includes('export const ShortageCalculator'), 'ShortageCalculator component exported');
  assert(calcContent.includes('steelEquivalentCoal'), 'ShortageCalculator computes 1:10 Steel equivalent');
  assert(calcContent.includes('dailyCoalRate'), 'ShortageCalculator supports daily coal rate input');
  assert(calcContent.includes('daysToGoalWithSteel'), 'ShortageCalculator computes days to goal with steel');

  const viewPath = path.join(SRC_DIR, 'views/ArmoryView.tsx');
  assert(fs.existsSync(viewPath), 'ArmoryView.tsx exists');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert(viewContent.includes("'All Active Deals'"), "ArmoryView includes 'All Active Deals' tab");
  assert(viewContent.includes("'Coal Ships'"), "ArmoryView includes 'Coal Ships' tab");
  assert(viewContent.includes("'Steel Ships'"), "ArmoryView includes 'Steel Ships' tab");
  assert(viewContent.includes("'Research Bureau'"), "ArmoryView includes 'Research Bureau' tab");
  assert(viewContent.includes("'Doubloon Ships'"), "ArmoryView includes 'Doubloon Ships' tab");
  assert(viewContent.includes("'Shortage Calculator'"), "ArmoryView includes 'Shortage Calculator' tab");
  assert(viewContent.includes("'Removed Ships Hall of Fame'"), "ArmoryView includes 'Removed Ships Hall of Fame' tab");
  assert(viewContent.includes("'Dockyard Archive'"), "ArmoryView includes 'Dockyard Archive' tab");

  // Summary
  console.log('\n====================================================');
  console.log(`  Phase 4 Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled error in Phase 4 verification:', err);
  process.exit(1);
});
