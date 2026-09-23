import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calcModifiedStats } from './modifiers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DATA = path.resolve(__dirname, '../public/data');
const IMAGES_DIR = path.resolve(__dirname, '../public/images/consumables');
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
  console.log('  WoWs-Info Consumables Verification Audit          ');
  console.log('  (Alignment with shiptool.st p=CON & Headers)      ');
  console.log('====================================================\n');

  // --- Suite 1: Consumable Icons Assets ---
  console.log('Suite 1: Consumable Icons Assets');
  assert(fs.existsSync(IMAGES_DIR), 'public/images/consumables directory exists');
  const iconFiles = fs.readdirSync(IMAGES_DIR);
  assert(iconFiles.length >= 41, `Found >= 41 consumable icons (got ${iconFiles.length})`);

  const expectedIcons = [
    'consumable_PCY009_CrashCrewPremium.png',
    'consumable_PCY010_RegenCrewPremium.png',
    'consumable_PCY010_RegenCrew_Eheal_Premium.png',
    'consumable_PCY014_SmokeGeneratorPremium.png',
    'consumable_PCY015_SpeedBoosterPremium.png',
    'consumable_PCY016_SonarSearchPremium.png',
    'consumable_PCY018_TorpedoReloaderPremium.png',
    'consumable_PCY020_RLSSearchPremium.png',
    'consumable_PCY022_ArtilleryBoosterPremium.png',
    'consumable_PCY045_Hydrophone.png',
    'consumable_PCY046_FastDeepRudders.png',
    'consumable_PCY047_SubmarineEnergyFreeze.png',
    'consumable_PCY048_SubmarineLocator.png',
    'consumable_PCY087_AuxiliaryTorpedoArmamentBooster.png',
    'stopwatch.png'
  ];

  for (const icon of expectedIcons) {
    const iconPath = path.join(IMAGES_DIR, icon);
    const exists = fs.existsSync(iconPath) && fs.statSync(iconPath).size > 0;
    assert(exists, `Icon '${icon}' exists and is non-empty`);
  }

  // --- Suite 2: Catalog Ingestion & Consumables Schema ---
  console.log('\nSuite 2: Catalog Ingestion & Consumables Schema');
  const catalogPath = path.join(PUBLIC_DATA, 'catalog.json');
  assert(fs.existsSync(catalogPath), 'catalog.json exists');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert(catalog.length === 993, `Catalog contains all 993 ships (got ${catalog.length})`);

  let shipsWithConsumables = 0;
  for (const s of catalog) {
    if (Array.isArray(s.consumables) && s.consumables.length > 0) {
      shipsWithConsumables++;
      for (const c of s.consumables) {
        if (!c.iconKey) {
          throw new Error(`Ship ${s.dispName} has consumable ${c.name} without iconKey`);
        }
      }
    }
  }
  assert(shipsWithConsumables >= 900, `Over 900 ships have resolved consumables in catalog (found ${shipsWithConsumables})`);

  // --- Suite 3: Authentic Values Across Archetypes (Tier 8 Cruiser parity) ---
  console.log('\nSuite 3: Authentic Values Across Archetypes');

  // Baltimore (Tier 8 Cruiser matching user request)
  const baltimore = catalog.find((s) => s.dispName === 'Baltimore');
  assert(Boolean(baltimore), 'Baltimore found in catalog');
  assert(baltimore.tier === 8, 'Baltimore is Tier 8');
  assert(baltimore.class === 'Cruiser', 'Baltimore is a Cruiser');

  const bRadar = baltimore.consumables.find((c) => c.type === 'rls');
  assert(Boolean(bRadar), 'Baltimore has Surveillance Radar');
  assert(bRadar.workTime === 25, `Baltimore Radar duration is 25s (got ${bRadar.workTime}s)`);
  assert(Math.round(bRadar.logic.distShip * 0.03 * 10) / 10 === 10.0, `Baltimore Radar range is 10.0 km`);
  assert(bRadar.numConsumables === 3, `Baltimore Radar has 3 charges`);

  const bHydro = baltimore.consumables.find((c) => c.type === 'sonar');
  assert(Boolean(bHydro), 'Baltimore has Hydroacoustic Search');
  assert(Math.round(bHydro.logic.distShip * 0.03 * 10) / 10 === 5.0, `Baltimore Hydro ship detect is 5.0 km`);
  assert(Math.round(bHydro.logic.distTorpedo * 0.03 * 10) / 10 === 3.5, `Baltimore Hydro torpedo detect is 3.5 km`);

  const bRepair = baltimore.consumables.find((c) => c.type === 'regenCrew');
  assert(Boolean(bRepair), 'Baltimore has Repair Party');
  const bHealPct = Math.round(bRepair.workTime * bRepair.logic.regenerationHPSpeed * 1000) / 10;
  assert(bHealPct === 14.0, `Baltimore Repair Party heals 14.0% HP (got ${bHealPct}%)`);

  // Conqueror (British Battleship with Superheal)
  const conqueror = catalog.find((s) => s.dispName === 'Conqueror');
  assert(Boolean(conqueror), 'Conqueror found in catalog');
  const cHeal = conqueror.consumables.find((c) => c.type === 'regenCrew');
  assert(Boolean(cHeal), 'Conqueror has Specialized Repair Teams');
  const cHealPct = Math.round(cHeal.workTime * cHeal.logic.regenerationHPSpeed * 1000) / 10;
  assert(cHealPct === 40.0, `Conqueror Specialized Repair Teams heals 40.0% HP (got ${cHealPct}%)`);

  // Shimakaze (Tier 10 Destroyer with Smoke & Engine Boost)
  const shimakaze = catalog.find((s) => s.dispName === 'Shimakaze');
  assert(Boolean(shimakaze), 'Shimakaze found in catalog');
  const sSmoke = shimakaze.consumables.find((c) => c.type === 'smokeGenerator');
  assert(Boolean(sSmoke), 'Shimakaze has Smoke Generator');
  assert(sSmoke.logic.lifeTime === 97, `Shimakaze Smoke lifetime is 97s (got ${sSmoke.logic.lifeTime}s)`);
  assert(Math.round(sSmoke.logic.radius * 30) === 450, `Shimakaze Smoke radius is 450m`);

  // --- Suite 4: Build Modifiers on Consumables ---
  console.log('\nSuite 4: Build Modifiers on Consumables');

  // Superintendent (+1 charge on consumables with numConsumables > 0)
  const baltimoreSI = calcModifiedStats(baltimore, { skills: { superintendent: true } });
  const bRadarSI = baltimoreSI.consumables.find((c) => c.type === 'rls');
  assert(bRadarSI.numConsumables === 4, `Superintendent increases Baltimore Radar charges from 3 to 4 (got ${bRadarSI.numConsumables})`);

  const bDcpSI = baltimoreSI.consumables.find((c) => c.type === 'crashCrew');
  assert(bDcpSI.numConsumables === -1, `Superintendent leaves infinite Damage Control charges at -1 (got ${bDcpSI.numConsumables})`);

  // Ship Consumables Mod 1 (+10% duration)
  const baltimoreSCM1 = calcModifiedStats(baltimore, { upgrades: { slot5: 'scm1' } });
  const bRadarSCM1 = baltimoreSCM1.consumables.find((c) => c.type === 'rls');
  assert(bRadarSCM1.workTime === 28, `Consumables Mod 1 increases Baltimore Radar duration from 25s to 28s (got ${bRadarSCM1.workTime}s)`);

  // --- Suite 5: Table Alignment & Preset UI ---
  console.log('\nSuite 5: VirtualizedTable & FilterBar Alignment');
  const tableContent = fs.readFileSync(path.join(SRC_DIR, 'components/table/VirtualizedTable.tsx'), 'utf8');

  const expectedTableHeaders = [
    "'Damage con.'",
    "'Repair party'",
    "'Repair %'",
    "'Smoke'",
    "'Dispersion'",
    "'Radius'",
    "'Hydro'",
    "'Radar'",
    "'Engine boost'",
    "'Speed'",
    "'Auxiliary'",
    "'MBRB'",
    "'Reload'",
    "'TRB'",
    "'Fighters'",
    "'Spotter'",
    "'Hydrophone'",
    "'Sub. surveillance'",
    "'Enhanced rudder'",
    "'Res. battery'"
  ];

  for (const h of expectedTableHeaders) {
    assert(tableContent.includes(h), `VirtualizedTable includes authentic shiptool header ${h}`);
  }

  assert(tableContent.includes('ConsumableIconCell'), 'VirtualizedTable renders ConsumableIconCell');

  const filterBarContent = fs.readFileSync(path.join(SRC_DIR, 'components/filters/FilterBar.tsx'), 'utf8');
  assert(filterBarContent.includes("id: 'consumables'"), "FilterBar includes 'consumables' preset button");

  console.log('\n====================================================');
  console.log(`  Consumables Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
