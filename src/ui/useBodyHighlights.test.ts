import { describe, expect, it } from 'vitest'
import type { ResourceRow } from '@/data/rows'
import { bodyHighlights } from './useBodyHighlights'

const row = (systemId: string, bodyId: string, bestQuality: number) => ({ systemId, bodyId, bestQuality }) as ResourceRow

describe('bodyHighlights', () => {
  const rows = [row('a', 'p1', 50), row('a', 'p1', 90), row('a', 'p2', 10), row('b', 'p3', 200)]
  it('keeps the best quality per body of one system', () => {
    expect([...bodyHighlights(rows, 'a', true)]).toEqual([['p1', 90], ['p2', 10]])
  })
  it('is empty when no filter is active', () => {
    expect(bodyHighlights(rows, 'a', false).size).toBe(0)
  })
})
