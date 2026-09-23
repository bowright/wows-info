import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SHIPTOOL_BASE_URL = 'https://shiptool.st';
export const SHIPTOOL_REGIONS = ['eu', 'com', 'asia'];
export const SHIPTOOL_SPANS = ['1', '3', 'all'];
export const STATS_DIR = path.resolve(__dirname, '../public/data/stats');
export const STATS_MANIFEST_PATH = path.join(STATS_DIR, 'manifest.json');

const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const MIN_SHIP_COVERAGE = 0.8;

const CLASS_BY_INDEX = {
  A: 'AirCarrier',
  B: 'Battleship',
  C: 'Cruiser',
  D: 'Destroyer',
  S: 'Submarine',
};

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

const EXPECTED_DAMAGE_BY_CLASS = {
  Battleship: [18000, 25000, 32000, 40000, 48000, 56000, 64000, 72000, 82000, 95000, 110000],
  Cruiser: [12000, 16000, 22000, 28000, 35000, 42000, 50000, 58000, 68000, 80000, 92000],
  Destroyer: [10000, 14000, 18000, 23000, 28000, 34000, 40000, 48000, 56000, 65000, 75000],
  AirCarrier: [15000, 20000, 28000, 38000, 48000, 58000, 68000, 80000, 95000, 110000, 125000],
  Submarine: { 6: 32000, 8: 45000, 10: 60000, 11: 72000 },
};

function calculatePR(actual, expected) {
  const expDamage = expected.expectedDamage > 0 ? expected.expectedDamage : 1;
  const expFrags = expected.expectedFrags > 0 ? expected.expectedFrags : 0.8;
  const expWinRate = expected.expectedWinRate > 0 ? expected.expectedWinRate : 50;

  const damageRatio = actual.avgDamage / expDamage;
  const fragsRatio = actual.avgFrags / expFrags;
  const winRatio = actual.winRate / expWinRate;

  const normalizedDamage = Math.max(0, (damageRatio - 0.4) / 0.6);
  const normalizedFrags = Math.max(0, (fragsRatio - 0.1) / 0.9);
  const normalizedWinRate = Math.max(0, (winRatio - 0.7) / 0.3);

  return Math.round(
    700 * normalizedDamage + 300 * normalizedFrags + 150 * normalizedWinRate
  );
}

function expectedFor(metrics, ship) {
  // ShipTool does not publish PR expectation baselines in the public bundle.
  // Use the same class/tier baselines as the local PR calculator instead of
  // deriving an expectation from the observed value for that same ship.
  const classBaselines = EXPECTED_DAMAGE_BY_CLASS[ship?.class];
  const tier = Number(ship?.tier);
  const expectedDamage = Array.isArray(classBaselines)
    ? classBaselines[tier - 1]
    : classBaselines?.[tier];

  return {
    expectedDamage: expectedDamage || Math.max(1, Math.round(metrics.avgDamage * 0.95)),
    expectedWinRate: 50,
    expectedFrags: 0.8,
  };
}

function rawMetricNumber(raw, field) {
  const value = Number(raw?.[field] ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ShipTool metric '${field}' is invalid`);
  }
  return value;
}

function validateRawBracket(raw) {
  if (!raw) return;
  const games = rawMetricNumber(raw, 'games');
  const wins = rawMetricNumber(raw, 'wins');
  const survived = rawMetricNumber(raw, 'surv');
  for (const field of ['damage', 'frags', 'xp', 'spot', 'pot', 'aa']) {
    rawMetricNumber(raw, field);
  }
  if (wins > games || survived > games) {
    throw new Error('ShipTool battle counters exceed the battle count');
  }
}

function metricFromRaw(raw, ship) {
  if (!raw) return null;
  validateRawBracket(raw);
  const games = rawMetricNumber(raw, 'games');
  if (games <= 0) return null;

  const wins = rawMetricNumber(raw, 'wins');
  const damage = rawMetricNumber(raw, 'damage');
  const frags = rawMetricNumber(raw, 'frags');
  const survived = rawMetricNumber(raw, 'surv');
  const xp = rawMetricNumber(raw, 'xp');
  const spotting = rawMetricNumber(raw, 'spot');
  const potential = rawMetricNumber(raw, 'pot');
  const planes = rawMetricNumber(raw, 'aa');

  const metrics = {
    battles: games,
    winRate: round((wins / games) * 100, 2),
    avgDamage: Math.round(damage / games),
    avgFrags: round(frags / games, 2),
    survivalRate: round((survived / games) * 100, 2),
    avgXp: Math.round(xp / games),
    spottingDamage: Math.round(spotting / games),
    potentialDamage: Math.round(potential / games),
    planesDowned: round(planes / games, 1),
    wins,
    damage,
    frags,
    survived,
    xp,
    spotting,
    potential,
    planes,
  };

  metrics.pr = calculatePR(metrics, expectedFor(metrics, ship));
  return metrics;
}

function emptyMetrics() {
  return {
    battles: 0,
    winRate: 0,
    avgDamage: 0,
    avgFrags: 0,
    survivalRate: 0,
    avgXp: 0,
    spottingDamage: 0,
    potentialDamage: 0,
    planesDowned: 0,
    wins: 0,
    damage: 0,
    frags: 0,
    survived: 0,
    xp: 0,
    spotting: 0,
    potential: 0,
    planes: 0,
    pr: 0,
  };
}

function aggregateMetrics(rawBrackets, ship) {
  const nonEmpty = rawBrackets.filter((bracket) => finiteNumber(bracket?.games) > 0);
  if (nonEmpty.length === 0) return null;
  for (const bracket of nonEmpty) validateRawBracket(bracket);

  const totals = nonEmpty.reduce(
    (sum, bracket) => {
      sum.games += finiteNumber(bracket.games);
      sum.wins += finiteNumber(bracket.wins);
      sum.damage += finiteNumber(bracket.damage);
      sum.frags += finiteNumber(bracket.frags);
      sum.survived += finiteNumber(bracket.surv);
      sum.xp += finiteNumber(bracket.xp);
      sum.spotting += finiteNumber(bracket.spot);
      sum.potential += finiteNumber(bracket.pot);
      sum.planes += finiteNumber(bracket.aa);
      return sum;
    },
    {
      games: 0,
      wins: 0,
      damage: 0,
      frags: 0,
      survived: 0,
      xp: 0,
      spotting: 0,
      potential: 0,
      planes: 0,
    }
  );

  return metricFromRaw({
    games: totals.games,
    wins: totals.wins,
    damage: totals.damage,
    frags: totals.frags,
    surv: totals.survived,
    xp: totals.xp,
    spot: totals.spotting,
    pot: totals.potential,
    aa: totals.planes,
  }, ship);
}

class ShipToolLiteralParser {
  constructor(source) {
    this.source = source;
    this.index = 0;
  }

  skipWhitespace() {
    while (/\s/.test(this.source[this.index] || '')) this.index++;
  }

  parse() {
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.index !== this.source.length) throw new Error('Unexpected trailing ShipTool literal data');
    return value;
  }

  parseValue() {
    this.skipWhitespace();
    const char = this.source[this.index];
    if (char === '[') return this.parseArray();
    if (char === '{') return this.parseObject();
    if (char === '`' || char === '"' || char === "'") return this.parseString();
    if (char === '-' || /[0-9]/.test(char || '')) return this.parseNumber();
    return this.parseIdentifier();
  }

  parseArray() {
    this.index++;
    const values = [];
    while (true) {
      this.skipWhitespace();
      if (this.source[this.index] === ']') {
        this.index++;
        return values;
      }
      values.push(this.parseValue());
      this.skipWhitespace();
      if (this.source[this.index] === ',') {
        this.index++;
        continue;
      }
      if (this.source[this.index] === ']') {
        this.index++;
        return values;
      }
      throw new Error('Expected a comma or closing bracket in ShipTool array');
    }
  }

  parseObject() {
    this.index++;
    const value = {};
    while (true) {
      this.skipWhitespace();
      if (this.source[this.index] === '}') {
        this.index++;
        return value;
      }
      const key = this.parseKey();
      this.skipWhitespace();
      if (this.source[this.index] !== ':') throw new Error('Expected a colon in ShipTool object');
      this.index++;
      value[key] = this.parseValue();
      this.skipWhitespace();
      if (this.source[this.index] === ',') {
        this.index++;
        continue;
      }
      if (this.source[this.index] === '}') {
        this.index++;
        return value;
      }
      throw new Error('Expected a comma or closing brace in ShipTool object');
    }
  }

  parseKey() {
    this.skipWhitespace();
    const char = this.source[this.index];
    if (char === '`' || char === '"' || char === "'") return this.parseString();
    const start = this.index;
    while (/[A-Za-z0-9_$]/.test(this.source[this.index] || '')) this.index++;
    if (start === this.index) throw new Error('Expected an object key in ShipTool literal');
    return this.source.slice(start, this.index);
  }

  parseString() {
    const quote = this.source[this.index++];
    let value = '';
    while (this.index < this.source.length) {
      const char = this.source[this.index++];
      if (char === quote) return value;
      if (char !== '\\') {
        value += char;
        continue;
      }
      const escaped = this.source[this.index++];
      const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' };
      if (escapes[escaped]) {
        value += escapes[escaped];
      } else if (escaped === 'u') {
        const code = this.source.slice(this.index, this.index + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(code)) throw new Error('Invalid Unicode escape in ShipTool literal');
        value += String.fromCharCode(parseInt(code, 16));
        this.index += 4;
      } else {
        value += escaped;
      }
    }
    throw new Error('Unterminated string in ShipTool literal');
  }

  parseNumber() {
    const match = this.source.slice(this.index).match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!match) throw new Error('Invalid number in ShipTool literal');
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) throw new Error('Non-finite number in ShipTool literal');
    return value;
  }

  parseIdentifier() {
    const start = this.index;
    while (/[A-Za-z0-9_$]/.test(this.source[this.index] || '')) this.index++;
    const identifier = this.source.slice(start, this.index);
    if (identifier === 'true') return true;
    if (identifier === 'false') return false;
    if (identifier === 'null') return null;
    throw new Error(`Unsupported identifier in ShipTool literal: ${identifier}`);
  }
}

export function parseShipToolBundle(source) {
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error('ShipTool bundle is empty');
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_BUNDLE_BYTES) {
    throw new Error(`ShipTool bundle exceeds ${MAX_BUNDLE_BYTES} byte safety limit`);
  }
  if (!source.includes('export{') || !source.includes('brackets:[')) {
    throw new Error('ShipTool bundle does not match the expected aggregate format');
  }

  const metadata = source.match(
    /var\s+e=(`(?:\\.|[^`])*`),t=(`(?:\\.|[^`])*`),n=(`(?:\\.|[^`])*`),r=([^,]+),i=([^,]+),a=\[/
  );
  if (!metadata) {
    throw new Error('ShipTool bundle metadata declaration is not recognized');
  }

  const arrayStart = source.indexOf('[', metadata.index + metadata[0].length - 1);
  let arrayEnd = -1;
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = arrayStart; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '`' || char === '"' || char === "'") {
      quote = char;
    } else if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0) {
        arrayEnd = index + 1;
        break;
      }
    }
  }

  if (arrayStart < 0 || arrayEnd < 0) {
    throw new Error('ShipTool bundle ship array is not balanced');
  }

  const decodeTemplate = (value) => value
    .slice(1, -1)
    .replaceAll('\\`', '`')
    .replaceAll('\\\\', '\\');
  let ships;
  try {
    ships = new ShipToolLiteralParser(source.slice(arrayStart, arrayEnd)).parse();
  } catch (error) {
    throw new Error(`Unable to parse ShipTool bundle: ${error.message}`);
  }

  const parsed = {
    version: decodeTemplate(metadata[1]),
    region: decodeTemplate(metadata[2]),
    span: decodeTemplate(metadata[3]),
    players: Number(metadata[4]),
    games: Number(metadata[5]),
    ships,
  };
  if (
    !parsed ||
    typeof parsed.version !== 'string' ||
    typeof parsed.region !== 'string' ||
    typeof parsed.span !== 'string' ||
    !Array.isArray(parsed.ships)
  ) {
    throw new Error('ShipTool bundle did not produce the expected metadata');
  }

  return parsed;
}

export function extractStatsAssetMap(entrySource) {
  if (typeof entrySource !== 'string' || entrySource.length === 0) {
    throw new Error('ShipTool entry bundle is empty');
  }
  if (Buffer.byteLength(entrySource, 'utf8') > MAX_ENTRY_BYTES) {
    throw new Error(`ShipTool entry bundle exceeds ${MAX_ENTRY_BYTES} byte safety limit`);
  }

  const assets = {};
  const keyPattern = /["']\.\.\/\.\.\/assets\/(stats-(?:eu|com|asia)-(?:1|3|all)\.json)["']\s*:/g;
  let match;

  while ((match = keyPattern.exec(entrySource)) !== null) {
    const tail = entrySource.slice(match.index, match.index + 2_000);
    const importMatch = tail.match(/import\(\s*[`"']\.\/([^`"']+)[`"']\s*\)/);
    if (!importMatch) continue;
    assets[match[1]] = importMatch[1];
  }

  const missing = [];
  for (const region of SHIPTOOL_REGIONS) {
    for (const span of SHIPTOOL_SPANS) {
      const key = `stats-${region}-${span}.json`;
      if (!assets[key]) missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`ShipTool entry is missing public statistics assets: ${missing.join(', ')}`);
  }

  return assets;
}

function loadCatalog() {
  const catalogPath = path.resolve(__dirname, '../public/data/catalog.json');
  if (!fs.existsSync(catalogPath)) {
    throw new Error('public/data/catalog.json is required before syncing ShipTool statistics');
  }
  const catalogSource = fs.readFileSync(catalogPath, 'utf8');
  const catalog = JSON.parse(catalogSource);
  return {
    catalogById: new Map(catalog.map((ship) => [Number(ship.id), ship])),
    fingerprint: createHash('sha256').update(catalogSource).digest('hex'),
  };
}

export function transformShipToolBundle(bundle, catalogById, sourceAsset) {
  const stats = [];
  let skipped = 0;

  for (const rawShip of bundle.ships) {
    const shipId = Number(rawShip.id);
    const catalogShip = catalogById.get(shipId);
    if (!catalogShip || !Array.isArray(rawShip.brackets)) {
      skipped++;
      continue;
    }

    const all = aggregateMetrics(rawShip.brackets, catalogShip);
    if (!all) {
      skipped++;
      continue;
    }

    // The public bundle stores the three coarse groups in slots 0, 3, and 6.
    // Keep absent groups empty rather than duplicating a small sample into
    // every bracket.
    const low = metricFromRaw(rawShip.brackets[0], catalogShip) || emptyMetrics();
    const medium = metricFromRaw(rawShip.brackets[3], catalogShip) || emptyMetrics();
    const high = metricFromRaw(rawShip.brackets[6], catalogShip) || emptyMetrics();
    const expected = expectedFor(all, catalogShip);

    stats.push({
      shipId,
      name: catalogShip.name || rawShip.index || rawShip.name,
      dispName: catalogShip.dispName || rawShip.name,
      tier: Number(catalogShip.tier ?? rawShip.tier),
      class: catalogShip.class || CLASS_BY_INDEX[String(rawShip.index || '').charAt(3)] || 'Cruiser',
      nation: catalogShip.nation || 'Unknown',
      category: catalogShip.acquisition?.category || 'Tech Tree',
      ...all,
      expectedDamage: expected.expectedDamage,
      expectedWinRate: expected.expectedWinRate,
      expectedFrags: expected.expectedFrags,
      brackets: { all, low, medium, high },
    });
  }

  if (stats.length === 0 || stats.length / catalogById.size < MIN_SHIP_COVERAGE) {
    throw new Error(
      `ShipTool ${bundle.region}/${bundle.span} coverage is too low ` +
      `(${stats.length}/${catalogById.size}; minimum ${MIN_SHIP_COVERAGE})`
    );
  }

  return {
    server: bundle.region,
    span: bundle.span,
    updatedAt: new Date().toISOString(),
    source: 'shiptool',
    sourceVersion: bundle.version,
    sourcePlayers: finiteNumber(bundle.players),
    sourceGames: finiteNumber(bundle.games),
    sourceAsset,
    totalShips: stats.length,
    skippedShips: skipped,
    stats,
  };
}

async function fetchText(url, { etag, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const parsedUrl = new URL(url);
  if (parsedUrl.origin !== SHIPTOOL_BASE_URL) {
    throw new Error(`Refusing non-ShipTool URL: ${url}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      Accept: 'text/html, text/javascript, application/javascript;q=0.9, */*;q=0.1',
      'User-Agent': 'wows-info-stats-sync/1.0',
    };
    if (etag) headers['If-None-Match'] = etag;

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'error',
    });
    if (response.status === 304) {
      return { status: 304, body: null, etag, lastModified: null };
    }
    if (!response.ok) {
      throw new Error(`ShipTool request failed (${response.status}) for ${url}`);
    }

    const contentLength = Number(response.headers.get('content-length'));
    const maxBytes = url.endsWith('.js') ? MAX_BUNDLE_BYTES : MAX_ENTRY_BYTES;
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`ShipTool response exceeds ${maxBytes} byte safety limit`);
    }

    const reader = response.body?.getReader();
    const chunks = [];
    let totalBytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw new Error(`ShipTool response exceeds ${maxBytes} byte safety limit`);
        }
        chunks.push(Buffer.from(value));
      }
    }

    return {
      status: response.status,
      body: Buffer.concat(chunks).toString('utf8'),
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  } finally {
    clearTimeout(timer);
  }
}

function readManifest() {
  if (!fs.existsSync(STATS_MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATS_MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function storageDirectory(manifest) {
  const storagePath = typeof manifest?.storagePath === 'string' && manifest.storagePath.length > 0
    ? manifest.storagePath
    : '';
  const resolved = path.resolve(STATS_DIR, storagePath);
  const statsRoot = path.resolve(STATS_DIR);
  if (resolved !== statsRoot && !resolved.startsWith(`${statsRoot}${path.sep}`)) {
    throw new Error('Statistics manifest storage path escapes the stats directory');
  }
  return resolved;
}

function hasCachedStats(manifest, catalogFingerprint, catalogSize) {
  if (!manifest || manifest.catalogFingerprint !== catalogFingerprint) return false;
  const storageDirectoryPath = storageDirectory(manifest);
  return SHIPTOOL_REGIONS.every((region) => SHIPTOOL_SPANS.every((span) => {
    const filePath = path.join(storageDirectoryPath, `stats-${region}-${span}.json`);
    if (!fs.existsSync(filePath)) return false;
    try {
      const chunk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (
        chunk.source !== 'shiptool' ||
        chunk.sourceVersion !== manifest.sourceVersion ||
        chunk.server !== region ||
        chunk.span !== span ||
        !Array.isArray(chunk.stats) ||
        chunk.totalShips !== chunk.stats.length ||
        chunk.stats.length / catalogSize < MIN_SHIP_COVERAGE
      ) return false;
      return chunk.stats.every((ship) =>
        Number.isFinite(ship.battles) &&
        ship.battles >= 0 &&
        Number.isFinite(ship.wins) &&
        ship.wins >= 0 &&
        ship.wins <= ship.battles
      );
    } catch {
      return false;
    }
  }));
}

function writeAtomic(filePath, content) {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function markManifestHealthy(manifest, fetchedAt, catalogFingerprint) {
  if (!manifest) return manifest;
  const healthyManifest = {
    ...manifest,
    lastAttemptAt: fetchedAt,
    lastSuccessfulFetchAt: manifest.lastSuccessfulFetchAt || manifest.fetchedAt || fetchedAt,
    stale: false,
    lastError: null,
    catalogFingerprint,
  };
  writeAtomic(STATS_MANIFEST_PATH, JSON.stringify(healthyManifest, null, 2));
  return healthyManifest;
}

function publishChunks(chunks, sourceVersion, publishVersioned) {
  if (!publishVersioned) {
    for (const { key, chunk } of chunks) {
      writeAtomic(path.join(STATS_DIR, key), JSON.stringify(chunk));
    }
    return {
      storagePath: '',
      basePath: '/data/stats',
    };
  }

  const generationId = `${sourceVersion}-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = path.join('versions', generationId);
  const generationDirectory = path.join(STATS_DIR, storagePath);
  fs.mkdirSync(generationDirectory, { recursive: true });

  // The manifest is published only after every file in this generation has
  // been written and validated by transformShipToolBundle.
  for (const { key, chunk } of chunks) {
    writeAtomic(path.join(generationDirectory, key), JSON.stringify(chunk));
  }

  return {
    storagePath,
    basePath: `/data/stats/${storagePath.replaceAll(path.sep, '/')}`,
  };
}

function pruneOldGenerations(currentStoragePath) {
  const versionsDirectory = path.join(STATS_DIR, 'versions');
  if (!fs.existsSync(versionsDirectory)) return;

  const currentName = currentStoragePath.split(path.sep).at(-1);
  const generations = fs.readdirSync(versionsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(versionsDirectory, entry.name);
      return { name: entry.name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const generation of generations.slice(2)) {
    if (generation.name === currentName) continue;
    fs.rmSync(generation.fullPath, { recursive: true, force: true });
  }
}

function entryScriptFromHtml(html) {
  const match = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/i);
  if (!match) throw new Error('ShipTool HTML did not expose a module entry script');
  return new URL(match[1], SHIPTOOL_BASE_URL).toString();
}

export async function syncShipToolStats(options = {}) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  const manifest = readManifest();
  const { catalogById, fingerprint: catalogFingerprint } = loadCatalog();
  const fetchedAt = new Date().toISOString();
  const publishVersioned = options.publishVersioned === true;

  try {
    const htmlResponse = await fetchText(`${SHIPTOOL_BASE_URL}/`, { timeoutMs: options.timeoutMs });
    const entryUrl = entryScriptFromHtml(htmlResponse.body);
    const entryResponse = await fetchText(entryUrl, {
      etag: options.force ? undefined : manifest?.entryEtag,
      timeoutMs: options.timeoutMs,
    });

    if (entryResponse.status === 304 && hasCachedStats(manifest, catalogFingerprint, catalogById.size)) {
      const healthyManifest = markManifestHealthy(manifest, fetchedAt, catalogFingerprint);
      return {
        success: true,
        updated: false,
        stale: false,
        source: 'shiptool',
        sourceVersion: manifest.sourceVersion,
        fetchedAt,
        manifest: healthyManifest,
      };
    }

    const resolvedEntryResponse = entryResponse.status === 304
      ? await fetchText(entryUrl, { timeoutMs: options.timeoutMs })
      : entryResponse;
    const assetMap = extractStatsAssetMap(resolvedEntryResponse.body);
    const sameAssets = manifest && SHIPTOOL_REGIONS.every((region) =>
      SHIPTOOL_SPANS.every((span) => {
        const key = `stats-${region}-${span}.json`;
        return manifest.assets?.[key]?.asset === assetMap[key];
      })
    );
    if (sameAssets && hasCachedStats(manifest, catalogFingerprint, catalogById.size)) {
      const healthyManifest = markManifestHealthy(manifest, fetchedAt, catalogFingerprint);
      return {
        success: true,
        updated: false,
        stale: false,
        source: 'shiptool',
        sourceVersion: manifest.sourceVersion,
        fetchedAt,
        manifest: healthyManifest,
      };
    }
    const chunks = [];
    const assets = {};

    for (const region of SHIPTOOL_REGIONS) {
      for (const span of SHIPTOOL_SPANS) {
        const key = `stats-${region}-${span}.json`;
        const assetName = assetMap[key];
        const assetUrl = `${SHIPTOOL_BASE_URL}/assets/${assetName}`;
        const assetResponse = await fetchText(assetUrl, { timeoutMs: options.timeoutMs });
        const bundle = parseShipToolBundle(assetResponse.body);

        if (bundle.region !== region || bundle.span !== span) {
          throw new Error(`ShipTool bundle metadata mismatch for ${key}`);
        }

        const chunk = transformShipToolBundle(bundle, catalogById, assetUrl);
        chunks.push({ key, chunk });
        assets[key] = {
          asset: assetName,
          url: assetUrl,
          version: bundle.version,
          lastModified: assetResponse.lastModified,
        };
      }
    }

    const sourceVersions = [...new Set(chunks.map(({ chunk }) => chunk.sourceVersion))];
    if (sourceVersions.length !== 1) {
      throw new Error(`ShipTool returned inconsistent versions: ${sourceVersions.join(', ')}`);
    }

    const publication = publishChunks(chunks, sourceVersions[0], publishVersioned);

    const nextManifest = {
      schemaVersion: 1,
      source: 'shiptool',
      sourceVersion: sourceVersions[0],
      fetchedAt,
      lastAttemptAt: fetchedAt,
      lastSuccessfulFetchAt: fetchedAt,
      stale: false,
      lastError: null,
      catalogFingerprint,
      storagePath: publication.storagePath,
      basePath: publication.basePath,
      entryUrl,
      entryEtag: resolvedEntryResponse.etag,
      entryLastModified: resolvedEntryResponse.lastModified,
      spans: SHIPTOOL_SPANS,
      regions: SHIPTOOL_REGIONS,
      assets,
      totalChunks: chunks.length,
    };
    writeAtomic(STATS_MANIFEST_PATH, JSON.stringify(nextManifest, null, 2));
    if (publishVersioned) {
      try {
        pruneOldGenerations(publication.storagePath);
      } catch (error) {
        console.warn(`[ShipToolSync] Unable to prune old generations: ${error.message}`);
      }
    }

    return {
      success: true,
      updated: true,
      stale: false,
      source: 'shiptool',
      sourceVersion: sourceVersions[0],
      fetchedAt,
      manifest: nextManifest,
    };
  } catch (error) {
    const message = error?.message || String(error);
    let cacheAvailable = false;
    try {
      cacheAvailable = Boolean(manifest && hasCachedStats(manifest, catalogFingerprint, catalogById.size));
    } catch {
      cacheAvailable = false;
    }
    if (cacheAvailable) {
      const staleManifest = {
        ...manifest,
        lastAttemptAt: fetchedAt,
        stale: true,
        lastError: message,
      };
      writeAtomic(STATS_MANIFEST_PATH, JSON.stringify(staleManifest, null, 2));
      return {
        success: true,
        updated: false,
        stale: true,
        source: 'shiptool-cache',
        sourceVersion: manifest.sourceVersion || null,
        fetchedAt,
        error: message,
        manifest: staleManifest,
      };
    }
    return {
      success: false,
      updated: false,
      stale: true,
      source: 'shiptool',
      sourceVersion: null,
      fetchedAt,
      error: message,
    };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const force = process.argv.includes('--force');
  syncShipToolStats({ force })
    .then((result) => {
      if (result.error) console.warn(`[ShipToolSync] ${result.error}`);
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) process.exitCode = 1;
    })
    .catch((error) => {
      console.error('[ShipToolSync] Failed:', error);
      process.exitCode = 1;
    });
}
