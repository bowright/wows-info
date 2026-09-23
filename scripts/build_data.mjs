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
    community: 'Community Tokens',
    eventum_10: 'Expedition Tokens',
    eventum_6: 'Pan-American Tokens',
    eventum_4: 'Event Tokens'
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
