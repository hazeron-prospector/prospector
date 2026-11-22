import { describe, expect, it } from 'vitest'
import type { BodyRow, ResourceRow, SystemRow } from '@/data/rows'
import { quickFilterBodies, quickFilterResources, quickFilterSystems } from './quickFilter'

const res = [
  { systemName: 'Sol', bodyName: 'Earth' },
  { systemName: 'Alpha Centauri', bodyName: 'Proxima b' },
] as ResourceRow[]

describe('quick filter', () => {
  it('matches system or body name, case-insensitively, as a substring', () => {
    expect(quickFilterResources(res, 'EAR')).toEqual([res[0]])
    expect(quickFilterResources(res, 'centaur')).toEqual([res[1]])
    expect(quickFilterResources(res, 'xyz')).toEqual([])
  })
  it('empty or blank query returns the same array', () => {
    expect(quickFilterResources(res, '')).toBe(res)
    expect(quickFilterResources(res, '  ')).toBe(res)
  })
  it('does not fuzzy match', () => {
    expect(quickFilterResources(res, 'sl')).toEqual([])
  })
  it('bodies use system and body name', () => {
    const rows = [{ systemName: 'Sol', bodyName: 'Mars' }] as BodyRow[]
    expect(quickFilterBodies(rows, 'sol')).toHaveLength(1)
    expect(quickFilterBodies(rows, 'mar')).toHaveLength(1)
    expect(quickFilterBodies(rows, 'venus')).toHaveLength(0)
  })
  it('systems use name and catalog (catalog may be missing)', () => {
    const rows = [{ name: 'Sol', catalog: 'HD 10' }, { name: 'Vega' }] as SystemRow[]
    expect(quickFilterSystems(rows, 'hd')).toEqual([rows[0]])
    expect(quickFilterSystems(rows, 'vega')).toEqual([rows[1]])
  })
})

describe('quickFilterSystems by sector', () => {
  it('matches the sector name too', () => {
    const rows = [
      { name: 'A', sectorName: 'Orion Reach' },
      { name: 'B', sectorName: 'Vega' },
    ] as unknown as Parameters<typeof quickFilterSystems>[0]
    expect(quickFilterSystems(rows, 'orion')).toEqual([rows[0]])
  })
})
