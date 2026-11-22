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
