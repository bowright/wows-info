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
  Check,
  CheckSquare,
  Square,
  Zap,
} from 'lucide-react';
import type { ModifiedShipStats, ColumnPreset, ShipClass } from '../../types';
import { AcquisitionBadge } from '../common/AcquisitionBadge';
import { useShipStore } from '../../stores/useShipStore';
import { copyToClipboard } from '../../utils/clipboard';
import { ConsumableIconCell } from './ConsumableIconCell';

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

      track('repairPct', s.repairPct);
      track('citadelRepairPct', s.citadelRepairPct);
      track('fireResistance', s.fireResistance);
      track('fireDuration', s.fireDuration);
      track('fireDamage', s.fireDamage);
      track('noOfFires', s.noOfFires);
      track('torpedoProtection', s.torpedoProtection);
      track('floodingDuration', s.floodingDuration);
      track('floodingDamage', s.floodingDamage);
      track('noOfFloodings', s.noOfFloodings);

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
      if (s.secondary) {
        track('secondaryRangeKm', s.secondary.rangeKm);
        track('secondaryCaliberMm', s.secondary.caliberMm);
        track('secondaryBarrels', s.secondary.totalBarrels);
        track('secondaryReload', s.secondary.reload);
        track('secondaryHeDpm', s.secondary.heDpm);
        track('secondaryApDpm', s.secondary.apDpm);
        track('secondarySapDpm', s.secondary.sapDpm);
        track('secondaryFireChance', s.secondary.fireChance);
        track('secondaryPenetrationMm', s.secondary.penetrationMm);
      }
      track('traverse180', s.traverse180);
      track('horizontalDispersion', s.horizontalDispersion);
      track('verticalDispersion', s.verticalDispersion);
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

      if (s.consumables) {
        const dcp = s.consumables.find((c) => c.type === 'crashCrew');
        if (dcp) track('dcpTime', dcp.workTime);

        const repair = s.consumables.find((c) => c.type === 'regenCrew');
        if (repair) {
          track('repairTime', repair.workTime);
          if (repair.logic?.regenerationHPSpeed) {
            track('repairHpPct', repair.workTime * repair.logic.regenerationHPSpeed * 100);
          }
        }

        const smoke = s.consumables.find((c) => c.type === 'smokeGenerator');
        if (smoke) {
          track('smokeTime', smoke.workTime);
          if (smoke.logic?.lifeTime) track('smokeDispersion', smoke.logic.lifeTime);
          if (smoke.logic?.radius) track('smokeRadius', smoke.logic.radius * 30);
        }

        const hydro = s.consumables.find((c) => c.type === 'sonar');
        if (hydro) {
          track('hydroTime', hydro.workTime);
          if (hydro.logic?.distShip) track('hydroRange', hydro.logic.distShip * 0.03);
        }

        const radar = s.consumables.find((c) => c.type === 'rls');
        if (radar) {
          track('radarTime', radar.workTime);
          if (radar.logic?.distShip) track('radarRange', radar.logic.distShip * 0.03);
        }

        const speed = s.consumables.find((c) => c.type === 'speedBoosters');
        if (speed) {
          track('speedTime', speed.workTime);
          if (speed.logic?.boostCoeff) track('speedBoost', speed.logic.boostCoeff * 100);
        }

        const aux = s.consumables.find((c) => c.type === 'auxTorpBooster');
        if (aux) track('auxTime', aux.workTime);

        const mbrb = s.consumables.find((c) => c.type === 'artilleryBoosters');
        if (mbrb) {
          track('mbrbTime', mbrb.workTime);
          if (mbrb.logic?.boostCoeff) track('mbrbReload', Math.abs((mbrb.logic.boostCoeff - 1) * 100));
        }

        const hydrophone = s.consumables.find((c) => c.type === 'hydrophone');
        if (hydrophone && hydrophone.logic?.hydrophoneWaveRadius) {
          track('hydrophoneRange', hydrophone.logic.hydrophoneWaveRadius / 1000);
        }

        const surv = s.consumables.find((c) => c.type === 'submarineLocator');
        if (surv && surv.logic?.distShip) {
          track('survRange', surv.logic.distShip * 0.03);
        }
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
        size: 170,
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
                  {format(val) ?? '—'}
                </span>
              );
            },
            size,
          }
        )
      );
    };

    const addIconCol = (
      id: string,
      header: string,
      type: string,
      size = 80
    ) => {
      metricCols.push(
        columnHelper.accessor(
          (row) => {
            const c = row.consumables?.find((item) => item.type === type);
            if (!c) return -1;
            return c.numConsumables > 0 ? c.numConsumables : 999;
          },
          {
            id,
            header,
            cell: ({ row }) => {
              const c = row.original.consumables?.find((item) => item.type === type);
              return <ConsumableIconCell consumable={c} />;
            },
            size,
          }
        )
      );
    };

    // General preset columns
    if (activePreset === 'general' || activePreset === 'all') {
      addCol('health', 'Health', (s) => s.health, (v) => v.toLocaleString(), true, 80);
      addCol('speed', 'Max speed', (s) => s.speed, (v) => `${v.toFixed(1)}`, true, 85);
      addCol('rudderTime', 'Rudder shift', (s) => s.rudderTime, (v) => `${v.toFixed(1)}s`, false, 85);
      addCol('turningRadius', 'Turning radius', (s) => s.turningRadius, (v) => `${v}m`, false, 90);
      addCol('concealmentSurface', 'Detect. by sea', (s) => s.concealmentSurface, (v) => `${v.toFixed(2)} km`, false, 100);
      addCol('concealmentAir', 'Detect. by air', (s) => s.concealmentAir, (v) => `${v.toFixed(2)} km`, false, 95);
      addCol('smokePenalty', 'Smoke firing detect.', (s) => s.smokePenalty, (v) => `${v.toFixed(2)} km`, false, 125);
    }

    // Survivability preset columns (matching shiptool.st p=SRV)
    if (activePreset === 'survivability' || activePreset === 'all') {
      if (activePreset === 'survivability') {
        addCol('health', 'Health', (s) => s.health, (v) => v.toLocaleString(), true, 80);
      }
      addCol('repairPct', 'Repair %', (s) => s.repairPct, (v) => `${v}%`, true, 80);
      addCol('citadelRepairPct', 'Citadel repair %', (s) => s.citadelRepairPct, (v) => `${v}%`, true, 110);
      addCol('fireResistance', 'Fire resistance', (s) => s.fireResistance, (v) => `${Math.round(v)}%`, true, 105);
      addCol('fireDuration', 'Fire duration', (s) => s.fireDuration ?? s.burnTime ?? 60, (v) => `${v}s`, false, 95);
      addCol('fireDamage', 'Fire damage', (s) => s.fireDamage, (v) => `${v}%`, false, 90);
      addCol('noOfFires', 'No of fires', (s) => s.noOfFires, (v) => `${v}`, false, 85);
      addCol('torpedoProtection', 'Torpedo protection', (s) => s.torpedoProtection, (v) => `${v}%`, true, 120);
      addCol('floodingDuration', 'Flooding duration', (s) => s.floodingDuration ?? s.floodTime ?? 40, (v) => `${v}s`, false, 110);
      addCol('floodingDamage', 'Flooding damage', (s) => s.floodingDamage, (v) => `${v}%`, false, 105);
      addCol('noOfFloodings', 'No of floodings', (s) => s.noOfFloodings, (v) => `${v}`, false, 105);
    }

    // Artillery preset columns
    if (activePreset === 'artillery' || activePreset === 'all') {
      addCol('caliberMm', 'Caliber', (s) => s.artillery?.caliberMm, (v) => `${v}mm`, true, 80);
      addCol('rangeKm', 'Range', (s) => s.artillery?.rangeKm, (v) => `${v.toFixed(2)} km`, true, 85);
      addCol('reload', 'Reload', (s) => s.artillery?.reload, (v) => `${v.toFixed(1)}s`, false, 80);
      addCol('traverse180', '180° turn', (s) => s.traverse180, (v) => `${v.toFixed(1)}s`, false, 85);
      addCol('heDpm', 'HE DPM', (s) => s.artillery?.heDpm || null, (v) => v.toLocaleString(), true, 90);
      addCol('fireChance', 'Fire chance', (s) => s.artillery?.fireChance || null, (v) => `${v}%`, true, 85);
      addCol('apDpm', 'AP DPM', (s) => s.artillery?.apDpm || null, (v) => v.toLocaleString(), true, 90);
      addCol('sapDpm', 'SAP DPM', (s) => s.artillery?.sapDpm || null, (v) => v.toLocaleString(), true, 90);
      addCol('overmatchMm', 'Overmatch', (s) => s.artillery?.overmatchMm, (v) => `${v}mm`, true, 85);
      addCol('horizontalDispersion', 'Horiz. dispersion', (s) => s.horizontalDispersion, (v) => `${v}m`, false, 110);
      addCol('verticalDispersion', 'Vert. dispersion', (s) => s.verticalDispersion, (v) => `${v}m`, false, 105);
      addCol('sigma', 'Sigma', (s) => s.artillery?.sigma, (v) => `${v.toFixed(2)}`, true, 75);
    }

    // Secondary battery preset
    if (activePreset === 'secondary' || activePreset === 'all') {
      addCol('secondaryRangeKm', 'Secondary range', (s) => s.secondary?.rangeKm, (v) => `${v.toFixed(2)} km`, true, 110);
      addCol('secondaryCaliberMm', 'Secondary caliber', (s) => s.secondary?.caliberMm, (v) => `${v}mm`, true, 110);
      addCol('secondaryBarrels', 'Secondary barrels', (s) => s.secondary?.totalBarrels, (v) => `${v}`, true, 115);
      addCol('secondaryReload', 'Secondary reload', (s) => s.secondary?.reload, (v) => `${v.toFixed(1)}s`, false, 110);
      addCol('secondaryHeDpm', 'Secondary HE DPM', (s) => s.secondary?.heDpm || null, (v) => v.toLocaleString(), true, 125);
      addCol('secondaryApDpm', 'Secondary AP DPM', (s) => s.secondary?.apDpm || null, (v) => v.toLocaleString(), true, 125);
      addCol('secondarySapDpm', 'Secondary SAP DPM', (s) => s.secondary?.sapDpm || null, (v) => v.toLocaleString(), true, 130);
      addCol('secondaryFireChance', 'Secondary fire chance', (s) => s.secondary?.fireChance, (v) => `${v}%`, true, 135);
      addCol('secondaryPenetrationMm', 'Secondary penetration', (s) => s.secondary?.penetrationMm, (v) => `${v}mm`, true, 140);
    }

    // Torpedoes preset columns
    if (activePreset === 'torpedoes' || activePreset === 'all') {
      addCol('torpRange', activePreset === 'all' ? 'Torp. Range' : 'Range', (s) => s.torpedoes?.rangeKm, (v) => `${v.toFixed(1)} km`, true, 90);
      addCol('torpSpeed', activePreset === 'all' ? 'Torp. Speed' : 'Speed', (s) => s.torpedoes?.speed, (v) => `${v} kts`, true, 85);
      addCol('torpDamage', activePreset === 'all' ? 'Torp. Damage' : 'Damage', (s) => s.torpedoes?.damage, (v) => v.toLocaleString(), true, 95);
      addCol('torpReload', activePreset === 'all' ? 'Torp. Reload' : 'Reload', (s) => s.torpedoes?.reload, (v) => `${v.toFixed(1)}s`, false, 90);
      addCol('torpedoDetect', 'Detectability', (s) => s.torpedoDetect, (v) => `${v.toFixed(1)} km`, false, 95);
    }

    // AA preset columns
    if (activePreset === 'aa' || activePreset === 'all') {
      addCol('aaRange', 'AA Range', (s) => s.aaRange, (v) => `${v.toFixed(1)} km`, true, 85);
      addCol('aaDps', 'AA DPS', (s) => s.aaDps, (v) => v.toLocaleString(), true, 85);
      addCol('flakCount', 'Flak count', (s) => s.flakCount, (v) => `${v}`, true, 85);
    }

    // ASW preset columns
    if (activePreset === 'asw' || activePreset === 'all') {
      addCol('aswRange', 'ASW Range', (s) => s.aswRange, (v) => `${v.toFixed(1)} km`, true, 90);
      addCol('aswReload', activePreset === 'all' ? 'ASW Reload' : 'Reload', (s) => s.asw?.reloadTime, (v) => `${v}s`, false, 85);
    }

    // Consumables preset columns (matching shiptool.st p=CON)
    if (activePreset === 'consumables' || activePreset === 'all') {
      const isConsumablePreset = activePreset === 'consumables';
      // Dynamic hideable check if in consumables preset: only show column if at least one visible ship has that ability
      const hasType = (t: string) => !isConsumablePreset || data.some((s) => s.consumables?.some((c) => c.type === t));

      // 1. Damage Control Party
      if (hasType('crashCrew')) {
        addIconCol('dcp', 'Damage con.', 'crashCrew', 85);
        addCol(
          'dcpTime',
          isConsumablePreset ? 'Time' : 'DCP Time',
          (s) => s.consumables?.find((c) => c.type === 'crashCrew')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
      }

      // 2. Repair Party
      if (hasType('regenCrew')) {
        addIconCol('repair', 'Repair party', 'regenCrew', 85);
        addCol(
          'repairTime',
          isConsumablePreset ? 'Time' : 'Repair Time',
          (s) => s.consumables?.find((c) => c.type === 'regenCrew')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
        addCol(
          'repairHpPct',
          'Repair %',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'regenCrew');
            return c?.logic?.regenerationHPSpeed
              ? Math.round(c.workTime * c.logic.regenerationHPSpeed * 1000) / 10
              : null;
          },
          (v) => `${v}%`,
          true,
          80
        );
      }

      // 3. Smoke Generator
      if (hasType('smokeGenerator')) {
        addIconCol('smoke', 'Smoke', 'smokeGenerator', 80);
        addCol(
          'smokeTime',
          isConsumablePreset ? 'Time' : 'Smoke Time',
          (s) => s.consumables?.find((c) => c.type === 'smokeGenerator')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
        addCol(
          'smokeDispersion',
          'Dispersion',
          (s) => s.consumables?.find((c) => c.type === 'smokeGenerator')?.logic?.lifeTime,
          (v) => `${v}s`,
          true,
          85
        );
        addCol(
          'smokeRadius',
          'Radius',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'smokeGenerator');
            return c?.logic?.radius ? Math.round(c.logic.radius * 30) : null;
          },
          (v) => `${v}m`,
          true,
          80
        );
      }

      // 4. Hydroacoustic Search
      if (hasType('sonar')) {
        addIconCol('hydro', 'Hydro', 'sonar', 80);
        addCol(
          'hydroTime',
          isConsumablePreset ? 'Time' : 'Hydro Time',
          (s) => s.consumables?.find((c) => c.type === 'sonar')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
        addCol(
          'hydroRange',
          isConsumablePreset ? 'Range' : 'Hydro Range',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'sonar');
            return c?.logic?.distShip ? Math.round(c.logic.distShip * 30 / 100) / 10 : null;
          },
          (v) => `${v.toFixed(1)} km`,
          true,
          85
        );
      }

      // 5. Surveillance Radar
      if (hasType('rls')) {
        addIconCol('radar', 'Radar', 'rls', 80);
        addCol(
          'radarTime',
          isConsumablePreset ? 'Time' : 'Radar Time',
          (s) => s.consumables?.find((c) => c.type === 'rls')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
        addCol(
          'radarRange',
          isConsumablePreset ? 'Range' : 'Radar Range',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'rls');
            return c?.logic?.distShip ? Math.round(c.logic.distShip * 30 / 100) / 10 : null;
          },
          (v) => `${v.toFixed(1)} km`,
          true,
          85
        );
      }

      // 6. Engine Boost
      if (hasType('speedBoosters')) {
        addIconCol('speed', 'Engine boost', 'speedBoosters', 85);
        addCol(
          'speedTime',
          isConsumablePreset ? 'Time' : 'Speed Time',
          (s) => s.consumables?.find((c) => c.type === 'speedBoosters')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
        addCol(
          'speedBoost',
          'Speed',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'speedBoosters');
            return c?.logic?.boostCoeff ? Math.round(c.logic.boostCoeff * 100) : null;
          },
          (v) => `+${v}%`,
          true,
          80
        );
      }

      // 7. Auxiliary
      if (hasType('auxTorpBooster')) {
        addIconCol('aux', 'Auxiliary', 'auxTorpBooster', 80);
        addCol(
          'auxTime',
          isConsumablePreset ? 'Time' : 'Aux Time',
          (s) => s.consumables?.find((c) => c.type === 'auxTorpBooster')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
      }

      // 8. Main Battery Reload Booster (MBRB)
      if (hasType('artilleryBoosters')) {
        addIconCol('mbrb', 'MBRB', 'artilleryBoosters', 80);
        addCol(
          'mbrbTime',
          isConsumablePreset ? 'Time' : 'MBRB Time',
          (s) => s.consumables?.find((c) => c.type === 'artilleryBoosters')?.workTime,
          (v) => `${v}s`,
          true,
          75
        );
        addCol(
          'mbrbReload',
          'Reload',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'artilleryBoosters');
            return c?.logic?.boostCoeff ? Math.round((c.logic.boostCoeff - 1) * 100) : null;
          },
          (v) => `${v}%`,
          false,
          80
        );
      }

      // 9. Torpedo Reload Booster (TRB)
      if (hasType('torpedoReloader')) {
        addIconCol('trb', 'TRB', 'torpedoReloader', 80);
      }

      // 10. Catapult Fighter
      if (hasType('fighter')) {
        addIconCol('fighter', 'Fighters', 'fighter', 80);
      }

      // 11. Spotting Aircraft
      if (hasType('scout')) {
        addIconCol('spotter', 'Spotter', 'scout', 80);
      }

      // 12. Hydrophone
      if (hasType('hydrophone')) {
        addIconCol('hydrophone', 'Hydrophone', 'hydrophone', 85);
        addCol(
          'hydrophoneRange',
          isConsumablePreset ? 'Range' : 'HydP. Range',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'hydrophone');
            return c?.logic?.hydrophoneWaveRadius ? Math.round(c.logic.hydrophoneWaveRadius / 100) / 10 : null;
          },
          (v) => `${v.toFixed(1)} km`,
          true,
          85
        );
      }

      // 13. Submarine Surveillance
      if (hasType('submarineLocator')) {
        addIconCol('submarineSurveillance', 'Sub. surveillance', 'submarineLocator', 95);
        addCol(
          'submarineSurveillanceRange',
          isConsumablePreset ? 'Range' : 'Sub Surv. Range',
          (s) => {
            const c = s.consumables?.find((item) => item.type === 'submarineLocator');
            return c?.logic?.distShip ? Math.round(c.logic.distShip * 30 / 100) / 10 : null;
          },
          (v) => `${v.toFixed(1)} km`,
          true,
          85
        );
      }

      // 14. Enhanced Rudder
      if (hasType('fastRudders')) {
        addIconCol('fastRudders', 'Enhanced rudder', 'fastRudders', 90);
      }

      // 15. Reserve Battery
      if (hasType('subsEnergyFreeze')) {
        addIconCol('subsEnergyFreeze', 'Res. battery', 'subsEnergyFreeze', 85);
      }
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
  const [copied, setCopied] = useState(false);

  const handleCopyTable = async () => {
    const exportColumns = columns.filter((col) => col.id !== 'compare');
    const headerRow = exportColumns.map((col) => {
      if (typeof col.header === 'string') return col.header;
      return col.id || '';
    });

    const tsvRows = rows.map((row) => {
      return exportColumns.map((col) => {
        if (!col.id) return '';
        const val = row.getValue(col.id);
        if (val === null || val === undefined) return '';
        if (col.id === 'tier' && typeof val === 'number') return TIER_ROMAN[val] || val;
        return String(val);
      }).join('\t');
    });

    const tsv = [headerRow.join('\t'), ...tsvRows].join('\n');
    const ok = await copyToClipboard(tsv);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        <table className="w-full text-left border-collapse text-xs select-text">
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
                            className={`p-2.5 whitespace-nowrap text-xs select-text ${
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

      {/* Table Footer: Status info & Copy Table */}
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
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyTable}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px] font-medium select-none cursor-pointer"
            title="Copy current visible table to clipboard as TSV (tab-separated values, Excel compatible)"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied TSV!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy Table</span>
              </>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-slate-400">High / Optimal</span>
            <span className="inline-block w-2 h-2 rounded-full bg-rose-400 ml-2" />
            <span className="text-[11px] text-slate-400">Low</span>
          </div>
        </div>
      </div>
    </div>
  );
};
