import type { Vec3 } from '@/data/mapdata'

/** 12 edges (24 vertices, 72 floats) of an axis-aligned box. */
export function cubeEdges(min: Vec3, max: Vec3): number[] {
  const c = (x: 0 | 1, y: 0 | 1, z: 0 | 1): Vec3 => [x ? max[0] : min[0], y ? max[1] : min[1], z ? max[2] : min[2]]
  const pairs: [Vec3, Vec3][] = []
  for (const a of [0, 1] as const) {
    for (const b of [0, 1] as const) {
      pairs.push([c(0, a, b), c(1, a, b)], [c(a, 0, b), c(a, 1, b)], [c(a, b, 0), c(a, b, 1)])
    }
  }
  return pairs.flatMap(([p, q]) => [...p, ...q])
}
