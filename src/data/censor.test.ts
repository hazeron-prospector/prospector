import { describe, expect, it } from 'vitest'
import { censorText, isCensored, makeLabelFormat, scramble, splitOrbit } from './censor'

describe('scramble', () => {
  it('keeps length and non-alphanumeric positions', () => {
    const t = 'Alpha-Centauri 3, B/2'
    const s = scramble(t)
    expect(s).toHaveLength(t.length)
    for (let i = 0; i < t.length; i++) {
      if (/[A-Za-z0-9]/.test(t[i]!)) expect(s[i]).not.toBe(t[i])
      else expect(s[i]).toBe(t[i])
      if (/[A-Z]/.test(t[i]!)) expect(s[i]).toMatch(/[A-Z]/)
      if (/[a-z]/.test(t[i]!)) expect(s[i]).toMatch(/[a-z]/)
      if (/[0-9]/.test(t[i]!)) expect(s[i]).toMatch(/[0-9]/)
    }
  })
  it('is deterministic, salt-dependent and never equal for real text', () => {
    expect(scramble('Sol')).toBe(scramble('Sol'))
    expect(scramble('Sol', 'a')).not.toBe(scramble('Sol', 'b'))
    for (const t of ['a', 'Sol', '1', '-12, 40, 7', 'Eridani', 'X']) expect(scramble(t)).not.toBe(t)
    expect(scramble('')).toBe('')
    expect(scramble(' - ')).toBe(' - ')
  })
  it('scrambles accented and Cyrillic letters, same code-point length, never equal', () => {
    for (const t of ['Ünï', 'Éridani Ünü 7', 'Москва', 'Альфа-Центавр 3', 'Ωmega ²']) {
      const s = scramble(t)
      const a = [...t]
      const b = [...s]
      expect(b).toHaveLength(a.length)
      expect(s).not.toBe(t)
      a.forEach((ch, i) => {
        if (/\p{L}/u.test(ch)) expect(b[i]).toMatch(/^[A-Za-z]$/)
        else if (/\p{N}/u.test(ch)) expect(b[i]).toMatch(/^[0-9]$/)
        else expect(b[i]).toBe(ch)
      })
    }
    expect(scramble('Москва')).toMatch(/^[A-Z][a-z]{5}$/)
  })
})

describe('censorText', () => {
  const flags = { systemNames: true, systemCoords: false, sectors: false }
  it('applies per kind', () => {
    expect(isCensored(flags, 'system')).toBe(true)
    expect(censorText(flags, 'system', 'Sol')).not.toBe('Sol')
    expect(censorText(flags, 'coords', '1, 2, 3')).toBe('1, 2, 3')
    expect(censorText(flags, 'sector', 'Core')).toBe('Core')
  })
})

describe('makeLabelFormat', () => {
  it('routes system and sector kinds to their toggles', () => {
    const f = makeLabelFormat({ systemNames: false, systemCoords: false, sectors: true })
    expect(f('Sol', 'system')).toEqual({ text: 'Sol' })
    const s = f('Core', 'sector')
    expect(s.text).not.toBe('Core')
    expect(s.text).toHaveLength(4)
    expect(s.className).toContain('blur-[4px]')
  })
})

describe('splitOrbit', () => {
  it('isolates the orbited name', () => {
    expect(splitOrbit("Orbiting EDL'TC Alpha at 2au 129°", "EDL'TC Alpha")).toEqual(['Orbiting ', "EDL'TC Alpha", ' at 2au 129°'])
    expect(splitOrbit('Primary', undefined)).toBeUndefined()
    expect(splitOrbit('Primary', 'X')).toBeUndefined()
  })
})
