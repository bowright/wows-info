import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { scrapeArmory } from '../scripts/scrape_armory.mjs';
import { buildData } from '../scripts/build_data.mjs';
import { syncShipToolStats } from '../scripts/sync_shiptool_stats.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || (process.env.NODE_ENV === 'production' ? '5173' : '3001'), 10);
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || String(6 * 60 * 60 * 1000), 10); // Default: 6 hours

// In-memory sync state
export const syncState = {
  isSyncing: false,
  lastSyncTime: null,
  lastSyncSource: null,
  lastError: null,
  totalShips: 993,
  armoryOffersCount: 226,
  armoryBundlesCount: 222,
  statsSource: null,
  statsSourceVersion: null,
  statsLastSyncTime: null,
  statsStale: false,
  syncHistory: []
};

// Initialize state from existing armory_master.json if available
const armoryMasterPath = path.resolve(__dirname, '../public/data/armory_master.json');
const statsManifestPath = path.resolve(__dirname, '../public/data/stats/manifest.json');
if (fs.existsSync(armoryMasterPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(armoryMasterPath, 'utf8'));
    syncState.lastSyncTime = existing.updatedAt || null;
    syncState.lastSyncSource = existing.source || 'snapshot';
    syncState.totalShips = existing.totalShips || 993;
    syncState.armoryOffersCount = existing.armoryOffersCount || 226;
    syncState.armoryBundlesCount = existing.armoryBundlesCount || 222;
  } catch (e) {
    // Ignore parse errors on startup
  }
}

if (fs.existsSync(statsManifestPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(statsManifestPath, 'utf8'));
    syncState.statsSource = existing.source || null;
    syncState.statsSourceVersion = existing.sourceVersion || null;
    syncState.statsLastSyncTime = existing.fetchedAt || null;
    syncState.statsStale = Boolean(existing.stale);
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

    // Server statistics are maintained separately from the catalog build so
    // an upstream outage never overwrites the last known-good local snapshot.
    const statsResult = await syncShipToolStats({
      force: options.forceStats ?? false,
      publishVersioned: true,
      timeoutMs: options.statsTimeoutMs ?? 30000,
    });
    if (statsResult.error) {
      console.warn(`[SyncService] ShipTool statistics note: ${statsResult.error}`);
    }
    if (!statsResult.success) {
      syncState.lastError = statsResult.error || 'ShipTool statistics cache is unavailable';
    }

    const now = new Date().toISOString();
    syncState.lastSyncTime = now;
    syncState.lastSyncSource = armoryResult.source;
    syncState.armoryOffersCount = armoryResult.shipOffers.length;
    syncState.armoryBundlesCount = armoryResult.shipBundles.length;
    syncState.totalShips = buildResult.catalogCount;
    syncState.statsSource = statsResult.source;
    syncState.statsSourceVersion = statsResult.sourceVersion;
    syncState.statsLastSyncTime = statsResult.updated
      ? now
      : statsResult.manifest?.fetchedAt || syncState.statsLastSyncTime;
    syncState.statsStale = Boolean(statsResult.stale);

    const logEntry = {
      timestamp: now,
      source: armoryResult.source,
      offersCount: armoryResult.shipOffers.length,
      statsSource: statsResult.source,
      statsVersion: statsResult.sourceVersion,
      statsUpdated: statsResult.updated,
      statsStale: statsResult.stale,
      elapsedSec: buildResult.elapsedSec
    };
    syncState.syncHistory.unshift(logEntry);
    if (syncState.syncHistory.length > 20) {
      syncState.syncHistory.pop();
    }

    console.log(
      `[SyncService] Sync completed via ${armoryResult.source}; ` +
      `ShipTool stats ${statsResult.updated ? 'updated' : statsResult.stale ? 'stale' : 'unchanged'} ` +
      `in ${buildResult.elapsedSec}s.`
    );

    return {
      success: statsResult.success,
      updated: true,
      message: statsResult.stale
        ? `Sync completed from ${armoryResult.source}; ShipTool statistics cache is stale`
        : `Sync successful from ${armoryResult.source}`,
      stats: {
        lastSyncTime: now,
        source: armoryResult.source,
        totalShips: syncState.totalShips,
        armoryOffersCount: syncState.armoryOffersCount,
        armoryBundlesCount: syncState.armoryBundlesCount,
        statsSource: syncState.statsSource,
        statsSourceVersion: syncState.statsSourceVersion,
        statsLastSyncTime: syncState.statsLastSyncTime,
        statsStale: syncState.statsStale,
        elapsedSec: buildResult.elapsedSec
      },
      ...(statsResult.success ? {} : { error: syncState.lastError }),
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
    const forceStats = req.query.stats === 'true' || req.body?.stats === true;
    const result = await runSync({ forceSnapshot, forceStats });
    res.status(result.success ? 200 : 500).json(result);
  };

  app.post('/api/sync', handleSync);
  app.get('/api/sync', handleSync);

  // Dynamic data updates written to public/data take priority so sync updates are immediately live
  const publicDataPath = path.resolve(__dirname, '../public/data');
  if (fs.existsSync(publicDataPath)) {
    app.use('/data', express.static(publicDataPath));
  }

  // Serve static production build if dist/ exists
  const distPath = path.resolve(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

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
