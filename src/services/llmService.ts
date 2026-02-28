import { IntelNewsItem, IntelSignal, LLMSettings, NewsItem } from '../types';

const FALLBACK_IRAN_COORDINATES: [number, number] = [53.6880, 32.4279];

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

async function fetchRssArticles() {
  const rssUrl = encodeURIComponent('https://feeds.bbci.co.uk/news/world/middle_east/rss.xml');
  const rssRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
  const rssData = await rssRes.json();
  const items = Array.isArray(rssData?.items) ? rssData.items : [];
  const articles = items.slice(0, 10).map((item: any, index: number) => {
    const title = String(item?.title || '').trim();
    const link = String(item?.link || '').trim();
    const pubDate = String(item?.pubDate || item?.publishedDate || item?.date || '').trim();
    const snippet = stripHtml(String(item?.description || item?.content || ''));
    return { index, title, link, pubDate, snippet };
  }).filter((a: any) => a.title && a.link);
  return articles;
}

export async function fetchIntelNews(settings: LLMSettings): Promise<IntelNewsItem[]> {
  if (!settings.endpoint || !settings.apiKey) {
    throw new Error('API Endpoint and Key are required. Please configure them in settings.');
  }

  let rssArticles: { index: number; title: string; link: string; pubDate: string; snippet: string }[] = [];
  try {
    rssArticles = await fetchRssArticles();
  } catch {
    // Ignore RSS errors and let the LLM rely on its own knowledge (lower quality).
    rssArticles = [];
  }

  const allowedUrls = new Set(rssArticles.map(a => a.link));
  const snippetByUrl = new Map(rssArticles.map(a => [a.link, a.snippet] as const));

  const system = [
    'You are a military intelligence analyst.',
    'You will be given up to 10 RSS articles about the Middle East / Iran situation.',
    'Pick the 5 most important items and return ONLY a valid JSON array (no markdown).',
    '',
    'Each news item MUST be an object with keys:',
    '- id (string)',
    '- title (string)',
    '- summary (string, 1-2 sentences)',
    '- source (string, e.g. "BBC")',
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
    '- If kind="movement", include movement.to (it can be the same as location).',
    '- Do not include any markdown formatting like ```json.',
  ].join('\n');

  const userPayload = {
    rss: rssArticles.map(a => ({
      id: `rss-${a.index}`,
      title: a.title,
      url: a.link,
      timestamp: a.pubDate,
      snippet: a.snippet.slice(0, 500),
    })),
    allowed_urls: rssArticles.map(a => a.link),
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
  const text: string | undefined = data.choices[0]?.message?.content;
  if (!text) return [];

  const cleanedText = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (e) {
    console.error('Failed to parse LLM response as JSON', e, cleanedText);
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const out: IntelNewsItem[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i] || {};
    const title = String(raw.title || '').trim();
    const summary = String(raw.summary || '').trim();
    const source = String(raw.source || 'BBC').trim() || 'BBC';
    let url = String(raw.url || '').trim();
    const timestamp = String(raw.timestamp || '').trim();
    const id = String(raw.id || `news-${i}`).trim() || `news-${i}`;

    if (url && !allowedUrls.has(url)) {
      const picked = pickBestUrlFromRss(title, rssArticles);
      if (picked) url = picked;
    }
    if (!url && rssArticles[i]?.link) url = rssArticles[i].link;

    const snippet = snippetByUrl.get(url) || '';
    const rawSignals = Array.isArray(raw.signals) ? raw.signals : [];
    const signals: IntelSignal[] = [];

    for (let j = 0; j < rawSignals.length; j++) {
      const s = rawSignals[j] || {};
      const kind = asKind(s.kind);
      const sev = asSeverity(s.severity);
      const loc = s.location || {};
      const locName = String(loc.name || '').trim() || title || 'Unknown';
      const locCountry = typeof loc.country === 'string' ? loc.country.trim() : undefined;
      const coords = isValidLonLat(loc.coordinates) ? (loc.coordinates as [number, number]) : FALLBACK_IRAN_COORDINATES;
      const confidence = clamp01(Number(s.confidence));

      const signal: IntelSignal = {
        id: String(s.id || `sig-${id}-${j}`).trim() || `sig-${id}-${j}`,
        kind,
        title: String(s.title || title || 'Signal').trim() || 'Signal',
        description: String(s.description || '').trim() || summary || '',
        severity: sev,
        location: {
          name: locName,
          country: locCountry,
          coordinates: coords,
        },
        movement: s.movement,
        unit: s.unit,
        infra: s.infra,
        battle: s.battle,
        evidence: normalizeEvidence(s.evidence, snippet),
        confidence,
        verified: typeof s.verified === 'boolean' ? s.verified : undefined,
      };

      // Ensure evidence constraint and a usable location.
      if (!signal.location.coordinates) signal.location.coordinates = FALLBACK_IRAN_COORDINATES;
      if (!signal.evidence) signal.evidence = snippet.slice(0, 120);
      signals.push(signal);
    }

    if (signals.length === 0) {
      signals.push({
        id: `sig-${id}-0`,
        kind: 'event',
        title: title || 'Intel Update',
        description: summary || '',
        severity: 'low',
        location: {
          name: 'Iran',
          coordinates: FALLBACK_IRAN_COORDINATES,
        },
        evidence: snippet.slice(0, 120),
        confidence: 0.1,
      });
    }

    out.push({
      id,
      title,
      summary,
      source,
      url,
      timestamp,
      signals,
    });
  }

  return out.slice(0, 5);
}

export async function fetchLatestNews(settings: LLMSettings): Promise<NewsItem[]> {
  if (!settings.endpoint || !settings.apiKey) {
    throw new Error('API Endpoint and Key are required. Please configure them in settings.');
  }

  // Fetch real-time context from public RSS to feed the LLM
  let realTimeContext = "";
  try {
    const rssUrl = encodeURIComponent('https://feeds.bbci.co.uk/news/world/middle_east/rss.xml');
    const rssRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    const rssData = await rssRes.json();
    if (rssData.status === 'ok' && rssData.items) {
      const articles = rssData.items.slice(0, 10).map((item: any) => `- ${item.title}: ${item.description} (${item.link})`).join('\n');
      realTimeContext = `\n\nHere is the latest real-time news context retrieved just now:\n${articles}\n\nPlease summarize and select the 5 most important items from this context.`;
    }
  } catch (e) {
    console.warn("Could not fetch RSS feed, relying on LLM internal knowledge.");
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
            content: 'You are a military intelligence analyst. Provide the 5 latest news items about the Middle East/Iran situation. Return ONLY a valid JSON array of objects with keys: id (string), title (string), summary (string), source (string), url (string), timestamp (string). Do not include any markdown formatting like ```json.' 
          },
          { 
            role: 'user', 
            content: `Latest news updates please.${realTimeContext}` 
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content;
    
    if (!text) return [];

    try {
      // Clean up potential markdown formatting if the LLM ignored the instruction
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) {
        return parsed as NewsItem[];
      }
      return [];
    } catch (e) {
      console.error('Failed to parse LLM response as JSON', e, text);
      return [];
    }
  } catch (error) {
    console.error('Error fetching news from LLM:', error);
    throw error;
  }
}
