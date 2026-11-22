import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/ui/ui/button'

/** Filter row with a Reset button and a row-count readout. */
export function FilterBar({
  children,
  shown,
  total,
  onReset,
  countText,
}: {
  children: ReactNode
  shown: number
  total: number
  /** Omit when the caller shows its own reset (e.g. filter chips). */
  onReset?: () => void
  /** Replaces the default "shown / total rows" readout. */
  countText?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-card/50 px-3 py-1.5">
      {children}
      {onReset && (
        <Button variant="ghost" size="xs" onClick={onReset}>
          <RotateCcw /> Reset
        </Button>
      )}
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {countText ?? `${shown.toLocaleString()} / ${total.toLocaleString()} rows`}
      </span>
    </div>
  )
}
