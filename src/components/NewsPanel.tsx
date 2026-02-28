import React from 'react';
import { IntelNewsItem, LLMSettings } from '../types';
import { Activity, ExternalLink, MapPin, RefreshCw, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface NewsPanelProps {
  settings: LLMSettings;
  news: IntelNewsItem[];
  loading: boolean;
  error: string | null;
  selectedNewsId: string | null;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onSelectNews: (id: string) => void;
}

export default function NewsPanel({
  settings,
  news,
  loading,
  error,
  selectedNewsId,
  onOpenSettings,
  onRefresh,
  onSelectNews,
}: NewsPanelProps) {
  return (
    <div className="w-80 h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl transition-colors duration-300">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Activity size={18} className="text-cyan-600 dark:text-cyan-400" />
          Live Intel
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="API Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading || !settings.endpoint || !settings.apiKey}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors disabled:opacity-50"
            title="Refresh News"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {!settings.endpoint || !settings.apiKey ? (
          <div className="text-slate-500 text-sm p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col gap-2">
            <p>Please configure API settings first.</p>
            <button onClick={onOpenSettings} className="text-cyan-700 dark:text-cyan-300 underline text-left font-medium">
              Open Settings
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex flex-col gap-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-rose-600 dark:text-rose-400 text-sm p-4 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-200 dark:border-rose-500/20 flex flex-col gap-2">
            <p>{error}</p>
            {error.includes('configure') && (
              <button onClick={onOpenSettings} className="text-rose-700 dark:text-rose-300 underline text-left font-medium">
                Open Settings
              </button>
            )}
          </div>
        ) : news.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">
            No recent intel found.
          </div>
        ) : (
          news.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={item.id}
              onClick={() => onSelectNews(item.id)}
              className={[
                "group flex flex-col gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-cyan-500/30 dark:hover:border-cyan-500/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer",
                selectedNewsId === item.id ? "ring-2 ring-cyan-500/40 border-cyan-500/40" : "",
              ].join(' ')}
            >
              <div className="flex justify-between items-start gap-2">
                <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">
                  {item.title}
                </h3>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                    <MapPin size={12} />
                    <span>{Array.isArray(item.signals) ? item.signals.length : 0}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 dark:text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.summary}
              </p>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-500/70 uppercase tracking-wider">
                  {item.source}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {item.timestamp}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
