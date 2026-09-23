import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Data from '../scratch/data.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ships = Data.Ship || Data.default?.Ship || [];
const shipById = new Map();
const shipByName = new Map();

for (const s of ships) {
  shipById.set(s.id, s);
  shipByName.set(s.name, s);
}

// 1. Explicit Removed Ships Catalog
const REMOVED_SHIPS_LIST = [
  {
    nameMatch: 'Musashi',
    note: 'Removed in 0.8.0 due to extreme combat popularity and power',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'coal',
    prevPrice: 176000
  },
  {
    nameMatch: 'Smaland',
    note: 'Removed in 0.10.1 due to overwhelming radar DD effectiveness',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'free_xp',
    prevPrice: 2000000
  },
  {
    nameMatch: 'Enterprise',
    note: 'Removed in 0.8.7 due to AP bomb performance and plane reserves',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 14000
  },
  {
    nameMatch: 'PBSC507_Belfast_1959',
    note: 'Removed in 0.6.14 due to HE + Radar + Smoke combination',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 8200
  },
  {
    nameMatch: 'Georgia',
    note: 'Removed in 0.10.1 due to speed boost and secondary popularity',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'coal',
    prevPrice: 228000
  },
  {
    nameMatch: 'PASC510_Alaska',
    note: 'Removed in 0.10.1 due to high utility and widespread adoption',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'free_xp',
    prevPrice: 1000000
  },
  {
    nameMatch: 'Thunderer',
    note: 'Removed in 0.10.1 due to overperforming HE & AP sniper dispersion',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'coal',
    prevPrice: 252000
  },
  {
    nameMatch: 'Somers',
    note: 'Removed in 0.10.1 due to torpedo alpha and concealment dominance',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'steel',
    prevPrice: 25000
  },
  {
    nameMatch: 'Missouri',
    note: 'Removed in 0.7.2 due to exceptional credit earning multiplier',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'free_xp',
    prevPrice: 750000
  },
  {
    nameMatch: 'PASB518_Massachusetts',
    note: 'Removed in 0.10.1 due to secondary battery and heal reload power',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 12500
  },
  {
    nameMatch: 'Nelson',
    note: 'Removed in 0.10.5 due to super-heal and high popularity',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'free_xp',
    prevPrice: 375000
  },
  {
    nameMatch: 'Kronshtadt',
    note: 'Removed in 0.8.0 due to high battle population',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'free_xp',
    prevPrice: 750000
  },
  {
    nameMatch: 'PFSB518_Jean_Bart',
    note: 'Removed in 0.9.3 due to reload booster and high volume',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'coal',
    prevPrice: 228000
  },
  {
    nameMatch: 'Benham',
    note: 'Savage Battles reward, extremely rare 16-torpedo broadside DD',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'eventum',
    prevPrice: null
  },
  {
    nameMatch: 'PRSC610_Smolensk',
    note: 'Removed in 0.9.3 due to smoke fire DPM impact on game meta',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'coal',
    prevPrice: 244000
  },
  {
    nameMatch: 'Kutuzov',
    note: 'Removed in 0.6.14 after smoke firing mechanics revision',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 10250
  },
  {
    nameMatch: 'Kamikaze',
    note: 'Removed in 0.5.11 due to extreme concealment and torpedo speed',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 3500
  },
  {
    nameMatch: 'Gremyashchy',
    note: 'Original closed beta preorder ship with 130mm stealth fire',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 3500
  },
  {
    nameMatch: 'Giulio_Cesare',
    note: 'Removed in 0.8.2 due to unmatched Tier 5 accuracy and armor',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 5350
  },
  {
    nameMatch: 'Haida',
    note: 'Removed in 0.10.5 due to creeping smoke and hydro dominance',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 5300
  },
  {
    nameMatch: 'PRSB518_Lenin',
    note: 'Removed in 0.10.5 due to 25mm overmatch resistance and 406mm bow guns',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 12500
  },
  {
    nameMatch: 'T_61',
    note: 'Removed in 0.10.5 due to 68-second torpedo reload and hydro',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 5300
  },
  {
    nameMatch: 'Z_39',
    note: 'Removed in 0.10.5 due to tier 8 upgrade slot and large HP pool',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 6300
  },
  {
    nameMatch: 'PRSB001_Nikolay_I',
    note: 'Rare early-release premium battleship no longer sold directly',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 3750
  },
  {
    nameMatch: 'PGSB503_Koenig_Albert',
    note: 'Removed after balance and matchmaking concerns for the Tier III premium battleship',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 2500
  },
  {
    nameMatch: 'PJSC026_Iwaki_1944',
    note: 'Closed-beta / Alpha reward cruiser no longer sold directly',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 2500
  },
  {
    nameMatch: 'PASB013_Arkansas_1912',
    note: 'Beta reward battleship no longer sold directly',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'none',
    prevPrice: null
  },
  {
    nameMatch: 'PJSD508_Asashio',
    note: 'Removed in 0.10.5 due to 20km deepwater BB/CV torpedoes',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 8900
  },
  {
    nameMatch: 'E_Loewenhardt',
    note: 'Removed in 0.10.5 due to fast planes and HE bomb alpha',
    rarity: 'Santa / Supercontainer Tier 1 (Extremely Rare)',
    prevCurrency: 'gold',
    prevPrice: 6800
  }
];

// 2. Explicit Dockyard Ships
const DOCKYARD_SHIPS_LIST = [
  {
    nameMatch: 'PASC610_Puerto_Rico',
    minDoubloonsRequired: 12000,
    totalPhases: 40,
    note: 'Dockyard 0.8.11 (2019) & 0.11.7 (2022) reward ship'
  },
  {
    nameMatch: 'PGSB508_Odin',
    minDoubloonsRequired: 3500,
    totalPhases: 20,
    note: 'Dockyard 0.9.5 (2020) reward ship'
  },
  {
    nameMatch: 'PASC518_Anchorage',
    minDoubloonsRequired: 3500,
    totalPhases: 20,
    note: 'Dockyard 0.9.8 (2020) reward ship'
  },
  {
    nameMatch: 'PJSB519_Hizen',
    minDoubloonsRequired: 7950,
    totalPhases: 26,
    note: 'Dockyard 0.9.12 (2020) reward ship'
  },
  {
    nameMatch: 'PHSC508_De_Zeven_Provincien',
    minDoubloonsRequired: 4500,
    totalPhases: 24,
    note: 'Dockyard 0.10.7 (2021) reward ship'
  },
  {
    nameMatch: 'PBSB509_Marlborough',
    minDoubloonsRequired: 5900,
    totalPhases: 32,
    note: 'Dockyard 0.10.11 (2021) reward ship'
  },
  {
    nameMatch: 'PVSB508_Atlantico',
    minDoubloonsRequired: 5000,
    totalPhases: 22,
    note: 'Dockyard 0.11.3 (2022) reward ship'
  },
  {
    nameMatch: 'PJSB539_Daisen',
    minDoubloonsRequired: 6500,
    totalPhases: 34,
    note: 'Dockyard 12.3 (2023) reward ship'
  },
  {
    nameMatch: 'PZSD510_Lushun',
    minDoubloonsRequired: 6500,
    totalPhases: 35,
    note: 'Dockyard 12.7 (2023) reward ship'
  },
  {
    nameMatch: 'PISC519_Michelangelo',
    minDoubloonsRequired: 7000,
    totalPhases: 32,
    note: 'Dockyard 12.11 (2023) reward ship'
  },
  {
    nameMatch: 'PASB730_Wisconsin',
    minDoubloonsRequired: 6400,
    totalPhases: 30,
    note: 'Dockyard 13.3 (2024) reward ship with Combat Instructions'
  },
  {
    nameMatch: 'PSSC719_Almirante_Oquendo',
    minDoubloonsRequired: 4000,
    totalPhases: 20,
    note: 'Dockyard 13.7 (2024) reward ship'
  },
  {
    nameMatch: 'PWSB719_Niord',
    minDoubloonsRequired: 4000,
    totalPhases: 20,
    note: 'Dockyard 13.9 (2024) reward ship'
  },
  {
    nameMatch: 'PGSC528_Schill',
    minDoubloonsRequired: 4500,
    totalPhases: 20,
    note: 'Event / Dockyard cruiser'
  }
];

// 3. Known Clone Parent Overrides
const CLONE_PARENT_OVERRIDES = {
  'PGSB598_Black_Tirpitz': 'PGSB002_Tirpiz_1942',
  'PGSB818_BA_Tirpitz': 'PGSB002_Tirpiz_1942',
  'PJSC708_ARP_Takao': 'PJSC038_Atago_1944',
  'PJSC598_Black_Atago': 'PJSC038_Atago_1944',
  'PJSB700_ARP_Yamato': 'PJSB018_Yamato_1944',
  'PJSB705_Kongou': 'PJSB007_Kongo_1942',
  'PJSB706_Kirishima': 'PJSB007_Kongo_1942',
  'PJSB707_Haruna': 'PJSB007_Kongo_1942',
  'PJSB708_Hiei_Arpeggio': 'PJSB007_Kongo_1942',
  'PJSC705_Myoko': 'PJSC008_Myoko_1945',
  'PJSC707_Ashigara': 'PJSC008_Myoko_1945',
  'PJSC709_Haguro': 'PJSC008_Myoko_1945',
  'PJSC737_Nachi': 'PJSC008_Myoko_1945',
  'PRSB709_AZUR_Sov_Russia': 'PRSB109_Sovetsky_Soyuz',
  'PASC718_AZUR_Montpelier': 'PASC208_Cleveland',
  'PISB708_AZUR_Littorio': 'PISB508_Roma',
  'PJSD718_AZUR_Yukikaze': 'PJSD208_Kagero',
  'PJSC519_AZUR_Azuma': 'PJSC510_Azuma',
  'PASB820_BA_Montana': 'PASB017_Montana_1945',
  'PJSC819_BA_Takahashi': 'PJSC039_Takahashi',
  'PJSS820_BA_I56': 'PJSS508_I56',
  'PFSC819_BA_Le_Havre': 'PFSC018_Cherbourg',
  'PISB818_BA_Marcantonio_Colonna': 'PISB108_Veneto',
  'PRSB819_BA_Zarya_Svobody': 'PRSB109_Sovetsky_Soyuz',
  'PJSB878_Ignis_Purgatio': 'PJSB013_Amagi_1942',
  'PJSB888_Ragnarok': 'PJSB013_Amagi_1942',
  'PGSC718_Warhammer_Blacktemplar': 'PGSC518_Mainz',
  'PZSD718_Warhammer_Ork': 'PZSD518_Fen_Yang',

  // Cosmetic/event variant series.
  'PASB808_Colorful_North_Carolina': 'PASB012_North_Carolina_1945',
  'PFSD810_Colorful_Kleber': 'PFSD110_Kleber',
  'PGSC809_Colorful_Roon': 'PGSC109_Roon',
  'PJSC890_CLR_Zao': 'PJSC034_Zao_1944',
  'PBSB920_MC_Conqueror': 'PBSB110_Conqueror',
  'PASB909_Pirate_Delaware': 'PASB209_Delaware',
  'PBSC909_Pirate_Neptune': 'PBSC109_Neptune',
  'PBSC920_Pirate_Plymouth': 'PBSC510_Plymouth',
  'PFSB909_Pirate_Jean_Bart': 'PFSB518_Jean_Bart',
  'PGSB918_Pirate_Brandenburg': 'PGSB518_Brandenburg',
  'PWSD907_Pirate_Grom': 'PWSD207_Grom',
  'PBSB747_STPatric_Duke_of_York': 'PBSB527_Duke_of_York',
  'PBSC707_STPatric_Belfast_1959': 'PBSC507_Belfast_1959',
  'PBSC708_STPatric_Belfast_1943': 'PBSC528_Belfast_1943',
  'PBSC718_STPatric_Tiger_1959': 'PBSC518_Tiger_1959',
  'PASB940_250TH_Wisconsin': 'PASB730_Wisconsin',
  'PASC909_250TH_Fort_Worth': 'PASC729_Fort_Worth',
  'PASC920_Gold_Hawaii': 'PASC720_Hawaii',
  'PASB908_East_North_Carolina_1945': 'PASB012_North_Carolina_1945',
  'PGSD910_East_Z_52': 'PGSD110_Z_52',
  'PISC908_East_Amalfi': 'PISC108_Amalfi',
  'PJSC905_East_Furutaka_1926': 'PJSC005_Furutaka_1926',
  'PRSB909_East_Navarin': 'PRSB509_Navarin',

  // Test/evaluation and variant hulls with a released parent.
  'PFSD820_Kleber_TE': 'PFSD110_Kleber',
  'PGSB828_Odin_TE': 'PGSB508_Odin',
  'PRSB818_Borodino_TE': 'PRSB528_Borodino',
  'PASB528_Alabama_VL': 'PASB508_Alabama',
  'PASB708_Alabama': 'PASB508_Alabama'
};

const DOUBLOON_BASE_PRICE_BY_TIER = {
  1: 250,
  2: 750,
  3: 1500,
  4: 2500,
  5: 3500,
  6: 6500,
  7: 8500,
  8: 11500,
  9: 19000,
  10: 22500,
  11: 25000
};

function findCloneParent(name) {
  const override = CLONE_PARENT_OVERRIDES[name];
  if (override) {
    const parent = shipByName.get(override);
    if (parent && parent.name !== name) return parent;
  }

  if (name.includes('_Black_')) {
    const baseName = name.replace(/_Black_/, '_');
    const parent = shipByName.get(baseName);
    if (parent && parent.name !== name) return parent;
  }

  const cleaned = name
    .replace(/_AZUR_|_Azur_/, '_')
    .replace(/_BA_/, '_')
    .replace(/_ARP_/, '_');
  const cleanedParent = shipByName.get(cleaned);
  if (cleanedParent && cleanedParent.name !== name) return cleanedParent;

  const coreName = name.replace(/^P[A-Z]{3}\d{3}_/, '')
    .replace(/^(?:AZUR_|Azur_|BA_|ARP_)/, '')
    .replace(/^(?:Colorful_|CLR_|MC_|Pirate_|STPatric_|250TH_|Gold_|East_)/, '')
    .replace(/_(?:TE|VL)$/, '');
  return ships.find(x =>
    x.name !== name &&
    x.name.includes(coreName) &&
    !x.name.includes('_Black_') &&
    !x.name.includes('AZUR') &&
    !x.name.includes('BA_') &&
    !x.name.includes('_ARP_')
  ) || null;
}

const curatedMap = {};

for (const s of ships) {
  const shipId = s.id;
  const name = s.name || '';
  const level = s.level;
  const group = s.group;
  const costCR = s.ShipUpgradeInfo?.costCR || null;
  const costXP = s.ShipUpgradeInfo?.costXP || null;

  let category = 'Testing';
  let status = 'in_testing';
  let primaryCurrency = 'none';
  let price = null;
  let basePrice = null;
  let couponEligible = false;
  let couponPrice = null;
  let steelEquivalent = null;
  let minDoubloonsRequired = null;
  let totalPhases = null;
  let isClone = false;
  let cloneOfShipId = null;
  let obtainMethodText = 'Testing / Unreleased';
  let availabilityNote = null;
  let rarity = null;
  const isProgressionShip = group === 'upgradeable' || group === 'start';
  const isDemoShip = group === 'demoWithoutStats' || group === 'demoWithoutStatsPrem';

  // 1. Check Tech Tree
  if (isProgressionShip) {
    category = 'Tech Tree';
    status = 'available_tech_tree';
    primaryCurrency = 'credits';
    price = costCR || 0;
    obtainMethodText = `Tech Tree Research (${(costXP || 0).toLocaleString()} XP, ${(costCR || 0).toLocaleString()} Credits)`;
  }
  // 2. Check Superships
  else if (group === 'superShip' || (level === 11 && !isDemoShip)) {
    category = 'Tech Tree';
    status = 'available_tech_tree';
    primaryCurrency = 'credits';
    price = costCR || 45000000;
    obtainMethodText = `Supership Tech Tree Purchase (${(price).toLocaleString()} Credits)`;
  }

  // Released premium/special groups are not test hulls just because they are
  // absent from the current Armory snapshot. Keep them discoverable with a
  // conservative historical Doubloon baseline until a live offer supersedes it.
  if (!isProgressionShip && ['special', 'premium', 'ultimate'].includes(group)) {
    const baselinePrice = DOUBLOON_BASE_PRICE_BY_TIER[level] || null;
    category = 'Doubloon';
    status = 'available_armory';
    primaryCurrency = 'gold';
    price = baselinePrice;
    basePrice = baselinePrice;
    couponEligible = baselinePrice != null;
    couponPrice = baselinePrice != null ? Math.round(baselinePrice * 0.75) : null;
    obtainMethodText = baselinePrice != null
      ? `Premium Ship (baseline ${baselinePrice.toLocaleString()} Doubloons)`
      : 'Premium Ship (price unavailable)';
  }

  // 3. Check Removed Ships
  const removedMatch = REMOVED_SHIPS_LIST.find(r => name.includes(r.nameMatch));
  if (removedMatch) {
    category = 'Removed';
    status = 'santa_supercontainer_only';
    primaryCurrency = 'none';
    price = null;
    obtainMethodText = 'Removed from sale (Available via Santa Crates / Supercontainers)';
    availabilityNote = removedMatch.note;
    rarity = removedMatch.rarity;
  }

  // 4. Check Dockyard Ships
  const dockyardMatch = DOCKYARD_SHIPS_LIST.find(d => name.includes(d.nameMatch));
  if (dockyardMatch) {
    category = 'Dockyard';
    status = 'dockyard_historical';
    primaryCurrency = 'gold';
    price = dockyardMatch.minDoubloonsRequired;
    minDoubloonsRequired = dockyardMatch.minDoubloonsRequired;
    totalPhases = dockyardMatch.totalPhases;
    obtainMethodText = `Dockyard Event (${dockyardMatch.totalPhases} phases, min ${dockyardMatch.minDoubloonsRequired.toLocaleString()} Doubloons)`;
    availabilityNote = dockyardMatch.note;
  }

  // 5. Check Black Friday Clones. Progression ships are never clones, even
  // when their historical identifier happens to contain a marker such as
  // "_Black_" (Black Swan is the notable example).
  if (!isProgressionShip && name.includes('_Black_') && name !== 'PBSC101_Black_Swan') {
    category = 'Black Friday';
    status = 'collaborative_limited';
    isClone = true;
    primaryCurrency = 'gold';
    price = null;
    basePrice = null;
    couponEligible = false;
    couponPrice = null;
    obtainMethodText = 'Black Friday Event (Annual Armory / Crates)';
    const parentShip = findCloneParent(name);
    if (parentShip) {
      cloneOfShipId = parentShip.id;
    }
  }

  // 6. Check Collaboration Clones (Azur Lane, ARP, Warhammer, Blue Archive)
  const isCollab = !isProgressionShip && (name.includes('AZUR') || name.includes('Azur') ||
                  name.includes('ARP_') || name.includes('Arpeggio') ||
                  name.includes('Warhammer') || name.includes('Ignis') || name.includes('Ragnarok') ||
                  name.includes('BA_') || name.includes('Haruna') || name.includes('Kirishima') ||
                  name.includes('Kongou') || name.includes('Haguro') ||
                  name.includes('Nachi') || name.includes('Ashigara'));

  const isKnownVariant = !isProgressionShip && (
    Object.prototype.hasOwnProperty.call(CLONE_PARENT_OVERRIDES, name) &&
    !isCollab &&
    !name.includes('_Black_')
  );

  if ((isCollab || isKnownVariant) && !name.includes('_Black_')) {
    category = 'Collaboration';
    status = 'collaborative_limited';
    isClone = true;
    primaryCurrency = 'gold';
    price = null;
    basePrice = null;
    couponEligible = false;
    couponPrice = null;
    obtainMethodText = 'Collaboration Event (Limited Time)';

    const parentShip = findCloneParent(name);
    if (parentShip) {
      cloneOfShipId = parentShip.id;
    }
  }

  // Evaluation-only variants still need clone semantics so they can be
  // hidden together with other replicas, but should remain visibly marked as
  // testing rather than priced as a released premium.
  const isEvaluationVariant = !isProgressionShip && (/_(?:TE|VL)$/.test(name) || name === 'PASB708_Alabama');
  if (isEvaluationVariant) {
    category = 'Testing';
    status = 'in_testing';
    primaryCurrency = 'none';
    price = null;
    basePrice = null;
    couponEligible = false;
    couponPrice = null;
    isClone = true;
    obtainMethodText = 'Test / Evaluation Variant';
    const parentShip = findCloneParent(name);
    if (parentShip) {
      cloneOfShipId = parentShip.id;
    }
  }

  // Record into curatedMap
  curatedMap[shipId] = {
    category,
    status,
    primaryCurrency,
    price,
    basePrice,
    couponEligible,
    couponPrice,
    steelEquivalent,
    minDoubloonsRequired,
    totalPhases,
    isClone,
    cloneOfShipId,
    obtainMethodText,
    availabilityNote,
    rarity
  };
}

const outputPath = path.resolve(__dirname, 'acquisition_curated.json');
fs.writeFileSync(outputPath, JSON.stringify(curatedMap, null, 2), 'utf8');

console.log(`[OK] Generated acquisition_curated.json with ${Object.keys(curatedMap).length} ships.`);

// Breakdown
const catCounts = {};
let cloneCount = 0;
for (const v of Object.values(curatedMap)) {
  catCounts[v.category] = (catCounts[v.category] || 0) + 1;
  if (v.isClone) cloneCount++;
}
console.log('Categories breakdown:', catCounts);
console.log('Clones identified:', cloneCount);
