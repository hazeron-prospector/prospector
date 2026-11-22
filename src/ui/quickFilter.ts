/** Per-table quick filter predicates (BLUEPRINT V11): case-insensitive substring, no fuzzy. */
import { substringMatch } from '@/data/search'
import type { BodyRow, ResourceRow, SystemRow } from '@/data/rows'

/** Resources table: system name or body name. Empty query matches everything. */
export function matchesResourceQuick(r: Pick<ResourceRow, 'systemName' | 'bodyName'>, q: string): boolean {
  return substringMatch(r.systemName, q) !== undefined || substringMatch(r.bodyName, q) !== undefined
}

export function quickFilterResources(rows: readonly ResourceRow[], q: string): readonly ResourceRow[] {
  const t = q.trim()
  return t ? rows.filter((r) => matchesResourceQuick(r, t)) : rows
}

function quickFilterBy<T>(rows: readonly T[], q: string, texts: (r: T) => (string | undefined)[]): readonly T[] {
  const t = q.trim()
  if (!t) return rows
  return rows.filter((r) => texts(r).some((x) => x !== undefined && substringMatch(x, t) !== undefined))
}

/** Planets table: system name or body name. */
export function quickFilterBodies(rows: readonly BodyRow[], q: string): readonly BodyRow[] {
  return quickFilterBy(rows, q, (r) => [r.systemName, r.bodyName])
}

/** Systems table: system, catalog or sector name (the palette's sector action filters by sector). */
export function quickFilterSystems(rows: readonly SystemRow[], q: string): readonly SystemRow[] {
  return quickFilterBy(rows, q, (r) => [r.name, r.catalog, r.sectorName])
}
