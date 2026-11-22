/**
 * Streaming XML -> StarMap.
 *
 * Uses saxes, which never fetches external entities or DTDs. We additionally
 * reject any DOCTYPE outright, so no entity declarations can ever be seen.
 * Schema source of truth: the game's exporter (see BLUEPRINT section 4).
 */
import { SaxesParser, type SaxesTagPlain } from 'saxes'
import {
  parseAtmosphere,
  parseDiameter,
  parseGravity,
  parseHabitableZone,
  parseOrbit,
  parseSurfaceLiquid,
  parseTemperatureK,
  parseZone,
} from './strings'
import {
  SCHEMA_VERSION,
  type Atmosphere,
  type Biosphere,
  type City,
  type Eod,
  type Geosphere,
  type Hydrosphere,
  type Planet,
  type Resource,
  type Sector,
  type Spacecraft,
  type Star,
  type StarMap,
  type System,
  type Wormhole,
  type WormholePolarity,
  type ZoneValue,
} from './types'

export class StarMapParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StarMapParseError'
  }
}

type Attrs = Record<string, string>
const CHUNK = 1 << 20
const MAX_ZONES = 4
const EODS: readonly Eod[] = ['Surveyed', 'Explored', 'Unexplored']
const POLARITIES: readonly WormholePolarity[] = ['positive', 'negative', 'neutral']

function req(a: Attrs, name: string, el: string): string {
  const v = a[name]
  if (v === undefined) throw new StarMapParseError(`<${el}> is missing required attribute "${name}"`)
  return v
}

function reqNum(a: Attrs, name: string, el: string): number {
  const raw = req(a, name, el).trim()
  const n = raw === '' ? NaN : Number(raw)
  if (!Number.isFinite(n)) throw new StarMapParseError(`<${el}> attribute "${name}" is not a number: "${raw}"`)
  return n
}

function optNum(a: Attrs, name: string): number | undefined {
  const v = a[name]
  if (v === undefined || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function yesNo(v: string | undefined): boolean | undefined {
  if (v === 'yes') return true
  if (v === 'no') return false
  return undefined
}

function pick<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value as T[K]
}

function zoneValues(a: Attrs, el: string): ZoneValue[] {
  const zones: ZoneValue[] = []
  for (let n = 1; n <= MAX_ZONES; n++) {
    if (a[`qualityZone${n}`] === undefined) break
    zones.push({
      quality: reqNum(a, `qualityZone${n}`, el),
      abundance: reqNum(a, `abundanceZone${n}`, el),
    })
  }
  if (zones.length === 0) throw new StarMapParseError(`<${el}> resource "${a.name ?? ''}" has no zone data`)
  return zones
}

type SphereKey = 'geosphere' | 'hydrosphere' | 'atmosphere' | 'biosphere'

export function parseStarMap(xml: string, onProgress?: (fraction: number) => void): StarMap {
  const parser = new SaxesParser<{ xmlns?: false }>()
  let root: Attrs | undefined
  let galaxyName: string | undefined
  const sectors: Sector[] = []
  const systems: System[] = []

  let sector: Sector | undefined
  let system: System | undefined
  let star: Star | undefined
  let planet: Planet | undefined
  let sphere: SphereKey | undefined
  let sawRoot = false
  let rootClosed = false
  let galaxy = ''

  parser.on('error', (e) => {
    throw new StarMapParseError(`Not a valid XML file: ${e.message}`, { cause: e })
  })
  parser.on('doctype', () => {
    throw new StarMapParseError('DOCTYPE declarations are not allowed in a starmap export')
  })

  parser.on('opentag', (tag: SaxesTagPlain) => {
    const a = tag.attributes as Attrs
    const name = tag.name
    if (!sawRoot) {
      if (name !== 'starmap') {
        throw new StarMapParseError(`This is not a starmap export: root element is <${name}>, expected <starmap>`)
      }
      sawRoot = true
      root = a
      return
    }
    switch (name) {
      case 'galaxy':
        galaxy = req(a, 'name', 'galaxy')
        galaxyName ??= galaxy
        break
      case 'sector':
        sector = {
          sectorId: req(a, 'sectorId', 'sector'),
          name: a.name ?? '',
          galaxy,
          x: optNum(a, 'x') ?? 0,
          y: optNum(a, 'y') ?? 0,
          z: optNum(a, 'z') ?? 0,
        }
        sectors.push(sector)
        break
      case 'system': {
        if (!sector) throw new StarMapParseError('<system> outside of a <sector>')
        const eodRawValue = req(a, 'eod', 'system')
        const known = EODS.includes(eodRawValue as Eod)
        const eod: Eod = known ? (eodRawValue as Eod) : 'Unexplored'
        system = {
          systemId: req(a, 'systemId', 'system'),
          sectorId: sector.sectorId,
          name: a.name ?? '',
          eod,
          stars: [],
          planets: [],
          wormholes: [],
          cities: [],
          spacecraft: [],
        }
        if (!known) system.eodRaw = eodRawValue
        pick(system, 'catalog', a.catalog)
        pick(system, 'x', optNum(a, 'x'))
        pick(system, 'y', optNum(a, 'y'))
        pick(system, 'z', optNum(a, 'z'))
        systems.push(system)
        break
      }
      case 'wormhole': {
        if (!system) break
        const w: Wormhole = {
          destX: reqNum(a, 'destX', 'wormhole'),
          destY: reqNum(a, 'destY', 'wormhole'),
          destZ: reqNum(a, 'destZ', 'wormhole'),
          explored: a.explored === 'Yes',
        }
        pick(w, 'destSystemId', a.destSystemId)
        if (a.polarity !== undefined && POLARITIES.includes(a.polarity as WormholePolarity)) {
          w.polarity = a.polarity as WormholePolarity
        }
        system.wormholes.push(w)
        break
      }
      case 'city': {
        if (!system) break
        const c: City = { cityId: req(a, 'cityId', 'city'), name: a.name ?? '' }
        pick(c, 'empire', a.empire)
        pick(c, 'empireId', a.empireId)
        pick(c, 'stance', a.stance)
        pick(c, 'capital', a.capital)
        pick(c, 'admin', a.admin)
        pick(c, 'airport', a.airport)
        system.cities.push(c)
        break
      }
      case 'spacecraft': {
        if (!system) break
        const sc: Spacecraft = {
          spacecraftId: req(a, 'spacecraftId', 'spacecraft'),
          name: a.name ?? '',
          ownership: a.ownership ?? '',
          structure: a.structure ?? '',
          condition: a.condition ?? '',
          health: optNum(a, 'health') ?? 0,
          moving: a.moving === 'yes',
          space: a.space ?? '',
          sensors: a.sensors === 'yes',
          warpDrive: a.warpDrive ?? 'none',
          wormholeDrive: a.wormholeDrive ?? 'none',
          captain: a.captain === 'yes',
          officer: a.officer === 'yes',
          isNew: a.new === 'yes',
        }
        pick(sc, 'empire', a.empire)
        pick(sc, 'empireId', a.empireId)
        pick(sc, 'stance', a.stance)
        system.spacecraft.push(sc)
        break
      }
      case 'star': {
        if (!system) break
        const diameterRaw = a.diameter ?? ''
        star = {
          starId: req(a, 'starId', 'star'),
          name: a.name ?? '',
          type: a.type ?? '',
          orbit: parseOrbit(a.orbit ?? 'Primary'),
          size: a.size ?? '',
          habRaw: a.hab ?? '',
          shell: a.shell ?? '',
          diameterRaw,
          resources: [],
        }
        pick(star, 'spectralClass', a.spectralClass)
        pick(star, 'surfaceTempRaw', a.surfaceTempK)
        pick(star, 'surfaceTempK', parseTemperatureK(a.surfaceTempK))
        pick(star, 'habAu', parseHabitableZone(a.hab))
        pick(star, 'diameterAu', parseDiameter(diameterRaw)?.au)
        system.stars.push(star)
        break
      }
      case 'planet': {
        if (!system) break
        planet = {
          planetId: req(a, 'planetId', 'planet'),
          name: a.name ?? '',
          bodyType: a.bodyType ?? '',
          orbit: parseOrbit(a.orbit ?? ''),
          zone: parseZone(a.zone ?? ''),
        }
        system.planets.push(planet)
        break
      }
      case 'geosphere': {
        if (!planet) break
        sphere = 'geosphere'
        const g: Geosphere = { resourceZones: optNum(a, 'resourceZones') ?? 1, resources: [] }
        pick(g, 'diameterRaw', a.diameter)
        const d = parseDiameter(a.diameter)
        pick(g, 'diameterM', d?.meters)
        pick(g, 'radiusM', d?.radiusM)
        pick(g, 'widthM', d?.widthM)
        pick(g, 'gravityRaw', a.gravity)
        const gr = parseGravity(a.gravity)
        pick(g, 'gravity', gr?.value)
        pick(g, 'gravityKind', gr?.kind)
        planet.geosphere = g
        break
      }
      case 'hydrosphere': {
        if (!planet) break
        sphere = 'hydrosphere'
        const h: Hydrosphere = { resources: [] }
        pick(h, 'surfaceLiquidRaw', a.surfaceLiquid)
        const sl = parseSurfaceLiquid(a.surfaceLiquid)
        pick(h, 'liquidPct', sl?.pct)
        pick(h, 'liquidType', sl?.liquid)
        pick(h, 'diameterRaw', a.diameter)
        pick(h, 'diameterM', parseDiameter(a.diameter)?.meters)
        pick(h, 'gravityRaw', a.gravity)
        pick(h, 'gravity', parseGravity(a.gravity)?.value)
        planet.hydrosphere = h
        break
      }
      case 'atmosphere': {
        if (!planet) break
        sphere = 'atmosphere'
        const at: Atmosphere = { resources: [] }
        pick(at, 'compositionRaw', a.composition)
        const p = parseAtmosphere(a.composition)
        pick(at, 'atmosphereType', p?.type)
        pick(at, 'densityPct', p?.densityPct)
        planet.atmosphere = at
        break
      }
      case 'biosphere': {
        if (!planet) break
        sphere = 'biosphere'
        const b: Biosphere = { resources: [] }
        pick(b, 'fauna', yesNo(a.fauna))
        pick(b, 'flora', yesNo(a.flora))
        planet.biosphere = b
        break
      }
      case 'resource': {
        const rname = req(a, 'name', 'resource')
        if (sphere && planet) {
          const r: Resource = { name: rname, zones: zoneValues(a, 'resource') }
          planet[sphere]!.resources.push(r)
        } else if (star && !planet) {
          star.resources.push({
            name: rname,
            quality: reqNum(a, 'quality', 'resource'),
            abundance: reqNum(a, 'abundance', 'resource'),
          })
        }
        break
      }
      default:
        break // anything unknown is ignored
    }
  })

  parser.on('closetag', (tag: SaxesTagPlain) => {
    switch (tag.name) {
      case 'starmap':
        rootClosed = true
        break
      case 'sector':
        sector = undefined
        break
      case 'system':
        system = undefined
        break
      case 'star':
        star = undefined
        break
      case 'planet':
        planet = undefined
        sphere = undefined
        break
      case 'geosphere':
      case 'hydrosphere':
      case 'atmosphere':
      case 'biosphere':
        sphere = undefined
        break
    }
  })

  const total = xml.length
  onProgress?.(0)
  for (let pos = 0; pos < total; pos += CHUNK) {
    parser.write(xml.slice(pos, pos + CHUNK))
    if (pos + CHUNK < total) onProgress?.((pos + CHUNK) / total)
  }
  parser.close()

  if (!sawRoot || !rootClosed || !root) {
    throw new StarMapParseError('This is not a starmap export: no <starmap> element found')
  }
  onProgress?.(1)

  return {
    schemaVersion: SCHEMA_VERSION,
    empireId: root.empireId ?? '',
    empire: root.empire ?? '',
    createDate: root.createDate ?? '',
    galaxyName: galaxyName ?? '',
    sectors,
    systems,
  }
}

