import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapDashboard from './components/MapDashboard';
import NewsPanel from './components/NewsPanel';
import ControlPanel from './components/ControlPanel';
import DetailsPanel from './components/DetailsPanel';
import SettingsModal from './components/SettingsModal';
import { Arrow, BattleResult, Event, Infrastructure, IntelNewsItem, IntelSignal, LLMSettings, MapFilters, SourceRef, Unit } from './types';
import { IRAN_COORDINATES, MOCK_ARROWS, MOCK_BATTLE_RESULTS, MOCK_EVENTS, MOCK_INFRASTRUCTURE, MOCK_UNITS } from './constants';
import { fetchIntelNews } from './services/llmService';
import { verifyIntelLocation } from './services/geocodeService';
import { Moon, RefreshCw, Sun, X } from 'lucide-react';
import { useI18n } from './i18n';

type MapFocus = { coordinates: [number, number]; zoom?: number; key: string } | null;
type ThemeSource = 'system' | 'user';
type MobileSheet = 'none' | 'news' | 'layers' | 'details';

const DEFAULT_LLM_SETTINGS: LLMSettings = {
  endpoint: 'https://warapi1.zeabur.app/v1',
  apiKey: 'sk-api123433',
  model: 'gpt-5.2',
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseTimestamp(ts: string, fallback: number) {
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function slugify(input: string) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mergeSources(existing: SourceRef[] | undefined, add: SourceRef) {
  const out = Array.isArray(existing) ? [...existing] : [];
  if (!out.some(s => s.url === add.url)) out.push(add);
  return out;
}

function asUnitType(input: any): Unit['type'] {
  if (input === 'military' || input === 'naval' || input === 'air' || input === 'base') return input;
  return 'military';
}

function asAffiliation(input: any): Unit['affiliation'] {
  if (input === 'iran' || input === 'us' || input === 'allied' || input === 'israel' || input === 'other') return input;
  return 'other';
}

function asInfraType(input: any): Infrastructure['type'] {
  if (input === 'oil' || input === 'nuclear' || input === 'military_base' || input === 'civilian') return input;
  return 'military_base';
}

function guessInfraType(title: string) {
  const t = title.toLowerCase();
  if (t.includes('oil') || t.includes('pipeline') || t.includes('refinery')) return 'oil' as const;
  if (t.includes('nuclear') || t.includes('uranium') || t.includes('enrichment')) return 'nuclear' as const;
  if (t.includes('airport') || t.includes('port') || t.includes('terminal')) return 'civilian' as const;
  return 'military_base' as const;
}

function guessInfraStatus(title: string, severity: IntelSignal['severity']): Infrastructure['status'] {
  const t = title.toLowerCase();
  if (t.includes('destroy') || t.includes('flatten') || t.includes('obliterate')) return 'destroyed';
  if (t.includes('damage') || t.includes('hit') || t.includes('strike')) return 'damaged';
  if (severity === 'high') return 'damaged';
  return 'intact';
}

function pickBestSignal(signals: IntelSignal[]) {
  if (!Array.isArray(signals) || signals.length === 0) return null;
  return [...signals].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0] || null;
}

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const initialTheme = useMemo(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('uiTheme');
    } catch {
      saved = null;
    }

    if (saved === 'dark' || saved === 'light') {
      return { source: 'user' as const, isDark: saved === 'dark' };
    }

    const prefersDark = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return { source: 'system' as const, isDark: prefersDark };
  }, []);

  const [themeSource, setThemeSource] = useState<ThemeSource>(initialTheme.source);
  const [isDarkMode, setIsDarkMode] = useState(initialTheme.isDark);
  const [showSettings, setShowSettings] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LLMSettings>(DEFAULT_LLM_SETTINGS);

  const [filters, setFilters] = useState<MapFilters>({
    showUnits: true,
    showEvents: true,
    showArrows: true,
    showAnnotations: true,
    showInfrastructure: true,
    showBattleResults: true,
  });

  const [units, setUnits] = useState<Unit[]>(() => MOCK_UNITS.map(u => ({ ...u, velocity: undefined })));
  const unitsRef = useRef<Unit[]>(units);
  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  const [intelNews, setIntelNews] = useState<IntelNewsItem[]>([]);
  const intelNewsRef = useRef<IntelNewsItem[]>(intelNews);
  useEffect(() => {
    intelNewsRef.current = intelNews;
  }, [intelNews]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus>(null);
  const [latestBatchSize, setLatestBatchSize] = useState(0);

  const [intelEvents, setIntelEvents] = useState<Event[]>([]);
  const [intelInfrastructure, setIntelInfrastructure] = useState<Infrastructure[]>([]);
  const [intelBattleResults, setIntelBattleResults] = useState<BattleResult[]>([]);
  const [intelArrows, setIntelArrows] = useState<Arrow[]>([]);

  const refreshSeq = useRef(0);
  const moveSeq = useRef(0);
  const autoRefreshDone = useRef(false);

  const [selectedItem, setSelectedItem] = useState<Unit | Event | Infrastructure | BattleResult | null>(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>('none');

  // Handle dark mode class on root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Follow system theme changes until the user explicitly overrides it.
  useEffect(() => {
    if (themeSource !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const next = 'matches' in e ? e.matches : mql.matches;
      setIsDarkMode(Boolean(next));
    };
    // Sync once in case it changed since initial render.
    onChange(mql);

    try {
      // Modern browsers
      (mql as any).addEventListener?.('change', onChange);
      // Safari fallback
      (mql as any).addListener?.(onChange);
    } catch {
      // Ignore.
    }

    return () => {
      try {
        (mql as any).removeEventListener?.('change', onChange);
        (mql as any).removeListener?.(onChange);
      } catch {
        // Ignore.
      }
    };
  }, [themeSource]);

  // Load settings from local storage
  useEffect(() => {
    const saved = localStorage.getItem('llmSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setLlmSettings({ ...DEFAULT_LLM_SETTINGS, ...(parsed as any) });
        }
      } catch (e) {
        console.error('Failed to parse settings');
      }
    }
  }, []);

  // Auto refresh once on first load when settings are available.
  useEffect(() => {
    if (autoRefreshDone.current) return;
    if (!llmSettings.endpoint || !llmSettings.apiKey) return;
    autoRefreshDone.current = true;
    void refreshIntel();
  }, [llmSettings.endpoint, llmSettings.apiKey, llmSettings.model]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const next = 'matches' in e ? e.matches : mql.matches;
      setIsMobile(Boolean(next));
    };
    onChange(mql);

    try {
      (mql as any).addEventListener?.('change', onChange);
      (mql as any).addListener?.(onChange);
    } catch {
      // Ignore.
    }

    return () => {
      try {
        (mql as any).removeEventListener?.('change', onChange);
        (mql as any).removeListener?.(onChange);
      } catch {
        // Ignore.
      }
    };
  }, []);

  useEffect(() => {
    setMobileSheet('none');
  }, [isMobile]);

  const handleSaveSettings = (newSettings: LLMSettings) => {
    setLlmSettings(newSettings);
    localStorage.setItem('llmSettings', JSON.stringify(newSettings));
  };

  const allEvents = useMemo(() => [...MOCK_EVENTS, ...intelEvents], [intelEvents]);
  const allInfrastructure = useMemo(() => [...MOCK_INFRASTRUCTURE, ...intelInfrastructure], [intelInfrastructure]);
  const allBattleResults = useMemo(() => [...MOCK_BATTLE_RESULTS, ...intelBattleResults], [intelBattleResults]);
  const allArrows = useMemo(() => [...MOCK_ARROWS, ...intelArrows], [intelArrows]);

  function buildSourceRef(item: IntelNewsItem): SourceRef {
    return {
      name: item.source || t('details.sourceFallback'),
      url: item.url,
      timestamp: item.timestamp || new Date().toISOString(),
    };
  }

  function deriveIntelLayersFromNews(news: IntelNewsItem[]) {
    const events: Event[] = [];
    const infrastructure: Infrastructure[] = [];
    const battleResults: BattleResult[] = [];

    for (const item of news) {
      const src = buildSourceRef(item);
      for (const signal of item.signals || []) {
        const coords = signal.movement?.to?.coordinates || signal.location.coordinates;
        if (!coords) continue;

        if (signal.kind === 'event') {
          events.push({
            id: `intel-event:${item.id}:${signal.id}`,
            title: signal.title,
            date: item.timestamp || new Date().toISOString(),
            description: signal.description,
            severity: signal.severity,
            coordinates: coords,
            sources: [src],
            newsId: item.id,
            confidence: clamp01(signal.confidence),
            verified: signal.verified,
          });
        } else if (signal.kind === 'infrastructure') {
          const t = signal.infra?.type ? asInfraType(signal.infra.type) : guessInfraType(signal.title);
          const status = signal.infra?.status ? signal.infra.status : guessInfraStatus(signal.title, signal.severity);
          infrastructure.push({
            id: `intel-infra:${item.id}:${signal.id}`,
            name: String(signal.infra?.name || signal.title || 'Infrastructure'),
            type: t,
            country: signal.location.country || 'Unknown',
            status,
            description: signal.description,
            coordinates: coords,
            sources: [src],
            newsId: item.id,
            confidence: clamp01(signal.confidence),
            verified: signal.verified,
          });
        } else if (signal.kind === 'battle') {
          battleResults.push({
            id: `intel-battle:${item.id}:${signal.id}`,
            title: signal.title,
            type: signal.battle?.type === 'kill' || signal.battle?.type === 'strike' || signal.battle?.type === 'capture'
              ? signal.battle.type
              : 'strike',
            date: item.timestamp || new Date().toISOString(),
            coordinates: coords,
            description: signal.description,
            sources: [src],
            newsId: item.id,
            confidence: clamp01(signal.confidence),
            verified: signal.verified,
          });
        } else if (signal.kind === 'movement') {
          // Always materialize a marker for movement signals so historic news items keep a clickable icon,
          // even if unit markers later move and no longer reference the old newsId.
          events.push({
            id: `intel-event:${item.id}:${signal.id}`,
            title: signal.title,
            date: item.timestamp || new Date().toISOString(),
            description: signal.description,
            severity: signal.severity,
            coordinates: coords,
            sources: [src],
            newsId: item.id,
            confidence: clamp01(signal.confidence),
            verified: signal.verified,
          });
        } else if (signal.kind === 'unit') {
          // Unit markers can only represent the latest state; add a per-news marker so each item remains clickable.
          events.push({
            id: `intel-event:${item.id}:${signal.id}`,
            title: signal.title,
            date: item.timestamp || new Date().toISOString(),
            description: signal.description,
            severity: signal.severity,
            coordinates: coords,
            sources: [src],
            newsId: item.id,
            confidence: clamp01(signal.confidence),
            verified: signal.verified,
          });
        }
      }
    }

    return { events, infrastructure, battleResults };
  }

  async function animateUnitTo(
    unitId: string,
    from: [number, number],
    to: [number, number],
    meta: { newsId: string; source: SourceRef; confidence: number; verified?: boolean },
    token: number
  ) {
    const steps = 30;
    const durationMs = 1500;
    const stepMs = Math.max(16, Math.floor(durationMs / steps));

    const [fx, fy] = from;
    const [tx, ty] = to;

    if (fx === tx && fy === ty) {
      setUnits(prev => prev.map(u => {
        if (u.id !== unitId) return u;
        return {
          ...u,
          coordinates: to,
          newsId: meta.newsId,
          sources: mergeSources(u.sources, meta.source),
          confidence: clamp01(meta.confidence),
          verified: typeof meta.verified === 'boolean' ? meta.verified : u.verified,
        };
      }));
      return;
    }

    for (let i = 1; i <= steps; i++) {
      if (moveSeq.current !== token) return;
      const t = i / steps;
      const nx = fx + (tx - fx) * t;
      const ny = fy + (ty - fy) * t;

      setUnits(prev => prev.map(u => {
        if (u.id !== unitId) return u;
        const next: Unit = {
          ...u,
          coordinates: [nx, ny],
          newsId: meta.newsId,
          sources: mergeSources(u.sources, meta.source),
          confidence: clamp01(meta.confidence),
          verified: typeof meta.verified === 'boolean' ? meta.verified : u.verified,
        };

        // Add to path history every 2 ticks to keep the trail smooth but bounded.
        if (i % 2 === 0) {
          const hist = Array.isArray(u.pathHistory) ? [...u.pathHistory] : [];
          hist.push([nx, ny]);
          while (hist.length > 60) hist.shift();
          next.pathHistory = hist;
        }

        return next;
      }));

      await sleep(stepMs);
    }
  }

  function applyIntelSignalsToUnitsAndArrows(news: IntelNewsItem[], { animate }: { animate: boolean }) {
    const currentUnits = unitsRef.current;
    const unitsById = new Map(currentUnits.map(u => [u.id, u] as const));
    const unitsByName = new Map(currentUnits.map(u => [u.name.toLowerCase(), u] as const));

    const plannedUnits: Unit[] = [...currentUnits];
    const posById = new Map<string, [number, number]>(currentUnits.map(u => [u.id, u.coordinates] as const));

    type MoveStep = {
      unitId: string;
      from: [number, number];
      to: [number, number];
      newsId: string;
      source: SourceRef;
      confidence: number;
      verified?: boolean;
      label: string;
      affiliation?: Unit['affiliation'];
    };

    const movesByUnitId = new Map<string, MoveStep[]>();
    const arrows: Arrow[] = [];

    const flat: Array<{ at: number; order: number; item: IntelNewsItem; signal: IntelSignal }> = [];
    let order = 0;
    for (const item of news) {
      const at = parseTimestamp(item.timestamp || '', order);
      for (const signal of item.signals || []) {
        if (signal.kind !== 'movement' && signal.kind !== 'unit') continue;
        flat.push({ at, order: order++, item, signal });
      }
    }
    flat.sort((a, b) => a.at - b.at || a.order - b.order);

    const ensureUnit = (signal: IntelSignal, item: IntelNewsItem, start: [number, number]) => {
      const unitSpec = signal.unit || {};
      const id = typeof unitSpec.id === 'string' ? unitSpec.id.trim() : '';
      const name = String(unitSpec.name || signal.title || item.title || 'Unknown Unit').trim() || 'Unknown Unit';
      const keyName = name.toLowerCase();

      let unit: Unit | undefined;
      if (id && unitsById.has(id)) unit = unitsById.get(id);
      if (!unit && unitsByName.has(keyName)) unit = unitsByName.get(keyName);

      if (!unit) {
        let baseId = id || `intel-${slugify(name) || 'unit'}`;
        let nextId = baseId;
        let n = 2;
        while (unitsById.has(nextId) || plannedUnits.some(u => u.id === nextId)) {
          nextId = `${baseId}-${n++}`;
        }

        unit = {
          id: nextId,
          name,
          type: asUnitType(unitSpec.type),
          affiliation: asAffiliation(unitSpec.affiliation),
          coordinates: start,
          description: signal.description,
          pathHistory: [],
          velocity: undefined,
        };
        plannedUnits.push(unit);
        unitsById.set(unit.id, unit);
        unitsByName.set(keyName, unit);
        posById.set(unit.id, start);
      }

      return unit;
    };

    for (const entry of flat) {
      const { item, signal } = entry;
      const src = buildSourceRef(item);

      const toLoc = signal.movement?.to || signal.location;
      const to = toLoc?.coordinates || IRAN_COORDINATES;
      const fromLoc = signal.movement?.from;

      // If LLM didn't provide a unit identity, we can still render a sourced movement arrow (if from/to exist),
      // but we won't move any unit.
      if (!signal.unit?.id && !signal.unit?.name && signal.kind === 'movement') {
        const from = fromLoc?.coordinates;
        const arrowId = `intel-arrow:${item.id}:${signal.id}`;
        if (from && (from[0] !== to[0] || from[1] !== to[1])) {
          arrows.push({
            id: arrowId,
            start: from,
            end: to,
            color: '#06b6d4',
            label: signal.title,
            sources: [src],
            newsId: item.id,
            confidence: clamp01(signal.confidence),
            verified: signal.verified,
          });
        }
        continue;
      }

      const unit = ensureUnit(signal, item, fromLoc?.coordinates || to);
      const currentPos = posById.get(unit.id) || unit.coordinates;
      const from = fromLoc?.coordinates || currentPos;

      const step: MoveStep = {
        unitId: unit.id,
        from,
        to,
        newsId: item.id,
        source: src,
        confidence: clamp01(signal.confidence),
        verified: signal.verified,
        label: signal.title,
        affiliation: unit.affiliation,
      };

      const list = movesByUnitId.get(unit.id) || [];
      list.push(step);
      movesByUnitId.set(unit.id, list);
      posById.set(unit.id, to);

      const arrowId = `intel-arrow:${item.id}:${signal.id}`;
      if (from[0] !== to[0] || from[1] !== to[1]) {
        arrows.push({
          id: arrowId,
          start: from,
          end: to,
          color: '#06b6d4',
          label: signal.title,
          sources: [src],
          newsId: item.id,
          confidence: clamp01(signal.confidence),
          verified: signal.verified,
        });
      }
    }

    if (animate) {
      // Ensure any new units exist before animating.
      setUnits(plannedUnits);
      unitsRef.current = plannedUnits;

      const token = ++moveSeq.current;
      for (const [unitId, queue] of movesByUnitId.entries()) {
        // Run each unit's movement sequentially, units in parallel.
        void (async () => {
          for (const step of queue) {
            if (moveSeq.current !== token) return;
            await animateUnitTo(
              unitId,
              step.from,
              step.to,
              {
                newsId: step.newsId,
                source: step.source,
                confidence: step.confidence,
                verified: step.verified,
              },
              token
            );
          }
        })();
      }
    }

    return { arrows };
  }

  async function refreshIntel() {
    const token = ++refreshSeq.current;
    setLoadingNews(true);
    setNewsError(null);
    try {
      const MAX_NEWS_ITEMS = 100;
      const freshAll = await fetchIntelNews(llmSettings);
      if (refreshSeq.current !== token) return;

      // Dedupe within the freshly fetched batch by URL (keep first occurrence).
      const seenUrls = new Set<string>();
      const freshCanonical = freshAll.filter(item => {
        const url = String(item?.url || '').trim();
        if (!url) return false;
        if (seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
      });

      // Preserve history by batches: new items always prepend, old items are never overwritten.
      const batchId = `b:${Date.now()}`;
      const fresh = freshCanonical.map((item, idx) => ({
        ...item,
        id: `${item.id}:${batchId}:${idx}`,
      }));

      const prev = intelNewsRef.current;
      let merged = [...fresh, ...prev];
      if (merged.length > MAX_NEWS_ITEMS) merged = merged.slice(0, MAX_NEWS_ITEMS);

      setIntelNews(merged);
      intelNewsRef.current = merged;
      setLatestBatchSize(fresh.length);

      // Derive clickable layers from signals and kick off sourced unit movement.
      const derived = deriveIntelLayersFromNews(merged);
      setIntelEvents(derived.events);
      setIntelInfrastructure(derived.infrastructure);
      setIntelBattleResults(derived.battleResults);

      // Only animate unit movement based on the current refresh batch (avoid replaying old moves).
      const { arrows: batchArrows } = applyIntelSignalsToUnitsAndArrows(fresh, { animate: true });
      const keptNewsIds = new Set(merged.map(n => n.id));
      setIntelArrows(prev => [...batchArrows, ...prev.filter(a => keptNewsIds.has(a.newsId || ''))]);

      // Verify a limited number of locations in the background and update markers accordingly.
      void (async () => {
        if (fresh.length === 0) return;
        const flatSignals: Array<{ newsId: string; signalId: string; locPath: 'location' | 'from' | 'to'; location: any; confidence: number }> = [];
        for (const item of fresh) {
          for (const signal of item.signals || []) {
            flatSignals.push({
              newsId: item.id,
              signalId: signal.id,
              locPath: 'location',
              location: signal.location,
              confidence: clamp01(signal.confidence),
            });
            if (signal.movement?.from) {
              flatSignals.push({
                newsId: item.id,
                signalId: signal.id,
                locPath: 'from',
                location: signal.movement.from,
                confidence: clamp01(signal.confidence) * 0.8,
              });
            }
            if (signal.movement?.to) {
              flatSignals.push({
                newsId: item.id,
                signalId: signal.id,
                locPath: 'to',
                location: signal.movement.to,
                confidence: clamp01(signal.confidence),
              });
            }
          }
        }

        flatSignals.sort((a, b) => b.confidence - a.confidence);

        const seen = new Set<string>();
        const picked = flatSignals.filter(s => {
          const key = `${String(s.location?.name || '').toLowerCase()}|${String(s.location?.country || '').toLowerCase()}|${(s.location?.coordinates || []).join(',')}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 15);

        const verifiedBySignal = new Map<string, { coordinates: [number, number]; verified: boolean; country?: string }>();
        for (const entry of picked) {
          if (refreshSeq.current !== token) return;
          try {
            const res = await verifyIntelLocation(entry.location);
            verifiedBySignal.set(`${entry.newsId}::${entry.signalId}::${entry.locPath}`, {
              coordinates: res.location.coordinates,
              verified: res.verified,
              country: res.location.country,
            });
          } catch {
            // Ignore geocode failures.
          }
        }

        if (refreshSeq.current !== token) return;

        const freshVerified = fresh.map(item => ({
          ...item,
          signals: (item.signals || []).map(sig => {
            const kLoc = `${item.id}::${sig.id}::location`;
            const kFrom = `${item.id}::${sig.id}::from`;
            const kTo = `${item.id}::${sig.id}::to`;
            const vLoc = verifiedBySignal.get(kLoc);
            const vFrom = verifiedBySignal.get(kFrom);
            const vTo = verifiedBySignal.get(kTo);
            if (!vLoc && !vFrom && !vTo) return sig;

            const next = { ...sig } as IntelSignal;

            if (vLoc) {
              next.location = {
                ...sig.location,
                country: sig.location.country || vLoc.country,
                coordinates: vLoc.coordinates,
              };
              next.verified = vLoc.verified;
            }

            if (sig.movement && (vFrom || vTo)) {
              next.movement = { ...sig.movement };
              if (sig.movement.from && vFrom) {
                next.movement.from = {
                  ...sig.movement.from,
                  country: sig.movement.from.country || vFrom.country,
                  coordinates: vFrom.coordinates,
                };
              }
              if (sig.movement.to && vTo) {
                next.movement.to = {
                  ...sig.movement.to,
                  country: sig.movement.to.country || vTo.country,
                  coordinates: vTo.coordinates,
                };
              }
              if (typeof next.verified !== 'boolean') {
                // If we didn't verify the primary location, fall back to movement verification.
                next.verified = Boolean(vTo?.verified ?? vFrom?.verified);
              }
            }

            return next;
          }),
        }));

        const byId = new Map(freshVerified.map(n => [n.id, n] as const));
        setIntelNews(prev => {
          const next = prev.map(n => (byId.has(n.id) ? byId.get(n.id)! : n));
          const nextDerived = deriveIntelLayersFromNews(next);
          setIntelEvents(nextDerived.events);
          setIntelInfrastructure(nextDerived.infrastructure);
          setIntelBattleResults(nextDerived.battleResults);
          return next;
        });

        // Patch arrow endpoints (keep original starts so the direction stays meaningful).
        const nextEnds = new Map<string, [number, number]>();
        for (const item of freshVerified) {
          for (const sig of item.signals || []) {
            if (sig.kind !== 'movement' && sig.kind !== 'unit') continue;
            const end = sig.movement?.to?.coordinates || sig.location.coordinates;
            const id = `intel-arrow:${item.id}:${sig.id}`;
            if (end) nextEnds.set(id, end);
          }
        }
        if (nextEnds.size > 0) {
          setIntelArrows(prev => prev.map(a => (nextEnds.has(a.id) ? { ...a, end: nextEnds.get(a.id)! } : a)));
        }
      })();
    } catch (e: any) {
      if (refreshSeq.current !== token) return;
      let msg = typeof e?.message === 'string' ? e.message : String(e);
      if (msg.includes('API Endpoint and Key are required')) msg = t('errors.missingSettings');
      if (!msg) msg = t('errors.refreshFailed');
      setNewsError(msg);
    } finally {
      if (refreshSeq.current === token) setLoadingNews(false);
    }
  }

  function handleSelectNews(id: string) {
    setSelectedNewsId(id);
    const item = intelNews.find(n => n.id === id);
    const best = item ? pickBestSignal(item.signals || []) : null;
    const coords = best?.movement?.to?.coordinates || best?.location?.coordinates;
    if (coords) {
      setFocus({ coordinates: coords, zoom: 5, key: `news:${id}:${Date.now()}` });
    }
    if (isMobile) setMobileSheet('none');
  }

  function handleSelectItem(item: Unit | Event | Infrastructure | BattleResult | null) {
    setSelectedItem(item);
    const newsId = (item as any)?.newsId;
    if (typeof newsId === 'string' && newsId) setSelectedNewsId(newsId);
    const coords = (item as any)?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      setFocus({ coordinates: coords as [number, number], zoom: 5, key: `item:${(item as any)?.id || 'x'}:${Date.now()}` });
    }
    if (isMobile && item) setMobileSheet('details');
  }

  const mobileSheetTitle =
    mobileSheet === 'news'
      ? t('mobile.news')
      : mobileSheet === 'layers'
        ? t('mobile.layers')
        : t('mobile.details');

  return (
    <div className="relative flex h-screen h-dvh w-full bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">
      {/* Main Map Area */}
      <div className="flex-1 relative p-2 sm:p-4 sm:pl-4 sm:pr-2 sm:pb-4 sm:pt-4">
        <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-10 flex items-center gap-2">
          <div
            className="flex items-center bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow-lg overflow-hidden"
            title={t('app.toggleLanguage')}
          >
            <button
              onClick={() => setLocale('zh')}
              className={[
                "px-2.5 py-2 sm:px-3 text-xs font-mono transition-colors",
                locale === 'zh'
                  ? "bg-cyan-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60",
              ].join(' ')}
            >
              {t('app.lang.zh')}
            </button>
            <button
              onClick={() => setLocale('en')}
              className={[
                "px-2.5 py-2 sm:px-3 text-xs font-mono transition-colors",
                locale === 'en'
                  ? "bg-cyan-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60",
              ].join(' ')}
            >
              {t('app.lang.en')}
            </button>
          </div>

          <button
            onClick={() => {
              const next = !isDarkMode;
              setIsDarkMode(next);
              setThemeSource('user');
              try {
                localStorage.setItem('uiTheme', next ? 'dark' : 'light');
              } catch {
                // Ignore.
              }
            }}
            className="p-2.5 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={t('app.toggleTheme')}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {isMobile && (
            <button
              onClick={refreshIntel}
              disabled={loadingNews || !llmSettings.endpoint || !llmSettings.apiKey}
              className="p-2.5 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
              title={t('news.refreshNews')}
            >
              <RefreshCw size={18} className={loadingNews ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        <MapDashboard
          filters={filters}
          units={units}
          events={allEvents}
          arrows={allArrows}
          infrastructure={allInfrastructure}
          battleResults={allBattleResults}
          focus={focus}
          selectedNewsId={selectedNewsId}
          onSelectEvent={handleSelectItem}
          onSelectUnit={handleSelectItem}
          onSelectInfrastructure={handleSelectItem}
          onSelectBattleResult={handleSelectItem}
        />

        {!isMobile && <ControlPanel filters={filters} setFilters={setFilters} />}

        {!isMobile && selectedItem && (
          <DetailsPanel selectedItem={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </div>

      {!isMobile && (
      <div className="hidden lg:block w-80 h-full py-4 pr-4 pl-2">
        <NewsPanel 
          settings={llmSettings} 
          news={intelNews}
          latestBatchSize={latestBatchSize}
          loading={loadingNews}
          error={newsError}
          selectedNewsId={selectedNewsId}
          onOpenSettings={() => setShowSettings(true)} 
          onRefresh={refreshIntel}
          onSelectNews={handleSelectNews}
          className="w-full h-full border-l border-slate-200 dark:border-slate-800"
        />
      </div>
      )}

      {isMobile && (
        <>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <div className="pointer-events-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl p-1.5 grid grid-cols-3 gap-1">
              <button
                onClick={() => setMobileSheet(prev => prev === 'news' ? 'none' : 'news')}
                className={[
                  "px-2 py-2 text-xs rounded-xl font-medium transition-colors",
                  mobileSheet === 'news'
                    ? "bg-cyan-600 text-white"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                ].join(' ')}
              >
                {t('mobile.news')}
              </button>
              <button
                onClick={() => setMobileSheet(prev => prev === 'layers' ? 'none' : 'layers')}
                className={[
                  "px-2 py-2 text-xs rounded-xl font-medium transition-colors",
                  mobileSheet === 'layers'
                    ? "bg-cyan-600 text-white"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                ].join(' ')}
              >
                {t('mobile.layers')}
              </button>
              <button
                onClick={() => {
                  if (!selectedItem) return;
                  setMobileSheet(prev => prev === 'details' ? 'none' : 'details');
                }}
                disabled={!selectedItem}
                className={[
                  "px-2 py-2 text-xs rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  mobileSheet === 'details'
                    ? "bg-cyan-600 text-white"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                ].join(' ')}
              >
                {t('mobile.details')}
              </button>
            </div>
          </div>

          {mobileSheet !== 'none' && (
            <div className="absolute inset-0 z-30">
              <button
                className="absolute inset-0 bg-black/35"
                aria-label={t('mobile.close')}
                onClick={() => setMobileSheet('none')}
              />
              <div className="absolute bottom-0 left-0 right-0 max-h-[78dvh] rounded-t-2xl border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{mobileSheetTitle}</div>
                  <button
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => setMobileSheet('none')}
                    title={t('mobile.close')}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="h-[min(70dvh,560px)] overflow-y-auto p-3">
                  {mobileSheet === 'news' && (
                    <NewsPanel
                      settings={llmSettings}
                      news={intelNews}
                      latestBatchSize={latestBatchSize}
                      loading={loadingNews}
                      error={newsError}
                      selectedNewsId={selectedNewsId}
                      onOpenSettings={() => setShowSettings(true)}
                      onRefresh={refreshIntel}
                      onSelectNews={handleSelectNews}
                      className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800"
                    />
                  )}

                  {mobileSheet === 'layers' && (
                    <ControlPanel filters={filters} setFilters={setFilters} embedded />
                  )}

                  {mobileSheet === 'details' && selectedItem && (
                    <DetailsPanel
                      selectedItem={selectedItem}
                      onClose={() => setMobileSheet('none')}
                      embedded
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showSettings && (
        <SettingsModal 
          settings={llmSettings} 
          onSave={handleSaveSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
}
