import { IntelLocation } from '../types';

const NOMINATIM_BASE = 'https://nominatim.terrestris.de';
const MIN_INTERVAL_MS = 1100;
const STORAGE_KEY = 'geocode-cache:v1';
const STORAGE_MAX_ENTRIES = 200;

type VerifyResult = {
  location: IntelLocation;
  verified: boolean;
};

const memCache = new Map<string, VerifyResult>();
let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesLoose(haystack: string, needle: string) {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (!h || !n) return false;
  return h.includes(n);
}

function roundCoord(n: number, digits = 4) {
  const m = Math.pow(10, digits);
  return Math.round(n * m) / m;
}

function loadPersistentCache() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v !== 'object') continue;
      const loc = (v as any).location;
      const verified = Boolean((v as any).verified);
      if (!loc || typeof loc !== 'object') continue;
      if (!Array.isArray((loc as any).coordinates) || (loc as any).coordinates.length !== 2) continue;
      memCache.set(k, { location: loc as IntelLocation, verified });
    }
  } catch {
    // Ignore cache corruption.
  }
}

function savePersistentCache() {
  try {
    if (typeof localStorage === 'undefined') return;
    const entries = Array.from(memCache.entries()).slice(-STORAGE_MAX_ENTRIES);
    const obj: Record<string, VerifyResult> = {};
    for (const [k, v] of entries) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Storage may be unavailable or full; ignore.
  }
}

loadPersistentCache();

async function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now);
    if (wait > 0) await sleep(wait);
    const out = await fn();
    lastRequestAt = Date.now();
    return out;
  };

  const p = requestChain.then(run, run) as Promise<T>;
  requestChain = p.then(() => undefined, () => undefined);
  return p;
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Geocode error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function isValidLonLat(coords: [number, number]) {
  const [lon, lat] = coords;
  return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

export async function verifyIntelLocation(input: IntelLocation): Promise<VerifyResult> {
  const lon = roundCoord(input.coordinates[0]);
  const lat = roundCoord(input.coordinates[1]);
  const cacheKey = `v1|${normalizeText(input.name)}|${normalizeText(input.country || '')}|${lon},${lat}`;

  const cached = memCache.get(cacheKey);
  if (cached) return cached;

  // If coordinates are obviously invalid, skip reverse and try search directly.
  const shouldReverse = isValidLonLat([lon, lat]);

  const result = await queued(async () => {
    let reverseOk = false;
    let reverseCountry: string | undefined;

    if (shouldReverse) {
      try {
        const reverseUrl = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`;
        const reverse = await fetchJson(reverseUrl);
        const display = String(reverse?.display_name || '');
        const address = reverse?.address || {};
        reverseCountry = typeof address?.country === 'string' ? address.country : undefined;

        // Loose checks: country match (if provided) + place name appears somewhere in reverse result.
        const countryOk = input.country ? includesLoose(reverseCountry || '', input.country) : true;
        const nameOk =
          includesLoose(display, input.name) ||
          includesLoose(String(address?.city || ''), input.name) ||
          includesLoose(String(address?.town || ''), input.name) ||
          includesLoose(String(address?.state || ''), input.name) ||
          includesLoose(String(address?.county || ''), input.name);

        reverseOk = Boolean(countryOk && nameOk);
        if (reverseOk) {
          const verifiedLoc: IntelLocation = {
            name: input.name,
            country: input.country || reverseCountry,
            coordinates: [lon, lat],
          };
          return { location: verifiedLoc, verified: true } as VerifyResult;
        }
      } catch {
        // Ignore reverse errors; fall back to search.
      }
    }

    // Search fallback.
    try {
      const q = input.country ? `${input.name}, ${input.country}` : input.name;
      const searchUrl = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=1`;
      const list = await fetchJson(searchUrl);
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        const slat = Number(first?.lat);
        const slon = Number(first?.lon);
        if (Number.isFinite(slat) && Number.isFinite(slon) && isValidLonLat([slon, slat])) {
          const verifiedLoc: IntelLocation = {
            name: input.name,
            country: input.country || reverseCountry,
            coordinates: [slon, slat],
          };
          return { location: verifiedLoc, verified: true } as VerifyResult;
        }
      }
    } catch {
      // Ignore.
    }

    // No verification.
    const unverifiedLoc: IntelLocation = {
      ...input,
      country: input.country || reverseCountry,
      coordinates: input.coordinates,
    };
    return { location: unverifiedLoc, verified: false } as VerifyResult;
  });

  memCache.set(cacheKey, result);
  savePersistentCache();
  return result;
}

