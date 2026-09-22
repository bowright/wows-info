export type ShipClass = 'Destroyer' | 'Cruiser' | 'Battleship' | 'AirCarrier' | 'Submarine';

export type AcquisitionCategory =
  | 'Tech Tree'
  | 'Coal'
  | 'Steel'
  | 'Doubloon'
  | 'Research Bureau'
  | 'Dockyard'
  | 'Removed'
  | 'Black Friday'
  | 'Collaboration'
  | 'Community Tokens'
  | 'Event Tokens'
  | 'Clan/Ranked Reward'
  | 'Testing';

export type AvailabilityStatus =
  | 'available_armory'
  | 'available_tech_tree'
  | 'dockyard_active'
  | 'dockyard_historical'
  | 'removed_from_sale'
  | 'santa_supercontainer_only'
  | 'clan_ranked_exclusive'
  | 'collaborative_limited'
  | 'in_testing';

export interface ShipAcquisitionData {
  category: AcquisitionCategory;
  status: AvailabilityStatus;
  primaryCurrency: 'coal' | 'steel' | 'gold' | 'paragon_xp' | 'credits' | 'community' | 'eventum' | 'free_xp' | 'none';
  price: number | null;
  basePrice?: number | null;
  couponEligible: boolean;
  couponPrice: number | null;
  steelEquivalent?: number | null;
  minDoubloonsRequired?: number | null;
  totalPhases?: number | null;
  isClone: boolean;
  cloneOfShipId?: number | null;
  obtainMethodText: string;
  availabilityNote?: string | null;
  rarity?: string | null;
  bundleId?: string | null;
  bundleExpiry?: string | null;
}

export interface CompactShipCatalogItem {
  id: number;
  name: string;
  index: string;
  dispName: string;
  dispShortName: string;
  tier: number;
  class: ShipClass;
  nation: string;
  group: string;
  isPremium: boolean;
  isSpecial: boolean;
  health: number;
  stockHealth: number;
  speed: number;
  rudderTime: number;
  turningRadius: number;
  concealmentSurface: number | null;
  concealmentAir: number | null;
  concealmentSmoke: number | null;
  artillery: {
    caliberMm: number;
    totalBarrels: number;
    reload: number;
    rangeKm: number;
    sigma: number;
    heDpm: number;
    apDpm: number;
    sapDpm: number;
    fireChance: number;
    overmatchMm: number;
  } | null;
  torpedoes: {
    totalTubes: number;
    rangeKm: number;
    speed: number;
    damage: number;
    reload: number;
  } | null;
  acquisition?: {
    category: AcquisitionCategory;
    status: AvailabilityStatus;
    primaryCurrency: string;
    price: number | null;
    couponEligible: boolean;
    couponPrice: number | null;
    steelEquivalent: number | null;
    isClone: boolean;
    rarity: string | null;
  };
}

export interface BallisticsPoint {
  distanceKm: number;
  flightTime: number;
  impactVelocity: number;
  impactAngleDeg: number;
  penetration: number;
  beltPenetration: number;
  deckPenetration: number;
}

export interface ShellBallisticsSummary {
  name: string;
  ammoType: string;
  caliberMm: number;
  alphaDamage: number;
  bulletSpeed: number;
  bulletMass: number;
  airDrag: number;
  overmatchMm: number;
  krupp?: number;
  muzzlePenetrationMm?: number;
  penAt5km?: number | null;
  penAt10km?: number | null;
  penAt15km?: number | null;
  penAt20km?: number | null;
  curve?: BallisticsPoint[];
}

export interface ShipDetailData extends Omit<CompactShipCatalogItem, 'acquisition'> {
  description: string;
  resolvedModules: {
    top: {
      hullKey: string;
      artilleryKey: string | null;
      fireControlKey: string | null;
      torpedoesKey: string | null;
      engineKey: string | null;
    };
    stock: {
      hullKey: string;
      artilleryKey: string | null;
      fireControlKey: string | null;
      torpedoesKey: string | null;
      engineKey: string | null;
    };
  };
  artilleryFull?: object | null;
  torpedoesFull?: object | null;
  consumables: Array<{
    slot: string;
    key: string;
    type: string;
    numConsumables: number;
    reloadTime: number;
    workTime: number;
  }>;
  acquisition: ShipAcquisitionData | null;
  ballistics?: ShellBallisticsSummary | null;
}
