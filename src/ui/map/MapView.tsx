/**
 * 3D starmap tab. Load it lazily so three.js lands in its own chunk:
 *
 *   const MapView = lazy(() => import('./map/MapView'))
 *   <Suspense fallback={...}><MapView map={map} highlight={highlight} ... /></Suspense>
 *
 * Nothing outside src/ui/map may import this file (or three) statically.
 */
import { Maximize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { StarMap } from '@/data/types'
import { Button } from '@/ui/ui/button'
import { Legend } from './Legend'
import { MapScene, type Layers } from './scene'

export interface MapViewProps {
  /** The loaded star map. A new object rebuilds the scene. */
  map: StarMap
  /**
   * systemId -> best matching quality from the shared resource filter.
   * `undefined` = no resource selected (star color + explored status styling).
   * An empty Map = a filter is active but nothing matches (everything dims).
   * Changing it updates the scene's buffers in place.
   */
  highlight?: ReadonlyMap<string, number>
  /** System drawn with a selection ring (and a persistent name label). */
  selectedSystemId?: string
  /** Called when the user clicks a system. */
  onSelectSystem: (systemId: string) => void
  /** Animates the camera to `systemId` whenever `nonce` changes (also once on mount). */
  flyToRequest?: { systemId: string; nonce: number }
}

const DEFAULT_LAYERS: Layers = { wormholes: true, sectors: true, status: true }

export default function MapView({ map, highlight, selectedSystemId, onSelectSystem, flyToRequest }: MapViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<MapScene | null>(null)
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS)
  const [error, setError] = useState<string | null>(null)

  // Latest props for (re)creating the scene without re-running on every change.
  const latest = useRef({ highlight, layers, selectedSystemId, onSelectSystem, flyToRequest })
  useEffect(() => {
    latest.current = { highlight, layers, selectedSystemId, onSelectSystem, flyToRequest }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let scene: MapScene
    try {
      const l = latest.current
      scene = new MapScene(host, {
        map,
        highlight: l.highlight,
        layers: l.layers,
        selectedSystemId: l.selectedSystemId,
        onSelect: (id) => latest.current.onSelectSystem(id),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    sceneRef.current = scene
    const fly = latest.current.flyToRequest
    if (fly) scene.flyTo(fly.systemId)
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [map])

  useEffect(() => sceneRef.current?.setHighlight(highlight), [highlight])
  useEffect(() => sceneRef.current?.setLayers(layers), [layers])
  useEffect(() => sceneRef.current?.setSelected(selectedSystemId), [selectedSystemId])
  const nonce = flyToRequest?.nonce
  useEffect(() => {
    const fly = latest.current.flyToRequest
    if (fly) sceneRef.current?.flyTo(fly.systemId)
  }, [nonce])

  if (error !== null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <div>
          <p className="text-foreground">The 3D map needs WebGL, which is not available in this browser.</p>
          <p className="mt-1 text-xs">The tables work without it.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-64 w-full overflow-hidden bg-[#0d0e11]">
      <div ref={hostRef} className="absolute inset-0" />
      <Legend
        layers={layers}
        onLayersChange={setLayers}
        highlightActive={highlight !== undefined}
        matchCount={highlight?.size}
      />
      <Button
        variant="outline"
        size="xs"
        className="absolute right-2 top-2"
        onClick={() => sceneRef.current?.resetView()}
      >
        <Maximize2 />
        Reset view
      </Button>
    </div>
  )
}
