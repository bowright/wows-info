/**
 * verify_filter_controls.mjs
 * Verification test suite for Select All / None and Full Tier Range Filter Controls
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

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
  console.log('=== Verifying Select All / None & Full Tier Filter Controls ===\n');

  // ----------------------------------------------------
  // Suite 1: useArmoryStore Filter State & Select All/None Actions
  // ----------------------------------------------------
  console.log('Suite 1: useArmoryStore Filter State & Select All/None Actions');
  const armoryStorePath = path.join(SRC_DIR, 'stores/useArmoryStore.ts');
  assert(fs.existsSync(armoryStorePath), 'src/stores/useArmoryStore.ts exists');
  const armoryStoreContent = fs.readFileSync(armoryStorePath, 'utf8');

  assert(armoryStoreContent.includes('export const ARMORY_TIERS'), 'ARMORY_TIERS constant is exported');
  assert(armoryStoreContent.includes('export const ARMORY_CLASSES'), 'ARMORY_CLASSES constant is exported');
  assert(armoryStoreContent.includes('export const ARMORY_NATIONS'), 'ARMORY_NATIONS constant is exported');
  assert(armoryStoreContent.includes('export const ARMORY_SOURCES'), 'ARMORY_SOURCES constant is exported');

  // Verify ARMORY_TIERS has 11 tiers
  assert(armoryStoreContent.includes('1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11'), 'ARMORY_TIERS contains all 11 tiers (1 to 11)');

  // Verify actions exist in interface
  assert(armoryStoreContent.includes('selectAllTiers: () => void'), 'selectAllTiers action defined');
  assert(armoryStoreContent.includes('clearTiers: () => void'), 'clearTiers (select none) action defined');
  assert(armoryStoreContent.includes('selectAllClasses: () => void'), 'selectAllClasses action defined');
  assert(armoryStoreContent.includes('clearClasses: () => void'), 'clearClasses (select none) action defined');
  assert(armoryStoreContent.includes('selectAllNations: () => void'), 'selectAllNations action defined');
  assert(armoryStoreContent.includes('clearNations: () => void'), 'clearNations (select none) action defined');
  assert(armoryStoreContent.includes('selectAllSources: () => void'), 'selectAllSources action defined');
  assert(armoryStoreContent.includes('clearSources: () => void'), 'clearSources (select none) action defined');
  assert(armoryStoreContent.includes('resetFilters: () => void'), 'resetFilters action defined');

  // Dynamic import of useArmoryStore to test state behavior
  const { useArmoryStore } = await import('../src/stores/useArmoryStore.ts');
  const armoryState = useArmoryStore.getState();

  // Test Tier actions
  armoryState.selectAllTiers();
  assert(useArmoryStore.getState().selectedTiers === null, 'selectAllTiers() sets selectedTiers to null (All)');
  armoryState.clearTiers();
  assert(Array.isArray(useArmoryStore.getState().selectedTiers) && useArmoryStore.getState().selectedTiers.length === 0, 'clearTiers() sets selectedTiers to [] (None)');
  armoryState.toggleTier(10);
  assert(JSON.stringify(useArmoryStore.getState().selectedTiers) === '[10]', 'toggleTier(10) selects Tier 10');
  armoryState.toggleTier(9);
  assert(JSON.stringify(useArmoryStore.getState().selectedTiers) === '[9,10]', 'toggleTier(9) adds Tier 9');

  // Test Class actions
  armoryState.selectAllClasses();
  assert(useArmoryStore.getState().selectedClasses === null, 'selectAllClasses() sets selectedClasses to null (All)');
  armoryState.clearClasses();
  assert(Array.isArray(useArmoryStore.getState().selectedClasses) && useArmoryStore.getState().selectedClasses.length === 0, 'clearClasses() sets selectedClasses to [] (None)');
  armoryState.toggleShipClass('Battleship');
  assert(JSON.stringify(useArmoryStore.getState().selectedClasses) === '["Battleship"]', 'toggleShipClass("Battleship") isolates Battleship');

  // Test Nation actions
  armoryState.selectAllNations();
  assert(useArmoryStore.getState().selectedNations === null, 'selectAllNations() sets selectedNations to null (All)');
  armoryState.clearNations();
  assert(Array.isArray(useArmoryStore.getState().selectedNations) && useArmoryStore.getState().selectedNations.length === 0, 'clearNations() sets selectedNations to [] (None)');
  armoryState.toggleNation('japan');
  assert(JSON.stringify(useArmoryStore.getState().selectedNations) === '["japan"]', 'toggleNation("japan") isolates Japan');

  // Test Source actions
  armoryState.selectAllSources();
  assert(useArmoryStore.getState().selectedSources === null, 'selectAllSources() sets selectedSources to null (All)');
  armoryState.clearSources();
  assert(Array.isArray(useArmoryStore.getState().selectedSources) && useArmoryStore.getState().selectedSources.length === 0, 'clearSources() sets selectedSources to [] (None)');
  armoryState.toggleSource('Steel');
  assert(JSON.stringify(useArmoryStore.getState().selectedSources) === '["Steel"]', 'toggleSource("Steel") isolates Steel');

  // Test resetFilters
  armoryState.resetFilters();
  const resetState = useArmoryStore.getState();
  assert(resetState.selectedTiers === null, 'resetFilters() resets selectedTiers to null');
  assert(resetState.selectedClasses === null, 'resetFilters() resets selectedClasses to null');
  assert(resetState.selectedNations === null, 'resetFilters() resets selectedNations to null');
  assert(resetState.selectedSources === null, 'resetFilters() resets selectedSources to null');
  assert(resetState.searchQuery === '', 'resetFilters() clears searchQuery');

  // ----------------------------------------------------
  // Suite 2: useStatsStore All Tiers & Select All/None Actions
  // ----------------------------------------------------
  console.log('\nSuite 2: useStatsStore All Tiers & Select All/None Actions');
  const statsStorePath = path.join(SRC_DIR, 'stores/useStatsStore.ts');
  assert(fs.existsSync(statsStorePath), 'src/stores/useStatsStore.ts exists');
  const statsStoreContent = fs.readFileSync(statsStorePath, 'utf8');

  assert(statsStoreContent.includes('selectAllTiers: () => void'), 'useStatsStore defines selectAllTiers action');
  assert(statsStoreContent.includes('clearTiers: () => void'), 'useStatsStore defines clearTiers (select none) action');
  assert(statsStoreContent.includes('selectAllClasses: () => void'), 'useStatsStore defines selectAllClasses action');
  assert(statsStoreContent.includes('clearClasses: () => void'), 'useStatsStore defines clearClasses (select none) action');

  // Dynamic import of useStatsStore to test state behavior
  const { useStatsStore } = await import('../src/stores/useStatsStore.ts');
  const statsState = useStatsStore.getState();

  statsState.selectAllTiers();
  assert(useStatsStore.getState().selectedTiers === null, 'useStatsStore.selectAllTiers() sets selectedTiers to null (All)');
  statsState.clearTiers();
  assert(Array.isArray(useStatsStore.getState().selectedTiers) && useStatsStore.getState().selectedTiers.length === 0, 'useStatsStore.clearTiers() sets selectedTiers to [] (None)');
  statsState.toggleTier(1);
  assert(JSON.stringify(useStatsStore.getState().selectedTiers) === '[1]', 'useStatsStore.toggleTier(1) supports Tier I');
  statsState.toggleTier(11);
  assert(JSON.stringify(useStatsStore.getState().selectedTiers) === '[1,11]', 'useStatsStore.toggleTier(11) supports Tier XI (★)');

  statsState.selectAllClasses();
  assert(useStatsStore.getState().selectedClasses === null, 'useStatsStore.selectAllClasses() sets selectedClasses to null (All)');
  statsState.clearClasses();
  assert(Array.isArray(useStatsStore.getState().selectedClasses) && useStatsStore.getState().selectedClasses.length === 0, 'useStatsStore.clearClasses() sets selectedClasses to [] (None)');

  statsState.resetFilters();
  assert(useStatsStore.getState().selectedTiers === null, 'useStatsStore.resetFilters() resets selectedTiers to null');
  assert(useStatsStore.getState().selectedClasses === null, 'useStatsStore.resetFilters() resets selectedClasses to null');

  // ----------------------------------------------------
  // Suite 3: ArmoryView UI Controls
  // ----------------------------------------------------
  console.log('\nSuite 3: ArmoryView UI Controls');
  const armoryViewPath = path.join(SRC_DIR, 'views/ArmoryView.tsx');
  assert(fs.existsSync(armoryViewPath), 'src/views/ArmoryView.tsx exists');
  const armoryViewContent = fs.readFileSync(armoryViewPath, 'utf8');

  // Check helper
  assert(armoryViewContent.includes('export function getOfferSource'), 'ArmoryView defines getOfferSource helper');
  assert(armoryViewContent.includes('ARMORY_SOURCE_CONFIG'), 'ArmoryView defines ARMORY_SOURCE_CONFIG');

  // Check Tier filter has all 11 tiers and All/None buttons
  assert(armoryViewContent.includes('selectAllTiers'), 'ArmoryView includes selectAllTiers button');
  assert(armoryViewContent.includes('clearTiers'), 'ArmoryView includes clearTiers (None) button');
  assert(armoryViewContent.includes('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]'), 'ArmoryView iterates over all 11 tiers (1..11)');

  // Check Class filter has All/None buttons
  assert(armoryViewContent.includes('selectAllClasses'), 'ArmoryView includes selectAllClasses button');
  assert(armoryViewContent.includes('clearClasses'), 'ArmoryView includes clearClasses (None) button');

  // Check Nation filter has All/None buttons and all 13 nations
  assert(armoryViewContent.includes('selectAllNations'), 'ArmoryView includes selectAllNations button');
  assert(armoryViewContent.includes('clearNations'), 'ArmoryView includes clearNations (None) button');
  assert(armoryViewContent.includes('NATION_LABELS'), 'ArmoryView renders NATION_LABELS');

  // Check Source filter has All/None buttons and 7 sources
  assert(armoryViewContent.includes('selectAllSources'), 'ArmoryView includes selectAllSources button');
  assert(armoryViewContent.includes('clearSources'), 'ArmoryView includes clearSources (None) button');
  assert(armoryViewContent.includes("'Coal'"), 'ArmoryView sources include Coal');
  assert(armoryViewContent.includes("'Steel'"), 'ArmoryView sources include Steel');
  assert(armoryViewContent.includes("'Doubloons'"), 'ArmoryView sources include Doubloons');
  assert(armoryViewContent.includes("'Research Bureau'"), 'ArmoryView sources include Research Bureau');
  assert(armoryViewContent.includes("'Dockyard'"), 'ArmoryView sources include Dockyard');
  assert(armoryViewContent.includes("'Removed'"), 'ArmoryView sources include Removed');
  assert(armoryViewContent.includes("'Event Tokens'"), 'ArmoryView sources include Event Tokens');

  // Check Reset button in sub-filters
  assert(armoryViewContent.includes('resetArmoryFilters'), 'ArmoryView includes resetArmoryFilters action');

  // ----------------------------------------------------
  // Suite 4: ServerStatsView UI Controls
  // ----------------------------------------------------
  console.log('\nSuite 4: ServerStatsView UI Controls');
  const serverStatsViewPath = path.join(SRC_DIR, 'views/ServerStatsView.tsx');
  assert(fs.existsSync(serverStatsViewPath), 'src/views/ServerStatsView.tsx exists');
  const serverStatsViewContent = fs.readFileSync(serverStatsViewPath, 'utf8');

  // Verify all 11 tiers are mapped, not just [8, 9, 10, 11]
  assert(serverStatsViewContent.includes('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]'), 'ServerStatsView maps all 11 tiers [1..11]');
  assert(!serverStatsViewContent.includes('{[8, 9, 10, 11].map'), 'ServerStatsView no longer restricts tier buttons to VIII onwards');

  // Verify Select All and None buttons in ServerStatsView
  assert(serverStatsViewContent.includes('selectAllTiers'), 'ServerStatsView integrates selectAllTiers button');
  assert(serverStatsViewContent.includes('clearTiers'), 'ServerStatsView integrates clearTiers (None) button');
  assert(serverStatsViewContent.includes('selectAllClasses'), 'ServerStatsView integrates selectAllClasses button');
  assert(serverStatsViewContent.includes('clearClasses'), 'ServerStatsView integrates clearClasses (None) button');

  console.log('\n====================================================');
  console.log(`  Filter Controls Summary: ${passedTests} passed, ${failedTests} failed (${totalTests} total tests)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('[FATAL] Verification suite crashed:', err);
  process.exit(1);
});
