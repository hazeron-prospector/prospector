import { describe, expect, it } from 'vitest'
import { ZONE_ORDER, zoneColor, zonesPresent } from './zoneColor'

describe('zoneColor', () => {
  it('maps each known zone to a distinct color', () => {
    const colors = ZONE_ORDER.map((z) => zoneColor(z))
    expect(new Set(colors).size).toBe(ZONE_ORDER.length)
  })
  it('accepts a " Zone" suffix and any case', () => {
    expect(zoneColor('habitable zone')).toBe(zoneColor('Habitable'))
  })
  it('falls back to the unknown grey', () => {
    expect(zoneColor(undefined)).toBe(zoneColor('Mystery'))
    expect(ZONE_ORDER.map(zoneColor)).not.toContain(zoneColor(undefined))
  })
})

describe('zonesPresent', () => {
  it('returns canonical zones present, in canonical order, deduped; unknown last', () => {
    expect(zonesPresent(['Outer', 'Inner', 'Outer', undefined, 'Habitable'])).toEqual(['Inner', 'Habitable', 'Outer', 'unknown'])
  })
  it('is empty for no zones', () => {
    expect(zonesPresent([])).toEqual([])
  })
})
