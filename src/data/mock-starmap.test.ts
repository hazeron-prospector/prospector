import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { resourceInfo } from './catalog'
import { layoutOrrery, ORRERY_EXTENT } from './orrery'
import { parseStarMap } from './parse'
import { toBodyRows, toResourceRows, toSystemRows } from './rows'
import type { StarMap } from './types'

// Synthetic export produced by scripts/gen-mock-starmap.mjs (BLUEPRINT section 22).
// Expected numbers below come from that generator; regenerate both together.
const ARC_TYPES = Array.from({ length: 8 }, (_, i) => `Ringworld Arc ${i + 1}`)
const mockPath = path.resolve(import.meta.dirname, '../../fixtures/mock-starmap.xml')

describe('mock starmap', () => {
  let map: StarMap
  let parseMs = 0

  beforeAll(() => {
    const xml = readFileSync(mockPath, 'utf8')
    const t0 = performance.now()
    map = parseStarMap(xml)
    parseMs = performance.now() - t0
    console.log(`parseStarMap(mock): ${parseMs.toFixed(0)} ms`)
  }, 60_000)

  const planets = () => map.systems.flatMap((s) => s.planets)

  it('lays out every system orrery with all bodies placed inside the view', () => {
    for (const sys of map.systems) {
      const o = layoutOrrery(sys)
      expect(o.bodies).toHaveLength(sys.planets.length)
      expect(o.stars).toHaveLength(sys.stars.length)
      expect(o.bodies.every((b) => b.placed)).toBe(true)
      for (const b of o.bodies) {
        expect(Math.abs(b.x) + b.r).toBeLessThanOrEqual(ORRERY_EXTENT)
        expect(Math.abs(b.y) + b.r).toBeLessThanOrEqual(ORRERY_EXTENT)
      }
    }
  })

  const wormholes = () => map.systems.flatMap((s) => s.wormholes)
  const count = (xs: readonly (string | undefined)[]) => {
    const m: Record<string, number> = {}
    for (const x of xs) m[String(x)] = (m[String(x)] ?? 0) + 1
    return m
  }

  it('has the expected structure counts', () => {
    expect(map.sectors).toHaveLength(10)
    expect(map.systems).toHaveLength(167)
    expect(map.systems.flatMap((s) => s.stars)).toHaveLength(162)
    expect(planets()).toHaveLength(748)
    expect(wormholes()).toHaveLength(145)
    expect(wormholes().filter((w) => w.destSystemId === undefined)).toHaveLength(36)
    expect(map.galaxyName).toBe('Mockverse')
    expect(map.empire).toBe('Mock Empire')
  })

  it('covers every system state', () => {
    expect(count(map.systems.map((s) => s.eod))).toEqual({ Surveyed: 66, Explored: 55, Unexplored: 46 })
    expect(map.systems.filter((s) => s.x === undefined)).toHaveLength(9)
    expect(map.systems.filter((s) => s.x === undefined).every((s) => s.name === 'Deep Space')).toBe(true)
    expect(map.systems.filter((s) => s.catalog !== undefined)).toHaveLength(55)
    expect(map.systems.filter((s) => s.stars.length > 1)).toHaveLength(7)
    expect(map.systems.some((s) => s.stars.length === 3)).toBe(true)
    // planets appear under Surveyed and Explored systems only
    expect(map.systems.filter((s) => s.eod === 'Unexplored').every((s) => s.planets.length === 0)).toBe(true)
  })

  it('covers wormholes, cities and habitable worlds', () => {
    expect(count(wormholes().map((w) => w.polarity))).toEqual({ positive: 41, negative: 55, neutral: 49 })
    expect(count(wormholes().map((w) => String(w.explored)))).toEqual({ true: 89, false: 56 })
    const cities = map.systems.flatMap((s) => s.cities)
    expect(cities).toHaveLength(8)
    expect(new Set(cities.map((c) => c.empire))).toEqual(
      new Set(['Mock Empire', 'Test Dominion', 'Placeholder Union', undefined]),
    )
    const habitable = planets().filter((p) => p.atmosphere?.atmosphereType === 'Standard' && p.zone === 'Habitable')
    expect(habitable).toHaveLength(7) // 4 regular + 3 ringworld arcs
  })

  it('covers spacecraft variety', () => {
    const craft = map.systems.flatMap((s) => s.spacecraft)
    expect(craft).toHaveLength(38)
    expect(new Set(craft.map((c) => c.stance))).toEqual(new Set(['Empire', 'Friend', 'Neutral', undefined]))
    expect(new Set(craft.map((c) => c.structure))).toEqual(new Set(['Station', 'Starship', 'Spaceship']))
    expect(new Set(craft.map((c) => c.moving))).toEqual(new Set([true, false]))
    expect(new Set(craft.map((c) => c.space))).toEqual(new Set(['deep', 'system', 'orbit', 'atmosphere']))
    expect(craft.filter((c) => c.empire === undefined)).toHaveLength(8)
    expect(craft.filter((c) => c.empire !== undefined && c.stance === undefined)).toHaveLength(9)
    expect(new Set(craft.map((c) => c.spacecraftId)).size).toBe(craft.length)
    // never attached to Deep Space systems (no coordinates to anchor them)
    expect(map.systems.filter((s) => s.x === undefined).every((s) => s.spacecraft.length === 0)).toBe(true)
  })

  it('parses fast enough', () => {
    expect(parseMs).toBeLessThan(10_000)
  })

  it('has the expected resource rows and distinct names', () => {
    const rows = toResourceRows(map)
    expect(rows).toHaveLength(2914)
    expect(new Set(rows.map((r) => r.resource)).size).toBe(54)
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(rows.every((r) => r.bestQuality >= 1 && r.bestQuality <= 255)).toBe(true)
    expect(new Set(rows.map((r) => r.sphere))).toEqual(
      new Set(['geosphere', 'hydrosphere', 'atmosphere', 'biosphere', 'star']),
    )
  })

  it('every resource gets a known icon or the placeholder path (no crash)', () => {
    const rows = toResourceRows(map)
    const unknown = new Set<string>()
    for (const r of rows) {
      const info = resourceInfo(r.resource, r.sphere)
      expect(info.categories.length).toBeGreaterThan(0)
      if (info.icon === undefined) unknown.add(r.resource)
      else expect(existsSync(path.resolve(import.meta.dirname, '../../public', info.icon))).toBe(true)
    }
    // the one made-up name takes the Unknown path; every real game name has an icon
    expect([...unknown]).toEqual(['Mockium'])
    expect(resourceInfo('Mockium', 'geosphere').categories).toEqual(['Unknown'])
  })

  it('maps Water in the Environment to Wildcatter and Siphon', () => {
    expect(toResourceRows(map).some((r) => r.resource === 'Water in the Environment')).toBe(true)
    const info = resourceInfo('Water in the Environment', 'hydrosphere')
    expect(info.icon).toBe('icons/c_Water.png')
    expect(info.categories).toEqual(['Wildcatter', 'Siphon'])
  })

  it('counts bodies by resource zones 1/2/3/4', () => {
    const zoned = (n: number) => planets().filter((p) => p.geosphere?.resourceZones === n).length
    expect([zoned(1), zoned(2), zoned(3), zoned(4)]).toEqual([407, 89, 160, 92])
  })

  it('has the documented body types and orbital zones', () => {
    expect(new Set(planets().map((p) => p.bodyType))).toEqual(
      new Set(['Moon', 'Planet', 'Gas Giant', 'Planetoid', 'Titan', 'Ring', ...ARC_TYPES]),
    )
    expect(new Set(planets().map((p) => p.zone))).toEqual(
      new Set(['Inferno', 'Inner', 'Habitable', 'Outer', 'Frigid', 'Penumbral']),
    )
  })

  it('has three synthetic ringworld systems (R1)', () => {
    const rw = map.systems.filter((s) => s.planets.some((p) => p.bodyType.startsWith('Ringworld')))
    expect(rw.map((s) => [s.name, s.eod, s.planets.length])).toEqual([
      ['Halo Prime', 'Surveyed', 6],
      ['Annulus Reach', 'Explored', 4],
      ['Orbital Garland', 'Surveyed', 8],
    ])
    // arcs of one system share one orbit radius and carry resources
    for (const s of rw) {
      expect(new Set(s.planets.map((p) => p.orbit.distance)).size).toBe(1)
      expect(s.planets.every((p) => p.orbit.unit === 'm' && p.geosphere?.radiusM !== undefined)).toBe(true)
      expect(s.planets.some((p) => (p.geosphere?.resources.length ?? 0) > 0)).toBe(true)
    }
    const rows = toSystemRows(map)
    expect(rows.filter((r) => r.hasRingworld)).toHaveLength(3)
    expect(toBodyRows(map).filter((r) => r.isRingworld)).toHaveLength(18)
    expect(toResourceRows(map).filter((r) => r.hasRingworld).length).toBeGreaterThan(0)
    expect(toResourceRows(map).filter((r) => r.isRingworld).every((r) => r.hasRingworld)).toBe(true)
  })

  it('derives body and system rows', () => {
    expect(toBodyRows(map)).toHaveLength(748)
    expect(toSystemRows(map)).toHaveLength(167)
  })

  it('parses every display string it can (no silent misses)', () => {
    const bad: string[] = []
    for (const p of planets()) {
      if (p.geosphere?.diameterRaw && p.geosphere.diameterM === undefined && p.geosphere.radiusM === undefined) bad.push(p.geosphere.diameterRaw)
      if (p.geosphere?.gravityRaw && p.geosphere.gravity === undefined) bad.push(p.geosphere.gravityRaw)
      if (p.hydrosphere?.surfaceLiquidRaw && p.hydrosphere.liquidPct === undefined) bad.push(p.hydrosphere.surfaceLiquidRaw)
      if (p.atmosphere?.compositionRaw && p.atmosphere.densityPct === undefined) bad.push(p.atmosphere.compositionRaw)
      if (p.orbit.au === undefined) bad.push(p.orbit.raw)
    }
    for (const s of map.systems.flatMap((x) => x.stars)) {
      if (s.diameterAu === undefined) bad.push(s.diameterRaw)
      if (s.surfaceTempRaw && s.surfaceTempK === undefined) bad.push(s.surfaceTempRaw)
    }
    expect(bad).toEqual([])
  })
})
