import React from 'react';
import { MapFilters } from '../types';
import { Layers, Shield, AlertTriangle, Navigation, MessageSquare, Factory, Crosshair } from 'lucide-react';
import clsx from 'clsx';

interface ControlPanelProps {
  filters: MapFilters;
  setFilters: React.Dispatch<React.SetStateAction<MapFilters>>;
}

export default function ControlPanel({ filters, setFilters }: ControlPanelProps) {
  const toggleFilter = (key: keyof MapFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const controls = [
    { id: 'showUnits', label: 'Units', icon: Shield, color: 'text-emerald-500 dark:text-emerald-400' },
    { id: 'showEvents', label: 'Events', icon: AlertTriangle, color: 'text-amber-500 dark:text-amber-400' },
    { id: 'showArrows', label: 'Movements', icon: Navigation, color: 'text-cyan-500 dark:text-cyan-400' },
    { id: 'showAnnotations', label: 'Labels', icon: MessageSquare, color: 'text-slate-500 dark:text-slate-400' },
    { id: 'showInfrastructure', label: 'Infrastructure', icon: Factory, color: 'text-indigo-500 dark:text-indigo-400' },
    { id: 'showBattleResults', label: 'Battle Results', icon: Crosshair, color: 'text-rose-500 dark:text-rose-400' },
  ];

  return (
    <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 w-64 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Layers size={18} className="text-cyan-600 dark:text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Map Layers</h2>
      </div>
      
      <div className="flex flex-col gap-3">
        {controls.map((control) => {
          const isActive = filters[control.id as keyof MapFilters];
          const Icon = control.icon;
          return (
            <button
              key={control.id}
              onClick={() => toggleFilter(control.id as keyof MapFilters)}
              className={clsx(
                "flex items-center justify-between p-2 rounded-lg border transition-all duration-200",
                isActive 
                  ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700" 
                  : "bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} className={isActive ? control.color : 'text-slate-400 dark:text-slate-600'} />
                <span className={clsx(
                  "text-sm font-medium",
                  isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-500"
                )}>
                  {control.label}
                </span>
              </div>
              <div className={clsx(
                "w-8 h-4 rounded-full relative transition-colors duration-300",
                isActive ? "bg-cyan-500/30" : "bg-slate-200 dark:bg-slate-800"
              )}>
                <div className={clsx(
                  "absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-300",
                  isActive ? "bg-cyan-600 dark:bg-cyan-400 translate-x-4" : "bg-slate-400 dark:bg-slate-500"
                )} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
