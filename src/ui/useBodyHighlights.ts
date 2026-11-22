import { useMemo } from 'react'
import type { ResourceRow } from '@/data/rows'
import type { ResourceFilter } from '@/data/filter'
import { useResourceFilter } from './state/ResourceFilterContext'

/** A resource/category/min-quality filter is on. */
export const isResourceFilterActive = (f: ResourceFilter): boolean =>
  f.resources.length > 0 || f.categories.length > 0 || (f.minBestQuality ?? 0) > 0

/** Best matching quality per body of one system; empty unless a resource/category filter is active. */
export function bodyHighlights(rows: readonly ResourceRow[], systemId: string, active: boolean): Map<string, number> {
  const m = new Map<string, number>()
  if (!active) return m
  for (const r of rows) {
    if (r.systemId !== systemId) continue
    if (r.bestQuality > (m.get(r.bodyId) ?? 0)) m.set(r.bodyId, r.bestQuality)
  }
  return m
}

/** Bodies of `systemId` present in the shared filtered resource rows while a resource/category/min-quality filter is on. */
export function useBodyHighlights(systemId: string): Map<string, number> {
  const { filter, filteredResourceRows } = useResourceFilter()
  const active = isResourceFilterActive(filter)
  return useMemo(() => bodyHighlights(filteredResourceRows, systemId, active), [filteredResourceRows, systemId, active])
}
