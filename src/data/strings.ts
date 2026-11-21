/**
 * Numeric extraction from the exporter's display strings.
 * Every function returns undefined (never NaN, never throws) when the text is
 * not in the expected shape; callers keep the raw text for display.
 */
import type { Dimensions, Orbit } from './types'

const NUM = String.raw`\d[\d,]*(?:\.\d+)?`
const METERS_PER_AU = 149_597_870_700
const AU_PER_PC = 206_264.806

export function parseNumber(s: string | undefined): number | undefined {
  if (s === undefined) return undefined
  const t = s.trim().replace(/,/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(t)) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/** "15,600m Diameter", "0.23au Diameter", "54700m Radius<br>15200m Width". */
export function parseDiameter(s: string | undefined): Dimensions | undefined {
  if (!s) return undefined
  const ring = new RegExp(`^(${NUM})m Radius\\s*<br\\s*/?>\\s*(${NUM})m Width$`).exec(s.trim())
  if (ring) {
    const radiusM = parseNumber(ring[1])
    const widthM = parseNumber(ring[2])
    if (radiusM === undefined || widthM === undefined) return undefined
    return { radiusM, widthM }
  }
  const m = new RegExp(`^(${NUM})(m|au) Diameter$`).exec(s.trim())
  if (!m) return undefined
  const v = parseNumber(m[1])
  if (v === undefined) return undefined
  return m[2] === 'm' ? { meters: v } : { au: v }
}

/** "11.89m/s² Sea Level Gravity", "5548.88m/s² Core Gravity". */
export function parseGravity(
  s: string | undefined,
): { value: number; kind: 'sea-level' | 'core' } | undefined {
  if (!s) return undefined
  const m = new RegExp(`^(${NUM})m/s\\S* (Sea Level|Core) Gravity$`).exec(s.trim())
  if (!m) return undefined
  const value = parseNumber(m[1])
  if (value === undefined) return undefined
  return { value, kind: m[2] === 'Core' ? 'core' : 'sea-level' }
}

/** "77% Surface Liquid", "12% Surface Water", "No Surface Lava". */
export function parseSurfaceLiquid(s: string | undefined): { pct: number; liquid: string } | undefined {
  if (!s) return undefined
  const t = s.trim()
  const none = /^No Surface (\S+)$/.exec(t)
  if (none) return { pct: 0, liquid: none[1] }
  const m = new RegExp(`^(${NUM})% Surface (\\S+)$`).exec(t)
  if (!m) return undefined
  const pct = parseNumber(m[1])
  return pct === undefined ? undefined : { pct, liquid: m[2] }
}

/** "Exotic, 77% Density" or "No Atmosphere". */
export function parseAtmosphere(s: string | undefined): { type: string; densityPct: number } | undefined {
  if (!s) return undefined
  const t = s.trim()
  if (t === 'No Atmosphere') return { type: 'None', densityPct: 0 }
  const m = new RegExp(`^(.+?), (${NUM})% Density$`).exec(t)
  if (!m) return undefined
  const densityPct = parseNumber(m[2])
  return densityPct === undefined ? undefined : { type: m[1], densityPct }
}

/** "Orbiting X at 0.5au 108°", "Orbiting X at 83,400m 257°", "Primary". */
export function parseOrbit(raw: string): Orbit {
  const m = new RegExp(`^Orbiting (.+) at (${NUM})(au|pc|m) (\\d+(?:\\.\\d+)?)\\S*$`).exec(raw.trim())
  if (!m) return { raw }
  const distance = parseNumber(m[2])
  const deg = parseNumber(m[4])
  if (distance === undefined || deg === undefined) return { raw }
  const unit = m[3] as 'au' | 'pc' | 'm'
  return {
    raw,
    orbitingName: m[1],
    distance,
    unit,
    au: unit === 'au' ? distance : unit === 'pc' ? distance * AU_PER_PC : distance / METERS_PER_AU,
    deg,
  }
}

/** "6,755°K". */
export function parseTemperatureK(s: string | undefined): number | undefined {
  if (!s) return undefined
  const m = new RegExp(`^(${NUM})\\S*K$`).exec(s.trim())
  return m ? parseNumber(m[1]) : undefined
}

/** "Habitable Zone at 1.5au" -> 1.5; "No Habitable Zone ..." -> undefined. */
export function parseHabitableZone(s: string | undefined): number | undefined {
  if (!s) return undefined
  const m = new RegExp(`^Habitable Zone at (${NUM})au$`).exec(s.trim())
  return m ? parseNumber(m[1]) : undefined
}

/** "Inferno Zone" -> "Inferno". */
export function parseZone(s: string): string {
  return s.replace(/ Zone$/, '')
}
