import { CENSOR_CLASS, scramble, splitOrbit, type CensorKind } from '@/data/censor'
import { useCensor } from './state/useCensor'

/**
 * The one way names and coordinates are rendered (W9). When the matching censor toggle is on,
 * only a scrambled same-length placeholder is in the DOM (under a blur); the real text is not.
 */
export function Censored({ kind, children }: { kind: CensorKind; children: string }) {
  const { on } = useCensor()
  if (!on(kind)) return <>{children}</>
  return (
    <span role="img" aria-label="hidden" className={CENSOR_CLASS}>
      {scramble(children)}
    </span>
  )
}

/** Orbit description with the orbited body's name (a system-name kind) censored. */
export function OrbitText({ orbit }: { orbit: { raw: string; orbitingName?: string } }) {
  const parts = splitOrbit(orbit.raw, orbit.orbitingName)
  if (!parts) return <>{orbit.raw}</>
  return (
    <>
      {parts[0]}
      <Censored kind="system">{parts[1]}</Censored>
      {parts[2]}
    </>
  )
}
