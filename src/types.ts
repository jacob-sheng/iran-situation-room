export interface GeoPoint {
  coordinates: [number, number]; // [longitude, latitude]
  id: string;
}

export interface Unit extends GeoPoint {
  name: string;
  type: 'military' | 'naval' | 'air' | 'base';
  affiliation: 'iran' | 'us' | 'allied' | 'israel' | 'other';
  description?: string;
  velocity?: [number, number]; // For movement
  pathHistory?: [number, number][]; // Tracks recent movement path
  sources?: SourceRef[];
  newsId?: string;
  confidence?: number;
  verified?: boolean;
}

export interface Event extends GeoPoint {
  title: string;
  date: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  sources?: SourceRef[];
  newsId?: string;
  confidence?: number;
  verified?: boolean;
}

export interface Arrow {
  id: string;
  start: [number, number];
  end: [number, number];
  color: string;
  label?: string;
  sources?: SourceRef[];
  newsId?: string;
  confidence?: number;
  verified?: boolean;
}

export interface Annotation extends GeoPoint {
  text: string;
}

export interface Infrastructure extends GeoPoint {
  name: string;
  type: 'oil' | 'nuclear' | 'military_base' | 'civilian';
  country: string;
  status: 'intact' | 'damaged' | 'destroyed';
  description?: string;
  sources?: SourceRef[];
  newsId?: string;
  confidence?: number;
  verified?: boolean;
}

export interface BattleResult extends GeoPoint {
  title: string;
  type: 'kill' | 'strike' | 'capture';
  date: string;
  description: string;
  sources?: SourceRef[];
  newsId?: string;
  confidence?: number;
  verified?: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
}

export interface SourceRef {
  name: string;
  url: string;
  timestamp: string;
}

export interface IntelLocation {
  name: string;
  country?: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export type IntelSignalKind = 'event' | 'movement' | 'infrastructure' | 'battle' | 'unit';

export interface IntelSignal {
  id: string;
  kind: IntelSignalKind;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location: IntelLocation;
  movement?: {
    from?: IntelLocation;
    to: IntelLocation;
  };
  unit?: {
    id?: string;
    name?: string;
    type?: Unit['type'];
    affiliation?: Unit['affiliation'];
  };
  infra?: {
    name?: string;
    type?: Infrastructure['type'];
    status?: Infrastructure['status'];
  };
  battle?: {
    type?: BattleResult['type'];
  };
  evidence: string;
  confidence: number;
  verified?: boolean;
}

export interface IntelNewsItem extends NewsItem {
  signals: IntelSignal[];
}

export interface MapFilters {
  showUnits: boolean;
  showEvents: boolean;
  showArrows: boolean;
  showAnnotations: boolean;
  showInfrastructure: boolean;
  showBattleResults: boolean;
}

export interface LLMSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  translationModel?: string;
}
