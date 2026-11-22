import { describe, expect, it } from 'vitest'
import { bestDepositsByBody, bestDepositsBySystem, buildSystemSummaries, habitableLabel, hoverResources, isHabitableWorld } from './systemSummary'
import type { Planet, StarMap, System } from './types'

const planet = (id: string, zone: string, type?: string): Planet => ({
  planetId: id,
  name: id,
  bodyType: 'Planet',
  orbit: { raw: '' },
  zone,
  ...(type !== undefined && { atmosphere: { atmosphereType: type, resources: [] } }),
})

const row = (systemId: string, resource: string, bestQuality: number, bodyName = 'B') => ({
  systemId,
  resource,
  bestQuality,
  bodyName,
  sphere: 'geosphere' as const,
})

describe('isHabitableWorld', () => {
  it('needs Standard atmosphere and Habitable zone', () => {
    expect(isHabitableWorld(planet('a', 'Habitable', 'Standard'))).toBe(true)
    expect(isHabitableWorld(planet('b', 'Habitable', 'Corrosive'))).toBe(false)
    expect(isHabitableWorld(planet('c', 'Inner', 'Standard'))).toBe(false)
    expect(isHabitableWorld(planet('d', 'Habitable'))).toBe(false)
  })
})

describe('bestDepositsBySystem', () => {
  it('keeps one entry per resource, sorted by quality, capped', () => {
    const out = bestDepositsBySystem(
      [row('S', 'Ore', 100, 'X'), row('S', 'Ore', 180, 'Y'), row('S', 'Oil', 180), row('S', 'Gold', 50), row('T', 'Ore', 1)],
      2,
    )
    expect(out.get('S')!.map((r) => [r.resource, r.bestQuality])).toEqual([
      ['Oil', 180],
      ['Ore', 180],
    ])
    expect(out.get('S')![1]!.bodyName).toBe('Y')
    expect(out.get('T')).toHaveLength(1)
  })
})

describe('buildSystemSummaries', () => {
  it('counts habitable worlds and attaches top resources', () => {
    const sys = (id: string, planets: Planet[]): System =>
      ({ systemId: id, sectorId: 's', name: id, eod: 'Explored', stars: [], planets, wormholes: [], cities: [] }) as System
    const map = {
      systems: [
        sys('A', [planet('1', 'Habitable', 'Standard'), planet('2', 'Habitable', 'Standard'), planet('3', 'Outer', 'Standard')]),
        sys('B', []),
      ],
    } as unknown as StarMap
    const m = buildSystemSummaries(map, [row('A', 'Ore', 9)])
    expect(m.get('A')).toMatchObject({ habitableCount: 2, topResources: [{ resource: 'Ore' }] })
    expect(m.get('B')).toEqual({ systemId: 'B', habitableCount: 0, topResources: [] })
  })
})

describe('habitableLabel', () => {
  it('pluralizes', () => {
    expect(habitableLabel(0)).toBe('No habitable worlds')
    expect(habitableLabel(1)).toBe('1 habitable world')
    expect(habitableLabel(2)).toBe('2 habitable worlds')
  })
})

describe('hoverResources', () => {
  const r = (resource: string, bestQuality: number) => ({ resource, bestQuality, bodyName: 'B', sphere: 'geosphere' as const })
  const top = [r('Ore', 200), r('Oil', 150), r('Gold', 100), r('Tin', 50)]
  it('lists the top three without a filter', () => {
    expect(hoverResources(top, undefined).map((x) => [x.resource, x.match])).toEqual([
      ['Ore', false],
      ['Oil', false],
      ['Gold', false],
    ])
  })
  it('puts matching deposits first, marked, without duplicates', () => {
    const out = hoverResources(top, [r('Gold', 100)])
    expect(out.map((x) => [x.resource, x.match])).toEqual([
      ['Gold', true],
      ['Ore', false],
      ['Oil', false],
    ])
  })
})

describe('bestDepositsByBody (preview hover)', () => {
  const row = (bodyId: string, resource: string, bestQuality: number) => ({
    bodyId,
    resource,
    bestQuality,
    bodyName: bodyId,
    sphere: 'geosphere' as const,
  })
  const rows = [row('p1', 'Tin', 50), row('p1', 'Ore', 200), row('p1', 'Ore', 120), row('p1', 'Gold', 50), row('p1', 'Oil', 150), row('s1', 'Helium', 90)]

  it('orders by best quality, ties by name, keeps the best per resource, caps at 3', () => {
    const out = bestDepositsByBody(rows).get('p1')!
    expect(out.map((x) => [x.resource, x.bestQuality])).toEqual([
      ['Ore', 200],
      ['Oil', 150],
      ['Gold', 50],
    ])
  })
  it('groups star resources by star id and omits bodies without rows', () => {
    const m = bestDepositsByBody(rows)
    expect(m.get('s1')?.map((x) => x.resource)).toEqual(['Helium'])
    expect(m.get('p2')).toBeUndefined()
    expect(hoverResources(m.get('p2') ?? [], undefined)).toEqual([])
  })
  it('puts filter matches first and marked', () => {
    const m = bestDepositsByBody(rows)
    const matches = bestDepositsByBody([row('p1', 'Tin', 50)])
    const out = hoverResources(m.get('p1') ?? [], matches.get('p1'))
    expect(out.map((x) => [x.resource, x.match])).toEqual([
      ['Tin', true],
      ['Ore', false],
      ['Oil', false],
    ])
  })
})
