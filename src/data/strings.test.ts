import { describe, expect, it } from 'vitest'
import {
  parseAtmosphere,
  parseDiameter,
  parseGravity,
  parseHabitableZone,
  parseNumber,
  parseOrbit,
  parseSurfaceLiquid,
  parseTemperatureK,
  parseZone,
} from './strings'

describe('parseNumber', () => {
  it('handles thousands separators and decimals', () => {
    expect(parseNumber('15,600')).toBe(15600)
    expect(parseNumber('0.23')).toBe(0.23)
    expect(parseNumber('1,234,567.5')).toBe(1234567.5)
  })
  it('returns undefined, never NaN', () => {
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('abc')).toBeUndefined()
    expect(parseNumber(undefined)).toBeUndefined()
  })
})

describe('parseDiameter', () => {
  it('parses meters with thousands separators', () => {
    expect(parseDiameter('15,600m Diameter')).toEqual({ meters: 15600 })
  })
  it('parses meters without separators', () => {
    expect(parseDiameter('6000m Diameter')).toEqual({ meters: 6000 })
  })
  it('parses au', () => {
    expect(parseDiameter('0.23au Diameter')).toEqual({ au: 0.23 })
    expect(parseDiameter('3au Diameter')).toEqual({ au: 3 })
  })
  it('parses ring radius and width', () => {
    expect(parseDiameter('54700m Radius<br>15200m Width')).toEqual({ radiusM: 54700, widthM: 15200 })
  })
  it('returns undefined when unparseable', () => {
    expect(parseDiameter('huge')).toBeUndefined()
    expect(parseDiameter(undefined)).toBeUndefined()
  })
})

describe('parseGravity', () => {
  it('parses sea level gravity', () => {
    expect(parseGravity('11.89m/s² Sea Level Gravity')).toEqual({ value: 11.89, kind: 'sea-level' })
  })
  it('parses core gravity', () => {
    expect(parseGravity('5548.88m/s² Core Gravity')).toEqual({ value: 5548.88, kind: 'core' })
  })
  it('handles separators', () => {
    expect(parseGravity('1,234.50m/s² Sea Level Gravity')?.value).toBe(1234.5)
  })
  it('returns undefined when unparseable', () => {
    expect(parseGravity('heavy')).toBeUndefined()
  })
})

describe('parseSurfaceLiquid', () => {
  it('parses generic liquid', () => {
    expect(parseSurfaceLiquid('77% Surface Liquid')).toEqual({ pct: 77, liquid: 'Liquid' })
  })
  it('parses water and lava', () => {
    expect(parseSurfaceLiquid('12% Surface Water')).toEqual({ pct: 12, liquid: 'Water' })
    expect(parseSurfaceLiquid('100% Surface Lava')).toEqual({ pct: 100, liquid: 'Lava' })
  })
  it('parses none as 0', () => {
    expect(parseSurfaceLiquid('No Surface Liquid')).toEqual({ pct: 0, liquid: 'Liquid' })
    expect(parseSurfaceLiquid('No Surface Lava')).toEqual({ pct: 0, liquid: 'Lava' })
  })
  it('returns undefined when unparseable', () => {
    expect(parseSurfaceLiquid('wet')).toBeUndefined()
  })
})

describe('parseAtmosphere', () => {
  it('parses type and density', () => {
    expect(parseAtmosphere('Exotic, 77% Density')).toEqual({ type: 'Exotic', densityPct: 77 })
    expect(parseAtmosphere('Standard, 17.5% Density')).toEqual({ type: 'Standard', densityPct: 17.5 })
  })
  it('parses no atmosphere', () => {
    expect(parseAtmosphere('No Atmosphere')).toEqual({ type: 'None', densityPct: 0 })
  })
  it('returns undefined when unparseable', () => {
    expect(parseAtmosphere('thick')).toBeUndefined()
  })
})

describe('parseOrbit', () => {
  it('parses au orbits', () => {
    expect(parseOrbit('Orbiting Caladan Alpha at 0.5au 108°')).toEqual({
      raw: 'Orbiting Caladan Alpha at 0.5au 108°',
      orbitingName: 'Caladan Alpha',
      distance: 0.5,
      unit: 'au',
      au: 0.5,
      deg: 108,
    })
  })
  it('parses parsec orbits and converts to au', () => {
    const o = parseOrbit('Orbiting Sol at 2pc 10°')
    expect(o).toMatchObject({ unit: 'pc', distance: 2, deg: 10 })
    expect(o.au).toBeCloseTo(2 * 206264.806, 3)
  })
  it('parses meter orbits and converts to au', () => {
    const o = parseOrbit("Orbiting MQL'HC'CF'e II at 83,400m 257°")
    expect(o.orbitingName).toBe("MQL'HC'CF'e II")
    expect(o.distance).toBe(83400)
    expect(o.unit).toBe('m')
    expect(o.au).toBeCloseTo(83400 / 149597870700, 12)
    expect(o.deg).toBe(257)
  })
  it('handles names containing " at "', () => {
    expect(parseOrbit('Orbiting Mount at Base at 2au 3°').orbitingName).toBe('Mount at Base')
  })
  it('Primary has no parsed fields', () => {
    expect(parseOrbit('Primary')).toEqual({ raw: 'Primary' })
  })
  it('keeps raw when unparseable', () => {
    expect(parseOrbit('Somewhere odd')).toEqual({ raw: 'Somewhere odd' })
  })
})

describe('parseTemperatureK', () => {
  it('parses', () => {
    expect(parseTemperatureK('6,755°K')).toBe(6755)
    expect(parseTemperatureK('714°K')).toBe(714)
  })
  it('returns undefined when unparseable', () => {
    expect(parseTemperatureK('warm')).toBeUndefined()
    expect(parseTemperatureK(undefined)).toBeUndefined()
  })
})

describe('parseHabitableZone', () => {
  it('parses distance', () => {
    expect(parseHabitableZone('Habitable Zone at 1.5au')).toBe(1.5)
  })
  it('returns undefined for no habitable zone variants', () => {
    expect(parseHabitableZone('No Habitable Zone - Too Cool')).toBeUndefined()
    expect(parseHabitableZone('No Habitable Zone')).toBeUndefined()
  })
})

describe('parseZone', () => {
  it('strips the Zone suffix', () => {
    expect(parseZone('Inferno Zone')).toBe('Inferno')
    expect(parseZone('Penumbral Zone')).toBe('Penumbral')
  })
  it('leaves other text alone', () => {
    expect(parseZone('Deep Space')).toBe('Deep Space')
  })
})
