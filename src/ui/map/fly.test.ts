import { describe, expect, it } from 'vitest'
import { centerPose, easeInOutCubic, flyDestination, flyPose, frameDistance, lerp3, decideCameraAction } from './fly'

describe('fly', () => {
  it('eases 0..1 symmetrically and clamps', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easeInOutCubic(-3)).toBe(0)
    expect(easeInOutCubic(9)).toBe(1)
  })
  it('interpolates and ends exactly at the destination', () => {
    expect(lerp3([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15])
    const from = { position: [0, 0, 100] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
    const to = { position: [5, 5, 5] as [number, number, number], target: [5, 5, 0] as [number, number, number] }
    expect(flyPose(from, to, 0)).toEqual(from)
    expect(flyPose(from, to, 600)).toEqual(to)
    expect(flyPose(from, to, 9999)).toEqual(to)
  })
  it('flies to a close-up keeping the view direction', () => {
    const cur = { position: [0, 0, 500] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
    const d = flyDestination(cur, [10, 20, 30], 100)
    expect(d.target).toEqual([10, 20, 30])
    expect(d.position[0]).toBeCloseTo(10)
    expect(d.position[1]).toBeCloseTo(20)
    expect(d.position[2]).toBeCloseTo(30 + 20) // close = max(15, 100*0.2)
  })
  it('does not zoom out when already closer', () => {
    const cur = { position: [0, 0, 5] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
    expect(flyDestination(cur, [0, 0, 0], 1000).position[2]).toBeCloseTo(5)
  })
  it('frames a sphere', () => {
    const d = frameDistance(10, 50, 1.5)
    expect(d).toBeGreaterThan(10)
    expect(frameDistance(10, 50, 0.5)).toBeGreaterThan(d) // narrow viewport needs more distance
  })
})

describe('centerPose', () => {
  it('moves camera and target by the same offset, keeping distance', () => {
    const cur = { position: [10, 20, 30] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
    const out = centerPose(cur, [5, -5, 2])
    expect(out.target).toEqual([5, -5, 2])
    expect(out.position).toEqual([15, 15, 32])
    const d = (p: typeof cur) => Math.hypot(p.position[0] - p.target[0], p.position[1] - p.target[1], p.position[2] - p.target[2])
    expect(d(out)).toBeCloseTo(d(cur))
  })
})

describe('decideCameraAction', () => {
  it('flies on a new nonce even when the selection changes too', () => {
    expect(decideCameraAction({ prevSelected: 'a', selected: 'b', prevNonce: undefined, nonce: 1 })).toBe('fly')
    expect(decideCameraAction({ prevSelected: 'b', selected: 'b', prevNonce: 1, nonce: 2 })).toBe('fly')
  })
  it('re-centers on a plain selection change', () => {
    expect(decideCameraAction({ prevSelected: 'a', selected: 'b', prevNonce: 1, nonce: 1 })).toBe('center')
    expect(decideCameraAction({ prevSelected: undefined, selected: 'b', prevNonce: undefined, nonce: undefined })).toBe('center')
  })
  it('does nothing otherwise', () => {
    expect(decideCameraAction({ prevSelected: 'a', selected: undefined, prevNonce: 1, nonce: 1 })).toBe('none')
    expect(decideCameraAction({ prevSelected: 'a', selected: 'a', prevNonce: 1, nonce: 1 })).toBe('none')
  })
})
