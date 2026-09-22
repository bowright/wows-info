import React from 'react';
import { BarChart3, ArrowLeft } from 'lucide-react';

interface ServerStatsViewProps {
  onNavigate: (path: string) => void;
}

export const ServerStatsView: React.FC<ServerStatsViewProps> = ({ onNavigate }) => {
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
              <BarChart3 className="w-5 h-5 text-amber-400" />
              Server Statistics & Meta Performance
            </h1>
            <p className="text-xs text-slate-400">
              EU, NA, and Asia battle-weighted win rates, average damage & PR benchmarks
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 rounded-xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
          Phase 5 Deliverable
        </span>
        <h2 className="text-base font-bold text-white">Precomputed Regional Server Statistics</h2>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          The 12 precomputed server statistics chunks in <code className="text-amber-400">public/data/stats/</code> (EU, NA, Asia across 1-week, 2-week, 4-week, and all-time spans) will be connected to interactive ranking charts and PR formulas in Phase 5.
        </p>
      </div>
    </div>
  );
};
