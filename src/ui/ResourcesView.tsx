import { useMemo } from 'react'
import { sortRows } from '@/data/filter'
import { rollupBySystem, type SystemRollupRow } from '@/data/rollup'
import type { ResourceRow } from '@/data/rows'
import type { Sphere } from '@/data/types'
import { CATEGORIES } from '@/data/catalog'
import { distinct } from './distinct'
import { Highlight } from './Highlight'
import { QuickFilter } from './QuickFilter'
import { quickFilterResources } from './quickFilter'
import { Button } from '@/ui/ui/button'
import { FilterBar } from './FilterBar'
import { FilterChips } from './FilterChips'
import { countSystems, resultCountText, suggestLoosen } from './filterChips'
import { MultiSelect } from './MultiSelect'
import { NumberInput } from './NumberInput'
import { ResourceIcon } from './ResourceIcon'
import { ResourcePicker } from './ResourcePicker'
import { QualityCell } from './QualityCell'
import { Segmented } from './Segmented'
import { InhabitedCell } from './InhabitedCell'
import { INHABITED_OPTIONS } from './segmentedOptions'
import { useNav } from './state/NavContext'
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

const makeColumns = (q: string): Column<ResourceRow>[] => [
  { id: 'resource', header: 'Resource', width: 150, sortKey: 'resource', cell: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <ResourceIcon name={r.resource} sphere={r.sphere} />
        {r.resource}
      </span>
    ),
  },
  {
    id: 'best',
    header: 'Best Q',
    width: 70,
    sortKey: 'bestQuality',
    firstDir: 'desc',
    cell: (r) => <QualityCell q={r.bestQuality} />,
  },
  { id: 'system', header: 'System', width: 150, sortKey: 'systemName', cell: (r) => <Highlight text={r.systemName} q={q} /> },
  { id: 'body', header: 'Body', width: 140, sortKey: 'bodyName', cell: (r) => <Highlight text={r.bodyName} q={q} /> },
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

const makeRollupColumns = (q: string): Column<SystemRollupRow>[] => [
  { id: 'system', header: 'System', width: 160, sortKey: 'systemName', cell: (r) => <Highlight text={r.systemName} q={q} /> },
  { id: 'sector', header: 'Sector', width: 110, sortKey: 'sectorName', cell: (r) => r.sectorName },
  { id: 'best', header: 'Best Q', width: 70, sortKey: 'bestQuality', firstDir: 'desc', cell: (r) => <QualityCell q={r.bestQuality} /> },
  {
    id: 'resource',
    header: 'Best resource',
    width: 160,
    sortKey: 'bestResource',
    cell: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <ResourceIcon name={r.bestResource} />
        {r.bestResource}
      </span>
    ),
  },
  { id: 'body', header: 'Best body', width: 140, sortKey: 'bestBodyName', cell: (r) => <Highlight text={r.bestBodyName} q={q} /> },
  { id: 'type', header: 'Body type', width: 90, sortKey: 'bestBodyType', cell: (r) => r.bestBodyType },
  { id: 'bodies', header: 'Bodies', width: 70, align: 'right', sortKey: 'bodyCount', firstDir: 'desc', cell: (r) => r.bodyCount },
  { id: 'deposits', header: 'Deposits', width: 80, align: 'right', sortKey: 'depositCount', firstDir: 'desc', cell: (r) => r.depositCount },
  {
    id: 'inhabited',
    header: 'Inhab.',
    width: 150,
    sortKey: 'inhabited',
    firstDir: 'desc',
    cell: (r) => <InhabitedCell inhabited={r.inhabited} empires={r.inhabitingEmpires} />,
  },
]

export function ResourcesView() {
  const nav = useNav()
  const { allRows: rows, filter, patch, setFilter, reset, filteredResourceRows, sort, setSort, rollup, setRollup, rollupSort, setRollupSort, quickFilter, setQuickFilter } =
    useResourceFilter()
  const quick = quickFilter.resources

  const options = useMemo(
    () => ({
      categories: CATEGORIES.filter((c) => rows.some((r) => r.categories.includes(c))),
      bodyTypes: distinct(rows, (r) => r.bodyType),
      zones: distinct(rows, (r) => r.orbitalZone),
    }),
    [rows],
  )
  const quickRows = useMemo(() => quickFilterResources(filteredResourceRows, quick), [filteredResourceRows, quick])
  // Rollup runs after every filter, including the quick filter.
  const rolled = useMemo(() => (rollup ? rollupBySystem(quickRows) : undefined), [rollup, quickRows])
  const shown = useMemo(() => (rolled ? undefined : sortRows(quickRows, sort.key, sort.dir)), [rolled, quickRows, sort])
  const rolledShown = useMemo(() => (rolled ? sortRows(rolled, rollupSort.key, rollupSort.dir) : undefined), [rolled, rollupSort])
  const columns = useMemo(() => makeColumns(quick.trim()), [quick])
  const rollupColumns = useMemo(() => makeRollupColumns(quick.trim()), [quick])
  const rowCount = rolled ? rolled.length : quickRows.length
  const systems = useMemo(() => (rolled ? rolled.length : countSystems(quickRows)), [rolled, quickRows])
  const chipState = useMemo(() => ({ filter, quick }), [filter, quick])
  const suggestion = useMemo(
    () => (rowCount === 0 ? suggestLoosen(rows, chipState) : undefined),
    [rowCount, rows, chipState],
  )

  const emptyNode = suggestion ? (
    <>
      No deposits match. Try removing <strong className="text-foreground">{suggestion.label}</strong> (
      {suggestion.count.toLocaleString()} deposits).
    </>
  ) : (
    'No deposits match. Use Reset all to clear the filters.'
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar shown={rowCount} total={rows.length} countText={resultCountText(quickRows.length, systems, rollup)}>
        <QuickFilter value={quick} onChange={(v) => setQuickFilter('resources', v)} placeholder="Filter by system or body name" />
        <Button
          variant={rollup ? 'secondary' : 'outline'}
          size="xs"
          aria-pressed={rollup}
          title="One row per system with its best deposit of the filtered resources"
          onClick={() => setRollup(!rollup)}
        >
          Best per system
        </Button>
        <ResourcePicker rows={rows} value={filter.resources} onChange={(resources) => patch({ resources })} />
        <MultiSelect label="Category" options={options.categories} value={filter.categories} onChange={(categories) => patch({ categories })} />
        <NumberInput label="Min Q" value={filter.minBestQuality} onChange={(minBestQuality) => patch({ minBestQuality })} />
        <MultiSelect label="Body type" options={options.bodyTypes} value={filter.bodyTypes} onChange={(bodyTypes) => patch({ bodyTypes })} />
        <MultiSelect label="Orbital zone" options={options.zones} value={filter.orbitalZones} onChange={(orbitalZones) => patch({ orbitalZones })} />
        <MultiSelect label="Sphere" options={SPHERES} value={filter.spheres} onChange={(spheres) => patch({ spheres })} />
        <Segmented label="Inhabited" options={INHABITED_OPTIONS} value={filter.inhabited} onChange={(inhabited) => patch({ inhabited })} />
      </FilterBar>
      <FilterChips
        state={chipState}
        onChange={(s) => {
          setFilter(s.filter)
          setQuickFilter('resources', s.quick)
        }}
        onReset={reset}
      />
      {rolledShown ? (
        <VirtualTable
          rows={rolledShown}
          columns={rollupColumns}
          rowKey={(r) => r.id}
          sort={rollupSort}
          onSort={setRollupSort}
          onRowClick={(r) => nav.peekSystem(r.systemId, r.id)}
          selectedKey={nav.selectedKey}
          empty={emptyNode}
        />
      ) : (
        <VirtualTable
          rows={shown ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          sort={sort}
          onSort={setSort}
          onRowClick={(r) => nav.peekBody(r.systemId, r.bodyId, r.id)}
          selectedKey={nav.selectedKey}
          empty={emptyNode}
        />
      )}
    </div>
  )
}
