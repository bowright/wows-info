import React, { useMemo, useRef, useState } from 'react';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  CheckSquare,
  Square,
  Zap,
} from 'lucide-react';
import type { ModifiedShipStats, ColumnPreset, ShipClass } from '../../types';
import { AcquisitionBadge } from '../common/AcquisitionBadge';
import { useShipStore } from '../../stores/useShipStore';

interface VirtualizedTableProps {
  data: ModifiedShipStats[];
  activePreset: ColumnPreset;
  applyCoupons: boolean;
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

const CLASS_COLORS: Record<ShipClass, { bg: string; text: string; abbr: string }> = {
  Destroyer: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', abbr: 'DD' },
  Cruiser: { bg: 'bg-cyan-500/15 border-cyan-500/30', text: 'text-cyan-400', abbr: 'CA' },
  Battleship: { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', abbr: 'BB' },
  AirCarrier: { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', abbr: 'CV' },
  Submarine: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', abbr: 'SS' },
};

const NATION_LABELS: Record<string, string> = {
  usa: 'US',
  japan: 'JP',
  germany: 'DE',
  ussr: 'RU',
  uk: 'UK',
  france: 'FR',
  italy: 'IT',
  pan_asia: 'PA',
  europe: 'EU',
  netherlands: 'NL',
  commonwealth: 'CW',
  pan_america: 'PM',
  spain: 'ES',
};

// Heatmap color calculation
function getHeatmapColor(
  value: number | null | undefined,
  min: number,
  max: number,
  higherIsBetter = true
): string {
  if (value == null || isNaN(value) || min === max) return 'text-slate-300';
  const ratio = (value - min) / (max - min);
  const normalized = higherIsBetter ? ratio : 1 - ratio;

  if (normalized >= 0.82) return 'text-emerald-400 font-semibold';
  if (normalized >= 0.60) return 'text-teal-300 font-medium';
  if (normalized >= 0.40) return 'text-slate-200';
  if (normalized >= 0.20) return 'text-amber-300/90';
  return 'text-rose-400/90';
}

const columnHelper = createColumnHelper<ModifiedShipStats>();

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  data,
  activePreset,
  applyCoupons,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const selectedShipIds = useShipStore((state) => state.selectedShipIds);
  const toggleCompareShip = useShipStore((state) => state.toggleCompareShip);

  // Compute stat min/max ranges across visible data for heatmap color scaling
  const statRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number }> = {};

    const track = (key: string, val: number | null | undefined) => {
      if (val == null || isNaN(val) || val <= 0) return;
      if (!ranges[key]) {
        ranges[key] = { min: val, max: val };
      } else {
        if (val < ranges[key].min) ranges[key].min = val;
        if (val > ranges[key].max) ranges[key].max = val;
      }
    };

    for (const s of data) {
      track('health', s.health);
      track('speed', s.speed);
      track('rudderTime', s.rudderTime);
      track('turningRadius', s.turningRadius);
      track('concealmentSurface', s.concealmentSurface);
      track('concealmentAir', s.concealmentAir);
      track('smokePenalty', s.smokePenalty);
      track('burnTime', s.burnTime);
      track('floodTime', s.floodTime);

      if (s.artillery) {
        track('caliberMm', s.artillery.caliberMm);
        track('reload', s.artillery.reload);
        track('rangeKm', s.artillery.rangeKm);
        track('heDpm', s.artillery.heDpm);
        track('apDpm', s.artillery.apDpm);
        track('sapDpm', s.artillery.sapDpm);
        track('fireChance', s.artillery.fireChance);
        track('sigma', s.artillery.sigma);
        track('overmatchMm', s.artillery.overmatchMm);
      }
      track('traverse180', s.traverse180);
      track('horizontalDispersion', s.horizontalDispersion);
      track('heAlpha', s.heAlpha);
      track('apAlpha', s.apAlpha);
      track('sapAlpha', s.sapAlpha);

      if (s.torpedoes) {
        track('torpRange', s.torpedoes.rangeKm);
        track('torpSpeed', s.torpedoes.speed);
        track('torpDamage', s.torpedoes.damage);
        track('torpReload', s.torpedoes.reload);
      }
      track('torpedoDetect', s.torpedoDetect);

      track('aaRange', s.aaRange);
      track('aaDps', s.aaDps);
      track('flakCount', s.flakCount);

      track('aswRange', s.aswRange);
      if (s.asw) {
        track('aswReload', s.asw.reloadTime);
      }
    }

    return ranges;
  }, [data]);

  // Build TanStack Table column definitions
  const columns = useMemo(() => {
    // 1. Pinned Columns (Always on the left)
    const pinned = [
      columnHelper.display({
        id: 'compare',
        header: () => <span className="sr-only">Compare</span>,
        cell: ({ row }) => {
          const isSelected = selectedShipIds.includes(row.original.id);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCompareShip(row.original.id);
              }}
              className="p-1 hover:text-amber-400 transition"
              title={isSelected ? 'Remove from compare' : 'Add to compare'}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
              )}
            </button>
          );
        },
        size: 38,
      }),

      columnHelper.accessor('tier', {
        id: 'tier',
        header: 'Tier',
        cell: (info) => (
          <span className="font-bold font-mono text-amber-400">
            {TIER_ROMAN[info.getValue()] || info.getValue()}
          </span>
        ),
        size: 48,
      }),

      columnHelper.accessor('class', {
        id: 'class',
        header: 'Class',
        cell: (info) => {
          const cls = info.getValue();
          const meta = CLASS_COLORS[cls] || { bg: 'bg-slate-800', text: 'text-slate-300', abbr: '??' };
          return (
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${meta.bg} ${meta.text}`}
              title={cls}
            >
              {meta.abbr}
            </span>
          );
        },
        size: 58,
      }),

      columnHelper.accessor('nation', {
        id: 'nation',
        header: 'Nation',
        cell: (info) => {
          const nat = info.getValue().toLowerCase();
          return (
            <span className="text-[11px] font-mono uppercase font-semibold text-slate-400">
              {NATION_LABELS[nat] || nat.slice(0, 3)}
            </span>
          );
        },
        size: 65,
      }),

      columnHelper.accessor('dispName', {
        id: 'name',
        header: 'Ship Name',
        cell: ({ row }) => {
          const isClone = row.original.acquisition?.isClone;
          const hasMods = row.original.modifiersApplied && row.original.modifiersApplied.length > 0;
          return (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-semibold text-slate-100 truncate text-xs">
                {row.original.dispName}
              </span>
              {isClone && (
                <span
                  title="Clone / Replica Ship"
                  className="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800 shrink-0"
                >
                  <Copy className="w-2.5 h-2.5 inline mr-0.5" />
                  Clone
                </span>
              )}
              {hasMods && (
                <span
                  title={`${row.original.modifiersApplied.length} Modifiers Active`}
                  className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800 shrink-0"
                >
                  <Zap className="w-2.5 h-2.5 inline" />
                </span>
              )}
            </div>
          );
        },
        size: 190,
      }),

      columnHelper.accessor((row) => row.acquisition?.category || 'Tech Tree', {
        id: 'acquisition',
        header: 'Acquisition',
        cell: ({ row }) => (
          <AcquisitionBadge
            acquisition={row.original.acquisition}
            applyCoupons={applyCoupons}
          />
        ),
        size: 155,
      }),
    ];

    // 2. Preset-Specific Metric Columns
    const metricCols: any[] = [];

    const addCol = (
      id: string,
      header: string,
      getValue: (s: ModifiedShipStats) => number | string | null | undefined,
      format: (v: any) => string,
      higherIsBetter = true,
      size = 90
    ) => {
      metricCols.push(
        columnHelper.accessor(
          (row) => getValue(row),
          {
            id,
            header,
            cell: (info) => {
              const val = info.getValue() as number | null | undefined;
              if (val == null || isNaN(val as number)) {
                return <span className="text-slate-600 font-mono">—</span>;
              }
              const range = statRanges[id];
              const colorClass = range
                ? getHeatmapColor(val as number, range.min, range.max, higherIsBetter)
                : 'text-slate-200';
              return (
                <span className={`font-mono text-xs ${colorClass}`}>
                  {format(val)}
                </span>
              );
            },
            size,
          }
        )
      );
    };

    // General preset columns
    if (activePreset === 'general' || activePreset === 'all') {
      addCol('health', 'HP', (s) => s.health, (v) => v.toLocaleString(), true, 80);
      addCol('speed', 'Speed (kts)', (s) => s.speed, (v) => `${v.toFixed(1)}`, true, 85);
      addCol('rudderTime', 'Rudder (s)', (s) => s.rudderTime, (v) => `${v.toFixed(1)}s`, false, 85);
      addCol('turningRadius', 'Turning (m)', (s) => s.turningRadius, (v) => `${v}m`, false, 85);
      addCol('concealmentSurface', 'Conceal Surf', (s) => s.concealmentSurface, (v) => `${v.toFixed(2)} km`, false, 95);
      addCol('concealmentAir', 'Conceal Air', (s) => s.concealmentAir, (v) => `${v.toFixed(2)} km`, false, 90);
      addCol('smokePenalty', 'Smoke Pen', (s) => s.smokePenalty, (v) => `${v.toFixed(2)} km`, false, 90);
    }

    // Survivability preset columns
    if (activePreset === 'survivability') {
      addCol('health', 'HP', (s) => s.health, (v) => v.toLocaleString(), true, 80);
      addCol('rudderTime', 'Rudder (s)', (s) => s.rudderTime, (v) => `${v.toFixed(1)}s`, false, 85);
      addCol('turningRadius', 'Turning (m)', (s) => s.turningRadius, (v) => `${v}m`, false, 85);
      addCol('concealmentSurface', 'Conceal Surf', (s) => s.concealmentSurface, (v) => `${v.toFixed(2)} km`, false, 95);
      addCol('concealmentAir', 'Conceal Air', (s) => s.concealmentAir, (v) => `${v.toFixed(2)} km`, false, 90);
      addCol('smokePenalty', 'Smoke Pen', (s) => s.smokePenalty, (v) => `${v.toFixed(2)} km`, false, 90);
      addCol('burnTime', 'Fire Dur', (s) => s.burnTime ?? 60, (v) => `${v}s`, false, 80);
      addCol('floodTime', 'Flood Dur', (s) => s.floodTime ?? 30, (v) => `${v}s`, false, 80);
    }

    // Artillery preset columns
    if (activePreset === 'artillery' || activePreset === 'all') {
      addCol('caliberMm', 'Caliber', (s) => s.artillery?.caliberMm, (v) => `${v}mm`, true, 80);
      addCol('rangeKm', 'Range', (s) => s.artillery?.rangeKm, (v) => `${v.toFixed(2)} km`, true, 85);
      addCol('reload', 'Reload', (s) => s.artillery?.reload, (v) => `${v.toFixed(1)}s`, false, 80);
      addCol('traverse180', '180° Trav', (s) => s.traverse180, (v) => `${v.toFixed(1)}s`, false, 85);
      addCol('heDpm', 'HE DPM', (s) => s.artillery?.heDpm, (v) => v.toLocaleString(), true, 90);
      addCol('fireChance', 'Fire %', (s) => s.artillery?.fireChance, (v) => `${v}%`, true, 75);
      addCol('apDpm', 'AP DPM', (s) => s.artillery?.apDpm, (v) => v.toLocaleString(), true, 90);
      addCol('sapDpm', 'SAP DPM', (s) => s.artillery?.sapDpm, (v) => (v > 0 ? v.toLocaleString() : null), true, 90);
      addCol('overmatchMm', 'Overmatch', (s) => s.artillery?.overmatchMm, (v) => `${v}mm`, true, 85);
      addCol('horizontalDispersion', 'Dispersion', (s) => s.horizontalDispersion, (v) => `${v}m`, false, 85);
      addCol('sigma', 'Sigma', (s) => s.artillery?.sigma, (v) => `${v.toFixed(2)}`, true, 75);
    }

    // Torpedoes preset columns
    if (activePreset === 'torpedoes' || activePreset === 'all') {
      addCol('torpRange', 'Torp Range', (s) => s.torpedoes?.rangeKm, (v) => `${v.toFixed(1)} km`, true, 90);
      addCol('torpSpeed', 'Torp Spd', (s) => s.torpedoes?.speed, (v) => `${v} kts`, true, 80);
      addCol('torpDamage', 'Torp Dmg', (s) => s.torpedoes?.damage, (v) => v.toLocaleString(), true, 90);
      addCol('torpReload', 'Torp Reload', (s) => s.torpedoes?.reload, (v) => `${v.toFixed(1)}s`, false, 90);
      addCol('torpedoDetect', 'Torp Detect', (s) => s.torpedoDetect, (v) => `${v.toFixed(1)} km`, false, 90);
    }

    // AA preset columns
    if (activePreset === 'aa' || activePreset === 'all') {
      addCol('aaRange', 'AA Range', (s) => s.aaRange, (v) => `${v.toFixed(1)} km`, true, 85);
      addCol('aaDps', 'AA DPS', (s) => s.aaDps, (v) => v.toLocaleString(), true, 85);
      addCol('flakCount', 'Flak Bursts', (s) => s.flakCount, (v) => `${v}`, true, 85);
    }

    // ASW preset columns
    if (activePreset === 'asw' || activePreset === 'all') {
      addCol('aswRange', 'ASW Range', (s) => s.aswRange, (v) => `${v.toFixed(1)} km`, true, 90);
      addCol('aswReload', 'ASW Reload', (s) => s.asw?.reloadTime, (v) => `${v}s`, false, 85);
    }

    return [...pinned, ...metricCols];
  }, [activePreset, applyCoupons, selectedShipIds, statRanges, toggleCompareShip]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  // Cumulative left offsets for pinned columns (first 6 columns)
  const pinnedWidths = [38, 48, 58, 65, 190, 155];
  const pinnedOffsets = useMemo(() => {
    const offsets = [0];
    for (let i = 0; i < pinnedWidths.length - 1; i++) {
      offsets.push(offsets[i] + pinnedWidths[i]);
    }
    return offsets;
  }, []);

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-xl flex flex-col h-[720px]">
      {/* Table Scroll Container */}
      <div
        ref={tableContainerRef}
        className="overflow-auto flex-1 relative scrollbar-thin scrollbar-thumb-slate-700"
      >
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead className="sticky top-0 z-30 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 shadow-md">
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
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        maxWidth: header.getSize(),
                        left: leftOffset,
                      }}
                      className={`p-2.5 whitespace-nowrap select-none ${
                        isPinned
                          ? 'sticky z-30 bg-slate-950 border-r border-slate-800/80'
                          : 'bg-slate-950'
                      } ${index === 5 ? 'border-r-2 border-amber-500/30' : ''}`}
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
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {header.column.getCanSort() && (
                            <span className="text-slate-500">
                              {isSorted === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-amber-400" />
                              ) : isSorted === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-amber-400" />
                              ) : (
                                <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
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
          <tbody className="divide-y divide-slate-800/50">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-16 text-center text-slate-500 text-sm"
                >
                  No ships match the current filter selection.
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
                  const isSelected = selectedShipIds.includes(row.original.id);

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors duration-100 ${
                        isSelected
                          ? 'bg-amber-950/25 hover:bg-amber-950/35'
                          : 'hover:bg-slate-800/40 odd:bg-slate-900/30 even:bg-slate-950/20'
                      }`}
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
                                ? `sticky z-20 border-r border-slate-800/80 ${
                                    isSelected ? 'bg-slate-900/95' : 'bg-slate-950/95'
                                  }`
                                : ''
                            } ${index === 5 ? 'border-r-2 border-amber-500/30' : ''}`}
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

      {/* Table Footer: Status info */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-white">{rows.length}</strong> ships
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] text-slate-500">
            Click column headers to sort. Pinned columns remain fixed while scrolling.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-slate-400">High / Optimal</span>
          <span className="inline-block w-2 h-2 rounded-full bg-rose-400 ml-2" />
          <span className="text-[11px] text-slate-400">Low</span>
        </div>
      </div>
    </div>
  );
};
