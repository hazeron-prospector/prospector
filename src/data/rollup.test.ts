import { describe, expect, it } from 'vitest'
import { rollupBySystem, type RollupInput } from './rollup'
import { sortRows } from './filter'

function row(o: Partial<RollupInput> & { id: string }): RollupInput {
  return {
    resource: 'Ore',
    bestQuality: 100,
    systemId: 'S1',
    systemName: 'Sys One',
    sectorName: 'Sec',
    bodyId: 'B1',
    bodyName: 'Body 1',
    bodyType: 'Planet',
    inhabited: false,
    inhabitingEmpires: [],
    systemHabitable: false,
    ...o,
  }
}

describe('rollupBySystem', () => {
  it('carries systemHabitable from the best row', () => {
    const out = rollupBySystem([row({ id: '1', systemHabitable: true })])
    expect(out[0]?.systemHabitable).toBe(true)
  })

  it('returns empty for empty input', () => {
    expect(rollupBySystem([])).toEqual([])
  })

  it('produces one row per system with counts and best pick', () => {
    const rows = [
      row({ id: '1', bestQuality: 100, bodyId: 'B1', bodyName: 'A I' }),
      row({ id: '2', bestQuality: 180, bodyId: 'B1', bodyName: 'A I', resource: 'Gold Ore' }),
      row({ id: '3', bestQuality: 150, bodyId: 'B2', bodyName: 'A II', bodyType: 'Moon' }),
      row({ id: '4', bestQuality: 90, systemId: 'S2', systemName: 'Sys Two', bodyId: 'B9', bodyName: 'Z', inhabited: true, inhabitingEmpires: ['E'] }),
    ]
    const out = rollupBySystem(rows)
    expect(out).toHaveLength(2)
    const s1 = out.find((r) => r.systemId === 'S1')!
    expect(s1).toMatchObject({
      systemName: 'Sys One',
      sectorName: 'Sec',
      bestQuality: 180,
      bestBodyId: 'B1',
      bestBodyName: 'A I',
      bestBodyType: 'Planet',
      bestResource: 'Gold Ore',
      bodyCount: 2,
      depositCount: 3,
      inhabited: false,
    })
    const s2 = out.find((r) => r.systemId === 'S2')!
    expect(s2).toMatchObject({ bodyCount: 1, depositCount: 1, inhabited: true, inhabitingEmpires: ['E'] })
  })

  it('breaks quality ties by resource name, then body name, then body id', () => {
    const tie = [
      row({ id: '1', resource: 'Stone', bodyId: 'B1', bodyName: 'A' }),
      row({ id: '2', resource: 'Ore', bodyId: 'B3', bodyName: 'C' }),
      row({ id: '3', resource: 'Ore', bodyId: 'B2', bodyName: 'B' }),
    ]
    const a = rollupBySystem(tie)[0]!
    expect(a.bestResource).toBe('Ore')
    expect(a.bestBodyName).toBe('B')
    // independent of input order
    const b = rollupBySystem([...tie].reverse())[0]!
    expect(b.bestBodyId).toBe(a.bestBodyId)
    const c = rollupBySystem([
      row({ id: '1', bodyId: 'B2', bodyName: 'Same' }),
      row({ id: '2', bodyId: 'B1', bodyName: 'Same' }),
    ])[0]!
    expect(c.bestBodyId).toBe('B1')
  })

  it('counts distinct bodies once even with many deposits', () => {
    const out = rollupBySystem([row({ id: '1' }), row({ id: '2', resource: 'Ice' }), row({ id: '3', resource: 'Coal' })])
    expect(out[0]).toMatchObject({ bodyCount: 1, depositCount: 3 })
  })

  it('output is sortable with sortRows', () => {
    const out = rollupBySystem([
      row({ id: '1', bestQuality: 50, systemId: 'A', systemName: 'A' }),
      row({ id: '2', bestQuality: 200, systemId: 'B', systemName: 'B' }),
    ])
    expect(sortRows(out, 'bestQuality', 'desc').map((r) => r.systemId)).toEqual(['B', 'A'])
    expect(sortRows(out, 'depositCount', 'asc')).toHaveLength(2)
  })
})
