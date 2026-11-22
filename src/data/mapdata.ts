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
import { isHabitableWorld } from './systemSummary'
import type { Star, StarMap, System } from './types'

export const SECTOR_SIZE = 10

/** Point sizes in renderer pixel units (the renderer may scale them). */
export const SIZE_EXPLORED = 6
export const SIZE_SURVEYED = 7
export const SIZE_UNEXPLORED = 4
export const SIZE_DIM = 3
export const SIZE_HIGHLIGHT_MIN = 6
export const SIZE_HIGHLIGHT_MAX = 10

/** Unexplored systems get their base color (neutral or star color) multiplied by this. */
export const UNEXPLORED_DIM = 0.35
/** Default system color (W13): Explored and Surveyed systems without a habitable world. */
export const NEUTRAL_COLOR: [number, number, number] = [0.78, 0.82, 0.88]
/** Systems with at least one habitable world (W3, W13). */
export const HABITABLE_COLOR: [number, number, number] = [0.3, 0.9, 0.45]
/** Non-matching systems while a resource highlight is active. */
export const DIM_GREY: [number, number, number] = [0.27, 0.29, 0.33]

export type RGB = [number, number, number]
export type Vec3 = [number, number, number]

/** In-game wormhole colors (austarmapwidget.cpp): explored rgba(192,64,32,200), unexplored rgba(32,64,192,200). */
export const WORMHOLE_EXPLORED: RGB = [192 / 255, 64 / 255, 32 / 255]
export const WORMHOLE_UNEXPLORED: RGB = [32 / 255, 64 / 255, 192 / 255]
export const WORMHOLE_OPACITY = 200 / 255

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
  /** 6 floats per segment (two xyz endpoints): the system, then its wormhole's destination. Explored segments first. */
  positions: Float32Array
  /** 6 floats per segment: the same flat rgb at both endpoints (no gradient). */
  colors: Float32Array
  /** Leading segments that are explored; the rest are unexplored. */
  exploredCount: number
  unexploredCount: number
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
  /** Extents of every system position. */
  bounds: { center: Vec3; radius: number }
  /**
   * Where the initial/reset camera looks: the dense core. Equals `bounds` unless far outlier
   * systems stretch the extents (the sample has a small group ~1500 pc from the other ~1000
   * systems); outliers stay on the map, reachable by panning.
   */
  frame: { center: Vec3; radius: number }
}

function hasCoords(s: System): s is System & { x: number; y: number; z: number } {
  return s.x !== undefined && s.y !== undefined && s.z !== undefined
}

function primaryStar(s: System): Star | undefined {
  return s.stars.find((st) => st.orbit.raw === 'Primary') ?? s.stars[0]
}

export interface StyleOptions {
  /** Color systems by their primary star instead of the neutral / habitable scheme (default false). */
  starColor?: boolean
  /** Explored-status styling: dim Unexplored, ring Surveyed (default true). */
  status?: boolean
}

/** True when the system has at least one habitable world (W3). */
export function hasHabitableWorld(s: System): boolean {
  return s.planets.some(isHabitableWorld)
}

/**
 * Build typed arrays for the scene.
 * `highlight`: systemId -> best matching quality; `undefined` means no resource is selected
 * (default styling); a Map (even empty) means a highlight is active and overrides `style`.
 * Default styling (W13): Unexplored dim, Explored/Surveyed neutral, habitable worlds green;
 * `style.starColor` restores the old star-color styling.
 */
export function buildMapData(map: StarMap, highlight?: ReadonlyMap<string, number>, style: StyleOptions = {}): MapData {
  const useStarColor = style.starColor ?? false
  const useStatus = style.status ?? true
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
      const base = useStarColor
        ? starColor(primaryStar(s)?.type ?? '')
        : hasHabitableWorld(s)
          ? HABITABLE_COLOR
          : NEUTRAL_COLOR
      if (useStatus && s.eod === 'Unexplored') {
        rgb = [base[0] * UNEXPLORED_DIM, base[1] * UNEXPLORED_DIM, base[2] * UNEXPLORED_DIM]
        size = SIZE_UNEXPLORED
      } else {
        rgb = base
        size = useStatus && s.eod === 'Surveyed' ? SIZE_SURVEYED : SIZE_EXPLORED
        if (useStatus && s.eod === 'Surveyed') rings[i] = 1
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
    frame: computeFrame(positions),
  }
}

const coordKey = (x: number, y: number, z: number): string => `${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`

type Located = System & { x: number; y: number; z: number }

/**
 * Wormhole segments like the in-game map (W14): one flat-colored line per wormhole, running from
 * the system to its `destX/Y/Z` whether or not the destination is in the map. Per system, an
 * unexplored wormhole to a destination that also has an explored one is dropped; A-to-B and
 * B-to-A collapse into one line, explored winning.
 */
function buildWormholes(pts: Located[]): WormholeLines {
  const byId = new Map(pts.map((s) => [s.systemId, s]))
  const byCoord = new Map(pts.map((s) => [coordKey(s.x, s.y, s.z), s]))
  const lines = new Map<string, { from: Located; to: Vec3; explored: boolean }>()

  for (const s of pts) {
    // Per system: explored wins over unexplored for the same destination.
    const dests = new Map<string, { to: Vec3; destId: string; explored: boolean }>()
    for (const w of s.wormholes) {
      const dest = (w.destSystemId !== undefined ? byId.get(w.destSystemId) : undefined) ?? byCoord.get(coordKey(w.destX, w.destY, w.destZ))
      const destId = dest?.systemId ?? coordKey(w.destX, w.destY, w.destZ)
      if (destId === s.systemId) continue
      const cur = dests.get(destId)
      if (!cur) dests.set(destId, { to: [w.destX, w.destY, w.destZ], destId, explored: w.explored })
      else if (w.explored && !cur.explored) dests.set(destId, { to: [w.destX, w.destY, w.destZ], destId, explored: true })
    }
    for (const d of dests.values()) {
      const key = s.systemId < d.destId ? `${s.systemId}|${d.destId}` : `${d.destId}|${s.systemId}`
      const cur = lines.get(key)
      if (!cur) lines.set(key, { from: s, to: d.to, explored: d.explored })
      else if (d.explored && !cur.explored) cur.explored = true
    }
  }

  const all = [...lines.values()]
  const ordered = [...all.filter((l) => l.explored), ...all.filter((l) => !l.explored)]
  const positions = new Float32Array(ordered.length * 6)
  const colors = new Float32Array(ordered.length * 6)
  ordered.forEach((l, i) => {
    positions.set([l.from.x, l.from.y, l.from.z, ...l.to], i * 6)
    const c = l.explored ? WORMHOLE_EXPLORED : WORMHOLE_UNEXPLORED
    colors.set([...c, ...c], i * 6)
  })
  const exploredCount = all.filter((l) => l.explored).length
  return { positions, colors, exploredCount, unexploredCount: all.length - exploredCount }
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

/** A system is an outlier when it is farther than this many times the 90th-percentile distance from the median. */
export const FRAME_OUTLIER_FACTOR = 3

/** Bounds of the dense core: systems within `FRAME_OUTLIER_FACTOR` x p90 distance of the per-axis median. */
export function computeFrame(p: Float32Array): { center: Vec3; radius: number } {
  const n = p.length / 3
  if (n === 0) return computeBounds(p)
  const median = (k: number): number => {
    const v = new Float32Array(n)
    for (let i = 0; i < n; i++) v[i] = p[i * 3 + k]!
    v.sort()
    return v[n >> 1]!
  }
  const m: Vec3 = [median(0), median(1), median(2)]
  const dist = new Float32Array(n)
  for (let i = 0; i < n; i++) dist[i] = Math.hypot(p[i * 3]! - m[0], p[i * 3 + 1]! - m[1], p[i * 3 + 2]! - m[2])
  const p90 = Float32Array.from(dist).sort()[Math.min(n - 1, Math.floor(n * 0.9))]!
  const limit = Math.max(p90 * FRAME_OUTLIER_FACTOR, 1)
  const core: number[] = []
  for (let i = 0; i < n; i++) if (dist[i]! <= limit) core.push(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!)
  return computeBounds(Float32Array.from(core))
}
