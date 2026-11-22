/** Pure navigation helpers: peek targets, row stepping, key handling, top resources. */
import type { ResourceRow } from '@/data/rows'
import type { Sphere } from '@/data/types'

/** What the quick-peek panel shows: a whole system, or one body (planet or star) inside it. */
export type PeekTarget =
  | { kind: 'system'; systemId: string }
  | { kind: 'body'; systemId: string; bodyId: string }

export interface Peek {
  target: PeekTarget
  /** Row key to highlight in the table the peek came from (rows of other tables simply never match). */
  rowKey?: string
}

/**
 * Next selected index when stepping through `count` rows. `current` < 0 means nothing selected
 * (either direction then lands on the first row). Clamps at both ends; -1 when there are no rows.
 */
export function stepIndex(count: number, current: number, dir: 1 | -1): number {
  if (count <= 0) return -1
  if (current < 0 || current >= count) return 0
  return Math.min(count - 1, Math.max(0, current + dir))
}

/**
 * scrollTop that brings row `index` fully into view below a sticky header, or `scrollTop`
 * unchanged when it already is. Row i occupies [header + i*rowH, header + (i+1)*rowH) in content
 * coordinates; the header covers the top `header` px of the viewport.
 */
export function scrollTopFor(
  index: number,
  scrollTop: number,
  viewportH: number,
  rowH: number,
  header: number,
): number {
  const top = header + index * rowH
  const bottom = top + rowH
  if (top < scrollTop + header) return Math.max(0, top - header)
  if (bottom > scrollTop + viewportH) return bottom - viewportH
  return scrollTop
}

interface ElementLike {
  tagName?: string
  isContentEditable?: boolean
}

/** True when keystrokes belong to a text control (arrows, `/` and Escape must not be hijacked). */
export function isTypingTarget(t: unknown): boolean {
  const el = t as ElementLike | null | undefined
  if (!el || typeof el !== 'object') return false
  const tag = (el.tagName ?? '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}

export interface KeyLike {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  target?: unknown
}

/** Ctrl/Cmd+K anywhere, or a bare `/` when not typing in a text control. */
export function isPaletteShortcut(e: KeyLike): boolean {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') return true
  return e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)
}

/** Enter with Ctrl, Cmd or Shift held runs the secondary ("show on map") action. */
export function isSecondaryEnter(e: KeyLike): boolean {
  return e.key === 'Enter' && !!(e.ctrlKey || e.metaKey || e.shiftKey)
}

export interface TopResource {
  name: string
  bestQuality: number
  /** Sphere and body of the best deposit. */
  sphere: Sphere
  bodyName: string
  /** Deposits of this resource among the given rows. */
  count: number
}

/** One entry per resource name with its best deposit, best quality first (name breaks ties). */
export function topResources(rows: readonly ResourceRow[], limit = 8): TopResource[] {
  const best = new Map<string, TopResource>()
  for (const r of rows) {
    const t = best.get(r.resource)
    if (!t) best.set(r.resource, { name: r.resource, bestQuality: r.bestQuality, sphere: r.sphere, bodyName: r.bodyName, count: 1 })
    else {
      t.count++
      if (r.bestQuality > t.bestQuality) {
        t.bestQuality = r.bestQuality
        t.sphere = r.sphere
        t.bodyName = r.bodyName
      }
    }
  }
  return [...best.values()]
    .sort((a, b) => b.bestQuality - a.bestQuality || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, limit)
}

/**
 * systemId -> best matching quality, for the map highlight; undefined when neither a resource nor
 * a category is selected (both select resources) and no minimum quality is set (the Prospect
 * slider alone highlights systems with any deposit at or above it).
 */
export function buildHighlight(
  rows: readonly ResourceRow[],
  selectedResources: readonly string[],
  selectedCategories: readonly string[] = [],
  minBestQuality?: number,
): Map<string, number> | undefined {
  if (selectedResources.length === 0 && selectedCategories.length === 0 && !(minBestQuality !== undefined && minBestQuality > 0)) return undefined
  const out = new Map<string, number>()
  for (const r of rows) {
    const cur = out.get(r.systemId)
    if (cur === undefined || r.bestQuality > cur) out.set(r.systemId, r.bestQuality)
  }
  return out
}
