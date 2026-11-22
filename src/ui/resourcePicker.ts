/** Pure helpers behind the grouped resource picker (BLUEPRINT V12). */
import { CATEGORIES } from '@/data/catalog'
import type { ResourceRow } from '@/data/rows'

export interface ResourceStat {
  name: string
  /** Deposit rows across the whole loaded map. */
  count: number
  /** Best quality across all of those deposits. */
  best: number
  /** Union of the categories of its rows. */
  categories: string[]
}

export interface ResourceGroup {
  category: string
  resources: ResourceStat[]
}

export function resourceStats(rows: readonly Pick<ResourceRow, 'resource' | 'bestQuality' | 'categories'>[]): ResourceStat[] {
  const m = new Map<string, ResourceStat>()
  for (const r of rows) {
    let s = m.get(r.resource)
    if (!s) m.set(r.resource, (s = { name: r.resource, count: 0, best: 0, categories: [] }))
    s.count++
    if (r.bestQuality > s.best) s.best = r.bestQuality
    for (const c of r.categories) if (!s.categories.includes(c)) s.categories.push(c)
  }
  return [...m.values()]
}

/**
 * Groups in CATEGORIES order (empty groups omitted); resources sorted by name. A multi-bay
 * resource appears in each of its groups. Unlisted categories go last.
 */
export function groupByCategory(stats: readonly ResourceStat[]): ResourceGroup[] {
  const by = new Map<string, ResourceStat[]>()
  for (const s of stats) for (const c of s.categories) (by.get(c) ?? by.set(c, []).get(c)!).push(s)
  const order = [...CATEGORIES, ...[...by.keys()].filter((c) => !CATEGORIES.includes(c)).sort()]
  return order
    .filter((c) => by.has(c))
    .map((category) => ({
      category,
      resources: by.get(category)!.sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

/** All of `names` selected -> remove them; otherwise add the missing ones. */
export function toggleGroup(selected: readonly string[], names: readonly string[]): string[] {
  const all = names.every((n) => selected.includes(n))
  if (all) return selected.filter((s) => !names.includes(s))
  return [...selected, ...names.filter((n) => !selected.includes(n))]
}

export const PRIORITY_GROUP = 'Priority'

/** Priority resources present in the map, in priority-list order; undefined when none are present. */
export function priorityGroup(stats: readonly ResourceStat[], priority: readonly string[]): ResourceGroup | undefined {
  const by = new Map(stats.map((s) => [s.name, s]))
  const resources = priority.flatMap((n) => by.get(n) ?? [])
  return resources.length ? { category: PRIORITY_GROUP, resources } : undefined
}
