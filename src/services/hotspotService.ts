import type { Hotspot, IntelNewsItem, IntelSignal, NewsCategory } from '../types';

export const DEFAULT_HOTSPOT_CELL_SIZE_DEG = 4;

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
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

function pickBestSignal(signals: IntelSignal[] | undefined) {
  if (!Array.isArray(signals) || signals.length === 0) return null;
  let best: IntelSignal | null = null;
  let bestScore = -1;
  for (const s of signals) {
    const c = clamp01(Number((s as any)?.confidence));
    if (c > bestScore) {
      bestScore = c;
      best = s;
    }
  }
  return best;
}

export function getPrimaryCoordinatesForNews(item: IntelNewsItem): [number, number] | null {
  const best = pickBestSignal(item.signals || []);
  const coords = best?.movement?.to?.coordinates || best?.location?.coordinates;
  return isValidLonLat(coords) ? coords : null;
}

export function hotspotIdForCoordinates(coords: [number, number], cellSizeDeg = DEFAULT_HOTSPOT_CELL_SIZE_DEG) {
  const size = Math.max(1, Number(cellSizeDeg) || DEFAULT_HOTSPOT_CELL_SIZE_DEG);
  const [lon, lat] = coords;
  const x = Math.floor((lon + 180) / size);
  const y = Math.floor((lat + 90) / size);
  return `hs:${size}:${x}:${y}`;
}

function parseTimestampMs(ts: string) {
  const n = Date.parse(ts || '');
  return Number.isFinite(n) ? n : 0;
}

function severityFactor(sev: any) {
  if (sev === 'high') return 2.0;
  if (sev === 'medium') return 1.4;
  return 1.0;
}

function recencyFactor(nowMs: number, tsMs: number) {
  if (!tsMs || tsMs > nowMs + 60_000) return 1;
  const ageMs = Math.max(0, nowMs - tsMs);
  const halfLifeMs = 36 * 60 * 60 * 1000;
  return Math.pow(0.5, ageMs / halfLifeMs);
}

export function deriveHotspotsFromNews(items: IntelNewsItem[], opts: {
  cellSizeDeg?: number;
  maxHotspots?: number;
  nowMs?: number;
} = {}): Hotspot[] {
  const cellSizeDeg = Math.max(1, Math.floor(opts.cellSizeDeg ?? DEFAULT_HOTSPOT_CELL_SIZE_DEG));
  const maxHotspots = Math.max(1, Math.floor(opts.maxHotspots ?? 12));
  const nowMs = Number.isFinite(opts.nowMs) ? (opts.nowMs as number) : Date.now();

  type Agg = {
    id: string;
    score: number;
    count: number;
    sumLon: number;
    sumLat: number;
    labelCounts: Map<string, number>;
    categories: Partial<Record<NewsCategory, number>>;
  };

  const byId = new Map<string, Agg>();

  for (const item of items || []) {
    const coords = getPrimaryCoordinatesForNews(item);
    if (!coords) continue;

    const best = pickBestSignal(item.signals || []);
    const confidence = clamp01(Number(best?.confidence));
    const sev = severityFactor(best?.severity);
    const tsMs = parseTimestampMs(item.timestamp || '');

    const score = recencyFactor(nowMs, tsMs) * sev * confidence;

    const id = hotspotIdForCoordinates(coords, cellSizeDeg);
    const prev = byId.get(id) || {
      id,
      score: 0,
      count: 0,
      sumLon: 0,
      sumLat: 0,
      labelCounts: new Map<string, number>(),
      categories: {},
    };

    const label =
      String(item.mentions?.[0]?.name || '').trim() ||
      String(best?.location?.country || '').trim() ||
      String(best?.location?.name || '').trim() ||
      'Unknown';

    prev.labelCounts.set(label, (prev.labelCounts.get(label) || 0) + 1);

    const cat = (item.category || 'other') as NewsCategory;
    prev.categories[cat] = (prev.categories[cat] || 0) + 1;

    prev.score += score;
    prev.count += 1;
    prev.sumLon += coords[0];
    prev.sumLat += coords[1];
    byId.set(id, prev);
  }

  const hotspots: Hotspot[] = [];
  for (const agg of byId.values()) {
    let label = 'Unknown';
    let best = -1;
    for (const [k, v] of agg.labelCounts.entries()) {
      if (v > best) {
        best = v;
        label = k;
      }
    }

    hotspots.push({
      id: agg.id,
      label,
      center: agg.count > 0 ? [agg.sumLon / agg.count, agg.sumLat / agg.count] : [0, 0],
      score: agg.score,
      count: agg.count,
      categories: agg.categories,
    });
  }

  hotspots.sort((a, b) => b.score - a.score || b.count - a.count);
  return hotspots.slice(0, maxHotspots);
}

