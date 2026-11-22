/** Pure logic for filter chips, result count text and the empty-state hint (BLUEPRINT V13). */
import { DEFAULT_RESOURCE_FILTER, filterResourceRows, type ResourceFilter } from '@/data/filter'
import type { ResourceRow } from '@/data/rows'
import { quickFilterResources } from './quickFilter'

/** Filter + Resources quick text: everything the chips represent. */
export interface ChipState {
  filter: ResourceFilter
  quick: string
}

/** Filter fields that can be cleared as a unit ('quick' is the table text box). */
export type FilterKey = 'resources' | 'minBestQuality' | 'bodyTypes' | 'orbitalZones' | 'spheres' | 'categories' | 'inhabited' | 'ringworld' | 'quick'

export interface Chip {
  id: string
  key: FilterKey
  label: string
  /** Set for resource chips so the UI can show the icon. */
  resource?: string
  /** State with just this chip removed. */
  remove: (s: ChipState) => ChipState
}

const without = <T>(list: readonly T[], v: T) => list.filter((x) => x !== v)

export function activeChips(s: ChipState): Chip[] {
  const { filter: f } = s
  const out: Chip[] = []
  const list = (key: 'resources' | 'bodyTypes' | 'orbitalZones' | 'spheres' | 'categories', prefix: string) => {
    for (const v of f[key] as string[]) {
      out.push({
        id: `${key}:${v}`,
        key,
        label: prefix ? `${prefix}: ${v}` : v,
        resource: key === 'resources' ? v : undefined,
        remove: (st) => ({ ...st, filter: { ...st.filter, [key]: without(st.filter[key] as string[], v) } }),
      })
    }
  }
  list('resources', '')
  if (f.minBestQuality !== undefined)
    out.push({
      id: 'minBestQuality',
      key: 'minBestQuality',
      label: `Min Q ≥ ${f.minBestQuality}`,
      remove: (st) => ({ ...st, filter: { ...st.filter, minBestQuality: undefined } }),
    })
  list('categories', 'Bay')
  list('bodyTypes', 'Type')
  list('orbitalZones', 'Zone')
  list('spheres', 'Sphere')
  if (f.inhabited !== 'any')
    out.push({
      id: 'inhabited',
      key: 'inhabited',
      label: f.inhabited === 'only' ? 'Inhabited only' : 'Uninhabited only',
      remove: (st) => ({ ...st, filter: { ...st.filter, inhabited: 'any' } }),
    })
  if (f.ringworld === 'only')
    out.push({
      id: 'ringworld',
      key: 'ringworld',
      label: 'Ringworld only',
      remove: (st) => ({ ...st, filter: { ...st.filter, ringworld: 'any' } }),
    })
  if (s.quick.trim())
    out.push({ id: 'quick', key: 'quick', label: `Search: "${s.quick.trim()}"`, remove: (st) => ({ ...st, quick: '' }) })
  return out
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/** "1,204 deposits in 87 systems"; in rollup mode one row per system: "87 systems". */
export function resultCountText(deposits: number, systems: number, rollup = false): string {
  return rollup ? plural(systems, 'system', 'systems') : `${plural(deposits, 'deposit', 'deposits')} in ${plural(systems, 'system', 'systems')}`
}

export function countSystems(rows: readonly Pick<ResourceRow, 'systemId'>[]): number {
  const set = new Set<string>()
  for (const r of rows) set.add(r.systemId)
  return set.size
}

function fieldLabel(s: ChipState, key: FilterKey): string {
  const f = s.filter
  const many = (name: string, v: readonly string[]) => (v.length === 1 ? `${name} ${v[0]}` : `${name} (${v.length} selected)`)
  switch (key) {
    case 'resources':
      return f.resources.length === 1 ? f.resources[0]! : `Resource (${f.resources.length} selected)`
    case 'minBestQuality':
      return `Min Q ≥ ${f.minBestQuality}`
    case 'bodyTypes':
      return many('Body type', f.bodyTypes)
    case 'orbitalZones':
      return many('Orbital zone', f.orbitalZones)
    case 'spheres':
      return many('Sphere', f.spheres)
    case 'categories':
      return many('Category', f.categories)
    case 'inhabited':
      return f.inhabited === 'only' ? 'Inhabited only' : 'Uninhabited only'
    case 'ringworld':
      return 'Ringworld only'
    case 'quick':
      return `Search "${s.quick.trim()}"`
  }
}

function clearKey(s: ChipState, key: FilterKey): ChipState {
  if (key === 'quick') return { ...s, quick: '' }
  return { ...s, filter: { ...s.filter, [key]: DEFAULT_RESOURCE_FILTER[key] } }
}

export interface Suggestion {
  /** Human label of the one active filter whose removal frees the most rows. */
  label: string
  /** Rows that would match with only that filter removed. */
  count: number
}

/**
 * For an empty result: which single active filter (a whole field, e.g. all selected resources),
 * when removed, yields the most rows. Undefined when nothing is active or no single removal helps.
 */
export function suggestLoosen(allRows: readonly ResourceRow[], s: ChipState): Suggestion | undefined {
  const keys = [...new Set(activeChips(s).map((c) => c.key))]
  let best: Suggestion | undefined
  for (const key of keys) {
    const t = clearKey(s, key)
    const count = quickFilterResources(filterResourceRows(allRows, t.filter), t.quick).length
    if (count > 0 && (!best || count > best.count)) best = { label: fieldLabel(s, key), count }
  }
  return best
}
