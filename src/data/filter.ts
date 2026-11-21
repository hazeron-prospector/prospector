/** Pure filter predicates and sorting for the table views (BLUEPRINT 5.2, 5.3, 5.5). */
import type { BodyRow, ResourceRow, SystemRow } from './rows'
import type { Eod, Sphere } from './types'

export type InhabitedMode = 'any' | 'hide' | 'only'
export type TriState = 'any' | 'yes' | 'no'
export interface Range {
  min?: number
  max?: number
}
export type SortDir = 'asc' | 'desc'
export interface Sort<T> {
  key: keyof T
  dir: SortDir
}

/** Empty arrays mean "no restriction". */
export interface ResourceFilter {
  resources: string[]
  minBestQuality?: number
  /** Includes the pseudo type 'Star'. */
  bodyTypes: string[]
  /** Stars have no orbital zone, so an active zone filter excludes them. */
  orbitalZones: string[]
  spheres: Sphere[]
  inhabited: InhabitedMode
}

export interface BodyFilter {
  bodyTypes: string[]
  orbitalZones: string[]
  diameter: Range
  gravity: Range
  atmosphereTypes: string[]
  liquidPct: Range
  flora: TriState
  fauna: TriState
  resourceZones: number[]
  inhabited: InhabitedMode
}

export interface SystemFilter {
  /** Empty means all statuses. */
  eod: Eod[]
}

export const DEFAULT_RESOURCE_FILTER: ResourceFilter = {
  resources: [],
  minBestQuality: undefined,
  bodyTypes: [],
  orbitalZones: [],
  spheres: [],
  inhabited: 'any',
}

export const DEFAULT_BODY_FILTER: BodyFilter = {
  bodyTypes: [],
  orbitalZones: [],
  diameter: {},
  gravity: {},
  atmosphereTypes: [],
  liquidPct: {},
  flora: 'any',
  fauna: 'any',
  resourceZones: [],
  inhabited: 'any',
}

export const DEFAULT_SYSTEM_FILTER: SystemFilter = { eod: [] }

export const DEFAULT_RESOURCE_SORT: Sort<ResourceRow> = { key: 'bestQuality', dir: 'desc' }

function inList<T>(list: readonly T[], v: T | undefined): boolean {
  return list.length === 0 || (v !== undefined && list.includes(v))
}

function inRange(r: Range, v: number | undefined): boolean {
  if (r.min === undefined && r.max === undefined) return true
  if (v === undefined) return false
  return (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max)
}

function inhabitedOk(mode: InhabitedMode, inhabited: boolean): boolean {
  return mode === 'any' || (mode === 'only' ? inhabited : !inhabited)
}

function triOk(t: TriState, v: boolean | undefined): boolean {
  if (t === 'any') return true
  return v === (t === 'yes')
}

export function filterResourceRows(rows: readonly ResourceRow[], f: ResourceFilter): ResourceRow[] {
  const res = f.resources.length ? new Set(f.resources) : undefined
  return rows.filter(
    (r) =>
      (!res || res.has(r.resource)) &&
      (f.minBestQuality === undefined || r.bestQuality >= f.minBestQuality) &&
      inList(f.bodyTypes, r.bodyType) &&
      inList(f.orbitalZones, r.orbitalZone) &&
      inList(f.spheres, r.sphere) &&
      inhabitedOk(f.inhabited, r.inhabited),
  )
}

export function filterBodyRows(rows: readonly BodyRow[], f: BodyFilter): BodyRow[] {
  return rows.filter(
    (r) =>
      inList(f.bodyTypes, r.bodyType) &&
      inList(f.orbitalZones, r.orbitalZone) &&
      inRange(f.diameter, r.diameterM) &&
      inRange(f.gravity, r.gravity) &&
      inList(f.atmosphereTypes, r.atmosphereType) &&
      inRange(f.liquidPct, r.liquidPct) &&
      triOk(f.flora, r.flora) &&
      triOk(f.fauna, r.fauna) &&
      inList(f.resourceZones, r.resourceZones) &&
      inhabitedOk(f.inhabited, r.inhabited),
  )
}

export function filterSystemRows(rows: readonly SystemRow[], f: SystemFilter): SystemRow[] {
  return rows.filter((r) => inList(f.eod, r.eod))
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

function compareDefined(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(String(a), String(b))
}

/**
 * Stable sort by one column. Undefined values go last regardless of direction.
 * Returns a new array.
 */
export function sortRows<T>(rows: readonly T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((x, y) => {
    const a = x[key]
    const b = y[key]
    if (a === undefined || a === null) return b === undefined || b === null ? 0 : 1
    if (b === undefined || b === null) return -1
    return sign * compareDefined(a, b)
  })
}
