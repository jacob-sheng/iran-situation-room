import type { NewsScope } from '../types';
import type { RssSource } from './rssSources';

export type RssArticle = {
  index: number;
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  source: string;
  scope: NewsScope;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(id);
  }
}

export function canonicalizeUrl(url: string) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    u.hash = '';
    const params = u.searchParams;
    for (const key of Array.from(params.keys())) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_')) params.delete(key);
    }
    params.delete('fbclid');
    params.delete('gclid');
    params.delete('igshid');
    params.delete('mc_cid');
    params.delete('mc_eid');
    return u.toString();
  } catch {
    return raw.split('#')[0].trim();
  }
}

function stripHtml(input: string) {
  return String(input || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateMs(ts: string) {
  const n = Date.parse(ts || '');
  return Number.isFinite(n) ? n : 0;
}

type ParsedFeedItem = { title: string; link: string; pubDate: string; snippet: string; source: string; scope: NewsScope };

function parseXmlFeed(xmlText: string, source: string, scope: NewsScope): ParsedFeedItem[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid XML');
  }

  const escapeNs = (tag: string) => tag.replace(/:/g, '\\:');
  const pickText = (root: ParentNode, tags: string[]) => {
    for (const t of tags) {
      const el = root.querySelector(escapeNs(t));
      const text = el?.textContent ? String(el.textContent).trim() : '';
      if (text) return text;
    }
    return '';
  };

  const out: ParsedFeedItem[] = [];

  const rssItems = Array.from(doc.querySelectorAll('item'));
  if (rssItems.length > 0) {
    for (const item of rssItems) {
      const title = pickText(item, ['title']);
      const link = canonicalizeUrl(pickText(item, ['link']));
      const pubDate = pickText(item, ['pubDate', 'dc:date']);
      const snippet = stripHtml(pickText(item, ['description', 'content:encoded']));
      if (!title || !link) continue;
      out.push({ title, link, pubDate, snippet, source, scope });
    }
    return out;
  }

  const atomEntries = Array.from(doc.querySelectorAll('entry'));
  for (const entry of atomEntries) {
    const title = pickText(entry, ['title']);
    const pubDate = pickText(entry, ['updated', 'published']);
    const snippet = stripHtml(pickText(entry, ['summary', 'content']));
    const linkEl =
      entry.querySelector('link[rel="alternate"][href]') ||
      entry.querySelector('link[href]') ||
      entry.querySelector('link');
    const link = canonicalizeUrl(String((linkEl as any)?.getAttribute?.('href') || linkEl?.textContent || '').trim());
    if (!title || !link) continue;
    out.push({ title, link, pubDate, snippet, source, scope });
  }
  return out;
}

async function fetchFeedViaRss2Json(src: RssSource, limit: number) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(src.url)}&count=${encodeURIComponent(String(limit))}`;
  const res = await fetchWithTimeout(api, { headers: { 'accept': 'application/json' } }, 7000);
  const data = await res.json();
  if (!data || data.status !== 'ok' || !Array.isArray(data.items)) {
    throw new Error('rss2json error');
  }
  return data.items.slice(0, limit).map((item: any) => {
    const title = String(item?.title || '').trim();
    const link = canonicalizeUrl(String(item?.link || '').trim());
    const pubDate = String(item?.pubDate || item?.publishedDate || item?.date || '').trim();
    const snippet = stripHtml(String(item?.description || item?.content || ''));
    return { title, link, pubDate, snippet, source: src.name, scope: src.scope };
  }).filter((a: any) => a.title && a.link);
}

async function fetchFeedViaAllOrigins(src: RssSource, limit: number) {
  const target = `https://api.allorigins.win/raw?url=${encodeURIComponent(src.url)}`;
  let lastErr: unknown = null;
  // Keep retries small; global fetch has its own time budget.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(target, { headers: { 'accept': '*/*' } }, 7500);
      const text = await res.text();
      const parsed = parseXmlFeed(text, src.name, src.scope);
      return parsed.slice(0, limit);
    } catch (e) {
      lastErr = e;
      await sleep(350 + attempt * 550);
    }
  }
  throw lastErr || new Error('allorigins error');
}

async function fetchFeedItems(src: RssSource, limit: number) {
  try {
    const via = await fetchFeedViaRss2Json(src, limit);
    if (via.length > 0) return via;
  } catch {
    // fall through
  }
  return await fetchFeedViaAllOrigins(src, limit);
}

async function tryFetchServerPool(opts: {
  scope: NewsScope;
  perSourceLimit: number;
  maxTotal: number;
  timeoutMs: number;
}): Promise<ParsedFeedItem[] | null> {
  // Same-origin probe only. If you run a full-stack deployment, this will exist.
  try {
    const health = await fetchWithTimeout('/api/rss/health', { headers: { 'accept': 'application/json' } }, Math.min(900, opts.timeoutMs));
    if (!health.ok) return null;

    const url = `/api/rss/articles?scope=${encodeURIComponent(opts.scope)}&perSourceLimit=${encodeURIComponent(String(opts.perSourceLimit))}&maxTotal=${encodeURIComponent(String(opts.maxTotal))}`;
    const res = await fetchWithTimeout(url, { headers: { 'accept': 'application/json' } }, opts.timeoutMs);
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data?.items) ? data.items : [];
    return list.map((it: any) => ({
      title: String(it?.title || '').trim(),
      link: canonicalizeUrl(String(it?.link || '').trim()),
      pubDate: String(it?.pubDate || '').trim(),
      snippet: String(it?.snippet || '').trim(),
      source: String(it?.source || '').trim(),
      scope: (it?.scope === 'global' || it?.scope === 'americas' || it?.scope === 'europe' || it?.scope === 'africa' || it?.scope === 'middle_east' || it?.scope === 'asia_pacific')
        ? it.scope
        : opts.scope,
    })).filter((a: any) => a.title && a.link);
  } catch {
    return null;
  }
}

export async function fetchRssPool(opts: {
  scope: NewsScope;
  sources: RssSource[];
  perSourceLimit: number;
  maxTotal: number;
  excludeUrls?: Set<string>;
  minNeeded?: number;
  concurrency?: number;
  timeBudgetMs?: number;
}): Promise<RssArticle[]> {
  const perSourceLimit = Math.max(1, Math.floor(opts.perSourceLimit));
  const maxTotal = Math.max(1, Math.floor(opts.maxTotal));
  const minNeeded = Math.max(1, Math.floor(opts.minNeeded ?? 1));
  const concurrency = Math.max(1, Math.floor(opts.concurrency ?? 4));
  const timeBudgetMs = Math.max(500, Math.floor(opts.timeBudgetMs ?? 3500));
  const scope = opts.scope;
  const exclude = opts.excludeUrls || new Set<string>();

  // Prefer server pool if available (full-stack deployment). It is faster and more stable.
  const serverPool = await tryFetchServerPool({ scope, perSourceLimit, maxTotal, timeoutMs: Math.min(3500, timeBudgetMs) });
  if (serverPool && serverPool.length > 0) {
    const byLink = new Map<string, ParsedFeedItem>();
    for (const it of serverPool) {
      const link = canonicalizeUrl(it.link);
      if (!link || exclude.has(link)) continue;
      if (!byLink.has(link)) byLink.set(link, { ...it, link });
      if (byLink.size >= maxTotal) break;
    }
    const list = Array.from(byLink.values());
    list.sort((a, b) => parseDateMs(b.pubDate) - parseDateMs(a.pubDate));
    return list.slice(0, maxTotal).map((it, index) => ({ index, title: it.title, link: it.link, pubDate: it.pubDate, snippet: it.snippet, source: it.source, scope: it.scope }));
  }

  const start = Date.now();
  const stop = { value: false };

  const byLink = new Map<string, ParsedFeedItem>();
  const sources = Array.isArray(opts.sources) ? [...opts.sources] : [];
  let cursor = 0;

  const nextSource = () => {
    if (cursor >= sources.length) return null;
    return sources[cursor++];
  };

  const worker = async () => {
    while (!stop.value) {
      if (Date.now() - start > timeBudgetMs) {
        stop.value = true;
        break;
      }
      const src = nextSource();
      if (!src) break;

      try {
        const items = await fetchFeedItems(src, perSourceLimit);
        for (const it of items) {
          const title = String(it?.title || '').trim();
          const link = canonicalizeUrl(String(it?.link || '').trim());
          if (!title || !link) continue;
          if (exclude.has(link)) continue;
          if (!byLink.has(link)) {
            byLink.set(link, { ...it, title, link, source: String(it?.source || src.name).trim(), scope: src.scope });
            if (byLink.size >= minNeeded && byLink.size >= maxTotal) {
              stop.value = true;
              break;
            }
            if (byLink.size >= minNeeded) {
              // Early stop once we have enough unique items.
              stop.value = true;
              break;
            }
          }
        }
      } catch {
        // Ignore per-source failures.
      }
    }
  };

  await Promise.race([
    Promise.all(Array.from({ length: concurrency }, () => worker())),
    sleep(timeBudgetMs).then(() => { stop.value = true; }),
  ]);

  const list = Array.from(byLink.values());
  list.sort((a, b) => parseDateMs(b.pubDate) - parseDateMs(a.pubDate));
  return list.slice(0, maxTotal).map((it, index) => ({
    index,
    title: it.title,
    link: it.link,
    pubDate: it.pubDate,
    snippet: it.snippet,
    source: it.source,
    scope: it.scope,
  }));
}
