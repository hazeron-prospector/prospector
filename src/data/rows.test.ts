import { describe, expect, it } from 'vitest'
import { MINI_XML } from './__fixtures__/mini'
import { parseStarMap } from './parse'
import { foldBodyType, isRingworldBody, ringworldArcNumber, orderRingworldArcs, toBodyRows, toResourceRows, toSystemRows } from './rows'

const map = parseStarMap(MINI_XML)

describe('toResourceRows', () => {
  const rows = toResourceRows(map)
  const find = (bodyId: string, resource: string) => rows.find((r) => r.bodyId === bodyId && r.resource === resource)!

  it('emits one row per resource per body, stars included, unexplored systems excluded', () => {
    expect(rows).toHaveLength(11)
    expect(rows.filter((r) => r.sphere === 'star')).toHaveLength(2)
    expect(rows.some((r) => r.systemId === 'SYSC')).toBe(false)
  })
  it('has stable unique ids', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(toResourceRows(map).map((r) => r.id)).toEqual(rows.map((r) => r.id))
  })
  it('computes best quality and per-zone values (undefined when absent)', () => {
    const ore = find('PA1', 'Ore')
    expect(ore.bestQuality).toBe(150)
    expect([ore.q1, ore.q2, ore.q3, ore.q4]).toEqual([100, 150, 50, 120])
    expect([ore.a1, ore.a2, ore.a3, ore.a4]).toEqual([2, 3, 1, 9])
    const moonOre = find('PA2', 'Ore')
    expect(moonOre.bestQuality).toBe(180)
    expect([moonOre.q2, moonOre.q3, moonOre.q4]).toEqual([undefined, undefined, undefined])
    expect([moonOre.a2, moonOre.a3, moonOre.a4]).toEqual([undefined, undefined, undefined])
  })
  it('labels spheres and carries body/system info', () => {
    expect(find('PA1', 'Stone')).toMatchObject({
      sphere: 'geosphere',
      bodyName: 'Aldera I',
      bodyType: 'Planet',
      orbitalZone: 'Habitable',
      systemId: 'SYSA',
      systemName: 'Aldera',
      sectorName: 'Alpha Sector',
    })
    expect(find('PA1', 'Myrathane').sphere).toBe('hydrosphere')
    expect(find('PA1', 'Air').sphere).toBe('atmosphere')
    expect(find('PA1', 'Fruit').sphere).toBe('biosphere')
    expect(find('PA4', 'Ice').bodyType).toBe('Ring')
    expect(find('PA1', 'Fruit').categories).toEqual(['Surface Only'])
    expect(find('PA1', 'Stone').categories).toEqual(['Prospector'])
    expect(find('STA', 'Type G Preons').categories).toEqual(['Particle Collector'])
  })
  it('stars: bodyType Star, no orbital zone, quality in zone 1', () => {
    const s = find('STA', 'Type G Preons')
    expect(s).toMatchObject({ sphere: 'star', bodyType: 'Star', bestQuality: 200, q1: 200, a1: 4 })
    expect(s.orbitalZone).toBeUndefined()
    expect(s.q2).toBeUndefined()
  })
  it('flags inhabited systems with their empires', () => {
    expect(find('PA1', 'Ore')).toMatchObject({ inhabited: true, inhabitingEmpires: ['House Test'] })
  })
})

describe('toResourceRows habitable flags', () => {
  it('marks the habitable body and its whole system; stars never body-habitable', () => {
    const m = structuredClone(map)
    const sys = m.systems.find((x) => x.systemId === 'SYSA')!
    const pa1 = sys.planets.find((p) => p.planetId === 'PA1')!
    pa1.zone = 'Habitable'
    pa1.atmosphere = { ...(pa1.atmosphere ?? {}), atmosphereType: 'Standard' } as typeof pa1.atmosphere
    const rows = toResourceRows(m)
    const sysA = rows.filter((r) => r.systemId === 'SYSA')
    expect(sysA.every((r) => r.systemHabitable)).toBe(true)
    expect(sysA.filter((r) => r.bodyHabitable).every((r) => r.bodyId === 'PA1')).toBe(true)
    expect(sysA.some((r) => r.bodyId === 'PA1' && r.bodyHabitable)).toBe(true)
    expect(sysA.some((r) => r.bodyId !== 'PA1' && !r.bodyHabitable)).toBe(true)
    expect(sysA.filter((r) => r.sphere === 'star').every((r) => !r.bodyHabitable)).toBe(true)
    expect(rows.filter((r) => r.systemId !== 'SYSA').every((r) => !r.systemHabitable)).toBe(true)
  })
})

describe('toBodyRows', () => {
  const rows = toBodyRows(map)
  const row = (id: string) => rows.find((r) => r.id === id)!
  it('emits one row per planet in every system', () => {
    expect(rows.map((r) => r.id)).toEqual(['PA1', 'PA2', 'PA3', 'PA4', 'PB1'])
  })
  it('fills habitability columns', () => {
    expect(row('PA1')).toMatchObject({
      systemName: 'Aldera',
      bodyName: 'Aldera I',
      bodyType: 'Planet',
      orbitalZone: 'Habitable',
      diameterM: 15600,
      gravity: 11.89,
      atmosphereType: 'Exotic',
      atmosphereDensityPct: 77,
      liquidPct: 77,
      liquidType: 'Water',
      flora: false,
      fauna: true,
      resourceZones: 4,
      inhabited: true,
      inhabitingEmpires: ['House Test'],
    })
  })
  it('uses hydrosphere size and gravity for gas giants', () => {
    expect(row('PA3')).toMatchObject({ diameterM: 64000, gravity: 48.77 })
  })
  it('leaves absent data undefined and non-inhabited systems unflagged', () => {
    const ring = row('PA4')
    expect(ring.gravity).toBeUndefined()
    expect(ring.atmosphereType).toBeUndefined()
    expect(ring.liquidPct).toBeUndefined()
    expect(ring.flora).toBeUndefined()
    expect(ring.ringRadiusM).toBe(54700)
    expect(row('PB1')).toMatchObject({ inhabited: false, inhabitingEmpires: [] })
  })
})

describe('toSystemRows', () => {
  const rows = toSystemRows(map)
  it('emits one row per system including unexplored and deep space', () => {
    expect(rows.map((r) => r.id)).toEqual(['SYSA', 'SYSB', 'SYSC', 'SYSD'])
  })
  it('summarises a system', () => {
    expect(rows[0]).toMatchObject({
      name: 'Aldera',
      catalog: "XQL'A'B'a",
      sectorName: 'Alpha Sector',
      eod: 'Surveyed',
      starTypes: ['G Yellow', 'Neutron Star'],
      starTypesText: 'G Yellow, Neutron Star',
      planetCount: 4,
      cityCount: 2,
      inhabited: true,
      inhabitingEmpires: ['House Test'],
      wormholeCount: 2,
    })
    expect(rows[3]).toMatchObject({ eod: 'Unexplored', planetCount: 0, starTypes: [], inhabited: false })
  })
})

const ARC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<starmap empireId="7" empire="House Test" createDate="Sat Nov 21 17:25:58 2026 GMT">
  <galaxy name="Test Galaxy">
    <sector sectorId="SEC1" name="Alpha Sector" x="1" y="1" z="1">
      <system systemId="RW1" name="Ringy" x="1.0" y="2.0" z="3.0" eod="Surveyed">
        <star starId="RS" name="Ringy" type="G Yellow" orbit="Primary" size="V Main Sequence" hab="Habitable Zone at 1.5au" shell="Photosphere" diameter="0.2au Diameter">
          <resource name="Type G Preons" quality="100" abundance="4"/>
        </star>
        <planet planetId="RA1" name="Ringy Arc 1" bodyType="Ringworld Arc 1" orbit="Orbiting Ringy at 83,400m 90°" zone="Habitable Zone">
          <geosphere diameter="83400m Radius" gravity="9.81m/s² Sea Level Gravity" resourceZones="1">
            <resource name="Ore" qualityZone1="100" abundanceZone1="2"/>
          </geosphere>
          <atmosphere composition="Standard, 100% Density"/>
        </planet>
        <planet planetId="RA2" name="Ringy Arc 2" bodyType="Ringworld Arc 2" orbit="Orbiting Ringy at 83,400m 180°" zone="Habitable Zone">
          <geosphere diameter="83400m Radius" gravity="9.81m/s² Sea Level Gravity" resourceZones="1"/>
        </planet>
        <planet planetId="RP" name="Ringy I" bodyType="Planet" orbit="Orbiting Ringy at 1au 10°" zone="Inner Zone">
          <geosphere diameter="9,000m Diameter" gravity="5.00m/s² Sea Level Gravity" resourceZones="1"/>
        </planet>
      </system>
      <system systemId="PL1" name="Plain" x="2.0" y="2.0" z="3.0" eod="Surveyed">
        <planet planetId="PP" name="Plain I" bodyType="Planet" orbit="Orbiting Plain at 1au 10°" zone="Inner Zone">
          <geosphere diameter="9,000m Diameter" gravity="5.00m/s² Sea Level Gravity" resourceZones="1">
            <resource name="Ore" qualityZone1="50" abundanceZone1="2"/>
          </geosphere>
        </planet>
      </system>
    </sector>
  </galaxy>
</starmap>`

describe('ringworld detection (R1)', () => {
  const rw = parseStarMap(ARC_XML)
  it('helpers', () => {
    expect(isRingworldBody('Ringworld Arc 3')).toBe(true)
    expect(isRingworldBody('Ring')).toBe(false)
    expect(isRingworldBody('Planet')).toBe(false)
    expect(foldBodyType('Ringworld Arc 12')).toBe('Ringworld Arc')
    expect(foldBodyType('Moon')).toBe('Moon')
  })
  it('parses the arc strings', () => {
    const arc = rw.systems[0]!.planets[0]!
    expect(arc.geosphere).toMatchObject({ radiusM: 83400, gravity: 9.81, gravityKind: 'sea-level' })
    expect(arc.orbit).toMatchObject({ orbitingName: 'Ringy', distance: 83400, unit: 'm', deg: 90 })
  })
  it('flags body rows', () => {
    const rows = toBodyRows(rw)
    expect(rows.map((r) => [r.id, r.isRingworld, r.hasRingworld])).toEqual([
      ['RA1', true, true],
      ['RA2', true, true],
      ['RP', false, true],
      ['PP', false, false],
    ])
  })
  it('flags resource and system rows', () => {
    const rows = toResourceRows(rw)
    const star = rows.find((r) => r.bodyId === 'RS')!
    expect([star.isRingworld, star.hasRingworld]).toEqual([false, true])
    const ore = rows.find((r) => r.bodyId === 'RA1')!
    expect([ore.isRingworld, ore.hasRingworld]).toEqual([true, true])
    const plain = rows.find((r) => r.bodyId === 'PP')!
    expect([plain.isRingworld, plain.hasRingworld]).toEqual([false, false])
    expect(toSystemRows(rw).map((r) => [r.id, r.hasRingworld])).toEqual([['RW1', true], ['PL1', false]])
  })
})

describe('ringworld arc order (R7)', () => {
  const b = (name: string, bodyType: string) => ({ name, bodyType })
  it('reads the arc number', () => {
    expect(ringworldArcNumber('Ringworld Arc 11')).toBe(11)
    expect(ringworldArcNumber('Ringworld Arc')).toBe(Infinity)
  })
  it('orders arcs by number in their own slots, leaving other bodies in place', () => {
    const list = [
      b('P', 'Planet'),
      b('A3', 'Ringworld Arc 3'),
      b('A10', 'Ringworld Arc 10'),
      b('M', 'Moon'),
      b('A1', 'Ringworld Arc 1'),
      b('A2', 'Ringworld Arc 2'),
    ]
    expect(orderRingworldArcs(list).map((x) => x.name)).toEqual(['P', 'A1', 'A2', 'M', 'A3', 'A10'])
    expect(list[1]!.name).toBe('A3') // input untouched
  })
})
