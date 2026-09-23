import { create } from 'zustand';
import type { ArmoryMasterData } from '../types';

export type ArmoryTab =
  | 'all'
  | 'coal'
  | 'steel'
  | 'rb'
  | 'doubloon'
  | 'calculator'
  | 'removed'
  | 'dockyard';

export type ArmorySortOption =
  | 'price-asc'
  | 'price-desc'
  | 'tier-desc'
  | 'tier-asc'
  | 'name-asc';

export type AffordabilityFilter = 'all' | 'coal' | 'steel' | 'shortage';

export const ARMORY_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const ARMORY_CLASSES = ['Destroyer', 'Cruiser', 'Battleship', 'AirCarrier', 'Submarine'] as const;
export const ARMORY_NATIONS = [
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
export const ARMORY_SOURCES = [
  'Coal',
  'Steel',
  'Doubloons',
  'Research Bureau',
  'Dockyard',
  'Removed',
  'Event Tokens',
] as const;

interface ArmoryStoreState {
  // Data
  armoryData: ArmoryMasterData | null;
  isLoading: boolean;
  error: string | null;
  fetchArmoryData: () => Promise<void>;

  // User Resources (Planner)
  userCoal: number;
  userSteel: number;
  dailyCoalRate: number;
  setUserCoal: (coal: number) => void;
  setUserSteel: (steel: number) => void;
  setDailyCoalRate: (rate: number) => void;

  // View Controls
  activeTab: ArmoryTab;
  setActiveTab: (tab: ArmoryTab) => void;
  globalApplyCoupons: boolean;
  setGlobalApplyCoupons: (apply: boolean) => void;
  toggleGlobalApplyCoupons: () => void;

  // Sub-filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTiers: number[] | null;
  toggleTier: (tier: number) => void;
  selectAllTiers: () => void;
  clearTiers: () => void;
  selectedClasses: string[] | null;
  toggleShipClass: (cls: string) => void;
  selectAllClasses: () => void;
  clearClasses: () => void;
  selectedNations: string[] | null;
  toggleNation: (nation: string) => void;
  selectAllNations: () => void;
  clearNations: () => void;
  selectedSources: string[] | null;
  toggleSource: (source: string) => void;
  selectAllSources: () => void;
  clearSources: () => void;
  resetFilters: () => void;
  sortOption: ArmorySortOption;
  setSortOption: (option: ArmorySortOption) => void;

  // Shortage Calculator Specifics
  affordabilityFilter: AffordabilityFilter;
  setAffordabilityFilter: (filter: AffordabilityFilter) => void;
  selectedTargetShipId: number | null;
  setSelectedTargetShipId: (id: number | null) => void;
}

// Local storage helpers
const getStoredNum = (key: string, fallback: number): number => {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? Math.max(0, parseInt(val, 10)) : fallback;
  } catch {
    return fallback;
  }
};

const setStoredNum = (key: string, val: number) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(val));
  } catch {}
};

export const useArmoryStore = create<ArmoryStoreState>((set, get) => ({
  armoryData: null,
  isLoading: false,
  error: null,

  userCoal: getStoredNum('wows_user_coal', 100000),
  userSteel: getStoredNum('wows_user_steel', 10000),
  dailyCoalRate: getStoredNum('wows_daily_coal_rate', 1200),

  setUserCoal: (coal: number) => {
    const safe = Math.max(0, Math.floor(coal));
    setStoredNum('wows_user_coal', safe);
    set({ userCoal: safe });
  },

  setUserSteel: (steel: number) => {
    const safe = Math.max(0, Math.floor(steel));
    setStoredNum('wows_user_steel', safe);
    set({ userSteel: safe });
  },

  setDailyCoalRate: (rate: number) => {
    const safe = Math.max(100, Math.floor(rate));
    setStoredNum('wows_daily_coal_rate', safe);
    set({ dailyCoalRate: safe });
  },

  activeTab: 'all',
  setActiveTab: (tab: ArmoryTab) => set({ activeTab: tab }),

  globalApplyCoupons: false,
  setGlobalApplyCoupons: (apply: boolean) => set({ globalApplyCoupons: apply }),
  toggleGlobalApplyCoupons: () => set((state) => ({ globalApplyCoupons: !state.globalApplyCoupons })),

  searchQuery: '',
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  selectedTiers: null,
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
      set({ selectedTiers: next.length === ARMORY_TIERS.length ? null : next });
    }
  },

  selectedClasses: null,
  selectAllClasses: () => set({ selectedClasses: null }),
  clearClasses: () => set({ selectedClasses: [] }),
  toggleShipClass: (cls: string) => {
    const current = get().selectedClasses;
    if (current === null) {
      set({ selectedClasses: [cls] });
    } else if (current.includes(cls)) {
      const next = current.filter((c) => c !== cls);
      set({ selectedClasses: next });
    } else {
      const next = [...current, cls];
      set({ selectedClasses: next.length === ARMORY_CLASSES.length ? null : next });
    }
  },

  selectedNations: null,
  selectAllNations: () => set({ selectedNations: null }),
  clearNations: () => set({ selectedNations: [] }),
  toggleNation: (nation: string) => {
    const current = get().selectedNations;
    if (current === null) {
      set({ selectedNations: [nation] });
    } else if (current.includes(nation)) {
      const next = current.filter((n) => n !== nation);
      set({ selectedNations: next });
    } else {
      const next = [...current, nation];
      set({ selectedNations: next.length === ARMORY_NATIONS.length ? null : next });
    }
  },

  selectedSources: null,
  selectAllSources: () => set({ selectedSources: null }),
  clearSources: () => set({ selectedSources: [] }),
  toggleSource: (source: string) => {
    const current = get().selectedSources;
    if (current === null) {
      set({ selectedSources: [source] });
    } else if (current.includes(source)) {
      const next = current.filter((s) => s !== source);
      set({ selectedSources: next });
    } else {
      const next = [...current, source];
      set({ selectedSources: next.length === ARMORY_SOURCES.length ? null : next });
    }
  },

  resetFilters: () =>
    set({
      searchQuery: '',
      selectedTiers: null,
      selectedClasses: null,
      selectedNations: null,
      selectedSources: null,
    }),

  sortOption: 'tier-desc',
  setSortOption: (option: ArmorySortOption) => set({ sortOption: option }),

  affordabilityFilter: 'all',
  setAffordabilityFilter: (filter: AffordabilityFilter) => set({ affordabilityFilter: filter }),

  selectedTargetShipId: null,
  setSelectedTargetShipId: (id: number | null) => set({ selectedTargetShipId: id }),

  fetchArmoryData: async () => {
    if (get().armoryData) return;
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/data/armory_master.json');
      if (!res.ok) throw new Error(`HTTP ${res.status} loading armory_master.json`);
      const data: ArmoryMasterData = await res.json();
      set({ armoryData: data, isLoading: false });
    } catch (err: any) {
      console.error('Error fetching armory_master.json:', err);
      set({ error: err?.message || 'Failed to load armory deals', isLoading: false });
    }
  },
}));
