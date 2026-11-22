import { describe, expect, it } from 'vitest'
import { compressAu, layoutOrrery, localOrbitRadius, spacedRadii, ORRERY_EXTENT, OUTER_RING } from './orrery'
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
