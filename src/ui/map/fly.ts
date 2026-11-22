/** Pure camera math: ease, fly interpolation and framing distances (no three.js). */
import type { Vec3 } from '@/data/mapdata'

export const FLY_DURATION_MS = 600

export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export interface CameraPose {
  position: Vec3
  target: Vec3
}

/** Pose `elapsedMs` into a fly from `from` to `to` (eased). Reaches `to` exactly at the end. */
export function flyPose(from: CameraPose, to: CameraPose, elapsedMs: number, durationMs = FLY_DURATION_MS): CameraPose {
  const t = durationMs <= 0 ? 1 : easeInOutCubic(elapsedMs / durationMs)
  return { position: lerp3(from.position, to.position, t), target: lerp3(from.target, to.target, t) }
}

/**
 * Where to fly to look at `systemPos`: same viewing direction as now, at a distance that is the
 * current one, capped to a close-up distance (so a far-out camera zooms in, a near one stays).
 */
export function flyDestination(current: CameraPose, systemPos: Vec3, boundsRadius: number): CameraPose {
  const dx = current.position[0] - current.target[0]
  const dy = current.position[1] - current.target[1]
  const dz = current.position[2] - current.target[2]
  const dist = Math.hypot(dx, dy, dz)
  const close = Math.max(15, boundsRadius * 0.2)
  const want = Math.min(dist > 1e-6 ? dist : close, close)
  const [ux, uy, uz]: Vec3 = dist > 1e-6 ? [dx / dist, dy / dist, dz / dist] : [0, 0.4, 1]
  const len = Math.hypot(ux, uy, uz)
  return {
    target: systemPos,
    position: [systemPos[0] + (ux / len) * want, systemPos[1] + (uy / len) * want, systemPos[2] + (uz / len) * want],
  }
}

/** Distance from the center at which a sphere of `radius` fits the view (vertical fov in degrees). */
export function frameDistance(radius: number, fovDeg: number, aspect: number): number {
  const v = (fovDeg * Math.PI) / 180
  const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(aspect, 0.01))
  const half = Math.min(v, h) / 2
  return (radius / Math.sin(half)) * 1.05
}
