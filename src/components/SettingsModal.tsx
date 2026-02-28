import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LLMSettings } from '../types';
import { Check, ChevronDown, RefreshCw, Save, Settings, X } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '../i18n';

interface SettingsModalProps {
  settings: LLMSettings;
  onSave: (settings: LLMSettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const { t } = useI18n();
  const [localSettings, setLocalSettings] = useState<LLMSettings>(settings);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localSettings);
    onClose();
  };

  const filteredModels = useMemo(() => {
    const q = (localSettings.model || '').trim().toLowerCase();
    const list = Array.isArray(models) ? [...models] : [];
    list.sort((a, b) => a.localeCompare(b));
    if (!q) return list;
    return list.filter(m => m.toLowerCase().includes(q));
  }, [models, localSettings.model]);

  useEffect(() => {
    if (!isModelPickerOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const root = modelPickerRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setIsModelPickerOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModelPickerOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isModelPickerOpen]);

  const fetchModels = async () => {
    if (!localSettings.endpoint || !localSettings.apiKey) {
      setModelError(t('settings.enterEndpointAndKeyFirst'));
      return;
    }
    setLoadingModels(true);
    setModelError('');
    try {
      const base = localSettings.endpoint.replace(/\/$/, '');
      const candidates = base.endsWith('/v1') ? [`${base}/models`] : [`${base}/models`, `${base}/v1/models`];

      let lastErr: unknown = null;
      for (let i = 0; i < candidates.length; i++) {
        const url = candidates[i];
        try {
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localSettings.apiKey}` }
          });

          if (!res.ok) {
            // If the user provided a base URL without /v1, some providers only support /v1/models.
            if (res.status === 404 && i < candidates.length - 1) continue;
            let detail = '';
            try {
              detail = (await res.text()).trim();
            } catch {
              // Ignore body parse failures.
            }
            const suffix = detail ? ` - ${detail.slice(0, 240)}` : '';
            throw new Error(`Failed to fetch models: ${res.status} ${res.statusText}${suffix}`);
          }

          const data = await res.json();
          const list = Array.isArray(data?.data)
            ? data.data
            : (Array.isArray(data?.models) ? data.models : null);
          if (!Array.isArray(list)) {
            throw new Error('Invalid response format (expected { data: [...] }).');
          }

          const ids = list
            .map((m: any) => (typeof m === 'string' ? m : m?.id))
            .filter((id: any) => typeof id === 'string' && id.trim().length > 0)
            .map((id: string) => id.trim());

          if (ids.length === 0) throw new Error('No models returned.');

          setModels(ids);
          setIsModelPickerOpen(true);
          lastErr = null;
          break;
        } catch (e: any) {
          lastErr = e;
        }
      }

      if (lastErr) throw lastErr;
    } catch (e: any) {
      setModelError(e.message || 'Error fetching models');
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Settings size={18} />
            <h2 className="font-semibold">{t('settings.title')}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('settings.endpointLabel')}
            </label>
            <input
              type="url"
              required
              value={localSettings.endpoint}
              onChange={(e) => setLocalSettings(s => ({ ...s, endpoint: e.target.value }))}
              placeholder={t('settings.endpointPlaceholder')}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('settings.apiKeyLabel')}
            </label>
            <input
              type="password"
              required
              value={localSettings.apiKey}
              onChange={(e) => setLocalSettings(s => ({ ...s, apiKey: e.target.value }))}
              placeholder={t('settings.apiKeyPlaceholder')}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('settings.modelLabel')}
              </label>
              <button 
                type="button" 
                onClick={fetchModels}
                disabled={loadingModels}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''} />
                {t('settings.fetchModels')}
              </button>
            </div>
            <div ref={modelPickerRef} className="relative">
              <input
                type="text"
                required
                value={localSettings.model}
                onChange={(e) => {
                  setLocalSettings(s => ({ ...s, model: e.target.value }));
                  if (models.length > 0) setIsModelPickerOpen(true);
                }}
                onFocus={() => {
                  if (models.length > 0) setIsModelPickerOpen(true);
                }}
                placeholder="gpt-3.5-turbo"
                className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                title={models.length > 0 ? t('settings.showModels') : t('settings.fetchModelsFirst')}
                onClick={() => {
                  if (models.length === 0) return;
                  setIsModelPickerOpen(v => !v);
                }}
                disabled={models.length === 0}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-40 disabled:hover:text-slate-400"
              >
                <ChevronDown size={16} className={clsx(isModelPickerOpen ? 'rotate-180 transition-transform' : 'transition-transform')} />
              </button>

              {isModelPickerOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md shadow-2xl overflow-hidden">
                  <div className="max-h-64 overflow-auto">
                    {filteredModels.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        {models.length === 0 ? t('settings.noModelsLoaded') : t('settings.noMatchingModels')}
                      </div>
                    ) : (
                      filteredModels.map((m) => {
                        const isSelected = m === localSettings.model;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setLocalSettings(s => ({ ...s, model: m }));
                              setIsModelPickerOpen(false);
                            }}
                            className={clsx(
                              "w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                              isSelected ? "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-200" : "text-slate-800 dark:text-slate-200"
                            )}
                          >
                            <span className="font-mono text-xs">{m}</span>
                            {isSelected && <Check size={14} className="shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {models.length > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {t('settings.loadedModels', { count: models.length, plural: models.length === 1 ? '' : 's' })}
              </p>
            )}

            {modelError && <p className="text-xs text-rose-500 mt-1">{modelError}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {t('settings.cancel')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              <Save size={16} />
              {t('settings.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
