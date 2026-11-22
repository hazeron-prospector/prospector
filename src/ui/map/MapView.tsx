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
import { HoverCard, type HoverInfo } from './HoverCard'
import { MapScene, type LabelFormat, type Layers } from './scene'

export type { HoverInfo, LabelFormat }

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
  /** Hover card content for a system; undefined hides the card. Memoize it (identity = data). */
  getHoverInfo?: (systemId: string) => HoverInfo | undefined
  /**
   * THE name seam (used by the censor feature): every system, sector, city and spacecraft name drawn by the map
   * (hover card, selection label, sector labels) goes through this. Return the text to show and
   * an optional class (e.g. a blur) to put on the element. Default: the real name, no class.
   * Memoize it (useCallback/useMemo): a new function re-applies all labels.
   */
  labelFormat?: LabelFormat
}

const PLAIN: LabelFormat = (name) => ({ text: name })

const DEFAULT_LAYERS: Layers = { wormholes: true, sectors: true, status: true, starColor: false, cities: true, spacecraft: true }

export default function MapView({ map, highlight, selectedSystemId, onSelectSystem, flyToRequest, getHoverInfo, labelFormat = PLAIN }: MapViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<MapScene | null>(null)
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<{ id: string; x: number; y: number }>()

  // Latest props for (re)creating the scene without re-running on every change.
  const latest = useRef({ highlight, layers, selectedSystemId, onSelectSystem, flyToRequest, labelFormat })
  useEffect(() => {
    latest.current = { highlight, layers, selectedSystemId, onSelectSystem, flyToRequest, labelFormat }
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
        onHover: (id, x, y) => setHover(id === undefined ? undefined : { id, x: Math.round(x), y: Math.round(y) }),
        labelFormat: l.labelFormat,
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
  useEffect(() => sceneRef.current?.setLabelFormat(labelFormat), [labelFormat])
  const centeredFor = useRef(selectedSystemId)
  useEffect(() => {
    sceneRef.current?.setSelected(selectedSystemId)
    // Re-center on a newly selected system (click, peek, palette). Declared before the flyTo
    // effect and guarded in the scene, so a "Show on map" fly-in for the same system wins.
    if (selectedSystemId !== undefined && selectedSystemId !== centeredFor.current) {
      sceneRef.current?.centerOn(selectedSystemId)
    }
    centeredFor.current = selectedSystemId
  }, [selectedSystemId])
  const nonce = flyToRequest?.nonce
  useEffect(() => {
    const fly = latest.current.flyToRequest
    if (fly) sceneRef.current?.flyTo(fly.systemId)
  }, [nonce])

  const hoverInfo = hover ? getHoverInfo?.(hover.id) : undefined

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
      {hoverInfo && hover && (
        <HoverCard info={hoverInfo} x={hover.x} y={hover.y} labelFormat={labelFormat} hasFilter={highlight !== undefined} />
      )}
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
