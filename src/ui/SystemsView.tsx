import { useMemo, useState } from 'react'
import { DEFAULT_SYSTEM_FILTER, filterSystemRows, sortRows, type Sort, type SystemFilter } from '@/data/filter'
import type { SystemRow } from '@/data/rows'
import type { Eod } from '@/data/types'
import { FilterBar } from './FilterBar'
import { MultiSelect } from './MultiSelect'
import { VirtualTable, type Column } from './VirtualTable'

const STATUSES: Eod[] = ['Surveyed', 'Explored', 'Unexplored']

const COLUMNS: Column<SystemRow>[] = [
  { id: 'name', header: 'Name', width: 170, sortKey: 'name', cell: (r) => r.name },
  { id: 'catalog', header: 'Catalog', width: 140, sortKey: 'catalog', cell: (r) => r.catalog ?? '' },
  { id: 'sector', header: 'Sector', width: 110, sortKey: 'sectorName', cell: (r) => r.sectorName },
  {
    id: 'status',
    header: 'Status',
    width: 95,
    sortKey: 'eod',
    cell: (r) => <span className={r.eod === 'Unexplored' ? 'text-muted-foreground' : ''}>{r.eod}</span>,
  },
  { id: 'stars', header: 'Star types', width: 260, sortKey: 'starTypesText', cell: (r) => r.starTypesText },
  { id: 'planets', header: 'Planets', width: 70, align: 'right', sortKey: 'planetCount', firstDir: 'desc', cell: (r) => r.planetCount },
  {
    id: 'cities',
    header: 'Cities',
    width: 180,
    sortKey: 'cityCount',
    firstDir: 'desc',
    cell: (r) =>
      r.cityCount > 0 ? (
        <span
          className="block truncate text-accent-foreground"
          title={`${r.cityCount} (${r.inhabitingEmpires.join(', ') || 'unknown empire'})`}
        >
          {r.cityCount} ({r.inhabitingEmpires.join(', ') || 'unknown empire'})
        </span>
      ) : (
        ''
      ),
  },
  { id: 'wh', header: 'Wormholes', width: 85, align: 'right', sortKey: 'wormholeCount', firstDir: 'desc', cell: (r) => r.wormholeCount },
]

export function SystemsView({
  rows,
  onOpenSystem,
}: {
  rows: readonly SystemRow[]
  onOpenSystem: (systemId: string) => void
}) {
  const [filter, setFilter] = useState<SystemFilter>(DEFAULT_SYSTEM_FILTER)
  const [sort, setSort] = useState<Sort<SystemRow>>({ key: 'name', dir: 'asc' })
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort])
  const shown = useMemo(() => filterSystemRows(sorted, filter), [sorted, filter])
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar shown={shown.length} total={rows.length} onReset={() => setFilter(DEFAULT_SYSTEM_FILTER)}>
        <MultiSelect label="Status" options={STATUSES} value={filter.eod} onChange={(eod) => setFilter({ eod })} />
      </FilterBar>
      <VirtualTable
        rows={shown}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        sort={sort}
        onSort={setSort}
        onRowClick={(r) => onOpenSystem(r.id)}
      />
    </div>
  )
}
