import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ConsumableItem } from '../../types';

interface TooltipPosition {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

interface ConsumableIconCellProps {
  consumable?: ConsumableItem | null;
}

export const ConsumableIconCell: React.FC<ConsumableIconCellProps> = ({ consumable }) => {
  const tooltipAnchorRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

  if (!consumable) {
    return <span className="text-slate-600 font-mono">—</span>;
  }

  const iconSrc = consumable.iconKey
    ? `/images/consumables/${consumable.iconKey}`
    : `/images/consumables/consumable_${consumable.key}.png`;

  const isInfinite = consumable.numConsumables < 0 || consumable.lifeCycleType === 1;
  const charges = consumable.numConsumables;

  // Extra metric highlights
  const healPct =
    consumable.type === 'regenCrew' && consumable.logic?.regenerationHPSpeed
      ? (consumable.workTime * consumable.logic.regenerationHPSpeed * 100).toFixed(1)
      : null;

  const detectShipKm =
    (consumable.type === 'rls' || consumable.type === 'sonar' || consumable.type === 'submarineLocator') &&
    consumable.logic?.distShip
      ? (consumable.logic.distShip * 0.03).toFixed(1)
      : null;

  const detectTorpKm =
    consumable.type === 'sonar' && consumable.logic?.distTorpedo
      ? (consumable.logic.distTorpedo * 0.03).toFixed(1)
      : null;

  const smokeDisp =
    consumable.type === 'smokeGenerator' && consumable.logic?.lifeTime
      ? `${consumable.logic.lifeTime}s`
      : null;

  const smokeRad =
    consumable.type === 'smokeGenerator' && consumable.logic?.radius
      ? `${Math.round(consumable.logic.radius * 30)}m`
      : null;

  const speedBoost =
    consumable.type === 'speedBoosters' && consumable.logic?.boostCoeff
      ? `+${Math.round(consumable.logic.boostCoeff * 100)}%`
      : null;

  const reloadBoost =
    consumable.type === 'artilleryBoosters' && consumable.logic?.boostCoeff
      ? `${Math.round((consumable.logic.boostCoeff - 1) * 100)}%`
      : null;

  const titleFallback = `${consumable.name} (${isInfinite ? '∞' : charges + ' charges'}) | Action: ${consumable.workTime}s | Reload: ${consumable.reloadTime}s`;

  const showTooltip = () => {
    const bounds = tooltipAnchorRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const width = 256;
    const aboveSpace = bounds.top - 12;
    const belowSpace = window.innerHeight - bounds.bottom - 12;
    const showAbove = aboveSpace > belowSpace;
    const left = Math.max(8, Math.min(bounds.left + (bounds.width - width) / 2, window.innerWidth - width - 8));
    const position = showAbove
      ? { left, bottom: window.innerHeight - bounds.top + 6, maxHeight: Math.max(120, aboveSpace - 8) }
      : { left, top: bounds.bottom + 6, maxHeight: Math.max(120, belowSpace - 8) };

    setTooltipPosition(position);
  };

  return (
    <div
      ref={tooltipAnchorRef}
      className="inline-flex items-center justify-center select-none"
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltipPosition(null)}
      title={titleFallback}
    >
      <div className="relative w-7 h-7 flex items-center justify-center rounded bg-slate-800/90 border border-slate-700/80 hover:border-amber-400/70 p-0.5 transition shadow-sm group">
        <img
          src={iconSrc}
          alt={consumable.name}
          className="w-full h-full object-contain pointer-events-none"
          loading="lazy"
        />
        {!isInfinite && charges > 0 && (
          <span className="absolute -bottom-1 -right-1 bg-slate-950/95 text-amber-300 font-mono font-bold text-[9px] px-1 rounded border border-slate-700/90 leading-tight shadow">
            {charges}
          </span>
        )}
      </div>

      {/* Styled Rich Tooltip */}
      {tooltipPosition && createPortal(
        <div
          className="fixed z-[100] w-64 overflow-y-auto p-3 rounded-lg bg-slate-900 text-slate-100 shadow-2xl border border-slate-700 text-xs pointer-events-none whitespace-normal"
          style={{
            left: tooltipPosition.left,
            top: tooltipPosition.top,
            bottom: tooltipPosition.bottom,
            maxHeight: tooltipPosition.maxHeight,
          }}
        >
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-800">
            <img src={iconSrc} alt="" className="w-6 h-6 object-contain shrink-0" />
            <div className="overflow-hidden">
              <div className="font-semibold text-amber-300 truncate">{consumable.name}</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {consumable.slot.replace('AbilitySlot', 'Slot ')} • {consumable.type}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[11px] mb-2 font-mono bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
            <div>
              <span className="text-slate-400">Action:</span>{' '}
              <span className="text-slate-200 font-bold">{consumable.workTime}s</span>
            </div>
            <div>
              <span className="text-slate-400">Reload:</span>{' '}
              <span className="text-slate-200 font-bold">{consumable.reloadTime}s</span>
            </div>
            <div>
              <span className="text-slate-400">Charges:</span>{' '}
              <span className="text-amber-300 font-bold">{isInfinite ? '∞' : charges}</span>
            </div>
            {detectShipKm && (
              <div>
                <span className="text-slate-400">Ship det.:</span>{' '}
                <span className="text-emerald-400 font-bold">{detectShipKm} km</span>
              </div>
            )}
            {detectTorpKm && (
              <div>
                <span className="text-slate-400">Torp det.:</span>{' '}
                <span className="text-cyan-400 font-bold">{detectTorpKm} km</span>
              </div>
            )}
            {healPct && (
              <div>
                <span className="text-slate-400">Heal HP:</span>{' '}
                <span className="text-emerald-400 font-bold">{healPct}%</span>
              </div>
            )}
            {smokeDisp && (
              <div>
                <span className="text-slate-400">Dispersion:</span>{' '}
                <span className="text-slate-200 font-bold">{smokeDisp}</span>
              </div>
            )}
            {smokeRad && (
              <div>
                <span className="text-slate-400">Radius:</span>{' '}
                <span className="text-slate-200 font-bold">{smokeRad}</span>
              </div>
            )}
            {speedBoost && (
              <div>
                <span className="text-slate-400">Speed:</span>{' '}
                <span className="text-emerald-400 font-bold">{speedBoost}</span>
              </div>
            )}
            {reloadBoost && (
              <div>
                <span className="text-slate-400">Reload:</span>{' '}
                <span className="text-emerald-400 font-bold">{reloadBoost}</span>
              </div>
            )}
          </div>

          {consumable.description && (
            <p className="text-[10px] text-slate-400 leading-relaxed italic line-clamp-3">
              {consumable.description}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
