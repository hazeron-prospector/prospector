import { useCallback, useMemo, useRef, useState } from 'react'
import type { StarMap } from '@/data/types'
import type { ResourceRow } from '@/data/rows'
import { toBodyRows, toResourceRows, toSystemRows } from '@/data/rows'
import { Button } from '@/ui/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/ui/ui/tabs'
import { PlanetsView } from './PlanetsView'
import { ResourcesView } from './ResourcesView'
import { SystemDetail } from './SystemDetail'
import { SystemsView } from './SystemsView'
import { ResourceFilterProvider } from './state/ResourceFilterContext'
import type { MapLoader } from './useMapLoader'

type Tab = 'resources' | 'planets' | 'systems'

/** Header, tabs and views. Remounted (key) when a new map is loaded so view state resets. */
export function AppShell({ map, loader }: { map: StarMap; loader: MapLoader }) {
  const resourceRows = useMemo(() => toResourceRows(map), [map])
  return (
    <ResourceFilterProvider rows={resourceRows}>
      <Shell map={map} loader={loader} resourceRows={resourceRows} />
    </ResourceFilterProvider>
  )
}

function Shell({ map, loader, resourceRows }: { map: StarMap; loader: MapLoader; resourceRows: ResourceRow[] }) {
  const [tab, setTab] = useState<Tab>('resources')
  const [visited, setVisited] = useState<Set<Tab>>(new Set(['resources']))
  // Detail history stack: last entry is the open system.
  const [stack, setStack] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

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
      <main className="relative flex min-h-0 flex-1 flex-col">
        {pane('resources', <ResourcesView rows={resourceRows} onOpenSystem={open} />)}
        {pane('planets', <PlanetsView rows={bodyRows} onOpenSystem={open} />)}
        {pane('systems', <SystemsView rows={systemRows} onOpenSystem={open} />)}
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
      </main>
      <footer className="border-t px-3 py-0.5 text-xs text-muted-foreground">
        <a href="NOTICE.txt" target="_blank" rel="noreferrer" className="underline">
          Resource icons © Hazeron Freehold LLC
        </a>
      </footer>
    </div>
  )
}
