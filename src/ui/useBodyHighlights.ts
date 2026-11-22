import { useMemo } from 'react'
import type { ResourceRow } from '@/data/rows'
import { useResourceFilter } from './state/ResourceFilterContext'

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

/** Bodies of `systemId` present in the shared filtered resource rows while a resource/category filter is on. */
export function useBodyHighlights(systemId: string): Map<string, number> {
  const { filter, filteredResourceRows } = useResourceFilter()
  const active = filter.resources.length > 0 || filter.categories.length > 0
  return useMemo(() => bodyHighlights(filteredResourceRows, systemId, active), [filteredResourceRows, systemId, active])
}
