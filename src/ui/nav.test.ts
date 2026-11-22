import { describe, expect, it } from 'vitest'
import type { ResourceRow } from '@/data/rows'
import {
  buildHighlight,
  isPaletteShortcut,
  isSecondaryEnter,
  isTypingTarget,
  scrollTopFor,
  stepIndex,
  topResources,
} from './nav'

const row = (o: Partial<ResourceRow>): ResourceRow =>
  ({ id: 'x', resource: 'Ore', bestQuality: 10, systemId: 'S1', bodyId: 'B1', bodyName: 'B', sphere: 'geosphere', ...o }) as ResourceRow

describe('stepIndex', () => {
  it('clamps at the ends', () => {
    expect(stepIndex(5, 0, -1)).toBe(0)
    expect(stepIndex(5, 4, 1)).toBe(4)
    expect(stepIndex(5, 2, 1)).toBe(3)
    expect(stepIndex(5, 2, -1)).toBe(1)
  })
  it('starts at the first row without a selection and handles empty', () => {
    expect(stepIndex(5, -1, 1)).toBe(0)
    expect(stepIndex(5, -1, -1)).toBe(0)
    expect(stepIndex(0, -1, 1)).toBe(-1)
    expect(stepIndex(3, 9, 1)).toBe(0)
  })
})

describe('scrollTopFor', () => {
  // header 26, rows 24, viewport 126 -> 4 rows visible
  it('keeps scroll when visible', () => expect(scrollTopFor(1, 0, 126, 24, 26)).toBe(0))
  it('scrolls down to reveal the bottom row', () => expect(scrollTopFor(4, 0, 126, 24, 26)).toBe(26 + 5 * 24 - 126))
  it('scrolls up so the row sits under the header', () => expect(scrollTopFor(2, 200, 126, 24, 26)).toBe(48))
  it('never goes negative', () => expect(scrollTopFor(0, 10, 126, 24, 26)).toBe(0))
})

describe('keys', () => {
  it('detects typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'div', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
  it('palette shortcut', () => {
    expect(isPaletteShortcut({ key: 'k', ctrlKey: true, target: { tagName: 'INPUT' } })).toBe(true)
    expect(isPaletteShortcut({ key: 'K', metaKey: true })).toBe(true)
    expect(isPaletteShortcut({ key: '/', target: { tagName: 'DIV' } })).toBe(true)
    expect(isPaletteShortcut({ key: '/', target: { tagName: 'INPUT' } })).toBe(false)
    expect(isPaletteShortcut({ key: 'k' })).toBe(false)
    expect(isPaletteShortcut({ key: '/', ctrlKey: true })).toBe(false)
  })
  it('secondary enter', () => {
    expect(isSecondaryEnter({ key: 'Enter', ctrlKey: true })).toBe(true)
    expect(isSecondaryEnter({ key: 'Enter', shiftKey: true })).toBe(true)
    expect(isSecondaryEnter({ key: 'Enter' })).toBe(false)
    expect(isSecondaryEnter({ key: 'a', ctrlKey: true })).toBe(false)
  })
})

describe('topResources', () => {
  it('keeps the best deposit per resource, sorted by quality', () => {
    const t = topResources([
      row({ resource: 'Ore', bestQuality: 100, bodyName: 'A' }),
      row({ resource: 'Ore', bestQuality: 150, bodyName: 'B', sphere: 'hydrosphere' }),
      row({ resource: 'Ice', bestQuality: 120 }),
      row({ resource: 'Air', bestQuality: 120 }),
    ])
    expect(t.map((x) => x.name)).toEqual(['Ore', 'Air', 'Ice'])
    expect(t[0]).toMatchObject({ bestQuality: 150, bodyName: 'B', sphere: 'hydrosphere', count: 2 })
    expect(topResources([row({})], 0)).toEqual([])
  })
})

describe('buildHighlight', () => {
  it('is undefined with no selected resource', () => expect(buildHighlight([row({})], [])).toBeUndefined())
  it('maps system to max quality; empty map when nothing matches', () => {
    const m = buildHighlight([row({ bestQuality: 5 }), row({ bestQuality: 9 }), row({ systemId: 'S2', bestQuality: 3 })], ['Ore'])
    expect([...m!]).toEqual([['S1', 9], ['S2', 3]])
    expect(buildHighlight([], ['Ore'])!.size).toBe(0)
  })
  it('is active for a category alone', () => {
    expect(buildHighlight([row({})], [], ['Wildcatter'])!.get('S1')).toBe(10)
    expect(buildHighlight([row({})], [], [])).toBeUndefined()
  })
})
