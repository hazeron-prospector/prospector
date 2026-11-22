import { describe, expect, it } from 'vitest'
import { parseStarMap } from './parse'
import { MINI_XML } from './__fixtures__/mini'
import { buildSearchIndex, fuzzyMatch, search, substringMatch } from './search'
import type { SearchEntry, SearchIndex } from './search'

const map = parseStarMap(MINI_XML)

function syntheticIndex(labels: string[]): SearchIndex {
  const entries: SearchEntry[] = labels.map((label, i) => ({
    kind: 'resource',
    id: `r${i}`,
    label,
    lower: label.toLowerCase(),
    depositCount: 1,
    bestQuality: 1,
  }))
  return { entries }
}

describe('fuzzyMatch', () => {
  it('ranks exact > prefix > word start > subsequence', () => {
    const exact = fuzzyMatch('Ore', 'ore')!
    const prefix = fuzzyMatch('Ore Deposit', 'ore')!
    const word = fuzzyMatch('Gold Ore', 'ore')!
    const sub = fuzzyMatch('Orange Rotten Emerald', 'ore')!
    const inner = fuzzyMatch('Fore', 'ore')!
    expect(exact.score).toBeGreaterThan(prefix.score)
    expect(prefix.score).toBeGreaterThan(word.score)
    expect(word.score).toBeGreaterThan(inner.score)
    expect(inner.score).toBeGreaterThan(sub.score)
  })

  it('is case-insensitive and returns matched indices', () => {
    expect(fuzzyMatch('Gold Ore', 'ORE')!.indices).toEqual([5, 6, 7])
    expect(fuzzyMatch('Crude Oil', 'cdl')!.indices).toEqual([0, 3, 8])
  })

  it('returns undefined when not a subsequence or query empty', () => {
    expect(fuzzyMatch('Ore', 'xyz')).toBeUndefined()
    expect(fuzzyMatch('Ore', 'oro')).toBeUndefined()
    expect(fuzzyMatch('Ore', '')).toBeUndefined()
  })

  it('treats apostrophes and spaces as word boundaries', () => {
    const m = fuzzyMatch("XQL'A'B'a", 'b')!
    expect(m.indices).toEqual([6])
    expect(m.score).toBeGreaterThan(fuzzyMatch('Xabc', 'b')!.score)
  })
})

describe('substringMatch', () => {
  it('finds a case-insensitive range', () => {
    expect(substringMatch('Aldera Alpha', 'ALP')).toEqual([7, 10])
  })
  it('returns undefined on miss or empty', () => {
    expect(substringMatch('Aldera', 'zz')).toBeUndefined()
    expect(substringMatch('Aldera', '')).toBeUndefined()
  })
})

describe('buildSearchIndex', () => {
  const index = buildSearchIndex(map)
  const kinds = (k: string) => index.entries.filter((e) => e.kind === k)

  it('has systems, bodies (planets and stars), resources, sectors', () => {
    // unnamed Deep Space systems are left out of the index
    expect(kinds('system').length).toBe(map.systems.filter((s) => s.name !== 'Deep Space').length)
    const bodies = kinds('body')
    expect(bodies.length).toBe(map.systems.reduce((n, s) => n + s.planets.length + s.stars.length, 0))
    expect(bodies.every((b) => b.kind === 'body' && b.systemName.length > 0)).toBe(true)
    expect(kinds('sector').map((s) => s.label)).toContain('Alpha Sector')
  })

  it('has distinct resources with deposit counts', () => {
    const ore = kinds('resource').find((r) => r.label === 'Ore')
    expect(ore?.kind === 'resource' && ore.depositCount).toBe(3)
    const names = kinds('resource').map((r) => r.label)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('search', () => {
  const index = buildSearchIndex(map)

  it('returns no groups for an empty query', () => {
    expect(search(index, '')).toEqual([])
    expect(search(index, '   ')).toEqual([])
  })

  it('finds a system by catalog name and flags the match', () => {
    const groups = search(index, "XQL'A'B")
    const hit = groups.find((g) => g.kind === 'system')!.hits[0]!
    expect(hit.entry.kind === 'system' && hit.entry.id).toBe('SYSA')
    expect(hit.matchedVia).toBe('catalog')
    expect(hit.indices.length).toBeGreaterThan(0)
  })

  it('finds by display name via name', () => {
    const hit = search(index, 'alder').find((g) => g.kind === 'system')!.hits[0]!
    expect(hit.matchedVia).toBe('name')
    expect(hit.indices).toEqual([0, 1, 2, 3, 4])
  })

  it('ranks within a group exact > prefix > word start > subsequence', () => {
    const idx = syntheticIndex(['Orange Rotten Emerald', 'Gold Ore', 'Ore Deposit', 'Ore'])
    const labels = search(idx, 'ore')[0]!.hits.map((h) => h.entry.label)
    expect(labels).toEqual(['Ore', 'Ore Deposit', 'Gold Ore', 'Orange Rotten Emerald'])
  })

  it('caps per group but reports the total', () => {
    const idx = syntheticIndex(Array.from({ length: 20 }, (_, i) => `Ore ${i}`))
    const g = search(idx, 'ore', { perGroupCap: 5 })[0]!
    expect(g.hits).toHaveLength(5)
    expect(g.total).toBe(20)
  })

  it('orders groups system, body, resource, sector and omits empty ones', () => {
    const kinds = search(index, 'a').map((g) => g.kind)
    expect(kinds).toEqual([...kinds].sort((a, b) => ['system', 'body', 'resource', 'sector'].indexOf(a) - ['system', 'body', 'resource', 'sector'].indexOf(b)))
    expect(search(index, 'qqqzzz')).toEqual([])
  })
})
