import { describe, expect, it } from 'vitest'
import { arcPoint, compressAu, layoutOrrery, nearestArc, localOrbitRadius, spacedRadii, ORRERY_EXTENT, OUTER_RING } from './orrery'
import { parseOrbit } from './strings'
import type { Planet, Star, System } from './types'

const star = (name: string, orbit = 'Primary', id = name): Star => ({
  starId: id, name, type: 'G Yellow', orbit: parseOrbit(orbit), size: 'V', habRaw: '', shell: '', diameterRaw: '', diameterAu: 0.2, resources: [],
})
const planet = (name: string, orbit: string, bodyType = 'Planet', extra: Partial<Planet> = {}): Planet => ({
  planetId: name, name, bodyType, orbit: parseOrbit(orbit), zone: 'Inner', ...extra,
})
const sys = (stars: Star[], planets: Planet[]): System => ({
  systemId: 's', sectorId: 'x', name: 'S', eod: 'Surveyed', stars, planets, wormholes: [], cities: [], spacecraft: [],
})
const ang = (b: { x: number; y: number }, c = { x: 0, y: 0 }) =>
  ((Math.atan2(-(b.y - c.y), b.x - c.x) * 180) / Math.PI + 360) % 360

describe('scale', () => {
  it('compressAu is monotonic', () => {
    let prev = -1
    for (const au of [0, 0.1, 0.5, 1, 5, 20, 100]) {
      const r = compressAu(au, 100, 10, 80)
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
  })
  it('spacedRadii keeps order, min gap and fits', () => {
    const r = spacedRadii([0.25, 0.26, 0.27, 40, 0.1], 10, 80)
    expect(Math.max(...r)).toBeLessThanOrEqual(80.0001)
    const sorted = [...r].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThan(0.5)
    expect(r[4]!).toBeLessThan(r[0]!)
    expect(r[0]!).toBeLessThan(r[1]!)
    expect(r[3]!).toBe(Math.max(...r))
  })
})

describe('layoutOrrery', () => {
  const s = sys(
    [star('A')],
    [
      planet('A I', 'Orbiting A at 0.5au 90'),
      planet('A II', 'Orbiting A at 2au 180', 'Gas Giant'),
      planet('A IIa', 'Orbiting A II at 83,400m 270', 'Moon'),
    ],
  )
  const o = layoutOrrery(s)
  const b = (id: string) => o.bodies.find((x) => x.id === id)!

  it('puts the primary star at the center', () => {
    expect(o.stars[0]).toMatchObject({ x: 0, y: 0, primary: true })
  })
  it('respects angles (counter-clockwise from +x) and outward ordering', () => {
    expect(ang(b('A I'))).toBeCloseTo(90, 5)
    expect(ang(b('A II'))).toBeCloseTo(180, 5)
    expect(Math.hypot(b('A II').x, b('A II').y)).toBeGreaterThan(Math.hypot(b('A I').x, b('A I').y))
  })
  it('places moons near their parent at their angle', () => {
    const par = b('A II')
    const m = b('A IIa')
    expect(Math.hypot(m.x - par.x, m.y - par.y)).toBeLessThan(15)
    expect(ang(m, par)).toBeCloseTo(270, 5)
    expect(m.parentId).toBe('A II')
    expect(localOrbitRadius(100_000, 3)).toBeGreaterThan(localOrbitRadius(10_000, 3))
  })
  it('keeps everything inside the viewBox', () => {
    for (const x of [...o.bodies, ...o.stars]) {
      expect(Math.abs(x.x) + x.r).toBeLessThanOrEqual(ORRERY_EXTENT)
      expect(Math.abs(x.y) + x.r).toBeLessThanOrEqual(ORRERY_EXTENT)
    }
  })
  it('flags highlighted bodies', () => {
    const h = layoutOrrery(s, new Set(['A I']))
    expect(h.bodies.find((x) => x.id === 'A I')!.highlighted).toBe(true)
    expect(h.bodies.find((x) => x.id === 'A II')!.highlighted).toBe(false)
  })
  it('marks habitable worlds', () => {
    const hab = sys([star('A')], [planet('A I', 'Orbiting A at 1au 0', 'Planet', { zone: 'Habitable', atmosphere: { atmosphereType: 'Standard', resources: [] } })])
    expect(layoutOrrery(hab).bodies[0]!.habitable).toBe(true)
    expect(o.bodies.every((x) => !x.habitable)).toBe(true)
  })
  it('puts missing or unparseable orbits on the outer ring, deterministically', () => {
    const bad = sys([star('A')], [planet('X', 'garbage'), planet('Y', 'Orbiting Nowhere at 1au 10'), planet('Z', 'Orbiting A at 1au 10')])
    const a = layoutOrrery(bad)
    expect(JSON.stringify(layoutOrrery(bad))).toBe(JSON.stringify(a))
    for (const id of ['X', 'Y']) {
      const p = a.bodies.find((x) => x.id === id)!
      expect(p.placed).toBe(false)
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(OUTER_RING, 5)
    }
    const [x, y] = [a.bodies.find((q) => q.id === 'X')!, a.bodies.find((q) => q.id === 'Y')!]
    expect(Math.abs(x.y - y.y)).toBeGreaterThan(1)
    expect(a.bodies.find((q) => q.id === 'Z')!.placed).toBe(true)
  })
  it('handles systems without stars', () => {
    const r = layoutOrrery(sys([], [planet('P', 'Orbiting A at 1au 0')]))
    expect(r.stars).toHaveLength(0)
    expect(r.bodies).toHaveLength(1)
  })
  it('handles multiple stars: companion on its orbit, its planets around it', () => {
    const m = sys(
      [star('A'), star('B', 'Orbiting A at 2au 180')],
      [planet('A I', 'Orbiting A at 1au 0'), planet('B I', 'Orbiting B at 0.5au 90')],
    )
    const r = layoutOrrery(m)
    const B = r.stars.find((x) => x.id === 'B')!
    expect(ang(B)).toBeCloseTo(180, 5)
    expect(B.primary).toBe(false)
    const bi = r.bodies.find((x) => x.id === 'B I')!
    expect(Math.hypot(bi.x - B.x, bi.y - B.y)).toBeLessThan(25)
    expect(ang(bi, B)).toBeCloseTo(90, 5)
    expect(r.bodies.find((x) => x.id === 'A I')!.placed).toBe(true)
  })
})

describe('orbit zones (W17)', () => {
  it('tags planet and moon orbits with the body zone', () => {
    const o = layoutOrrery(
      sys([star('A')], [
        planet('P', 'Orbiting A at 1au 10', 'Planet', { zone: 'Habitable' }),
        planet('M', 'Orbiting P at 100,000m 10', 'Moon', { zone: 'Outer' }),
      ]),
    )
    expect(o.orbits.map((c) => c.zone).sort()).toEqual(['Habitable', 'Outer'])
  })
})

describe('ringworld rings (R5)', () => {
  const arcs = [3, 1, 2].map((n) => planet(`R Arc ${n}`, `Orbiting R at 83,400m ${n * 100}`, `Ringworld Arc ${n}`))
  const s = sys([star('R')], [...arcs, planet('R I', 'Orbiting R at 1au 10')])
  const o = layoutOrrery(s)

  it('groups arcs of one orbit into one ring, ordered by arc number', () => {
    expect(o.rings).toHaveLength(1)
    const ring = o.rings[0]!
    expect(ring.id).toBe('R Arc 1')
    expect(ring.arcs.map((a) => a.id)).toEqual(['R Arc 1', 'R Arc 2', 'R Arc 3'])
    expect([ring.cx, ring.cy]).toEqual([0, 0])
    expect(ring.r).toBeGreaterThan(0)
    expect(ring.arcs.map((a) => Math.round(a.deg))).toEqual([100, 200, 300])
  })
  it('flags arc bodies but keeps them in the body list', () => {
    expect(o.bodies).toHaveLength(4)
    expect(o.bodies.filter((b) => b.ringworld).map((b) => b.id).sort()).toEqual(['R Arc 1', 'R Arc 2', 'R Arc 3'])
  })
  it('has no rings without ringworld arcs', () => {
    expect(layoutOrrery(sys([star('A')], [planet('A I', 'Orbiting A at 1au 10')])).rings).toEqual([])
  })
  it('carries highlight to the arc', () => {
    expect(layoutOrrery(s, new Set(['R Arc 2'])).rings[0]!.arcs.map((a) => a.highlighted)).toEqual([false, true, false])
  })
  it('picks the nearest arc by angle, wrapping around 0', () => {
    const ring = o.rings[0]!
    const at = (deg: number) => arcPoint(ring, deg)
    expect(nearestArc(ring, at(190).x, at(190).y).id).toBe('R Arc 2')
    expect(nearestArc(ring, at(110).x, at(110).y).id).toBe('R Arc 1')
    // 350 deg is 50 away from arc 3 (300) and 110 away from arc 1 (100)
    expect(nearestArc(ring, at(350).x, at(350).y).id).toBe('R Arc 3')
    expect(nearestArc(ring, at(20).x, at(20).y).id).toBe('R Arc 1') // 80 from arc 1, 80 from arc 3 wrapped: first wins ties
  })
  it('stays inside the view for the mock-style crowded case', () => {
    for (const b of o.bodies) expect(Math.abs(b.x) + b.r).toBeLessThanOrEqual(ORRERY_EXTENT)
  })
})
