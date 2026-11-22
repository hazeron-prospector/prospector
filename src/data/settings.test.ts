import { describe, expect, it } from 'vitest'
import { DEFAULT_PRIORITY, moveItem, SETTINGS_KEY, defaultSettings, loadSettings, saveSettings, validateSettings } from './settings'

const memory = (init?: string) => {
  const m = new Map<string, string>(init === undefined ? [] : [[SETTINGS_KEY, init]])
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}
const throwing = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('quota')
  },
}

describe('settings', () => {
  it('defaults when missing', () => {
    expect(loadSettings(memory())).toEqual(defaultSettings())
    expect(defaultSettings().priorityResources).toEqual(DEFAULT_PRIORITY)
  })
  it('round-trips', () => {
    const st = memory()
    const s = { censor: { systemNames: true, systemCoords: false, sectors: true }, priorityResources: ['Gold'] }
    expect(saveSettings(s, st)).toBe(true)
    expect(loadSettings(st)).toEqual(s)
  })
  it('falls back on invalid JSON and wrong shapes', () => {
    expect(loadSettings(memory('{nope'))).toEqual(defaultSettings())
    expect(validateSettings(42)).toEqual(defaultSettings())
    expect(validateSettings(null)).toEqual(defaultSettings())
  })
  it('validates per field', () => {
    const s = validateSettings({ censor: { systemNames: 'yes', sectors: true }, priorityResources: [1, 2] })
    expect(s.censor).toEqual({ systemNames: false, systemCoords: false, sectors: true })
    expect(s.priorityResources).toEqual(DEFAULT_PRIORITY)
  })
  it('dedupes and trims priority names, keeps an empty list', () => {
    expect(validateSettings({ priorityResources: [' Ore ', 'Ore', '', 'Oil'] }).priorityResources).toEqual(['Ore', 'Oil'])
    expect(validateSettings({ priorityResources: [] }).priorityResources).toEqual([])
  })
  it('survives throwing or absent storage', () => {
    expect(loadSettings(throwing)).toEqual(defaultSettings())
    expect(saveSettings(defaultSettings(), throwing)).toBe(false)
    expect(saveSettings(defaultSettings(), undefined)).toBe(false)
  })
})

describe('moveItem', () => {
  it('moves and clamps without mutating', () => {
    const a = ['a', 'b', 'c']
    expect(moveItem(a, 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(a, 0, -1)).toEqual(a)
    expect(moveItem(a, 2, 1)).toEqual(a)
    expect(a).toEqual(['a', 'b', 'c'])
  })
})
