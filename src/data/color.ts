/** Shared quality color scale (table cells and the 3D map). Pure; no DOM or three.js. */

export interface QualityHsl {
  /** 0..360, unrounded. */
  hue: number
  /** Lightness percent, unrounded. */
  light: number
  /** Saturation percent (constant). */
  sat: number
  /** Normalized quality 0..1. */
  t: number
}

/** Quality 1-255: dim red -> amber -> green -> cyan. Readable on dark. */
export function qualityHsl(q: number): QualityHsl {
  const t = Math.min(1, Math.max(0, (q - 1) / 254))
  const hue = t < 0.5 ? t * 2 * 45 : 45 + (t - 0.5) * 2 * 125 // 0 red, 45 amber, 170 cyan-green
  return { hue, light: 52 + t * 18, sat: 75, t }
}

/** hsl (h degrees, s and l percent) to rgb in 0..1. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100
  const ln = l / 100
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number): number => {
    const k = (n + h / 30) % 12
    return ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

/** Same hue/lightness as the table text color, as rgb 0..1 (for typed color buffers). */
export function qualityRgb(q: number): [number, number, number] {
  const { hue, sat, light } = qualityHsl(q)
  return hslToRgb(hue, sat, light)
}
