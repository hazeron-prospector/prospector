import { describe, expect, it } from 'vitest'
import { groupByCategory, priorityGroup, resourceStats, toggleGroup } from './resourcePicker'

const row = (resource: string, bestQuality: number, categories: string[]) => ({ resource, bestQuality, categories })

describe('resourceStats', () => {
  it('counts deposits, tracks best quality and merges categories', () => {
    const s = resourceStats([row('Iron', 50, ['Prospector']), row('Iron', 120, ['Prospector', 'Wildcatter']), row('Gold', 10, ['Prospector'])])
    expect(s.find((x) => x.name === 'Iron')).toEqual({ name: 'Iron', count: 2, best: 120, categories: ['Prospector', 'Wildcatter'] })
    expect(s).toHaveLength(2)
  })
})

describe('groupByCategory', () => {
  it('orders by CATEGORIES, lists multi-bay resources in each group, omits empty groups', () => {
    const g = groupByCategory(
      resourceStats([row('Zinc', 1, ['Wildcatter']), row('Iron', 1, ['Prospector', 'Wildcatter']), row('Mystery', 1, ['Unknown']), row('Fern', 1, ['Surface Only'])]),
    )
    expect(g.map((x) => x.category)).toEqual(['Prospector', 'Wildcatter', 'Surface Only', 'Unknown'])
    expect(g[1]!.resources.map((r) => r.name)).toEqual(['Iron', 'Zinc'])
    expect(g[0]!.resources.map((r) => r.name)).toEqual(['Iron'])
  })
})

describe('toggleGroup', () => {
  it('adds missing then removes when all present', () => {
    expect(toggleGroup(['A'], ['A', 'B'])).toEqual(['A', 'B'])
    expect(toggleGroup(['A', 'B', 'C'], ['A', 'B'])).toEqual(['C'])
  })
})

describe('priorityGroup', () => {
  const stats = resourceStats([row('Iron', 5, ['Prospector']), row('Gold', 9, ['Prospector'])])
  it('keeps list order and skips absent resources', () => {
    expect(priorityGroup(stats, ['Gold', 'Nope', 'Iron'])?.resources.map((r) => r.name)).toEqual(['Gold', 'Iron'])
  })
  it('is undefined when nothing is present', () => {
    expect(priorityGroup(stats, ['Nope'])).toBeUndefined()
    expect(priorityGroup(stats, [])).toBeUndefined()
  })
})
