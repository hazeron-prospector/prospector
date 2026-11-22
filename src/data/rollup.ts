/** Best-per-system rollup of (already filtered) resource rows (BLUEPRINT 14.6). Pure. */
import type { ResourceRow } from './rows'

/** The ResourceRow fields the rollup reads; extra fields on the input are ignored. */
export type RollupInput = Pick<
  ResourceRow,
  | 'resource'
  | 'bestQuality'
  | 'systemId'
  | 'systemName'
  | 'sectorName'
  | 'bodyId'
  | 'bodyName'
  | 'bodyType'
  | 'inhabited'
  | 'inhabitingEmpires'
  | 'systemHabitable'
  | 'hasRingworld'
> & { id: string }

/** One row per system. Flat fields only, so `sortRows` works on every column. */
export interface SystemRollupRow {
  /** systemId (stable row key). */
  id: string
  systemId: string
  systemName: string
  sectorName: string
  /** Quality of the best deposit (max `bestQuality` over matching rows). */
  bestQuality: number
  bestBodyId: string
  bestBodyName: string
  bestBodyType: string
  bestResource: string
  /** Distinct matching bodies. */
  bodyCount: number
  /** Matching deposit rows. */
  depositCount: number
  inhabited: boolean
  inhabitingEmpires: string[]
  systemHabitable: boolean
  hasRingworld: boolean
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/** True when `a` is a better pick than `b`: higher quality, then resource, body name, body id (ascending). */
function better(a: RollupInput, b: RollupInput): boolean {
  if (a.bestQuality !== b.bestQuality) return a.bestQuality > b.bestQuality
  const byResource = collator.compare(a.resource, b.resource)
  if (byResource !== 0) return byResource < 0
  const byBody = collator.compare(a.bodyName, b.bodyName)
  if (byBody !== 0) return byBody < 0
  return a.bodyId < b.bodyId
}

/**
 * Roll rows up to one per system. Best pick: highest quality; ties by resource name, then body
 * name (case-insensitive, numeric-aware), then body id, so the result never depends on input order.
 * Output order is first appearance of each system in the input.
 */
export function rollupBySystem(rows: readonly RollupInput[]): SystemRollupRow[] {
  const groups = new Map<string, { best: RollupInput; bodies: Set<string>; deposits: number }>()
  for (const r of rows) {
    const g = groups.get(r.systemId)
    if (!g) {
      groups.set(r.systemId, { best: r, bodies: new Set([r.bodyId]), deposits: 1 })
      continue
    }
    g.bodies.add(r.bodyId)
    g.deposits++
    if (better(r, g.best)) g.best = r
  }
  const out: SystemRollupRow[] = []
  for (const [systemId, g] of groups) {
    const b = g.best
    out.push({
      id: systemId,
      systemId,
      systemName: b.systemName,
      sectorName: b.sectorName,
      bestQuality: b.bestQuality,
      bestBodyId: b.bodyId,
      bestBodyName: b.bodyName,
      bestBodyType: b.bodyType,
      bestResource: b.resource,
      bodyCount: g.bodies.size,
      depositCount: g.deposits,
      inhabited: b.inhabited,
      inhabitingEmpires: b.inhabitingEmpires,
      systemHabitable: b.systemHabitable,
      hasRingworld: b.hasRingworld,
    })
  }
  return out
}
