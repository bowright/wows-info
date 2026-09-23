import { create } from 'zustand';
import type { CompactShipCatalogItem, ColumnPreset, ShipBuild, ModifiedShipStats } from '../types/index.ts';
import { calcModifiedStats } from '../utils/modifiers.ts';

export const SHIP_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const SHIP_CLASSES = ['Destroyer', 'Cruiser', 'Battleship', 'AirCarrier', 'Submarine'] as const;
export const SHIP_NATIONS = [
  'usa',
  'japan',
  'germany',
  'ussr',
  'uk',
  'france',
  'italy',
  'pan_asia',
  'europe',
  'netherlands',
  'commonwealth',
  'pan_america',
  'spain',
] as const;
export const SHIP_ACQUISITIONS = [
  'Coal',
  'Steel',
  'Doubloons',
  'Research Bureau',
  'Dockyard',
  'Tech Tree',
  'Removed',
  'Clones',
] as const;

export interface ShipFilters {
  searchQuery: string;
  selectedNations: string[] | null;
  selectedTiers: number[] | null;
  selectedClasses: string[] | null;
  selectedAcquisitions: string[] | null;
  applyCoupons: boolean;
  hideClones: boolean;
  useTopModules: boolean;
  activePreset: ColumnPreset;
}

export interface ShipStoreState extends ShipFilters {
  // Data
  ships: CompactShipCatalogItem[];
  isLoading: boolean;
  error: string | null;
  
  // Comparison
  selectedShipIds: number[];
  
  // Build Modifiers
  activeBuild: ShipBuild;
  
  // UI Actions
  fetchCatalog: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  toggleNation: (nation: string) => void;
  setSelectedNations: (nations: string[] | null) => void;
  selectAllNations: () => void;
  clearNations: () => void;
  toggleTier: (tier: number) => void;
  setSelectedTiers: (tiers: number[] | null) => void;
  selectAllTiers: () => void;
  clearTiers: () => void;
  toggleShipClass: (shipClass: string) => void;
  setSelectedClasses: (classes: string[] | null) => void;
  selectAllClasses: () => void;
  clearClasses: () => void;
  toggleAcquisition: (acquisition: string) => void;
  setSelectedAcquisitions: (acquisitions: string[] | null) => void;
  selectAllAcquisitions: () => void;
  clearAcquisitions: () => void;
  setApplyCoupons: (apply: boolean) => void;
  toggleApplyCoupons: () => void;
  setHideClones: (hide: boolean) => void;
  toggleHideClones: () => void;
  setUseTopModules: (useTop: boolean) => void;
  toggleUseTopModules: () => void;
  setActivePreset: (preset: ColumnPreset) => void;
  resetFilters: () => void;

  // Compare Actions
  toggleCompareShip: (shipId: number) => void;
  clearCompare: () => void;
  isShipSelected: (shipId: number) => boolean;

  // Build Actions
  setBuild: (build: Partial<ShipBuild>) => void;
  resetBuild: () => void;

  // Selectors / Helpers
  getFilteredShips: () => ModifiedShipStats[];
}

export function filterShips(
  ships: CompactShipCatalogItem[],
  filters: {
    searchQuery?: string;
    selectedNations?: string[] | null;
    selectedTiers?: number[] | null;
    selectedClasses?: string[] | null;
    selectedAcquisitions?: string[] | null;
    hideClones?: boolean;
  }
): CompactShipCatalogItem[] {
  const query = (filters.searchQuery || '').trim().toLowerCase();

  return ships.filter((ship) => {
    // 1. Hide Clones
    if (filters.hideClones && ship.acquisition?.isClone) {
      return false;
    }

    // 2. Nation filter
    if (filters.selectedNations !== null && filters.selectedNations !== undefined) {
      if (filters.selectedNations.length === 0) {
        return false;
      }
      const shipNation = ship.nation.toLowerCase();
      if (!filters.selectedNations.some((n) => n.toLowerCase() === shipNation)) {
        return false;
      }
    }

    // 3. Tier filter
    if (filters.selectedTiers !== null && filters.selectedTiers !== undefined) {
      if (filters.selectedTiers.length === 0) {
        return false;
      }
      if (!filters.selectedTiers.includes(ship.tier)) {
        return false;
      }
    }

    // 4. Class filter
    if (filters.selectedClasses !== null && filters.selectedClasses !== undefined) {
      if (filters.selectedClasses.length === 0) {
        return false;
      }
      if (!filters.selectedClasses.includes(ship.class)) {
        return false;
      }
    }

    // 5. Acquisition category filter
    if (filters.selectedAcquisitions !== null && filters.selectedAcquisitions !== undefined) {
      if (filters.selectedAcquisitions.length === 0) {
        return false;
      }
      const match = filters.selectedAcquisitions.some((acq) => {
        const cat = ship.acquisition?.category;
        if (acq === 'Clones') {
          return ship.acquisition?.isClone === true || cat === 'Black Friday' || cat === 'Collaboration';
        }
        if (acq === 'Doubloons' || acq === 'Doubloon') {
          return cat === 'Doubloon';
        }
        return cat === acq;
      });
      if (!match) return false;
    }

    // 6. Search query
    if (query) {
      const matchDisp = ship.dispName?.toLowerCase().includes(query);
      const matchName = ship.name?.toLowerCase().includes(query);
      const matchShort = ship.dispShortName?.toLowerCase().includes(query);
      if (!matchDisp && !matchName && !matchShort) {
        return false;
      }
    }

    return true;
  });
}

export function getEffectivePrice(
  acquisition?: CompactShipCatalogItem['acquisition'] | null,
  applyCoupons = false
): number | null {
  if (!acquisition || acquisition.price == null) return null;
  if (applyCoupons && acquisition.couponEligible) {
    return acquisition.couponPrice ?? Math.round(acquisition.price * 0.75);
  }
  return acquisition.price;
}

const initialFilters: ShipFilters = {
  searchQuery: '',
  selectedNations: null,
  selectedTiers: null,
  selectedClasses: null,
  selectedAcquisitions: null,
  applyCoupons: false,
  hideClones: false,
  useTopModules: true,
  activePreset: 'general',
};

const initialBuild: ShipBuild = {
  upgrades: {},
  skills: {},
  signals: {},
};

export const useShipStore = create<ShipStoreState>((set, get) => ({
  ...initialFilters,
  ships: [],
  isLoading: false,
  error: null,
  selectedShipIds: [],
  activeBuild: initialBuild,

  fetchCatalog: async () => {
    if (get().ships.length > 0) return;
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/data/catalog.json');
      if (!res.ok) throw new Error(`HTTP ${res.status} while fetching catalog`);
      const data: CompactShipCatalogItem[] = await res.json();
      set({ ships: data, isLoading: false });
    } catch (err: any) {
      console.error('Error loading catalog.json:', err);
      set({ error: err?.message || 'Failed to load catalog', isLoading: false });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  selectAllNations: () => set({ selectedNations: null }),
  clearNations: () => set({ selectedNations: [] }),
  toggleNation: (nation: string) => {
    const norm = nation.toLowerCase();
    const current = get().selectedNations;
    if (current === null) {
      set({ selectedNations: [norm] });
    } else if (current.includes(norm)) {
      const next = current.filter((n) => n !== norm);
      set({ selectedNations: next });
    } else {
      const next = [...current, norm];
      set({ selectedNations: next.length === SHIP_NATIONS.length ? null : next });
    }
  },

  setSelectedNations: (nations: string[] | null) =>
    set({ selectedNations: nations ? nations.map((n) => n.toLowerCase()) : null }),

  selectAllTiers: () => set({ selectedTiers: null }),
  clearTiers: () => set({ selectedTiers: [] }),
  toggleTier: (tier: number) => {
    const current = get().selectedTiers;
    if (current === null) {
      set({ selectedTiers: [tier] });
    } else if (current.includes(tier)) {
      const next = current.filter((t) => t !== tier);
      set({ selectedTiers: next });
    } else {
      const next = [...current, tier].sort((a, b) => a - b);
      set({ selectedTiers: next.length === SHIP_TIERS.length ? null : next });
    }
  },

  setSelectedTiers: (tiers: number[] | null) =>
    set({ selectedTiers: tiers ? [...tiers].sort((a, b) => a - b) : null }),

  selectAllClasses: () => set({ selectedClasses: null }),
  clearClasses: () => set({ selectedClasses: [] }),
  toggleShipClass: (shipClass: string) => {
    const current = get().selectedClasses;
    if (current === null) {
      set({ selectedClasses: [shipClass] });
    } else if (current.includes(shipClass)) {
      const next = current.filter((c) => c !== shipClass);
      set({ selectedClasses: next });
    } else {
      const next = [...current, shipClass];
      set({ selectedClasses: next.length === SHIP_CLASSES.length ? null : next });
    }
  },

  setSelectedClasses: (classes: string[] | null) =>
    set({ selectedClasses: classes ? [...classes] : null }),

  selectAllAcquisitions: () => set({ selectedAcquisitions: null }),
  clearAcquisitions: () => set({ selectedAcquisitions: [] }),
  toggleAcquisition: (acquisition: string) => {
    const current = get().selectedAcquisitions;
    if (current === null) {
      set({ selectedAcquisitions: [acquisition] });
    } else if (current.includes(acquisition)) {
      const next = current.filter((a) => a !== acquisition);
      set({ selectedAcquisitions: next });
    } else {
      const next = [...current, acquisition];
      set({ selectedAcquisitions: next.length === SHIP_ACQUISITIONS.length ? null : next });
    }
  },

  setSelectedAcquisitions: (acquisitions: string[] | null) =>
    set({ selectedAcquisitions: acquisitions ? [...acquisitions] : null }),

  setApplyCoupons: (apply: boolean) => set({ applyCoupons: apply }),
  toggleApplyCoupons: () => set((state) => ({ applyCoupons: !state.applyCoupons })),

  setHideClones: (hide: boolean) => set({ hideClones: hide }),
  toggleHideClones: () => set((state) => ({ hideClones: !state.hideClones })),

  setUseTopModules: (useTop: boolean) => set({ useTopModules: useTop }),
  toggleUseTopModules: () => set((state) => ({ useTopModules: !state.useTopModules })),

  setActivePreset: (preset: ColumnPreset) => set({ activePreset: preset }),

  resetFilters: () =>
    set({
      searchQuery: '',
      selectedNations: null,
      selectedTiers: null,
      selectedClasses: null,
      selectedAcquisitions: null,
      hideClones: false,
      useTopModules: true,
      applyCoupons: false,
    }),

  toggleCompareShip: (shipId: number) => {
    const current = get().selectedShipIds;
    if (current.includes(shipId)) {
      set({ selectedShipIds: current.filter((id) => id !== shipId) });
    } else {
      set({ selectedShipIds: [...current, shipId] });
    }
  },

  clearCompare: () => set({ selectedShipIds: [] }),

  isShipSelected: (shipId: number) => get().selectedShipIds.includes(shipId),

  setBuild: (buildUpdate: Partial<ShipBuild>) => {
    set((state) => ({
      activeBuild: {
        ...state.activeBuild,
        ...buildUpdate,
        upgrades: { ...state.activeBuild.upgrades, ...buildUpdate.upgrades },
        skills: { ...state.activeBuild.skills, ...buildUpdate.skills },
        signals: { ...state.activeBuild.signals, ...buildUpdate.signals },
      },
    }));
  },

  resetBuild: () => set({ activeBuild: initialBuild }),

  getFilteredShips: () => {
    const {
      ships,
      searchQuery,
      selectedNations,
      selectedTiers,
      selectedClasses,
      selectedAcquisitions,
      hideClones,
      useTopModules,
      activeBuild,
    } = get();

    const filtered = filterShips(ships, {
      searchQuery,
      selectedNations,
      selectedTiers,
      selectedClasses,
      selectedAcquisitions,
      hideClones,
    });

    const hasActiveModifiers =
      Boolean(activeBuild.upgrades && Object.values(activeBuild.upgrades).some(Boolean)) ||
      Boolean(activeBuild.skills && Object.values(activeBuild.skills).some(Boolean)) ||
      Boolean(activeBuild.signals && Object.values(activeBuild.signals).some(Boolean)) ||
      (activeBuild.skills?.hpLostPercent != null && activeBuild.skills.hpLostPercent > 0);

    return filtered.map((ship) => {
      let baseShip = ship;
      if (!useTopModules) {
        const stockArtillery = ship.artillery?.stock ?? ship.artillery;
        const stockTorpedoes = ship.torpedoes?.stock ?? ship.torpedoes;

        baseShip = {
          ...ship,
          health: ship.stockHealth,
          speed: ship.stockSpeed,
          rudderTime: ship.stockRudderTime,
          turningRadius: ship.stockTurningRadius,
          concealmentSurface: ship.stockConcealmentSurface,
          concealmentAir: ship.stockConcealmentAir,
          concealmentSmoke: ship.stockConcealmentSmoke,
          smokePenalty: ship.stockConcealmentSmoke,
          artillery: stockArtillery,
          torpedoes: stockTorpedoes,
          traverse180: stockArtillery?.traverse180 ?? null,
          horizontalDispersion: stockArtillery?.horizontalDispersion ?? null,
          verticalDispersion: stockArtillery?.verticalDispersion ?? null,
          heAlpha: stockArtillery?.heAlpha ?? null,
          apAlpha: stockArtillery?.apAlpha ?? null,
          sapAlpha: stockArtillery?.sapAlpha ?? null,
          torpedoDetect: stockTorpedoes?.detectabilityKm ?? null,
        };
      }

      if (!hasActiveModifiers) {
        return {
          ...baseShip,
          modifiersApplied: [],
        };
      }

      return calcModifiedStats(baseShip, activeBuild);
    });
  },
}));
