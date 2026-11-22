import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { qualityHsl } from '@/data/color'
import { starColor } from '@/data/mapdata'
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
                <div className="text-muted-foreground">Star color</div>
                {STAR_KEY.map(([short, long, type]) => (
                  <Swatch key={short} color={css(starColor(type))} text={long} />
                ))}
                {layers.status && (
                  <>
                    <Swatch color={css(starColor('G'))} text="Explored" />
                    <Swatch color={css(starColor('G').map((c) => c * 0.35) as [number, number, number])} text="Unexplored (dim)" />
                    <Swatch color={css(starColor('G'))} text="Surveyed (ring)" ring />
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
