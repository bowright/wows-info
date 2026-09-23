import React, { useState, useEffect, useMemo } from 'react';
import { useShipStore } from '../stores/useShipStore';
import { FilterBar } from '../components/filters/FilterBar';
import { VirtualizedTable } from '../components/table/VirtualizedTable';
import { BuildModifierDrawer } from '../components/modifiers/BuildModifierDrawer';
import { CompareBar } from '../components/compare/CompareBar';
import { Loader2, AlertCircle } from 'lucide-react';

interface ShipParametersViewProps {
  onNavigate: (path: string) => void;
}

export const ShipParametersView: React.FC<ShipParametersViewProps> = ({ onNavigate }) => {
  const [isModifierDrawerOpen, setIsModifierDrawerOpen] = useState(false);

  const fetchCatalog = useShipStore((state) => state.fetchCatalog);
  const ships = useShipStore((state) => state.ships);
  const isLoading = useShipStore((state) => state.isLoading);
  const error = useShipStore((state) => state.error);
  const searchQuery = useShipStore((state) => state.searchQuery);
  const selectedNations = useShipStore((state) => state.selectedNations);
  const selectedTiers = useShipStore((state) => state.selectedTiers);
  const selectedClasses = useShipStore((state) => state.selectedClasses);
  const selectedAcquisitions = useShipStore((state) => state.selectedAcquisitions);
  const hideClones = useShipStore((state) => state.hideClones);
  const useTopModules = useShipStore((state) => state.useTopModules);
  const activePreset = useShipStore((state) => state.activePreset);
  const applyCoupons = useShipStore((state) => state.applyCoupons);
  const activeBuild = useShipStore((state) => state.activeBuild);
  const getFilteredShips = useShipStore((state) => state.getFilteredShips);

  // Load catalog on mount if empty & parse URL query params
  useEffect(() => {
    fetchCatalog();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('p') || params.get('preset');
      const presetMap: Record<string, any> = {
        GEN: 'general',
        general: 'general',
        SRV: 'survivability',
        survivability: 'survivability',
        DIV: 'diving',
        diving: 'diving',
        MB: 'artillery',
        artillery: 'artillery',
        AP: 'ap_shells',
        ap_shells: 'ap_shells',
        HE: 'he_shells',
        he_shells: 'he_shells',
        SAP: 'sap_shells',
        sap_shells: 'sap_shells',
        SEC: 'secondary',
        secondary: 'secondary',
        SON: 'sonar',
        sonar: 'sonar',
        TORP: 'torpedoes',
        torpedoes: 'torpedoes',
        AA: 'aa',
        aa: 'aa',
        ASW: 'asw',
        asw: 'asw',
        AS: 'airstrike',
        airstrike: 'airstrike',
        ATT: 'attack_aircraft',
        attack_aircraft: 'attack_aircraft',
        TB: 'torpedo_bombers',
        torpedo_bombers: 'torpedo_bombers',
        DB: 'bombers',
        bombers: 'bombers',
        SB: 'skip_bombers',
        skip_bombers: 'skip_bombers',
        CON: 'consumables',
        consumables: 'consumables',
        CI: 'combat_instructions',
        combat_instructions: 'combat_instructions',
        IS: 'innate',
        innate: 'innate',
        all: 'all',
      };
      if (p && presetMap[p]) {
        useShipStore.getState().setActivePreset(presetMap[p]);
      }

      const ty = params.get('ty');
      if (ty) {
        const classMap: Record<string, string> = {
          C: 'Cruiser',
          D: 'Destroyer',
          B: 'Battleship',
          A: 'AirCarrier',
          S: 'Submarine',
        };
        if (classMap[ty]) {
          useShipStore.setState({ selectedClasses: [classMap[ty]] });
        }
      }

      const t = params.get('t');
      if (t) {
        const tierNum = parseInt(t, 10);
        if (!isNaN(tierNum)) {
          useShipStore.setState({ selectedTiers: [tierNum] });
        }
      }
    }
  }, [fetchCatalog]);

  // Sync active preset changes to URL search param (?p=CODE)
  useEffect(() => {
    if (typeof window !== 'undefined' && activePreset) {
      const presetToCode: Record<string, string> = {
        general: 'GEN',
        survivability: 'SRV',
        diving: 'DIV',
        artillery: 'MB',
        ap_shells: 'AP',
        he_shells: 'HE',
        sap_shells: 'SAP',
        secondary: 'SEC',
        sonar: 'SON',
        torpedoes: 'TORP',
        aa: 'AA',
        asw: 'ASW',
        airstrike: 'AS',
        attack_aircraft: 'ATT',
        torpedo_bombers: 'TB',
        bombers: 'DB',
        skip_bombers: 'SB',
        consumables: 'CON',
        combat_instructions: 'CI',
        innate: 'IS',
        all: 'all',
      };
      const code = presetToCode[activePreset] || activePreset;
      const url = new URL(window.location.href);
      if (url.searchParams.get('p') !== code) {
        url.searchParams.set('p', code);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [activePreset]);

  // Compute active modifiers count
  const activeModifierCount = useMemo(() => {
    let count = 0;
    if (activeBuild.upgrades) {
      count += Object.values(activeBuild.upgrades).filter(Boolean).length;
    }
    if (activeBuild.skills) {
      for (const [k, v] of Object.entries(activeBuild.skills)) {
        if (k !== 'hpLostPercent' && Boolean(v)) count++;
      }
    }
    if (activeBuild.signals) {
      count += Object.values(activeBuild.signals).filter(Boolean).length;
    }
    return count;
  }, [activeBuild]);

  // Retrieve filtered and modified ships reactively
  const filteredShips = useMemo(() => {
    return getFilteredShips();
  }, [
    getFilteredShips,
    ships,
    searchQuery,
    selectedNations,
    selectedTiers,
    selectedClasses,
    selectedAcquisitions,
    hideClones,
    useTopModules,
    activeBuild,
  ]);

  if (isLoading && ships.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">Loading Ship Catalog...</p>
          <p className="text-xs text-slate-500">Preparing 993 ships and ballistic matrix</p>
        </div>
      </div>
    );
  }

  if (error && ships.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-rose-300">Failed to load ship catalog</p>
          <p className="text-xs text-slate-500">{error}</p>
          <button
            onClick={() => fetchCatalog()}
            className="mt-3 px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-4 w-full px-4 lg:px-6 py-4 pb-24">
      {/* Filter Controls Bar */}
      <FilterBar
        onOpenModifierDrawer={() => setIsModifierDrawerOpen(true)}
        activeModifierCount={activeModifierCount}
      />

      {/* Virtualized Parameter Matrix Table */}
      <VirtualizedTable
        data={filteredShips}
        activePreset={activePreset}
        applyCoupons={applyCoupons}
      />

      {/* Build Modifier Drawer */}
      <BuildModifierDrawer
        isOpen={isModifierDrawerOpen}
        onClose={() => setIsModifierDrawerOpen(false)}
      />

      {/* Floating Compare Dock */}
      <CompareBar onNavigateToCompare={() => onNavigate('/compare')} />
    </div>
  );
};
