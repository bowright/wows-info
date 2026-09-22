import React from 'react';
import { useShipStore } from '../stores/useShipStore';
import { GitCompare, ArrowLeft, Trash2 } from 'lucide-react';
import { AcquisitionBadge } from '../components/common/AcquisitionBadge';

interface ShipCompareViewProps {
  onNavigate: (path: string) => void;
}

export const ShipCompareView: React.FC<ShipCompareViewProps> = ({ onNavigate }) => {
  const ships = useShipStore((state) => state.ships);
  const selectedShipIds = useShipStore((state) => state.selectedShipIds);
  const toggleCompareShip = useShipStore((state) => state.toggleCompareShip);
  const clearCompare = useShipStore((state) => state.clearCompare);
  const applyCoupons = useShipStore((state) => state.applyCoupons);

  const selectedShips = selectedShipIds
    .map((id) => ships.find((s) => s.id === id))
    .filter(Boolean);

  if (selectedShips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-xl mx-auto text-center space-y-4">
        <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
          <GitCompare className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">No Ships Selected for Comparison</h2>
          <p className="text-xs text-slate-400 mt-1">
            Navigate back to the Parameters Matrix and check the boxes beside any ships to compare their survivability, firepower, and acquisition costs side-by-side.
          </p>
        </div>
        <button
          onClick={() => onNavigate('/params')}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Parameters</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/params')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Matrix</span>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-amber-400" />
              Ship Comparison Matrix
            </h1>
            <p className="text-xs text-slate-400">
              Comparing {selectedShips.length} selected warships
            </p>
          </div>
        </div>

        <button
          onClick={clearCompare}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-800/40 rounded-lg transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Comparison</span>
        </button>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {selectedShips.map((ship) => {
          if (!ship) return null;
          return (
            <div
              key={ship.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4 relative flex flex-col justify-between"
            >
              {/* Remove button */}
              <button
                onClick={() => toggleCompareShip(ship.id)}
                className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition"
                title="Remove ship"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Identity */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    T{ship.tier}
                  </span>
                  <span className="text-xs font-mono uppercase text-slate-400">
                    {ship.nation} • {ship.class}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1.5 truncate">
                  {ship.dispName}
                </h3>
                <div className="mt-2">
                  <AcquisitionBadge
                    acquisition={ship.acquisition}
                    applyCoupons={applyCoupons}
                  />
                </div>
              </div>

              {/* Stats Table */}
              <div className="space-y-2 border-t border-slate-800 pt-3 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 font-sans">Hit Points:</span>
                  <span className="font-bold text-slate-100">{ship.health.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 font-sans">Max Speed:</span>
                  <span className="text-slate-200">{ship.speed} kts</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 font-sans">Rudder Shift:</span>
                  <span className="text-slate-200">{ship.rudderTime}s</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 font-sans">Surface Detect:</span>
                  <span className="text-slate-200">{ship.concealmentSurface ? `${ship.concealmentSurface} km` : '—'}</span>
                </div>

                {ship.artillery && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 font-sans">Artillery:</span>
                      <span className="text-amber-300">
                        {ship.artillery.totalBarrels}x{ship.artillery.caliberMm}mm
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 font-sans">Gun Reload:</span>
                      <span className="text-slate-200">{ship.artillery.reload}s</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 font-sans">Firing Range:</span>
                      <span className="text-slate-200">{ship.artillery.rangeKm} km</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 font-sans">HE / AP DPM:</span>
                      <span className="text-slate-200">
                        {ship.artillery.heDpm.toLocaleString()} / {ship.artillery.apDpm.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}

                {ship.torpedoes && (
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 font-sans">Torpedoes:</span>
                    <span className="text-cyan-300">
                      {ship.torpedoes.rangeKm}km @ {ship.torpedoes.speed}kts
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
