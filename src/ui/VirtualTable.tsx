import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Sort } from '@/data/filter'
import { cn } from '@/lib/utils'

export interface Column<T> {
  id: string
  header: string
  /** Fixed width in px. */
  width: number
  align?: 'right'
  /** Row field this column sorts by; omit for unsortable columns. */
  sortKey?: keyof T
  /** Direction applied on first click (default asc). */
  firstDir?: 'asc' | 'desc'
  cell: (row: T) => ReactNode
}

interface Props<T> {
  rows: readonly T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  sort: Sort<T>
  onSort: (s: Sort<T>) => void
  onRowClick?: (row: T) => void
  rowHeight?: number
  /** Shown instead of the default message when there are no rows. */
  empty?: ReactNode
}

/** Generic virtualized, sticky-header, click-to-sort table (fixed-height rows). */
export function VirtualTable<T>({
  rows,
  columns,
  rowKey,
  sort,
  onSort,
  onRowClick,
  rowHeight = 24,
  empty,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  })
  const totalWidth = columns.reduce((n, c) => n + c.width, 0)
  const template = columns.map((c) => `${c.width}px`).join(' ')

  const clickHeader = (c: Column<T>) => {
    if (!c.sortKey) return
    if (sort.key === c.sortKey) onSort({ key: c.sortKey, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    else onSort({ key: c.sortKey, dir: c.firstDir ?? 'asc' })
  }
  const keyDown = (e: KeyboardEvent, row: T) => {
    if (e.key === 'Enter') onRowClick?.(row)
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" role="table">
      <div style={{ width: totalWidth, minWidth: '100%' }}>
        <div
          role="row"
          className="sticky top-0 z-10 grid border-b bg-card text-xs text-muted-foreground"
          style={{ gridTemplateColumns: template, height: rowHeight + 2 }}
        >
          {columns.map((c) => {
            const active = c.sortKey !== undefined && sort.key === c.sortKey
            return (
              <button
                key={c.id}
                role="columnheader"
                type="button"
                disabled={!c.sortKey}
                onClick={() => clickHeader(c)}
                className={cn(
                  'flex items-center gap-1 px-2 text-left font-medium uppercase tracking-wide select-none',
                  c.sortKey && 'hover:text-foreground',
                  active && 'text-primary',
                  c.align === 'right' && 'justify-end text-right',
                )}
              >
                <span className="truncate">{c.header}</span>
                {active &&
                  (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
              </button>
            )
          })}
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index]!
            return (
              <div
                key={rowKey(row)}
                role="row"
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => keyDown(e, row) : undefined}
                className={cn(
                  'absolute left-0 grid w-full items-center border-b border-border/40 text-sm',
                  onRowClick && 'cursor-pointer hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none',
                )}
                style={{
                  gridTemplateColumns: template,
                  height: rowHeight,
                  transform: `translateY(${v.start}px)`,
                }}
              >
                {columns.map((c) => (
                  <div
                    key={c.id}
                    role="cell"
                    className={cn('truncate px-2 tabular-nums', c.align === 'right' && 'text-right')}
                  >
                    {c.cell(row)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        {rows.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">{empty ?? 'No rows match the current filters.'}</div>
        )}
      </div>
    </div>
  )
}
