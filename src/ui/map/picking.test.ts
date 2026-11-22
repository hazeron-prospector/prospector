import { describe, expect, it } from 'vitest'
import { pickNearest, pointPixelSize, projectPoint, projectPoints } from './picking'

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

describe('pointPixelSize', () => {
  it('matches the shader formula: attenuated, clamped', () => {
    expect(pointPixelSize(6, 100, 100, 2)).toBeCloseTo(12) // att 1, devicePixelRatio 2
    expect(pointPixelSize(6, 1, 100, 1)).toBeCloseTo(12) // att capped at 2
    expect(pointPixelSize(6, 1e6, 100, 1)).toBeCloseTo(3) // att floored at 0.5
    expect(pointPixelSize(1000, 100, 100, 1)).toBe(96)
  })
})

describe('pickNearest on-screen size and highlight preference', () => {
  const pos = new Float32Array([-0.5, 0, 0, -0.4, 0, 0])
  const proj = projectPoints(pos, I, 200, 100) // x = 50 and 60, depth 1
  it('derives the hit bonus from the drawn size (pixel ratio and attenuation)', () => {
    // size 10 at ratio 2, att 1: drawn 20 device px = 10 css px, bonus 5 -> reach 5 + 5 = 10
    const screen = { refDist: 1, pixelRatio: 2 }
    expect(pickNearest(proj, 40, 50, 5, [10, 1], { screen })).toBe(0) // d=10 <= 10
    expect(pickNearest(proj, 39, 50, 5, [10, 1], { screen })).toBe(-1) // d=11
    // far away: attenuation floors at 0.5, so bonus shrinks to 2.5 css px
    expect(pickNearest(proj, 40, 50, 5, [10, 1], { screen: { refDist: 1e-6, pixelRatio: 2 } })).toBe(-1)
  })
  it('prefers highlighted points within the threshold over a nearer dim one', () => {
    // click at x=58: dim point 1 (x=60) is nearer than highlighted point 0 (x=50), both within radius 10
    expect(pickNearest(proj, 58, 50, 10, [3, 3])).toBe(1)
    expect(pickNearest(proj, 58, 50, 10, [3, 3], { prefer: [1, 0] })).toBe(0)
    // a highlighted point out of range does not win
    expect(pickNearest(proj, 58, 50, 5, [3, 3], { prefer: [1, 0] })).toBe(1)
  })
})
