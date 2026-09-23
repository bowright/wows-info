import { create } from 'zustand';
import type {
  StatsServer,
  StatsTimespan,
  SkillBracket,
  ShipServerStats,
  ShipStatMetrics,
  StatsChunkData,
  AggregateMetrics,
  ShipClass,
  AcquisitionCategory,
} from '../types/index.ts';
import { calculatePR } from '../utils/prCalculator.ts';

export interface EnrichedShipStatRow extends ShipStatMetrics {
  shipId: number;
  name: string;
  dispName: string;
  tier: number;
  class: ShipClass;
  nation: string;
  category: AcquisitionCategory | string;
  expectedDamage: number;
  expectedWinRate: number;
  expectedFrags: number;
  pr: number;
  rank?: number;
}

export interface StatsFilters {
  selectedServer: StatsServer;
  selectedSpan: StatsTimespan;
  selectedBracket: SkillBracket;
  selectedTiers: number[] | null;
  selectedClasses: ShipClass[] | null;
  selectedAcquisition: string; // 'All' | 'Coal' | 'Steel' | ...
  searchQuery: string;
}

export interface StatsStoreState extends StatsFilters {
  // Data cache: key format `${server}-${span}`
  statsCache: Record<string, StatsChunkData>;
  currentStats: ShipServerStats[];
  isLoading: boolean;
  error: string | null;
  lastLoadedKey: string | null;

  // Actions
  setServer: (server: StatsServer | 'na') => Promise<void>;
  setSpan: (span: StatsTimespan) => Promise<void>;
  setBracket: (bracket: SkillBracket) => void;
  setSelectedTiers: (tiers: number[] | null) => void;
  selectAllTiers: () => void;
  clearTiers: () => void;
  toggleTier: (tier: number) => void;
  setSelectedClasses: (classes: ShipClass[] | null) => void;
  selectAllClasses: () => void;
  clearClasses: () => void;
  toggleShipClass: (shipClass: ShipClass) => void;
  setSelectedAcquisition: (category: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Data Loading
  loadStats: (server?: StatsServer | 'na', span?: StatsTimespan) => Promise<StatsChunkData | null>;

  // Selectors
  getFilteredStats: () => EnrichedShipStatRow[];
  getAggregateMetrics: () => AggregateMetrics;
}

/**
 * Normalizes server identifier ('na' maps to 'com')
 */
export function normalizeServer(server: string): StatsServer {
  const s = server.toLowerCase();
  if (s === 'na' || s === 'com' || s === 'us' || s === 'north_america') return 'com';
  if (s === 'asia' || s === 'apac') return 'asia';
  return 'eu';
}

/**
 * Computes battle-weighted aggregate metrics across a collection of ship stat metric records.
 *
 * WinRate = (sum(wins) / sum(games)) * 100%
 * AvgDamage = sum(damage) / sum(games)
 * FragRate = sum(frags) / sum(games)
 * SurvivalRate = (sum(surv) / sum(games)) * 100%
 * AvgXP = sum(xp) / sum(games)
 * Spotting = sum(spot) / sum(games)
 * Potential = sum(pot) / sum(games)
 * Planes = sum(aa) / sum(games)
 */
export function computeAggregateMetrics(
  records: Array<ShipStatMetrics & { pr?: number }>
): AggregateMetrics {
  if (!records || records.length === 0) {
    return {
      totalBattles: 0,
      totalShips: 0,
      winRate: 0,
      avgDamage: 0,
      fragRate: 0,
      survivalRate: 0,
      avgXp: 0,
      spottingDamage: 0,
      potentialDamage: 0,
      planesDowned: 0,
      avgPr: 0,
    };
  }

  let totalGames = 0;
  let totalWins = 0;
  let totalDamage = 0;
  let totalFrags = 0;
  let totalSurvived = 0;
  let totalXp = 0;
  let totalSpot = 0;
  let totalPot = 0;
  let totalPlanes = 0;
  let weightedPrSum = 0;

  for (const r of records) {
    const games = r.battles || 0;
    if (games <= 0) continue;

    totalGames += games;

    // Use raw accumulators if available, otherwise compute from rates
    const wins = r.wins !== undefined ? r.wins : Math.round(games * (r.winRate / 100));
    const damage = r.damage !== undefined ? r.damage : Math.round(games * r.avgDamage);
    const frags = r.frags !== undefined ? r.frags : Math.round(games * r.avgFrags);
    const survived = r.survived !== undefined ? r.survived : Math.round(games * (r.survivalRate / 100));
    const xp = r.xp !== undefined ? r.xp : Math.round(games * r.avgXp);
    const spot = r.spotting !== undefined ? r.spotting : Math.round(games * r.spottingDamage);
    const pot = r.potential !== undefined ? r.potential : Math.round(games * r.potentialDamage);
    const planes = r.planes !== undefined ? r.planes : Math.round(games * r.planesDowned);

    totalWins += wins;
    totalDamage += damage;
    totalFrags += frags;
    totalSurvived += survived;
    totalXp += xp;
    totalSpot += spot;
    totalPot += pot;
    totalPlanes += planes;

    if (r.pr !== undefined && !isNaN(r.pr)) {
      weightedPrSum += r.pr * games;
    }
  }

  if (totalGames === 0) {
    return {
      totalBattles: 0,
      totalShips: records.length,
      winRate: 0,
      avgDamage: 0,
      fragRate: 0,
      survivalRate: 0,
      avgXp: 0,
      spottingDamage: 0,
      potentialDamage: 0,
      planesDowned: 0,
      avgPr: 0,
    };
  }

  return {
    totalBattles: totalGames,
    totalShips: records.length,
    winRate: Math.round((totalWins / totalGames) * 10000) / 100,
    avgDamage: Math.round(totalDamage / totalGames),
    fragRate: Math.round((totalFrags / totalGames) * 100) / 100,
    survivalRate: Math.round((totalSurvived / totalGames) * 10000) / 100,
    avgXp: Math.round(totalXp / totalGames),
    spottingDamage: Math.round(totalSpot / totalGames),
    potentialDamage: Math.round(totalPot / totalGames),
    planesDowned: Math.round((totalPlanes / totalGames) * 10) / 10,
    avgPr: Math.round(weightedPrSum / totalGames),
  };
}

/**
 * Normalizes acquisition filter category matching.
 * E.g., 'Coal' matches category === 'Coal', 'Doubloons' matches 'Doubloon', etc.
 */
export function matchesAcquisitionCategory(
  shipCategory: string | undefined,
  filterCategory: string
): boolean {
  if (!filterCategory || filterCategory === 'All') return true;

  const target = filterCategory.toLowerCase().trim();
  const current = (shipCategory || 'Tech Tree').toLowerCase().trim();

  if (target === 'doubloons' || target === 'doubloon') {
    return current === 'doubloon' || current === 'doubloons';
  }
  if (target === 'tech tree' || target === 'techtree') {
    return current === 'tech tree' || current === 'techtree';
  }
  if (target === 'research bureau' || target === 'rb' || target === 'research') {
    return current === 'research bureau';
  }
  if (target === 'dockyard') {
    return current === 'dockyard';
  }
  if (target === 'steel') {
    return current === 'steel';
  }
  if (target === 'coal') {
    return current === 'coal';
  }
  if (target === 'removed' || target === 'rare') {
    return current === 'removed';
  }
  return current === target;
}

export const useStatsStore = create<StatsStoreState>((set, get) => ({
  selectedServer: 'eu',
  selectedSpan: '1',
  selectedBracket: 'all',
  selectedTiers: null,
  selectedClasses: null,
  selectedAcquisition: 'All',
  searchQuery: '',

  statsCache: {},
  currentStats: [],
  isLoading: false,
  error: null,
  lastLoadedKey: null,

  setServer: async (server) => {
    const norm = normalizeServer(server);
    if (norm === get().selectedServer && get().currentStats.length > 0) return;
    set({ selectedServer: norm });
    await get().loadStats(norm, get().selectedSpan);
  },

  setSpan: async (span) => {
    if (span === get().selectedSpan && get().currentStats.length > 0) return;
    set({ selectedSpan: span });
    await get().loadStats(get().selectedServer, span);
  },

  setBracket: (bracket) => {
    set({ selectedBracket: bracket });
  },

  setSelectedTiers: (tiers) => set({ selectedTiers: tiers }),

  selectAllTiers: () => set({ selectedTiers: null }),

  clearTiers: () => set({ selectedTiers: [] }),

  toggleTier: (tier) => {
    const current = get().selectedTiers;
    if (current === null) {
      set({ selectedTiers: [tier] });
    } else if (current.includes(tier)) {
      const next = current.filter((t) => t !== tier);
      set({ selectedTiers: next });
    } else {
      const next = [...current, tier].sort((a, b) => a - b);
      set({ selectedTiers: next.length === 11 ? null : next });
    }
  },

  setSelectedClasses: (classes) => set({ selectedClasses: classes }),

  selectAllClasses: () => set({ selectedClasses: null }),

  clearClasses: () => set({ selectedClasses: [] }),

  toggleShipClass: (shipClass) => {
    const current = get().selectedClasses;
    if (current === null) {
      set({ selectedClasses: [shipClass] });
    } else if (current.includes(shipClass)) {
      const next = current.filter((c) => c !== shipClass);
      set({ selectedClasses: next });
    } else {
      const next = [...current, shipClass];
      set({ selectedClasses: next.length === 5 ? null : next });
    }
  },

  setSelectedAcquisition: (category) => set({ selectedAcquisition: category }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  resetFilters: () =>
    set({
      selectedBracket: 'all',
      selectedTiers: null,
      selectedClasses: null,
      selectedAcquisition: 'All',
      searchQuery: '',
    }),

  loadStats: async (serverOverride, spanOverride) => {
    const srv = normalizeServer(serverOverride || get().selectedServer);
    const span = spanOverride || get().selectedSpan;
    const cacheKey = `${srv}-${span}`;

    // 1. Check client-side memory cache
    const cached = get().statsCache[cacheKey];
    if (cached && cached.stats && cached.stats.length > 0) {
      set({
        selectedServer: srv,
        selectedSpan: span,
        currentStats: cached.stats,
        lastLoadedKey: cacheKey,
        error: null,
      });
      return cached;
    }

    set({ isLoading: true, error: null });

    const possiblePaths = [
      `/data/stats/stats-${srv}-${span}.json`,
      `/data/stats/${srv}-${span}.json`,
      `/data/stats/stats-${srv === 'com' ? 'na' : srv}-${span}.json`,
      `/data/stats/${srv === 'com' ? 'na' : srv}-${span}.json`,
    ];

    let loadedData: StatsChunkData | null = null;

    for (const urlPath of possiblePaths) {
      try {
        const res = await fetch(urlPath);
        if (res.ok) {
          loadedData = await res.json();
          break;
        }
      } catch {
        // Try next fallback path
      }
    }

    if (!loadedData || !loadedData.stats) {
      const errorMsg = `Failed to load statistics chunk for server '${srv}', timespan '${span}'`;
      set({
        isLoading: false,
        error: errorMsg,
      });
      return null;
    }

    // Cache the loaded chunk
    set((state) => ({
      isLoading: false,
      error: null,
      selectedServer: srv,
      selectedSpan: span,
      currentStats: loadedData!.stats,
      lastLoadedKey: cacheKey,
      statsCache: {
        ...state.statsCache,
        [cacheKey]: loadedData!,
      },
    }));

    return loadedData;
  },

  getFilteredStats: () => {
    const {
      currentStats,
      selectedBracket,
      selectedTiers,
      selectedClasses,
      selectedAcquisition,
      searchQuery,
    } = get();

    if (!currentStats || currentStats.length === 0) return [];

    const query = searchQuery.trim().toLowerCase();

    return currentStats
      .filter((ship) => {
        // Tier filter
        if (selectedTiers !== null && !selectedTiers.includes(ship.tier)) {
          return false;
        }

        // Class filter
        if (selectedClasses !== null && !selectedClasses.includes(ship.class)) {
          return false;
        }

        // Acquisition filter
        if (
          selectedAcquisition &&
          selectedAcquisition !== 'All' &&
          !matchesAcquisitionCategory(ship.category, selectedAcquisition)
        ) {
          return false;
        }

        // Search query
        if (query) {
          const matchName = ship.name.toLowerCase().includes(query);
          const matchDisp = ship.dispName.toLowerCase().includes(query);
          const matchNation = ship.nation.toLowerCase().includes(query);
          if (!matchName && !matchDisp && !matchNation) return false;
        }

        return true;
      })
      .map((ship) => {
        // Extract bracket-specific metrics or default to ship level
        const bracketMetrics =
          ship.brackets && ship.brackets[selectedBracket]
            ? ship.brackets[selectedBracket]
            : (ship as ShipStatMetrics);

        const expected = {
          expectedDamage: ship.expectedDamage || 50000,
          expectedWinRate: ship.expectedWinRate || 50.0,
          expectedFrags: ship.expectedFrags || 0.8,
        };

        const calculatedPr =
          bracketMetrics.pr !== undefined && !isNaN(bracketMetrics.pr)
            ? bracketMetrics.pr
            : calculatePR(bracketMetrics, expected);

        return {
          shipId: ship.shipId,
          name: ship.name,
          dispName: ship.dispName,
          tier: ship.tier,
          class: ship.class,
          nation: ship.nation,
          category: ship.category,
          expectedDamage: expected.expectedDamage,
          expectedWinRate: expected.expectedWinRate,
          expectedFrags: expected.expectedFrags,
          ...bracketMetrics,
          pr: calculatedPr,
        };
      });
  },

  getAggregateMetrics: () => {
    const filtered = get().getFilteredStats();
    return computeAggregateMetrics(filtered);
  },
}));
