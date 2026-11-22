import { useMemo } from 'react'
import { DEFAULT_RESOURCE_FILTER, sortRows, filterResourceRows } from '@/data/filter'
import type { ResourceRow } from '@/data/rows'
import type { Sphere } from '@/data/types'
import { distinct } from './distinct'
import { FilterBar } from './FilterBar'
import { MultiSelect } from './MultiSelect'
import { NumberInput } from './NumberInput'
import { QualityCell } from './QualityCell'
import { Segmented } from './Segmented'
import { InhabitedCell } from './InhabitedCell'
import { INHABITED_OPTIONS } from './segmentedOptions'
import { useResourceFilter } from './state/ResourceFilterContext'
import { VirtualTable, type Column } from './VirtualTable'

const SPHERES: Sphere[] = ['geosphere', 'hydrosphere', 'atmosphere', 'biosphere', 'star']

function zoneCol(n: 1 | 2 | 3 | 4): Column<ResourceRow> {
  const q = `q${n}` as const
  const a = `a${n}` as const
  return {
    id: q,
    header: `Z${n} q/ab`,
    width: 84,
    sortKey: q,
    firstDir: 'desc',
    cell: (r) => <QualityCell q={r[q]} a={r[a]} />,
  }
}

const COLUMNS: Column<ResourceRow>[] = [
  { id: 'resource', header: 'Resource', width: 150, sortKey: 'resource', cell: (r) => r.resource },
  {
    id: 'best',
    header: 'Best Q',
    width: 70,
    sortKey: 'bestQuality',
    firstDir: 'desc',
    cell: (r) => <QualityCell q={r.bestQuality} />,
  },
  { id: 'system', header: 'System', width: 150, sortKey: 'systemName', cell: (r) => r.systemName },
  { id: 'body', header: 'Body', width: 140, sortKey: 'bodyName', cell: (r) => r.bodyName },
  { id: 'type', header: 'Type', width: 85, sortKey: 'bodyType', cell: (r) => r.bodyType },
  {
    id: 'zone',
    header: 'Orb. zone',
    width: 90,
    sortKey: 'orbitalZone',
    cell: (r) => r.orbitalZone ?? <span className="text-muted-foreground/40">-</span>,
  },
  { id: 'sphere', header: 'Sphere', width: 90, sortKey: 'sphere', cell: (r) => r.sphere },
  zoneCol(1),
  zoneCol(2),
  zoneCol(3),
  zoneCol(4),
  {
    id: 'inhabited',
    header: 'Inhab.',
    width: 150,
    sortKey: 'inhabited',
    firstDir: 'desc',
    cell: (r) => <InhabitedCell inhabited={r.inhabited} empires={r.inhabitingEmpires} />,
  },
]

export function ResourcesView({
  rows,
  onOpenSystem,
}: {
  rows: readonly ResourceRow[]
  onOpenSystem: (systemId: string) => void
}) {
  const { filter, patch, setFilter, sort, setSort } = useResourceFilter()

  const options = useMemo(
    () => ({
      resources: distinct(rows, (r) => r.resource),
      bodyTypes: distinct(rows, (r) => r.bodyType),
      zones: distinct(rows, (r) => r.orbitalZone),
    }),
    [rows],
  )
  // Sort once per sort change; filtering preserves order.
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort])
  const shown = useMemo(() => filterResourceRows(sorted, filter), [sorted, filter])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar
        shown={shown.length}
        total={rows.length}
        onReset={() => setFilter(DEFAULT_RESOURCE_FILTER)}
      >
        <MultiSelect label="Resource" searchable options={options.resources} value={filter.resources} onChange={(resources) => patch({ resources })} />
        <NumberInput label="Min Q" value={filter.minBestQuality} onChange={(minBestQuality) => patch({ minBestQuality })} />
        <MultiSelect label="Body type" options={options.bodyTypes} value={filter.bodyTypes} onChange={(bodyTypes) => patch({ bodyTypes })} />
        <MultiSelect label="Orbital zone" options={options.zones} value={filter.orbitalZones} onChange={(orbitalZones) => patch({ orbitalZones })} />
        <MultiSelect label="Sphere" options={SPHERES} value={filter.spheres} onChange={(spheres) => patch({ spheres })} />
        <Segmented label="Inhabited" options={INHABITED_OPTIONS} value={filter.inhabited} onChange={(inhabited) => patch({ inhabited })} />
      </FilterBar>
      <VirtualTable
        rows={shown}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        sort={sort}
        onSort={setSort}
        onRowClick={(r) => onOpenSystem(r.systemId)}
      />
    </div>
  )
}
