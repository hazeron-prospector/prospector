import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BODY_FILTER,
  DEFAULT_RESOURCE_FILTER,
  DEFAULT_RESOURCE_SORT,
  DEFAULT_SYSTEM_FILTER,
  filterBodyRows,
  filterResourceRows,
  filterSystemRows,
  sortRows,
} from './filter'
import type { BodyRow, ResourceRow, SystemRow } from './rows'

function rr(o: Partial<ResourceRow> & { id: string }): ResourceRow {
  return {
    resource: 'Ore',
    bestQuality: 100,
    systemId: 's',
    systemName: 'S',
    sectorName: 'Sec',
    bodyId: 'b',
    bodyName: 'B',
    bodyType: 'Planet',
    orbitalZone: 'Inner',
    sphere: 'geosphere',
    inhabited: false,
    inhabitingEmpires: [],
    ...o,
  }
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('filterResourceRows', () => {
  const rows = [
    rr({ id: '1', resource: 'Ore', bestQuality: 200 }),
    rr({ id: '2', resource: 'Ice', bestQuality: 50, bodyType: 'Moon', orbitalZone: 'Frigid', sphere: 'geosphere' }),
    rr({ id: '3', resource: 'Air', bestQuality: 120, sphere: 'atmosphere', inhabited: true }),
    rr({ id: '4', resource: 'Type G Preons', bestQuality: 210, bodyType: 'Star', orbitalZone: undefined, sphere: 'star' }),
  ]
  const f = (o: Partial<typeof DEFAULT_RESOURCE_FILTER>) => ids(filterResourceRows(rows, { ...DEFAULT_RESOURCE_FILTER, ...o }))

  it('default filter passes everything', () => expect(f({})).toEqual(['1', '2', '3', '4']))
  it('resources (multi)', () => expect(f({ resources: ['Ore', 'Air'] })).toEqual(['1', '3']))
  it('min best quality is inclusive', () => {
    expect(f({ minBestQuality: 120 })).toEqual(['1', '3', '4'])
    expect(f({ minBestQuality: undefined })).toHaveLength(4)
  })
  it('body types incl. Star', () => {
    expect(f({ bodyTypes: ['Moon', 'Star'] })).toEqual(['2', '4'])
  })
  it('orbital zones (stars have none and are excluded when active)', () => {
    expect(f({ orbitalZones: ['Inner'] })).toEqual(['1', '3'])
    expect(f({ orbitalZones: ['Frigid', 'Inner'] })).toEqual(['1', '2', '3'])
  })
  it('spheres', () => expect(f({ spheres: ['atmosphere', 'star'] })).toEqual(['3', '4']))
  it('inhabited any / hide / only', () => {
    expect(f({ inhabited: 'any' })).toHaveLength(4)
    expect(f({ inhabited: 'hide' })).toEqual(['1', '2', '4'])
    expect(f({ inhabited: 'only' })).toEqual(['3'])
  })
  it('combines criteria', () => {
    expect(f({ resources: ['Ore', 'Ice'], minBestQuality: 100 })).toEqual(['1'])
  })
  it('does not mutate input', () => {
    const copy = [...rows]
    f({ resources: ['Ore'] })
    expect(rows).toEqual(copy)
  })
})

describe('filterBodyRows', () => {
  function br(o: Partial<BodyRow> & { id: string }): BodyRow {
    return {
      systemId: 's',
      systemName: 'S',
      sectorName: 'Sec',
      bodyName: 'B',
      bodyType: 'Planet',
      orbitalZone: 'Inner',
      inhabited: false,
      inhabitingEmpires: [],
      ...o,
    }
  }
  const rows = [
    br({ id: 'a', diameterM: 15000, gravity: 10, atmosphereType: 'Standard', liquidPct: 50, flora: true, fauna: false, resourceZones: 4, inhabited: true }),
    br({ id: 'b', bodyType: 'Moon', orbitalZone: 'Frigid', diameterM: 2000, gravity: 1, atmosphereType: 'None', liquidPct: 0, flora: false, fauna: false, resourceZones: 1 }),
    br({ id: 'c', bodyType: 'Ring', orbitalZone: 'Outer', resourceZones: 1 }),
  ]
  const f = (o: Partial<typeof DEFAULT_BODY_FILTER>) => ids(filterBodyRows(rows, { ...DEFAULT_BODY_FILTER, ...o }))

  it('default passes all', () => expect(f({})).toEqual(['a', 'b', 'c']))
  it('body type and zone', () => {
    expect(f({ bodyTypes: ['Moon', 'Ring'] })).toEqual(['b', 'c'])
    expect(f({ orbitalZones: ['Inner'] })).toEqual(['a'])
  })
  it('diameter range; undefined fails an active range', () => {
    expect(f({ diameter: { min: 1000, max: 5000 } })).toEqual(['b'])
    expect(f({ diameter: { min: 1000 } })).toEqual(['a', 'b'])
    expect(f({ diameter: { max: 20000 } })).toEqual(['a', 'b'])
    expect(f({ diameter: {} })).toEqual(['a', 'b', 'c'])
  })
  it('gravity range', () => expect(f({ gravity: { min: 5, max: 12 } })).toEqual(['a']))
  it('atmosphere type', () => expect(f({ atmosphereTypes: ['None', 'Standard'] })).toEqual(['a', 'b']))
  it('liquid range', () => {
    expect(f({ liquidPct: { min: 10 } })).toEqual(['a'])
    expect(f({ liquidPct: { max: 0 } })).toEqual(['b'])
  })
  it('flora / fauna tri-state', () => {
    expect(f({ flora: 'yes' })).toEqual(['a'])
    expect(f({ flora: 'no' })).toEqual(['b'])
    expect(f({ fauna: 'yes' })).toEqual([])
    expect(f({ fauna: 'any' })).toHaveLength(3)
  })
  it('resource zones', () => {
    expect(f({ resourceZones: [1] })).toEqual(['b', 'c'])
    expect(f({ resourceZones: [4, 1] })).toEqual(['a', 'b', 'c'])
  })
  it('inhabited', () => {
    expect(f({ inhabited: 'only' })).toEqual(['a'])
    expect(f({ inhabited: 'hide' })).toEqual(['b', 'c'])
  })
})

describe('filterSystemRows', () => {
  const mk = (id: string, eod: SystemRow['eod']): SystemRow => ({
    id, name: id, sectorId: 's', sectorName: 'S', eod, starTypes: [], starTypesText: '',
    planetCount: 0, cityCount: 0, inhabited: false, inhabitingEmpires: [], wormholeCount: 0,
  })
  const rows = [mk('a', 'Surveyed'), mk('b', 'Explored'), mk('c', 'Unexplored')]
  it('status filter', () => {
    expect(ids(filterSystemRows(rows, DEFAULT_SYSTEM_FILTER))).toEqual(['a', 'b', 'c'])
    expect(ids(filterSystemRows(rows, { eod: ['Surveyed', 'Explored'] }))).toEqual(['a', 'b'])
  })
})

describe('sortRows', () => {
  const rows = [
    { id: 'a', n: 5, s: 'beta' },
    { id: 'b', n: undefined, s: 'Alpha' },
    { id: 'c', n: 9, s: undefined },
    { id: 'd', n: 5, s: 'gamma' },
    { id: 'e', n: 1, s: 'alpha2' },
  ]
  it('sorts numbers asc/desc with undefined last in both directions', () => {
    expect(ids(sortRows(rows, 'n', 'asc'))).toEqual(['e', 'a', 'd', 'c', 'b'])
    expect(ids(sortRows(rows, 'n', 'desc'))).toEqual(['c', 'a', 'd', 'e', 'b'])
  })
  it('sorts strings case-insensitively, undefined last', () => {
    expect(ids(sortRows(rows, 's', 'asc'))).toEqual(['b', 'e', 'a', 'd', 'c'])
    expect(ids(sortRows(rows, 's', 'desc'))).toEqual(['d', 'a', 'e', 'b', 'c'])
  })
  it('is stable and does not mutate', () => {
    const before = [...rows]
    sortRows(rows, 'n', 'asc')
    expect(rows).toEqual(before)
    expect(ids(sortRows(rows, 'n', 'desc')).slice(1, 3)).toEqual(['a', 'd'])
  })
  it('sorts booleans false before true', () => {
    const b = [{ id: 'x', v: true }, { id: 'y', v: false }]
    expect(ids(sortRows(b, 'v', 'asc'))).toEqual(['y', 'x'])
  })
  it('default resource sort is bestQuality desc', () => {
    expect(DEFAULT_RESOURCE_SORT).toEqual({ key: 'bestQuality', dir: 'desc' })
  })
})
