/**
 * Domain model for a parsed Shores of Hazeron starmap export.
 *
 * Everything here is a plain object / array / string / number / boolean so a
 * StarMap survives structuredClone, postMessage and IndexedDB unchanged.
 * Optional fields are simply absent (never `null`).
 *
 * Display strings from the exporter ("15,600m Diameter") are kept verbatim in
 * `*Raw` fields; the extracted numbers sit next to them.
 */

/** Bump when the shape of StarMap changes; the IndexedDB cache discards older versions. */
export const SCHEMA_VERSION = 1

export type Eod = 'Surveyed' | 'Explored' | 'Unexplored'
export type WormholePolarity = 'positive' | 'negative' | 'neutral'
export type Sphere = 'geosphere' | 'hydrosphere' | 'atmosphere' | 'biosphere' | 'star'

/** Quality (1-255) and abundance for one resource zone. */
export interface ZoneValue {
  quality: number
  abundance: number
}

/** Planet resource. `zones.length` is 1..4; index 0 is zone 1. */
export interface Resource {
  name: string
  zones: ZoneValue[]
}

/** Star resource: plain quality and abundance, no zones. */
export interface StarResource {
  name: string
  quality: number
  abundance: number
}

/** Parsed "Orbiting X at 0.5au 108°" / "Orbiting X at 83,400m 257°" / "Primary". */
export interface Orbit {
  raw: string
  orbitingName?: string
  /** Distance as written, in `unit`. */
  distance?: number
  unit?: 'au' | 'm'
  /** Distance converted to au (equals `distance` when unit is au). */
  au?: number
  deg?: number
}

/** Size parsed from "15,600m Diameter", "0.23au Diameter", "54700m Radius<br>15200m Width". */
export interface Dimensions {
  meters?: number
  au?: number
  radiusM?: number
  widthM?: number
}

export interface Geosphere {
  diameterRaw?: string
  diameterM?: number
  /** Rings only. */
  radiusM?: number
  widthM?: number
  gravityRaw?: string
  gravity?: number
  /** Gas giants report core gravity, others sea level gravity. */
  gravityKind?: 'sea-level' | 'core'
  /** Number of resource zones (1-4). */
  resourceZones: number
  resources: Resource[]
}

export interface Hydrosphere {
  surfaceLiquidRaw?: string
  /** 0 for "No Surface Liquid". */
  liquidPct?: number
  /** 'Liquid' | 'Water' | 'Lava' (as worded by the exporter). */
  liquidType?: string
  /** Gas giants only. */
  diameterRaw?: string
  diameterM?: number
  gravityRaw?: string
  gravity?: number
  resources: Resource[]
}

export interface Atmosphere {
  compositionRaw?: string
  /** 'Standard' | 'Corrosive' | 'Tainted' | 'Exotic' | 'Insidious' | 'None' */
  atmosphereType?: string
  /** 0 for "No Atmosphere". */
  densityPct?: number
  resources: Resource[]
}

export interface Biosphere {
  fauna?: boolean
  flora?: boolean
  resources: Resource[]
}

export interface Planet {
  planetId: string
  name: string
  /** Moon | Planet | Gas Giant | Planetoid | Titan | Ring (as exported). */
  bodyType: string
  orbit: Orbit
  /** Orbital zone without the " Zone" suffix: Inferno, Inner, Habitable, Outer, Frigid, Penumbral. */
  zone: string
  geosphere?: Geosphere
  hydrosphere?: Hydrosphere
  atmosphere?: Atmosphere
  biosphere?: Biosphere
}

export interface Star {
  starId: string
  name: string
  type: string
  orbit: Orbit
  size: string
  spectralClass?: string
  surfaceTempRaw?: string
  surfaceTempK?: number
  habRaw: string
  /** Distance of the habitable zone in au, when the star has one. */
  habAu?: number
  shell: string
  diameterRaw: string
  diameterAu?: number
  resources: StarResource[]
}

export interface Wormhole {
  destX: number
  destY: number
  destZ: number
  destSystemId?: string
  explored: boolean
  polarity?: WormholePolarity
}

export interface City {
  cityId: string
  name: string
  empire?: string
  empireId?: string
  stance?: string
  capital?: string
  admin?: string
  airport?: string
}

export interface System {
  systemId: string
  sectorId: string
  /** "Deep Space" when the exporter had no name. */
  name: string
  /** Original catalog name; present only when the system was renamed. */
  catalog?: string
  /** Absent for Deep Space. */
  x?: number
  y?: number
  z?: number
  eod: Eod
  stars: Star[]
  planets: Planet[]
  wormholes: Wormhole[]
  cities: City[]
}

export interface Sector {
  sectorId: string
  name: string
  galaxy: string
  x: number
  y: number
  z: number
}

export interface StarMap {
  schemaVersion: number
  empireId: string
  empire: string
  createDate: string
  /** Name of the first galaxy in the file (a file normally has one). */
  galaxyName: string
  sectors: Sector[]
  /** Flat list; each system references its sector by `sectorId`. */
  systems: System[]
}
