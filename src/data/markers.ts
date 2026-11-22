/**
 * Pure city and spacecraft marker preparation (BLUEPRINT W16). No three.js import.
 * Cities and spacecraft are children of a system and have no coordinates of their own, so one
 * marker per system per kind sits at the system point; the renderer offsets it in screen space.
 * Deep Space systems (no coordinates) never get markers.
 */
import type { RGB } from './mapdata'
import { systemHasRingworld } from './rows'
import type { City, Spacecraft, StarMap, System } from './types'

/** Own empire (stance "Empire") versus every other empire. */
export const MARKER_OWN_COLOR: RGB = [0.35, 0.9, 1]
export const MARKER_OTHER_COLOR: RGB = [1, 0.72, 0.28]
/** Glyph size in CSS pixels: one item, or more than one (larger glyph stands in for a count). */
export const MARKER_SIZE_SINGLE = 8
export const MARKER_SIZE_MULTI = 12
/** Items listed per kind in the hover card before "+N more". */
export const MARKER_CAP = 4

export function isOwn(x: { stance?: string }): boolean {
  return x.stance === 'Empire'
}

export interface MarkerSet {
  count: number
  /** xyz of the owning system per marker. */
  positions: Float32Array
  /** rgb per marker. */
  colors: Float32Array
  /** Glyph size in CSS px per marker. */
  sizes: Float32Array
  /** Items (cities or spacecraft) behind each marker. */
  counts: Float32Array
  systemIds: string[]
}

export interface MarkerData {
  cities: MarkerSet
  spacecraft: MarkerSet
}

type Located = System & { x: number; y: number; z: number }

function markerSet(pts: Located[], items: (s: System) => readonly { stance?: string }[]): MarkerSet {
  const rows = pts.filter((s) => items(s).length > 0)
  const positions = new Float32Array(rows.length * 3)
  const colors = new Float32Array(rows.length * 3)
  const sizes = new Float32Array(rows.length)
  const counts = new Float32Array(rows.length)
  rows.forEach((s, i) => {
    const list = items(s)
    positions.set([s.x, s.y, s.z], i * 3)
    colors.set(list.some(isOwn) ? MARKER_OWN_COLOR : MARKER_OTHER_COLOR, i * 3)
    sizes[i] = list.length > 1 ? MARKER_SIZE_MULTI : MARKER_SIZE_SINGLE
    counts[i] = list.length
  })
  return { count: rows.length, positions, colors, sizes, counts, systemIds: rows.map((s) => s.systemId) }
}

export function buildMarkers(map: StarMap): MarkerData {
  const pts = map.systems.filter((s): s is Located => s.x !== undefined && s.y !== undefined && s.z !== undefined)
  return { cities: markerSet(pts, (s) => s.cities), spacecraft: markerSet(pts, (s) => s.spacecraft) }
}

const SPACE_WORDS: Record<string, string> = { deep: 'deep space', system: 'in system' }

/** "moving, deep space" / "stationary, in system" / "stationary, orbit". */
export function describeSpacecraft(sc: Pick<Spacecraft, 'moving' | 'space'>): string {
  return `${sc.moving ? 'moving' : 'stationary'}, ${SPACE_WORDS[sc.space] ?? sc.space}`
}

export interface CityLine {
  name: string
  empire?: string
  own: boolean
}

export interface SpacecraftLine {
  name: string
  structure: string
  status: string
  empire?: string
  own: boolean
}

export interface MarkerList<T> {
  items: T[]
  /** Items beyond the cap. */
  more: number
  total: number
}

export interface MarkerSummary {
  cities: MarkerList<CityLine>
  spacecraft: MarkerList<SpacecraftLine>
}

/** Own-empire entries first; otherwise the exporter's order. */
function capped<T extends { stance?: string }, L>(list: readonly T[], line: (x: T) => L, cap: number): MarkerList<L> {
  const sorted = [...list.filter(isOwn), ...list.filter((x) => !isOwn(x))]
  return { items: sorted.slice(0, cap).map(line), more: Math.max(0, sorted.length - cap), total: sorted.length }
}

const cityLine = (c: City): CityLine => ({ name: c.name, ...(c.empire !== undefined && { empire: c.empire }), own: isOwn(c) })
const craftLine = (c: Spacecraft): SpacecraftLine => ({
  name: c.name,
  structure: c.structure,
  status: describeSpacecraft(c),
  ...(c.empire !== undefined && { empire: c.empire }),
  own: isOwn(c),
})

/** Compact, capped lists for the map hover card. Names are raw: render them through the label seam. */
export function summarizeMarkers(s: System, cap = MARKER_CAP): MarkerSummary {
  return { cities: capped(s.cities, cityLine, cap), spacecraft: capped(s.spacecraft, craftLine, cap) }
}

export interface RingworldMarkers {
  count: number
  /** xyz of each ringworld system. */
  positions: Float32Array
  systemIds: string[]
}

/**
 * Ringworld systems that can carry a map marker (BLUEPRINT R4): a ringworld arc among the bodies
 * and coordinates (Deep Space has none). The marker is one point per system, not per arc.
 */
export function buildRingworldMarkers(map: StarMap): RingworldMarkers {
  const rows = map.systems.filter((s): s is Located => s.x !== undefined && s.y !== undefined && s.z !== undefined && systemHasRingworld(s))
  const positions = new Float32Array(rows.length * 3)
  rows.forEach((s, i) => positions.set([s.x, s.y, s.z], i * 3))
  return { count: rows.length, positions, systemIds: rows.map((s) => s.systemId) }
}
