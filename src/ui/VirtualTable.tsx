import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Sort } from '@/data/filter'
import { cn } from '@/lib/utils'
import { isTypingTarget, scrollTopFor, stepIndex } from './nav'

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
  /** Click, Enter, and Up/Down stepping all call this (select + open). */
  onRowClick?: (row: T) => void
  /** rowKey of the highlighted row. */
  selectedKey?: string
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
  selectedKey,
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
    // Only the row itself: Enter on a button inside a cell belongs to that button.
    if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick?.(row)
  }

  const headerH = rowHeight + 2
  const selectedIndex = useMemo(
    () => (selectedKey === undefined ? -1 : rows.findIndex((r) => rowKey(r) === selectedKey)),
    [rows, rowKey, selectedKey],
  )

  // Up/Down steps the selection while focus is in this table, or in the peek panel / on the page
  // body while this table holds a selection. Never inside text controls; never in hidden tabs.
  // Row index to move DOM focus to once its element is rendered (set when stepping from inside
  // the table, so Enter acts on the newly selected row). Expires so it cannot steal focus later.
  const pendingFocus = useRef<{ index: number; until: number } | null>(null)
  const latest = useRef({ rows, selectedIndex, onRowClick })
  useEffect(() => {
    latest.current = { rows, selectedIndex, onRowClick }
  })
  useEffect(() => {
    const p = pendingFocus.current
    if (!p) return
    if (performance.now() > p.until) {
      pendingFocus.current = null
      return
    }
    // The element may not exist until the virtualizer re-renders after the scroll; this effect
    // runs on every render, so it retries until the row appears.
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-index="${p.index}"]`)
    if (el) {
      pendingFocus.current = null
      el.focus({ preventScroll: true })
    }
  })
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const root = scrollRef.current
      if (!root || root.closest('[inert]')) return
      const t = e.target
      if (isTypingTarget(t)) return
      const { rows: rs, selectedIndex: cur, onRowClick: click } = latest.current
      const el = t instanceof Element ? t : null
      const inTable = !!el && root.contains(el)
      const outside = el === document.body || !!el?.closest('[data-peek-panel]')
      if (!click || !(inTable || (outside && cur >= 0))) return
      const next = stepIndex(rs.length, cur, e.key === 'ArrowDown' ? 1 : -1)
      if (next < 0) return
      e.preventDefault()
      root.scrollTop = scrollTopFor(next, root.scrollTop, root.clientHeight, rowHeight, headerH)
      if (inTable) pendingFocus.current = { index: next, until: performance.now() + 500 }
      click(rs[next]!)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [rowHeight, headerH])

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" role="table">
      <div style={{ width: totalWidth, minWidth: '100%' }}>
        <div
          role="row"
          className="sticky top-0 z-10 grid border-b bg-card text-xs text-muted-foreground"
          style={{ gridTemplateColumns: template, height: headerH }}
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
                data-index={v.index}
                aria-selected={selectedKey !== undefined && v.index === selectedIndex ? true : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => keyDown(e, row) : undefined}
                className={cn(
                  'absolute left-0 grid w-full items-center border-b border-border/40 text-sm',
                  onRowClick && 'cursor-pointer hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none',
                  v.index === selectedIndex && 'bg-primary/15 shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/20',
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
