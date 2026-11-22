/**
 * Shared resource-table state (BLUEPRINT 14.7): filter, sort, rollup toggle and the per-table
 * quick-filter text. In memory only. The provider is mounted in AppShell, so it remounts (and
 * resets) together with the map.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_RESOURCE_FILTER,
  DEFAULT_RESOURCE_SORT,
  filterResourceRows,
  type ResourceFilter,
  type Sort,
} from '@/data/filter'
import type { ResourceRow } from '@/data/rows'
import type { SystemRollupRow } from '@/data/rollup'

/** Tables that have a quick filter. */
export type QuickFilterTab = 'resources' | 'planets' | 'systems'

export const DEFAULT_ROLLUP_SORT: Sort<SystemRollupRow> = { key: 'bestQuality', dir: 'desc' }

export interface ResourceFilterStore {
  /** All resource rows of the loaded map (unfiltered). */
  allRows: readonly ResourceRow[]
  filter: ResourceFilter
  setFilter: (f: ResourceFilter) => void
  patch: (p: Partial<ResourceFilter>) => void
  /** Reset the filter and the Resources quick filter (rollup toggle and sorts are kept). */
  reset: () => void
  /** `allRows` with `filter` applied; no quick filter, original row order. */
  filteredResourceRows: readonly ResourceRow[]
  sort: Sort<ResourceRow>
  setSort: (s: Sort<ResourceRow>) => void
  rollup: boolean
  setRollup: (on: boolean) => void
  rollupSort: Sort<SystemRollupRow>
  setRollupSort: (s: Sort<SystemRollupRow>) => void
  quickFilter: Record<QuickFilterTab, string>
  setQuickFilter: (tab: QuickFilterTab, text: string) => void
}

const Ctx = createContext<ResourceFilterStore | null>(null)

export function ResourceFilterProvider({ rows, children }: { rows: readonly ResourceRow[]; children: ReactNode }) {
  const [filter, setFilter] = useState<ResourceFilter>(DEFAULT_RESOURCE_FILTER)
  const [sort, setSort] = useState<Sort<ResourceRow>>(DEFAULT_RESOURCE_SORT)
  const [rollup, setRollup] = useState(false)
  const [rollupSort, setRollupSort] = useState<Sort<SystemRollupRow>>(DEFAULT_ROLLUP_SORT)
  const [quickFilter, setQuick] = useState<Record<QuickFilterTab, string>>({ resources: '', planets: '', systems: '' })

  const patch = useCallback((p: Partial<ResourceFilter>) => setFilter((f) => ({ ...f, ...p })), [])
  const setQuickFilter = useCallback((tab: QuickFilterTab, text: string) => setQuick((q) => ({ ...q, [tab]: text })), [])
  const reset = useCallback(() => {
    setFilter(DEFAULT_RESOURCE_FILTER)
    setQuick((q) => ({ ...q, resources: '' }))
  }, [])
  const filteredResourceRows = useMemo(() => filterResourceRows(rows, filter), [rows, filter])

  const value = useMemo<ResourceFilterStore>(
    () => ({
      allRows: rows,
      filter,
      setFilter,
      patch,
      reset,
      filteredResourceRows,
      sort,
      setSort,
      rollup,
      setRollup,
      rollupSort,
      setRollupSort,
      quickFilter,
      setQuickFilter,
    }),
    [rows, filter, patch, reset, filteredResourceRows, sort, rollup, rollupSort, quickFilter, setQuickFilter],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useResourceFilter(): ResourceFilterStore {
  const v = useContext(Ctx)
  if (!v) throw new Error('useResourceFilter must be used inside ResourceFilterProvider')
  return v
}
