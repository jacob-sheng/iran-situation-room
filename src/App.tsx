import React, { useState, useEffect } from 'react';
import MapDashboard from './components/MapDashboard';
import NewsPanel from './components/NewsPanel';
import ControlPanel from './components/ControlPanel';
import DetailsPanel from './components/DetailsPanel';
import SettingsModal from './components/SettingsModal';
import { MapFilters, Unit, Event, Infrastructure, BattleResult, LLMSettings } from './types';
import { MOCK_UNITS, MOCK_EVENTS, MOCK_INFRASTRUCTURE, MOCK_BATTLE_RESULTS } from './constants';
import { Activity, Moon, Sun } from 'lucide-react';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LLMSettings>({
    endpoint: '',
    apiKey: '',
    model: 'gpt-3.5-turbo'
  });

  const [filters, setFilters] = useState<MapFilters>({
    showUnits: true,
    showEvents: true,
    showArrows: true,
    showAnnotations: true,
    showInfrastructure: true,
    showBattleResults: true,
  });

  const [units, setUnits] = useState<Unit[]>(MOCK_UNITS);
  const [selectedItem, setSelectedItem] = useState<Unit | Event | Infrastructure | BattleResult | null>(null);

  // Handle dark mode class on root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load settings from local storage
  useEffect(() => {
    const saved = localStorage.getItem('llmSettings');
    if (saved) {
      try {
        setLlmSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse settings');
      }
    }
  }, []);

  const handleSaveSettings = (newSettings: LLMSettings) => {
    setLlmSettings(newSettings);
    localStorage.setItem('llmSettings', JSON.stringify(newSettings));
  };

  // Simulate unit movement
  useEffect(() => {
    const interval = setInterval(() => {
      setUnits(prevUnits => prevUnits.map(unit => {
        if (!unit.velocity) return unit;
        
        let [vx, vy] = unit.velocity;
        let [x, y] = unit.coordinates;
        
        const newHistory = [...(unit.pathHistory || []), [x, y] as [number, number]];
        if (newHistory.length > 20) {
          newHistory.shift();
        }
        
        x += vx;
        y += vy;
        
        // Simple bounding box to make them bounce back and forth
        if (x > 58 || x < 48) vx = -vx;
        if (y > 30 || y < 24) vy = -vy;
        
        return { ...unit, coordinates: [x, y], velocity: [vx, vy], pathHistory: newHistory };
      }));
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">
      {/* Main Map Area */}
      <div className="flex-1 relative p-4 pl-4 pr-2 pb-4 pt-4">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xl transition-colors duration-300">
          <Activity className="text-rose-500 animate-pulse" size={20} />
          <h1 className="text-lg font-bold tracking-widest uppercase text-slate-800 dark:text-slate-100">
            Iran Situation Room
          </h1>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-2" />
        </div>

        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-6 right-6 z-10 p-2.5 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <MapDashboard
          filters={filters}
          units={units}
          events={MOCK_EVENTS}
          infrastructure={MOCK_INFRASTRUCTURE}
          battleResults={MOCK_BATTLE_RESULTS}
          onSelectEvent={setSelectedItem}
          onSelectUnit={setSelectedItem}
          onSelectInfrastructure={setSelectedItem}
          onSelectBattleResult={setSelectedItem}
        />
        
        <ControlPanel filters={filters} setFilters={setFilters} />
        
        {selectedItem && (
          <DetailsPanel selectedItem={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </div>

      {/* Right Sidebar for News */}
      <div className="w-80 h-full py-4 pr-4 pl-2">
        <NewsPanel 
          settings={llmSettings} 
          onOpenSettings={() => setShowSettings(true)} 
        />
      </div>

      {showSettings && (
        <SettingsModal 
          settings={llmSettings} 
          onSave={handleSaveSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
}
