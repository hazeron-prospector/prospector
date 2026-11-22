import { describe, expect, it } from 'vitest'
import { pickNearest, projectPoint, projectPoints } from './picking'

// Orthographic-like identity: clip = world, so ndc x,y in [-1,1].
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

describe('projection', () => {
  it('maps ndc to pixels with y flipped', () => {
    const p = projectPoint(I, 0, 0, 0, 200, 100)
    expect(p).toMatchObject({ x: 100, y: 50, visible: true })
    expect(projectPoint(I, -1, 1, 0, 200, 100)).toMatchObject({ x: 0, y: 0 })
  })
  it('hides points behind the camera or beyond depth range', () => {
    expect(projectPoint(I, 0, 0, 2, 100, 100).visible).toBe(false)
    const behind = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1]
    expect(projectPoint(behind, 0, 0, 0, 100, 100).visible).toBe(false)
  })
})

describe('pickNearest', () => {
  const pos = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 0.5])
  const proj = projectPoints(pos, I, 200, 100)
  it('picks the nearest point within the radius', () => {
    expect(pickNearest(proj, 52, 50, 10)).toBe(0) // x=50
    expect(pickNearest(proj, 148, 50, 10)).toBe(1) // x=150
  })
  it('returns -1 outside the radius', () => {
    expect(pickNearest(proj, 100, 50, 10)).toBe(-1)
  })
  it('breaks ties toward the nearer depth and respects sizes', () => {
    // points 1 and 2 project to the same pixel; with identity matrix depth is cw=1 for both: first wins
    expect(pickNearest(proj, 150, 50, 5)).toBe(1)
    const bigFar = pickNearest(proj, 60, 50, 5, [30, 1, 1]) // radius 5 + 15 covers distance 10
    expect(bigFar).toBe(0)
  })
  it('skips invisible points', () => {
    const p = projectPoints(new Float32Array([0, 0, 5]), I, 100, 100)
    expect(pickNearest(p, 50, 50, 20)).toBe(-1)
  })
})
