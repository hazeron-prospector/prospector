import { describe, expect, it } from 'vitest'
import { MINI_XML } from './__fixtures__/mini'
import { parseStarMap } from './parse'
import { toBodyRows, toResourceRows, toSystemRows } from './rows'

const map = parseStarMap(MINI_XML)

describe('toResourceRows', () => {
  const rows = toResourceRows(map)
  const find = (bodyId: string, resource: string) => rows.find((r) => r.bodyId === bodyId && r.resource === resource)!

  it('emits one row per resource per body, stars included, unexplored systems excluded', () => {
    expect(rows).toHaveLength(11)
    expect(rows.filter((r) => r.sphere === 'star')).toHaveLength(2)
    expect(rows.some((r) => r.systemId === 'SYSC')).toBe(false)
  })
  it('has stable unique ids', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(toResourceRows(map).map((r) => r.id)).toEqual(rows.map((r) => r.id))
  })
  it('computes best quality and per-zone values (undefined when absent)', () => {
    const ore = find('PA1', 'Ore')
    expect(ore.bestQuality).toBe(150)
    expect([ore.q1, ore.q2, ore.q3, ore.q4]).toEqual([100, 150, 50, 120])
    expect([ore.a1, ore.a2, ore.a3, ore.a4]).toEqual([2, 3, 1, 9])
    const moonOre = find('PA2', 'Ore')
    expect(moonOre.bestQuality).toBe(180)
    expect([moonOre.q2, moonOre.q3, moonOre.q4]).toEqual([undefined, undefined, undefined])
    expect([moonOre.a2, moonOre.a3, moonOre.a4]).toEqual([undefined, undefined, undefined])
  })
  it('labels spheres and carries body/system info', () => {
    expect(find('PA1', 'Stone')).toMatchObject({
      sphere: 'geosphere',
      bodyName: 'Aldera I',
      bodyType: 'Planet',
      orbitalZone: 'Habitable',
      systemId: 'SYSA',
      systemName: 'Aldera',
      sectorName: 'Alpha Sector',
    })
    expect(find('PA1', 'Myrathane').sphere).toBe('hydrosphere')
    expect(find('PA1', 'Air').sphere).toBe('atmosphere')
    expect(find('PA1', 'Fruit').sphere).toBe('biosphere')
    expect(find('PA4', 'Ice').bodyType).toBe('Ring')
    expect(find('PA1', 'Fruit').categories).toEqual(['Surface Only'])
    expect(find('PA1', 'Stone').categories).toEqual(['Prospector'])
    expect(find('STA', 'Type G Preons').categories).toEqual(['Particle Collector'])
  })
  it('stars: bodyType Star, no orbital zone, quality in zone 1', () => {
    const s = find('STA', 'Type G Preons')
    expect(s).toMatchObject({ sphere: 'star', bodyType: 'Star', bestQuality: 200, q1: 200, a1: 4 })
    expect(s.orbitalZone).toBeUndefined()
    expect(s.q2).toBeUndefined()
  })
  it('flags inhabited systems with their empires', () => {
    expect(find('PA1', 'Ore')).toMatchObject({ inhabited: true, inhabitingEmpires: ['House Test'] })
  })
})

describe('toBodyRows', () => {
  const rows = toBodyRows(map)
  const row = (id: string) => rows.find((r) => r.id === id)!
  it('emits one row per planet in every system', () => {
    expect(rows.map((r) => r.id)).toEqual(['PA1', 'PA2', 'PA3', 'PA4', 'PB1'])
  })
  it('fills habitability columns', () => {
    expect(row('PA1')).toMatchObject({
      systemName: 'Aldera',
      bodyName: 'Aldera I',
      bodyType: 'Planet',
      orbitalZone: 'Habitable',
      diameterM: 15600,
      gravity: 11.89,
      atmosphereType: 'Exotic',
      atmosphereDensityPct: 77,
      liquidPct: 77,
      liquidType: 'Water',
      flora: false,
      fauna: true,
      resourceZones: 4,
      inhabited: true,
      inhabitingEmpires: ['House Test'],
    })
  })
  it('uses hydrosphere size and gravity for gas giants', () => {
    expect(row('PA3')).toMatchObject({ diameterM: 64000, gravity: 48.77 })
  })
  it('leaves absent data undefined and non-inhabited systems unflagged', () => {
    const ring = row('PA4')
    expect(ring.gravity).toBeUndefined()
    expect(ring.atmosphereType).toBeUndefined()
    expect(ring.liquidPct).toBeUndefined()
    expect(ring.flora).toBeUndefined()
    expect(ring.ringRadiusM).toBe(54700)
    expect(row('PB1')).toMatchObject({ inhabited: false, inhabitingEmpires: [] })
  })
})

describe('toSystemRows', () => {
  const rows = toSystemRows(map)
  it('emits one row per system including unexplored and deep space', () => {
    expect(rows.map((r) => r.id)).toEqual(['SYSA', 'SYSB', 'SYSC', 'SYSD'])
  })
  it('summarises a system', () => {
    expect(rows[0]).toMatchObject({
      name: 'Aldera',
      catalog: "XQL'A'B'a",
      sectorName: 'Alpha Sector',
      eod: 'Surveyed',
      starTypes: ['G Yellow', 'Neutron Star'],
      starTypesText: 'G Yellow, Neutron Star',
      planetCount: 4,
      cityCount: 2,
      inhabited: true,
      inhabitingEmpires: ['House Test'],
      wormholeCount: 2,
    })
    expect(rows[3]).toMatchObject({ eod: 'Unexplored', planetCount: 0, starTypes: [], inhabited: false })
  })
})
