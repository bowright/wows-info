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
  const activePreset = useShipStore((state) => state.activePreset);
  const applyCoupons = useShipStore((state) => state.applyCoupons);
  const activeBuild = useShipStore((state) => state.activeBuild);
  const getFilteredShips = useShipStore((state) => state.getFilteredShips);

  // Load catalog on mount if empty
  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

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

  // Retrieve filtered and modified ships
  const filteredShips = useMemo(() => {
    return getFilteredShips();
  }, [
    getFilteredShips,
    // Note: getFilteredShips is reactive to store state
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
    <div className="flex-1 flex flex-col space-y-4 max-w-[1700px] w-full mx-auto p-4 sm:p-6 pb-24">
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
