import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateOvermatch, calculateKruppPenetration } from './calculate_ballistics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DATA = path.resolve(__dirname, '../public/data');

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
  console.log('  WoWs-Info Phase 1 Ingestion Verification Suite    ');
  console.log('====================================================\n');

  // --- Suite 1: Catalog Integrity & Completeness ---
  console.log('Suite 1: Catalog Integrity & Completeness');
  const catalogPath = path.join(PUBLIC_DATA, 'catalog.json');
  assert(fs.existsSync(catalogPath), 'catalog.json exists in public/data/');

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert(Array.isArray(catalog), 'catalog.json is an array');
  assert(catalog.length === 993, `100% of 993 ships present (found ${catalog.length})`);

  // Check critical fields across all ships
  let validFieldCount = 0;
  const validClasses = new Set(['Destroyer', 'Cruiser', 'Battleship', 'AirCarrier', 'Submarine']);
  for (const s of catalog) {
    if (s.id && s.name && s.dispName && s.tier >= 1 && s.tier <= 11 && validClasses.has(s.class) && s.health > 0) {
      validFieldCount++;
    }
  }
  assert(validFieldCount === 993, `All 993 ships have valid typed fields (ID, name, tier 1-11, valid class, HP > 0)`);
  const displayNames = new Set(catalog.map((ship) => ship.dispName));
  assert(displayNames.size === catalog.length, 'Catalog display names are unique after test-hull disambiguation');
  assert(catalog.some((ship) => ship.dispName === 'Vrijheid (Test)'), 'Duplicate Vrijheid test hull is explicitly labeled');

  // --- Suite 2: Top Module Resolution ---
  console.log('\nSuite 2: Top Module Resolution');
  const iowa = catalog.find(s => s.name === 'PASB018_Iowa_1944');
  assert(Boolean(iowa), 'Found Iowa (PASB018_Iowa_1944)');
  assert(iowa?.health === 79000, `Iowa top health correctly resolved to 79,000 HP (stock was ${iowa?.stockHealth} HP)`);
  assert(iowa?.stockHealth === 68100, `Iowa stock health preserved as 68,100 HP`);
  assert(Math.abs((iowa?.artillery?.rangeKm || 0) - 23.35) < 0.1, `Iowa top artillery range correctly resolved to 23.35 km with FCS upgrade`);
  assert(iowa?.artillery?.overmatchMm === 28, `Iowa 406mm guns correctly calculate 28mm overmatch threshold`);

  // Fletcher
  const fletcher = catalog.find(s => s.name === 'PASD021_Fletcher_1943');
  assert(Boolean(fletcher), 'Found Fletcher (PASD021_Fletcher_1943)');
  assert(fletcher?.torpedoes?.rangeKm === 10.5, `Fletcher top torpedoes range is 10.5 km (found ${fletcher?.torpedoes?.rangeKm} km)`);
  assert(fletcher?.torpedoes?.damage === 19033, `Fletcher top torpedo damage is 19,033 (found ${fletcher?.torpedoes?.damage})`);

  // Mogami
  const mogami = catalog.find(s => s.name === 'PJSC009_Mogami_1935');
  assert(Boolean(mogami), 'Found Mogami (PJSC009_Mogami_1935)');
  assert(mogami?.artillery?.caliberMm === 203, `Mogami top configuration resolves to 203mm artillery`);
  assert(mogami?.artillery?.totalBarrels === 10, `Mogami top configuration has 10 barrels (5x2)`);

  // --- Suite 3: Armory Strict Filtering & False Positive Prevention ---
  console.log('\nSuite 3: Armory Strict Filtering & False Positive Prevention');
  const armoryMasterPath = path.join(PUBLIC_DATA, 'armory_master.json');
  assert(fs.existsSync(armoryMasterPath), 'armory_master.json exists in public/data/');

  const armoryMaster = JSON.parse(fs.readFileSync(armoryMasterPath, 'utf8'));
  assert(armoryMaster.armoryOffersCount === 226, `Exactly 226 active armory ship bundle offers matched (found ${armoryMaster.armoryOffersCount})`);
  assert(armoryMaster.armoryBundlesCount === 222, `222 ship bundles containing ships identified (found ${armoryMaster.armoryBundlesCount})`);

  // Zero false positives
  const nonShipTitles = ['Quán Róng', 'Steel Camouflage', 'Dà Róng', 'Camo'];
  let falsePositiveCount = 0;
  for (const offer of armoryMaster.offers) {
    if (nonShipTitles.some(t => offer.title.includes(t)) && !offer.title.includes('Bismarck')) {
      falsePositiveCount++;
    }
  }
  assert(falsePositiveCount === 0, `Zero commanders or camos matched as ship bundles (0 false positives)`);

  // 100% of Armory offers map to catalog ships
  const catalogIds = new Set(catalog.map(s => s.id));
  let unmappedArmoryShips = 0;
  for (const offer of armoryMaster.offers) {
    if (!catalogIds.has(offer.shipId)) {
      unmappedArmoryShips++;
    }
  }
  assert(unmappedArmoryShips === 0, `All 226 Armory ship offers map to valid ships in catalog.json`);

  const zeroPriceEarlyAccess = armoryMaster.offers.filter((offer) =>
    offer.price <= 0 && ['Serrano', 'Almirante Villar'].includes(offer.title)
  );
  assert(zeroPriceEarlyAccess.length === 0, 'Zero-price early-access mission steps are excluded from Armory offers');

  // Coupon calculations
  const coalOffer = armoryMaster.offers.find(o => o.currency === 'coal');
  assert(Boolean(coalOffer && coalOffer.couponEligible), 'Coal ships marked couponEligible === true');
  assert(coalOffer?.couponPrice === Math.round(coalOffer?.price * 0.75), `Coal ship couponPrice has exact -25% discount`);
  assert(coalOffer?.steelEquivalent === Math.ceil(coalOffer?.price / 10), `Coal ship has steelEquivalent computed at 1:10 ratio`);

  const rpOffer = armoryMaster.offers.find(o => o.currency === 'paragon_xp');
  assert(Boolean(rpOffer && !rpOffer.couponEligible), 'Research Bureau ships have couponEligible === false (coupons do not apply)');

  // --- Suite 4: Curated Historical Acquisition Catalog ---
  console.log('\nSuite 4: Curated Historical Acquisition Catalog');
  const removedNames = ['Musashi', 'Smaland', 'Enterprise', 'Belfast', 'Georgia', 'Alaska', 'Thunderer', 'Somers'];
  for (const rName of removedNames) {
    const s = catalog.find(x => x.name.includes(rName) && !x.name.includes('Black') && !x.name.includes('PostApoc') && !x.name.includes('STPatric'));
    assert(
      s?.acquisition?.category === 'Removed' && s?.acquisition?.status === 'santa_supercontainer_only',
      `Removed ship ${rName} classified as Removed / santa_supercontainer_only`
    );
  }

  const dockyardNames = ['Wisconsin', 'Michelangelo', 'Atlantico', 'Odin', 'Anchorage'];
  for (const dName of dockyardNames) {
    const s = catalog.find(x => x.name.includes(dName) && !x.name.includes('Black') && !x.name.includes('TE') && !x.name.includes('250TH'));
    assert(
      s?.acquisition?.category === 'Dockyard' && s?.acquisition?.status === 'dockyard_historical',
      `Dockyard ship ${dName} classified as Dockyard / dockyard_historical`
    );
  }

  // Clones
  const tirpitzB = catalog.find(s => s.name === 'PGSB598_Black_Tirpitz');
  assert(tirpitzB?.acquisition?.isClone === true, `Tirpitz B marked as isClone === true`);
  const tirpitzBDetail = JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, `details/${tirpitzB?.id}.json`), 'utf8'));
  assert(tirpitzBDetail?.acquisition?.cloneOfShipId != null, `Tirpitz B has cloneOfShipId pointing to parent Tirpitz`);

  const arpYamato = catalog.find(s => s.name === 'PJSB700_ARP_Yamato');
  assert(arpYamato?.acquisition?.isClone === true, `ARP Yamato marked as isClone === true`);

  const blackSwan = catalog.find(s => s.name === 'PBSC101_Black_Swan');
  assert(blackSwan?.acquisition?.category === 'Tech Tree' && blackSwan?.acquisition?.isClone === false, 'Black Swan remains a Tech Tree ship, not a Black Friday clone');
  const myoko = catalog.find(s => s.name === 'PJSC008_Myoko_1945');
  assert(myoko?.acquisition?.category === 'Tech Tree' && myoko?.acquisition?.cloneOfShipId == null, 'Myōkō remains a Tech Tree parent with no self-clone reference');
  const z57 = catalog.find(s => s.name === 'PGSD111_Z_57');
  assert(z57?.acquisition?.category === 'Testing', 'Z-57 demo hull is not classified as a Supership Tech Tree ship');

  // --- Suite 5: Krupp Ballistics & Overmatch Precision ---
  console.log('\nSuite 5: Krupp Ballistics & Overmatch Precision');
  assert(calculateOvermatch(460) === 32, 'Overmatch: 460mm (Yamato) -> 32mm');
  assert(calculateOvermatch(406) === 28, 'Overmatch: 406mm (Iowa) -> 28mm');
  assert(calculateOvermatch(380) === 26, 'Overmatch: 380mm (Bismarck) -> 26mm');
  assert(calculateOvermatch(203) === 14, 'Overmatch: 203mm (Des Moines) -> 14mm');
  assert(calculateOvermatch(152) === 10, 'Overmatch: 152mm (Cleveland) -> 10mm');

  // Iowa muzzle penetration
  // Krupp: 2520, Mass: 1225kg, Speed: 762 m/s, Diameter: 0.406m
  const iowaPen = calculateKruppPenetration(2520, 1225, 762, 0.406);
  assert(Math.abs(iowaPen - 847.6) < 1.0, `Iowa AP muzzle penetration is 847.6mm (calculated: ${iowaPen}mm)`);

  // Yamato muzzle penetration
  // Krupp: 2574, Mass: 1460kg, Speed: 780 m/s, Diameter: 0.460m
  const yamatoPen = calculateKruppPenetration(2574, 1460, 780, 0.460);
  assert(Math.abs(yamatoPen - 883.0) < 1.0, `Yamato AP muzzle penetration is 883.0mm (calculated: ${yamatoPen}mm)`);

  // --- Suite 6: Tiered Artifact Store ---
  console.log('\nSuite 6: Tiered Artifact Store');
  const detailsFiles = fs.readdirSync(path.join(PUBLIC_DATA, 'details'));
  assert(detailsFiles.length === 993, `Exactly 993 detail JSON files in public/data/details/ (found ${detailsFiles.length})`);

  const enLocalePath = path.join(PUBLIC_DATA, 'locales/en.json');
  assert(fs.existsSync(enLocalePath), 'locales/en.json exists');
  const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf8'));
  assert(Object.keys(enLocale).length >= 5000, `locales/en.json contains ${Object.keys(enLocale).length} English strings`);

  const statsDir = path.join(PUBLIC_DATA, 'stats');
  const statsFiles = fs.readdirSync(statsDir).filter((file) => /^stats-(eu|com|asia)-(1|3|all)\.json$/.test(file));
  assert(statsFiles.length === 9, `public/data/stats/ contains 9 ShipTool chunks (found ${statsFiles.length})`);
  assert(fs.existsSync(path.join(statsDir, 'manifest.json')), 'ShipTool statistics manifest exists');

  console.log('\n====================================================');
  console.log(`  Verification Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('[FATAL] Verification suite crashed:', err);
  process.exit(1);
});
