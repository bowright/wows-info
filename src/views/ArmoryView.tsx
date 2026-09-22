import React from 'react';
import { ShoppingBag, ArrowLeft, Flame, Gem, Coins, Award } from 'lucide-react';

interface ArmoryViewProps {
  onNavigate: (path: string) => void;
}

export const ArmoryView: React.FC<ArmoryViewProps> = ({ onNavigate }) => {
  return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
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
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              Acquisition Center & Resource Planner
            </h1>
            <p className="text-xs text-slate-400">
              Live WG Armory Pricing, 25% Coupon Calculator & Steel-to-Coal Converter
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
            <Flame className="w-4 h-4" />
            Coal Ships
          </div>
          <div className="text-2xl font-bold text-white font-mono">35</div>
          <div className="text-[11px] text-slate-400">Coupon eligible (-25%)</div>
        </div>

        <div className="bg-slate-900 border border-cyan-500/30 p-4 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
            <Gem className="w-4 h-4" />
            Steel Ships
          </div>
          <div className="text-2xl font-bold text-white font-mono">21</div>
          <div className="text-[11px] text-slate-400">1:10 Steel substitution</div>
        </div>

        <div className="bg-slate-900 border border-yellow-500/30 p-4 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold text-xs">
            <Coins className="w-4 h-4" />
            Doubloon Deals
          </div>
          <div className="text-2xl font-bold text-white font-mono">104</div>
          <div className="text-[11px] text-slate-400">Active Armory offers</div>
        </div>

        <div className="bg-slate-900 border border-rose-500/30 p-4 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
            <Award className="w-4 h-4" />
            Research Bureau
          </div>
          <div className="text-2xl font-bold text-white font-mono">19</div>
          <div className="text-[11px] text-slate-400">Reset points catalog</div>
        </div>
      </div>

      <div className="p-8 rounded-xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
          Phase 4 Deliverable
        </span>
        <h2 className="text-base font-bold text-white">Full Armory & Shortage Calculator Center</h2>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          The acquisition center with real-time Armory bundle cards, Steel-to-Coal shortage converter, and Santa container rarity tracker will be fully expanded in Phase 4.
        </p>
      </div>
    </div>
  );
};
