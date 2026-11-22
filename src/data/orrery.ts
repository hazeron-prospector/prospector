/**
 * Pure 2D top-down layout of a system for the preview (BLUEPRINT W11).
 * Abstract viewBox of 200 x 200 centered on the primary star: x right, y down. An orbit angle
 * of 0 deg points right and angles run counter-clockwise on screen.
 */
import { isHabitableWorld } from './systemSummary'
import type { Orbit, Planet, Star, System } from './types'

export const ORRERY_EXTENT = 100
export const ORRERY_VIEWBOX = `${-ORRERY_EXTENT} ${-ORRERY_EXTENT} ${ORRERY_EXTENT * 2} ${ORRERY_EXTENT * 2}`
/** Outer ring for bodies whose orbit cannot be placed. */
export const OUTER_RING = 94
const MAIN_MAX_R = 76
const COMPANION_MAX_R = 20
const MIN_GAP = 4
const METERS_PER_AU = 149_597_870_700
const AU_PER_PC = 206_264.806

export const BODY_COLORS: Record<string, string> = {
  Planet: '#5fa8d3',
  Moon: '#b8c0cc',
  'Gas Giant': '#e0a458',
  Planetoid: '#a08a73',
  Titan: '#c77dff',
  Ring: '#7a8794',
}
export const FALLBACK_BODY_COLOR = '#8b95a1'

export interface OrreryStar {
  id: string
  name: string
  type: string
  x: number
  y: number
  r: number
  primary: boolean
  highlighted: boolean
}

export interface OrreryBody {
  id: string
  name: string
  bodyType: string
  x: number
  y: number
  r: number
  color: string
  habitable: boolean
  highlighted: boolean
  /** The body (or star) this one orbits, when placed relative to it. */
  parentId?: string
  /** False when the orbit was missing or unresolved and the body sits on the outer ring. */
  placed: boolean
}

export interface OrreryCircle {
  cx: number
  cy: number
  r: number
}

export interface Orrery {
  stars: OrreryStar[]
  bodies: OrreryBody[]
  orbits: OrreryCircle[]
}

/**
 * Monotonic compressed radius: sqrt scale from `inner` (au 0) to `outer` (au `maxAu`).
 * Distances beyond `maxAu` clamp to `outer`.
 */
export function compressAu(au: number, maxAu: number, inner: number, outer: number): number {
  if (!(maxAu > 0) || !(au > 0)) return inner
  return inner + (outer - inner) * Math.sqrt(Math.min(au, maxAu) / maxAu)
}

/**
 * Radii for a list of distinct distances: compressed, strictly increasing with at least `gap`
 * between neighbours (rescaled to fit when spacing pushes past `outer`).
 */
export function spacedRadii(aus: readonly number[], inner: number, outer: number, gap = MIN_GAP): number[] {
  if (aus.length === 0) return []
  const order = aus.map((_, i) => i).sort((a, b) => aus[a]! - aus[b]!)
  const maxAu = aus[order[order.length - 1]!]!
  const out = new Array<number>(aus.length)
  let prev = -Infinity
  for (const i of order) {
    const r = Math.max(compressAu(aus[i]!, maxAu, inner, outer), prev + gap, inner)
    out[i] = r
    prev = r
  }
  const last = Math.max(...out)
  if (last > outer && last > inner) {
    const k = (outer - inner) / (last - inner)
    return out.map((r) => inner + (r - inner) * k)
  }
  return out
}

const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos(rad(deg)),
  y: cy - r * Math.sin(rad(deg)),
})

function orbitAu(o: Orbit): number | undefined {
  if (o.au !== undefined) return o.au
  if (o.distance === undefined || !o.unit) return undefined
  if (o.unit === 'au') return o.distance
  if (o.unit === 'pc') return o.distance * AU_PER_PC
  return o.distance / METERS_PER_AU
}

function orbitMeters(o: Orbit): number | undefined {
  if (o.unit === 'm' && o.distance !== undefined) return o.distance
  const au = orbitAu(o)
  return au === undefined ? undefined : au * METERS_PER_AU
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Dot radius of a star from its diameter in au (5..10). */
export function starRadius(s: Star): number {
  const au = s.diameterAu
  if (!au || au <= 0) return 6
  return clamp(5 + 3 * Math.log10(au / 0.1), 5, 10)
}

/** Dot radius of a body from its diameter in meters, log scale (1..4.5). */
export function bodyRadius(p: Planet): number {
  const g = p.geosphere
  const d = p.hydrosphere?.diameterM ?? g?.diameterM ?? (g?.radiusM ? g.radiusM * 2 : undefined)
  if (!d || d <= 0) return 1.8
  return clamp(1 + ((Math.log10(d) - 4) / 4.2) * 3.5, 1, 4.5)
}

/** Small local orbit radius for moons/rings around a parent dot of radius `parentR`. */
export function localOrbitRadius(meters: number | undefined, parentR: number): number {
  const base = parentR + 3
  if (!meters || meters <= 0) return base + 2
  // 10 km -> ~0, 10,000 km -> ~6
  return base + clamp((Math.log10(meters) - 4) * 2, 0, 7)
}

export function layoutOrrery(system: System, highlighted?: ReadonlySet<string>): Orrery {
  const isHi = (id: string) => highlighted?.has(id) ?? false
  const stars = system.stars
  const primary = stars.find((s) => !s.orbit.orbitingName) ?? stars[0]

  const pos = new Map<string, { x: number; y: number; r: number }>() // by name
  const outStars: OrreryStar[] = []
  const outBodies: OrreryBody[] = []
  const orbits: OrreryCircle[] = []

  if (primary) pos.set(primary.name, { x: 0, y: 0, r: starRadius(primary) })

  // Hosts of a star-level orbit: all children (stars and planets) whose parent is a star.
  const starByName = new Map(stars.map((s) => [s.name, s]))
  const planetByName = new Map(system.planets.map((p) => [p.name, p]))

  interface Child {
    kind: 'star' | 'planet'
    id: string
    au: number
    deg: number
  }
  const childrenOf = new Map<string, Child[]>()
  const orphanStars: Star[] = []
  const orphanPlanets: Planet[] = []
  const add = (host: string, c: Child) => childrenOf.set(host, [...(childrenOf.get(host) ?? []), c])

  for (const s of stars) {
    if (s === primary) continue
    const au = orbitAu(s.orbit)
    const host = s.orbit.orbitingName
    if (host && host !== s.name && starByName.has(host) && au !== undefined && s.orbit.deg !== undefined) {
      add(host, { kind: 'star', id: s.starId, au, deg: s.orbit.deg })
    } else orphanStars.push(s)
  }
  const moonChildren = new Map<string, Planet[]>()
  for (const p of system.planets) {
    const host = p.orbit.orbitingName
    const au = orbitAu(p.orbit)
    if (host && host !== p.name && au !== undefined && p.orbit.deg !== undefined) {
      if (starByName.has(host)) {
        add(host, { kind: 'planet', id: p.planetId, au, deg: p.orbit.deg })
        continue
      }
      if (planetByName.has(host)) {
        moonChildren.set(host, [...(moonChildren.get(host) ?? []), p])
        continue
      }
    }
    orphanPlanets.push(p)
  }

  const starById = new Map(stars.map((s) => [s.starId, s]))
  const planetById = new Map(system.planets.map((p) => [p.planetId, p]))

  const placePlanet = (p: Planet, x: number, y: number, parentId: string | undefined, placed: boolean) => {
    const r = bodyRadius(p)
    pos.set(p.name, { x, y, r })
    outBodies.push({
      id: p.planetId,
      name: p.name,
      bodyType: p.bodyType,
      x,
      y,
      r,
      color: BODY_COLORS[p.bodyType] ?? FALLBACK_BODY_COLOR,
      habitable: isHabitableWorld(p),
      highlighted: isHi(p.planetId),
      parentId,
      placed,
    })
  }

  const placeMoons = (parent: Planet, visited: Set<string>) => {
    const pp = pos.get(parent.name)
    if (!pp) return
    const kids = moonChildren.get(parent.name) ?? []
    for (const m of kids) {
      if (visited.has(m.planetId)) continue
      visited.add(m.planetId)
      const lr = localOrbitRadius(orbitMeters(m.orbit), pp.r)
      const { x, y } = polar(pp.x, pp.y, lr, m.orbit.deg ?? 0)
      orbits.push({ cx: pp.x, cy: pp.y, r: lr })
      placePlanet(m, x, y, parent.planetId, true)
      placeMoons(m, visited)
    }
  }

  const visitedStars = new Set<string>()
  const visitedPlanets = new Set<string>()
  const placeHost = (hostName: string, maxR: number) => {
    const hp = pos.get(hostName)
    if (!hp) return
    const kids = (childrenOf.get(hostName) ?? []).filter((c) =>
      c.kind === 'star' ? !visitedStars.has(c.id) : !visitedPlanets.has(c.id),
    )
    if (kids.length === 0) return
    const distinct = [...new Set(kids.map((k) => k.au))]
    const radii = spacedRadii(distinct, hp.r + 8, maxR)
    const radiusOf = new Map(distinct.map((au, i) => [au, radii[i]!]))
    for (const au of distinct) orbits.push({ cx: hp.x, cy: hp.y, r: radiusOf.get(au)! })
    const companions: string[] = []
    for (const k of kids) {
      const { x, y } = polar(hp.x, hp.y, radiusOf.get(k.au)!, k.deg)
      if (k.kind === 'star') {
        visitedStars.add(k.id)
        const s = starById.get(k.id)!
        const r = starRadius(s)
        pos.set(s.name, { x, y, r })
        outStars.push({ id: s.starId, name: s.name, type: s.type, x, y, r, primary: false, highlighted: isHi(s.starId) })
        companions.push(s.name)
      } else {
        visitedPlanets.add(k.id)
        const p = planetById.get(k.id)!
        placePlanet(p, x, y, starById.get(hostName)?.starId, true)
        placeMoons(p, visitedPlanets)
      }
    }
    for (const c of companions) placeHost(c, COMPANION_MAX_R)
  }

  if (primary) {
    outStars.push({
      id: primary.starId,
      name: primary.name,
      type: primary.type,
      x: 0,
      y: 0,
      r: starRadius(primary),
      primary: true,
      highlighted: isHi(primary.starId),
    })
    visitedStars.add(primary.starId)
    placeHost(primary.name, MAIN_MAX_R)
  }

  // Anything left (missing orbit, unknown parent, parent unplaced) goes on the outer ring.
  const leftoverPlanets = system.planets.filter((p) => !visitedPlanets.has(p.planetId) && !outBodies.some((b) => b.id === p.planetId))
  const leftoverStars = stars.filter((s) => !visitedStars.has(s.starId) && !outStars.some((o) => o.id === s.starId))
  const total = leftoverPlanets.length + leftoverStars.length
  if (total > 0) {
    orbits.push({ cx: 0, cy: 0, r: OUTER_RING })
    let i = 0
    for (const s of leftoverStars) {
      const { x, y } = polar(0, 0, OUTER_RING, (360 * i++) / total + 90)
      const r = starRadius(s) / 2
      pos.set(s.name, { x, y, r })
      outStars.push({ id: s.starId, name: s.name, type: s.type, x, y, r, primary: false, highlighted: isHi(s.starId) })
    }
    for (const p of leftoverPlanets) {
      const { x, y } = polar(0, 0, OUTER_RING, (360 * i++) / total + 90)
      placePlanet(p, x, y, undefined, false)
      visitedPlanets.add(p.planetId)
    }
    // Moons of outer-ring bodies still orbit their parent.
    for (const p of leftoverPlanets) placeMoons(p, visitedPlanets)
  }

  // Moons whose parent was placed only in the first pass are handled in placeMoons; any moon still
  // missing (cyclic or dangling chain) falls back to the outer ring.
  const missing = system.planets.filter((p) => !outBodies.some((b) => b.id === p.planetId))
  missing.forEach((p, i) => {
    const { x, y } = polar(0, 0, OUTER_RING, (360 * i) / missing.length + 45)
    placePlanet(p, x, y, undefined, false)
  })

  return fitToView({ stars: outStars, bodies: outBodies, orbits })
}

/** Uniformly shrink positions (not dot sizes) so every dot lies inside the view; angles are kept. */
function fitToView(o: Orrery): Orrery {
  const dots = [...o.stars, ...o.bodies]
  const maxDot = Math.max(0, ...dots.map((d) => d.r))
  const maxPos = Math.max(0, ...dots.map((d) => Math.max(Math.abs(d.x), Math.abs(d.y))), ...o.orbits.map((c) => Math.max(Math.abs(c.cx), Math.abs(c.cy)) + c.r))
  const room = ORRERY_EXTENT - maxDot
  if (maxPos <= room || maxPos === 0) return o
  const k = room / maxPos
  for (const d of dots) {
    d.x *= k
    d.y *= k
  }
  for (const c of o.orbits) {
    c.cx *= k
    c.cy *= k
    c.r *= k
  }
  return o
}
