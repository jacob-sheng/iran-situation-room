import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MESSAGES, type Locale, type MessageKey } from './messages';
import { isLocale, normalizeLocale } from './locale';

const STORAGE_KEY = 'uiLocale';

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
    const v = (vars as any)[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
  return normalizeLocale(typeof navigator !== 'undefined' ? navigator.language : 'en');
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale());

  const t = useCallback<I18nContextValue['t']>((key, vars) => {
    const dict = MESSAGES[locale] as any;
    const fallback = MESSAGES.en as any;
    const template = String(dict?.[key] ?? fallback?.[key] ?? key);
    return interpolate(template, vars);
  }, [locale]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore.
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = t('app.title');
  }, [locale, t]);

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

