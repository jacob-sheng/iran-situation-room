import { Unit, Event, Arrow, Annotation, Infrastructure, BattleResult } from './types';

// Coordinates: [longitude, latitude]
export const IRAN_COORDINATES: [number, number] = [53.6880, 32.4279];
export const TEHRAN_COORDINATES: [number, number] = [51.3890, 35.6892];
export const STRAIT_OF_HORMUZ: [number, number] = [56.2641, 26.5683];
export const PERSIAN_GULF: [number, number] = [51.6825, 26.9605];
export const ISFAHAN_COORDINATES: [number, number] = [51.6660, 32.6539];
export const NATANZ_COORDINATES: [number, number] = [51.9333, 33.7333];
export const BANDAR_ABBAS: [number, number] = [56.2808, 27.1832];
export const TEL_AVIV: [number, number] = [34.7818, 32.0853];
export const DAMASCUS: [number, number] = [36.2913, 33.5138];
export const BAGHDAD: [number, number] = [44.3615, 33.3128];
export const RIYADH: [number, number] = [46.6753, 24.7136];

export const MOCK_UNITS: Unit[] = [
  {
    id: 'u1',
    name: 'IRGC HQ',
    type: 'base',
    affiliation: 'iran',
    coordinates: TEHRAN_COORDINATES,
    description: 'Islamic Revolutionary Guard Corps Headquarters'
  },
  {
    id: 'u2',
    name: 'Naval Patrol Alpha',
    type: 'naval',
    affiliation: 'iran',
    coordinates: STRAIT_OF_HORMUZ,
    description: 'Fast attack craft patrol zone',
    velocity: [-0.05, 0.02] // Moving slowly
  },
  {
    id: 'u3',
    name: 'Nuclear Facility',
    type: 'base',
    affiliation: 'iran',
    coordinates: NATANZ_COORDINATES,
    description: 'Uranium enrichment plant'
  },
  {
    id: 'u4',
    name: 'Air Base',
    type: 'air',
    affiliation: 'iran',
    coordinates: ISFAHAN_COORDINATES,
    description: 'Tactical fighter base'
  },
  {
    id: 'u5',
    name: 'Naval Base',
    type: 'base',
    affiliation: 'iran',
    coordinates: BANDAR_ABBAS,
    description: 'Southern fleet headquarters'
  },
  {
    id: 'u6',
    name: 'US 5th Fleet',
    type: 'naval',
    affiliation: 'us',
    coordinates: [50.5876, 26.2285], // Bahrain
    description: 'US Naval Forces Central Command',
    velocity: [0.01, -0.01]
  },
  {
    id: 'u7',
    name: 'IDF Air Command',
    type: 'air',
    affiliation: 'israel',
    coordinates: TEL_AVIV,
    description: 'Israeli Air Force Command Center'
  }
];

export const MOCK_EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Missile Test',
    date: '2024-05-15',
    description: 'Medium-range ballistic missile test reported.',
    severity: 'medium',
    coordinates: [54.0, 34.0]
  },
  {
    id: 'e2',
    title: 'Naval Exercise',
    date: '2024-05-18',
    description: 'Large-scale naval drill in the Persian Gulf.',
    severity: 'low',
    coordinates: PERSIAN_GULF
  },
  {
    id: 'e3',
    title: 'Drone Interception',
    date: '2024-05-20',
    description: 'Unidentified drone intercepted near border.',
    severity: 'high',
    coordinates: [45.0, 35.0] // Western border
  }
];

export const MOCK_ARROWS: Arrow[] = [
  {
    id: 'a1',
    start: BANDAR_ABBAS,
    end: STRAIT_OF_HORMUZ,
    color: '#06b6d4', // cyan-500
    label: 'Patrol Route'
  },
  {
    id: 'a2',
    start: TEHRAN_COORDINATES,
    end: ISFAHAN_COORDINATES,
    color: '#f59e0b', // amber-500
    label: 'Supply Line'
  }
];

export const MOCK_ANNOTATIONS: Annotation[] = [
  {
    id: 'an1',
    text: 'Strait of Hormuz Chokepoint',
    coordinates: [57.0, 26.0]
  },
  {
    id: 'an2',
    text: 'Persian Gulf',
    coordinates: [51.0, 28.0]
  },
  {
    id: 'an3',
    text: 'Zagros Mountains',
    coordinates: [50.0, 33.0]
  }
];

export const MOCK_INFRASTRUCTURE: Infrastructure[] = [
  {
    id: 'inf1',
    name: 'Abqaiq Oil Processing Facility',
    type: 'oil',
    country: 'Saudi Arabia',
    status: 'intact',
    coordinates: [49.6800, 25.9350],
    description: 'World\'s largest oil processing facility.'
  },
  {
    id: 'inf2',
    name: 'Nevatim Airbase',
    type: 'military_base',
    country: 'Israel',
    status: 'damaged',
    coordinates: [35.0114, 31.2089],
    description: 'Major airbase housing F-35 fighter jets. Reported minor damage.'
  },
  {
    id: 'inf3',
    name: 'Isfahan Nuclear Technology Center',
    type: 'nuclear',
    country: 'Iran',
    status: 'intact',
    coordinates: [51.7289, 32.5531],
    description: 'Key nuclear research facility.'
  },
  {
    id: 'inf4',
    name: 'Damascus International Airport',
    type: 'civilian',
    country: 'Syria',
    status: 'damaged',
    coordinates: [36.4833, 33.4114],
    description: 'Civilian airport frequently used for military logistics. Runways damaged.'
  }
];

export const MOCK_BATTLE_RESULTS: BattleResult[] = [
  {
    id: 'br1',
    title: 'High-Value Target Eliminated',
    type: 'kill',
    date: '2024-04-01',
    coordinates: DAMASCUS,
    description: 'Senior IRGC commander eliminated in targeted strike on consulate annex.'
  },
  {
    id: 'br2',
    title: 'Air Defense Battery Destroyed',
    type: 'strike',
    date: '2024-04-19',
    coordinates: [51.8, 32.7], // Near Isfahan
    description: 'S-300 radar system destroyed in retaliatory precision strike.'
  }
];
