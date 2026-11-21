import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseStarMap } from './parse'
import { toBodyRows, toResourceRows, toSystemRows } from './rows'
import type { StarMap } from './types'

// Local-only: the sample export is never committed. Skipped when absent.
const samplePath = path.resolve(import.meta.dirname, '../../../sample/starmap.xml')

describe.skipIf(!existsSync(samplePath))('full sample starmap', () => {
  let map: StarMap
  let parseMs = 0

  beforeAll(() => {
    const xml = readFileSync(samplePath, 'utf8')
    const t0 = performance.now()
    map = parseStarMap(xml)
    parseMs = performance.now() - t0
    console.log(`parseStarMap(sample): ${parseMs.toFixed(0)} ms`)
  }, 60_000)

  const planets = () => map.systems.flatMap((s) => s.planets)

  it('has the expected structure counts', () => {
    expect(map.sectors).toHaveLength(70)
    expect(map.systems).toHaveLength(1009)
    expect(map.systems.flatMap((s) => s.stars)).toHaveLength(1521)
    expect(planets()).toHaveLength(2496)
    expect(map.systems.flatMap((s) => s.wormholes)).toHaveLength(910)
    expect(map.systems.flatMap((s) => s.wormholes).filter((w) => w.destSystemId === undefined)).toHaveLength(59)
  })

  it('parses fast enough', () => {
    expect(parseMs).toBeLessThan(10_000)
  })

  it('has 63,762 resource rows and 61 distinct resource names', () => {
    const rows = toResourceRows(map)
    expect(rows).toHaveLength(63_762)
    expect(new Set(rows.map((r) => r.resource)).size).toBe(61)
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(rows.every((r) => r.bestQuality >= 1 && r.bestQuality <= 255)).toBe(true)
  })

  it('counts bodies by resource zones 1/2/3/4', () => {
    const count = (n: number) => planets().filter((p) => p.geosphere?.resourceZones === n).length
    expect([count(1), count(2), count(3), count(4)]).toEqual([1590, 181, 586, 139])
  })

  it('has the documented body types and orbital zones', () => {
    expect(new Set(planets().map((p) => p.bodyType))).toEqual(
      new Set(['Moon', 'Planet', 'Gas Giant', 'Planetoid', 'Titan', 'Ring']),
    )
    expect(new Set(planets().map((p) => p.zone))).toEqual(
      new Set(['Inferno', 'Inner', 'Habitable', 'Outer', 'Frigid', 'Penumbral']),
    )
  })

  it('derives body and system rows', () => {
    expect(toBodyRows(map)).toHaveLength(2496)
    expect(toSystemRows(map)).toHaveLength(1009)
  })

  it('parses every display string it can (no silent misses)', () => {
    const bad: string[] = []
    for (const p of planets()) {
      if (p.geosphere?.diameterRaw && p.geosphere.diameterM === undefined && p.geosphere.radiusM === undefined) bad.push(p.geosphere.diameterRaw)
      if (p.geosphere?.gravityRaw && p.geosphere.gravity === undefined) bad.push(p.geosphere.gravityRaw)
      if (p.hydrosphere?.surfaceLiquidRaw && p.hydrosphere.liquidPct === undefined) bad.push(p.hydrosphere.surfaceLiquidRaw)
      if (p.atmosphere?.compositionRaw && p.atmosphere.densityPct === undefined) bad.push(p.atmosphere.compositionRaw)
      if (p.orbit.au === undefined) bad.push(p.orbit.raw)
    }
    for (const s of map.systems.flatMap((x) => x.stars)) {
      if (s.diameterAu === undefined) bad.push(s.diameterRaw)
      if (s.surfaceTempRaw && s.surfaceTempK === undefined) bad.push(s.surfaceTempRaw)
    }
    expect(bad).toEqual([])
  })
})
