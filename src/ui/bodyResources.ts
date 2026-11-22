import type { Planet, Resource, Sphere, ZoneValue } from '@/data/types'

/** Quality at or above which a resource counts as high when the Prospect min-quality is unset (W18). */
export const DEFAULT_HIGH_QUALITY = 200

export interface BodyResourceRow {
  name: string
  sphere: Sphere
  /** Best quality across zones. */
  best: number
  /** Zones 1..4 in order; may be shorter than 4. */
  zones: ZoneValue[]
}

/** Flatten a planet's sphere resources into rows with their best quality. */
export function planetResourceRows(planet: Planet): BodyResourceRow[] {
  const spheres: [Sphere, Resource[] | undefined][] = [
    ['geosphere', planet.geosphere?.resources],
    ['hydrosphere', planet.hydrosphere?.resources],
    ['atmosphere', planet.atmosphere?.resources],
    ['biosphere', planet.biosphere?.resources],
  ]
  return spheres.flatMap(([sphere, rs]) =>
    (rs ?? []).map((r) => ({ name: r.name, sphere, zones: r.zones, best: Math.max(0, ...r.zones.map((z) => z.quality)) })),
  )
}

const byBestThenName = (a: BodyResourceRow, b: BodyResourceRow) => b.best - a.best || a.name.localeCompare(b.name)

export interface HighQualitySummary {
  items: BodyResourceRow[]
  /** True when nothing qualified and `items` holds the single best resource as a fallback. */
  dimmed: boolean
}

/**
 * Collapsed-card summary (W18): resources with best quality >= `minBestQuality` (or >= 200 when
 * unset/0), best first, ties by name. If none qualify, just the single best one, flagged dimmed.
 */
export function highQualitySummary(rows: readonly BodyResourceRow[], minBestQuality?: number): HighQualitySummary {
  const threshold = minBestQuality && minBestQuality > 0 ? minBestQuality : DEFAULT_HIGH_QUALITY
  const sorted = [...rows].sort(byBestThenName)
  const high = sorted.filter((r) => r.best >= threshold)
  if (high.length > 0) return { items: high, dimmed: false }
  return sorted.length > 0 ? { items: [sorted[0]!], dimmed: true } : { items: [], dimmed: false }
}
