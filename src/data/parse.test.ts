import { describe, expect, it } from 'vitest'
import { MINI_XML } from './__fixtures__/mini'
import { parseStarMap, StarMapParseError } from './parse'
import { SCHEMA_VERSION } from './types'

const map = parseStarMap(MINI_XML)
const sys = (id: string) => map.systems.find((s) => s.systemId === id)!

describe('parseStarMap structure', () => {
  it('reads the header', () => {
    expect(map.schemaVersion).toBe(SCHEMA_VERSION)
    expect(map.empireId).toBe('7')
    expect(map.empire).toBe('House Test')
    expect(map.createDate).toBe('Sat Nov 21 17:25:58 2026 GMT')
    expect(map.galaxyName).toBe('Test Galaxy')
  })
  it('reads sectors and flat systems with sector references', () => {
    expect(map.sectors).toEqual([
      { sectorId: 'SEC1', name: 'Alpha Sector', galaxy: 'Test Galaxy', x: 75, y: 1, z: 2 },
      { sectorId: 'SEC2', name: 'Beta Sector', galaxy: 'Test Galaxy', x: 76, y: 1, z: 2 },
    ])
    expect(map.systems.map((s) => [s.systemId, s.sectorId, s.eod])).toEqual([
      ['SYSA', 'SEC1', 'Surveyed'],
      ['SYSB', 'SEC1', 'Explored'],
      ['SYSC', 'SEC2', 'Unexplored'],
      ['SYSD', 'SEC2', 'Unexplored'],
    ])
  })
  it('reads system coordinates and optional catalog', () => {
    const a = sys('SYSA')
    expect([a.x, a.y, a.z]).toEqual([754.1, 11.8, 9.8])
    expect(a.catalog).toBe("XQL'A'B'a")
    expect(sys('SYSB').catalog).toBeUndefined()
  })
  it('handles Deep Space without coordinates', () => {
    const d = sys('SYSD')
    expect(d.name).toBe('Deep Space')
    expect(d.x).toBeUndefined()
    expect(d.y).toBeUndefined()
    expect(d.z).toBeUndefined()
    expect(d.stars).toEqual([])
  })
  it('keeps unexplored systems with their stars and no planets', () => {
    const c = sys('SYSC')
    expect(c.stars).toHaveLength(1)
    expect(c.planets).toHaveLength(0)
  })
})

describe('wormholes, cities, spacecraft', () => {
  it('parses wormholes with and without destSystemId', () => {
    expect(sys('SYSA').wormholes).toEqual([
      { destX: 755, destY: 12, destZ: 10, destSystemId: 'SYSB', explored: true, polarity: 'positive' },
      { destX: 700, destY: 1, destZ: 2.5, explored: false, polarity: 'negative' },
    ])
    expect(sys('SYSA').wormholes[1]).not.toHaveProperty('destSystemId')
  })
  it('parses cities with optional attributes', () => {
    expect(sys('SYSA').cities).toEqual([
      {
        cityId: 'C1',
        name: 'Homeport',
        empire: 'House Test',
        empireId: '7',
        stance: 'Empire',
        capital: 'Empire, Galaxy, Sector',
        admin: 'Capitol',
        airport: 'Airport Terminal',
      },
      { cityId: 'C2', name: 'Outpost' },
    ])
  })
  it('ignores spacecraft entirely', () => {
    expect(JSON.stringify(map)).not.toContain('Ignored')
  })
})

describe('stars', () => {
  it('parses star attributes, numbers and resources', () => {
    const [a, b] = sys('SYSA').stars
    expect(a).toMatchObject({
      starId: 'STA',
      type: 'G Yellow',
      size: 'V Main Sequence',
      spectralClass: '5',
      surfaceTempRaw: '5,527°K',
      surfaceTempK: 5527,
      habRaw: 'Habitable Zone at 1.5au',
      habAu: 1.5,
      shell: 'Photosphere',
      diameterRaw: '0.23au Diameter',
      diameterAu: 0.23,
    })
    expect(a.orbit).toEqual({ raw: 'Primary' })
    expect(a.resources).toEqual([
      { name: 'Type G Preons', quality: 200, abundance: 4 },
      { name: 'Type K Preons', quality: 90, abundance: 1 },
    ])
    expect(b.orbit.orbitingName).toBe('Aldera Alpha')
    expect(b.spectralClass).toBeUndefined()
    expect(b.surfaceTempK).toBeUndefined()
    expect(b.habAu).toBeUndefined()
    expect(b.resources).toEqual([])
  })
})

describe('planets', () => {
  const planets = Object.fromEntries(sys('SYSA').planets.map((p) => [p.planetId, p]))

  it('parses a 4-zone planet with all spheres', () => {
    const p = planets.PA1
    expect(p).toMatchObject({ name: 'Aldera I', bodyType: 'Planet', zone: 'Habitable' })
    expect(p.orbit).toMatchObject({ orbitingName: 'Aldera Alpha', au: 1.5, deg: 108 })
    expect(p.geosphere).toMatchObject({
      diameterRaw: '15,600m Diameter',
      diameterM: 15600,
      gravityRaw: '11.89m/s² Sea Level Gravity',
      gravity: 11.89,
      gravityKind: 'sea-level',
      resourceZones: 4,
    })
    expect(p.geosphere!.resources[0]).toEqual({
      name: 'Ore',
      zones: [
        { quality: 100, abundance: 2 },
        { quality: 150, abundance: 3 },
        { quality: 50, abundance: 1 },
        { quality: 120, abundance: 9 },
      ],
    })
    expect(p.hydrosphere).toMatchObject({ liquidPct: 77, liquidType: 'Water' })
    expect(p.hydrosphere!.resources[0].zones).toEqual([{ quality: 130, abundance: 40 }])
    expect(p.atmosphere).toMatchObject({ atmosphereType: 'Exotic', densityPct: 77 })
    expect(p.atmosphere!.resources[0].zones).toHaveLength(1)
    expect(p.biosphere).toMatchObject({ fauna: true, flora: false })
    expect(p.biosphere!.resources[0].zones).toHaveLength(4)
  })
  it('parses 1-zone and 2-zone planets', () => {
    expect(planets.PA2.geosphere!.resources[0].zones).toHaveLength(1)
    expect(planets.PA3.geosphere!.resources[0].zones).toHaveLength(2)
  })
  it('parses gas giant core gravity and hydrosphere size', () => {
    expect(planets.PA3.geosphere).toMatchObject({ gravity: 5548.88, gravityKind: 'core', diameterM: 6000 })
    expect(planets.PA3.hydrosphere).toMatchObject({ diameterM: 64000, gravity: 48.77 })
  })
  it('parses rings (radius/width, no gravity, no hydro/atmo)', () => {
    const r = planets.PA4
    expect(r.geosphere).toMatchObject({ radiusM: 54700, widthM: 15200 })
    expect(r.geosphere!.gravity).toBeUndefined()
    expect(r.geosphere!.diameterM).toBeUndefined()
    expect(r.hydrosphere).toBeUndefined()
    expect(r.atmosphere).toBeUndefined()
    expect(r.biosphere).toBeUndefined()
  })
  it('parses no-liquid / no-atmosphere as zero', () => {
    expect(planets.PA2.hydrosphere).toMatchObject({ liquidPct: 0 })
    expect(planets.PA2.atmosphere).toMatchObject({ atmosphereType: 'None', densityPct: 0 })
  })
  it('keeps planets of explored systems with no resources', () => {
    const p = sys('SYSB').planets[0]
    expect(p.geosphere!.resources).toEqual([])
    expect(p.biosphere).toBeUndefined()
  })
})

describe('plain-data model', () => {
  it('survives structuredClone unchanged', () => {
    expect(structuredClone(map)).toEqual(map)
  })
  it('survives JSON round trip (no undefined-only keys that matter)', () => {
    expect(JSON.parse(JSON.stringify(map))).toEqual(map)
  })
})

describe('errors', () => {
  it('throws StarMapParseError for non-XML', () => {
    expect(() => parseStarMap('this is not xml')).toThrow(StarMapParseError)
    expect(() => parseStarMap('')).toThrow(StarMapParseError)
    expect(() => parseStarMap('<starmap><galaxy></starmap>')).toThrow(StarMapParseError)
  })
  it('throws a clear error when the root is not starmap', () => {
    expect(() => parseStarMap('<html><body/></html>')).toThrow(/starmap/)
    expect(() => parseStarMap('<html/>')).toThrow(StarMapParseError)
  })
  it('rejects DOCTYPE and never resolves entities', () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE starmap [<!ENTITY x SYSTEM "file:///etc/passwd">]><starmap empireId="1" empire="&x;" createDate="d"><galaxy name="g"/></starmap>`
    expect(() => parseStarMap(xxe)).toThrow(StarMapParseError)
    const billion = `<!DOCTYPE starmap [<!ENTITY a "aaaa">]><starmap empireId="1" empire="&a;" createDate="d"/>`
    expect(() => parseStarMap(billion)).toThrow(/DOCTYPE/)
  })
  it('does not expand undeclared entities', () => {
    expect(() => parseStarMap('<starmap empireId="1" empire="&x;" createDate="d"/>')).toThrow(StarMapParseError)
  })
  it('throws on a system without systemId', () => {
    const xml = `<starmap empireId="1" empire="e" createDate="d"><galaxy name="g"><sector sectorId="S" name="n" x="1" y="1" z="1"><system name="x" eod="Surveyed"/></sector></galaxy></starmap>`
    expect(() => parseStarMap(xml)).toThrow(/systemId/)
  })
  it('throws on a non-numeric quality', () => {
    const xml = MINI_XML.replace('qualityZone1="180"', 'qualityZone1="lots"')
    expect(() => parseStarMap(xml)).toThrow(StarMapParseError)
  })
})

describe('progress', () => {
  it('reports increasing fractions ending at 1', () => {
    const big = MINI_XML.replace('</galaxy>', '<!-- ' + 'x'.repeat(3 * 1024 * 1024) + ' --></galaxy>')
    const seen: number[] = []
    parseStarMap(big, (f) => seen.push(f))
    expect(seen.length).toBeGreaterThan(2)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
    expect(seen.at(-1)).toBe(1)
    expect(seen.every((f) => f >= 0 && f <= 1)).toBe(true)
  })
})
