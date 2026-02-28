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
}

export interface Event extends GeoPoint {
  title: string;
  date: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Arrow {
  id: string;
  start: [number, number];
  end: [number, number];
  color: string;
  label?: string;
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
}

export interface BattleResult extends GeoPoint {
  title: string;
  type: 'kill' | 'strike' | 'capture';
  date: string;
  description: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
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
}
