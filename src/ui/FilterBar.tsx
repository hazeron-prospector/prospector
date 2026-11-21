import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/ui/ui/button'

/** Filter row with a Reset button and a row-count readout. */
export function FilterBar({
  children,
  shown,
  total,
  onReset,
}: {
  children: ReactNode
  shown: number
  total: number
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-card/50 px-3 py-1.5">
      {children}
      <Button variant="ghost" size="xs" onClick={onReset}>
        <RotateCcw /> Reset
      </Button>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {shown.toLocaleString()} / {total.toLocaleString()} rows
      </span>
    </div>
  )
}
