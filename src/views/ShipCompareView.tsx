import React, { useState } from 'react';
import { useShipStore } from '../stores/useShipStore';
import {
  GitCompare,
  ArrowLeft,
  Trash2,
  Plus,
  Search,
  X,
  Shield,
  Crosshair,
  Flame,
  Wind,
  Eye,
  ShoppingBag,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AcquisitionBadge } from '../components/common/AcquisitionBadge';
import { BallisticsChart } from '../components/ballistics/BallisticsChart';
import type { CompactShipCatalogItem } from '../types';
import {
  COMPARISON_CATEGORIES,
  SHIP_PALETTE,
  computeAdvantage,
  MetricRowDef,
} from '../utils/comparisonMatrix';

export { COMPARISON_CATEGORIES, SHIP_PALETTE };

interface ShipCompareViewProps {
  onNavigate: (path: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingBag,
  Shield,
  Crosshair,
  Flame,
  Wind,
  Sliders,
  Eye,
};

const PRESETS = [
  {
    name: 'Yamato vs Iowa vs Montana',
    shipNames: ['Yamato', 'Iowa', 'Montana'],
  },
  {
    name: 'Des Moines vs Worcester vs Minotaur',
    shipNames: ['Des Moines', 'Worcester', 'Minotaur'],
  },
  {
    name: 'Shimakaze vs Gearing vs Daring',
    shipNames: ['Shimakaze', 'Gearing', 'Daring'],
  },
  {
    name: 'Bismarck vs Tirpitz vs Richelieu',
    shipNames: ['Bismarck', 'Tirpitz', 'Richelieu'],
  },
];

export const ShipCompareView: React.FC<ShipCompareViewProps> = ({ onNavigate }) => {
  const ships = useShipStore((state) => state.ships);
  const selectedShipIds = useShipStore((state) => state.selectedShipIds);
  const toggleCompareShip = useShipStore((state) => state.toggleCompareShip);
  const clearCompare = useShipStore((state) => state.clearCompare);
  const applyCoupons = useShipStore((state) => state.applyCoupons);

  const [searchPickerQuery, setSearchPickerQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const selectedShips = selectedShipIds
    .map((id) => ships.find((s) => s.id === id))
    .filter((s): s is CompactShipCatalogItem => Boolean(s))
    .slice(0, 4); // Limit to maximum 4 ships side-by-side

  const handleApplyPreset = (presetNames: string[]) => {
    clearCompare();
    for (const name of presetNames) {
      const match = ships.find(
        (s) => s.dispName.toLowerCase() === name.toLowerCase() || s.name.toLowerCase().includes(name.toLowerCase())
      );
      if (match) {
        toggleCompareShip(match.id);
      }
    }
  };

  const handleAddShip = (shipId: number) => {
    if (selectedShips.length < 4 && !selectedShipIds.includes(shipId)) {
      toggleCompareShip(shipId);
    }
    setShowPicker(false);
    setSearchPickerQuery('');
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Helper to determine advantage styling for row values
  const getAdvantageBadgeClass = (row: MetricRowDef, val: any, shipValues: any[]) => {
    const adv = computeAdvantage(row, val, shipValues);
    if (adv === 'best') {
      return 'text-emerald-300 font-bold bg-emerald-950/70 border border-emerald-700/60 px-2 py-0.5 rounded shadow-sm';
    }
    if (adv === 'worst') {
      return 'text-rose-300 bg-rose-950/50 border border-rose-900/40 px-2 py-0.5 rounded';
    }
    return 'text-slate-200';
  };

  // Filter ships for quick picker
  const filteredPickerShips = searchPickerQuery.trim()
    ? ships
        .filter(
          (s) =>
            !selectedShipIds.includes(s.id) &&
            (s.dispName.toLowerCase().includes(searchPickerQuery.toLowerCase()) ||
              s.name.toLowerCase().includes(searchPickerQuery.toLowerCase()) ||
              s.nation.toLowerCase().includes(searchPickerQuery.toLowerCase()))
        )
        .slice(0, 10)
    : ships.filter((s) => !selectedShipIds.includes(s.id)).slice(0, 8);

  // If 0 ships selected
  if (selectedShips.length === 0) {
    return (
      <div className="flex-1 max-w-4xl mx-auto p-6 sm:p-12 space-y-8 animate-fade-in">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <GitCompare className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Enhanced Ship Duel & Comparison Matrix</h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1.5 leading-relaxed">
              Compare 2 to 4 warships side-by-side with dynamic Krupp AP penetration ballistics curves, comparative performance heatmaps, and acquisition costs.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Or Launch a Duel Preset:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset.shipNames)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/40 transition"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => onNavigate('/params')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Browse Parameters Matrix</span>
            </button>
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Select Ships to Compare</span>
            </button>
          </div>
        </div>

        {/* Modal Ship Picker */}
        {showPicker && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-400" />
                  Select Warships to Compare
                </h3>
                <button
                  onClick={() => setShowPicker(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchPickerQuery}
                  onChange={(e) => setSearchPickerQuery(e.target.value)}
                  placeholder="Search ship name, tier, nation..."
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {filteredPickerShips.map((ship) => (
                  <div
                    key={ship.id}
                    onClick={() => handleAddShip(ship.id)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 hover:bg-amber-500/10 border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        T{ship.tier}
                      </span>
                      <span className="text-xs font-bold text-white">{ship.dispName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ship.nation} • {ship.class}
                      </span>
                    </div>
                    <Plus className="w-4 h-4 text-amber-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Top Header Bar */}
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
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-amber-400" />
              Ship Duel & Comparison Matrix
            </h1>
            <p className="text-xs text-slate-400">
              Comparing {selectedShips.length} warship{selectedShips.length > 1 ? 's' : ''} (up to 4 vessels)
            </p>
          </div>
        </div>

        {/* Actions: Add Ship, Presets, Clear */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedShips.length < 4 && (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Ship ({selectedShips.length}/4)</span>
            </button>
          )}

          <button
            onClick={clearCompare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-800/40 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Matrix</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
        <span className="shrink-0 text-[11px] font-mono uppercase text-slate-400">Duel Presets:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handleApplyPreset(preset.shipNames)}
            className="shrink-0 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[11px] transition"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* SVG AP Ballistics & Trajectory Overlay Chart */}
      <BallisticsChart ships={selectedShips} />

      {/* Side-by-Side Ship Identity Cards */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${selectedShips.length + (selectedShips.length < 4 ? 1 : 0)}, minmax(0, 1fr))`,
        }}
      >
        {selectedShips.map((ship, idx) => {
          const color = SHIP_PALETTE[idx % SHIP_PALETTE.length];
          return (
            <div
              key={ship.id}
              className="bg-slate-900/90 border rounded-xl p-4 relative space-y-3 shadow-lg"
              style={{ borderColor: `${color}60` }}
            >
              {/* Color Header Stripe */}
              <div
                className="h-1 -mt-4 -mx-4 rounded-t-xl"
                style={{ backgroundColor: color }}
              />

              {/* Close / Remove button */}
              <button
                onClick={() => toggleCompareShip(ship.id)}
                className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition"
                title={`Remove ${ship.dispName}`}
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold font-mono px-2 py-0.5 rounded border"
                    style={{
                      color: color,
                      borderColor: `${color}40`,
                      backgroundColor: `${color}15`,
                    }}
                  >
                    T{ship.tier}
                  </span>
                  <span className="text-[11px] font-mono uppercase text-slate-400">
                    {ship.nation} • {ship.class}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1.5 truncate" title={ship.dispName}>
                  {ship.dispName}
                </h3>
              </div>

              <div>
                <AcquisitionBadge
                  acquisition={ship.acquisition}
                  applyCoupons={applyCoupons}
                />
              </div>
            </div>
          );
        })}

        {/* Empty slot inviting to add another ship */}
        {selectedShips.length < 4 && (
          <div
            onClick={() => setShowPicker(true)}
            className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-950/40 hover:bg-slate-900/40 transition group space-y-2 min-h-[140px]"
          >
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 group-hover:border-amber-500/40 flex items-center justify-center text-slate-500 group-hover:text-amber-400 transition">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200">
              Add Ship to Compare ({selectedShips.length}/4)
            </span>
          </div>
        )}
      </div>

      {/* Comprehensive Comparative Parameter Matrix Table */}
      <div className="space-y-4">
        {COMPARISON_CATEGORIES.map((category) => {
          const isCollapsed = collapsedCategories[category.id];
          const Icon = CATEGORY_ICONS[category.iconName] || Shield;

          return (
            <div
              key={category.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-md"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950/60 hover:bg-slate-950 border-b border-slate-800 text-left transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded bg-amber-500/10 text-amber-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {category.title}
                  </span>
                </div>
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Rows */}
              {!isCollapsed && (
                <div className="divide-y divide-slate-800/60">
                  {category.rows.map((row) => {
                    const values = selectedShips.map((s) => row.getValue(s));

                    return (
                      <div
                        key={row.id}
                        className="grid py-2.5 px-4 text-xs items-center hover:bg-slate-800/30 transition"
                        style={{
                          gridTemplateColumns: `240px repeat(${selectedShips.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {/* Metric Label */}
                        <div className="text-slate-400 font-medium pr-2">
                          <span>{row.label}</span>
                          {row.unit && <span className="text-[10px] text-slate-500 ml-1">({row.unit})</span>}
                        </div>

                        {/* Ship Values */}
                        {selectedShips.map((ship) => {
                          const val = row.getValue(ship);
                          const formatted = row.format ? row.format(val) : val !== null && val !== undefined ? String(val) : '—';
                          const highlightClass = getAdvantageBadgeClass(row, val, values);

                          return (
                            <div key={ship.id} className="font-mono text-center sm:text-left pr-2">
                              <span className={`inline-block ${highlightClass}`}>
                                {formatted}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Ship Picker */}
      {showPicker && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                Add Ship to Comparison Matrix ({selectedShips.length}/4)
              </h3>
              <button
                onClick={() => setShowPicker(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchPickerQuery}
                onChange={(e) => setSearchPickerQuery(e.target.value)}
                placeholder="Search ship name, tier, nation..."
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredPickerShips.map((ship) => (
                <div
                  key={ship.id}
                  onClick={() => handleAddShip(ship.id)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 hover:bg-amber-500/10 border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      T{ship.tier}
                    </span>
                    <span className="text-xs font-bold text-white">{ship.dispName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {ship.nation} • {ship.class}
                    </span>
                  </div>
                  <Plus className="w-4 h-4 text-amber-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
