/** Resource catalog: icon and harvester-bay categories (BLUEPRINT 12 V2-V4, 14.1). */
import { GAME_RESOURCES, RESOURCE_ALIASES } from './gamedata.generated'
import type { Sphere } from './types'

export const BAY_CATEGORIES = ['Prospector', 'Wildcatter', 'Siphon', 'Atmosphere Condenser', 'Particle Collector'] as const
export const SURFACE_ONLY = 'Surface Only'
export const UNKNOWN_CATEGORY = 'Unknown'

/** All categories in display order. */
export const CATEGORIES: readonly string[] = [...BAY_CATEGORIES, SURFACE_ONLY, UNKNOWN_CATEGORY]

export interface ResourceInfo {
  /** URL relative to the site base, e.g. 'icons/c_Gems.png'. Absent for unknown names. */
  icon?: string
  categories: string[]
}

/**
 * Names are lookup keys only; the icon URL always comes from the generated table.
 * Biosphere resources are "Surface Only" by sphere (no bay), even when the name is
 * unknown. Known names without a bay are also "Surface Only"; unknown names are "Unknown".
 */
export function resourceInfo(name: string, sphere?: Sphere): ResourceInfo {
  const key = Object.hasOwn(RESOURCE_ALIASES, name) ? RESOURCE_ALIASES[name]! : name
  const known = Object.hasOwn(GAME_RESOURCES, key) ? GAME_RESOURCES[key] : undefined
  const info: ResourceInfo = { categories: [] }
  if (known) info.icon = known.icon
  if (sphere === 'biosphere') info.categories = [SURFACE_ONLY]
  else if (!known) info.categories = [UNKNOWN_CATEGORY]
  else info.categories = known.bays.length ? [...known.bays] : [SURFACE_ONLY]
  return info
}
