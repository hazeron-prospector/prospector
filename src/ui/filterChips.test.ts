import { describe, expect, it } from 'vitest'
import { DEFAULT_RESOURCE_FILTER } from '@/data/filter'
import type { ResourceRow } from '@/data/rows'
import { activeChips, countSystems, resultCountText, suggestLoosen, type ChipState } from './filterChips'

const row = (o: Partial<ResourceRow>): ResourceRow =>
  ({
    id: Math.random().toString(),
    resource: 'Iron',
    bestQuality: 100,
    systemId: 's1',
    systemName: 'Sol',
    sectorName: 'A',
    bodyId: 'b1',
    bodyName: 'Earth',
    bodyType: 'Rocky',
    sphere: 'geosphere',
    categories: ['Prospector'],
    inhabited: false,
    inhabitingEmpires: [],
    ...o,
  }) as ResourceRow

const state = (f: Partial<typeof DEFAULT_RESOURCE_FILTER>, quick = ''): ChipState => ({ filter: { ...DEFAULT_RESOURCE_FILTER, ...f }, quick })

describe('resultCountText', () => {
  it('uses separators and singular forms', () => {
    expect(resultCountText(1204, 87)).toBe('1,204 deposits in 87 systems')
    expect(resultCountText(1, 1)).toBe('1 deposit in 1 system')
    expect(resultCountText(0, 0)).toBe('0 deposits in 0 systems')
    expect(resultCountText(5000, 1200, true)).toBe('1,200 systems')
    expect(resultCountText(1, 1, true)).toBe('1 system')
  })
  it('counts distinct systems', () => {
    expect(countSystems([{ systemId: 'a' }, { systemId: 'a' }, { systemId: 'b' }])).toBe(2)
  })
})

describe('activeChips', () => {
  it('is empty by default and one chip per value otherwise', () => {
    expect(activeChips(state({}))).toEqual([])
    const chips = activeChips(state({ resources: ['Iron', 'Gold'], minBestQuality: 200, inhabited: 'only' }, 'sol'))
    expect(chips.map((c) => c.label)).toEqual(['Iron', 'Gold', 'Min Q ≥ 200', 'Inhabited only', 'Search: "sol"'])
    expect(chips[0]!.resource).toBe('Iron')
  })
  it('adds a Ringworld chip that removes itself', () => {
    const s = state({ ringworld: 'only' })
    const chips = activeChips(s)
    expect(chips.map((c) => c.label)).toEqual(['Ringworld only'])
    expect(chips[0]!.remove(s).filter.ringworld).toBe('any')
  })
  it('removes just that chip', () => {
    const s = state({ resources: ['Iron', 'Gold'], minBestQuality: 200 })
    const chips = activeChips(s)
    expect(chips[0]!.remove(s).filter.resources).toEqual(['Gold'])
    expect(chips.find((c) => c.key === 'minBestQuality')!.remove(s).filter.minBestQuality).toBeUndefined()
  })
})

describe('suggestLoosen', () => {
  const rows = [row({ bestQuality: 50 }), row({ bestQuality: 60 }), row({ resource: 'Gold', bestQuality: 300, bodyType: 'Gas Giant' })]
  it('names the single filter whose removal frees the most rows', () => {
    const s = state({ resources: ['Iron'], minBestQuality: 200 })
    // Removing Min Q frees 2 Iron rows; removing Resource frees 1 Gold row.
    expect(suggestLoosen(rows, s)).toEqual({ label: 'Min Q ≥ 200', count: 2 })
  })
  it('can suggest dropping the ringworld filter', () => {
    const s = state({ ringworld: 'only' })
    expect(suggestLoosen(rows, s)).toEqual({ label: 'Ringworld only', count: 3 })
  })
  it('accounts for the quick filter', () => {
    const s = state({ minBestQuality: 200 }, 'zzz')
    expect(suggestLoosen(rows, s)).toEqual({ label: 'Search "zzz"', count: 1 })
  })
  it('is undefined when no single removal helps or nothing is active', () => {
    expect(suggestLoosen(rows, state({}))).toBeUndefined()
    expect(suggestLoosen(rows, state({ resources: ['Iron'], bodyTypes: ['Gas Giant'] }, 'x'))).toBeUndefined()
  })
})
