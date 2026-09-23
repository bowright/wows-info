import React, { useState, useEffect, useRef } from 'react';
import type { CompactShipCatalogItem, ShipDetailData, BallisticsPoint } from '../../types';
import { Crosshair, ShieldAlert, Zap, Timer, Compass } from 'lucide-react';

interface BallisticsChartProps {
  ships: CompactShipCatalogItem[];
}

export const SHIP_PALETTE = [
  '#f59e0b', // Amber (Ship 1)
  '#06b6d4', // Cyan (Ship 2)
  '#10b981', // Emerald (Ship 3)
  '#c084fc', // Purple (Ship 4)
];

type MetricType = 'penetration' | 'flightTime' | 'impactVelocity' | 'impactAngle';

const METRIC_CONFIGS: Record<
  MetricType,
  {
    label: string;
    unit: string;
    maxY: number;
    ticks: number[];
    icon: React.ComponentType<{ className?: string }>;
    getValue: (pt: BallisticsPoint) => number;
  }
> = {
  penetration: {
    label: 'Krupp AP Penetration',
    unit: 'mm',
    maxY: 1000,
    ticks: [0, 200, 400, 600, 800, 1000],
    icon: ShieldAlert,
    getValue: (pt) => pt.penetration,
  },
  flightTime: {
    label: 'Shell Flight Time',
    unit: 's',
    maxY: 20,
    ticks: [0, 5, 10, 15, 20],
    icon: Timer,
    getValue: (pt) => pt.flightTime,
  },
  impactVelocity: {
    label: 'Impact Velocity',
    unit: 'm/s',
    maxY: 1000,
    ticks: [0, 200, 400, 600, 800, 1000],
    icon: Zap,
    getValue: (pt) => pt.impactVelocity,
  },
  impactAngle: {
    label: 'Impact Angle',
    unit: '°',
    maxY: 60,
    ticks: [0, 15, 30, 45, 60],
    icon: Compass,
    getValue: (pt) => pt.impactAngleDeg,
  },
};

// Cache loaded ship details in memory across renders
const detailsCache = new Map<number, ShipDetailData>();

export const BallisticsChart: React.FC<BallisticsChartProps> = ({ ships }) => {
  const [details, setDetails] = useState<Record<number, ShipDetailData>>({});
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('penetration');
  const [hoverDist, setHoverDist] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDetails() {
      const missingShips = ships.filter((s) => !detailsCache.has(s.id));
      if (missingShips.length === 0) {
        const loaded: Record<number, ShipDetailData> = {};
        ships.forEach((s) => {
          const cached = detailsCache.get(s.id);
          if (cached) loaded[s.id] = cached;
        });
        if (isMounted) setDetails(loaded);
        return;
      }

      setLoading(true);
      try {
        await Promise.all(
          missingShips.map(async (ship) => {
            try {
              const res = await fetch(`/data/details/${ship.id}.json`);
              if (res.ok) {
                const data: ShipDetailData = await res.json();
                detailsCache.set(ship.id, data);
              }
            } catch (err) {
              console.warn(`Failed to load details for ${ship.dispName}:`, err);
            }
          })
        );

        if (isMounted) {
          const loaded: Record<number, ShipDetailData> = {};
          ships.forEach((s) => {
            const cached = detailsCache.get(s.id);
            if (cached) loaded[s.id] = cached;
          });
          setDetails(loaded);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [ships]);

  // Chart Dimensions & Scales
  const width = 800;
  const height = 360;
  const padding = { top: 30, right: 35, bottom: 45, left: 65 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const minX = 0;
  const maxX = 25; // 0 to 25 km standard comparison distance
  const currentMetricConfig = METRIC_CONFIGS[metric];
  const minY = 0;
  const maxY = currentMetricConfig.maxY;

  const scaleX = (x: number) => padding.left + ((x - minX) / (maxX - minX)) * plotWidth;
  const scaleY = (y: number) => padding.top + plotHeight - ((y - minY) / (maxY - minY)) * plotHeight;

  // Linear interpolation for hover scrubbing
  const interpolatePoint = (curve: BallisticsPoint[], targetKm: number): BallisticsPoint | null => {
    if (!curve || curve.length === 0) return null;
    if (targetKm <= curve[0].distanceKm) return curve[0];
    const last = curve[curve.length - 1];
    if (targetKm >= last.distanceKm) return last;

    for (let i = 0; i < curve.length - 1; i++) {
      const p1 = curve[i];
      const p2 = curve[i + 1];
      if (targetKm >= p1.distanceKm && targetKm <= p2.distanceKm) {
        const span = p2.distanceKm - p1.distanceKm;
        const ratio = span === 0 ? 0 : (targetKm - p1.distanceKm) / span;
        return {
          distanceKm: targetKm,
          penetration: Math.round((p1.penetration + ratio * (p2.penetration - p1.penetration)) * 10) / 10,
          beltPenetration: Math.round((p1.beltPenetration + ratio * (p2.beltPenetration - p1.beltPenetration)) * 10) / 10,
          deckPenetration: Math.round((p1.deckPenetration + ratio * (p2.deckPenetration - p1.deckPenetration)) * 10) / 10,
          flightTime: Math.round((p1.flightTime + ratio * (p2.flightTime - p1.flightTime)) * 10) / 10,
          impactVelocity: Math.round(p1.impactVelocity + ratio * (p2.impactVelocity - p1.impactVelocity)),
          impactAngleDeg: Math.round((p1.impactAngleDeg + ratio * (p2.impactAngleDeg - p1.impactAngleDeg)) * 10) / 10,
        };
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normX = (mouseX / rect.width) * width;
    const clampedPlotX = Math.max(padding.left, Math.min(width - padding.right, normX));
    const dist = minX + ((clampedPlotX - padding.left) / plotWidth) * (maxX - minX);
    setHoverDist(Math.round(dist * 10) / 10);
  };

  const handleMouseLeave = () => {
    setHoverDist(null);
  };

  // Determine which ships have AP ballistics curves
  const ballisticsData = ships.map((ship, idx) => {
    const detail = details[ship.id];
    const ballistics = detail?.ballistics;
    const curve = ballistics?.curve || [];
    const color = SHIP_PALETTE[idx % SHIP_PALETTE.length];
    return {
      ship,
      ballistics,
      curve,
      color,
      hasBallistics: !!ballistics && curve.length > 0,
    };
  });

  const anyBallistics = ballisticsData.some((b) => b.hasBallistics);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
      {/* Chart Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              AP Ballistics & Penetration Curves (0 – 25 km)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Comparative Krupp armor penetration and trajectory analysis across distance
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          {(Object.keys(METRIC_CONFIGS) as MetricType[]).map((m) => {
            const cfg = METRIC_CONFIGS[m];
            const Icon = cfg.icon;
            const isSelected = metric === m;
            return (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{cfg.label.split(' ')[0]}</span>
                <span className="md:hidden">{cfg.unit}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">Loading ship trajectory ballistics...</span>
        </div>
      )}

      {!loading && !anyBallistics && (
        <div className="p-8 text-center bg-slate-950/60 rounded-lg border border-slate-800/80 text-slate-400 text-xs">
          None of the currently selected warships possess AP artillery ballistics curves (e.g. Submarines, Aircraft Carriers, or stock hulls). Select cruisers or battleships to compare penetration curves.
        </div>
      )}

      {!loading && anyBallistics && (
        <div className="space-y-4">
          {/* Main SVG Chart Container */}
          <div className="relative bg-slate-950/80 rounded-xl border border-slate-800/90 p-2 overflow-hidden shadow-inner">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto block select-none cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {ballisticsData.map((item) => (
                  <linearGradient
                    key={`grad-${item.ship.id}`}
                    id={`grad-${item.ship.id}`}
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor={item.color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={item.color} stopOpacity="0.0" />
                  </linearGradient>
                ))}
              </defs>

              {/* Grid Lines - Horizontal */}
              {currentMetricConfig.ticks.map((tick) => {
                const y = scaleY(tick);
                return (
                  <g key={`y-${tick}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray={tick === 0 ? undefined : '3 3'}
                      opacity={tick === 0 ? 0.7 : 0.4}
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[11px] fill-slate-400 font-mono"
                    >
                      {tick} {currentMetricConfig.unit}
                    </text>
                  </g>
                );
              })}

              {/* Grid Lines - Vertical (Distance km) */}
              {[0, 5, 10, 15, 20, 25].map((dist) => {
                const x = scaleX(dist);
                return (
                  <g key={`x-${dist}`}>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={height - padding.bottom}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray={dist === 0 ? undefined : '3 3'}
                      opacity={dist === 0 ? 0.7 : 0.4}
                    />
                    <text
                      x={x}
                      y={height - padding.bottom + 18}
                      textAnchor="middle"
                      className="text-[11px] fill-slate-400 font-mono"
                    >
                      {dist} km
                    </text>
                  </g>
                );
              })}

              {/* Axis Labels */}
              <text
                x={width / 2}
                y={height - 6}
                textAnchor="middle"
                className="text-[11px] fill-slate-400 font-sans font-medium"
              >
                Target Distance (km)
              </text>
              <text
                x={14}
                y={padding.top + plotHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90 14 ${padding.top + plotHeight / 2})`}
                className="text-[11px] fill-slate-400 font-sans font-medium"
              >
                {currentMetricConfig.label} ({currentMetricConfig.unit})
              </text>

              {/* Ship Curves */}
              {ballisticsData.map((item) => {
                if (!item.hasBallistics) return null;

                // Points up to 25 km
                const pts = item.curve.filter((pt) => pt.distanceKm <= maxX);
                if (pts.length < 2) return null;

                const pathCoords = pts.map((pt, i) => {
                  const x = scaleX(pt.distanceKm);
                  const y = scaleY(currentMetricConfig.getValue(pt));
                  return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                });

                const pathD = pathCoords.join(' ');

                // Area under curve
                const firstX = scaleX(pts[0].distanceKm);
                const lastX = scaleX(pts[pts.length - 1].distanceKm);
                const baseY = scaleY(0);
                const areaD = `${pathD} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

                return (
                  <g key={item.ship.id} className="transition-opacity duration-200">
                    {/* Shaded Area */}
                    <path d={areaD} fill={`url(#grad-${item.ship.id})`} />

                    {/* Main Stroke */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="2.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Data Points at 5, 10, 15, 20 km */}
                    {pts
                      .filter((pt) => pt.distanceKm % 5 === 0)
                      .map((pt) => {
                        const cx = scaleX(pt.distanceKm);
                        const cy = scaleY(currentMetricConfig.getValue(pt));
                        return (
                          <circle
                            key={`circle-${pt.distanceKm}`}
                            cx={cx}
                            cy={cy}
                            r="4"
                            fill={item.color}
                            stroke="#020617"
                            strokeWidth="2"
                          />
                        );
                      })}
                  </g>
                );
              })}

              {/* Active Hover Crosshair Line & Point Markers */}
              {hoverDist !== null && (
                <g>
                  <line
                    x1={scaleX(hoverDist)}
                    y1={padding.top}
                    x2={scaleX(hoverDist)}
                    y2={height - padding.bottom}
                    stroke="#f8fafc"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  {ballisticsData.map((item) => {
                    if (!item.hasBallistics) return null;
                    const pt = interpolatePoint(item.curve, hoverDist);
                    if (!pt || hoverDist > (item.ship.artillery?.rangeKm || 25)) return null;
                    const cx = scaleX(hoverDist);
                    const cy = scaleY(currentMetricConfig.getValue(pt));
                    return (
                      <circle
                        key={`hover-${item.ship.id}`}
                        cx={cx}
                        cy={cy}
                        r="6"
                        fill={item.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                    );
                  })}
                </g>
              )}
            </svg>

            {/* Hover Tooltip Overlay HUD */}
            {hoverDist !== null && (
              <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-2xl backdrop-blur-md text-xs font-mono pointer-events-none z-10 space-y-1.5 min-w-[210px]">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[11px] text-slate-400">
                  <span className="font-semibold text-white">Distance:</span>
                  <span className="text-amber-400 font-bold">{hoverDist.toFixed(1)} km</span>
                </div>
                {ballisticsData.map((item) => {
                  if (!item.hasBallistics) {
                    return (
                      <div key={item.ship.id} className="flex justify-between items-center text-slate-500 text-[11px]">
                        <span className="truncate max-w-[110px]">{item.ship.dispName}</span>
                        <span>No AP Guns</span>
                      </div>
                    );
                  }
                  const pt = interpolatePoint(item.curve, hoverDist);
                  if (!pt) return null;
                  const outOfRange = item.ship.artillery && hoverDist > item.ship.artillery.rangeKm;

                  return (
                    <div key={item.ship.id} className="space-y-0.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1.5" style={{ color: item.color }}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate max-w-[100px]">{item.ship.dispName}</span>
                        </span>
                        {outOfRange ? (
                          <span className="text-slate-500 italic">Out of Range</span>
                        ) : (
                          <span className="font-bold text-white">
                            {currentMetricConfig.getValue(pt)} {currentMetricConfig.unit}
                          </span>
                        )}
                      </div>
                      {!outOfRange && (
                        <div className="text-[10px] text-slate-400 flex justify-between pl-3.5">
                          <span>Flight: {pt.flightTime}s</span>
                          <span>Angle: {pt.impactAngleDeg}°</span>
                          <span>V: {pt.impactVelocity} m/s</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Ship Legends & Krupp Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {ballisticsData.map((item) => {
              const b = item.ballistics;
              return (
                <div
                  key={item.ship.id}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-white truncate">{item.ship.dispName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      T{item.ship.tier} {item.ship.class}
                    </span>
                  </div>

                  {b ? (
                    <div className="text-[11px] font-mono space-y-0.5 pt-1 border-t border-slate-800/60">
                      <div className="flex justify-between text-slate-400">
                        <span>Caliber:</span>
                        <span className="text-slate-200">{b.caliberMm} mm</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Muzzle Velocity:</span>
                        <span className="text-slate-200">{b.bulletSpeed} m/s</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Krupp Rating:</span>
                        <span className="text-amber-300 font-semibold">{b.krupp || '—'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Overmatch:</span>
                        <span className="text-emerald-400 font-semibold">{b.overmatchMm} mm</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Muzzle Pen:</span>
                        <span className="text-slate-200 font-semibold">{b.muzzlePenetrationMm || '—'} mm</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic pt-1">
                      No AP ballistics available for this vessel.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
