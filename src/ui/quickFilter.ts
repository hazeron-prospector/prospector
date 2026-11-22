/** Per-table quick filter predicates (BLUEPRINT V11): case-insensitive substring, no fuzzy. */
import { substringMatch } from '@/data/search'
import type { ResourceRow } from '@/data/rows'

/** Resources table: system name or body name. Empty query matches everything. */
export function matchesResourceQuick(r: Pick<ResourceRow, 'systemName' | 'bodyName'>, q: string): boolean {
  return substringMatch(r.systemName, q) !== undefined || substringMatch(r.bodyName, q) !== undefined
}

export function quickFilterResources(rows: readonly ResourceRow[], q: string): readonly ResourceRow[] {
  const t = q.trim()
  return t ? rows.filter((r) => matchesResourceQuick(r, t)) : rows
}
