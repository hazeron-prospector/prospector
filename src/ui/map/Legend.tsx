import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { qualityHsl } from '@/data/color'
import { HABITABLE_COLOR, NEUTRAL_COLOR, starColor, UNEXPLORED_DIM, WORMHOLE_EXPLORED, WORMHOLE_UNEXPLORED } from '@/data/mapdata'
import { Checkbox } from '@/ui/ui/checkbox'
import type { Layers } from './scene'

export interface LegendProps {
  layers: Layers
  onLayersChange: (layers: Layers) => void
  /** True when a resource filter is selected and the map shows the quality scale. */
  highlightActive: boolean
  /** Systems matching the highlight (shown next to the scale). */
  matchCount?: number
}

const css = (c: [number, number, number]): string =>
  `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`

const dim = (c: [number, number, number]): [number, number, number] => [c[0] * UNEXPLORED_DIM, c[1] * UNEXPLORED_DIM, c[2] * UNEXPLORED_DIM]

const QUALITY_GRADIENT = `linear-gradient(to right, ${[1, 64, 128, 192, 255]
  .map((q) => {
    const { hue, sat, light } = qualityHsl(q)
    return `hsl(${hue.toFixed(0)} ${sat}% ${light.toFixed(0)}%)`
  })
  .join(', ')})`

const STAR_KEY: [string, string, string][] = [
  ['O/B/A', 'Blue-white', 'B'],
  ['F/G', 'Yellow', 'G'],
  ['K', 'Orange', 'K'],
  ['M', 'Red', 'M'],
  ['L/T/Y', 'Brown dwarf', 'L'],
  ['Neutron', 'Neutron star', 'Neutron Star'],
  ['Black hole', 'Black hole', 'Black Hole'],
]

const LAYER_ROWS: [keyof Layers, string][] = [
  ['wormholes', 'Wormholes'],
  ['sectors', 'Sector grid'],
  ['status', 'Explored status'],
  ['starColor', 'Star color'],
]

export function Legend({ layers, onLayersChange, highlightActive, matchCount }: LegendProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className="absolute left-2 top-2 w-48 rounded-md border border-border bg-popover/90 text-xs text-popover-foreground shadow-md backdrop-blur-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Legend
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-2 py-1.5">
          <div className="space-y-1">
            {LAYER_ROWS.map(([key, text]) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={layers[key]}
                  onCheckedChange={(v) => onLayersChange({ ...layers, [key]: v === true })}
                />
                {text}
              </label>
            ))}
          </div>
          {layers.wormholes && (
            <div className="space-y-1 border-t border-border pt-1.5">
              <LineKey color={css(WORMHOLE_EXPLORED)} text="Wormhole, explored" />
              <LineKey color={css(WORMHOLE_UNEXPLORED)} text="Wormhole, unexplored" />
            </div>
          )}
          <div className="space-y-1 border-t border-border pt-1.5">
            {highlightActive ? (
              <>
                <div className="text-muted-foreground">
                  Best quality{matchCount !== undefined ? ` (${matchCount.toLocaleString()} systems)` : ''}
                </div>
                <div className="h-2 rounded-sm" style={{ background: QUALITY_GRADIENT }} />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span>255</span>
                </div>
                <Swatch color="rgb(69 74 84)" text="No match" />
              </>
            ) : (
              <>
                {layers.starColor ? (
                  <>
                    <div className="text-muted-foreground">Star color</div>
                    {STAR_KEY.map(([short, long, type]) => (
                      <Swatch key={short} color={css(starColor(type))} text={long} />
                    ))}
                  </>
                ) : (
                  <Swatch color={css(HABITABLE_COLOR)} text="Habitable world" />
                )}
                {layers.status && (
                  <>
                    <Swatch color={css(layers.starColor ? starColor('G') : NEUTRAL_COLOR)} text="Explored" />
                    <Swatch color={css(dim(layers.starColor ? starColor('G') : NEUTRAL_COLOR))} text="Unexplored (dim)" />
                    <Swatch color={css(layers.starColor ? starColor('G') : NEUTRAL_COLOR)} text="Surveyed (ring)" ring />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LineKey({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-2.5 shrink-0" style={{ backgroundColor: color }} />
      <span>{text}</span>
    </div>
  )
}

function Swatch({ color, text, ring }: { color: string; text: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={ring ? { border: `1.5px solid ${color}` } : { backgroundColor: color }}
      />
      <span>{text}</span>
    </div>
  )
}
