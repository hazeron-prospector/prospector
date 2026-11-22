import { Component, lazy, Suspense, useCallback, useMemo, type ReactNode } from 'react'
import type { ResourceRow } from '@/data/rows'
import { bestDepositsBySystem, buildSystemSummaries, hoverResources } from '@/data/systemSummary'
import type { StarMap } from '@/data/types'
import type { HoverInfo, LabelFormat } from './map/MapView'

// The only reference to the map module outside src/ui/map, and it is dynamic: three.js stays in
// its own chunk that is fetched when the Map tab is first visited (BLUEPRINT V5, acceptance 7).
const MapView = lazy(() => import('./map/MapView'))

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <Message>The 3D map failed to load. The tables work without it; reload to retry.</Message>
    ) : (
      this.props.children
    )
  }
}

function Message({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{children}</div>
}

interface Props {
  map: StarMap
  highlight: ReadonlyMap<string, number> | undefined
  selectedSystemId: string | undefined
  onSelectSystem: (systemId: string) => void
  flyToRequest: { systemId: string; nonce: number } | undefined
  /** All resource rows (overall top resources per system). */
  allRows: readonly ResourceRow[]
  /** Rows matching the active resource filter; undefined when no filter drives the highlight. */
  matchRows: readonly ResourceRow[] | undefined
  /** Name seam for map labels and the hover card; see MapView `labelFormat`. */
  labelFormat?: LabelFormat
}

export function MapPane({ map, highlight, selectedSystemId, onSelectSystem, flyToRequest, allRows, matchRows, labelFormat }: Props) {
  const summaries = useMemo(() => buildSystemSummaries(map, allRows, 3), [map, allRows])
  const matches = useMemo(() => (matchRows ? bestDepositsBySystem(matchRows, 3) : undefined), [matchRows])
  const systemById = useMemo(() => new Map(map.systems.map((s) => [s.systemId, s])), [map])
  const getHoverInfo = useCallback(
    (id: string): HoverInfo | undefined => {
      const s = systemById.get(id)
      if (!s) return undefined
      const sum = summaries.get(id)
      return {
        name: s.name,
        eod: s.eod,
        resources: hoverResources(sum?.topResources ?? [], matches?.get(id)),
        habitableCount: sum?.habitableCount ?? 0,
        empires: [...new Set(s.cities.map((c) => c.empire).filter((e): e is string => !!e))],
      }
    },
    [systemById, summaries, matches],
  )
  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0">
        <MapBoundary>
          <Suspense fallback={<Message>Loading map...</Message>}>
            <MapView
              map={map}
              highlight={highlight}
              selectedSystemId={selectedSystemId}
              onSelectSystem={onSelectSystem}
              flyToRequest={flyToRequest}
              getHoverInfo={getHoverInfo}
              {...(labelFormat && { labelFormat })}
            />
          </Suspense>
        </MapBoundary>
      </div>
    </div>
  )
}
