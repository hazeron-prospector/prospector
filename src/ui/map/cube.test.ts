import { expect, it } from 'vitest'
import { cubeEdges } from './cube'

it('emits 12 axis-aligned edges on the box corners', () => {
  const e = cubeEdges([0, 0, 0], [10, 10, 10])
  expect(e).toHaveLength(72)
  for (let i = 0; i < 72; i += 6) {
    const d = [0, 1, 2].map((k) => Math.abs(e[i + k]! - e[i + 3 + k]!))
    expect(d.filter((v) => v === 10)).toHaveLength(1)
    expect(d.filter((v) => v === 0)).toHaveLength(2)
  }
})
