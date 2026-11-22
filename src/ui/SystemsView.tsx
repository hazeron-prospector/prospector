import { useMemo, useState } from 'react'
import { DEFAULT_SYSTEM_FILTER, filterSystemRows, sortRows, type Sort, type SystemFilter } from '@/data/filter'
import type { SystemRow } from '@/data/rows'
import type { Eod } from '@/data/types'
import { mapColumn } from './ShowOnMapButton'
import { Highlight } from './Highlight'
import { QuickFilter } from './QuickFilter'
import { quickFilterSystems } from './quickFilter'
import { useNav } from './state/NavContext'
import { useResourceFilter } from './state/ResourceFilterContext'
import { FilterBar } from './FilterBar'
import { MultiSelect } from './MultiSelect'
import { Segmented } from './Segmented'
import { shimmerClass } from './rowTint'
import { RINGWORLD_OPTIONS } from './segmentedOptions'
import { VirtualTable, type Column } from './VirtualTable'

const STATUSES: Eod[] = ['Surveyed', 'Explored', 'Unexplored']

const makeColumns = (q: string): Column<SystemRow>[] => [
  mapColumn((r) => r.id),
  { id: 'name', header: 'Name', width: 170, sortKey: 'name', cell: (r) => <Highlight text={r.name} q={q} kind="system" /> },
  { id: 'catalog', header: 'Catalog', width: 140, sortKey: 'catalog', cell: (r) => (r.catalog ? <Highlight text={r.catalog} q={q} kind="system" /> : '') },
  { id: 'sector', header: 'Sector', width: 110, sortKey: 'sectorName', cell: (r) => <Highlight text={r.sectorName} q={q} kind="sector" /> },
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

export function SystemsView({ rows }: { rows: readonly SystemRow[] }) {
  const nav = useNav()
  const [filter, setFilter] = useState<SystemFilter>(DEFAULT_SYSTEM_FILTER)
  const [sort, setSort] = useState<Sort<SystemRow>>({ key: 'name', dir: 'asc' })
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort])
  const { quickFilter, setQuickFilter } = useResourceFilter()
  const quick = quickFilter.systems
  const shown = useMemo(() => quickFilterSystems(filterSystemRows(sorted, filter), quick), [sorted, filter, quick])
  const columns = useMemo(() => makeColumns(quick.trim()), [quick])
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar shown={shown.length} total={rows.length} onReset={() => {
          setFilter(DEFAULT_SYSTEM_FILTER)
          setQuickFilter('systems', '')
        }}
      >
        <QuickFilter value={quick} onChange={(v) => setQuickFilter('systems', v)} placeholder="Filter by system, catalog or sector name" />
        <MultiSelect label="Status" options={STATUSES} value={filter.eod} onChange={(eod) => setFilter((f) => ({ ...f, eod }))} />
        <Segmented label="Ringworld" options={RINGWORLD_OPTIONS} value={filter.ringworld} onChange={(ringworld) => setFilter((f) => ({ ...f, ringworld }))} />
      </FilterBar>
      <VirtualTable
        rows={shown}
        columns={columns}
        rowKey={(r) => r.id}
        sort={sort}
        onSort={setSort}
        onRowClick={(r) => nav.peekSystem(r.id, r.id)}
        selectedKey={nav.selectedKey}
        rowClassName={shimmerClass}
      />
    </div>
  )
}
