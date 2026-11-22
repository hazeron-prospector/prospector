/** Per-system summaries for the map hover card, peek panel and system preview (BLUEPRINT W2, W3). Pure. */
import type { ResourceRow } from './rows'
import type { Planet, Sphere, StarMap } from './types'

/** Standard atmosphere in the Habitable orbital zone (W3). */
export function isHabitableWorld(p: Pick<Planet, 'zone' | 'atmosphere'>): boolean {
  return p.atmosphere?.atmosphereType === 'Standard' && p.zone === 'Habitable'
}

export interface SummaryResource {
  resource: string
  bestQuality: number
  bodyName: string
  sphere: Sphere
}

export interface SystemSummary {
  systemId: string
  habitableCount: number
  /** Best deposit per resource name, highest quality first (ties by name). Capped at `topN`. */
  topResources: SummaryResource[]
}

export const DEFAULT_TOP_N = 5

type Pickable = Pick<ResourceRow, 'resource' | 'bestQuality' | 'bodyName' | 'sphere' | 'systemId'>

const byQuality = (a: SummaryResource, b: SummaryResource): number =>
  b.bestQuality - a.bestQuality || (a.resource < b.resource ? -1 : a.resource > b.resource ? 1 : 0)

/**
 * systemId -> best deposit per resource name, highest quality first, at most `topN` each.
 * Feed it all rows for overall tops, or the filtered rows for the best matching deposits.
 */
export function bestDepositsBySystem(rows: readonly Pickable[], topN = DEFAULT_TOP_N): Map<string, SummaryResource[]> {
  const per = new Map<string, Map<string, SummaryResource>>()
  for (const r of rows) {
    let m = per.get(r.systemId)
    if (!m) per.set(r.systemId, (m = new Map()))
    const cur = m.get(r.resource)
    if (!cur || r.bestQuality > cur.bestQuality) {
      m.set(r.resource, { resource: r.resource, bestQuality: r.bestQuality, bodyName: r.bodyName, sphere: r.sphere })
    }
  }
  const out = new Map<string, SummaryResource[]>()
  for (const [id, m] of per) out.set(id, [...m.values()].sort(byQuality).slice(0, topN))
  return out
}

export function buildSystemSummaries(
  map: StarMap,
  resourceRows: readonly Pickable[],
  topN = DEFAULT_TOP_N,
): Map<string, SystemSummary> {
  const tops = bestDepositsBySystem(resourceRows, topN)
  const out = new Map<string, SystemSummary>()
  for (const s of map.systems) {
    out.set(s.systemId, {
      systemId: s.systemId,
      habitableCount: s.planets.filter(isHabitableWorld).length,
      topResources: tops.get(s.systemId) ?? [],
    })
  }
  return out
}

/** "2 habitable worlds" / "1 habitable world" / "No habitable worlds". */
export function habitableLabel(count: number): string {
  if (count <= 0) return 'No habitable worlds'
  return `${count} habitable world${count === 1 ? '' : 's'}`
}
