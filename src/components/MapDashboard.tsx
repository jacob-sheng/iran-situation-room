import React, { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  Annotation as MapAnnotation,
  ZoomableGroup
} from 'react-simple-maps';
import { Unit, Event, Arrow, Annotation, MapFilters, Infrastructure, BattleResult } from '../types';
import { MOCK_ARROWS, MOCK_ANNOTATIONS, IRAN_COORDINATES } from '../constants';
import { MapPin, Shield, Plane, Anchor, AlertTriangle, Factory, Zap, Building, Crosshair, Skull, Flame } from 'lucide-react';
import clsx from 'clsx';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MapDashboardProps {
  filters: MapFilters;
  units: Unit[];
  events: Event[];
  infrastructure: Infrastructure[];
  battleResults: BattleResult[];
  onSelectEvent: (event: Event | null) => void;
  onSelectUnit: (unit: Unit | null) => void;
  onSelectInfrastructure: (infra: Infrastructure | null) => void;
  onSelectBattleResult: (result: BattleResult | null) => void;
}

export default function MapDashboard({ 
  filters, 
  units, 
  events, 
  infrastructure, 
  battleResults, 
  onSelectEvent, 
  onSelectUnit,
  onSelectInfrastructure,
  onSelectBattleResult
}: MapDashboardProps) {
  const [position, setPosition] = useState({ coordinates: IRAN_COORDINATES, zoom: 4 });

  function handleZoomIn() {
    if (position.zoom >= 10) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom * 1.5 }));
  }

  function handleZoomOut() {
    if (position.zoom <= 1) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom / 1.5 }));
  }

  function handleMoveEnd(position: any) {
    setPosition(position);
  }

  const renderUnitIcon = (type: string) => {
    switch (type) {
      case 'naval': return <Anchor size={16} />;
      case 'air': return <Plane size={16} />;
      case 'base': return <Shield size={16} />;
      default: return <MapPin size={16} />;
    }
  };

  const renderInfraIcon = (type: string) => {
    switch (type) {
      case 'oil': return <Factory size={16} />;
      case 'nuclear': return <Zap size={16} />;
      case 'military_base': return <Shield size={16} />;
      case 'civilian': return <Building size={16} />;
      default: return <MapPin size={16} />;
    }
  };

  const renderBattleIcon = (type: string) => {
    switch (type) {
      case 'kill': return <Skull size={16} />;
      case 'strike': return <Crosshair size={16} />;
      default: return <Flame size={16} />;
    }
  };

  // Calculate dynamic scale based on zoom level to prevent overlap
  const markerScale = Math.max(0.4, 1.5 / Math.sqrt(position.zoom));

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden rounded-xl border border-slate-300 dark:border-slate-800 shadow-2xl transition-colors duration-300">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 800,
          center: IRAN_COORDINATES
        }}
        className="w-full h-full"
      >
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={handleMoveEnd}
          maxZoom={10}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const isIran = geo.properties.name === 'Iran';
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    className="outline-none transition-colors duration-300"
                    style={{
                      default: { 
                        fill: isIran ? 'rgba(6, 182, 212, 0.15)' : 'var(--color-slate-200, #e2e8f0)',
                        stroke: isIran ? '#06b6d4' : 'var(--color-slate-300, #cbd5e1)',
                        strokeWidth: isIran ? 1 : 0.5,
                        outline: 'none'
                      },
                      hover: { 
                        fill: isIran ? 'rgba(6, 182, 212, 0.25)' : 'var(--color-slate-300, #cbd5e1)',
                        stroke: isIran ? '#06b6d4' : 'var(--color-slate-400, #94a3b8)',
                        outline: 'none' 
                      },
                      pressed: { outline: 'none' }
                    }}
                  />
                );
              })
            }
          </Geographies>

          <defs>
            <marker id="arrow-cyan" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
            </marker>
            <marker id="arrow-amber" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Arrows */}
          {filters.showArrows && MOCK_ARROWS.map((arrow) => (
            <Line
              key={arrow.id}
              from={arrow.start}
              to={arrow.end}
              stroke={arrow.color}
              strokeWidth={2 * markerScale}
              strokeLinecap="round"
              className="opacity-70"
              markerEnd={arrow.color === '#06b6d4' ? 'url(#arrow-cyan)' : 'url(#arrow-amber)'}
            />
          ))}

          {/* Annotations */}
          {filters.showAnnotations && MOCK_ANNOTATIONS.map((ann) => (
            <MapAnnotation
              key={ann.id}
              subject={ann.coordinates}
              dx={-30 * markerScale}
              dy={-30 * markerScale}
              connectorProps={{
                stroke: "#94a3b8",
                strokeWidth: 1 * markerScale,
                strokeLinecap: "round"
              }}
            >
              <text x="-8" textAnchor="end" alignmentBaseline="middle" fill="#94a3b8" fontSize={10 * markerScale} className="font-mono uppercase tracking-wider">
                {ann.text}
              </text>
            </MapAnnotation>
          ))}

          {/* Infrastructure */}
          {filters.showInfrastructure && infrastructure.map((infra) => (
            <Marker key={infra.id} coordinates={infra.coordinates} onClick={() => onSelectInfrastructure(infra)}>
              <g transform={`scale(${markerScale})`}>
                <g className="cursor-pointer transition-transform hover:scale-125" transform="translate(-12, -12)">
                  <circle cx="12" cy="12" r="12" className="fill-white dark:fill-slate-900" stroke={
                    infra.status === 'destroyed' ? '#ef4444' :
                    infra.status === 'damaged' ? '#f59e0b' :
                    '#94a3b8'
                  } strokeWidth="1.5" />
                  <foreignObject x="4" y="4" width="16" height="16">
                    <div className={clsx(
                      "flex items-center justify-center w-full h-full",
                      infra.status === 'destroyed' ? 'text-rose-500' :
                      infra.status === 'damaged' ? 'text-amber-500' :
                      'text-slate-500'
                    )}>
                      {renderInfraIcon(infra.type)}
                    </div>
                  </foreignObject>
                  {infra.status !== 'intact' && (
                    <circle cx="20" cy="4" r="4" fill="#ef4444" className="animate-pulse" />
                  )}
                </g>
              </g>
            </Marker>
          ))}

          {/* Battle Results */}
          {filters.showBattleResults && battleResults.map((result) => (
            <Marker key={result.id} coordinates={result.coordinates} onClick={() => onSelectBattleResult(result)}>
              <g transform={`scale(${markerScale})`}>
                <g className="cursor-pointer transition-transform hover:scale-125" transform="translate(-12, -12)">
                  <circle cx="12" cy="12" r="14" fill="rgba(239, 68, 68, 0.15)" className="animate-ping" />
                  <circle cx="12" cy="12" r="12" className="fill-rose-500 dark:fill-rose-900" stroke="#ef4444" strokeWidth="1.5" />
                  <foreignObject x="4" y="4" width="16" height="16">
                    <div className="flex items-center justify-center w-full h-full text-white dark:text-rose-300">
                      {renderBattleIcon(result.type)}
                    </div>
                  </foreignObject>
                </g>
              </g>
            </Marker>
          ))}

          {/* Events */}
          {filters.showEvents && events.map((event) => (
            <Marker key={event.id} coordinates={event.coordinates} onClick={() => onSelectEvent(event)}>
              <g transform={`scale(${markerScale})`}>
                <g
                  className="cursor-pointer transition-transform hover:scale-125"
                  transform="translate(-12, -24)"
                >
                  <circle cx="12" cy="12" r="14" fill={
                    event.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' :
                    event.severity === 'medium' ? 'rgba(245, 158, 11, 0.2)' :
                    'rgba(59, 130, 246, 0.2)'
                  } className="animate-ping" />
                  <foreignObject x="0" y="0" width="24" height="24">
                    <div className="flex items-center justify-center w-full h-full">
                      <AlertTriangle
                        size={24}
                        className={clsx(
                          event.severity === 'high' ? 'text-rose-500' :
                          event.severity === 'medium' ? 'text-amber-500' :
                          'text-blue-500'
                        )}
                      />
                    </div>
                  </foreignObject>
                </g>
              </g>
            </Marker>
          ))}

          {/* Unit Trails */}
          {filters.showUnits && units.map((unit) => {
            if (!unit.pathHistory || unit.pathHistory.length === 0) return null;
            
            const points = [...unit.pathHistory, unit.coordinates];
            const segments = [];
            
            const strokeColor = unit.affiliation === 'iran' ? '#34d399' :
                                unit.affiliation === 'us' ? '#60a5fa' :
                                unit.affiliation === 'israel' ? '#818cf8' :
                                '#94a3b8';

            for (let i = 0; i < points.length - 1; i++) {
              const opacity = (i + 1) / points.length;
              segments.push(
                <Line
                  key={`${unit.id}-segment-${i}`}
                  from={points[i]}
                  to={points[i+1]}
                  stroke={strokeColor}
                  strokeWidth={2 * markerScale}
                  strokeLinecap="round"
                  strokeOpacity={opacity * 0.8}
                />
              );
            }
            return <g key={`${unit.id}-trail`}>{segments}</g>;
          })}

          {/* Units */}
          {filters.showUnits && units.map((unit) => (
            <Marker key={unit.id} coordinates={unit.coordinates} onClick={() => onSelectUnit(unit)}>
              <g transform={`scale(${markerScale})`}>
                <g className="cursor-pointer transition-transform hover:scale-125" transform="translate(-12, -12)">
                  <circle cx="12" cy="12" r="12" className="fill-white dark:fill-slate-900" stroke={
                    unit.affiliation === 'iran' ? '#34d399' :
                    unit.affiliation === 'us' ? '#60a5fa' :
                    unit.affiliation === 'israel' ? '#818cf8' :
                    '#94a3b8'
                  } strokeWidth="1.5" />
                  <foreignObject x="4" y="4" width="16" height="16">
                    <div className={clsx(
                      "flex items-center justify-center w-full h-full",
                      unit.affiliation === 'iran' ? 'text-emerald-500 dark:text-emerald-400' :
                      unit.affiliation === 'us' ? 'text-blue-500 dark:text-blue-400' :
                      unit.affiliation === 'israel' ? 'text-indigo-500 dark:text-indigo-400' :
                      'text-slate-500 dark:text-slate-400'
                    )}>
                      {renderUnitIcon(unit.type)}
                    </div>
                  </foreignObject>
                </g>
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white backdrop-blur-sm transition-colors"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white backdrop-blur-sm transition-colors"
        >
          -
        </button>
      </div>
    </div>
  );
}
