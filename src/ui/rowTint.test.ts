import { describe, expect, it } from 'vitest'
import { INHABITED_TEXT } from './InhabitedCell'
import { BODY_HABITABLE_TEXT, SYSTEM_HABITABLE_TEXT, rowTint } from './rowTint'

describe('rowTint', () => {
  it('inhabited wins over everything', () => {
    expect(rowTint({ inhabited: true, bodyHabitable: true, systemHabitable: true })).toBe(INHABITED_TEXT)
  })
  it('body habitable beats system habitable', () => {
    expect(rowTint({ inhabited: false, bodyHabitable: true, systemHabitable: true })).toBe(BODY_HABITABLE_TEXT)
  })
  it('system habitable only gives dark green (also rollup rows)', () => {
    expect(rowTint({ inhabited: false, bodyHabitable: false, systemHabitable: true })).toBe(SYSTEM_HABITABLE_TEXT)
    expect(rowTint({ inhabited: false, systemHabitable: true })).toBe(SYSTEM_HABITABLE_TEXT)
  })
  it('no tint otherwise', () => {
    expect(rowTint({ inhabited: false, bodyHabitable: false, systemHabitable: false })).toBeUndefined()
  })
})
