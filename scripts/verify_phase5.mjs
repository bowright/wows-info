import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculatePR,
  getPRTier,
  getPRColor,
  formatPR,
  getExpectedBaseline,
} from '../src/utils/prCalculator.ts';
import {
  computeAggregateMetrics,
  normalizeServer,
  matchesAcquisitionCategory,
} from '../src/stores/useStatsStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DATA = path.resolve(__dirname, '../public/data');
const STATS_DIR = path.join(PUBLIC_DATA, 'stats');
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

async function runVerification() {
  console.log('=== World of Warships Server Statistics & PR Engine Verification (Phase 5) ===\n');

  // ----------------------------------------------------
  // Suite 1: Server Stats Chunks & File Integrity
  // ----------------------------------------------------
  console.log('Suite 1: Server Stats Chunks & File Integrity');

  const statsFiles = fs.readdirSync(STATS_DIR);
  assert(statsFiles.length === 12, `public/data/stats/ contains exactly 12 chunks (found ${statsFiles.length})`);

  const servers = ['eu', 'com', 'asia'];
  const spans = ['1', '3', '12', 'all'];

  for (const srv of servers) {
    for (const span of spans) {
      const filename = `stats-${srv}-${span}.json`;
      const filePath = path.join(STATS_DIR, filename);
      assert(fs.existsSync(filePath), `Chunk exists: ${filename}`);

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert(data.server === srv, `${filename} has server === '${srv}'`);
      assert(data.span === span, `${filename} has span === '${span}'`);
      assert(typeof data.updatedAt === 'string', `${filename} has ISO updatedAt`);
      assert(data.totalShips === 993, `${filename} reports totalShips === 993`);
      assert(Array.isArray(data.stats) && data.stats.length === 993, `${filename} contains 993 ship records`);

      // Check random sample records
      const sample = data.stats[0];
      assert(typeof sample.shipId === 'number', `${filename} ship[0] has numeric shipId`);
      assert(typeof sample.name === 'string', `${filename} ship[0] has ship name`);
      assert(typeof sample.dispName === 'string', `${filename} ship[0] has dispName`);
      assert(typeof sample.battles === 'number' && sample.battles > 0, `${filename} ship[0] has valid battles`);
      assert(typeof sample.winRate === 'number', `${filename} ship[0] has winRate`);
      assert(typeof sample.avgDamage === 'number', `${filename} ship[0] has avgDamage`);
      assert(typeof sample.avgFrags === 'number', `${filename} ship[0] has avgFrags`);
      assert(typeof sample.survivalRate === 'number', `${filename} ship[0] has survivalRate`);
      assert(typeof sample.avgXp === 'number', `${filename} ship[0] has avgXp`);
      assert(typeof sample.spottingDamage === 'number', `${filename} ship[0] has spottingDamage`);
      assert(typeof sample.potentialDamage === 'number', `${filename} ship[0] has potentialDamage`);
      assert(typeof sample.planesDowned === 'number', `${filename} ship[0] has planesDowned`);
      assert(typeof sample.pr === 'number' && sample.pr >= 0, `${filename} ship[0] has PR score (${sample.pr})`);
      assert(typeof sample.brackets === 'object', `${filename} ship[0] has brackets dictionary`);
      assert(
        ['all', 'low', 'medium', 'high', 'top1'].every((k) => sample.brackets[k] != null),
        `${filename} ship[0] contains all 5 skill brackets (all, low, medium, high, top1)`
      );
    }
  }

  // ----------------------------------------------------
  // Suite 2: Skill Bracket Integrity & Battle-Weighted Mathematics
  // ----------------------------------------------------
  console.log('\nSuite 2: Skill Bracket Integrity & Battle-Weighted Mathematics');

  const testChunkPath = path.join(STATS_DIR, 'stats-eu-1.json');
  const eu1Data = JSON.parse(fs.readFileSync(testChunkPath, 'utf8'));

  // Test 10 ships across tiers & classes for mathematical exactness
  const testIndices = [0, 50, 100, 200, 300, 450, 600, 750, 880, 990];
  for (const idx of testIndices) {
    const s = eu1Data.stats[idx];
    const bAll = s.brackets.all;
    const bLow = s.brackets.low;
    const bMed = s.brackets.medium;
    const bHigh = s.brackets.high;
    const bTop = s.brackets.top1;

    // 1. Battles conservation: all = low + med + high + top1
    const subSumBattles = bLow.battles + bMed.battles + bHigh.battles + bTop.battles;
    assert(
      bAll.battles === subSumBattles,
      `Ship '${s.dispName}' battles conservation: all (${bAll.battles}) == sum of brackets (${subSumBattles})`
    );

    // 2. Wins conservation: all = low + med + high + top1
    const subSumWins = bLow.wins + bMed.wins + bHigh.wins + bTop.wins;
    assert(
      bAll.wins === subSumWins,
      `Ship '${s.dispName}' wins conservation: all (${bAll.wins}) == sum of brackets (${subSumWins})`
    );

    // 3. Damage conservation: all = low + med + high + top1
    const subSumDamage = bLow.damage + bMed.damage + bHigh.damage + bTop.damage;
    assert(
      bAll.damage === subSumDamage,
      `Ship '${s.dispName}' damage conservation: all (${bAll.damage}) == sum of brackets (${subSumDamage})`
    );

    // 4. Frags conservation: all = low + med + high + top1
    const subSumFrags = bLow.frags + bMed.frags + bHigh.frags + bTop.frags;
    assert(
      bAll.frags === subSumFrags,
      `Ship '${s.dispName}' frags conservation: all (${bAll.frags}) == sum of brackets (${subSumFrags})`
    );

    // 5. Survived conservation: all = low + med + high + top1
    const subSumSurv = bLow.survived + bMed.survived + bHigh.survived + bTop.survived;
    assert(
      bAll.survived === subSumSurv,
      `Ship '${s.dispName}' survived conservation: all (${bAll.survived}) == sum of brackets (${subSumSurv})`
    );

    // 6. XP conservation: all = low + med + high + top1
    const subSumXp = bLow.xp + bMed.xp + bHigh.xp + bTop.xp;
    assert(
      bAll.xp === subSumXp,
      `Ship '${s.dispName}' XP conservation: all (${bAll.xp}) == sum of brackets (${subSumXp})`
    );

    // 7. Spotting conservation
    const subSumSpot = bLow.spotting + bMed.spotting + bHigh.spotting + bTop.spotting;
    assert(
      bAll.spotting === subSumSpot,
      `Ship '${s.dispName}' spotting conservation: all (${bAll.spotting}) == sum of brackets (${subSumSpot})`
    );

    // 8. Potential conservation
    const subSumPot = bLow.potential + bMed.potential + bHigh.potential + bTop.potential;
    assert(
      bAll.potential === subSumPot,
      `Ship '${s.dispName}' potential conservation: all (${bAll.potential}) == sum of brackets (${subSumPot})`
    );

    // 9. Exact Rate calculations check for 'all'
    const expectedWR = Math.round((subSumWins / subSumBattles) * 10000) / 100;
    assert(
      bAll.winRate === expectedWR,
      `Ship '${s.dispName}' WinRate formula: ${bAll.winRate}% === ${expectedWR}%`
    );

    const expectedAvgDmg = Math.round(subSumDamage / subSumBattles);
    assert(
      bAll.avgDamage === expectedAvgDmg,
      `Ship '${s.dispName}' AvgDamage formula: ${bAll.avgDamage} === ${expectedAvgDmg}`
    );

    const expectedFragRate = Math.round((subSumFrags / subSumBattles) * 100) / 100;
    assert(
      bAll.avgFrags === expectedFragRate,
      `Ship '${s.dispName}' FragRate formula: ${bAll.avgFrags} === ${expectedFragRate}`
    );

    const expectedSurvivalRate = Math.round((subSumSurv / subSumBattles) * 10000) / 100;
    assert(
      bAll.survivalRate === expectedSurvivalRate,
      `Ship '${s.dispName}' SurvivalRate formula: ${bAll.survivalRate}% === ${expectedSurvivalRate}%`
    );

    const expectedAvgXp = Math.round(subSumXp / subSumBattles);
    assert(
      bAll.avgXp === expectedAvgXp,
      `Ship '${s.dispName}' AvgXP formula: ${bAll.avgXp} === ${expectedAvgXp}`
    );
  }

  // Test multi-ship aggregate metrics function
  const sampleSubset = eu1Data.stats.slice(0, 20);
  const agg = computeAggregateMetrics(sampleSubset);

  let manualGames = 0;
  let manualWins = 0;
  let manualDamage = 0;
  let manualFrags = 0;
  let manualSurv = 0;
  let manualXp = 0;

  for (const s of sampleSubset) {
    manualGames += s.battles;
    manualWins += s.wins;
    manualDamage += s.damage;
    manualFrags += s.frags;
    manualSurv += s.survived;
    manualXp += s.xp;
  }

  assert(agg.totalBattles === manualGames, `Aggregate total battles matches: ${agg.totalBattles}`);
  assert(
    agg.winRate === Math.round((manualWins / manualGames) * 10000) / 100,
    `Aggregate battle-weighted winRate matches: ${agg.winRate}%`
  );
  assert(
    agg.avgDamage === Math.round(manualDamage / manualGames),
    `Aggregate battle-weighted avgDamage matches: ${agg.avgDamage}`
  );
  assert(
    agg.fragRate === Math.round((manualFrags / manualGames) * 100) / 100,
    `Aggregate battle-weighted fragRate matches: ${agg.fragRate}`
  );
  assert(
    agg.survivalRate === Math.round((manualSurv / manualGames) * 10000) / 100,
    `Aggregate battle-weighted survivalRate matches: ${agg.survivalRate}%`
  );
  assert(
    agg.avgXp === Math.round(manualXp / manualGames),
    `Aggregate battle-weighted avgXp matches: ${agg.avgXp}`
  );

  // ----------------------------------------------------
  // Suite 3: Personal Rating (PR) Formula & Tier Classification
  // ----------------------------------------------------
  console.log('\nSuite 3: Personal Rating (PR) Formula & Tier Classification');

  // Test 1: Exact baseline performance -> PR = 1150
  const baselineActual = { avgDamage: 80000, avgFrags: 0.8, winRate: 50.0 };
  const baselineExpected = { expectedDamage: 80000, expectedFrags: 0.8, expectedWinRate: 50.0 };
  const prBaseline = calculatePR(baselineActual, baselineExpected);
  assert(prBaseline === 1150, `PR at expected performance equals 1150 (got ${prBaseline})`);

  // Test 2: Zero performance -> PR = 0
  const zeroActual = { avgDamage: 0, avgFrags: 0, winRate: 0 };
  const prZero = calculatePR(zeroActual, baselineExpected);
  assert(prZero === 0, `PR at zero performance equals 0 (got ${prZero})`);

  // Test 3: Sub-floor ratios clamp to 0 without going negative
  const subFloorActual = { avgDamage: 20000, avgFrags: 0.05, winRate: 30.0 };
  // rDmg = 20k/80k = 0.25 < 0.4 -> nDmg = 0
  // rFrags = 0.05/0.8 = 0.0625 < 0.1 -> nFrags = 0
  // rWin = 30/50 = 0.6 < 0.7 -> nWin = 0
  const prSubFloor = calculatePR(subFloorActual, baselineExpected);
  assert(prSubFloor === 0, `Sub-floor ratios clamp to 0 -> PR = 0 (got ${prSubFloor})`);

  // Test 4: High unicum performance calculation
  // rDmg = 1.6, rFrags = 1.8, rWin = 1.3
  const unicumActual = { avgDamage: 128000, avgFrags: 1.44, winRate: 65.0 };
  const prUnicum = calculatePR(unicumActual, baselineExpected);
  // nDmg = (1.6 - 0.4)/0.6 = 2.0 -> 700 * 2.0 = 1400
  // nFrags = (1.8 - 0.1)/0.9 = 1.8889 -> 300 * 1.8889 = 566.67
  // nWin = (1.3 - 0.7)/0.3 = 2.0 -> 150 * 2.0 = 300
  // total = 1400 + 566.67 + 300 = 2266.67 -> 2267
  assert(prUnicum === 2267, `High unicum calculation matches expected 2267 (got ${prUnicum})`);

  // Test 5: PR Tier boundaries and color assignments
  const tiersTestCases = [
    { pr: 450, expectedId: 'below_average', expectedLabel: 'Below Average', expectedHex: '#FE0E00' },
    { pr: 749, expectedId: 'below_average', expectedLabel: 'Below Average', expectedHex: '#FE0E00' },
    { pr: 750, expectedId: 'average', expectedLabel: 'Average', expectedHex: '#FE7903' },
    { pr: 1099, expectedId: 'average', expectedLabel: 'Average', expectedHex: '#FE7903' },
    { pr: 1100, expectedId: 'good', expectedLabel: 'Good', expectedHex: '#FFC702' },
    { pr: 1349, expectedId: 'good', expectedLabel: 'Good', expectedHex: '#FFC702' },
    { pr: 1350, expectedId: 'very_good', expectedLabel: 'Very Good', expectedHex: '#44B300' },
    { pr: 1549, expectedId: 'very_good', expectedLabel: 'Very Good', expectedHex: '#44B300' },
    { pr: 1550, expectedId: 'great', expectedLabel: 'Great', expectedHex: '#02C9B3' },
    { pr: 1749, expectedId: 'great', expectedLabel: 'Great', expectedHex: '#02C9B3' },
    { pr: 1750, expectedId: 'unicum', expectedLabel: 'Unicum', expectedHex: '#D042F3' },
    { pr: 2099, expectedId: 'unicum', expectedLabel: 'Unicum', expectedHex: '#D042F3' },
    { pr: 2100, expectedId: 'super_unicum', expectedLabel: 'Super Unicum', expectedHex: '#A020F0' },
    { pr: 2800, expectedId: 'super_unicum', expectedLabel: 'Super Unicum', expectedHex: '#A020F0' },
  ];

  for (const tc of tiersTestCases) {
    const tier = getPRTier(tc.pr);
    assert(tier.id === tc.expectedId, `PR ${tc.pr} mapped to tier ID '${tc.expectedId}'`);
    assert(tier.label === tc.expectedLabel, `PR ${tc.pr} has label '${tc.expectedLabel}'`);
    assert(tier.hex === tc.expectedHex, `PR ${tc.pr} has hex color '${tc.expectedHex}'`);
    assert(getPRColor(tc.pr) === tc.expectedHex, `getPRColor(${tc.pr}) returns '${tc.expectedHex}'`);
  }

  assert(formatPR(1540) === '1,540', `formatPR(1540) formats with comma: '1,540'`);
  assert(formatPR(null) === '—', `formatPR(null) returns '—'`);

  // ----------------------------------------------------
  // Suite 4: Cross-Domain Acquisition Filtering in Server Statistics
  // ----------------------------------------------------
  console.log('\nSuite 4: Cross-Domain Acquisition Filtering in Server Statistics');

  const allShips = eu1Data.stats;

  // Filter 1: Coal ships
  const coalShips = allShips.filter((s) => matchesAcquisitionCategory(s.category, 'Coal'));
  assert(coalShips.length > 0, `Coal filter returns ${coalShips.length} ships`);
  assert(
    coalShips.every((s) => s.category === 'Coal'),
    'All ships under Coal filter strictly have category === Coal'
  );

  // Filter 2: Steel ships
  const steelShips = allShips.filter((s) => matchesAcquisitionCategory(s.category, 'Steel'));
  assert(steelShips.length > 0, `Steel filter returns ${steelShips.length} ships`);
  assert(
    steelShips.every((s) => s.category === 'Steel'),
    'All ships under Steel filter strictly have category === Steel'
  );

  // Filter 3: Research Bureau ships
  const rbShips = allShips.filter((s) => matchesAcquisitionCategory(s.category, 'Research Bureau'));
  assert(rbShips.length > 0, `Research Bureau filter returns ${rbShips.length} ships`);
  assert(
    rbShips.every((s) => s.category === 'Research Bureau'),
    'All ships under Research Bureau filter have category === Research Bureau'
  );

  // Filter 4: Dockyard ships
  const dockyardShips = allShips.filter((s) => matchesAcquisitionCategory(s.category, 'Dockyard'));
  assert(dockyardShips.length > 0, `Dockyard filter returns ${dockyardShips.length} ships`);
  assert(
    dockyardShips.every((s) => s.category === 'Dockyard'),
    'All ships under Dockyard filter have category === Dockyard'
  );

  // Filter 5: Tech Tree ships
  const ttShips = allShips.filter((s) => matchesAcquisitionCategory(s.category, 'Tech Tree'));
  assert(ttShips.length > 0, `Tech Tree filter returns ${ttShips.length} ships`);
  assert(
    ttShips.every((s) => s.category === 'Tech Tree'),
    'All ships under Tech Tree filter have category === Tech Tree'
  );

  // Filter 6: Removed ships
  const removedShips = allShips.filter((s) => matchesAcquisitionCategory(s.category, 'Removed'));
  assert(removedShips.length > 0, `Removed filter returns ${removedShips.length} ships`);
  assert(
    removedShips.every((s) => s.category === 'Removed'),
    'All ships under Removed filter have category === Removed'
  );

  // Filter 7: Doubloons matching
  assert(matchesAcquisitionCategory('Doubloon', 'Doubloons'), `matchesAcquisitionCategory matches 'Doubloon' to 'Doubloons'`);
  assert(matchesAcquisitionCategory('Doubloons', 'Doubloon'), `matchesAcquisitionCategory matches 'Doubloons' to 'Doubloon'`);

  // Compound cross-domain query: "Top performing Coal cruisers on EU (last 3 updates)"
  const eu3Path = path.join(STATS_DIR, 'stats-eu-3.json');
  const eu3Data = JSON.parse(fs.readFileSync(eu3Path, 'utf8'));
  const eu3CoalCruisers = eu3Data.stats.filter(
    (s) => matchesAcquisitionCategory(s.category, 'Coal') && s.class === 'Cruiser' && s.tier === 10
  );
  assert(
    eu3CoalCruisers.length > 0,
    `Query 'Tier X Coal cruisers on EU (3 updates)' returned ${eu3CoalCruisers.length} ships`
  );
  // Sort by winRate descending
  eu3CoalCruisers.sort((a, b) => b.winRate - a.winRate);
  assert(
    eu3CoalCruisers[0].winRate >= eu3CoalCruisers[eu3CoalCruisers.length - 1].winRate,
    `Top performing Coal cruiser '${eu3CoalCruisers[0].dispName}' has highest WR: ${eu3CoalCruisers[0].winRate}%`
  );

  // ----------------------------------------------------
  // Suite 5: Frontend Component & Store Integration Verification
  // ----------------------------------------------------
  console.log('\nSuite 5: Frontend Component & Store Integration Verification');

  // Verify useStatsStore.ts
  const statsStorePath = path.join(SRC_DIR, 'stores/useStatsStore.ts');
  assert(fs.existsSync(statsStorePath), 'src/stores/useStatsStore.ts exists');
  const statsStoreContent = fs.readFileSync(statsStorePath, 'utf8');
  assert(statsStoreContent.includes('export const useStatsStore'), 'useStatsStore hook is exported');
  assert(statsStoreContent.includes('computeAggregateMetrics'), 'computeAggregateMetrics is exported');
  assert(statsStoreContent.includes('normalizeServer'), 'normalizeServer is exported');
  assert(statsStoreContent.includes('matchesAcquisitionCategory'), 'matchesAcquisitionCategory is exported');

  // Verify normalizeServer
  assert(normalizeServer('na') === 'com', `normalizeServer('na') maps to 'com'`);
  assert(normalizeServer('US') === 'com', `normalizeServer('US') maps to 'com'`);
  assert(normalizeServer('eu') === 'eu', `normalizeServer('eu') maps to 'eu'`);
  assert(normalizeServer('asia') === 'asia', `normalizeServer('asia') maps to 'asia'`);

  // Verify prCalculator.ts
  const prCalcPath = path.join(SRC_DIR, 'utils/prCalculator.ts');
  assert(fs.existsSync(prCalcPath), 'src/utils/prCalculator.ts exists');
  const prCalcContent = fs.readFileSync(prCalcPath, 'utf8');
  assert(prCalcContent.includes('export function calculatePR'), 'calculatePR is exported');
  assert(prCalcContent.includes('export function getPRTier'), 'getPRTier is exported');
  assert(prCalcContent.includes('export function getPRColor'), 'getPRColor is exported');
  assert(prCalcContent.includes('export const PR_TIERS'), 'PR_TIERS is exported');

  // Verify ServerStatsView.tsx
  const serverStatsViewPath = path.join(SRC_DIR, 'views/ServerStatsView.tsx');
  assert(fs.existsSync(serverStatsViewPath), 'src/views/ServerStatsView.tsx exists');
  const serverStatsViewContent = fs.readFileSync(serverStatsViewPath, 'utf8');
  assert(serverStatsViewContent.includes('ServerStatsView'), 'ServerStatsView component exported');
  assert(serverStatsViewContent.includes('SERVER_OPTIONS'), 'ServerStatsView defines server selection');
  assert(serverStatsViewContent.includes('SPAN_OPTIONS'), 'ServerStatsView defines timespan selection');
  assert(serverStatsViewContent.includes('BRACKET_OPTIONS'), 'ServerStatsView defines skill bracket selection');
  assert(serverStatsViewContent.includes('ACQUISITION_PILLS'), 'ServerStatsView defines acquisition pills');
  assert(serverStatsViewContent.includes('useVirtualizer'), 'ServerStatsView uses TanStack Virtual for 60fps rendering');
  assert(serverStatsViewContent.includes('AcquisitionBadge'), 'ServerStatsView renders AcquisitionBadge in pinned column');

  console.log('\n====================================================');
  console.log(`  Phase 5 Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('[FATAL] Phase 5 verification suite crashed:', err);
  process.exit(1);
});
