import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { StarMap } from '@/data/types'

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
}

export function MapPane({ map, highlight, selectedSystemId, onSelectSystem, flyToRequest }: Props) {
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
            />
          </Suspense>
        </MapBoundary>
      </div>
    </div>
  )
}
