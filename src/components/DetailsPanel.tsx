import React from 'react';
import { Unit, Event, Infrastructure, BattleResult } from '../types';
import { X, Shield, AlertTriangle, MapPin, Calendar, Info, Factory, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { useI18n } from '../i18n';

interface DetailsPanelProps {
  selectedItem: Unit | Event | Infrastructure | BattleResult | null;
  onClose: () => void;
  embedded?: boolean;
  translate?: (text: string) => string;
}

export default function DetailsPanel({ selectedItem, onClose, embedded = false, translate }: DetailsPanelProps) {
  if (!selectedItem) return null;
  const { t } = useI18n();

  const isUnit = 'type' in selectedItem && 'affiliation' in selectedItem;
  const isEvent = 'severity' in selectedItem;
  const isInfra = 'status' in selectedItem;
  const isBattle = 'type' in selectedItem && !('affiliation' in selectedItem);
  const sources = (selectedItem as any).sources as { name: string; url: string; timestamp: string }[] | undefined;
  const confidence = (selectedItem as any).confidence as number | undefined;
  const verified = (selectedItem as any).verified as boolean | undefined;

  const getHeaderColor = () => {
    if (isUnit) {
      const u = selectedItem as Unit;
      return u.affiliation === 'iran' ? 'bg-emerald-500' : u.affiliation === 'us' ? 'bg-blue-500' : u.affiliation === 'israel' ? 'bg-indigo-500' : 'bg-slate-500';
    }
    if (isEvent) {
      const e = selectedItem as Event;
      return e.severity === 'high' ? 'bg-rose-500' : e.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500';
    }
    if (isInfra) {
      const i = selectedItem as Infrastructure;
      return i.status === 'destroyed' ? 'bg-rose-500' : i.status === 'damaged' ? 'bg-amber-500' : 'bg-slate-500';
    }
    return 'bg-rose-500'; // BattleResult
  };

  const getIcon = () => {
    if (isUnit) return <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />;
    if (isEvent) return <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />;
    if (isInfra) return <Factory size={20} className="text-indigo-600 dark:text-indigo-400" />;
    return <Crosshair size={20} className="text-rose-600 dark:text-rose-400" />;
  };

  const getTitle = () => {
    if ('name' in selectedItem) return translate ? translate(selectedItem.name) : selectedItem.name;
    if ('title' in selectedItem) return translate ? translate(selectedItem.title) : selectedItem.title;
    return t('details.unknown');
  };

  const getSubtitle = () => {
    if (isUnit) {
      const u = selectedItem as Unit;
      const aff = t((`enum.affiliation.${u.affiliation}`) as any);
      return `${t('details.affiliation')}: ${aff}`;
    }
    if (isEvent) {
      const e = selectedItem as Event;
      const sev = t((`enum.severity.${e.severity}`) as any);
      return `${t('details.severity')}: ${sev}`;
    }
    if (isInfra) {
      const i = selectedItem as Infrastructure;
      const st = t((`enum.infraStatus.${i.status}`) as any);
      return `${t('details.status')}: ${st} | ${i.country}`;
    }
    if (isBattle) {
      const b = selectedItem as BattleResult;
      const bt = t((`enum.battleType.${b.type}`) as any);
      return `${t('details.type')}: ${bt}`;
    }
    return '';
  };

  const body = (
    <>
      <div className={clsx("h-1 w-full", getHeaderColor())} />
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {getTitle()}
              </h3>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mt-1">
                {getSubtitle()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Info size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <p className="leading-relaxed">
              {('description' in selectedItem && selectedItem.description)
                ? (translate ? translate(selectedItem.description) : selectedItem.description)
                : t('details.noDescription')}
              </p>
            </div>

          {('date' in selectedItem) && (
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <Calendar size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="font-mono">{(selectedItem as any).date}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <MapPin size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <span className="font-mono">
              {selectedItem.coordinates[1].toFixed(4)}°N, {selectedItem.coordinates[0].toFixed(4)}°E
            </span>
          </div>

          {(typeof confidence === 'number' || typeof verified === 'boolean') && (
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>
                {typeof confidence === 'number'
                  ? `${t('details.confidence')}: ${(Math.max(0, Math.min(1, confidence)) * 100).toFixed(0)}%`
                  : ''}
              </span>
              {typeof verified === 'boolean' && (
                <span className={clsx(
                  "uppercase tracking-wider",
                  verified ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}>
                  {verified ? t('details.verified') : t('details.unverified')}
                </span>
              )}
            </div>
          )}

          {Array.isArray(sources) && sources.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t('details.sources')}
              </div>
              <div className="space-y-2">
                {sources.map((s, idx) => (
                  <div key={`${s.url}-${idx}`} className="text-xs text-slate-600 dark:text-slate-300">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-700 dark:text-cyan-300 underline decoration-cyan-500/40 hover:decoration-cyan-500"
                    >
                      {s.name || t('details.sourceFallback')}
                    </a>
                    {s.timestamp ? (
                      <span className="ml-2 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {s.timestamp}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden transition-colors duration-300">
        {body}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="absolute bottom-4 left-4 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden transition-colors duration-300"
      >
        {body}
      </motion.div>
    </AnimatePresence>
  );
}
