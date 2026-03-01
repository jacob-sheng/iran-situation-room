import { IntelNewsItem, IntelSignal, LLMSettings, NewsCategory, NewsScope, NewsItem } from '../types';
import { DEFAULT_MAP_CENTER } from '../constants';
import { extractMentions, pickBestMentionForFallback, resolveToCapital } from './placeMentions';
import { RSS_SOURCES_BY_SCOPE } from './rssSources';
import { canonicalizeUrl, fetchRssPool, type RssArticle } from './rssClient';

const FALLBACK_COORDINATES: [number, number] = DEFAULT_MAP_CENTER;

// Stable hash for IDs derived from URLs (keeps selection stable across refreshes).
function fnv1a32(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableNewsIdFromUrl(url: string) {
  const u = String(url || '').trim();
  if (!u) return '';
  return `news:${fnv1a32(u).toString(36)}`;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asSeverity(input: any): 'low' | 'medium' | 'high' {
  if (input === 'low' || input === 'medium' || input === 'high') return input;
  return 'medium';
}

function asKind(input: any): IntelSignal['kind'] {
  if (input === 'event' || input === 'movement' || input === 'infrastructure' || input === 'battle' || input === 'unit') return input;
  return 'event';
}

function isValidLonLat(coords: any): coords is [number, number] {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number' &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1]) &&
    coords[0] >= -180 &&
    coords[0] <= 180 &&
    coords[1] >= -90 &&
    coords[1] <= 90
  );
}

function pickBestUrlFromRss(title: string, rss: { title: string; link: string }[]) {
  const t = (title || '').toLowerCase();
  if (!t) return '';
  for (const item of rss) {
    const it = (item.title || '').toLowerCase();
    if (it && (it === t || it.includes(t) || t.includes(it))) return item.link;
  }
  return '';
}

function normalizeEvidence(evidence: any, snippet: string) {
  let ev = typeof evidence === 'string' ? evidence.trim() : '';
  if (ev.length > 120) ev = ev.slice(0, 120);
  if (!ev) return snippet.slice(0, 120);
  if (snippet && snippet.includes(ev)) return ev;

  // Try a looser match by stripping whitespace.
  const compactSnippet = snippet.replace(/\s+/g, ' ');
  const compactEv = ev.replace(/\s+/g, ' ');
  if (compactSnippet.includes(compactEv)) return compactEv.slice(0, 120);

  // As a last resort, force evidence to be a substring of the snippet.
  return snippet.slice(0, 120);
}

function asCategory(input: any): NewsCategory {
  const v = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (
    v === 'conflict' ||
    v === 'politics' ||
    v === 'economy' ||
    v === 'disaster' ||
    v === 'health' ||
    v === 'tech' ||
    v === 'science' ||
    v === 'energy' ||
    v === 'other'
  ) {
    return v;
  }
  return 'other';
}

function guessCategory(text: string): NewsCategory {
  const t = String(text || '').toLowerCase();
  if (!t) return 'other';
  if (/(strike|missile|drone|attack|war|battle|shell|air\s*raid|invasion|ceasefire|hostage|terror|military)/.test(t)) return 'conflict';
  if (/(election|parliament|president|prime\s*minister|diplomacy|sanction|treaty|protest|policy|vote)/.test(t)) return 'politics';
  if (/(market|stocks|inflation|gdp|trade|tariff|bank|interest\s*rate|oil\s*price|jobs|econom)/.test(t)) return 'economy';
  if (/(earthquake|hurricane|storm|flood|wildfire|tsunami|eruption|disaster|rescue)/.test(t)) return 'disaster';
  if (/(outbreak|virus|covid|flu|ebola|vaccine|who|health|disease)/.test(t)) return 'health';
  if (/(ai|chip|semiconductor|software|cyber|hack|iphone|google|microsoft|openai|tech)/.test(t)) return 'tech';
  if (/(nasa|space|rocket|telescope|research|study|science|quantum)/.test(t)) return 'science';
  if (/(oil|gas|pipeline|refinery|power\s*grid|nuclear|uranium|energy)/.test(t)) return 'energy';
  return 'other';
}

function buildCapitalFallback(title: string, snippet: string) {
  const mentions = extractMentions(`${title}\n${snippet}`);
  const picked = pickBestMentionForFallback(mentions);
  const cap = picked ? resolveToCapital(picked) : null;
  const coords = cap?.coordinates || FALLBACK_COORDINATES;
  const country = picked || undefined;
  return { mentions, picked, coords, country };
}

function buildPreviewSignal(title: string, snippet: string, fallback: { picked: string; coords: [number, number]; country?: string }) {
  const stableId = stableNewsIdFromUrl(title || snippet) || `sig-${Date.now().toString(36)}`;
  return {
    id: `sig-${stableId}-preview`,
    kind: 'event',
    title: title || 'Intel Update',
    description: snippet ? snippet.slice(0, 300) : '',
    severity: 'low',
    location: {
      name: fallback.picked || fallback.country || 'Unknown',
      country: fallback.country,
      coordinates: fallback.coords,
    },
    evidence: snippet.slice(0, 120),
    confidence: 0.05,
    verified: false,
    locationReliability: 'capital_fallback' as const,
  } satisfies IntelSignal;
}

function sanitizeLocation(loc: any, fallback: { picked: string; coords: [number, number]; country?: string }) {
  const name = String(loc?.name || '').trim() || fallback.picked || 'Unknown';
  const country = typeof loc?.country === 'string' ? loc.country.trim() : fallback.country;
  const coords = isValidLonLat(loc?.coordinates) ? (loc.coordinates as [number, number]) : fallback.coords;
  const usedFallback = !isValidLonLat(loc?.coordinates);
  return { name, country, coords, usedFallback };
}

export type FetchIntelNewsOptions = {
  mode?: 'initial' | 'refresh';
  scope?: NewsScope;
  excludeUrls?: string[];
  targetCount?: number;
  onPreview?: (items: IntelNewsItem[]) => void;
};

export async function fetchIntelNews(settings: LLMSettings, opts: FetchIntelNewsOptions = {}): Promise<IntelNewsItem[]> {
  if (!settings.endpoint || !settings.apiKey) {
    throw new Error('API Endpoint and Key are required. Please configure them in settings.');
  }

  const targetCount = Math.max(1, Math.floor(opts.targetCount ?? 10));
  const mode = opts.mode === 'initial' ? 'initial' : 'refresh';
  const scope: NewsScope = (opts.scope === 'americas' || opts.scope === 'europe' || opts.scope === 'africa' || opts.scope === 'middle_east' || opts.scope === 'asia_pacific')
    ? opts.scope
    : 'global';

  const exclude = new Set((opts.excludeUrls || []).map(u => canonicalizeUrl(u)).filter(Boolean));
  const depthCandidates = mode === 'initial' ? [20, 40, 80] : [10, 20, 40, 80];
  const sources = RSS_SOURCES_BY_SCOPE[scope] || RSS_SOURCES_BY_SCOPE.global;

  let rssArticles: RssArticle[] = [];
  for (const depth of depthCandidates) {
    try {
      const pool = await fetchRssPool({
        scope,
        sources,
        perSourceLimit: depth,
        maxTotal: 400,
        excludeUrls: exclude,
        minNeeded: targetCount * 6,
        concurrency: 4,
        timeBudgetMs: mode === 'initial' ? 5500 : 3500,
      });

      if (pool.length >= targetCount) {
        rssArticles = pool.slice(0, targetCount);
        break;
      }
      rssArticles = pool;
    } catch {
      // Try next depth.
      rssArticles = [];
    }
  }

  if (rssArticles.length === 0) {
    // Keep the "no invented content" guarantee.
    return [];
  }

  const allowedUrls = new Set(rssArticles.map(a => a.link));
  const snippetByUrl = new Map(rssArticles.map(a => [a.link, a.snippet] as const));
  const sourceByUrl = new Map(rssArticles.map(a => [a.link, a.source] as const));
  const mentionsByUrl = new Map<string, Array<{ name: string; country?: string }>>();
  const fallbackByUrl = new Map<string, { mentions: Array<{ name: string; country?: string }>; picked: string; coords: [number, number]; country?: string }>();
  const categoryByUrl = new Map<string, NewsCategory>();

  for (const a of rssArticles) {
    const m = buildCapitalFallback(a.title, a.snippet);
    mentionsByUrl.set(a.link, m.mentions);
    fallbackByUrl.set(a.link, m);
    categoryByUrl.set(a.link, guessCategory(`${a.title}\n${a.snippet}`));
  }

  // Emit a fast RSS-based preview immediately, so UI can render real items while waiting for the LLM.
  if (typeof opts.onPreview === 'function') {
    try {
      const preview: IntelNewsItem[] = rssArticles.map((a, i) => {
        const stableId = stableNewsIdFromUrl(a.link) || `news-preview-${i}`;
        const snippet = a.snippet || '';
        const fallback = fallbackByUrl.get(a.link) || buildCapitalFallback(a.title, a.snippet);
        return {
          id: stableId,
          title: a.title,
          summary: snippet ? snippet.slice(0, 220) : '',
          source: a.source || 'Unknown',
          url: a.link,
          timestamp: a.pubDate || new Date().toISOString(),
          signals: [buildPreviewSignal(a.title, snippet, fallback)],
          scope,
          category: categoryByUrl.get(a.link) || 'other',
          isPreview: true,
          mentions: fallback.mentions,
        };
      });
      opts.onPreview(preview);
    } catch {
      // Preview is best-effort.
    }
  }

  const allowedSources = Array.from(new Set(rssArticles.map(a => a.source))).filter(Boolean).sort();

  const system = [
    'You are a real-time intelligence analyst.',
    `You will be given ${rssArticles.length} RSS articles about global breaking news from multiple sources.`,
    `Generate exactly ${rssArticles.length} news items (one per provided RSS article) and return ONLY a valid JSON array (no markdown).`,
    '',
    'Each news item MUST be an object with keys:',
    '- id (string)',
    '- title (string)',
    '- summary (string, 1-2 sentences)',
    '- category (string, one of: conflict|politics|economy|disaster|health|tech|science|energy|other)',
    '- source (string, MUST match the source name of the chosen url)',
    '- url (string, MUST be one of the provided RSS links)',
    '- timestamp (string, ISO-like date or best-effort)',
    '- signals (array, at least 1 element)',
    '',
    'Each signal MUST be an object with keys:',
    '- id (string)',
    '- kind ("event" | "movement" | "infrastructure" | "battle" | "unit")',
    '- title (string)',
    '- description (string)',
    '- severity ("low" | "medium" | "high")',
    '- location (object): { name (string), country (string optional), coordinates ([lon, lat]) }',
    '- evidence (string, MUST be copied as a direct substring from the provided article snippet, <= 120 chars)',
    '- confidence (number 0..1)',
    '',
    'Optional keys (use them when relevant):',
    '- movement (object) for kind="movement": { from?: location, to: location }',
    '- unit (object) for kind="movement" or kind="unit": { id?: string, name?: string, type?: "military"|"naval"|"air"|"base", affiliation?: "iran"|"us"|"allied"|"israel"|"other" }',
    '- infra (object) for kind="infrastructure": { name?: string, type?: "oil"|"nuclear"|"military_base"|"civilian", status?: "intact"|"damaged"|"destroyed" }',
    '- battle (object) for kind="battle": { type?: "kill"|"strike"|"capture" }',
    '',
    'Notes:',
    '- coordinates MUST be [longitude, latitude].',
    '- url MUST come from the provided RSS links list. Do not invent URLs.',
    '- Keep url and source exactly as provided for each article.',
    '- If kind="movement", include movement.to (it can be the same as location).',
    '- If you are unsure about the exact city, use the best country/region mentioned in the article and provide coordinates near its capital.',
    '- Do not include any markdown formatting like ```json.',
  ].join('\n');

  const userPayload = {
    rss: rssArticles.map(a => ({
      id: `rss-${a.index}`,
      title: a.title,
      url: a.link,
      timestamp: a.pubDate,
      snippet: (a.snippet || '').slice(0, 500),
      source: a.source,
      scope: a.scope,
    })),
    allowed_urls: rssArticles.map(a => a.link),
    allowed_sources: allowedSources,
  };

  const response = await fetch(`${settings.endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `RSS_ARTICLES_JSON:\n${JSON.stringify(userPayload)}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();
  const text: string | undefined = data.choices?.[0]?.message?.content;
  if (!text) return [];

  const cleanedText = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const outByUrl = new Map<string, IntelNewsItem>();
  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i] || {};
    const title = String(raw.title || '').trim();
    const summary = String(raw.summary || '').trim();
    const timestamp = String(raw.timestamp || '').trim();
    let source = String(raw.source || '').trim();
    let url = canonicalizeUrl(String(raw.url || '').trim());

    if (allowedUrls.size > 0 && url && !allowedUrls.has(url)) {
      const picked = pickBestUrlFromRss(title, rssArticles);
      if (picked) url = picked;
    }
    if (!url && rssArticles[i]?.link) url = rssArticles[i].link;
    if (allowedUrls.size > 0 && (!url || !allowedUrls.has(url))) continue;

    const stableId = stableNewsIdFromUrl(url) || String(raw.id || `news-${i}`).trim() || `news-${i}`;

    const snippet = snippetByUrl.get(url) || '';
    const mappedSource = sourceByUrl.get(url);
    if (mappedSource) source = mappedSource;
    if (!source) source = mappedSource || 'Unknown';

    const fallback = fallbackByUrl.get(url) || buildCapitalFallback(title, snippet);
    const mentions = mentionsByUrl.get(url) || fallback.mentions;

    const rawSignals = Array.isArray(raw.signals) ? raw.signals : [];
    const signals: IntelSignal[] = [];

    for (let j = 0; j < rawSignals.length; j++) {
      const s = rawSignals[j] || {};
      const kind = asKind(s.kind);
      const sev = asSeverity(s.severity);

      const loc = s.location || {};
      const locSan = sanitizeLocation(loc, fallback);
      const confidence = clamp01(Number(s.confidence));

      const signal: IntelSignal = {
        id: String(s.id || `sig-${stableId}-${j}`).trim() || `sig-${stableId}-${j}`,
        kind,
        title: String(s.title || title || 'Signal').trim() || 'Signal',
        description: String(s.description || '').trim() || summary || '',
        severity: sev,
        location: {
          name: locSan.name,
          country: locSan.country,
          coordinates: locSan.coords,
        },
        movement: s.movement,
        unit: s.unit,
        infra: s.infra,
        battle: s.battle,
        evidence: normalizeEvidence(s.evidence, snippet),
        confidence,
        verified: typeof s.verified === 'boolean' ? s.verified : undefined,
        locationReliability: locSan.usedFallback ? 'capital_fallback' : 'llm_inferred',
      };

      // Sanitize movement endpoints (best-effort, still sourced).
      if (signal.movement) {
        const from = signal.movement.from;
        const to = signal.movement.to;
        if (from) {
          const sFrom = sanitizeLocation(from, fallback);
          signal.movement = { ...signal.movement, from: { name: sFrom.name, country: sFrom.country, coordinates: sFrom.coords } };
        }
        if (to) {
          const sTo = sanitizeLocation(to, fallback);
          signal.movement = { ...signal.movement, to: { name: sTo.name, country: sTo.country, coordinates: sTo.coords } };
        }
      }

      // Ensure evidence constraint.
      if (!signal.evidence) signal.evidence = snippet.slice(0, 120);
      signals.push(signal);
    }

    if (signals.length === 0) {
      const snippetSafe = snippet || '';
      signals.push({
        id: `sig-${stableId}-0`,
        kind: 'event',
        title: title || 'Intel Update',
        description: summary || snippetSafe.slice(0, 300),
        severity: 'low',
        location: {
          name: fallback.picked || fallback.country || 'Unknown',
          country: fallback.country,
          coordinates: fallback.coords,
        },
        evidence: snippetSafe.slice(0, 120),
        confidence: 0.1,
        verified: false,
        locationReliability: 'capital_fallback',
      });
    }

    const cat = asCategory(raw.category) || categoryByUrl.get(url) || guessCategory(`${title}\n${snippet}`);

    const item: IntelNewsItem = {
      id: stableId,
      title,
      summary,
      source,
      url,
      timestamp,
      signals,
      scope,
      category: cat,
      isPreview: false,
      mentions,
    };

    if (url && !outByUrl.has(url)) outByUrl.set(url, item);
  }

  const final: IntelNewsItem[] = [];
  for (let i = 0; i < rssArticles.length; i++) {
    const a = rssArticles[i];
    const existing = outByUrl.get(a.link);
    if (existing) {
      final.push(existing);
      continue;
    }

    const stableId = stableNewsIdFromUrl(a.link) || `news-fallback-${i}`;
    const snippet = a.snippet || '';
    const fallback = fallbackByUrl.get(a.link) || buildCapitalFallback(a.title, a.snippet);
    final.push({
      id: stableId,
      title: a.title,
      summary: snippet ? snippet.slice(0, 220) : '',
      source: a.source || 'Unknown',
      url: a.link,
      timestamp: a.pubDate || new Date().toISOString(),
      scope,
      category: categoryByUrl.get(a.link) || guessCategory(`${a.title}\n${snippet}`),
      isPreview: false,
      mentions: fallback.mentions,
      signals: [
        {
          id: `sig-${stableId}-0`,
          kind: 'event',
          title: a.title || 'Intel Update',
          description: snippet ? snippet.slice(0, 300) : '',
          severity: 'low',
          location: {
            name: fallback.picked || fallback.country || 'Unknown',
            country: fallback.country,
            coordinates: fallback.coords,
          },
          evidence: snippet.slice(0, 120),
          confidence: 0.05,
          verified: false,
          locationReliability: 'capital_fallback',
        },
      ],
    });
  }

  return final.slice(0, targetCount);
}

// Legacy API (not used by the current UI, kept for reference).
export async function fetchLatestNews(settings: LLMSettings): Promise<NewsItem[]> {
  if (!settings.endpoint || !settings.apiKey) {
    throw new Error('API Endpoint and Key are required. Please configure them in settings.');
  }

  try {
    const response = await fetch(`${settings.endpoint.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Provide the 5 latest global breaking news items. Return ONLY a valid JSON array of objects with keys: id, title, summary, source, url, timestamp.'
          },
          {
            role: 'user',
            content: 'Latest news updates please.'
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return [];

    const cleanedText = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    return Array.isArray(parsed) ? (parsed as NewsItem[]) : [];
  } catch (error) {
    console.error('Error fetching news from LLM:', error);
    throw error;
  }
}
