import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  useStatsStore,
  EnrichedShipStatRow,
} from '../stores/useStatsStore';
import { useShipStore } from '../stores/useShipStore';
import { AcquisitionBadge } from '../components/common/AcquisitionBadge';
import { getPRTier, formatPR } from '../utils/prCalculator';
import type { ShipClass, StatsServer, StatsTimespan, SkillBracket } from '../types';

interface ServerStatsViewProps {
  onNavigate: (path: string) => void;
}

const TIER_ROMAN: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
  11: '★',
};

const CLASS_CONFIG: Record<ShipClass, { label: string; abbr: string; bg: string; text: string }> = {
  Destroyer: { label: 'Destroyer', abbr: 'DD', bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400' },
  Cruiser: { label: 'Cruiser', abbr: 'CA', bg: 'bg-cyan-500/15 border-cyan-500/30', text: 'text-cyan-400' },
  Battleship: { label: 'Battleship', abbr: 'BB', bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400' },
  AirCarrier: { label: 'Carrier', abbr: 'CV', bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400' },
  Submarine: { label: 'Submarine', abbr: 'SS', bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400' },
};

const ACQUISITION_PILLS = [
  'All',
  'Coal',
  'Steel',
  'Doubloons',
  'Research Bureau',
  'Dockyard',
  'Tech Tree',
  'Removed',
];

const SERVER_OPTIONS: Array<{ id: StatsServer; label: string; sub: string }> = [
  { id: 'eu', label: 'EU', sub: 'Europe' },
  { id: 'com', label: 'NA', sub: 'North America' },
  { id: 'asia', label: 'ASIA', sub: 'Asia / Pacific' },
];

const SPAN_OPTIONS: Array<{ id: StatsTimespan; label: string; sub: string }> = [
  { id: '1', label: 'Current Update (1)', sub: 'Recent 4 weeks meta' },
  { id: '3', label: '3 Updates (Quarterly)', sub: 'Last ~12 weeks' },
  { id: 'all', label: 'All Time', sub: 'Cumulative baseline' },
];

const BRACKET_OPTIONS: Array<{ id: SkillBracket; label: string; sub: string }> = [
  { id: 'all', label: 'All Players', sub: 'Population aggregate' },
  { id: 'low', label: 'Low Skill', sub: 'ShipTool low-skill group' },
  { id: 'medium', label: 'Medium Skill', sub: 'ShipTool medium-skill group' },
  { id: 'high', label: 'High Skill', sub: 'ShipTool high-skill group' },
];

// Heatmap color generator
function getHeatmapColor(
  value: number | null | undefined,
  min: number,
  max: number,
  higherIsBetter = true
): string {
  if (value == null || isNaN(value) || min === max) return 'text-slate-300';
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const normalized = higherIsBetter ? ratio : 1 - ratio;

  if (normalized >= 0.82) return 'text-emerald-400 font-semibold';
  if (normalized >= 0.60) return 'text-teal-300 font-medium';
  if (normalized >= 0.40) return 'text-slate-200';
  if (normalized >= 0.20) return 'text-amber-300/90';
  return 'text-rose-400/90';
}

const columnHelper = createColumnHelper<EnrichedShipStatRow>();

export const ServerStatsView: React.FC<ServerStatsViewProps> = ({ onNavigate }) => {
  const catalogShips = useShipStore((state) => state.ships);
  const fetchCatalog = useShipStore((state) => state.fetchCatalog);

  const {
    selectedServer,
    selectedSpan,
    selectedBracket,
    selectedTiers,
    selectedClasses,
    selectedAcquisition,
    searchQuery,
    isLoading,
    error,
    currentStats,
    lastLoadedKey,
    statsSource,
    statsSourceVersion,
    statsLastUpdated,
    statsStale,
    setServer,
    setSpan,
    setBracket,
    toggleTier,
    selectAllTiers,
    clearTiers,
    toggleShipClass,
    selectAllClasses,
    clearClasses,
    setSelectedAcquisition,
    setSearchQuery,
    resetFilters,
    loadStats,
    getFilteredStats,
    getAggregateMetrics,
  } = useStatsStore();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'winRate', desc: true }]);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Initialize catalog and stats on mount
  useEffect(() => {
    if (catalogShips.length === 0) {
      fetchCatalog();
    }
    loadStats();
  }, [catalogShips.length, fetchCatalog, loadStats]);

  // Catalog Map lookup by shipId
  const catalogMap = useMemo(() => {
    const map = new Map<number, (typeof catalogShips)[0]>();
    for (const s of catalogShips) {
      map.set(s.id, s);
    }
    return map;
  }, [catalogShips]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return getFilteredStats();
  }, [
    getFilteredStats,
    currentStats,
    lastLoadedKey,
    selectedServer,
    selectedSpan,
    selectedBracket,
    selectedTiers,
    selectedClasses,
    selectedAcquisition,
    searchQuery,
  ]);

  // Aggregate battle-weighted metrics
  const aggregateMetrics = useMemo(() => {
    return getAggregateMetrics();
  }, [filteredData, getAggregateMetrics]);

  // Calculate min/max range for heatmaps
  const metricRanges = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        battles: { min: 0, max: 1 },
        winRate: { min: 45, max: 60 },
        avgDamage: { min: 20000, max: 100000 },
        fragRate: { min: 0.5, max: 1.5 },
        survivalRate: { min: 20, max: 60 },
        avgXp: { min: 800, max: 2200 },
        spottingDamage: { min: 10000, max: 60000 },
        potentialDamage: { min: 300000, max: 2000000 },
        planesDowned: { min: 0, max: 15 },
        pr: { min: 600, max: 2200 },
      };
    }

    const calc = (accessor: (r: EnrichedShipStatRow) => number) => {
      let min = Infinity;
      let max = -Infinity;
      for (const r of filteredData) {
        const v = accessor(r);
        if (v != null && !isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 1 };
    };

    return {
      battles: calc((r) => r.battles),
      winRate: calc((r) => r.winRate),
      avgDamage: calc((r) => r.avgDamage),
      fragRate: calc((r) => r.avgFrags),
      survivalRate: calc((r) => r.survivalRate),
      avgXp: calc((r) => r.avgXp),
      spottingDamage: calc((r) => r.spottingDamage),
      potentialDamage: calc((r) => r.potentialDamage),
      planesDowned: calc((r) => r.planesDowned),
      pr: calc((r) => r.pr),
    };
  }, [filteredData]);

  // Table Columns configuration
  const columns = useMemo(() => {
    return [
      // 0. Rank
      columnHelper.display({
        id: 'rank',
        header: '#',
        size: 44,
        cell: (info) => (
          <span className="text-slate-500 font-mono text-[11px]">
            {info.row.index + 1}
          </span>
        ),
      }),

      // 1. Tier
      columnHelper.accessor('tier', {
        id: 'tier',
        header: 'Tier',
        size: 50,
        cell: (info) => (
          <span className="font-mono font-bold text-amber-300 text-xs">
            {TIER_ROMAN[info.getValue()] || info.getValue()}
          </span>
        ),
      }),

      // 2. Class
      columnHelper.accessor('class', {
        id: 'class',
        header: 'Class',
        size: 60,
        cell: (info) => {
          const cfg = CLASS_CONFIG[info.getValue()] || CLASS_CONFIG.Cruiser;
          return (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.bg} ${cfg.text}`}
              title={cfg.label}
            >
              {cfg.abbr}
            </span>
          );
        },
      }),

      // 3. Nation
      columnHelper.accessor('nation', {
        id: 'nation',
        header: 'Nation',
        size: 65,
        cell: (info) => (
          <span className="font-mono text-slate-400 uppercase text-[11px] truncate block" title={info.getValue()}>
            {info.getValue().replace('_', ' ')}
          </span>
        ),
      }),

      // 4. Ship Name (clickable)
      columnHelper.accessor('dispName', {
        id: 'dispName',
        header: 'Ship Name',
        size: 160,
        cell: (info) => {
          const ship = info.row.original;
          return (
            <div
              onClick={() => onNavigate('/params')}
              className="flex items-center gap-1.5 cursor-pointer group"
              title="Inspect in Parameters Matrix"
            >
              <span className="font-medium text-slate-100 group-hover:text-amber-300 truncate text-xs transition">
                {info.getValue() || ship.name}
              </span>
              <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-amber-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
            </div>
          );
        },
      }),

      // 5. Acquisition Badge (Last Pinned Column)
      columnHelper.display({
        id: 'acquisition',
        header: 'Acquisition',
        size: 130,
        cell: (info) => {
          const ship = info.row.original;
          const catalogShip = catalogMap.get(ship.shipId);
          const acq = catalogShip?.acquisition || {
            category: (ship.category as any) || 'Tech Tree',
            status: 'available_tech_tree' as any,
            primaryCurrency: 'none',
            price: null,
            couponEligible: false,
            couponPrice: null,
            steelEquivalent: null,
            minDoubloonsRequired: null,
            totalPhases: null,
            isClone: false,
            cloneOfShipId: null,
            obtainMethodText: ship.category || 'Tech Tree',
            rarity: null,
          };
          return <AcquisitionBadge acquisition={acq} />;
        },
      }),

      // 6. Battles
      columnHelper.accessor('battles', {
        id: 'battles',
        header: 'Battles',
        size: 95,
        cell: (info) => (
          <span className="font-mono text-slate-300 text-xs">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),

      // 7. Win Rate %
      columnHelper.accessor('winRate', {
        id: 'winRate',
        header: 'Win Rate',
        size: 90,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.winRate.min,
            metricRanges.winRate.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {val.toFixed(1)}%
            </span>
          );
        },
      }),

      // 8. PR (Personal Rating)
      columnHelper.accessor('pr', {
        id: 'pr',
        header: 'PR Benchmark',
        size: 135,
        cell: (info) => {
          const val = info.getValue();
          const tierInfo = getPRTier(val);
          return (
            <div className="flex items-center gap-1.5" title={`PR ${val} (${tierInfo.label})`}>
              <span className={`font-mono text-xs font-bold ${tierInfo.textClass}`}>
                {formatPR(val)}
              </span>
              <span
                className={`px-1.5 py-0.2 text-[10px] font-medium rounded border ${tierInfo.bgClass} ${tierInfo.borderClass} ${tierInfo.textClass}`}
              >
                {tierInfo.label}
              </span>
            </div>
          );
        },
      }),

      // 9. Avg Damage
      columnHelper.accessor('avgDamage', {
        id: 'avgDamage',
        header: 'Avg Damage',
        size: 100,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.avgDamage.min,
            metricRanges.avgDamage.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {val.toLocaleString()}
            </span>
          );
        },
      }),

      // 10. Frag Rate
      columnHelper.accessor('avgFrags', {
        id: 'avgFrags',
        header: 'Frag Rate',
        size: 85,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.fragRate.min,
            metricRanges.fragRate.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {val.toFixed(2)}
            </span>
          );
        },
      }),

      // 11. Survival %
      columnHelper.accessor('survivalRate', {
        id: 'survivalRate',
        header: 'Survival',
        size: 85,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.survivalRate.min,
            metricRanges.survivalRate.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {val.toFixed(1)}%
            </span>
          );
        },
      }),

      // 12. Avg XP
      columnHelper.accessor('avgXp', {
        id: 'avgXp',
        header: 'Avg XP',
        size: 85,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.avgXp.min,
            metricRanges.avgXp.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {val.toLocaleString()}
            </span>
          );
        },
      }),

      // 13. Spotting Damage
      columnHelper.accessor('spottingDamage', {
        id: 'spottingDamage',
        header: 'Spotting',
        size: 90,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.spottingDamage.min,
            metricRanges.spottingDamage.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {val.toLocaleString()}
            </span>
          );
        },
      }),

      // 14. Potential Damage
      columnHelper.accessor('potentialDamage', {
        id: 'potentialDamage',
        header: 'Potential Dmg',
        size: 105,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.potentialDamage.min,
            metricRanges.potentialDamage.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {(val / 1000).toFixed(0)}k
            </span>
          );
        },
      }),

      // 15. Planes Downed
      columnHelper.accessor('planesDowned', {
        id: 'planesDowned',
        header: 'Planes',
        size: 80,
        cell: (info) => {
          const val = info.getValue();
          const colorClass = getHeatmapColor(
            val,
            metricRanges.planesDowned.min,
            metricRanges.planesDowned.max,
            true
          );
          return (
            <span className={`font-mono text-xs ${colorClass}`}>
              {val.toFixed(1)}
            </span>
          );
        },
      }),
    ];
  }, [metricRanges, catalogMap, onNavigate]);

  // TanStack Table instance
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  // Virtualizer for 60fps scrolling
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 38,
    overscan: 25,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0;

  // Cumulative left offsets for pinned columns (indices 0 to 5)
  const pinnedOffsets = useMemo(() => {
    let acc = 0;
    return columns.slice(0, 6).map((col) => {
      const current = acc;
      acc += col.size || 80;
      return current;
    });
  }, [columns]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-53px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Filter and Controls Bar */}
      <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 lg:px-6 py-3 space-y-3 shrink-0">
        {/* Top Line: Title + Server + Span + Skill Bracket */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                Server Statistics & PR Performance Engine
                {isLoading && (
                  <span className="text-xs font-normal text-amber-400 animate-pulse">
                    (Loading snapshot...)
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">
                ShipTool battle-weighted win rates, average damage, XP, and local PR estimates
              </p>
              <p className={`text-[10px] ${statsStale ? 'text-amber-400' : 'text-slate-500'}`}>
                {statsStale ? 'Stale local cache' : statsSource || 'Local cache'}
                {statsSourceVersion ? ` · v${statsSourceVersion}` : ''}
                {statsLastUpdated ? ` · ${new Date(statsLastUpdated).toLocaleDateString()}` : ''}
              </p>
            </div>
          </div>

          {/* Server & Timespan Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Server Selection Pills */}
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
              {SERVER_OPTIONS.map((srv) => {
                const isActive = selectedServer === srv.id;
                return (
                  <button
                    key={srv.id}
                    onClick={() => setServer(srv.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={srv.sub}
                  >
                    {srv.label}
                  </button>
                );
              })}
            </div>

            {/* Timespan Selection Pills */}
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
              {SPAN_OPTIONS.map((span) => {
                const isActive = selectedSpan === span.id;
                return (
                  <button
                    key={span.id}
                    onClick={() => setSpan(span.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                      isActive
                        ? 'bg-slate-800 text-amber-300 font-semibold border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={span.sub}
                  >
                    {span.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Second Line: Skill Brackets & Cross-Domain Acquisition Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
          {/* Skill Bracket Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Skill Bracket:
            </span>
            {BRACKET_OPTIONS.map((brk) => {
              const isActive = selectedBracket === brk.id;
              return (
                <button
                  key={brk.id}
                  onClick={() => setBracket(brk.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    isActive
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                  title={brk.sub}
                >
                  {brk.label}
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ship or nation..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
        </div>

        {/* Third Line: Cross-Domain Acquisition Source Pills + Class & Tier Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
          {/* Acquisition Source Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Acquisition:
            </span>
            {ACQUISITION_PILLS.map((acq) => {
              const isActive = selectedAcquisition === acq;
              return (
                <button
                  key={acq}
                  onClick={() => setSelectedAcquisition(acq)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                >
                  {acq}
                </button>
              );
            })}
          </div>

          {/* Tier and Class quick pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ship Classes */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
                Class:
              </span>
              <button
                onClick={selectAllClasses}
                className={`px-1.5 py-0.5 rounded text-xs font-bold transition border ${
                  selectedClasses === null
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={clearClasses}
                className={`px-1.5 py-0.5 rounded text-xs font-bold transition border ${
                  selectedClasses !== null && selectedClasses.length === 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                None
              </button>
              {(['Destroyer', 'Cruiser', 'Battleship', 'AirCarrier', 'Submarine'] as ShipClass[]).map((cls) => {
                const isSel = selectedClasses !== null && selectedClasses.includes(cls);
                const cfg = CLASS_CONFIG[cls];
                return (
                  <button
                    key={cls}
                    onClick={() => toggleShipClass(cls)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition border ${
                      isSel
                        ? `${cfg.bg} ${cfg.text}`
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {cfg.abbr}
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-slate-800" />

            {/* Tiers */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
                Tier:
              </span>
              <button
                onClick={selectAllTiers}
                className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold transition border ${
                  selectedTiers === null
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={clearTiers}
                className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold transition border ${
                  selectedTiers !== null && selectedTiers.length === 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                None
              </button>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((t) => {
                const isSel = selectedTiers !== null && selectedTiers.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTier(t)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition border ${
                      isSel
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {TIER_ROMAN[t]}
                  </button>
                );
              })}
            </div>

            {/* Reset Filters */}
            {(selectedAcquisition !== 'All' ||
              selectedBracket !== 'all' ||
              selectedTiers !== null ||
              selectedClasses !== null ||
              searchQuery) && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-500/30 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Battle-Weighted Aggregate KPI Summary Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 lg:px-6 py-2 flex items-center justify-between overflow-x-auto gap-4 shrink-0 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Ships:</span>
            <strong className="text-white font-mono">{filteredData.length}</strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Total Battles:</span>
            <strong className="text-slate-200 font-mono">
              {aggregateMetrics.totalBattles.toLocaleString()}
            </strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Weighted WR:</span>
            <strong
              className={`font-mono font-bold ${
                aggregateMetrics.winRate >= 52
                  ? 'text-emerald-400'
                  : aggregateMetrics.winRate >= 49
                  ? 'text-slate-200'
                  : 'text-amber-400'
              }`}
            >
              {aggregateMetrics.winRate.toFixed(2)}%
            </strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Avg PR:</span>
            <strong className={`font-mono font-bold ${getPRTier(aggregateMetrics.avgPr).textClass}`}>
              {formatPR(aggregateMetrics.avgPr)}
            </strong>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] border ${
                getPRTier(aggregateMetrics.avgPr).bgClass
              } ${getPRTier(aggregateMetrics.avgPr).borderClass} ${
                getPRTier(aggregateMetrics.avgPr).textClass
              }`}
            >
              {getPRTier(aggregateMetrics.avgPr).label}
            </span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Avg Damage:</span>
            <strong className="text-slate-200 font-mono">
              {aggregateMetrics.avgDamage.toLocaleString()}
            </strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Frag Rate:</span>
            <strong className="text-slate-200 font-mono">
              {aggregateMetrics.fragRate.toFixed(2)}
            </strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Survival:</span>
            <strong className="text-slate-200 font-mono">
              {aggregateMetrics.survivalRate.toFixed(1)}%
            </strong>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>PR: local community-formula estimate</span>
        </div>
      </div>

      {/* Main Table Area (Virtualized & Scrollable) */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto relative bg-slate-950 select-none"
      >
        <table className="w-full text-left border-collapse table-fixed">
          {/* Table Header */}
          <thead className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isPinned = index < 6;
                  const leftOffset = isPinned ? pinnedOffsets[index] : undefined;
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      style={{
                        width: header.column.getSize(),
                        minWidth: header.column.getSize(),
                        maxWidth: header.column.getSize(),
                        left: leftOffset,
                      }}
                      className={`p-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider ${
                        isPinned
                          ? 'sticky z-30 bg-slate-900 border-r border-slate-800'
                          : ''
                      } ${index === 5 ? 'border-r-2 border-amber-500/40' : ''}`}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? 'flex items-center gap-1 cursor-pointer hover:text-white transition'
                              : 'flex items-center gap-1',
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          <span>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {header.column.getCanSort() && (
                            <span className="text-slate-500">
                              {isSorted === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-amber-400" />
                              ) : isSorted === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-amber-400" />
                              ) : (
                                <ArrowUpDown className="w-2.5 h-2.5 opacity-30 hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Table Body (Virtualized) */}
          <tbody className="divide-y divide-slate-800/40 font-mono">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-16 text-center text-slate-500 text-sm">
                  {error ? (
                    <div className="space-y-2">
                      <p className="text-rose-400 font-semibold">{error}</p>
                      <button
                        onClick={() => loadStats()}
                        className="px-3 py-1.5 rounded-lg text-xs bg-amber-500 text-slate-950 font-bold"
                      >
                        Retry Loading
                      </button>
                    </div>
                  ) : (
                    'No ships match the current server and filter criteria.'
                  )}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-800/40 odd:bg-slate-900/20 even:bg-slate-950/20 transition-colors"
                    >
                      {row.getVisibleCells().map((cell, index) => {
                        const isPinned = index < 6;
                        const leftOffset = isPinned ? pinnedOffsets[index] : undefined;

                        return (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              minWidth: cell.column.getSize(),
                              maxWidth: cell.column.getSize(),
                              left: leftOffset,
                            }}
                            className={`p-2.5 whitespace-nowrap text-xs ${
                              isPinned
                                ? 'sticky z-20 border-r border-slate-800 bg-slate-950/95'
                                : ''
                            } ${index === 5 ? 'border-r-2 border-amber-500/40' : ''}`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950 text-xs text-slate-400 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Displaying <strong className="text-white">{rows.length}</strong> ships on{' '}
            <strong className="text-amber-400 uppercase">
              {SERVER_OPTIONS.find((s) => s.id === selectedServer)?.label || selectedServer}
            </strong> server
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-[11px] text-slate-500">
            Bracket:{' '}
            <strong className="text-slate-300">
              {BRACKET_OPTIONS.find((b) => b.id === selectedBracket)?.label}
            </strong>
          </span>
        </div>

        {/* PR Tier Legend */}
        <div className="hidden md:flex items-center gap-2 text-[10px]">
          <span className="text-slate-500">PR Tiers:</span>
          <span className="text-red-400 font-bold">&lt;750</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-bold">750–1100</span>
          <span className="text-slate-600">|</span>
          <span className="text-yellow-400 font-bold">1100–1350</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-bold">1350–1550</span>
          <span className="text-slate-600">|</span>
          <span className="text-teal-400 font-bold">1550–1750</span>
          <span className="text-slate-600">|</span>
          <span className="text-fuchsia-400 font-bold">1750–2100</span>
          <span className="text-slate-600">|</span>
          <span className="text-purple-300 font-bold">2100+</span>
        </div>
      </div>
    </div>
  );
};

export default ServerStatsView;
