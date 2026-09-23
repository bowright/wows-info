import React, { useEffect, useMemo } from 'react';
import { useArmoryStore, type ArmoryTab } from '../stores/useArmoryStore';
import { useShipStore } from '../stores/useShipStore';
import { ArmoryCard } from '../components/armory/ArmoryCard';
import { ShortageCalculator } from '../components/armory/ShortageCalculator';
import { DOCKYARD_ARCHIVE } from '../data/dockyardArchive';
import { REMOVED_SHIPS_ARCHIVE } from '../data/removedShipsArchive';
import type { ShipClass } from '../types';
import {
  ShoppingBag,
  ArrowLeft,
  Flame,
  Gem,
  Coins,
  Award,
  Calculator,
  Ban,
  Hammer,
  Search,
  Percent,
  ExternalLink,
  CheckSquare,
  Square,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface ArmoryViewProps {
  onNavigate: (path: string) => void;
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

const CLASS_META: Record<string, { bg: string; text: string; abbr: string; label: string }> = {
  Destroyer: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', abbr: 'DD', label: 'Destroyer' },
  Cruiser: { bg: 'bg-cyan-500/15 border-cyan-500/30', text: 'text-cyan-400', abbr: 'CA', label: 'Cruiser' },
  Battleship: { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', abbr: 'BB', label: 'Battleship' },
  AirCarrier: { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', abbr: 'CV', label: 'Aircraft Carrier' },
  Submarine: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', abbr: 'SS', label: 'Submarine' },
};

const NATION_LABELS: Record<string, string> = {
  usa: 'U.S.A.',
  japan: 'Japan',
  germany: 'Germany',
  ussr: 'U.S.S.R.',
  uk: 'U.K.',
  france: 'France',
  italy: 'Italy',
  pan_asia: 'Pan-Asia',
  europe: 'Europe',
  netherlands: 'Netherlands',
  commonwealth: 'Commonwealth',
  pan_america: 'Pan-America',
  spain: 'Spain',
};

export function getOfferSource(
  offer: { currency: string },
  catalogShip?: { acquisition?: { category?: string } }
): string {
  if (offer.currency === 'coal') return 'Coal';
  if (offer.currency === 'steel') return 'Steel';
  if (offer.currency === 'gold') return 'Doubloons';
  if (offer.currency === 'paragon_xp') return 'Research Bureau';
  if (offer.currency && offer.currency.startsWith('eventum')) return 'Event Tokens';
  if (catalogShip?.acquisition?.category) return catalogShip.acquisition.category;
  return 'Other';
}

const ARMORY_SOURCE_CONFIG: Array<{ id: string; label: string; color: string }> = [
  { id: 'Coal', label: 'Coal', color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
  { id: 'Steel', label: 'Steel', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' },
  { id: 'Doubloons', label: 'Doubloons', color: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' },
  { id: 'Research Bureau', label: 'Research Bureau', color: 'text-rose-400 border-rose-500/40 bg-rose-500/10' },
  { id: 'Dockyard', label: 'Dockyard', color: 'text-orange-400 border-orange-500/40 bg-orange-500/10' },
  { id: 'Removed', label: 'Removed', color: 'text-red-400 border-red-500/40 bg-red-500/10' },
  { id: 'Event Tokens', label: 'Event Tokens', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
];

export const ArmoryView: React.FC<ArmoryViewProps> = ({ onNavigate }) => {
  const armoryData = useArmoryStore((state) => state.armoryData);
  const isArmoryLoading = useArmoryStore((state) => state.isLoading);
  const fetchArmoryData = useArmoryStore((state) => state.fetchArmoryData);

  const activeTab = useArmoryStore((state) => state.activeTab);
  const setActiveTab = useArmoryStore((state) => state.setActiveTab);

  const globalApplyCoupons = useArmoryStore((state) => state.globalApplyCoupons);
  const toggleGlobalApplyCoupons = useArmoryStore((state) => state.toggleGlobalApplyCoupons);

  const searchQuery = useArmoryStore((state) => state.searchQuery);
  const setSearchQuery = useArmoryStore((state) => state.setSearchQuery);

  const selectedTiers = useArmoryStore((state) => state.selectedTiers);
  const toggleTier = useArmoryStore((state) => state.toggleTier);
  const selectAllTiers = useArmoryStore((state) => state.selectAllTiers);
  const clearTiers = useArmoryStore((state) => state.clearTiers);

  const selectedClasses = useArmoryStore((state) => state.selectedClasses);
  const toggleShipClass = useArmoryStore((state) => state.toggleShipClass);
  const selectAllClasses = useArmoryStore((state) => state.selectAllClasses);
  const clearClasses = useArmoryStore((state) => state.clearClasses);

  const selectedNations = useArmoryStore((state) => state.selectedNations);
  const toggleNation = useArmoryStore((state) => state.toggleNation);
  const selectAllNations = useArmoryStore((state) => state.selectAllNations);
  const clearNations = useArmoryStore((state) => state.clearNations);

  const selectedSources = useArmoryStore((state) => state.selectedSources);
  const toggleSource = useArmoryStore((state) => state.toggleSource);
  const selectAllSources = useArmoryStore((state) => state.selectAllSources);
  const clearSources = useArmoryStore((state) => state.clearSources);

  const resetArmoryFilters = useArmoryStore((state) => state.resetFilters);

  const sortOption = useArmoryStore((state) => state.sortOption);
  const setSortOption = useArmoryStore((state) => state.setSortOption);

  const setSelectedTargetShipId = useArmoryStore((state) => state.setSelectedTargetShipId);

  // Ship store
  const ships = useShipStore((state) => state.ships);
  const fetchCatalog = useShipStore((state) => state.fetchCatalog);
  const resetShipFilters = useShipStore((state) => state.resetFilters);
  const setSearchInShipStore = useShipStore((state) => state.setSearchQuery);
  const selectedShipIds = useShipStore((state) => state.selectedShipIds);
  const toggleCompareShip = useShipStore((state) => state.toggleCompareShip);

  useEffect(() => {
    fetchArmoryData();
    fetchCatalog();
  }, [fetchArmoryData, fetchCatalog]);

  const catalogMap = useMemo(() => {
    return new Map(ships.map((s) => [s.id, s]));
  }, [ships]);

  const offers = useMemo(() => armoryData?.offers || [], [armoryData]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const coal = offers.filter((o) => o.currency === 'coal').length;
    const steel = offers.filter((o) => o.currency === 'steel').length;
    const rb = offers.filter((o) => o.currency === 'paragon_xp').length;
    const gold = offers.filter((o) => o.currency === 'gold').length;

    return {
      all: offers.length,
      coal,
      steel,
      rb,
      doubloon: gold,
      removed: REMOVED_SHIPS_ARCHIVE.length,
      dockyard: DOCKYARD_ARCHIVE.length,
    };
  }, [offers]);

  // Offers matching current deal tab
  const tabOffers = useMemo(() => {
    if (activeTab === 'coal') return offers.filter((o) => o.currency === 'coal');
    if (activeTab === 'steel') return offers.filter((o) => o.currency === 'steel');
    if (activeTab === 'rb') return offers.filter((o) => o.currency === 'paragon_xp');
    if (activeTab === 'doubloon') return offers.filter((o) => o.currency === 'gold');
    if (activeTab === 'all') return offers;
    return [];
  }, [offers, activeTab]);

  // Filtered & sorted offers for deal tabs
  const visibleOffers = useMemo(() => {
    let list = tabOffers;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        const cat = catalogMap.get(o.shipId);
        const matchTitle = o.title.toLowerCase().includes(q);
        const matchDisp = cat?.dispName?.toLowerCase().includes(q);
        return matchTitle || matchDisp;
      });
    }

    // Tiers
    if (selectedTiers !== null) {
      list = list.filter((o) => {
        const cat = catalogMap.get(o.shipId);
        const tier = cat?.tier || o.level;
        return selectedTiers.includes(tier);
      });
    }

    // Classes
    if (selectedClasses !== null) {
      list = list.filter((o) => {
        const cat = catalogMap.get(o.shipId);
        const cls = cat?.class || o.shipClass;
        return selectedClasses.includes(cls);
      });
    }

    // Nations
    if (selectedNations !== null) {
      list = list.filter((o) => {
        const cat = catalogMap.get(o.shipId);
        const nation = cat?.nation || o.nation;
        return nation ? selectedNations.includes(nation) : false;
      });
    }

    // Sources
    if (selectedSources !== null) {
      list = list.filter((o) => {
        const cat = catalogMap.get(o.shipId);
        const src = getOfferSource(o, cat);
        return selectedSources.includes(src);
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      const catA = catalogMap.get(a.shipId);
      const catB = catalogMap.get(b.shipId);

      const priceA = globalApplyCoupons && a.couponEligible ? (a.couponPrice ?? a.price * 0.75) : a.price;
      const priceB = globalApplyCoupons && b.couponEligible ? (b.couponPrice ?? b.price * 0.75) : b.price;

      const tierA = catA?.tier || a.level;
      const tierB = catB?.tier || b.level;

      if (sortOption === 'price-asc') return priceA - priceB;
      if (sortOption === 'price-desc') return priceB - priceA;
      if (sortOption === 'tier-desc') return tierB - tierA;
      if (sortOption === 'tier-asc') return tierA - tierB;
      if (sortOption === 'name-asc') {
        const nameA = catA?.dispName || a.title;
        const nameB = catB?.dispName || b.title;
        return nameA.localeCompare(nameB);
      }
      return 0;
    });
  }, [
    tabOffers,
    searchQuery,
    selectedTiers,
    selectedClasses,
    selectedNations,
    selectedSources,
    sortOption,
    globalApplyCoupons,
    catalogMap,
  ]);

  // Coal offers for Shortage Calculator
  const coalOffers = useMemo(() => {
    return offers.filter((o) => o.currency === 'coal');
  }, [offers]);

  // Filtered Removed ships
  const visibleRemovedShips = useMemo(() => {
    let list = REMOVED_SHIPS_ARCHIVE;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => s.dispName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    if (selectedTiers !== null) {
      list = list.filter((s) => selectedTiers.includes(s.tier));
    }
    if (selectedClasses !== null) {
      list = list.filter((s) => selectedClasses.includes(s.class));
    }
    if (selectedNations !== null) {
      list = list.filter((s) => selectedNations.includes(s.nation));
    }
    if (selectedSources !== null && !selectedSources.includes('Removed')) {
      return [];
    }

    return [...list].sort((a, b) => {
      if (sortOption === 'tier-desc') return b.tier - a.tier;
      if (sortOption === 'tier-asc') return a.tier - b.tier;
      return a.dispName.localeCompare(b.dispName);
    });
  }, [searchQuery, selectedTiers, selectedClasses, selectedNations, selectedSources, sortOption]);

  // Filtered Dockyard ships
  const visibleDockyards = useMemo(() => {
    let list = DOCKYARD_ARCHIVE;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => s.dispName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    if (selectedTiers !== null) {
      list = list.filter((s) => selectedTiers.includes(s.tier));
    }
    if (selectedClasses !== null) {
      list = list.filter((s) => selectedClasses.includes(s.class));
    }
    if (selectedNations !== null) {
      list = list.filter((s) => selectedNations.includes(s.nation));
    }
    if (selectedSources !== null && !selectedSources.includes('Dockyard')) {
      return [];
    }

    return [...list].sort((a, b) => {
      if (sortOption === 'tier-desc') return b.tier - a.tier;
      if (sortOption === 'tier-asc') return a.tier - b.tier;
      if (sortOption === 'price-asc') return a.minDoubloonsRequired - b.minDoubloonsRequired;
      if (sortOption === 'price-desc') return b.minDoubloonsRequired - a.minDoubloonsRequired;
      return b.eventYear - a.eventYear;
    });
  }, [searchQuery, selectedTiers, selectedClasses, selectedNations, selectedSources, sortOption]);

  const handleInspectShip = (shipDisplayName: string) => {
    resetShipFilters();
    setSearchInShipStore(shipDisplayName);
    onNavigate('/params');
  };

  const handleSelectAsTarget = (shipId: number) => {
    setSelectedTargetShipId(shipId);
    setActiveTab('calculator');
  };

  const tabs: Array<{
    id: ArmoryTab;
    label: string;
    count?: number;
    icon: React.ComponentType<{ className?: string }>;
    color?: string;
  }> = [
    { id: 'all', label: 'All Active Deals', count: tabCounts.all, icon: ShoppingBag },
    { id: 'coal', label: 'Coal Ships', count: tabCounts.coal, icon: Flame, color: 'text-amber-400' },
    { id: 'steel', label: 'Steel Ships', count: tabCounts.steel, icon: Gem, color: 'text-cyan-400' },
    { id: 'rb', label: 'Research Bureau', count: tabCounts.rb, icon: Award, color: 'text-rose-400' },
    { id: 'doubloon', label: 'Doubloon Ships', count: tabCounts.doubloon, icon: Coins, color: 'text-yellow-400' },
    { id: 'calculator', label: 'Shortage Calculator', icon: Calculator, color: 'text-emerald-400' },
    { id: 'removed', label: 'Removed Ships Hall of Fame', count: tabCounts.removed, icon: Ban, color: 'text-red-400' },
    { id: 'dockyard', label: 'Dockyard Archive', count: tabCounts.dockyard, icon: Hammer, color: 'text-orange-400' },
  ];

  if (isArmoryLoading && offers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">Loading Armory Deals...</p>
          <p className="text-xs text-slate-500">Retrieving 226 verified ship bundle entitlements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 space-y-6 pb-24">
      {/* 1. Header Bar with Back Navigation and Global Coupon Switch */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/params')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Parameters Matrix</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <span>Acquisition Center & Resource Planner</span>
            </h1>
            <p className="text-xs text-slate-400">
              Live Armory Bundles, -25% Coupon Modeling, 1:10 Steel-to-Coal Calculator & Historical Archives
            </p>
          </div>
        </div>

        {/* Global Coupon Switch in Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleGlobalApplyCoupons}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition shadow-sm ${
              globalApplyCoupons
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle 25% Armory coupon on Coal, Steel, and Doubloon deals"
          >
            <Percent className="w-3.5 h-3.5" />
            <span>-25% Armory Coupons</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                globalApplyCoupons ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {globalApplyCoupons ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div
          onClick={() => setActiveTab('coal')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            activeTab === 'coal'
              ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              <span>Coal Ships</span>
            </span>
            <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.2 rounded text-amber-300">
              -25%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{tabCounts.coal}</div>
          <div className="text-[11px] text-slate-400">1:10 Steel Substitution</div>
        </div>

        <div
          onClick={() => setActiveTab('steel')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            activeTab === 'steel'
              ? 'bg-cyan-950/30 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-cyan-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Gem className="w-4 h-4" />
              <span>Steel Ships</span>
            </span>
            <span className="text-[10px] font-mono bg-cyan-500/20 px-1.5 py-0.2 rounded text-cyan-300">
              -25%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{tabCounts.steel}</div>
          <div className="text-[11px] text-slate-400">Competitive Rewards</div>
        </div>

        <div
          onClick={() => setActiveTab('rb')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            activeTab === 'rb'
              ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-500/10'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-rose-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>Research Bureau</span>
            </span>
            <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.2 rounded text-slate-400">
              No Coupons
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{tabCounts.rb}</div>
          <div className="text-[11px] text-slate-400">Reset Points Catalog</div>
        </div>

        <div
          onClick={() => setActiveTab('doubloon')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            activeTab === 'doubloon'
              ? 'bg-yellow-950/30 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-yellow-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              <span>Doubloon Ships</span>
            </span>
            <span className="text-[10px] font-mono bg-yellow-500/20 px-1.5 py-0.2 rounded text-yellow-300">
              -25%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{tabCounts.doubloon}</div>
          <div className="text-[11px] text-slate-400">Armory Premium Fleet</div>
        </div>

        <div
          onClick={() => setActiveTab('calculator')}
          className={`p-3.5 rounded-xl border transition cursor-pointer col-span-2 md:col-span-4 lg:col-span-1 ${
            activeTab === 'calculator'
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Calculator className="w-4 h-4" />
              <span>Shortage Planner</span>
            </span>
            <span className="text-[10px] font-mono bg-emerald-500/20 px-1.5 py-0.2 rounded text-emerald-300">
              Dynamic
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-white mt-1">Resource Math</div>
          <div className="text-[11px] text-slate-400">Exact Days to Goal</div>
        </div>
      </div>

      {/* 3. Category Selector Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  isActive
                    ? 'bg-slate-800 text-white border-slate-700 shadow-md'
                    : 'bg-slate-900/60 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.color || 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count != null && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Sub-filters & Controls (Shown for deal tabs, removed, and dockyard) */}
      {activeTab !== 'calculator' && (
        <div className="flex flex-col gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800 shadow-sm">
          {/* Top Row: Search Input + Sort Selector + Reset Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ships by name..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition"
              />
            </div>

            {/* Sort Selector & Reset */}
            <div className="flex items-center gap-2">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="tier-desc">Sort: Tier (High to Low)</option>
                <option value="tier-asc">Sort: Tier (Low to High)</option>
                <option value="price-asc">Sort: Price (Low to High)</option>
                <option value="price-desc">Sort: Price (High to Low)</option>
                <option value="name-asc">Sort: Name (A to Z)</option>
              </select>

              {(searchQuery.trim().length > 0 ||
                selectedTiers !== null ||
                selectedClasses !== null ||
                selectedNations !== null ||
                selectedSources !== null) && (
                <button
                  onClick={resetArmoryFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-500/30 transition"
                  title="Reset all sub-filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Rows: Tier, Class, Nation, Source */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs">
            {/* 1. Tier Filter */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
                Tier:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAllTiers}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedTiers === null
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={clearTiers}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedTiers !== null && selectedTiers.length === 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  None
                </button>
              </div>
              <div className="h-4 w-px bg-slate-800 mx-0.5" />
              <div className="flex items-center flex-wrap gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((t) => {
                  const isSel = selectedTiers !== null && selectedTiers.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTier(t)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {TIER_ROMAN[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Class Filter */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
                Class:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAllClasses}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedClasses === null
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={clearClasses}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedClasses !== null && selectedClasses.length === 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  None
                </button>
              </div>
              <div className="h-4 w-px bg-slate-800 mx-0.5" />
              <div className="flex items-center flex-wrap gap-1">
                {(['Destroyer', 'Cruiser', 'Battleship', 'AirCarrier', 'Submarine'] as ShipClass[]).map((cls) => {
                  const meta = CLASS_META[cls];
                  const isSel = selectedClasses !== null && selectedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      onClick={() => toggleShipClass(cls)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition border flex items-center gap-1 ${
                        isSel
                          ? `${meta.bg} ${meta.text} border-amber-500/40`
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold">{meta.abbr}</span>
                      <span className="text-[10px] opacity-75 hidden sm:inline">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Nation Filter */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
                Nation:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAllNations}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedNations === null
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={clearNations}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedNations !== null && selectedNations.length === 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  None
                </button>
              </div>
              <div className="h-4 w-px bg-slate-800 mx-0.5" />
              <div className="flex items-center flex-wrap gap-1">
                {Object.entries(NATION_LABELS).map(([nationKey, nationName]) => {
                  const isSel = selectedNations !== null && selectedNations.includes(nationKey);
                  return (
                    <button
                      key={nationKey}
                      onClick={() => toggleNation(nationKey)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition border ${
                        isSel
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {nationName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Source Filter */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
                Source:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAllSources}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedSources === null
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={clearSources}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                    selectedSources !== null && selectedSources.length === 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  None
                </button>
              </div>
              <div className="h-4 w-px bg-slate-800 mx-0.5" />
              <div className="flex items-center flex-wrap gap-1">
                {ARMORY_SOURCE_CONFIG.map((src) => {
                  const isSel = selectedSources !== null && selectedSources.includes(src.id);
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition border ${
                        isSel
                          ? `${src.color} shadow-sm font-semibold`
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {src.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab Content Views */}
      {/* Tab: Shortage Calculator */}
      {activeTab === 'calculator' && (
        <ShortageCalculator
          coalOffers={coalOffers}
          catalogMap={catalogMap}
          onNavigate={onNavigate}
        />
      )}

      {/* Tab: Removed Ships Hall of Fame */}
      {activeTab === 'removed' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-400" />
                <span>Removed Ships Hall of Fame (26 Ships)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exclusively dropped via Santa Crates & Supercontainers. Historical removal update versions, meta impact rationale, and previous prices.
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
              Santa Tier 1 (Extremely Rare)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleRemovedShips.map((ship) => {
              const classMeta = CLASS_META[ship.class] || {
                bg: 'bg-slate-800 border-slate-700',
                text: 'text-slate-300',
                abbr: '??',
              };
              const isSelected = selectedShipIds.includes(ship.shipId);

              return (
                <div
                  key={ship.shipId}
                  className="p-4 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3 shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {TIER_ROMAN[ship.tier]}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${classMeta.bg} ${classMeta.text}`}>
                          {classMeta.abbr}
                        </span>
                        <span className="text-[10px] font-mono uppercase text-slate-400">
                          {NATION_LABELS[ship.nation] || ship.nation}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleCompareShip(ship.shipId)}
                        className={`p-1 rounded transition ${
                          isSelected
                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Compare"
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <h4 className="text-base font-bold text-white tracking-tight">{ship.dispName}</h4>

                    <div className="p-2 rounded-lg bg-red-950/20 border border-red-500/20 space-y-1">
                      <div className="text-[11px] font-mono text-red-300 font-semibold flex items-center justify-between">
                        <span>Version {ship.removalVersion}</span>
                        <span className="text-[10px] text-red-400/90 font-normal">Removed from Direct Sale</span>
                      </div>
                      <p className="text-xs text-slate-300">{ship.removalReason}</p>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Previous Price:</span>
                        <span className="font-mono font-medium text-slate-200">
                          {ship.prevPrice ? `${ship.prevPrice.toLocaleString()} ${ship.prevCurrency}` : ship.prevCurrency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Current Acquisition:</span>
                        <span className="font-mono text-amber-400 text-[11px]">
                          Santa & Supercontainers
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                    <button
                      onClick={() => handleInspectShip(ship.dispName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                      <span>Inspect in Parameters</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Dockyard Archive */}
      {activeTab === 'dockyard' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Hammer className="w-5 h-5 text-orange-400" />
                <span>Dockyard Construction Archive (14 Campaigns)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete phase breakdown, starter pack Doubloon requirements, and mission completion phases across every historical WoWs dockyard.
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/40">
              14 Campaigns Documented
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleDockyards.map((dy) => {
              const classMeta = CLASS_META[dy.class] || {
                bg: 'bg-slate-800 border-slate-700',
                text: 'text-slate-300',
                abbr: '??',
              };
              const isSelected = selectedShipIds.includes(dy.shipId);
              const freePercent = Math.round((dy.freePhases / dy.totalPhases) * 100);

              return (
                <div
                  key={dy.shipId}
                  className="p-4 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3 shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {TIER_ROMAN[dy.tier]}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${classMeta.bg} ${classMeta.text}`}>
                          {classMeta.abbr}
                        </span>
                        <span className="text-[10px] font-mono uppercase text-slate-400">
                          {NATION_LABELS[dy.nation] || dy.nation}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleCompareShip(dy.shipId)}
                        className={`p-1 rounded transition ${
                          isSelected
                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Compare"
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <h4 className="text-base font-bold text-white tracking-tight">{dy.dispName}</h4>
                      <span className="text-xs font-mono text-slate-400">{dy.eventYear}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-orange-950/20 border border-orange-500/20 space-y-1">
                      <div className="text-[11px] font-mono text-orange-300 font-semibold flex items-center justify-between">
                        <span>Campaign: Update {dy.releaseVersion}</span>
                        <span className="text-[10px] text-orange-400/90">
                          Min {dy.minDoubloonsRequired.toLocaleString()} Doubloons
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{dy.notes}</p>
                    </div>

                    {/* Phase Progress Bar */}
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-slate-400">
                          {dy.freePhases} Free + {dy.starterPackPhases} Paid Phases
                        </span>
                        <span className="text-white font-bold">{dy.totalPhases} Total Phases</span>
                      </div>

                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${freePercent}%` }}
                          className="bg-emerald-500 transition-all duration-300"
                          title={`${dy.freePhases} Free Combat Mission Phases`}
                        />
                        <div
                          style={{ width: `${100 - freePercent}%` }}
                          className="bg-yellow-500 transition-all duration-300"
                          title={`${dy.starterPackPhases} Paid Starter Pack Phases`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Missions ({dy.freePhases})</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span>Doubloons ({dy.minDoubloonsRequired.toLocaleString()})</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                    <button
                      onClick={() => handleInspectShip(dy.dispName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                      <span>Inspect in Parameters</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Standard Deals Grid (All, Coal, Steel, Research Bureau, Doubloon) */}
      {activeTab !== 'calculator' && activeTab !== 'removed' && activeTab !== 'dockyard' && (
        <div>
          {visibleOffers.length === 0 ? (
            <div className="p-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
              <p className="text-sm font-semibold text-slate-300">No ship deals match your current filters</p>
              <p className="text-xs text-slate-500">Try adjusting your search query, tier, or class filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {visibleOffers.map((offer) => {
                const catalogShip = catalogMap.get(offer.shipId);

                return (
                  <ArmoryCard
                    key={`${offer.bundleId}_${offer.currency}`}
                    offer={offer}
                    catalogShip={catalogShip}
                    applyCoupon={globalApplyCoupons}
                    onNavigate={onNavigate}
                    onSelectAsTarget={handleSelectAsTarget}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
