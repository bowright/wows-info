import type { CompactShipCatalogItem } from '../types';

export const SHIP_PALETTE = [
  '#f59e0b', // Amber (Ship 1)
  '#06b6d4', // Cyan (Ship 2)
  '#10b981', // Emerald (Ship 3)
  '#c084fc', // Purple (Ship 4)
];

export interface MetricRowDef {
  id: string;
  label: string;
  unit?: string;
  direction?: 'higher' | 'lower' | 'neutral';
  getValue: (ship: CompactShipCatalogItem) => number | string | null | undefined;
  format?: (val: any) => string;
}

export interface MetricCategory {
  id: string;
  title: string;
  iconName: string;
  rows: MetricRowDef[];
}

export const COMPARISON_CATEGORIES: MetricCategory[] = [
  {
    id: 'acquisition',
    title: 'Acquisition & Economy',
    iconName: 'ShoppingBag',
    rows: [
      {
        id: 'category',
        label: 'Source Category',
        direction: 'neutral',
        getValue: (s) => s.acquisition?.category || 'Tech Tree',
      },
      {
        id: 'primaryCurrency',
        label: 'Currency',
        direction: 'neutral',
        getValue: (s) => {
          const curr = s.acquisition?.primaryCurrency;
          if (!curr || curr === 'none') return 'Silver / Free XP';
          if (curr === 'coal') return 'Coal';
          if (curr === 'steel') return 'Steel';
          if (curr === 'research_points') return 'Research Points (RP)';
          if (curr === 'gold') return 'Doubloons';
          return curr;
        },
      },
      {
        id: 'basePrice',
        label: 'Base Price',
        direction: 'lower',
        getValue: (s) => s.acquisition?.price || null,
        format: (val) => (typeof val === 'number' && val > 0 ? val.toLocaleString() : '—'),
      },
      {
        id: 'couponPrice',
        label: 'Coupon Discount (25%)',
        direction: 'lower',
        getValue: (s) => s.acquisition?.couponPrice || null,
        format: (val) => (typeof val === 'number' && val > 0 ? val.toLocaleString() : '—'),
      },
      {
        id: 'availability',
        label: 'Availability Status',
        direction: 'neutral',
        getValue: (s) => s.acquisition?.obtainMethodText || 'Standard Progression',
      },
    ],
  },
  {
    id: 'survivability',
    title: 'Survivability & Armor',
    iconName: 'Shield',
    rows: [
      {
        id: 'health',
        label: 'Hit Points (Top Hull)',
        unit: 'HP',
        direction: 'higher',
        getValue: (s) => s.health,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'stockHealth',
        label: 'Stock Hit Points',
        unit: 'HP',
        direction: 'higher',
        getValue: (s) => s.stockHealth,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'overmatchMm',
        label: 'AP Overmatch Protection Rule',
        unit: 'mm',
        direction: 'higher',
        getValue: (s) => s.artillery?.overmatchMm || 0,
        format: (val) => (Number(val) > 0 ? `${val} mm bow/stern overmatch` : '—'),
      },
    ],
  },
  {
    id: 'artillery',
    title: 'Artillery & Firepower',
    iconName: 'Crosshair',
    rows: [
      {
        id: 'caliber',
        label: 'Caliber',
        unit: 'mm',
        direction: 'higher',
        getValue: (s) => s.artillery?.caliberMm || null,
        format: (val) => (val ? `${val} mm` : '—'),
      },
      {
        id: 'barrels',
        label: 'Main Battery Barrels',
        direction: 'higher',
        getValue: (s) => s.artillery?.totalBarrels || null,
        format: (val) => (val ? `${val} barrels` : '—'),
      },
      {
        id: 'reload',
        label: 'Reload Time',
        unit: 's',
        direction: 'lower',
        getValue: (s) => s.artillery?.reload || null,
        format: (val) => (val ? `${val}s` : '—'),
      },
      {
        id: 'range',
        label: 'Firing Range',
        unit: 'km',
        direction: 'higher',
        getValue: (s) => s.artillery?.rangeKm || null,
        format: (val) => (val ? `${val} km` : '—'),
      },
      {
        id: 'traverse',
        label: '180° Traverse Time',
        unit: 's',
        direction: 'lower',
        getValue: (s) => s.artillery?.traverse180 || s.traverse180 || null,
        format: (val) => (val ? `${val}s` : '—'),
      },
      {
        id: 'heDpm',
        label: 'HE Shell DPM',
        direction: 'higher',
        getValue: (s) => s.artillery?.heDpm || null,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'apDpm',
        label: 'AP Shell DPM',
        direction: 'higher',
        getValue: (s) => s.artillery?.apDpm || null,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'heAlpha',
        label: 'HE Shell Alpha Damage',
        direction: 'higher',
        getValue: (s) => s.heAlpha || null,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'apAlpha',
        label: 'AP Shell Alpha Damage',
        direction: 'higher',
        getValue: (s) => s.apAlpha || null,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'fireChance',
        label: 'HE Fire Chance',
        unit: '%',
        direction: 'higher',
        getValue: (s) => s.artillery?.fireChance || null,
        format: (val) => (val !== null && val !== undefined ? `${val}%` : '—'),
      },
      {
        id: 'sigma',
        label: 'Artillery Sigma',
        direction: 'higher',
        getValue: (s) => s.artillery?.sigma || null,
        format: (val) => (val ? Number(val).toFixed(2) : '—'),
      },
      {
        id: 'dispersionH',
        label: 'Horizontal Dispersion',
        unit: 'm',
        direction: 'lower',
        getValue: (s) => s.horizontalDispersion || s.artillery?.horizontalDispersion || null,
        format: (val) => (val ? `${val} m` : '—'),
      },
    ],
  },
  {
    id: 'torpedoes',
    title: 'Torpedo Armament',
    iconName: 'Flame',
    rows: [
      {
        id: 'torpTubes',
        label: 'Total Torpedo Tubes',
        direction: 'higher',
        getValue: (s) => s.torpedoes?.totalTubes || null,
        format: (val) => (val ? `${val} tubes` : '—'),
      },
      {
        id: 'torpRange',
        label: 'Torpedo Range',
        unit: 'km',
        direction: 'higher',
        getValue: (s) => s.torpedoes?.rangeKm || null,
        format: (val) => (val ? `${val} km` : '—'),
      },
      {
        id: 'torpSpeed',
        label: 'Torpedo Speed',
        unit: 'kts',
        direction: 'higher',
        getValue: (s) => s.torpedoes?.speed || null,
        format: (val) => (val ? `${val} kts` : '—'),
      },
      {
        id: 'torpDamage',
        label: 'Max Torpedo Damage',
        direction: 'higher',
        getValue: (s) => s.torpedoes?.damage || null,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'torpReload',
        label: 'Torpedo Reload',
        unit: 's',
        direction: 'lower',
        getValue: (s) => s.torpedoes?.reload || null,
        format: (val) => (val ? `${val}s` : '—'),
      },
      {
        id: 'torpDetect',
        label: 'Torpedo Detectability',
        unit: 'km',
        direction: 'lower',
        getValue: (s) => s.torpedoDetect || s.torpedoes?.detectabilityKm || null,
        format: (val) => (val ? `${val} km` : '—'),
      },
    ],
  },
  {
    id: 'aa',
    title: 'Anti-Air Defense (AA)',
    iconName: 'Wind',
    rows: [
      {
        id: 'aaRange',
        label: 'Max AA Firing Range',
        unit: 'km',
        direction: 'higher',
        getValue: (s) => s.aaRange || s.aa?.maxRange || null,
        format: (val) => (val ? `${val} km` : '—'),
      },
      {
        id: 'aaDps',
        label: 'Continuous AA DPS',
        direction: 'higher',
        getValue: (s) => s.aaDps || s.aa?.totalDps || null,
        format: (val) => (val ? Number(val).toLocaleString() : '—'),
      },
      {
        id: 'flakCount',
        label: 'Flak Burst Count',
        direction: 'higher',
        getValue: (s) => s.flakCount ?? s.aa?.flakCount ?? null,
        format: (val) => (val !== null && val !== undefined ? `${val} bursts` : '—'),
      },
    ],
  },
  {
    id: 'asw',
    title: 'Anti-Submarine Warfare (ASW)',
    iconName: 'Shield',
    rows: [
      {
        id: 'aswType',
        label: 'ASW System Type',
        direction: 'neutral',
        getValue: (s) => (s.asw?.type === 'depth_charges' ? 'Ship Depth Charges' : s.asw?.type === 'airstrike' ? 'ASW Airstrike' : '—'),
      },
      {
        id: 'aswRange',
        label: 'ASW Operating Range',
        unit: 'km',
        direction: 'higher',
        getValue: (s) => s.aswRange || s.asw?.rangeKm || null,
        format: (val) => (val ? `${val} km` : '—'),
      },
      {
        id: 'aswReload',
        label: 'ASW Reload Time',
        unit: 's',
        direction: 'lower',
        getValue: (s) => s.asw?.reloadTime || null,
        format: (val) => (val ? `${val}s` : '—'),
      },
    ],
  },
  {
    id: 'mobility',
    title: 'Mobility & Handling',
    iconName: 'Sliders',
    rows: [
      {
        id: 'speed',
        label: 'Maximum Speed',
        unit: 'kts',
        direction: 'higher',
        getValue: (s) => s.speed,
        format: (val) => (val ? `${val} kts` : '—'),
      },
      {
        id: 'turningRadius',
        label: 'Turning Circle Radius',
        unit: 'm',
        direction: 'lower',
        getValue: (s) => s.turningRadius,
        format: (val) => (val ? `${val} m` : '—'),
      },
      {
        id: 'rudderTime',
        label: 'Rudder Shift Time',
        unit: 's',
        direction: 'lower',
        getValue: (s) => s.rudderTime,
        format: (val) => (val ? `${val}s` : '—'),
      },
    ],
  },
  {
    id: 'concealment',
    title: 'Concealment & Stealth',
    iconName: 'Eye',
    rows: [
      {
        id: 'concealmentSurface',
        label: 'Surface Detectability',
        unit: 'km',
        direction: 'lower',
        getValue: (s) => s.concealmentSurface,
        format: (val) => (val ? `${val} km` : '—'),
      },
      {
        id: 'concealmentAir',
        label: 'Air Detectability',
        unit: 'km',
        direction: 'lower',
        getValue: (s) => s.concealmentAir,
        format: (val) => (val ? `${val} km` : '—'),
      },
      {
        id: 'concealmentSmoke',
        label: 'Smoke Firing Penalty',
        unit: 'km',
        direction: 'lower',
        getValue: (s) => s.concealmentSmoke,
        format: (val) => (val ? `${val} km` : '—'),
      },
    ],
  },
];

export function computeAdvantage(
  row: MetricRowDef,
  val: any,
  shipValues: any[]
): 'best' | 'worst' | 'neutral' {
  if (row.direction === 'neutral' || shipValues.length < 2) {
    return 'neutral';
  }

  const numericValues = shipValues
    .map((v) => (v !== null && v !== undefined && !Number.isNaN(Number(v)) ? Number(v) : null))
    .filter((v): v is number => v !== null);

  if (numericValues.length < 2) return 'neutral';

  const currentNum = val !== null && val !== undefined && !Number.isNaN(Number(val)) ? Number(val) : null;
  if (currentNum === null) return 'neutral';

  const max = Math.max(...numericValues);
  const min = Math.min(...numericValues);

  if (max === min) return 'neutral';

  if (row.direction === 'higher') {
    if (currentNum === max) return 'best';
    if (currentNum === min) return 'worst';
  } else if (row.direction === 'lower') {
    if (currentNum === min) return 'best';
    if (currentNum === max) return 'worst';
  }

  return 'neutral';
}
