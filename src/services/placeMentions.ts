import { CAPITALS_BY_COUNTRY } from '../data/capitals';

export type PlaceMention = { name: string; country?: string };

function normalizeKey(input: string) {
  return String(input || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const EXTRA_CAPITALS: Record<string, { capital: string; coordinates: [number, number] }> = {
  'European Union': { capital: 'Brussels', coordinates: [4.3517, 50.8503] },
  'EU': { capital: 'Brussels', coordinates: [4.3517, 50.8503] },
  'Gaza Strip': { capital: 'Gaza City', coordinates: [34.4667, 31.5167] },
  'Gaza': { capital: 'Gaza City', coordinates: [34.4667, 31.5167] },
};

// Aliases map to canonical country/region names used by CAPITALS_BY_COUNTRY.
const COUNTRY_ALIASES: Record<string, string> = {
  // United States
  'us': 'United States',
  'u s': 'United States',
  'u s a': 'United States',
  'usa': 'United States',
  'united states': 'United States',
  'united states of america': 'United States',
  'u s of a': 'United States',

  // United Kingdom
  'uk': 'United Kingdom',
  'u k': 'United Kingdom',
  'united kingdom': 'United Kingdom',
  'britain': 'United Kingdom',
  'great britain': 'United Kingdom',

  // Russia
  'russia': 'Russia',
  'russian federation': 'Russia',

  // Iran
  'iran': 'Iran',
  'islamic republic of iran': 'Iran',

  // Korea
  'south korea': 'South Korea',
  'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  'dprk': 'North Korea',
  'democratic people s republic of korea': 'North Korea',

  // China
  'prc': 'China',
  'people s republic of china': 'China',
  'mainland china': 'China',

  // EU / Gaza
  'eu': 'European Union',
  'european union': 'European Union',
  'gaza': 'Gaza Strip',
  'gaza strip': 'Gaza Strip',
};

function getAllCanonicalCountries() {
  return Object.keys(CAPITALS_BY_COUNTRY);
}

const CANONICAL_SET = new Set(getAllCanonicalCountries());

function toCanonicalCountry(input: string) {
  const key = normalizeKey(input);
  if (!key) return '';
  const mapped = COUNTRY_ALIASES[key];
  if (mapped) return mapped;

  // Try to match exact canonical name (case-insensitive/normalized).
  for (const name of CANONICAL_SET) {
    if (normalizeKey(name) === key) return name;
  }

  return '';
}

type AliasPattern = { alias: string; canonical: string; re: RegExp };

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAliasPatterns(): AliasPattern[] {
  const patterns: AliasPattern[] = [];

  const add = (alias: string, canonical: string) => {
    const a = String(alias || '').trim();
    const c = String(canonical || '').trim();
    if (!a || !c) return;
    const raw = a.toLowerCase();

    // Use a "soft" boundary to avoid matching inside words (e.g. "us" in "thus").
    const boundary = '(^|[^a-z0-9])';
    const tail = '([^a-z0-9]|$)';
    const body = escapeRegex(raw);
    const re = new RegExp(boundary + body + tail, 'i');
    patterns.push({ alias: a, canonical: c, re });
  };

  // Canonical country names.
  for (const c of CANONICAL_SET) add(c, c);

  // Extra regions.
  for (const k of Object.keys(EXTRA_CAPITALS)) add(k, k);

  // Aliases.
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) add(alias, canonical);

  // Prefer longer matches first (prevents partial matches in sorting by index ties).
  patterns.sort((a, b) => b.alias.length - a.alias.length);
  return patterns;
}

const ALIAS_PATTERNS = buildAliasPatterns();

export function extractMentions(text: string): PlaceMention[] {
  const src = String(text || '');
  if (!src.trim()) return [];

  const hits: Array<{ index: number; canonical: string }> = [];
  for (const p of ALIAS_PATTERNS) {
    const m = p.re.exec(src);
    if (!m) continue;
    hits.push({ index: m.index, canonical: p.canonical });
  }

  hits.sort((a, b) => a.index - b.index || a.canonical.localeCompare(b.canonical));

  const out: PlaceMention[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.canonical)) continue;
    seen.add(h.canonical);
    out.push({ name: h.canonical, country: h.canonical });
    if (out.length >= 8) break;
  }
  return out;
}

export function resolveToCapital(countryOrRegion: string): { name: string; coordinates: [number, number] } | null {
  const canonical = toCanonicalCountry(countryOrRegion) || countryOrRegion;
  const extra = EXTRA_CAPITALS[canonical];
  if (extra) return { name: extra.capital, coordinates: extra.coordinates };

  const row = (CAPITALS_BY_COUNTRY as any)[canonical] as { capital: string; coordinates: [number, number] } | undefined;
  if (!row) return null;
  return { name: row.capital, coordinates: row.coordinates };
}

export function pickBestMentionForFallback(mentions: PlaceMention[]) {
  if (!Array.isArray(mentions) || mentions.length === 0) return '';
  // First mention is typically the most relevant (ordered by appearance).
  return String(mentions[0]?.country || mentions[0]?.name || '').trim();
}
