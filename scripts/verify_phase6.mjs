import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  COMPARISON_CATEGORIES,
  SHIP_PALETTE,
  computeAdvantage,
} from '../src/utils/comparisonMatrix.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SRC_DIR = path.join(ROOT_DIR, 'src');

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
  console.log('=== World of Warships PWA, Offline Caching, Polish & One-Command Launch (Phase 6) ===\n');

  // ----------------------------------------------------
  // Suite 1: PWA Manifest & App Configuration
  // ----------------------------------------------------
  console.log('Suite 1: PWA Manifest & Web App Configuration');

  const manifestPath = path.join(PUBLIC_DIR, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'public/manifest.json exists');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.name === 'WoWs Info', `manifest.name is 'WoWs Info' (got '${manifest.name}')`);
  assert(manifest.short_name === 'wows-info', `manifest.short_name is 'wows-info' (got '${manifest.short_name}')`);
  assert(manifest.start_url === '/', `manifest.start_url is '/' (got '${manifest.start_url}')`);
  assert(manifest.display === 'standalone', `manifest.display is 'standalone' (got '${manifest.display}')`);
  assert(manifest.theme_color === '#020617', `manifest.theme_color is '#020617' (got '${manifest.theme_color}')`);
  assert(manifest.background_color === '#020617', `manifest.background_color is '#020617' (got '${manifest.background_color}')`);

  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, `manifest.icons defined (${manifest.icons.length} icons found)`);

  const icon192 = path.join(PUBLIC_DIR, 'icons/icon-192.png');
  const icon512 = path.join(PUBLIC_DIR, 'icons/icon-512.png');
  const iconSvg = path.join(PUBLIC_DIR, 'icons/icon.svg');

  assert(fs.existsSync(icon192), 'public/icons/icon-192.png exists');
  assert(fs.statSync(icon192).size > 500, `icon-192.png is valid non-empty asset (${fs.statSync(icon192).size} bytes)`);

  assert(fs.existsSync(icon512), 'public/icons/icon-512.png exists');
  assert(fs.statSync(icon512).size > 1000, `icon-512.png is valid non-empty asset (${fs.statSync(icon512).size} bytes)`);

  assert(fs.existsSync(iconSvg), 'public/icons/icon.svg exists');

  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  assert(indexHtml.includes('rel="manifest"'), 'index.html links to manifest.json');
  assert(indexHtml.includes('name="theme-color"'), 'index.html defines theme-color meta tag');
  assert(indexHtml.includes('/icons/icon'), 'index.html includes favicon icon link');

  // ----------------------------------------------------
  // Suite 2: Service Worker & Offline Caching Engine
  // ----------------------------------------------------
  console.log('\nSuite 2: Service Worker & Offline Caching Architecture');

  const swPath = path.join(PUBLIC_DIR, 'sw.js');
  assert(fs.existsSync(swPath), 'public/sw.js exists');

  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes("addEventListener('install'"), 'sw.js registers install event listener');
  assert(swContent.includes("addEventListener('activate'"), 'sw.js registers activate event listener');
  assert(swContent.includes("addEventListener('fetch'"), 'sw.js registers fetch event listener');
  assert(swContent.includes("wows-info-data-v2"), 'sw.js uses the post-ShipTool data cache generation');
  assert(!swContent.includes("wows-info-data-v1"), 'sw.js does not retain the pre-ShipTool data cache generation');
  assert(swContent.includes("url.pathname === '/data/stats/manifest.json'"), 'sw.js network-refreshes the statistics manifest pointer');

  assert(swContent.includes('/data/catalog.json'), 'sw.js pre-caches core catalog artifact');
  assert(swContent.includes('/data/locales/en.json'), 'sw.js pre-caches core localized strings');
  assert(swContent.includes('/data/armory_master.json'), 'sw.js pre-caches armory master database');

  assert(
    swContent.includes("url.pathname.startsWith('/data/')"),
    'sw.js handles /data/ requests with dynamic data cache'
  );
  assert(
    swContent.includes("url.pathname.startsWith('/api/')"),
    'sw.js handles /api/ live endpoint requests with offline fallback'
  );

  const mainTsx = fs.readFileSync(path.join(SRC_DIR, 'main.tsx'), 'utf8');
  assert(mainTsx.includes('serviceWorker') && mainTsx.includes('register'), 'src/main.tsx registers service worker (/sw.js)');

  // ----------------------------------------------------
  // Suite 3: Offline Detection Hook & Status Banner
  // ----------------------------------------------------
  console.log('\nSuite 3: Offline Detection Hook & Status Banner');

  const useOnlineStatusPath = path.join(SRC_DIR, 'utils/useOnlineStatus.ts');
  assert(fs.existsSync(useOnlineStatusPath), 'src/utils/useOnlineStatus.ts exists');

  const useOnlineStatusContent = fs.readFileSync(useOnlineStatusPath, 'utf8');
  assert(useOnlineStatusContent.includes('export function useOnlineStatus'), 'exports useOnlineStatus hook');
  assert(useOnlineStatusContent.includes("navigator.onLine"), 'listens to navigator.onLine');
  assert(useOnlineStatusContent.includes("'online'"), 'listens to window online event');
  assert(useOnlineStatusContent.includes("'offline'"), 'listens to window offline event');

  const headerPath = path.join(SRC_DIR, 'components/common/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');
  assert(headerContent.includes('useOnlineStatus'), 'Header.tsx integrates useOnlineStatus');
  assert(headerContent.includes('Offline Mode'), 'Header.tsx renders offline notification and status');
  assert(headerContent.includes('Offline (Cached)'), 'Header.tsx displays offline cached pill');

  // ----------------------------------------------------
  // Suite 4: One-Command Quick Launch Orchestrator (start.sh)
  // ----------------------------------------------------
  console.log('\nSuite 4: One-Command Quick Launch Orchestrator (start.sh)');

  const startShPath = path.join(ROOT_DIR, 'start.sh');
  assert(fs.existsSync(startShPath), 'start.sh exists in repository root');

  const startShStat = fs.statSync(startShPath);
  const isExecutable = (startShStat.mode & 0o111) !== 0;
  assert(isExecutable, 'start.sh has executable permissions (+x)');

  // Validate bash syntax using bash -n
  try {
    execSync('bash -n start.sh', { cwd: ROOT_DIR });
    assert(true, 'start.sh passes bash syntax validation (bash -n)');
  } catch (err) {
    assert(false, `start.sh bash syntax error: ${err.message}`);
  }

  const startShContent = fs.readFileSync(startShPath, 'utf8');
  assert(startShContent.includes('command -v node'), 'start.sh verifies Node.js environment');
  assert(startShContent.includes('command -v npm'), 'start.sh verifies npm environment');
  assert(startShContent.includes('npm run build'), 'start.sh checks and triggers production build');
  assert(startShContent.includes('server/sync_service.mjs'), 'start.sh starts Option B sync daemon');
  assert(startShContent.includes('3001'), 'start.sh configures sync port 3001');
  assert(startShContent.includes('5173'), 'start.sh configures web application port 5173');
  assert(startShContent.includes('trap cleanup'), 'start.sh implements signal trap for graceful cleanup');
  assert(startShContent.includes('http://localhost'), 'start.sh formats terminal launch banner');

  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert(pkgJson.scripts.start === 'bash ./start.sh', `package.json 'start' script is 'bash ./start.sh'`);
  assert(pkgJson.scripts['test:phase6'] === 'node scripts/verify_phase6.mjs', `package.json defines 'test:phase6' script`);

  // ----------------------------------------------------
  // Suite 5: Enhanced Ship Duel & Comparison Matrix
  // ----------------------------------------------------
  console.log('\nSuite 5: Enhanced Ship Duel & Comparison Matrix');

  const compareViewPath = path.join(SRC_DIR, 'views/ShipCompareView.tsx');
  const ballisticsChartPath = path.join(SRC_DIR, 'components/ballistics/BallisticsChart.tsx');

  assert(fs.existsSync(compareViewPath), 'src/views/ShipCompareView.tsx exists');
  assert(fs.existsSync(ballisticsChartPath), 'src/components/ballistics/BallisticsChart.tsx exists');

  assert(Array.isArray(SHIP_PALETTE) && SHIP_PALETTE.length >= 4, `SHIP_PALETTE defines at least 4 ship colors (${SHIP_PALETTE.length} defined)`);

  const chartContent = fs.readFileSync(ballisticsChartPath, 'utf8');
  assert(chartContent.includes('<svg'), 'BallisticsChart renders SVG element');
  assert(chartContent.includes('detailsCache'), 'BallisticsChart implements in-memory details caching');
  assert(chartContent.includes('interpolatePoint'), 'BallisticsChart implements distance trajectory interpolation');
  assert(chartContent.includes('hoverDist'), 'BallisticsChart implements interactive hover crosshair & scrub');
  assert(chartContent.includes('Krupp AP Penetration'), 'BallisticsChart supports Krupp AP Penetration');
  assert(chartContent.includes('Shell Flight Time'), 'BallisticsChart supports Flight Time metric');
  assert(chartContent.includes('Impact Velocity'), 'BallisticsChart supports Impact Velocity metric');
  assert(chartContent.includes('Impact Angle'), 'BallisticsChart supports Impact Angle metric');

  // Verify categories in COMPARISON_CATEGORIES
  const expectedCategories = [
    'acquisition',
    'survivability',
    'artillery',
    'torpedoes',
    'aa',
    'asw',
    'mobility',
    'concealment',
  ];

  assert(
    COMPARISON_CATEGORIES.length === expectedCategories.length,
    `COMPARISON_CATEGORIES defines exactly 8 comparative categories (found ${COMPARISON_CATEGORIES.length})`
  );

  for (const catId of expectedCategories) {
    const found = COMPARISON_CATEGORIES.some((c) => c.id === catId);
    assert(found, `Category '${catId}' is present in COMPARISON_CATEGORIES`);
  }

  // Load sample catalog ships to verify matrix extraction & advantage rules
  const catalog = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'data/catalog.json'), 'utf8'));
  const yamato = catalog.find((s) => s.dispName === 'Yamato');
  const iowa = catalog.find((s) => s.dispName === 'Iowa');
  const montana = catalog.find((s) => s.dispName === 'Montana');

  assert(Boolean(yamato && iowa && montana), 'Sample battleship duel ships (Yamato, Iowa, Montana) exist in catalog');

  if (yamato && iowa && montana) {
    const survivabilityCat = COMPARISON_CATEGORIES.find((c) => c.id === 'survivability');
    const hpRow = survivabilityCat.rows.find((r) => r.id === 'health');
    assert(hpRow.direction === 'higher', 'Health metric row defines direction === "higher"');

    const yamatoHp = hpRow.getValue(yamato);
    const iowaHp = hpRow.getValue(iowa);
    const montanaHp = hpRow.getValue(montana);

    assert(yamatoHp === 97200, `Yamato HP correctly resolved to 97,200 (got ${yamatoHp})`);
    assert(iowaHp === 79000, `Iowa HP correctly resolved to 79,000 (got ${iowaHp})`);
    assert(montanaHp === 96300, `Montana HP correctly resolved to 96,300 (got ${montanaHp})`);

    // Verify Yamato has highest HP among the three
    const hpValues = [yamatoHp, iowaHp, montanaHp];
    assert(computeAdvantage(hpRow, yamatoHp, hpValues) === 'best', 'Yamato HP (97,200) classified as "best"');
    assert(computeAdvantage(hpRow, iowaHp, hpValues) === 'worst', 'Iowa HP (79,000) classified as "worst"');
    assert(computeAdvantage(hpRow, montanaHp, hpValues) === 'neutral', 'Montana HP (96,300) classified as "neutral"');

    const artilleryCat = COMPARISON_CATEGORIES.find((c) => c.id === 'artillery');
    const reloadRow = artilleryCat.rows.find((r) => r.id === 'reload');
    assert(reloadRow.direction === 'lower', 'Artillery Reload metric row defines direction === "lower"');

    const yamatoReload = reloadRow.getValue(yamato);
    const iowaReload = reloadRow.getValue(iowa);
    assert(typeof yamatoReload === 'number' && typeof iowaReload === 'number', 'Reload times extracted as numbers');

    // Des Moines test for lower is better
    const desMoines = catalog.find((s) => s.dispName === 'Des Moines');
    if (desMoines) {
      const dmReload = reloadRow.getValue(desMoines);
      const reloadValues = [yamatoReload, iowaReload, dmReload];
      assert(computeAdvantage(reloadRow, dmReload, reloadValues) === 'best', 'Des Moines reload (5.5s) classified as "best" (lowest)');
      assert(computeAdvantage(reloadRow, yamatoReload, reloadValues) === 'worst', 'Yamato reload (30s) classified as "worst" (highest)');
    }

    // Identical values
    assert(computeAdvantage(hpRow, 80000, [80000, 80000, 80000]) === 'neutral', 'Identical values result in "neutral" (no false highlights)');

    const overmatchRow = artilleryCat.rows.find((r) => r.id === 'overmatchMm');
    if (overmatchRow) {
      assert(overmatchRow.getValue(yamato) === 32, 'Yamato overmatch resolved to 32mm');
      assert(overmatchRow.getValue(iowa) === 28, 'Iowa overmatch resolved to 28mm');
    }
  }

  // ----------------------------------------------------
  // Suite 6: Production Build & Asset Integrity
  // ----------------------------------------------------
  console.log('\nSuite 6: Production Build & Asset Integrity');

  const distIndex = path.join(ROOT_DIR, 'dist/index.html');
  assert(fs.existsSync(distIndex), 'dist/index.html exists from production build');

  const distAssets = fs.readdirSync(path.join(ROOT_DIR, 'dist/assets'));
  const jsBundle = distAssets.find((f) => f.endsWith('.js'));
  const cssBundle = distAssets.find((f) => f.endsWith('.css'));

  assert(Boolean(jsBundle), `Production JS bundle generated (${jsBundle})`);
  assert(Boolean(cssBundle), `Production CSS bundle generated (${cssBundle})`);

  console.log('\n====================================================');
  console.log(`  Phase 6 Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Phase 6 verification script failed with error:', err);
  process.exit(1);
});
