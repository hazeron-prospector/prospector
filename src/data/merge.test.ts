import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { mergeStarMaps, parseExportDate } from './merge'
import { parseStarMap } from './parse'
import { clearMap, loadMap, saveMap } from './store'
import { SCHEMA_VERSION, type City, type Eod, type Spacecraft, type StarMap, type System, type Wormhole } from './types'

const OLD = 'Sat Nov 21 17:25:58 2026 GMT'
const NEW = 'Sun Nov 22 09:00:00 2026 GMT'

function sys(id: string, eod: Eod, extra: Partial<System> = {}): System {
  return {
    systemId: id, sectorId: 'SEC1', name: `Name ${id}`, x: 1, y: 2, z: 3, eod,
    stars: [], planets: [], wormholes: [], cities: [], spacecraft: [], ...extra,
  }
}
function map(systems: System[], extra: Partial<StarMap> = {}): StarMap {
  return {
    schemaVersion: SCHEMA_VERSION, empireId: '1', empire: 'Old Empire', createDate: OLD, galaxyName: 'G',
    sectors: [{ sectorId: 'SEC1', name: 'S1', galaxy: 'G', x: 0, y: 0, z: 0 }], systems, ...extra,
  }
}
const city = (id: string, name = id): City => ({ cityId: id, name })
const craft = (id: string, name = id): Spacecraft => ({
  spacecraftId: id, name, ownership: 'Fleet', structure: 'Station', condition: 'Green', health: 255,
  moving: false, space: 'orbit', sensors: false, warpDrive: 'none', wormholeDrive: 'none', captain: false,
  officer: false, isNew: false,
})
const wh = (dest: string | undefined, explored: boolean, x = 1, y = 1, z = 1): Wormhole => ({
  destX: x, destY: y, destZ: z, ...(dest && { destSystemId: dest }), explored,
})
const OPTS = { mergeLists: true }
const one = (r: ReturnType<typeof mergeStarMaps>, id = 'A') => r.map.systems.find((s) => s.systemId === id)!

describe('parseExportDate', () => {
  it('parses the exporter format as UTC', () => {
    expect(parseExportDate('Sat Nov 21 17:25:58 2026 GMT')).toBe(Date.UTC(2026, 10, 21, 17, 25, 58))
    expect(parseExportDate('Sat Jan 02 03:04:05 2100 GMT')).toBe(Date.UTC(2100, 0, 2, 3, 4, 5))
  })
  it('accepts ISO and rejects junk', () => {
    expect(parseExportDate('2026-11-21T17:25:58Z')).toBe(Date.UTC(2026, 10, 21, 17, 25, 58))
    expect(parseExportDate('')).toBeUndefined()
    expect(parseExportDate(undefined)).toBeUndefined()
    expect(parseExportDate('not a date')).toBeUndefined()
    expect(parseExportDate('Sat Foo 21 17:25:58 2026 GMT')).toBeUndefined()
  })
})

describe('precedence', () => {
  const ranks: Eod[] = ['Unexplored', 'Explored', 'Surveyed']
  const pairs = ranks.flatMap((a, i) => ranks.map((b, j) => [a, b, i, j] as const))
  it.each(pairs)('existing %s vs incoming %s (incoming older date)', (ex, inc, i, j) => {
    const r = mergeStarMaps(
      map([sys('A', ex, { name: 'ex' })], { createDate: NEW }),
      map([sys('A', inc, { name: 'inc' })], { createDate: OLD }),
      OPTS,
    )
    const incomingWins = j > i
    expect(one(r).name).toBe(incomingWins ? 'inc' : 'ex')
    expect(r.stats).toEqual({ added: 0, updated: incomingWins ? 1 : 0, kept: incomingWins ? 0 : 1 })
  })
  const tie = (exDate: string, incDate: string) =>
    one(
      mergeStarMaps(
        map([sys('A', 'Explored', { name: 'ex' })], { createDate: exDate }),
        map([sys('A', 'Explored', { name: 'inc' })], { createDate: incDate }),
        OPTS,
      ),
    ).name
  it('equal rank: newer incoming wins', () => expect(tie(OLD, NEW)).toBe('inc'))
  it('equal rank: older incoming loses', () => expect(tie(NEW, OLD)).toBe('ex'))
  it('equal rank: equal dates -> incoming', () => expect(tie(OLD, OLD)).toBe('inc'))
  it('equal rank: bad date -> incoming', () => {
    expect(tie('garbage', OLD)).toBe('inc')
    expect(tie(NEW, '')).toBe('inc')
  })
  it('uses per-system sourceDate over the map date', () => {
    const r = mergeStarMaps(
      map([sys('A', 'Explored', { name: 'ex', sourceDate: NEW })], { createDate: OLD }),
      map([sys('A', 'Explored', { name: 'inc' })], { createDate: OLD }),
      OPTS,
    )
    expect(one(r).name).toBe('ex')
  })
  it('keeps stars, planets and coordinates from the winner', () => {
    const r = mergeStarMaps(
      map([sys('A', 'Unexplored', { x: 9 })]),
      map([sys('A', 'Surveyed', { x: 5, planets: [{ planetId: 'P' } as never] })]),
      OPTS,
    )
    expect(one(r).x).toBe(5)
    expect(one(r).planets).toHaveLength(1)
  })
  it('stamps sourceDate from the winner export', () => {
    const r = mergeStarMaps(
      map([sys('A', 'Surveyed'), sys('B', 'Surveyed')], { createDate: OLD }),
      map([sys('A', 'Unexplored'), sys('C', 'Surveyed')], { createDate: NEW }),
      OPTS,
    )
    expect(one(r, 'A').sourceDate).toBe(OLD)
    expect(one(r, 'B').sourceDate).toBe(OLD)
    expect(one(r, 'C').sourceDate).toBe(NEW)
  })
})

describe('one-sided systems and stats', () => {
  it('keeps and adds, counting stats', () => {
    const r = mergeStarMaps(
      map([sys('A', 'Surveyed'), sys('B', 'Explored'), sys('C', 'Unexplored')]),
      map([sys('B', 'Surveyed'), sys('C', 'Unexplored', { name: 'c2' }), sys('D', 'Explored')], { createDate: NEW }),
      OPTS,
    )
    expect(r.map.systems.map((s) => s.systemId)).toEqual(['A', 'B', 'C', 'D'])
    expect(r.stats).toEqual({ added: 1, updated: 2, kept: 0 })
    const r2 = mergeStarMaps(map([sys('A', 'Surveyed')]), map([sys('A', 'Unexplored')]), OPTS)
    expect(r2.stats).toEqual({ added: 0, updated: 0, kept: 1 })
  })
})

describe('lists', () => {
  const ex = () =>
    map([
      sys('A', 'Surveyed', {
        cities: [city('C1', 'ex1'), city('C2')],
        spacecraft: [craft('S1', 'ex1')],
        wormholes: [wh('W1', false, 1, 1, 1), wh(undefined, false, 5.01, 5, 5)],
      }),
    ])
  const inc = (eod: Eod) =>
    map(
      [
        sys('A', eod, {
          cities: [city('C1', 'inc1'), city('C3')],
          spacecraft: [craft('S1', 'inc1'), craft('S2')],
          wormholes: [wh('W1', true, 1, 1, 1), wh('W2', false, 2, 2, 2), wh(undefined, true, 5.04, 5.0, 5)],
        }),
      ],
      { createDate: NEW },
    )
  it('union with winner record on duplicates (incoming wins)', () => {
    const s = one(mergeStarMaps(ex(), inc('Surveyed'), OPTS))
    expect(s.cities.map((c) => c.cityId).sort()).toEqual(['C1', 'C2', 'C3'])
    expect(s.cities.find((c) => c.cityId === 'C1')!.name).toBe('inc1')
    expect(s.spacecraft.map((c) => c.spacecraftId).sort()).toEqual(['S1', 'S2'])
    expect(s.spacecraft.find((c) => c.spacecraftId === 'S1')!.name).toBe('inc1')
  })
  it('union with winner record on duplicates (existing wins)', () => {
    const s = one(mergeStarMaps(ex(), inc('Unexplored'), OPTS))
    expect(s.cities.map((c) => c.cityId).sort()).toEqual(['C1', 'C2', 'C3'])
    expect(s.cities.find((c) => c.cityId === 'C1')!.name).toBe('ex1')
    expect(s.spacecraft.find((c) => c.spacecraftId === 'S1')!.name).toBe('ex1')
  })
  it('replace uses only the winner lists', () => {
    const a = one(mergeStarMaps(ex(), inc('Surveyed'), { mergeLists: false }))
    expect(a.cities.map((c) => c.cityId)).toEqual(['C1', 'C3'])
    expect(a.spacecraft.map((c) => c.spacecraftId)).toEqual(['S1', 'S2'])
    expect(a.wormholes).toHaveLength(3)
    const b = one(mergeStarMaps(ex(), inc('Unexplored'), { mergeLists: false }))
    expect(b.cities.map((c) => c.cityId)).toEqual(['C1', 'C2'])
    expect(b.wormholes).toHaveLength(2)
  })
  it('dedupes wormholes by destination, explored wins', () => {
    const s = one(mergeStarMaps(ex(), inc('Unexplored'), OPTS))
    // W1 (existing unexplored loses to incoming explored), W2, coord-based pair collapses to explored
    expect(s.wormholes).toHaveLength(3)
    expect(s.wormholes.find((w) => w.destSystemId === 'W1')!.explored).toBe(true)
    expect(s.wormholes.find((w) => !w.destSystemId)!.explored).toBe(true)
  })
  it('same explored state: winner record is used', () => {
    const a = map([sys('A', 'Surveyed', { wormholes: [{ ...wh('W', true), polarity: 'positive' }] })])
    const b = map([sys('A', 'Surveyed', { wormholes: [{ ...wh('W', true), polarity: 'negative' }] })])
    expect(one(mergeStarMaps(a, b, OPTS)).wormholes).toEqual([{ ...wh('W', true), polarity: 'negative' }])
  })
})

describe('sectors and header', () => {
  const sec = (id: string, name: string) => ({ sectorId: id, name, galaxy: 'G', x: 0, y: 0, z: 0 })
  it('unions sectors, newer export wins on the same id', () => {
    const r = mergeStarMaps(
      map([], { sectors: [sec('1', 'old1'), sec('2', 'only-ex')] }),
      map([], { sectors: [sec('1', 'new1'), sec('3', 'only-inc')], createDate: NEW }),
      OPTS,
    )
    expect(r.map.sectors.map((s) => `${s.sectorId}:${s.name}`)).toEqual(['1:new1', '2:only-ex', '3:only-inc'])
  })
  it('existing newer than incoming keeps its sector record', () => {
    const r = mergeStarMaps(
      map([], { sectors: [sec('1', 'ex')], createDate: NEW }),
      map([], { sectors: [sec('1', 'inc')], createDate: OLD }),
      OPTS,
    )
    expect(r.map.sectors[0]!.name).toBe('ex')
  })
  it('takes header fields from incoming', () => {
    const r = mergeStarMaps(
      map([]),
      map([], { empire: 'New Empire', empireId: '9', createDate: NEW, galaxyName: 'G2' }),
      OPTS,
    )
    expect(r.map).toMatchObject({ empire: 'New Empire', empireId: '9', createDate: NEW, galaxyName: 'G2', schemaVersion: SCHEMA_VERSION })
  })
})

describe('immutability', () => {
  it('does not mutate inputs', () => {
    const a = map([sys('A', 'Unexplored', { cities: [city('C1')] }), sys('B', 'Surveyed')])
    const b = map([sys('A', 'Surveyed', { cities: [city('C2')] }), sys('Z', 'Explored')], { createDate: NEW })
    const sa = structuredClone(a)
    const sb = structuredClone(b)
    mergeStarMaps(a, b, OPTS)
    mergeStarMaps(a, b, { mergeLists: false })
    expect(a).toEqual(sa)
    expect(b).toEqual(sb)
  })
})

describe('store round trip', () => {
  beforeEach(async () => {
    await clearMap()
  })
  it('keeps sourceDate through IndexedDB', async () => {
    const r = mergeStarMaps(map([sys('A', 'Surveyed')]), map([sys('B', 'Surveyed')], { createDate: NEW }), OPTS)
    await saveMap(r.map)
    const loaded = await loadMap()
    expect(loaded).toEqual(r.map)
    expect(loaded!.systems.map((s) => s.sourceDate)).toEqual([OLD, NEW])
  })
})

describe('mock fixture merge', () => {
  const mock = parseStarMap(readFileSync(path.resolve(import.meta.dirname, '../../fixtures/mock-starmap.xml'), 'utf8'))
  const mockDate = mock.createDate

  it('merging with itself keeps counts and is idempotent in content', () => {
    const r = mergeStarMaps(mock, mock, OPTS)
    expect(r.map.systems).toHaveLength(mock.systems.length)
    expect(r.stats).toEqual({ added: 0, updated: mock.systems.length, kept: 0 })
    expect(r.map.sectors.map(({ sourceDate: _d, ...x }) => x)).toEqual(mock.sectors)
    for (const [i, s] of r.map.systems.entries()) {
      expect(s.cities).toEqual(mock.systems[i]!.cities)
      expect(s.wormholes).toEqual(mock.systems[i]!.wormholes)
    }
  })

  it('merges a downgraded, newer, other-empire copy', () => {
    const copy = structuredClone(mock)
    copy.createDate = 'Sun Jan 03 03:04:05 2100 GMT'
    copy.empire = 'Other Empire'
    copy.empireId = '99'
    const surveyed = copy.systems.filter((s) => s.eod === 'Surveyed').slice(0, 5)
    expect(surveyed.length).toBe(5)
    for (const s of surveyed) s.eod = 'Unexplored'
    const target = copy.systems.find((s) => s.eod !== 'Unexplored' && !surveyed.includes(s))!
    target.cities = [...target.cities, city('CTY-OTHER', 'Other city')]
    const extra = sys('SYS-NEW', 'Explored')
    copy.systems.push(extra)

    const r = mergeStarMaps(mock, copy, OPTS)
    expect(r.map.empire).toBe('Other Empire')
    expect(r.map.systems).toHaveLength(mock.systems.length + 1)
    for (const s of surveyed) expect(one(r, s.systemId).eod).toBe('Surveyed')
    expect(r.stats.added).toBe(1)
    expect(r.stats.kept).toBe(5)
    expect(r.stats.updated).toBe(mock.systems.length - 5)
    const merged = one(r, target.systemId)
    expect(merged.cities.some((c) => c.cityId === 'CTY-OTHER')).toBe(true)
    const orig = mock.systems.find((s) => s.systemId === target.systemId)!
    expect(merged.cities.length).toBe(orig.cities.length + 1)
    expect(merged.sourceDate).toBe(copy.createDate)
    expect(one(r, surveyed[0]!.systemId).sourceDate).toBe(mockDate)

    const replaced = mergeStarMaps(mock, copy, { mergeLists: false })
    expect(one(replaced, target.systemId).cities).toEqual(target.cities)
  })
})

describe('wormhole dedupe across explored/unexplored', () => {
  const A = (w: Wormhole[], d = OLD) => map([sys('A', 'Explored', { wormholes: w })], { createDate: d })
  const unexplored = wh(undefined, false, 5, 6, 7)
  const explored = wh('SYS9', true, 5, 6, 7)
  it.each([
    ['unexplored existing, explored incoming', A([unexplored]), A([explored], NEW)],
    ['explored existing, unexplored incoming', A([explored]), A([unexplored], NEW)],
    ['explored existing (newer), unexplored incoming', A([explored], NEW), A([unexplored])],
    ['unexplored existing (newer), explored incoming', A([unexplored], NEW), A([explored])],
  ])('%s -> one explored wormhole', (_n, ex, inc) => {
    const w = one(mergeStarMaps(ex, inc, OPTS)).wormholes
    expect(w).toHaveLength(1)
    expect(w[0]!.explored).toBe(true)
  })
  it('keeps distinct destinations distinct', () => {
    const w = one(mergeStarMaps(A([wh(undefined, false, 5, 6, 7)]), A([wh('SYS8', true, 9, 9, 9)], NEW), OPTS)).wormholes
    expect(w).toHaveLength(2)
  })
})

describe('per-sector source dates', () => {
  const sec = (name: string) => ({ sectorId: '1', name, galaxy: 'G', x: 0, y: 0, z: 0 })
  const m = (name: string, d: string) => map([], { sectors: [sec(name)], createDate: d })
  it('A(Nov20) -> B(Nov10) -> C(Nov15): A sector survives C', () => {
    const a = m('A', 'Thu Nov 20 10:00:00 2026 GMT')
    const b = m('B', 'Tue Nov 10 10:00:00 2026 GMT')
    const c = m('C', 'Sun Nov 15 10:00:00 2026 GMT')
    const ab = mergeStarMaps(a, b, OPTS).map
    expect(ab.sectors[0]!.name).toBe('A')
    const abc = mergeStarMaps(ab, c, OPTS).map
    expect(abc.sectors[0]!.name).toBe('A')
    expect(abc.sectors[0]!.sourceDate).toBe(a.createDate)
  })
})
