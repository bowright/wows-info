export type ShipClass = 'Destroyer' | 'Cruiser' | 'Battleship' | 'AirCarrier' | 'Submarine';

export type AcquisitionCategory =
  | 'Tech Tree'
  | 'Coal'
  | 'Steel'
  | 'Doubloon'
  | 'Coal / Doubloon'
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

export interface AdditionalOffer {
  bundleId?: string | null;
  currency: string;
  price: number;
  basePrice?: number | null;
  couponEligible: boolean;
  couponPrice: number | null;
  steelEquivalent?: number | null;
}

export interface ShipAcquisitionData {
  category: AcquisitionCategory;
  categories?: AcquisitionCategory[];
  status: AvailabilityStatus;
  primaryCurrency: 'coal' | 'steel' | 'gold' | 'paragon_xp' | 'credits' | 'community' | 'eventum' | `eventum_${number}` | 'free_xp' | 'none';
  price: number | null;
  basePrice?: number | null;
  couponEligible: boolean;
  couponPrice: number | null;
  steelEquivalent?: number | null;
  secondaryCurrency?: string | null;
  secondaryPrice?: number | null;
  secondaryBasePrice?: number | null;
  secondaryCouponEligible?: boolean;
  secondaryCouponPrice?: number | null;
  minDoubloonsRequired?: number | null;
  totalPhases?: number | null;
  isClone: boolean;
  cloneOfShipId?: number | null;
  obtainMethodText: string;
  availabilityNote?: string | null;
  rarity?: string | null;
  bundleId?: string | null;
  bundleExpiry?: string | null;
  otherOffers?: AdditionalOffer[];
}

export interface ShipArtilleryStats {
  caliberMm: number;
  totalBarrels: number;
  reload: number;
  traverse180?: number;
  rangeKm: number;
  sigma: number;
  horizontalDispersion?: number;
  verticalDispersion?: number;
  heDpm: number;
  apDpm: number;
  sapDpm: number;
  heAlpha?: number | null;
  apAlpha?: number | null;
  sapAlpha?: number | null;
  fireChance: number;
  overmatchMm: number;
  stockRangeKm?: number | null;
  stock?: Omit<ShipArtilleryStats, 'stockRangeKm' | 'stock'> | null;
}

export interface ShipTorpedoStats {
  totalTubes: number;
  rangeKm: number;
  speed: number;
  damage: number;
  reload: number;
  detectabilityKm?: number;
  stock?: ShipTorpedoStats | null;
}

export interface ShipSecondaryStats {
  rangeKm: number | null;
  caliberMm: number;
  totalBarrels: number;
  reload: number | null;
  heDpm: number;
  apDpm: number;
  sapDpm: number;
  fireChance: number | null;
  penetrationMm: number | null;
}

export interface AircraftLoadoutStats {
  planes: Array<{
    name: string;
    maxHealth: number;
    squadronSize: number;
    attackerSize: number;
    attackCount: number;
    projectilesPerAttack: number;
    hangarSize: number;
    restorationTimeSeconds: number;
    speed: number;
    payload: {
      name: string;
      type: string;
      alphaDamage: number;
      fireChance: number | null;
    } | null;
  }>;
}

export interface ShipAircraftStats {
  attackAircraft: AircraftLoadoutStats | null;
  torpedoBombers: AircraftLoadoutStats | null;
  diveBombers: AircraftLoadoutStats | null;
  skipBombers: AircraftLoadoutStats | null;
}

export interface ShipSubmarineStats {
  diveCapacity: number | null;
  diveCapacityRechargeRate: number | null;
  submergedSpeed: number | null;
  periscopeDetectabilityKm: number | null;
  pingRangeKm: number | null;
  pingReloadTime: number | null;
  pingSpeed: number | null;
  pingDurationsSeconds: number[];
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
  stockSpeed: number;
  rudderTime: number;
  stockRudderTime: number;
  turningRadius: number;
  stockTurningRadius: number;
  concealmentSurface: number | null;
  concealmentAir: number | null;
  concealmentSmoke: number | null;
  stockConcealmentSurface: number | null;
  stockConcealmentAir: number | null;
  stockConcealmentSmoke: number | null;
  smokePenalty: number | null;

  // Promoted scalar columns for 60fps virtualized matrix
  traverse180: number | null;
  horizontalDispersion: number | null;
  verticalDispersion: number | null;
  heAlpha: number | null;
  apAlpha: number | null;
  sapAlpha: number | null;
  torpedoDetect: number | null;
  aaRange: number | null;
  aaDps: number | null;
  flakCount: number | null;
  aswRange: number | null;

  // Survivability metrics matching shiptool.st (p=SRV)
  repairPct: number | null;
  citadelRepairPct: number | null;
  fireResistance: number | null;
  fireDuration: number | null;
  fireDamage: number | null;
  noOfFires: number | null;
  torpedoProtection: number | null;
  floodingDuration: number | null;
  floodingDamage: number | null;
  noOfFloodings: number | null;

  artillery: ShipArtilleryStats | null;
  torpedoes: ShipTorpedoStats | null;
  secondary: ShipSecondaryStats | null;
  aircraft: ShipAircraftStats | null;
  submarine: ShipSubmarineStats | null;
  aa?: {
    maxRange: number;
    totalDps: number;
    flakCount: number;
  } | null;
  asw?: {
    type: 'airstrike' | 'depth_charges';
    rangeKm: number;
    reloadTime: number;
  } | null;
  acquisition?: {
    category: AcquisitionCategory;
    categories?: AcquisitionCategory[];
    status: AvailabilityStatus;
    primaryCurrency: string;
    price: number | null;
    basePrice?: number | null;
    couponEligible: boolean;
    couponPrice: number | null;
    steelEquivalent: number | null;
    secondaryCurrency?: string | null;
    secondaryPrice?: number | null;
    secondaryBasePrice?: number | null;
    secondaryCouponEligible?: boolean;
    secondaryCouponPrice?: number | null;
    minDoubloonsRequired?: number | null;
    totalPhases?: number | null;
    isClone: boolean;
    cloneOfShipId?: number | null;
    obtainMethodText?: string;
    availabilityNote?: string | null;
    rarity: string | null;
    bundleId?: string | null;
    bundleExpiry?: string | null;
    otherOffers?: AdditionalOffer[];
  };
  consumables?: ConsumableItem[];
}

export type ColumnPreset = 'general' | 'survivability' | 'artillery' | 'secondary' | 'torpedoes' | 'aa' | 'asw' | 'consumables' | 'all';


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

export interface ConsumableItem {
  slot: string;
  slotIndex: number;
  key: string;
  variant: string;
  type: string;
  name: string;
  description: string;
  iconKey?: string;
  numConsumables: number;
  reloadTime: number;
  workTime: number;
  preparationTime: number;
  lifeCycleType?: number;
  logic?: any;
}

export interface AAData {
  nearDps: number;
  mediumDps: number;
  farDps: number;
  totalDps: number;
  maxRange: number;
  flakCount: number;
  flakDamage: number;
  auras: Array<{
    type: 'near' | 'medium' | 'far';
    dps: number;
    rangeKm: number;
    hitChance: number;
  }>;
}

export interface ASWData {
  type: 'airstrike' | 'depth_charges';
  rangeKm: number;
  reloadTime: number;
  flightTime: number;
  payloadCount: number;
  bombDamage: number;
  chargesNum?: number;
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
  aa: AAData | null;
  asw: ASWData | null;
  consumables: ConsumableItem[];
  acquisition: ShipAcquisitionData | null;
  ballistics?: ShellBallisticsSummary | null;
}

export interface ShipBuild {
  upgrades?: {
    slot1?: string | null;
    slot2?: string | null;
    slot3?: string | null;
    slot4?: string | null;
    slot5?: string | null;
    slot6?: string | null;
  };
  skills?: {
    concealmentExpert?: boolean;
    adrenalineRush?: boolean;
    hpLostPercent?: number; // 0 to 100
    heavyAP?: boolean;
    heavyHE?: boolean;
    survivabilityExpert?: boolean;
    greaseTheGears?: boolean;
    swiftInSilence?: boolean;
    superintendent?: boolean;
    [key: string]: any;
  };
  signals?: {
    sierraMike?: boolean;
    indiaYankee?: boolean;
    julietYankeeBissotwo?: boolean;
    victorLima?: boolean;
    indiaXRay?: boolean;
    mikeYankeeSoxisix?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface AppliedModifier {
  source: string;
  category: 'upgrade' | 'skill' | 'signal';
  description: string;
}

export type ModifiedShipStats = CompactShipCatalogItem & {
  modifiersApplied: AppliedModifier[];
  burnTime?: number;
  floodTime?: number;
};

export interface ArmoryOffer {
  bundleId: string;
  shipId: number;
  title: string;
  currency: string;
  price: number;
  originalPrice: number | null;
  discount: number | null;
  couponEligible: boolean;
  couponPrice: number;
  steelEquivalent: number | null;
  isPrimary: boolean;
  isBonus: boolean;
  bundleExpiry: string | null;
  shipClass: ShipClass | string;
  level: number;
  nation: string;
}

export interface ArmoryMasterData {
  version: string;
  updatedAt: string;
  source: string;
  totalShips: number;
  armoryBundlesCount: number;
  armoryOffersCount: number;
  uniqueArmoryShipsCount: number;
  bundles: any[];
  offers: ArmoryOffer[];
  ships: Record<string, ShipAcquisitionData>;
}

export interface DockyardShipInfo {
  shipId: number;
  name: string;
  dispName: string;
  tier: number;
  class: ShipClass;
  nation: string;
  totalPhases: number;
  freePhases: number;
  starterPackPhases: number;
  minDoubloonsRequired: number;
  releaseVersion: string;
  eventYear: number;
  notes: string;
}

export interface RemovedShipInfo {
  shipId: number;
  name: string;
  dispName: string;
  tier: number;
  class: ShipClass;
  nation: string;
  removalVersion: string;
  removalReason: string;
  rarity: string;
  prevCurrency: string;
  prevPrice: number | null;
}

export interface ShortageCalculationResult {
  offer: ArmoryOffer;
  ship?: CompactShipCatalogItem;
  effectiveCoalPrice: number;
  isCouponApplied: boolean;
  canAffordPureCoal: boolean;
  pureCoalRemaining: number;
  pureCoalShortage: number;
  steelNeededToCover: number;
  canAffordWithSteel: boolean;
  steelRemainingAfterCover: number;
  effectiveSteelShortage: number;
  remainingCoalShortageWithSteel: number;
  daysToGoalPureCoal: number;
  daysToGoalWithSteel: number;
}

export type StatsServer = 'eu' | 'com' | 'asia';
export type StatsTimespan = '1' | '3' | 'all';
export type SkillBracket = 'all' | 'low' | 'medium' | 'high';

export interface ShipStatMetrics {
  battles: number;
  winRate: number; // e.g. 52.4 (%)
  avgDamage: number;
  avgFrags: number;
  survivalRate: number; // e.g. 38.5 (%)
  avgXp: number;
  spottingDamage: number;
  potentialDamage: number;
  planesDowned: number;
  pr?: number;

  // Battle-weighted raw accumulators
  wins: number;
  damage: number;
  frags: number;
  survived: number; // surv
  xp: number;
  spotting: number; // spot
  potential: number; // pot
  planes: number; // aa
}

export interface ShipServerStats extends ShipStatMetrics {
  shipId: number;
  name: string;
  dispName: string;
  tier: number;
  class: ShipClass;
  nation: string;
  category: AcquisitionCategory;
  expectedDamage: number;
  expectedWinRate: number;
  expectedFrags: number;
  brackets?: Record<SkillBracket, ShipStatMetrics>;
}

export interface StatsChunkData {
  server: StatsServer | string;
  span: StatsTimespan | string;
  updatedAt: string;
  source?: 'shiptool' | string;
  sourceVersion?: string | null;
  sourcePlayers?: number;
  sourceGames?: number;
  sourceAsset?: string;
  skippedShips?: number;
  totalShips: number;
  stats: ShipServerStats[];
}

export interface AggregateMetrics {
  totalBattles: number;
  totalShips: number;
  winRate: number;
  avgDamage: number;
  fragRate: number;
  survivalRate: number;
  avgXp: number;
  spottingDamage: number;
  potentialDamage: number;
  planesDowned: number;
  avgPr: number;
}

export type PRTierId =
  | 'below_average'
  | 'average'
  | 'good'
  | 'very_good'
  | 'great'
  | 'unicum'
  | 'super_unicum';

export interface PRTierInfo {
  id: PRTierId;
  label: string;
  min: number;
  max: number | null;
  hex: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}
