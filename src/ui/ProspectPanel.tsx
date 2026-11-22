import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/ui/button'
import { ResourceIcon } from './ResourceIcon'
import { useResourceFilter } from './state/ResourceFilterContext'
import { useSettings } from './state/SettingsContext'

/**
 * Map "Prospect" overlay (W4): min-quality slider and one-click priority resource chips. Both
 * edit the shared resource filter, so the Resources table and the map highlight always agree.
 */
export function ProspectPanel() {
  const { allRows, filter, patch } = useResourceFilter()
  const { settings } = useSettings()
  const present = useMemo(() => new Set(allRows.map((r) => r.resource)), [allRows])
  const chips = settings.priorityResources.filter((n) => present.has(n))
  const min = filter.minBestQuality ?? 0
  const active = filter.resources.length > 0 || min > 0
  const toggle = (n: string) =>
    patch({ resources: filter.resources.includes(n) ? filter.resources.filter((r) => r !== n) : [...filter.resources, n] })
  return (
    <div className="absolute bottom-2 left-2 w-56 space-y-2 rounded-md border border-border bg-popover/90 p-2 text-xs text-popover-foreground shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Prospect</span>
        <Button variant="ghost" size="xs" disabled={!active} onClick={() => patch({ resources: [], minBestQuality: undefined })}>
          Clear
        </Button>
      </div>
      <label className="block space-y-1">
        <span className="flex items-center justify-between">
          Min quality <span className="tabular-nums text-primary">{min}</span>
        </span>
        <input
          type="range"
          min={0}
          max={255}
          step={1}
          value={min}
          aria-label="Minimum best quality"
          className="w-full accent-primary"
          onChange={(e) => {
            const v = Number(e.target.value)
            patch({ minBestQuality: v > 0 ? v : undefined })
          }}
        />
      </label>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((n) => {
            const on = filter.resources.includes(n)
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(n)}
                className={cn(
                  'flex items-center gap-1 rounded border px-1 py-0.5 hover:bg-accent',
                  on ? 'border-primary bg-primary/20 text-primary' : 'border-border',
                )}
              >
                <ResourceIcon name={n} />
                {n}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
