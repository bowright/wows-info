import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ARMORY_URL = 'https://armory.worldofwarships.eu/en/';
export const DEFAULT_SNAPSHOT_PATHS = [
  path.resolve(__dirname, '../scratch/armory.html'),
  path.resolve(__dirname, '../../../../brain/97a87afa-13d4-4b68-8c2d-42d8aa3e1bb6/scratch/armory.html')
];

/**
 * Extracts and parses the `const _state = { ... };` embedded JSON from the Armory HTML page.
 * @param {string} html 
 * @returns {object}
 */
export function parseArmoryHtml(html) {
  const startToken = 'const _state = ';
  const idx = html.indexOf(startToken);
  if (idx === -1) {
    throw new Error('Could not find const _state token in armory HTML');
  }
  let endIdx = html.indexOf(';\n', idx);
  if (endIdx === -1) {
    endIdx = html.indexOf(';\r\n', idx);
  }
  if (endIdx === -1) {
    endIdx = html.indexOf(';', idx);
  }
  if (endIdx === -1) {
    throw new Error('Could not find closing delimiter for _state in armory HTML');
  }
  const jsonStr = html.substring(idx + startToken.length, endIdx).trim();
  return JSON.parse(jsonStr);
}

/**
 * Normalizes Armory bundles into strict ship offers, filtering out commanders, camos, etc.
 * Enforces: ONLY entitlements where type === 'ship'.
 * @param {object} rawState 
 * @returns {{ shipOffers: Array<object>, shipBundles: Array<object>, byShipId: Map<number, object> }}
 */
export function normalizeArmoryData(rawState) {
  const bundles = rawState?.content?.bundles || {};
  const shipOffers = [];
  const shipBundlesMap = new Map();
  const byShipId = new Map();

  for (const [bId, b] of Object.entries(bundles)) {
    const entitlements = Array.isArray(b.entitlements) ? b.entitlements : [];
    
    // Strict filtering: ONLY entitlements with type === 'ship'
    const shipEntitlements = entitlements.filter(e => e && e.type === 'ship');
    if (shipEntitlements.length === 0) {
      continue;
    }

    const bundleInfo = {
      bundleId: String(bId),
      title: b.title || 'Unknown Bundle',
      description: b.description || null,
      currency: b.currency || 'unknown',
      price: Number(b.price) || 0,
      originalPrice: b.originalPrice != null ? Number(b.originalPrice) : null,
      discount: b.discount != null ? Number(b.discount) : null,
      activeTill: b.activeTill || null,
      totalEntitlements: entitlements.length,
      shipCount: shipEntitlements.length
    };
    shipBundlesMap.set(String(bId), bundleInfo);

    for (const ent of shipEntitlements) {
      const shipId = Number(ent.identifier);
      const isCouponEligible = ['coal', 'steel', 'gold'].includes(bundleInfo.currency);
      const couponPrice = isCouponEligible ? Math.round(bundleInfo.price * 0.75) : bundleInfo.price;
      const steelEquivalent = bundleInfo.currency === 'coal' ? Math.ceil(bundleInfo.price / 10) : null;

      const offer = {
        bundleId: String(bId),
        shipId,
        title: bundleInfo.title,
        currency: bundleInfo.currency,
        price: bundleInfo.price,
        originalPrice: bundleInfo.originalPrice,
        discount: bundleInfo.discount,
        couponEligible: isCouponEligible,
        couponPrice,
        steelEquivalent,
        isPrimary: ent.isPrimary !== false,
        isBonus: Boolean(ent.isBonus),
        bundleExpiry: bundleInfo.activeTill,
        shipClass: ent.customisation?.shipClass || null,
        level: ent.customisation?.level ? Number(ent.customisation.level) : null,
        nation: ent.customisation?.nation || null
      };

      shipOffers.push(offer);

      // Keep the best (or primary/lowest price) offer per shipId
      if (!byShipId.has(shipId) || (byShipId.get(shipId).isBonus && !offer.isBonus)) {
        byShipId.set(shipId, offer);
      }
    }
  }

  return {
    shipOffers,
    shipBundles: Array.from(shipBundlesMap.values()),
    byShipId
  };
}

/**
 * Loads Armory data with fallback: tries live scrape, falls back to local snapshot.
 * @param {object} [options]
 * @returns {Promise<{ shipOffers: Array<object>, shipBundles: Array<object>, byShipId: Map<number, object>, source: 'live' | 'snapshot' }>}
 */
export async function scrapeArmory(options = {}) {
  const timeoutMs = options.timeoutMs ?? 3000;
  const snapshotPaths = options.snapshotPaths ?? DEFAULT_SNAPSHOT_PATHS;
  let html = null;
  let source = 'live';

  if (!options.forceSnapshot) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(ARMORY_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timer);
      if (res.ok) {
        html = await res.text();
      }
    } catch (err) {
      // live fetch failed or timed out, will fallback
    }
  }

  if (!html) {
    source = 'snapshot';
    for (const snapPath of snapshotPaths) {
      if (fs.existsSync(snapPath)) {
        html = fs.readFileSync(snapPath, 'utf8');
        break;
      }
    }
  }

  if (!html) {
    throw new Error('Failed to load Armory HTML from both live URL and local snapshots.');
  }

  const rawState = parseArmoryHtml(html);
  const normalized = normalizeArmoryData(rawState);

  return {
    ...normalized,
    rawState,
    source
  };
}

// CLI execution test
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log('Running scrape_armory.mjs directly...');
  scrapeArmory().then(result => {
    console.log(`[OK] Ingested Armory source: ${result.source}`);
    console.log(`[OK] Total active ship bundles: ${result.shipBundles.length}`);
    console.log(`[OK] Total active ship bundle offers (entitlements): ${result.shipOffers.length}`);
    console.log(`[OK] Unique ship IDs covered: ${result.byShipId.size}`);
    
    // Currency breakdown
    const currencies = {};
    for (const o of result.shipOffers) {
      currencies[o.currency] = (currencies[o.currency] || 0) + 1;
    }
    console.log('Currencies breakdown:', currencies);
  }).catch(err => {
    console.error('[ERROR] Armory scrape failed:', err);
    process.exit(1);
  });
}
