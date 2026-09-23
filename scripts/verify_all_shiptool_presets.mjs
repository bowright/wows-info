import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  console.log('  WoWs-Info 20 Shiptool Parameter Presets Audit     ');
  console.log('  (Full Parity with shiptool.st/params Columns)     ');
  console.log('====================================================\n');

  // --- Suite 1: Catalog Ingestion for All 20 Presets ---
  console.log('Suite 1: Catalog Ingestion & Schema Parity');
  const catalogPath = path.join(PUBLIC_DATA, 'catalog.json');
  assert(fs.existsSync(catalogPath), 'catalog.json exists');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert(catalog.length === 993, `Catalog contains all 993 ships (got ${catalog.length})`);

  // Verify General parameters
  const dm = catalog.find((s) => s.dispName === 'Des Moines');
  assert(Boolean(dm), 'Des Moines found in catalog');
  assert(dm.year === '1948', `Des Moines Year is '1948' (got '${dm.year}')`);
  assert(dm.length === 218.4, `Des Moines Length is 218.4m (got ${dm.length}m)`);
  assert(dm.beam === 23, `Des Moines Beam is 23m (got ${dm.beam}m)`);
  assert(dm.tonnage === 20950, `Des Moines Tonnage is 20950t (got ${dm.tonnage}t)`);
  assert(dm.powerWeight === 5.73, `Des Moines Power/Weight is 5.73 hp/t (got ${dm.powerWeight})`);
  assert(dm.acceleration === 30.4, `Des Moines Acceleration is 30.4s (got ${dm.acceleration}s)`);

  // Verify Diving & Sonar on Submarine
  const subs = catalog.filter((s) => s.class === 'Submarine');
  assert(subs.length > 0, `Catalog contains ${subs.length} submarines`);
  const sub = subs[0];
  assert(sub.subDetectability != null, `${sub.dispName} has subDetectability (${sub.subDetectability} km)`);
  assert(sub.submergedSpeed != null, `${sub.dispName} has submergedSpeed (${sub.submergedSpeed} kts)`);
  assert(sub.divingPlaneShift != null, `${sub.dispName} has divingPlaneShift (${sub.divingPlaneShift}s)`);
  assert(sub.diveCapacity != null, `${sub.dispName} has diveCapacity (${sub.diveCapacity})`);
  assert(sub.sonar != null, `${sub.dispName} has sonar stats`);
  assert(sub.sonar.rangeKm != null, `${sub.dispName} sonar has rangeKm (${sub.sonar.rangeKm} km)`);
  assert(sub.sonar.reload != null, `${sub.dispName} sonar has reload (${sub.sonar.reload}s)`);

  // Verify AP, HE, SAP shell stats on Artillery
  assert(dm.artillery != null, 'Des Moines has artillery');
  assert(dm.artillery.ap != null, 'Des Moines has AP shell stats');
  assert(dm.artillery.ap.bulletMass === 152, `Des Moines AP bullet mass is 152 kg (got ${dm.artillery.ap.bulletMass})`);
  assert(dm.artillery.ap.krupp === 2919, `Des Moines AP Krupp is 2919 (got ${dm.artillery.ap.krupp})`);
  assert(dm.artillery.ap.penetrationMm > 190, `Des Moines AP penetration calculated (${dm.artillery.ap.penetrationMm} mm)`);
  assert(dm.artillery.apSalvo === 45000, `Des Moines AP salvo is 45000 (got ${dm.artillery.apSalvo})`);
  assert(dm.artillery.he != null, 'Des Moines has HE shell stats');
  assert(dm.artillery.heSalvo === 25200, `Des Moines HE salvo is 25200 (got ${dm.artillery.heSalvo})`);

  // Verify Aircraft Carrier presets
  const cvs = catalog.filter((s) => s.class === 'AirCarrier');
  assert(cvs.length > 0, `Catalog contains ${cvs.length} aircraft carriers`);
  const essex = catalog.find((s) => s.dispName === 'Essex');
  assert(Boolean(essex), 'Essex found in catalog');
  assert(essex.aircraft != null, 'Essex has aircraft data');
  assert(essex.aircraft.attackAircraft?.planes?.length > 0, 'Essex has Attack Aircraft');
  assert(essex.aircraft.torpedoBombers?.planes?.length > 0, 'Essex has Torpedo Bombers');
  assert(essex.aircraft.diveBombers?.planes?.length > 0, 'Essex has Dive Bombers');

  // Verify Combat Instructions & Innate Skills
  const ciShips = catalog.filter((s) => s.hasCombatInstructions);
  assert(ciShips.length >= 30, `Found ${ciShips.length} ships with Combat Instructions (>= 30)`);
  const isShips = catalog.filter((s) => s.hasInnateSkills);
  assert(isShips.length >= 5, `Found ${isShips.length} ships with Innate Skills (>= 5)`);

  // --- Suite 2: FilterBar Presets Matrix & Order ---
  console.log('\nSuite 2: FilterBar Preset Buttons Parity');
  const filterBarPath = path.join(SRC_DIR, 'components/filters/FilterBar.tsx');
  const filterBarContent = fs.readFileSync(filterBarPath, 'utf8');

  const expectedPresets = [
    { id: 'general', label: 'General' },
    { id: 'survivability', label: 'Survivability' },
    { id: 'diving', label: 'Diving' },
    { id: 'artillery', label: 'Main battery' },
    { id: 'ap_shells', label: 'AP shells' },
    { id: 'he_shells', label: 'HE shells' },
    { id: 'sap_shells', label: 'SAP shells' },
    { id: 'secondary', label: 'Secondaries' },
    { id: 'sonar', label: 'Sonar' },
    { id: 'torpedoes', label: 'Torpedoes' },
    { id: 'aa', label: 'Anti-aircraft' },
    { id: 'asw', label: 'Depth charges' },
    { id: 'airstrike', label: 'Airstrike' },
    { id: 'attack_aircraft', label: 'Attack aircraft' },
    { id: 'torpedo_bombers', label: 'Torpedo bombers' },
    { id: 'bombers', label: 'Bombers' },
    { id: 'skip_bombers', label: 'Skip bombers' },
    { id: 'consumables', label: 'Consumables' },
    { id: 'combat_instructions', label: 'Combat instructions' },
    { id: 'innate', label: 'Innate skills' },
    { id: 'all', label: 'All Columns' },
  ];

  for (const preset of expectedPresets) {
    assert(
      filterBarContent.includes(`id: '${preset.id}'`),
      `FilterBar includes preset '${preset.id}' (${preset.label})`
    );
  }

  // --- Suite 3: ShipParametersView URL Routing & Codes ---
  console.log('\nSuite 3: URL Deep-Linking Codes (?p=CODE & ?p=name)');
  const viewPath = path.join(SRC_DIR, 'views/ShipParametersView.tsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');

  const codeMappings = [
    ['GEN', 'general'],
    ['SRV', 'survivability'],
    ['DIV', 'diving'],
    ['MB', 'artillery'],
    ['AP', 'ap_shells'],
    ['HE', 'he_shells'],
    ['SAP', 'sap_shells'],
    ['SEC', 'secondary'],
    ['SON', 'sonar'],
    ['TORP', 'torpedoes'],
    ['AA', 'aa'],
    ['ASW', 'asw'],
    ['AS', 'airstrike'],
    ['ATT', 'attack_aircraft'],
    ['TB', 'torpedo_bombers'],
    ['DB', 'bombers'],
    ['SB', 'skip_bombers'],
    ['CON', 'consumables'],
    ['CI', 'combat_instructions'],
    ['IS', 'innate'],
  ];

  for (const [code, name] of codeMappings) {
    assert(
      viewContent.includes(`presetMap['${code}'] = '${name}'`) ||
      viewContent.includes(`'${code}': '${name}'`) ||
      viewContent.includes(`${code}: '${name}'`),
      `ShipParametersView maps short code '${code}' to '${name}'`
    );
  }

  // --- Suite 4: VirtualizedTable Column Arrangement & Exact Headers ---
  console.log('\nSuite 4: VirtualizedTable Headers for All 20 Presets');
  const tablePath = path.join(SRC_DIR, 'components/table/VirtualizedTable.tsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  const presetHeaderExpectations = {
    general: ["'Year'", "'Length'", "'Beam'", "'Displacement'", "'Detect. by sea'", "'Detect. by air'", "'Smoke firing detect.'", "'Power / weight'", "'Max speed'", "'Acceleration'", "'Rudder shift'", "'Turning radius'"],
    survivability: ["'Health'", "'Repair %'", "'Citadel repair %'", "'Fire resistance'", "'Fire duration'", "'Fire damage'", "'No of fires'", "'Torpedo protection'", "'Flooding duration'", "'Flooding damage'", "'No of floodings'"],
    diving: ["'Detectability'", "'Submerged speed'", "'Diving plane shift'", "'Dive speed'", "'Dive capacity'", "'Depletion rate'", "'Recharge rate'"],
    artillery: ["'Description'", "'AP DPM'", "'HE DPM'", "'SAP DPM'", "'AP salvo'", "'HE salvo'", "'SAP salvo'", "'Range'", "'Reload'", "'180° turn'", "'Horiz. dispersion'", "'Vert. dispersion'", "'Sigma'", "'Flight time'", "'Shells / min'"],
    ap_shells: ["'Description'", "'Weight'", "'Damage'", "'Initial speed'", "'Drag coeff.'", "'Flight time'", "'Impact speed'", "'Impact angle'", "'Krupp'", "'Penetration'", "'Overmatch'", "'Ricochet'", "'Threshold'", "'Fuse time'"],
    he_shells: ["'Description'", "'Weight'", "'Damage'", "'Initial speed'", "'Drag coeff.'", "'Flight time'", "'Impact speed'", "'Impact angle'", "'Penetration'", "'Fire chance'", "'Fires / min'"],
    sap_shells: ["'Description'", "'Weight'", "'Damage'", "'Initial speed'", "'Drag coeff.'", "'Flight time'", "'Impact speed'", "'Impact angle'", "'Penetration'", "'Ricochet'"],
    secondary: ["'Description'", "'Secondary DPM'", "'Hitting DPM'", "'Secondary range'", "'Secondary caliber'", "'Secondary barrels'", "'Secondary reload'", "'Secondary HE DPM'", "'Secondary AP DPM'", "'Secondary SAP DPM'", "'Secondary fire chance'", "'Secondary penetration'", "'Flight time'", "'Horiz. dispersion'", "'Sigma'", "'Fires / min'", "'Shells / min'"],
    sonar: ["'Range'", "'Reload'", "'180° turn'", "'1st life time'", "'2nd life time'", "'Wave width'", "'Wave speed'"],
    torpedoes: ["'Description'", "'Type'", "'Loaders'", "'Torpedo DPM'", "'Range'", "'Damage'", "'Spread'", "'Flood chance'", "'Reload'", "'Speed'", "'Detectability'", "'Reaction time'", "'Torpedoes / min'", "'Homing rate'"],
    aa: ["'AA strength'", "'Long range'", "'Long DPS'", "'Medium range'", "'Medium DPS'", "'Short range'", "'Short DPS'", "'Flak strength'", "'Flak count'", "'Flak DPS'", "'Priority time'", "'Priority %'", "'Concentrated %'"],
    asw: ["'Attacks'", "'Reload'", "'Bombs'", "'Drop interval'", "'Detonation timer'", "'Detonation depth'", "'Damage'", "'Radius'", "'Flood chance'", "'Fire chance'"],
    airstrike: ["'Type'", "'Attacks'", "'Reload'", "'Health'", "'Min range'", "'Max range'", "'Bombs'", "'Reticle size'", "'Detonation timer'", "'Detonation depth'", "'Damage'", "'Radius'", "'Flood chance'", "'Fire chance'", "'Penetration'"],
    attack_aircraft: ["'Description'", "'Health'", "'Max speed'", "'Detectability'", "'On deck'", "'Regeneration'", "'Squadron'", "'Rockets'", "'Reticle size'", "'Firing delay'", "'Type'", "'Damage'", "'Fire chance'", "'Penetration'", "'Threshold'", "'Fuse time'"],
    torpedo_bombers: ["'Description'", "'Health'", "'Max speed'", "'Detectability'", "'On deck'", "'Regeneration'", "'Squadron'", "'Torpedoes'", "'Torpedo speed'", "'Arming time'", "'Arming distance'", "'Range'", "'Damage'", "'Flood chance'"],
    bombers: ["'Description'", "'Health'", "'Max speed'", "'Detectability'", "'On deck'", "'Regeneration'", "'Squadron'", "'Bombs'", "'Reticle size'", "'Type'", "'Damage'", "'Fire chance'", "'Penetration'", "'Threshold'", "'Fuse time'"],
    skip_bombers: ["'Description'", "'Health'", "'Max speed'", "'Detectability'", "'On deck'", "'Regeneration'", "'Squadron'", "'Bombs'", "'Type'", "'Damage'", "'Fire chance'", "'Penetration'", "'Threshold'", "'Fuse time'"],
    consumables: ["'Damage con.'", "'Repair party'", "'Repair %'", "'Smoke'", "'Dispersion'", "'Radius'", "'Hydro'", "'Radar'", "'Engine boost'", "'Speed'", "'Auxiliary'", "'MBRB'", "'Reload'", "'TRB'", "'Fighters'", "'Spotter'", "'Hydrophone'", "'Sub. surveillance'", "'Enhanced rudder'", "'Res. battery'"],
    combat_instructions: ["'Combat instructions'"],
    innate: ["'Innate skill'"],
  };

  for (const [preset, headers] of Object.entries(presetHeaderExpectations)) {
    for (const h of headers) {
      assert(
        tableContent.includes(h),
        `Preset '${preset}' column header ${h} present in VirtualizedTable`
      );
    }
  }

  // Pinned columns verification (6 sticky columns)
  assert(tableContent.includes("id: 'compare'"), 'Pinned compare column configured');
  assert(tableContent.includes("id: 'tier'"), 'Pinned tier column configured');
  assert(tableContent.includes("id: 'class'"), 'Pinned class column configured');
  assert(tableContent.includes("id: 'nation'"), 'Pinned nation column configured');
  assert(tableContent.includes("id: 'name'"), 'Pinned name column configured');
  assert(tableContent.includes("id: 'acquisition'"), 'Pinned acquisition column configured');

  console.log('\n====================================================');
  console.log(`  20 Presets Audit Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
