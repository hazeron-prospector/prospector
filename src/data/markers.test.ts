import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildMarkers,
  buildRingworldMarkers,
  describeSpacecraft,
  isOwn,
  MARKER_CAP,
  MARKER_OTHER_COLOR,
  MARKER_OWN_COLOR,
  MARKER_SIZE_MULTI,
  MARKER_SIZE_SINGLE,
  summarizeMarkers,
} from './markers'
import { parseStarMap } from './parse'
import type { City, Eod, Spacecraft, StarMap, System } from './types'

const city = (id: string, o: Partial<City> = {}): City => ({ cityId: id, name: `City ${id}`, ...o })
const craft = (id: string, o: Partial<Spacecraft> = {}): Spacecraft => ({
  spacecraftId: id, name: `Craft ${id}`, ownership: 'Fleet', structure: 'Spaceship', condition: 'Green', health: 255,
  moving: false, space: 'deep', sensors: false, warpDrive: 'none', wormholeDrive: 'none', captain: false, officer: false,
  isNew: false, ...o,
})
function sys(id: string, o: Partial<System> = {}): System {
  return { systemId: id, sectorId: 'S', name: id, eod: 'Explored' as Eod, stars: [], planets: [], wormholes: [], cities: [], spacecraft: [], ...o }
}
const mapOf = (systems: System[]): StarMap => ({
  schemaVersion: 2, empireId: '1', empire: 'E', createDate: '', galaxyName: 'G', sectors: [], systems,
})
const close = (a: ArrayLike<number>, b: number[]) => b.forEach((v, i) => expect(a[i]).toBeCloseTo(v, 4))

describe('isOwn', () => {
  it('is true only for stance Empire', () => {
    expect(isOwn({ stance: 'Empire' })).toBe(true)
    expect(isOwn({ stance: 'Friend' })).toBe(false)
    expect(isOwn({})).toBe(false)
  })
})

describe('buildMarkers', () => {
  const map = mapOf([
    sys('A', { x: 1, y: 2, z: 3, cities: [city('1', { stance: 'Empire' })], spacecraft: [craft('1', { stance: 'Friend' })] }),
    sys('B', { x: 4, y: 5, z: 6, cities: [city('2', { stance: 'Friend' }), city('3', { stance: 'Empire' })] }),
    sys('C', { x: 7, y: 8, z: 9, spacecraft: [craft('2'), craft('3', { stance: 'Neutral' })] }),
    sys('D', { x: 0, y: 0, z: 0 }),
    sys('DEEP', { cities: [city('4')], spacecraft: [craft('4')] }), // no coordinates
  ])
  const m = buildMarkers(map)

  it('emits one marker per system per kind, only for systems with that kind', () => {
    expect(m.cities.count).toBe(2)
    expect(m.cities.systemIds).toEqual(['A', 'B'])
    expect(m.spacecraft.count).toBe(2)
    expect(m.spacecraft.systemIds).toEqual(['A', 'C'])
    expect(m.cities.positions).toHaveLength(6)
    close(m.cities.positions, [1, 2, 3, 4, 5, 6])
    close(m.spacecraft.positions, [1, 2, 3, 7, 8, 9])
  })

  it('skips Deep Space systems (no coordinates)', () => {
    expect(m.cities.systemIds).not.toContain('DEEP')
    expect(m.spacecraft.systemIds).not.toContain('DEEP')
  })

  it('colors own-empire markers differently from others (any own item makes the marker own)', () => {
    expect(MARKER_OWN_COLOR.join()).not.toBe(MARKER_OTHER_COLOR.join())
    close(m.cities.colors.subarray(0, 3), MARKER_OWN_COLOR) // A: own city
    close(m.cities.colors.subarray(3, 6), MARKER_OWN_COLOR) // B: mixed, has own
    close(m.spacecraft.colors.subarray(0, 3), MARKER_OTHER_COLOR) // A: friend craft
    close(m.spacecraft.colors.subarray(3, 6), MARKER_OTHER_COLOR)
  })

  it('draws a larger glyph when more than one', () => {
    expect(MARKER_SIZE_MULTI).toBeGreaterThan(MARKER_SIZE_SINGLE)
    expect(Array.from(m.cities.sizes)).toEqual([MARKER_SIZE_SINGLE, MARKER_SIZE_MULTI])
    expect(Array.from(m.spacecraft.sizes)).toEqual([MARKER_SIZE_SINGLE, MARKER_SIZE_MULTI])
    expect(Array.from(m.cities.counts)).toEqual([1, 2])
  })

  it('is empty for a map without cities or spacecraft', () => {
    const e = buildMarkers(mapOf([sys('A', { x: 0, y: 0, z: 0 })]))
    expect(e.cities.count).toBe(0)
    expect(e.spacecraft.positions).toHaveLength(0)
  })
})

describe('describeSpacecraft', () => {
  it('words movement and location', () => {
    expect(describeSpacecraft(craft('1', { moving: true, space: 'deep' }))).toBe('moving, deep space')
    expect(describeSpacecraft(craft('1', { moving: false, space: 'system' }))).toBe('stationary, in system')
    expect(describeSpacecraft(craft('1', { space: 'orbit' }))).toBe('stationary, orbit')
    expect(describeSpacecraft(craft('1', { space: 'atmosphere' }))).toBe('stationary, atmosphere')
  })
})

describe('summarizeMarkers', () => {
  it('lists cities and spacecraft with empire, structure and status', () => {
    const s = summarizeMarkers(
      sys('A', {
        x: 0, y: 0, z: 0,
        cities: [city('1', { name: 'Homeport', empire: 'House', stance: 'Empire' }), city('2', { name: 'Outpost' })],
        spacecraft: [craft('1', { name: 'Wayfarer', structure: 'Starship', moving: true, empire: 'House', stance: 'Empire' })],
      }),
    )
    expect(s.cities.items).toEqual([
      { name: 'Homeport', empire: 'House', own: true },
      { name: 'Outpost', own: false },
    ])
    expect(s.cities.more).toBe(0)
    expect(s.cities.total).toBe(2)
    expect(s.spacecraft.items).toEqual([
      { name: 'Wayfarer', structure: 'Starship', status: 'moving, deep space', empire: 'House', own: true },
    ])
  })

  it('caps each list and reports the rest', () => {
    const s = summarizeMarkers(
      sys('A', {
        x: 0, y: 0, z: 0,
        cities: Array.from({ length: MARKER_CAP + 3 }, (_, i) => city(String(i))),
        spacecraft: Array.from({ length: MARKER_CAP + 1 }, (_, i) => craft(String(i))),
      }),
    )
    expect(s.cities.items).toHaveLength(MARKER_CAP)
    expect(s.cities.more).toBe(3)
    expect(s.spacecraft.items).toHaveLength(MARKER_CAP)
    expect(s.spacecraft.more).toBe(1)
  })

  it('puts own-empire entries first', () => {
    const s = summarizeMarkers(sys('A', { cities: [city('1', { name: 'Far' }), city('2', { name: 'Home', stance: 'Empire' })] }))
    expect(s.cities.items.map((c) => c.name)).toEqual(['Home', 'Far'])
  })
})

describe('mock starmap markers', () => {
  const map = parseStarMap(readFileSync(path.resolve(import.meta.dirname, '../../fixtures/mock-starmap.xml'), 'utf8'))
  it('builds markers for every located system that has cities or spacecraft', () => {
    const m = buildMarkers(map)
    const located = map.systems.filter((s) => s.x !== undefined)
    expect(m.cities.count).toBe(located.filter((s) => s.cities.length > 0).length)
    expect(m.spacecraft.count).toBe(located.filter((s) => s.spacecraft.length > 0).length)
    expect(m.cities.count).toBeGreaterThan(0)
    expect(m.spacecraft.count).toBeGreaterThan(0)
    expect(new Set(Array.from({ length: m.spacecraft.count }, (_, i) => m.spacecraft.colors[i * 3]!)).size).toBe(2)
  })
})

describe('buildRingworldMarkers', () => {
  const arc = (id: string, n: number) =>
    ({ planetId: id, name: id, bodyType: `Ringworld Arc ${n}`, orbit: { raw: '' }, zone: 'Habitable' }) as System['planets'][number]
  const planet = (id: string) => ({ planetId: id, name: id, bodyType: 'Planet', orbit: { raw: '' }, zone: 'Inner' }) as System['planets'][number]
  it('lists one marker per located ringworld system', () => {
    const map = mapOf([
      sys('A', { x: 1, y: 2, z: 3, planets: [arc('a1', 1), arc('a2', 2), planet('p')] }),
      sys('B', { x: 4, y: 5, z: 6, planets: [planet('q')] }),
      sys('C', { planets: [arc('c1', 1)] }), // Deep Space: no coordinates
      sys('D', { x: 7, y: 8, z: 9, planets: [arc('d1', 4)] }),
    ])
    const m = buildRingworldMarkers(map)
    expect(m.count).toBe(2)
    expect(m.systemIds).toEqual(['A', 'D'])
    close(m.positions, [1, 2, 3, 7, 8, 9])
  })
  it('is empty without ringworlds', () => {
    const m = buildRingworldMarkers(mapOf([sys('A', { x: 1, y: 2, z: 3, planets: [planet('p')] })]))
    expect(m.count).toBe(0)
    expect(m.positions).toHaveLength(0)
  })
  it('finds the three mock ringworld systems', () => {
    const xml = readFileSync(path.resolve(import.meta.dirname, '../../fixtures/mock-starmap.xml'), 'utf8')
    expect(buildRingworldMarkers(parseStarMap(xml)).count).toBe(3)
  })
})
