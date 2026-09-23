import React, { useState } from 'react';
import type { CompactShipCatalogItem } from '../../types';
import {
  Gem,
  Coins,
  Flame,
  Award,
  Hammer,
  Layers,
  Ban,
  Copy,
  Info,
} from 'lucide-react';

interface AcquisitionBadgeProps {
  acquisition?: CompactShipCatalogItem['acquisition'] | null;
  applyCoupons?: boolean;
}

const formatCompact = (val: number | null | undefined): string => {
  if (val == null) return '';
  if (val >= 1000) {
    const k = val / 1000;
    return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return val.toLocaleString();
};

export const AcquisitionBadge: React.FC<AcquisitionBadgeProps> = ({
  acquisition,
  applyCoupons = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!acquisition) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        Tech Tree
      </span>
    );
  }

  const {
    category,
    categories,
    status,
    primaryCurrency,
    price,
    basePrice,
    couponEligible,
    couponPrice,
    steelEquivalent,
    secondaryCurrency,
    secondaryPrice,
    secondaryBasePrice,
    secondaryCouponEligible,
    secondaryCouponPrice,
    minDoubloonsRequired,
    totalPhases,
    isClone,
    obtainMethodText,
    availabilityNote,
    rarity,
  } = acquisition;

  const isDualCoalDoubloon =
    category === 'Coal / Doubloon' ||
    (categories?.includes('Coal') && categories?.includes('Doubloon')) ||
    (primaryCurrency === 'coal' && secondaryCurrency === 'gold');

  // Compute effective price based on coupon toggle
  const effectivePrice =
    applyCoupons && couponEligible
      ? couponPrice ?? (price != null ? Math.round(price * 0.75) : null)
      : price;

  const effectiveSecondaryPrice =
    applyCoupons && secondaryCouponEligible
      ? secondaryCouponPrice ?? (secondaryPrice != null ? Math.round(secondaryPrice * 0.75) : null)
      : secondaryPrice;

  const formattedEffectivePrice =
    effectivePrice != null ? effectivePrice.toLocaleString() : null;
  const formattedBasePrice =
    (basePrice ?? price) != null ? (basePrice ?? price)!.toLocaleString() : null;
  const formattedCouponPrice =
    couponPrice != null
      ? couponPrice.toLocaleString()
      : price != null
      ? Math.round(price * 0.75).toLocaleString()
      : null;

  const formattedSecondaryBasePrice =
    (secondaryBasePrice ?? secondaryPrice) != null ? (secondaryBasePrice ?? secondaryPrice)!.toLocaleString() : null;
  const formattedSecondaryCouponPrice =
    secondaryCouponPrice != null
      ? secondaryCouponPrice.toLocaleString()
      : secondaryPrice != null
      ? Math.round(secondaryPrice * 0.75).toLocaleString()
      : null;

  // Custom visual styles by category
  let badgeClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let IconComponent = Layers;
  let label: string = category || 'Tech Tree';

  if (isClone) {
    badgeClasses = 'bg-purple-950/80 text-purple-300 border-purple-800/80 hover:bg-purple-900/90';
    IconComponent = Copy;
    label = 'Clone / Replica';
  } else if (isDualCoalDoubloon) {
    badgeClasses = 'bg-gradient-to-r from-amber-950/90 to-yellow-950/90 text-amber-200 border-amber-600/80 hover:border-amber-400';
    IconComponent = Flame;
    label =
      effectivePrice != null && effectiveSecondaryPrice != null
        ? `${formatCompact(effectivePrice)} Coal / ${formatCompact(effectiveSecondaryPrice)} Doub`
        : 'Coal / Doubloon';
  } else if (category === 'Coal') {
    badgeClasses = 'bg-amber-950/80 text-amber-300 border-amber-800/80 hover:bg-amber-900/90';
    IconComponent = Flame;
    label = formattedEffectivePrice ? `${formattedEffectivePrice} Coal` : 'Coal';
  } else if (category === 'Steel') {
    badgeClasses = 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80 hover:bg-cyan-900/90';
    IconComponent = Gem;
    label = formattedEffectivePrice ? `${formattedEffectivePrice} Steel` : 'Steel';
  } else if (category === 'Doubloon' || (category as string) === 'Doubloons') {
    badgeClasses = 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80 hover:bg-yellow-900/90';
    IconComponent = Coins;
    label = formattedEffectivePrice ? `${formattedEffectivePrice} Doub` : 'Doubloon';
  } else if (category === 'Research Bureau') {
    badgeClasses = 'bg-rose-950/80 text-rose-300 border-rose-800/80 hover:bg-rose-900/90';
    IconComponent = Award;
    label = formattedEffectivePrice ? `${formattedEffectivePrice} RP` : 'Research Bureau';
  } else if (category === 'Dockyard') {
    badgeClasses = 'bg-orange-950/80 text-orange-300 border-orange-800/80 hover:bg-orange-900/90';
    IconComponent = Hammer;
    const doubMin = minDoubloonsRequired ?? price;
    label = doubMin ? `Dockyard (${doubMin.toLocaleString()} Doub)` : 'Dockyard Event';
  } else if (category === 'Removed') {
    badgeClasses = 'bg-red-950/90 text-red-300 border-red-800/90 hover:bg-red-900/90';
    IconComponent = Ban;
    label = 'Removed / Santa';
  } else if (category === 'Tech Tree') {
    badgeClasses = 'bg-slate-800 text-slate-300 border-slate-700';
    IconComponent = Layers;
    label = formattedBasePrice && primaryCurrency === 'credits'
      ? `${(Number(basePrice || price) / 1000000).toFixed(1)}M Credits`
      : 'Tech Tree';
  } else if (category === 'Black Friday' || category === 'Collaboration') {
    badgeClasses = 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
    IconComponent = Award;
    label = category;
  } else if (category === 'Clan/Ranked Reward') {
    badgeClasses = 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
    IconComponent = Award;
    label = 'Reward Ship';
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-sans font-medium border cursor-help transition select-text ${badgeClasses}`}
      >
        {isDualCoalDoubloon ? (
          <span className="flex items-center gap-0.5 shrink-0">
            <Flame className="w-3 h-3 text-amber-400" />
            <Coins className="w-3 h-3 text-yellow-400" />
          </span>
        ) : (
          <IconComponent className="w-3 h-3 shrink-0" />
        )}
        <span className="truncate max-w-[155px]" title={label}>{label}</span>
      </span>

      {/* Popover / Tooltip */}
      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-1.5 z-50 w-72 p-3 bg-slate-900 text-slate-100 rounded-lg shadow-2xl border border-slate-700 text-xs pointer-events-none">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
            <span className="font-semibold text-white flex items-center gap-1.5">
              {isDualCoalDoubloon ? (
                <>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Coal or Doubloons</span>
                </>
              ) : (
                <>
                  <IconComponent className="w-3.5 h-3.5 text-amber-400" />
                  <span>{category}</span>
                </>
              )}
            </span>
            {status && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {/* Dual Coal + Doubloon Price Information */}
            {isDualCoalDoubloon ? (
              <div className="space-y-1 text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" /> Coal Base:
                  </span>
                  <span className="font-mono font-medium text-amber-300">
                    {formattedBasePrice} COAL
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-yellow-400" /> Doubloons:
                  </span>
                  <span className="font-mono font-medium text-yellow-300">
                    {formattedSecondaryBasePrice} DOUB
                  </span>
                </div>

                {couponEligible && (
                  <div className="pt-1 border-t border-slate-800 text-[11px] space-y-0.5 text-emerald-400">
                    <div className="font-medium text-emerald-300 flex items-center gap-1">
                      <span>-25% Armory Coupons:</span>
                    </div>
                    <div className="flex justify-between pl-2 font-mono">
                      <span className="text-slate-400">Coal:</span>
                      <span className="font-bold">{formattedCouponPrice} COAL</span>
                    </div>
                    <div className="flex justify-between pl-2 font-mono">
                      <span className="text-slate-400">Doubloons:</span>
                      <span className="font-bold">{formattedSecondaryCouponPrice} DOUB</span>
                    </div>
                  </div>
                )}

                {steelEquivalent != null && (
                  <div className="flex items-center justify-between text-cyan-300 text-[11px] pt-0.5">
                    <span>1:10 Steel Substitution:</span>
                    <span className="font-mono font-semibold">
                      {steelEquivalent.toLocaleString()} Steel
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Single Price Information */}
                {price != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Base Price:</span>
                    <span className="font-mono font-medium text-slate-200">
                      {formattedBasePrice} {primaryCurrency.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Coupon Information */}
                {couponEligible && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="flex items-center gap-1">
                      <span>-25% Armory Coupon:</span>
                    </span>
                    <span className="font-mono font-bold">
                      {formattedCouponPrice} {primaryCurrency.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Steel to Coal substitution */}
                {category === 'Coal' && steelEquivalent != null && (
                  <div className="flex items-center justify-between text-cyan-300 text-[11px] pt-0.5">
                    <span>1:10 Steel Substitution:</span>
                    <span className="font-mono font-semibold">
                      {steelEquivalent.toLocaleString()} Steel
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Dockyard details */}
            {category === 'Dockyard' && (
              <div className="text-[11px] text-orange-300/90 pt-0.5 space-y-0.5">
                {minDoubloonsRequired != null && (
                  <p>Minimum starter packs: {minDoubloonsRequired.toLocaleString()} Doubloons</p>
                )}
                {totalPhases != null && <p>Shipyard Phases: {totalPhases}</p>}
              </div>
            )}

            {/* Historical Note */}
            {availabilityNote && (
              <div className="pt-1.5 mt-1 border-t border-slate-800 text-slate-300 text-[11px] flex gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-snug">{availabilityNote}</p>
              </div>
            )}

            {/* Obtain Method */}
            {obtainMethodText && !availabilityNote && (
              <div className="pt-1 text-slate-400 text-[11px]">
                {obtainMethodText}
              </div>
            )}

            {/* Rarity */}
            {rarity && (
              <div className="pt-1 text-rose-300 text-[10px] font-medium uppercase tracking-wide">
                Rarity: {rarity}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
