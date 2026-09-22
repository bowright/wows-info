import React from 'react';
import { GitCompare, X, Trash2, ArrowRight } from 'lucide-react';
import { useShipStore } from '../../stores/useShipStore';

interface CompareBarProps {
  onNavigateToCompare: () => void;
}

export const CompareBar: React.FC<CompareBarProps> = ({ onNavigateToCompare }) => {
  const ships = useShipStore((state) => state.ships);
  const selectedShipIds = useShipStore((state) => state.selectedShipIds);
  const toggleCompareShip = useShipStore((state) => state.toggleCompareShip);
  const clearCompare = useShipStore((state) => state.clearCompare);

  if (selectedShipIds.length === 0) return null;

  // Resolve selected ship items
  const selectedShips = selectedShipIds
    .map((id) => ships.find((s) => s.id === id))
    .filter(Boolean);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl bg-slate-900/95 backdrop-blur-md border border-amber-500/40 shadow-2xl rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
      {/* Left: Summary & Selected Ship Chips */}
      <div className="flex items-center gap-3 overflow-x-auto w-full sm:w-auto scrollbar-none py-0.5">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
            <GitCompare className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white whitespace-nowrap">
            {selectedShipIds.length} {selectedShipIds.length === 1 ? 'Ship' : 'Ships'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {selectedShips.map((ship) => {
            if (!ship) return null;
            return (
              <div
                key={ship.id}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-slate-200 shrink-0"
              >
                <span className="font-mono text-amber-400 font-bold text-[10px]">
                  T{ship.tier}
                </span>
                <span className="max-w-[120px] truncate font-medium">{ship.dispName}</span>
                <button
                  onClick={() => toggleCompareShip(ship.id)}
                  className="p-0.5 text-slate-400 hover:text-rose-400 transition"
                  title={`Remove ${ship.dispName}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
        <button
          onClick={clearCompare}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>

        <button
          onClick={onNavigateToCompare}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition"
        >
          <span>Compare Matrix</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
