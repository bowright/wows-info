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

async function runVerification() {
  console.log('====================================================');
  console.log('  WoWs-Info Shiptool Column & Survivability Audit   ');
  console.log('  (Alignment with shiptool.st p=SRV & Headers)      ');
  console.log('====================================================\n');

  // --- Suite 1: Catalog Ingestion & Survivability Schema ---
  console.log('Suite 1: Catalog Ingestion & Survivability Schema');
  const catalogPath = path.join(PUBLIC_DATA, 'catalog.json');
  assert(fs.existsSync(catalogPath), 'catalog.json exists');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert(catalog.length === 993, `Catalog contains all 993 ships (got ${catalog.length})`);

  const survivabilityKeys = [
    'repairPct',
    'citadelRepairPct',
    'fireResistance',
    'fireDuration',
    'fireDamage',
    'noOfFires',
    'torpedoProtection',
    'floodingDuration',
    'floodingDamage',
    'noOfFloodings'
  ];

  for (const key of survivabilityKeys) {
    const hasField = catalog.every((s) => key in s);
    assert(hasField, `Every ship has field '${key}' in catalog.json`);
  }

  // --- Suite 2: Authentic Shiptool Values Across Archetypes ---
  console.log('\nSuite 2: Authentic Values Across Archetypes');

  // 1. Conqueror (British BB with 75% Superheal)
  const conqueror = catalog.find((s) => s.dispName === 'Conqueror');
  assert(Boolean(conqueror), 'Conqueror found in catalog');
  assert(conqueror.repairPct === 75, `Conqueror Repair % is 75% superheal (got ${conqueror.repairPct}%)`);
  assert(conqueror.citadelRepairPct === 10, `Conqueror Citadel repair % is 10% (got ${conqueror.citadelRepairPct}%)`);
  assert(conqueror.torpedoProtection === 28, `Conqueror Torpedo protection is 28% (got ${conqueror.torpedoProtection}%)`);
  assert(conqueror.fireDuration === 60, `Conqueror Fire duration is 60s (got ${conqueror.fireDuration}s)`);
  assert(conqueror.fireDamage === 18, `Conqueror Fire damage is 18% (got ${conqueror.fireDamage}%)`);

  // 2. Minotaur (British Light Cruiser with 50% Citadel Heal)
  const minotaur = catalog.find((s) => s.dispName === 'Minotaur');
  assert(Boolean(minotaur), 'Minotaur found in catalog');
  assert(minotaur.repairPct === 50, `Minotaur Repair % is 50% (got ${minotaur.repairPct}%)`);
  assert(minotaur.citadelRepairPct === 50, `Minotaur Citadel repair % is 50% (got ${minotaur.citadelRepairPct}%)`);
  assert(minotaur.torpedoProtection === 13, `Minotaur Torpedo protection is 13% (got ${minotaur.torpedoProtection}%)`);
  assert(minotaur.fireDuration === 30, `Minotaur Fire duration is 30s (got ${minotaur.fireDuration}s)`);

  // 3. Des Moines (US Heavy Cruiser with 33% Citadel Heal)
  const desMoines = catalog.find((s) => s.dispName === 'Des Moines');
  assert(Boolean(desMoines), 'Des Moines found in catalog');
  assert(desMoines.repairPct === 50, `Des Moines Repair % is 50% (got ${desMoines.repairPct}%)`);
  assert(desMoines.citadelRepairPct === 33, `Des Moines Citadel repair % is 33% (got ${desMoines.citadelRepairPct}%)`);
  assert(desMoines.torpedoProtection === 7, `Des Moines Torpedo protection is 7% (got ${desMoines.torpedoProtection}%)`);
  assert(desMoines.fireDuration === 30, `Des Moines Fire duration is 30s (got ${desMoines.fireDuration}s)`);
  assert(desMoines.fireDamage === 9, `Des Moines Fire damage is 9% (got ${desMoines.fireDamage}%)`);

  // 4. Iowa (US Battleship with 10% Citadel Heal and 25% Torp Prot)
  const iowa = catalog.find((s) => s.dispName === 'Iowa');
  assert(Boolean(iowa), 'Iowa found in catalog');
  assert(iowa.repairPct === 50, `Iowa Repair % is 50% (got ${iowa.repairPct}%)`);
  assert(iowa.citadelRepairPct === 10, `Iowa Citadel repair % is 10% (got ${iowa.citadelRepairPct}%)`);
  assert(iowa.torpedoProtection === 25, `Iowa Torpedo protection is 25% (got ${iowa.torpedoProtection}%)`);
  assert(iowa.fireDuration === 60, `Iowa Fire duration is 60s (got ${iowa.fireDuration}s)`);

  // 5. Yamato (Japanese Battleship with 55% Torp Prot)
  const yamato = catalog.find((s) => s.dispName === 'Yamato');
  assert(Boolean(yamato), 'Yamato found in catalog');
  assert(yamato.torpedoProtection === 55, `Yamato Torpedo protection is 55% (got ${yamato.torpedoProtection}%)`);
  assert(yamato.citadelRepairPct === 10, `Yamato Citadel repair % is 10% (got ${yamato.citadelRepairPct}%)`);

  // 6. Shimakaze (Destroyer with No Citadel -> null citadelRepairPct)
  const shimakaze = catalog.find((s) => s.dispName === 'Shimakaze');
  assert(Boolean(shimakaze), 'Shimakaze found in catalog');
  assert(shimakaze.citadelRepairPct === null, 'Shimakaze Citadel repair % is strictly null (no citadel)');
  assert(shimakaze.torpedoProtection === 0, `Shimakaze Torpedo protection is 0% (got ${shimakaze.torpedoProtection}%)`);
  assert(shimakaze.repairPct === 50, `Shimakaze Repair % is 50% (got ${shimakaze.repairPct}%)`);
  assert(shimakaze.fireDuration === 30, `Shimakaze Fire duration is 30s (got ${shimakaze.fireDuration}s)`);

  // --- Suite 3: Build Modifiers on Survivability Timers ---
  console.log('\nSuite 3: Build Modifiers on Survivability');

  // India Yankee signal (-20% fire burn time)
  const iowaWithIY = calcModifiedStats(iowa, { signals: { indiaYankee: true } });
  assert(iowaWithIY.fireDuration === 48, `India Yankee reduces Iowa fire duration from 60s to 48s (got ${iowaWithIY.fireDuration}s)`);
  assert(iowaWithIY.burnTime === 48, `Iowa burnTime equals 48s`);

  // Juliet Yankee Bissotwo signal (-20% flood time)
  const iowaWithJYB = calcModifiedStats(iowa, { signals: { julietYankeeBissotwo: true } });
  assert(iowaWithJYB.floodingDuration === 32, `Juliet Yankee Bissotwo reduces Iowa flood duration from 40s to 32s (got ${iowaWithJYB.floodingDuration}s)`);

  // Damage Control Mod 2 (-15% fire and flood time)
  const iowaWithDCM2 = calcModifiedStats(iowa, { upgrades: { slot4: 'dcmod2' } });
  assert(iowaWithDCM2.fireDuration === 51, `DCM2 reduces Iowa fire duration from 60s to 51s (got ${iowaWithDCM2.fireDuration}s)`);
  assert(iowaWithDCM2.floodingDuration === 34, `DCM2 reduces Iowa flood duration from 40s to 34s (got ${iowaWithDCM2.floodingDuration}s)`);

  // Compound: India Yankee + Damage Control Mod 2 (60 * 0.80 * 0.85 = 40.8s)
  const iowaCompound = calcModifiedStats(iowa, {
    upgrades: { slot4: 'dcmod2' },
    signals: { indiaYankee: true }
  });
  assert(iowaCompound.fireDuration === 40.8, `Compound DCM2 + IY gives exact 40.8s fire duration (got ${iowaCompound.fireDuration}s)`);

  // Des Moines with India Yankee (30 * 0.8 = 24s)
  const dmWithIY = calcModifiedStats(desMoines, { signals: { indiaYankee: true } });
  assert(dmWithIY.fireDuration === 24, `India Yankee on Des Moines gives exact 24s fire duration (got ${dmWithIY.fireDuration}s)`);

  // Verify non-timer survivability fields pass through unchanged
  assert(iowaCompound.repairPct === 50, 'Iowa repairPct preserved under modifiers');
  assert(iowaCompound.citadelRepairPct === 10, 'Iowa citadelRepairPct preserved under modifiers');
  assert(iowaCompound.torpedoProtection === 25, 'Iowa torpedoProtection preserved under modifiers');

  // --- Suite 4: VirtualizedTable Column Headers Alignment ---
  console.log('\nSuite 4: VirtualizedTable Column Headers Alignment');
  const tableFilePath = path.join(SRC_DIR, 'components/table/VirtualizedTable.tsx');
  const tableContent = fs.readFileSync(tableFilePath, 'utf8');

  // Check Shiptool exact column names in table definition
  const expectedHeaders = [
    // General
    "'Health'",
    "'Max speed'",
    "'Rudder shift'",
    "'Turning radius'",
    "'Detect. by sea'",
    "'Detect. by air'",
    "'Smoke firing detect.'",
    // Survivability (p=SRV)
    "'Repair %'",
    "'Citadel repair %'",
    "'Fire resistance'",
    "'Fire duration'",
    "'Fire damage'",
    "'No of fires'",
    "'Torpedo protection'",
    "'Flooding duration'",
    "'Flooding damage'",
    "'No of floodings'",
    // Artillery
    "'180° turn'",
    "'Fire chance'",
    "'Horiz. dispersion'",
    "'Vert. dispersion'",
    // AA
    "'Flak count'"
  ];

  for (const h of expectedHeaders) {
    const present = tableContent.includes(h);
    assert(present, `VirtualizedTable includes authentic shiptool header ${h}`);
  }

  // --- Suite 5: Code-Split Details Persistence ---
  console.log('\nSuite 5: Code-Split Details Files');
  const sampleDetails = [
    conqueror.id,
    minotaur.id,
    desMoines.id,
    iowa.id,
    yamato.id,
    shimakaze.id
  ];

  for (const id of sampleDetails) {
    const detailPath = path.join(PUBLIC_DATA, 'details', `${id}.json`);
    assert(fs.existsSync(detailPath), `Detail file exists for ship ID ${id}`);
    const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
    assert(detail.repairPct != null, `Detail ${id} (${detail.dispName}) has repairPct`);
    assert(detail.torpedoProtection != null, `Detail ${id} (${detail.dispName}) has torpedoProtection`);
  }

  console.log('\n====================================================');
  console.log(`  Shiptool Alignment Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
