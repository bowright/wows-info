import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { scrapeArmory } from '../scripts/scrape_armory.mjs';
import { buildData } from '../scripts/build_data.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || String(6 * 60 * 60 * 1000), 10); // Default: 6 hours

// In-memory sync state
export const syncState = {
  isSyncing: false,
  lastSyncTime: null,
  lastSyncSource: null,
  lastError: null,
  totalShips: 993,
  armoryOffersCount: 228,
  armoryBundlesCount: 224,
  syncHistory: []
};

// Initialize state from existing armory_master.json if available
const armoryMasterPath = path.resolve(__dirname, '../public/data/armory_master.json');
if (fs.existsSync(armoryMasterPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(armoryMasterPath, 'utf8'));
    syncState.lastSyncTime = existing.updatedAt || null;
    syncState.lastSyncSource = existing.source || 'snapshot';
    syncState.totalShips = existing.totalShips || 993;
    syncState.armoryOffersCount = existing.armoryOffersCount || 228;
    syncState.armoryBundlesCount = existing.armoryBundlesCount || 224;
  } catch (e) {
    // Ignore parse errors on startup
  }
}

/**
 * Executes a sync check and rebuilds data artifacts if needed.
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function runSync(options = {}) {
  if (syncState.isSyncing) {
    return {
      success: false,
      message: 'Sync is already in progress',
      state: syncState
    };
  }

  syncState.isSyncing = true;
  syncState.lastError = null;

  try {
    console.log('[SyncService] Running sync check...');
    const armoryResult = await scrapeArmory({
      timeoutMs: options.timeoutMs ?? 4000,
      forceSnapshot: options.forceSnapshot ?? false
    });

    const buildResult = await buildData({
      armoryOptions: {
        forceSnapshot: options.forceSnapshot ?? false
      }
    });

    const now = new Date().toISOString();
    syncState.lastSyncTime = now;
    syncState.lastSyncSource = armoryResult.source;
    syncState.armoryOffersCount = armoryResult.shipOffers.length;
    syncState.armoryBundlesCount = armoryResult.shipBundles.length;
    syncState.totalShips = buildResult.catalogCount;

    const logEntry = {
      timestamp: now,
      source: armoryResult.source,
      offersCount: armoryResult.shipOffers.length,
      elapsedSec: buildResult.elapsedSec
    };
    syncState.syncHistory.unshift(logEntry);
    if (syncState.syncHistory.length > 20) {
      syncState.syncHistory.pop();
    }

    console.log(`[SyncService] Sync completed successfully via ${armoryResult.source} in ${buildResult.elapsedSec}s.`);

    return {
      success: true,
      updated: true,
      message: `Sync successful from ${armoryResult.source}`,
      stats: {
        lastSyncTime: now,
        source: armoryResult.source,
        totalShips: syncState.totalShips,
        armoryOffersCount: syncState.armoryOffersCount,
        armoryBundlesCount: syncState.armoryBundlesCount,
        elapsedSec: buildResult.elapsedSec
      }
    };
  } catch (err) {
    console.error('[SyncService] Sync failed:', err);
    syncState.lastError = err.message || String(err);
    return {
      success: false,
      message: err.message || 'Sync failed',
      error: syncState.lastError
    };
  } finally {
    syncState.isSyncing = false;
  }
}

/**
 * Creates and configures the Express sync app.
 */
export function createSyncServer() {
  const app = express();
  app.use(express.json());

  // CORS middleware for Vite dev server
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Health and Status
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      service: 'wows-info-sync-service',
      state: syncState
    });
  });

  // Manual Trigger Endpoint (supports both GET and POST)
  const handleSync = async (req, res) => {
    const forceSnapshot = req.query.snapshot === 'true' || req.body?.snapshot === true;
    const result = await runSync({ forceSnapshot });
    res.status(result.success ? 200 : 500).json(result);
  };

  app.post('/api/sync', handleSync);
  app.get('/api/sync', handleSync);

  return app;
}

// Direct Execution Entry Point
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const app = createSyncServer();
  const server = app.listen(PORT, () => {
    console.log(`[SyncService] Background sync service running on port ${PORT} (interval: ${Math.round(SYNC_INTERVAL_MS / 60000)}m)`);

    // Non-blocking initial check on startup
    setTimeout(() => {
      console.log('[SyncService] Running startup sync check...');
      runSync({ forceSnapshot: false }).catch(err => {
        console.warn('[SyncService] Startup sync check note:', err.message);
      });
    }, 1000);

    // Schedule background polling
    setInterval(() => {
      console.log('[SyncService] Running scheduled background sync...');
      runSync({ forceSnapshot: false }).catch(err => {
        console.warn('[SyncService] Scheduled sync note:', err.message);
      });
    }, SYNC_INTERVAL_MS);
  });

  const shutdown = () => {
    console.log('\n[SyncService] Shutting down sync service...');
    server.close(() => {
      console.log('[SyncService] Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
