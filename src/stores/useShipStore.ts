import { create } from 'zustand';
import type { CompactShipCatalogItem, ColumnPreset, ShipBuild, ModifiedShipStats } from '../types';
import { calcModifiedStats } from '../utils/modifiers';

export interface ShipFilters {
  searchQuery: string;
  selectedNations: string[];
  selectedTiers: number[];
  selectedClasses: string[];
  selectedAcquisitions: string[];
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
  setSelectedNations: (nations: string[]) => void;
  toggleTier: (tier: number) => void;
  setSelectedTiers: (tiers: number[]) => void;
  toggleShipClass: (shipClass: string) => void;
  setSelectedClasses: (classes: string[]) => void;
  toggleAcquisition: (acquisition: string) => void;
  setSelectedAcquisitions: (acquisitions: string[]) => void;
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
    searchQuery: string;
    selectedNations: string[];
    selectedTiers: number[];
    selectedClasses: string[];
    selectedAcquisitions: string[];
    hideClones: boolean;
  }
): CompactShipCatalogItem[] {
  const query = filters.searchQuery.trim().toLowerCase();

  return ships.filter((ship) => {
    // 1. Hide Clones
    if (filters.hideClones && ship.acquisition?.isClone) {
      return false;
    }

    // 2. Nation filter
    if (filters.selectedNations.length > 0) {
      const shipNation = ship.nation.toLowerCase();
      if (!filters.selectedNations.some((n) => n.toLowerCase() === shipNation)) {
        return false;
      }
    }

    // 3. Tier filter
    if (filters.selectedTiers.length > 0) {
      if (!filters.selectedTiers.includes(ship.tier)) {
        return false;
      }
    }

    // 4. Class filter
    if (filters.selectedClasses.length > 0) {
      if (!filters.selectedClasses.includes(ship.class)) {
        return false;
      }
    }

    // 5. Acquisition category filter
    if (filters.selectedAcquisitions.length > 0) {
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
  selectedNations: [],
  selectedTiers: [],
  selectedClasses: [],
  selectedAcquisitions: [],
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

  toggleNation: (nation: string) => {
    const norm = nation.toLowerCase();
    const current = get().selectedNations;
    if (current.includes(norm)) {
      set({ selectedNations: current.filter((n) => n !== norm) });
    } else {
      set({ selectedNations: [...current, norm] });
    }
  },

  setSelectedNations: (nations: string[]) =>
    set({ selectedNations: nations.map((n) => n.toLowerCase()) }),

  toggleTier: (tier: number) => {
    const current = get().selectedTiers;
    if (current.includes(tier)) {
      set({ selectedTiers: current.filter((t) => t !== tier) });
    } else {
      set({ selectedTiers: [...current, tier].sort((a, b) => a - b) });
    }
  },

  setSelectedTiers: (tiers: number[]) => set({ selectedTiers: [...tiers].sort((a, b) => a - b) }),

  toggleShipClass: (shipClass: string) => {
    const current = get().selectedClasses;
    if (current.includes(shipClass)) {
      set({ selectedClasses: current.filter((c) => c !== shipClass) });
    } else {
      set({ selectedClasses: [...current, shipClass] });
    }
  },

  setSelectedClasses: (classes: string[]) => set({ selectedClasses: classes }),

  toggleAcquisition: (acquisition: string) => {
    const current = get().selectedAcquisitions;
    if (current.includes(acquisition)) {
      set({ selectedAcquisitions: current.filter((a) => a !== acquisition) });
    } else {
      set({ selectedAcquisitions: [...current, acquisition] });
    }
  },

  setSelectedAcquisitions: (acquisitions: string[]) => set({ selectedAcquisitions: acquisitions }),

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
      selectedNations: [],
      selectedTiers: [],
      selectedClasses: [],
      selectedAcquisitions: [],
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
      // If useTopModules is false, adjust base health to stockHealth
      let baseShip = ship;
      if (!useTopModules && ship.stockHealth && ship.stockHealth !== ship.health) {
        baseShip = { ...ship, health: ship.stockHealth };
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
