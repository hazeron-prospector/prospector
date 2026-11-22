/** Pure screen-space projection and nearest-point picking (no three.js; testable in node). */

/** Column-major 4x4 matrix (three.js `Matrix4.elements` layout). */
export type Mat4 = ArrayLike<number>

export interface ProjectedPoints {
  /** Pixel x/y from the top-left of the canvas. */
  x: Float32Array
  y: Float32Array
  /** Clip-space w (distance along the view axis for a perspective camera). */
  depth: Float32Array
  /** 1 when the point is in front of the camera and inside the depth range. */
  visible: Uint8Array
}

export interface ScreenPoint {
  x: number
  y: number
  depth: number
  visible: boolean
}

/** Project one world point with a view-projection matrix. */
export function projectPoint(
  m: Mat4,
  px: number,
  py: number,
  pz: number,
  width: number,
  height: number,
): ScreenPoint {
  const cx = m[0]! * px + m[4]! * py + m[8]! * pz + m[12]!
  const cy = m[1]! * px + m[5]! * py + m[9]! * pz + m[13]!
  const cz = m[2]! * px + m[6]! * py + m[10]! * pz + m[14]!
  const cw = m[3]! * px + m[7]! * py + m[11]! * pz + m[15]!
  if (cw <= 1e-9) return { x: 0, y: 0, depth: cw, visible: false }
  const nz = cz / cw
  return {
    x: (cx / cw * 0.5 + 0.5) * width,
    y: (1 - (cy / cw * 0.5 + 0.5)) * height,
    depth: cw,
    visible: nz >= -1 && nz <= 1,
  }
}

/** Project xyz-triples to pixels. Reuses `out` when it has the right capacity. */
export function projectPoints(
  positions: Float32Array,
  m: Mat4,
  width: number,
  height: number,
  out?: ProjectedPoints,
): ProjectedPoints {
  const n = positions.length / 3
  const o =
    out && out.x.length === n
      ? out
      : { x: new Float32Array(n), y: new Float32Array(n), depth: new Float32Array(n), visible: new Uint8Array(n) }
  for (let i = 0; i < n; i++) {
    const p = projectPoint(m, positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!, width, height)
    o.x[i] = p.x
    o.y[i] = p.y
    o.depth[i] = p.depth
    o.visible[i] = p.visible ? 1 : 0
  }
  return o
}

/**
 * Index of the visible point nearest to (px, py) within `radius` pixels, or -1.
 * `sizes` (pixel diameters) widen a point's hit area by half its size, so big points are easier
 * to hit; the best score is distance minus that bonus, ties go to the nearer point to the camera.
 */
export function pickNearest(
  proj: ProjectedPoints,
  px: number,
  py: number,
  radius: number,
  sizes?: ArrayLike<number>,
): number {
  let best = -1
  let bestScore = Infinity
  let bestDepth = Infinity
  const n = proj.x.length
  for (let i = 0; i < n; i++) {
    if (!proj.visible[i]) continue
    const d = Math.hypot(proj.x[i]! - px, proj.y[i]! - py)
    const bonus = sizes ? sizes[i]! * 0.5 : 0
    if (d > radius + bonus) continue
    const score = d - bonus
    const depth = proj.depth[i]!
    if (score < bestScore - 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && depth < bestDepth)) {
      best = i
      bestScore = score
      bestDepth = depth
    }
  }
  return best
}
