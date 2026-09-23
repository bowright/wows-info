import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractStatsAssetMap,
  parseShipToolBundle,
  transformShipToolBundle,
} from './sync_shiptool_stats.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const STATS_DIR = path.join(ROOT_DIR, 'public/data/stats');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
  }
}

const sampleBundle = [
  'var e=`0.15.7`,t=`eu`,n=`3`,r=3,i=30,a=[{name:`Demo`,id:1,index:`PASC001`,tier:10,brackets:[',
  '{players:1,games:10,games_510:10,xp:10000,damage:500000,frags:10,wins:4,cap:0,def:0,surv:4,spot:100000,pot:1000000,aa:10},',
  '{players:0,games:0,games_510:0,xp:0,damage:0,frags:0,wins:0,cap:0,def:0,surv:0,spot:0,pot:0,aa:0},',
  '{players:0,games:0,games_510:0,xp:0,damage:0,frags:0,wins:0,cap:0,def:0,surv:0,spot:0,pot:0,aa:0},',
  '{players:1,games:10,games_510:10,xp:12000,damage:600000,frags:12,wins:6,cap:0,def:0,surv:5,spot:120000,pot:1200000,aa:12},',
  '{players:0,games:0,games_510:0,xp:0,damage:0,frags:0,wins:0,cap:0,def:0,surv:0,spot:0,pot:0,aa:0},',
  '{players:0,games:0,games_510:0,xp:0,damage:0,frags:0,wins:0,cap:0,def:0,surv:0,spot:0,pot:0,aa:0},',
  '{players:1,games:10,games_510:10,xp:14000,damage:700000,frags:14,wins:8,cap:0,def:0,surv:6,spot:140000,pot:1400000,aa:14}',
  ']}],o={version:e,region:`eu`,span:`3`,players:r,games:i,ships:a};export{o as default,i as games,r as players,t as region,a as ships,n as span,e as version};',
].join('');

function run() {
  console.log('=== ShipTool Statistics Sync Verification ===\n');

  const parsed = parseShipToolBundle(sampleBundle);
  assert(parsed.version === '0.15.7', 'Parses ShipTool version');
  assert(parsed.region === 'eu' && parsed.span === '3', 'Parses ShipTool region and span');
  assert(parsed.ships.length === 1, 'Parses aggregate ship records');

  const entry = [
    'Object.assign({',
    '"../../assets/stats-eu-1.json":()=>import(`./stats-eu-1-example.js`),',
    '"../../assets/stats-eu-3.json":()=>import(`./stats-eu-3-example.js`),',
    '"../../assets/stats-eu-all.json":()=>import(`./stats-eu-all-example.js`),',
    '"../../assets/stats-com-1.json":()=>import(`./stats-com-1-example.js`),',
    '"../../assets/stats-com-3.json":()=>import(`./stats-com-3-example.js`),',
    '"../../assets/stats-com-all.json":()=>import(`./stats-com-all-example.js`),',
    '"../../assets/stats-asia-1.json":()=>import(`./stats-asia-1-example.js`),',
    '"../../assets/stats-asia-3.json":()=>import(`./stats-asia-3-example.js`),',
    '"../../assets/stats-asia-all.json":()=>import(`./stats-asia-all-example.js`)',
    '})',
  ].join('');
  const assetMap = extractStatsAssetMap(entry);
  assert(Object.keys(assetMap).length === 9, 'Extracts all 9 public region/span assets');

  const catalog = new Map([[
    1,
    {
      id: 1,
      name: 'PASC001_Demo',
      dispName: 'Demo',
      tier: 10,
      class: 'Cruiser',
      nation: 'USA',
      acquisition: { category: 'Tech Tree' },
    },
  ]]);
  const chunk = transformShipToolBundle(parsed, catalog, 'https://shiptool.st/assets/demo.js');
  assert(chunk.source === 'shiptool', 'Transformed chunk records its source');
  assert(chunk.totalShips === 1, 'Transforms catalog-matched ship records');
  assert(chunk.stats[0].brackets.all.battles === 30, 'Aggregates all public skill groups');
  assert(chunk.stats[0].brackets.all.wins === 18, 'Aggregates raw wins without averaging percentages');
  assert(chunk.stats[0].brackets.low.battles === 10, 'Maps low skill group');
  assert(chunk.stats[0].brackets.medium.battles === 10, 'Maps medium skill group');
  assert(chunk.stats[0].brackets.high.battles === 10, 'Maps high skill group');

  const invalidBundle = structuredClone(parsed);
  invalidBundle.ships[0].brackets[0].wins = 11;
  let invalidRejected = false;
  try {
    transformShipToolBundle(invalidBundle, catalog, 'https://shiptool.st/assets/demo.js');
  } catch {
    invalidRejected = true;
  }
  assert(invalidRejected, 'Rejects raw wins greater than battles');

  const lowCoverageCatalog = new Map(catalog);
  for (let id = 2; id <= 5; id++) lowCoverageCatalog.set(id, { ...catalog.get(1), id });
  let lowCoverageRejected = false;
  try {
    transformShipToolBundle(parsed, lowCoverageCatalog, 'https://shiptool.st/assets/demo.js');
  } catch {
    lowCoverageRejected = true;
  }
  assert(lowCoverageRejected, 'Rejects snapshots below the catalog coverage threshold');

  const manifestPath = path.join(STATS_DIR, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'Local ShipTool statistics manifest exists');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifest.source === 'shiptool', 'Local statistics manifest identifies ShipTool');
    assert(manifest.totalChunks === 9, 'Local manifest contains 9 public chunks');
    assert(typeof manifest.catalogFingerprint === 'string' && manifest.catalogFingerprint.length === 64, 'Manifest pins the catalog fingerprint');
    assert(manifest.stale === false, 'Fresh local manifest is not marked stale');
  }

  for (const region of ['eu', 'com', 'asia']) {
    for (const span of ['1', '3', 'all']) {
      const filename = `stats-${region}-${span}.json`;
      const filePath = path.join(STATS_DIR, filename);
      assert(fs.existsSync(filePath), `${filename} exists`);
      if (!fs.existsSync(filePath)) continue;
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert(data.source === 'shiptool', `${filename} is sourced from ShipTool`);
      assert(data.span === span && data.server === region, `${filename} metadata matches its path`);
      assert(data.stats.length > 0, `${filename} contains real ship records`);
      assert(!data.stats.some((ship) => ship.brackets?.top1), `${filename} does not fabricate Top 1% data`);
    }
  }

  console.log(`\nVerification summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
