import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { ResourceRow } from '@/data/rows'
import type { StarMap } from '@/data/types'
import { toBodyRows, toResourceRows, toSystemRows } from '@/data/rows'
import { Button } from '@/ui/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/ui/ui/tabs'
import { PlanetsView } from './PlanetsView'
import { ResourcesView } from './ResourcesView'
import { SystemDetail } from './SystemDetail'
import { SystemsView } from './SystemsView'
import { MapPane } from './MapPane'
import { PeekPanel } from './PeekPanel'
import { CommandPalette } from './CommandPalette'
import { buildHighlight, isPaletteShortcut, type Peek } from './nav'
import { buildSearchIndex } from '@/data/search'
import { NavProvider, type Nav } from './state/NavContext'
import { ResourceFilterProvider, useResourceFilter } from './state/ResourceFilterContext'
import type { MapLoader } from './useMapLoader'

type Tab = 'resources' | 'planets' | 'systems' | 'map'

/** Header, tabs and views. Remounted (key) when a new map is loaded so view state resets. */
export function AppShell({ map, loader }: { map: StarMap; loader: MapLoader }) {
  const resourceRows = useMemo(() => toResourceRows(map), [map])
  return (
    <ResourceFilterProvider rows={resourceRows}>
      <Shell map={map} loader={loader} />
    </ResourceFilterProvider>
  )
}

function Shell({ map, loader }: { map: StarMap; loader: MapLoader }) {
  const [tab, setTab] = useState<Tab>('resources')
  const [visited, setVisited] = useState<Set<Tab>>(new Set(['resources']))
  // Detail history stack: last entry is the open system.
  const [stack, setStack] = useState<string[]>([])
  const [peek, setPeek] = useState<Peek | undefined>()
  const fileInput = useRef<HTMLInputElement>(null)
  const { allRows, patch, setQuickFilter, filter, filteredResourceRows } = useResourceFilter()
  const [fly, setFly] = useState<{ systemId: string; nonce: number }>()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const searchIndex = useMemo(() => buildSearchIndex(map), [map])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return
      e.preventDefault()
      setPaletteOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bodyRows = useMemo(() => toBodyRows(map), [map])
  const systemRows = useMemo(() => toSystemRows(map), [map])
  const systemById = useMemo(() => new Map(map.systems.map((s) => [s.systemId, s])), [map])

  const open = useCallback((id: string) => setStack((s) => (s[s.length - 1] === id ? s : [...s, id])), [])
  const back = () => setStack((s) => s.slice(0, -1))
  const close = () => setStack([])
  const selectTab = (t: string) => {
    setTab(t as Tab)
    setVisited((v) => new Set(v).add(t as Tab))
    setStack([])
  }
  const rowsBySystem = useMemo(() => {
    const m = new Map<string, ResourceRow[]>()
    for (const r of allRows) {
      const list = m.get(r.systemId)
      if (list) list.push(r)
      else m.set(r.systemId, [r])
    }
    return m
  }, [allRows])
  const sectorNames = useMemo(() => new Map(map.sectors.map((s) => [s.sectorId, s.name])), [map])

  // Systems holding the selected resources, with their best quality; undefined = nothing selected.
  const mapVisited = visited.has('map')
  const highlight = useMemo(
    () => (mapVisited ? buildHighlight(filteredResourceRows, filter.resources) : undefined),
    [mapVisited, filteredResourceRows, filter.resources],
  )

  const nav = useMemo<Nav>(
    () => ({
      peek,
      selectedKey: peek?.rowKey,
      peekSystem: (systemId, rowKey) => {
        setStack([])
        setPeek({ target: { kind: 'system', systemId }, ...(rowKey !== undefined && { rowKey }) })
      },
      peekBody: (systemId, bodyId, rowKey) => {
        setStack([])
        setPeek({ target: { kind: 'body', systemId, bodyId }, ...(rowKey !== undefined && { rowKey }) })
      },
      closePeek: () => setPeek(undefined),
      openFullPage: (systemId) => {
        setPeek(undefined)
        open(systemId)
      },
      showOnMap: (systemId) => {
        if (systemById.get(systemId)?.x === undefined) return
        setTab('map')
        setVisited((v) => new Set(v).add('map'))
        setStack([])
        setPeek((p) =>
          p?.target.systemId === systemId ? p : { target: { kind: 'system', systemId }, rowKey: systemId },
        )
        setFly((f) => ({ systemId, nonce: (f?.nonce ?? 0) + 1 }))
      },
      canShowOnMap: (systemId) => systemById.get(systemId)?.x !== undefined,
    }),
    [peek, open, systemById],
  )
  const current = stack.length ? systemById.get(stack[stack.length - 1]!) : undefined

  const pane = (t: Tab, node: React.ReactNode) =>
    visited.has(t) && (
      // Inactive panes stay laid out (just invisible) so inner scroll positions survive tab switches.
      <div
        className={
          t === tab
            ? 'flex min-h-0 flex-1 flex-col'
            : 'pointer-events-none invisible absolute inset-0 flex flex-col'
        }
        aria-hidden={t === tab ? undefined : true}
        inert={t !== tab}
      >
        {node}
      </div>
    )

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-card px-3 py-1.5">
        <span className="font-semibold text-primary">Prospector</span>
        <span className="text-sm">{map.empire}</span>
        <span className="text-xs text-muted-foreground">exported {map.createDate}</span>
        <Tabs value={tab} onValueChange={selectTab} className="ml-4">
          <TabsList variant="line" className="!h-7">
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="planets">Planets</TabsTrigger>
            <TabsTrigger value="systems">Systems</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          {loader.parsing && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Parsing {Math.round(loader.progress * 100)}%
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) loader.loadFile(f)
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="xs" onClick={() => setPaletteOpen(true)} title="Search (Ctrl+K or /)">
            <Search /> Search <kbd className="text-muted-foreground">Ctrl K</kbd>
          </Button>
          <Button variant="outline" size="xs" disabled={loader.parsing} onClick={() => fileInput.current?.click()}>
            Load another file
          </Button>
        </div>
      </header>
      {loader.error && (
        <div role="alert" className="flex items-center gap-2 border-b bg-destructive/15 px-3 py-1 text-sm text-destructive">
          {loader.error}
          <Button variant="ghost" size="xs" className="ml-auto" onClick={loader.clearError}>
            Dismiss
          </Button>
        </div>
      )}
      <NavProvider value={nav}>
      <main className="flex min-h-0 flex-1">
       <div className="relative flex min-w-0 flex-1 flex-col">
        {pane('resources', <ResourcesView />)}
        {pane('planets', <PlanetsView rows={bodyRows} />)}
        {pane('systems', <SystemsView rows={systemRows} />)}
        {pane(
          'map',
          <MapPane
            map={map}
            highlight={highlight}
            selectedSystemId={peek?.target.systemId}
            onSelectSystem={(id) => nav.peekSystem(id, id)}
            flyToRequest={fly}
          />,
        )}
        {current && (
          <SystemDetail
            key={current.systemId}
            map={map}
            system={current}
            systemById={systemById}
            canGoBack={stack.length > 1}
            onBack={back}
            onClose={close}
            onOpenSystem={open}
          />
        )}
       </div>
        {peek && (
          <PeekPanel
            target={peek.target}
            systemById={systemById}
            sectorNameOf={(id) => sectorNames.get(id) ?? id}
            rowsBySystem={rowsBySystem}
          />
        )}
      </main>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        index={searchIndex}
        onResource={(name) => {
          patch({ resources: [name] })
          selectTab('resources')
        }}
        onSector={(name) => {
          setQuickFilter('systems', name)
          selectTab('systems')
        }}
      />
      </NavProvider>
      <footer className="border-t px-3 py-0.5 text-xs text-muted-foreground">
        <a href="NOTICE.txt" target="_blank" rel="noreferrer" className="underline">
          Resource icons © Hazeron Freehold LLC
        </a>
      </footer>
    </div>
  )
}
