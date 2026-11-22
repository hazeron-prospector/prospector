import { INHABITED_TEXT } from './InhabitedCell'

/** Light green: the row's body is a habitable world (W20). */
export const BODY_HABITABLE_TEXT = 'text-green-300'
/** Dark green: the system has a habitable world but this body is not one (W20). Legible on the dark background. */
export const SYSTEM_HABITABLE_TEXT = 'text-green-600'

/** Resources tab row text color (W20). Precedence: inhabited (cyan), body habitable, system habitable. */
export function rowTint(r: { inhabited: boolean; bodyHabitable?: boolean; systemHabitable: boolean }): string | undefined {
  if (r.inhabited) return INHABITED_TEXT
  if (r.bodyHabitable) return BODY_HABITABLE_TEXT
  if (r.systemHabitable) return SYSTEM_HABITABLE_TEXT
  return undefined
}

/** CSS class (index.css) for the animated light sweep on rows whose system has a ringworld (R2). */
export const RINGWORLD_ROW = 'ringworld-row'

/** Row class: the text tint (W20) plus the ringworld shimmer layered over it. */
export function rowClass(r: { inhabited: boolean; bodyHabitable?: boolean; systemHabitable?: boolean; hasRingworld: boolean }): string | undefined {
  const tint = rowTint({ ...r, systemHabitable: r.systemHabitable ?? false })
  if (!r.hasRingworld) return tint
  return tint ? `${tint} ${RINGWORLD_ROW}` : RINGWORLD_ROW
}

/** Planets and Systems tables have no text tint; only the shimmer. */
export function shimmerClass(r: { hasRingworld: boolean }): string | undefined {
  return r.hasRingworld ? RINGWORLD_ROW : undefined
}
