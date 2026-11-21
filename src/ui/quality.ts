import type { CSSProperties } from 'react'

/** Color scale for resource quality 1-255: dim red -> amber -> green -> cyan. Readable on dark. */
export function qualityStyle(q: number): CSSProperties {
  const t = Math.min(1, Math.max(0, (q - 1) / 254))
  const hue = t < 0.5 ? t * 2 * 45 : 45 + (t - 0.5) * 2 * 125 // 0 red, 45 amber, 170 cyan-green
  const light = 52 + t * 18
  return {
    color: `hsl(${hue.toFixed(0)} 75% ${light.toFixed(0)}%)`,
    backgroundColor: `hsl(${hue.toFixed(0)} 75% 50% / ${(0.08 + t * 0.1).toFixed(2)})`,
  }
}
