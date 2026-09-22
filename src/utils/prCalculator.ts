import type { PRTierInfo, ShipClass } from '../types/index.ts';

export const PR_TIERS: PRTierInfo[] = [
  {
    id: 'below_average',
    label: 'Below Average',
    min: 0,
    max: 750,
    hex: '#FE0E00',
    textClass: 'text-red-400',
    bgClass: 'bg-red-500/15',
    borderClass: 'border-red-500/30',
  },
  {
    id: 'average',
    label: 'Average',
    min: 750,
    max: 1100,
    hex: '#FE7903',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/15',
    borderClass: 'border-amber-500/30',
  },
  {
    id: 'good',
    label: 'Good',
    min: 1100,
    max: 1350,
    hex: '#FFC702',
    textClass: 'text-yellow-400',
    bgClass: 'bg-yellow-400/15',
    borderClass: 'border-yellow-400/30',
  },
  {
    id: 'very_good',
    label: 'Very Good',
    min: 1350,
    max: 1550,
    hex: '#44B300',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/15',
    borderClass: 'border-emerald-500/30',
  },
  {
    id: 'great',
    label: 'Great',
    min: 1550,
    max: 1750,
    hex: '#02C9B3',
    textClass: 'text-teal-400',
    bgClass: 'bg-teal-500/15',
    borderClass: 'border-teal-500/30',
  },
  {
    id: 'unicum',
    label: 'Unicum',
    min: 1750,
    max: 2100,
    hex: '#D042F3',
    textClass: 'text-fuchsia-400',
    bgClass: 'bg-fuchsia-500/15',
    borderClass: 'border-fuchsia-500/30',
  },
  {
    id: 'super_unicum',
    label: 'Super Unicum',
    min: 2100,
    max: null,
    hex: '#A020F0',
    textClass: 'text-purple-300',
    bgClass: 'bg-purple-600/25',
    borderClass: 'border-purple-500/40',
  },
];

export interface ActualShipStats {
  avgDamage: number;
  avgFrags: number;
  winRate: number;
}

export interface ExpectedShipStats {
  expectedDamage: number;
  expectedFrags: number;
  expectedWinRate: number;
}

/**
 * Calculates World of Warships Personal Rating (PR) based on the official community formula.
 *
 * rDmg = avgDmg / expDmg
 * rFrags = avgFrags / expFrags
 * rWin = winRate / expWinRate
 *
 * nDmg = max(0, (rDmg - 0.4) / 0.6)
 * nFrags = max(0, (rFrags - 0.1) / 0.9)
 * nWin = max(0, (rWin - 0.7) / 0.3)
 *
 * PR = 700 * nDmg + 300 * nFrags + 150 * nWin
 */
export function calculatePR(
  actual: ActualShipStats,
  expected: ExpectedShipStats
): number {
  if (!actual || !expected) return 0;

  const expDmg = expected.expectedDamage > 0 ? expected.expectedDamage : 1;
  const expFrags = expected.expectedFrags > 0 ? expected.expectedFrags : 0.8;
  const expWin = expected.expectedWinRate > 0 ? expected.expectedWinRate : 50.0;

  const rDmg = actual.avgDamage / expDmg;
  const rFrags = actual.avgFrags / expFrags;
  const rWin = actual.winRate / expWin;

  const nDmg = Math.max(0, (rDmg - 0.4) / 0.6);
  const nFrags = Math.max(0, (rFrags - 0.1) / 0.9);
  const nWin = Math.max(0, (rWin - 0.7) / 0.3);

  const rawPR = 700 * nDmg + 300 * nFrags + 150 * nWin;
  return Math.round(rawPR);
}

/**
 * Returns the PRTierInfo matching a given PR score.
 */
export function getPRTier(pr: number): PRTierInfo {
  if (pr < 750) return PR_TIERS[0]; // Below Average
  if (pr < 1100) return PR_TIERS[1]; // Average
  if (pr < 1350) return PR_TIERS[2]; // Good
  if (pr < 1550) return PR_TIERS[3]; // Very Good
  if (pr < 1750) return PR_TIERS[4]; // Great
  if (pr < 2100) return PR_TIERS[5]; // Unicum
  return PR_TIERS[6]; // Super Unicum
}

/**
 * Returns the hex color string corresponding to a given PR value.
 */
export function getPRColor(pr: number): string {
  return getPRTier(pr).hex;
}

/**
 * Format PR as string or 'N/A' if NaN.
 */
export function formatPR(pr: number | null | undefined): string {
  if (pr == null || isNaN(pr)) return '—';
  return pr.toLocaleString();
}

/**
 * Default expected baseline metrics table by class and tier.
 */
export const DEFAULT_CLASS_TIER_BASELINES: Record<
  string,
  Record<number, { damage: number; frags: number; winRate: number }>
> = {
  Battleship: {
    1: { damage: 18000, frags: 0.8, winRate: 50.0 },
    2: { damage: 25000, frags: 0.8, winRate: 50.0 },
    3: { damage: 32000, frags: 0.8, winRate: 50.0 },
    4: { damage: 40000, frags: 0.8, winRate: 50.0 },
    5: { damage: 48000, frags: 0.8, winRate: 50.0 },
    6: { damage: 56000, frags: 0.8, winRate: 50.0 },
    7: { damage: 64000, frags: 0.8, winRate: 50.0 },
    8: { damage: 72000, frags: 0.8, winRate: 50.0 },
    9: { damage: 82000, frags: 0.8, winRate: 50.0 },
    10: { damage: 95000, frags: 0.8, winRate: 50.0 },
    11: { damage: 110000, frags: 0.8, winRate: 50.0 },
  },
  Cruiser: {
    1: { damage: 12000, frags: 0.8, winRate: 50.0 },
    2: { damage: 16000, frags: 0.8, winRate: 50.0 },
    3: { damage: 22000, frags: 0.8, winRate: 50.0 },
    4: { damage: 28000, frags: 0.8, winRate: 50.0 },
    5: { damage: 35000, frags: 0.8, winRate: 50.0 },
    6: { damage: 42000, frags: 0.8, winRate: 50.0 },
    7: { damage: 50000, frags: 0.8, winRate: 50.0 },
    8: { damage: 58000, frags: 0.8, winRate: 50.0 },
    9: { damage: 68000, frags: 0.8, winRate: 50.0 },
    10: { damage: 80000, frags: 0.8, winRate: 50.0 },
    11: { damage: 92000, frags: 0.8, winRate: 50.0 },
  },
  Destroyer: {
    1: { damage: 10000, frags: 0.8, winRate: 50.0 },
    2: { damage: 14000, frags: 0.8, winRate: 50.0 },
    3: { damage: 18000, frags: 0.8, winRate: 50.0 },
    4: { damage: 23000, frags: 0.8, winRate: 50.0 },
    5: { damage: 28000, frags: 0.8, winRate: 50.0 },
    6: { damage: 34000, frags: 0.8, winRate: 50.0 },
    7: { damage: 40000, frags: 0.8, winRate: 50.0 },
    8: { damage: 48000, frags: 0.8, winRate: 50.0 },
    9: { damage: 56000, frags: 0.8, winRate: 50.0 },
    10: { damage: 65000, frags: 0.8, winRate: 50.0 },
    11: { damage: 75000, frags: 0.8, winRate: 50.0 },
  },
  AirCarrier: {
    1: { damage: 15000, frags: 0.8, winRate: 50.0 },
    2: { damage: 20000, frags: 0.8, winRate: 50.0 },
    3: { damage: 28000, frags: 0.8, winRate: 50.0 },
    4: { damage: 38000, frags: 0.8, winRate: 50.0 },
    5: { damage: 48000, frags: 0.8, winRate: 50.0 },
    6: { damage: 58000, frags: 0.8, winRate: 50.0 },
    7: { damage: 68000, frags: 0.8, winRate: 50.0 },
    8: { damage: 80000, frags: 0.8, winRate: 50.0 },
    9: { damage: 95000, frags: 0.8, winRate: 50.0 },
    10: { damage: 110000, frags: 0.8, winRate: 50.0 },
    11: { damage: 125000, frags: 0.8, winRate: 50.0 },
  },
  Submarine: {
    6: { damage: 32000, frags: 0.8, winRate: 50.0 },
    8: { damage: 45000, frags: 0.8, winRate: 50.0 },
    10: { damage: 60000, frags: 0.8, winRate: 50.0 },
    11: { damage: 72000, frags: 0.8, winRate: 50.0 },
  },
};

/**
 * Resolves expected baseline for a ship, preferring existing expected properties if present,
 * or defaulting to community tier/class baseline.
 */
export function getExpectedBaseline(ship: {
  tier?: number;
  class?: ShipClass | string;
  expectedDamage?: number;
  expectedFrags?: number;
  expectedWinRate?: number;
  avgDamage?: number;
}): ExpectedShipStats {
  if (
    ship.expectedDamage &&
    ship.expectedFrags !== undefined &&
    ship.expectedWinRate !== undefined
  ) {
    return {
      expectedDamage: ship.expectedDamage,
      expectedFrags: ship.expectedFrags,
      expectedWinRate: ship.expectedWinRate,
    };
  }

  const tier = ship.tier || 8;
  const cls = (ship.class || 'Cruiser') as string;
  const classTable = DEFAULT_CLASS_TIER_BASELINES[cls] || DEFAULT_CLASS_TIER_BASELINES['Cruiser'];
  const baseline = classTable[tier] || {
    damage: Math.round(ship.avgDamage ? ship.avgDamage * 0.95 : 50000),
    frags: 0.8,
    winRate: 50.0,
  };

  return {
    expectedDamage: baseline.damage,
    expectedFrags: baseline.frags,
    expectedWinRate: baseline.winRate,
  };
}
