import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  CheckSquare,
  Square,
  Zap,
  Award,
} from 'lucide-react';
import type { ModifiedShipStats, ColumnPreset, ShipClass } from '../../types';
import { AcquisitionBadge } from '../common/AcquisitionBadge';
import { useShipStore } from '../../stores/useShipStore';
import { copyToClipboard } from '../../utils/clipboard';
import { ConsumableIconCell } from './ConsumableIconCell';
import { PINNED_COLUMN_WIDTHS } from './pinnedColumnWidths';

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
  united_kingdom: 'UK',
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
const compactMetricWidth = (size: number) => Math.max(80, Math.round(size * 0.9));
const minHeaderWidth = (header: unknown) => {
  if (typeof header !== 'string') return 74;
  const longestWord = Math.max(...header.split(/\s+/).map((word) => word.length));
  return Math.max(74, Math.ceil(longestWord * 6.5 + 28));
};

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  data,
  activePreset,
  applyCoupons,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableHeaderRef = useRef<HTMLTableSectionElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const [horizontalScrollMetrics, setHorizontalScrollMetrics] = useState({ contentWidth: 0, viewportWidth: 0 });
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth
  );
  const [scrollMargin, setScrollMargin] = useState(0);

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
        track('aswAttacks', s.asw.attacks);
        track('aswBombs', s.asw.bombs);
        track('aswInterval', s.asw.dropInterval);
        track('aswTimer', s.asw.detonationTimer);
        track('aswDepth', s.asw.detonationDepth);
        track('aswDmg', s.asw.damage);
        track('aswRad', s.asw.radius);
        track('aswFlood', s.asw.floodChance);
        track('aswFire', s.asw.fireChance);
        track('asHp', s.asw.health);
        track('asMinR', s.asw.minRangeKm);
        track('asMaxR', s.asw.rangeKm);
        track('asPen', s.asw.penetration);
      }

      // General metrics
      track('length', s.length);
      track('beam', s.beam);
      track('tonnage', s.tonnage);
      track('powerWeight', s.powerWeight);
      track('acceleration', s.acceleration);

      // Diving metrics
      track('subDetectability', s.subDetectability);
      track('submergedSpeed', s.submergedSpeed);
      track('divingPlaneShift', s.divingPlaneShift);
      track('diveSpeed', s.diveSpeed);
      track('diveCapacity', s.diveCapacity);
      track('diveDepletionRate', s.diveDepletionRate);
      track('diveRechargeRate', s.diveRechargeRate);

      // Sonar metrics
      if (s.sonar) {
        track('sonarRange', s.sonar.rangeKm);
        track('sonarReload', s.sonar.reload);
        track('sonarTrav', s.sonar.traverse180);
        track('sonarLife1', s.sonar.life1);
        track('sonarLife2', s.sonar.life2);
        track('sonarWidth', s.sonar.width);
        track('sonarSpeed', s.sonar.speed);
      }

      // Shells detailed metrics
      if (s.artillery) {
        track('apSalvo', s.artillery.apSalvo);
        track('heSalvo', s.artillery.heSalvo);
        track('sapSalvo', s.artillery.sapSalvo);
        track('artSpm', s.artillery.shellsPerMinute);
        if (s.artillery.ap) {
          track('apWeight', s.artillery.ap.bulletMass);
          track('apDamage', s.artillery.ap.damage);
          track('apSpeed', s.artillery.ap.bulletSpeed);
          track('apDrag', s.artillery.ap.airDrag);
          track('apFlightTime', s.artillery.ap.flightTime);
          track('apImpactSpeed', s.artillery.ap.impactVelocity);
          track('apImpactAngle', s.artillery.ap.impactAngle);
          track('apKrupp', s.artillery.ap.krupp);
          track('apPen', s.artillery.ap.penetrationMm);
          track('apThreshold', s.artillery.ap.threshold);
          track('apFuse', s.artillery.ap.fuse);
        }
        if (s.artillery.he) {
          track('heWeight', s.artillery.he.bulletMass);
          track('heDamage', s.artillery.he.damage);
          track('heSpeed', s.artillery.he.bulletSpeed);
          track('heDrag', s.artillery.he.airDrag);
          track('heFlightTime', s.artillery.he.flightTime);
          track('heImpactSpeed', s.artillery.he.impactVelocity);
          track('heImpactAngle', s.artillery.he.impactAngle);
          track('hePen', s.artillery.he.penetrationMm);
          track('heFpm', s.artillery.he.firesPerMin);
        }
        if (s.artillery.sap) {
          track('sapWeight', s.artillery.sap.bulletMass);
          track('sapDamage', s.artillery.sap.damage);
          track('sapSpeed', s.artillery.sap.bulletSpeed);
          track('sapDrag', s.artillery.sap.airDrag);
          track('sapFlightTime', s.artillery.sap.flightTime);
          track('sapImpactSpeed', s.artillery.sap.impactVelocity);
          track('sapImpactAngle', s.artillery.sap.impactAngle);
          track('sapPen', s.artillery.sap.penetrationMm);
        }
      }

      // Secondary detailed metrics
      if (s.secondary) {
        track('secondaryDpm', (s.secondary.heDpm || 0) + (s.secondary.apDpm || 0) + (s.secondary.sapDpm || 0));
        track('secHitDpm', s.secondary.hitDpm);
        track('secFlightTime', s.secondary.flightTime);
        track('secHorizDisp', s.secondary.horizontalDispersion);
        track('secSigma', s.secondary.sigma);
        track('secFireChance', s.secondary.fireChance);
        track('secFpm', s.secondary.firesPerMin);
        track('secSpm', s.secondary.shellsPerMinute);
      }

      // Torpedoes detailed metrics
      if (s.torpedoes) {
        track('torpLoaders', s.torpedoes.loaders);
        track('torpDpm', s.torpedoes.dpm);
        track('torpSpread', s.torpedoes.spread);
        track('torpFlood', s.torpedoes.floodChance);
        track('torpReact', s.torpedoes.reactionTimeSeconds);
        track('torpTpm', s.torpedoes.torpsPerMinute);
        track('torpHoming', s.torpedoes.homingRate);
      }

      // AA detailed metrics
      if (s.aa) {
        track('aaStr', s.aa.totalDps);
        track('aaLongRng', s.aa.farRange);
        track('aaLongDps', s.aa.farDps);
        track('aaMedRng', s.aa.mediumRange);
        track('aaMedDps', s.aa.mediumDps);
        track('aaShortRng', s.aa.nearRange);
        track('aaShortDps', s.aa.nearDps);
        track('aaFlakStr', s.aa.flakDamage);
        track('aaFlakDps', s.aa.flakDamage);
      }

      // Aircraft metrics
      if (s.aircraft) {
        const att = s.aircraft.attackAircraft?.planes?.[0];
        if (att) {
          track('attHp', att.maxHealth);
          track('attSpd', att.speed);
          track('attDet', att.detectability);
          track('attDeck', att.hangarSize);
          track('attRegen', att.restorationTimeSeconds);
          track('attSquad', att.squadronSize);
          track('attDmg', att.payload?.alphaDamage);
          track('attFire', att.payload?.fireChance);
          track('attPen', att.payload?.penetrationMm);
          track('attThres', att.payload?.detonatorThreshold);
          track('attFuse', att.payload?.detonatorFuse);
        }
        const tb = s.aircraft.torpedoBombers?.planes?.[0];
        if (tb) {
          track('tbHp', tb.maxHealth);
          track('tbSpd', tb.speed);
          track('tbDet', tb.detectability);
          track('tbDeck', tb.hangarSize);
          track('tbRegen', tb.restorationTimeSeconds);
          track('tbSquad', tb.squadronSize);
          track('tbTspd', tb.payload?.torpedoSpeed);
          track('tbArmt', tb.payload?.armingTime);
          track('tbRange', tb.payload?.rangeKm);
          track('tbDmg', tb.payload?.alphaDamage);
          track('tbFlood', tb.payload?.floodChance);
        }
        const db = s.aircraft.diveBombers?.planes?.[0];
        if (db) {
          track('dbHp', db.maxHealth);
          track('dbSpd', db.speed);
          track('dbDet', db.detectability);
          track('dbDeck', db.hangarSize);
          track('dbRegen', db.restorationTimeSeconds);
          track('dbSquad', db.squadronSize);
          track('dbDmg', db.payload?.alphaDamage);
          track('dbFire', db.payload?.fireChance);
          track('dbPen', db.payload?.penetrationMm);
          track('dbThres', db.payload?.detonatorThreshold);
          track('dbFuse', db.payload?.detonatorFuse);
        }
        const sb = s.aircraft.skipBombers?.planes?.[0];
        if (sb) {
          track('sbHp', sb.maxHealth);
          track('sbSpd', sb.speed);
          track('sbDet', sb.detectability);
          track('sbDeck', sb.hangarSize);
          track('sbRegen', sb.restorationTimeSeconds);
          track('sbSquad', sb.squadronSize);
          track('sbDmg', sb.payload?.alphaDamage);
          track('sbFire', sb.payload?.fireChance);
          track('sbPen', sb.payload?.penetrationMm);
          track('sbThres', sb.payload?.detonatorThreshold);
          track('sbFuse', sb.payload?.detonatorFuse);
        }
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
        size: PINNED_COLUMN_WIDTHS.select,
      }),

      columnHelper.accessor('tier', {
        id: 'tier',
        header: 'Tier',
        cell: (info) => (
          <span className="font-bold font-mono text-amber-400">
            {TIER_ROMAN[info.getValue()] || info.getValue()}
          </span>
        ),
        size: PINNED_COLUMN_WIDTHS.tier,
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
        size: PINNED_COLUMN_WIDTHS.shipClass,
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
        size: PINNED_COLUMN_WIDTHS.nation,
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
        size: PINNED_COLUMN_WIDTHS.shipName,
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
        size: PINNED_COLUMN_WIDTHS.acquisition,
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
            sortingFn: id === 'artDesc'
              ? (rowA, rowB) =>
                  (rowA.original.artillery?.caliberMm ?? 0) -
                  (rowB.original.artillery?.caliberMm ?? 0)
              : 'auto',
            cell: (info) => {
              const val = info.getValue() as number | string | null | undefined;
              if (val == null || val === '' || (typeof val === 'number' && isNaN(val))) {
                return <span className="text-slate-600 font-mono">—</span>;
              }
              if (typeof val === 'string' && isNaN(Number(val))) {
                const displayValue = format(val) ?? val;
                return (
                  <span className="block max-w-full truncate font-mono text-xs text-slate-200" title={String(displayValue)}>
                    {displayValue}
                  </span>
                );
              }
              const numVal = typeof val === 'number' ? val : Number(val);
              const range = statRanges[id];
              const colorClass = range
                ? getHeatmapColor(numVal, range.min, range.max, higherIsBetter)
                : 'text-slate-200';
              const displayValue = format(val) ?? '—';
              return (
                <span className={`block max-w-full truncate font-mono text-xs ${colorClass}`} title={String(displayValue)}>
                  {displayValue}
                </span>
              );
            },
            size: compactMetricWidth(size),
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
            size: compactMetricWidth(size),
          }
        )
      );
    };

    // 1. General preset columns (matching shiptool.st p=GEN)
    if (activePreset === 'general' || activePreset === 'all') {
      if (activePreset === 'general') {
        addCol('year', 'Year', (s) => s.year, (v) => `${v}`, false, 75);
        addCol('length', 'Length', (s) => s.length, (v) => `${v}m`, false, 80);
        addCol('beam', 'Beam', (s) => s.beam, (v) => `${Number(v).toFixed(1)}m`, false, 80);
        addCol('tonnage', 'Displacement', (s) => s.tonnage, (v) => `${Number(v).toLocaleString()} t`, false, 95);
      }
      addCol('health', 'Health', (s) => s.health, (v) => Number(v).toLocaleString(), true, 80);
      addCol('concealmentSurface', 'Detect. by sea', (s) => s.concealmentSurface, (v) => `${Number(v).toFixed(2)} km`, false, 100);
      addCol('concealmentAir', 'Detect. by air', (s) => s.concealmentAir, (v) => `${Number(v).toFixed(2)} km`, false, 95);
      addCol('smokePenalty', 'Smoke firing detect.', (s) => s.smokePenalty, (v) => `${Number(v).toFixed(2)} km`, false, 125);
      if (activePreset === 'general') {
        addCol('powerWeight', 'Power / weight', (s) => s.powerWeight, (v) => `${Number(v).toFixed(2)} hp/t`, true, 105);
      }
      addCol('speed', 'Max speed', (s) => s.speed, (v) => `${Number(v).toFixed(1)} kts`, true, 85);
      if (activePreset === 'general') {
        addCol('acceleration', 'Acceleration', (s) => s.acceleration, (v) => `${Number(v).toFixed(1)}s`, false, 90);
      }
      addCol('rudderTime', 'Rudder shift', (s) => s.rudderTime, (v) => `${Number(v).toFixed(1)}s`, false, 85);
      addCol('turningRadius', 'Turning radius', (s) => s.turningRadius, (v) => `${v}m`, false, 90);
    }

    // 2. Survivability preset columns (matching shiptool.st p=SRV)
    if (activePreset === 'survivability' || activePreset === 'all') {
      if (activePreset === 'survivability') {
        addCol('health', 'Health', (s) => s.health, (v) => Number(v).toLocaleString(), true, 80);
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

    // 3. Diving preset columns (matching shiptool.st p=DIV)
    if (activePreset === 'diving') {
      addCol('subDetectability', 'Detectability', (s) => s.subDetectability, (v) => `${Number(v).toFixed(2)} km`, false, 95);
      addCol('submergedSpeed', 'Submerged speed', (s) => s.submergedSpeed, (v) => `${Number(v).toFixed(1)} kts`, true, 115);
      addCol('divingPlaneShift', 'Diving plane shift', (s) => s.divingPlaneShift, (v) => `${Number(v).toFixed(1)}s`, false, 125);
      addCol('diveSpeed', 'Dive speed', (s) => s.diveSpeed, (v) => `${Number(v).toFixed(1)} m/s`, true, 95);
      addCol('diveCapacity', 'Dive capacity', (s) => s.diveCapacity, (v) => `${v}`, true, 100);
      addCol('diveDepletionRate', 'Depletion rate', (s) => s.diveDepletionRate, (v) => `${Number(v).toFixed(1)} u/s`, false, 105);
      addCol('diveRechargeRate', 'Recharge rate', (s) => s.diveRechargeRate, (v) => `${Number(v).toFixed(1)} u/s`, true, 105);
    }

    // 4. Main battery preset columns (matching shiptool.st p=MB)
    if (activePreset === 'artillery' || activePreset === 'all') {
      if (activePreset === 'artillery') {
        addCol('artDesc', 'Description', (s) => s.artillery?.desc || (s.artillery ? `${s.artillery.totalBarrels}x ${s.artillery.caliberMm}mm` : null), (v) => `${v}`, false, 130);
      } else {
        addCol('caliberMm', 'Caliber', (s) => s.artillery?.caliberMm, (v) => `${v}mm`, true, 80);
      }
      addCol('apDpm', 'AP DPM', (s) => s.artillery?.apDpm || null, (v) => Number(v).toLocaleString(), true, 90);
      addCol('heDpm', 'HE DPM', (s) => s.artillery?.heDpm || null, (v) => Number(v).toLocaleString(), true, 90);
      addCol('sapDpm', 'SAP DPM', (s) => s.artillery?.sapDpm || null, (v) => Number(v).toLocaleString(), true, 90);
      if (activePreset === 'artillery') {
        addCol('apSalvo', 'AP salvo', (s) => s.artillery?.apSalvo || null, (v) => Number(v).toLocaleString(), true, 90);
        addCol('heSalvo', 'HE salvo', (s) => s.artillery?.heSalvo || null, (v) => Number(v).toLocaleString(), true, 90);
        addCol('sapSalvo', 'SAP salvo', (s) => s.artillery?.sapSalvo || null, (v) => Number(v).toLocaleString(), true, 90);
      }
      addCol('rangeKm', 'Range', (s) => s.artillery?.rangeKm, (v) => `${Number(v).toFixed(1)} km`, true, 85);
      addCol('reload', 'Reload', (s) => s.artillery?.reload, (v) => `${Number(v).toFixed(1)}s`, false, 80);
      addCol('traverse180', '180° turn', (s) => s.traverse180, (v) => `${Number(v).toFixed(1)}s`, false, 85);
      addCol('horizontalDispersion', 'Horiz. dispersion', (s) => s.horizontalDispersion, (v) => `${v}m`, false, 110);
      addCol('verticalDispersion', 'Vert. dispersion', (s) => s.verticalDispersion, (v) => `${v}m`, false, 105);
      addCol('sigma', 'Sigma', (s) => s.artillery?.sigma, (v) => `${Number(v).toFixed(2)}`, true, 75);
      if (activePreset === 'artillery') {
        addCol('artFlightTime', 'Flight time', (s) => s.artillery?.ap?.flightTime ?? s.artillery?.he?.flightTime, (v) => `${Number(v).toFixed(1)}s`, false, 85);
        addCol('artSpm', 'Shells / min', (s) => s.artillery?.shellsPerMinute, (v) => `${Number(v).toFixed(1)}`, true, 90);
      }
      if (activePreset === 'all') {
        addCol('fireChance', 'Fire chance', (s) => s.artillery?.fireChance || null, (v) => `${v}%`, true, 85);
        addCol('overmatchMm', 'Overmatch', (s) => s.artillery?.overmatchMm, (v) => `${v}mm`, true, 85);
      }
    }

    // 5. AP shells preset (matching shiptool.st p=AP)
    if (activePreset === 'ap_shells') {
      addCol('apDesc', 'Description', (s) => s.artillery?.desc || (s.artillery ? `${s.artillery.caliberMm}mm` : null), (v) => `${v}`, false, 120);
      addCol('apWeight', 'Weight', (s) => s.artillery?.ap?.bulletMass, (v) => `${Number(v).toFixed(1)} kg`, true, 85);
      addCol('apDamage', 'Damage', (s) => s.artillery?.ap?.damage, (v) => Number(v).toLocaleString(), true, 85);
      addCol('apSpeed', 'Initial speed', (s) => s.artillery?.ap?.bulletSpeed, (v) => `${v} m/s`, true, 95);
      addCol('apDrag', 'Drag coeff.', (s) => s.artillery?.ap?.airDrag, (v) => `${Number(v).toFixed(3)}`, false, 85);
      addCol('apFlightTime', 'Flight time', (s) => s.artillery?.ap?.flightTime, (v) => `${Number(v).toFixed(1)}s`, false, 85);
      addCol('apImpactSpeed', 'Impact speed', (s) => s.artillery?.ap?.impactVelocity, (v) => `${v} m/s`, true, 95);
      addCol('apImpactAngle', 'Impact angle', (s) => s.artillery?.ap?.impactAngle, (v) => `${Number(v).toFixed(1)}°`, false, 90);
      addCol('apKrupp', 'Krupp', (s) => s.artillery?.ap?.krupp, (v) => `${v}`, true, 75);
      addCol('apPen', 'Penetration', (s) => s.artillery?.ap?.penetrationMm, (v) => `${Math.round(Number(v))}mm`, true, 95);
      addCol('apOvermatch', 'Overmatch', (s) => s.artillery?.overmatchMm, (v) => `${v}mm`, true, 85);
      addCol('apRicochet', 'Ricochet', (s) => s.artillery?.ap?.ricochet, (v) => `${v}`, false, 95);
      addCol('apThreshold', 'Threshold', (s) => s.artillery?.ap?.threshold, (v) => `${v}mm`, false, 85);
      addCol('apFuse', 'Fuse time', (s) => s.artillery?.ap?.fuse, (v) => `${Number(v).toFixed(3)}s`, false, 85);
    }

    // 6. HE shells preset (matching shiptool.st p=HE)
    if (activePreset === 'he_shells') {
      addCol('heDesc', 'Description', (s) => s.artillery?.desc || (s.artillery ? `${s.artillery.caliberMm}mm` : null), (v) => `${v}`, false, 120);
      addCol('heWeight', 'Weight', (s) => s.artillery?.he?.bulletMass, (v) => `${Number(v).toFixed(1)} kg`, true, 85);
      addCol('heDamage', 'Damage', (s) => s.artillery?.he?.damage, (v) => Number(v).toLocaleString(), true, 85);
      addCol('heSpeed', 'Initial speed', (s) => s.artillery?.he?.bulletSpeed, (v) => `${v} m/s`, true, 95);
      addCol('heDrag', 'Drag coeff.', (s) => s.artillery?.he?.airDrag, (v) => `${Number(v).toFixed(3)}`, false, 85);
      addCol('heFlightTime', 'Flight time', (s) => s.artillery?.he?.flightTime, (v) => `${Number(v).toFixed(1)}s`, false, 85);
      addCol('heImpactSpeed', 'Impact speed', (s) => s.artillery?.he?.impactVelocity, (v) => `${v} m/s`, true, 95);
      addCol('heImpactAngle', 'Impact angle', (s) => s.artillery?.he?.impactAngle, (v) => `${Number(v).toFixed(1)}°`, false, 90);
      addCol('hePen', 'Penetration', (s) => s.artillery?.he?.penetrationMm, (v) => `${v}mm`, true, 90);
      addCol('fireChance', 'Fire chance', (s) => s.artillery?.fireChance, (v) => `${v}%`, true, 85);
      addCol('heFpm', 'Fires / min', (s) => s.artillery?.he?.firesPerMin, (v) => `${Number(v).toFixed(1)}`, true, 85);
    }

    // 7. SAP shells preset (matching shiptool.st p=SAP)
    if (activePreset === 'sap_shells') {
      addCol('sapDesc', 'Description', (s) => s.artillery?.desc || (s.artillery ? `${s.artillery.caliberMm}mm` : null), (v) => `${v}`, false, 120);
      addCol('sapWeight', 'Weight', (s) => s.artillery?.sap?.bulletMass, (v) => `${Number(v).toFixed(1)} kg`, true, 85);
      addCol('sapDamage', 'Damage', (s) => s.artillery?.sap?.damage, (v) => Number(v).toLocaleString(), true, 85);
      addCol('sapSpeed', 'Initial speed', (s) => s.artillery?.sap?.bulletSpeed, (v) => `${v} m/s`, true, 95);
      addCol('sapDrag', 'Drag coeff.', (s) => s.artillery?.sap?.airDrag, (v) => `${Number(v).toFixed(3)}`, false, 85);
      addCol('sapFlightTime', 'Flight time', (s) => s.artillery?.sap?.flightTime, (v) => `${Number(v).toFixed(1)}s`, false, 85);
      addCol('sapImpactSpeed', 'Impact speed', (s) => s.artillery?.sap?.impactVelocity, (v) => `${v} m/s`, true, 95);
      addCol('sapImpactAngle', 'Impact angle', (s) => s.artillery?.sap?.impactAngle, (v) => `${Number(v).toFixed(1)}°`, false, 90);
      addCol('sapPen', 'Penetration', (s) => s.artillery?.sap?.penetrationMm, (v) => `${v}mm`, true, 90);
      addCol('sapRicochet', 'Ricochet', (s) => s.artillery?.sap?.ricochet, (v) => `${v}`, false, 95);
    }

    // 8. Secondary battery preset (matching shiptool.st p=SEC)
    if (activePreset === 'secondary' || activePreset === 'all') {
      if (activePreset === 'secondary') {
        addCol('secDesc', 'Description', (s) => s.secondary?.desc, (v) => `${v}`, false, 120);
      }
      addCol('secondaryDpm', 'Secondary DPM', (s) => (s.secondary?.heDpm || 0) + (s.secondary?.apDpm || 0) + (s.secondary?.sapDpm || 0) || null, (v) => Number(v).toLocaleString(), true, 110);
      if (activePreset === 'secondary') {
        addCol('secHitDpm', 'Hitting DPM', (s) => s.secondary?.hitDpm, (v) => Number(v).toLocaleString(), true, 100);
      }
      addCol('secondaryRangeKm', 'Secondary range', (s) => s.secondary?.rangeKm, (v) => `${Number(v).toFixed(1)} km`, true, 110);
      addCol('secondaryCaliberMm', 'Secondary caliber', (s) => s.secondary?.caliberMm, (v) => `${v}mm`, true, 110);
      addCol('secondaryBarrels', 'Secondary barrels', (s) => s.secondary?.totalBarrels, (v) => `${v}`, true, 115);
      addCol('secondaryReload', 'Secondary reload', (s) => s.secondary?.reload, (v) => `${Number(v).toFixed(1)}s`, false, 110);
      addCol('secondaryHeDpm', 'Secondary HE DPM', (s) => s.secondary?.heDpm || null, (v) => Number(v).toLocaleString(), true, 125);
      addCol('secondaryApDpm', 'Secondary AP DPM', (s) => s.secondary?.apDpm || null, (v) => Number(v).toLocaleString(), true, 125);
      addCol('secondarySapDpm', 'Secondary SAP DPM', (s) => s.secondary?.sapDpm || null, (v) => Number(v).toLocaleString(), true, 130);
      addCol('secondaryFireChance', 'Secondary fire chance', (s) => s.secondary?.fireChance, (v) => `${v}%`, true, 135);
      addCol('secondaryPenetrationMm', 'Secondary penetration', (s) => s.secondary?.penetrationMm, (v) => `${v}mm`, true, 140);
      if (activePreset === 'secondary') {
        addCol('secFlightTime', 'Flight time', (s) => s.secondary?.flightTime, (v) => `${Number(v).toFixed(1)}s`, false, 85);
        addCol('secHorizDisp', 'Horiz. dispersion', (s) => s.secondary?.horizontalDispersion, (v) => `${v}m`, false, 110);
        addCol('secSigma', 'Sigma', (s) => s.secondary?.sigma, (v) => `${Number(v).toFixed(2)}`, true, 75);
        addCol('secFpm', 'Fires / min', (s) => s.secondary?.firesPerMin, (v) => `${Number(v).toFixed(1)}`, true, 85);
        addCol('secSpm', 'Shells / min', (s) => s.secondary?.shellsPerMinute, (v) => `${Number(v).toFixed(1)}`, true, 90);
      }
    }

    // 9. Sonar preset (matching shiptool.st p=SON)
    if (activePreset === 'sonar') {
      addCol('sonarRange', 'Range', (s) => s.sonar?.rangeKm, (v) => `${Number(v).toFixed(1)} km`, true, 85);
      addCol('sonarReload', 'Reload', (s) => s.sonar?.reload, (v) => `${Number(v).toFixed(1)}s`, false, 80);
      addCol('sonarTrav', '180° turn', (s) => s.sonar?.traverse180, (v) => `${Number(v).toFixed(1)}s`, false, 85);
      addCol('sonarLife1', '1st life time', (s) => s.sonar?.life1, (v) => `${Number(v).toFixed(1)}s`, true, 95);
      addCol('sonarLife2', '2nd life time', (s) => s.sonar?.life2, (v) => `${Number(v).toFixed(1)}s`, true, 95);
      addCol('sonarWidth', 'Wave width', (s) => s.sonar?.width, (v) => `${Number(v).toFixed(1)}m`, true, 90);
      addCol('sonarSpeed', 'Wave speed', (s) => s.sonar?.speed, (v) => `${v} m/s`, true, 95);
    }

    // 10. Torpedoes preset columns (matching shiptool.st p=TORP)
    if (activePreset === 'torpedoes' || activePreset === 'all') {
      if (activePreset === 'torpedoes') {
        addCol('torpDesc', 'Description', (s) => s.torpedoes?.desc, (v) => `${v}`, false, 120);
        addCol('torpType', 'Type', (s) => s.torpedoes?.type, (v) => `${v}`, false, 85);
        addCol('torpLoaders', 'Loaders', (s) => s.torpedoes?.loaders, (v) => `${v}`, true, 75);
        addCol('torpDpm', 'Torpedo DPM', (s) => s.torpedoes?.dpm, (v) => Number(v).toLocaleString(), true, 100);
      }
      addCol('torpRange', activePreset === 'all' ? 'Torp. Range' : 'Range', (s) => s.torpedoes?.rangeKm, (v) => `${Number(v).toFixed(1)} km`, true, 85);
      addCol('torpSpeed', activePreset === 'all' ? 'Torp. Speed' : 'Speed', (s) => s.torpedoes?.speed, (v) => `${v} kts`, true, 80);
      addCol('torpDamage', activePreset === 'all' ? 'Torp. Damage' : 'Damage', (s) => s.torpedoes?.damage, (v) => Number(v).toLocaleString(), true, 85);
      if (activePreset === 'torpedoes') {
        addCol('torpSpread', 'Spread', (s) => s.torpedoes?.spread, (v) => `${Number(v).toFixed(1)}°`, false, 80);
        addCol('torpFlood', 'Flood chance', (s) => s.torpedoes?.floodChance, (v) => `${v}%`, true, 95);
      }
      addCol('torpReload', activePreset === 'all' ? 'Torp. Reload' : 'Reload', (s) => s.torpedoes?.reload, (v) => `${Number(v).toFixed(1)}s`, false, 80);
      addCol('torpedoDetect', 'Detectability', (s) => s.torpedoes?.detectabilityKm ?? s.torpedoDetect, (v) => `${Number(v).toFixed(1)} km`, false, 95);
      if (activePreset === 'torpedoes') {
        addCol('torpReact', 'Reaction time', (s) => s.torpedoes?.reactionTimeSeconds, (v) => `${Number(v).toFixed(1)}s`, false, 95);
        addCol('torpTpm', 'Torpedoes / min', (s) => s.torpedoes?.torpsPerMinute, (v) => `${Number(v).toFixed(1)}`, true, 105);
        addCol('torpHoming', 'Homing rate', (s) => s.torpedoes?.homingRate, (v) => `${Number(v).toFixed(1)}°/s`, true, 95);
      }
    }

    // 11. AA preset columns (matching shiptool.st p=AA)
    if (activePreset === 'aa' || activePreset === 'all') {
      if (activePreset === 'aa') {
        addCol('aaStr', 'AA strength', (s) => s.aa?.totalDps || s.aaDps, (v) => Number(v).toLocaleString(), true, 95);
        addCol('aaLongRng', 'Long range', (s) => s.aa?.farRange, (v) => `${Number(v).toFixed(1)} km`, true, 90);
        addCol('aaLongDps', 'Long DPS', (s) => s.aa?.farDps, (v) => Number(v).toLocaleString(), true, 85);
        addCol('aaMedRng', 'Medium range', (s) => s.aa?.mediumRange, (v) => `${Number(v).toFixed(1)} km`, true, 100);
        addCol('aaMedDps', 'Medium DPS', (s) => s.aa?.mediumDps, (v) => Number(v).toLocaleString(), true, 95);
        addCol('aaShortRng', 'Short range', (s) => s.aa?.nearRange, (v) => `${Number(v).toFixed(1)} km`, true, 90);
        addCol('aaShortDps', 'Short DPS', (s) => s.aa?.nearDps, (v) => Number(v).toLocaleString(), true, 85);
        addCol('aaFlakStr', 'Flak strength', (s) => s.aa?.flakDamage, (v) => Number(v).toLocaleString(), true, 95);
      }
      if (activePreset === 'all') {
        addCol('aaRange', 'AA Range', (s) => s.aaRange, (v) => `${Number(v).toFixed(1)} km`, true, 85);
        addCol('aaDps', 'AA DPS', (s) => s.aaDps, (v) => Number(v).toLocaleString(), true, 85);
      }
      addCol('flakCount', 'Flak count', (s) => s.flakCount, (v) => `${v}`, true, 85);
      if (activePreset === 'aa') {
        addCol('aaFlakDps', 'Flak DPS', (s) => s.aa?.flakDamage, (v) => Number(v).toLocaleString(), true, 85);
        addCol('aaPriTime', 'Priority time', (s) => s.class === 'Battleship' ? 15 : s.class === 'Cruiser' ? 12 : 10, (v) => `${v}s`, false, 90);
        addCol('aaPriDmg', 'Priority %', () => 150, (v) => `${v}%`, true, 85);
        addCol('aaConc', 'Concentrated %', () => 3.5, (v) => `${v}%`, true, 100);
      }
    }

    // 12. Depth charges preset (matching shiptool.st p=ASW)
    if (activePreset === 'asw' || activePreset === 'all') {
      if (activePreset === 'asw') {
        addCol('aswAttacks', 'Attacks', (s) => s.asw?.attacks || (s.class === 'Destroyer' || s.class === 'Cruiser' ? 2 : null), (v) => `${v}`, true, 75);
        addCol('aswReload', 'Reload', (s) => s.asw?.reloadTime, (v) => `${v}s`, false, 75);
        addCol('aswBombs', 'Bombs', (s) => s.asw?.bombs || 2, (v) => `${v}`, true, 75);
        addCol('aswInterval', 'Drop interval', (s) => s.asw?.dropInterval || 1, (v) => `${v}s`, false, 95);
        addCol('aswTimer', 'Detonation timer', (s) => s.asw?.detonationTimer || 2.4, (v) => `${Number(v).toFixed(1)}s`, false, 115);
        addCol('aswDepth', 'Detonation depth', (s) => s.asw?.detonationDepth || 30, (v) => `${v}m`, true, 115);
        addCol('aswDmg', 'Damage', (s) => s.asw?.damage || 2000, (v) => Number(v).toLocaleString(), true, 85);
        addCol('aswRad', 'Radius', (s) => s.asw?.radius || 30, (v) => `${v}m`, true, 75);
        addCol('aswFlood', 'Flood chance', (s) => s.asw?.floodChance || 33, (v) => `${v}%`, true, 95);
        addCol('aswFire', 'Fire chance', (s) => s.asw?.fireChance || 0, (v) => `${v}%`, true, 85);
      } else {
        addCol('aswRange', 'ASW Range', (s) => s.aswRange, (v) => `${Number(v).toFixed(1)} km`, true, 90);
        addCol('aswReloadAll', 'ASW Reload', (s) => s.asw?.reloadTime, (v) => `${v}s`, false, 85);
      }
    }

    // 13. Airstrike preset (matching shiptool.st p=AS)
    if (activePreset === 'airstrike') {
      addCol('asType', 'Type', (s) => s.asw?.type === 'airstrike' ? 'Airstrike' : null, (v) => `${v}`, false, 80);
      addCol('asAttacks', 'Attacks', (s) => s.asw?.type === 'airstrike' ? (s.asw?.attacks || 2) : null, (v) => `${v}`, true, 75);
      addCol('asReload', 'Reload', (s) => s.asw?.type === 'airstrike' ? s.asw?.reloadTime : null, (v) => `${v}s`, false, 75);
      addCol('asHp', 'Health', (s) => s.asw?.type === 'airstrike' ? (s.asw?.health || 2000) : null, (v) => Number(v).toLocaleString(), true, 80);
      addCol('asMinR', 'Min range', (s) => s.asw?.type === 'airstrike' ? (s.asw?.minRangeKm ?? 0.5) : null, (v) => `${Number(v).toFixed(1)} km`, false, 85);
      addCol('asMaxR', 'Max range', (s) => s.asw?.type === 'airstrike' ? (s.asw?.rangeKm ?? s.aswRange) : null, (v) => `${Number(v).toFixed(1)} km`, true, 85);
      addCol('asBombs', 'Bombs', (s) => s.asw?.type === 'airstrike' ? (s.asw?.bombs || 2) : null, (v) => `${v}`, true, 75);
      addCol('asRet', 'Reticle size', (s) => s.asw?.type === 'airstrike' ? (s.asw?.radius ? `${s.asw.radius * 2}x${s.asw.radius * 2}m` : '180x240m') : null, (v) => `${v}`, false, 95);
      addCol('asTimer', 'Detonation timer', (s) => s.asw?.type === 'airstrike' ? (s.asw?.detonationTimer ?? 1.0) : null, (v) => `${Number(v).toFixed(1)}s`, false, 115);
      addCol('asDepth', 'Detonation depth', (s) => s.asw?.type === 'airstrike' ? (s.asw?.detonationDepth ?? 15) : null, (v) => `${v}m`, true, 115);
      addCol('asDmg', 'Damage', (s) => s.asw?.type === 'airstrike' ? (s.asw?.damage || 4900) : null, (v) => Number(v).toLocaleString(), true, 85);
      addCol('asRad', 'Radius', (s) => s.asw?.type === 'airstrike' ? (s.asw?.radius || 13) : null, (v) => `${v}m`, true, 75);
      addCol('asFlood', 'Flood chance', (s) => s.asw?.type === 'airstrike' ? (s.asw?.floodChance || 300) : null, (v) => `${v}%`, true, 95);
      addCol('asFire', 'Fire chance', (s) => s.asw?.type === 'airstrike' ? (s.asw?.fireChance || 28) : null, (v) => `${v}%`, true, 85);
      addCol('asPen', 'Penetration', (s) => s.asw?.type === 'airstrike' ? (s.asw?.penetration || 32) : null, (v) => `${v}mm`, true, 90);
    }

    // 14. Attack Aircraft preset (matching shiptool.st p=ATT)
    if (activePreset === 'attack_aircraft') {
      const getPlane = (s: ModifiedShipStats) => s.aircraft?.attackAircraft?.planes?.[0];
      addCol('attDesc', 'Description', (s) => getPlane(s)?.name, (v) => `${v}`, false, 130);
      addCol('attHp', 'Health', (s) => getPlane(s)?.maxHealth, (v) => Number(v).toLocaleString(), true, 80);
      addCol('attSpd', 'Max speed', (s) => getPlane(s)?.speed, (v) => `${v} kts`, true, 85);
      addCol('attDet', 'Detectability', (s) => getPlane(s)?.detectability ?? 10, (v) => `${Number(v).toFixed(1)} km`, false, 95);
      addCol('attDeck', 'On deck', (s) => getPlane(s)?.hangarSize, (v) => `${v}`, true, 80);
      addCol('attRegen', 'Regeneration', (s) => getPlane(s)?.restorationTimeSeconds, (v) => `${v}s`, false, 95);
      addCol('attSquad', 'Squadron', (s) => getPlane(s)?.squadronSize, (v) => `${v}`, true, 80);
      addCol('attProj', 'Rockets', (s) => {
        const p = getPlane(s);
        return p ? (p.attackerSize || 1) * (p.projectilesPerAttack || 1) : null;
      }, (v) => `${v}`, true, 80);
      addCol('attRet', 'Reticle size', (s) => getPlane(s) ? '120x80m' : null, (v) => `${v}`, false, 90);
      addCol('attDelay', 'Firing delay', (s) => getPlane(s) ? 2.5 : null, (v) => `${Number(v).toFixed(1)}s`, false, 90);
      addCol('attType', 'Type', (s) => getPlane(s)?.payload?.type, (v) => `${v}`, false, 75);
      addCol('attDmg', 'Damage', (s) => getPlane(s)?.payload?.alphaDamage, (v) => Number(v).toLocaleString(), true, 85);
      addCol('attFire', 'Fire chance', (s) => getPlane(s)?.payload?.fireChance, (v) => `${v}%`, true, 85);
      addCol('attPen', 'Penetration', (s) => getPlane(s)?.payload?.penetrationMm, (v) => `${Math.round(Number(v))}mm`, true, 90);
      addCol('attThres', 'Threshold', (s) => getPlane(s)?.payload?.detonatorThreshold, (v) => `${v}mm`, false, 85);
      addCol('attFuse', 'Fuse time', (s) => getPlane(s)?.payload?.detonatorFuse, (v) => `${Number(v).toFixed(3)}s`, false, 85);
    }

    // 15. Torpedo Bombers preset (matching shiptool.st p=TB)
    if (activePreset === 'torpedo_bombers') {
      const getPlane = (s: ModifiedShipStats) => s.aircraft?.torpedoBombers?.planes?.[0];
      addCol('tbDesc', 'Description', (s) => getPlane(s)?.name, (v) => `${v}`, false, 130);
      addCol('tbHp', 'Health', (s) => getPlane(s)?.maxHealth, (v) => Number(v).toLocaleString(), true, 80);
      addCol('tbSpd', 'Max speed', (s) => getPlane(s)?.speed, (v) => `${v} kts`, true, 85);
      addCol('tbDet', 'Detectability', (s) => getPlane(s)?.detectability ?? 10, (v) => `${Number(v).toFixed(1)} km`, false, 95);
      addCol('tbDeck', 'On deck', (s) => getPlane(s)?.hangarSize, (v) => `${v}`, true, 80);
      addCol('tbRegen', 'Regeneration', (s) => getPlane(s)?.restorationTimeSeconds, (v) => `${v}s`, false, 95);
      addCol('tbSquad', 'Squadron', (s) => getPlane(s)?.squadronSize, (v) => `${v}`, true, 80);
      addCol('tbProj', 'Torpedoes', (s) => {
        const p = getPlane(s);
        return p ? (p.attackerSize || 1) * (p.projectilesPerAttack || 1) : null;
      }, (v) => `${v}`, true, 85);
      addCol('tbTspd', 'Torpedo speed', (s) => getPlane(s) ? (getPlane(s)?.payload?.torpedoSpeed || 35) : null, (v) => `${v} kts`, true, 100);
      addCol('tbArmt', 'Arming time', (s) => getPlane(s) ? (getPlane(s)?.payload?.armingTime || 3.0) : null, (v) => `${Number(v).toFixed(1)}s`, false, 90);
      addCol('tbArmd', 'Arming distance', (s) => {
        const p = getPlane(s);
        if (!p) return null;
        const time = p.payload?.armingTime || 3.0;
        const spd = p.payload?.torpedoSpeed || 35;
        return Math.round(time * spd * 0.514 * 10);
      }, (v) => `${v}m`, false, 105);
      addCol('tbRange', 'Range', (s) => getPlane(s) ? (getPlane(s)?.payload?.rangeKm || 3.0) : null, (v) => `${Number(v).toFixed(1)} km`, true, 85);
      addCol('tbDmg', 'Damage', (s) => getPlane(s)?.payload?.alphaDamage, (v) => Number(v).toLocaleString(), true, 85);
      addCol('tbFlood', 'Flood chance', (s) => getPlane(s)?.payload?.floodChance || 45, (v) => `${v}%`, true, 95);
    }

    // 16. Bombers preset (matching shiptool.st p=DB)
    if (activePreset === 'bombers') {
      const getPlane = (s: ModifiedShipStats) => s.aircraft?.diveBombers?.planes?.[0];
      addCol('dbDesc', 'Description', (s) => getPlane(s)?.name, (v) => `${v}`, false, 130);
      addCol('dbHp', 'Health', (s) => getPlane(s)?.maxHealth, (v) => Number(v).toLocaleString(), true, 80);
      addCol('dbSpd', 'Max speed', (s) => getPlane(s)?.speed, (v) => `${v} kts`, true, 85);
      addCol('dbDet', 'Detectability', (s) => getPlane(s)?.detectability ?? 10, (v) => `${Number(v).toFixed(1)} km`, false, 95);
      addCol('dbDeck', 'On deck', (s) => getPlane(s)?.hangarSize, (v) => `${v}`, true, 80);
      addCol('dbRegen', 'Regeneration', (s) => getPlane(s)?.restorationTimeSeconds, (v) => `${v}s`, false, 95);
      addCol('dbSquad', 'Squadron', (s) => getPlane(s)?.squadronSize, (v) => `${v}`, true, 80);
      addCol('dbProj', 'Bombs', (s) => {
        const p = getPlane(s);
        return p ? (p.attackerSize || 1) * (p.projectilesPerAttack || 1) : null;
      }, (v) => `${v}`, true, 75);
      addCol('dbRet', 'Reticle size', (s) => getPlane(s) ? '140x60m' : null, (v) => `${v}`, false, 90);
      addCol('dbType', 'Type', (s) => getPlane(s)?.payload?.type, (v) => `${v}`, false, 75);
      addCol('dbDmg', 'Damage', (s) => getPlane(s)?.payload?.alphaDamage, (v) => Number(v).toLocaleString(), true, 85);
      addCol('dbFire', 'Fire chance', (s) => getPlane(s)?.payload?.fireChance, (v) => `${v}%`, true, 85);
      addCol('dbPen', 'Penetration', (s) => getPlane(s)?.payload?.penetrationMm, (v) => `${v}mm`, true, 90);
      addCol('dbThres', 'Threshold', (s) => getPlane(s)?.payload?.detonatorThreshold, (v) => `${v}mm`, false, 85);
      addCol('dbFuse', 'Fuse time', (s) => getPlane(s)?.payload?.detonatorFuse, (v) => `${Number(v).toFixed(3)}s`, false, 85);
    }

    // 17. Skip Bombers preset (matching shiptool.st p=SB)
    if (activePreset === 'skip_bombers') {
      const getPlane = (s: ModifiedShipStats) => s.aircraft?.skipBombers?.planes?.[0];
      addCol('sbDesc', 'Description', (s) => getPlane(s)?.name, (v) => `${v}`, false, 130);
      addCol('sbHp', 'Health', (s) => getPlane(s)?.maxHealth, (v) => Number(v).toLocaleString(), true, 80);
      addCol('sbSpd', 'Max speed', (s) => getPlane(s)?.speed, (v) => `${v} kts`, true, 85);
      addCol('sbDet', 'Detectability', (s) => getPlane(s)?.detectability ?? 10, (v) => `${Number(v).toFixed(1)} km`, false, 95);
      addCol('sbDeck', 'On deck', (s) => getPlane(s)?.hangarSize, (v) => `${v}`, true, 80);
      addCol('sbRegen', 'Regeneration', (s) => getPlane(s)?.restorationTimeSeconds, (v) => `${v}s`, false, 95);
      addCol('sbSquad', 'Squadron', (s) => getPlane(s)?.squadronSize, (v) => `${v}`, true, 80);
      addCol('sbProj', 'Bombs', (s) => {
        const p = getPlane(s);
        return p ? (p.attackerSize || 1) * (p.projectilesPerAttack || 1) : null;
      }, (v) => `${v}`, true, 75);
      addCol('sbType', 'Type', (s) => getPlane(s)?.payload?.type, (v) => `${v}`, false, 75);
      addCol('sbDmg', 'Damage', (s) => getPlane(s)?.payload?.alphaDamage, (v) => Number(v).toLocaleString(), true, 85);
      addCol('sbFire', 'Fire chance', (s) => getPlane(s)?.payload?.fireChance, (v) => `${v}%`, true, 85);
      addCol('sbPen', 'Penetration', (s) => getPlane(s)?.payload?.penetrationMm, (v) => `${v}mm`, true, 90);
      addCol('sbThres', 'Threshold', (s) => getPlane(s)?.payload?.detonatorThreshold, (v) => `${v}mm`, false, 85);
      addCol('sbFuse', 'Fuse time', (s) => getPlane(s)?.payload?.detonatorFuse, (v) => `${Number(v).toFixed(3)}s`, false, 85);
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

    // 19. Combat Instructions preset (matching shiptool.st p=CI)
    if (activePreset === 'combat_instructions') {
      metricCols.push(
        columnHelper.accessor(
          (row) => row.hasCombatInstructions ? row.combatInstructions?.name : null,
          {
            id: 'combatInstructions',
            header: 'Combat instructions',
            cell: ({ row }) => {
              const ci = row.original.combatInstructions;
              if (!ci || !row.original.hasCombatInstructions) {
                return <span className="text-slate-600 font-mono">—</span>;
              }
              return (
                <div className="flex items-center gap-1.5 py-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{ci.name}</span>
                    {ci.duration ? <span className="text-slate-400 font-normal">({ci.duration}s)</span> : null}
                  </span>
                </div>
              );
            },
            size: 260,
          }
        )
      );
    }

    // 20. Innate Skills preset (matching shiptool.st p=IS)
    if (activePreset === 'innate') {
      metricCols.push(
        columnHelper.accessor(
          (row) => row.hasInnateSkills ? row.innateSkills?.name : null,
          {
            id: 'innateSkills',
            header: 'Innate skill',
            cell: ({ row }) => {
              const is = row.original.innateSkills;
              if (!is || !row.original.hasInnateSkills) {
                return <span className="text-slate-600 font-mono">—</span>;
              }
              return (
                <div className="flex items-center gap-1.5 py-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    <Award className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{is.name}</span>
                  </span>
                </div>
              );
            },
            size: 260,
          }
        )
      );
    }

    const pinnedWidth = Object.values(PINNED_COLUMN_WIDTHS).reduce((total, width) => total + width, 0);
    const availableMetricWidth = Math.max(0, viewportWidth - pinnedWidth - 8 - metricCols.length * 3);
    const minimumWidths = metricCols.map((column) => minHeaderWidth(column.header));
    const totalMetricWidth = metricCols.reduce((total, column) => total + (column.size || 80), 0);
    const minimumMetricWidth = minimumWidths.reduce((total, width) => total + width, 0);
    const shrinkableWidth = Math.max(0, totalMetricWidth - minimumMetricWidth);
    const scale = totalMetricWidth > availableMetricWidth && availableMetricWidth > 0 && shrinkableWidth > 0
      ? Math.max(0, Math.min(1, (availableMetricWidth - minimumMetricWidth) / shrinkableWidth))
      : 1;
    for (const [index, column] of metricCols.entries()) {
      column.size = Math.max(minimumWidths[index], Math.round(minimumWidths[index] + ((column.size || 80) - minimumWidths[index]) * scale));
    }

    return [...pinned, ...metricCols];
  }, [activePreset, applyCoupons, selectedShipIds, statRanges, toggleCompareShip, viewportWidth]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  useEffect(() => {
    const scrollContainer = tableContainerRef.current;
    const tableElement = scrollContainer?.querySelector('table');
    if (!scrollContainer || !tableElement) return;

    const updateScrollMetrics = () => {
      const viewportWidth = scrollContainer.clientWidth;
      setViewportWidth(window.innerWidth);
      setHorizontalScrollMetrics((current) => {
        const contentWidth = Math.max(tableElement.scrollWidth, viewportWidth);
        return current.contentWidth === contentWidth && current.viewportWidth === viewportWidth
          ? current
          : { contentWidth, viewportWidth };
      });
    };

    updateScrollMetrics();
    window.addEventListener('resize', updateScrollMetrics);
    return () => window.removeEventListener('resize', updateScrollMetrics);
  }, [columns, data.length]);

  useEffect(() => {
    const scrollContainer = tableContainerRef.current;
    const tableHeader = tableHeaderRef.current;
    if (!scrollContainer || !tableHeader) return;

    const updateScrollMargin = () => {
      const margin = scrollContainer.getBoundingClientRect().top + window.scrollY + tableHeader.getBoundingClientRect().height;
      setScrollMargin((current) => Math.abs(current - margin) < 1 ? current : margin);
    };

    updateScrollMargin();
    window.addEventListener('resize', updateScrollMargin);
    return () => window.removeEventListener('resize', updateScrollMargin);
  }, [columns, data.length, horizontalScrollMetrics.contentWidth, viewportWidth]);

  const syncHorizontalScroll = (source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (!target) return;
    const sourceRange = source.scrollWidth - source.clientWidth;
    const targetRange = target.scrollWidth - target.clientWidth;
    const targetScrollLeft = sourceRange > 0 ? (source.scrollLeft / sourceRange) * targetRange : 0;
    if (Math.abs(target.scrollLeft - targetScrollLeft) > 1) {
      target.scrollLeft = targetScrollLeft;
    }
  };

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
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 40,
    overscan: 20,
    scrollMargin,
  });

  useEffect(() => {
    if (rows.length === 0 || rowVirtualizer.getVirtualItems().length > 0) return;

    const tableContainer = tableContainerRef.current;
    const tableHeader = tableHeaderRef.current;
    if (!tableContainer || !tableHeader) return;

    const stickyTop = Number.parseFloat(tableHeader.style.top) || 0;
    const tableTop = window.scrollY + tableContainer.getBoundingClientRect().top;
    window.scrollTo({ top: Math.max(0, tableTop - stickyTop), behavior: 'auto' });
  }, [data, rowVirtualizer, rows.length]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0
    ? Math.max(0, virtualRows[0].start - scrollMargin)
    : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? Math.max(0, totalSize - (virtualRows[virtualRows.length - 1].end - scrollMargin))
      : 0;

  // Cumulative left offsets for pinned columns (first 6 columns)
  const pinnedOffsets = useMemo(() => {
    let left = 0;
    return columns.slice(0, 6).map((column) => {
      const offset = left;
      left += column.size || 80;
      return offset;
    });
  }, [columns]);

  return (
    <div className="w-full border border-slate-800 rounded-xl bg-slate-900/60 shadow-xl flex flex-col">
      {horizontalScrollMetrics.contentWidth > horizontalScrollMetrics.viewportWidth + 1 && (
        <div
          ref={horizontalScrollRef}
          className="sticky top-[53px] z-40 h-3.5 overflow-x-auto overflow-y-hidden border-b border-slate-800/70 bg-slate-900/95 scrollbar-thin scrollbar-thumb-slate-700"
          style={{ width: `${horizontalScrollMetrics.viewportWidth}px` }}
          role="region"
          aria-label="Horizontal parameters scrollbar"
          tabIndex={0}
          onScroll={(event) => syncHorizontalScroll(event.currentTarget, tableContainerRef.current)}
        >
          <div className="h-px" style={{ width: `${horizontalScrollMetrics.contentWidth}px` }} />
        </div>
      )}
      {/* Table Scroll Container */}
      <div
        ref={tableContainerRef}
        className="relative overflow-x-auto overflow-y-clip scrollbar-thin scrollbar-thumb-slate-700"
        onScroll={(event) => syncHorizontalScroll(event.currentTarget, horizontalScrollRef.current)}
      >
        <table className="w-max min-w-full table-fixed text-left border-collapse text-xs select-text">
          {/* Table Header */}
          <thead
            ref={tableHeaderRef}
            className="sticky z-30 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 shadow-md"
            style={{ top: horizontalScrollMetrics.contentWidth > horizontalScrollMetrics.viewportWidth + 1 ? '67px' : '53px' }}
          >
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
                      className={`px-1.5 py-2 whitespace-normal select-none ${
                        isPinned
                          ? 'sticky z-30 bg-slate-950 border-r border-slate-800/80'
                          : 'bg-slate-950'
                      } ${index === 5 ? 'border-r-2 border-amber-500/30' : ''}`}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? 'flex min-w-0 items-center gap-1 cursor-pointer hover:text-white transition'
                              : 'flex min-w-0 items-center gap-1',
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          <span
                            className="min-w-0 break-words"
                            title={typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : undefined}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
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
                            className={`px-1 py-2.5 whitespace-nowrap text-xs select-text ${
                              isPinned
                                ? `sticky z-20 hover:z-40 border-r border-slate-800/80 ${
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
