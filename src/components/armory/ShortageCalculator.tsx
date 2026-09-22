import React, { useMemo, useState } from 'react';
import type { ArmoryOffer, CompactShipCatalogItem, ShortageCalculationResult } from '../../types';
import { useArmoryStore } from '../../stores/useArmoryStore';
import { useShipStore } from '../../stores/useShipStore';
import {
  Flame,
  Gem,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Percent,
  Search,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';

interface ShortageCalculatorProps {
  coalOffers: ArmoryOffer[];
  catalogMap: Map<number, CompactShipCatalogItem>;
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

export const ShortageCalculator: React.FC<ShortageCalculatorProps> = ({
  coalOffers,
  catalogMap,
  onNavigate,
}) => {
  const userCoal = useArmoryStore((state) => state.userCoal);
  const userSteel = useArmoryStore((state) => state.userSteel);
  const dailyCoalRate = useArmoryStore((state) => state.dailyCoalRate);
  const setUserCoal = useArmoryStore((state) => state.setUserCoal);
  const setUserSteel = useArmoryStore((state) => state.setUserSteel);
  const setDailyCoalRate = useArmoryStore((state) => state.setDailyCoalRate);

  const globalApplyCoupons = useArmoryStore((state) => state.globalApplyCoupons);
  const toggleGlobalApplyCoupons = useArmoryStore((state) => state.toggleGlobalApplyCoupons);

  const affordabilityFilter = useArmoryStore((state) => state.affordabilityFilter);
  const setAffordabilityFilter = useArmoryStore((state) => state.setAffordabilityFilter);

  const selectedTargetShipId = useArmoryStore((state) => state.selectedTargetShipId);
  const setSelectedTargetShipId = useArmoryStore((state) => state.setSelectedTargetShipId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [calcSort, setCalcSort] = useState<'days-asc' | 'shortage-asc' | 'price-asc' | 'tier-desc'>('days-asc');

  const resetFilters = useShipStore((state) => state.resetFilters);
  const setSearchInShipStore = useShipStore((state) => state.setSearchQuery);

  // Compute total purchasing power in Coal
  const steelEquivalentCoal = userSteel * 10;
  const totalCoalPower = userCoal + steelEquivalentCoal;

  // Calculate affordability matrix across all Coal offers
  const calculatedResults: ShortageCalculationResult[] = useMemo(() => {
    return coalOffers.map((offer) => {
      const ship = catalogMap.get(offer.shipId);
      const isCouponApplied = globalApplyCoupons && offer.couponEligible;
      const effectiveCoalPrice = isCouponApplied
        ? offer.couponPrice ?? Math.round(offer.price * 0.75)
        : offer.price;

      // 1. Pure Coal purchase
      const canAffordPureCoal = userCoal >= effectiveCoalPrice;
      const pureCoalRemaining = canAffordPureCoal ? userCoal - effectiveCoalPrice : 0;
      const pureCoalShortage = canAffordPureCoal ? 0 : effectiveCoalPrice - userCoal;
      const daysToGoalPureCoal =
        pureCoalShortage > 0 ? Math.ceil(pureCoalShortage / dailyCoalRate) : 0;

      // 2. Steel substitution (1:10)
      const steelNeededToCover = pureCoalShortage > 0 ? Math.ceil(pureCoalShortage / 10) : 0;
      const canAffordWithSteel =
        canAffordPureCoal || (pureCoalShortage > 0 && userSteel >= steelNeededToCover);
      const steelRemainingAfterCover = canAffordWithSteel
        ? userSteel - steelNeededToCover
        : 0;

      // Remaining shortage if user converts all current steel
      const remainingCoalShortageWithSteel = Math.max(
        0,
        effectiveCoalPrice - (userCoal + userSteel * 10)
      );
      const effectiveSteelShortage = Math.ceil(remainingCoalShortageWithSteel / 10);
      const daysToGoalWithSteel =
        remainingCoalShortageWithSteel > 0
          ? Math.ceil(remainingCoalShortageWithSteel / dailyCoalRate)
          : 0;

      return {
        offer,
        ship,
        effectiveCoalPrice,
        isCouponApplied,
        canAffordPureCoal,
        pureCoalRemaining,
        pureCoalShortage,
        steelNeededToCover,
        canAffordWithSteel,
        steelRemainingAfterCover,
        effectiveSteelShortage,
        remainingCoalShortageWithSteel,
        daysToGoalPureCoal,
        daysToGoalWithSteel,
      };
    });
  }, [coalOffers, catalogMap, userCoal, userSteel, dailyCoalRate, globalApplyCoupons]);

  // Overall counts for summary pills
  const counts = useMemo(() => {
    let pureCount = 0;
    let steelCount = 0;
    let shortageCount = 0;

    for (const r of calculatedResults) {
      if (r.canAffordPureCoal) {
        pureCount++;
      } else if (r.canAffordWithSteel) {
        steelCount++;
      } else {
        shortageCount++;
      }
    }

    return {
      all: calculatedResults.length,
      coal: pureCount,
      steel: steelCount,
      shortage: shortageCount,
    };
  }, [calculatedResults]);

  // Selected Target ship result
  const targetResult = useMemo(() => {
    if (!selectedTargetShipId) {
      // Default to first unaffordable ship or first ship
      return calculatedResults.find((r) => !r.canAffordPureCoal) || calculatedResults[0];
    }
    return (
      calculatedResults.find((r) => r.offer.shipId === selectedTargetShipId) ||
      calculatedResults[0]
    );
  }, [calculatedResults, selectedTargetShipId]);

  // Filtered and sorted results for the list/grid
  const visibleResults = useMemo(() => {
    let list = calculatedResults;

    // Affordability Filter
    if (affordabilityFilter === 'coal') {
      list = list.filter((r) => r.canAffordPureCoal);
    } else if (affordabilityFilter === 'steel') {
      list = list.filter((r) => !r.canAffordPureCoal && r.canAffordWithSteel);
    } else if (affordabilityFilter === 'shortage') {
      list = list.filter((r) => !r.canAffordWithSteel);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const title = r.offer.title.toLowerCase();
        const disp = r.ship?.dispName?.toLowerCase() || '';
        return title.includes(q) || disp.includes(q);
      });
    }

    // Tier Filter
    if (selectedTier != null) {
      list = list.filter((r) => (r.ship?.tier || r.offer.level) === selectedTier);
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (calcSort === 'days-asc') {
        return a.daysToGoalWithSteel - b.daysToGoalWithSteel;
      }
      if (calcSort === 'shortage-asc') {
        return a.remainingCoalShortageWithSteel - b.remainingCoalShortageWithSteel;
      }
      if (calcSort === 'price-asc') {
        return a.effectiveCoalPrice - b.effectiveCoalPrice;
      }
      if (calcSort === 'tier-desc') {
        const tierA = a.ship?.tier || a.offer.level;
        const tierB = b.ship?.tier || b.offer.level;
        return tierB - tierA;
      }
      return 0;
    });
  }, [calculatedResults, affordabilityFilter, searchQuery, selectedTier, calcSort]);

  const handleInspect = (shipName: string) => {
    resetFilters();
    setSearchInShipStore(shipName);
    onNavigate('/params');
  };

  const formatDaysText = (days: number) => {
    if (days === 0) return 'Ready to purchase';
    if (days === 1) return '1 day';
    if (days < 30) return `${days} days (~${Math.round((days / 7) * 10) / 10} wks)`;
    const months = Math.round((days / 30) * 10) / 10;
    return `${days} days (~${months} mos)`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Interactive User Balance Controller & Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span>Coal & Steel Resource Balances</span>
            </h2>
            <p className="text-xs text-slate-400">
              Input your current resources to calculate pure Coal affordability and automatic 1:10 Steel substitution.
            </p>
          </div>

          {/* Global Coupon Switch */}
          <button
            onClick={toggleGlobalApplyCoupons}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              globalApplyCoupons
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Apply -25% Armory Coupon</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                globalApplyCoupons ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {globalApplyCoupons ? 'ACTIVE' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Resource Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Coal Input */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                <span>Current Coal</span>
              </label>
              <button
                onClick={() => setUserCoal(0)}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={userCoal || ''}
                onChange={(e) => setUserCoal(parseInt(e.target.value || '0', 10))}
                className="w-full bg-slate-900 border border-amber-500/30 focus:border-amber-400 rounded-lg px-3 py-2 text-lg font-mono font-bold text-white focus:outline-none"
                placeholder="0"
              />
              <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400 pointer-events-none">
                Coal
              </span>
            </div>

            {/* Quick Increment Buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              {[10000, 25000, 50000].map((inc) => (
                <button
                  key={inc}
                  onClick={() => setUserCoal(userCoal + inc)}
                  className="px-2 py-1 rounded text-[10px] font-mono bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition"
                >
                  +{inc / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Steel Input */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-cyan-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                <Gem className="w-4 h-4" />
                <span>Current Steel</span>
              </label>
              <button
                onClick={() => setUserSteel(0)}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="500"
                value={userSteel || ''}
                onChange={(e) => setUserSteel(parseInt(e.target.value || '0', 10))}
                className="w-full bg-slate-900 border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-3 py-2 text-lg font-mono font-bold text-white focus:outline-none"
                placeholder="0"
              />
              <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400 pointer-events-none">
                Steel
              </span>
            </div>

            {/* Quick Increment Buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              {[1000, 2500, 5000].map((inc) => (
                <button
                  key={inc}
                  onClick={() => setUserSteel(userSteel + inc)}
                  className="px-2 py-1 rounded text-[10px] font-mono bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition"
                >
                  +{inc / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Daily Collection Rate */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Daily Coal Earning Rate</span>
              </label>
            </div>

            <div className="relative">
              <input
                type="number"
                min="100"
                step="100"
                value={dailyCoalRate || ''}
                onChange={(e) => setDailyCoalRate(parseInt(e.target.value || '1200', 10))}
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-3 py-2 text-lg font-mono font-bold text-white focus:outline-none"
                placeholder="1200"
              />
              <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400 pointer-events-none">
                Coal/day
              </span>
            </div>

            {/* Preset Rates */}
            <div className="flex items-center gap-1.5 pt-1">
              {[
                { label: 'Casual (800)', val: 800 },
                { label: '3x Boxes (1,200)', val: 1200 },
                { label: 'Active (1,600)', val: 1600 },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => setDailyCoalRate(p.val)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition border ${
                    dailyCoalRate === p.val
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Combined Purchasing Power Summary Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-cyan-950/30 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Total Combined Purchasing Power (1 Steel = 10 Coal)</div>
              <div className="text-2xl font-bold font-mono text-white flex items-center gap-2">
                <span>{totalCoalPower.toLocaleString()}</span>
                <span className="text-xs font-normal text-slate-400">Coal Equivalent</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {userCoal.toLocaleString()} Coal + ({userSteel.toLocaleString()} Steel × 10 = {steelEquivalentCoal.toLocaleString()} Coal)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-400">Affordability Status</div>
              <div className="text-sm font-bold text-white font-mono">
                <span className="text-emerald-400">{counts.coal}</span> Pure Coal ·{' '}
                <span className="text-cyan-400">+{counts.steel}</span> with Steel
              </div>
              <div className="text-[11px] text-slate-500">
                {counts.coal + counts.steel} of {counts.all} Coal ships affordable
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Target Ship Detailed Focus Panel */}
      {targetResult && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Tier {TIER_ROMAN[targetResult.ship?.tier || targetResult.offer.level]}
              </span>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{targetResult.ship?.dispName || targetResult.offer.title}</span>
                  <span className="text-xs font-normal text-slate-400">
                    ({targetResult.ship?.class || targetResult.offer.shipClass})
                  </span>
                </h3>
                <span className="text-xs text-slate-400">
                  Target Ship Resource & Shortage Breakdown
                </span>
              </div>
            </div>

            <button
              onClick={() =>
                handleInspect(targetResult.ship?.dispName || targetResult.offer.title)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Inspect in Parameters</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Target Price */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Ship Cost</span>
                {targetResult.isCouponApplied && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    -25% Coupon
                  </span>
                )}
              </div>
              <div className="text-xl font-bold font-mono text-white flex items-baseline gap-2">
                <span>{targetResult.effectiveCoalPrice.toLocaleString()}</span>
                <span className="text-xs text-amber-400">Coal</span>
              </div>
              {targetResult.isCouponApplied && (
                <div className="text-[11px] font-mono text-slate-500 line-through">
                  Base: {targetResult.offer.price.toLocaleString()} Coal
                </div>
              )}
            </div>

            {/* Pure Coal Assessment */}
            <div
              className={`p-3.5 rounded-xl border space-y-1 ${
                targetResult.canAffordPureCoal
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
              }`}
            >
              <div className="text-xs font-medium flex items-center justify-between">
                <span>Pure Coal Status</span>
                {targetResult.canAffordPureCoal ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="text-xl font-bold font-mono">
                {targetResult.canAffordPureCoal ? (
                  <span>Leftover: +{targetResult.pureCoalRemaining.toLocaleString()}</span>
                ) : (
                  <span>Short: {targetResult.pureCoalShortage.toLocaleString()}</span>
                )}
              </div>
              <div className="text-[11px] font-mono opacity-80">
                {targetResult.canAffordPureCoal
                  ? 'Fully affordable with current Coal'
                  : `Requires ~${formatDaysText(targetResult.daysToGoalPureCoal)} at current rate`}
              </div>
            </div>

            {/* Steel Substitution Assessment */}
            <div
              className={`p-3.5 rounded-xl border space-y-1 ${
                targetResult.canAffordWithSteel
                  ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="text-xs font-medium flex items-center justify-between">
                <span>Steel Substitution (1:10)</span>
                <Gem className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl font-bold font-mono">
                {targetResult.canAffordPureCoal ? (
                  <span className="text-slate-400 text-base">0 Steel needed</span>
                ) : targetResult.canAffordWithSteel ? (
                  <span>Use {targetResult.steelNeededToCover.toLocaleString()} Steel</span>
                ) : (
                  <span>Still Short: {targetResult.remainingCoalShortageWithSteel.toLocaleString()}</span>
                )}
              </div>
              <div className="text-[11px] font-mono opacity-80">
                {targetResult.canAffordPureCoal
                  ? 'No Steel required'
                  : targetResult.canAffordWithSteel
                  ? `Leaves ${targetResult.steelRemainingAfterCover.toLocaleString()} Steel remaining`
                  : `Even with all Steel, need ${targetResult.effectiveSteelShortage.toLocaleString()} more Steel`}
              </div>
            </div>

            {/* Time Estimation */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Time to Earn</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {targetResult.canAffordWithSteel ? (
                  <span className="text-emerald-400">Ready Now</span>
                ) : (
                  <span>{formatDaysText(targetResult.daysToGoalWithSteel)}</span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {targetResult.canAffordWithSteel
                  ? 'Can purchase immediately with Steel'
                  : `Based on ${dailyCoalRate.toLocaleString()} Coal/day containers`}
              </div>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Goal Progress ({targetResult.effectiveCoalPrice.toLocaleString()} Coal)</span>
              <span>
                {Math.min(
                  100,
                  Math.round(
                    ((userCoal +
                      (targetResult.canAffordWithSteel
                        ? targetResult.steelNeededToCover * 10
                        : steelEquivalentCoal)) /
                      targetResult.effectiveCoalPrice) *
                      100
                  )
                )}
                % covered
              </span>
            </div>

            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
              {/* Current Coal segment */}
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (userCoal / targetResult.effectiveCoalPrice) * 100
                  )}%`,
                }}
                className="bg-amber-500 transition-all duration-300"
                title={`Coal: ${userCoal.toLocaleString()}`}
              />
              {/* Steel substitution segment */}
              {!targetResult.canAffordPureCoal && (
                <div
                  style={{
                    width: `${Math.min(
                      100 - (userCoal / targetResult.effectiveCoalPrice) * 100,
                      ((targetResult.canAffordWithSteel
                        ? targetResult.steelNeededToCover * 10
                        : steelEquivalentCoal) /
                        targetResult.effectiveCoalPrice) *
                        100
                    )}%`,
                  }}
                  className="bg-cyan-500 transition-all duration-300"
                  title="Steel substitution (1:10)"
                />
              )}
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Current Coal</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span>Steel Substitution (1:10)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span>Remaining Shortage</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sub-filter & Affordability Category Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Coal Ships', count: counts.all },
              { id: 'coal', label: 'Affordable (Coal only)', count: counts.coal, color: 'text-emerald-400' },
              { id: 'steel', label: 'Affordable (with Steel)', count: counts.steel, color: 'text-cyan-400' },
              { id: 'shortage', label: 'Remaining Shortage', count: counts.shortage, color: 'text-rose-400' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAffordabilityFilter(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  affordabilityFilter === tab.id
                    ? 'bg-amber-500/20 text-white border-amber-500/40 shadow'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 ${
                    tab.color || 'text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Controls: Search, Tier, and Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Coal ships..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            {/* Tier filter pill buttons */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              {[5, 6, 7, 8, 9, 10].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTier(selectedTier === t ? null : t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                    selectedTier === t
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {TIER_ROMAN[t]}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <select
              value={calcSort}
              onChange={(e) => setCalcSort(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="days-asc">Sort: Days to Goal (Soonest)</option>
              <option value="shortage-asc">Sort: Lowest Shortage</option>
              <option value="price-asc">Sort: Price (Low to High)</option>
              <option value="tier-desc">Sort: Tier (High to Low)</option>
            </select>
          </div>
        </div>

        {/* 4. Filtered List of Coal Ships */}
        {visibleResults.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
            <p className="text-sm font-semibold text-slate-300">No Coal ships match current filters</p>
            <p className="text-xs text-slate-500">Try selecting a different affordability tab or clearing search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleResults.map((item) => {
              const shipName = item.ship?.dispName || item.offer.title;
              const tierRoman = TIER_ROMAN[item.ship?.tier || item.offer.level] || 'X';
              const isSelected = targetResult?.offer.shipId === item.offer.shipId;

              return (
                <div
                  key={item.offer.bundleId}
                  onClick={() => setSelectedTargetShipId(item.offer.shipId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-slate-900 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {tierRoman}
                        </span>
                        <span className="text-[10px] font-mono uppercase text-slate-400">
                          {item.ship?.class || item.offer.shipClass} · {item.ship?.nation || item.offer.nation}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm tracking-tight truncate max-w-[220px]" title={shipName}>
                        {shipName}
                      </h4>
                    </div>

                    {/* Affordability Badge */}
                    <div>
                      {item.canAffordPureCoal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Coal Ready</span>
                        </span>
                      ) : item.canAffordWithSteel ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          <Gem className="w-3 h-3" />
                          <span>With Steel</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <Clock className="w-3 h-3" />
                          <span>~{item.daysToGoalWithSteel}d</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing and Shortage Details */}
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Price:</span>
                      <span className="font-mono font-semibold text-white">
                        {item.effectiveCoalPrice.toLocaleString()} Coal
                        {item.isCouponApplied && (
                          <span className="text-[10px] text-emerald-400 ml-1">(-25%)</span>
                        )}
                      </span>
                    </div>

                    {!item.canAffordPureCoal && (
                      <div className="flex items-center justify-between text-amber-400/90">
                        <span>Coal Shortage:</span>
                        <span className="font-mono font-bold">
                          {item.pureCoalShortage.toLocaleString()} Coal
                        </span>
                      </div>
                    )}

                    {!item.canAffordPureCoal && item.canAffordWithSteel && (
                      <div className="flex items-center justify-between text-cyan-400">
                        <span>Steel Needed:</span>
                        <span className="font-mono font-semibold">
                          {item.steelNeededToCover.toLocaleString()} Steel
                        </span>
                      </div>
                    )}

                    {!item.canAffordWithSteel && (
                      <div className="flex items-center justify-between text-rose-400">
                        <span>Remaining Shortage:</span>
                        <span className="font-mono font-semibold">
                          {item.remainingCoalShortageWithSteel.toLocaleString()} Coal
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Target Selection */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {item.canAffordWithSteel ? 'Ready to buy' : `Est: ${formatDaysText(item.daysToGoalWithSteel)}`}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspect(shipName);
                      }}
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Parameters</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
