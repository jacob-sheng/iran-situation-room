import React from 'react';
import { Hotspot, IntelNewsItem, LLMSettings, NewsCategory, NewsScope } from '../types';
import { Activity, ExternalLink, Github, MapPin, RefreshCw, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from '../i18n';
import clsx from 'clsx';

interface NewsPanelProps {
  settings: LLMSettings;
  scope: NewsScope;
  category: NewsCategory | 'all';
  hotspots: Hotspot[];
  selectedHotspotId: string | null;
  onChangeScope: (scope: NewsScope) => void;
  onChangeCategory: (category: NewsCategory | 'all') => void;
  onSelectHotspot: (hotspot: Hotspot | null) => void;
  news: IntelNewsItem[];
  latestBatchSize: number;
  latestBatchKey?: string | null;
  loading: boolean;
  error: string | null;
  selectedNewsId: string | null;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onSelectNews: (id: string) => void;
  className?: string;
  translate?: (text: string) => string;
}

export default function NewsPanel({
  settings,
  scope,
  category,
  hotspots,
  selectedHotspotId,
  onChangeScope,
  onChangeCategory,
  onSelectHotspot,
  news,
  latestBatchSize,
  latestBatchKey,
  loading,
  error,
  selectedNewsId,
  onOpenSettings,
  onRefresh,
  onSelectNews,
  className,
  translate,
}: NewsPanelProps) {
  const { t } = useI18n();
  const missingSettings = !settings.endpoint || !settings.apiKey;
  const showSkeleton = loading && news.length === 0;

  let dividerAfterIndex = -1;
  if (latestBatchKey) {
    const needle = `:${latestBatchKey}:`;
    for (let i = 0; i < news.length; i++) {
      if (String(news[i]?.id || '').includes(needle)) dividerAfterIndex = i;
    }
    if (dividerAfterIndex >= news.length - 1) dividerAfterIndex = -1;
  } else if (latestBatchSize > 0 && news.length > latestBatchSize) {
    dividerAfterIndex = latestBatchSize - 1;
  }

  const categories: Array<NewsCategory | 'all'> = [
    'all',
    'conflict',
    'politics',
    'economy',
    'disaster',
    'health',
    'tech',
    'science',
    'energy',
    'other',
  ];

  return (
    <div
      className={clsx(
        "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex flex-col shadow-2xl transition-colors duration-300",
        className ?? "w-80 h-full border-l border-slate-200 dark:border-slate-800"
      )}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Activity size={18} className="text-cyan-600 dark:text-cyan-400" />
          {t('news.title')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title={t('news.apiSettings')}
          >
            <Settings size={16} />
          </button>
          <a
            href="https://github.com/jacob-sheng/iran-situation-room"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title={t('news.github')}
            aria-label={t('news.github')}
          >
            <Github size={16} />
          </a>
          <button
            onClick={onRefresh}
            disabled={loading || !settings.endpoint || !settings.apiKey}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors disabled:opacity-50"
            title={t('news.refreshNews')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('news.scope')}
          </div>
          <select
            value={scope}
            onChange={(e) => onChangeScope(e.target.value as NewsScope)}
            className="text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 px-2 py-1 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          >
            <option value="global">{t('scope.global')}</option>
            <option value="americas">{t('scope.americas')}</option>
            <option value="europe">{t('scope.europe')}</option>
            <option value="africa">{t('scope.africa')}</option>
            <option value="middle_east">{t('scope.middle_east')}</option>
            <option value="asia_pacific">{t('scope.asia_pacific')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('news.category')}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = c === category;
              const label = c === 'all' ? t('category.all') : t((`category.${c}`) as any);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChangeCategory(c)}
                  className={clsx(
                    "px-2 py-1 rounded-full border text-[11px] font-mono transition-colors",
                    active
                      ? "bg-cyan-600 text-white border-cyan-600"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('news.hotspots')}
            </div>
            {selectedHotspotId && (
              <button
                type="button"
                onClick={() => onSelectHotspot(null)}
                className="text-[10px] font-mono uppercase tracking-wider text-cyan-700 dark:text-cyan-300 underline decoration-cyan-500/40 hover:decoration-cyan-500"
              >
                {t('news.clearHotspot')}
              </button>
            )}
          </div>
          {Array.isArray(hotspots) && hotspots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {hotspots.map((hs) => {
                const active = selectedHotspotId === hs.id;
                return (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={() => onSelectHotspot(active ? null : hs)}
                    className={clsx(
                      "px-2 py-1 rounded-full border text-[11px] font-mono transition-colors",
                      active
                        ? "bg-cyan-600 text-white border-cyan-600"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                    title={hs.label}
                  >
                    {hs.label} <span className="opacity-70">({hs.count})</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('news.noHotspots')}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {missingSettings ? (
          <div className="text-slate-500 text-sm p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col gap-2">
            <p>{t('news.configureFirst')}</p>
            <button onClick={onOpenSettings} className="text-cyan-700 dark:text-cyan-300 underline text-left font-medium">
              {t('news.openSettings')}
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="text-rose-600 dark:text-rose-400 text-sm p-4 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-200 dark:border-rose-500/20 flex flex-col gap-2">
            <p>{error}</p>
            {error.includes('configure') && (
              <button onClick={onOpenSettings} className="text-rose-700 dark:text-rose-300 underline text-left font-medium">
                {t('news.openSettings')}
              </button>
            )}
          </div>
        ) : null}

        {showSkeleton ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex flex-col gap-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">
            {t('news.noRecentIntel')}
          </div>
        ) : (
          news.map((item, index) => {
            const showDivider = dividerAfterIndex >= 0 && index === dividerAfterIndex;

            return (
              <React.Fragment key={item.id}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => onSelectNews(item.id)}
                  className={[
                    "group flex flex-col gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-cyan-500/30 dark:hover:border-cyan-500/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer",
                    selectedNewsId === item.id ? "ring-2 ring-cyan-500/40 border-cyan-500/40" : "",
                  ].join(' ')}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">
                      {translate ? translate(item.title) : item.title}
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
                    {translate ? translate(item.summary) : item.summary}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-500/70 uppercase tracking-wider truncate">
                        {item.source}
                      </span>
                      {item.category ? (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          {t((`category.${item.category}`) as any)}
                        </span>
                      ) : null}
                      {item.isPreview ? (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300">
                          PREVIEW
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {item.timestamp}
                    </span>
                  </div>
                </motion.div>

                {showDivider ? (
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('news.dividerThisRefresh')}
                    </div>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>
                ) : null}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
