import React from 'react';
import {
  Search,
  X,
  RotateCcw,
  Tag,
  Copy,
  Layers,
  Shield,
  Crosshair,
  Flame,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { useShipStore } from '../../stores/useShipStore';
import type { ColumnPreset, ShipClass } from '../../types';

const NATIONS = [
  { id: 'usa', label: 'U.S.A.' },
  { id: 'japan', label: 'Japan' },
  { id: 'germany', label: 'Germany' },
  { id: 'ussr', label: 'U.S.S.R.' },
  { id: 'uk', label: 'U.K.' },
  { id: 'france', label: 'France' },
  { id: 'italy', label: 'Italy' },
  { id: 'pan_asia', label: 'Pan-Asia' },
  { id: 'europe', label: 'Europe' },
  { id: 'netherlands', label: 'Netherlands' },
  { id: 'commonwealth', label: 'Commonwealth' },
  { id: 'pan_america', label: 'Pan-America' },
  { id: 'spain', label: 'Spain' },
];

const TIERS = [
  { tier: 1, label: 'I' },
  { tier: 2, label: 'II' },
  { tier: 3, label: 'III' },
  { tier: 4, label: 'IV' },
  { tier: 5, label: 'V' },
  { tier: 6, label: 'VI' },
  { tier: 7, label: 'VII' },
  { tier: 8, label: 'VIII' },
  { tier: 9, label: 'IX' },
  { tier: 10, label: 'X' },
  { tier: 11, label: '★ XI' },
];

const SHIP_CLASSES: { id: ShipClass; label: string; abbr: string }[] = [
  { id: 'Destroyer', label: 'Destroyer', abbr: 'DD' },
  { id: 'Cruiser', label: 'Cruiser', abbr: 'CA/CL' },
  { id: 'Battleship', label: 'Battleship', abbr: 'BB' },
  { id: 'AirCarrier', label: 'Aircraft Carrier', abbr: 'CV' },
  { id: 'Submarine', label: 'Submarine', abbr: 'SS' },
];

const ACQUISITIONS = [
  { id: 'Coal', label: 'Coal', color: 'text-amber-400 border-amber-500/30' },
  { id: 'Steel', label: 'Steel', color: 'text-cyan-400 border-cyan-500/30' },
  { id: 'Doubloons', label: 'Doubloons', color: 'text-yellow-400 border-yellow-500/30' },
  { id: 'Research Bureau', label: 'Research Bureau', color: 'text-rose-400 border-rose-500/30' },
  { id: 'Dockyard', label: 'Dockyard', color: 'text-orange-400 border-orange-500/30' },
  { id: 'Tech Tree', label: 'Tech Tree', color: 'text-slate-300 border-slate-600' },
  { id: 'Removed', label: 'Removed / Santa', color: 'text-red-400 border-red-500/30' },
  { id: 'Clones', label: 'Clones / Replicas', color: 'text-purple-400 border-purple-500/30' },
];

const PRESETS: { id: ColumnPreset; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'survivability', label: 'Survivability', icon: Shield },
  { id: 'artillery', label: 'Artillery', icon: Crosshair },
  { id: 'secondary', label: 'Secondary', icon: Radio },
  { id: 'torpedoes', label: 'Torpedoes', icon: Flame },
  { id: 'aa', label: 'AA Defense', icon: Radio },
  { id: 'asw', label: 'ASW', icon: Layers },
  { id: 'all', label: 'All Columns', icon: Layers },
];

interface FilterBarProps {
  onOpenModifierDrawer: () => void;
  activeModifierCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onOpenModifierDrawer,
  activeModifierCount,
}) => {
  const searchQuery = useShipStore((state) => state.searchQuery);
  const setSearchQuery = useShipStore((state) => state.setSearchQuery);
  const selectedNations = useShipStore((state) => state.selectedNations);
  const toggleNation = useShipStore((state) => state.toggleNation);
  const selectAllNations = useShipStore((state) => state.selectAllNations);
  const clearNations = useShipStore((state) => state.clearNations);
  const selectedTiers = useShipStore((state) => state.selectedTiers);
  const toggleTier = useShipStore((state) => state.toggleTier);
  const selectAllTiers = useShipStore((state) => state.selectAllTiers);
  const clearTiers = useShipStore((state) => state.clearTiers);
  const selectedClasses = useShipStore((state) => state.selectedClasses);
  const toggleShipClass = useShipStore((state) => state.toggleShipClass);
  const selectAllClasses = useShipStore((state) => state.selectAllClasses);
  const clearClasses = useShipStore((state) => state.clearClasses);
  const selectedAcquisitions = useShipStore((state) => state.selectedAcquisitions);
  const toggleAcquisition = useShipStore((state) => state.toggleAcquisition);
  const selectAllAcquisitions = useShipStore((state) => state.selectAllAcquisitions);
  const clearAcquisitions = useShipStore((state) => state.clearAcquisitions);
  const applyCoupons = useShipStore((state) => state.applyCoupons);
  const toggleApplyCoupons = useShipStore((state) => state.toggleApplyCoupons);
  const hideClones = useShipStore((state) => state.hideClones);
  const toggleHideClones = useShipStore((state) => state.toggleHideClones);
  const useTopModules = useShipStore((state) => state.useTopModules);
  const toggleUseTopModules = useShipStore((state) => state.toggleUseTopModules);
  const activePreset = useShipStore((state) => state.activePreset);
  const setActivePreset = useShipStore((state) => state.setActivePreset);
  const resetFilters = useShipStore((state) => state.resetFilters);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedNations !== null ||
    selectedTiers !== null ||
    selectedClasses !== null ||
    selectedAcquisitions !== null ||
    hideClones ||
    !useTopModules ||
    applyCoupons;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
      {/* Top Row: Search, Preset Tabs, Modifier Drawer Button, Reset Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search ship by name, hull index, or tier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Preset Tabs */}
        <div className="flex items-center overflow-x-auto gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800 scrollbar-none">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePreset(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons: Modifiers & Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenModifierDrawer}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              activeModifierCount > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Build Modifiers</span>
            {activeModifierCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {activeModifierCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Tiers & Classes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
        {/* Tier Pills */}
        <div className="flex items-center flex-wrap gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1.5 w-12 shrink-0">
            Tier:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={selectAllTiers}
              className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
                selectedTiers === null
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={clearTiers}
              className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
                selectedTiers !== null && selectedTiers.length === 0
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              None
            </button>
          </div>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          {TIERS.map((t) => {
            const isSelected = selectedTiers !== null && selectedTiers.includes(t.tier);
            return (
              <button
                key={t.tier}
                onClick={() => toggleTier(t.tier)}
                className={`px-2 py-1 rounded text-xs font-mono font-medium border transition ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Class Pills */}
        <div className="flex items-center flex-wrap gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1.5 w-12 shrink-0">
            Class:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={selectAllClasses}
              className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
                selectedClasses === null
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={clearClasses}
              className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
                selectedClasses !== null && selectedClasses.length === 0
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              None
            </button>
          </div>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          {SHIP_CLASSES.map((c) => {
            const isSelected = selectedClasses !== null && selectedClasses.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleShipClass(c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="font-bold">{c.abbr}</span>
                <span className="text-[11px] text-slate-400 hidden xl:inline">({c.label})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Nations */}
      <div className="flex items-center flex-wrap gap-1 pt-1 border-t border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1.5 w-12 shrink-0">
          Nation:
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={selectAllNations}
            className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
              selectedNations === null
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            All
          </button>
          <button
            onClick={clearNations}
            className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
              selectedNations !== null && selectedNations.length === 0
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            None
          </button>
        </div>
        <div className="h-4 w-px bg-slate-800 mx-0.5" />
        {NATIONS.map((n) => {
          const isSelected = selectedNations !== null && selectedNations.includes(n.id);
          return (
            <button
              key={n.id}
              onClick={() => toggleNation(n.id)}
              className={`px-2 py-0.5 rounded text-xs font-medium border transition ${
                isSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {n.label}
            </button>
          );
        })}
      </div>

      {/* Row 4: Acquisition Sources & Toggles */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
        {/* Acquisition Source Pills */}
        <div className="flex items-center flex-wrap gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1.5 w-12 shrink-0">
            Source:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={selectAllAcquisitions}
              className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
                selectedAcquisitions === null
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={clearAcquisitions}
              className={`px-2 py-0.5 rounded text-xs font-medium transition border ${
                selectedAcquisitions !== null && selectedAcquisitions.length === 0
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              None
            </button>
          </div>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          {ACQUISITIONS.map((acq) => {
            const isSelected = selectedAcquisitions !== null && selectedAcquisitions.includes(acq.id);
            return (
              <button
                key={acq.id}
                onClick={() => toggleAcquisition(acq.id)}
                className={`px-2.5 py-0.5 rounded text-xs font-medium border transition ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : `bg-slate-950/40 ${acq.color} hover:bg-slate-800/50`
                }`}
              >
                {acq.label}
              </button>
            );
          })}
        </div>

        {/* Global Toggles */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* -25% Armory Coupons Toggle */}
          <button
            onClick={toggleApplyCoupons}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition ${
              applyCoupons
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/70 shadow-sm'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <Tag className={`w-3 h-3 ${applyCoupons ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>-25% Coupons</span>
            <span
              className={`w-2 h-2 rounded-full ${
                applyCoupons ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
          </button>

          {/* Hide Clones Toggle */}
          <button
            onClick={toggleHideClones}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition ${
              hideClones
                ? 'bg-purple-950/60 text-purple-300 border-purple-600/70 shadow-sm'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <Copy className={`w-3 h-3 ${hideClones ? 'text-purple-400' : 'text-slate-500'}`} />
            <span>Hide Clones</span>
            <span
              className={`w-2 h-2 rounded-full ${
                hideClones ? 'bg-purple-400' : 'bg-slate-600'
              }`}
            />
          </button>

          {/* Top vs Stock Modules Toggle */}
          <button
            onClick={toggleUseTopModules}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition ${
              useTopModules
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-600/70 shadow-sm'
                : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <Layers className={`w-3 h-3 ${useTopModules ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>{useTopModules ? 'Top Modules' : 'Stock Modules'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
