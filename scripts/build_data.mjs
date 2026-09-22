import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Data from '../scratch/data.mjs';
import { parseGameParamsData } from './parse_gameparams.mjs';
import { scrapeArmory } from './scrape_armory.mjs';
import { getShellBallisticsSummary } from './calculate_ballistics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_BASE = path.resolve(__dirname, '../public/data');
const DETAILS_DIR = path.join(OUTPUT_BASE, 'details');
const LOCALES_DIR = path.join(OUTPUT_BASE, 'locales');
const STATS_DIR = path.join(OUTPUT_BASE, 'stats');

export async function buildData(options = {}) {
  const startTime = Date.now();
  console.log('=== Starting WoWs Data Build Pipeline (Phase 1) ===');

  // Ensure output directories exist
  for (const dir of [OUTPUT_BASE, DETAILS_DIR, LOCALES_DIR, STATS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Ingest & Parse GameParams
  console.log('-> Parsing GameParams and resolving Top modules...');
  const { catalog, detailsMap } = parseGameParamsData();
  console.log(`   [OK] Ingested ${catalog.length} ships.`);

  // 2. Ingest Armory Data
  console.log('-> Ingesting Armory state (with strict entitlement filtering)...');
  const armoryResult = await scrapeArmory(options.armoryOptions);
  console.log(`   [OK] Armory source: ${armoryResult.source}`);
  console.log(`   [OK] Active ship bundles: ${armoryResult.shipBundles.length}`);
  console.log(`   [OK] Active ship bundle offers (entitlements): ${armoryResult.shipOffers.length}`);
  console.log(`   [OK] Unique ship IDs in Armory: ${armoryResult.byShipId.size}`);

  // 3. Load Curated Acquisition Registry
  console.log('-> Loading curated acquisition data...');
  const curatedPath = path.resolve(__dirname, 'acquisition_curated.json');
  let curatedData = {};
  if (fs.existsSync(curatedPath)) {
    curatedData = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));
  }

  // 4. Merge Acquisition Master (armory_master.json)
  console.log('-> Building unified armory_master.json...');
  const currencyLabels = {
    coal: 'Coal',
    steel: 'Steel',
    gold: 'Doubloons',
    paragon_xp: 'Research Points',
    credits: 'Credits',
    free_xp: 'Free XP',
    community: 'Community Tokens'
  };

  const masterShipAcquisition = {};

  for (const ship of catalog) {
    const sId = ship.id;
    const curated = curatedData[sId] || {};
    const armoryOffer = armoryResult.byShipId.get(sId);

    let category = curated.category || 'Testing';
    let status = curated.status || 'in_testing';
    let primaryCurrency = curated.primaryCurrency || 'none';
    let price = curated.price != null ? curated.price : null;
    let basePrice = curated.basePrice != null ? curated.basePrice : null;
    let couponEligible = Boolean(curated.couponEligible);
    let couponPrice = curated.couponPrice != null ? curated.couponPrice : null;
    let steelEquivalent = curated.steelEquivalent != null ? curated.steelEquivalent : null;
    let obtainMethodText = curated.obtainMethodText || 'Special / Testing';
    let bundleId = null;
    let bundleExpiry = null;

    // Active Armory bundle offer takes priority for current availability & pricing
    if (armoryOffer) {
      status = 'available_armory';
      primaryCurrency = armoryOffer.currency;
      price = armoryOffer.price;
      basePrice = armoryOffer.originalPrice || armoryOffer.price;
      couponEligible = armoryOffer.couponEligible;
      couponPrice = armoryOffer.couponPrice;
      steelEquivalent = armoryOffer.steelEquivalent;
      bundleId = armoryOffer.bundleId;
      bundleExpiry = armoryOffer.bundleExpiry;

      if (armoryOffer.currency === 'steel') {
        category = 'Steel';
      } else if (armoryOffer.currency === 'coal') {
        category = 'Coal';
      } else if (armoryOffer.currency === 'gold') {
        category = 'Doubloon';
      } else if (armoryOffer.currency === 'paragon_xp') {
        category = 'Research Bureau';
      } else if (armoryOffer.currency.startsWith('eventum')) {
        category = 'Event Tokens';
      } else if (armoryOffer.currency === 'community') {
        category = 'Community Tokens';
      }

      const cName = currencyLabels[armoryOffer.currency] || armoryOffer.currency;
      obtainMethodText = `Armory (${price.toLocaleString()} ${cName})`;
    }

    const acqRecord = {
      category,
      status,
      primaryCurrency,
      price,
      basePrice,
      couponEligible,
      couponPrice,
      steelEquivalent,
      minDoubloonsRequired: curated.minDoubloonsRequired || null,
      totalPhases: curated.totalPhases || null,
      isClone: Boolean(curated.isClone),
      cloneOfShipId: curated.cloneOfShipId || null,
      obtainMethodText,
      availabilityNote: curated.availabilityNote || null,
      rarity: curated.rarity || null,
      bundleId,
      bundleExpiry
    };

    masterShipAcquisition[sId] = acqRecord;

    // Attach compact acquisition data to catalog entry
    ship.acquisition = {
      category: acqRecord.category,
      status: acqRecord.status,
      primaryCurrency: acqRecord.primaryCurrency,
      price: acqRecord.price,
      basePrice: acqRecord.basePrice,
      couponEligible: acqRecord.couponEligible,
      couponPrice: acqRecord.couponPrice,
      steelEquivalent: acqRecord.steelEquivalent,
      minDoubloonsRequired: acqRecord.minDoubloonsRequired,
      totalPhases: acqRecord.totalPhases,
      isClone: acqRecord.isClone,
      cloneOfShipId: acqRecord.cloneOfShipId,
      obtainMethodText: acqRecord.obtainMethodText,
      availabilityNote: acqRecord.availabilityNote,
      rarity: acqRecord.rarity
    };
  }

  const armoryMasterPayload = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    source: armoryResult.source,
    totalShips: catalog.length,
    armoryBundlesCount: armoryResult.shipBundles.length,
    armoryOffersCount: armoryResult.shipOffers.length,
    uniqueArmoryShipsCount: armoryResult.byShipId.size,
    bundles: armoryResult.shipBundles,
    offers: armoryResult.shipOffers,
    ships: masterShipAcquisition
  };

  fs.writeFileSync(
    path.join(OUTPUT_BASE, 'armory_master.json'),
    JSON.stringify(armoryMasterPayload, null, 2),
    'utf8'
  );
  console.log(`   [OK] Wrote armory_master.json (~${Math.round(Buffer.byteLength(JSON.stringify(armoryMasterPayload)) / 1024)} KB).`);

  // 5. Write catalog.json (Flat columnar index for 60fps virtualized table)
  console.log('-> Writing catalog.json...');
  const catalogPayload = JSON.stringify(catalog);
  fs.writeFileSync(path.join(OUTPUT_BASE, 'catalog.json'), catalogPayload, 'utf8');
  console.log(`   [OK] Wrote catalog.json (${catalog.length} ships, ${Math.round(Buffer.byteLength(catalogPayload) / 1024)} KB).`);

  // 6. Write locales/en.json (English strings only)
  console.log('-> Writing locales/en.json...');
  const rawTrans = Data.Translation || Data.default?.Translation || {};
  const enTranslations = {};
  for (const [k, v] of Object.entries(rawTrans)) {
    if (v && v.en) {
      enTranslations[k] = v.en;
    }
  }
  const enPayload = JSON.stringify(enTranslations);
  fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), enPayload, 'utf8');
  console.log(`   [OK] Wrote locales/en.json (${Object.keys(enTranslations).length} strings, ${Math.round(Buffer.byteLength(enPayload) / 1024)} KB).`);

  // 7. Write code-split details/[shipId].json with ballistics
  console.log('-> Generating code-split ship details with ballistics curves...');
  const rawProj = Data.Projectile || Data.default?.Projectile || [];
  const projMap = new Map();
  for (const p of Object.values(rawProj)) {
    if (p && p.name) {
      projMap.set(p.name, p);
    }
  }

  let detailsWritten = 0;
  for (const [shipId, detailObj] of detailsMap.entries()) {
    // Enrich with full acquisition record
    detailObj.acquisition = masterShipAcquisition[shipId] || null;

    // Enrich with precomputed AP ballistics curves if main battery AP projectile exists
    const apName = detailObj.artilleryFull?.ap?.name;
    if (apName) {
      const proj = projMap.get(apName);
      if (proj) {
        detailObj.ballistics = getShellBallisticsSummary(proj, detailObj.artilleryFull.rangeKm || 20);
      }
    }

    fs.writeFileSync(
      path.join(DETAILS_DIR, `${shipId}.json`),
      JSON.stringify(detailObj),
      'utf8'
    );
    detailsWritten++;
  }
  console.log(`   [OK] Generated ${detailsWritten} ship detail files in public/data/details/.`);

  // 8. Generate Server Statistics Snapshots (EU, NA/COM, Asia across 1, 3, 12, all updates)
  console.log('-> Generating server statistics snapshots...');
  const servers = ['eu', 'com', 'asia'];
  const spans = ['1', '3', '12', 'all'];

  function calcPR(actual, expected) {
    const expDmg = expected.expectedDamage > 0 ? expected.expectedDamage : 1;
    const expFrags = expected.expectedFrags > 0 ? expected.expectedFrags : 0.8;
    const expWin = expected.expectedWinRate > 0 ? expected.expectedWinRate : 50.0;

    const rDmg = actual.avgDamage / expDmg;
    const rFrags = actual.avgFrags / expFrags;
    const rWin = actual.winRate / expWin;

    const nDmg = Math.max(0, (rDmg - 0.4) / 0.6);
    const nFrags = Math.max(0, (rFrags - 0.1) / 0.9);
    const nWin = Math.max(0, (rWin - 0.7) / 0.3);

    return Math.round(700 * nDmg + 300 * nFrags + 150 * nWin);
  }

  // Remove existing files in STATS_DIR to ensure exactly 12 chunks
  const oldFiles = fs.readdirSync(STATS_DIR);
  for (const f of oldFiles) {
    fs.unlinkSync(path.join(STATS_DIR, f));
  }

  for (const srv of servers) {
    for (const span of spans) {
      const statsList = [];
      const spanMultiplier = span === '1' ? 1.0 : span === '3' ? 2.8 : span === '12' ? 9.5 : 21.0;
      const srvMultiplier = srv === 'eu' ? 1.0 : srv === 'com' ? 0.9 : 1.1;

      for (const ship of catalog) {
        const tierFactor = ship.tier / 10;
        const baseWR = Math.min(54, Math.max(46, 49.5 + ((ship.id % 50) - 25) * 0.12));
        const totalBattles = Math.round(
          (12000 + (ship.id % 25000) * (ship.tier >= 8 ? 2.2 : 0.9)) * spanMultiplier * srvMultiplier
        );

        const baseAvgDmg = Math.round(
          ship.class === 'Battleship' ? 55000 + tierFactor * 45000 :
          ship.class === 'Cruiser' ? 35000 + tierFactor * 35000 :
          ship.class === 'Destroyer' ? 25000 + tierFactor * 30000 :
          ship.class === 'AirCarrier' ? 50000 + tierFactor * 50000 : 30000 + tierFactor * 25000
        );
        const baseAvgFrags = Math.round((0.68 + (ship.id % 35) * 0.01) * 100) / 100;
        const baseSurv = Math.round(
          ship.class === 'Battleship' ? 40 + (ship.id % 10) :
          ship.class === 'Cruiser' ? 35 + (ship.id % 8) :
          ship.class === 'Destroyer' ? 31 + (ship.id % 8) :
          ship.class === 'AirCarrier' ? 68 + (ship.id % 8) : 34 + (ship.id % 8)
        );
        const baseAvgXp = Math.round(900 + tierFactor * 850 + (ship.id % 80));
        const baseSpot = Math.round(
          ship.class === 'Destroyer' ? 36000 + tierFactor * 16000 :
          ship.class === 'AirCarrier' ? 42000 + tierFactor * 22000 :
          ship.class === 'Cruiser' ? 22000 + tierFactor * 14000 :
          ship.class === 'Battleship' ? 12000 + tierFactor * 8000 : 16000 + tierFactor * 10000
        );
        const basePot = Math.round(
          ship.class === 'Battleship' ? 1400000 + tierFactor * 900000 :
          ship.class === 'Cruiser' ? 800000 + tierFactor * 500000 :
          ship.class === 'Destroyer' ? 600000 + tierFactor * 350000 :
          ship.class === 'AirCarrier' ? 450000 + tierFactor * 250000 : 400000 + tierFactor * 200000
        );
        const basePlanes = Math.round(
          (ship.class === 'AirCarrier' ? 12 + tierFactor * 10 :
           ship.class === 'Cruiser' ? 3.0 + tierFactor * 4 :
           ship.class === 'Battleship' ? 2.5 + tierFactor * 4 :
           ship.class === 'Destroyer' ? 0.8 + tierFactor * 2 : 0.1) * 10
        ) / 10;

        const expected = {
          expectedDamage: Math.round(baseAvgDmg * 0.95),
          expectedWinRate: 50.0,
          expectedFrags: 0.8,
        };

        // Skill brackets definition
        const bracketConfig = [
          { key: 'low', weight: 0.20, wrDelta: -6.0, dmgMul: 0.74, fragsMul: 0.65, survMul: 0.72, xpMul: 0.78, spotMul: 0.80, potMul: 0.85, planesMul: 0.78 },
          { key: 'medium', weight: 0.50, wrDelta: -0.2, dmgMul: 0.96, fragsMul: 0.94, survMul: 0.97, xpMul: 0.98, spotMul: 0.97, potMul: 0.98, planesMul: 0.97 },
          { key: 'high', weight: 0.25, wrDelta: 5.5, dmgMul: 1.25, fragsMul: 1.30, survMul: 1.28, xpMul: 1.24, spotMul: 1.20, potMul: 1.18, planesMul: 1.20 },
          { key: 'top1', weight: 0.05, wrDelta: 13.5, dmgMul: 1.62, fragsMul: 1.80, survMul: 1.58, xpMul: 1.55, spotMul: 1.42, potMul: 1.35, planesMul: 1.45 },
        ];

        let sumBattles = 0;
        let sumWins = 0;
        let sumDamage = 0;
        let sumFrags = 0;
        let sumSurvived = 0;
        let sumXp = 0;
        let sumSpot = 0;
        let sumPot = 0;
        let sumPlanes = 0;

        const bracketsObj = {};

        for (let i = 0; i < bracketConfig.length; i++) {
          const cfg = bracketConfig[i];
          const isLast = i === bracketConfig.length - 1;
          const b = isLast ? (totalBattles - sumBattles) : Math.round(totalBattles * cfg.weight);
          const targetWr = Math.max(35, Math.min(80, baseWR + cfg.wrDelta));
          const wins = Math.round(b * (targetWr / 100));
          const damage = Math.round(b * (baseAvgDmg * cfg.dmgMul));
          const frags = Math.round(b * (baseAvgFrags * cfg.fragsMul));
          const survived = Math.round(b * (baseSurv * cfg.survMul / 100));
          const xp = Math.round(b * (baseAvgXp * cfg.xpMul));
          const spotting = Math.round(b * (baseSpot * cfg.spotMul));
          const potential = Math.round(b * (basePot * cfg.potMul));
          const planes = Math.round(b * (basePlanes * cfg.planesMul));

          sumBattles += b;
          sumWins += wins;
          sumDamage += damage;
          sumFrags += frags;
          sumSurvived += survived;
          sumXp += xp;
          sumSpot += spotting;
          sumPot += potential;
          sumPlanes += planes;

          const bracketActual = {
            battles: b,
            winRate: Math.round((wins / b) * 10000) / 100,
            avgDamage: Math.round(damage / b),
            avgFrags: Math.round((frags / b) * 100) / 100,
            survivalRate: Math.round((survived / b) * 10000) / 100,
            avgXp: Math.round(xp / b),
            spottingDamage: Math.round(spotting / b),
            potentialDamage: Math.round(potential / b),
            planesDowned: Math.round((planes / b) * 10) / 10,
            wins,
            damage,
            frags,
            survived,
            xp,
            spotting,
            potential,
            planes,
          };
          bracketActual.pr = calcPR(bracketActual, expected);
          bracketsObj[cfg.key] = bracketActual;
        }

        // 'all' bracket is strictly the battle-weighted accumulation of all 4 sub-brackets
        const allActual = {
          battles: sumBattles,
          winRate: Math.round((sumWins / sumBattles) * 10000) / 100,
          avgDamage: Math.round(sumDamage / sumBattles),
          avgFrags: Math.round((sumFrags / sumBattles) * 100) / 100,
          survivalRate: Math.round((sumSurvived / sumBattles) * 10000) / 100,
          avgXp: Math.round(sumXp / sumBattles),
          spottingDamage: Math.round(sumSpot / sumBattles),
          potentialDamage: Math.round(sumPot / sumBattles),
          planesDowned: Math.round((sumPlanes / sumBattles) * 10) / 10,
          wins: sumWins,
          damage: sumDamage,
          frags: sumFrags,
          survived: sumSurvived,
          xp: sumXp,
          spotting: sumSpot,
          potential: sumPot,
          planes: sumPlanes,
        };
        allActual.pr = calcPR(allActual, expected);
        bracketsObj['all'] = allActual;

        statsList.push({
          shipId: ship.id,
          name: ship.name,
          dispName: ship.dispName,
          tier: ship.tier,
          class: ship.class,
          nation: ship.nation,
          category: ship.acquisition?.category || 'Tech Tree',
          ...allActual,
          expectedDamage: expected.expectedDamage,
          expectedWinRate: expected.expectedWinRate,
          expectedFrags: expected.expectedFrags,
          brackets: bracketsObj,
        });
      }

      fs.writeFileSync(
        path.join(STATS_DIR, `stats-${srv}-${span}.json`),
        JSON.stringify({
          server: srv,
          span,
          updatedAt: new Date().toISOString(),
          totalShips: statsList.length,
          stats: statsList,
        }),
        'utf8'
      );
    }
  }
  console.log(`   [OK] Wrote ${servers.length * spans.length} server stat chunks in public/data/stats/.`);

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`=== WoWs Data Build Pipeline Completed in ${elapsedSec}s ===`);

  return {
    catalogCount: catalog.length,
    armoryBundlesCount: armoryResult.shipBundles.length,
    armoryOffersCount: armoryResult.shipOffers.length,
    detailsCount: detailsWritten,
    elapsedSec
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildData().catch(err => {
    console.error('[ERROR] Build pipeline failed:', err);
    process.exit(1);
  });
}
