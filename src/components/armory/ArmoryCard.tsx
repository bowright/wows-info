import React, { useState } from 'react';
import type { ArmoryOffer, CompactShipCatalogItem } from '../../types';
import {
  Flame,
  Gem,
  Coins,
  Award,
  Sparkles,
  ExternalLink,
  CheckSquare,
  Square,
  Percent,
  Zap,
} from 'lucide-react';
import { useShipStore } from '../../stores/useShipStore';

interface ArmoryCardProps {
  offer: ArmoryOffer;
  catalogShip?: CompactShipCatalogItem;
  applyCoupon?: boolean;
  onNavigate: (path: string) => void;
  onSelectAsTarget?: (shipId: number) => void;
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

const CLASS_META: Record<string, { bg: string; text: string; abbr: string; label: string }> = {
  Destroyer: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', abbr: 'DD', label: 'Destroyer' },
  Cruiser: { bg: 'bg-cyan-500/15 border-cyan-500/30', text: 'text-cyan-400', abbr: 'CA', label: 'Cruiser' },
  Battleship: { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', abbr: 'BB', label: 'Battleship' },
  AirCarrier: { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', abbr: 'CV', label: 'Aircraft Carrier' },
  Submarine: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', abbr: 'SS', label: 'Submarine' },
};

const NATION_LABELS: Record<string, string> = {
  usa: 'U.S.A.',
  japan: 'Japan',
  germany: 'Germany',
  ussr: 'U.S.S.R.',
  uk: 'U.K.',
  france: 'France',
  italy: 'Italy',
  pan_asia: 'Pan-Asia',
  europe: 'Europe',
  netherlands: 'Netherlands',
  commonwealth: 'Commonwealth',
  pan_america: 'Pan-America',
  spain: 'Spain',
};

export const ArmoryCard: React.FC<ArmoryCardProps> = ({
  offer,
  catalogShip,
  applyCoupon = false,
  onNavigate,
  onSelectAsTarget,
}) => {
  const [imgError, setImgError] = useState(false);
  const selectedShipIds = useShipStore((state) => state.selectedShipIds);
  const toggleCompareShip = useShipStore((state) => state.toggleCompareShip);
  const resetFilters = useShipStore((state) => state.resetFilters);
  const setSearchQuery = useShipStore((state) => state.setSearchQuery);

  const isSelectedForCompare = selectedShipIds.includes(offer.shipId);

  // Derive ship metadata
  const shipClass = (catalogShip?.class || offer.shipClass) as string;
  const classInfo = CLASS_META[shipClass] || {
    bg: 'bg-slate-800 border-slate-700',
    text: 'text-slate-300',
    abbr: '??',
    label: shipClass,
  };

  const tier = catalogShip?.tier || offer.level || 10;
  const tierRoman = TIER_ROMAN[tier] || String(tier);
  const nationKey = (catalogShip?.nation || offer.nation || '').toLowerCase();
  const nationLabel = NATION_LABELS[nationKey] || nationKey.toUpperCase();
  const shipDisplayName = catalogShip?.dispName || offer.title;

  // Coupon and Pricing logic
  const isCouponEligible = offer.couponEligible;
  const isCouponActive = applyCoupon && isCouponEligible;
  const basePrice = offer.price;
  const effectivePrice = isCouponActive
    ? offer.couponPrice ?? Math.round(basePrice * 0.75)
    : basePrice;
  const discountAmount = isCouponActive ? basePrice - effectivePrice : 0;

  // Currency configuration
  const currency = offer.currency;
  let currencyLabel = 'Credits';
  let currencyIcon = Sparkles;
  let currencyColor = 'text-slate-300';

  if (currency === 'coal') {
    currencyLabel = 'Coal';
    currencyIcon = Flame;
    currencyColor = 'text-amber-400';
  } else if (currency === 'steel') {
    currencyLabel = 'Steel';
    currencyIcon = Gem;
    currencyColor = 'text-cyan-400';
  } else if (currency === 'gold') {
    currencyLabel = 'Doubloons';
    currencyIcon = Coins;
    currencyColor = 'text-yellow-400';
  } else if (currency === 'paragon_xp') {
    currencyLabel = 'Research Points';
    currencyIcon = Award;
    currencyColor = 'text-rose-400';
  } else if (currency.startsWith('eventum')) {
    currencyLabel = 'Event Tokens';
    currencyIcon = Sparkles;
    currencyColor = 'text-purple-400';
  }

  const CurrencyIconComp = currencyIcon;

  // Steel substitute max preview for Coal ships (1:10)
  const maxSteelSubstitute = currency === 'coal' ? Math.ceil(effectivePrice / 10) : null;

  const handleInspect = () => {
    resetFilters();
    setSearchQuery(shipDisplayName);
    onNavigate('/params');
  };

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCompareShip(offer.shipId);
  };

  // Image preview source from WG CDN with index fallback
  const shipIndex = catalogShip?.index || '';
  const imgSrc = shipIndex
    ? `https://glossary-wows-global.gcdn.co/icons/v1/ships/medium/${shipIndex}.png`
    : null;

  return (
    <div className="group relative flex flex-col justify-between bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-all duration-200 shadow-lg hover:shadow-2xl">
      {/* Top Header: Tier, Class, Nation & Compare Toggle */}
      <div className="p-3.5 pb-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30"
              title={`Tier ${tier}`}
            >
              {tierRoman}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${classInfo.bg} ${classInfo.text}`}
              title={classInfo.label}
            >
              {classInfo.abbr}
            </span>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {nationLabel}
            </span>
          </div>

          <button
            onClick={handleToggleCompare}
            className={`p-1 rounded transition ${
              isSelectedForCompare
                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-300 bg-slate-800/40 border border-transparent hover:border-slate-700'
            }`}
            title={isSelectedForCompare ? 'Remove from Compare' : 'Add to Compare'}
          >
            {isSelectedForCompare ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Ship Name & Title */}
        <h3 className="font-bold text-white text-base tracking-tight truncate group-hover:text-amber-300 transition-colors" title={shipDisplayName}>
          {shipDisplayName}
        </h3>
      </div>

      {/* Visual Ship Artwork / Silhouette */}
      <div className="relative h-28 w-full bg-gradient-to-b from-slate-950/40 to-slate-950/80 flex items-center justify-center px-4 overflow-hidden border-y border-slate-800/60">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={shipDisplayName}
            className="max-h-24 max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          /* Sleek Warship Silhouette Fallback */
          <div className="flex flex-col items-center justify-center opacity-30 group-hover:opacity-45 transition-opacity">
            <svg
              className="w-32 h-14 text-slate-400"
              viewBox="0 0 160 60"
              fill="currentColor"
            >
              {/* Hull and superstructure silhouette */}
              <path d="M 5,42 L 15,48 L 145,48 L 155,38 L 140,36 L 115,26 L 110,18 L 85,18 L 82,10 L 72,10 L 70,22 L 45,26 L 25,36 Z" />
              {/* Gun barrels */}
              <line x1="32" y1="28" x2="18" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="125" y1="28" x2="142" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              {/* Waterline */}
              <line x1="0" y1="52" x2="160" y2="52" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>
            <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-widest">
              {classInfo.abbr} · {nationLabel}
            </span>
          </div>
        )}

        {/* Coupon Ribbon Badge if active & eligible */}
        {isCouponActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
            <Percent className="w-2.5 h-2.5" />
            <span>-25%</span>
          </div>
        )}
      </div>

      {/* Pricing & Substitution Section */}
      <div className="p-3.5 space-y-3 bg-slate-900/60">
        <div className="flex items-baseline justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <CurrencyIconComp className={`w-3.5 h-3.5 ${currencyColor}`} />
              <span>{currencyLabel}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-bold font-mono ${isCouponActive ? 'text-emerald-400' : 'text-white'}`}>
                {effectivePrice.toLocaleString()}
              </span>

              {isCouponActive && (
                <span className="text-xs font-mono text-slate-500 line-through">
                  {basePrice.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Coupon discount amount indicator */}
          {isCouponActive && discountAmount > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-mono text-emerald-400/90 block">
                Save {discountAmount.toLocaleString()}
              </span>
            </div>
          )}

          {!isCouponEligible && currency === 'paragon_xp' && (
            <span className="text-[10px] text-slate-500 italic">No coupons</span>
          )}
        </div>

        {/* Steel Substitution Preview on Coal ships */}
        {currency === 'coal' && maxSteelSubstitute != null && (
          <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-between text-[11px]">
            <span className="text-cyan-300/80 flex items-center gap-1">
              <Gem className="w-3 h-3 text-cyan-400" />
              <span>Steel substitute:</span>
            </span>
            <span className="font-mono font-medium text-cyan-300">
              ≤ {maxSteelSubstitute.toLocaleString()}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-1 flex items-center gap-2">
          <button
            onClick={handleInspect}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 transition"
            title="Inspect armor, artillery, consumables, and ballistics in Parameters"
          >
            <ExternalLink className="w-3 h-3 text-slate-400" />
            <span>Parameters</span>
          </button>

          {currency === 'coal' && onSelectAsTarget && (
            <button
              onClick={() => onSelectAsTarget(offer.shipId)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1"
              title="Plan shortage & daily time to earn in Resource Planner"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Plan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
