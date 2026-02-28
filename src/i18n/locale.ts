import type { Locale } from './messages';

export function normalizeLocale(input: string | null | undefined): Locale {
  const s = String(input || '').trim().toLowerCase();
  if (s.startsWith('zh')) return 'zh';
  return 'en';
}

export function isLocale(input: unknown): input is Locale {
  return input === 'en' || input === 'zh';
}

