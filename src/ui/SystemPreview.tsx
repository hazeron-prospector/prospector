import { useId, useMemo } from 'react'
import { layoutOrrery, ORRERY_VIEWBOX } from '@/data/orrery'
import { starColor } from '@/data/mapdata'
import { qualityHsl } from '@/data/color'
import type { System } from '@/data/types'
import { identityName, type RenderName } from './renderName'

interface Props {
  system: System
  size: 'compact' | 'large'
  /** Bodies (or stars) to ring, e.g. those matching the resource filter. */
  highlightedBodyIds?: ReadonlySet<string>
  /** Best matching quality per highlighted body; colors the ring. */
  bodyQuality?: ReadonlyMap<string, number>
  /** Body drawn with a white emphasis ring (body peek). */
  emphasizedBodyId?: string
  onBodyClick?: (bodyId: string) => void
  renderName?: RenderName
}

const rgb = (c: [number, number, number]) => `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`
const HAB = '#4ade80'

/** Top-down 2D orbit preview of a system (BLUEPRINT W11). No three.js. */
export function SystemPreview({
  system,
  size,
  highlightedBodyIds,
  bodyQuality,
  emphasizedBodyId,
  onBodyClick,
  renderName = identityName,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const orrery = useMemo(() => layoutOrrery(system, highlightedBodyIds), [system, highlightedBodyIds])
  const ringColor = (id: string) => {
    const q = bodyQuality?.get(id)
    if (q === undefined) return '#22d3ee'
    const { hue, light } = qualityHsl(q)
    return `hsl(${hue.toFixed(0)} 75% ${light.toFixed(0)}%)`
  }
  const click = (id: string) => (onBodyClick ? () => onBodyClick(id) : undefined)
  const interactive = onBodyClick ? 'cursor-pointer' : undefined

  return (
    <svg
      viewBox={ORRERY_VIEWBOX}
      role="img"
      aria-label="Orbit preview"
      className={size === 'large' ? 'mx-auto block aspect-square w-full max-w-[34rem]' : 'block aspect-square w-full'}
    >
      <defs>
        {orrery.stars.map((s) => (
          <radialGradient key={s.id} id={`${uid}-g-${s.id}`}>
            <stop offset="0%" stopColor={rgb(starColor(s.type))} stopOpacity="0.9" />
            <stop offset="35%" stopColor={rgb(starColor(s.type))} stopOpacity="0.35" />
            <stop offset="100%" stopColor={rgb(starColor(s.type))} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <rect x="-100" y="-100" width="200" height="200" className="fill-background/40" />
      {orrery.orbits.map((o, i) => (
        <circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.35" className="text-foreground" />
      ))}
      {orrery.stars.map((s) => (
        <g key={s.id} className={interactive} onClick={click(s.id)}>
          <title>{renderName(s.name)}</title>
          <circle cx={s.x} cy={s.y} r={s.r * 2.6} fill={`url(#${uid}-g-${s.id})`} />
          <circle cx={s.x} cy={s.y} r={s.r} fill={rgb(starColor(s.type))} />
          {(s.highlighted || s.id === emphasizedBodyId) && (
            <circle cx={s.x} cy={s.y} r={s.r + 2.2} fill="none" stroke={s.id === emphasizedBodyId ? '#fff' : ringColor(s.id)} strokeWidth="1.2" />
          )}
        </g>
      ))}
      {orrery.bodies.map((b) => (
        <g key={b.id} className={interactive} onClick={click(b.id)}>
          <title>{renderName(b.name)}</title>
          {/* Larger invisible target so tiny moons are clickable. */}
          <circle cx={b.x} cy={b.y} r={Math.max(b.r + 1.5, 3.5)} fill="transparent" />
          <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} />
          {b.habitable && <circle cx={b.x} cy={b.y} r={b.r + 1} fill="none" stroke={HAB} strokeWidth="0.8" strokeDasharray="1.4 1" />}
          {b.highlighted && <circle cx={b.x} cy={b.y} r={b.r + 2.6} fill="none" stroke={ringColor(b.id)} strokeWidth="1.2" />}
          {b.id === emphasizedBodyId && <circle cx={b.x} cy={b.y} r={b.r + 4.2} fill="none" stroke="#fff" strokeWidth="1" />}
        </g>
      ))}
    </svg>
  )
}
