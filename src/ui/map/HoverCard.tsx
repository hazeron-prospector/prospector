import { useLayoutEffect, useRef, useState } from 'react'
import type { MarkerSummary } from '@/data/markers'
import { habitableLabel, type HoverResource } from '@/data/systemSummary'
import type { Eod } from '@/data/types'
import { qualityStyle } from '@/ui/quality'
import { ResourceIcon } from '@/ui/ResourceIcon'
import type { LabelFormat } from './scene'

/** What the hover card shows for one system. Built outside src/ui/map (no three.js needed). */
export interface HoverInfo {
  name: string
  eod: Eod
  /** Up to 3, matching deposits of an active filter first (`match`). */
  resources: HoverResource[]
  habitableCount: number
  empires: string[]
  /** Capped city and spacecraft lists (W16); names are raw and rendered through the label seam. */
  markers: MarkerSummary
}

const OFFSET = 14

/**
 * Small card near the cursor, clamped inside the map container. The system name goes through
 * `labelFormat` (the single seam for hiding names; see MapView) and is never rendered raw here.
 */
export function HoverCard({
  info,
  x,
  y,
  labelFormat,
  hasFilter,
}: {
  info: HoverInfo
  x: number
  y: number
  labelFormat: LabelFormat
  hasFilter: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + OFFSET, top: y + OFFSET })
  useLayoutEffect(() => {
    const el = ref.current
    const host = el?.parentElement
    if (!el || !host) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    // Prefer below-right of the cursor; flip to the other side when it would overflow.
    let left = x + OFFSET
    let top = y + OFFSET
    if (left + w > host.clientWidth) left = x - OFFSET - w
    if (top + h > host.clientHeight) top = y - OFFSET - h
    setPos({
      left: Math.max(0, Math.min(left, host.clientWidth - w)),
      top: Math.max(0, Math.min(top, host.clientHeight - h)),
    })
  }, [x, y, info])
  const name = labelFormat(info.name, 'system')
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max max-w-64 rounded-sm border border-border bg-popover/95 px-2 py-1.5 text-xs text-popover-foreground shadow-md"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-medium ${name.className ?? ''}`}>{name.text}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{info.eod}</span>
      </div>
      {info.resources.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {info.resources.map((r) => (
            <li key={r.resource} className="flex items-center gap-1.5">
              <ResourceIcon name={r.resource} sphere={r.sphere} size={16} />
              <span className="min-w-0 flex-1 truncate">{r.resource}</span>
              {hasFilter && r.match && (
                <span className="text-[10px] text-primary" title="Matches the resource filter">
                  match
                </span>
              )}
              <span className="rounded-sm px-1 tabular-nums" style={qualityStyle(r.bestQuality)}>
                {r.bestQuality}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 text-muted-foreground">{habitableLabel(info.habitableCount)}</div>
      <MarkerLists markers={info.markers} labelFormat={labelFormat} />
      {info.empires.length > 0 && <div className="text-muted-foreground">Inhabited by {info.empires.join(', ')}</div>}
    </div>
  )
}

function Name({ text, kind, labelFormat }: { text: string; kind: 'city' | 'spacecraft'; labelFormat: LabelFormat }) {
  const f = labelFormat(text, kind)
  return <span className={f.className}>{f.text}</span>
}

function MarkerLists({ markers, labelFormat }: { markers: MarkerSummary; labelFormat: LabelFormat }) {
  const { cities, spacecraft } = markers
  if (cities.total === 0 && spacecraft.total === 0) return null
  return (
    <div className="mt-1 space-y-1 border-t border-border pt-1">
      {cities.total > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {cities.total} {cities.total === 1 ? 'city' : 'cities'}
          </div>
          <ul>
            {cities.items.map((c, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="min-w-0 truncate">
                  <Name text={c.name} kind="city" labelFormat={labelFormat} />
                </span>
                {c.empire && <span className="shrink-0 text-muted-foreground">{c.empire}</span>}
              </li>
            ))}
            {cities.more > 0 && <li className="text-muted-foreground">+{cities.more} more</li>}
          </ul>
        </div>
      )}
      {spacecraft.total > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {spacecraft.total} spacecraft
          </div>
          <ul>
            {spacecraft.items.map((c, i) => (
              <li key={i}>
                <span className="truncate">
                  <Name text={c.name} kind="spacecraft" labelFormat={labelFormat} />
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  {c.structure}, {c.status}
                  {c.empire ? `, ${c.empire}` : ''}
                </span>
              </li>
            ))}
            {spacecraft.more > 0 && <li className="text-muted-foreground">+{spacecraft.more} more</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
