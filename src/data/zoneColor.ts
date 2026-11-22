/** Orbital zone -> orbit color (BLUEPRINT W17). Canonical order runs star outward. */
export const ZONE_ORDER = ['Inferno', 'Inner', 'Habitable', 'Outer', 'Frigid', 'Penumbral'] as const
export type KnownZone = (typeof ZONE_ORDER)[number]

const COLORS: Record<KnownZone, string> = {
  Inferno: '#ef4444', // red
  Inner: '#fb923c', // orange
  Habitable: '#4ade80', // green
  Outer: '#60a5fa', // blue
  Frigid: '#a5f3fc', // pale cyan
  Penumbral: '#a78bfa', // violet
}
export const UNKNOWN_ZONE_COLOR = '#94a3b8' // grey

/** Canonical zone name for "Habitable", "habitable zone", ...; undefined when not a known zone. */
export function normalizeZone(zone: string | undefined): KnownZone | undefined {
  if (!zone) return undefined
  const z = zone.trim().replace(/\s+zone$/i, '').toLowerCase()
  return ZONE_ORDER.find((k) => k.toLowerCase() === z)
}

export function zoneColor(zone: string | undefined): string {
  const k = normalizeZone(zone)
  return k ? COLORS[k] : UNKNOWN_ZONE_COLOR
}

/** Distinct zones among `zones` in canonical order; anything unrecognized collapses to a trailing 'unknown'. */
export function zonesPresent(zones: readonly (string | undefined)[]): (KnownZone | 'unknown')[] {
  const seen = new Set(zones.map(normalizeZone))
  const out: (KnownZone | 'unknown')[] = ZONE_ORDER.filter((k) => seen.has(k))
  if (seen.has(undefined)) out.push('unknown')
  return out
}
