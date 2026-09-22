import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calcModifiedStats } from './modifiers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DATA = path.resolve(__dirname, '../public/data');
const DETAILS_DIR = path.join(PUBLIC_DATA, 'details');

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
  console.log('====================================================');
  console.log('  WoWs-Info Phase 2 Verification Suite              ');
  console.log('  (Ballistics, Modifiers, AA/ASW & Consumables)     ');
  console.log('====================================================\n');

  // Load catalog.json
  const catalogPath = path.join(PUBLIC_DATA, 'catalog.json');
  assert(fs.existsSync(catalogPath), 'catalog.json exists in public/data/');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  // --- Suite 1: Consumables Pipeline Ingestion ---
  console.log('Suite 1: Consumables Pipeline Ingestion');
  
  // Iowa consumables
  const iowa = catalog.find(s => s.name === 'PASB018_Iowa_1944');
  assert(Boolean(iowa), 'Found Iowa in catalog');
  const iowaDetail = JSON.parse(fs.readFileSync(path.join(DETAILS_DIR, `${iowa.id}.json`), 'utf8'));
  assert(Array.isArray(iowaDetail.consumables) && iowaDetail.consumables.length >= 3, `Iowa has >= 3 consumables (found ${iowaDetail.consumables?.length})`);
  
  const iowaDcp = iowaDetail.consumables.find(c => c.type === 'crashCrew');
  assert(Boolean(iowaDcp), 'Iowa has Damage Control Party consumable');
  assert(iowaDcp?.reloadTime === 80, `Iowa Damage Control Party reload time is 80s (found ${iowaDcp?.reloadTime}s)`);
  assert(iowaDcp?.workTime === 20, `Iowa Damage Control Party work time is 20s (found ${iowaDcp?.workTime}s)`);
  assert(iowaDcp?.numConsumables === -1, 'Iowa Damage Control Party has unlimited charges (-1)');

  const iowaHeal = iowaDetail.consumables.find(c => c.type === 'regenCrew');
  assert(Boolean(iowaHeal), 'Iowa has Repair Party consumable');
  assert(iowaHeal?.numConsumables === 4, `Iowa Repair Party has 4 charges (found ${iowaHeal?.numConsumables})`);

  // Des Moines consumables
  const desMoines = catalog.find(s => s.name === 'PASC020_Des_Moines_1948');
  assert(Boolean(desMoines), 'Found Des Moines in catalog');
  const dmDetail = JSON.parse(fs.readFileSync(path.join(DETAILS_DIR, `${desMoines.id}.json`), 'utf8'));
  assert(Array.isArray(dmDetail.consumables) && dmDetail.consumables.length >= 5, `Des Moines has >= 5 consumables across slots (found ${dmDetail.consumables?.length})`);
  const dmRadar = dmDetail.consumables.find(c => c.type === 'rls');
  assert(Boolean(dmRadar), 'Des Moines has Surveillance Radar consumable');
  assert(dmRadar?.workTime === 35, `Des Moines Radar work time is 35s (found ${dmRadar?.workTime}s)`);

  // Shimakaze consumables
  const shimakaze = catalog.find(s => s.name === 'PJSD012_Shimakaze_1943');
  assert(Boolean(shimakaze), 'Found Shimakaze in catalog');
  const shimaDetail = JSON.parse(fs.readFileSync(path.join(DETAILS_DIR, `${shimakaze.id}.json`), 'utf8'));
  assert(Array.isArray(shimaDetail.consumables) && shimaDetail.consumables.length >= 3, `Shimakaze has >= 3 consumables (found ${shimaDetail.consumables?.length})`);
  const shimaSmoke = shimaDetail.consumables.find(c => c.type === 'smokeGenerator');
  assert(Boolean(shimaSmoke), 'Shimakaze has Smoke Generator consumable');

  // Breadth verification: over 900 armed ships have consumables resolved
  let shipsWithConsumables = 0;
  for (const s of catalog) {
    const dPath = path.join(DETAILS_DIR, `${s.id}.json`);
    if (fs.existsSync(dPath)) {
      const d = JSON.parse(fs.readFileSync(dPath, 'utf8'));
      if (Array.isArray(d.consumables) && d.consumables.length > 0) {
        shipsWithConsumables++;
      }
    }
  }
  assert(shipsWithConsumables >= 900, `Over 900 ships have resolved consumables (found ${shipsWithConsumables} / 993)`);

  // --- Suite 2: AA Defense Extraction ---
  console.log('\nSuite 2: AA Defense Extraction');
  assert(iowaDetail.aa != null, 'Iowa has AA defense object in details');
  assert(iowaDetail.aa?.totalDps >= 1000, `Iowa continuous AA DPS is >= 1,000 (found ${iowaDetail.aa?.totalDps})`);
  assert(iowaDetail.aa?.maxRange === 5.8, `Iowa max AA range is 5.8 km (found ${iowaDetail.aa?.maxRange} km)`);
  assert(iowaDetail.aa?.flakCount === 8, `Iowa flak burst count is 8 (found ${iowaDetail.aa?.flakCount})`);
  assert(iowaDetail.aa?.flakDamage === 1610, `Iowa flak damage is 1,610 (found ${iowaDetail.aa?.flakDamage})`);

  assert(dmDetail.aa != null, 'Des Moines has AA defense object in details');
  assert(dmDetail.aa?.totalDps >= 600, `Des Moines continuous AA DPS is >= 600 (found ${dmDetail.aa?.totalDps})`);
  assert(dmDetail.aa?.flakCount === 5, `Des Moines flak burst count is 5 (found ${dmDetail.aa?.flakCount})`);
  assert(dmDetail.aa?.flakDamage === 1680, `Des Moines flak damage is 1,680 (found ${dmDetail.aa?.flakDamage})`);

  const halland = catalog.find(s => s.name === 'PWSD110_Halland');
  assert(Boolean(halland), 'Found Halland in catalog');
  const hallandDetail = JSON.parse(fs.readFileSync(path.join(DETAILS_DIR, `${halland.id}.json`), 'utf8'));
  assert(hallandDetail.aa?.maxRange === 6.0, `Halland max AA range is 6.0 km (found ${hallandDetail.aa?.maxRange} km)`);
  assert(hallandDetail.aa?.totalDps >= 400, `Halland continuous AA DPS is >= 400 (found ${hallandDetail.aa?.totalDps})`);

  // --- Suite 3: ASW Armament Extraction ---
  console.log('\nSuite 3: ASW Armament Extraction');
  assert(iowaDetail.asw != null, 'Iowa has ASW data');
  assert(iowaDetail.asw?.type === 'airstrike', 'Iowa ASW type is airstrike');
  assert(iowaDetail.asw?.rangeKm === 10.0, `Iowa ASW airstrike range is 10.0 km (found ${iowaDetail.asw?.rangeKm} km)`);
  assert(iowaDetail.asw?.reloadTime === 30, `Iowa ASW airstrike reload time is 30s (found ${iowaDetail.asw?.reloadTime}s)`);
  assert(iowaDetail.asw?.flightTime === 15.0, `Iowa ASW airstrike flight time is 15.0s (found ${iowaDetail.asw?.flightTime}s)`);
  assert(iowaDetail.asw?.payloadCount === 2, `Iowa ASW airstrike payload count is 2 (found ${iowaDetail.asw?.payloadCount})`);
  assert(iowaDetail.asw?.bombDamage === 4200, `Iowa ASW bomb damage is 4,200 (found ${iowaDetail.asw?.bombDamage})`);

  assert(dmDetail.asw?.rangeKm === 8.0, `Des Moines ASW airstrike range is 8.0 km (found ${dmDetail.asw?.rangeKm} km)`);
  assert(dmDetail.asw?.bombDamage === 4900, `Des Moines ASW bomb damage is 4,900 (found ${dmDetail.asw?.bombDamage})`);

  assert(shimaDetail.asw != null, 'Shimakaze has ASW data');
  assert(shimaDetail.asw?.type === 'depth_charges', 'Shimakaze ASW type is depth_charges');
  assert(shimaDetail.asw?.reloadTime === 40, `Shimakaze depth charge reload time is 40s (found ${shimaDetail.asw?.reloadTime}s)`);

  // --- Suite 4: Promoted Key Scalar Columns in catalog.json ---
  console.log('\nSuite 4: Promoted Key Scalar Columns in catalog.json');
  assert(iowa.traverse180 === 45, `Iowa traverse180 promoted to catalog.json (found ${iowa.traverse180}s)`);
  assert(iowa.horizontalDispersion === 294, `Iowa horizontalDispersion promoted (found ${iowa.horizontalDispersion}m)`);
  assert(iowa.verticalDispersion === 176, `Iowa verticalDispersion promoted (found ${iowa.verticalDispersion}m)`);
  assert(iowa.heAlpha === 5700, `Iowa heAlpha promoted (found ${iowa.heAlpha})`);
  assert(iowa.apAlpha === 13500, `Iowa apAlpha promoted (found ${iowa.apAlpha})`);
  assert(iowa.aaRange === 5.8, `Iowa aaRange promoted (found ${iowa.aaRange} km)`);
  assert(iowa.aaDps === 1033, `Iowa aaDps promoted (found ${iowa.aaDps})`);
  assert(iowa.flakCount === 8, `Iowa flakCount promoted (found ${iowa.flakCount})`);
  assert(iowa.aswRange === 10, `Iowa aswRange promoted (found ${iowa.aswRange} km)`);
  assert(iowa.smokePenalty != null && iowa.smokePenalty > 0, `Iowa smokePenalty promoted (found ${iowa.smokePenalty} km)`);

  assert(shimakaze.torpedoDetect === 1.8, `Shimakaze torpedoDetect promoted to catalog.json (found ${shimakaze.torpedoDetect} km)`);
  assert(desMoines.sapAlpha === null, 'Des Moines sapAlpha correctly null (no SAP)');

  // Verify non-zero counts across catalog
  let hasHorizDisp = 0, hasTraverse = 0, hasAaDps = 0, hasAswRange = 0;
  for (const s of catalog) {
    if (s.horizontalDispersion != null && s.horizontalDispersion > 0) hasHorizDisp++;
    if (s.traverse180 != null && s.traverse180 > 0) hasTraverse++;
    if (s.aaDps != null && s.aaDps > 0) hasAaDps++;
    if (s.aswRange != null && s.aswRange > 0) hasAswRange++;
  }
  assert(hasHorizDisp >= 700, `At least 700 ships have horizontalDispersion (found ${hasHorizDisp})`);
  assert(hasTraverse >= 700, `At least 700 ships have traverse180 (found ${hasTraverse})`);
  assert(hasAaDps >= 900, `At least 900 ships have aaDps (found ${hasAaDps})`);
  assert(hasAswRange >= 500, `At least 500 ships have aswRange (found ${hasAswRange})`);

  // --- Suite 5: Dynamic Build Modifier Engine ---
  console.log('\nSuite 5: Dynamic Build Modifier Engine');

  // Test 1: CE + CSM1 on Iowa reduces 15.7 km detectability to 12.72 km (exact compound 0.81 multiplier)
  const iowaConcealmentTest = { ...iowa, concealmentSurface: 15.7 };
  const modCeCsm1 = calcModifiedStats(iowaConcealmentTest, {
    upgrades: { slot5: 'csm1' },
    skills: { concealmentExpert: true }
  });
  assert(
    modCeCsm1.concealmentSurface === 12.72,
    `CE + CSM1 on Iowa reduces 15.7 km detectability to 12.72 km (exact compound 0.81 multiplier, got ${modCeCsm1.concealmentSurface})`
  );

  // Test 2: Main Battery Mod 3 reduces 30.0s reload to 26.4s (-12%)
  const reloadBaseShip = { artillery: { reload: 30.0, totalBarrels: 9, heAlpha: 5000, apAlpha: 10000 } };
  const modMbm3 = calcModifiedStats(reloadBaseShip, {
    upgrades: { slot6: 'mbm3' }
  });
  assert(
    modMbm3.artillery?.reload === 26.4,
    `Main Battery Mod 3 reduces 30.0s reload to 26.4s (-12%, got ${modMbm3.artillery?.reload}s)`
  );

  // Test 3: Sierra Mike signal boosts 33.0 kts speed to 34.65 kts (+5%)
  const speedBaseShip = { speed: 33.0 };
  const modSm = calcModifiedStats(speedBaseShip, {
    signals: { sierraMike: true }
  });
  assert(
    modSm.speed === 34.65,
    `Sierra Mike signal boosts 33.0 kts speed to 34.65 kts (+5%, got ${modSm.speed} kts)`
  );

  // Test 4: Adrenaline Rush at 50% HP grants 10% reload buff
  const arBaseShip = { artillery: { reload: 30.0, totalBarrels: 9, heAlpha: 5000, apAlpha: 10000 } };
  const modAr50 = calcModifiedStats(arBaseShip, {
    skills: { adrenalineRush: true, hpLostPercent: 50 }
  });
  assert(
    modAr50.artillery?.reload === 27.0,
    `Adrenaline Rush at 50% HP grants 10% reload buff: 30.0s -> 27.0s (got ${modAr50.artillery?.reload}s)`
  );

  // Test 5: Aiming Systems Mod 1 reduces dispersion by -7%
  const dispBaseShip = { horizontalDispersion: 200, verticalDispersion: 120 };
  const modAsm1 = calcModifiedStats(dispBaseShip, {
    upgrades: { slot3: 'asm1' }
  });
  assert(
    modAsm1.horizontalDispersion === 186,
    `Aiming Systems Mod 1 reduces 200m dispersion to 186m (-7%, got ${modAsm1.horizontalDispersion}m)`
  );

  // Test 6: Superintendent adds +1 charge to ship consumables
  const consumableTestShip = {
    consumables: [
      { key: 'heal', numConsumables: 3, workTime: 28 },
      { key: 'dcp', numConsumables: -1, workTime: 20 }
    ]
  };
  const modSi = calcModifiedStats(consumableTestShip, {
    skills: { superintendent: true }
  });
  assert(
    modSi.consumables?.[0].numConsumables === 4,
    `Superintendent increases repair party charges from 3 to 4 (got ${modSi.consumables?.[0].numConsumables})`
  );
  assert(
    modSi.consumables?.[1].numConsumables === -1,
    'Superintendent leaves unlimited charges (-1) unchanged'
  );

  // Test 7: Compound full build test
  const fullBuildShip = {
    class: 'Battleship',
    tier: 9,
    speed: 33.0,
    concealmentSurface: 15.7,
    artillery: { reload: 30.0, totalBarrels: 9, heAlpha: 5700, apAlpha: 13500, rangeKm: 23.35, traverse180: 45.0 }
  };
  const fullModified = calcModifiedStats(fullBuildShip, {
    upgrades: {
      slot1: 'mam1',
      slot2: 'dcm1',
      slot3: 'asm1',
      slot4: 'sgm1',
      slot5: 'csm1',
      slot6: 'mbm3'
    },
    skills: {
      concealmentExpert: true,
      adrenalineRush: true,
      hpLostPercent: 50,
      survivabilityExpert: true
    },
    signals: {
      sierraMike: true,
      indiaYankee: true,
      julietYankeeBissotwo: true
    }
  });
  assert(fullModified.modifiersApplied.length >= 8, `Full build applied ${fullModified.modifiersApplied.length} active modifier records`);
  assert(fullModified.speed === 34.65, `Speed correctly modified to 34.65 kts`);
  assert(fullModified.concealmentSurface === 12.72, `Concealment correctly compound-multiplied to 12.72 km`);
  // 30.0 * 0.88 (MBM3) * 0.90 (AR 50%) = 23.76s
  assert(fullModified.artillery?.reload === 23.76, `Compound reload is 23.76s (got ${fullModified.artillery?.reload}s)`);

  console.log('\n====================================================');
  console.log(`  Phase 2 Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('[FATAL] Phase 2 verification crashed:', err);
  process.exit(1);
});
