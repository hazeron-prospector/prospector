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
