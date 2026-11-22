import { describe, expect, it } from 'vitest'
import { INHABITED_TEXT } from './InhabitedCell'
import { BODY_HABITABLE_TEXT, RINGWORLD_ROW, SYSTEM_HABITABLE_TEXT, rowClass, rowTint, shimmerClass } from './rowTint'

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

describe('ringworld shimmer class', () => {
  it('layers over the text tint without replacing it', () => {
    expect(rowClass({ inhabited: true, systemHabitable: false, hasRingworld: true })).toBe(`${INHABITED_TEXT} ${RINGWORLD_ROW}`)
    expect(rowClass({ inhabited: false, systemHabitable: false, hasRingworld: true })).toBe(RINGWORLD_ROW)
    expect(rowClass({ inhabited: true, systemHabitable: false, hasRingworld: false })).toBe(INHABITED_TEXT)
    expect(rowClass({ inhabited: false, systemHabitable: false, hasRingworld: false })).toBeUndefined()
  })
  it('planets and systems get only the shimmer', () => {
    expect(shimmerClass({ hasRingworld: true })).toBe(RINGWORLD_ROW)
    expect(shimmerClass({ hasRingworld: false })).toBeUndefined()
  })
})
