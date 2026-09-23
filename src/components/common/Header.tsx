import React, { useState, useEffect } from 'react';
import { Anchor, Table, ShoppingBag, BarChart3, GitCompare, RefreshCw, Wifi, CloudOff } from 'lucide-react';
import { useShipStore } from '../../stores/useShipStore';
import { useOnlineStatus } from '../../utils/useOnlineStatus';

export { useOnlineStatus };

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const ships = useShipStore((state) => state.ships);
  const selectedShipIds = useShipStore((state) => state.selectedShipIds);

  const isOnline = useOnlineStatus();
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Check backend sync service status on mount and when network is online
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      if (!isOnline) {
        if (isMounted) setIsBackendOnline(false);
        return;
      }
      try {
        const res = await fetch('/api/status', { method: 'GET' });
        if (res.ok) {
          if (isMounted) setIsBackendOnline(true);
        } else {
          if (isMounted) setIsBackendOnline(false);
        }
      } catch {
        if (isMounted) setIsBackendOnline(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOnline]);

  const handleSync = async () => {
    if (!isOnline) {
      setSyncFeedback('Offline: Local datasets and cache active');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    setIsSyncing(true);
    setSyncFeedback('Checking live Armory updates...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSyncFeedback(data.message || 'Armory synced successfully');
        setIsBackendOnline(true);
      } else {
        setSyncFeedback('Sync service error');
      }
    } catch {
      setSyncFeedback('Sync service offline (local datasets active)');
      setIsBackendOnline(false);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const navItems = [
    { path: '/params', label: 'Parameters', icon: Table },
    { path: '/armory', label: 'Armory & Acquisition', icon: ShoppingBag },
    { path: '/stats', label: 'Server Stats', icon: BarChart3 },
    {
      path: '/compare',
      label: 'Compare',
      icon: GitCompare,
      badge: selectedShipIds.length > 0 ? selectedShipIds.length : undefined,
    },
  ];

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          aria-label="Offline Mode Notification"
          className="bg-amber-950/90 border-b border-amber-800/60 px-4 py-1.5 text-xs text-amber-200 flex items-center justify-center gap-2 font-medium z-50 sticky top-0"
        >
          <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Offline Mode: Network disconnected. All 993 ships, Armory database, and Krupp ballistics are running from local PWA cache.</span>
        </div>
      )}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-6 py-2.5 flex items-center justify-between">
        {/* Brand & Badge */}
        <div className="flex items-center space-x-6">
          <div
            onClick={() => onNavigate('/params')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 group-hover:border-amber-400/50 transition">
              <Anchor className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-tight">WoWs Info</span>
                <span className="text-[10px] font-mono uppercase bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                  v0.1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {ships.length > 0 ? `${ships.length} Ships | 226 Armory Deals` : 'Local Ship Matrix'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path || (currentPath === '/' && item.path === '/params');
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Controls: Option B Sync Status & Network Online/Offline */}
        <div className="flex items-center space-x-3">
          {/* Online/Offline Status Indicator */}
          {!isOnline ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border bg-amber-950/60 text-amber-300 border-amber-800/60"
              title="Network Offline: Serving pre-compiled datasets from local PWA cache"
            >
              <CloudOff className="w-3 h-3 text-amber-400" />
              <span className="font-mono hidden sm:inline">Offline (Cached)</span>
              <span className="font-mono sm:hidden">Offline</span>
            </div>
          ) : isBackendOnline ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
              title="Online: Local Sync Daemon Connected (/api/sync)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="font-mono hidden sm:inline">Online</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border bg-slate-800/80 text-slate-300 border-slate-700/60"
              title="Online: Local Datasets Active (Sync Daemon Standby)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <Wifi className="w-3 h-3 text-amber-400" />
              <span className="font-mono hidden sm:inline">Local Datasets</span>
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Check for Updates</span>
          </button>

          {syncFeedback && (
            <div className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-1 rounded border border-amber-800/60 shadow-sm animate-fade-in">
              {syncFeedback}
            </div>
          )}
        </div>
      </header>
    </>
  );
};
