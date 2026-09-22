import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/common/Header';
import { ShipParametersView } from './views/ShipParametersView';
import { ArmoryView } from './views/ArmoryView';
import { ServerStatsView } from './views/ServerStatsView';
import { ShipCompareView } from './views/ShipCompareView';

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p === '/' ? '/params' : p;
    }
    return '/params';
  });

  // Listen to browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p === '/' ? '/params' : p);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      <Header currentPath={currentPath} onNavigate={handleNavigate} />

      <main className="flex-1 flex flex-col">
        {currentPath === '/armory' ? (
          <ArmoryView onNavigate={handleNavigate} />
        ) : currentPath === '/stats' ? (
          <ServerStatsView onNavigate={handleNavigate} />
        ) : currentPath === '/compare' ? (
          <ShipCompareView onNavigate={handleNavigate} />
        ) : (
          <ShipParametersView onNavigate={handleNavigate} />
        )}
      </main>
    </div>
  );
}

export default App;
