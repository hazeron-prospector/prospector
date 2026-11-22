import { describe, expect, it } from 'vitest'
import { DEFAULT_HIGH_QUALITY, highQualitySummary, type BodyResourceRow } from './bodyResources'

const row = (name: string, best: number, sphere: BodyResourceRow['sphere'] = 'geosphere'): BodyResourceRow => ({
  name, sphere, best, zones: [{ quality: best, abundance: 1 }],
})

describe('highQualitySummary', () => {
  const rows = [row('Iron', 150), row('Gold', 220), row('Silver', 200), row('Zinc', 199)]
  it('uses the filter threshold when set', () => {
    const s = highQualitySummary(rows, 150)
    expect(s.dimmed).toBe(false)
    expect(s.items.map((r) => r.name)).toEqual(['Gold', 'Silver', 'Zinc', 'Iron'])
  })
  it('falls back to 200 when unset or 0', () => {
    for (const m of [undefined, 0]) {
      const s = highQualitySummary(rows, m)
      expect(s.items.map((r) => r.name)).toEqual(['Gold', 'Silver'])
      expect(DEFAULT_HIGH_QUALITY).toBe(200)
    }
  })
  it('when none qualify returns the single best, dimmed', () => {
    const s = highQualitySummary(rows, 250)
    expect(s.dimmed).toBe(true)
    expect(s.items.map((r) => r.name)).toEqual(['Gold'])
  })
  it('breaks ties by name', () => {
    const s = highQualitySummary([row('Zed', 210), row('Abe', 210)], undefined)
    expect(s.items.map((r) => r.name)).toEqual(['Abe', 'Zed'])
    expect(highQualitySummary([row('Zed', 10), row('Abe', 10)], undefined).items.map((r) => r.name)).toEqual(['Abe'])
  })
  it('is empty with no resources', () => {
    expect(highQualitySummary([], 100)).toEqual({ items: [], dimmed: false })
  })
})

import { defaultDir, filterBodyResources, sortBodyResources } from './bodyResources'

describe('sortBodyResources / filterBodyResources (W19)', () => {
  const z = (...qs: number[]) => qs.map((quality) => ({ quality, abundance: 1 }))
  const rows: BodyResourceRow[] = [
    { name: 'Iron', sphere: 'geosphere', best: 120, zones: z(100, 120) },
    { name: 'Water', sphere: 'hydrosphere', best: 90, zones: z(90, 10, 50) },
    { name: 'Gold', sphere: 'geosphere', best: 120, zones: z(120) },
  ]
  const names = (rs: BodyResourceRow[]) => rs.map((r) => r.name)
  it('sorts best quality desc with name tiebreak', () => {
    expect(names(sortBodyResources(rows, 'best', 'desc'))).toEqual(['Gold', 'Iron', 'Water'])
    expect(names(sortBodyResources(rows, 'best', 'asc'))).toEqual(['Water', 'Gold', 'Iron'])
  })
  it('sorts by name and sphere', () => {
    expect(names(sortBodyResources(rows, 'name', 'asc'))).toEqual(['Gold', 'Iron', 'Water'])
    expect(names(sortBodyResources(rows, 'name', 'desc'))).toEqual(['Water', 'Iron', 'Gold'])
    expect(names(sortBodyResources(rows, 'sphere', 'desc'))).toEqual(['Water', 'Gold', 'Iron'])
  })
  it('sorts by zone with missing zones last in both directions', () => {
    expect(names(sortBodyResources(rows, 'z2', 'desc'))).toEqual(['Iron', 'Water', 'Gold'])
    expect(names(sortBodyResources(rows, 'z2', 'asc'))).toEqual(['Water', 'Iron', 'Gold'])
    expect(names(sortBodyResources(rows, 'z3', 'desc'))).toEqual(['Water', 'Gold', 'Iron'])
  })
  it('does not mutate input', () => {
    const copy = [...rows]
    sortBodyResources(rows, 'name', 'desc')
    expect(rows).toEqual(copy)
  })
  it('filters by case-insensitive substring; blank keeps all', () => {
    expect(names(filterBodyResources(rows, 'OLD'))).toEqual(['Gold'])
    expect(filterBodyResources(rows, '  ')).toHaveLength(3)
    expect(filterBodyResources(rows, 'zzz')).toEqual([])
  })
  it('default direction: text asc, numbers desc', () => {
    expect(defaultDir('name')).toBe('asc')
    expect(defaultDir('sphere')).toBe('asc')
    expect(defaultDir('best')).toBe('desc')
    expect(defaultDir('z1')).toBe('desc')
  })
})
