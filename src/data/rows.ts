/** Flatten the StarMap into table rows. Pure; derived in memory, never persisted. */
import type { Eod, Planet, Resource, Sphere, StarMap, System } from './types'

export interface ResourceRow {
  /** `${bodyId}|${sphere}|${resource}`; unique and stable across runs. */
  id: string
  resource: string
  /** Maximum quality across zones. */
  bestQuality: number
  q1?: number
  q2?: number
  q3?: number
  q4?: number
  a1?: number
  a2?: number
  a3?: number
  a4?: number
  systemId: string
  systemName: string
  sectorName: string
  bodyId: string
  bodyName: string
  /** Planet body type, or 'Star' for star resources. */
  bodyType: string
  /** Orbital zone without " Zone". Undefined for stars (they have no orbital zone). */
  orbitalZone?: string
  sphere: Sphere
  /** System has at least one city (cities are per system, not per body). */
  inhabited: boolean
  inhabitingEmpires: string[]
}

export interface BodyRow {
  /** planetId */
  id: string
  systemId: string
  systemName: string
  sectorName: string
  bodyName: string
  bodyType: string
  orbitalZone: string
  orbitingName?: string
  /** Hydrosphere diameter for gas giants (the visible size), else geosphere diameter. */
  diameterM?: number
  ringRadiusM?: number
  ringWidthM?: number
  /** Hydrosphere sea level gravity for gas giants, else geosphere gravity. */
  gravity?: number
  atmosphereType?: string
  atmosphereDensityPct?: number
  liquidPct?: number
  liquidType?: string
  flora?: boolean
  fauna?: boolean
  resourceZones?: number
  inhabited: boolean
  inhabitingEmpires: string[]
}

export interface SystemRow {
  /** systemId */
  id: string
  name: string
  catalog?: string
  sectorId: string
  sectorName: string
  eod: Eod
  starTypes: string[]
  /** starTypes joined with ", " (sortable/displayable). */
  starTypesText: string
  planetCount: number
  cityCount: number
  inhabited: boolean
  inhabitingEmpires: string[]
  wormholeCount: number
  x?: number
  y?: number
  z?: number
}

interface Ctx {
  sectorNames: Map<string, string>
}

function context(map: StarMap): Ctx {
  return { sectorNames: new Map(map.sectors.map((s) => [s.sectorId, s.name])) }
}

function empiresOf(sys: System): string[] {
  const set = new Set<string>()
  for (const c of sys.cities) if (c.empire) set.add(c.empire)
  return [...set]
}

function opt<T extends object, K extends keyof T>(o: T, k: K, v: T[K] | undefined): void {
  if (v !== undefined) o[k] = v
}

function bestOf(r: Resource): number {
  let best = -Infinity
  for (const z of r.zones) if (z.quality > best) best = z.quality
  return best
}

export function toResourceRows(map: StarMap): ResourceRow[] {
  const { sectorNames } = context(map)
  const rows: ResourceRow[] = []
  for (const sys of map.systems) {
    if (sys.eod === 'Unexplored') continue
    const base = {
      systemId: sys.systemId,
      systemName: sys.name,
      sectorName: sectorNames.get(sys.sectorId) ?? '',
      inhabited: sys.cities.length > 0,
      inhabitingEmpires: empiresOf(sys),
    }
    for (const star of sys.stars) {
      for (const r of star.resources) {
        rows.push({
          id: `${star.starId}|star|${r.name}`,
          resource: r.name,
          bestQuality: r.quality,
          q1: r.quality,
          a1: r.abundance,
          ...base,
          bodyId: star.starId,
          bodyName: star.name,
          bodyType: 'Star',
          sphere: 'star',
        })
      }
    }
    for (const p of sys.planets) {
      const spheres: [Exclude<Sphere, 'star'>, Resource[] | undefined][] = [
        ['geosphere', p.geosphere?.resources],
        ['hydrosphere', p.hydrosphere?.resources],
        ['atmosphere', p.atmosphere?.resources],
        ['biosphere', p.biosphere?.resources],
      ]
      for (const [sphere, resources] of spheres) {
        for (const r of resources ?? []) {
          const row: ResourceRow = {
            id: `${p.planetId}|${sphere}|${r.name}`,
            resource: r.name,
            bestQuality: bestOf(r),
            ...base,
            bodyId: p.planetId,
            bodyName: p.name,
            bodyType: p.bodyType,
            orbitalZone: p.zone,
            sphere,
          }
          opt(row, 'q1', r.zones[0]?.quality)
          opt(row, 'q2', r.zones[1]?.quality)
          opt(row, 'q3', r.zones[2]?.quality)
          opt(row, 'q4', r.zones[3]?.quality)
          opt(row, 'a1', r.zones[0]?.abundance)
          opt(row, 'a2', r.zones[1]?.abundance)
          opt(row, 'a3', r.zones[2]?.abundance)
          opt(row, 'a4', r.zones[3]?.abundance)
          rows.push(row)
        }
      }
    }
  }
  return rows
}

function bodyRow(p: Planet, sys: System, sectorName: string): BodyRow {
  const g = p.geosphere
  const h = p.hydrosphere
  const row: BodyRow = {
    id: p.planetId,
    systemId: sys.systemId,
    systemName: sys.name,
    sectorName,
    bodyName: p.name,
    bodyType: p.bodyType,
    orbitalZone: p.zone,
    inhabited: sys.cities.length > 0,
    inhabitingEmpires: empiresOf(sys),
  }
  opt(row, 'orbitingName', p.orbit.orbitingName)
  opt(row, 'diameterM', h?.diameterM ?? g?.diameterM)
  opt(row, 'ringRadiusM', g?.radiusM)
  opt(row, 'ringWidthM', g?.widthM)
  opt(row, 'gravity', h?.gravity ?? g?.gravity)
  opt(row, 'atmosphereType', p.atmosphere?.atmosphereType)
  opt(row, 'atmosphereDensityPct', p.atmosphere?.densityPct)
  opt(row, 'liquidPct', h?.liquidPct)
  opt(row, 'liquidType', h?.liquidType)
  opt(row, 'flora', p.biosphere?.flora)
  opt(row, 'fauna', p.biosphere?.fauna)
  opt(row, 'resourceZones', g?.resourceZones)
  return row
}

export function toBodyRows(map: StarMap): BodyRow[] {
  const { sectorNames } = context(map)
  const rows: BodyRow[] = []
  for (const sys of map.systems) {
    const sectorName = sectorNames.get(sys.sectorId) ?? ''
    for (const p of sys.planets) rows.push(bodyRow(p, sys, sectorName))
  }
  return rows
}

export function toSystemRows(map: StarMap): SystemRow[] {
  const { sectorNames } = context(map)
  return map.systems.map((sys) => {
    const starTypes = sys.stars.map((s) => s.type)
    const row: SystemRow = {
      id: sys.systemId,
      name: sys.name,
      sectorId: sys.sectorId,
      sectorName: sectorNames.get(sys.sectorId) ?? '',
      eod: sys.eod,
      starTypes,
      starTypesText: starTypes.join(', '),
      planetCount: sys.planets.length,
      cityCount: sys.cities.length,
      inhabited: sys.cities.length > 0,
      inhabitingEmpires: empiresOf(sys),
      wormholeCount: sys.wormholes.length,
    }
    opt(row, 'catalog', sys.catalog)
    opt(row, 'x', sys.x)
    opt(row, 'y', sys.y)
    opt(row, 'z', sys.z)
    return row
  })
}
