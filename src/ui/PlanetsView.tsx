import { useMemo, useState } from 'react'
import {
  DEFAULT_BODY_FILTER,
  filterBodyRows,
  sortRows,
  type BodyFilter,
  type Range,
  type Sort,
} from '@/data/filter'
import type { BodyRow } from '@/data/rows'
import { distinct } from './distinct'
import { FilterBar } from './FilterBar'
import { MultiSelect } from './MultiSelect'
import { NumberInput } from './NumberInput'
import { Segmented } from './Segmented'
import { Highlight } from './Highlight'
import { QuickFilter } from './QuickFilter'
import { quickFilterBodies } from './quickFilter'
import { useResourceFilter } from './state/ResourceFilterContext'
import { InhabitedCell } from './InhabitedCell'
import { INHABITED_OPTIONS, TRI_OPTIONS } from './segmentedOptions'
import { VirtualTable, type Column } from './VirtualTable'

const num = (n: number | undefined, digits = 0) =>
  n === undefined ? '' : n.toLocaleString('en-US', { maximumFractionDigits: digits })
// <biosphere> is exported only when life exists, so missing means none known.
const tri = (b: boolean | undefined) => (b ? 'yes' : 'no')

const makeColumns = (q: string): Column<BodyRow>[] => [
  { id: 'system', header: 'System', width: 150, sortKey: 'systemName', cell: (r) => <Highlight text={r.systemName} q={q} /> },
  { id: 'body', header: 'Body', width: 140, sortKey: 'bodyName', cell: (r) => <Highlight text={r.bodyName} q={q} /> },
  { id: 'type', header: 'Type', width: 85, sortKey: 'bodyType', cell: (r) => r.bodyType },
  { id: 'zone', header: 'Orb. zone', width: 90, sortKey: 'orbitalZone', cell: (r) => r.orbitalZone },
  {
    id: 'diam',
    header: 'Diameter m',
    width: 100,
    align: 'right',
    sortKey: 'diameterM',
    firstDir: 'desc',
    cell: (r) => num(r.diameterM) || (r.ringRadiusM !== undefined ? `R ${num(r.ringRadiusM)}` : ''),
  },
  { id: 'grav', header: 'Grav m/s²', width: 85, align: 'right', sortKey: 'gravity', firstDir: 'desc', cell: (r) => num(r.gravity, 2) },
  { id: 'atm', header: 'Atmosphere', width: 90, sortKey: 'atmosphereType', cell: (r) => r.atmosphereType ?? '' },
  { id: 'dens', header: 'Dens %', width: 70, align: 'right', sortKey: 'atmosphereDensityPct', firstDir: 'desc', cell: (r) => num(r.atmosphereDensityPct) },
  { id: 'liq', header: 'Liquid', width: 110, align: 'right', sortKey: 'liquidPct', firstDir: 'desc', cell: (r) => (r.liquidPct === undefined ? '' : `${num(r.liquidPct)}%${r.liquidType ? ` ${r.liquidType}` : ''}`) },
  { id: 'flora', header: 'Flora', width: 55, sortKey: 'flora', firstDir: 'desc', cell: (r) => tri(r.flora) },
  { id: 'fauna', header: 'Fauna', width: 55, sortKey: 'fauna', firstDir: 'desc', cell: (r) => tri(r.fauna) },
  { id: 'zones', header: 'Res. zones', width: 80, align: 'right', sortKey: 'resourceZones', firstDir: 'desc', cell: (r) => r.resourceZones ?? '' },
  {
    id: 'inhabited',
    header: 'Inhab.',
    width: 150,
    sortKey: 'inhabited',
    firstDir: 'desc',
    cell: (r) => <InhabitedCell inhabited={r.inhabited} empires={r.inhabitingEmpires} />,
  },
]

function RangeInputs({ label, value, onChange }: { label: string; value: Range; onChange: (r: Range) => void }) {
  return (
    <span className="flex items-center gap-1">
      <NumberInput label={`${label} min`} value={value.min} onChange={(min) => onChange({ ...value, min })} />
      <NumberInput label="max" value={value.max} onChange={(max) => onChange({ ...value, max })} />
    </span>
  )
}

export function PlanetsView({
  rows,
  onOpenSystem,
}: {
  rows: readonly BodyRow[]
  onOpenSystem: (systemId: string) => void
}) {
  const [filter, setFilter] = useState<BodyFilter>(DEFAULT_BODY_FILTER)
  const [sort, setSort] = useState<Sort<BodyRow>>({ key: 'systemName', dir: 'asc' })
  const patch = (p: Partial<BodyFilter>) => setFilter((f) => ({ ...f, ...p }))
  const options = useMemo(
    () => ({
      bodyTypes: distinct(rows, (r) => r.bodyType),
      zones: distinct(rows, (r) => r.orbitalZone),
      atmospheres: distinct(rows, (r) => r.atmosphereType),
      liquids: distinct(rows, (r) => r.liquidType),
      resourceZones: distinct(rows, (r) => r.resourceZones),
    }),
    [rows],
  )
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort])
  const { quickFilter, setQuickFilter } = useResourceFilter()
  const quick = quickFilter.planets
  const shown = useMemo(() => quickFilterBodies(filterBodyRows(sorted, filter), quick), [sorted, filter, quick])
  const columns = useMemo(() => makeColumns(quick.trim()), [quick])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar shown={shown.length} total={rows.length} onReset={() => {
          setFilter(DEFAULT_BODY_FILTER)
          setQuickFilter('planets', '')
        }}
      >
        <QuickFilter value={quick} onChange={(v) => setQuickFilter('planets', v)} placeholder="Filter by system or body name" />
        <MultiSelect label="Body type" options={options.bodyTypes} value={filter.bodyTypes} onChange={(bodyTypes) => patch({ bodyTypes })} />
        <MultiSelect label="Orbital zone" options={options.zones} value={filter.orbitalZones} onChange={(orbitalZones) => patch({ orbitalZones })} />
        <MultiSelect label="Atmosphere" options={options.atmospheres} value={filter.atmosphereTypes} onChange={(atmosphereTypes) => patch({ atmosphereTypes })} />
        <MultiSelect label="Liquid type" options={options.liquids} value={filter.liquidTypes} onChange={(liquidTypes) => patch({ liquidTypes })} />
        <MultiSelect label="Res. zones" options={options.resourceZones} value={filter.resourceZones} onChange={(resourceZones) => patch({ resourceZones })} />
        <RangeInputs label="Diameter" value={filter.diameter} onChange={(diameter) => patch({ diameter })} />
        <RangeInputs label="Gravity" value={filter.gravity} onChange={(gravity) => patch({ gravity })} />
        <RangeInputs label="Liquid %" value={filter.liquidPct} onChange={(liquidPct) => patch({ liquidPct })} />
        <Segmented label="Flora" options={TRI_OPTIONS} value={filter.flora} onChange={(flora) => patch({ flora })} />
        <Segmented label="Fauna" options={TRI_OPTIONS} value={filter.fauna} onChange={(fauna) => patch({ fauna })} />
        <Segmented label="Inhabited" options={INHABITED_OPTIONS} value={filter.inhabited} onChange={(inhabited) => patch({ inhabited })} />
      </FilterBar>
      <VirtualTable
        rows={shown}
        columns={columns}
        rowKey={(r) => r.id}
        sort={sort}
        onSort={setSort}
        onRowClick={(r) => onOpenSystem(r.systemId)}
      />
    </div>
  )
}
