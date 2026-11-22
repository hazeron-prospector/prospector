/**
 * Pure map preparation for the three.js scene (BLUEPRINT 14.3). No three.js import: the output is
 * typed arrays and plain objects the renderer feeds into BufferGeometry.
 *
 * Coordinates: system x/y/z are parsecs, as in the export. A sector's x/y/z is its cube CENTER
 * divided by 10 (verified on the sample: every system lies in [10*s - 5, 10*s + 5) on each axis),
 * so a sector cube is 10 parsecs wide centered on 10 * (x, y, z). Axes are passed through
 * unchanged; the renderer chooses which one is "up".
 */
import { qualityHsl, qualityRgb } from './color'
import type { Star, StarMap, System, WormholePolarity } from './types'

export const SECTOR_SIZE = 10

/** Point sizes in renderer pixel units (the renderer may scale them). */
export const SIZE_EXPLORED = 6
export const SIZE_SURVEYED = 7
export const SIZE_UNEXPLORED = 4
export const SIZE_DIM = 3
export const SIZE_HIGHLIGHT_MIN = 9
export const SIZE_HIGHLIGHT_MAX = 16

/** Unexplored systems get their star color multiplied by this. */
export const UNEXPLORED_DIM = 0.35
/** Non-matching systems while a resource highlight is active. */
export const DIM_GREY: [number, number, number] = [0.27, 0.29, 0.33]

/** Stub length for wormholes with no resolvable destination: 25% of the distance, capped (parsecs). */
export const STUB_FRACTION = 0.25
export const STUB_MAX_LENGTH = 3

export type RGB = [number, number, number]
export type Vec3 = [number, number, number]

export type LinkPolarity = WormholePolarity | 'unknown'

export const WORMHOLE_COLORS: Record<LinkPolarity, RGB> = {
  positive: [0.3, 0.79, 0.94],
  negative: [0.97, 0.15, 0.52],
  neutral: [0.6, 0.63, 0.65],
  unknown: [0.42, 0.45, 0.5],
}

const FALLBACK_STAR: RGB = [0.81, 0.83, 0.86]
const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]

/** Spectral letter (first word of the export's star `type`) to color. */
const SPECTRAL: Record<string, RGB> = {
  O: hex(0x9bb0ff),
  B: hex(0xaabfff),
  A: hex(0xcad7ff),
  F: hex(0xf8f7ff),
  G: hex(0xffe27a),
  K: hex(0xffa95c),
  M: hex(0xff6a4d),
  L: hex(0xb06a3b), // brown dwarfs
  T: hex(0xb06a3b),
  Y: hex(0xb06a3b),
  S: hex(0xd94f4f), // carbon
  C: hex(0xd94f4f),
  WC: hex(0x6ee7ff), // Wolf-Rayet
  WN: hex(0x6ee7ff),
}

/** Whole-type matches checked before the spectral letter. */
const SPECIAL: [string, RGB][] = [
  ['black hole', hex(0x9a6bff)],
  ['neutron', hex(0x5ce1e6)],
  ['magnetar', hex(0xff5cf0)],
]

/** Color for a star `type` string such as "G Yellow", "K T Tauri", "Neutron Star". */
export function starColor(type: string): RGB {
  const t = type.toLowerCase()
  for (const [needle, c] of SPECIAL) if (t.includes(needle)) return c
  const first = type.trim().split(/\s+/)[0] ?? ''
  return SPECTRAL[first] ?? FALLBACK_STAR
}

export interface SectorCube {
  sectorId: string
  name: string
  /** Cube center, parsecs. */
  center: Vec3
  min: Vec3
  max: Vec3
  size: number
  /** Where to anchor the label (cube center). */
  labelPosition: Vec3
  /** Systems in the map belonging to this sector. */
  systemCount: number
}

export interface WormholeLines {
  /** 6 floats per segment (two xyz endpoints). Links first, then stubs. */
  positions: Float32Array
  /** 6 floats per segment (rgb per endpoint; links blend polarity from each end). */
  colors: Float32Array
  /** Segments joining two systems. */
  linkCount: number
  /** Short segments toward an unresolved destination. */
  stubCount: number
}

export interface MapData {
  count: number
  /** xyz per system. */
  positions: Float32Array
  /** rgb 0..1 per system. */
  colors: Float32Array
  sizes: Float32Array
  /** 1 when the renderer should draw a ring (Surveyed, no highlight), else 0. */
  rings: Float32Array
  /** Point index to systemId. */
  systemIds: string[]
  indexOfSystem: Map<string, number>
  wormholes: WormholeLines
  sectors: SectorCube[]
  bounds: { center: Vec3; radius: number }
}

function hasCoords(s: System): s is System & { x: number; y: number; z: number } {
  return s.x !== undefined && s.y !== undefined && s.z !== undefined
}

function primaryStar(s: System): Star | undefined {
  return s.stars.find((st) => st.orbit.raw === 'Primary') ?? s.stars[0]
}

/**
 * Build typed arrays for the scene.
 * `highlight`: systemId -> best matching quality; `undefined` means no resource is selected
 * (star colors and explored status); a Map (even empty) means a highlight is active.
 */
export function buildMapData(map: StarMap, highlight?: ReadonlyMap<string, number>): MapData {
  const pts = map.systems.filter(hasCoords)
  const n = pts.length
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  const sizes = new Float32Array(n)
  const rings = new Float32Array(n)
  const systemIds: string[] = []
  const indexOfSystem = new Map<string, number>()

  pts.forEach((s, i) => {
    positions.set([s.x, s.y, s.z], i * 3)
    systemIds.push(s.systemId)
    indexOfSystem.set(s.systemId, i)
    let rgb: RGB
    let size: number
    if (highlight) {
      const q = highlight.get(s.systemId)
      if (q === undefined) {
        rgb = DIM_GREY
        size = SIZE_DIM
      } else {
        rgb = qualityRgb(q)
        size = SIZE_HIGHLIGHT_MIN + (SIZE_HIGHLIGHT_MAX - SIZE_HIGHLIGHT_MIN) * qualityHsl(q).t
      }
    } else {
      const base = starColor(primaryStar(s)?.type ?? '')
      if (s.eod === 'Unexplored') {
        rgb = [base[0] * UNEXPLORED_DIM, base[1] * UNEXPLORED_DIM, base[2] * UNEXPLORED_DIM]
        size = SIZE_UNEXPLORED
      } else {
        rgb = base
        size = s.eod === 'Surveyed' ? SIZE_SURVEYED : SIZE_EXPLORED
        if (s.eod === 'Surveyed') rings[i] = 1
      }
    }
    colors.set(rgb, i * 3)
    sizes[i] = size
  })

  return {
    count: n,
    positions,
    colors,
    sizes,
    rings,
    systemIds,
    indexOfSystem,
    wormholes: buildWormholes(pts),
    sectors: buildSectors(map),
    bounds: computeBounds(positions),
  }
}

function buildWormholes(pts: (System & { x: number; y: number; z: number })[]): WormholeLines {
  const byId = new Map(pts.map((s) => [s.systemId, s]))
  const pol = (p: WormholePolarity | undefined): RGB => WORMHOLE_COLORS[p ?? 'unknown']
  const links: { a: System & { x: number; y: number; z: number }; b: System & { x: number; y: number; z: number }; ca: RGB; cb: RGB }[] = []
  const linkIndex = new Map<string, number>()
  const stubs: { pos: number[]; c: RGB }[] = []

  for (const s of pts) {
    for (const w of s.wormholes) {
      const dest = w.destSystemId !== undefined ? byId.get(w.destSystemId) : undefined
      if (dest && dest.systemId !== s.systemId) {
        const [lo, hi] = s.systemId < dest.systemId ? [s, dest] : [dest, s]
        const key = `${lo.systemId}|${hi.systemId}`
        const at = linkIndex.get(key)
        if (at === undefined) {
          linkIndex.set(key, links.length)
          // Both ends start with this side's polarity; the reverse link may refine its own end.
          links.push({ a: lo, b: hi, ca: pol(w.polarity), cb: pol(w.polarity) })
        } else if (w.polarity !== undefined) {
          const l = links[at]!
          if (s === l.a) l.ca = pol(w.polarity)
          else l.cb = pol(w.polarity)
        }
        continue
      }
      if (dest) continue // self link
      const dx = w.destX - s.x
      const dy = w.destY - s.y
      const dz = w.destZ - s.z
      const dist = Math.hypot(dx, dy, dz)
      if (dist === 0) continue
      const len = Math.min(dist * STUB_FRACTION, STUB_MAX_LENGTH)
      const k = len / dist
      stubs.push({ pos: [s.x, s.y, s.z, s.x + dx * k, s.y + dy * k, s.z + dz * k], c: pol(w.polarity) })
    }
  }

  const total = links.length + stubs.length
  const positions = new Float32Array(total * 6)
  const colors = new Float32Array(total * 6)
  links.forEach((l, i) => {
    positions.set([l.a.x, l.a.y, l.a.z, l.b.x, l.b.y, l.b.z], i * 6)
    colors.set([...l.ca, ...l.cb], i * 6)
  })
  stubs.forEach((st, j) => {
    const i = links.length + j
    positions.set(st.pos, i * 6)
    colors.set([...st.c, ...st.c], i * 6)
  })
  return { positions, colors, linkCount: links.length, stubCount: stubs.length }
}

function buildSectors(map: StarMap): SectorCube[] {
  const counts = new Map<string, number>()
  for (const s of map.systems) counts.set(s.sectorId, (counts.get(s.sectorId) ?? 0) + 1)
  const h = SECTOR_SIZE / 2
  return map.sectors.map((sec) => {
    const center: Vec3 = [sec.x * SECTOR_SIZE, sec.y * SECTOR_SIZE, sec.z * SECTOR_SIZE]
    return {
      sectorId: sec.sectorId,
      name: sec.name,
      center,
      min: [center[0] - h, center[1] - h, center[2] - h],
      max: [center[0] + h, center[1] + h, center[2] + h],
      size: SECTOR_SIZE,
      labelPosition: center,
      systemCount: counts.get(sec.sectorId) ?? 0,
    }
  })
}

function computeBounds(p: Float32Array): { center: Vec3; radius: number } {
  if (p.length === 0) return { center: [0, 0, 0], radius: 10 }
  const lo: Vec3 = [Infinity, Infinity, Infinity]
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p[i + k]!
      if (v < lo[k]!) lo[k] = v
      if (v > hi[k]!) hi[k] = v
    }
  }
  const center: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
  let r2 = 0
  for (let i = 0; i < p.length; i += 3) {
    r2 = Math.max(r2, (p[i]! - center[0]) ** 2 + (p[i + 1]! - center[1]) ** 2 + (p[i + 2]! - center[2]) ** 2)
  }
  return { center, radius: Math.max(Math.sqrt(r2), 1) }
}
