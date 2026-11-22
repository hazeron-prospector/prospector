import type { CSSProperties } from 'react'
import { qualityHsl } from '../data/color'

/** Color scale for resource quality 1-255: dim red -> amber -> green -> cyan. Readable on dark. */
export function qualityStyle(q: number): CSSProperties {
  const { hue, light, t } = qualityHsl(q)
  return {
    color: `hsl(${hue.toFixed(0)} 75% ${light.toFixed(0)}%)`,
    backgroundColor: `hsl(${hue.toFixed(0)} 75% 50% / ${(0.08 + t * 0.1).toFixed(2)})`,
  }
}
